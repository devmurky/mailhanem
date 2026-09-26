"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  DURUMLAR,
  KATEGORILER,
  firmaKullanicilari,
  kategoriYaz,
  firmaKutusu,
  gunlukYaz,
  kullaniciEkle,
  kullaniciDurumYaz,
  mailDurumYaz,
  mailGetir,
  mailNotuEkle,
  mailNotuSil,
  rolYaz,
  sahipYaz,
  taslakSil,
  taslakYaz,
  vipYaz,
  yanitEkle,
  type Kullanici,
} from "@/sunucu/db";
import { yanitGonder, yanitKonusu } from "@/sunucu/posta/yanit";
import { davetSemasi, hatalar } from "@/sunucu/dogrula";
import { davetPostasiGonder } from "@/sunucu/girisPostasi";
import { panelOturumu } from "./yetki";

/**
 * Sunucu eylemlerinin argümanları da dışarıdan gelir: tarayıcıdaki bileşen
 * ne gönderirse onu alırız. O yüzden her eylem önce oturumu, sonra girdiyi
 * doğrular — ve maili firma sınırıyla birlikte arar.
 */

const mailIdSemasi = z.coerce.number().int().positive();
const kategoriSemasi = z.enum(KATEGORILER).nullable();
const durumSemasi = z.enum(DURUMLAR);
const rolSemasi = z.enum(["yonetici", "personel"]);

/** Maili firma sınırı içinde bulur; bulamazsa eylem hiç çalışmaz. */
async function mailIcin(hamId: unknown) {
  const oturum = await panelOturumu();
  const mailId = mailIdSemasi.parse(hamId);
  const mail = mailGetir(mailId, oturum.firmaId);
  if (!mail) throw new Error("Mail bulunamadı.");
  return { ...oturum, mail };
}

function tazele(mailId: number): void {
  revalidatePath("/panel");
  revalidatePath(`/panel/mail/${mailId}`);
}

export async function sahiplen(hamId: unknown): Promise<void> {
  const { firmaId, kullanici, mail } = await mailIcin(hamId);
  sahipYaz(mail.id, firmaId, kullanici.id);
  /* Sahiplenmek işe başlamaktır; mail "yeni" kalırsa kuyruk yanlış okunur. */
  if (mail.durum === "yeni") mailDurumYaz(mail.id, firmaId, "islemde");
  tazele(mail.id);
}

export async function sahipBirak(hamId: unknown): Promise<void> {
  const { firmaId, mail } = await mailIcin(hamId);
  sahipYaz(mail.id, firmaId, null);
  tazele(mail.id);
}

/** Devretme. Hedef kişi aynı firmanın kullanıcısı değilse eylem reddedilir. */
export async function sahipAta(hamId: unknown, hamKisi: unknown): Promise<void> {
  const { firmaId, mail } = await mailIcin(hamId);
  const kisiId = mailIdSemasi.parse(hamKisi);
  const ekip = firmaKullanicilari(firmaId, true);
  if (!ekip.some((k: Kullanici) => k.id === kisiId)) throw new Error("Bu kişi ekipte değil.");

  sahipYaz(mail.id, firmaId, kisiId);
  if (mail.durum === "yeni") mailDurumYaz(mail.id, firmaId, "islemde");
  tazele(mail.id);
}

/**
 * Kategori şimdilik elle seçilir. Yapay zekâ adımı bağlandığında aynı sütunu
 * önceden dolduracak; seçim yine kişide kalacak.
 */
export async function kategoriSec(hamId: unknown, hamKategori: unknown): Promise<void> {
  const { firmaId, mail } = await mailIcin(hamId);
  const kategori = kategoriSemasi.parse(hamKategori === "" ? null : hamKategori);
  kategoriYaz(mail.id, firmaId, kategori);
  tazele(mail.id);
}

export async function durumSec(hamId: unknown, hamDurum: unknown): Promise<void> {
  const { firmaId, mail } = await mailIcin(hamId);
  mailDurumYaz(mail.id, firmaId, durumSemasi.parse(hamDurum));
  tazele(mail.id);
}

/**
 * Rol değişimi. Yalnızca sahip dağıtır, kendi rolüne dokunamaz ve sahiplik
 * bu ekrandan devredilmez — firmayı sahipsiz bırakacak bir tıklama olmasın.
 */
export async function rolDegistir(hamKisi: unknown, hamRol: unknown): Promise<void> {
  const { firmaId, kullanici } = await panelOturumu();
  if (kullanici.rol !== "sahip") throw new Error("Rolleri yalnızca firma sahibi değiştirebilir.");

  const kisiId = mailIdSemasi.parse(hamKisi);
  if (kisiId === kullanici.id) throw new Error("Kendi rolünüzü değiştiremezsiniz.");

  const hedef = firmaKullanicilari(firmaId).find((k: Kullanici) => k.id === kisiId);
  if (!hedef) throw new Error("Bu kişi ekipte değil.");
  if (hedef.rol === "sahip") throw new Error("Sahiplik bu ekrandan devredilmez.");

  rolYaz(kisiId, firmaId, rolSemasi.parse(hamRol));
  revalidatePath("/panel/ekip");
}

export type DavetDurumu = {
  tamam?: string;
  /** SMTP kapalıyken bağlantı burada döner; davet eden elden iletebilsin diye. */
  baglanti?: string;
  hata?: string;
  alanlar?: Record<string, string>;
};

/**
 * Ekibe yeni kişi. Sahip ve yönetici davet edebilir — rol açıklamasındaki
 * "ekip üyesi davet eder" yetkisi bu. Davet edilen kişi kaydedilir ve ona
 * tek kullanımlık bir giriş bağlantısı gider; şifre yok, ayrı bir kabul
 * adımı da yok.
 */
export async function ekibeDavet(
  _onceki: DavetDurumu,
  veri: FormData,
): Promise<DavetDurumu> {
  const { kullanici, firma, firmaId } = await panelOturumu();
  if (kullanici.rol !== "sahip" && kullanici.rol !== "yonetici") {
    return { hata: "Ekibe davet etmek için yönetici olmanız gerekiyor." };
  }

  const sonuc = davetSemasi.safeParse({
    eposta: veri.get("eposta"),
    ad: veri.get("ad"),
    rol: veri.get("rol"),
  });
  if (!sonuc.success) return { alanlar: hatalar(sonuc.error) };

  const yeni = kullaniciEkle(firmaId, sonuc.data.eposta, sonuc.data.ad, sonuc.data.rol);
  if (!yeni) {
    return {
      alanlar: {
        eposta:
          "Bu adres sistemde kayıtlı. Kendi ekibinizdeyse listede görünüyordur; " +
          "değilse kurulum ekibinize yazın.",
      },
    };
  }

  const davet = await davetPostasiGonder(yeni, kullanici.ad || kullanici.eposta, firma.ad);
  gunlukYaz(
    "kurulum",
    `${yeni.eposta} ekibe davet edildi (${sonuc.data.rol})` +
      (davet.gonderildi ? "" : " — davet maili gönderilemedi"),
    firmaId,
  );
  revalidatePath("/panel/ekip");

  return davet.gonderildi
    ? { tamam: `${yeni.eposta} adresine davet gönderildi.` }
    : {
        tamam: `${yeni.eposta} ekibe eklendi ama davet maili gönderilemedi.`,
        baglanti: davet.baglanti,
      };
}

/**
 * Ekipten çıkarma ve geri alma.
 *
 * Kayıt silinmiyor, kapatılıyor: silseydik o kişinin sahiplendiği maillerin
 * geçmişi "kimse"ye dönerdi. Kapatılan kişinin açık oturumları aynı anda
 * düşüyor — erişim hemen kesiliyor.
 *
 * Sahip kapatılamaz ve kimse kendini kapatamaz: firmayı yöneticisiz bırakacak
 * ya da kişiyi kendi panelinden atacak bir tıklama olmasın.
 */
export async function ekipDurumu(hamKisi: unknown, hamDurum: unknown): Promise<void> {
  const { kullanici, firmaId } = await panelOturumu();
  if (kullanici.rol !== "sahip" && kullanici.rol !== "yonetici") {
    throw new Error("Bunun için yönetici olmanız gerekiyor.");
  }

  const kisiId = mailIdSemasi.parse(hamKisi);
  if (kisiId === kullanici.id) throw new Error("Kendi hesabınızı kapatamazsınız.");

  const durum = z.enum(["etkin", "kapali"]).parse(hamDurum);
  const hedef = firmaKullanicilari(firmaId).find((k: Kullanici) => k.id === kisiId);
  if (!hedef) throw new Error("Bu kişi ekipte değil.");
  if (hedef.rol === "sahip") throw new Error("Firma sahibinin hesabı bu ekrandan kapatılmaz.");

  kullaniciDurumYaz(kisiId, firmaId, durum);
  gunlukYaz(
    "kurulum",
    durum === "kapali"
      ? `${hedef.eposta} ekipten çıkarıldı`
      : `${hedef.eposta} erişimi geri açıldı`,
    firmaId,
  );
  revalidatePath("/panel/ekip");
}

export type YanitDurumu = {
  tamam?: string;
  hata?: string;
  /** Gönderilemeyen metin formda kalsın; kullanıcı yazdığını kaybetmesin. */
  taslak?: string;
};

/**
 * Yanıt gönderme.
 *
 * Yanıt firmanın kendi kutusundan çıkar. Onay basamağı yok: taslağı yazan da
 * gönderen de aynı kişi, araya koyacak bir "yapay zekâ önerisi" henüz yok.
 * Model adımı geldiğinde onay şartı da o zaman anlam kazanacak.
 *
 * Gönderim başarısız olursa mail "yanıtlandı" olmuyor ve yazılan metin
 * kullanıcıya geri veriliyor.
 */
export async function yanitla(_onceki: YanitDurumu, veri: FormData): Promise<YanitDurumu> {
  const { kullanici, firmaId } = await panelOturumu();

  const mailId = mailIdSemasi.parse(veri.get("mail_id"));
  const metin = String(veri.get("metin") ?? "").trim();
  const alintiEkle = veri.get("alinti") === "1";

  if (metin.length < 2) return { hata: "Yanıt boş görünüyor.", taslak: metin };
  if (metin.length > 20000) return { hata: "Yanıt fazla uzun.", taslak: metin };

  const mail = mailGetir(mailId, firmaId);
  if (!mail) return { hata: "Mail bulunamadı." };

  const kutu = firmaKutusu(mail.kutu_id, firmaId);
  if (!kutu) return { hata: "Mailin kutusu bulunamadı.", taslak: metin };

  const sonuc = await yanitGonder(kutu, mail, metin, kullanici.ad, alintiEkle);

  yanitEkle({
    mail_id: mail.id,
    firma_id: firmaId,
    kullanici_id: kullanici.id,
    kime: mail.gonderen,
    konu: yanitKonusu(mail.konu),
    metin,
    mesaj_kimlik: sonuc.mesajKimlik ?? "",
    hata: sonuc.tamam ? null : (sonuc.hata ?? "Gönderilemedi."),
  });

  if (!sonuc.tamam) {
    gunlukYaz("hata", `Yanıt gönderilemedi (${mail.gonderen}): ${sonuc.hata}`, firmaId);
    revalidatePath(`/panel/mail/${mail.id}`);
    return { hata: sonuc.hata ?? "Yanıt gönderilemedi.", taslak: metin };
  }

  /* Sahipsiz bir maile yanıt yazan kişi onu üstlenmiş sayılır. */
  if (mail.sahip_id === null) sahipYaz(mail.id, firmaId, kullanici.id);
  /* Metin gitti: saklanan taslak artık kendi kopyasının hayaleti (madde 3). */
  taslakSil(mail.id, firmaId, kullanici.id);
  mailDurumYaz(mail.id, firmaId, "yanitlandi");
  tazele(mail.id);
  return { tamam: `${mail.gonderen} adresine gönderildi.` };
}

/* ══════════════════════════════════════════════════════════
   Yanıt taslağı (madde 3)

   Yazarken kendiliğinden kaydediliyor. İki karar:

   1. **`revalidatePath` yok.** Taslak kaydı sayfayı tazelemez; tazeleseydi
      her birkaç saniyede bir textarea'nın altındaki her şey yeniden
      çizilirdi ve yazarken imleç oynardı.
   2. **Taslak kişiye ait.** Anahtar (mail, kullanıcı); aynı maile yazan iki
      kişi birbirinin metnini ezmiyor.
   ══════════════════════════════════════════════════════════ */

export type TaslakSonucu = { damga?: string; hata?: string };

export async function taslakKaydet(hamId: unknown, hamMetin: unknown): Promise<TaslakSonucu> {
  const { kullanici, firmaId } = await panelOturumu();
  const mailId = mailIdSemasi.parse(hamId);
  const mail = mailGetir(mailId, firmaId);
  if (!mail) return { hata: "Mail bulunamadı." };

  /* Yanıtın kendi sınırı 20 000; taslak onun altında kalmalı ki kaydedilen
     bir metin gönderilemez hâle gelmesin. */
  const metin = String(hamMetin ?? "").slice(0, 20000);
  return { damga: taslakYaz(mail.id, firmaId, kullanici.id, metin) };
}

/**
 * VIP işareti. Maile değil **gönderenin adresine** bağlanıyor: aynı kişiden
 * gelen bütün mailler — bundan sonrakiler dahil — öne çıkıyor.
 *
 * Ekipteki herkes işaretleyebilir; "bu müşteri önemli" bilgisi kuruluma değil
 * işi yapana ait.
 */
export async function vipIsaretle(hamId: unknown, vip: boolean): Promise<void> {
  const { firmaId, kullanici, mail } = await mailIcin(hamId);
  vipYaz(firmaId, mail.gonderen, Boolean(vip), kullanici.id);
  revalidatePath("/panel");
  revalidatePath(`/panel/mail/${mail.id}`);
}

/* ══════════════════════════════════════════════════════════
   Ekip içi notlar (madde 14)

   Yanıttan ayrı bir şey: bu metin hiçbir zaman gönderilmez. Firma sınırı
   burada da oturumdan geliyor ve mail numarası sınırla birlikte aranıyor.
   ══════════════════════════════════════════════════════════ */

export type NotDurumu = { hata?: string };

const notSemasi = z.object({
  mailId: z.coerce.number().int().positive(),
  metin: z.string().trim().min(1, "Boş not eklenemez.").max(4000),
});

export async function notEkle(_onceki: NotDurumu, veri: FormData): Promise<NotDurumu> {
  const { kullanici, firmaId } = await panelOturumu();

  const sonuc = notSemasi.safeParse({
    mailId: veri.get("mail_id"),
    metin: veri.get("metin"),
  });
  if (!sonuc.success) return { hata: sonuc.error.issues[0]?.message ?? "Not okunamadı." };

  const mail = mailGetir(sonuc.data.mailId, firmaId);
  if (!mail) return { hata: "Mail bulunamadı." };

  mailNotuEkle(mail.id, firmaId, kullanici.id, sonuc.data.metin);
  revalidatePath("/panel");
  revalidatePath(`/panel/mail/${mail.id}`);
  return {};
}

/** Yalnız kendi notu: sorgunun koşulunda hem firma hem yazan var. */
export async function notSil(notId: number, mailId: number): Promise<void> {
  const { kullanici, firmaId } = await panelOturumu();
  mailNotuSil(notId, firmaId, kullanici.id);
  revalidatePath("/panel");
  revalidatePath(`/panel/mail/${mailId}`);
}

/* ══════════════════════════════════════════════════════════
   Toplu işlem (madde 12)

   Tek tek yapılan işin aynısı, yalnız döngüde. Önemli olan kısayol
   yazmamak: her mail **aynı firma sınırından** geçiyor ve aynı doğrulamaya
   giriyor. "Hepsini güncelle" diye tek bir SQL yazmak, listeye başka firmanın
   numarası sıkıştıran birine bütün tabloyu açardı.
   ══════════════════════════════════════════════════════════ */

export type TopluDurum = { hata?: string; tamam?: string };

const topluSemasi = z.object({
  idler: z.array(z.coerce.number().int().positive()).min(1, "Hiç mail seçilmedi.").max(200),
  islem: z.enum(["sahiplen", "birak", "kapat", "islemde", "kategori"]),
  kategori: z.string().optional(),
});

export async function topluIslem(_onceki: TopluDurum, veri: FormData): Promise<TopluDurum> {
  const { kullanici, firmaId } = await panelOturumu();

  const sonuc = topluSemasi.safeParse({
    idler: veri.getAll("secili").map(String),
    islem: veri.get("islem"),
    kategori: veri.get("kategori") ?? undefined,
  });
  if (!sonuc.success) {
    return { hata: sonuc.error.issues[0]?.message ?? "Seçim okunamadı." };
  }

  const { idler, islem, kategori } = sonuc.data;
  if (islem === "kategori" && !KATEGORILER.includes(kategori as never)) {
    return { hata: "Tanınmayan kategori." };
  }

  let sayi = 0;
  let atlanan = 0;

  for (const id of idler) {
    /* Firma sınırı her mailde yeniden: liste dışarıdan geliyor. */
    const mail = mailGetir(id, firmaId);
    if (!mail) {
      atlanan++;
      continue;
    }

    if (islem === "sahiplen") {
      sahipYaz(mail.id, firmaId, kullanici.id);
      /* Tekil sahiplenmedeki davranışın aynısı: sahiplenen mail işleme girer. */
      if (mail.durum === "yeni") mailDurumYaz(mail.id, firmaId, "islemde");
    } else if (islem === "birak") {
      sahipYaz(mail.id, firmaId, null);
    } else if (islem === "kapat") {
      mailDurumYaz(mail.id, firmaId, "kapandi");
    } else if (islem === "islemde") {
      mailDurumYaz(mail.id, firmaId, "islemde");
    } else {
      kategoriYaz(mail.id, firmaId, kategori as string);
    }
    sayi++;
  }

  revalidatePath("/panel");

  const ek = atlanan ? ` ${atlanan} mail bulunamadı ve atlandı.` : "";
  return { tamam: `${sayi} mail güncellendi.${ek}` };
}

"use server";

import { revalidatePath } from "next/cache";
import {
  firmaKutusu,
  gunlukYaz,
  kutuEkle,
  kutuDurumYaz,
  kutuParolaYaz,
  kutulariGetir,
} from "@/sunucu/db";
import { anahtarVarMi, KasaHatasi, zarfla } from "@/sunucu/kasa";
import { hatalar, panelKutuSemasi, parolaSemasi } from "@/sunucu/dogrula";
import { baglantiyiDene } from "@/sunucu/posta/imap";
import { panelOturumu } from "../yetki";

/**
 * Kutu bağlama, müşterinin kendi elinde.
 *
 * Önceden bu yalnızca operatörde vardı ve firma her yeni kutu için kurulum
 * ekibini beklemek zorundaydı. Sunucu tarafı zaten hazırdı; tek eksik yetkiyi
 * firmaya açmaktı. **Firma numarası formdan değil oturumdan geliyor** —
 * başka firmaya kutu yazılamaz.
 *
 * Personel bu ekranı kullanamaz: kutu parolası kurulum bilgisidir.
 */
async function yoneticiOl() {
  const oturum = await panelOturumu();
  if (oturum.kullanici.rol !== "sahip" && oturum.kullanici.rol !== "yonetici") {
    throw new Error("Kutu ayarları için yönetici olmanız gerekiyor.");
  }
  return oturum;
}

export type KutuDurumu = {
  tamam?: string;
  hata?: string;
  alanlar?: Record<string, string>;
};

export async function kutuBagla(_onceki: KutuDurumu, veri: FormData): Promise<KutuDurumu> {
  const { firmaId } = await yoneticiOl();

  const sonuc = panelKutuSemasi.safeParse({
    adres: veri.get("adres"),
    saglayici: veri.get("saglayici"),
    imap_sunucu: veri.get("imap_sunucu"),
    imap_port: veri.get("imap_port"),
    smtp_sunucu: veri.get("smtp_sunucu"),
    smtp_port: veri.get("smtp_port"),
    kullanici_adi: veri.get("kullanici_adi"),
    parola: veri.get("parola"),
  });
  if (!sonuc.success) return { alanlar: hatalar(sonuc.error) };
  const k = sonuc.data;

  if (kutulariGetir(firmaId).some((v) => v.adres === k.adres)) {
    return { alanlar: { adres: "Bu kutu zaten bağlı." } };
  }

  if (!anahtarVarMi()) {
    return {
      hata:
        "Sunucuda şifreleme anahtarı tanımlı değil, parola güvenle saklanamaz. " +
        "Kutu bağlanmadı — kurulum ekibinize haber verin.",
    };
  }

  /* Çalışmayan bilgiyi kaydetmiyoruz: önce bağlanıp deniyoruz. */
  const deneme = await baglantiyiDene({
    sunucu: k.imap_sunucu,
    port: k.imap_port,
    kullanici: k.kullanici_adi || k.adres,
    parola: k.parola,
  });
  if (!deneme.tamam) return { hata: `Bağlantı kurulamadı: ${deneme.hata}` };

  try {
    const id = kutuEkle({
      firma_id: firmaId,
      adres: k.adres,
      saglayici: k.saglayici,
      imap_sunucu: k.imap_sunucu,
      imap_port: k.imap_port,
      smtp_sunucu: k.smtp_sunucu,
      smtp_port: k.smtp_port,
      kullanici_adi: k.kullanici_adi || k.adres,
      parola_sifreli: zarfla(k.parola),
    });
    kutuDurumYaz(id, "iyi");
    gunlukYaz("kurulum", `${k.adres} bağlandı (${k.imap_sunucu})`, firmaId);
    revalidatePath("/panel/hesaplar");
    revalidatePath("/panel");
    return { tamam: `${k.adres} bağlandı · kutuda ${deneme.adet} mail görünüyor` };
  } catch (e) {
    if (e instanceof KasaHatasi) return { hata: e.message };
    return { hata: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Parola güncelleme. Kopuk kutuların en sık sebebi parola değişikliği; yeni
 * parola da önce denenir, tutmazsa eskisi bozulmaz.
 */
export async function kutuParola(_onceki: KutuDurumu, veri: FormData): Promise<KutuDurumu> {
  const { firmaId } = await yoneticiOl();

  const sonuc = parolaSemasi.safeParse({
    kutu_id: veri.get("kutu_id"),
    parola: veri.get("parola"),
  });
  if (!sonuc.success) return { alanlar: hatalar(sonuc.error) };

  const kutu = firmaKutusu(sonuc.data.kutu_id, firmaId);
  if (!kutu) return { hata: "Kutu bulunamadı." };
  if (!anahtarVarMi()) return { hata: "Sunucuda şifreleme anahtarı tanımlı değil." };

  const deneme = await baglantiyiDene({
    sunucu: kutu.imap_sunucu,
    port: kutu.imap_port,
    kullanici: kutu.kullanici_adi || kutu.adres,
    parola: sonuc.data.parola,
  });
  if (!deneme.tamam) {
    return { hata: `Yeni parolayla da bağlanılamadı: ${deneme.hata}` };
  }

  try {
    kutuParolaYaz(kutu.id, firmaId, zarfla(sonuc.data.parola));
    gunlukYaz("kurulum", `${kutu.adres} parolası güncellendi`, firmaId);
    revalidatePath("/panel/hesaplar");
    return { tamam: `${kutu.adres} yeniden bağlandı.` };
  } catch (e) {
    if (e instanceof KasaHatasi) return { hata: e.message };
    return { hata: e instanceof Error ? e.message : String(e) };
  }
}

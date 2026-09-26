/**
 * Çekme işçisi: kaynaktan al → kuraldan geçir → veritabanına yaz.
 *
 * Elenen mail de yazılır ama `elendi` sütunu dolu olur. Sebebi şu: "neden
 * ücret ödemedim" ve "bu mail neden gelmedi" sorularının cevabı görünür
 * olmalı. Elenen mail modele gitmez; ücretlendirilen tek şey geçenlerdir.
 */
import {
  cekimBasla,
  cekimBitir,
  kutuDurumYaz,
  kutuGetir,
  ekEkle,
  mailEkle,
  gunlukYaz,
  konusmaCoz,
  mailIdBul,
  mailSinifla,
  sorgu,
  yonlendirmeEslesti,
  yonlendirmeleriGetir,
  type Kutu,
} from "../db.ts";
import { zarfiAc } from "../kasa.ts";
import { EK_SINIR, EK_TIPLERI, ekYaz } from "../ekDosya.ts";
import { DosyaKaynagi } from "./dosya.ts";
import { ImapKaynagi } from "./imap.ts";
import { kararVer } from "./kural.ts";
import { zincirKimlikleri } from "./konusma.ts";
import type { HamEk } from "./kaynak.ts";
import { yonlendir } from "./yonlendirme.ts";
import { ozetCikar, type MailKaynagi } from "./kaynak.ts";

export type CekimSonucu = {
  kutu: string;
  bulunan: number;
  yeni: number;
  elenen: number;
  hata?: string;
};

/**
 * Gövde panelde okunabilsin diye saklanıyor. Üst sınır var: tek bir mail
 * veritabanını şişirmesin, imzaya eklenmiş uzun yasal metinler satırları
 * kilitlemesin. Kesilen yerde bunu açıkça söylüyoruz.
 */
const GOVDE_SINIR = 20000;

/**
 * Gelen mailin eklerini diske ve künyeye yazar (madde 10).
 *
 * Üç kapı, ticket ekindekiyle aynı: tip beyaz listede mi, boyut sınırın
 * altında mı, dosya dolu mu. Buradaki fark, reddedilen ekin kullanıcıya
 * söylenemiyor olması — mail zaten geldi. O yüzden atlanan ek **günlüğe**
 * yazılıyor; "ek nerede" sorusunun cevabı bir yerde dursun.
 */
function ekleriSakla(mailId: number, firmaId: number, ekler: HamEk[]): void {
  for (const e of ekler) {
    if (!e.icerik.length) continue;

    if (!EK_TIPLERI.has(e.tip)) {
      gunlukYaz("posta", `Ek atlandı (tip kabul edilmiyor): ${e.ad} · ${e.tip}`, firmaId);
      continue;
    }
    if (e.boyut > EK_SINIR) {
      gunlukYaz("posta", `Ek atlandı (10 MB sınırı aşıldı): ${e.ad}`, firmaId);
      continue;
    }

    try {
      const dosya = ekYaz(e.icerik, e.tip);
      ekEkle({
        mailId,
        firmaId,
        ad: e.ad,
        tip: e.tip,
        boyut: e.boyut,
        dosya,
      });
    } catch (hata) {
      /* Diske yazılamayan ek maili düşürmüyor. */
      gunlukYaz(
        "hata",
        `Ek yazılamadı: ${e.ad} — ${hata instanceof Error ? hata.message : String(hata)}`,
        firmaId,
      );
    }
  }
}

function govdeKirp(metin: string): string {
  const duz = metin.replace(/\r\n/g, "\n").trimEnd();
  return duz.length <= GOVDE_SINIR
    ? duz
    : duz.slice(0, GOVDE_SINIR) + "\n\n[… mailin devamı kaydedilmedi]";
}

/** Firmanın kendi alan adları — iç yazışma kuralı bunlara bakar. */
function kendiAlanlar(kutu: Kutu): string[] {
  const firma = sorgu<{ alan_adi: string }>("SELECT alan_adi FROM firmalar WHERE id = ?", kutu.firma_id);
  const kutununAlani = kutu.adres.split("@")[1] ?? "";
  return [...firma.map((f) => f.alan_adi), kutununAlani].filter(Boolean);
}

/**
 * Kutu için kaynağı seçer.
 * `POSTA_KAYNAGI=dosya:<klasör>` verilirse gerçek IMAP yerine diskteki
 * `.eml` dosyaları okunur — canlı kutu olmadan hattı denemek için.
 */
export function kaynakSec(kutu: Kutu): MailKaynagi {
  const ayar = process.env.POSTA_KAYNAGI ?? "";
  if (ayar.startsWith("dosya:")) {
    return new DosyaKaynagi(ayar.slice("dosya:".length));
  }
  if (!kutu.parola_sifreli) {
    throw new Error(`${kutu.adres} için parola kayıtlı değil; kutu henüz kurulmadı.`);
  }
  return new ImapKaynagi({
    sunucu: kutu.imap_sunucu,
    port: kutu.imap_port,
    kullanici: kutu.kullanici_adi || kutu.adres,
    parola: zarfiAc(kutu.parola_sifreli),
  });
}

export async function kutuyuCek(kutuId: number, enFazla = 50): Promise<CekimSonucu> {
  const kutu = kutuGetir(kutuId);
  if (!kutu) throw new Error("Kutu bulunamadı.");

  const cekimId = cekimBasla(kutuId);
  const alanlar = kendiAlanlar(kutu);
  /* Kurallar tur başına bir kez okunuyor; her mail için sorgu atmıyoruz. */
  const kurallar = yonlendirmeleriGetir(kutu.firma_id, true);
  let bulunan = 0, yeni = 0, elenen = 0;

  try {
    const kaynak = kaynakSec(kutu);
    const mailler = await kaynak.cek(enFazla);
    bulunan = mailler.length;

    for (const m of mailler) {
      const karar = kararVer({
        gonderen: m.gonderen,
        konu: m.konu,
        basliklar: m.basliklar,
        kendiAlanlar: alanlar,
      });

      /* Konuşma zinciri (madde 2). Karar yazmadan önce veriliyor: yazıldıktan
         sonra bakılsaydı mail kendi kendisini ata olarak bulabilirdi. */
      const tarih = m.tarih.toISOString().replace("T", " ").slice(0, 19);
      const konusma =
        konusmaCoz({
          firmaId: kutu.firma_id,
          kutuId: kutu.id,
          kimlikler: zincirKimlikleri(m.basliklar),
          gonderen: m.gonderen,
          konu: m.konu,
          tarih,
        }) ?? m.mesajKimlik;

      const yazildi = mailEkle({
        kutu_id: kutu.id,
        firma_id: kutu.firma_id,
        mesaj_kimlik: m.mesajKimlik,
        konusma,
        uid: m.uid,
        gonderen_ad: m.gonderenAd,
        gonderen: m.gonderen,
        konu: m.konu,
        ozet: ozetCikar(m.metin),
        govde: govdeKirp(m.metin),
        tarih,
        elendi: karar.gecer ? null : karar.kural,
        eleme_sebep: karar.gecer ? "" : karar.sebep,
      });

      if (yazildi) {
        yeni++;

        /* Ekler yalnız **geçen** mailde saklanıyor: elenen mail bülten ya da
           otomatik yanıt, eki de kimsenin işine yaramıyor ve diski boşuna
           doldururdu. Bir ekin yazılamaması maili düşürmemeli — mail elde,
           eksik olan yalnız dosya. */
        if (karar.gecer && m.ekler.length) {
          const mailId = mailIdBul(kutu.id, m.mesajKimlik);
          if (mailId) ekleriSakla(mailId, kutu.firma_id, m.ekler);
        }

        if (karar.gecer) {
          /* Geçen mail sınıflandırılır: kategori ve sahip elle kurulmuş
             kurallardan gelir. Elenen maile dokunulmuyor — o zaten kimsenin
             işi değil. */
          const sonuc = yonlendir(kurallar, { gonderen: m.gonderen, konu: m.konu });
          const mailId = sonuc ? mailIdBul(kutu.id, m.mesajKimlik) : undefined;
          if (sonuc && mailId) {
            mailSinifla(mailId, kutu.firma_id, sonuc.kategori, sonuc.sahipId);
            yonlendirmeEslesti(sonuc.kuralId, kutu.firma_id);
          }
        } else {
          elenen++;
        }
      }
    }

    cekimBitir(cekimId, { bulunan, yeni, elenen });
    kutuDurumYaz(kutu.id, "iyi", new Date().toISOString().replace("T", " ").slice(0, 19));
    return { kutu: kutu.adres, bulunan, yeni, elenen };
  } catch (e) {
    const hata = e instanceof Error ? e.message : String(e);
    cekimBitir(cekimId, { bulunan, yeni, elenen, hata });
    kutuDurumYaz(kutu.id, "kopuk");
    gunlukYaz("hata", `${kutu.adres} çekilemedi: ${hata}`, kutu.firma_id);
    return { kutu: kutu.adres, bulunan, yeni, elenen, hata };
  }
}

/** Bütün kutuları sırayla çeker. Zamanlayıcı gelene kadar elle tetikleniyor. */
export async function hepsiniCek(enFazla = 50): Promise<CekimSonucu[]> {
  const kutular = sorgu<{ id: number }>("SELECT id FROM kutular ORDER BY id");
  const sonuc: CekimSonucu[] = [];
  for (const k of kutular) sonuc.push(await kutuyuCek(k.id, enFazla));
  return sonuc;
}

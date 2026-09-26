/**
 * Geciken sahipsiz mail bildirimi (madde 13).
 *
 * Panelin bütün uyarısı bugün ekranda: kimse panele bakmazsa geciken mail
 * geciktiğini kendine saklıyor. Bu modül, 24 saati geçmiş ve hâlâ kimsenin
 * üstünde olmayan mailleri toplayıp firmanın ekibine tek bir özet mail
 * gönderiyor.
 *
 * ── Üç karar ──────────────────────────────────────────────
 *
 * 1. **Mail başına değil, firma başına tek özet.** On geciken mail on ayrı
 *    bildirim demek olsaydı, bildirim de tıpkı maillerin kendisi gibi göz ardı
 *    edilen bir yığına dönerdi.
 * 2. **Aynı firmaya günde bir kez.** Son gönderim damgası `ayarlar` tablosunda;
 *    zamanlayıcı saatte bir dönse bile ikinci mail çıkmıyor.
 * 3. **SMTP kapalıysa hiçbir şey olmuyor** ve kimseye "gönderdim" denmiyor —
 *    `gonder()` zaten `gercek: false` dönüyor, damga da atılmıyor ki açıldığında
 *    bildirim gerçekten gitsin.
 *
 * Alıcı: firmanın **etkin** kullanıcıları. Kapatılmış kişiye bildirim gitmiyor.
 */
import { ayarOku, ayarYaz, db, gunlukYaz, type Kullanici } from "./db.ts";
import { gonder } from "./posta/gonderim.ts";
import { uygulamaKoku } from "./koku.ts";

/** Kaç saat sonra "geciken" sayılıyor — gelen kutusundaki sekmeyle aynı ölçü. */
const GECIKME_SAAT = 24;

/** İki bildirim arası en az bu kadar saat geçmeli. */
const SESSIZ_SAAT = 20;

const DAMGA_ONEK = "bildirim_geciken_";

type GecikenSatir = {
  id: number;
  konu: string;
  gonderen: string;
  gonderen_ad: string;
  tarih: string;
  kutu_adres: string;
};

export type BildirimSonucu = {
  firmaId: number;
  firmaAd: string;
  mailAdedi: number;
  alici: number;
  gonderildi: boolean;
  atlandi?: string;
};

function saatGecti(damga: string, saat: number): boolean {
  if (!damga) return true;
  const t = new Date(damga.replace(" ", "T") + "Z").getTime();
  if (Number.isNaN(t)) return true;
  return Date.now() - t >= saat * 3600 * 1000;
}

function metin(firmaAd: string, satirlar: GecikenSatir[]): string {
  const kok = uygulamaKoku();
  const liste = satirlar
    .slice(0, 10)
    .map((m) => {
      const saat = Math.round(
        (Date.now() - new Date(m.tarih.replace(" ", "T") + "Z").getTime()) / 3600000,
      );
      return `  · ${m.konu || "(konu yok)"}\n    ${m.gonderen_ad || m.gonderen} — ${saat} saattir bekliyor\n    ${kok}/panel/mail/${m.id}`;
    })
    .join("\n\n");

  const fazla = satirlar.length > 10 ? `\n\n…ve ${satirlar.length - 10} mail daha.` : "";

  return [
    `Merhaba,`,
    "",
    `${firmaAd} kutusunda ${satirlar.length} mail ${GECIKME_SAAT} saatten uzun süredir`,
    `kimsenin üstünde değil:`,
    "",
    liste + fazla,
    "",
    `Gelen kutusu: ${kok}/panel?sekme=geciken`,
    "",
    "Bu bildirim, sahipsiz mail biriktiğinde günde en çok bir kez gönderilir.",
    "",
    "Mailhanem",
  ].join("\n");
}

/**
 * Bütün firmaları tarar ve gerekeni gönderir. Zamanlayıcının nabzından
 * çağrılıyor; elle de çalıştırılabilir.
 */
export async function gecikenleriBildir(): Promise<BildirimSonucu[]> {
  const firmalar = db
    .prepare("SELECT id, ad FROM firmalar WHERE durum IN ('etkin','deneme')")
    .all() as { id: number; ad: string }[];

  const sonuclar: BildirimSonucu[] = [];

  for (const f of firmalar) {
    const gecikenler = db
      .prepare(
        `SELECT m.id, m.konu, m.gonderen, m.gonderen_ad, m.tarih, k.adres AS kutu_adres
         FROM mailler m JOIN kutular k ON k.id = m.kutu_id
         WHERE m.firma_id = ? AND m.elendi IS NULL AND m.sahip_id IS NULL
           AND m.durum NOT IN ('kapandi','yanitlandi')
           AND m.tarih <= datetime('now', ?)
         ORDER BY m.tarih ASC`,
      )
      .all(f.id, `-${GECIKME_SAAT} hours`) as GecikenSatir[];

    if (!gecikenler.length) continue;

    const damgaAnahtari = DAMGA_ONEK + f.id;
    if (!saatGecti(ayarOku(damgaAnahtari), SESSIZ_SAAT)) {
      sonuclar.push({
        firmaId: f.id,
        firmaAd: f.ad,
        mailAdedi: gecikenler.length,
        alici: 0,
        gonderildi: false,
        atlandi: "bugün zaten gönderildi",
      });
      continue;
    }

    const ekip = db
      .prepare(
        "SELECT eposta FROM kullanicilar WHERE firma_id = ? AND durum = 'etkin' AND eposta != ''",
      )
      .all(f.id) as Pick<Kullanici, "eposta">[];

    if (!ekip.length) continue;

    const sonuc = await gonder({
      kime: ekip.map((k) => k.eposta).join(", "),
      konu: `${gecikenler.length} mail ${GECIKME_SAAT} saattir bekliyor — ${f.ad}`,
      metin: metin(f.ad, gecikenler),
    });

    /* Damga yalnız gerçekten gittiyse: SMTP kapalıyken damga atarsak,
       açıldığında ilk bildirim sessizce atlanırdı. */
    if (sonuc.gercek) {
      ayarYaz(damgaAnahtari, new Date().toISOString().replace("T", " ").slice(0, 19));
      gunlukYaz(
        "posta",
        `${gecikenler.length} geciken mail için ${ekip.length} kişiye bildirim gönderildi`,
        f.id,
      );
    }

    sonuclar.push({
      firmaId: f.id,
      firmaAd: f.ad,
      mailAdedi: gecikenler.length,
      alici: ekip.length,
      gonderildi: sonuc.gercek,
      atlandi: sonuc.gercek ? undefined : "SMTP kapalı",
    });
  }

  return sonuclar;
}

/**
 * Mail kaynağı arayüzü.
 *
 * İki uygulaması var: gerçek IMAP (`imap.ts`) ve diskteki `.eml` dosyaları
 * (`dosya.ts`). İkincisi oyuncak değil — hattın tamamı (ayrıştırma, kural
 * motoru, tekrar koruması, veritabanına yazma) canlı bir sunucu olmadan
 * uçtan uca denenebilsin diye var. Gerçek kutu bağlandığında tek değişen
 * bu arayüzün hangi uygulamasının verildiğidir.
 */
import { imzaAyir } from "./imza.ts";

export type HamMail = {
  /** IMAP UID; dosya kaynağında yok. */
  uid: number | null;
  /** Message-ID. Yoksa kaynak deterministik bir tane üretir. */
  mesajKimlik: string;
  gonderenAd: string;
  gonderen: string;
  konu: string;
  tarih: Date;
  /** Düz metin gövde; özet buradan çıkarılır. */
  metin: string;
  basliklar: Record<string, string | undefined>;
  /**
   * Mailin ekleri (madde 10).
   *
   * Gövde burada **bellekte** taşınıyor çünkü `mailparser` zaten ayrıştırırken
   * çözüyor; diske yazma kararı işçide veriliyor. Satır içi görseller
   * (`inline`, gövdeye gömülü imza logoları) ayıklanıyor — onları ek diye
   * listelemek her mailin altına üç tane anlamsız dosya asardı.
   */
  ekler: HamEk[];
};

export type HamEk = {
  ad: string;
  tip: string;
  boyut: number;
  icerik: Uint8Array;
};

export interface MailKaynagi {
  /** Kaynağın adı — günlüklerde görünür. */
  readonly ad: string;
  /** Bağlan, gelen kutusundaki mailleri ver, kapat. */
  cek(enFazla: number): Promise<HamMail[]>;
}

/**
 * Gövdeden listede gösterilecek kısa özet.
 *
 * İmza, alıntı ve yasal uyarı kuyruğu **özete girmiyor** (madde 1): listede
 * birbirinin altında duran on mailin özeti "Tel: 0212 ... · www..." diye
 * başlayınca hiçbiri ayırt edilemiyordu. Kuyruk atılmıyor, gövdede tam hâliyle
 * duruyor — burada yalnız özetin dışında kalıyor. Bkz. `imza.ts`.
 *
 * Alıntı satırları (`>`) ayrıca elenmeye devam ediyor: satır arası yanıt
 * yazanların kendi cümleleri alıntının **altında** kalabiliyor, o yüzden ilk
 * `>` satırında kesmiyoruz, yalnız alıntıyı atıyoruz.
 */
export function ozetCikar(metin: string, uzunluk = 180): string {
  const tek = imzaAyir(metin)
    .metin.split("\n")
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith(">"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return tek.length <= uzunluk ? tek : tek.slice(0, uzunluk - 1).trimEnd() + "…";
}

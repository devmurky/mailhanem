/**
 * Mail kategorileri ve durumları — **yan etkisiz**, tarayıcı da yükleyebilir.
 *
 * `ticketSabitleri.ts` ile aynı gerekçe: bu listeleri `db.ts`ten almak, o
 * dosyayı — ve `node:sqlite`i — tarayıcı grafiğine sokuyor ve Turbopack
 * derlemeyi kırıyor.
 *
 * **Kural: `"use client"` taşıyan hiçbir dosya `sunucu/db.ts` import etmeyecek.**
 */

export const KATEGORILER = ["satis", "destek", "fatura", "sikayet", "diger"] as const;
export type Kategori = (typeof KATEGORILER)[number];

export const KATEGORI_AD: Record<Kategori, string> = {
  satis: "Satış",
  destek: "Destek",
  fatura: "Fatura",
  sikayet: "Şikayet",
  diger: "Diğer",
};

/**
 * Mailin ekipteki yolculuğu. "yanitlandi" gönderim bağlandığında eklendi:
 * panel artık müşterinin kendi kutusundan yanıt gönderiyor.
 */
export const DURUMLAR = ["yeni", "islemde", "yanitlandi", "kapandi"] as const;
export type MailDurum = (typeof DURUMLAR)[number];

export const DURUM_AD: Record<MailDurum, string> = {
  yeni: "Yeni",
  islemde: "İşlemde",
  yanitlandi: "Yanıtlandı",
  kapandi: "Kapandı",
};

/**
 * Ticket sabitleri — **yan etkisiz**, hem sunucu hem tarayıcı yükleyebilir.
 *
 * Neden ayrı dosya: bu listeler `db.ts`in içindeyken destek formu ve denetim
 * seçicileri (ikisi de `"use client"`) onları almak için `db.ts`i import
 * ediyordu. `db.ts` yüklenir yüklenmez `node:sqlite` açıyor; modül tarayıcı
 * grafiğine girince Turbopack `node:sqlite`i çözemeyip derlemeyi kırdı.
 *
 * Aynı tuzağa `zamanlayici.ts` de düşmüştü ve çözümü de aynıydı: veriye
 * dokunan taraf ile sabitler ayrı dosyalara bölünür.
 *
 * **Kural: `"use client"` taşıyan hiçbir dosya `sunucu/db.ts` import etmeyecek.**
 */

export const TICKET_KATEGORILERI = ["kurulum", "hata", "soru", "fatura", "ozellik"] as const;
export const TICKET_ONCELIKLERI = ["dusuk", "normal", "yuksek", "acil"] as const;
export const TICKET_DURUMLARI = ["acik", "operatorde", "musteride", "cozuldu", "kapandi"] as const;

export type TicketKategori = (typeof TICKET_KATEGORILERI)[number];
export type TicketOncelik = (typeof TICKET_ONCELIKLERI)[number];
export type TicketDurum = (typeof TICKET_DURUMLARI)[number];

export const TICKET_KATEGORI_AD: Record<string, string> = {
  kurulum: "Kurulum",
  hata: "Hata",
  soru: "Soru",
  fatura: "Fatura",
  ozellik: "Özellik isteği",
};

export const TICKET_ONCELIK_AD: Record<string, string> = {
  dusuk: "Düşük",
  normal: "Normal",
  yuksek: "Yüksek",
  acil: "Acil",
};

/**
 * Durum adları kullanıcıya göre değil **duruma** göre yazılmış: "Bizde"
 * operatör panelinde doğru okunuyor, müşteri panelinde de "talep serviste"
 * anlamına geliyor. İki ayrı sözlük tutmak, aynı satırın iki ekranda farklı
 * görünmesine ve "hangisi doğru" sorusuna yol açardı.
 */
export const TICKET_DURUM_AD: Record<string, string> = {
  acik: "Açık",
  operatorde: "Bizde",
  musteride: "Yanıt bekliyor",
  cozuldu: "Çözüldü",
  kapandi: "Kapandı",
};

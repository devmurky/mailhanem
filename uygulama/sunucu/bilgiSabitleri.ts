/**
 * Bilgi deposunun sabitleri.
 *
 * `db.ts`ten ayrı duruyorlar çünkü `"use client"` taşıyan düzenleme bileşenleri
 * bu listeleri okuyor; `db.ts` import edilseydi `node:sqlite` tarayıcı grafiğine
 * girer ve derleme kırılırdı (bkz. AGENTS.md ve `ticketSabitleri.ts`).
 */

/**
 * Karakterin alanları.
 *
 * Sütun değil **satır** olarak saklanıyorlar (`karakter_alanlari`): her alan
 * kendi kaynağını ve damgasını taşıyor, ve yeni bir alan eklemek şema göçü
 * gerektirmiyor. Beşi de modelin yanıt yazarken ihtiyaç duyduğu şeyler:
 * kim olduğumuz, nasıl konuştuğumuz, neyi asla yazmayacağımız.
 */
export const KARAKTER_ALANLARI = ["tanim", "ton", "hitap", "kurallar", "imza"] as const;
export type KarakterAlani = (typeof KARAKTER_ALANLARI)[number];

export const KARAKTER_AD: Record<KarakterAlani, string> = {
  tanim: "Ne iş yapıyoruz",
  ton: "Ses tonu",
  hitap: "Hitap",
  kurallar: "Yanıt kuralları",
  imza: "İmza",
};

export const KARAKTER_ACIKLAMA: Record<KarakterAlani, string> = {
  tanim: "Firma ne satıyor, kime satıyor. Modelin ilk okuyacağı satır bu.",
  ton: "Yazışmanın havası: resmi mi, samimi mi, kısa mı, açıklayıcı mı.",
  hitap: "Müşteriye nasıl sesleniyorsunuz — “Sayın”, “siz”, ad ile mi.",
  kurallar: "Yanıtta neyin yazılıp neyin yazılmayacağı. “Fiyat vermeyiz, teklife yönlendiririz” gibi.",
  imza: "Yanıtların altına düşecek imza metni.",
};

export const KARAKTER_ORNEK: Record<KarakterAlani, string> = {
  tanim: "Ofis ve ev mobilyası üretiyoruz; müşterilerimiz kurumsal firmalar ve son kullanıcılar.",
  ton: "Kısa, net, fazla resmi değil. Söz verilen tarih mutlaka yazılır.",
  hitap: "“Merhaba <ad> Bey/Hanım”, siz diliyle.",
  kurallar: "Fiyat maille verilmez, teklif için satış ekibine yönlendirilir. Teslim süresi teyit edilmeden yazılmaz.",
  imza: "İyi çalışmalar,\nArkun Mobilya · Müşteri İlişkileri",
};

/**
 * Yöneticinin eklediği maddelerin anahtar öneki.
 *
 * Hem sunucu (`db.ts`) hem düzenleme ekranı buna bakıyor; iki yerde ayrı ayrı
 * yazılmış bir dizgi olmasın diye burada. `db.ts` de buradan alıyor.
 */
export const OZEL_ONEK = "ozel:";

/** Bir bilginin nereden geldiği. Ekranda her satırın altında yazıyor. */
export const KAYNAK_AD: Record<string, string> = {
  elle: "elle yazıldı",
  cikarim: "çıkarımdan onaylandı",
};

/** Bilgi kartının konusu. Mailin kategorileriyle aynı sözlük kullanılıyor. */
export const KART_SINIRI = { baslik: 120, icerik: 4000 } as const;

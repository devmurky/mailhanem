/**
 * Konuşma (thread) kimliği — hangi mail hangi yazışmanın parçası (madde 2).
 *
 * Panelde her mail ayrı bir satırdı: müşteri üç kez yazdıysa üç satır, aradaki
 * bizim yanıtlarımız da ayrı yerlerde duruyordu. "Bu konu ne oldu" sorusunun
 * cevabı hiçbir ekranda bir arada değildi.
 *
 * ── İki yol, sırayla ─────────────────────────────────────
 *
 * 1. **Başlık zinciri.** `In-Reply-To` ve `References` başlıkları, yanıtın
 *    hangi mesaja verildiğini Message-ID ile söyler. Doğru olan bu: konu
 *    değişse de, gönderen değişse de zincir kopmaz.
 * 2. **Konu + gönderen.** Bazı istemciler o başlıkları yazmaz ya da araya
 *    giren bir aktarım siler. O zaman aynı kutuya, aynı adresten, aynı konuyla
 *    (Re:/Fwd: kırpılarak) gelen mail aynı konuşma sayılıyor.
 *
 * Yedek yolun sınırı bilinçli: **yalnız aynı gönderen**. "Merhaba" konulu iki
 * ayrı müşteriyi tek konuşmada birleştirmek, ayrı göstermekten çok daha kötü
 * bir hata olurdu — biri ötekinin yazışmasını okurdu.
 *
 * Saf modül: veritabanı yok, ağ yok. Eşleşmeyi `db.ts` yapıyor, kuralı burası
 * söylüyor.
 */

/** Konu başındaki yanıt/iletme önekleri. Türkçe istemciler Ynt/İlt kullanıyor. */
const ONEK = /^\s*(?:(?:re|ynt|yan|fw|fwd|ilt|iletilen|aw|sv|antwort)\s*(?:\[\d+\])?\s*:\s*)+/i;

const HARF: Record<string, string> = {
  ı: "i", İ: "i", ş: "s", Ş: "s", ğ: "g", Ğ: "g",
  ü: "u", Ü: "u", ö: "o", Ö: "o", ç: "c", Ç: "c",
};

/**
 * Konunun karşılaştırılabilir kökü.
 *
 * "Re: Ynt: Teklif hk." ile "teklif hk" aynı konuşma. Türkçe harfler katlanıyor
 * çünkü aynı kişi bir mailde "Şubat", ötekinde "Subat" yazabiliyor.
 */
export function konuKoku(konu: string): string {
  /* Katlama **önce** yapılıyor: "İlt:" öneki büyük İ ile yazılıyor ve JavaScript
     onu `i` bayrağıyla `ilt`e eşitlemiyor — İ, i'nin büyük hâli değil. Katlamayı
     öne almazsak Türkçe istemcilerin ilettiği mail zincire hiç girmiyordu. */
  let metin = (konu ?? "")
    .replace(/[ıİşŞğĞüÜöÖçÇ]/g, (h) => HARF[h] ?? h)
    .toLowerCase()
    .trim();

  /* Önek birden çok kez birikmiş olabilir: "Re: Ynt: Re: ..." */
  let onceki = "";
  while (metin !== onceki) {
    onceki = metin;
    metin = metin.replace(ONEK, "").trim();
  }
  return metin.replace(/\s+/g, " ").trim();
}

/**
 * `In-Reply-To` ve `References` başlıklarındaki Message-ID'ler.
 *
 * En yakın atadan başlayarak sıralanıyor: `In-Reply-To` doğrudan cevaplanan
 * mesaj, `References` ise kökten başlayan zincir — o yüzden tersine çevriliyor.
 * Sıra önemli, çünkü eşleşen ilk kimlik konuşmayı belirliyor.
 */
export function zincirKimlikleri(basliklar: Record<string, string | undefined>): string[] {
  const oku = (ad: string): string => {
    const anahtar = Object.keys(basliklar).find((k) => k.toLowerCase() === ad);
    return anahtar ? (basliklar[anahtar] ?? "") : "";
  };

  const kimlikler = (metin: string): string[] => {
    const bulunan = metin.match(/<[^<>\s]+>/g);
    return bulunan ? bulunan.map((k) => k.trim()) : [];
  };

  const dogrudan = kimlikler(oku("in-reply-to"));
  const zincir = kimlikler(oku("references")).reverse();

  /* Tekrarları at, sırayı koru. */
  return [...new Set([...dogrudan, ...zincir])];
}

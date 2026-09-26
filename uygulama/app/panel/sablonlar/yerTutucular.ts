/**
 * Şablon yer tutucuları.
 *
 * Yalnızca bu beşi var ve hepsi panelin elindeki veriden doluyor. Uydurma bir
 * alan (sipariş numarası, kargo kodu…) eklemedik: değerini bilmediğimiz bir
 * yer tutucu, gönderilen mailde `{siparis}` olarak görünürdü.
 *
 * Bu dosya hem sunucu hem tarayıcı tarafından okunuyor; içinde veritabanı ya
 * da düğüm modülü yok.
 */
export const YER_TUTUCULAR = [
  { anahtar: "ad", ne: "Gönderenin adı" },
  { anahtar: "eposta", ne: "Gönderenin adresi" },
  { anahtar: "konu", ne: "Mailin konusu" },
  { anahtar: "ben", ne: "Yanıtı yazan kişi" },
  { anahtar: "firma", ne: "Firmanızın adı" },
] as const;

export type YerTutucuDegerleri = {
  ad: string;
  eposta: string;
  konu: string;
  ben: string;
  firma: string;
};

/**
 * `{ad}` gibi yer tutucuları doldurur. Tanınmayan bir yer tutucu **olduğu gibi
 * bırakılıyor**: sessizce silmek, yazanın fark etmediği bir boşluk üretirdi.
 */
export function doldur(metin: string, deger: YerTutucuDegerleri): string {
  return metin.replace(/\{(\w+)\}/g, (tam, anahtar: string) => {
    const k = anahtar as keyof YerTutucuDegerleri;
    return k in deger ? deger[k] : tam;
  });
}

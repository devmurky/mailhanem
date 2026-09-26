/**
 * Uygulamanın kökü — bağlantı kurmak isteyen her yer buradan alıyor.
 *
 * Neden ayrı dosya: bu tek satırlık yardımcı `girisPostasi.ts` içindeydi ve o
 * dosya `oturum.ts`i, o da `next/headers`i çekiyor. Bildirim modülü yalnız kök
 * adresi için o zinciri yüklemek zorunda kalıyor ve düz Node testinde
 * `next/headers` çözülemediği için düşüyordu.
 *
 * Aynı kural `ticketSabitleri.ts` ve `kategoriler.ts` için de geçerliydi:
 * yan etkisiz olan, yan etkiliden ayrılır.
 */
export function uygulamaKoku(): string {
  return (process.env.UYGULAMA_KOKU ?? "http://127.0.0.1:3100").replace(/\/+$/, "");
}

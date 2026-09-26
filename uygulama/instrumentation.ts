/**
 * Sunucu açılışında bir kez çalışır.
 *
 * Buradaki tek iş çekim zamanlayıcısını kurmak. Edge çalışma zamanında
 * `node:sqlite` ve IMAP yok; o yüzden yalnız Node tarafında kuruluyor.
 * Derleme sırasında çağrılmaz — `next build` bunu çalıştırmaz.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { zamanlayiciyiBaslat } = await import("./sunucu/zamanlayiciCekirdek.ts");
  zamanlayiciyiBaslat();
}

/**
 * Çekim zamanlayıcısı.
 *
 * Mail hattı bugüne kadar yalnızca panelden elle tetikleniyordu; müşterinin
 * maili panele düşsün diye birinin düğmeye basması gerekiyordu. Burası o
 * düğmeye periyodik basan yer.
 *
 * Tasarım kararı: ayrı bir kuyruk ya da cron servisi yok. Sunucu açılırken
 * `instrumentation.ts` bunu kuruyor, dakikada bir "nabız" atıyor ve aralık
 * dolduysa çekimi çalıştırıyor. Sebebi ölçek: bugün tek süreç, tek haneli
 * müşteri ve on kadar kutu var. Bunun için Redis'li bir kuyruk kurmak,
 * bakılacak ikinci bir sistem demek olurdu.
 *
 * Bu yüzden şu ikisi doğru değil ve bilinerek böyle:
 * - **Tek süreç varsayılıyor.** Uygulama iki kopya halinde çalıştırılırsa iki
 *   zamanlayıcı olur ve kutular iki kez çekilir. (Zararsız — `mailEkle`
 *   aynı Message-ID'yi ikinci kez yazmıyor — ama IMAP'e gereksiz yük.)
 * - **Dakikadan ince aralık yok.** Nabız dakikada bir.
 *
 * Son çalışma damgası veritabanında durur; sunucu yeniden başladığında
 * zamanlayıcı sıfırdan saymaz, kaldığı yerden devam eder.
 *
 * Bu dosya **yalnızca ayarı ve durumu** bilir; çekimin kendisi
 * `zamanlayiciCekirdek.ts`'de. Ayrılmalarının sebebi teknik: panel ekranları
 * durumu okuyor, ve mail hattını (IMAP, mailparser) sayfanın modül grafiğine
 * sokmak derlemeyi kırıyordu.
 */
import { ayarOku, ayarYaz } from "./db.ts";

export const ARALIK_ANAHTAR = "cekim_araligi_dk";
export const SON_CALISMA = "cekim_son_calisma";
export const SON_SONUC = "cekim_son_sonuc";

/** Panelde seçilebilen aralıklar. 0 = zamanlayıcı kapalı. */
export const ARALIKLAR = [0, 5, 15, 30, 60, 180] as const;

export const ARALIK_AD: Record<number, string> = {
  0: "Kapalı — yalnızca elle",
  5: "5 dakikada bir",
  15: "15 dakikada bir",
  30: "Yarım saatte bir",
  60: "Saatte bir",
  180: "Üç saatte bir",
};

/** Ayardaki aralık; tanınmayan ya da boş değer "kapalı" sayılır. */
export function araligiOku(): number {
  const ham = Number(ayarOku(ARALIK_ANAHTAR));
  return (ARALIKLAR as readonly number[]).includes(ham) ? ham : 0;
}

export function araligiYaz(dakika: number): void {
  if (!(ARALIKLAR as readonly number[]).includes(dakika)) {
    throw new Error("Tanınmayan aralık.");
  }
  ayarYaz(ARALIK_ANAHTAR, String(dakika));
}

export type ZamanlayiciDurumu = {
  aralik: number;
  acik: boolean;
  sonCalisma: string;
  sonSonuc: string;
  /** Sıradaki turun tahmini zamanı; kapalıysa boş. */
  siradaki: string;
};

export function durum(): ZamanlayiciDurumu {
  const aralik = araligiOku();
  const sonCalisma = ayarOku(SON_CALISMA);
  let siradaki = "";
  if (aralik > 0) {
    const taban = sonCalisma ? Date.parse(sonCalisma + "Z") : Date.now();
    siradaki = new Date(taban + aralik * 60_000).toISOString().replace("T", " ").slice(0, 19);
  }
  return {
    aralik,
    acik: aralik > 0,
    sonCalisma,
    sonSonuc: ayarOku(SON_SONUC),
    siradaki,
  };
}

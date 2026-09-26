/**
 * Ek dosyalarının diskteki tarafı.
 *
 * İçerik neden veritabanında değil: SQLite'a megabaytlık blob koymak dosyayı
 * şişirir, her yedeklemeyi ağırlaştırır ve tek bir büyük ek yüzünden bütün
 * veritabanı yavaşlar. `ekler` tablosu yalnız künyeyi (ad, tip, boyut, disk
 * adı) tutuyor; gövde burada.
 *
 * Disk adı **veritabanından üretiliyor**, kullanıcının verdiği addan değil:
 * yüklenen "..\\..\\etc\\passwd" gibi bir ad dosya yolunu kırardı. Görünen ad
 * ayrı sütunda duruyor ve indirirken o kullanılıyor.
 */
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** Tek ek için üst sınır. Daha büyüğü reddediliyor, sessizce kesilmiyor. */
export const EK_SINIR = 10 * 1024 * 1024;

/**
 * Kabul edilen tipler. Liste **beyaz liste**: çalıştırılabilir bir şeyin
 * sunucuya inip indirilebilir olması istenmiyor.
 */
export const EK_TIPLERI = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function kok(): string {
  return process.env.EK_KLASORU ?? resolve(process.cwd(), "veri", "ekler");
}

function yol(dosya: string): string {
  /* Dosya adı bizim ürettiğimiz onaltılık dizge; yine de yol ayracı taşıyan
     bir ad buraya gelirse reddediliyor. */
  if (!/^[0-9a-f]{32}(\.[a-z0-9]{1,8})?$/.test(dosya)) {
    throw new Error("Geçersiz ek adı.");
  }
  return resolve(kok(), dosya);
}

const UZANTI: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/csv": ".csv",
  "application/zip": ".zip",
};

/** İçeriği diske yazar ve üretilen disk adını döner. */
export function ekYaz(icerik: Uint8Array, tip: string): string {
  const ad = randomBytes(16).toString("hex") + (UZANTI[tip] ?? "");
  const hedef = yol(ad);
  mkdirSync(dirname(hedef), { recursive: true });
  writeFileSync(hedef, icerik);
  return ad;
}

export function ekOku(dosya: string): Buffer {
  return readFileSync(yol(dosya));
}

export function ekSil(dosya: string): void {
  try {
    unlinkSync(yol(dosya));
  } catch {
    /* Dosya zaten yoksa sorun değil: künye silinmişse gövdenin kalması
       tek başına bir hata değil. */
  }
}

/** Ekranlarda gösterilecek okunur boyut. */
export function boyutYaz(bayt: number): string {
  if (bayt < 1024) return `${bayt} B`;
  if (bayt < 1024 * 1024) return `${Math.round(bayt / 1024)} KB`;
  return `${(bayt / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
}

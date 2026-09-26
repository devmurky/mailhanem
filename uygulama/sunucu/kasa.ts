/**
 * Posta kutusu parolalarının kasası — AES-256-GCM zarf şifreleme.
 *
 * Ürün sözü şu: parola panele geri gösterilmez ve veritabanını okuyan biri
 * onu çözemez. Bunun için iki katman var:
 *
 *   ana anahtar (MAILHANEM_ANAHTAR, ortamda durur, veritabanında DURMAZ)
 *     └─ her parola için üretilen rastgele veri anahtarı (DEK)
 *          └─ parolanın kendisi
 *
 * Veritabanına yalnızca "ana anahtarla şifrelenmiş DEK + DEK ile şifrelenmiş
 * parola" yazılır. Ana anahtar sızmadıkça kayıt işe yaramaz; ana anahtar
 * değiştirilmek istendiğinde yalnızca DEK'ler yeniden sarılır, parolalar değil.
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_UZUNLUK = 12; // GCM için önerilen
const ETIKET_UZUNLUK = 16;

export class KasaHatasi extends Error {}

/**
 * Ortamdaki ana anahtar. 32 bayt, base64. Yoksa açıkça patlar — sessizce düz
 * metne düşmez.
 *
 * `MAILHANE_ANAHTAR` eski addır; proje Mailhanem olunca değişken de yeniden
 * adlandırıldı. Eski ad hâlâ okunuyor çünkü bu anahtarı kaybetmek **kayıtlı
 * kutu parolalarını çözülemez hale getirir**: güncellenmemiş bir ortam
 * dosyası yüzünden bunu riske atmaya değmez. Eski ada düşüldüğünde uyarı
 * basılıyor; ortam dosyası düzeltilince satır susar.
 */
function anaAnahtar(): Buffer {
  const ham = process.env.MAILHANEM_ANAHTAR ?? process.env.MAILHANE_ANAHTAR;
  if (ham && !process.env.MAILHANEM_ANAHTAR) {
    console.warn(
      "[kasa] MAILHANE_ANAHTAR eski addır, MAILHANEM_ANAHTAR olarak yeniden adlandırın.",
    );
  }
  if (!ham) {
    throw new KasaHatasi(
      "MAILHANEM_ANAHTAR tanımlı değil. `node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"` " +
        "ile bir anahtar üretip ortama koyun.",
    );
  }
  const anahtar = Buffer.from(ham, "base64");
  if (anahtar.length !== 32) {
    throw new KasaHatasi(`MAILHANEM_ANAHTAR 32 bayt olmalı, ${anahtar.length} bayt geldi.`);
  }
  return anahtar;
}

export function anahtarVarMi(): boolean {
  try {
    anaAnahtar();
    return true;
  } catch {
    return false;
  }
}

/** Tek seferlik: kurulumda kullanılacak yeni bir ana anahtar üretir. */
export function anahtarUret(): string {
  return randomBytes(32).toString("base64");
}

function sifrele(anahtar: Buffer, acik: Buffer): Buffer {
  const iv = randomBytes(IV_UZUNLUK);
  const s = createCipheriv(ALGO, anahtar, iv);
  const govde = Buffer.concat([s.update(acik), s.final()]);
  return Buffer.concat([iv, s.getAuthTag(), govde]);
}

function coz(anahtar: Buffer, paket: Buffer): Buffer {
  if (paket.length < IV_UZUNLUK + ETIKET_UZUNLUK) {
    throw new KasaHatasi("Şifreli kayıt bozuk: paket çok kısa.");
  }
  const iv = paket.subarray(0, IV_UZUNLUK);
  const etiket = paket.subarray(IV_UZUNLUK, IV_UZUNLUK + ETIKET_UZUNLUK);
  const govde = paket.subarray(IV_UZUNLUK + ETIKET_UZUNLUK);
  const c = createDecipheriv(ALGO, anahtar, iv);
  c.setAuthTag(etiket);
  try {
    return Buffer.concat([c.update(govde), c.final()]);
  } catch {
    throw new KasaHatasi("Şifreli kayıt çözülemedi: anahtar yanlış ya da kayıt bozulmuş.");
  }
}

/**
 * Parolayı zarfla. Dönen dize doğrudan `kutular.parola_sifreli` sütununa yazılır.
 * Biçim: v1.<base64 sarılı DEK>.<base64 şifreli parola>
 */
export function zarfla(parola: string): string {
  const ana = anaAnahtar();
  const dek = randomBytes(32);
  const sarilanDek = sifrele(ana, dek);
  const sifreliParola = sifrele(dek, Buffer.from(parola, "utf8"));
  dek.fill(0);
  return `v1.${sarilanDek.toString("base64")}.${sifreliParola.toString("base64")}`;
}

/** Zarfı aç. Yalnızca IMAP'a bağlanırken çağrılır; sonucu hiçbir yere yazma. */
export function zarfiAc(kayit: string): string {
  const parca = kayit.split(".");
  if (parca.length !== 3 || parca[0] !== "v1") {
    throw new KasaHatasi("Şifreli kayıt tanınmıyor.");
  }
  const ana = anaAnahtar();
  const dek = coz(ana, Buffer.from(parca[1]!, "base64"));
  try {
    return coz(dek, Buffer.from(parca[2]!, "base64")).toString("utf8");
  } finally {
    dek.fill(0);
  }
}

/** Aynı parola mı? Karşılaştırma sabit zamanlı yapılır. */
export function ayniMi(kayit: string, parola: string): boolean {
  try {
    const a = Buffer.from(zarfiAc(kayit), "utf8");
    const b = Buffer.from(parola, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

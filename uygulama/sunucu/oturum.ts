/**
 * Giriş ve oturum.
 *
 * Şifre yok: kullanıcı adresini yazar, tek kullanımlık bir bağlantı alır.
 * Ne giriş jetonu ne oturum jetonu veritabanında düz durur — yalnızca SHA-256
 * özetleri saklanır, böylece veritabanını okuyan biri kimsenin yerine giremez.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db, girisDamgala, girisKaydiYaz, kullaniciIdIle, type Kullanici } from "./db.ts";

export const CEREZ = "mailhanem_oturum";
const LINK_DAKIKA = 15;
const OTURUM_GUN = 30;

function ozet(jeton: string): string {
  return createHash("sha256").update(jeton).digest("hex");
}

function jetonUret(): string {
  return randomBytes(32).toString("base64url");
}

function ileri(saniye: number): string {
  return new Date(Date.now() + saniye * 1000).toISOString().replace("T", " ").slice(0, 19);
}

/* ── sihirli bağlantı ───────────────────────────────────── */

/** Kullanıcı için tek kullanımlık giriş jetonu üretir. Dönen değer bir kez gösterilir. */
export function girisLinkiUret(kullaniciId: number): { jeton: string; gecerlilik: string } {
  const jeton = jetonUret();
  const gecerlilik = ileri(LINK_DAKIKA * 60);
  db.prepare(
    "INSERT INTO giris_linkleri (kullanici_id, jeton_ozet, gecerlilik) VALUES (?, ?, ?)",
  ).run(kullaniciId, ozet(jeton), gecerlilik);
  return { jeton, gecerlilik };
}

/**
 * Jetonu harcar ve kullanıcıyı döner. Süresi geçmiş, kullanılmış veya
 * tanınmayan jetonlar için undefined döner — hangisi olduğu dışarı söylenmez.
 */
export function girisLinkiHarca(jeton: string): Kullanici | undefined {
  const satir = db
    .prepare(
      `SELECT id, kullanici_id FROM giris_linkleri
       WHERE jeton_ozet = ? AND kullanildi IS NULL AND gecerlilik > datetime('now')`,
    )
    .get(ozet(jeton)) as { id: number; kullanici_id: number } | undefined;
  if (!satir) return undefined;

  const kullanici = kullaniciIdIle(satir.kullanici_id);
  if (!kullanici || kullanici.durum !== "etkin") return undefined;

  db.prepare("UPDATE giris_linkleri SET kullanildi = datetime('now') WHERE id = ?").run(satir.id);
  girisDamgala(satir.kullanici_id);
  return kullanici;
}

/* ── oturum ─────────────────────────────────────────────── */

/**
 * Oturum açar ve **girişi günlüğe yazar** (madde 11).
 *
 * Kayıt burada tutuluyor, giriş sayfasında değil: panele girmenin başka yolu
 * olsa da (geliştirme kapısı, ileride tek imza) hepsi buradan geçiyor ve
 * hiçbiri kaydın dışında kalmıyor.
 *
 * Operatör panelinin günlük ekranı "bir müşteri paneline yapılan her giriş bu
 * listede" diyor; firma yöneticisi de aynı satırları kendi ekranında görüyor.
 * Söz, yazan tarafta tutulmazsa okuyan tarafta hiç tutulmuyor demektir.
 */
export function oturumAc(kullaniciId: number): { jeton: string; gecerlilik: string } {
  const jeton = jetonUret();
  const gecerlilik = ileri(OTURUM_GUN * 24 * 3600);
  db.prepare("INSERT INTO oturumlar (kullanici_id, jeton_ozet, gecerlilik) VALUES (?, ?, ?)").run(
    kullaniciId,
    ozet(jeton),
    gecerlilik,
  );

  girisKaydiYaz(kullaniciId);
  return { jeton, gecerlilik };
}

export function oturumCoz(jeton: string | undefined): Kullanici | undefined {
  if (!jeton) return undefined;
  const satir = db
    .prepare(
      `SELECT id, kullanici_id FROM oturumlar
       WHERE jeton_ozet = ? AND gecerlilik > datetime('now')`,
    )
    .get(ozet(jeton)) as { id: number; kullanici_id: number } | undefined;
  if (!satir) return undefined;

  /* Ekipten çıkarılan kişinin elinde kalan çerez işe yaramasın. */
  const kullanici = kullaniciIdIle(satir.kullanici_id);
  if (!kullanici || kullanici.durum !== "etkin") return undefined;

  db.prepare("UPDATE oturumlar SET son_gorulme = datetime('now') WHERE id = ?").run(satir.id);
  return kullanici;
}

export function oturumKapat(jeton: string | undefined): void {
  if (!jeton) return;
  db.prepare("DELETE FROM oturumlar WHERE jeton_ozet = ?").run(ozet(jeton));
}

/* ── çerez ──────────────────────────────────────────────── */

export async function cerezYaz(jeton: string): Promise<void> {
  const kutu = await cookies();
  kutu.set(CEREZ, jeton, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OTURUM_GUN * 24 * 3600,
  });
}

export async function cerezSil(): Promise<void> {
  const kutu = await cookies();
  kutu.set(CEREZ, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** O anki kullanıcı; oturum yoksa undefined. */
export async function suankiKullanici(): Promise<Kullanici | undefined> {
  const kutu = await cookies();
  return oturumCoz(kutu.get(CEREZ)?.value);
}

/** Sabit zamanlı karşılaştırma — jeton doğrulamasında sızıntı olmasın diye. */
export function esitMi(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

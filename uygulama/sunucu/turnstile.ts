/**
 * Cloudflare Turnstile — giriş formunun bot koruması.
 *
 * Neden bu: Cloudflare'in WAF / Bot Management katmanı DNS seviyesinde çalışır,
 * koda eklenmez; alan adı Cloudflare'in arkasına geçtiğinde kendiliğinden
 * devreye girer. Forma gömülebilen tek Cloudflare aracı **Turnstile**.
 *
 * Neyi engelliyor: bu form tanınan bir adrese mail gönderiyor. Koruma olmadan
 * biri bu ucu döngüye sokup bir müşteriyi mail yağmuruna tutabilir. Adres
 * sayımına (enumeration) karşı zaten korunuyoruz — cevap adres tanınsın
 * tanınmasın aynı.
 *
 * **Anahtar yoksa koruma kapalıdır ve giriş çalışmaya devam eder.** Sessizce
 * "doğrulandı" saymıyoruz; yapılandırılmamış olmakla doğrulanmış olmak ayrı
 * şeyler ve ikisi de arayüzde farklı görünüyor.
 */
const DOGRULAMA_UCU = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Tarayıcıya giden anahtar. `NEXT_PUBLIC_` öneki Next'in gereği. */
export function siteAnahtari(): string {
  return (process.env.NEXT_PUBLIC_TURNSTILE_SITE ?? "").trim();
}

function gizliAnahtar(): string {
  return (process.env.TURNSTILE_GIZLI ?? "").trim();
}

/**
 * Koruma ancak **iki anahtar birden** varsa açık.
 *
 * Yalnız site anahtarı verilirse tarayıcıda bulmaca çıkar ama sunucu onu
 * doğrulayamaz — güvenlik hissi verip hiçbir şey yapmayan bir durum. Böyle bir
 * yarı kurulumu açık saymıyoruz.
 */
export function turnstileAcikMi(): boolean {
  return Boolean(siteAnahtari() && gizliAnahtar());
}

export type DogrulamaSonucu = { gecti: boolean; sebep?: string };

/**
 * Jetonu Cloudflare'e doğrulatır.
 *
 * Ağ hatasında **geçersiz sayıyoruz**. Tersi — hata olunca geçirmek — koruma
 * duvarını, Cloudflare'e erişimi kesebilen birinin isteğiyle indirilebilir
 * hale getirirdi.
 */
export async function turnstileDogrula(
  jeton: string,
  ip?: string,
): Promise<DogrulamaSonucu> {
  if (!turnstileAcikMi()) return { gecti: true };
  if (!jeton) return { gecti: false, sebep: "eksik-jeton" };

  const govde = new URLSearchParams({ secret: gizliAnahtar(), response: jeton });
  if (ip) govde.set("remoteip", ip);

  try {
    const cevap = await fetch(DOGRULAMA_UCU, {
      method: "POST",
      body: govde,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(8000),
    });
    const sonuc = (await cevap.json()) as { success?: boolean; "error-codes"?: string[] };
    return sonuc.success
      ? { gecti: true }
      : { gecti: false, sebep: (sonuc["error-codes"] ?? []).join(",") || "reddedildi" };
  } catch (e) {
    console.error(`[turnstile] doğrulama yapılamadı: ${e instanceof Error ? e.message : e}`);
    return { gecti: false, sebep: "dogrulama-yapilamadi" };
  }
}

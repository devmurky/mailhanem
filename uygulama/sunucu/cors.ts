/**
 * Tanıtım sayfası ayrı bir kökten servis ediliyor (geliştirmede 8791, üretimde
 * mailhanem.app). Yalnızca üç uç dışarı açık; hepsi buradaki listeden geçer.
 */
const IZINLI = new Set(
  (process.env.SITE_KAYNAKLARI ??
    "http://127.0.0.1:8791,http://localhost:8791,https://mailhanem.app,https://www.mailhanem.app")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

/** İsteğin kökü listedeyse ona özel başlıklar döner; değilse hiç başlık koymaz. */
export function corsBasliklari(istek: Request): Record<string, string> {
  const kaynak = istek.headers.get("origin");
  if (!kaynak || !IZINLI.has(kaynak)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": kaynak,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function onIstek(istek: Request): Response {
  return new Response(null, { status: 204, headers: corsBasliklari(istek) });
}

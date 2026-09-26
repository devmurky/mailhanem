/**
 * Sihirli bağlantının indiği yer: jetonu harcar, oturumu açar, panele bırakır.
 * Operatör kendi arka ofisine, müşteri kendi paneline gider.
 */
import { NextResponse } from "next/server";
import { girisLinkiHarca, oturumAc, cerezYaz } from "@/sunucu/oturum";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Yönlendirmeyi tarayıcının kullandığı host üzerinden kurar.
 * `istek.url` geliştirmede localhost'a normalleşebiliyor; başka bir host'a
 * atarsak az önce yazdığımız oturum çerezi gönderilmez ve giriş kaybolur.
 */
function hedefUrl(istek: Request, yol: string): string {
  const url = new URL(istek.url);
  const host = istek.headers.get("host") ?? url.host;
  const sema = istek.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${sema}://${host}${yol}`;
}

export async function GET(istek: Request) {
  const jeton = new URL(istek.url).searchParams.get("jeton") ?? "";

  const kullanici = jeton ? girisLinkiHarca(jeton) : undefined;
  if (!kullanici) {
    return NextResponse.redirect(hedefUrl(istek, "/giris?durum=gecersiz"));
  }

  const { jeton: oturumJetonu } = oturumAc(kullanici.id);
  await cerezYaz(oturumJetonu);

  return NextResponse.redirect(hedefUrl(istek, kullanici.operator === 1 ? "/operator" : "/panel"));
}

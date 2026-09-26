/**
 * Tanıtım sayfasının okuduğu ayarlar. Yalnızca ACIK_AYARLAR listesindekiler
 * dışarı çıkar; boş bırakılan bir alan sayfada hiç görünmez.
 */
import { NextResponse } from "next/server";
import { ACIK_AYARLAR, ayarlariOku } from "@/sunucu/db";
import { siteAnahtari, turnstileAcikMi } from "@/sunucu/turnstile";
import { corsBasliklari, onIstek } from "@/sunucu/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(istek: Request) {
  const hepsi = ayarlariOku(ACIK_AYARLAR);
  return NextResponse.json(
    {
      eposta: hepsi.iletisim_eposta ?? "",
      telefon: hepsi.iletisim_telefon ?? "",
      /* Turnstile site anahtarı: tarayıcıya gitmesi gereken, gizli olmayan
         yarısı. Koruma ancak iki anahtar birden varken açık sayıldığı için
         yalnız o durumda gönderiliyor — site yarım kurulumda widget çizip
         doğrulanamayan bir jeton üretmesin. */
      turnstile: turnstileAcikMi() ? siteAnahtari() : "",
    },
    { headers: { ...corsBasliklari(istek), "Cache-Control": "public, max-age=60" } },
  );
}

export async function OPTIONS(istek: Request) {
  return onIstek(istek);
}

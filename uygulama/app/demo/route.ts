/**
 * Sitedeki "Demoda deneyimleyin" düğmesinin indiği yer.
 *
 * Giriş istemiyor: demo firmayı sıfırdan kurup ziyaretçiyi o firmanın sahibi
 * olarak panele bırakıyor. Şifre yok, mail yok, kayıt yok — ziyaretçi ürünü
 * görmek için kendi adresini vermek zorunda kalmasın.
 *
 * **Bu bir açık kapı değil:** oturum yalnızca `demo=1` bayraklı uydurma firmaya
 * açılıyor. O firmanın verisi her ziyarette siliniyor, gerçek müşterinin
 * kaydına erişimi yok — panelin bütün sorguları `firma_id`'yi oturumdan alıyor
 * (bkz. `app/panel/yetki.ts`).
 */
import { NextResponse } from "next/server";
import { demoKur } from "@/sunucu/demo";
import { oturumAc, cerezYaz } from "@/sunucu/oturum";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Çerez yazılan host ile yönlendirme host'u aynı olsun (bkz. giris/dogrula). */
function hedefUrl(istek: Request, yol: string): string {
  const url = new URL(istek.url);
  const host = istek.headers.get("host") ?? url.host;
  const sema = istek.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${sema}://${host}${yol}`;
}

export async function GET(istek: Request) {
  const kullanici = demoKur();
  const { jeton } = oturumAc(kullanici.id);
  await cerezYaz(jeton);
  return NextResponse.redirect(hedefUrl(istek, "/panel/ozet"));
}

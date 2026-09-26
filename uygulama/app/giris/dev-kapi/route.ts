/**
 * ★★★ GEÇİCİ GELİŞTİRME KAPISI — İŞ BİTİNCE SİLİNECEK ★★★
 *
 * Giriş maili / sihirli bağlantı beklemeden panellere doğrudan girmek için.
 * Kullanıcının isteği: "login isteme, bana panellerin giriş linklerini ver,
 * direk girebileyim." Bu dosya o kapı.
 *
 * Linkler:
 *   /giris/dev-kapi?panel=operator   → operatör arka ofisine
 *   /giris/dev-kapi?panel=musteri    → müşteri paneline (firma sahibi olarak)
 *
 * GÜVENLİK: Yalnızca .env.local'de DEV_KAPI=acik varken çalışır. O bayrak
 * sürüm kontrolüne girmeyen .env.local'de durur; üretime taşınmaz. Bayrak
 * yoksa kapı 404 döner. İşimiz bitince: bu dosyayı ve bayrağı sil.
 *
 * Nasıl çalışır: sihirli bağlantı akışının aynısı — mevcut bir kullanıcı için
 * oturum açıp çereze yazar. Yeni kullanıcı yaratmaz, şifre kullanmaz. Kimi
 * seçeceğini veritabanından okur (ilk etkin operatör / ilk etkin firma sahibi).
 */
import { NextResponse } from "next/server";
import { db, kullaniciIdIle } from "@/sunucu/db";
import { oturumAc, cerezYaz } from "@/sunucu/oturum";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Çerez yazılan host ile yönlendirme host'u aynı olsun (bkz. dogrula/route.ts). */
function hedefUrl(istek: Request, yol: string): string {
  const url = new URL(istek.url);
  const host = istek.headers.get("host") ?? url.host;
  const sema = istek.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${sema}://${host}${yol}`;
}

export async function GET(istek: Request) {
  if (process.env.DEV_KAPI !== "acik") {
    return new NextResponse("Bulunamadı", { status: 404 });
  }

  const panel = new URL(istek.url).searchParams.get("panel") ?? "musteri";

  const secim =
    panel === "operator"
      ? db
          .prepare(
            "SELECT id FROM kullanicilar WHERE operator = 1 AND durum = 'etkin' ORDER BY id LIMIT 1",
          )
          .get()
      : db
          .prepare(
            `SELECT id FROM kullanicilar
             WHERE operator = 0 AND rol = 'sahip' AND firma_id IS NOT NULL AND durum = 'etkin'
             ORDER BY id LIMIT 1`,
          )
          .get();

  const id = (secim as { id: number } | undefined)?.id;
  const kullanici = id ? kullaniciIdIle(id) : undefined;
  if (!kullanici) {
    return new NextResponse(
      `Bu panel için etkin bir hesap bulunamadı (panel=${panel}).`,
      { status: 404 },
    );
  }

  const { jeton } = oturumAc(kullanici.id);
  await cerezYaz(jeton);

  return NextResponse.redirect(hedefUrl(istek, kullanici.operator === 1 ? "/operator" : "/panel"));
}

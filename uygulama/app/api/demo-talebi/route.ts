/**
 * Tanıtım sayfasındaki demo formunun düştüğü yer.
 * Operatör panelindeki "Demo Talepleri" ekranı bu tabloyu okur.
 *
 * **Bot koruması burada asıl gerekli.** Giriş formu tanınan bir adrese mail
 * gönderiyordu; bu uç ise doğrudan veritabanına yazıyor ve operatöre iş
 * çıkarıyor. Korumasız bırakılırsa kuyruk çöple dolar ve gerçek talep
 * aralarında kaybolur.
 *
 * Doğrulama **gövde okunmadan önce**: sahte istek veritabanına hiç yaklaşmıyor.
 * İki anahtar birden yoksa koruma kapalı ve form çalışmaya devam ediyor
 * (bkz. `sunucu/turnstile.ts`).
 */
import { NextResponse } from "next/server";
import { talepEkle } from "@/sunucu/db";
import { hatalar, talepSemasi } from "@/sunucu/dogrula";
import { corsBasliklari, onIstek } from "@/sunucu/cors";
import { turnstileAcikMi, turnstileDogrula } from "@/sunucu/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(istek: Request) {
  const basliklar = corsBasliklari(istek);

  if (turnstileAcikMi()) {
    /* Jeton gövdeden değil başlıktan okunuyor: gövdeyi ayrıştırmadan önce
       karar verebilmek için. */
    const jeton = istek.headers.get("x-turnstile") ?? "";
    const ip = istek.headers.get("cf-connecting-ip") ?? undefined;
    const sonuc = await turnstileDogrula(jeton, ip);
    if (!sonuc.gecti) {
      return NextResponse.json(
        { tamam: false, hata: "Doğrulama tamamlanamadı, sayfayı yenileyip tekrar deneyin." },
        { status: 403, headers: basliklar },
      );
    }
  }

  let govde: unknown;
  try {
    govde = await istek.json();
  } catch {
    return NextResponse.json({ tamam: false, hata: "Gövde okunamadı." }, { status: 400, headers: basliklar });
  }

  const sonuc = talepSemasi.safeParse(govde);
  if (!sonuc.success) {
    return NextResponse.json(
      { tamam: false, alanlar: hatalar(sonuc.error) },
      { status: 422, headers: basliklar },
    );
  }

  const t = sonuc.data;
  const id = talepEkle({
    ad: t.ad,
    firma: t.firma,
    eposta: t.eposta,
    telefon: t.telefon,
    saglayici: t.saglayici,
    kisi: t.kisi,
    aciklama: t.not,
    kaynak: t.kaynak,
  });

  return NextResponse.json({ tamam: true, id }, { status: 201, headers: basliklar });
}

export async function OPTIONS(istek: Request) {
  return onIstek(istek);
}

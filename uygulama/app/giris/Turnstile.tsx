"use client";

import Script from "next/script";

/**
 * Cloudflare Turnstile bulmacası.
 *
 * Widget, formun içine `cf-turnstile-response` adlı gizli bir alan koyuyor;
 * sunucu eylemi jetonu oradan okuyup Cloudflare'e doğrulatıyor.
 *
 * **Görünümü biçimlendirilemez**: widget çapraz kökenli bir iframe, içi
 * Cloudflare'in kendi arayüzü. Bizim yapabileceğimiz tek şey ne zaman ve ne
 * boyutta çizileceğini söylemek:
 *
 * - `interaction-only` — kutu normalde **hiç çizilmiyor**. Cloudflare arka
 *   planda karar veriyor; yalnızca gerçekten şüphelendiğinde bulmacayı
 *   gösteriyor. Sayfanın ortasında sürekli duran bir Cloudflare kutusu
 *   yerine, tasarımı bozmayan ve çoğu ziyaretçinin hiç görmediği bir koruma.
 * - `flexible` — belirdiğinde kartın genişliğine oturuyor, 300px'lik sabit
 *   kutu olarak yanda kalmıyor.
 *
 * `next/script` kullanılıyor çünkü betik sayfa başına bir kez yüklenmeli;
 * doğrudan `<script>` yazmak React'in yeniden çizimlerinde birden fazla kopya
 * yükleyip widget'ı iki kez çizdiriyor.
 */
export function Turnstile({ siteAnahtari }: { siteAnahtari: string }) {
  if (!siteAnahtari) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="lazyOnload"
      />
      <div
        className="cf-turnstile turnstile-alan"
        data-sitekey={siteAnahtari}
        data-language="tr"
        data-theme="light"
        data-size="flexible"
        data-appearance="interaction-only"
      />
    </>
  );
}

import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Dışa açık uçların CORS'u sunucu/cors.ts'de; tek liste, tek yer.

  /*
   * Kök adres tanıtım sayfası.
   *
   * Sayfa `public/tanitim/index.html`'de duruyor (derleme öncesi
   * `araclar/siteyi-kopyala.mjs` oraya koyuyor). `beforeFiles` seçilmesinin
   * sebebi: bu aşama dosya sisteminden ve sayfa rotalarından **önce** çalışıyor,
   * yani uygulamanın kendi `/` rotası olsa bile tanıtım sayfası kazanıyor.
   *
   * Giriş yapmış kullanıcı `/` adresinde kendi panelini değil tanıtım sayfasını
   * görür; bu bilinçli. Üstteki "Giriş" bağlantısı `/giris`'e gider ve orası
   * açık oturumu görünce doğrudan panele bırakır.
   */
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/tanitim/index.html" }],
      afterFiles: [],
      fallback: [],
    };
  },

  /* Geliştirmede sayfayı 127.0.0.1 üzerinden açınca Next kendi dev kaynaklarını
     (HMR dahil) çapraz köken sayıp engelliyor; bağlantı kurulamayınca sayfa hiç
     hidrate olmuyor. İki adı da tanıtıyoruz. */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default config;

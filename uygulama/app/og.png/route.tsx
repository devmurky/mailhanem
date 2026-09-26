import { ImageResponse } from "next/og";

/**
 * Paylaşım görseli (Open Graph / Twitter).
 *
 * Sayfanın `og:image`i yoktu: WhatsApp, LinkedIn ve X'te bağlantı **görselsiz,
 * çıplak bir kart** olarak çıkıyordu. B2B'de site çoğunlukla WhatsApp'tan
 * paylaşılıyor, yani bu eksik doğrudan tıklanmayı düşürüyordu.
 *
 * Görsel diskte bir dosya değil, **burada üretiliyor**. Sebebi: başlık ya da
 * konumlandırma değiştiğinde birinin Photoshop açıp yeniden dışa aktarması
 * gerekmesin. Tasarım jetonları sayfanın kendi jetonlarıyla aynı, yani görsel
 * siteyle birlikte değişiyor.
 *
 * `next/og` Satori ile çiziyor: harici bağımlılık yok, çalışma anında PNG.
 */
export const runtime = "nodejs";

/* Paylaşım kartlarının beklediği ölçü. */
const GENISLIK = 1200;
const YUKSEKLIK = 630;

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#FFFFFF",
          padding: "64px 72px",
          fontFamily: "sans-serif",
          /* Sayfadaki pastel yıkamanın karşılığı. */
          backgroundImage:
            "linear-gradient(135deg, #EAF0F6 0%, #FFFFFF 45%, #E3F2EC 100%)",
        }}
      >
        {/* Marka satırı */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#1D4E7C",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
              <path d="M3.6 7.6l7.5 5a1.6 1.6 0 0 0 1.8 0l7.5-5" />
            </svg>
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, color: "#16202B", letterSpacing: -0.8 }}>
            Mailhanem
          </div>
        </div>

        {/* Sayfanın kendi başlığı — vaat burada. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 68,
              fontWeight: 700,
              color: "#16202B",
              letterSpacing: -2.4,
              lineHeight: 1.1,
            }}
          >
            info@ kutunuza üç kişi bakıyor.
          </div>
          <div
            style={{
              fontSize: 40,
              color: "#485664",
              letterSpacing: -1,
              lineHeight: 1.2,
            }}
          >
            Üçü de diğeri bakar sanıyor.
          </div>
        </div>

        {/* Ürün gerçeği — sayfadaki dürüstlük satırının aynısı. */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              background: "#0F7154",
            }}
          />
          <div style={{ fontSize: 24, color: "#0F7154", fontWeight: 600 }}>
            Onaysız hiçbir mail gitmez
          </div>
          <div style={{ fontSize: 24, color: "#A8B3BE" }}>·</div>
          <div style={{ fontSize: 24, color: "#485664" }}>
            Mailleriniz kendi sunucunuzda kalır
          </div>
        </div>
      </div>
    ),
    { width: GENISLIK, height: YUKSEKLIK },
  );
}

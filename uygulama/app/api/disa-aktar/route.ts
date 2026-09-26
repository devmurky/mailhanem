/**
 * Veri dışa aktarma ucu (madde 12).
 *
 * **Yetki burada kesiliyor.** Adres tahmin edilebilir; firmanın bütün
 * yazışmasını tek dosyada veren bir ucun kapısı, ek indirme ucundan daha sıkı
 * olmalı:
 *
 * - Oturum yoksa 401.
 * - Personel alamıyor: bu, kurulum ve yönetim kararı (`/panel/bilgi` ve
 *   `/panel/gunluk` ile aynı çizgi).
 * - Firma sınırı oturumdan geliyor; adreste firma numarası diye bir şey yok.
 * - Operatör bu uçtan indiremiyor. Servis sahibinin bütün firmaların verisini
 *   tek tıkla dosyalaması, müşterinin hesap kaydında görünmeyen bir yetki
 *   olurdu; operatörün kendi ekranları ayrı iş.
 *
 * Her indirme **hesap kaydına** yazılıyor: müşteri kendi verisinin ne zaman,
 * kim tarafından kopyalandığını görebiliyor.
 */
import {
  MAIL_BASLIKLARI,
  TICKET_BASLIKLARI,
  csvYap,
  dosyaAdi,
  mailSatirlari,
  tamKopya,
  ticketSatirlari,
} from "@/sunucu/disaAktar";
import { firmaGetir, gunlukYaz } from "@/sunucu/db";
import { suankiKullanici } from "@/sunucu/oturum";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TURLER = ["mail", "ticket", "hepsi"] as const;
type Tur = (typeof TURLER)[number];

const TUR_AD: Record<Tur, string> = {
  mail: "mailler",
  ticket: "destek talepleri",
  hepsi: "tüm veri",
};

export async function GET(istek: Request) {
  const kullanici = await suankiKullanici();
  if (!kullanici) return new Response("Yetkisiz", { status: 401 });
  if (kullanici.operator === 1 || kullanici.firma_id === null) {
    return new Response("Bu uç müşteri panelinindir.", { status: 403 });
  }
  if (kullanici.rol !== "sahip" && kullanici.rol !== "yonetici") {
    return new Response("Veri kopyasını sahip ya da yönetici alabilir.", { status: 403 });
  }

  const firma = firmaGetir(kullanici.firma_id);
  if (!firma) return new Response("Firma bulunamadı", { status: 404 });

  const ham = new URL(istek.url).searchParams.get("tur") ?? "";
  const tur: Tur = (TURLER as readonly string[]).includes(ham) ? (ham as Tur) : "hepsi";

  let govde: string;
  let ad: string;
  let tip: string;

  if (tur === "mail") {
    govde = csvYap(MAIL_BASLIKLARI, mailSatirlari(firma.id));
    ad = dosyaAdi(firma, "mailler", "csv");
    tip = "text/csv; charset=utf-8";
  } else if (tur === "ticket") {
    govde = csvYap(TICKET_BASLIKLARI, ticketSatirlari(firma.id));
    ad = dosyaAdi(firma, "talepler", "csv");
    tip = "text/csv; charset=utf-8";
  } else {
    govde = JSON.stringify(tamKopya(firma.id, firma), null, 2);
    ad = dosyaAdi(firma, "tum-veri", "json");
    tip = "application/json; charset=utf-8";
  }

  gunlukYaz("veri", `${kullanici.ad || kullanici.eposta} veri kopyası indirdi — ${TUR_AD[tur]}`, firma.id);

  const bayt = new TextEncoder().encode(govde);
  return new Response(bayt, {
    headers: {
      "Content-Type": tip,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(ad)}`,
      "Content-Length": String(bayt.byteLength),
      /* Kişisel veri; ara belleklerde durmasın. */
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

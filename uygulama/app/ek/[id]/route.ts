import { ekGetir, ticketGetir } from "@/sunucu/db";
import { ekOku } from "@/sunucu/ekDosya";
import { suankiKullanici } from "@/sunucu/oturum";

/**
 * Ek indirme.
 *
 * **Yetki burada kesiliyor.** Ek numarası tahmin edilebilir bir sayı; dosyayı
 * numarasını bilen herkese vermek, bir firmanın ekini başka firmaya açmak
 * olurdu. İki kapı var:
 *
 * - Operatör (`operator = 1`) her eke bakabiliyor — servis sahibi zaten
 *   bütün firmaların verisini görüyor.
 * - Müşteri yalnız **kendi firmasının** ekini alabiliyor.
 *
 * Dosya adı künyeden geliyor, diskteki addan değil: diskte rastgele bir
 * onaltılık ad duruyor, kullanıcı kendi verdiği adla indiriyor.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_istek: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const kullanici = await suankiKullanici();
  if (!kullanici) return new Response("Yetkisiz", { status: 401 });

  const ek = ekGetir(Number(id));
  if (!ek) return new Response("Bulunamadı", { status: 404 });

  if (kullanici.operator !== 1) {
    if (kullanici.firma_id === null || ek.firma_id !== kullanici.firma_id) {
      /* Var olmayan ve erişilemeyen aynı cevabı veriyor: 403 dönmek, o
         numarada bir ek olduğunu ele verirdi. */
      return new Response("Bulunamadı", { status: 404 });
    }
  }

  /* Ticket eki, ticket silinmişse künyede kalmış olabilir. */
  if (ek.ticket_id !== null && !ticketGetir(ek.ticket_id)) {
    return new Response("Bulunamadı", { status: 404 });
  }

  let icerik: Buffer;
  try {
    icerik = ekOku(ek.dosya);
  } catch {
    return new Response("Dosya okunamadı", { status: 410 });
  }

  return new Response(new Uint8Array(icerik), {
    headers: {
      "Content-Type": ek.tip || "application/octet-stream",
      /* `attachment`: tarayıcıda açmak yerine indirilsin. Yüklenen bir HTML
         ya da SVG'nin bizim kökenimizde çalışmasını istemiyoruz. */
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(ek.ad)}`,
      "Content-Length": String(icerik.byteLength),
      "Cache-Control": "private, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

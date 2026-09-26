/**
 * Dosya kaynağı: bir klasördeki `.eml` dosyalarını okur.
 *
 * Gerçek IMAP'la aynı arayüzü uygular; hattın tamamı canlı sunucu olmadan
 * denenebilsin diye var. Ayrıştırma da gerçeğiyle aynı kütüphaneyle yapılır,
 * yani burada geçen bir mail orada da aynı şekilde ayrıştırılır.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { simpleParser } from "mailparser";
import { type HamMail, type MailKaynagi } from "./kaynak.ts";

export class DosyaKaynagi implements MailKaynagi {
  readonly ad: string;
  private klasor: string;

  constructor(klasor: string) {
    this.klasor = klasor;
    this.ad = `dosya:${klasor}`;
  }

  async cek(enFazla: number): Promise<HamMail[]> {
    let dosyalar: string[];
    try {
      dosyalar = (await readdir(this.klasor))
        .filter((d) => extname(d).toLowerCase() === ".eml")
        .sort();
    } catch {
      return [];
    }

    const cikti: HamMail[] = [];
    for (const d of dosyalar.slice(0, enFazla)) {
      const ham = await readFile(join(this.klasor, d));
      cikti.push(await ayristir(ham, d));
    }
    return cikti;
  }
}

/** Ham RFC822 baytlarını HamMail'e çevirir. IMAP kaynağı da bunu kullanır. */
export async function ayristir(ham: Buffer, kaynakAd: string): Promise<HamMail> {
  const m = await simpleParser(ham);

  const basliklar: Record<string, string | undefined> = {};
  m.headerLines.forEach((satir) => {
    const i = satir.line.indexOf(":");
    if (i > 0) basliklar[satir.line.slice(0, i).trim()] = satir.line.slice(i + 1).trim();
  });

  const ilkGonderen = m.from?.value?.[0];
  const gonderen = (ilkGonderen?.address ?? "").toLowerCase();

  /* Message-ID yoksa içerikten deterministik bir kimlik üretiyoruz;
     böylece aynı mail ikinci çekimde tekrar yazılmıyor. */
  const kimlik =
    m.messageId?.trim() ||
    "uretilmis-" +
      createHash("sha256")
        .update(`${kaynakAd}|${gonderen}|${m.subject ?? ""}|${m.date?.toISOString() ?? ""}`)
        .digest("hex")
        .slice(0, 32);

  /* Satır içi görseller ek sayılmıyor: imzadaki logo da teknik olarak bir
     ek ve her mailin altına asılırsa gerçek ekler arasında kaybolur.
     `contentDisposition === "attachment"` ya da adı olan dosyalar kalıyor. */
  const ekler = (m.attachments ?? [])
    .filter((e) => e.contentDisposition !== "inline" || Boolean(e.filename))
    .map((e) => ({
      ad: e.filename || "adsiz",
      tip: e.contentType || "application/octet-stream",
      boyut: e.size ?? e.content?.length ?? 0,
      icerik: new Uint8Array(e.content ?? []),
    }));

  return {
    uid: null,
    mesajKimlik: kimlik,
    gonderenAd: ilkGonderen?.name ?? "",
    gonderen,
    konu: m.subject ?? "",
    tarih: m.date ?? new Date(),
    metin: m.text ?? "",
    basliklar,
    ekler,
  };
}

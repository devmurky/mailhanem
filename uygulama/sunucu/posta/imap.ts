/**
 * Gerçek IMAP kaynağı.
 *
 * Kutu okunur, hiçbir şey değiştirilmez: bağlantı salt okunur açılır, mailler
 * okundu diye işaretlenmez. Müşterinin kutusu bizim dokunuşumuzla değişmemeli —
 * Outlook'unu açtığında her şey bıraktığı gibi durmalı.
 */
import { ImapFlow } from "imapflow";
import { ayristir } from "./dosya.ts";
import { type HamMail, type MailKaynagi } from "./kaynak.ts";

export type ImapAyar = {
  sunucu: string;
  port: number;
  kullanici: string;
  parola: string;
  /** 993 için true; 143 + STARTTLS için false. */
  tls?: boolean;
};

export class ImapKaynagi implements MailKaynagi {
  readonly ad: string;
  private ayar: ImapAyar;

  constructor(ayar: ImapAyar) {
    this.ayar = ayar;
    this.ad = `imap:${ayar.kullanici}@${ayar.sunucu}`;
  }

  async cek(enFazla: number): Promise<HamMail[]> {
    const istemci = new ImapFlow({
      host: this.ayar.sunucu,
      port: this.ayar.port,
      secure: this.ayar.tls ?? this.ayar.port === 993,
      auth: { user: this.ayar.kullanici, pass: this.ayar.parola },
      logger: false,
    });

    await istemci.connect();
    try {
      /* readOnly: kutuya dokunmuyoruz, okundu işareti koymuyoruz. */
      const kilit = await istemci.getMailboxLock("INBOX", { readOnly: true });
      try {
        const kutu = istemci.mailbox;
        const toplam = typeof kutu === "object" && kutu ? kutu.exists : 0;
        if (!toplam) return [];

        const ilk = Math.max(1, toplam - enFazla + 1);
        const cikti: HamMail[] = [];

        for await (const ileti of istemci.fetch(`${ilk}:*`, { source: true, uid: true })) {
          if (!ileti.source) continue;
          const mail = await ayristir(ileti.source as Buffer, this.ad);
          mail.uid = typeof ileti.uid === "number" ? ileti.uid : null;
          cikti.push(mail);
        }
        return cikti;
      } finally {
        kilit.release();
      }
    } finally {
      await istemci.logout().catch(() => istemci.close());
    }
  }
}

/** Kurulumda "bağlantıyı birlikte test edelim" adımı. Kaç mail var, onu döner. */
export async function baglantiyiDene(
  ayar: ImapAyar,
): Promise<{ tamam: true; adet: number } | { tamam: false; hata: string }> {
  const istemci = new ImapFlow({
    host: ayar.sunucu,
    port: ayar.port,
    secure: ayar.tls ?? ayar.port === 993,
    auth: { user: ayar.kullanici, pass: ayar.parola },
    logger: false,
  });
  try {
    await istemci.connect();
    const kilit = await istemci.getMailboxLock("INBOX", { readOnly: true });
    try {
      const kutu = istemci.mailbox;
      return { tamam: true, adet: typeof kutu === "object" && kutu ? kutu.exists : 0 };
    } finally {
      kilit.release();
    }
  } catch (e) {
    return { tamam: false, hata: e instanceof Error ? e.message : String(e) };
  } finally {
    await istemci.logout().catch(() => istemci.close());
  }
}

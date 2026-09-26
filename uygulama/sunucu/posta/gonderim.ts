/**
 * Giden posta.
 *
 * Mailhanem bugüne kadar yalnızca mail **okuyordu**; giriş bağlantısı sunucu
 * günlüğüne yazılıyordu. Burası uygulamanın kendi gönderdiği mailler için:
 * giriş bağlantısı, ekip daveti. **Müşterinin yanıtları buradan geçmiyor** —
 * o ayrı bir iş ve henüz yok.
 *
 * İki uygulama var ve hangisinin seçildiği ortama bakar:
 *
 * - **SMTP** — `SMTP_SUNUCU` tanımlıysa gerçekten gönderir (nodemailer).
 * - **Günlük** — tanımlı değilse konsola yazar ve *gönderdim demez*.
 *   `gercek: false` döner; çağıran taraf bunu bilir ve kullanıcıya yalan
 *   söylemez. Geliştirmede bağlantıyı konsoldan kopyalamak için de gerekli.
 *
 * Gönderim hataları kullanıcıya sızdırılmaz: giriş formunun hangi adresin
 * kayıtlı olduğunu ele vermemesi gerekiyor, hata mesajı da bunu ele verebilir.
 * Hatalar günlüğe ve `ayarlar` tablosuna yazılır; operatör panelinde görünür.
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ayarYaz } from "../db.ts";

export type Mesaj = {
  kime: string;
  konu: string;
  /** Düz metin gövde. HTML gönderilmiyor: bu mailler kısa ve işlevsel. */
  metin: string;
  /** `From` başlığını ayara değil buna göre kurar — müşterinin kendi kutusu için. */
  gonderen?: string;
  /** Ek başlıklar; yanıtlarda `In-Reply-To` ve `References` buradan geçiyor. */
  basliklar?: Record<string, string>;
};

export type GonderimSonucu = {
  /** Mail gerçekten bir sunucuya teslim edildiyse true. Günlük modunda false. */
  gercek: boolean;
  hata?: string;
  /** Gönderilen mailin Message-ID'si; yanıt zincirini takip etmek için. */
  mesajKimlik?: string;
};

const SON_GONDERIM = "posta_son_gonderim";
const SON_HATA = "posta_son_hata";

function simdi(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export type PostaAyari = {
  sunucu: string;
  port: number;
  guvenli: boolean;
  kullanici: string;
  parola: string;
  gonderen: string;
};

/** Ortamdaki SMTP ayarı; sunucu adresi yoksa undefined. */
export function postaAyari(): PostaAyari | undefined {
  const sunucu = (process.env.SMTP_SUNUCU ?? "").trim();
  if (!sunucu) return undefined;

  const port = Number(process.env.SMTP_PORT ?? 587);
  return {
    sunucu,
    port: Number.isInteger(port) && port > 0 ? port : 587,
    /* 465 örtük TLS'tir; 587 STARTTLS ile açılır. Ayar açıkça verilebilir. */
    guvenli: (process.env.SMTP_GUVENLI ?? "").trim()
      ? process.env.SMTP_GUVENLI === "1" || process.env.SMTP_GUVENLI === "true"
      : port === 465,
    kullanici: (process.env.SMTP_KULLANICI ?? "").trim(),
    parola: process.env.SMTP_PAROLA ?? "",
    gonderen: (process.env.SMTP_GONDEREN ?? "").trim() || "Mailhanem <bildirim@mailhanem.app>",
  };
}

export function postaAcikMi(): boolean {
  return postaAyari() !== undefined;
}

/*
 * Taşıyıcı bir kez kurulur; her mail için yeni bağlantı açmak gereksiz.
 * Önbellek ayarın kendisiyle anahtarlanıyor: ortam değişirse eski bağlantıya
 * yapışıp kalmasın.
 */
let tasiyici: { anahtar: string; t: import("nodemailer").Transporter } | undefined;

async function tasiyiciGetir(ayar: PostaAyari) {
  const anahtar = `${ayar.sunucu}:${ayar.port}:${ayar.guvenli}:${ayar.kullanici}`;
  if (tasiyici?.anahtar === anahtar) return tasiyici.t;

  const { createTransport } = await import("nodemailer");
  const t = createTransport({
    host: ayar.sunucu,
    port: ayar.port,
    secure: ayar.guvenli,
    auth: ayar.kullanici ? { user: ayar.kullanici, pass: ayar.parola } : undefined,
  });
  tasiyici = { anahtar, t };
  return t;
}

/**
 * SMTP kapalıyken giden maillerin düştüğü yerel dosya.
 *
 * Konsola yazmak yetmiyordu: sunucuyu arka planda çalıştıran biri giriş
 * bağlantısını hiç göremiyor ve panele giremiyordu. Dosya `veri/` altında —
 * veritabanıyla aynı klasör, aynı güven seviyesi, sürüm kontrolüne girmiyor.
 *
 * Bu bir "geliştirme girişi" arka kapısı **değil**: bağlantıyı ağdan kimseye
 * açmıyor, yalnızca sunucunun diskine yazıyor. Dosyayı okuyabilen zaten
 * veritabanını da okuyabilir.
 */
const DOSYA = resolve(process.env.DB_YOLU ? dirname(process.env.DB_YOLU) : resolve(process.cwd(), "veri"), "giden-mailler.log");

function diskeYaz(m: Mesaj): void {
  const satir = [
    "",
    "═".repeat(72),
    `${simdi()}  →  ${m.kime}`,
    `Konu: ${m.konu}`,
    "─".repeat(72),
    m.metin,
    "",
  ].join("\n");
  try {
    mkdirSync(dirname(DOSYA), { recursive: true });
    appendFileSync(DOSYA, satir, "utf8");
  } catch (e) {
    /* Günlük tutulamıyorsa akış durmamalı; konsol zaten yazıyor. */
    console.error(`[posta] günlük dosyasına yazılamadı: ${e instanceof Error ? e.message : e}`);
  }
}

/**
 * Mesajı gönderir. Hata fırlatmaz — çağıran akışlar (giriş, davet) bir posta
 * sunucusu yüzünden yarıda kalmamalı; sonuç nesnesine bakarlar.
 */
export async function gonder(m: Mesaj): Promise<GonderimSonucu> {
  const ayar = postaAyari();

  if (!ayar) {
    console.log(`[posta] SMTP kapalı — gönderilmedi: ${m.kime} · ${m.konu}\n${m.metin}`);
    diskeYaz(m);
    return { gercek: false };
  }

  return gonderIle(ayar, m, true);
}

/**
 * Verilen SMTP ayarıyla gönderir. İki çağıranı var: uygulamanın kendi
 * mailleri (`gonder`, ortamdaki ayar) ve müşterinin kutusundan çıkan yanıtlar
 * (`posta/yanit.ts`, kutunun kendi ayarı). Hata fırlatmaz.
 *
 * `damgala` yalnızca uygulamanın kendi gönderimlerinde açık: operatör
 * panelindeki "son gönderim" satırı müşteri yanıtlarıyla karışmasın.
 */
export async function gonderIle(
  ayar: PostaAyari,
  m: Mesaj,
  damgala = false,
): Promise<GonderimSonucu> {
  try {
    const t = await tasiyiciGetir(ayar);
    const sonuc = await t.sendMail({
      from: m.gonderen ?? ayar.gonderen,
      to: m.kime,
      subject: m.konu,
      text: m.metin,
      headers: m.basliklar,
    });
    if (damgala) {
      ayarYaz(SON_GONDERIM, `${simdi()} · ${m.kime}`);
      ayarYaz(SON_HATA, "");
    }
    return { gercek: true, mesajKimlik: sonuc.messageId };
  } catch (e) {
    const hata = e instanceof Error ? e.message : String(e);
    console.error(`[posta] gönderilemedi: ${m.kime} · ${hata}`);
    if (damgala) ayarYaz(SON_HATA, `${simdi()} · ${hata}`);
    return { gercek: false, hata };
  }
}

/** Operatör panelindeki "posta gönderimi" kartının okuduğu şey. */
export function gonderimDurumu(): {
  acik: boolean;
  gonderen: string;
  sunucu: string;
} {
  const ayar = postaAyari();
  return {
    acik: ayar !== undefined,
    gonderen: ayar?.gonderen ?? "",
    sunucu: ayar ? `${ayar.sunucu}:${ayar.port}${ayar.guvenli ? " · TLS" : " · STARTTLS"}` : "",
  };
}

export const POSTA_AYAR_ANAHTARLARI = { SON_GONDERIM, SON_HATA } as const;

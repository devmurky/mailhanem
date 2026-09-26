/**
 * Dil modeli istemcisi.
 *
 * Tek çağrı yeri burası. Üç karar:
 *
 * 1. **SDK yok, `fetch` var.** Proje bağımlılıkları yalın (ImapFlow, mailparser,
 *    nodemailer, zod) ve bir HTTP çağrısı için paket eklemek bu ölçekte
 *    gereksiz. Anthropic Messages API'si düz JSON.
 * 2. **Anahtar yoksa patlamıyoruz.** `bagli: false` dönüyor; çağıran bunu
 *    kullanıcıya olduğu gibi söylüyor. "Model cevap vermedi" demek yanlış
 *    olurdu — model hiç aranmadı.
 * 3. **Ücret varsayım.** Birim fiyat ortamdan geliyor; girilmemişse kuruş sıfır
 *    yazılıyor ve token kaydı yine tutuluyor (bkz. `aiKullanimYaz`).
 */

/** Varsayılan model. `ZEKA_MODEL` ile değiştirilebilir. */
const VARSAYILAN_MODEL = "claude-sonnet-5";

/** Anthropic'in sürüm başlığı; API'nin kendi sözleşmesi. */
const API_SURUM = "2023-06-01";

export type ZekaCevabi =
  | { durum: "bagli-degil" }
  | { durum: "tamam"; metin: string; model: string; girdiToken: number; ciktiToken: number }
  | { durum: "hata"; hata: string; model: string };

/**
 * Anahtar iki adla da kabul ediliyor.
 *
 * Proje kendi değişkenlerini Türkçe adlandırıyor (`MAILHANEM_ANAHTAR`,
 * `TURNSTILE_GIZLI`), ama operatör panelindeki entegrasyon listesi bu iş
 * yazılmadan önce `ANTHROPIC_API_KEY` diye yazmıştı ve sağlayıcının kendi
 * belgeleri de o adı kullanıyor. İkisini de okuyoruz: hangi adı yazarsa
 * yazsın anahtar çalışsın — "girdim ama çalışmıyor" en pahalı hata olurdu.
 */
function anahtariOku(): string {
  return (
    (process.env.ANTHROPIC_ANAHTAR ?? "").trim() ||
    (process.env.ANTHROPIC_API_KEY ?? "").trim()
  );
}

export function zekaBagliMi(): boolean {
  return Boolean(anahtariOku());
}

export function zekaModeli(): string {
  return (process.env.ZEKA_MODEL ?? "").trim() || VARSAYILAN_MODEL;
}

/**
 * Token başına kuruş. `ZEKA_KURUS_1M_GIRDI` / `ZEKA_KURUS_1M_CIKTI` ortamda
 * milyon token başına kuruş olarak verilir; verilmezse maliyet sıfır yazılır.
 */
export function kurusHesapla(girdiToken: number, ciktiToken: number): number {
  const oku = (ad: string): number => {
    const sayi = Number((process.env[ad] ?? "").trim());
    return Number.isFinite(sayi) && sayi > 0 ? sayi : 0;
  };
  const girdi = (girdiToken / 1_000_000) * oku("ZEKA_KURUS_1M_GIRDI");
  const cikti = (ciktiToken / 1_000_000) * oku("ZEKA_KURUS_1M_CIKTI");
  return girdi + cikti;
}

export async function modeleSor(v: {
  sistem: string;
  istem: string;
  enFazlaJeton?: number;
  /** Ağ takılırsa kullanıcıyı sonsuza kadar bekletmeyelim. */
  zamanAsimiMs?: number;
}): Promise<ZekaCevabi> {
  const anahtar = anahtariOku();
  if (!anahtar) return { durum: "bagli-degil" };

  const model = zekaModeli();
  const kesici = AbortSignal.timeout(v.zamanAsimiMs ?? 90_000);

  try {
    const cevap = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: kesici,
      headers: {
        "content-type": "application/json",
        "x-api-key": anahtar,
        "anthropic-version": API_SURUM,
      },
      body: JSON.stringify({
        model,
        max_tokens: v.enFazlaJeton ?? 4000,
        system: v.sistem,
        messages: [{ role: "user", content: v.istem }],
      }),
    });

    if (!cevap.ok) {
      /* Gövdeyi okuyoruz ama kullanıcıya kısaltarak veriyoruz: API hata
         gövdeleri uzun ve içinde anahtar parçası geçebiliyor. */
      const govde = await cevap.text().catch(() => "");
      const kisa = govde.slice(0, 200).replace(/\s+/g, " ").trim();
      return {
        durum: "hata",
        model,
        hata: `Model isteği reddedildi (HTTP ${cevap.status})${kisa ? `: ${kisa}` : ""}`,
      };
    }

    const veri = (await cevap.json()) as {
      content?: { type?: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const metin = (veri.content ?? [])
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("")
      .trim();

    if (!metin) return { durum: "hata", model, hata: "Model boş cevap döndü." };

    return {
      durum: "tamam",
      metin,
      model,
      girdiToken: veri.usage?.input_tokens ?? 0,
      ciktiToken: veri.usage?.output_tokens ?? 0,
    };
  } catch (e) {
    const mesaj = e instanceof Error ? e.message : String(e);
    return {
      durum: "hata",
      model,
      hata: mesaj.includes("timeout") || mesaj.includes("abort")
        ? "Model zamanında cevap vermedi."
        : `Modele ulaşılamadı: ${mesaj}`,
    };
  }
}

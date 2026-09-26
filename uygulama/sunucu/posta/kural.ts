/**
 * Kural motoru — modelden ÖNCE çalışır.
 *
 * Ürün İlkesi 3: "Yapay zekâya gitmeyen mail, ücretlendirilmeyen maildir."
 * Bülten, no-reply, otomatik yanıt ve iç yazışma buradan geri çevrilir; modele
 * hiç ulaşmaz. İkinci ve daha önemli sebep: otomatik yanıt veren bir adrese
 * yapay zekânın cevap yazması, iki sistemi sonsuz bir döngüye sokar.
 *
 * Saf fonksiyon: ağ yok, veritabanı yok. Başlıkları ver, kararı al.
 */

export type Basliklar = Record<string, string | undefined>;

export type Girdi = {
  /** Gönderenin adresi, örn. "ayse@firma.com" */
  gonderen: string;
  konu: string;
  basliklar: Basliklar;
  /** Firmanın kendi alan adları — bunlardan geleni iç yazışma sayarız. */
  kendiAlanlar: string[];
};

export type Karar =
  | { gecer: true }
  | { gecer: false; kural: KuralAdi; sebep: string };

export type KuralAdi =
  | "bulten"
  | "no-reply"
  | "otomatik-yanit"
  | "ic-yazisma"
  | "gonderen-yok";

/** Başlık adları büyük/küçük harf duyarsızdır; okumayı tek yerden yapıyoruz. */
function bas(b: Basliklar, ad: string): string {
  const anahtar = Object.keys(b).find((k) => k.toLowerCase() === ad.toLowerCase());
  return anahtar ? (b[anahtar] ?? "").trim() : "";
}

function alanAdi(adres: string): string {
  const i = adres.lastIndexOf("@");
  return i < 0 ? "" : adres.slice(i + 1).trim().toLowerCase();
}

function yerelKisim(adres: string): string {
  const i = adres.lastIndexOf("@");
  return (i < 0 ? adres : adres.slice(0, i)).trim().toLowerCase();
}

/* no-reply kalıpları: ayraç ne olursa olsun yakalanır (no-reply, noreply, no_reply…) */
const NO_REPLY = /^(no[-._]?reply|do[-._]?not[-._]?reply|donotreply|noreply|nepasrepondre|bounce|mailer[-._]?daemon|postmaster)$/;

export function kararVer(g: Girdi): Karar {
  const gonderen = g.gonderen.trim().toLowerCase();

  if (!gonderen || !gonderen.includes("@")) {
    return {
      gecer: false,
      kural: "gonderen-yok",
      sebep: "Gönderen adresi okunamadı",
    };
  }

  /* 1) Bülten: List-Unsubscribe varsa bu bir yayın, kişisel yazışma değil. */
  if (bas(g.basliklar, "list-unsubscribe") || bas(g.basliklar, "list-id")) {
    return { gecer: false, kural: "bulten", sebep: "List-Unsubscribe" };
  }

  /* 2) Otomatik yanıt: cevap yazarsak döngü başlar. */
  const otoGonderim = bas(g.basliklar, "auto-submitted").toLowerCase();
  if (otoGonderim && otoGonderim !== "no") {
    return { gecer: false, kural: "otomatik-yanit", sebep: `Auto-Submitted: ${otoGonderim}` };
  }
  const oncelik = bas(g.basliklar, "precedence").toLowerCase();
  if (["bulk", "list", "junk", "auto_reply"].includes(oncelik)) {
    return { gecer: false, kural: "otomatik-yanit", sebep: `Precedence: ${oncelik}` };
  }
  if (bas(g.basliklar, "x-autoreply") || bas(g.basliklar, "x-autorespond")) {
    return { gecer: false, kural: "otomatik-yanit", sebep: "X-Autoreply" };
  }
  if (bas(g.basliklar, "x-auto-response-suppress")) {
    return { gecer: false, kural: "otomatik-yanit", sebep: "X-Auto-Response-Suppress" };
  }
  /* Boş Return-Path (<>) teslimat bildirimlerinin işaretidir. */
  if (bas(g.basliklar, "return-path").replace(/[<>\s]/g, "") === "") {
    if (bas(g.basliklar, "return-path")) {
      return { gecer: false, kural: "otomatik-yanit", sebep: "Boş Return-Path" };
    }
  }

  /* 3) no-reply: yanıtlanamayan gönderen. */
  if (NO_REPLY.test(yerelKisim(gonderen))) {
    return { gecer: false, kural: "no-reply", sebep: "Yanıtlanamaz gönderen" };
  }

  /* 4) İç yazışma: kendi alan adımızdan gelen mail müşteri maili değildir. */
  const alan = alanAdi(gonderen);
  const kendi = g.kendiAlanlar.map((a) => a.trim().toLowerCase()).filter(Boolean);
  if (alan && kendi.some((k) => alan === k || alan.endsWith("." + k))) {
    return { gecer: false, kural: "ic-yazisma", sebep: `Kendi alan adınız (${alan})` };
  }

  return { gecer: true };
}

/** Arayüzde gösterilecek kısa adlar. */
export const KURAL_AD: Record<KuralAdi, string> = {
  bulten: "Bülten",
  "no-reply": "no-reply adresi",
  "otomatik-yanit": "Otomatik yanıt",
  "ic-yazisma": "İç yazışma",
  "gonderen-yok": "Gönderen okunamadı",
};

/**
 * Geçmiş maillerden firmanın karakterini çıkarır.
 *
 * ── Neden iki kaynak ─────────────────────────────────────
 * **Giden yanıtlar** firmanın kendi sesi: nasıl selamlıyor, ne kadar resmi,
 * neyi söz veriyor. Karakter buradan çıkıyor.
 * **Gelen mailler** müşterinin ne sorduğu: kargo, iade, montaj, fiyat. Bilgi
 * kartları buradan çıkıyor — tekrar tekrar sorulan şeyin cevabı depoda dursun.
 *
 * ── İki kural ────────────────────────────────────────────
 * 1. **Çıkan hiçbir şey doğrudan depoya girmiyor.** Hepsi öneri olarak
 *    yazılıyor; yönetici onaylamadan karaktere ya da karta dönüşmüyor.
 *    (Ürün İlkesi 1: insan onayı olmadan hiçbir şey gitmez.)
 * 2. **Modele giden metin kırpılıyor.** Gövdelerin imza/alıntı kuyruğu
 *    `imzaAyir` ile ayrılıyor: hem gürültü hem gereksiz kişisel veri (telefon,
 *    adres) modele gitmesin. KVKK sayfasında yazan şey bu.
 */
import {
  cikarimDerlemi,
  cikarimYaz,
  gunlukYaz,
  karakterGetir,
  oneriEkle,
  aiKullanimYaz,
} from "../db.ts";
import { KARAKTER_ALANLARI, KARAKTER_AD, type KarakterAlani } from "../bilgiSabitleri.ts";
import { KATEGORILER } from "../kategoriler.ts";
import { imzaAyir } from "../posta/imza.ts";
import { kurusHesapla, modeleSor, zekaBagliMi } from "./istemci.ts";

/** Derlem sınırları: maliyet ve istem boyu bu ikisiyle belirleniyor. */
const SINIR = { mail: 60, yanit: 40 } as const;
/** Tek bir metin istemi şişirmesin. */
const METIN_SINIRI = 1200;
/** Model en fazla bu kadar kart önersin; onaylanacak liste okunabilir kalsın. */
const EN_FAZLA_KART = 10;

export type CikarimSonucu =
  | { durum: "bagli-degil" }
  | { durum: "veri-yok" }
  | { durum: "hata"; hata: string }
  | { durum: "tamam"; oneri: number; okunanMail: number; okunanYanit: number };

const SISTEM = [
  "Sen bir Türk KOBİ'sinin ortak posta kutusunu inceleyen bir asistansın.",
  "Görevin, geçmiş yazışmalardan firmanın karakterini ve tekrar eden gerçeklerini çıkarmak.",
  "Yalnızca yazışmalarda GERÇEKTEN geçen bilgiyi yaz; eksik olanı uydurma, tahmin etme.",
  "Bir alandan emin değilsen o alanı hiç yazma — boş bırakmak, uydurmaktan iyidir.",
  "Çıktın yalnızca JSON olacak; önünde ve arkasında açıklama, kod çiti olmayacak.",
].join(" ");

function istemKur(v: {
  firmaAd: string;
  yanitlar: { konu: string; metin: string }[];
  mailler: { konu: string; metin: string }[];
  mevcut: string[];
}): string {
  const parcalar: string[] = [];

  parcalar.push(`Firma: ${v.firmaAd}`);
  parcalar.push("");
  parcalar.push("## Firmanın gönderdiği yanıtlar (kendi sesi)");
  v.yanitlar.forEach((y, i) => {
    parcalar.push(`--- yanıt ${i + 1} · konu: ${y.konu}`);
    parcalar.push(y.metin);
  });

  parcalar.push("");
  parcalar.push("## Firmaya gelen mailler (müşteriler ne soruyor)");
  v.mailler.forEach((m, i) => {
    parcalar.push(`--- mail ${i + 1} · konu: ${m.konu}`);
    parcalar.push(m.metin);
  });

  if (v.mevcut.length) {
    parcalar.push("");
    parcalar.push("## Depoda zaten yazılı olanlar (bunları tekrar önerme)");
    parcalar.push(v.mevcut.join("\n"));
  }

  parcalar.push("");
  parcalar.push("## İstenen çıktı");
  parcalar.push(
    [
      "Şu şemada tek bir JSON nesnesi döndür:",
      "{",
      '  "karakter": {',
      ...KARAKTER_ALANLARI.map((a) => `    "${a}": "${KARAKTER_AD[a]}",`),
      "  },",
      '  "kartlar": [',
      '    { "baslik": "kısa başlık", "icerik": "cevabın kendisi",',
      `      "kategori": "${KATEGORILER.join(" | ")} | (boş)",`,
      '      "dayanak": "hangi maillerden çıkardığın, tek cümle" }',
      "  ]",
      "}",
      "",
      `Kart sayısı en fazla ${EN_FAZLA_KART}. Emin olmadığın alanı JSON'a hiç koyma.`,
      "İçerikleri Türkçe ve kısa yaz; imza metnini olduğu gibi aktar.",
    ].join("\n"),
  );

  return parcalar.join("\n");
}

/** Model bazen JSON'u kod çitiyle sarıyor; çiti soyup ayrıştırıyoruz. */
function jsonAyristir(metin: string): unknown {
  let ham = metin.trim();
  if (ham.startsWith("```")) {
    ham = ham.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/, "").trim();
  }
  const bas = ham.indexOf("{");
  const son = ham.lastIndexOf("}");
  if (bas < 0 || son <= bas) throw new Error("JSON bulunamadı");
  return JSON.parse(ham.slice(bas, son + 1));
}

type Cikti = {
  karakter: Partial<Record<KarakterAlani, string>>;
  kartlar: { baslik: string; icerik: string; kategori: string; dayanak: string }[];
};

/**
 * Ham çıktıyı güvenli bir yapıya indirger.
 *
 * zod yerine elle: beklediğimiz şekil çok küçük ve modelin döndürdüğü her
 * fazlalığı sessizce atmak istiyoruz. Tanınmayan alan, boş dizgi, yanlış tip —
 * hepsi düşüyor; kalan şey yazılabilir olan.
 */
function ciktiyiTemizle(ham: unknown): Cikti {
  const cikti: Cikti = { karakter: {}, kartlar: [] };
  if (!ham || typeof ham !== "object") return cikti;

  const kok = ham as Record<string, unknown>;
  const karakter = kok.karakter;
  if (karakter && typeof karakter === "object") {
    for (const alan of KARAKTER_ALANLARI) {
      const deger = (karakter as Record<string, unknown>)[alan];
      if (typeof deger === "string" && deger.trim()) {
        cikti.karakter[alan] = deger.trim().slice(0, 2000);
      }
    }
  }

  const kartlar = kok.kartlar;
  if (Array.isArray(kartlar)) {
    for (const k of kartlar.slice(0, EN_FAZLA_KART)) {
      if (!k || typeof k !== "object") continue;
      const s = k as Record<string, unknown>;
      const baslik = typeof s.baslik === "string" ? s.baslik.trim() : "";
      const icerik = typeof s.icerik === "string" ? s.icerik.trim() : "";
      if (!icerik) continue;

      const kategori = typeof s.kategori === "string" ? s.kategori.trim() : "";
      cikti.kartlar.push({
        baslik: (baslik || icerik.slice(0, 60)).slice(0, 120),
        icerik: icerik.slice(0, 2000),
        /* Tanınmayan kategori boşa düşüyor: uydurma bir kategori adı panelin
           süzgeçlerinde karşılığı olmayan bir çip olurdu. */
        kategori: (KATEGORILER as readonly string[]).includes(kategori) ? kategori : "",
        dayanak: typeof s.dayanak === "string" ? s.dayanak.trim().slice(0, 300) : "",
      });
    }
  }

  return cikti;
}

export async function karakterCikar(v: {
  firmaId: number;
  firmaAd: string;
  kullaniciId: number;
}): Promise<CikarimSonucu> {
  if (!zekaBagliMi()) return { durum: "bagli-degil" };

  const derlem = cikarimDerlemi(v.firmaId, { mail: SINIR.mail, yanit: SINIR.yanit });

  /* Gövdenin imza/alıntı kuyruğu modele gitmiyor. */
  const mailler = derlem.mailler
    .map((m) => ({
      konu: m.konu,
      metin: (imzaAyir(m.govde).metin || m.ozet).slice(0, METIN_SINIRI),
    }))
    .filter((m) => m.metin.trim());
  const yanitlar = derlem.yanitlar
    .map((y) => ({ konu: y.konu, metin: imzaAyir(y.metin).metin.slice(0, METIN_SINIRI) }))
    .filter((y) => y.metin.trim());

  if (!mailler.length && !yanitlar.length) return { durum: "veri-yok" };

  const mevcut = [...karakterGetir(v.firmaId).entries()].map(
    ([alan, satir]) => `${alan}: ${satir.deger}`,
  );

  const cevap = await modeleSor({
    sistem: SISTEM,
    istem: istemKur({ firmaAd: v.firmaAd, yanitlar, mailler, mevcut }),
  });

  if (cevap.durum === "bagli-degil") return { durum: "bagli-degil" };

  if (cevap.durum === "hata") {
    cikarimYaz({
      firmaId: v.firmaId, baslatanId: v.kullaniciId, okunanMail: mailler.length,
      okunanYanit: yanitlar.length, oneri: 0, model: cevap.model, hata: cevap.hata,
    });
    gunlukYaz("zeka", `Bilgi deposu çıkarımı başarısız: ${cevap.hata}`, v.firmaId);
    return { durum: "hata", hata: cevap.hata };
  }

  /* Maliyet kaydı, çıktı okunamasa bile yazılıyor: çağrı yapıldı, token yandı. */
  aiKullanimYaz({
    firmaId: v.firmaId,
    isTuru: "karakter",
    model: cevap.model,
    girdiToken: cevap.girdiToken,
    ciktiToken: cevap.ciktiToken,
    kurus: kurusHesapla(cevap.girdiToken, cevap.ciktiToken),
  });

  let cikti: Cikti;
  try {
    cikti = ciktiyiTemizle(jsonAyristir(cevap.metin));
  } catch {
    const hata = "Model okunabilir bir cevap vermedi; depoya hiçbir şey yazılmadı.";
    cikarimYaz({
      firmaId: v.firmaId, baslatanId: v.kullaniciId, okunanMail: mailler.length,
      okunanYanit: yanitlar.length, oneri: 0, model: cevap.model, hata,
    });
    gunlukYaz("zeka", `Bilgi deposu çıkarımı: ${hata}`, v.firmaId);
    return { durum: "hata", hata };
  }

  /* Depodakiyle birebir aynı öneri kullanıcıya iş çıkarmaktan başka bir şey
     yapmaz; onları atıyoruz. */
  const suanki = karakterGetir(v.firmaId);
  let sayi = 0;

  for (const alan of KARAKTER_ALANLARI) {
    const deger = cikti.karakter[alan];
    if (!deger) continue;
    if (suanki.get(alan)?.deger.trim() === deger) continue;
    oneriEkle(v.firmaId, { tur: "karakter", alan, icerik: deger });
    sayi++;
  }

  for (const kart of cikti.kartlar) {
    oneriEkle(v.firmaId, {
      tur: "kart",
      baslik: kart.baslik,
      icerik: kart.icerik,
      kategori: kart.kategori,
      dayanak: kart.dayanak,
    });
    sayi++;
  }

  cikarimYaz({
    firmaId: v.firmaId, baslatanId: v.kullaniciId, okunanMail: mailler.length,
    okunanYanit: yanitlar.length, oneri: sayi, model: cevap.model,
  });
  gunlukYaz(
    "zeka",
    `Bilgi deposu çıkarımı çalıştı: ${mailler.length} mail, ${yanitlar.length} yanıt okundu, ${sayi} öneri çıktı`,
    v.firmaId,
  );

  return {
    durum: "tamam",
    oneri: sayi,
    okunanMail: mailler.length,
    okunanYanit: yanitlar.length,
  };
}

/* Test ve ekran tarafının görmesi gereken iç parçalar. */
export const denemeIcin = { ciktiyiTemizle, jsonAyristir, istemKur, SINIR, METIN_SINIRI };

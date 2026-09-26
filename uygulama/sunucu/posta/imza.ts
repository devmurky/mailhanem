/**
 * İmza / alıntı / yasal uyarı kuyruğunu asıl mesajdan ayırır (madde 1).
 *
 * Sorun şu: her mailin altında altı satırlık bir imza var — ad, unvan, telefon,
 * web adresi, bir de "bu e-posta gizlidir" paragrafı. Liste ekranındaki özet
 * bunlarla doluyor ve "Tel: 0212..." yazan on mail birbirinden ayırt
 * edilemiyor. Mail detayında da gözün ilk gördüğü şey mesaj değil imza oluyor.
 *
 * ── İki kural ────────────────────────────────────────────
 *
 * 1. **Kuyruk silinmiyor, ayrılıyor.** Fonksiyon iki parça döndürüyor; gövde
 *    veritabanında tam hâliyle duruyor. İmzada gerçekten işe yarayan bir şey
 *    olabilir (doğru telefon numarası, vergi dairesi) ve onu silmek, okumayı
 *    kolaylaştırmak için veriyi atmak olurdu. Arayüz kuyruğu katlayıp
 *    gösteriyor, atmıyor.
 * 2. **Şüphedeyse kesme.** Yanlış kesme, kesmemekten kötü: mesajın son
 *    paragrafı kaybolursa kullanıcı onu hiç görmeyebilir. O yüzden her işaret
 *    için ayrı bir koşul var ve kesilen yerin önünde en az bir dolu satır
 *    kalması şart.
 *
 * ── Neden ayrı dosya, neden veritabanı yok ───────────────
 * Buradaki tek iş metin kesmek; `node:sqlite` bu dosyaya girmiyor. Böylece
 * testler veritabanı kurmadan çalışıyor ve gerekirse arayüz tarafı da bu
 * modülü import edebiliyor (bkz. AGENTS.md'deki "use client" kuralı).
 */

/** Kuyruğu hangi işaret kesti — arayüzdeki etiket buna bakıyor. */
export type KuyrukSebebi = "ayrac" | "alinti" | "kapanis" | "iletisim" | "yasal";

export const KUYRUK_AD: Record<KuyrukSebebi, string> = {
  ayrac: "İmza",
  alinti: "Alıntılanan yazışma",
  kapanis: "İmza",
  iletisim: "İmza",
  yasal: "Yasal uyarı",
};

export type AyrilmisGovde = {
  /** Asıl mesaj. Kesilecek şey bulunamazsa gövdenin tamamı. */
  metin: string;
  /** Kesilen kuyruk. Boşsa kesilmedi. */
  kuyruk: string;
  /** Neden kesildi. Kuyruk boşken bu da boş. */
  sebep: KuyrukSebebi | "";
};

/**
 * Türkçe harf katlaması.
 *
 * `db.ts`'teki `turkceKatla` ile aynı işi yapıyor ama oradan import edilmiyor:
 * o dosya açılırken veritabanını açıyor, bu modül ise saf kalsın diye ayrı
 * duruyor. Kopya bilinçli.
 *
 * Katlama şart, çünkü gelen maillerin çoğu Türkçe karakter taşımıyor:
 * "Teşekkürler" de "Tesekkurler" de aynı kapanış.
 */
const HARF: Record<string, string> = {
  ı: "i", İ: "i", ş: "s", Ş: "s", ğ: "g", Ğ: "g",
  ü: "u", Ü: "u", ö: "o", Ö: "o", ç: "c", Ç: "c", â: "a", î: "i", û: "u",
};

function katla(metin: string): string {
  return metin.replace(/[ıİşŞğĞüÜöÖçÇâîû]/g, (h) => HARF[h] ?? h).toLowerCase();
}

/**
 * İmza kuyruğunun boyu. Bundan uzun bir "kuyruk" artık kuyruk değil, mesajın
 * kendisidir — o yüzden kapanış ve çizgi işaretleri bu sınırın üstünde kesmez.
 */
const KUYRUK_EN_FAZLA_SATIR = 10;

/** İmza satırları kısadır. Bundan uzun satır düz yazı sayılıyor. */
const IMZA_SATIR_UZUNLUK = 60;

/**
 * Kaç satırlık kuyruk arayüzde katlanmaya değer.
 *
 * "Teşekkürler, / Ayşe Demir" iki satır: onu katlayıp arkasına düğme koymak,
 * gösterdiğinden fazla yer tutar. Özet tarafında ise her kesme işe yarıyor —
 * bu eşik yalnızca ekrandaki karar.
 */
export const KATLAMA_ESIGI = 3;

/** İletişim izleri: telefon, adres, site, kurumsal son ek. */
const ILETISIM = [
  /^(tel|gsm|cep|mobil|faks|fax|phone|mobile|direct|ofis|office|adres|address)\s*[:.]/,
  /^[tmpf]\s*[:.]\s*[+(\d]/,
  /\+\d[\d ()./-]{8,}/,
  /\b0\d{3}[ ./-]?\d{3}[ ./-]?\d{2}[ ./-]?\d{2}\b/,
  /\b(www\.|https?:\/\/)/,
  /[\w.+-]+@[\w-]+\.[a-z]{2,}/,
  /\b(a\.?\s?s\.?|ltd\.?|sti\.?|san\.|tic\.|inc\.|llc|gmbh)(\s|$|,)/,
];

/** Kapanış kalıpları. Satırın **başında** aranıyor. */
const KAPANIS = [
  "saygilarimla", "saygilarimizla", "saygilarim", "saygilar",
  "iyi calismalar", "iyi gunler", "iyi aksamlar", "iyi haftalar", "kolay gelsin",
  "tesekkurler", "tesekkur ederim", "tesekkur ederiz", "tesekkurlerimle",
  "simdiden tesekkurler", "sevgiler", "selamlar", "hosca kalin",
  "best regards", "kind regards", "warm regards", "regards", "sincerely",
  "yours truly", "yours sincerely", "thanks", "thank you", "cheers", "br",
];

/** Alıntı başlıkları: "... şunu yazdı:", "On ... wrote:", "Original Message". */
const ALINTI = [
  /-{2,}\s*(original message|orijinal mesaj|forwarded message|iletilen (ileti|mesaj))/,
  /^(on|tarihinde)\b.{0,160}\bwrote\s*:?\s*$/,
  /\bwrote\s*:\s*$/,
  /\byaz(di|diniz|misti|mis)\s*:\s*$/,
  /\bsunlari? yazdi\s*:?\s*$/,
  /^(begin forwarded message|iletilen mesaj)\s*:?\s*$/,
];

/** Yasal uyarı kalıpları. */
const YASAL = [
  /^bu (e-?\s?posta|e-?mail|mesaj|ileti|elektronik posta)\b.{0,120}(gizli|mahrem|yalniz|sadece|hukuk|yasal|kisiye ozel)/,
  /^this (e-?mail|message|communication|transmission)\b.{0,140}(confidential|privileged|intended)/,
  /^(yasal uyari|gizlilik (bildirimi|uyarisi)|disclaimer|legal notice)\b/,
];

/** Outlook'un alıntı başlığı: "From: ... Sent: ... Subject: ...". */
const BASLIK_ANAHTAR = /^(from|kimden|gonderen)\s*:/;
const BASLIK_DESTEK = /^(sent|gonderildi|tarih|date|to|kime|subject|konu|cc|bilgi)\s*:/;

function iletisimIzi(katlanmis: string): boolean {
  return ILETISIM.some((k) => k.test(katlanmis));
}

/**
 * `bas` satırından sonuna kadar olan kısım imza biçiminde mi?
 *
 * Kısa satırlardan oluşan, en fazla on satırlık bir blok imza sayılıyor. Uzun
 * satır varsa yalnızca bir iletişim izi görürsek kesiyoruz — bazı imzalarda
 * tek uzun adres satırı oluyor.
 */
function imzaBicimli(satirlar: string[], bas: number): boolean {
  const kalan = satirlar.slice(bas).map((s) => s.trim()).filter(Boolean);
  if (!kalan.length) return false;
  if (kalan.length > KUYRUK_EN_FAZLA_SATIR) return false;
  const uzunVar = kalan.some((s) => s.length > IMZA_SATIR_UZUNLUK);
  return !uzunVar || kalan.some((s) => iletisimIzi(katla(s)));
}

/** `i`'den önce dolu satır var mı — yoksa kesim mesajı yok eder. */
function oncesiDolu(satirlar: string[], i: number): boolean {
  return satirlar.slice(0, i).some((s) => s.trim());
}

/** Outlook başlık bloğu: "From:" satırını üç satır içinde bir "Subject:" izler. */
function baslikBloguMu(satirlar: string[], i: number): boolean {
  if (!BASLIK_ANAHTAR.test(katla((satirlar[i] ?? "").trim()))) return false;
  return satirlar
    .slice(i + 1, i + 5)
    .some((s) => BASLIK_DESTEK.test(katla(s.trim())));
}

/**
 * Son bloğa bakan yedek kural.
 *
 * Kapanış cümlesi de ayraç da olmayan imzalar var: boş satırdan sonra ad,
 * unvan, telefon. Hiçbir işaret bulunamadıysa son blok buna benziyor mu diye
 * bakılıyor — iletişim izi şart, yoksa "Ayşe Demir" yazan tek satırı da
 * keserdik.
 */
function sonBlokBasi(satirlar: string[]): number {
  let son = satirlar.length;
  while (son > 0 && !(satirlar[son - 1] ?? "").trim()) son--;
  if (!son) return -1;

  let bas = son;
  while (bas > 0 && (satirlar[bas - 1] ?? "").trim()) bas--;
  if (bas <= 0) return -1;
  if (!oncesiDolu(satirlar, bas)) return -1;

  const blok = satirlar.slice(bas, son).map((s) => s.trim());
  if (blok.length > KUYRUK_EN_FAZLA_SATIR) return -1;
  if (blok.some((s) => s.length > IMZA_SATIR_UZUNLUK)) return -1;
  return blok.some((s) => iletisimIzi(katla(s))) ? bas : -1;
}

/**
 * Gövdeyi mesaj ve kuyruk olarak ayırır.
 *
 * Kesim noktası **en erken** eşleşen işaret: mail bir kez imzaya girdiyse
 * altında kalan her şey (ikinci imza, alıntı, yasal uyarı) kuyruğun parçası.
 */
export function imzaAyir(govde: string): AyrilmisGovde {
  const duz = (govde ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const satirlar = duz.split("\n");

  for (let i = 0; i < satirlar.length; i++) {
    const ham = (satirlar[i] ?? "").trim();
    if (!ham) continue;
    if (!oncesiDolu(satirlar, i)) continue;

    const f = katla(ham);

    /* RFC 3676'nın imza ayracı. Tek başına yeterli işaret: biçim aramıyoruz. */
    if (/^(--|—)$/.test(ham)) return kes(satirlar, i, "ayrac");

    if (ALINTI.some((k) => k.test(f))) return kes(satirlar, i, "alinti");
    if (baslikBloguMu(satirlar, i)) return kes(satirlar, i, "alinti");
    if (YASAL.some((k) => k.test(f))) return kes(satirlar, i, "yasal");

    /* Çizgi ya da alt çizgi dizisi: imza ayracı da olabilir, mesajın içinde
       bölüm ayracı da. Arkasından imza gelmiyorsa dokunmuyoruz. */
    if (/^([-_=*]{3,}|_{2,})$/.test(ham) && imzaBicimli(satirlar, i + 1)) {
      return kes(satirlar, i, "ayrac");
    }

    /* Kapanış cümlesi. "İyi günler," mailin başında selam olarak da geçiyor;
       o yüzden hem önünde mesaj olması hem arkasında imza gelmesi şart. */
    if (ham.length <= 32 && KAPANIS.some((k) => f.startsWith(k)) && imzaBicimli(satirlar, i + 1)) {
      return kes(satirlar, i, "kapanis");
    }
  }

  const blok = sonBlokBasi(satirlar);
  if (blok > 0) return kes(satirlar, blok, "iletisim");

  return { metin: duz.trim(), kuyruk: "", sebep: "" };
}

function kes(satirlar: string[], i: number, sebep: KuyrukSebebi): AyrilmisGovde {
  const metin = satirlar.slice(0, i).join("\n").trim();
  const kuyruk = satirlar.slice(i).join("\n").trim();
  /* Kesim mesajı yok ettiyse kesmiş sayılmıyoruz — gövdenin tamamı dönüyor. */
  if (!metin) return { metin: satirlar.join("\n").trim(), kuyruk: "", sebep: "" };
  return { metin, kuyruk, sebep };
}

/**
 * Kuyruk ekranda katlanmaya değer mi?
 *
 * İki satırlık bir imzayı katlamak, kazandırdığı yerden fazlasını düğmeye
 * harcıyor. Alıntı ve yasal uyarı her boyda katlanıyor — onlar okuma akışını
 * gerçekten bozan kısım.
 */
export function kuyrukKatlanir(a: AyrilmisGovde): boolean {
  if (!a.kuyruk) return false;
  if (a.sebep === "alinti" || a.sebep === "yasal") return true;
  return a.kuyruk.split("\n").filter((s) => s.trim()).length >= KATLAMA_ESIGI;
}

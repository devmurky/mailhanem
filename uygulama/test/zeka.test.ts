/**
 * Çıkarım boru hattı.
 *
 * Anahtar yok; olması da gerekmiyor. Denenen şey modelin ne söylediği değil,
 * **çevresindeki kurallar**:
 *
 * - Anahtar yokken ağa hiç çıkılmıyor ve bu dürüstçe söyleniyor.
 * - Modelin çıktısı depoya doğrudan girmiyor, öneriye düşüyor.
 * - Modele giden metinde imza kuyruğu yok.
 * - Bozuk çıktı hiçbir şey yazdırmıyor.
 *
 * Gerçek çağrı `fetch` yerine konan bir sahteyle taklit ediliyor.
 */
import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { after, before, beforeEach, describe, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const klasor = mkdtempSync(join(tmpdir(), "mailhanem-zeka-"));
process.env.DB_YOLU = join(klasor, "deneme.db");
process.env.MAILHANEM_ANAHTAR = randomBytes(32).toString("base64");
Object.assign(process.env, { NODE_ENV: "production" });
/* Testler ortamdan anahtar okumasın; her test kendi durumunu kuruyor.
   **İkisi de siliniyor:** istemci iki adı da kabul ediyor ve geliştirme
   makinesinde `ANTHROPIC_API_KEY` tanımlı olabilir — o zaman "anahtar yokken"
   testleri sessizce yanlış dalı denerdi. */
delete process.env.ANTHROPIC_ANAHTAR;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ZEKA_KURUS_1M_GIRDI;
delete process.env.ZEKA_KURUS_1M_CIKTI;

type DB = typeof import("../sunucu/db.ts");
type Istemci = typeof import("../sunucu/zeka/istemci.ts");
type Karakter = typeof import("../sunucu/zeka/karakter.ts");

let d: DB;
let istemci: Istemci;
let zeka: Karakter;
let firma = 0, kisi = 0, kutu = 0;

/** Sahte `fetch`: son isteği saklıyor, verilen gövdeyi döndürüyor. */
const gercekFetch = globalThis.fetch;
let sonIstek: { url: string; govde: string } | null = null;
/** İsteğe hangi anahtarın gittiği — iki ad sınanırken buna bakılıyor. */
let sonAnahtar = "";
let cagriSayisi = 0;

function fetchSahtele(modelMetni: string): void {
  cagriSayisi = 0;
  sonIstek = null;
  sonAnahtar = "";
  globalThis.fetch = (async (url: string | URL | Request, ayar?: RequestInit) => {
    cagriSayisi++;
    sonIstek = { url: String(url), govde: String(ayar?.body ?? "") };
    sonAnahtar = String((ayar?.headers as Record<string, string> | undefined)?.["x-api-key"] ?? "");
    return new Response(
      JSON.stringify({
        content: [{ type: "text", text: modelMetni }],
        usage: { input_tokens: 1200, output_tokens: 300 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
}

before(async () => {
  d = await import("../sunucu/db.ts");
  istemci = await import("../sunucu/zeka/istemci.ts");
  zeka = await import("../sunucu/zeka/karakter.ts");

  firma = (d.db
    .prepare("INSERT INTO firmalar (ad, alan_adi) VALUES (?, ?) RETURNING id")
    .get("Arkun Mobilya", "arkunmobilya.com") as { id: number }).id;
  kisi = (d.db
    .prepare("INSERT INTO kullanicilar (firma_id, eposta, ad, rol) VALUES (?, ?, ?, 'sahip') RETURNING id")
    .get(firma, "ayse@arkunmobilya.com", "Ayşe Demir") as { id: number }).id;
  kutu = d.kutuEkle({
    firma_id: firma, adres: "info@arkunmobilya.com", saglayici: "cPanel",
    imap_sunucu: "imap.turhost.com", imap_port: 993, smtp_sunucu: "", smtp_port: 465,
    kullanici_adi: "info@arkunmobilya.com", parola_sifreli: null,
  });

  /* Gövdesinde imza olan bir mail: kuyruğun modele gitmediğini burada görüyoruz. */
  d.mailEkle({
    kutu_id: kutu, firma_id: firma, mesaj_kimlik: "<z1@ornek.com>", uid: null,
    gonderen_ad: "Ayça Tuncel", gonderen: "ayca@ornek.com",
    konu: "Kargo ne zaman gelir?",
    ozet: "Siparişim ne zaman gelir?",
    govde:
      "Merhaba,\n\nGeçen hafta verdiğim sipariş ne zaman gelir?\n\n--\n" +
      "Ayça Tuncel\nSatınalma\nTel: 0212 555 44 33\nwww.ornekmusteri.com",
    tarih: "2026-09-20 10:00:00", elendi: null, eleme_sebep: "",
  });
  const mailId = (d.db
    .prepare("SELECT id FROM mailler WHERE mesaj_kimlik = ?")
    .get("<z1@ornek.com>") as { id: number }).id;

  d.yanitEkle({
    mail_id: mailId, firma_id: firma, kullanici_id: kisi,
    kime: "ayca@ornek.com", konu: "Re: Kargo ne zaman gelir?",
    metin: "Merhaba Ayça Hanım,\n\nSiparişiniz cuma günü çıkıyor.\n\nİyi çalışmalar,\nArkun Mobilya",
    mesaj_kimlik: "<bizim@arkunmobilya.com>", hata: null,
  });
});

beforeEach(() => {
  delete process.env.ANTHROPIC_ANAHTAR;
  delete process.env.ANTHROPIC_API_KEY;
  globalThis.fetch = gercekFetch;
  d.db.prepare("DELETE FROM bilgi_onerileri").run();
  d.db.prepare("DELETE FROM bilgi_cikarimlari").run();
  d.db.prepare("DELETE FROM ai_kullanim").run();
});

after(() => {
  globalThis.fetch = gercekFetch;
  d.db.close();
  rmSync(klasor, { recursive: true, force: true });
});

describe("istemci", () => {
  test("anahtar yokken bağlı değil ve ağa hiç çıkılmıyor", async () => {
    fetchSahtele("{}");
    delete process.env.ANTHROPIC_ANAHTAR;
    delete process.env.ANTHROPIC_API_KEY;

    const cevap = await istemci.modeleSor({ sistem: "s", istem: "i" });
    assert.equal(cevap.durum, "bagli-degil");
    assert.equal(cagriSayisi, 0, "anahtar yokken istek atılmamalı");
    assert.equal(istemci.zekaBagliMi(), false);
  });

  /**
   * Anahtarın iki adı da çalışmalı: proje Türkçe adlandırıyor ama operatör
   * panelindeki entegrasyon listesi ve sağlayıcının kendi belgeleri
   * `ANTHROPIC_API_KEY` diyor. Yanlış ada yazıp "girdim ama çalışmıyor" demek,
   * en pahalı hata olurdu.
   */
  test("ANTHROPIC_API_KEY adıyla da bağlanıyor", async () => {
    fetchSahtele("merhaba");
    delete process.env.ANTHROPIC_ANAHTAR;
    process.env.ANTHROPIC_API_KEY = "sk-eski-ad";

    assert.equal(istemci.zekaBagliMi(), true);
    const cevap = await istemci.modeleSor({ sistem: "s", istem: "i" });
    assert.equal(cevap.durum, "tamam");
    assert.equal(cagriSayisi, 1);
  });

  test("iki ad birden varken Türkçe olan kazanıyor", async () => {
    fetchSahtele("merhaba");
    process.env.ANTHROPIC_ANAHTAR = "sk-tercih-edilen";
    process.env.ANTHROPIC_API_KEY = "sk-eski-ad";

    await istemci.modeleSor({ sistem: "s", istem: "i" });
    assert.equal(sonAnahtar, "sk-tercih-edilen");
  });

  test("anahtar varken istek Anthropic'e gidiyor ve token okunuyor", async () => {
    fetchSahtele("merhaba");
    process.env.ANTHROPIC_ANAHTAR = "sk-deneme";

    const cevap = await istemci.modeleSor({ sistem: "sistem metni", istem: "istem metni" });
    assert.equal(cevap.durum, "tamam");
    if (cevap.durum !== "tamam") return;

    assert.equal(cevap.metin, "merhaba");
    assert.equal(cevap.girdiToken, 1200);
    assert.equal(cevap.ciktiToken, 300);
    assert.ok(sonIstek?.url.includes("api.anthropic.com"));
    assert.ok(sonIstek?.govde.includes("istem metni"));
  });

  test("birim fiyat girilmemişse maliyet sıfır, girilmişse hesaplanıyor", () => {
    assert.equal(istemci.kurusHesapla(1_000_000, 1_000_000), 0);

    process.env.ZEKA_KURUS_1M_GIRDI = "100";
    process.env.ZEKA_KURUS_1M_CIKTI = "500";
    assert.equal(istemci.kurusHesapla(1_000_000, 200_000), 100 + 100);

    delete process.env.ZEKA_KURUS_1M_GIRDI;
    delete process.env.ZEKA_KURUS_1M_CIKTI;
  });
});

describe("çıktı ayrıştırma", () => {
  test("kod çitli JSON okunuyor", () => {
    const veri = zeka.denemeIcin.jsonAyristir('```json\n{"karakter":{"ton":"kısa"}}\n```');
    assert.deepEqual(veri, { karakter: { ton: "kısa" } });
  });

  test("JSON olmayan çıktı hata veriyor", () => {
    assert.throws(() => zeka.denemeIcin.jsonAyristir("bugün sana yardımcı olamam"));
  });

  test("tanınmayan alan, boş içerik ve uydurma kategori düşüyor", () => {
    const temiz = zeka.denemeIcin.ciktiyiTemizle({
      karakter: { ton: "  Kısa ve net  ", uydurma: "x", imza: "   " },
      kartlar: [
        { baslik: "İyi", icerik: "içerik", kategori: "satis" },
        { baslik: "Kategorisi uydurma", icerik: "içerik", kategori: "kargo" },
        { baslik: "İçeriksiz", icerik: "" },
        { icerik: "başlıksız ama içerikli" },
      ],
    });

    assert.deepEqual(Object.keys(temiz.karakter), ["ton"]);
    assert.equal(temiz.karakter.ton, "Kısa ve net");
    assert.equal(temiz.kartlar.length, 3, "içeriksiz kart düşer");
    assert.equal(temiz.kartlar[0]?.kategori, "satis");
    assert.equal(temiz.kartlar[1]?.kategori, "", "tanınmayan kategori boşa düşer");
    assert.equal(temiz.kartlar[2]?.baslik, "başlıksız ama içerikli");
  });

  test("kart sayısı sınırı aşılmıyor", () => {
    const cok = Array.from({ length: 30 }, (_, i) => ({ baslik: `k${i}`, icerik: "içerik" }));
    const temiz = zeka.denemeIcin.ciktiyiTemizle({ kartlar: cok });
    assert.equal(temiz.kartlar.length, 10);
  });
});

describe("çıkarım turu", () => {
  test("anahtar yokken hiçbir şey yazılmıyor", async () => {
    fetchSahtele("{}");
    const sonuc = await zeka.karakterCikar({ firmaId: firma, firmaAd: "Arkun", kullaniciId: kisi });

    assert.equal(sonuc.durum, "bagli-degil");
    assert.equal(cagriSayisi, 0);
    assert.equal(d.oneriSayisi(firma), 0);
    assert.equal(d.sonCikarim(firma), undefined, "tur kaydı bile açılmıyor");
  });

  test("modele giden metinde imza kuyruğu yok", async () => {
    process.env.ANTHROPIC_ANAHTAR = "sk-deneme";
    fetchSahtele('{"karakter":{},"kartlar":[]}');

    await zeka.karakterCikar({ firmaId: firma, firmaAd: "Arkun Mobilya", kullaniciId: kisi });

    const govde = sonIstek?.govde ?? "";
    assert.ok(govde.includes("sipariş ne zaman gelir"), "mailin kendisi gitmeli");
    assert.ok(!govde.includes("0212 555 44 33"), "imzadaki telefon gitmemeli");
    assert.ok(!govde.includes("www.ornekmusteri.com"), "imzadaki site gitmemeli");
    assert.ok(govde.includes("Siparişiniz cuma günü çıkıyor"), "giden yanıt da gitmeli");
  });

  test("çıkan her şey öneriye düşüyor, depoya girmiyor", async () => {
    process.env.ANTHROPIC_ANAHTAR = "sk-deneme";
    fetchSahtele(
      JSON.stringify({
        karakter: { ton: "Kısa ve net.", imza: "İyi çalışmalar, Arkun Mobilya" },
        kartlar: [
          { baslik: "Kargo", icerik: "Cuma günleri çıkıyor.", kategori: "destek", dayanak: "2 mail" },
        ],
      }),
    );

    const sonuc = await zeka.karakterCikar({
      firmaId: firma, firmaAd: "Arkun Mobilya", kullaniciId: kisi,
    });

    assert.equal(sonuc.durum, "tamam");
    if (sonuc.durum !== "tamam") return;
    assert.equal(sonuc.oneri, 3);

    assert.equal(d.oneriSayisi(firma), 3);
    assert.equal(d.karakterGetir(firma).size, 0, "karakter onaysız dolmadı");
    assert.equal(d.bilgiKartlari(firma).length, 0, "kart onaysız eklenmedi");

    const tur = d.sonCikarim(firma);
    assert.equal(tur?.oneri, 3);
    assert.equal(tur?.hata, "");
    assert.ok((tur?.okunan_mail ?? 0) > 0);

    /* Token kaydı da düşmüş olmalı: çağrı yapıldı, maliyet ölçülebilir. */
    const kullanim = d.db
      .prepare("SELECT is_turu, girdi_token, cikti_token FROM ai_kullanim WHERE firma_id = ?")
      .all(firma) as { is_turu: string; girdi_token: number; cikti_token: number }[];
    assert.equal(kullanim.length, 1);
    assert.equal(kullanim[0]?.is_turu, "karakter");
    assert.equal(kullanim[0]?.girdi_token, 1200);
  });

  test("depoda zaten yazılı olan alan yeniden önerilmiyor", async () => {
    process.env.ANTHROPIC_ANAHTAR = "sk-deneme";
    d.karakterYaz(firma, "ton", "Kısa ve net.", kisi);
    fetchSahtele(JSON.stringify({ karakter: { ton: "Kısa ve net." }, kartlar: [] }));

    const sonuc = await zeka.karakterCikar({
      firmaId: firma, firmaAd: "Arkun Mobilya", kullaniciId: kisi,
    });
    assert.equal(sonuc.durum, "tamam");
    if (sonuc.durum !== "tamam") return;
    assert.equal(sonuc.oneri, 0, "aynı metni ikinci kez onaylatmıyoruz");

    d.db.prepare("DELETE FROM karakter_alanlari WHERE firma_id = ?").run(firma);
  });

  test("bozuk çıktı hiçbir şey yazdırmıyor ama tur kaydına hata düşüyor", async () => {
    process.env.ANTHROPIC_ANAHTAR = "sk-deneme";
    fetchSahtele("bugün sana yardımcı olamam");

    const sonuc = await zeka.karakterCikar({
      firmaId: firma, firmaAd: "Arkun Mobilya", kullaniciId: kisi,
    });

    assert.equal(sonuc.durum, "hata");
    assert.equal(d.oneriSayisi(firma), 0);
    assert.ok(d.sonCikarim(firma)?.hata.includes("okunabilir"));
    /* Çağrı yapıldı: token kaydı yine yazılıyor. */
    const n = d.db
      .prepare("SELECT COUNT(*) AS n FROM ai_kullanim WHERE firma_id = ?")
      .get(firma) as { n: number };
    assert.equal(n.n, 1);
  });

  test("model hatası turu düşürüyor ama panel çalışmaya devam ediyor", async () => {
    process.env.ANTHROPIC_ANAHTAR = "sk-deneme";
    globalThis.fetch = (async () =>
      new Response("üst sınır aşıldı", { status: 429 })) as typeof fetch;

    const sonuc = await zeka.karakterCikar({
      firmaId: firma, firmaAd: "Arkun Mobilya", kullaniciId: kisi,
    });

    assert.equal(sonuc.durum, "hata");
    assert.ok(d.sonCikarim(firma)?.hata.includes("429"));
    assert.equal(d.oneriSayisi(firma), 0);
  });

  test("çıkarım turu hesap kaydına yazılıyor", async () => {
    process.env.ANTHROPIC_ANAHTAR = "sk-deneme";
    fetchSahtele(JSON.stringify({ karakter: { hitap: "Siz diliyle." }, kartlar: [] }));
    d.db.prepare("DELETE FROM gunluk").run();

    await zeka.karakterCikar({ firmaId: firma, firmaAd: "Arkun Mobilya", kullaniciId: kisi });

    const kayit = d.firmaGunlugu(firma, "zeka");
    assert.equal(kayit.length, 1);
    assert.ok(kayit[0]?.mesaj.includes("çıkarımı çalıştı"));
  });
});

/**
 * Bilgi deposu — veri katmanı.
 *
 * İki soru çiviliyor:
 *
 * 1. **Firma sınırı.** Bir firmanın karakteri ve kartları başka firmadan
 *    okunabiliyor mu, yazılabiliyor mu? (Panelin geri kalanındaki kural.)
 * 2. **Onay akışı.** Modelin ürettiği hiçbir şey onaylanmadan depoya
 *    girmiyor mu? Depoya giren şeyin kaynağı doğru yazılıyor mu?
 */
import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const klasor = mkdtempSync(join(tmpdir(), "mailhanem-bilgi-"));
process.env.DB_YOLU = join(klasor, "deneme.db");
process.env.MAILHANEM_ANAHTAR = randomBytes(32).toString("base64");
Object.assign(process.env, { NODE_ENV: "production" });

type DB = typeof import("../sunucu/db.ts");
let d: DB;
let firmaA = 0, firmaB = 0, ayse = 0, yabanci = 0;

before(async () => {
  d = await import("../sunucu/db.ts");

  const firma = (ad: string, alan: string) =>
    (d.db
      .prepare("INSERT INTO firmalar (ad, alan_adi) VALUES (?, ?) RETURNING id")
      .get(ad, alan) as { id: number }).id;
  const kisi = (fid: number, eposta: string, ad: string) =>
    (d.db
      .prepare("INSERT INTO kullanicilar (firma_id, eposta, ad, rol) VALUES (?, ?, ?, 'sahip') RETURNING id")
      .get(fid, eposta, ad) as { id: number }).id;

  firmaA = firma("Arkun Mobilya", "arkunmobilya.com");
  firmaB = firma("Kaya Isı", "kayaisi.com.tr");
  ayse = kisi(firmaA, "ayse@arkunmobilya.com", "Ayşe Demir");
  yabanci = kisi(firmaB, "zeynep@kayaisi.com.tr", "Zeynep Kaya");
});

after(() => {
  d.db.close();
  rmSync(klasor, { recursive: true, force: true });
});

describe("karakter", () => {
  test("yazılan alan geri okunur, kaynağı ve yazanı görünür", () => {
    d.karakterYaz(firmaA, "ton", "Kısa ve net, fazla resmi değil.", ayse);
    const k = d.karakterGetir(firmaA).get("ton");
    assert.equal(k?.deger, "Kısa ve net, fazla resmi değil.");
    assert.equal(k?.kaynak, "elle");
    assert.equal(k?.guncelleyen_ad, "Ayşe Demir");
  });

  test("ikinci yazma üstüne yazar, ikinci satır açmaz", () => {
    d.karakterYaz(firmaA, "ton", "birinci", ayse);
    d.karakterYaz(firmaA, "ton", "ikinci", ayse);
    assert.equal(d.karakterGetir(firmaA).get("ton")?.deger, "ikinci");

    const n = d.db
      .prepare("SELECT COUNT(*) AS n FROM karakter_alanlari WHERE firma_id = ? AND alan = 'ton'")
      .get(firmaA) as { n: number };
    assert.equal(n.n, 1);
  });

  test("boş değer alanı siler — yazılmamışı yazılmış göstermiyoruz", () => {
    d.karakterYaz(firmaA, "imza", "İyi çalışmalar", ayse);
    assert.ok(d.karakterGetir(firmaA).has("imza"));
    d.karakterYaz(firmaA, "imza", "   ", ayse);
    assert.equal(d.karakterGetir(firmaA).has("imza"), false);
  });

  test("firmanın karakteri başka firmaya sızmaz", () => {
    d.karakterYaz(firmaA, "tanim", "Mobilya üretiyoruz", ayse);
    d.karakterYaz(firmaB, "tanim", "Isı yalıtımı yapıyoruz", yabanci);

    assert.equal(d.karakterGetir(firmaA).get("tanim")?.deger, "Mobilya üretiyoruz");
    assert.equal(d.karakterGetir(firmaB).get("tanim")?.deger, "Isı yalıtımı yapıyoruz");
  });
});

describe("bilgi kartları", () => {
  test("eklenen kart listede, düzenleme ve silme firma sınırında", () => {
    const id = d.bilgiKartiEkle(
      firmaA,
      { baslik: "Kargo süresi", icerik: "Ankara'ya 5 iş günü.", kategori: "destek" },
      ayse,
    );

    let kart = d.bilgiKartlari(firmaA).find((k) => k.id === id);
    assert.equal(kart?.baslik, "Kargo süresi");
    assert.equal(kart?.kaynak, "elle");

    /* Başka firmanın numarasıyla düzenleme hiçbir şeye dokunmuyor. */
    d.bilgiKartiYaz(id, firmaB, { baslik: "ele geçti", icerik: "x", kategori: "" }, yabanci);
    kart = d.bilgiKartlari(firmaA).find((k) => k.id === id);
    assert.equal(kart?.baslik, "Kargo süresi");

    d.bilgiKartiYaz(id, firmaA, { baslik: "Kargo", icerik: "5 iş günü.", kategori: "destek" }, ayse);
    assert.equal(d.bilgiKartlari(firmaA).find((k) => k.id === id)?.baslik, "Kargo");

    d.bilgiKartiSil(id, firmaB);
    assert.ok(d.bilgiKartlari(firmaA).some((k) => k.id === id), "yanlış firma silemez");
    d.bilgiKartiSil(id, firmaA);
    assert.ok(!d.bilgiKartlari(firmaA).some((k) => k.id === id));
  });

  test("başka firmanın kartı listeye girmez", () => {
    d.bilgiKartiEkle(firmaB, { baslik: "B kartı", icerik: "gizli", kategori: "" }, yabanci);
    assert.ok(!d.bilgiKartlari(firmaA).some((k) => k.baslik === "B kartı"));
  });

  test("elle düzenlenen çıkarım kartı artık elle sayılır", () => {
    const id = d.bilgiKartiEkle(
      firmaA,
      { baslik: "İade", icerik: "14 gün", kategori: "", kaynak: "cikarim", dayanak: "3 mail" },
      ayse,
    );
    assert.equal(d.bilgiKartlari(firmaA).find((k) => k.id === id)?.kaynak, "cikarim");

    d.bilgiKartiYaz(id, firmaA, { baslik: "İade", icerik: "14 gün, kutusu açılmamışsa", kategori: "" }, ayse);
    assert.equal(
      d.bilgiKartlari(firmaA).find((k) => k.id === id)?.kaynak,
      "elle",
      "insan eli değince kaynak da değişir",
    );
    d.bilgiKartiSil(id, firmaA);
  });
});

describe("öneri akışı", () => {
  test("öneri tek başına depoya girmiyor", () => {
    const oncekiKart = d.bilgiKartlari(firmaA).length;
    d.oneriEkle(firmaA, {
      tur: "kart",
      baslik: "Montaj",
      icerik: "Montaj İstanbul içinde ücretsiz.",
      kategori: "destek",
      dayanak: "4 mailden",
    });

    assert.equal(d.bilgiKartlari(firmaA).length, oncekiKart, "onaylanmadan kart olmadı");
    assert.equal(d.oneriSayisi(firmaA), 1);
  });

  test("onaylanan kart önerisi depoya çıkarım damgasıyla geçiyor", () => {
    const oneri = d.onerileriGetir(firmaA)[0];
    assert.ok(oneri);

    assert.equal(d.oneriOnayla(oneri.id, firmaA, ayse), true);
    const kart = d.bilgiKartlari(firmaA).find((k) => k.baslik === "Montaj");
    assert.equal(kart?.icerik, "Montaj İstanbul içinde ücretsiz.");
    assert.equal(kart?.kaynak, "cikarim");
    assert.equal(kart?.dayanak, "4 mailden");
    assert.equal(d.oneriSayisi(firmaA), 0, "onaylanan öneri listeden düşer");
  });

  test("onaylanan karakter önerisi alana yazılıyor", () => {
    d.oneriEkle(firmaA, { tur: "karakter", alan: "hitap", icerik: "Sayın <ad>, siz diliyle." });
    const oneri = d.onerileriGetir(firmaA)[0];
    assert.ok(oneri);

    d.oneriOnayla(oneri.id, firmaA, ayse);
    const alan = d.karakterGetir(firmaA).get("hitap");
    assert.equal(alan?.deger, "Sayın <ad>, siz diliyle.");
    assert.equal(alan?.kaynak, "cikarim");
  });

  test("silinen öneri hiçbir şey yazmıyor", () => {
    const oncekiKart = d.bilgiKartlari(firmaA).length;
    d.oneriEkle(firmaA, { tur: "kart", baslik: "Yanlış bilgi", icerik: "olmayan kural" });
    const oneri = d.onerileriGetir(firmaA)[0];
    assert.ok(oneri);

    d.oneriSil(oneri.id, firmaA);
    assert.equal(d.oneriSayisi(firmaA), 0);
    assert.equal(d.bilgiKartlari(firmaA).length, oncekiKart);
  });

  test("başka firmanın önerisi onaylanamaz", () => {
    d.oneriEkle(firmaB, { tur: "kart", baslik: "B önerisi", icerik: "gizli" });
    const oneri = d.onerileriGetir(firmaB)[0];
    assert.ok(oneri);

    assert.equal(d.oneriOnayla(oneri.id, firmaA, ayse), false);
    assert.ok(!d.bilgiKartlari(firmaA).some((k) => k.baslik === "B önerisi"));
    assert.equal(d.oneriSayisi(firmaB), 1, "öneri yerinde duruyor");
  });
});

describe("çıkarım turları", () => {
  test("tur kaydı yazılıyor ve en sonu okunuyor", () => {
    d.cikarimYaz({
      firmaId: firmaA, baslatanId: ayse, okunanMail: 60, okunanYanit: 12,
      oneri: 7, model: "claude-sonnet-5",
    });
    const son = d.sonCikarim(firmaA);
    assert.equal(son?.okunan_mail, 60);
    assert.equal(son?.oneri, 7);
    assert.equal(son?.baslatan_ad, "Ayşe Demir");
    assert.equal(son?.hata, "");
  });

  test("başarılı tur günlük sınırı doldurur, hatalı tur doldurmaz", () => {
    assert.equal(d.bugunCikarimYapildi(firmaA), true);
    assert.equal(d.bugunCikarimYapildi(firmaB), false);

    d.cikarimYaz({
      firmaId: firmaB, baslatanId: yabanci, okunanMail: 0, okunanYanit: 0,
      oneri: 0, model: "claude-sonnet-5", hata: "model okunabilir cevap vermedi",
    });
    assert.equal(
      d.bugunCikarimYapildi(firmaB),
      false,
      "patlayan tur kullanıcıyı ertesi güne kilitlemez",
    );
    assert.equal(d.sonCikarim(firmaB)?.hata, "model okunabilir cevap vermedi");
  });

  test("dünkü tur bugünü kilitlemiyor", () => {
    d.db
      .prepare("UPDATE bilgi_cikarimlari SET olusma = datetime('now','-2 days') WHERE firma_id = ?")
      .run(firmaA);
    assert.equal(d.bugunCikarimYapildi(firmaA), false);
  });
});

/**
 * Yöneticinin kendi karakter maddesi.
 *
 * Hazır beş alan her firmaya uymuyor; yönetici kendi başlığını ekleyebiliyor.
 * Çakışan başlık, silme sınırı ve boşaltma davranışı burada çivileniyor.
 */
describe("özel karakter maddesi", () => {
  test("eklenen madde başlığıyla birlikte okunuyor", () => {
    const alan = d.karakterMaddeEkle(firmaA, "Kampanya dili", "İndirim oranı yazılmaz.", ayse);
    assert.ok(alan.startsWith("ozel:"));

    const satir = d.karakterGetir(firmaA).get(alan);
    assert.equal(satir?.baslik, "Kampanya dili");
    assert.equal(satir?.deger, "İndirim oranı yazılmaz.");
    assert.equal(satir?.kaynak, "elle");
  });

  test("aynı başlık ikinci kez eklenince anahtar çakışmıyor", () => {
    const a = d.karakterMaddeEkle(firmaA, "Bayi yazışması", "Bayiye fiyat verilir.", ayse);
    const b = d.karakterMaddeEkle(firmaA, "Bayi yazışması", "İkinci madde.", ayse);
    assert.notEqual(a, b);
    assert.equal(d.karakterGetir(firmaA).get(a)?.deger, "Bayiye fiyat verilir.");
    assert.equal(d.karakterGetir(firmaA).get(b)?.deger, "İkinci madde.");
  });

  test("özel madde boşaltılınca silinmiyor — başlık yerinde kalıyor", () => {
    const alan = d.karakterMaddeEkle(firmaA, "Geçici madde", "bir metin", ayse);
    d.karakterYaz(firmaA, alan, "   ", ayse);

    const satir = d.karakterGetir(firmaA).get(alan);
    assert.ok(satir, "satır durmalı");
    assert.equal(satir?.deger, "");
    assert.equal(satir?.baslik, "Geçici madde");
  });

  test("hazır alan boşaltılınca satır siliniyor", () => {
    d.karakterYaz(firmaA, "ton", "bir şey", ayse);
    d.karakterYaz(firmaA, "ton", "", ayse);
    assert.equal(d.karakterGetir(firmaA).has("ton"), false);
  });

  test("silme yalnız özel maddeye çalışıyor, hazır alan silinemiyor", () => {
    const alan = d.karakterMaddeEkle(firmaA, "Silinecek", "metin", ayse);
    d.karakterYaz(firmaA, "hitap", "Siz diliyle.", ayse);

    d.karakterMaddeSil(firmaA, "hitap");
    assert.ok(d.karakterGetir(firmaA).has("hitap"), "hazır alan bu yoldan silinmiyor");

    d.karakterMaddeSil(firmaA, alan);
    assert.equal(d.karakterGetir(firmaA).has(alan), false);
  });

  test("başka firmanın maddesi silinemiyor", () => {
    const alan = d.karakterMaddeEkle(firmaA, "A firmasının maddesi", "metin", ayse);
    d.karakterMaddeSil(firmaB, alan);
    assert.ok(d.karakterGetir(firmaA).has(alan), "firma sınırı burada da geçerli");
    d.karakterMaddeSil(firmaA, alan);
  });
});

/**
 * Deponun özeti — operatörün müşteri çekmecesi bunu okuyor.
 *
 * Sorusu şu: bu müşteri taslak adımına hazır mı? Sayılar firma sınırında
 * kalmalı; başka firmanın dolu deposu bu firmayı hazır göstermemeli.
 */
describe("depo özeti", () => {
  test("dolu maddeler, kartlar ve bekleyen öneriler sayılıyor", () => {
    d.db.prepare("DELETE FROM karakter_alanlari WHERE firma_id = ?").run(firmaA);
    d.db.prepare("DELETE FROM bilgi_kartlari WHERE firma_id = ?").run(firmaA);
    d.db.prepare("DELETE FROM bilgi_onerileri WHERE firma_id = ?").run(firmaA);

    d.karakterYaz(firmaA, "ton", "Kısa ve net.", ayse);
    d.karakterYaz(firmaA, "imza", "İyi çalışmalar", ayse);
    d.bilgiKartiEkle(firmaA, { baslik: "Kargo", icerik: "5 iş günü", kategori: "" }, ayse);
    d.oneriEkle(firmaA, { tur: "kart", baslik: "Montaj", icerik: "ücretsiz" });

    const o = d.bilgiOzeti(firmaA);
    assert.equal(o.alan, 2);
    assert.equal(o.kart, 1);
    assert.equal(o.oneri, 1);
  });

  test("boşaltılmış özel madde dolu sayılmıyor", () => {
    const alan = d.karakterMaddeEkle(firmaA, "Geçici", "bir metin", ayse);
    assert.equal(d.bilgiOzeti(firmaA).alan, 3);

    d.karakterYaz(firmaA, alan, "", ayse);
    assert.equal(d.bilgiOzeti(firmaA).alan, 2, "satır duruyor ama değeri boş");
    d.karakterMaddeSil(firmaA, alan);
  });

  test("son çıkarım yalnız başarılı turdan okunuyor", () => {
    d.db.prepare("DELETE FROM bilgi_cikarimlari WHERE firma_id = ?").run(firmaA);
    assert.equal(d.bilgiOzeti(firmaA).sonCikarim, null);

    d.cikarimYaz({
      firmaId: firmaA, baslatanId: ayse, okunanMail: 0, okunanYanit: 0,
      oneri: 0, model: "m", hata: "patladı",
    });
    assert.equal(d.bilgiOzeti(firmaA).sonCikarim, null, "hatalı tur sayılmıyor");

    d.cikarimYaz({
      firmaId: firmaA, baslatanId: ayse, okunanMail: 10, okunanYanit: 2,
      oneri: 3, model: "m",
    });
    assert.ok(d.bilgiOzeti(firmaA).sonCikarim);
  });

  test("başka firmanın deposu bu firmayı dolu göstermiyor", () => {
    d.db.prepare("DELETE FROM karakter_alanlari WHERE firma_id = ?").run(firmaB);
    d.db.prepare("DELETE FROM bilgi_kartlari WHERE firma_id = ?").run(firmaB);
    d.db.prepare("DELETE FROM bilgi_onerileri WHERE firma_id = ?").run(firmaB);

    const o = d.bilgiOzeti(firmaB);
    assert.deepEqual([o.alan, o.kart, o.oneri], [0, 0, 0]);
  });
});

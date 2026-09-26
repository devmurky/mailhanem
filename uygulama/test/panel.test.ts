/**
 * Müşteri panelinin veri katmanı.
 *
 * Buradaki asıl soru güzel görünüp görünmediği değil: **bir firmanın
 * kullanıcısı başka bir firmanın mailine ulaşabiliyor mu?** Panelin her
 * okuması ve her yazması firma sınırını sorgunun içinde taşıyor; testler o
 * sınırı iki firmayla birlikte zorluyor.
 *
 * Geçici bir veritabanı dosyası kullanılıyor; `NODE_ENV=production` verilerek
 * geliştirme örnek verisi yazılmıyor — kurulum yalnız bu dosyada.
 */
import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const klasor = mkdtempSync(join(tmpdir(), "mailhanem-test-"));
process.env.DB_YOLU = join(klasor, "deneme.db");
/* NODE_ENV tiplerde salt okunur; tohum.ts üretim dalına girsin diye yine de veriyoruz. */
Object.assign(process.env, { NODE_ENV: "production" });

type DB = typeof import("../sunucu/db.ts");
let d: DB;

/* Firma A: iki kullanıcı, bir kutu, üç mail. Firma B: bir kullanıcı, bir mail. */
let firmaA = 0, firmaB = 0;
let ayse = 0, burak = 0, yabanci = 0;
let kutuA = 0, kutuB = 0;
let mailGecen = 0, mailIkinci = 0, mailElenen = 0, mailB = 0;

before(async () => {
  d = await import("../sunucu/db.ts");

  const firma = (ad: string, alan: string) =>
    (d.db
      .prepare("INSERT INTO firmalar (ad, alan_adi) VALUES (?, ?) RETURNING id")
      .get(ad, alan) as { id: number }).id;

  const kisi = (fid: number, eposta: string, ad: string, rol: string) =>
    (d.db
      .prepare(
        "INSERT INTO kullanicilar (firma_id, eposta, ad, rol) VALUES (?, ?, ?, ?) RETURNING id",
      )
      .get(fid, eposta, ad, rol) as { id: number }).id;

  firmaA = firma("Arkun Mobilya", "arkunmobilya.com");
  firmaB = firma("Kaya Isı", "kayaisi.com.tr");

  ayse = kisi(firmaA, "ayse@arkunmobilya.com", "Ayşe Demir", "sahip");
  burak = kisi(firmaA, "burak@arkunmobilya.com", "Burak Tosun", "personel");
  yabanci = kisi(firmaB, "zeynep@kayaisi.com.tr", "Zeynep Kaya", "sahip");

  kutuA = d.kutuEkle({
    firma_id: firmaA, adres: "info@arkunmobilya.com", saglayici: "cPanel",
    imap_sunucu: "imap.turhost.com", imap_port: 993, smtp_sunucu: "", smtp_port: 465,
    kullanici_adi: "info@arkunmobilya.com", parola_sifreli: null,
  });
  kutuB = d.kutuEkle({
    firma_id: firmaB, adres: "info@kayaisi.com.tr", saglayici: "cPanel",
    imap_sunucu: "imap.turhost.com", imap_port: 993, smtp_sunucu: "", smtp_port: 465,
    kullanici_adi: "info@kayaisi.com.tr", parola_sifreli: null,
  });

  const mail = (
    kutu: number, fid: number, kimlik: string, gonderen: string, konu: string,
    tarih: string, elendi: string | null,
  ) => {
    d.mailEkle({
      kutu_id: kutu, firma_id: fid, mesaj_kimlik: kimlik, uid: null,
      gonderen_ad: gonderen.split("@")[0] ?? "", gonderen, konu,
      ozet: konu + " özeti", govde: konu + " gövdesi", tarih,
      elendi, eleme_sebep: elendi ? "kural" : "",
    });
    return (d.db
      .prepare("SELECT id FROM mailler WHERE mesaj_kimlik = ?")
      .get(kimlik) as { id: number }).id;
  };

  mailGecen = mail(kutuA, firmaA, "<a1@x>", "murat@teknoyapi.com.tr",
    "Toplu alım talebi", "2026-09-10 09:12:00", null);
  mailIkinci = mail(kutuA, firmaA, "<a2@x>", "murat@teknoyapi.com.tr",
    "Proforma fatura", "2026-09-11 11:04:00", null);
  mailElenen = mail(kutuA, firmaA, "<a3@x>", "haber@bulten.com",
    "Eylül bülteni", "2026-09-11 08:00:00", "bulten");
  mailB = mail(kutuB, firmaB, "<b1@x>", "alici@baskafirma.com",
    "Kayaisi teklif", "2026-09-11 10:00:00", null);
});

after(() => {
  d.db.close();
  rmSync(klasor, { recursive: true, force: true });
});

describe("gelen kutusu", () => {
  test("elenen mail gelen kutusunda görünmez", () => {
    const gelen = d.gelenKutusu(firmaA);
    assert.deepEqual(gelen.map((m) => m.id).sort(), [mailGecen, mailIkinci].sort());
    assert.ok(!gelen.some((m) => m.id === mailElenen));
  });

  test("başka firmanın maili hiç gelmez", () => {
    assert.ok(!d.gelenKutusu(firmaA).some((m) => m.id === mailB));
    assert.equal(d.gelenKutusu(firmaB).length, 1);
  });

  test("mailGetir firma sınırını aşmaz", () => {
    assert.ok(d.mailGetir(mailGecen, firmaA));
    assert.equal(d.mailGetir(mailB, firmaA), undefined);
    assert.equal(d.mailGetir(mailGecen, firmaB), undefined);
  });

  test("en yeni mail üstte", () => {
    const gelen = d.gelenKutusu(firmaA);
    assert.equal(gelen[0]?.id, mailIkinci);
  });

  test("gövde ve özet birlikte saklanır", () => {
    const m = d.mailGetir(mailGecen, firmaA);
    assert.equal(m?.govde, "Toplu alım talebi gövdesi");
    assert.equal(m?.ozet, "Toplu alım talebi özeti");
  });

  test("aynı Message-ID ikinci kez yazılmaz", () => {
    const yazildi = d.mailEkle({
      kutu_id: kutuA, firma_id: firmaA, mesaj_kimlik: "<a1@x>", uid: null,
      gonderen_ad: "", gonderen: "murat@teknoyapi.com.tr", konu: "kopya",
      ozet: "", govde: "", tarih: "2026-09-12 09:00:00", elendi: null, eleme_sebep: "",
    });
    assert.equal(yazildi, false);
    assert.equal(d.gelenSay(firmaA), 2);
  });
});

describe("süzgeçler", () => {
  test("sahipsiz süzgeci yalnızca atanmamışları verir", () => {
    d.sahipYaz(mailGecen, firmaA, ayse);
    assert.deepEqual(
      d.gelenKutusu(firmaA, { sahipsiz: true }).map((m) => m.id),
      [mailIkinci],
    );
    assert.deepEqual(d.gelenKutusu(firmaA, { sahipId: ayse }).map((m) => m.id), [mailGecen]);
    d.sahipYaz(mailGecen, firmaA, null);
  });

  test("kategori süzgeci ve kategorisiz sayacı birlikte tutar", () => {
    d.kategoriYaz(mailGecen, firmaA, "satis");
    assert.deepEqual(d.gelenKutusu(firmaA, { kategori: "satis" }).map((m) => m.id), [mailGecen]);
    assert.equal(d.gelenSay(firmaA, { kategoriYok: true }), 1);
    d.kategoriYaz(mailGecen, firmaA, null);
    assert.equal(d.gelenSay(firmaA, { kategoriYok: true }), 2);
  });

  test("arama konu, gönderen ve gövdede çalışır; bozuk girdi her şeyi getirmez", () => {
    assert.equal(d.gelenSay(firmaA, { arama: "proforma" }), 1);
    assert.equal(d.gelenSay(firmaA, { arama: "teknoyapi" }), 2);
    assert.equal(d.gelenSay(firmaA, { arama: "bulunmayan" }), 0);

    /* Arama FTS5'e geçti (madde 11). Eskiden "%" LIKE kalıbından temizlenip
       "%%" oluyor ve **her şeyi** getiriyordu; test o davranışı kodluyordu.
       Artık aranabilir hiçbir karakter yoksa sonuç boş — kullanıcıya aradığı
       şeyin bütün kutuyu getirdiğini düşündürmek yanlıştı. */
    assert.equal(d.gelenSay(firmaA, { arama: "%" }), 0);
    assert.equal(d.gelenSay(firmaA, { arama: "!!!" }), 0);
  });

  test("kutu süzgeci başka firmanın kutusunu kabul etse de mail vermez", () => {
    assert.equal(d.gelenSay(firmaA, { kutuId: kutuA }), 2);
    assert.equal(d.gelenSay(firmaA, { kutuId: kutuB }), 0);
  });

  test("sayaç ile liste aynı süzgeçte aynı sonucu verir", () => {
    const s = { arama: "teknoyapi", kutuId: kutuA };
    assert.equal(d.gelenSay(firmaA, s), d.gelenKutusu(firmaA, s).length);
  });
});

describe("yazma işlemleri firma sınırında durur", () => {
  test("başka firmanın mailine sahip yazılamaz", () => {
    d.sahipYaz(mailB, firmaA, ayse);
    assert.equal(d.mailGetir(mailB, firmaB)?.sahip_id, null);
  });

  test("başka firmanın mailine kategori ve durum yazılamaz", () => {
    d.kategoriYaz(mailB, firmaA, "satis");
    d.mailDurumYaz(mailB, firmaA, "kapandi");
    const m = d.mailGetir(mailB, firmaB);
    assert.equal(m?.kategori, null);
    assert.equal(m?.durum, "yeni");
  });

  test("sahiplenme ve devretme sahip adını da getirir", () => {
    d.sahipYaz(mailIkinci, firmaA, burak);
    assert.equal(d.mailGetir(mailIkinci, firmaA)?.sahip_ad, "Burak Tosun");
    d.sahipYaz(mailIkinci, firmaA, ayse);
    assert.equal(d.mailGetir(mailIkinci, firmaA)?.sahip_ad, "Ayşe Demir");
    d.sahipYaz(mailIkinci, firmaA, null);
  });

  test("başka firmanın kullanıcısının rolü değiştirilemez", () => {
    d.rolYaz(yabanci, firmaA, "personel");
    assert.equal(d.kullaniciIdIle(yabanci)?.rol, "sahip");
    d.rolYaz(burak, firmaA, "yonetici");
    assert.equal(d.kullaniciIdIle(burak)?.rol, "yonetici");
    d.rolYaz(burak, firmaA, "personel");
  });
});

describe("ekibe davet", () => {
  test("yeni kullanıcı firmaya bağlı olarak eklenir", () => {
    const yeni = d.kullaniciEkle(firmaA, "Yeni.Kisi@ARKUNMOBILYA.com", "  Yeni Kişi  ", "personel");
    assert.ok(yeni);
    /* Adres küçük harfe iniyor, ad kırpılıyor: liste ve giriş aynı değeri görsün. */
    assert.equal(yeni?.eposta, "yeni.kisi@arkunmobilya.com");
    assert.equal(yeni?.ad, "Yeni Kişi");
    assert.equal(yeni?.firma_id, firmaA);
    assert.equal(yeni?.operator, 0);
    assert.ok(d.firmaKullanicilari(firmaA).some((k) => k.id === yeni?.id));
  });

  test("aynı adres ikinci kez eklenemez", () => {
    assert.equal(d.kullaniciEkle(firmaA, "yeni.kisi@arkunmobilya.com", "Kopya", "personel"), undefined);
  });

  test("başka firmanın kullanıcısı kendi ekibine çekilemez", () => {
    assert.equal(d.kullaniciEkle(firmaA, "zeynep@kayaisi.com.tr", "Zeynep", "yonetici"), undefined);
    assert.equal(d.kullaniciIdIle(yabanci)?.firma_id, firmaB, "yabancı kayıt olduğu yerde kalmalı");
  });

  test("operatörün adresi de davetle ele geçirilemez", () => {
    assert.equal(d.kullaniciEkle(firmaA, "operator@mailhanem.app", "Sahte", "yonetici"), undefined);
    assert.equal(d.kullaniciEpostaIle("operator@mailhanem.app")?.firma_id, null);
  });
});

describe("ekipten çıkarma", () => {
  test("kapatılan kişi listede kalır ama etkin sayılmaz", () => {
    d.kullaniciDurumYaz(burak, firmaA, "kapali");
    assert.equal(d.kullaniciIdIle(burak)?.durum, "kapali");
    assert.ok(d.firmaKullanicilari(firmaA).some((k) => k.id === burak), "listede kalmalı");
    assert.ok(!d.firmaKullanicilari(firmaA, true).some((k) => k.id === burak));
  });

  test("kapatılan kişinin açık oturumu düşer", () => {
    d.db.prepare(
      "INSERT INTO oturumlar (kullanici_id, jeton_ozet, gecerlilik) VALUES (?, 'ozet-deneme', '2099-01-01 00:00:00')",
    ).run(burak);
    d.kullaniciDurumYaz(burak, firmaA, "kapali");
    const kalan = d.db
      .prepare("SELECT COUNT(*) AS n FROM oturumlar WHERE kullanici_id = ?")
      .get(burak) as { n: number };
    assert.equal(kalan.n, 0);
  });

  test("kapatmak maillerdeki geçmiş sahipliği silmez", () => {
    d.sahipYaz(mailGecen, firmaA, burak);
    d.kullaniciDurumYaz(burak, firmaA, "kapali");
    assert.equal(d.mailGetir(mailGecen, firmaA)?.sahip_ad, "Burak Tosun");
    d.sahipYaz(mailGecen, firmaA, null);
  });

  test("başka firmanın kullanıcısı kapatılamaz", () => {
    d.kullaniciDurumYaz(yabanci, firmaA, "kapali");
    assert.equal(d.kullaniciIdIle(yabanci)?.durum, "etkin");
  });

  test("geri açılan kişi yeniden etkin olur", () => {
    d.kullaniciDurumYaz(burak, firmaA, "etkin");
    assert.ok(d.firmaKullanicilari(firmaA, true).some((k) => k.id === burak));
  });
});

describe("ekip ve kutular", () => {
  test("firmaKullanicilari yalnızca kendi ekibini verir", () => {
    const ekip = d.firmaKullanicilari(firmaA).map((k) => k.eposta);
    assert.deepEqual(ekip, [
      "ayse@arkunmobilya.com",
      "burak@arkunmobilya.com",
      "yeni.kisi@arkunmobilya.com",
    ]);
    assert.ok(!ekip.includes("zeynep@kayaisi.com.tr"));
  });

  test("operatör hiçbir firmanın ekibinde görünmez", () => {
    const operator = d.kullaniciEpostaIle("operator@mailhanem.app");
    assert.ok(operator, "kurulum operatörü oluşturmuş olmalı");
    assert.equal(operator?.firma_id, null);
    for (const f of [firmaA, firmaB]) {
      assert.ok(!d.firmaKullanicilari(f).some((k) => k.operator === 1));
    }
  });

  test("kutu özetleri gelen ve elenen maili ayrı sayar", () => {
    const [kutu] = d.kutuOzetleri(firmaA);
    assert.equal(kutu?.adres, "info@arkunmobilya.com");
    assert.equal(kutu?.gelen, 2);
    assert.equal(kutu?.elenen, 1);
    assert.equal(kutu?.toplam, 3);
  });

  test("hiç maili olmayan kutu listeden düşmez", () => {
    const bos = d.kutuEkle({
      firma_id: firmaA, adres: "bos@arkunmobilya.com", saglayici: "",
      imap_sunucu: "imap.turhost.com", imap_port: 993, smtp_sunucu: "", smtp_port: 465,
      kullanici_adi: "", parola_sifreli: null,
    });
    const ozet = d.kutuOzetleri(firmaA).find((k) => k.id === bos);
    assert.equal(ozet?.toplam, 0);
    assert.equal(ozet?.durum, "kurulmadi");
  });
});

/**
 * Yanıt taslakları (madde 3).
 *
 * İki soru: metin kayboluyor mu, ve başkasının metnini görüyor muyuz. İkincisi
 * daha ağır basıyor — taslak henüz gönderilmemiş bir yazıdır, sahibinden
 * başkasının işi değil.
 */
describe("yanıt taslakları", () => {
  test("yazılan taslak geri okunur", () => {
    const damga = d.taslakYaz(mailGecen, firmaA, ayse, "Merhaba, fiyat listesi ekte");
    assert.ok(damga, "kaydın damgası dönmeli");

    const taslak = d.taslakGetir(mailGecen, firmaA, ayse);
    assert.equal(taslak?.metin, "Merhaba, fiyat listesi ekte");
    assert.equal(taslak?.guncelleme, damga);
  });

  test("ikinci yazma üstüne yazar, ikinci satır açmaz", () => {
    d.taslakYaz(mailGecen, firmaA, ayse, "birinci");
    d.taslakYaz(mailGecen, firmaA, ayse, "ikinci");
    assert.equal(d.taslakGetir(mailGecen, firmaA, ayse)?.metin, "ikinci");

    const sayi = d.db
      .prepare("SELECT COUNT(*) AS n FROM yanit_taslaklari WHERE mail_id = ?")
      .get(mailGecen) as { n: number };
    assert.equal(sayi.n, 1);
  });

  test("aynı maile iki kişi ayrı taslak yazar", () => {
    d.taslakYaz(mailGecen, firmaA, ayse, "Ayşe'nin metni");
    d.taslakYaz(mailGecen, firmaA, burak, "Burak'ın metni");

    assert.equal(d.taslakGetir(mailGecen, firmaA, ayse)?.metin, "Ayşe'nin metni");
    assert.equal(d.taslakGetir(mailGecen, firmaA, burak)?.metin, "Burak'ın metni");
  });

  test("başkasının taslağı okunmaz", () => {
    d.taslakYaz(mailGecen, firmaA, ayse, "gizli kalsın");
    /* Yanlış firma numarasıyla sorulduğunda da boş dönüyor: sınır sorgunun
       içinde, çağıranın iyi niyetinde değil. */
    assert.equal(d.taslakGetir(mailGecen, firmaB, ayse), undefined);
    assert.equal(d.taslakGetir(mailGecen, firmaA, yabanci), undefined);
  });

  test("boş metin taslağı siler", () => {
    d.taslakYaz(mailIkinci, firmaA, ayse, "yazmaya başladım");
    assert.ok(d.taslakGetir(mailIkinci, firmaA, ayse));

    assert.equal(d.taslakYaz(mailIkinci, firmaA, ayse, "   "), "");
    assert.equal(d.taslakGetir(mailIkinci, firmaA, ayse), undefined);
  });

  test("taslaklı mailler kümesi yalnız kişinin kendi taslaklarını verir", () => {
    d.db.prepare("DELETE FROM yanit_taslaklari").run();
    d.taslakYaz(mailGecen, firmaA, ayse, "benim");
    d.taslakYaz(mailIkinci, firmaA, burak, "onun");

    assert.deepEqual([...d.taslakliMailler(firmaA, ayse)], [mailGecen]);
    assert.deepEqual([...d.taslakliMailler(firmaA, burak)], [mailIkinci]);
    assert.deepEqual([...d.taslakliMailler(firmaB, ayse)], []);
  });

  test("silme yalnız kendi taslağına dokunur", () => {
    d.db.prepare("DELETE FROM yanit_taslaklari").run();
    d.taslakYaz(mailGecen, firmaA, ayse, "benim");
    d.taslakYaz(mailGecen, firmaA, burak, "onun");

    d.taslakSil(mailGecen, firmaA, ayse);
    assert.equal(d.taslakGetir(mailGecen, firmaA, ayse), undefined);
    assert.equal(d.taslakGetir(mailGecen, firmaA, burak)?.metin, "onun");
  });

  test("mail silinince taslağı da gider", () => {
    const gecici = d.mailEkle({
      kutu_id: kutuA, firma_id: firmaA, mesaj_kimlik: "<taslak-testi@x>", uid: null,
      gonderen_ad: "", gonderen: "biri@ornek.com", konu: "geçici",
      ozet: "", govde: "", tarih: "2026-09-12 10:00:00", elendi: null, eleme_sebep: "",
    });
    assert.equal(gecici, true);
    const id = (d.db
      .prepare("SELECT id FROM mailler WHERE mesaj_kimlik = ?")
      .get("<taslak-testi@x>") as { id: number }).id;

    d.taslakYaz(id, firmaA, ayse, "bu mail birazdan silinecek");
    d.db.prepare("DELETE FROM mailler WHERE id = ?").run(id);
    assert.equal(d.taslakGetir(id, firmaA, ayse), undefined);
  });
});

/**
 * Hesap kaydı (madde 11).
 *
 * Operatör ekranı "firmanın yöneticisi de aynı kayıtları görür" diyordu; bu
 * testler hem o sözün hem de **sınırın** tutulduğunu çiviliyor: firmanın kendi
 * satırları geliyor, sistem satırları ve başka firmanın satırları gelmiyor.
 */
describe("hesap kaydı", () => {
  test("firma yalnız kendi satırlarını görür", () => {
    d.db.prepare("DELETE FROM gunluk").run();
    d.gunlukYaz("kurulum", "A firmasının kutusu bağlandı", firmaA);
    d.gunlukYaz("kurulum", "B firmasının kutusu bağlandı", firmaB);
    d.gunlukYaz("hata", "Sistem geneli bir hata", null);

    const a = d.firmaGunlugu(firmaA);
    assert.deepEqual(a.map((g) => g.mesaj), ["A firmasının kutusu bağlandı"]);

    const b = d.firmaGunlugu(firmaB);
    assert.deepEqual(b.map((g) => g.mesaj), ["B firmasının kutusu bağlandı"]);
  });

  test("firmasız (sistem) satırları hiçbir firmaya görünmez", () => {
    d.db.prepare("DELETE FROM gunluk").run();
    d.gunlukYaz("hata", "Zamanlayıcı düştü", null);
    assert.equal(d.firmaGunlugu(firmaA).length, 0);
    assert.equal(d.firmaGunlugu(firmaB).length, 0);
    /* Operatör tarafında duruyor; kaybolmuyor, yalnız müşteriye gitmiyor. */
    assert.ok(d.gunlukGetir().some((g) => g.mesaj === "Zamanlayıcı düştü"));
  });

  test("tür süzgeci ve sayılar firma sınırında", () => {
    d.db.prepare("DELETE FROM gunluk").run();
    d.gunlukYaz("giris", "ayse@arkunmobilya.com panele girdi", firmaA);
    d.gunlukYaz("giris", "burak@arkunmobilya.com panele girdi", firmaA);
    d.gunlukYaz("kurulum", "kutu bağlandı", firmaA);
    d.gunlukYaz("giris", "zeynep@kayaisi.com.tr panele girdi", firmaB);

    assert.equal(d.firmaGunlugu(firmaA, "giris").length, 2);
    assert.equal(d.firmaGunlugu(firmaA, "kurulum").length, 1);

    const sayilar = d.firmaGunlukSayilari(firmaA);
    assert.equal(sayilar.giris, 2);
    assert.equal(sayilar.kurulum, 1);
    assert.equal(d.firmaGunlukSayilari(firmaB).giris, 1);
  });

  test("en yeni kayıt üstte", () => {
    d.db.prepare("DELETE FROM gunluk").run();
    d.gunlukYaz("kurulum", "önce olan", firmaA);
    d.gunlukYaz("kurulum", "sonra olan", firmaA);
    assert.equal(d.firmaGunlugu(firmaA)[0]?.mesaj, "sonra olan");
  });

  test("panele giriş kaydı bırakır", () => {
    d.db.prepare("DELETE FROM gunluk").run();
    d.girisKaydiYaz(ayse);

    const kayit = d.firmaGunlugu(firmaA, "giris");
    assert.equal(kayit.length, 1, "her oturum bir satır yazmalı");
    assert.ok(kayit[0]?.mesaj.includes("ayse@arkunmobilya.com"));
    assert.ok(kayit[0]?.mesaj.includes("panele girdi"));
  });

  test("operatör girişi hiçbir firmanın kaydına düşmez", () => {
    d.db.prepare("DELETE FROM gunluk").run();
    const operator = d.kullaniciEpostaIle("operator@mailhanem.app");
    assert.ok(operator);
    d.girisKaydiYaz(operator.id);

    assert.equal(d.firmaGunlugu(firmaA, "giris").length, 0);
    assert.equal(d.firmaGunlugu(firmaB, "giris").length, 0);
    const hepsi = d.gunlukGetir("giris");
    assert.equal(hepsi.length, 1);
    assert.ok(hepsi[0]?.mesaj.includes("arka ofise girdi"));
  });
});

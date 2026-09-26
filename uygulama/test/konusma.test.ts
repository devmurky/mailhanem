/**
 * Konuşma zinciri (madde 2).
 *
 * İki katman ayrı ayrı deneniyor: kuralın kendisi (saf modül) ve zincirin
 * veritabanında nasıl kurulduğu.
 *
 * Buradaki en önemli test "ayrı kalması gerekenler" tarafında: iki müşterinin
 * yazışmasını tek konuşmada birleştirmek, konuşmayı hiç kurmamaktan çok daha
 * ağır bir hata — biri ötekinin yazışmasını okur.
 */
import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { konuKoku, zincirKimlikleri } from "../sunucu/posta/konusma.ts";

describe("konu kökü", () => {
  test("yanıt ve iletme önekleri kırpılır", () => {
    assert.equal(konuKoku("Re: Teklif"), "teklif");
    assert.equal(konuKoku("Ynt: Teklif"), "teklif");
    assert.equal(konuKoku("FW: Teklif"), "teklif");
    assert.equal(konuKoku("İlt: Teklif"), "teklif");
  });

  test("üst üste binmiş önekler de kırpılır", () => {
    assert.equal(konuKoku("Re: Ynt: Re: Şubat teklifi"), "subat teklifi");
    assert.equal(konuKoku("RE[2]: Teklif"), "teklif");
  });

  test("Türkçe harfler katlanıyor — aynı konu iki yazımda da eşleşsin", () => {
    assert.equal(konuKoku("Şubat teklifi"), konuKoku("Subat teklifi"));
    assert.equal(konuKoku("İade süreci"), konuKoku("Iade sureci"));
  });

  test("boşluklar tek boşluğa iner, boş konu boş kalır", () => {
    assert.equal(konuKoku("  Teklif   hakkında  "), "teklif hakkinda");
    assert.equal(konuKoku(""), "");
    assert.equal(konuKoku("Re:"), "");
  });
});

describe("zincir kimlikleri", () => {
  test("In-Reply-To önce, References tersten gelir", () => {
    const k = zincirKimlikleri({
      "In-Reply-To": "<c@x>",
      References: "<a@x> <b@x> <c@x>",
    });
    assert.deepEqual(k, ["<c@x>", "<b@x>", "<a@x>"]);
  });

  test("başlık adının büyük/küçük hâli önemsiz", () => {
    assert.deepEqual(zincirKimlikleri({ "in-reply-to": "<a@x>" }), ["<a@x>"]);
    assert.deepEqual(zincirKimlikleri({ REFERENCES: "<a@x>" }), ["<a@x>"]);
  });

  test("başlık yoksa boş dizi", () => {
    assert.deepEqual(zincirKimlikleri({}), []);
    assert.deepEqual(zincirKimlikleri({ Subject: "Merhaba" }), []);
  });
});

/* ── veritabanı tarafı ───────────────────────────────────── */

const klasor = mkdtempSync(join(tmpdir(), "mailhanem-konusma-"));
process.env.DB_YOLU = join(klasor, "deneme.db");
process.env.MAILHANEM_ANAHTAR = randomBytes(32).toString("base64");
Object.assign(process.env, { NODE_ENV: "production" });

type DB = typeof import("../sunucu/db.ts");
let d: DB;
let firma = 0, kisi = 0, kutu = 0, ikinciKutu = 0;

/** Test maili yazar ve id'sini verir. Zinciri çağıran belirtmezse çözülür. */
function mail(v: {
  kimlik: string;
  gonderen: string;
  konu: string;
  tarih: string;
  kimlikler?: string[];
  kutuId?: number;
}): number {
  const kutuId = v.kutuId ?? kutu;
  const konusma =
    d.konusmaCoz({
      firmaId: firma,
      kutuId,
      kimlikler: v.kimlikler ?? [],
      gonderen: v.gonderen,
      konu: v.konu,
      tarih: v.tarih,
    }) ?? v.kimlik;

  d.mailEkle({
    kutu_id: kutuId, firma_id: firma, mesaj_kimlik: v.kimlik, uid: null,
    gonderen_ad: "", gonderen: v.gonderen, konu: v.konu, ozet: "", govde: "",
    tarih: v.tarih, elendi: null, eleme_sebep: "", konusma,
  });
  return (d.db.prepare("SELECT id FROM mailler WHERE mesaj_kimlik = ?").get(v.kimlik) as {
    id: number;
  }).id;
}

function zinciri(mailId: number): string {
  return (d.db.prepare("SELECT konusma FROM mailler WHERE id = ?").get(mailId) as {
    konusma: string;
  }).konusma;
}

before(async () => {
  d = await import("../sunucu/db.ts");

  firma = (d.db
    .prepare("INSERT INTO firmalar (ad, alan_adi) VALUES (?, ?) RETURNING id")
    .get("Arkun Mobilya", "arkunmobilya.com") as { id: number }).id;
  kisi = (d.db
    .prepare("INSERT INTO kullanicilar (firma_id, eposta, ad, rol) VALUES (?, ?, ?, ?) RETURNING id")
    .get(firma, "ayse@arkunmobilya.com", "Ayşe Demir", "sahip") as { id: number }).id;

  const kutuAc = (adres: string) =>
    d.kutuEkle({
      firma_id: firma, adres, saglayici: "cPanel",
      imap_sunucu: "imap.turhost.com", imap_port: 993, smtp_sunucu: "", smtp_port: 465,
      kullanici_adi: adres, parola_sifreli: null,
    });
  kutu = kutuAc("info@arkunmobilya.com");
  ikinciKutu = kutuAc("satis@arkunmobilya.com");
});

after(() => {
  d.db.close();
  rmSync(klasor, { recursive: true, force: true });
});

describe("zincir kurulumu", () => {
  test("In-Reply-To ile gelen yanıt aynı konuşmaya girer", () => {
    const ilk = mail({
      kimlik: "<t1@musteri.com>", gonderen: "ayca@musteri.com",
      konu: "Koltuk stokta var mı?", tarih: "2026-09-10 09:00:00",
    });
    const yanit = mail({
      kimlik: "<t2@musteri.com>", gonderen: "ayca@musteri.com",
      konu: "Re: Koltuk stokta var mı?", tarih: "2026-09-10 11:00:00",
      kimlikler: ["<t1@musteri.com>"],
    });
    assert.equal(zinciri(yanit), "<t1@musteri.com>");
    assert.equal(zinciri(ilk), "<t1@musteri.com>");
  });

  test("konu tamamen değişse de zincir kopmuyor", () => {
    const yeni = mail({
      kimlik: "<t3@musteri.com>", gonderen: "ayca@musteri.com",
      konu: "Bir de şunu sorayım", tarih: "2026-09-10 12:00:00",
      kimlikler: ["<t2@musteri.com>"],
    });
    assert.equal(zinciri(yeni), "<t1@musteri.com>", "başlık zinciri konudan güçlü");
  });

  test("bizim yanıtımıza gelen cevap da zincire bağlanır", () => {
    const soru = mail({
      kimlik: "<y1@baska.com>", gonderen: "murat@baska.com",
      konu: "Numune talebi", tarih: "2026-09-11 09:00:00",
    });
    /* Gönderdiğimiz yanıt yalnız `yanitlar` tablosunda duruyor; müşteri ona
       cevap verdiğinde In-Reply-To bu kimliği taşıyor. */
    d.yanitEkle({
      mail_id: soru, firma_id: firma, kullanici_id: kisi,
      kime: "murat@baska.com", konu: "Re: Numune talebi", metin: "Yarın gönderiyoruz.",
      mesaj_kimlik: "<bizim-yanit@arkunmobilya.com>", hata: null,
    });

    const cevap = mail({
      kimlik: "<y2@baska.com>", gonderen: "murat@baska.com",
      konu: "Re: Numune talebi", tarih: "2026-09-11 15:00:00",
      kimlikler: ["<bizim-yanit@arkunmobilya.com>"],
    });
    assert.equal(zinciri(cevap), "<y1@baska.com>");
  });

  test("başlık yoksa aynı kutu + aynı adres + aynı konu yeter", () => {
    const ilk = mail({
      kimlik: "<k1@ornek.com>", gonderen: "zeynep@ornek.com",
      konu: "Montaj randevusu", tarih: "2026-09-12 09:00:00",
    });
    const devam = mail({
      kimlik: "<k2@ornek.com>", gonderen: "zeynep@ornek.com",
      konu: "Ynt: Montaj randevusu", tarih: "2026-09-12 10:00:00",
    });
    assert.equal(zinciri(devam), zinciri(ilk));
  });

  test("aynı konu başka gönderenden gelirse ayrı konuşma", () => {
    const biri = mail({
      kimlik: "<a1@ornek.com>", gonderen: "ali@ornek.com",
      konu: "Merhaba", tarih: "2026-09-13 09:00:00",
    });
    const bambaska = mail({
      kimlik: "<a2@baskayer.com>", gonderen: "veli@baskayer.com",
      konu: "Merhaba", tarih: "2026-09-13 10:00:00",
    });
    assert.notEqual(zinciri(bambaska), zinciri(biri));
    assert.equal(zinciri(bambaska), "<a2@baskayer.com>");
  });

  test("aynı konu başka kutuya gelirse ayrı konuşma", () => {
    const info = mail({
      kimlik: "<c1@ornek.com>", gonderen: "can@ornek.com",
      konu: "Fiyat listesi", tarih: "2026-09-14 09:00:00",
    });
    const satis = mail({
      kimlik: "<c2@ornek.com>", gonderen: "can@ornek.com",
      konu: "Fiyat listesi", tarih: "2026-09-14 10:00:00", kutuId: ikinciKutu,
    });
    assert.notEqual(zinciri(satis), zinciri(info));
  });

  test("aylar sonra gelen aynı konu yeni bir iştir", () => {
    const eski = mail({
      kimlik: "<e1@ornek.com>", gonderen: "eski@ornek.com",
      konu: "Yıllık bakım", tarih: "2026-01-05 09:00:00",
    });
    const yeni = mail({
      kimlik: "<e2@ornek.com>", gonderen: "eski@ornek.com",
      konu: "Yıllık bakım", tarih: "2026-09-15 09:00:00",
    });
    assert.notEqual(zinciri(yeni), zinciri(eski), "60 günlük pencere dışında");
  });

  test("konusu boş mailler birbirine yapışmaz", () => {
    const bir = mail({
      kimlik: "<b1@ornek.com>", gonderen: "bos@ornek.com", konu: "",
      tarih: "2026-09-16 09:00:00",
    });
    const iki = mail({
      kimlik: "<b2@ornek.com>", gonderen: "bos@ornek.com", konu: "",
      tarih: "2026-09-16 10:00:00",
    });
    assert.notEqual(zinciri(iki), zinciri(bir));
  });
});

describe("konuşmayı okuma", () => {
  test("zincirdeki mailler eskiden yeniye gelir", () => {
    const zincir = zinciri(
      (d.db.prepare("SELECT id FROM mailler WHERE mesaj_kimlik = ?").get("<t1@musteri.com>") as {
        id: number;
      }).id,
    );
    const mailler = d.konusmaMailleri(firma, zincir);
    assert.deepEqual(
      mailler.map((m) => m.mesaj_kimlik),
      ["<t1@musteri.com>", "<t2@musteri.com>", "<t3@musteri.com>"],
    );
  });

  test("başka firmanın numarasıyla konuşma okunmaz", () => {
    const baska = (d.db
      .prepare("INSERT INTO firmalar (ad, alan_adi) VALUES (?, ?) RETURNING id")
      .get("Kaya Isı", "kayaisi.com.tr") as { id: number }).id;
    assert.deepEqual(d.konusmaMailleri(baska, "<t1@musteri.com>"), []);
    assert.deepEqual(d.konusmaYanitlari(baska, "<y1@baska.com>"), []);
  });

  test("giden yanıtlar da konuşmanın parçası", () => {
    const yanitlar = d.konusmaYanitlari(firma, "<y1@baska.com>");
    assert.equal(yanitlar.length, 1);
    assert.equal(yanitlar[0]?.mesaj_kimlik, "<bizim-yanit@arkunmobilya.com>");
    assert.equal(yanitlar[0]?.yazan_ad, "Ayşe Demir");
  });

  test("sayılar: tek mesajlık konuşma listede yok, çok mesajlı var", () => {
    const sayilar = d.konusmaSayilari(firma);
    assert.equal(sayilar.get("<t1@musteri.com>"), 3);
    /* İki gelen mail + bir giden yanıt = üç mesaj. */
    assert.equal(sayilar.get("<y1@baska.com>"), 3);
    assert.equal(sayilar.has("<a1@ornek.com>"), false, "tek mesaj konuşma sayılmaz");
  });

  test("boş zincir kimliğiyle sorulunca boş dönüyor", () => {
    assert.deepEqual(d.konusmaMailleri(firma, ""), []);
    assert.deepEqual(d.konusmaYanitlari(firma, ""), []);
  });
});

/**
 * Bir kez ısıran hata: geri doldurma sırasında bütün satırların `konusma`
 * sütunu boş oluyor. Yedek kural o boş satırlardan birini aday diye bulup boş
 * dizgiyi döndürünce, `?? ` boş dizgiyi yakalamıyor ve mail **boş zincirle**
 * işaretleniyordu — üstelik kayıt "bağlandı" diye görünüyordu.
 */
describe("boş zincir hiç dönmez", () => {
  test("zinciri kurulmamış aday eşleşmeyi bozmaz", () => {
    /* Zinciri elle boşaltılan, **en yeni** aday: sorgu tarihe göre tersten
       sıraladığı için hata varken ilk bulunacak satır tam bu olurdu. */
    d.db.prepare("UPDATE mailler SET konusma = '' WHERE mesaj_kimlik = ?").run("<k2@ornek.com>");

    const sonuc = d.konusmaCoz({
      firmaId: firma,
      kutuId: kutu,
      kimlikler: [],
      gonderen: "zeynep@ornek.com",
      konu: "Montaj randevusu",
      tarih: "2026-09-12 12:00:00",
    });

    assert.notEqual(sonuc, "", "boş zincir dönemez");
    /* Zinciri duran ikinci mail hâlâ aday: eşleşme ondan geliyor. */
    assert.equal(sonuc, "<k1@ornek.com>");
  });

  test("hiç adayı olmayan mail için null döner", () => {
    const sonuc = d.konusmaCoz({
      firmaId: firma,
      kutuId: kutu,
      kimlikler: [],
      gonderen: "hic@gorulmedi.com",
      konu: "Yepyeni bir konu",
      tarih: "2026-09-20 09:00:00",
    });
    assert.equal(sonuc, null);
  });
});

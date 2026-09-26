/**
 * "Şu an bu maile bakıyor" (madde 8).
 *
 * Buradaki iddia iki tane. Biri: **bayat satır bakan sayılmaz** — sekmesi
 * kapanan kişi kimseye haber veremez, o yüzden cevabı satırın varlığı değil
 * damganın tazeliği verir. Öteki: kişi kendini görmez; "bu maile ben
 * bakıyorum" uyarısı kimseye bir şey söylemez.
 */
import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const klasor = mkdtempSync(join(tmpdir(), "mailhanem-bakis-"));
process.env.DB_YOLU = join(klasor, "deneme.db");
process.env.MAILHANEM_ANAHTAR = randomBytes(32).toString("base64");
Object.assign(process.env, { NODE_ENV: "production" });

type DB = typeof import("../sunucu/db.ts");
let d: DB;
let firma = 0, ayse = 0, selin = 0, burak = 0, kutu = 0, mailId = 0;

/** Damgayı elle geriye alır: bayatlamayı beklemeden denemek için. */
function damgayiGeriAl(kullaniciId: number, saniye: number): void {
  d.db
    .prepare(
      `UPDATE mail_bakanlar SET son_gorulme = datetime('now', ?)
       WHERE mail_id = ? AND kullanici_id = ?`,
    )
    .run(`-${saniye} seconds`, mailId, kullaniciId);
}

before(async () => {
  d = await import("../sunucu/db.ts");

  firma = (d.db
    .prepare("INSERT INTO firmalar (ad, alan_adi) VALUES (?, ?) RETURNING id")
    .get("Arkun Mobilya", "arkunmobilya.com") as { id: number }).id;

  const kisi = (eposta: string, ad: string, rol: string) =>
    (d.db
      .prepare("INSERT INTO kullanicilar (firma_id, eposta, ad, rol) VALUES (?, ?, ?, ?) RETURNING id")
      .get(firma, eposta, ad, rol) as { id: number }).id;

  ayse = kisi("ayse@arkunmobilya.com", "Ayşe Demir", "sahip");
  selin = kisi("selin@arkunmobilya.com", "Selin Kaya", "personel");
  burak = kisi("burak@arkunmobilya.com", "Burak Doğan", "yonetici");

  kutu = d.kutuEkle({
    firma_id: firma, adres: "info@arkunmobilya.com", saglayici: "cPanel",
    imap_sunucu: "imap.turhost.com", imap_port: 993, smtp_sunucu: "", smtp_port: 465,
    kullanici_adi: "info@arkunmobilya.com", parola_sifreli: null,
  });

  d.mailEkle({
    kutu_id: kutu, firma_id: firma, mesaj_kimlik: "<b1@ornek.com>", uid: null,
    gonderen_ad: "", gonderen: "musteri@ornek.com", konu: "Toplu alım", ozet: "", govde: "",
    tarih: "2026-09-25 09:00:00", elendi: null, eleme_sebep: "", konusma: "<b1@ornek.com>",
  });
  mailId = (d.db.prepare("SELECT id FROM mailler WHERE mesaj_kimlik = ?").get("<b1@ornek.com>") as {
    id: number;
  }).id;
});

after(() => {
  d.db.close();
  rmSync(klasor, { recursive: true, force: true });
});

describe("kim bakıyor", () => {
  test("kimse bakmıyorken liste boş", () => {
    assert.deepEqual(d.mailBakanlar(mailId, firma, ayse), []);
  });

  test("kişi kendini görmez, başkasını görür", () => {
    d.bakisBildir(mailId, firma, ayse, false);
    assert.deepEqual(d.mailBakanlar(mailId, firma, ayse), []);

    d.bakisBildir(mailId, firma, selin, false);
    const ayseninGordugu = d.mailBakanlar(mailId, firma, ayse);
    assert.equal(ayseninGordugu.length, 1);
    assert.equal(ayseninGordugu[0]?.ad, "Selin Kaya");
  });

  test("yazan öne çıkıyor — asıl çakışma riski o", () => {
    d.bakisBildir(mailId, firma, burak, true);
    const liste = d.mailBakanlar(mailId, firma, ayse);

    assert.equal(liste.length, 2);
    assert.equal(liste[0]?.ad, "Burak Doğan");
    assert.equal(liste[0]?.yaziyor, 1);
    assert.equal(liste[1]?.yaziyor, 0);
  });

  test("aynı kişi iki kez satır açmıyor, durumu güncelleniyor", () => {
    d.bakisBildir(mailId, firma, burak, false);
    const liste = d.mailBakanlar(mailId, firma, ayse);
    assert.equal(liste.length, 2);
    assert.equal(liste.find((b) => b.ad === "Burak Doğan")?.yaziyor, 0);
  });

  test("bayat satır bakan sayılmıyor — sekmesi kapanan kişi listede kalmaz", () => {
    damgayiGeriAl(selin, d.BAKIS_SANIYE + 5);
    const liste = d.mailBakanlar(mailId, firma, ayse);

    assert.deepEqual(liste.map((b) => b.ad), ["Burak Doğan"]);
  });

  test("pencerenin içindeki satır hâlâ sayılıyor", () => {
    damgayiGeriAl(selin, d.BAKIS_SANIYE - 10);
    const adlar = d.mailBakanlar(mailId, firma, ayse).map((b) => b.ad);
    assert.ok(adlar.includes("Selin Kaya"));
  });

  test("bırakma satırı siliyor", () => {
    d.bakisiBirak(mailId, firma, burak);
    const adlar = d.mailBakanlar(mailId, firma, ayse).map((b) => b.ad);
    assert.deepEqual(adlar, ["Selin Kaya"]);
  });

  test("çok eski satırlar bildirimde temizleniyor", () => {
    damgayiGeriAl(selin, d.BAKIS_SANIYE * 4 + 10);
    /* Bildirim sırasında silme çalışıyor: ayrı bir temizlik işi yok. */
    d.bakisBildir(mailId, firma, ayse, false);

    const kalan = d.db
      .prepare("SELECT COUNT(*) AS n FROM mail_bakanlar WHERE kullanici_id = ?")
      .get(selin) as { n: number };
    assert.equal(kalan.n, 0);
  });

  test("başka firmanın gözünden bu mailde kimse yok", () => {
    d.bakisBildir(mailId, firma, selin, true);
    const digerFirma = (d.db
      .prepare("INSERT INTO firmalar (ad, alan_adi) VALUES (?, ?) RETURNING id")
      .get("Başka Ltd", "baska.com") as { id: number }).id;

    assert.deepEqual(d.mailBakanlar(mailId, digerFirma, ayse), []);
  });
});

/**
 * Okundu/okunmadı (madde 6).
 *
 * Buradaki asıl iddia şu: **okuma kişiseldir, durum ortaktır.** Ortak kutuda
 * Ayşe'nin açtığı mail Selin için hâlâ okunmamıştır; eskiden liste durumu
 * okuduğu için biri maile bakınca satır herkes için sönüyordu. Testlerin
 * çoğu bu ayrımı çiviliyor.
 */
import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const klasor = mkdtempSync(join(tmpdir(), "mailhanem-okuma-"));
process.env.DB_YOLU = join(klasor, "deneme.db");
process.env.MAILHANEM_ANAHTAR = randomBytes(32).toString("base64");
Object.assign(process.env, { NODE_ENV: "production" });

type DB = typeof import("../sunucu/db.ts");
let d: DB;
let firma = 0, ayse = 0, selin = 0, ayrilan = 0, kutu = 0;
let ilkMail = 0, ikinciMail = 0;

function mail(kimlik: string, konu: string, tarih: string): number {
  d.mailEkle({
    kutu_id: kutu, firma_id: firma, mesaj_kimlik: kimlik, uid: null,
    gonderen_ad: "", gonderen: "musteri@ornek.com", konu, ozet: "", govde: "",
    tarih, elendi: null, eleme_sebep: "", konusma: kimlik,
  });
  return (d.db.prepare("SELECT id FROM mailler WHERE mesaj_kimlik = ?").get(kimlik) as {
    id: number;
  }).id;
}

before(async () => {
  d = await import("../sunucu/db.ts");

  firma = (d.db
    .prepare("INSERT INTO firmalar (ad, alan_adi) VALUES (?, ?) RETURNING id")
    .get("Arkun Mobilya", "arkunmobilya.com") as { id: number }).id;

  const kisi = (eposta: string, ad: string, rol: string, durum = "etkin") =>
    (d.db
      .prepare(
        `INSERT INTO kullanicilar (firma_id, eposta, ad, rol, durum)
         VALUES (?, ?, ?, ?, ?) RETURNING id`,
      )
      .get(firma, eposta, ad, rol, durum) as { id: number }).id;

  ayse = kisi("ayse@arkunmobilya.com", "Ayşe Demir", "sahip");
  selin = kisi("selin@arkunmobilya.com", "Selin Kaya", "personel");
  /* Ekipten çıkarılan kişi silinmiyor, kapatılıyor — okuma izi de kalmalı. */
  ayrilan = kisi("eski@arkunmobilya.com", "Eski Personel", "personel", "kapali");

  kutu = d.kutuEkle({
    firma_id: firma, adres: "info@arkunmobilya.com", saglayici: "cPanel",
    imap_sunucu: "imap.turhost.com", imap_port: 993, smtp_sunucu: "", smtp_port: 465,
    kullanici_adi: "info@arkunmobilya.com", parola_sifreli: null,
  });

  ilkMail = mail("<m1@ornek.com>", "Koltuk stokta var mı?", "2026-09-20 09:00:00");
  ikinciMail = mail("<m2@ornek.com>", "Fatura kopyası", "2026-09-20 10:00:00");
});

after(() => {
  d.db.close();
  rmSync(klasor, { recursive: true, force: true });
});

describe("okuma kaydı", () => {
  test("yeni mail hiçbir şey yazılmadan herkes için okunmamış", () => {
    assert.equal(d.okunanlar(firma, ayse, [ilkMail, ikinciMail]).size, 0);
    assert.equal(d.okunanlar(firma, selin, [ilkMail, ikinciMail]).size, 0);
    assert.deepEqual(d.mailOkuyanlar(ilkMail, firma), []);
  });

  test("ilk okuma true döner, ikincisi false — ekran boşuna tazelenmesin", () => {
    assert.equal(d.okumaYaz(ilkMail, firma, ayse), true);
    assert.equal(d.okumaYaz(ilkMail, firma, ayse), false);
  });

  test("okuma kişisel: Ayşe okudu diye Selin'in satırı sönmüyor", () => {
    assert.ok(d.okunanlar(firma, ayse, [ilkMail, ikinciMail]).has(ilkMail));
    assert.equal(d.okunanlar(firma, selin, [ilkMail, ikinciMail]).has(ilkMail), false);
  });

  test("okunmamış süzgeci kişiye göre değişiyor", () => {
    const ayseninki = d.gelenKutusu(firma, { okumayanId: ayse }).map((m) => m.id);
    const selininki = d.gelenKutusu(firma, { okumayanId: selin }).map((m) => m.id);

    assert.deepEqual(ayseninki, [ikinciMail]);
    assert.deepEqual(selininki.sort(), [ilkMail, ikinciMail].sort());
    assert.equal(d.gelenSay(firma, { okumayanId: ayse }), 1);
    assert.equal(d.gelenSay(firma, { okumayanId: selin }), 2);
  });

  test("okunmamışlık durumdan bağımsız: kapanmış mail de okunmamış olabilir", () => {
    d.mailDurumYaz(ikinciMail, firma, "kapandi");
    assert.ok(d.gelenKutusu(firma, { okumayanId: ayse }).some((m) => m.id === ikinciMail));

    /* Ters yön: okunmuş mail hâlâ "yeni" durumda kalabiliyor. İki ayrı soru —
       "işin nerede" ile "kim baktı" birbirinin yerine geçmiyor. */
    const durum = (d.db.prepare("SELECT durum FROM mailler WHERE id = ?").get(ilkMail) as {
      durum: string;
    }).durum;
    assert.equal(durum, "yeni");
    assert.ok(d.okunanlar(firma, ayse, [ilkMail]).has(ilkMail));
  });

  test("okunmadı işareti geri alınabiliyor", () => {
    d.okumaSil(ilkMail, firma, ayse);
    assert.equal(d.okunanlar(firma, ayse, [ilkMail]).size, 0);
    assert.ok(d.gelenKutusu(firma, { okumayanId: ayse }).some((m) => m.id === ilkMail));
  });

  test("okuyanlar listesi ekibin ortak bilgisi, sırası ilk bakana göre", () => {
    d.okumaYaz(ilkMail, firma, selin);
    d.okumaYaz(ilkMail, firma, ayse);

    const okuyanlar = d.mailOkuyanlar(ilkMail, firma);
    assert.equal(okuyanlar.length, 2);
    assert.deepEqual(
      okuyanlar.map((o) => o.kullanici_id).sort(),
      [ayse, selin].sort(),
    );
    assert.ok(okuyanlar.every((o) => o.ad.length > 0));
  });

  test("ekipten çıkarılmış kişinin izi kalıyor — geçmiş yalan söylemesin", () => {
    d.okumaYaz(ikinciMail, firma, ayrilan);
    const okuyanlar = d.mailOkuyanlar(ikinciMail, firma);
    assert.deepEqual(
      okuyanlar.map((o) => o.ad),
      ["Eski Personel"],
    );
  });

  test("okunanlar boş listeyle hiç sorgu atmadan boş küme döner", () => {
    assert.equal(d.okunanlar(firma, ayse, []).size, 0);
  });

  test("başka firmanın okuması bu firmaya sızmıyor", () => {
    const digerFirma = (d.db
      .prepare("INSERT INTO firmalar (ad, alan_adi) VALUES (?, ?) RETURNING id")
      .get("Başka Ltd", "baska.com") as { id: number }).id;

    assert.equal(d.okunanlar(digerFirma, ayse, [ilkMail]).size, 0);
    assert.deepEqual(d.mailOkuyanlar(ilkMail, digerFirma), []);
  });
});

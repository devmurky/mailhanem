/**
 * Mail araması (madde 11 — FTS5).
 *
 * Buradaki asıl sorular Türkçe'ye özgü ve üçü de sessizce yanlış çalışabilir:
 *
 * 1. **ı ile i birleşiyor mu?** `unicode61 remove_diacritics` ç/ş/ö/ü/ğ'yi
 *    katlıyor ama noktasız ı'yı katlamıyor — Unicode'da ı aksanlı bir i değil.
 *    İlk yazışta "çalışma" araması "calisma" yazan maili bulamıyordu.
 * 2. **Ek alan kelime bulunuyor mu?** Türkçe eklemeli: tam eşleşme arasaydık
 *    "şikayet" araması "şikayetim"i ıskalardı.
 * 3. **Kullanıcı sorguyu kırabiliyor mu?** Ham girdi MATCH'e verilirse tek bir
 *    çift tırnak "unterminated string" ile düşürüyor, OR operatör oluyor.
 */
import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const klasor = mkdtempSync(join(tmpdir(), "mailhanem-arama-"));
process.env.DB_YOLU = join(klasor, "deneme.db");
Object.assign(process.env, { NODE_ENV: "production" });
process.env.MAILHANEM_ANAHTAR = randomBytes(32).toString("base64");

type DB = typeof import("../sunucu/db.ts");
let d: DB;
let firma = 0;
let kutu = 0;

function mail(konu: string, gonderen: string, ozet: string, govde: string) {
  d.mailEkle({
    kutu_id: kutu,
    firma_id: firma,
    mesaj_kimlik: `<${randomBytes(6).toString("hex")}@x>`,
    uid: null,
    gonderen_ad: "",
    gonderen,
    konu,
    ozet,
    govde,
    tarih: new Date().toISOString().replace("T", " ").slice(0, 19),
    elendi: null,
    eleme_sebep: "",
  });
}

before(async () => {
  d = await import("../sunucu/db.ts");

  firma = (
    d.db
      .prepare("INSERT INTO firmalar (ad, alan_adi) VALUES (?, ?) RETURNING id")
      .get("Arama A.Ş.", "arama.com") as { id: number }
  ).id;
  kutu = (
    d.db
      .prepare("INSERT INTO kutular (firma_id, adres) VALUES (?, ?) RETURNING id")
      .get(firma, "info@arama.com") as { id: number }
  ).id;

  mail(
    "İade talebi",
    "ayse@musteri.com",
    "Ürünü geri göndermek istiyorum",
    "Şikayetim var, sipariş numaram VM-20418. Çalışma saatleriniz nedir?",
  );
  mail(
    "Toplu alim",
    "kemal@ofisyapi.com.tr",
    "40 calisma masasi lazim",
    "Fiyat listesi rica ederim, fiyatlar 30 gun gecerli olsun.",
  );
  mail("Fatura", "muhasebe@turhost.com", "Subat faturasi", "Odeme icin son tarih 28 Subat.");
});

after(() => {
  d.db.close();
  rmSync(klasor, { recursive: true, force: true });
});

const ara = (q: string) => d.gelenKutusu(firma, { arama: q }).map((m) => m.konu);

describe("mail araması", () => {
  test("gövdede arıyor — eski LIKE araması bunu yapamıyordu", () => {
    assert.deepEqual(ara("30 gun"), ["Toplu alim"]);
    assert.deepEqual(ara("VM-20418"), ["İade talebi"]);
  });

  test("ı ile i aynı sayılıyor: çalışma ↔ calisma", () => {
    /* İki mail de "çalışma/calisma" içeriyor; biri Türkçe, öteki ASCII yazılmış. */
    const turkce = ara("çalışma").sort();
    const ascii = ara("calisma").sort();
    assert.deepEqual(turkce, ascii, "yazım biçimi sonucu değiştirmemeli");
    assert.equal(turkce.length, 2);
  });

  test("büyük/küçük ve aksan katlanıyor", () => {
    assert.deepEqual(ara("İADE"), ara("iade"));
    assert.deepEqual(ara("ŞUBAT"), ara("subat"));
    assert.deepEqual(ara("Ürün"), ara("urun"));
  });

  test("ek almış kelime önekle bulunuyor", () => {
    /* "şikayet" araması gövdedeki "Şikayetim"i bulmalı. */
    assert.deepEqual(ara("şikayet"), ["İade talebi"]);
    assert.deepEqual(ara("fatura"), ["Fatura"]);
  });

  test("birden çok kelime VE ile birleşiyor", () => {
    assert.deepEqual(ara("fiyat listesi"), ["Toplu alim"]);
    assert.deepEqual(ara("fiyat iade"), [], "ikisi birden geçmiyorsa sonuç yok");
  });

  test("gönderen adresinden aranıyor", () => {
    assert.deepEqual(ara("ofisyapi"), ["Toplu alim"]);
    assert.deepEqual(ara("muhasebe@turhost.com"), ["Fatura"]);
  });

  test("kullanıcı girdisi sorguyu kıramıyor", () => {
    /* Hiçbiri patlamamalı. */
    for (const bozuk of ['"', '""', "OR", "NEAR(a b)", "*", "   ", "-", "a AND b"]) {
      assert.doesNotThrow(() => ara(bozuk), `girdi patlattı: ${bozuk}`);
    }
    /* Operatör sayılmayıp sıradan kelimeye dönüştüğü için sonuç boş. */
    assert.deepEqual(ara("iade OR fatura"), []);
  });

  test("aranabilir hiçbir şey yoksa boş dönüyor, her şeyi getirmiyor", () => {
    assert.deepEqual(ara("!!!"), []);
    assert.deepEqual(ara('"'), []);
  });

  test("silinen mail dizinden düşüyor", () => {
    const id = (
      d.db.prepare("SELECT id FROM mailler WHERE konu = 'Fatura'").get() as { id: number }
    ).id;
    assert.equal(ara("fatura").length, 1);

    d.db.prepare("DELETE FROM mailler WHERE id = ?").run(id);
    assert.deepEqual(ara("fatura"), [], "tetikleyici dizini temizlemeli");
  });

  test("sorgu kurucu operatörleri tırnaklıyor", () => {
    assert.equal(d.ftsSorgusu("iade"), '"iade"*');
    assert.equal(d.ftsSorgusu("OR"), '"or"*');
    assert.equal(d.ftsSorgusu('"'), "");
    assert.equal(d.ftsSorgusu("İade Şubat"), '"iade"* "subat"*');
  });

  test("Türkçe katlama iki yönlü tutarlı", () => {
    assert.equal(d.turkceKatla("İIıi"), "iiii");
    assert.equal(d.turkceKatla("ŞşÇçĞğÖöÜü"), "ssccggoouu");
    assert.equal(d.turkceKatla("Çalışma"), "calisma");
  });
});

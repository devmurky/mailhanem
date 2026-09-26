/**
 * FTS şema göçü.
 *
 * Bu testin sebebi gerçek bir hata: arama ilk sürümde `content=mailler` ile
 * yazılmıştı. Türkçe ı/i yüzünden şema değişti ve göç **yalnız tabloyu**
 * bıraktı. `mailler` üstündeki eski tetikleyiciler yerinde kaldı, artık var
 * olmayan sütunlara yazmaya çalıştı ve **her mail yazmasını düşürdü**
 * ("table mail_fts has no column named konu"). Hatayı sistem günlüğü gösterdi.
 *
 * Burada iki şey çiviliyor:
 *
 * 1. Eski şema ve tetikleyicileri bulunduğunda **üçü de** bırakılıyor.
 * 2. Göçten sonra mail yazmak çalışıyor ve dizin kendiliğinden doluyor.
 */
import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const klasor = mkdtempSync(join(tmpdir(), "mailhanem-ftsgoc-"));
const dbYolu = join(klasor, "deneme.db");

/**
 * Eski sürümü elle kuruyoruz: `mailler` tablosu + eski FTS tablosu +
 * o sürümün üç tetikleyicisi. `db.ts` bu dosyayı açtığında göçü çalıştırmalı.
 */
function eskiSurumuKur(): void {
  const d = new DatabaseSync(dbYolu);
  d.exec(`
    CREATE TABLE mailler (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kutu_id INTEGER, firma_id INTEGER, mesaj_kimlik TEXT, uid INTEGER,
      gonderen_ad TEXT DEFAULT '', gonderen TEXT, konu TEXT DEFAULT '',
      ozet TEXT DEFAULT '', govde TEXT DEFAULT '', tarih TEXT,
      kategori TEXT, sahip_id INTEGER, durum TEXT DEFAULT 'yeni',
      elendi TEXT, eleme_sebep TEXT DEFAULT '', olusma TEXT DEFAULT (datetime('now')),
      UNIQUE (kutu_id, mesaj_kimlik)
    );
    CREATE VIRTUAL TABLE mail_fts USING fts5(
      konu, gonderen, gonderen_ad, ozet, govde,
      content = 'mailler', content_rowid = 'id'
    );
    CREATE TRIGGER mail_fts_ekle AFTER INSERT ON mailler BEGIN
      INSERT INTO mail_fts (rowid, konu, gonderen, gonderen_ad, ozet, govde)
      VALUES (new.id, new.konu, new.gonderen, new.gonderen_ad, new.ozet, new.govde);
    END;
    CREATE TRIGGER mail_fts_sil AFTER DELETE ON mailler BEGIN
      INSERT INTO mail_fts (mail_fts, rowid, konu, gonderen, gonderen_ad, ozet, govde)
      VALUES ('delete', old.id, old.konu, old.gonderen, old.gonderen_ad, old.ozet, old.govde);
    END;
    CREATE TRIGGER mail_fts_guncelle AFTER UPDATE ON mailler BEGIN
      INSERT INTO mail_fts (mail_fts, rowid, konu, gonderen, gonderen_ad, ozet, govde)
      VALUES ('delete', old.id, old.konu, old.gonderen, old.gonderen_ad, old.ozet, old.govde);
    END;
  `);
  d.close();
}

process.env.DB_YOLU = dbYolu;
Object.assign(process.env, { NODE_ENV: "production" });
process.env.MAILHANEM_ANAHTAR = randomBytes(32).toString("base64");

type DB = typeof import("../sunucu/db.ts");
let d: DB;
let firma = 0;
let kutu = 0;

before(async () => {
  eskiSurumuKur();
  /* Bu import göçü çalıştırıyor. */
  d = await import("../sunucu/db.ts");

  firma = (
    d.db
      .prepare("INSERT INTO firmalar (ad, alan_adi) VALUES (?, ?) RETURNING id")
      .get("Göç A.Ş.", "goc.com") as { id: number }
  ).id;
  kutu = (
    d.db
      .prepare("INSERT INTO kutular (firma_id, adres) VALUES (?, ?) RETURNING id")
      .get(firma, "info@goc.com") as { id: number }
  ).id;
});

after(() => {
  d.db.close();
  rmSync(klasor, { recursive: true, force: true });
});

describe("FTS şema göçü", () => {
  test("eski tetikleyicilerin üçü de bırakılıyor", () => {
    const adlar = (
      d.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'mail_fts%'",
        )
        .all() as { name: string }[]
    ).map((x) => x.name);

    assert.deepEqual(adlar, ["mail_fts_sil"], "yalnız yeni silme tetikleyicisi kalmalı");
  });

  test("tablo yeni şemada", () => {
    const sql = (
      d.db
        .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'mail_fts'")
        .get() as { sql: string }
    ).sql;
    assert.ok(sql.includes("mail_id"), "yeni şema mail_id taşımalı");
    assert.ok(!sql.includes("content"), "content= kalmamalı");
  });

  test("göçten sonra mail yazılabiliyor — asıl kırılan buydu", () => {
    const yazildi = d.mailEkle({
      kutu_id: kutu,
      firma_id: firma,
      mesaj_kimlik: "<goc1@goc.com>",
      uid: null,
      gonderen_ad: "Biri",
      gonderen: "biri@disarisi.com",
      konu: "Göç sonrası ilk mail",
      ozet: "Şubat teklifi ekte",
      govde: "Fiyatlar 30 gün geçerlidir.",
      tarih: new Date().toISOString().replace("T", " ").slice(0, 19),
      elendi: null,
      eleme_sebep: "",
    });

    assert.equal(yazildi, true, "mail yazması hata vermemeli");
  });

  test("yazılan mail aranabiliyor", () => {
    assert.equal(d.gelenKutusu(firma, { arama: "30 gün" }).length, 1);
    assert.equal(d.gelenKutusu(firma, { arama: "subat" }).length, 1, "Türkçe katlama");
  });

  test("silinen mail dizinden düşüyor", () => {
    const id = (
      d.db.prepare("SELECT id FROM mailler LIMIT 1").get() as { id: number }
    ).id;
    d.db.prepare("DELETE FROM mailler WHERE id = ?").run(id);
    assert.equal(d.gelenKutusu(firma, { arama: "30 gün" }).length, 0);
  });
});

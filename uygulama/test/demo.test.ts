/**
 * Demo vitrini.
 *
 * Buradaki asıl soru şu: `demoKur()` her ziyarette **siliyor**. Sildiği şey
 * yalnızca demo firma mı, yoksa gerçek müşterinin kaydına da dokunuyor mu?
 * Bir hata burada sessizce veri kaybettirir, o yüzden sınır testle çiviliyor.
 *
 * Geçici veritabanı; `NODE_ENV=production` verilerek geliştirme örnek verisi
 * yazılmıyor — kurulan tek şey bu dosyadakiler.
 */
import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const klasor = mkdtempSync(join(tmpdir(), "mailhanem-demo-"));
process.env.DB_YOLU = join(klasor, "deneme.db");
Object.assign(process.env, { NODE_ENV: "production" });

/* Demo kutuları SMTP parolasını kasadan geçiriyor (yanıt kutusu demoda da
   görünsün diye); kasa anahtarsız çalışmıyor ve bu doğru davranış. */
process.env.MAILHANEM_ANAHTAR = randomBytes(32).toString("base64");

type DB = typeof import("../sunucu/db.ts");
type Demo = typeof import("../sunucu/demo.ts");
let d: DB;
let demo: Demo;

/* Gerçek müşteri: demo kurulumu buna dokunmamalı. */
let gercekFirma = 0;
let gercekKisi = 0;
let gercekMail = 0;

before(async () => {
  d = await import("../sunucu/db.ts");
  demo = await import("../sunucu/demo.ts");

  gercekFirma = (
    d.db
      .prepare("INSERT INTO firmalar (ad, alan_adi) VALUES (?, ?) RETURNING id")
      .get("Gerçek Firma", "gercek.com") as { id: number }
  ).id;

  gercekKisi = (
    d.db
      .prepare(
        `INSERT INTO kullanicilar (firma_id, eposta, ad, rol, operator)
         VALUES (?, ?, ?, 'sahip', 0) RETURNING id`,
      )
      .get(gercekFirma, "sahip@gercek.com", "Gerçek Sahip") as { id: number }
  ).id;

  const kutu = (
    d.db
      .prepare(
        "INSERT INTO kutular (firma_id, adres) VALUES (?, ?) RETURNING id",
      )
      .get(gercekFirma, "info@gercek.com") as { id: number }
  ).id;

  gercekMail = (
    d.db
      .prepare(
        `INSERT INTO mailler (kutu_id, firma_id, mesaj_kimlik, gonderen, konu, tarih)
         VALUES (?, ?, '<g1@gercek.com>', 'biri@disarisi.com', 'Gerçek mail',
                 datetime('now')) RETURNING id`,
      )
      .get(kutu, gercekFirma) as { id: number }
  ).id;
});

after(() => {
  /* Windows açık WAL dosyasını sildirmiyor; önce bağlantıyı kapat. */
  d.db.close();
  rmSync(klasor, { recursive: true, force: true });
});

describe("demo vitrini", () => {
  test("kurulum demo bayraklı bir firma ve dolu bir kutu bırakır", () => {
    const kullanici = demo.demoKur();

    assert.equal(kullanici.operator, 0);
    assert.ok(kullanici.firma_id, "demo kullanıcısının firması olmalı");

    const firma = d.firmaGetir(kullanici.firma_id!);
    assert.ok(firma);
    assert.equal(firma.demo, 1, "firma demo bayrağı taşımalı");
    assert.ok(demo.demoMu(firma), "demoMu bayrağı görmeli");

    /* Boş panel ürünü anlatmaz: gelen kutusunda mail, elenen tarafta da olmalı. */
    const gelen = d.gelenSay(firma.id, {});
    assert.ok(gelen > 5, `gelen kutusu dolu olmalı, ${gelen} çıktı`);

    const elenen = (
      d.db
        .prepare(
          "SELECT COUNT(*) AS n FROM mailler WHERE firma_id = ? AND elendi IS NOT NULL",
        )
        .get(firma.id) as { n: number }
    ).n;
    assert.ok(elenen > 0, "kural motorunun elediği mailler de yazılmalı");

    assert.equal(d.kutulariGetir(firma.id).length, 2);
    assert.equal(d.firmaKullanicilari(firma.id).length, 3);
    assert.ok(d.sablonlariGetir(firma.id).length > 0);
    assert.ok(d.yonlendirmeleriGetir(firma.id).length > 0);
  });

  test("ikinci ziyaret vitrini sıfırlar, iki demo firma birikmez", () => {
    const once = demo.demoKur();
    const firmaOnce = once.firma_id!;

    /* Ziyaretçi bir mail sahiplenmiş gibi davran. */
    const mail = (
      d.db
        .prepare("SELECT id FROM mailler WHERE firma_id = ? LIMIT 1")
        .get(firmaOnce) as { id: number }
    ).id;
    d.db.prepare("UPDATE mailler SET durum = 'kapandi' WHERE id = ?").run(mail);

    const sonra = demo.demoKur();

    const demoAdedi = (
      d.db.prepare("SELECT COUNT(*) AS n FROM firmalar WHERE demo = 1").get() as {
        n: number;
      }
    ).n;
    assert.equal(demoAdedi, 1, "her ziyarette tek demo firma kalmalı");

    assert.notEqual(sonra.firma_id, firmaOnce, "firma yeniden kurulmalı");
    assert.equal(
      d.firmaGetir(firmaOnce),
      undefined,
      "önceki ziyaretin firması silinmeli",
    );

    const kalan = (
      d.db
        .prepare("SELECT COUNT(*) AS n FROM mailler WHERE firma_id = ?")
        .get(firmaOnce) as { n: number }
    ).n;
    assert.equal(kalan, 0, "önceki ziyaretin mailleri de gitmeli");
  });

  test("gerçek firmaya dokunmuyor", () => {
    demo.demoKur();
    demo.demoKur();

    const firma = d.firmaGetir(gercekFirma);
    assert.ok(firma, "gerçek firma silinmemeli");
    assert.equal(firma.demo, 0, "gerçek firma demo sayılmamalı");
    assert.ok(d.kullaniciIdIle(gercekKisi), "gerçek kullanıcı durmalı");

    const mail = (
      d.db
        .prepare("SELECT COUNT(*) AS n FROM mailler WHERE id = ?")
        .get(gercekMail) as { n: number }
    ).n;
    assert.equal(mail, 1, "gerçek mail durmalı");
  });

  test("demo kullanıcısı kendi firmasının dışını görmüyor", () => {
    const kullanici = demo.demoKur();
    const firmaId = kullanici.firma_id!;

    /* Firma sınırı panelin her sorgusunda; demo da aynı kapıdan geçiyor. */
    const bulundu = d.mailGetir(firmaId, gercekMail);
    assert.equal(bulundu, undefined, "demo, gerçek firmanın mailini görmemeli");
  });
});

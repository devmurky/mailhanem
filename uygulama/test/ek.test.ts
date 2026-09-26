/**
 * Ekler (madde 5 ve 10).
 *
 * İki soru var ve ikisi de sessizce yanlış çalışabilir:
 *
 * 1. **Ayrıştırma neyi ek sayıyor?** İmzadaki logo da teknik olarak bir ek.
 *    Onları listelemek her mailin altına üç anlamsız dosya asar; elemek de
 *    gerçek bir eki kaçırma riski taşır. Sınır burada çiviliyor.
 * 2. **Disk adı nereden geliyor?** Kullanıcının verdiği addan gelirse
 *    `..\\..\\bir-yer` gibi bir ad yolu kırar. Ad veritabanından üretiliyor ve
 *    `ekOku` yalnız o biçimi kabul ediyor.
 */
import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const klasor = mkdtempSync(join(tmpdir(), "mailhanem-ek-"));
process.env.DB_YOLU = join(klasor, "deneme.db");
process.env.EK_KLASORU = join(klasor, "ekler");
Object.assign(process.env, { NODE_ENV: "production" });
process.env.MAILHANEM_ANAHTAR = randomBytes(32).toString("base64");

type DB = typeof import("../sunucu/db.ts");
type EkDosya = typeof import("../sunucu/ekDosya.ts");
type Dosya = typeof import("../sunucu/posta/dosya.ts");
let d: DB;
let ek: EkDosya;
let dosya: Dosya;

let firma = 0;
let mail = 0;

/* Gerçek bir multipart mail: iki gerçek ek + satır içi imza logosu. */
function emlKur(): Buffer {
  const sinir = "SINIR_TEST";
  const pdf = Buffer.from("%PDF-1.4\ntest\n%%EOF\n");
  const csv = Buffer.from("a;b\n1;2\n");
  const gif = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64",
  );

  return Buffer.from(
    [
      "From: Biri <biri@disarisi.com>",
      "To: info@firma.com",
      "Subject: Ekli mail",
      "Date: Mon, 22 Sep 2026 09:00:00 +0300",
      "Message-ID: <ek-test@disarisi.com>",
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${sinir}"`,
      "",
      `--${sinir}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Ekte gonderiyorum.",
      "",
      `--${sinir}`,
      'Content-Type: application/pdf; name="belge.pdf"',
      'Content-Disposition: attachment; filename="belge.pdf"',
      "Content-Transfer-Encoding: base64",
      "",
      pdf.toString("base64"),
      "",
      `--${sinir}`,
      'Content-Type: text/csv; name="liste.csv"',
      'Content-Disposition: attachment; filename="liste.csv"',
      "Content-Transfer-Encoding: base64",
      "",
      csv.toString("base64"),
      "",
      `--${sinir}`,
      "Content-Type: image/gif",
      "Content-Disposition: inline",
      "Content-ID: <imza>",
      "Content-Transfer-Encoding: base64",
      "",
      gif.toString("base64"),
      "",
      `--${sinir}--`,
      "",
    ].join("\r\n"),
  );
}

before(async () => {
  d = await import("../sunucu/db.ts");
  ek = await import("../sunucu/ekDosya.ts");
  dosya = await import("../sunucu/posta/dosya.ts");

  firma = (
    d.db
      .prepare("INSERT INTO firmalar (ad, alan_adi) VALUES (?, ?) RETURNING id")
      .get("Ek A.Ş.", "ek.com") as { id: number }
  ).id;

  const kutu = (
    d.db
      .prepare("INSERT INTO kutular (firma_id, adres) VALUES (?, ?) RETURNING id")
      .get(firma, "info@ek.com") as { id: number }
  ).id;

  mail = (
    d.db
      .prepare(
        `INSERT INTO mailler (kutu_id, firma_id, mesaj_kimlik, gonderen, konu, tarih)
         VALUES (?, ?, '<m1@ek.com>', 'biri@disarisi.com', 'Ekli', datetime('now'))
         RETURNING id`,
      )
      .get(kutu, firma) as { id: number }
  ).id;
});

after(() => {
  d.db.close();
  rmSync(klasor, { recursive: true, force: true });
});

describe("mail ekleri", () => {
  test("satır içi imza logosu ek sayılmıyor, gerçek ekler alınıyor", async () => {
    const m = await dosya.ayristir(emlKur(), "deneme");

    assert.equal(m.ekler.length, 2, "yalnız iki gerçek ek olmalı");
    const adlar = m.ekler.map((e) => e.ad).sort();
    assert.deepEqual(adlar, ["belge.pdf", "liste.csv"]);
    assert.ok(
      m.ekler.every((e) => e.icerik.length > 0),
      "eklerin içeriği dolu gelmeli",
    );
  });

  test("beyaz liste dışındaki tip reddediliyor", () => {
    assert.ok(ek.EK_TIPLERI.has("application/pdf"));
    assert.ok(!ek.EK_TIPLERI.has("application/x-msdownload"), "çalıştırılabilir kabul edilmemeli");
    assert.ok(!ek.EK_TIPLERI.has("text/html"), "HTML kabul edilmemeli");
  });

  test("disk adı üretiliyor, kullanıcının adı yola karışmıyor", () => {
    const ad = ek.ekYaz(new Uint8Array([1, 2, 3]), "application/pdf");
    assert.match(ad, /^[0-9a-f]{32}\.pdf$/, "ad onaltılık ve uzantılı olmalı");
    assert.equal(ek.ekOku(ad).length, 3);
  });

  test("yol ayracı taşıyan ad okunmuyor", () => {
    assert.throws(() => ek.ekOku("../../veri/mailhanem.db"), /Geçersiz ek adı/);
    assert.throws(() => ek.ekOku("bir-yer/dosya.pdf"), /Geçersiz ek adı/);
  });

  test("künye ve dosya birlikte duruyor, firma sınırı okumada geçerli", () => {
    const ad = ek.ekYaz(new Uint8Array([9, 9]), "text/csv");
    const id = d.ekEkle({
      mailId: mail,
      firmaId: firma,
      ad: "liste.csv",
      tip: "text/csv",
      boyut: 2,
      dosya: ad,
    });

    const listeler = d.mailEkleri(mail, firma);
    assert.equal(listeler.length, 1);
    assert.equal(listeler[0]!.ad, "liste.csv");

    /* Başka firmanın numarasıyla aynı mail sorulunca boş dönmeli. */
    assert.equal(d.mailEkleri(mail, firma + 999).length, 0);

    const tek = d.ekGetir(id);
    assert.ok(tek);
    assert.equal(tek.firma_id, firma, "indirme ucu yetkiyi bu alandan kesiyor");
  });

  test("silinen ek dosyası okunmaya çalışılınca patlıyor, sessizce boş dönmüyor", () => {
    const ad = ek.ekYaz(new Uint8Array([5]), "text/plain");
    ek.ekSil(ad);
    assert.ok(!existsSync(join(klasor, "ekler", ad)));
    assert.throws(() => ek.ekOku(ad));
  });

  test("boyut okunur biçime çevriliyor", () => {
    assert.equal(ek.boyutYaz(512), "512 B");
    assert.equal(ek.boyutYaz(2048), "2 KB");
    assert.match(ek.boyutYaz(5 * 1024 * 1024), /MB$/);
  });
});

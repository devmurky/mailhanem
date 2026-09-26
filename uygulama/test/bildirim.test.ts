/**
 * Geciken mail bildirimi (madde 13).
 *
 * Buradaki asıl sorular şunlar: **kime gidiyor, ne zaman gitmiyor?** Bildirim
 * sessizce yanlış çalışırsa ya kimse haberdar olmaz ya da ekip her turda mail
 * bombardımanına tutulur; ikisi de ekrandan görülmez.
 *
 * SMTP kapalı olduğu için `gonder()` gerçek mail atmıyor ve `gercek: false`
 * dönüyor — testin beklediği de bu: damga **atılmamalı** ki SMTP açıldığında
 * ilk bildirim atlanmasın.
 */
import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const klasor = mkdtempSync(join(tmpdir(), "mailhanem-bildirim-"));
process.env.DB_YOLU = join(klasor, "deneme.db");
Object.assign(process.env, { NODE_ENV: "production" });
process.env.MAILHANEM_ANAHTAR = randomBytes(32).toString("base64");
/* SMTP kapalı: gönderim konsola düşüyor, gercek:false dönüyor. */
process.env.SMTP_SUNUCU = "";

type DB = typeof import("../sunucu/db.ts");
type Bildirim = typeof import("../sunucu/bildirim.ts");
let d: DB;
let b: Bildirim;

let firma = 0;
let kutu = 0;

before(async () => {
  d = await import("../sunucu/db.ts");
  b = await import("../sunucu/bildirim.ts");

  firma = (
    d.db
      .prepare("INSERT INTO firmalar (ad, alan_adi, durum) VALUES (?, ?, 'etkin') RETURNING id")
      .get("Geciken A.Ş.", "geciken.com") as { id: number }
  ).id;

  d.db
    .prepare(
      `INSERT INTO kullanicilar (firma_id, eposta, ad, rol, operator, durum)
       VALUES (?, 'ekip@geciken.com', 'Ekip', 'sahip', 0, 'etkin')`,
    )
    .run(firma);

  /* Kapatılmış kişi: bildirime girmemeli. */
  d.db
    .prepare(
      `INSERT INTO kullanicilar (firma_id, eposta, ad, rol, operator, durum)
       VALUES (?, 'ayrilan@geciken.com', 'Ayrılan', 'personel', 0, 'kapali')`,
    )
    .run(firma);

  kutu = (
    d.db
      .prepare("INSERT INTO kutular (firma_id, adres) VALUES (?, ?) RETURNING id")
      .get(firma, "info@geciken.com") as { id: number }
  ).id;
});

after(() => {
  d.db.close();
  rmSync(klasor, { recursive: true, force: true });
});

function mailEkle(v: {
  mesaj: string;
  saatOnce: number;
  sahip?: number | null;
  durum?: string;
  elendi?: boolean;
}) {
  d.db
    .prepare(
      `INSERT INTO mailler (kutu_id, firma_id, mesaj_kimlik, gonderen, konu, tarih,
                            sahip_id, durum, elendi)
       VALUES (?, ?, ?, 'biri@disarisi.com', 'Bekleyen mail', datetime('now', ?),
               ?, ?, ?)`,
    )
    .run(
      kutu,
      firma,
      v.mesaj,
      `-${v.saatOnce} hours`,
      v.sahip ?? null,
      v.durum ?? "yeni",
      v.elendi ? "2026-01-01 00:00:00" : null,
    );
}

describe("geciken mail bildirimi", () => {
  test("24 saati geçmemiş mail bildirim üretmez", async () => {
    mailEkle({ mesaj: "<taze@x>", saatOnce: 2 });
    const sonuc = await b.gecikenleriBildir();
    assert.equal(sonuc.length, 0, "taze mail için bildirim çıkmamalı");
  });

  test("geciken sahipsiz mail bildirime giriyor, kapalı kullanıcı alıcı değil", async () => {
    mailEkle({ mesaj: "<geciken1@x>", saatOnce: 30 });
    mailEkle({ mesaj: "<geciken2@x>", saatOnce: 40 });

    const sonuc = await b.gecikenleriBildir();
    assert.equal(sonuc.length, 1);
    assert.equal(sonuc[0]!.mailAdedi, 2, "iki geciken mail sayılmalı");
    assert.equal(sonuc[0]!.alici, 1, "yalnız etkin kullanıcı alıcı olmalı");
    assert.equal(sonuc[0]!.gonderildi, false, "SMTP kapalı, gerçekten gitmedi");
  });

  test("sahiplenilmiş, kapanmış ve elenmiş mail sayılmıyor", async () => {
    const kisi = (
      d.db.prepare("SELECT id FROM kullanicilar WHERE eposta = ?").get("ekip@geciken.com") as {
        id: number;
      }
    ).id;

    mailEkle({ mesaj: "<sahipli@x>", saatOnce: 50, sahip: kisi });
    mailEkle({ mesaj: "<kapandi@x>", saatOnce: 50, durum: "kapandi" });
    mailEkle({ mesaj: "<yanitlandi@x>", saatOnce: 50, durum: "yanitlandi" });
    mailEkle({ mesaj: "<elendi@x>", saatOnce: 50, elendi: true });

    const sonuc = await b.gecikenleriBildir();
    assert.equal(sonuc[0]!.mailAdedi, 2, "sayı hâlâ iki olmalı");
  });

  test("SMTP kapalıyken damga atılmıyor — açıldığında ilk bildirim atlanmasın", async () => {
    const damga = d.ayarOku("bildirim_geciken_" + firma);
    assert.equal(damga, "", "gönderilemeyen bildirim damgalanmamalı");
  });

  test("damga varsa aynı gün ikinci bildirim çıkmıyor", async () => {
    d.ayarYaz(
      "bildirim_geciken_" + firma,
      new Date().toISOString().replace("T", " ").slice(0, 19),
    );

    const sonuc = await b.gecikenleriBildir();
    assert.equal(sonuc.length, 1);
    assert.equal(sonuc[0]!.gonderildi, false);
    assert.equal(sonuc[0]!.atlandi, "bugün zaten gönderildi");
  });

  test("sessizlik süresi dolunca yeniden bildiriliyor", async () => {
    d.ayarYaz("bildirim_geciken_" + firma, "2020-01-01 00:00:00");

    const sonuc = await b.gecikenleriBildir();
    assert.equal(sonuc[0]!.atlandi, "SMTP kapalı", "artık sessizlik yüzünden atlanmamalı");
  });

  test("ekibi olmayan firma bildirim üretmiyor", async () => {
    const bos = (
      d.db
        .prepare("INSERT INTO firmalar (ad, alan_adi, durum) VALUES (?, ?, 'etkin') RETURNING id")
        .get("Ekipsiz", "ekipsiz.com") as { id: number }
    ).id;
    const bosKutu = (
      d.db
        .prepare("INSERT INTO kutular (firma_id, adres) VALUES (?, ?) RETURNING id")
        .get(bos, "info@ekipsiz.com") as { id: number }
    ).id;
    d.db
      .prepare(
        `INSERT INTO mailler (kutu_id, firma_id, mesaj_kimlik, gonderen, konu, tarih)
         VALUES (?, ?, '<ekipsiz@x>', 'biri@disarisi.com', 'Bekleyen', datetime('now', '-40 hours'))`,
      )
      .run(bosKutu, bos);

    const sonuc = await b.gecikenleriBildir();
    assert.ok(
      !sonuc.some((s) => s.firmaId === bos),
      "alıcısı olmayan firma için bildirim üretilmemeli",
    );
  });
});

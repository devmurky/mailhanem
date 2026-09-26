/**
 * Zamanlayıcının karar mantığı.
 *
 * Çekimin kendisi burada çalıştırılmıyor (onu hat testleri kapsıyor);
 * buradaki soru şu: ayar okunurken çöp değere ne oluyor, "sıradaki tur"
 * ne zaman hesaplanıyor, kapalıyken ne diyor.
 */
import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const klasor = mkdtempSync(join(tmpdir(), "mailhanem-zaman-"));
process.env.DB_YOLU = join(klasor, "deneme.db");
Object.assign(process.env, { NODE_ENV: "production" });

let d: typeof import("../sunucu/db.ts");
let z: typeof import("../sunucu/zamanlayici.ts");

before(async () => {
  d = await import("../sunucu/db.ts");
  z = await import("../sunucu/zamanlayici.ts");
});

after(() => {
  d.db.close();
  rmSync(klasor, { recursive: true, force: true });
});

describe("aralık ayarı", () => {
  test("ayar hiç yazılmamışsa zamanlayıcı kapalıdır", () => {
    assert.equal(z.araligiOku(), 0);
    assert.equal(z.durum().acik, false);
  });

  test("tanınan aralık yazılır ve geri okunur", () => {
    z.araligiYaz(15);
    assert.equal(z.araligiOku(), 15);
    assert.equal(z.durum().acik, true);
  });

  test("tanınmayan aralık yazılamaz", () => {
    assert.throws(() => z.araligiYaz(7), /Tanınmayan aralık/);
    assert.equal(z.araligiOku(), 15, "eski değer bozulmamalı");
  });

  test("ayarda çöp değer varsa kapalı sayılır, patlamaz", () => {
    d.ayarYaz(z.ARALIK_ANAHTAR, "bilmemne");
    assert.equal(z.araligiOku(), 0);
    assert.equal(z.durum().acik, false);
    z.araligiYaz(30);
  });

  test("sıfır aralık zamanlayıcıyı kapatır", () => {
    z.araligiYaz(0);
    const s = z.durum();
    assert.equal(s.acik, false);
    assert.equal(s.siradaki, "", "kapalıyken sıradaki tur olmaz");
    z.araligiYaz(30);
  });
});

describe("sıradaki tur", () => {
  test("son çalışmanın üstüne aralık eklenir", () => {
    d.ayarYaz("cekim_son_calisma", "2026-09-12 10:00:00");
    z.araligiYaz(30);
    assert.equal(z.durum().siradaki, "2026-09-12 10:30:00");

    z.araligiYaz(180);
    assert.equal(z.durum().siradaki, "2026-09-12 13:00:00");
  });

  test("hiç çalışmadıysa son sonuç boş kalır", () => {
    assert.equal(z.durum().sonSonuc, "");
  });
});

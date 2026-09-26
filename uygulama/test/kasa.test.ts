import { strict as assert } from "node:assert";
import { test, before } from "node:test";
import { anahtarUret, ayniMi, KasaHatasi, zarfiAc, zarfla } from "../sunucu/kasa.ts";

before(() => {
  process.env.MAILHANEM_ANAHTAR = anahtarUret();
});

test("zarflanan parola geri açılır", () => {
  const p = "çok-gizli-parola-42";
  assert.equal(zarfiAc(zarfla(p)), p);
});

test("aynı parola her seferinde farklı kayıt üretir", () => {
  const a = zarfla("aynısı");
  const b = zarfla("aynısı");
  assert.notEqual(a, b, "IV ve DEK rastgele olmalı");
  assert.equal(zarfiAc(a), zarfiAc(b));
});

test("kayıtta parola düz metin geçmez", () => {
  const kayit = zarfla("parolam1234");
  assert.ok(!kayit.includes("parolam1234"));
});

test("kurcalanan kayıt çözülmez", () => {
  const kayit = zarfla("parola");
  const parca = kayit.split(".");
  const bozuk = Buffer.from(parca[2]!, "base64");
  bozuk[bozuk.length - 1] = (bozuk[bozuk.length - 1] ?? 0) ^ 0xff;
  const kurcalanmis = `${parca[0]}.${parca[1]}.${bozuk.toString("base64")}`;
  assert.throws(() => zarfiAc(kurcalanmis), KasaHatasi);
});

test("başka ana anahtarla çözülmez", () => {
  const kayit = zarfla("parola");
  const eski = process.env.MAILHANEM_ANAHTAR;
  process.env.MAILHANEM_ANAHTAR = anahtarUret();
  assert.throws(() => zarfiAc(kayit), KasaHatasi);
  process.env.MAILHANEM_ANAHTAR = eski;
});

test("anahtar yoksa sessizce düz metne düşmez, patlar", () => {
  const eski = process.env.MAILHANEM_ANAHTAR;
  delete process.env.MAILHANEM_ANAHTAR;
  assert.throws(() => zarfla("parola"), KasaHatasi);
  process.env.MAILHANEM_ANAHTAR = eski;
});

test("kısa anahtar reddedilir", () => {
  const eski = process.env.MAILHANEM_ANAHTAR;
  process.env.MAILHANEM_ANAHTAR = Buffer.alloc(16).toString("base64");
  assert.throws(() => zarfla("parola"), KasaHatasi);
  process.env.MAILHANEM_ANAHTAR = eski;
});

test("ayniMi doğru cevap verir", () => {
  const kayit = zarfla("dogru");
  assert.equal(ayniMi(kayit, "dogru"), true);
  assert.equal(ayniMi(kayit, "yanlis"), false);
  assert.equal(ayniMi("bozuk-kayit", "dogru"), false);
});

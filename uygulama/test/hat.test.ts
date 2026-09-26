/**
 * Hattın tamamı: .eml dosyalarını oku → ayrıştır → kural motorundan geçir.
 * Veritabanına dokunmuyor; ayrıştırma ile kararın birlikte doğru çalıştığını
 * gösteriyor.
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { resolve } from "node:path";
import { DosyaKaynagi } from "../sunucu/posta/dosya.ts";
import { kararVer } from "../sunucu/posta/kural.ts";
import { ozetCikar } from "../sunucu/posta/kaynak.ts";

const KLASOR = resolve(import.meta.dirname, "..", "ornek-posta");
const KENDI = ["arkunmobilya.com"];

async function hepsi() {
  const mailler = await new DosyaKaynagi(KLASOR).cek(100);
  return mailler.map((m) => ({
    m,
    karar: kararVer({
      gonderen: m.gonderen,
      konu: m.konu,
      basliklar: m.basliklar,
      kendiAlanlar: KENDI,
    }),
  }));
}

test("örnek kutudaki on bir mailin hepsi ayrıştırılır", async () => {
  const sonuc = await hepsi();
  /* 11-ekli-teklif.eml madde 10 (ekler) için eklendi; hat testine de dahil. */
  assert.equal(sonuc.length, 11);
  for (const { m } of sonuc) {
    assert.ok(m.gonderen.includes("@"), "gönderen okunmalı: " + m.konu);
    assert.ok(m.mesajKimlik, "mesaj kimliği olmalı: " + m.konu);
    assert.ok(m.tarih instanceof Date && !Number.isNaN(m.tarih.getTime()));
  }
});

test("beş mail geçer, altısı elenir", async () => {
  const sonuc = await hepsi();
  const gecen = sonuc.filter((s) => s.karar.gecer).map((s) => s.m.konu);
  const elenen = sonuc.filter((s) => !s.karar.gecer).map((s) => s.m.konu);

  assert.equal(gecen.length, 5, "geçenler: " + gecen.join(" | "));
  assert.equal(elenen.length, 6, "elenenler: " + elenen.join(" | "));

  assert.ok(gecen.some((k) => k.includes("Iade proseduru")));
  assert.ok(gecen.some((k) => k.includes("toplu alim")));
  assert.ok(gecen.some((k) => k.includes("hasarli")));
  assert.ok(gecen.some((k) => k.includes("gider faturalari")));
  assert.ok(gecen.some((k) => k.includes("teklifi")), "ekli mail de geçmeli");
});

test("her eleme doğru kuralla gerekçelenir", async () => {
  const sonuc = await hepsi();
  const kural = (parca: string) => {
    const s = sonuc.find((x) => x.m.konu.includes(parca));
    assert.ok(s, "mail bulunamadı: " + parca);
    return s.karar.gecer ? "gecti" : s.karar.kural;
  };

  assert.equal(kural("Eylul sayisi"), "bulten");
  assert.equal(kural("teslim edildi"), "no-reply");
  assert.equal(kural("Otomatik yanit"), "otomatik-yanit");
  assert.equal(kural("Depo sayimi"), "ic-yazisma");
  assert.equal(kural("Undelivered"), "otomatik-yanit");
  assert.equal(kural("kampanyasi"), "otomatik-yanit");
});

test("özet gövdeden çıkarılır ve kısaltılır", async () => {
  const sonuc = await hepsi();
  const iade = sonuc.find((s) => s.m.konu.includes("Iade proseduru"));
  assert.ok(iade);
  const ozet = ozetCikar(iade.m.metin);
  assert.ok(ozet.length > 20, "özet boş olmamalı");
  assert.ok(!ozet.includes("\n"), "özet tek satır olmalı");
  assert.ok(ozet.includes("koltugu iade"));
});

test("uzun gövde kesilir ve üç nokta eklenir", () => {
  const ozet = ozetCikar("a".repeat(500));
  assert.equal(ozet.length, 180);
  assert.ok(ozet.endsWith("…"));
});

test("alıntı satırları özete girmez", () => {
  assert.equal(ozetCikar("Merhaba\n> eski mail\nİyi günler"), "Merhaba İyi günler");
});

test("aynı dosya iki kez okunduğunda aynı kimlik üretilir", async () => {
  const a = await new DosyaKaynagi(KLASOR).cek(100);
  const b = await new DosyaKaynagi(KLASOR).cek(100);
  assert.deepEqual(
    a.map((m) => m.mesajKimlik),
    b.map((m) => m.mesajKimlik),
    "tekrar koruması buna dayanıyor",
  );
});

test("olmayan klasör boş döner, patlamaz", async () => {
  assert.deepEqual(await new DosyaKaynagi(resolve(KLASOR, "yok-boyle")).cek(10), []);
});

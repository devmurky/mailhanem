/**
 * Yönlendirme motoru — saf fonksiyon, veritabanı yok.
 *
 * Sorular: doğru kural mı yakalıyor, yanlış olanı yakalamıyor mu, sıra
 * gerçekten ilk eşleşende mi duruyor, ve Türkçe büyük/küçük harf ("İ"/"ı")
 * eşleşmeyi bozuyor mu.
 */
import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { esler, yonlendir, type Kural } from "../sunucu/posta/yonlendirme.ts";

function kural(p: Partial<Kural>): Kural {
  return {
    id: 1,
    tip: "alan",
    kalip: "",
    kategori: null,
    sahip_id: null,
    etkin: 1,
    ...p,
  };
}

describe("gönderen adresi kuralı", () => {
  test("tam adres eşleşir", () => {
    const k = kural({ tip: "gonderen", kalip: "muhasebe@tedarikci.com" });
    assert.ok(esler(k, { gonderen: "muhasebe@tedarikci.com", konu: "" }));
    assert.ok(esler(k, { gonderen: "  MUHASEBE@Tedarikci.COM ", konu: "" }));
  });

  test("benzeyen adres eşleşmez", () => {
    const k = kural({ tip: "gonderen", kalip: "murat@firma.com" });
    assert.ok(!esler(k, { gonderen: "murat@firmax.com", konu: "" }));
    assert.ok(!esler(k, { gonderen: "muratx@firma.com", konu: "" }));
    /* Parça eşleşmesi yok: adres kuralı tam eşleşmedir. */
    assert.ok(!esler(k, { gonderen: "ali.murat@firma.com", konu: "" }));
  });
});

describe("alan adı kuralı", () => {
  test("alan adı ve alt alan adı eşleşir", () => {
    const k = kural({ tip: "alan", kalip: "tedarikci.com" });
    assert.ok(esler(k, { gonderen: "biri@tedarikci.com", konu: "" }));
    assert.ok(esler(k, { gonderen: "biri@posta.tedarikci.com", konu: "" }));
  });

  test("benzeyen alan adı eşleşmez", () => {
    const k = kural({ tip: "alan", kalip: "firma.com" });
    assert.ok(!esler(k, { gonderen: "biri@sahtefirma.com", konu: "" }));
    assert.ok(!esler(k, { gonderen: "biri@firma.com.tr", konu: "" }));
  });

  test("adressiz girdi patlamaz", () => {
    const k = kural({ tip: "alan", kalip: "firma.com" });
    assert.ok(!esler(k, { gonderen: "bozuk-adres", konu: "" }));
  });
});

describe("konu kuralı", () => {
  test("konunun içinde geçmesi yeter", () => {
    const k = kural({ tip: "konu", kalip: "fatura" });
    assert.ok(esler(k, { gonderen: "x@y.com", konu: "Şubat ayı faturası" }));
    assert.ok(!esler(k, { gonderen: "x@y.com", konu: "Sipariş durumu" }));
  });

  test("Türkçe büyük harf eşleşmeyi bozmaz", () => {
    /* "İADE" küçültülünce "iade" olmalı; İngilizce katlamada "i̇ade" çıkar. */
    const k = kural({ tip: "konu", kalip: "iade" });
    assert.ok(esler(k, { gonderen: "x@y.com", konu: "ÜRÜN İADE TALEBİ" }));

    const k2 = kural({ tip: "konu", kalip: "İADE" });
    assert.ok(esler(k2, { gonderen: "x@y.com", konu: "ürün iade talebi" }));
  });
});

describe("sıra ve etkinlik", () => {
  const kurallar: Kural[] = [
    kural({ id: 1, tip: "alan", kalip: "tedarikci.com", kategori: "fatura" }),
    kural({ id: 2, tip: "konu", kalip: "fatura", kategori: "destek", sahip_id: 7 }),
    kural({ id: 3, tip: "konu", kalip: "sikayet", kategori: "sikayet" }),
  ];

  test("ilk eşleşen kazanır, sonrakine bakılmaz", () => {
    const s = yonlendir(kurallar, {
      gonderen: "biri@tedarikci.com",
      konu: "Şubat faturası",
    });
    assert.equal(s?.kuralId, 1);
    assert.equal(s?.kategori, "fatura");
    assert.equal(s?.sahipId, null, "ikinci kuralın sahibi uygulanmamalı");
  });

  test("duraklatılmış kural atlanır", () => {
    const duraklatilmis = [kural({ id: 1, tip: "konu", kalip: "fatura", etkin: 0 }), kurallar[2]!];
    assert.equal(yonlendir(duraklatilmis, { gonderen: "x@y.com", konu: "fatura" }), undefined);
  });

  test("hiçbiri tutmazsa sonuç yok", () => {
    assert.equal(
      yonlendir(kurallar, { gonderen: "biri@baska.com", konu: "merhaba" }),
      undefined,
    );
  });

  test("boş kalıp hiçbir şeyi yakalamaz", () => {
    /* Yoksa boş bir kural bütün maillere uygulanırdı. */
    assert.ok(!esler(kural({ tip: "konu", kalip: "   " }), { gonderen: "x@y.com", konu: "x" }));
    assert.ok(!esler(kural({ tip: "alan", kalip: "" }), { gonderen: "x@y.com", konu: "x" }));
  });

  test("tanınmayan tip eşleşmez", () => {
    assert.ok(!esler(kural({ tip: "bilinmeyen", kalip: "x" }), { gonderen: "x@y.com", konu: "x" }));
  });
});

/**
 * Tema geçişindeki zarf maskesinin geometrisi.
 *
 * Denenmeye değen tek şey şu: maske büyüdüğünde ekranı **tam olarak** yutuyor
 * mu. Yutmazsa geçişin sonunda eski temadan bir şerit kalıyor ve kullanıcı
 * bunu çizim hatası sanıyor. Kapak (üst kenardaki çöküntü) yüzünden bu,
 * "köşelere yetişsin" kadar basit değil: tepe ortası en son kapanan yer.
 */
import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { icindeMi, kapsayanOlcek, zarfMaskesi } from "../app/bilesenler/zarfMaske.ts";

/** Ekranın dört köşesi, dört kenar ortası ve merkezi. */
function kritikNoktalar(en: number, boy: number) {
  return [
    [0, 0], [en, 0], [0, boy], [en, boy],
    [en / 2, 0], [en / 2, boy], [0, boy / 2], [en, boy / 2],
    [en / 2, boy / 2],
  ] as [number, number][];
}

describe("zarf maskesi", () => {
  test("polygon beş nokta üretiyor ve piksel biriminde", () => {
    const m = zarfMaskesi(100, 100, 50);
    assert.ok(m.startsWith("polygon("));
    assert.equal(m.split(",").length, 5);
    assert.ok(m.includes("px"));
  });

  test("küçük maske düğmenin çevresinde kalıyor", () => {
    /* Geçişin ilk karesi: ekranın tamamı değil, düğmenin üstündeki nokta. */
    assert.ok(icindeMi(200, 500, 10, 200, 505), "merkez içeride olmalı");
    assert.equal(icindeMi(200, 500, 10, 600, 300), false, "uzak nokta dışarıda olmalı");
  });

  test("kapak çöküntüsü gerçekten var — üst orta başlangıçta açık", () => {
    /* Zarfı zarf yapan şey bu: üst kenarın ortası içeri çöküyor. */
    const mx = 400, my = 400, olcek = 100;
    const ust = my - olcek + 2; // üst kenarın hemen altı
    /* Tam ortada kapak en derin yerinde: nokta dışarıda kalıyor. */
    assert.equal(icindeMi(mx, my, olcek, mx, ust), false, "orta, kapak yüzünden dışarıda");
    /* Köşeye yakın aynı yükseklikte kapak bitmiş oluyor: nokta içeride. */
    assert.ok(icindeMi(mx, my, olcek, mx - 138, ust), "köşeye yakın taraf içeride");
  });

  for (const [en, boy] of [[1440, 900], [1920, 1080], [375, 812], [2560, 1440]] as const) {
    test(`${en}×${boy} ekranda, düğme nerede olursa olsun ekran tamamen kapanıyor`, () => {
      /* Düğme sol menünün dibinde duruyor ama panel kaydırılabiliyor ve dar
         ekranda menü üste çıkıyor: her köşeden denenmesi gerek. */
      const dugmeYerleri: [number, number][] = [
        [30, boy - 30],       // sol alt — bugünkü yeri
        [en - 30, 30],        // sağ üst
        [en / 2, boy / 2],    // orta
        [10, 10],             // sol üst
        [en - 10, boy - 10],  // sağ alt
      ];

      for (const [mx, my] of dugmeYerleri) {
        const olcek = kapsayanOlcek(mx, my, en, boy);
        for (const [nx, ny] of kritikNoktalar(en, boy)) {
          assert.ok(
            icindeMi(mx, my, olcek, nx, ny),
            `düğme (${mx},${my}) → nokta (${nx},${ny}) kapanmadı`,
          );
        }
      }
    });
  }

  test("ölçek sıfıra düşmüyor — düğme köşedeyken bile maske büyüyor", () => {
    assert.ok(kapsayanOlcek(0, 0, 1440, 900) > 0);
    assert.ok(kapsayanOlcek(1440, 900, 1440, 900) > 0);
  });
});

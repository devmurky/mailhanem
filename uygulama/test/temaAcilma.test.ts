/**
 * Tema geçişindeki açılma dairesi.
 *
 * Denenmeye değen tek şey: daire büyüdüğünde ekranda kapanmadık yer kalıyor
 * mu. Kalırsa geçişin sonunda köşede eski temadan bir hilal görünüyor ve
 * kullanıcı bunu çizim hatası sanıyor.
 */
import { strict as assert } from "node:assert";
import { describe, test } from "node:test";
import { daire, icindeMi, kapsayanYaricap } from "../app/bilesenler/temaAcilma.ts";

/** Ekranın dört köşesi, dört kenar ortası ve merkezi. */
function kritikNoktalar(en: number, boy: number) {
  return [
    [0, 0], [en, 0], [0, boy], [en, boy],
    [en / 2, 0], [en / 2, boy], [0, boy / 2], [en, boy / 2],
    [en / 2, boy / 2],
  ] as [number, number][];
}

describe("tema açılma dairesi", () => {
  test("clip-path yazımı piksel biriminde ve yuvarlanmış", () => {
    assert.equal(daire(100.4, 200.6, 50.5), "circle(51px at 100px 201px)");
  });

  for (const [en, boy] of [[1440, 900], [1920, 1080], [375, 812], [2560, 1440]] as const) {
    test(`${en}×${boy} ekranda, düğme nerede olursa olsun ekran tamamen kapanıyor`, () => {
      /* Düğme müşteri panelinde sol menünün dibinde, tanıtım sayfasında sağ
         üstte; dar ekranda ikisi de başka yere kayıyor. Hepsi denenmeli. */
      const dugmeYerleri: [number, number][] = [
        [30, boy - 30],
        [en - 30, 30],
        [en / 2, boy / 2],
        [0, 0],
        [en, boy],
      ];

      for (const [mx, my] of dugmeYerleri) {
        const r = kapsayanYaricap(mx, my, en, boy);
        for (const [nx, ny] of kritikNoktalar(en, boy)) {
          assert.ok(
            icindeMi(mx, my, r, nx, ny),
            `düğme (${mx},${my}) → nokta (${nx},${ny}) kapanmadı`,
          );
        }
      }
    });
  }

  test("yarıçap en uzak köşeye göre, en yakınına göre değil", () => {
    /* Sol üstteki düğme için sağ alt köşe belirleyici: köşegen uzunluğu. */
    assert.equal(Math.round(kapsayanYaricap(0, 0, 300, 400)), 500);
    /* Tam ortadaki düğme için yarım köşegen yetiyor. */
    assert.equal(Math.round(kapsayanYaricap(150, 200, 300, 400)), 250);
  });

  test("daire hiç küçülmüyor — sıfır yarıçap yalnız başlangıç karesi", () => {
    assert.ok(kapsayanYaricap(0, 0, 1440, 900) > 0);
    assert.equal(daire(10, 10, 0), "circle(0px at 10px 10px)");
  });
});

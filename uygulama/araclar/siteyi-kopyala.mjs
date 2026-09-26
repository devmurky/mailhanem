/**
 * Tanıtım sayfasını uygulamanın içine alır.
 *
 * Site ile uygulama ayrı sunuculardaydı: site 8791'de statik, uygulama 3100'de.
 * Tek kökene geçince CORS'a gerek kalmıyor, tek komutla her şey ayağa kalkıyor
 * ve tarayıcıdaki adres tek. Ama **kaynak dosya yerinde kalıyor**
 * (`mailhanem/site/index.html`): yön sözleşmesi ve yakalama aracı tam o yolu
 * okuyor, oradan taşımak onları koparırdı.
 *
 * Bu yüzden kopyalama bir derleme adımı: `npm run yap` ve `npm run dev` öncesi
 * çalışır, kopyayı `public/tanitim/` altına koyar ve iki şeyi değiştirir:
 *
 *   1. `AYAR.koku` boşaltılır — uçlar artık aynı kökende.
 *   2. `giris.html` bağlantıları `/giris`'e döner — uygulamanın kendi giriş
 *      sayfası gerçek olanı; statik kopya tasarım artefaktı olarak kalıyor.
 *
 * Değişimlerden biri tutmazsa betik **patlar**. Sessizce geçseydi yayına
 * çıkan sayfa yanlış kökene istek atardı ve bunu ancak kullanıcı fark ederdi.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const burasi = dirname(fileURLToPath(import.meta.url));
const KAYNAK = resolve(burasi, "..", "..", "site", "index.html");
const HEDEF = resolve(burasi, "..", "public", "tanitim", "index.html");

/** [ne, yerine, beklenen en az adet] */
const DEGISIMLER = [
  ['koku: "http://127.0.0.1:3100"', 'koku: ""', 1],
  ['href="giris.html"', 'href="/giris"', 3],
];

function main() {
  let metin = readFileSync(KAYNAK, "utf8");

  for (const [ne, yerine, enAz] of DEGISIMLER) {
    const adet = metin.split(ne).length - 1;
    if (adet < enAz) {
      throw new Error(
        `siteyi-kopyala: "${ne}" ${enAz} kez bekleniyordu, ${adet} bulundu. ` +
          "Kaynak sayfa değişmiş olabilir; kopyalama kuralı güncellenmeli.",
      );
    }
    metin = metin.split(ne).join(yerine);
  }

  mkdirSync(dirname(HEDEF), { recursive: true });
  writeFileSync(HEDEF, metin, "utf8");
  console.log(`[site] tanıtım sayfası kopyalandı → public/tanitim/index.html`);
}

main();

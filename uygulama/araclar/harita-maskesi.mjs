/**
 * Tanıtım sayfasının arka plan haritası için kara maskesi üretir.
 *
 * Neden bir betik: `site/index.html` tek dosya, yapı adımı yok. Tam bir dünya
 * SVG'si 30–80 KB, yani sayfayı neredeyse ikiye katlardı. Bunun yerine kara
 * bir kez burada **bit ızgarasına** çevriliyor ve sayfaya ~2 KB'lık base64
 * dizgi olarak giriyor; çizimi tarayıcı canvas'ta yapıyor.
 *
 * Kaynak: Natural Earth 110m "land" (nvkelso/natural-earth-vector).
 * Natural Earth **kamu malıdır**, atıf zorunluluğu yoktur; yine de kaynağın
 * adı burada yazıyor ki harita yeniden üretilebilsin.
 *
 * Kırpma Türkiye'nin ticaret komşuluğu: Avrupa, Kuzey Afrika, Orta Doğu, BDT.
 * Antarktika'lı tam dünya dekordur; alıcıların gerçekten olduğu bölge bir
 * argümandır — üstelik bu kırpma veriyi küçültüp kıyıları okunur bırakıyor.
 *
 * Kullanım:  node araclar/harita-maskesi.mjs
 * Sonuç:     site/index.html içindeki harita-maskesi işaretleri arasına yazar.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const KAYNAK =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson";

/* Kırpma ve çözünürlük.
 *
 * İlk deneme Türkiye'nin ticaret komşuluğuydu (Avrupa–MENA–BDT). Fikir iyiydi
 * ama veri aksini söyledi: o dikdörtgenin **%76'sı kara**, yani nokta ızgarası
 * tıkanıyor ve harita okunmuyordu. Dünyanın tamamında kara %29 — yani tam
 * dünya hem istenen şey hem de görsel olarak daha seyrek.
 *
 * Kutuplar atıldı (lat -58…78): Antarktika ile boş Arktik, ekranda yer kaplayıp
 * hiçbir şey anlatmıyor. 1.25° ızgara 288×109 = 31.392 bit ≈ 5,1 KB base64;
 * bu ölçekte İtalya, Britanya, Anadolu ve Kızıldeniz ayırt ediliyor. */
const LON0 = -180, LON1 = 180;
const LAT0 = -58, LAT1 = 78;
const ADIM = 1.25;

const BU = dirname(fileURLToPath(import.meta.url));
const HEDEF = join(BU, "..", "..", "site", "index.html");
const ONBELLEK = join(BU, "..", "..", ".harita-onbellek.json");

/** Kaynağı indirir; ikinci çalıştırmada ağa çıkmasın diye diske bırakır. */
async function veriyiAl() {
  try {
    const yerel = await readFile(ONBELLEK, "utf8");
    console.log("[harita] önbellekten okundu");
    return JSON.parse(yerel);
  } catch {
    /* Önbellek yok: indir. */
  }

  console.log("[harita] indiriliyor:", KAYNAK);
  const cevap = await fetch(KAYNAK);
  if (!cevap.ok) throw new Error(`Kaynak alınamadı: ${cevap.status}`);
  const metin = await cevap.text();
  await writeFile(ONBELLEK, metin);
  console.log("[harita] önbelleğe yazıldı:", ONBELLEK);
  return JSON.parse(metin);
}

/** GeoJSON'daki bütün poligonları, sınır kutularıyla birlikte düz listeye alır. */
function poligonlar(geojson) {
  const liste = [];

  const ekle = (halkalar) => {
    let enAzX = Infinity, enCokX = -Infinity, enAzY = Infinity, enCokY = -Infinity;
    for (const halka of halkalar) {
      for (const [x, y] of halka) {
        if (x < enAzX) enAzX = x;
        if (x > enCokX) enCokX = x;
        if (y < enAzY) enAzY = y;
        if (y > enCokY) enCokY = y;
      }
    }
    /* Kırpma alanının tamamen dışındaki poligon hiç saklanmıyor: Amerika ve
       Okyanusya bu haritada yok, onları her hücrede yeniden denemek boşuna. */
    if (enCokX < LON0 || enAzX > LON1 || enCokY < LAT0 || enAzY > LAT1) return;
    liste.push({ halkalar, enAzX, enCokX, enAzY, enCokY });
  };

  for (const oge of geojson.features) {
    const g = oge.geometry;
    if (!g) continue;
    if (g.type === "Polygon") ekle(g.coordinates);
    else if (g.type === "MultiPolygon") for (const p of g.coordinates) ekle(p);
  }
  return liste;
}

/**
 * Nokta poligonun içinde mi — ışın atma.
 *
 * Bir poligonun bütün halkaları birlikte sayılıyor: dış halka bir kesişme,
 * içindeki delik bir kesişme daha ekler, yani tek/çift kuralı deliği
 * kendiliğinden deniz yapar. (Örnek: Hazar.)
 */
function icindeMi(poligon, x, y) {
  if (x < poligon.enAzX || x > poligon.enCokX || y < poligon.enAzY || y > poligon.enCokY) {
    return false;
  }
  let iceride = false;
  for (const halka of poligon.halkalar) {
    for (let i = 0, j = halka.length - 1; i < halka.length; j = i++) {
      const [xi, yi] = halka[i];
      const [xj, yj] = halka[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        iceride = !iceride;
      }
    }
  }
  return iceride;
}

const geojson = await veriyiAl();
const kara = poligonlar(geojson);
console.log(`[harita] kırpma alanına giren poligon: ${kara.length}`);

const en = Math.round((LON1 - LON0) / ADIM);
const boy = Math.round((LAT1 - LAT0) / ADIM);

/* Bitler MSB'den dolduruluyor; tarayıcı tarafı da aynı sırayla okuyor. */
const baytlar = new Uint8Array(Math.ceil((en * boy) / 8));
let karaHucre = 0;

for (let satir = 0; satir < boy; satir++) {
  /* Satır 0 en kuzey: canvas'ta yukarıdan aşağıya çizilecek. */
  const lat = LAT1 - (satir + 0.5) * ADIM;
  for (let sutun = 0; sutun < en; sutun++) {
    const lon = LON0 + (sutun + 0.5) * ADIM;
    let dolu = false;
    for (const p of kara) {
      if (icindeMi(p, lon, lat)) { dolu = true; break; }
    }
    if (dolu) {
      const bit = satir * en + sutun;
      baytlar[bit >> 3] |= 0x80 >> (bit & 7);
      karaHucre++;
    }
  }
}

const b64 = Buffer.from(baytlar).toString("base64");
console.log(
  `[harita] ızgara ${en}×${boy}, kara hücre ${karaHucre} (%${((karaHucre / (en * boy)) * 100).toFixed(1)}), base64 ${b64.length} karakter`,
);

const satirlar = [
  "/* Bu blok araclar/harita-maskesi.mjs tarafından üretildi — elle düzenleme. */",
  `var HARITA = { en:${en}, boy:${boy}, lon0:${LON0}, lon1:${LON1}, lat0:${LAT0}, lat1:${LAT1},`,
  `  veri:"${b64}" };`,
];

const ISARET_BAS = "/* harita-maskesi:başlangıç */";
const ISARET_SON = "/* harita-maskesi:bitiş */";

const sayfa = await readFile(HEDEF, "utf8");
const bas = sayfa.indexOf(ISARET_BAS);
const son = sayfa.indexOf(ISARET_SON);
if (bas === -1 || son === -1) {
  console.error(
    `[harita] işaretler bulunamadı. site/index.html içindeki betiğe şunları koyun:\n${ISARET_BAS}\n${ISARET_SON}`,
  );
  console.log("\n--- üretilen blok ---\n" + satirlar.join("\n"));
  process.exit(1);
}

const yeni =
  sayfa.slice(0, bas + ISARET_BAS.length) +
  "\n" + satirlar.join("\n") + "\n" +
  sayfa.slice(son);

await writeFile(HEDEF, yeni);
console.log("[harita] site/index.html güncellendi");

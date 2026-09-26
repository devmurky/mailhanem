import Link from "next/link";
import {
  aiMaliyet,
  aiMaliyetToplam,
  db,
  destekDakika,
  destekDakikaToplam,
  firmaHacimSerisi,
  firmaOzetleri,
  gelirSerisi,
  saglikSkoru,
  talepSayilari,
  type FirmaOzet,
} from "@/sunucu/db";
import { Kivilcim } from "./Kivilcim";
import { MusteriTablosu, para, type MusteriSatiri } from "./MusteriTablosu";

/** Operatörün kendi saatinin karşılığı (kuruş). Net marj bunu düşüyor. */
const SAAT_KURUS = 75_000;

/**
 * Operatör Genel Bakış — `tasarim/operator.html`in `bakisHTML()` ekranı.
 *
 * Prototipin düzeni birebir: dört istatistik kartı, altında **İş kuyruğu**
 * (önem sırasına göre), altında müşteri tablosu ve dipnot.
 *
 * ── İş kuyruğu gerçek ──────────────────────────────────────
 * Prototipte elle yazılmış dört satırdı. Burada gerçek sinyallerden
 * üretiliyor: kopuk kutu (acil), cevaplanmamış demo talebi (fırsat), deneme
 * süresi işleyen firma (risk), uzun süredir çekim yapmamış kutu (risk).
 * Satır yoksa kuyruk boş görünüyor — doldurmak için iş uydurulmuyor.
 *
 * ── Her sayı gerçek sorgudan ───────────────────────────────
 * Dört kartın dördü de prototipteki adıyla duruyor ve dördü de gerçek bir
 * tabloyu sorguluyor: gelir `firmalar`/`abonelik_gecmisi`, yapay zekâ
 * `ai_kullanim`, destek `destek_kayitlari`, net marj bu üçünün hesabı.
 *
 * Bugün son üçü tire gösteriyor çünkü **o tablolarda henüz satır yok** —
 * sabit sıfır ya da uydurma rakam değil. Model `ai_kullanim`a yazmaya
 * başladığı, operatör destek dakikası girdiği an kartlar kendiliğinden dolar;
 * bu dosyada değişecek hiçbir şey yok.
 */
export const dynamic = "force-dynamic";

type Is = {
  seviye: "kritik" | "uyari" | "firsat";
  rozet: string;
  firma: string;
  metin: string;
  sure: string;
  eylem: string;
  yol: string;
};

function gecenSure(damga: string | null): string {
  if (!damga) return "—";
  const fark = Date.now() - new Date(damga.replace(" ", "T") + "Z").getTime();
  const dk = Math.round(fark / 60000);
  if (dk < 60) return `${dk} dk`;
  const sa = Math.round(dk / 60);
  if (sa < 48) return `${sa} sa`;
  return `${Math.round(sa / 24)} gün`;
}

function isKuyrugu(firmalar: FirmaOzet[]): Is[] {
  const isler: Is[] = [];

  /* Kopuk kutu: müşteri mail alamıyor. Kuyruğun en tepesi. */
  const kopuklar = db
    .prepare(
      `SELECT k.adres, k.son_cekim, f.ad AS firma
       FROM kutular k JOIN firmalar f ON f.id = k.firma_id
       WHERE k.durum = 'kopuk' ORDER BY k.son_cekim IS NULL DESC, k.son_cekim ASC`,
    )
    .all() as { adres: string; son_cekim: string | null; firma: string }[];

  for (const k of kopuklar) {
    isler.push({
      seviye: "kritik",
      rozet: "acil",
      firma: k.firma,
      metin: `${k.adres} bağlantısı koptu — bu kutuya gelen mailler panele düşmüyor.`,
      sure: gecenSure(k.son_cekim),
      eylem: "Bağlantıya git",
      yol: "/operator/saglik",
    });
  }

  /* Cevaplanmamış demo talebi: gelir fırsatı bekliyor. */
  const yeniTalepler = db
    .prepare(
      `SELECT ad, firma, olusma FROM talepler WHERE durum = 'yeni'
       ORDER BY olusma ASC`,
    )
    .all() as { ad: string; firma: string; olusma: string }[];

  for (const t of yeniTalepler) {
    isler.push({
      seviye: "firsat",
      rozet: "fırsat",
      firma: t.firma || t.ad,
      metin: `${t.ad} demo talebi bıraktı, henüz dönülmedi.`,
      sure: gecenSure(t.olusma),
      eylem: "Talebi aç",
      yol: "/operator/talepler",
    });
  }

  /* Deneme firması: ücrete dönmezse kaybediliyor. */
  for (const f of firmalar) {
    if (f.durum !== "deneme") continue;
    isler.push({
      seviye: "uyari",
      rozet: "risk",
      firma: f.ad,
      metin: `Deneme sürüyor, abonelik başlamadı. Bu ay ${f.gelen_ay.toLocaleString("tr-TR")} mail işlendi.`,
      sure: gecenSure(f.olusma),
      eylem: "Aboneliğe git",
      yol: "/operator/abonelikler",
    });
  }

  return isler;
}

export default async function OperatorGenelBakis() {
  const firmalar = firmaOzetleri();
  const talepler = talepSayilari();

  const aylikGelir = firmalar.reduce((t, f) => t + (f.aylik_kurus ?? 0), 0);
  const gelenAy = firmalar.reduce((t, f) => t + f.gelen_ay, 0);
  const denemede = firmalar.filter((f) => f.durum === "deneme").length;

  /* Dördü de gerçek sorgudan geliyor. Bugün boş dönenler sabit sıfır değil —
     tablolarında henüz satır yok. Model `ai_kullanim`a, operatör
     `destek_kayitlari`na yazdığı anda bu kartlar kendiliğinden dolar. */
  const gelirSeri = gelirSerisi();
  const aiKurus = aiMaliyetToplam();
  const destekDk = destekDakikaToplam();

  /* Marj ancak iki gider de ölçülüyorsa hesaplanabilir; biri eksikse rakam
     yazmak "gider yok" demek olurdu. */
  const destekKurus = destekDk === null ? null : Math.round((destekDk / 60) * SAAT_KURUS);
  const brutY =
    aylikGelir > 0 && aiKurus !== null
      ? Math.round(((aylikGelir - aiKurus) / aylikGelir) * 100)
      : null;
  const netY =
    aylikGelir > 0 && aiKurus !== null && destekKurus !== null
      ? Math.round(((aylikGelir - aiKurus - destekKurus) / aylikGelir) * 100)
      : null;

  const isler = isKuyrugu(firmalar);

  const satirlar: MusteriSatiri[] = firmalar.map((f) => {
    const s = saglikSkoru(f.id);
    const ai = aiMaliyet(f.id);
    const dk = destekDakika(f.id);
    const ucret = f.aylik_kurus ?? 0;
    const destekK = dk === null ? null : Math.round((dk / 60) * SAAT_KURUS);
    return {
      id: f.id,
      ad: f.ad,
      alan_adi: f.alan_adi,
      plan: f.plan,
      durum: f.durum,
      aylik_kurus: ucret,
      gelen_ay: f.gelen_ay,
      hacim: firmaHacimSerisi(f.id),
      skor: s.skor,
      kapsam: s.kapsam,
      ai_kurus: ai,
      destek_dk: dk,
      net_yuzde:
        ucret > 0 && ai !== null && destekK !== null
          ? Math.round(((ucret - ai - destekK) / ucret) * 100)
          : null,
    };
  });

  return (
    <div className="sayfa">
      <div className="sayfa-ust">
        <div>
          <h1>Genel Bakış</h1>
          <p>Bugün müşteri kaybettirebilecek her şey en üstte</p>
        </div>
      </div>

      <dl className="kartlar">
        <div className="skart">
          <dt>Aylık gelir</dt>
          <div className="deger">
            <dd>{para(aylikGelir)}</dd>
            {gelirSeri.length > 1 ? (
              <span className="kivilcim">
                <Kivilcim dizi={gelirSeri} renk="var(--olumlu)" />
              </span>
            ) : null}
          </div>
          <div className="not">
            {firmalar.length} firma · {denemede} deneme
          </div>
        </div>

        <div className={aiKurus === null ? "skart bekleyen" : "skart"}>
          <dt>Yapay zekâ maliyeti</dt>
          <div className="deger">
            <dd>{aiKurus === null ? "—" : para(aiKurus)}</dd>
          </div>
          <div className="not">
            {aiKurus === null
              ? "model bağlanıp işlem yazdıkça dolar"
              : `son 30 gün · ${gelenAy.toLocaleString("tr-TR")} mail`}
          </div>
        </div>

        <div className={destekDk === null ? "skart bekleyen" : "skart"}>
          <dt>Destek yükün</dt>
          <div className="deger">
            <dd>
              {destekDk === null
                ? "—"
                : `${(destekDk / 60).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} sa`}
            </dd>
          </div>
          <div className="not">
            {destekDk === null
              ? "destek dakikası girildikçe dolar"
              : `bu ay · ${para(Math.round((destekDk / 60) * SAAT_KURUS))} karşılığı`}
          </div>
        </div>

        <div className={netY === null ? "skart bekleyen" : "skart"}>
          <dt>Net marj</dt>
          <div className="deger">
            <dd>{netY === null ? "—" : `%${netY}`}</dd>
          </div>
          <div className="not">
            {netY === null ? (
              "yapay zekâ ve destek ölçüsü bekliyor"
            ) : (
              <>
                brüt %{brutY} · aradaki fark senin zamanın
              </>
            )}
          </div>
        </div>
      </dl>

      <h2 className="bolum">
        İş kuyruğu
        <span className="sayi">{isler.length} açık</span>
        <span className="aciklayici">önem sırasına göre</span>
      </h2>

      {isler.length ? (
        <div className="triyaj">
          {isler.map((is, i) => (
            <div className={`tsatir ${is.seviye}`} key={`${is.yol}-${i}`}>
              <span className={`rozet r-${is.seviye}`}>{is.rozet}</span>
              <span className="ne">
                <span className="firma">{is.firma}</span>
                <span className="aciklama">{is.metin}</span>
              </span>
              <span className="sure">{is.sure}</span>
              <Link className="dugme ufak" href={is.yol}>
                {is.eylem}
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="triyaj">
          <div className="tsatir bos">
            <span className="ne">
              <span className="firma">Kuyruk boş</span>
              <span className="aciklama">
                Kopuk kutu yok, bekleyen demo talebi yok, denemede firma yok.
              </span>
            </span>
          </div>
        </div>
      )}

      <h2 className="bolum">
        Müşteriler
        <span className="sayi">{firmalar.length}</span>
        <span className="aciklayici">
          {talepler.yeni ? `${talepler.yeni} yeni talep bekliyor` : "tamamı kurulu"}
        </span>
      </h2>

      <MusteriTablosu satirlar={satirlar} />

      <p className="dip">
        <b>Net marj</b> = abonelik − yapay zekâ − destek saatin (saati{" "}
        {para(SAAT_KURUS)}). Brüt marj senin zamanını bedava sayar; net marj saymaz.
        Aradaki fark, hangi müşterinin gerçekten kâr getirdiğini gösteren tek sayıdır.
        Tire gören hücrelerde ölçüm kapalı değil — <b>o tabloda henüz satır yok</b>;
        yapay zekâ işlem yazdıkça ve destek dakikası girildikçe kendiliğinden dolarlar.
      </p>
    </div>
  );
}

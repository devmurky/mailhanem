import {
  AI_IS_TURU_AD,
  aiIsTurleri,
  aiMaliyet,
  aiMaliyetToplam,
  destekDakika,
  destekDakikaToplam,
  firmaOzetleri,
  sorgu,
} from "@/sunucu/db";
import { para } from "../MusteriTablosu";

/**
 * Maliyet ve Marj — prototipteki `maliyetHTML()`.
 *
 * Prototipin dört paneli aynen duruyor: yapay zekâ iş türüne göre, aylık
 * maliyet tablosu, 1000 mail başına maliyet, plan bazlı net marj. Üstteki
 * yeşil tasarruf bandı da orada.
 *
 * ── Ölçülen ve ölçülmeyen ─────────────────────────────────
 * Bu ekran tamamen `ai_kullanim` ve `destek_kayitlari` tablolarına dayanıyor.
 * Model henüz bağlı değil, o yüzden yapay zekâ satırları bugün boş; **ama
 * sorgular gerçek** ve model yazmaya başladığı an bu ekran kendiliğinden
 * dolar. Uydurma rakam yok.
 *
 * Kural motorunun elediği mail sayısı **ölçülüyor** — o gerçek. Ne kadar
 * tasarruf ettirdiğini söylemek için mail başına model maliyeti gerekiyor;
 * o da ancak model bağlanınca bilinecek. Bu yüzden tasarruf bandı, birim
 * maliyet ölçülene kadar tutar yerine **adedi** yazıyor.
 */
export const dynamic = "force-dynamic";

/** Operatörün kendi saatinin karşılığı (kuruş) — Genel Bakış ile aynı. */
const SAAT_KURUS = 75_000;

/** Sunucu ve depolamanın aylık payı (kuruş). Ortamdan okunuyor. */
function altyapiKurus(): number {
  const ham = Number(process.env.ALTYAPI_KURUS ?? "0");
  return Number.isFinite(ham) && ham > 0 ? ham : 0;
}

function yuzde(pay: number, toplam: number): number | null {
  return toplam > 0 ? Math.round((pay / toplam) * 100) : null;
}

const PLAN_AD: Record<string, string> = {
  kurumsal: "Kurumsal",
  pro: "Pro",
  baslangic: "Başlangıç",
  deneme: "Deneme",
};

export default async function Maliyet() {
  const firmalar = firmaOzetleri();

  const gelir = firmalar.reduce((t, f) => t + (f.aylik_kurus ?? 0), 0);
  const gelenAy = firmalar.reduce((t, f) => t + f.gelen_ay, 0);
  const elenenAy = firmalar.reduce((t, f) => t + f.elenen_ay, 0);

  const ai = aiMaliyetToplam();
  const destekDk = destekDakikaToplam();
  const destekKurus = destekDk === null ? null : Math.round((destekDk / 60) * SAAT_KURUS);
  const altyapi = altyapiKurus();

  const isTurleri = aiIsTurleri();

  /* Net ancak bütün giderler ölçülüyorsa hesaplanabilir. Biri eksikken rakam
     yazmak "o gider yok" demek olurdu. */
  const hepsiOlculdu = ai !== null && destekKurus !== null;
  const net = hepsiOlculdu ? gelir - ai! - altyapi - destekKurus! : null;

  /* Mail başına maliyet: gerçek ölçüm. Model yazmadan önce null. */
  const binMailBasi = firmalar
    .filter((f) => f.gelen_ay > 0)
    .map((f) => {
      const fAi = aiMaliyet(f.id);
      return {
        ad: f.ad,
        mail: f.gelen_ay,
        kurus: fAi === null ? null : Math.round((fAi / f.gelen_ay) * 1000),
      };
    })
    .sort((a, b) => (b.kurus ?? -1) - (a.kurus ?? -1));

  /* Plan bazlı net marj. */
  const planlar = ["kurumsal", "pro", "baslangic"].map((p) => {
    const grup = firmalar.filter((f) => f.plan === p);
    const planGelir = grup.reduce((t, f) => t + (f.aylik_kurus ?? 0), 0);

    let planGider = 0;
    let olculdu = grup.length > 0;
    for (const f of grup) {
      const fAi = aiMaliyet(f.id);
      const fDk = destekDakika(f.id);
      if (fAi === null || fDk === null) {
        olculdu = false;
        break;
      }
      planGider += fAi + Math.round((fDk / 60) * SAAT_KURUS);
    }

    return {
      plan: p,
      adet: grup.length,
      gelir: planGelir,
      yuzde: olculdu && planGelir > 0 ? Math.round(((planGelir - planGider) / planGelir) * 100) : null,
    };
  });

  /* Kural motorunun bu ay elediği mail — ölçülen tek tasarruf girdisi. */
  const elemeOrani = gelenAy + elenenAy > 0 ? Math.round((elenenAy / (gelenAy + elenenAy)) * 100) : 0;

  const cekimVar = (
    sorgu<{ n: number }>("SELECT COUNT(*) AS n FROM cekimler")[0]?.n ?? 0
  ) > 0;

  return (
    <div className="sayfa">
      <div className="sayfa-ust">
        <div>
          <h1>Maliyet ve Marj</h1>
          <p>Her kuruş nereye gidiyor, hangi müşteri gerçekten kazandırıyor</p>
        </div>
      </div>

      {/* Tasarruf bandı: adet gerçek, tutar model bağlanınca hesaplanacak. */}
      <div className="kaz">
        <b>{elenenAy.toLocaleString("tr-TR")}</b>
        <span className="ne">
          Bu ay yapay zekâya <b>hiç gönderilmeyen</b> mail. Kural motoru bülten,
          no-reply ve otomatik yanıtları modele varmadan eledi — gelen trafiğin %
          {elemeOrani}&apos;i. Bunun parasal karşılığını yazmak için mail başına model
          maliyeti gerekiyor; o da model bağlanınca ölçülecek.
        </span>
      </div>

      <div className="pizgara p2">
        <div className="kt">
          <div className="kt-ust">
            <span className="kt-ad">Yapay zekâ · iş türüne göre</span>
            <span className="kt-not">son 30 gün</span>
          </div>
          <div className="kt-ic">
            {isTurleri.length ? (
              <>
                {isTurleri.map((t) => (
                  <div className="mal-satir" key={`${t.is_turu}-${t.model}`}>
                    {/* Tanınmayan tür ham yazılıyor: sessizce "diğer" demek,
                        yeni bir iş türünün gözden kaçması olurdu. */}
                    <span className="ad">
                      {AI_IS_TURU_AD[t.is_turu] ?? (t.is_turu || "belirtilmemiş")}
                    </span>
                    <span className="ek">
                      {t.model} · {t.cagri.toLocaleString("tr-TR")} çağrı ·{" "}
                      {t.token.toLocaleString("tr-TR")} token
                    </span>
                    <span className="tut">{para(t.kurus)}</span>
                  </div>
                ))}
                <div className="mal-satir top">
                  <span className="ad">Toplam</span>
                  <span className="tut">{para(ai ?? 0)}</span>
                </div>
              </>
            ) : (
              <p className="dip">
                <b>Henüz model çağrısı yok.</b> Bu tablo <code>ai_kullanim</code>{" "}
                tablosundan okuyor. Müşteri panelindeki <b>Bilgi Deposu</b> çıkarımı
                çalıştırıldığında ilk satır buraya düşer; sınıflandırma ve taslak
                çağrıları bağlandığında onlar da eklenir. Tutar için ortamda birim
                fiyat (<code>ZEKA_KURUS_1M_GIRDI</code>) tanımlı olmalı — tanımsızken
                token sayılır, kuruş sıfır yazılır.
              </p>
            )}
          </div>
        </div>

        <div className="kt">
          <div className="kt-ust">
            <span className="kt-ad">Aylık maliyet tablosu</span>
          </div>
          <div className="kt-ic">
            <div className="mal-satir">
              <span className="ad">Gelir</span>
              <span className="ek">{firmalar.length} firma</span>
              <span className="tut">{para(gelir)}</span>
            </div>

            <div className="mal-satir">
              <span className="ad">Yapay zekâ</span>
              <span className="ek">{gelenAy.toLocaleString("tr-TR")} mail</span>
              <span className={ai === null ? "tut olcusuz" : "tut eksi"}>
                {ai === null ? "—" : `−${para(ai)}`}
              </span>
            </div>

            <div className="mal-satir">
              <span className="ad">Sunucu ve depolama</span>
              <span className="ek">{altyapi ? "ALTYAPI_KURUS" : "girilmedi"}</span>
              <span className={altyapi ? "tut eksi" : "tut olcusuz"}>
                {altyapi ? `−${para(altyapi)}` : "—"}
              </span>
            </div>

            <div className="mal-satir">
              <span className="ad">Destek zamanın</span>
              <span className="ek">
                {destekDk === null
                  ? "kayıt yok"
                  : `${(destekDk / 60).toLocaleString("tr-TR", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })} sa × ${para(SAAT_KURUS)}`}
              </span>
              <span className={destekKurus === null ? "tut olcusuz" : "tut eksi"}>
                {destekKurus === null ? "—" : `−${para(destekKurus)}`}
              </span>
            </div>

            <div className="mal-satir top">
              <span className="ad">Net</span>
              <span className="tut">
                {net === null ? (
                  <span className="olcusuz">—</span>
                ) : (
                  <>
                    {para(net)} · %{yuzde(net, gelir) ?? 0}
                  </>
                )}
              </span>
            </div>

            <p className="dip">
              {net === null ? (
                <>
                  Net, giderlerin <b>hepsi</b> ölçülmeden hesaplanmıyor. Bugün eksik
                  olanlar: {ai === null ? "yapay zekâ" : null}
                  {ai === null && destekKurus === null ? ", " : null}
                  {destekKurus === null ? "destek zamanı" : null}
                  {!altyapi ? (ai === null || destekKurus === null ? ", altyapı" : "altyapı") : null}.
                  Eksik gideri sıfır saymak, marjı olduğundan yüksek gösterirdi.
                </>
              ) : (
                <>
                  <b>Destek kalemi</b> ölçülüyor: ölçeklenirken model maliyetini değil,
                  destek saatini düşürmek gerekiyor. Brüt marj senin zamanını bedava
                  sayar, buradaki net saymaz.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="pizgara p2">
        <div className="kt">
          <div className="kt-ust">
            <span className="kt-ad">1000 mail başına maliyet</span>
            <span className="kt-not">müşteri bazında</span>
          </div>
          <div className="kt-ic">
            {binMailBasi.length ? (
              binMailBasi.map((b) => (
                <div className="mal-satir" key={b.ad}>
                  <span className="ad">{b.ad}</span>
                  <span className="ek">{b.mail.toLocaleString("tr-TR")} mail</span>
                  <span className={b.kurus === null ? "tut olcusuz" : "tut"}>
                    {b.kurus === null ? (
                      "—"
                    ) : (
                      <>
                        {para(b.kurus)} <span className="birim">/1000</span>
                      </>
                    )}
                  </span>
                </div>
              ))
            ) : (
              <p className="dip">
                {cekimVar
                  ? "Bu ay hiçbir firmaya mail gelmemiş."
                  : "Henüz çekim yapılmadı; mail geldikçe burası dolar."}
              </p>
            )}
            <p className="dip">
              Birim maliyet müşteriye göre değişecek, çünkü mail karışımı farklı: çok
              ek gönderen müşteride belge analizi payı büyür. Bugün model bağlı
              olmadığı için sütun boş, mail sayıları gerçek.
            </p>
          </div>
        </div>

        <div className="kt">
          <div className="kt-ust">
            <span className="kt-ad">Plan bazlı net marj</span>
          </div>
          <div className="kt-ic">
            {planlar.map((p) => (
              <div className="mal-satir" key={p.plan}>
                <span className="ad">{PLAN_AD[p.plan] ?? p.plan}</span>
                <span className="ek">
                  {p.adet} müşteri · {para(p.gelir)}
                </span>
                <span
                  className={
                    p.yuzde === null ? "tut olcusuz" : p.yuzde < 55 ? "tut eksi" : "tut"
                  }
                >
                  {p.yuzde === null ? "—" : `%${p.yuzde}`}
                </span>
              </div>
            ))}
            <p className="dip">
              Bu tablo hangi planın gerçekten kazandırdığını gösterecek. Ucuz planın
              en çok destek isteyen müşterileri toplaması olağan; marj orada çökerse
              ya fiyat artar ya destek o plandan çıkar. Karar için önce{" "}
              <b>destek dakikasının girilmesi</b> gerekiyor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

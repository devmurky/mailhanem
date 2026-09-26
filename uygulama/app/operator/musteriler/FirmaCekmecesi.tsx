import Link from "next/link";
import type { BilgiOzeti, SaglikSkoru } from "@/sunucu/db";
import { Ikon } from "../../bilesenler/Ikon";
import { para } from "../MusteriTablosu";

/**
 * Firma detay çekmecesi (madde 8) — prototipteki `cekmeceHTML()`.
 *
 * Sağdan açılan panel: sağlık skoru **kırılımıyla**, aylık mail hacmi ve
 * "bu müşteri gerçekten ne kazandırıyor" hesabı.
 *
 * ── Skor neden kırılımıyla ────────────────────────────────
 * Tek bir sayı ("67") kara kutudur; kimse ona güvenmez ve kimse ona göre
 * karar vermez. Kırılım hangi bileşenden kaç puan geldiğini gösteriyor, ve
 * **ölçülemeyen bileşen sıfır puan değil "ölçülmüyor" diye yazıyor** — veri
 * yokluğunu kötü performans gibi göstermek yanlış olurdu.
 *
 * Açılma `?cekmece=` ile adreste: yenilenince kaybolmuyor, paylaşılabiliyor ve
 * JS olmadan da çalışıyor. Perde de bir bağlantı — kapatmak için JS gerekmiyor.
 */

export type CekmeceFirma = {
  id: number;
  ad: string;
  alan_adi: string;
  plan: string;
  durum: string;
  aylik_kurus: number;
  olusma: string;
  kutu: number;
  kullanici: number;
  gelen_ay: number;
  elenen_ay: number;
  gelen_toplam: number;
};

const AY_KISA = ["6 ay", "5 ay", "4 ay", "3 ay", "2 ay", "bu ay"];

function skorSinif(s: number): string {
  return s >= 70 ? "s-iyi" : s >= 45 ? "s-orta" : "s-kotu";
}

function skorYorum(s: number, kapsam: number): string {
  if (kapsam < 100) {
    return `Skorun %${kapsam}'lık bölümü ölçülebiliyor; kalanı model ve destek kaydı bağlanınca girecek.`;
  }
  if (s >= 70) return "Sağlıklı: hacim yerinde, ekip kullanıyor.";
  if (s >= 45) return "İzlemeye değer: bir bileşen düşük.";
  return "Riskli: kaybetmeden önce konuşulmalı.";
}

export function FirmaCekmecesi({
  firma,
  skor,
  hacim,
  bilgi,
  aiKurus,
  destekDk,
  altyapiPay,
  saatKurus,
  geriYol,
}: {
  firma: CekmeceFirma;
  skor: SaglikSkoru;
  hacim: number[];
  /** Deponun doluluğu: taslak adımına hazırlığın ölçüsü. */
  bilgi: BilgiOzeti;
  aiKurus: number | null;
  destekDk: number | null;
  altyapiPay: number;
  saatKurus: number;
  /** Perde ve kapat düğmesinin döneceği adres. */
  geriYol: string;
}) {
  const enB = Math.max(...hacim, 1);
  const destekKurus = destekDk === null ? null : Math.round((destekDk / 60) * saatKurus);
  const hepsiOlculdu = aiKurus !== null && destekKurus !== null;
  const net = hepsiOlculdu
    ? firma.aylik_kurus - aiKurus! - altyapiPay - destekKurus!
    : null;
  const netY = net !== null && firma.aylik_kurus > 0
    ? Math.round((net / firma.aylik_kurus) * 100)
    : null;

  const ayFarki = Math.max(
    0,
    Math.round(
      (Date.now() - new Date(firma.olusma.replace(" ", "T") + "Z").getTime()) /
        (30 * 86400000),
    ),
  );

  return (
    <>
      {/* Perde bir bağlantı: kapatmak JS istemiyor. */}
      <Link className="perde" href={geriYol} aria-label="Kapat" />

      <aside className="cekmece" role="dialog" aria-label={firma.ad}>
        <div className="c-ust">
          <span className="av kare buyuk">{firma.ad.trim().charAt(0).toUpperCase()}</span>
          <div>
            <h2>{firma.ad}</h2>
            <div className="alt">
              {firma.alan_adi} ·{" "}
              {firma.durum === "deneme"
                ? "deneme sürümü"
                : ayFarki > 0
                  ? `${ayFarki} aydır müşteri`
                  : "bu ay katıldı"}{" "}
              · {firma.kutu} kutu · {firma.kullanici} kişi
            </div>
          </div>
          <Link className="c-kapat" href={geriYol} aria-label="Kapat">
            <Ikon ad="carpi" boyut={16} />
          </Link>
        </div>

        <div className="c-ic">
          <section>
            <h3 className="c-baslik">Sağlık skoru</h3>
            <div className="skor-ust">
              <span className={`skor-buyuk ${skor.skor === null ? "" : skorSinif(skor.skor)}`}>
                {skor.skor === null ? "—" : skor.skor}
              </span>
              <span className="skor-yorum">
                {skor.skor === null
                  ? "Hiçbir bileşen henüz ölçülemiyor."
                  : skorYorum(skor.skor, skor.kapsam)}
              </span>
            </div>

            <div className="kirilim">
              {skor.kirilim.map((k) => (
                <div className="kir" key={k.ad}>
                  <span className="ad">{k.ad}</span>
                  <span className="ray">
                    <i
                      style={{
                        width: k.deger === null ? "0%" : `${k.deger}%`,
                      }}
                    />
                  </span>
                  <span className={k.deger === null ? "puan olcusuz" : "puan"}>
                    {k.deger === null
                      ? `ölçülmüyor / ${k.agirlik}`
                      : `${Math.round((k.deger / 100) * k.agirlik)} / ${k.agirlik}`}
                  </span>
                </div>
              ))}
            </div>
            <p className="dip">
              Ölçülemeyen bileşen <b>sıfır puan sayılmıyor</b>, skordan çıkarılıyor —
              veri yokluğunu kötü performans gibi göstermek yanlış olurdu.
            </p>
          </section>

          <section>
            <h3 className="c-baslik">Aylık mail hacmi</h3>
            {hacim.some((v) => v > 0) ? (
              <div className="hacim-grafik">
                {hacim.map((v, i) => (
                  <div className="hacim-sutun" key={i}>
                    <div
                      className="hacim-cubuk"
                      style={{ height: `${Math.max(2, Math.round((v / enB) * 100))}%` }}
                      title={`${v.toLocaleString("tr-TR")} mail`}
                    />
                    <span className="hacim-et">{AY_KISA[i]}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="dip" style={{ marginTop: 0 }}>
                Bu firmaya henüz mail çekilmemiş.
              </p>
            )}
          </section>

          {/* Depo, taslak adımına hazırlığın tek somut ölçüsü. Kurulum
              görüşmesinde konuşulacak şey: boş depo, model bağlandığı gün
              firmayı tanımayan bir taslak demek. */}
          <section>
            <h3 className="c-baslik">Bilgi deposu</h3>
            <div className="hesap-satir">
              <span className="ad">Karakter</span>
              <span className="aciklayici">
                {bilgi.alan ? "dolu madde" : "hiç yazılmamış"}
              </span>
              <span className={bilgi.alan ? "tut" : "tut olcusuz"}>
                {bilgi.alan || "—"}
              </span>
            </div>
            <div className="hesap-satir">
              <span className="ad">Bilgi kartı</span>
              <span className="aciklayici">
                {bilgi.oneri ? `${bilgi.oneri} öneri onay bekliyor` : "onay bekleyen yok"}
              </span>
              <span className={bilgi.kart ? "tut" : "tut olcusuz"}>{bilgi.kart || "—"}</span>
            </div>
            <p className="dip">
              {bilgi.sonCikarim
                ? `Son çıkarım ${bilgi.sonCikarim.slice(0, 10)}. `
                : "Henüz çıkarım çalıştırılmamış. "}
              {bilgi.alan || bilgi.kart
                ? "Taslak adımı bağlandığında model bu depodan okuyacak."
                : "Depo boş; taslak adımı bağlanırsa model firmayı tanımadan yazar."}
            </p>
          </section>

          <section>
            <h3 className="c-baslik">Bu müşteri gerçekten ne kazandırıyor</h3>

            <div className="hesap-satir">
              <span className="ad">Abonelik</span>
              <span className="tut">
                {firma.aylik_kurus ? para(firma.aylik_kurus) : "ücret yazılmadı"}
              </span>
            </div>

            <div className="hesap-satir">
              <span className="ad">Yapay zekâ</span>
              <span className="aciklayici">
                {firma.gelen_ay.toLocaleString("tr-TR")} mail
              </span>
              <span className={aiKurus === null ? "tut olcusuz" : "tut eksi"}>
                {aiKurus === null ? "—" : `−${para(aiKurus)}`}
              </span>
            </div>

            <div className="hesap-satir">
              <span className="ad">Altyapı payı</span>
              <span className="aciklayici">
                {altyapiPay ? "firma başına" : "ALTYAPI_KURUS girilmedi"}
              </span>
              <span className={altyapiPay ? "tut eksi" : "tut olcusuz"}>
                {altyapiPay ? `−${para(altyapiPay)}` : "—"}
              </span>
            </div>

            <div className="hesap-satir">
              <span className="ad">Destek zamanın</span>
              <span className="aciklayici">
                {destekDk === null
                  ? "kayıt yok"
                  : `${(destekDk / 60).toLocaleString("tr-TR", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })} sa × ${para(saatKurus)}`}
              </span>
              <span className={destekKurus === null ? "tut olcusuz" : "tut eksi"}>
                {destekKurus === null ? "—" : `−${para(destekKurus)}`}
              </span>
            </div>

            <div className="hesap-satir sonuc">
              <span className="ad">Net</span>
              <span className={net !== null && net < 0 ? "tut eksi" : "tut"}>
                {net === null ? (
                  <span className="olcusuz">—</span>
                ) : (
                  <>
                    {para(net)}
                    {netY !== null ? ` · %${netY}` : ""}
                  </>
                )}
              </span>
            </div>

            <p className="dip">
              {net === null ? (
                <>
                  Net, giderlerin hepsi ölçülmeden hesaplanmıyor. Eksik gideri sıfır
                  saymak bu müşteriyi olduğundan kârlı gösterirdi.
                </>
              ) : (
                <>
                  Brüt marj senin zamanını bedava sayar; buradaki net saymaz. Fark
                  destek yükünden gelir — büyükse bu müşteri ya üst plana geçmeli ya
                  da destek biçimi değişmeli.
                </>
              )}
            </p>
          </section>

          <section>
            <h3 className="c-baslik">Kısayollar</h3>
            <div className="c-kisayol">
              <Link className="dugme ufak" href={`/operator/saglik?acik=${firma.id}`}>
                Bağlantı sağlığı
              </Link>
              <Link className="dugme ufak" href="/operator/ticketlar">
                Destek talepleri
              </Link>
              <Link className="dugme ufak" href="/operator/abonelikler">
                Abonelik
              </Link>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}

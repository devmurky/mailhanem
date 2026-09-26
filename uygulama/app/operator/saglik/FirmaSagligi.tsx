import Link from "next/link";
import { Ikon } from "../../bilesenler/Ikon";
import { YenidenDene } from "./YenidenDene";

/**
 * Bir firmanın bağlantı sağlığı bloğu.
 *
 * Müşteriler ekranındaki kategori kalıbının aynısı, tek farkla: **sorunu olan
 * firma kapanmıyor.** Bu ekranın varlık sebebi "müşteri aramadan önce görmek";
 * kopuk bir kutuyu bir tık arkasına saklamak ekranı işlevsiz bırakırdı.
 * Sağlıklı firmalar katlanıyor, çünkü onlarda bakılacak bir şey yok.
 */

export type SaglikKutusu = {
  id: number;
  adres: string;
  saglayici: string;
  imap_sunucu: string;
  imap_port: number;
  durum: string;
  son_cekim: string | null;
  gelen_ay: number;
  hata: string | null;
};

export type SaglikFirmasi = {
  id: number;
  ad: string;
  alan_adi: string;
  kutular: SaglikKutusu[];
};

const DURUM_AD: Record<string, { ad: string; sinif: string; nb: string }> = {
  iyi: { ad: "İyi", sinif: "r-bitti", nb: "" },
  yavas: { ad: "Yavaş", sinif: "r-uyari", nb: "uyari" },
  kopuk: { ad: "Kopuk", sinif: "r-kritik", nb: "kopuk" },
  kurulmadi: { ad: "Kurulmadı", sinif: "r-kapali", nb: "sonuk" },
};

/** Dikkat isteyen durumlar: bu firma katlanamaz. */
export function sorunluMu(f: SaglikFirmasi): boolean {
  return f.kutular.some((k) => k.durum === "kopuk" || k.durum === "yavas");
}

function sure(damga: string | null): string {
  if (!damga) return "henüz çekim yok";
  const fark = Date.now() - new Date(damga.replace(" ", "T") + "Z").getTime();
  const dk = Math.round(fark / 60000);
  if (dk < 60) return `${dk} dk önce`;
  const sa = Math.round(dk / 60);
  if (sa < 48) return `${sa} sa önce`;
  return `${Math.round(sa / 24)} gün önce`;
}

export function FirmaSagligi({
  firma,
  acik,
  sorunlu,
}: {
  firma: SaglikFirmasi;
  acik: boolean;
  sorunlu: boolean;
}) {
  const kopuk = firma.kutular.filter((k) => k.durum === "kopuk").length;
  const yavas = firma.kutular.filter((k) => k.durum === "yavas").length;
  const kurulmadi = firma.kutular.filter((k) => k.durum === "kurulmadi").length;

  const govde = (
    <div className="firma-ic">
      <div className="kutu-listesi">
        {firma.kutular.map((k) => {
          const d = DURUM_AD[k.durum] ?? DURUM_AD.kurulmadi!;
          return (
            <div className={`kutu-satiri sag-${k.durum}`} key={k.id}>
              <span className={`nb ${d.nb}`} />
              <span className="kutu-adres">{k.adres}</span>
              <span className={`rozet ${d.sinif}`}>{d.ad}</span>
              <span className="kutu-saglayici">{k.saglayici || "sağlayıcı yazılmamış"}</span>
              <span className="kutu-sunucu sayi-h">
                {k.imap_sunucu ? `${k.imap_sunucu}:${k.imap_port}` : "sunucu yazılmadı"}
              </span>
              <span className="kutu-sayi sayi-h">
                {k.gelen_ay.toLocaleString("tr-TR")} mail/ay
              </span>
              <span className="kutu-cekim">{sure(k.son_cekim)}</span>
              {/* Madde 7 — sorunu gördüğün yerde çöz. */}
              {k.durum === "kopuk" || k.durum === "yavas" ? (
                <YenidenDene kutuId={k.id} adres={k.adres} />
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Son çekimde hata varsa sebebini yaz: "kopuk" tek başına ne yapılacağını
          söylemiyor, kimlik hatası ile ağ hatası ayrı işler. */}
      {firma.kutular.some((k) => k.hata) ? (
        <div className="sag-hatalar">
          {firma.kutular
            .filter((k) => k.hata)
            .map((k) => (
              <p key={k.id}>
                <Ikon ad="uyari" boyut={13} />
                <span>
                  <b>{k.adres}</b> — {k.hata}
                </span>
              </p>
            ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className={`firma-kat${acik || sorunlu ? " acik" : ""}${sorunlu ? " sorunlu" : ""}`}>
      {sorunlu ? (
        /* Katlanamaz: başlık bağlantı değil, düz satır. */
        <div className="firma-basi sabit">
          <span className="firma-ok uyari">
            <Ikon ad="uyari" boyut={14} />
          </span>
          <span className="av kare">{firma.ad.trim().charAt(0).toUpperCase()}</span>
          <span className="firma-ad">
            <b>{firma.ad}</b>
            <small>{firma.alan_adi}</small>
          </span>
          {kopuk ? <span className="rozet r-kritik">{kopuk} kopuk</span> : null}
          {yavas ? <span className="rozet r-uyari">{yavas} yavaş</span> : null}
          <span className="firma-sayilar sayi-h">{firma.kutular.length} kutu</span>
        </div>
      ) : (
        <Link
          className="firma-basi"
          href={acik ? "/operator/saglik" : `/operator/saglik?acik=${firma.id}`}
          aria-expanded={acik}
        >
          <span className="firma-ok">
            <Ikon ad="sagok" boyut={14} />
          </span>
          <span className="av kare">{firma.ad.trim().charAt(0).toUpperCase()}</span>
          <span className="firma-ad">
            <b>{firma.ad}</b>
            <small>{firma.alan_adi}</small>
          </span>
          {kurulmadi ? (
            <span className="rozet r-kapali">{kurulmadi} kurulmadı</span>
          ) : (
            <span className="rozet r-bitti">hepsi iyi</span>
          )}
          <span className="firma-sayilar sayi-h">{firma.kutular.length} kutu</span>
        </Link>
      )}

      {acik || sorunlu ? govde : null}
    </div>
  );
}

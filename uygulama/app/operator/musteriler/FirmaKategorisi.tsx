import Link from "next/link";
import { Ikon } from "../../bilesenler/Ikon";

/**
 * Bir firma kategorisi: kapalıyken tek satır, açıkken kutuları ve ekibi.
 *
 * Açma/kapama `Link` ile yapılıyor, `<details>` ya da state ile değil —
 * böylece hangi firmanın açık olduğu adreste duruyor, sunucu yalnız o
 * firmanın ayrıntısını sorguluyor ve JS kapalıyken de çalışıyor.
 */

export type FirmaKutusu = {
  id: number;
  adres: string;
  saglayici: string;
  imap_sunucu: string;
  durum: string;
  son_cekim: string | null;
  gelen: number;
  elenen: number;
};

export type FirmaKisi = {
  id: number;
  ad: string;
  eposta: string;
  rol: string;
  durum: string;
  son_giris: string | null;
};

type Firma = {
  id: number;
  ad: string;
  alan_adi: string;
  plan: string;
  durum: string;
  kutu: number;
  kisi: number;
  kopuk: number;
  gelen_ay: number;
  acik_ticket: number;
};

const PLAN_AD: Record<string, string> = {
  baslangic: "Başlangıç",
  pro: "Pro",
  kurumsal: "Kurumsal",
  deneme: "Deneme",
};

const FIRMA_DURUM: Record<string, { ad: string; sinif: string }> = {
  deneme: { ad: "Deneme", sinif: "r-uyari" },
  etkin: { ad: "Etkin", sinif: "r-bitti" },
  duraklatildi: { ad: "Duraklatıldı", sinif: "r-kapali" },
  ayrildi: { ad: "Ayrıldı", sinif: "r-kapali" },
};

const KUTU_DURUM: Record<string, string> = {
  iyi: "",
  yavas: "uyari",
  kopuk: "kopuk",
  kurulmadi: "sonuk",
};

const ROL_AD: Record<string, string> = {
  sahip: "Sahip",
  yonetici: "Yönetici",
  personel: "Personel",
};

function sure(damga: string | null): string {
  if (!damga) return "hiç";
  const fark = Date.now() - new Date(damga.replace(" ", "T") + "Z").getTime();
  const dk = Math.round(fark / 60000);
  if (dk < 60) return `${dk} dk önce`;
  const sa = Math.round(dk / 60);
  if (sa < 48) return `${sa} sa önce`;
  return `${Math.round(sa / 24)} gün önce`;
}

export function FirmaKategorisi({
  firma,
  acik,
  kutular,
  kisiler,
}: {
  firma: Firma;
  acik: boolean;
  kutular: FirmaKutusu[];
  kisiler: FirmaKisi[];
}) {
  const d = FIRMA_DURUM[firma.durum] ?? { ad: firma.durum, sinif: "r-kapali" };

  return (
    <div className={acik ? "firma-kat acik" : "firma-kat"}>
      <Link
        className="firma-basi"
        href={acik ? "/operator/musteriler" : `/operator/musteriler?acik=${firma.id}`}
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

        <span className="rozet r-bilgi">{PLAN_AD[firma.plan] ?? firma.plan}</span>
        <span className={`rozet ${d.sinif}`}>{d.ad}</span>

        {firma.kopuk ? (
          <span className="rozet r-kritik">{firma.kopuk} kopuk kutu</span>
        ) : null}
        {firma.acik_ticket ? (
          <span className="rozet r-uyari">{firma.acik_ticket} açık talep</span>
        ) : null}

        <span className="firma-sayilar sayi-h">
          {firma.kutu} kutu · {firma.kisi} kişi · {firma.gelen_ay.toLocaleString("tr-TR")} mail/ay
        </span>
      </Link>

      {/* Madde 8 — satırın kendisi kategoriyi açıyor, bu bağlantı çekmeceyi.
          İkisini tek tıklamaya bindirmek, kutulara bakmak isteyene her
          seferinde paneli açardı. */}
      <Link
        className="firma-detay"
        href={`/operator/musteriler?${acik ? `acik=${firma.id}&` : ""}cekmece=${firma.id}`}
      >
        Detay
      </Link>

      {acik ? (
        <div className="firma-ic">
          <div className="firma-bolum">
            <h3>
              Bağlı hesaplar
              <span className="sayi">{kutular.length}</span>
            </h3>
            {kutular.length ? (
              <div className="kutu-listesi">
                {kutular.map((k) => (
                  <div className="kutu-satiri" key={k.id}>
                    <span className={`nb ${KUTU_DURUM[k.durum] ?? "sonuk"}`} />
                    <span className="kutu-adres">{k.adres}</span>
                    <span className="kutu-saglayici">{k.saglayici || "sağlayıcı yazılmamış"}</span>
                    <span className="kutu-sunucu sayi-h">{k.imap_sunucu || "—"}</span>
                    <span className="kutu-sayi sayi-h">
                      {k.gelen.toLocaleString("tr-TR")} gelen · {k.elenen.toLocaleString("tr-TR")} elenen
                    </span>
                    <span className="kutu-cekim">{sure(k.son_cekim)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="firma-bos">Bu firmaya henüz kutu bağlanmamış.</p>
            )}
          </div>

          <div className="firma-bolum">
            <h3>
              Ekip
              <span className="sayi">{kisiler.length}</span>
            </h3>
            {kisiler.length ? (
              <div className="kutu-listesi">
                {kisiler.map((u) => (
                  <div className={u.durum === "etkin" ? "kisi-satiri" : "kisi-satiri kapali"} key={u.id}>
                    <span className="av kucuk">
                      {(u.ad || u.eposta).trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="kisi-ad">
                      <b>{u.ad || "adsız"}</b>
                      <small>{u.eposta}</small>
                    </span>
                    <span className="rozet r-kapali">{ROL_AD[u.rol] ?? u.rol}</span>
                    {u.durum !== "etkin" ? (
                      <span className="rozet r-kapali">kapalı</span>
                    ) : null}
                    <span className="kisi-giris">{sure(u.son_giris)} girdi</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="firma-bos">Bu firmada etkin kullanıcı yok.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

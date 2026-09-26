import {
  aiMaliyet,
  bilgiOzeti,
  destekDakika,
  firmaHacimSerisi,
  saglikSkoru,
  sorgu,
  tek,
} from "@/sunucu/db";
import { Ikon } from "../../bilesenler/Ikon";
import { FirmaKategorisi, type FirmaKutusu, type FirmaKisi } from "./FirmaKategorisi";
import { FirmaCekmecesi, type CekmeceFirma } from "./FirmaCekmecesi";

/** Operatörün kendi saatinin karşılığı (kuruş) — diğer ekranlarla aynı. */
const SAAT_KURUS = 75_000;

/**
 * Müşteriler — her firma bir **kategori**, açılınca içine bakılıyor.
 *
 * Kullanıcının isteği: *"her yeni firma operatör panelde kategori olsun, o
 * firmanın bağlı hesapları o firmayı genişlettiğimde ekrana gelsin, böylece
 * karmaşıklığı önleriz."*
 *
 * Kapalı hâlde ekranda yalnız firma satırları var; yirmi firmada bile liste
 * bir ekrana sığıyor. Bir firmanın kutularını, ekibini ve bağlantı durumunu
 * görmek için o satır açılıyor. Önceki hâlde her firma tek satırdı ve
 * "hangi kutu kopuk" sorusunun cevabı başka ekrandaydı.
 *
 * Açık/kapalı durumu adreste (`?acik=`) duruyor: yenilenince kaybolmuyor,
 * paylaşılabiliyor ve JS olmadan da çalışıyor.
 */
export const dynamic = "force-dynamic";

type Satir = {
  id: number;
  ad: string;
  alan_adi: string;
  plan: string;
  durum: string;
  olusma: string;
  kutu: number;
  kisi: number;
  kopuk: number;
  gelen_ay: number;
  acik_ticket: number;
};

export default async function Musteriler({
  searchParams,
}: {
  searchParams: Promise<{ acik?: string; cekmece?: string }>;
}) {
  const { acik, cekmece } = await searchParams;
  const acikId = acik ? Number(acik) : null;
  const cekmeceId = cekmece ? Number(cekmece) : null;

  const firmalar = sorgu<Satir>(`
    SELECT f.*,
      (SELECT COUNT(*) FROM kutular k WHERE k.firma_id = f.id)                      AS kutu,
      (SELECT COUNT(*) FROM kullanicilar u
        WHERE u.firma_id = f.id AND u.durum = 'etkin')                              AS kisi,
      (SELECT COUNT(*) FROM kutular k
        WHERE k.firma_id = f.id AND k.durum = 'kopuk')                              AS kopuk,
      (SELECT COUNT(*) FROM mailler m
        WHERE m.firma_id = f.id AND m.elendi IS NULL
          AND m.olusma >= datetime('now', '-30 days'))                              AS gelen_ay,
      (SELECT COUNT(*) FROM ticketlar t
        WHERE t.firma_id = f.id AND t.durum NOT IN ('kapandi','cozuldu'))           AS acik_ticket
    FROM firmalar f ORDER BY f.ad COLLATE NOCASE`);

  /* Yalnız açılan firmanın ayrıntısı çekiliyor: kapalı satırlar için kutu ve
     kişi listesi sorgulamak, yirmi firmada yirmi gereksiz sorgu demek. */
  const kutular = acikId
    ? sorgu<FirmaKutusu>(
        `SELECT id, adres, saglayici, imap_sunucu, durum, son_cekim,
                (SELECT COUNT(*) FROM mailler m WHERE m.kutu_id = kutular.id
                  AND m.elendi IS NULL)                                   AS gelen,
                (SELECT COUNT(*) FROM mailler m WHERE m.kutu_id = kutular.id
                  AND m.elendi IS NOT NULL)                               AS elenen
         FROM kutular WHERE firma_id = ? ORDER BY adres COLLATE NOCASE`,
        acikId,
      )
    : [];

  const kisiler = acikId
    ? sorgu<FirmaKisi>(
        `SELECT id, ad, eposta, rol, durum, son_giris
         FROM kullanicilar WHERE firma_id = ?
         ORDER BY CASE rol WHEN 'sahip' THEN 0 WHEN 'yonetici' THEN 1 ELSE 2 END,
                  ad COLLATE NOCASE`,
        acikId,
      )
    : [];

  /* Çekmece verisi yalnız açıkken çekiliyor. */
  const cekmeceFirma = cekmeceId
    ? tek<CekmeceFirma>(
        `SELECT f.*,
           (SELECT COUNT(*) FROM kutular k WHERE k.firma_id = f.id)            AS kutu,
           (SELECT COUNT(*) FROM kullanicilar u
             WHERE u.firma_id = f.id AND u.durum = 'etkin')                    AS kullanici,
           (SELECT COUNT(*) FROM mailler m WHERE m.firma_id = f.id
             AND m.elendi IS NULL AND m.olusma >= datetime('now','-30 days'))  AS gelen_ay,
           (SELECT COUNT(*) FROM mailler m WHERE m.firma_id = f.id
             AND m.elendi IS NOT NULL AND m.olusma >= datetime('now','-30 days')) AS elenen_ay,
           (SELECT COUNT(*) FROM mailler m WHERE m.firma_id = f.id
             AND m.elendi IS NULL)                                             AS gelen_toplam
         FROM firmalar f WHERE f.id = ?`,
        cekmeceId,
      )
    : undefined;

  /* Altyapı payı firma başına bölünüyor: tek bir sunucu bütün müşterilere
     hizmet ediyor, maliyeti birine yazmak yanıltırdı. */
  const firmaAdedi = firmalar.length || 1;
  const altyapiToplam = Number(process.env.ALTYAPI_KURUS ?? "0") || 0;

  /* Çekmecenin döneceği adres: açık kategori korunuyor. */
  const geriYol = acikId ? `/operator/musteriler?acik=${acikId}` : "/operator/musteriler";

  return (
    <div className="sayfa">
      <div className="sayfa-ust">
        <div>
          <h1>Müşteriler</h1>
          <p>Her firma bir kategori. Satırı açınca o firmanın kutuları ve ekibi gelir.</p>
        </div>
      </div>

      {firmalar.length ? (
        <div className="firma-yigin">
          {firmalar.map((f) => (
            <FirmaKategorisi
              key={f.id}
              firma={f}
              acik={acikId === f.id}
              kutular={acikId === f.id ? kutular : []}
              kisiler={acikId === f.id ? kisiler : []}
            />
          ))}
        </div>
      ) : (
        <div className="talep-bos">
          <Ikon ad="bina" boyut={22} />
          <b>Henüz müşteri yok</b>
          <span>Bir demo talebi görüşmeye dönüp kurulum yapıldığında burada belirir.</span>
        </div>
      )}

      {cekmeceFirma ? (
        <FirmaCekmecesi
          firma={cekmeceFirma}
          skor={saglikSkoru(cekmeceFirma.id)}
          hacim={firmaHacimSerisi(cekmeceFirma.id)}
          bilgi={bilgiOzeti(cekmeceFirma.id)}
          aiKurus={aiMaliyet(cekmeceFirma.id)}
          destekDk={destekDakika(cekmeceFirma.id)}
          altyapiPay={altyapiToplam ? Math.round(altyapiToplam / firmaAdedi) : 0}
          saatKurus={SAAT_KURUS}
          geriYol={geriYol}
        />
      ) : null}
    </div>
  );
}

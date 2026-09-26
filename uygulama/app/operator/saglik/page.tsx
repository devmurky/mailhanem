import { sorgu } from "@/sunucu/db";
import { anahtarVarMi } from "@/sunucu/kasa";
import { durum as zamanlayiciDurumu } from "@/sunucu/zamanlayici";
import { Ikon } from "../../bilesenler/Ikon";
import { KutuBagla } from "./KutuBagla";
import { FirmaSagligi, sorunluMu, type SaglikFirmasi, type SaglikKutusu } from "./FirmaSagligi";

/**
 * Bağlantı Sağlığı — kutular **firmaya göre** gruplu.
 *
 * Kullanıcının isteği: müşteriler ekranındaki gibi kategorize etmek. Aynı
 * kalıp, tek farkla: sorunu olan firma katlanamıyor. Bu ekranın işi "müşteri
 * aramadan önce görmek"; kopuk bir kutuyu bir tık arkasına saklamak onu
 * işlevsiz bırakırdı.
 *
 * Sıralama da ona göre: önce sorunlu firmalar.
 */
export const dynamic = "force-dynamic";

const DURUM_AD: Record<string, { ad: string; sinif: string; nb: string }> = {
  iyi: { ad: "İyi", sinif: "r-bitti", nb: "" },
  yavas: { ad: "Yavaş", sinif: "r-uyari", nb: "uyari" },
  kopuk: { ad: "Kopuk", sinif: "r-kritik", nb: "kopuk" },
  kurulmadi: { ad: "Kurulmadı", sinif: "r-kapali", nb: "sonuk" },
};

type Kutu = {
  id: number;
  adres: string;
  saglayici: string;
  imap_sunucu: string;
  imap_port: number;
  durum: string;
  son_cekim: string | null;
  firma: string;
  firma_id: number;
  alan_adi: string;
  gelen_ay: number;
  hata: string | null;
};

export default async function Saglik({
  searchParams,
}: {
  searchParams: Promise<{ acik?: string }>;
}) {
  const { acik } = await searchParams;
  const acikId = acik ? Number(acik) : null;

  const kutular = sorgu<Kutu>(`
    SELECT k.*, f.ad AS firma, f.id AS firma_id, f.alan_adi,
      (SELECT COUNT(*) FROM mailler m WHERE m.kutu_id = k.id AND m.elendi IS NULL
        AND m.olusma >= datetime('now', '-30 days'))                       AS gelen_ay,
      (SELECT c.hata FROM cekimler c WHERE c.kutu_id = k.id
        ORDER BY c.baslangic DESC LIMIT 1)                                 AS hata
    FROM kutular k JOIN firmalar f ON f.id = k.firma_id
    ORDER BY f.ad COLLATE NOCASE,
             CASE k.durum WHEN 'kopuk' THEN 0 WHEN 'yavas' THEN 1
                          WHEN 'kurulmadi' THEN 2 ELSE 3 END,
             k.adres COLLATE NOCASE`);

  /* Firmaya göre grupla, sorunlular öne. */
  const harita = new Map<number, SaglikFirmasi>();
  for (const k of kutular) {
    let f = harita.get(k.firma_id);
    if (!f) {
      f = { id: k.firma_id, ad: k.firma, alan_adi: k.alan_adi, kutular: [] };
      harita.set(k.firma_id, f);
    }
    f.kutular.push(k as unknown as SaglikKutusu);
  }
  const gruplar = [...harita.values()].sort((a, b) => {
    const fark = Number(sorunluMu(b)) - Number(sorunluMu(a));
    return fark !== 0 ? fark : a.ad.localeCompare(b.ad, "tr");
  });

  const say = (d: string) => kutular.filter((k) => k.durum === d).length;
  const firmalar = sorgu<{ id: number; ad: string }>(
    "SELECT id, ad FROM firmalar ORDER BY ad COLLATE NOCASE",
  );
  const anahtar = anahtarVarMi();
  const zaman = zamanlayiciDurumu();

  return (
    <div className="sayfa">
      <div className="sayfa-ust">
        <div>
          <h1>Bağlantı Sağlığı</h1>
          <p>Müşteri seni aramadan önce görmen gereken ekran.</p>
        </div>
        {anahtar ? <KutuBagla firmalar={firmalar} /> : null}
      </div>

      {!anahtar ? (
        <div className="kutu-uyari" style={{ marginTop: 0, marginBottom: 22 }}>
          <span className="ikn">
            <Ikon ad="kilit" boyut={16} />
          </span>
          <span>
            <b>MAILHANE_ANAHTAR tanımlı değil.</b> Kutu parolaları şifrelenemeyeceği için
            yeni kutu bağlama kapalı. Anahtarı üretmek için:{" "}
            <code>
              node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;base64&apos;))&quot;
            </code>
          </span>
        </div>
      ) : null}

      <dl className="kartlar">
        <div className="skart">
          <dt>İzlenen kutu</dt>
          <div className="deger">
            <dd>{kutular.length}</dd>
          </div>
          <div className="not">{new Set(kutular.map((k) => k.firma)).size} firma</div>
        </div>
        <div className="skart">
          <dt>Kopuk</dt>
          <div className="deger">
            <dd style={say("kopuk") ? { color: "var(--kritik)" } : undefined}>{say("kopuk")}</dd>
          </div>
          <div className="not">mail hiç çekilmiyor</div>
        </div>
        <div className="skart">
          <dt>Yavaş senkron</dt>
          <div className="deger">
            <dd style={say("yavas") ? { color: "var(--uyari)" } : undefined}>{say("yavas")}</dd>
          </div>
          <div className="not">gecikmeli çekiliyor</div>
        </div>
        <div className="skart">
          <dt>Kurulmadı</dt>
          <div className="deger">
            <dd>{say("kurulmadi")}</dd>
          </div>
          <div className="not">IMAP bilgisi girilmedi</div>
        </div>
      </dl>

      <h2 className="bolum">
        Firmalar
        <span className="sayi">{gruplar.length}</span>
        <span className="aciklayici">sorunlu olanlar üstte ve açık</span>
      </h2>

      {gruplar.length ? (
        <div className="firma-yigin">
          {gruplar.map((f) => (
            <FirmaSagligi
              key={f.id}
              firma={f}
              acik={acikId === f.id}
              sorunlu={sorunluMu(f)}
            />
          ))}
        </div>
      ) : (
        <div className="talep-bos">
          <Ikon ad="nabiz" boyut={22} />
          <b>İzlenen kutu yok</b>
          <span>Kurulumda bir kutu bağlandığında burada görünür.</span>
        </div>
      )}

      <div className="kutu-bilgi">
        <span className="ikn">
          <Ikon ad="bilgi" boyut={16} />
        </span>
        <span>
          {zaman.acik ? (
            <>
              <b>Çekim {zaman.aralik} dakikada bir çalışıyor.</b> Aralık{" "}
              <a href="/operator/posta">Posta Akışı</a> ekranından değişir; oradaki
              &quot;Çekimi çalıştır&quot; düğmesi sıradaki turu beklemeden bir tur başlatır.
            </>
          ) : (
            <>
              <b>Zamanlayıcı kapalı.</b> Kutular kendiliğinden taranmıyor;{" "}
              <a href="/operator/posta">Posta Akışı</a> ekranından bir aralık seçin ya da
              &quot;Çekimi çalıştır&quot; ile elle tur başlatın.
            </>
          )}
        </span>
      </div>
    </div>
  );
}

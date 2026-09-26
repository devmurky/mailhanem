import { Ikon } from "../../bilesenler/Ikon";

/**
 * Bağlı dış servisler — prototipteki `sistemHTML()`in entegrasyon kartları.
 *
 * ── Ekranın tek kuralı ────────────────────────────────────
 * Burada **anahtar değeri gösterilmiyor ve kabul edilmiyor.** Görünen tek şey
 * anahtarın var olup olmadığı ve o servisin bugün ne yaptığı. Değerler
 * sunucudaki ortam değişkenlerinde duruyor; tarayıcıya gönderilmiyor,
 * veritabanına yazılmıyor, günlüğe düşmüyor.
 *
 * Bu yüzden sunucu bileşeni: `process.env`e bakıp **yalnızca boolean** döküyor.
 * Anahtarın kendisi hiçbir zaman istemciye geçmiyor.
 */

export type Entegrasyon = {
  ad: string;
  ne: string;
  ikon: string;
  env: string;
  /** Anahtar tanımlı mı — değeri değil, varlığı. */
  bagli: boolean;
  /** Bağlı değilken neyin çalışmadığını söyleyen cümle. */
  not: string;
  olcum: [string, string][];
};

export function Entegrasyonlar({ liste }: { liste: Entegrasyon[] }) {
  return (
    <>
      {liste.map((e) => (
        <div className={e.bagli ? "ent" : "ent uyari"} key={e.ad}>
          <div className="ent-ust">
            <span className="ent-ikon">
              <Ikon ad={e.ikon} boyut={16} />
            </span>
            <span className="ent-bilgi">
              <span className="ent-ad">{e.ad}</span>
              <span className="ent-ne">{e.ne}</span>
            </span>
            <span className="ent-env">{e.env}</span>
            <span className={e.bagli ? "ent-durum" : "ent-durum uyari"}>
              <i />
              {e.bagli ? "Bağlı" : "Tanımlı değil"}
            </span>
          </div>

          {!e.bagli && e.not ? <div className="ent-not">{e.not}</div> : null}

          <dl className="ent-olcum">
            {e.olcum.map(([ad, deger]) => (
              <div key={ad}>
                <dt>{ad}</dt>
                <dd>{deger}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </>
  );
}

/**
 * Durum halkası.
 *
 * Prototipteki "onay durumu" halkasının yerinde duruyor ama başka bir şeyi
 * gösteriyor: orada yapay zekâ taslaklarının onay durumu vardı, burada
 * **mailin ekipteki durumu** var. Sebebi basit — taslak diye bir kayıt henüz
 * yok, olmayan şeyin grafiği çizilmez. Bu halka ekip çalıştıkça doluyor.
 *
 * Sunucuda çiziliyor: JavaScript gerekmiyor, grafik kütüphanesi de.
 */
export type Dilim = { ad: string; adet: number; renk: string };

export function Halka({ dilimler, toplam, altYazi }: {
  dilimler: Dilim[];
  toplam: number;
  altYazi: string;
}) {
  const r = 58;
  const cevre = 2 * Math.PI * r;
  const bosluk = 3;

  let ofset = 0;
  const yaylar = dilimler
    .filter((d) => d.adet > 0)
    .map((d) => {
      const pay = d.adet / toplam;
      /* Tek dilim kalınca boşluk bırakmak halkayı kırık gösteriyor. */
      const uzunluk = Math.max(pay * cevre - (dilimler.filter((x) => x.adet > 0).length > 1 ? bosluk : 0), 1);
      const yay = (
        <circle
          key={d.ad}
          cx="73"
          cy="73"
          r={r}
          fill="none"
          stroke={d.renk}
          strokeWidth="15"
          strokeLinecap="round"
          strokeDasharray={`${uzunluk.toFixed(1)} ${(cevre - uzunluk).toFixed(1)}`}
          strokeDashoffset={(-ofset).toFixed(1)}
        />
      );
      ofset += pay * cevre;
      return yay;
    });

  return (
    <div className="halka-alan">
      <div className="halka">
        <svg width="146" height="146" viewBox="0 0 146 146" aria-hidden="true">
          <circle cx="73" cy="73" r={r} fill="none" stroke="var(--ak2)" strokeWidth="15" />
          {yaylar}
        </svg>
        <div className="halka-orta">
          <div>
            <b>{toplam}</b>
            <small>{altYazi}</small>
          </div>
        </div>
      </div>

      <dl className="aciklama">
        {dilimler.map((d) => (
          <div className="acik-satir" key={d.ad}>
            <span className="nokta" style={{ background: d.renk }} />
            <dt className="ad">{d.ad}</dt>
            <dd className="deg">
              {d.adet}
              {toplam ? ` · %${Math.round((d.adet / toplam) * 100)}` : ""}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

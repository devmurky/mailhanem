"use client";

import { useState, useTransition } from "react";
import { Ikon } from "../../bilesenler/Ikon";
import { zamanlayiciAraligi } from "./eylemler";

/**
 * Otomatik çekim aralığı. Seçim anında kaydedilir; ayrı bir "kaydet"
 * düğmesi yok çünkü kaydedilecek tek bir değer var.
 */
export function Zamanlayici({
  aralik,
  secenekler,
  sonCalisma,
  sonSonuc,
  siradaki,
}: {
  aralik: number;
  secenekler: { deger: number; ad: string }[];
  sonCalisma: string;
  sonSonuc: string;
  siradaki: string;
}) {
  const [bekliyor, basla] = useTransition();
  const [hata, setHata] = useState("");

  return (
    <div className="zaman-kart">
      <div className="zaman-ust">
        <span className={aralik > 0 ? "nb" : "nb sonuk"} />
        <b>Otomatik çekim</b>
        <select
          value={String(aralik)}
          disabled={bekliyor}
          aria-label="Çekim aralığı"
          onChange={(e) => {
            const yeni = Number(e.target.value);
            setHata("");
            basla(async () => {
              try {
                await zamanlayiciAraligi(yeni);
              } catch (err) {
                setHata(err instanceof Error ? err.message : "Aralık kaydedilemedi.");
              }
            });
          }}
        >
          {secenekler.map((s) => (
            <option key={s.deger} value={s.deger}>
              {s.ad}
            </option>
          ))}
        </select>
      </div>

      <dl className="zaman-sayilar">
        <div>
          <dt>Son tur</dt>
          <dd>{sonCalisma ? sonCalisma.slice(0, 16) : "henüz çalışmadı"}</dd>
        </div>
        <div>
          <dt>Sıradaki</dt>
          <dd>{aralik > 0 ? (siradaki ? siradaki.slice(0, 16) : "birazdan") : "—"}</dd>
        </div>
        <div className="genis">
          <dt>Son sonuç</dt>
          <dd>{sonSonuc || "—"}</dd>
        </div>
      </dl>

      {hata ? (
        <p className="cekim-hata">
          <Ikon ad="uyari" boyut={15} />
          <span>{hata}</span>
        </p>
      ) : null}

      <p className="zaman-not">
        Zamanlayıcı sunucuyla birlikte çalışır; uygulama kapalıyken çekim olmaz.
        Aralık dolduğunda tur kendiliğinden başlar, yukarıdaki düğme onu beklemeden
        çalıştırır.
      </p>
    </div>
  );
}

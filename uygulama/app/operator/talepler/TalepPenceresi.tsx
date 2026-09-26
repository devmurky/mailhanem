"use client";

import { useEffect, useRef } from "react";
import type { Talep, TalepDurum } from "@/sunucu/db";
import { Ikon } from "../../bilesenler/Ikon";

/**
 * Demo talebinin açılır penceresi.
 *
 * Kullanıcının isteği: *"pop up şeklinde tıklayayım, bilgiler ekrana gelsin,
 * ben ona göre cep veya mailden dönüş sağlayayım."* Yani bu pencere bir form
 * değil, **dönüş yapmadan önce bakılacak kart**: siteden gelen yedi alanın
 * tamamı okunur hâlde ve iki dönüş yolu (telefon, mail) bir tık uzakta.
 *
 * Satır listesi kısa kalıyor, ayrıntı buraya iniyor — kuyruk taranabilir
 * kalsın diye.
 *
 * Klavye: Escape kapatır, açılışta odak pencereye girer, perdeye tıklamak
 * kapatır. Pencere açıkken arkadaki sayfa kaymaz.
 */
export function TalepPenceresi({
  talep,
  kapat,
  isaretle,
  mailBaglantisi,
  bekliyor,
}: {
  talep: Talep;
  kapat: () => void;
  isaretle: (durum: TalepDurum) => void;
  mailBaglantisi: (t: Talep) => string;
  bekliyor: boolean;
}) {
  const kutu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const oncekiOdak = document.activeElement as HTMLElement | null;
    kutu.current?.focus();

    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") kapat();
    };
    document.addEventListener("keydown", tus);

    /* Pencere açıkken arkadaki sayfanın kaymaması: yoksa perdeye rağmen
       tekerlek listeyi kaydırıyor ve pencere yerinde duruyormuş gibi olmuyor. */
    const eskiTasma = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", tus);
      document.body.style.overflow = eskiTasma;
      oncekiOdak?.focus?.();
    };
  }, [kapat]);

  const tarih = new Date(talep.olusma.replace(" ", "T") + "Z").toLocaleString("tr-TR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const telUrl = talep.telefon ? `tel:${talep.telefon.replace(/[^\d+]/g, "")}` : null;

  return (
    <div
      className="modal-perde"
      onClick={(e) => {
        if (e.target === e.currentTarget) kapat();
      }}
    >
      <div
        className="modal talep-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`talep-baslik-${talep.id}`}
        tabIndex={-1}
        ref={kutu}
      >
        <div className="modal-ust">
          <span className="av kare">{talep.firma.trim().charAt(0).toUpperCase()}</span>
          <div>
            <h2 id={`talep-baslik-${talep.id}`}>{talep.firma}</h2>
            <p>
              {talep.ad} · {tarih}
            </p>
          </div>
          <button className="modal-kapat" type="button" onClick={kapat} aria-label="Kapat">
            <Ikon ad="carpi" boyut={16} />
          </button>
        </div>

        {/* Dönüş yolları en üstte: pencerenin varlık sebebi bu. */}
        <div className="donus-yollari">
          <a className="dugme ana" href={mailBaglantisi(talep)} onClick={() => isaretle("yazildi")}>
            <Ikon ad="zarf" boyut={15} />
            Mail ile dön
          </a>
          {telUrl ? (
            <a className="dugme" href={telUrl}>
              <Ikon ad="saat" boyut={15} />
              {talep.telefon}
            </a>
          ) : (
            <span className="telefon-yok">Telefon bırakmamış</span>
          )}
        </div>

        {/* Siteden gelen yedi alan, formdaki sırayla. */}
        <dl className="talep-alanlar">
          <div>
            <dt>Ad</dt>
            <dd>{talep.ad}</dd>
          </div>
          <div>
            <dt>Firma</dt>
            <dd>{talep.firma}</dd>
          </div>
          <div>
            <dt>E-posta</dt>
            <dd>
              <a href={`mailto:${talep.eposta}`}>{talep.eposta}</a>
            </dd>
          </div>
          <div>
            <dt>Telefon</dt>
            <dd>{talep.telefon ? <span className="sayi-h">{talep.telefon}</span> : <i>yok</i>}</dd>
          </div>
          <div>
            <dt>Posta sağlayıcısı</dt>
            <dd>{talep.saglayici || <i>belirtmemiş</i>}</dd>
          </div>
          <div>
            <dt>Kutuya bakan</dt>
            <dd>{talep.kisi || <i>belirtmemiş</i>}</dd>
          </div>
          <div className="genis">
            <dt>Notu</dt>
            <dd>{talep.aciklama ? talep.aciklama : <i>not bırakmamış</i>}</dd>
          </div>
        </dl>

        <div className="modal-alt">
          <span className="kaynak">
            {talep.kaynak ? `kaynak: ${talep.kaynak}` : "kaynak belirtilmemiş"}
          </span>
          <span className="eylem">
            {talep.durum === "yazildi" ? (
              <button
                className="dugme"
                type="button"
                disabled={bekliyor}
                onClick={() => isaretle("kuruldu")}
              >
                Görüşme kuruldu
              </button>
            ) : null}
            {talep.durum === "kapandi" ? (
              <button
                className="dugme sade"
                type="button"
                disabled={bekliyor}
                onClick={() => isaretle("yeni")}
              >
                Geri aç
              </button>
            ) : (
              <button
                className="dugme sade"
                type="button"
                disabled={bekliyor}
                onClick={() => isaretle("kapandi")}
              >
                Kapat
              </button>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

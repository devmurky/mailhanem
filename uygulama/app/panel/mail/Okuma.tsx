"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Ikon } from "../../bilesenler/Ikon";
import { okunduIsaretle, okunmadiIsaretle } from "../eylemler";

export type OkuyanOge = { kullanici_id: number; ad: string; ilk_okuma: string };

/**
 * Okuma şeridi (madde 6) — iki iş yapıyor: mail açılınca okundu yazmak ve
 * "buna kim baktı" sorusunu cevaplamak.
 *
 * **İşaret neden tarayıcıdan düşüyor?** Sunucuda çizim sırasında yazmak en
 * kısa yoldu ama yanlış: Next bağlantıları önceden getiriyor (prefetch) ve
 * fareyi satırın üstünden geçirmek hiç bakılmamış maili okunmuş yapardı.
 * Burada işaret, bileşen gerçekten ekrana geldiğinde düşüyor.
 *
 * `isaretle` kapalıyken şerit yalnız okuyor: gelen kutusunda kendiliğinden
 * açılan önizleme okundu sayılmıyor — okumak için tıklamak gerekiyor.
 */
export function OkumaSeridi({
  mailId,
  okuyanlar,
  benimId,
  isaretle,
}: {
  mailId: number;
  okuyanlar: OkuyanOge[];
  benimId: number;
  isaretle: boolean;
}) {
  const [bekliyor, basla] = useTransition();
  const [hata, setHata] = useState("");
  const okudum = okuyanlar.some((o) => o.kullanici_id === benimId);

  /* Hangi mail için işaret gönderildiğini tutuyor. İki işi birden görüyor:
     aynı mail için ikinci isteği engelliyor, ve "okunmadı işaretle"den sonra
     şeridin maili anında yeniden okunmuş yapmasını önlüyor — kullanıcı onu
     bilerek kuyruğa geri koydu. */
  const isaretlenen = useRef(0);

  useEffect(() => {
    if (!isaretle || okudum) return;
    if (isaretlenen.current === mailId) return;
    isaretlenen.current = mailId;
    okunduIsaretle(mailId).catch(() => {
      /* Ağ ya da oturum hatası: bir daha denenebilsin diye kilidi bırak.
         Ekrana hata basmıyoruz — kullanıcı okumayı işaretlemeyi istemedi,
         yalnız maili açtı. */
      isaretlenen.current = 0;
    });
  }, [mailId, isaretle, okudum]);

  const geriAl = () => {
    setHata("");
    isaretlenen.current = mailId;
    basla(async () => {
      try {
        await okunmadiIsaretle(mailId);
      } catch (e) {
        setHata(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
      }
    });
  };

  const baskalari = okuyanlar.filter((o) => o.kullanici_id !== benimId);

  return (
    <div className="okuma-serit">
      <Ikon ad="kisiler" boyut={13} />
      {okuyanlar.length ? (
        <span className="ok-kim">
          {baskalari.slice(0, 4).map((o) => (
            <span className="av kucuk" key={o.kullanici_id} title={`${o.ad} · ${o.ilk_okuma.slice(0, 16)}`}>
              {o.ad.trim().charAt(0).toUpperCase()}
            </span>
          ))}
          <span className="ok-metin">
            {baskalari.length
              ? `${baskalari.map((o) => o.ad.split(" ")[0]).join(", ")} baktı`
              : "Yalnız siz baktınız"}
            {okudum && baskalari.length ? " · siz de" : ""}
          </span>
        </span>
      ) : (
        <span className="ok-metin bos">Bu maile henüz kimse bakmadı</span>
      )}

      {okudum ? (
        <button
          className="dugme sade ufak ok-dugme"
          type="button"
          onClick={geriAl}
          disabled={bekliyor}
        >
          {bekliyor ? "…" : "Okunmadı işaretle"}
        </button>
      ) : null}

      {hata ? <span className="ok-hata">{hata}</span> : null}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { ekipDurumu, rolDegistir } from "../eylemler";

/**
 * Rol değişimi. Değiştiren kişi yalnızca sahip olabilir; sunucu da aynı
 * kontrolü yapıyor, buradaki `disabled` sadece nezaket.
 */
export function RolSecici({
  kisiId,
  rol,
  kilitli,
  kilitSebep,
}: {
  kisiId: number;
  rol: string;
  kilitli: boolean;
  kilitSebep: string;
}) {
  const [bekliyor, basla] = useTransition();
  const [hata, setHata] = useState("");

  if (kilitli) {
    return <span className="rol-kilit">{kilitSebep}</span>;
  }

  return (
    <span className="rol-sec">
      <select
        value={rol}
        disabled={bekliyor}
        aria-label="Rol"
        onChange={(e) => {
          const yeni = e.target.value;
          setHata("");
          basla(async () => {
            try {
              await rolDegistir(kisiId, yeni);
            } catch (err) {
              setHata(err instanceof Error ? err.message : "Rol değiştirilemedi.");
            }
          });
        }}
      >
        <option value="yonetici">Yönetici</option>
        <option value="personel">Personel</option>
      </select>
      {hata ? <small className="rol-hata">{hata}</small> : null}
    </span>
  );
}

/**
 * Ekipten çıkarma. Ayrı bir bileşen çünkü rol seçicisinden farklı bir soru:
 * biri "ne yapabilir", öteki "girebilir mi".
 */
export function EkipDurumu({
  kisiId,
  kapali,
  ad,
}: {
  kisiId: number;
  kapali: boolean;
  ad: string;
}) {
  const [bekliyor, basla] = useTransition();
  const [hata, setHata] = useState("");
  const [soruyor, setSoruyor] = useState(false);

  const calistir = (durum: "etkin" | "kapali") => {
    setHata("");
    basla(async () => {
      try {
        await ekipDurumu(kisiId, durum);
        setSoruyor(false);
      } catch (err) {
        setHata(err instanceof Error ? err.message : "İşlem tamamlanamadı.");
      }
    });
  };

  if (kapali) {
    return (
      <span className="rol-sec">
        <button
          className="dugme ufak"
          type="button"
          disabled={bekliyor}
          onClick={() => calistir("etkin")}
        >
          Erişimi geri aç
        </button>
        {hata ? <small className="rol-hata">{hata}</small> : null}
      </span>
    );
  }

  if (soruyor) {
    return (
      <span className="rol-sec">
        <span className="onay-sor">
          <b>{ad} çıkarılsın mı?</b>
          <button
            className="dugme ufak"
            type="button"
            disabled={bekliyor}
            onClick={() => calistir("kapali")}
          >
            Evet, çıkar
          </button>
          <button
            className="dugme sade ufak"
            type="button"
            onClick={() => setSoruyor(false)}
          >
            Vazgeç
          </button>
        </span>
        <small className="rol-hata">{hata || "Açık oturumları hemen düşer."}</small>
      </span>
    );
  }

  return (
    <button
      className="dugme sade ufak"
      type="button"
      title="Ekipten çıkar"
      aria-label={ad + " kişisini ekipten çıkar"}
      onClick={() => setSoruyor(true)}
    >
      Çıkar
    </button>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Ikon } from "../../bilesenler/Ikon";
import { tekKutuyuCek } from "../posta/eylemler";

/**
 * Kopuk kutuyu yerinde yeniden deneme (madde 7).
 *
 * Eskiden bu ekran yalnız haber veriyordu: "kopuk" yazıyor ama düzeltmek için
 * Posta Akışı'na gidip bütün kutuları çekmek gerekiyordu. Çekim işi zaten
 * `tekKutuyuCek` ile tek kutuya inebiliyordu; eksik olan düğmeydi.
 *
 * Sonuç **yazılmıyor** çünkü çekim başarılıysa sayfa yeniden çiziliyor ve
 * satırın kendisi "İyi"ye dönüyor — ayrıca "oldu" demek fazlalık olurdu.
 * Başarısızsa durum "kopuk" kalıyor ve satırın altındaki hata satırı sebebi
 * yazıyor.
 */
export function YenidenDene({ kutuId, adres }: { kutuId: number; adres: string }) {
  const [bekliyor, gecis] = useTransition();
  const [hata, setHata] = useState("");

  return (
    <>
      <button
        className="dugme ufak"
        type="button"
        disabled={bekliyor}
        title={`${adres} için yeniden bağlan`}
        onClick={() => {
          setHata("");
          gecis(async () => {
            try {
              await tekKutuyuCek(kutuId);
            } catch (e) {
              setHata(e instanceof Error ? e.message : "Denenemedi.");
            }
          });
        }}
      >
        <Ikon ad="yenile" boyut={13} />
        {bekliyor ? "Deneniyor…" : "Yeniden dene"}
      </button>
      {hata ? <span className="yd-hata">{hata}</span> : null}
    </>
  );
}

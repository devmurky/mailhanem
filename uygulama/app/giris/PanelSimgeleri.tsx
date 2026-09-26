"use client";

import { useState } from "react";
import { Ikon } from "../bilesenler/Ikon";

/**
 * "Panelde sizi bekleyen" şeridi.
 *
 * Simgeler süs değil, panelin gerçek ekranları — ama tıklayınca o ekrana
 * **gitmiyorlar**: giriş yapmamış birini `/panel`'e yollamak onu buraya geri
 * getirirdi. Onun yerine altındaki satırı değiştiriyorlar; hangi ekranın ne işe
 * yaradığını giriş yapmadan gösteriyor.
 *
 * Metinler uydurulmuş değil: her biri panelde o ekranın yaptığı işi anlatıyor.
 */
const EKRANLAR = [
  {
    anahtar: "kategori",
    ad: "Kategoriler",
    ikon: "liste",
    metin: "Gelen maili kategoriye ve kişiye bağlayan kurallar. İlk eşleşen uygulanır.",
  },
  {
    anahtar: "sahiplenme",
    ad: "Sahiplenme",
    ikon: "kisiler",
    metin: "Her mailin bir sahibi olur; kimin baktığı ve ne kadardır beklediği görünür.",
  },
  {
    anahtar: "kutu",
    ad: "Gelen kutusu",
    ikon: "zarf",
    metin: "Solda liste, sağda mailin tamamı. Bülten ve otomatik yanıtlar buraya hiç girmez.",
  },
  {
    anahtar: "yanit",
    ad: "Yanıt",
    ikon: "kalem",
    metin: "Yanıt kendi kutunuzdan çıkar. Şablonlar tek tıkla eklenir, gönderme kararı sizde.",
  },
  {
    anahtar: "ekip",
    ad: "Ekip",
    ikon: "bina",
    metin: "Kim girebilir, kim ne yapabilir. Ayrılan biri çıkarılır, oturumu anında düşer.",
  },
] as const;

export function PanelSimgeleri() {
  const [secili, setSecili] = useState("kutu");
  const acik = EKRANLAR.find((e) => e.anahtar === secili) ?? EKRANLAR[2];

  return (
    <>
      <div className="simgeler" role="tablist" aria-label="Panel ekranları">
        {EKRANLAR.map((e) => (
          <button
            key={e.anahtar}
            type="button"
            role="tab"
            aria-selected={e.anahtar === secili}
            className={e.anahtar === secili ? "simge etkin" : "simge"}
            title={e.ad}
            onClick={() => setSecili(e.anahtar)}
          >
            <Ikon ad={e.ikon} boyut={18} />
            <span className="gizli">{e.ad}</span>
          </button>
        ))}
      </div>

      <span className="simge-et">{acik.ad}</span>
      <p className="simge-metin">{acik.metin}</p>
    </>
  );
}

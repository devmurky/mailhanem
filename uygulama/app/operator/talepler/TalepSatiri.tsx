"use client";

import { useState, useTransition } from "react";
import type { Talep, TalepDurum } from "@/sunucu/db";
import { talebiIsaretle } from "../eylemler";
import { Ikon } from "../../bilesenler/Ikon";
import { TalepPenceresi } from "./TalepPenceresi";

const DURUM: Record<TalepDurum, { ad: string; sinif: string }> = {
  yeni: { ad: "Yeni", sinif: "r-uyari" },
  yazildi: { ad: "Yazıldı", sinif: "r-bilgi" },
  kuruldu: { ad: "Görüşme kuruldu", sinif: "r-bitti" },
  kapandi: { ad: "Kapandı", sinif: "r-kapali" },
};

function gecenSure(damga: string): string {
  const t = new Date(damga.replace(" ", "T") + "Z").getTime();
  const fark = Math.max(0, Date.now() - t);
  const dk = Math.round(fark / 60000);
  if (dk < 60) return `${dk} dakika önce`;
  const saat = Math.round(dk / 60);
  if (saat < 24) return `${saat} saat önce`;
  const gun = Math.round(saat / 24);
  return gun === 1 ? "dün" : `${gun} gün önce`;
}

/** Hazır bir cevap taslağı; operatör kendi posta programında açıp gönderir. */
function mailBaglantisi(t: Talep): string {
  const NL = "%0A";
  const konu = encodeURIComponent(`Mailhanem demo görüşmesi — ${t.firma}`);
  const govde =
    encodeURIComponent(`Merhaba ${t.ad.split(" ")[0]},`) + NL + NL +
    encodeURIComponent(
      "Demo talebiniz için teşekkürler. Kırk beş dakikalık bir görüşme öneriyorum; " +
        "kutunuzu birlikte bağlayıp ilk sınıflandırmayı ekranda görüyoruz.",
    ) + NL + NL +
    encodeURIComponent("Size uygun olabilecek saatler:") + NL +
    encodeURIComponent("  · ") + NL + encodeURIComponent("  · ") + NL +
    encodeURIComponent("  · ") + NL + NL +
    encodeURIComponent("Uymazsa siz bir saat söyleyin.") + NL + NL +
    encodeURIComponent("Enes");
  return `mailto:${t.eposta}?subject=${konu}&body=${govde}`;
}

/**
 * Kuyruktaki bir satır.
 *
 * Satır artık **özet**: firma, kişi, iletişim ve durum. Ayrıntının tamamı
 * (sağlayıcı, kişi sayısı, serbest not, kaynak) tıklayınca açılan pencerede.
 * Sebebi kullanıcının isteği: kuyruk taranabilir kalsın, dönüş yapmadan önce
 * bakılacak her şey tek bir pencerede toplansın.
 *
 * Satırın tamamı tıklanabilir ama sağdaki düğmeler değil — oradaki tıklama
 * pencereyi açmasın diye olay orada durduruluyor.
 */
export function TalepSatiri({ talep }: { talep: Talep }) {
  const [bekliyor, gecis] = useTransition();
  const [acik, setAcik] = useState(false);
  const d = DURUM[talep.durum];
  const bas = talep.firma.trim().charAt(0).toUpperCase();

  const isaretle = (durum: TalepDurum) => gecis(() => void talebiIsaretle(talep.id, durum));

  return (
    <>
      <div
        className={`talep-satir acilir ${talep.durum}${bekliyor ? " bekliyor" : ""}`}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        onClick={() => setAcik(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setAcik(true);
          }
        }}
      >
        <span className="av kare">{bas}</span>

        <div className="talep-ne">
          <span className="talep-kim">
            <b>{talep.firma}</b>
            <span className="ad">{talep.ad}</span>
          </span>
          <span className="talep-bilgi">
            <span>{talep.eposta}</span>
            {talep.telefon ? (
              <>
                <span className="ayrac">·</span>
                <span className="sayi-h">{talep.telefon}</span>
              </>
            ) : null}
            {talep.aciklama ? (
              <>
                <span className="ayrac">·</span>
                <span className="not-var">not bıraktı</span>
              </>
            ) : null}
          </span>
        </div>

        <span className="sure">{gecenSure(talep.olusma)}</span>
        <span className={`rozet ${d.sinif}`}>{d.ad}</span>

        <span className="talep-eylem" onClick={(e) => e.stopPropagation()}>
          <button className="dugme ufak ana" type="button" onClick={() => setAcik(true)}>
            Aç
          </button>
        </span>
      </div>

      {acik ? (
        <TalepPenceresi
          talep={talep}
          kapat={() => setAcik(false)}
          isaretle={isaretle}
          mailBaglantisi={mailBaglantisi}
          bekliyor={bekliyor}
        />
      ) : null}
    </>
  );
}

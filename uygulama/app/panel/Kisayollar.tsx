"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { durumSec } from "./eylemler";

/**
 * Klavye kısayolları (madde 4).
 *
 * Günde elli maile bakan birinin en büyük yorgunluğu fare gidip gelmesi:
 * satıra tıkla, oku, listeye dön, bir sonrakine tıkla. `j`/`k` bu döngüyü
 * klavyeye alıyor.
 *
 * ── Üç kural ─────────────────────────────────────────────
 * 1. **Yazarken kısayol yok.** Yanıt kutusunda "e" harfi maili kapatamaz;
 *    girdi alanlarında dinleyici hiç çalışmıyor. Tek istisna Esc.
 * 2. **Kısayol mevcut bir düğmenin işini yapıyor**, yeni bir yetenek
 *    açmıyor: `e` durum seçicisinin "Kapandı"sı, `r` yanıt kutusu. Fare ile
 *    yapılamayan hiçbir şey klavyeyle de yapılmıyor.
 * 3. **Görünür olmayan kısayol yoktur.** Listenin başındaki düğme tuşları
 *    sayıyor; `?` de aynı pencereyi açıyor.
 */

type Kisayol = { tus: string; ne: string };

const KISAYOLLAR: Kisayol[] = [
  { tus: "j", ne: "Sonraki mail" },
  { tus: "k", ne: "Önceki mail" },
  { tus: "r", ne: "Yanıt kutusuna geç" },
  { tus: "e", ne: "Maili kapandı işaretle" },
  { tus: "/", ne: "Aramaya geç" },
  { tus: "?", ne: "Bu pencere" },
  { tus: "Esc", ne: "Pencereyi kapat, alandan çık" },
];

/** Girdi alanında mıyız? Yazarken kısayol çalıştırmak en sinir bozucu hata. */
function yaziyorMu(hedef: EventTarget | null): boolean {
  if (!(hedef instanceof HTMLElement)) return false;
  if (hedef.isContentEditable) return true;
  const ad = hedef.tagName;
  return ad === "INPUT" || ad === "TEXTAREA" || ad === "SELECT";
}

export function Kisayollar({
  idler,
  secili,
  suzgecSorgusu,
}: {
  /** Listedeki mail numaraları, ekrandaki sırayla. Boşsa j/k çalışmaz. */
  idler: number[];
  /** Şu an sağ sütunda açık olan mail; yoksa 0. */
  secili: number;
  /** Süzgeçleri koruyan sorgu dizgisi — kısayol süzgeci bozmasın. */
  suzgecSorgusu: string;
}) {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [, basla] = useTransition();

  /* Dinleyici bir kez kuruluyor; değişen değerler ref üzerinden okunuyor.
     Her tuşta yeniden bağlamak, uzun listede boşuna iş. */
  const durum = useRef({ idler, secili, suzgecSorgusu });
  durum.current = { idler, secili, suzgecSorgusu };

  const git = useCallback(
    (yon: 1 | -1) => {
      const { idler: liste, secili: simdiki, suzgecSorgusu: sorgu } = durum.current;
      if (!liste.length) return;

      const yer = liste.indexOf(simdiki);
      /* Seçili mail listede yoksa (süzgeç değişmiş olabilir) baştan başla. */
      const hedef = yer === -1 ? liste[0] : liste[Math.min(Math.max(yer + yon, 0), liste.length - 1)];
      if (hedef === undefined || hedef === simdiki) return;

      router.push(`/panel?${sorgu ? sorgu + "&" : ""}mail=${hedef}`, { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    const dinle = (o: KeyboardEvent) => {
      if (o.metaKey || o.ctrlKey || o.altKey) return;

      if (o.key === "Escape") {
        setAcik(false);
        if (yaziyorMu(o.target)) (o.target as HTMLElement).blur();
        return;
      }
      if (yaziyorMu(o.target)) return;

      const { secili: simdiki } = durum.current;

      switch (o.key) {
        case "j":
          o.preventDefault();
          git(1);
          break;
        case "k":
          o.preventDefault();
          git(-1);
          break;
        case "r": {
          if (!simdiki) break;
          const kutu = document.getElementById(`yanit-${simdiki}`);
          if (!kutu) break;
          o.preventDefault();
          kutu.focus();
          kutu.scrollIntoView({ block: "center" });
          break;
        }
        case "e":
          if (!simdiki) break;
          o.preventDefault();
          basla(async () => {
            try {
              await durumSec(simdiki, "kapandi");
            } catch {
              /* Eylem sunucuda reddedildiyse ekran zaten değişmiyor; klavye
                 kısayolu için ayrı bir hata penceresi açmak abartı olurdu. */
            }
          });
          break;
        case "/": {
          const arama = document.querySelector<HTMLInputElement>('input[name="q"]');
          if (!arama) break;
          o.preventDefault();
          arama.focus();
          arama.select();
          break;
        }
        case "?":
          o.preventDefault();
          setAcik((x) => !x);
          break;
      }
    };

    document.addEventListener("keydown", dinle);
    return () => document.removeEventListener("keydown", dinle);
  }, [git]);

  /* Seçim klavyeyle değiştiğinde satır ekranın dışında kalabiliyor. */
  useEffect(() => {
    if (!secili) return;
    document.querySelector(".satir.secili")?.scrollIntoView({ block: "nearest" });
  }, [secili]);

  return (
    <>
      <button
        className="kisayol-ipucu"
        type="button"
        onClick={() => setAcik(true)}
        title="Klavye kısayolları"
        aria-label="Klavye kısayolları"
      >
        <kbd>?</kbd>
      </button>

      {acik ? (
        <div className="kisayol-ort" onClick={() => setAcik(false)} role="presentation">
          <div
            className="kisayol-pencere"
            onClick={(o) => o.stopPropagation()}
            role="dialog"
            aria-label="Klavye kısayolları"
          >
            <div className="kisayol-ust">
              <b>Klavye kısayolları</b>
              <button className="dugme sade ufak" type="button" onClick={() => setAcik(false)}>
                Kapat
              </button>
            </div>
            <ul className="kisayol-liste">
              {KISAYOLLAR.map((k) => (
                <li key={k.tus}>
                  <kbd>{k.tus}</kbd>
                  <span>{k.ne}</span>
                </li>
              ))}
            </ul>
            <p className="kisayol-not">
              Yazarken kısayollar çalışmaz — yanıt kutusundaki “e” harfi maili kapatmaz.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

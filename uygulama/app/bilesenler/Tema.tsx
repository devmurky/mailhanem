"use client";

import { Ikon } from "./Ikon";
import { kapsayanOlcek, zarfMaskesi } from "./zarfMaske";

/**
 * Gündüz / gece düğmesi.
 *
 * ── Geçiş ─────────────────────────────────────────────────
 * Tema değişimi `document.startViewTransition` ile sarılıyor: tarayıcı eski
 * ekranın fotoğrafını tutuyor, yeni temayı üstüne çiziyor. Biz de yeni
 * görüntüyü **zarf biçiminde bir maskeyle** açıyoruz — maske düğmenin
 * üstünde bir nokta olarak doğuyor, 700 ms'de ekranı yutuyor.
 *
 * Zarf tesadüf değil: markanın amblemi o. Dairesel açılma her yerde var;
 * ekranı kendi amblemiyle açmak, geçişi süsten çıkarıp markanın parçası
 * yapıyor.
 *
 * ── Üç kural ──────────────────────────────────────────────
 * 1. **Hareket azaltılmışsa animasyon yok.** `prefers-reduced-motion` açıksa
 *    tema anında değişiyor; büyüyen bir maske, baş dönmesi yaşayan biri için
 *    süs değil sorun.
 * 2. **Desteklemeyen tarayıcıda da çalışıyor.** `startViewTransition` yoksa
 *    (bugün Firefox) tema yine değişiyor, yalnız animasyonsuz. Özelliğin
 *    kendisi animasyona bağlanmadı.
 * 3. **Seçim tarayıcıda kalıyor** (`localStorage`). Sunucuya yazmak, tema
 *    için bir tablo ve bir eylem demekti; bu, cihazın kararı.
 */

const ANAHTAR = "mailhanem-tema";

export function TemaDugmesi() {
  const degistir = (olay: React.MouseEvent<HTMLButtonElement>) => {
    const kok = document.documentElement;
    const yeni = kok.dataset.tema === "gece" ? "gunduz" : "gece";

    const uygula = () => {
      kok.dataset.tema = yeni;
      try {
        localStorage.setItem(ANAHTAR, yeni);
      } catch {
        /* Gizli sekmede ya da depolama kapalıysa tema yine değişsin; yalnız
           bir sonraki açılışta hatırlanmaz. */
      }
    };

    const azHareket = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (azHareket || typeof document.startViewTransition !== "function") {
      uygula();
      return;
    }

    /* Ölçüler tıklama anında alınıyor: düğme menüde, menü kaydırılabiliyor. */
    const kutu = olay.currentTarget.getBoundingClientRect();
    const mx = kutu.left + kutu.width / 2;
    const my = kutu.top + kutu.height / 2;

    const gecis = document.startViewTransition(uygula);
    /* `ready` her zaman çözülmüyor: sekme arka plandayken tarayıcı geçişi hiç
       başlatmıyor, başka bir geçiş araya girerse de reddediliyor. Tema o
       durumda animasyonsuz değişiyor — yakalanmamış söz hatası bırakmayalım. */
    void gecis.ready
      .then(() => {
        const en = window.innerWidth;
        const boy = window.innerHeight;
        const son = kapsayanOlcek(mx, my, en, boy);

        kok.animate(
          { clipPath: [zarfMaskesi(mx, my, 10), zarfMaskesi(mx, my, son)] },
          {
            duration: 700,
            easing: "cubic-bezier(.65,0,.35,1)",
            pseudoElement: "::view-transition-new(root)",
          },
        );
      })
      .catch(() => {});
  };

  /* İkon **CSS ile** seçiliyor, JavaScript'le değil: sunucu hangi temada
     olduğumuzu bilmiyor, durumu React state'ine koysaydık ilk çizimde yanlış
     ikon görünüp yerine oturacaktı (hydration uyuşmazlığı). Etiket iki durumda
     da doğru olsun diye nötr yazıldı. */
  return (
    <button
      className="tema-dugme"
      type="button"
      onClick={degistir}
      aria-label="Gündüz / gece temasını değiştir"
      title="Gündüz / gece"
    >
      <span className="tema-ay">
        <Ikon ad="ay" boyut={16} />
      </span>
      <span className="tema-gunes">
        <Ikon ad="gunes" boyut={16} />
      </span>
    </button>
  );
}

"use client";

import { Ikon } from "./Ikon";
import { daire, kapsayanYaricap } from "./temaAcilma";

/**
 * Gündüz / gece düğmesi.
 *
 * ── Geçiş ─────────────────────────────────────────────────
 * Tema değişimi `document.startViewTransition` ile sarılıyor: tarayıcı eski
 * ekranın fotoğrafını tutuyor, yeni temayı üstüne çiziyor. Yeni görüntü
 * düğmenin üstünde doğan bir **daireyle** açılıyor.
 *
 * İlk sürüm zarf biçiminde bir çokgendi; markaya bağlıydı ama köşeleri ekranı
 * süpürürken sert görünüyordu — geçiş "açılma" değil "silme" gibi okunuyordu.
 * Şimdi üç şey yumuşatıyor:
 *
 * 1. **Daire.** Kenarını tarayıcı yumuşatıyor, çokgenin köşeleri yok.
 * 2. **Üstel yavaşlama.** `cubic-bezier(.22,1,.36,1)` hızlı başlayıp uzun
 *    sürede oturuyor; önceki `.65,0,.35,1` ortada hızlanıp sonda frene
 *    basıyordu, bu da hareketi mekanik gösteriyor.
 * 3. **İki katman birlikte oynuyor.** Yeni katman ilk 240 ms'de saydamdan
 *    geliyor (kenar sert bir çizgi olmuyor), eski katman hafifçe büyüyüp
 *    soluyor. Eski kare donuk dururken üstüne bir şekil sürünmesi, geçişi
 *    iki ayrı olaya bölüyordu.
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

    let uygulandi = false;
    const uygula = () => {
      if (uygulandi) return;
      uygulandi = true;
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

    /* **Güvenlik ağı.** Tarayıcı kare üretmiyorsa (arka plan sekmesi, küçültülmüş
       pencere, uzak masaüstü) geçiş hiç başlamıyor ve `startViewTransition`a
       verilen geri çağrı **hiç çalışmıyor** — ölçüldü. O hâlde tema sessizce
       değişmiyor ve kullanıcı düğmeye bastığında hiçbir şey olmuyor sanıyor.
       Kısa bir süre sonra temayı doğrudan uyguluyoruz; geçiş normal
       başladıysa `uygula` zaten çalışmış olur ve bu çağrı hiçbir şey yapmaz. */
    window.setTimeout(uygula, 300);

    /* `ready` her zaman çözülmüyor: geçiş hiç başlamazsa ne çözülüyor ne
       reddediliyor, araya başka bir geçiş girerse reddediliyor. İki durumda da
       tema animasyonsuz değişiyor — yakalanmamış söz hatası bırakmayalım. */
    void gecis.ready
      .then(() => {
        const son = kapsayanYaricap(mx, my, window.innerWidth, window.innerHeight);
        const sure = 620;
        const yumusak = "cubic-bezier(.22,1,.36,1)";

        kok.animate(
          { clipPath: [daire(mx, my, 0), daire(mx, my, son)] },
          { duration: sure, easing: yumusak, pseudoElement: "::view-transition-new(root)" },
        );
        /* Açılan kenar sert bir çizgi olmasın diye yeni katman saydamdan
           geliyor; kısa sürüyor, yoksa tema geç oturmuş gibi görünür. */
        kok.animate(
          { opacity: [0.55, 1] },
          { duration: 240, easing: "ease-out", pseudoElement: "::view-transition-new(root)" },
        );
        /* Eski katman geri çekiliyor: donuk durursa iki katman birbirinden
           kopuk görünüyor. Ölçek küçük tutuldu — hareket değil, derinlik. */
        kok.animate(
          { transform: ["scale(1)", "scale(1.03)"], opacity: [1, 0.86] },
          { duration: sure, easing: yumusak, pseudoElement: "::view-transition-old(root)" },
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

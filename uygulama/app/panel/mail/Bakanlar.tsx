"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Ikon } from "../../bilesenler/Ikon";
import { bakistanCik, bakistayim } from "../eylemler";

type Bakan = { ad: string; yaziyor: boolean };

/** Sunucudaki tazelik penceresinin (BAKIS_SANIYE) yarısı: bir haber kaçsa da
    kimse "kayboldu" görünmüyor. */
const ARALIK_MS = 20_000;

/**
 * "Şu an bu maile bakıyor" (madde 8).
 *
 * Ortak kutunun en pahalı çakışması aynı maile iki ayrı yanıt: müşteri iki
 * farklı cevap alıyor, ekip birbirinin işini bozuyor. Taslak tablosu metni
 * kaybetmiyor ama çakışmayı önlemiyordu.
 *
 * ── Neden yoklama (polling)? ──────────────────────────────
 * Anlık bağlantı (websocket) kurmak, tek sunucuda çalışan bu uygulamaya ayrı
 * bir altyapı sokardı. Yirmi saniyelik yoklama, "aynı anda yanıt yazıyoruz"
 * çakışmasını yakalamaya fazlasıyla yetiyor — yanıt yazmak dakikalar sürüyor.
 *
 * Şerit yanıt kutusunun **hemen üstünde**: uyarının işe yaradığı an, yazmaya
 * başlamadan önceki an. Ekranın tepesindeki bir bant o noktada çoktan
 * kaydırılıp gitmiş olurdu.
 */
export function Bakanlar({ mailId }: { mailId: number }) {
  const [bakanlar, setBakanlar] = useState<Bakan[]>([]);
  /* Yazma durumu ref'te: her tuş vuruşunda yeniden çizim yapmaya değmez,
     değeri yalnız bir sonraki bildirim okuyor. */
  const yaziyor = useRef(false);

  const bildir = useCallback(async () => {
    try {
      setBakanlar(await bakistayim(mailId, yaziyor.current));
    } catch {
      /* Oturum düşmüş ya da ağ kopmuş olabilir. Varlık bilgisi yardımcı bir
         şey; hata basmak, asıl iş olan yanıt yazmanın önüne geçerdi. */
    }
  }, [mailId]);

  useEffect(() => {
    let yasiyor = true;
    void bildir();
    const saat = setInterval(() => {
      /* Arka plandaki sekmeden haber vermek yanlış olur: kişi başka işte. */
      if (document.visibilityState === "visible") void bildir();
    }, ARALIK_MS);

    /* Yanıt kutusuna girip çıkmak "yazıyor"u değiştiriyor; bunu bir sonraki
       tura bırakmayıp hemen bildiriyoruz — uyarının değeri hızında. */
    const odak = () => {
      const simdi = document.activeElement?.id === `yanit-${mailId}`;
      if (simdi === yaziyor.current) return;
      yaziyor.current = simdi;
      if (yasiyor) void bildir();
    };
    document.addEventListener("focusin", odak);
    document.addEventListener("focusout", odak);

    return () => {
      yasiyor = false;
      clearInterval(saat);
      document.removeEventListener("focusin", odak);
      document.removeEventListener("focusout", odak);
      /* Başka maile geçerken satırı bırak; sekme kapanışında bu çalışmaz,
         orada satır kendiliğinden bayatlıyor. */
      void bakistanCik(mailId).catch(() => {});
    };
  }, [mailId, bildir]);

  if (!bakanlar.length) return null;

  const yazanlar = bakanlar.filter((b) => b.yaziyor);
  const adlar = (liste: Bakan[]) => liste.map((b) => b.ad.split(" ")[0]).join(", ");

  return (
    <div className={yazanlar.length ? "bakan-serit yazan" : "bakan-serit"}>
      <Ikon ad={yazanlar.length ? "uyari" : "kisiler"} boyut={15} />
      {yazanlar.length ? (
        <span>
          <b>{adlar(yazanlar)}</b> şu an yanıt yazıyor. İkinci bir cevap gitmesin —
          önce konuşun.
        </span>
      ) : (
        <span>
          <b>{adlar(bakanlar)}</b> şu an bu maile bakıyor.
        </span>
      )}
    </div>
  );
}

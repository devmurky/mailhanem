"use client";

import { useState, useTransition } from "react";
import { Ikon } from "../../bilesenler/Ikon";
import { durumSec, kategoriSec, sahipAta, sahipBirak, sahiplen, vipIsaretle } from "../eylemler";

type Kisi = { id: number; ad: string; eposta: string };

/** Eylemler sunucuda; buradaki tek iş beklemeyi ve hatayı göstermek. */
function useEylem() {
  const [bekliyor, basla] = useTransition();
  const [hata, setHata] = useState("");

  const calistir = (is: () => Promise<void>) => {
    setHata("");
    basla(async () => {
      try {
        await is();
      } catch (e) {
        setHata(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
      }
    });
  };

  return { bekliyor, hata, calistir };
}

function Hata({ metin }: { metin: string }) {
  if (!metin) return null;
  return (
    <p className="cekim-hata t-hata">
      <Ikon ad="uyari" boyut={15} />
      <span>{metin}</span>
    </p>
  );
}

export function Sahiplik({
  mailId,
  sahipId,
  sahipAd,
  benimId,
  ekip,
}: {
  mailId: number;
  sahipId: number | null;
  sahipAd: string | null;
  benimId: number;
  ekip: Kisi[];
}) {
  const { bekliyor, hata, calistir } = useEylem();
  const [devretAcik, setDevretAcik] = useState(false);
  const benimMi = sahipId === benimId;

  /* Triyaj şeridinin ilk satırı. Sahipsizlik burada uyarı tonuyla söyleniyor —
     ayrı bir turuncu bant kurmaya gerek yok, satırın kendisi yanıyor. */
  return (
    <>
      <div className={sahipId === null ? "t-satir uyr" : "t-satir"}>
        <span className="t-et">Sahip</span>
        <div className="t-ic">
          {sahipId === null ? (
            <b className="t-bos">Kimseye atanmadı</b>
          ) : (
            <span className="t-kisi">
              <span className="av kucuk">{(sahipAd ?? "?").trim().charAt(0).toUpperCase()}</span>
              <b>{benimMi ? "Sende" : (sahipAd ?? "Bir ekip üyesinde")}</b>
            </span>
          )}

          <span className="t-dugmeler">
            {sahipId === null ? (
              <button
                className="dugme ana ufak"
                type="button"
                disabled={bekliyor}
                onClick={() => calistir(() => sahiplen(mailId))}
              >
                Sahiplen
              </button>
            ) : (
              <button
                className="dugme ufak"
                type="button"
                disabled={bekliyor}
                onClick={() => calistir(() => sahipBirak(mailId))}
              >
                Bırak
              </button>
            )}
            <button
              className="dugme ufak"
              type="button"
              disabled={bekliyor || ekip.length < 2}
              aria-expanded={devretAcik}
              onClick={() => setDevretAcik((a) => !a)}
            >
              {sahipId === null ? "Birine ata" : "Devret"}
            </button>
          </span>
        </div>
      </div>

      {devretAcik ? (
        <div className="t-satir t-devret">
          <span className="t-et">Kime</span>
          <div className="devret">
            {ekip.map((k) => (
              <button
                key={k.id}
                className="devret-kisi"
                type="button"
                disabled={bekliyor || k.id === sahipId}
                onClick={() =>
                  calistir(async () => {
                    await sahipAta(mailId, k.id);
                    setDevretAcik(false);
                  })
                }
              >
                <span className="av kucuk">
                  {(k.ad || k.eposta).trim().charAt(0).toUpperCase()}
                </span>
                <span>
                  <b>{k.ad || k.eposta}</b>
                  <small>{k.eposta}</small>
                </span>
                {k.id === sahipId ? <span className="rozet r-kapali">şu an</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {hata ? (
        <div className="t-satir">
          <span className="t-et" />
          <Hata metin={hata} />
        </div>
      ) : null}
    </>
  );
}

export function KategoriSecici({
  mailId,
  secili,
  secenekler,
}: {
  mailId: number;
  secili: string | null;
  secenekler: { deger: string; ad: string }[];
}) {
  const { bekliyor, hata, calistir } = useEylem();

  return (
    <>
      <div className="secim-serisi">
        {secenekler.map((s) => (
          <button
            key={s.deger}
            className={s.deger === secili ? "kcip secili" : "kcip"}
            type="button"
            disabled={bekliyor}
            onClick={() => calistir(() => kategoriSec(mailId, s.deger === secili ? "" : s.deger))}
          >
            {s.ad}
          </button>
        ))}
      </div>
      <Hata metin={hata} />
    </>
  );
}

export function DurumSecici({
  mailId,
  secili,
  secenekler,
}: {
  mailId: number;
  secili: string;
  secenekler: { deger: string; ad: string }[];
}) {
  const { bekliyor, hata, calistir } = useEylem();

  return (
    <>
      <div className="secim-serisi">
        {secenekler.map((s) => (
          <button
            key={s.deger}
            className={s.deger === secili ? "kcip secili" : "kcip"}
            type="button"
            disabled={bekliyor || s.deger === secili}
            onClick={() => calistir(() => durumSec(mailId, s.deger))}
          >
            {s.ad}
          </button>
        ))}
      </div>
      <Hata metin={hata} />
    </>
  );
}

/**
 * VIP anahtarı. Gönderenin adresine bağlanıyor, maile değil — bu yüzden
 * metin "bu gönderen" diyor, "bu mail" demiyor.
 */
export function VipDugmesi({ mailId, vip, gonderen }: {
  mailId: number;
  vip: boolean;
  gonderen: string;
}) {
  const { bekliyor, hata, calistir } = useEylem();

  return (
    <span className="vip-alan">
      <button
        className={vip ? "dugme ufak vip-acik" : "dugme sade ufak"}
        type="button"
        disabled={bekliyor}
        title={vip ? `${gonderen} VIP listesinde` : `${gonderen} adresini VIP yap`}
        onClick={() => calistir(() => vipIsaretle(mailId, !vip))}
      >
        <Ikon ad={vip ? "yildiz-dolu" : "yildiz"} boyut={14} />
        {vip ? "VIP" : "VIP yap"}
      </button>
      <Hata metin={hata} />
    </span>
  );
}

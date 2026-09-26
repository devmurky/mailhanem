"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Ikon } from "../../bilesenler/Ikon";
import { abonelikKaydet, type AbonelikDurumu } from "./eylemler";

function Kaydet() {
  const { pending } = useFormStatus();
  return (
    <button className="dugme ana ufak" type="submit" disabled={pending}>
      {pending ? "Kaydediliyor…" : "Kaydet"}
    </button>
  );
}

export function AbonelikDuzenle({
  firmaId,
  plan,
  durum,
  aylikKurus,
  planlar,
  durumlar,
}: {
  firmaId: number;
  plan: string;
  durum: string;
  aylikKurus: number;
  planlar: { deger: string; ad: string }[];
  durumlar: { deger: string; ad: string }[];
}) {
  const [acik, setAcik] = useState(false);
  const [sonuc, eylem] = useActionState<AbonelikDurumu, FormData>(abonelikKaydet, {});

  if (!acik) {
    return (
      <button className="dugme ufak" type="button" onClick={() => setAcik(true)}>
        Düzenle
      </button>
    );
  }

  return (
    <form className="abonelik-form" action={eylem}>
      <input type="hidden" name="firma_id" value={firmaId} />

      <label className="gizli" htmlFor={`plan-${firmaId}`}>
        Plan
      </label>
      <select id={`plan-${firmaId}`} name="plan" defaultValue={plan}>
        {planlar.map((p) => (
          <option key={p.deger} value={p.deger}>
            {p.ad}
          </option>
        ))}
      </select>

      <label className="gizli" htmlFor={`durum-${firmaId}`}>
        Durum
      </label>
      <select id={`durum-${firmaId}`} name="durum" defaultValue={durum}>
        {durumlar.map((d) => (
          <option key={d.deger} value={d.deger}>
            {d.ad}
          </option>
        ))}
      </select>

      <label className="gizli" htmlFor={`ucret-${firmaId}`}>
        Aylık ücret (TL)
      </label>
      <span className="ucret-alan">
        <input
          id={`ucret-${firmaId}`}
          name="ucret"
          defaultValue={aylikKurus ? (aylikKurus / 100).toFixed(2) : ""}
          placeholder="0,00"
          inputMode="decimal"
        />
        <small>TL / ay</small>
      </span>

      <Kaydet />
      <button className="dugme sade ufak" type="button" onClick={() => setAcik(false)}>
        {sonuc.tamam ? "Kapat" : "Vazgeç"}
      </button>

      {sonuc.tamam ? (
        <span className="sonuc iyi">
          <Ikon ad="onay" boyut={15} />
          {sonuc.tamam}
        </span>
      ) : null}
      {sonuc.hata ? (
        <span className="sonuc kotu">
          <Ikon ad="uyari" boyut={15} />
          {sonuc.hata}
        </span>
      ) : null}
    </form>
  );
}

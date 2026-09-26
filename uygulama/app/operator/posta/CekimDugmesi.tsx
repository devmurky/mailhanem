"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { cekimiCalistir, type CekimDurumu } from "./eylemler";
import { Ikon } from "../../bilesenler/Ikon";

function Dugme() {
  const { pending } = useFormStatus();
  return (
    <button className="dugme ana" type="submit" disabled={pending}>
      <Ikon ad="yenile" boyut={15} />
      {pending ? "Çekiliyor…" : "Çekimi çalıştır"}
    </button>
  );
}

export function CekimDugmesi() {
  const [durum, eylem] = useActionState<CekimDurumu, FormData>(
    () => cekimiCalistir({}),
    {},
  );

  return (
    <div>
      <form action={eylem}>
        <Dugme />
      </form>

      {durum.hata ? (
        <p className="cekim-hata">
          <Ikon ad="uyari" boyut={15} />
          <span>{durum.hata}</span>
        </p>
      ) : null}

      {durum.sonuc?.length ? (
        <ul className="cekim-ozet">
          {durum.sonuc.map((s) => (
            <li key={s.kutu}>
              <span className={`nb ${s.hata ? "kopuk" : ""}`} />
              <b>{s.kutu}</b>
              {s.hata ? (
                <span className="hata">{s.hata}</span>
              ) : (
                <span>
                  {s.bulunan} bulundu · {s.yeni} yeni · {s.elenen} elendi
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

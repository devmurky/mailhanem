"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Ikon } from "../../bilesenler/Ikon";
import { destekZamaniEkle, type OpTicketDurumu } from "./eylemler";

/**
 * Bu işe harcanan zamanın kaydı.
 *
 * Net marjın eksik yarısı buydu: `destek_kayitlari` tablosu açıktı ama yazan
 * yoktu, o yüzden marj hesaplanamıyor ve operatör ekranlarında tire
 * görünüyordu. Buradan girilen her dakika Genel Bakış'taki "Destek yükün"
 * kartına ve müşteri tablosundaki "Destek sa." sütununa **doğrudan** akıyor.
 *
 * Hazır düğmeler var çünkü asıl sorun ölçmek değil, ölçmeyi hatırlamak: 5/15/30
 * dakika tek tıkla giriliyor, serbest alan da duruyor.
 */
const HAZIR = [5, 15, 30, 60];

function Kaydet() {
  const { pending } = useFormStatus();
  return (
    <button className="dugme ufak ana" type="submit" disabled={pending}>
      {pending ? "…" : "Kaydet"}
    </button>
  );
}

export function DestekZamani({
  ticketId,
  firmaAd,
  toplamDakika,
}: {
  ticketId: number;
  firmaAd: string;
  toplamDakika: number | null;
}) {
  const [durum, eylem] = useActionState<OpTicketDurumu, FormData>(destekZamaniEkle, {});

  return (
    <div className="destek-zamani">
      <div className="dz-ust">
        <span className="kutu-ad">Harcanan zaman</span>
        <span className="dz-toplam">
          {toplamDakika === null ? (
            <i>bu firmaya henüz kayıt yok</i>
          ) : (
            <>
              {firmaAd} · son 30 günde{" "}
              <b>
                {(toplamDakika / 60).toLocaleString("tr-TR", {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1,
                })}{" "}
                sa
              </b>
            </>
          )}
        </span>
      </div>

      {durum.tamam ? (
        <p className="sonuc iyi">
          <Ikon ad="onay" boyut={15} />
          <span>{durum.tamam}</span>
        </p>
      ) : null}
      {durum.hata ? (
        <p className="sonuc kotu">
          <Ikon ad="uyari" boyut={15} />
          <span>{durum.hata}</span>
        </p>
      ) : null}

      <form action={eylem} className="dz-form">
        <input type="hidden" name="ticket_id" value={ticketId} />
        <span className="dz-hazir">
          {HAZIR.map((d) => (
            <button
              key={d}
              className="kcip"
              type="submit"
              name="dakika"
              value={d}
              title={`${d} dakika kaydet`}
            >
              {d} dk
            </button>
          ))}
        </span>
        <span className="dz-serbest">
          <label className="gizli" htmlFor={`dz-${ticketId}`}>
            Dakika
          </label>
          <input
            id={`dz-${ticketId}`}
            name="dakika"
            type="number"
            min={1}
            max={600}
            placeholder="dk"
            inputMode="numeric"
          />
          <Kaydet />
        </span>
      </form>
    </div>
  );
}

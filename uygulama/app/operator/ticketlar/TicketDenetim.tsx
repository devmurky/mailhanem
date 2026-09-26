"use client";

import { useActionState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  TICKET_DURUMLARI,
  TICKET_DURUM_AD,
  TICKET_ONCELIKLERI,
  TICKET_ONCELIK_AD,
} from "@/sunucu/ticketSabitleri";
import { Ikon } from "../../bilesenler/Ikon";
import {
  operatorDurumYaz,
  operatorOncelikYaz,
  operatorYanitla,
  type OpTicketDurumu,
} from "./eylemler";

/**
 * Operatörün talep üstündeki iki kolu: durum ve öncelik.
 *
 * Önceliğin buradan değiştirilebilmesi bilinçli — müşteri her talebi "acil"
 * işaretlerse kuyruğun sırası anlamını yitirir.
 */
export function TicketDenetim({
  ticketId,
  durum,
  oncelik,
}: {
  ticketId: number;
  durum: string;
  oncelik: string;
}) {
  const [bekliyor, gecis] = useTransition();

  return (
    <div className="t-denetim">
      <label className="alan">
        <span>Durum</span>
        <select
          value={durum}
          disabled={bekliyor}
          onChange={(e) => gecis(() => void operatorDurumYaz(ticketId, e.target.value))}
        >
          {TICKET_DURUMLARI.map((d) => (
            <option key={d} value={d}>
              {TICKET_DURUM_AD[d]}
            </option>
          ))}
        </select>
      </label>

      <label className="alan">
        <span>Öncelik</span>
        <select
          value={oncelik}
          disabled={bekliyor}
          onChange={(e) => gecis(() => void operatorOncelikYaz(ticketId, e.target.value))}
        >
          {TICKET_ONCELIKLERI.map((o) => (
            <option key={o} value={o}>
              {TICKET_ONCELIK_AD[o]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function Gonder() {
  const { pending } = useFormStatus();
  return (
    <button className="dugme ana" type="submit" disabled={pending}>
      <Ikon ad="sagok" boyut={15} />
      {pending ? "Gönderiliyor…" : "Yanıtla"}
    </button>
  );
}

export function OpTicketYaniti({ ticketId }: { ticketId: number }) {
  const [durum, eylem] = useActionState<OpTicketDurumu, FormData>(operatorYanitla, {});

  return (
    <div className="kutu yanit-kutu">
      <div className="kutu-ust">
        <span className="kutu-ad">Yanıt yaz</span>
        <span className="kutu-not">müşteri panelinde görünür</span>
      </div>

      {durum.tamam ? (
        <p className="sonuc iyi">
          <Ikon ad="onay" boyut={16} />
          <span>{durum.tamam}</span>
        </p>
      ) : null}
      {durum.hata ? (
        <p className="sonuc kotu">
          <Ikon ad="uyari" boyut={16} />
          <span>{durum.hata}</span>
        </p>
      ) : null}

      <form action={eylem}>
        <input type="hidden" name="ticket_id" value={ticketId} />
        <label className="gizli" htmlFor={`op-yanit-${ticketId}`}>
          Yanıt metni
        </label>
        <textarea
          id={`op-yanit-${ticketId}`}
          name="metin"
          rows={4}
          required
          placeholder="Yanıtınızı yazın…"
        />
        <div className="form-alt-satir">
          <Gonder />
          <span className="ipuc">Gönderince talep &quot;yanıt bekliyor&quot;a döner.</span>
        </div>
      </form>
    </div>
  );
}

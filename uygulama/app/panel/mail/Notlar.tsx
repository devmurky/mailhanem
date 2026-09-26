"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Ikon } from "../../bilesenler/Ikon";
import { notEkle, notSil, type NotDurumu } from "../eylemler";

export type Not = {
  id: number;
  metin: string;
  olusma: string;
  yazan_id: number | null;
  yazan_ad: string | null;
};

function sure(damga: string): string {
  const fark = Date.now() - new Date(damga.replace(" ", "T") + "Z").getTime();
  const dk = Math.round(fark / 60000);
  if (dk < 60) return `${dk} dk`;
  const sa = Math.round(dk / 60);
  if (sa < 24) return `${sa} sa`;
  return `${Math.round(sa / 24)} gün`;
}

function Ekle() {
  const { pending } = useFormStatus();
  return (
    <button className="dugme ufak ana" type="submit" disabled={pending}>
      {pending ? "…" : "Not ekle"}
    </button>
  );
}

/**
 * Mailin altındaki ekip içi notlar.
 *
 * **Bu metin müşteriye gitmez.** Yanıt kutusundan ayrı bir yerde ve ayrı
 * görünümde duruyor; ikisini karıştırmak, iç konuşmayı yanlışlıkla göndermek
 * demek olurdu. O yüzden not kutusu sarı zeminde ve düğmesi "Not ekle",
 * "Gönder" değil.
 *
 * Silme yalnız kendi notunda: başkasının notunu silmek geçmişi bozar.
 */
export function Notlar({
  mailId,
  notlar,
  benimId,
}: {
  mailId: number;
  notlar: Not[];
  benimId: number;
}) {
  const [durum, eylem] = useActionState<NotDurumu, FormData>(notEkle, {});

  return (
    <div className="kutu not-kutu">
      <div className="kutu-ust">
        <span className="kutu-ad">Ekip notu</span>
        <span className="kutu-not">müşteriye gitmez</span>
      </div>

      {notlar.length ? (
        <div className="not-listesi">
          {notlar.map((n) => (
            <div className="not-satiri" key={n.id}>
              <div className="not-ust">
                <b>{n.yazan_ad || "Ekipten biri"}</b>
                <span className="sure">{sure(n.olusma)}</span>
                {n.yazan_id === benimId ? (
                  <form
                    action={async () => {
                      await notSil(n.id, mailId);
                    }}
                  >
                    <button className="not-sil" type="submit" aria-label="Notu sil">
                      <Ikon ad="carpi" boyut={13} />
                    </button>
                  </form>
                ) : null}
              </div>
              <p>{n.metin}</p>
            </div>
          ))}
        </div>
      ) : null}

      {durum.hata ? (
        <p className="sonuc kotu">
          <Ikon ad="uyari" boyut={15} />
          <span>{durum.hata}</span>
        </p>
      ) : null}

      <form action={eylem} className="not-formu">
        <input type="hidden" name="mail_id" value={mailId} />
        <label className="gizli" htmlFor={`not-${mailId}`}>
          Ekip notu
        </label>
        <textarea
          id={`not-${mailId}`}
          name="metin"
          rows={2}
          required
          placeholder="Ekibin göreceği not — müşteriye gitmez…"
        />
        <Ekle />
      </form>
    </div>
  );
}

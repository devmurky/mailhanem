"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  TICKET_KATEGORILERI,
  TICKET_KATEGORI_AD,
  TICKET_ONCELIKLERI,
  TICKET_ONCELIK_AD,
} from "@/sunucu/ticketSabitleri";
import { Ikon } from "../../bilesenler/Ikon";
import { ticketAcEylem, ticketYanitla, type TicketDurumu } from "./eylemler";

export type MailSecenegi = { id: number; konu: string; gonderen: string; tarih: string };

/** Ortak dosya alanı: hem yeni talepte hem yanıtta aynı kurallar geçerli. */
function EkAlani({ id }: { id: string }) {
  return (
    <label className="alan ek-alan">
      <span>Dosya ekle — isteğe bağlı</span>
      <input
        id={id}
        type="file"
        name="ek"
        multiple
        accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,text/csv,application/zip,.doc,.docx,.xls,.xlsx"
      />
      <small>Ekran görüntüsü çoğu sorunu tek başına çözer. En çok 10 MB.</small>
    </label>
  );
}

function Gonder({ etiket, bekleyen }: { etiket: string; bekleyen: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="dugme ana" type="submit" disabled={pending}>
      <Ikon ad="sagok" boyut={15} />
      {pending ? bekleyen : etiket}
    </button>
  );
}

function Sonuc({ durum }: { durum: TicketDurumu }) {
  if (durum.tamam) {
    return (
      <p className="sonuc iyi">
        <Ikon ad="onay" boyut={16} />
        <span>{durum.tamam}</span>
      </p>
    );
  }
  if (durum.hata) {
    return (
      <p className="sonuc kotu">
        <Ikon ad="uyari" boyut={16} />
        <span>{durum.hata}</span>
      </p>
    );
  }
  return null;
}

/**
 * Yeni destek talebi formu.
 *
 * Öncelik ve kategori müşteriye bırakılıyor: hangi işin acil olduğunu en iyi
 * o bilir. Operatör tarafında ikisi de değiştirilebilir — yanlış işaretlenmiş
 * bir talep kuyruğun sırasını bozmasın.
 */
export function TicketFormu({ mailler = [] }: { mailler?: MailSecenegi[] }) {
  const [durum, eylem] = useActionState<TicketDurumu, FormData>(ticketAcEylem, {});

  return (
    <div className="kutu">
      <div className="kutu-ust">
        <span className="kutu-ad">Yeni destek talebi</span>
      </div>

      <Sonuc durum={durum} />

      {durum.tamam ? null : (
        <form action={eylem} className="ticket-formu">
          <label className="alan">
            <span>Konu</span>
            <input
              name="konu"
              required
              maxLength={140}
              placeholder="Kısaca ne oldu?"
              autoComplete="off"
            />
          </label>

          <div className="alan-ikili">
            <label className="alan">
              <span>Kategori</span>
              <select name="kategori" defaultValue="soru">
                {TICKET_KATEGORILERI.map((k) => (
                  <option key={k} value={k}>
                    {TICKET_KATEGORI_AD[k]}
                  </option>
                ))}
              </select>
            </label>

            <label className="alan">
              <span>Öncelik</span>
              <select name="oncelik" defaultValue="normal">
                {TICKET_ONCELIKLERI.map((o) => (
                  <option key={o} value={o}>
                    {TICKET_ONCELIK_AD[o]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="alan">
            <span>Ayrıntı</span>
            <textarea
              name="metin"
              rows={8}
              required
              defaultValue={durum.taslak ?? ""}
              placeholder="Ne yapmaya çalıştınız, ne oldu? Hata mesajı varsa yazın."
            />
          </label>

          {/* Madde 3 — "şu mail gelmedi" derken hangisi olduğunu gösterebilsin. */}
          {mailler.length ? (
            <label className="alan">
              <span>İlgili mail — isteğe bağlı</span>
              <select name="mail_id" defaultValue="">
                <option value="">bir mail bağlama</option>
                {mailler.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.konu || "(konu yok)"} — {m.gonderen}
                  </option>
                ))}
              </select>
              <small>Bağlarsanız o maili biz de görürüz; anlatmanız gerekmez.</small>
            </label>
          ) : null}

          <EkAlani id="ek-yeni" />

          <div className="form-alt-satir">
            <Gonder etiket="Talebi gönder" bekleyen="Gönderiliyor…" />
            <span className="ipuc">
              Yanıt bu ekranda görünür; ayrıca adresinize bildirim gitmez.
            </span>
          </div>
        </form>
      )}
    </div>
  );
}

/** Açık bir talebe mesaj ekleme kutusu. */
export function TicketYaniti({ ticketId, kapali }: { ticketId: number; kapali: boolean }) {
  const [durum, eylem] = useActionState<TicketDurumu, FormData>(ticketYanitla, {});

  return (
    <div className="kutu yanit-kutu">
      <div className="kutu-ust">
        <span className="kutu-ad">{kapali ? "Yeniden aç" : "Yanıt yaz"}</span>
      </div>

      <Sonuc durum={durum} />

      <form action={eylem}>
        <input type="hidden" name="ticket_id" value={ticketId} />
        <label className="gizli" htmlFor={`ticket-metin-${ticketId}`}>
          Mesajınız
        </label>
        <textarea
          id={`ticket-metin-${ticketId}`}
          name="metin"
          rows={4}
          required
          placeholder={kapali ? "Yazarsanız talep yeniden açılır…" : "Mesajınızı yazın…"}
        />
        <EkAlani id={`ek-yanit-${ticketId}`} />

        <div className="form-alt-satir">
          <Gonder etiket="Gönder" bekleyen="Gönderiliyor…" />
        </div>
      </form>
    </div>
  );
}

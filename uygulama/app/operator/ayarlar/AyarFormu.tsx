"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ayarlariKaydet, type AyarDurumu } from "../eylemler";
import { Ikon } from "../../bilesenler/Ikon";

function Kaydet() {
  const { pending } = useFormStatus();
  return (
    <button className="dugme ana" type="submit" disabled={pending}>
      {pending ? "Kaydediliyor…" : "Kaydet"}
    </button>
  );
}

export function AyarFormu({ eposta, telefon }: { eposta: string; telefon: string }) {
  const [durum, eylem] = useActionState<AyarDurumu, FormData>(ayarlariKaydet, {});

  return (
    <form action={eylem} className="kutu" style={{ maxWidth: 560 }}>
      <div className={durum.alanlar?.iletisim_eposta ? "form-satir hata" : "form-satir"}>
        <label htmlFor="iletisim_eposta">İletişim e-postası</label>
        <input
          id="iletisim_eposta"
          name="iletisim_eposta"
          type="email"
          defaultValue={eposta}
          placeholder="merhaba@mailhanem.app"
        />
        <span className="alan-hata">{durum.alanlar?.iletisim_eposta ?? ""}</span>
        <span className="ipuc">
          Boş bırakırsan sitede iletişim satırı <b>hiç görünmez</b>. Uydurma bir adres
          yayınlamaktansa satırı hiç göstermemek doğrusu.
        </span>
      </div>

      <div className="form-satir">
        <label htmlFor="iletisim_telefon">İletişim telefonu</label>
        <input
          id="iletisim_telefon"
          name="iletisim_telefon"
          type="tel"
          defaultValue={telefon}
          placeholder="0212 000 00 00"
        />
        <span className="ipuc">İsteğe bağlı. Yazarsan sitede e-postanın yanında görünür.</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 4 }}>
        <Kaydet />
        {durum.tamam ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              color: "var(--olumlu)",
              fontSize: 13.5,
              fontWeight: 600,
            }}
          >
            <Ikon ad="onay" boyut={15} />
            Kaydedildi · site birkaç dakika içinde yeni değeri okur
          </span>
        ) : null}
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Ikon } from "../../bilesenler/Ikon";
import { maliyetKaydet, type AbonelikDurumu } from "../abonelikler/eylemler";

function Kaydet() {
  const { pending } = useFormStatus();
  return (
    <button className="dugme ufak" type="submit" disabled={pending}>
      {pending ? "Kaydediliyor…" : "Kaydet"}
    </button>
  );
}

/**
 * Mail başına maliyet varsayımı.
 *
 * Bu sayıyı uygulama bilmiyor: model adımı henüz bağlı değil, bağlandığında da
 * kullanılan modele göre değişecek. O yüzden **operatör giriyor** ve ekran bunu
 * "ölçüm" değil "varsayım" diye adlandırıyor.
 */
export function MaliyetVarsayimi({ mailKurus }: { mailKurus: string }) {
  const [sonuc, eylem] = useActionState<AbonelikDurumu, FormData>(maliyetKaydet, {});

  return (
    <form className="varsayim-form" action={eylem}>
      <label htmlFor="mail_kurus">Mail başına maliyet varsayımı</label>
      <span className="ucret-alan">
        <input
          id="mail_kurus"
          name="mail_kurus"
          defaultValue={mailKurus}
          placeholder="0"
          inputMode="decimal"
        />
        <small>kuruş / işlenen mail</small>
      </span>
      <Kaydet />
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

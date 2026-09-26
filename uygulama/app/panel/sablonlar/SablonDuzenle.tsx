"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Ikon } from "../../bilesenler/Ikon";
import { sablonKaydet, sablonuSil, type SablonDurumu } from "./eylemler";
import { YER_TUTUCULAR } from "./yerTutucular";

type Sablon = {
  id: number;
  ad: string;
  kategori: string | null;
  metin: string;
  kullanim: number;
};

function Kaydet({ yeni }: { yeni: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="dugme ana" type="submit" disabled={pending}>
      {pending ? "Kaydediliyor…" : yeni ? "Şablonu ekle" : "Değişikliği kaydet"}
    </button>
  );
}

function Formu({
  sablon,
  kategoriler,
  kapat,
}: {
  sablon?: Sablon;
  kategoriler: { deger: string; ad: string }[];
  kapat: () => void;
}) {
  const [durum, eylem] = useActionState<SablonDurumu, FormData>(sablonKaydet, {});

  return (
    <form className="sablon-form" action={eylem}>
      <input type="hidden" name="id" value={sablon?.id ?? 0} />

      <div className="ikili">
        <div className={durum.alanlar?.ad ? "form-satir hata" : "form-satir"}>
          <label htmlFor={`s-ad-${sablon?.id ?? 0}`}>Şablon adı</label>
          <input
            id={`s-ad-${sablon?.id ?? 0}`}
            name="ad"
            defaultValue={sablon?.ad ?? ""}
            placeholder="Kargo gecikmesi"
            maxLength={80}
            required
          />
          <span className="alan-hata">{durum.alanlar?.ad ?? ""}</span>
        </div>

        <div className="form-satir">
          <label htmlFor={`s-kat-${sablon?.id ?? 0}`}>
            Kategori <span className="ops">— isteğe bağlı</span>
          </label>
          <select
            id={`s-kat-${sablon?.id ?? 0}`}
            name="kategori"
            defaultValue={sablon?.kategori ?? ""}
          >
            <option value="">Her kategoride görünsün</option>
            {kategoriler.map((k) => (
              <option key={k.deger} value={k.deger}>
                {k.ad}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={durum.alanlar?.metin ? "form-satir hata" : "form-satir"}>
        <label htmlFor={`s-metin-${sablon?.id ?? 0}`}>Şablon metni</label>
        <textarea
          id={`s-metin-${sablon?.id ?? 0}`}
          name="metin"
          rows={8}
          defaultValue={sablon?.metin ?? ""}
          placeholder={"Merhaba {ad},\n\n…\n\nİyi çalışmalar,\n{ben}\n{firma}"}
          required
        />
        <span className="alan-hata">{durum.alanlar?.metin ?? ""}</span>
      </div>

      <div className="yer-tutucular">
        <span className="et">Yer tutucular</span>
        {YER_TUTUCULAR.map((y) => (
          <span key={y.anahtar} className="yt">
            <code>{`{${y.anahtar}}`}</code>
            {y.ne}
          </span>
        ))}
      </div>

      <div className="form-alt-satir">
        <Kaydet yeni={!sablon} />
        <button className="dugme sade" type="button" onClick={kapat}>
          {durum.tamam ? "Kapat" : "Vazgeç"}
        </button>
        {durum.tamam ? (
          <span className="sonuc iyi">
            <Ikon ad="onay" boyut={15} />
            {durum.tamam}
          </span>
        ) : null}
        {durum.hata ? (
          <span className="sonuc kotu">
            <Ikon ad="uyari" boyut={15} />
            {durum.hata}
          </span>
        ) : null}
      </div>
    </form>
  );
}

export function YeniSablon({ kategoriler }: { kategoriler: { deger: string; ad: string }[] }) {
  const [acik, setAcik] = useState(false);

  if (!acik) {
    return (
      <button className="dugme" type="button" onClick={() => setAcik(true)}>
        <Ikon ad="kalem" boyut={15} />
        Şablon ekle
      </button>
    );
  }

  return (
    <div className="kutu sablon-kutu">
      <div className="kutu-ust">
        <span className="kutu-ad">Yeni şablon</span>
      </div>
      <Formu kategoriler={kategoriler} kapat={() => setAcik(false)} />
    </div>
  );
}

export function SablonSatiri({
  sablon,
  kategoriAd,
  kategoriler,
  duzenlenebilir,
}: {
  sablon: Sablon;
  kategoriAd: string;
  kategoriler: { deger: string; ad: string }[];
  duzenlenebilir: boolean;
}) {
  const [acik, setAcik] = useState(false);
  const [soruyor, setSoruyor] = useState(false);
  const [bekliyor, basla] = useTransition();

  return (
    <div className="kutu sablon-kutu">
      <div className="kutu-ust">
        <span className="kutu-ad">{sablon.ad}</span>
        {sablon.kategori ? <span className="rozet r-bilgi">{kategoriAd}</span> : null}
        <span className="kutu-not">
          {sablon.kullanim ? `${sablon.kullanim} kez kullanıldı` : "henüz kullanılmadı"}
        </span>
        {duzenlenebilir ? (
          <span className="sablon-eylem">
            <button className="dugme ufak" type="button" onClick={() => setAcik((a) => !a)}>
              {acik ? "Kapat" : "Düzenle"}
            </button>
            {soruyor ? (
              <>
                <button
                  className="dugme ufak"
                  type="button"
                  disabled={bekliyor}
                  onClick={() => basla(async () => void (await sablonuSil(sablon.id)))}
                >
                  Evet, sil
                </button>
                <button className="dugme sade ufak" type="button" onClick={() => setSoruyor(false)}>
                  Vazgeç
                </button>
              </>
            ) : (
              <button className="dugme sade ufak" type="button" onClick={() => setSoruyor(true)}>
                Sil
              </button>
            )}
          </span>
        ) : null}
      </div>

      {acik ? (
        <Formu sablon={sablon} kategoriler={kategoriler} kapat={() => setAcik(false)} />
      ) : (
        <p className="sablon-onizleme">{sablon.metin}</p>
      )}
    </div>
  );
}

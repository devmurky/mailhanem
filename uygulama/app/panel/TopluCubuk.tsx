"use client";

import { useActionState, useEffect, useState } from "react";
import { KATEGORILER, KATEGORI_AD } from "@/sunucu/kategoriler";
import { Ikon } from "../bilesenler/Ikon";
import { topluIslem, type TopluDurum } from "./eylemler";

/**
 * Gelen kutusunda toplu işlem (madde 12).
 *
 * Kutucuklar liste satırlarının içinde yaşıyor ama çubuk burada: seçim varken
 * beliriyor, yokken hiç çizilmiyor. Boş bir araç çubuğunu sürekli ekranda
 * tutmak, dar olan liste sütunundan yer çalardı.
 *
 * Seçim **sayfa değişince sıfırlanıyor**: süzgeç değiştirildiğinde ekranda
 * görünmeyen maillerin seçili kalması, "12 mail kapatıldı" dedikten sonra
 * hangileri olduğunu bilememek demek olurdu.
 */
export function TopluCubuk({ mailIdleri }: { mailIdleri: number[] }) {
  const [secili, setSecili] = useState<number[]>([]);
  const [durum, eylem] = useActionState<TopluDurum, FormData>(topluIslem, {});
  const [kategori, setKategori] = useState<string>(KATEGORILER[0]);

  /* Liste değişti (süzgeç, sayfa, arama): seçim artık o listeye ait değil. */
  const anahtar = mailIdleri.join(",");
  useEffect(() => {
    setSecili([]);
  }, [anahtar]);

  /* İşlem bitince seçim kalksın; yoksa aynı maillere ikinci kez basılabiliyor. */
  useEffect(() => {
    if (durum.tamam) setSecili([]);
  }, [durum.tamam]);

  /* Kutucuklar server-render edilmiş satırların içinde; buradan dinleniyorlar.
     Ayrı bir liste bileşeni yazmak, gelen kutusunun tamamını istemciye
     taşımak olurdu — sayfa JS'siz de çalışsın istiyoruz. */
  useEffect(() => {
    const kutular = () =>
      [...document.querySelectorAll<HTMLInputElement>("input.satir-secim")];

    const oku = () =>
      setSecili(kutular().filter((k) => k.checked).map((k) => Number(k.value)));

    const alan = document.querySelector(".liste-sutun") ?? document;
    alan.addEventListener("change", oku);
    return () => alan.removeEventListener("change", oku);
  }, []);

  useEffect(() => {
    /* Dışarıdan sıfırlandıysa kutucukları da temizle. */
    if (secili.length) return;
    document
      .querySelectorAll<HTMLInputElement>("input.satir-secim:checked")
      .forEach((k) => {
        k.checked = false;
      });
  }, [secili.length]);

  if (!secili.length) {
    return durum.tamam ? (
      <p className="toplu-sonuc">
        <Ikon ad="onay" boyut={14} />
        <span>{durum.tamam}</span>
      </p>
    ) : null;
  }

  return (
    <form className="toplu-cubuk" action={eylem}>
      {secili.map((id) => (
        <input key={id} type="hidden" name="secili" value={id} />
      ))}

      <span className="toplu-sayi">{secili.length} seçili</span>

      <span className="toplu-eylemler">
        <button className="kcip" type="submit" name="islem" value="sahiplen">
          Sahiplen
        </button>
        <button className="kcip" type="submit" name="islem" value="islemde">
          İşleme al
        </button>
        <button className="kcip" type="submit" name="islem" value="birak">
          Sahipliği bırak
        </button>
        <button className="kcip" type="submit" name="islem" value="kapat">
          Kapat
        </button>
      </span>

      <span className="toplu-kategori">
        <label className="gizli" htmlFor="toplu-kat">
          Kategori
        </label>
        <select
          id="toplu-kat"
          name="kategori"
          value={kategori}
          onChange={(e) => setKategori(e.target.value)}
        >
          {KATEGORILER.map((k) => (
            <option key={k} value={k}>
              {KATEGORI_AD[k]}
            </option>
          ))}
        </select>
        <button className="kcip" type="submit" name="islem" value="kategori">
          Uygula
        </button>
      </span>

      {durum.hata ? <span className="toplu-hata">{durum.hata}</span> : null}
    </form>
  );
}

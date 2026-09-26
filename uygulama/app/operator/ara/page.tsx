import Link from "next/link";
import { operatorArama } from "@/sunucu/db";
import { Ikon } from "../../bilesenler/Ikon";

/**
 * Operatör araması (madde 9).
 *
 * Dört kaynakta birden: firma, posta kutusu, destek talebi, demo talebi.
 * Sebebi, operatörün elinde çoğu zaman tek bir ipucu olması — bir adres, bir
 * firma adı, bir konu. Hangi ekranda aranacağını bilmek zorunda kalmamalı.
 *
 * Sorgu adreste (`?q=`): geri tuşu çalışıyor, sonuç paylaşılabiliyor ve form
 * JS'siz de gönderiliyor.
 */
export const dynamic = "force-dynamic";

const TUR_AD: Record<string, { ad: string; ikon: string }> = {
  firma: { ad: "Firma", ikon: "bina" },
  kutu: { ad: "Posta kutusu", ikon: "sunucu" },
  ticket: { ad: "Destek talebi", ikon: "soru" },
  talep: { ad: "Demo talebi", ikon: "zarf" },
};

export default async function Ara({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const metin = (q ?? "").trim();
  const sonuclar = metin.length >= 2 ? operatorArama(metin) : [];

  /* Türe göre öbekleniyor: karışık bir liste "neye baktığımı" kaybettiriyor. */
  const obekler = ["firma", "kutu", "ticket", "talep"]
    .map((t) => ({ tur: t, satirlar: sonuclar.filter((s) => s.tur === t) }))
    .filter((o) => o.satirlar.length);

  return (
    <div className="sayfa">
      <div className="sayfa-ust">
        <div>
          <h1>Ara</h1>
          <p>Firma, posta kutusu, destek talebi ve demo talebi — hepsi bir arada.</p>
        </div>
      </div>

      <form className="arac" action="/operator/ara">
        <div className="arama">
          <Ikon ad="ara" boyut={13} />
          <input
            type="search"
            name="q"
            defaultValue={metin}
            placeholder="Firma adı, e-posta adresi, konu…"
            aria-label="Ara"
            autoFocus
          />
        </div>
        <button className="dugme ufak ana" type="submit">
          Ara
        </button>
      </form>

      {metin.length >= 2 ? (
        obekler.length ? (
          obekler.map((o) => (
            <div key={o.tur}>
              <h2 className="bolum">
                {TUR_AD[o.tur]?.ad ?? o.tur}
                <span className="sayi">{o.satirlar.length}</span>
              </h2>
              <div className="kutu-listesi ara-liste">
                {o.satirlar.map((s) => (
                  <Link className="kutu-satiri" key={`${s.tur}-${s.id}`} href={s.yol}>
                    <Ikon ad={TUR_AD[s.tur]?.ikon ?? "liste"} boyut={14} />
                    <span className="ara-baslik">{s.baslik || "(adsız)"}</span>
                    <span className="ara-alt">{s.alt}</span>
                    <span className="ara-git">
                      <Ikon ad="sagok" boyut={13} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="talep-bos">
            <Ikon ad="ara" boyut={22} />
            <b>Sonuç yok</b>
            <span>
              &quot;{metin}&quot; için firma, kutu, destek talebi ya da demo talebi
              bulunamadı.
            </span>
          </div>
        )
      ) : (
        <p className="dip">En az iki harf yazın.</p>
      )}
    </div>
  );
}

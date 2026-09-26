"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  KARAKTER_ACIKLAMA,
  KARAKTER_AD,
  KARAKTER_ORNEK,
  KAYNAK_AD,
  OZEL_ONEK,
  type KarakterAlani,
} from "@/sunucu/bilgiSabitleri";
import { Ikon } from "../../bilesenler/Ikon";
import {
  cikarimiBaslat,
  kartKaydet,
  kartiSil,
  karakterKaydet,
  karakterMaddesiEkle,
  karakterMaddesiSil,
  oneriyiOnayla,
  oneriyiSil,
  type BilgiDurumu,
  type CikarimDurumu,
} from "./eylemler";

export type KarakterSatiri = {
  /** Hazır beşliden biri ya da yöneticinin eklediği madde (`ozel:` önekli). */
  alan: string;
  /** Yöneticinin eklediği maddenin başlığı; hazır alanlarda boş. */
  baslik: string;
  deger: string;
  kaynak: string;
  guncelleme: string;
  guncelleyen_ad: string | null;
};

export type KartSatiri = {
  id: number;
  baslik: string;
  icerik: string;
  kategori: string;
  kaynak: string;
  dayanak: string;
  guncelleme: string;
  guncelleyen_ad: string | null;
};

export type OneriSatiri = {
  id: number;
  tur: string;
  alan: string;
  baslik: string;
  icerik: string;
  kategori: string;
  dayanak: string;
};

export type KategoriSecenegi = { deger: string; ad: string };

function Kaydet({ etiket }: { etiket: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="dugme ana ufak" type="submit" disabled={pending}>
      {pending ? "Kaydediliyor…" : etiket}
    </button>
  );
}

function Sonuc({ durum }: { durum: BilgiDurumu }) {
  if (durum.tamam) {
    return (
      <span className="sonuc iyi">
        <Ikon ad="onay" boyut={15} />
        {durum.tamam}
      </span>
    );
  }
  if (durum.hata) {
    return (
      <span className="sonuc kotu">
        <Ikon ad="uyari" boyut={15} />
        {durum.hata}
      </span>
    );
  }
  return null;
}

/**
 * Karakterin tek alanı.
 *
 * Kapalıyken yazılı metin, açıkken kutu. Beş alanın beşini birden forma çevirip
 * ekranı bir ayar sayfasına döndürmek yerine: okunan bir metin, düzenlenebilir.
 */
export function KarakterAlaniKutusu({ satir }: { satir: KarakterSatiri }) {
  const [acik, setAcik] = useState(false);
  const [soruyor, setSoruyor] = useState(false);
  const [bekliyor, basla] = useTransition();
  const [durum, eylem] = useActionState<BilgiDurumu, FormData>(karakterKaydet, {});

  const dolu = Boolean(satir.deger.trim());
  /* Yöneticinin eklediği madde: başlığı kendi taşıyor, açıklaması yok ve
     silinebiliyor. Hazır beşli silinmiyor — boşaltılınca yerinde duruyor. */
  const ozel = satir.alan.startsWith(OZEL_ONEK);
  const ad = ozel ? satir.baslik : (KARAKTER_AD[satir.alan as KarakterAlani] ?? satir.alan);
  const aciklama = ozel ? "" : (KARAKTER_ACIKLAMA[satir.alan as KarakterAlani] ?? "");
  const ornek = ozel ? "" : (KARAKTER_ORNEK[satir.alan as KarakterAlani] ?? "");

  return (
    <div className={dolu ? "bd-alan" : "bd-alan bos"}>
      <div className="bd-alan-ust">
        <b>{ad}</b>
        {dolu ? (
          <span className="bd-kaynak">
            {KAYNAK_AD[satir.kaynak] ?? satir.kaynak}
            {satir.guncelleme ? ` · ${satir.guncelleme.slice(0, 10)}` : ""}
            {satir.guncelleyen_ad ? ` · ${satir.guncelleyen_ad}` : ""}
          </span>
        ) : (
          <span className="bd-kaynak bos">henüz yazılmadı</span>
        )}
        <span className="bd-eylem">
          <button className="dugme sade ufak" type="button" onClick={() => setAcik((a) => !a)}>
            {acik ? "Kapat" : dolu ? "Düzenle" : "Yaz"}
          </button>
          {ozel ? (
            soruyor ? (
              <>
                <button
                  className="dugme ufak"
                  type="button"
                  disabled={bekliyor}
                  onClick={() => basla(async () => void (await karakterMaddesiSil(satir.alan)))}
                >
                  Evet, sil
                </button>
                <button
                  className="dugme sade ufak"
                  type="button"
                  onClick={() => setSoruyor(false)}
                >
                  Vazgeç
                </button>
              </>
            ) : (
              <button
                className="dugme sade ufak"
                type="button"
                onClick={() => setSoruyor(true)}
              >
                Sil
              </button>
            )
          ) : null}
        </span>
      </div>

      {acik ? (
        <form action={eylem} className="bd-form">
          <input type="hidden" name="alan" value={satir.alan} />
          <label className="gizli" htmlFor={`k-${satir.alan}`}>
            {ad}
          </label>
          <textarea
            id={`k-${satir.alan}`}
            name="deger"
            rows={4}
            defaultValue={satir.deger}
            placeholder={ornek}
          />
          {aciklama ? <p className="bd-ipuc">{aciklama}</p> : null}
          <div className="form-alt-satir">
            <Kaydet etiket="Kaydet" />
            <button className="dugme sade ufak" type="button" onClick={() => setAcik(false)}>
              Vazgeç
            </button>
            <Sonuc durum={durum} />
          </div>
        </form>
      ) : dolu ? (
        <p className="bd-metin">{satir.deger}</p>
      ) : (
        <p className="bd-metin bos">{aciklama || "Bu madde boş; yazmak için sağdaki düğme."}</p>
      )}
    </div>
  );
}

function KartFormu({
  kart,
  kategoriler,
  kapat,
}: {
  kart?: KartSatiri;
  kategoriler: KategoriSecenegi[];
  kapat: () => void;
}) {
  const [durum, eylem] = useActionState<BilgiDurumu, FormData>(kartKaydet, {});

  return (
    <form className="bd-form" action={eylem}>
      <input type="hidden" name="id" value={kart?.id ?? 0} />

      <div className="bd-ikili">
        <div className={durum.alanlar?.baslik ? "form-satir hata" : "form-satir"}>
          <label htmlFor={`kart-baslik-${kart?.id ?? 0}`}>Başlık</label>
          <input
            id={`kart-baslik-${kart?.id ?? 0}`}
            name="baslik"
            defaultValue={kart?.baslik ?? ""}
            placeholder="Kargo süresi"
            maxLength={120}
            required
          />
          <span className="alan-hata">{durum.alanlar?.baslik ?? ""}</span>
        </div>

        <div className="form-satir">
          <label htmlFor={`kart-kat-${kart?.id ?? 0}`}>
            Kategori <span className="ops">— isteğe bağlı</span>
          </label>
          <select
            id={`kart-kat-${kart?.id ?? 0}`}
            name="kategori"
            defaultValue={kart?.kategori ?? ""}
          >
            <option value="">Kategorisiz</option>
            {kategoriler.map((k) => (
              <option key={k.deger} value={k.deger}>
                {k.ad}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={durum.alanlar?.icerik ? "form-satir hata" : "form-satir"}>
        <label htmlFor={`kart-icerik-${kart?.id ?? 0}`}>Bilginin kendisi</label>
        <textarea
          id={`kart-icerik-${kart?.id ?? 0}`}
          name="icerik"
          rows={4}
          defaultValue={kart?.icerik ?? ""}
          placeholder="Ankara'ya teslimat 5 iş günü; montaj dahil."
          required
        />
        <span className="alan-hata">{durum.alanlar?.icerik ?? ""}</span>
      </div>

      <div className="form-alt-satir">
        <Kaydet etiket={kart ? "Değişikliği kaydet" : "Kartı ekle"} />
        <button className="dugme sade ufak" type="button" onClick={kapat}>
          {durum.tamam ? "Kapat" : "Vazgeç"}
        </button>
        <Sonuc durum={durum} />
      </div>
    </form>
  );
}

/**
 * Kart bölümünün başlığı + ekleme.
 *
 * Başlık ve form aynı bileşende duruyor ama form başlığın **içinde** değil:
 * `margin-left:auto` ile başlık satırına konunca geniş ekranda sağda asılı
 * kalıyor, başlıkla arasında kocaman bir boşluk oluşuyordu (ekran görüntüsünde
 * görülen hata). Başlık satırında yalnız düğme var; form onun altında, tam
 * genişlikte açılıyor.
 */
export function KartBolumu({
  sayi,
  kategoriler,
}: {
  sayi: number;
  kategoriler: KategoriSecenegi[];
}) {
  const [acik, setAcik] = useState(false);

  return (
    <>
      <h2 className="bolum">
        Bilgi kartları
        <span className="sayi">{sayi}</span>
        {acik ? null : (
          <button className="dugme bolum-dugme" type="button" onClick={() => setAcik(true)}>
            <Ikon ad="kalem" boyut={15} />
            Kart ekle
          </button>
        )}
      </h2>

      {acik ? (
        <div className="kutu bd-kart bd-yeni">
          <div className="kutu-ust">
            <span className="kutu-ad">Yeni bilgi kartı</span>
          </div>
          <KartFormu kategoriler={kategoriler} kapat={() => setAcik(false)} />
        </div>
      ) : null}
    </>
  );
}

/**
 * Karakter bölümünün başlığı + yöneticinin kendi maddesi.
 *
 * Hazır beş alan her firmaya yetmiyor: birinin "kampanya dili", ötekinin
 * "bayi yazışması" diye bir başlığa ihtiyacı oluyor. Form yine başlığın
 * altında açılıyor, sağa asılmıyor.
 */
export function KarakterBolumu({ dolu, toplam }: { dolu: number; toplam: number }) {
  const [acik, setAcik] = useState(false);
  const [durum, eylem] = useActionState<BilgiDurumu, FormData>(karakterMaddesiEkle, {});

  return (
    <>
      <h2 className="bolum">
        Karakter
        <span className="sayi">
          {dolu}/{toplam}
        </span>
        {acik ? null : (
          <button className="dugme bolum-dugme" type="button" onClick={() => setAcik(true)}>
            <Ikon ad="kalem" boyut={15} />
            Madde ekle
          </button>
        )}
      </h2>

      {acik ? (
        <div className="kutu bd-kart bd-yeni">
          <div className="kutu-ust">
            <span className="kutu-ad">Yeni karakter maddesi</span>
          </div>
          <form className="bd-form" action={eylem}>
            <div className={durum.alanlar?.baslik ? "form-satir hata" : "form-satir"}>
              <label htmlFor="madde-baslik">Madde başlığı</label>
              <input
                id="madde-baslik"
                name="baslik"
                placeholder="Kampanya dili"
                maxLength={80}
                required
              />
              <span className="alan-hata">{durum.alanlar?.baslik ?? ""}</span>
            </div>

            <div className="form-satir">
              <label htmlFor="madde-deger">İçerik</label>
              <textarea
                id="madde-deger"
                name="deger"
                rows={3}
                placeholder="Kampanya maillerinde indirim oranı yazılmaz, kampanya sayfasına yönlendirilir."
              />
            </div>

            <div className="form-alt-satir">
              <Kaydet etiket="Maddeyi ekle" />
              <button className="dugme sade ufak" type="button" onClick={() => setAcik(false)}>
                {durum.tamam ? "Kapat" : "Vazgeç"}
              </button>
              <Sonuc durum={durum} />
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}

export function KartKutusu({
  kart,
  kategoriAd,
  kategoriler,
}: {
  kart: KartSatiri;
  kategoriAd: string;
  kategoriler: KategoriSecenegi[];
}) {
  const [acik, setAcik] = useState(false);
  const [soruyor, setSoruyor] = useState(false);
  const [bekliyor, basla] = useTransition();

  return (
    <div className="kutu bd-kart">
      <div className="kutu-ust">
        <span className="kutu-ad">{kart.baslik}</span>
        {kart.kategori ? <span className="rozet r-bilgi">{kategoriAd}</span> : null}
        <span className="bd-kaynak">
          {KAYNAK_AD[kart.kaynak] ?? kart.kaynak}
          {kart.guncelleyen_ad ? ` · ${kart.guncelleyen_ad}` : ""}
        </span>
        <span className="bd-eylem">
          <button className="dugme ufak" type="button" onClick={() => setAcik((a) => !a)}>
            {acik ? "Kapat" : "Düzenle"}
          </button>
          {soruyor ? (
            <>
              <button
                className="dugme ufak"
                type="button"
                disabled={bekliyor}
                onClick={() => basla(async () => void (await kartiSil(kart.id)))}
              >
                Evet, sil
              </button>
              <button
                className="dugme sade ufak"
                type="button"
                onClick={() => setSoruyor(false)}
              >
                Vazgeç
              </button>
            </>
          ) : (
            <button className="dugme sade ufak" type="button" onClick={() => setSoruyor(true)}>
              Sil
            </button>
          )}
        </span>
      </div>

      {acik ? (
        <KartFormu kart={kart} kategoriler={kategoriler} kapat={() => setAcik(false)} />
      ) : (
        <>
          <p className="bd-metin">{kart.icerik}</p>
          {kart.dayanak ? <p className="bd-dayanak">Dayanak: {kart.dayanak}</p> : null}
        </>
      )}
    </div>
  );
}

/** Onay bekleyen bir öneri. İki düğme: depoya al, ya da at. */
export function OneriKutusu({ oneri, baslik }: { oneri: OneriSatiri; baslik: string }) {
  const [bekliyor, basla] = useTransition();

  return (
    <div className="bd-oneri">
      <div className="bd-oneri-ust">
        <span className="rozet r-bilgi">{oneri.tur === "karakter" ? "Karakter" : "Kart"}</span>
        <b>{baslik}</b>
        <span className="bd-eylem">
          <button
            className="dugme ana ufak"
            type="button"
            disabled={bekliyor}
            onClick={() => basla(async () => void (await oneriyiOnayla(oneri.id)))}
          >
            <Ikon ad="onay" boyut={14} />
            Onayla
          </button>
          <button
            className="dugme sade ufak"
            type="button"
            disabled={bekliyor}
            onClick={() => basla(async () => void (await oneriyiSil(oneri.id)))}
          >
            At
          </button>
        </span>
      </div>
      <p className="bd-metin">{oneri.icerik}</p>
      {oneri.dayanak ? <p className="bd-dayanak">Dayanak: {oneri.dayanak}</p> : null}
    </div>
  );
}

/**
 * Çıkarım düğmesi.
 *
 * Sonucu olduğu gibi yazıyor: kaç mail okundu, kaç öneri çıktı, ya da neden
 * çıkmadı. "Tamamlandı" deyip geçmek, hiçbir şey bulunmadığı hâlde iş
 * yapılmış izlenimi verirdi.
 */
export function CikarimDugmesi({ engel }: { engel?: string }) {
  const [bekliyor, basla] = useTransition();
  const [durum, setDurum] = useState<CikarimDurumu>({});

  if (engel) {
    return (
      <p className="bd-kapali">
        <Ikon ad="bilgi" boyut={15} />
        {engel}
      </p>
    );
  }

  return (
    <div className="bd-cikarim">
      <button
        className="dugme ana"
        type="button"
        disabled={bekliyor}
        onClick={() =>
          basla(async () => {
            setDurum({});
            setDurum(await cikarimiBaslat());
          })
        }
      >
        <Ikon ad="yenile" boyut={15} />
        {bekliyor ? "Mailler okunuyor…" : "Maillerden çıkar"}
      </button>

      {durum.tamam ? (
        <span className="sonuc iyi">
          <Ikon ad="onay" boyut={15} />
          {durum.tamam}
        </span>
      ) : null}
      {durum.bilgi ? (
        <span className="sonuc">
          <Ikon ad="bilgi" boyut={15} />
          {durum.bilgi}
        </span>
      ) : null}
      {durum.hata ? (
        <span className="sonuc kotu">
          <Ikon ad="uyari" boyut={15} />
          {durum.hata}
        </span>
      ) : null}
    </div>
  );
}

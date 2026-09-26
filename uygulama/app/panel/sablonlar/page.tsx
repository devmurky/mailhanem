import { KATEGORILER, KATEGORI_AD, sablonlariGetir, type Kategori } from "@/sunucu/db";
import { Ikon } from "../../bilesenler/Ikon";
import { panelOturumu } from "../yetki";
import { SablonSatiri, YeniSablon } from "./SablonDuzenle";

export const dynamic = "force-dynamic";

export default async function Sablonlar() {
  const { kullanici, firmaId } = await panelOturumu();
  const sablonlar = sablonlariGetir(firmaId);
  const duzenlenebilir = kullanici.rol === "sahip" || kullanici.rol === "yonetici";

  const kategoriler = KATEGORILER.map((k) => ({ deger: k, ad: KATEGORI_AD[k] }));

  return (
    <div className="sayfa">
      <div className="sayfa-ust">
        <div>
          <h1>Yanıt şablonları</h1>
          <p>Sık yazdığınız cevaplar. Yanıt kutusunda tek tıkla eklenir.</p>
        </div>
        {duzenlenebilir ? (
          <span className="ust-ekle">
            <YeniSablon kategoriler={kategoriler} />
          </span>
        ) : null}
      </div>

      {sablonlar.length ? (
        <div className="sablon-liste">
          {sablonlar.map((s) => (
            <SablonSatiri
              key={s.id}
              sablon={{
                id: s.id,
                ad: s.ad,
                kategori: s.kategori,
                metin: s.metin,
                kullanim: s.kullanim,
              }}
              kategoriAd={s.kategori ? (KATEGORI_AD[s.kategori as Kategori] ?? s.kategori) : ""}
              kategoriler={kategoriler}
              duzenlenebilir={duzenlenebilir}
            />
          ))}
        </div>
      ) : (
        <div className="talep-bos">
          <Ikon ad="kalem" boyut={22} />
          <b>Henüz şablon yok</b>
          <span>
            {duzenlenebilir
              ? "Aynı cevabı ikinci kez yazdığınızda şablona çevirin."
              : "Şablonları firma yöneticiniz ekler."}
          </span>
        </div>
      )}

      <div className="kutu-bilgi">
        <span className="ikn">
          <Ikon ad="bilgi" boyut={16} />
        </span>
        <span>
          <b>Şablon kendiliğinden gönderilmez.</b> Yanıt kutusuna metni koyar, orada
          düzenlersiniz; göndermeden önce son söz sizde. Yer tutucular
          (<code>{"{ad}"}</code>, <code>{"{konu}"}</code>…) eklerken doldurulur —
          tanımadığımız bir yer tutucu olduğu gibi kalır, sessizce silinmez.
        </span>
      </div>
    </div>
  );
}

import Link from "next/link";
import {
  KATEGORILER,
  KATEGORI_AD,
  YONLENDIRME_TIP_AD,
  firmaKullanicilari,
  gelenSay,
  yonlendirmeleriGetir,
  type Kategori,
  type YonlendirmeTipi,
} from "@/sunucu/db";
import { Ikon } from "../../bilesenler/Ikon";
import { panelOturumu } from "../yetki";
import { GecmiseUygula, KuralEylemleri, YeniKural } from "./KuralDuzenle";

export const dynamic = "force-dynamic";

export default async function Yonlendirme() {
  const { kullanici, firmaId } = await panelOturumu();
  const kurallar = yonlendirmeleriGetir(firmaId);
  const duzenlenebilir = kullanici.rol === "sahip" || kullanici.rol === "yonetici";

  const kategoriler = KATEGORILER.map((k) => ({ deger: k, ad: KATEGORI_AD[k] }));
  const kisiler = firmaKullanicilari(firmaId, true).map((k) => ({
    deger: String(k.id),
    ad: k.ad || k.eposta,
  }));

  const kategorisiz = gelenSay(firmaId, { kategoriYok: true });
  const sahipsiz = gelenSay(firmaId, { sahipsiz: true });

  return (
    <div className="sayfa">
      <div className="sayfa-ust">
        <div>
          <h1>Kategoriler ve yönlendirme</h1>
          <p>Gelen maili kategoriye ve kişiye bağlayan kurallar. İlk eşleşen uygulanır.</p>
        </div>
        {duzenlenebilir ? (
          <span className="ust-ekle">
            <YeniKural kategoriler={kategoriler} kisiler={kisiler} />
          </span>
        ) : null}
      </div>

      <dl className="kartlar">
        <div className="skart">
          <dt>Kural</dt>
          <div className="deger">
            <dd>{kurallar.length}</dd>
          </div>
          <div className="not">{kurallar.filter((k) => k.etkin).length} tanesi çalışıyor</div>
        </div>
        <div className="skart">
          <dt>Toplam eşleşme</dt>
          <div className="deger">
            <dd>{kurallar.reduce((t, k) => t + k.eslesme, 0)}</dd>
          </div>
          <div className="not">kurulduklarından beri</div>
        </div>
        <div className="skart">
          <dt>Kategorisiz mail</dt>
          <div className="deger">
            <dd>{kategorisiz}</dd>
          </div>
          <div className="not">
            <Link href="/panel">gelen kutusunda</Link>
          </div>
        </div>
        <div className="skart">
          <dt>Sahipsiz mail</dt>
          <div className="deger">
            <dd style={sahipsiz ? { color: "var(--uyari)" } : undefined}>{sahipsiz}</dd>
          </div>
          <div className="not">kimse üstlenmedi</div>
        </div>
      </dl>

      <h2 className="bolum">
        Kurallar
        <span className="sayi">{kurallar.length}</span>
        {duzenlenebilir && kurallar.length ? (
          <span style={{ marginLeft: "auto" }}>
            <GecmiseUygula />
          </span>
        ) : null}
      </h2>

      {kurallar.length ? (
        <div className="kural-liste">
          {kurallar.map((k, i) => (
            <div className={k.etkin ? "kural-satir" : "kural-satir duraklatildi"} key={k.id}>
              <span className="kural-sira">{i + 1}</span>
              <div className="kural-ne">
                <span className="kural-kosul">
                  <span className="et">{YONLENDIRME_TIP_AD[k.tip as YonlendirmeTipi] ?? k.tip}</span>
                  <code>{k.kalip}</code>
                </span>
                <span className="kural-sonuc">
                  <Ikon ad="sagok" boyut={14} />
                  {k.kategori ? (
                    <span className="rozet r-bilgi">
                      {KATEGORI_AD[k.kategori as Kategori] ?? k.kategori}
                    </span>
                  ) : null}
                  {k.sahip_ad ? <span className="rozet r-kapali">{k.sahip_ad}</span> : null}
                  {!k.kategori && !k.sahip_ad ? (
                    <span className="rozet r-uyari">sonucu kalmamış</span>
                  ) : null}
                </span>
              </div>
              <span className="kural-sayac">{k.eslesme} eşleşme</span>
              {duzenlenebilir ? (
                <KuralEylemleri
                  id={k.id}
                  etkin={Boolean(k.etkin)}
                  ilkMi={i === 0}
                  sonMu={i === kurallar.length - 1}
                />
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="talep-bos">
          <Ikon ad="liste" boyut={22} />
          <b>Henüz kural yok</b>
          <span>
            {duzenlenebilir
              ? "Aynı gönderenden gelen maili her seferinde aynı kişiye atıyorsanız, onu kurala çevirin."
              : "Kuralları firma yöneticiniz kurar."}
          </span>
        </div>
      )}

      <div className="kutu-bilgi">
        <span className="ikn">
          <Ikon ad="bilgi" boyut={16} />
        </span>
        <span>
          <b>Kural dolu alanın üstüne yazmaz.</b> Birinin elle seçtiği kategori ya da
          sahiplendiği mail, kural yüzünden değişmez — kurallar yalnızca boş bırakılanı
          doldurur. Eleme kuralları (bülten, no-reply, otomatik yanıt) burada değil;
          onlar maili panele hiç sokmadan, çekim sırasında çalışır. Yapay zekâ
          sınıflandırması bağlandığında bu kurallar kalacak: elle kurulmuş bir kural
          modelin tahmininden kesindir, model yalnızca kuralın tutmadığı maile bakacak.
        </span>
      </div>
    </div>
  );
}

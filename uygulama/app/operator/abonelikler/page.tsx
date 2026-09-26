import {
  FIRMA_DURUMLARI,
  FIRMA_DURUM_AD,
  PLANLAR,
  PLAN_AD,
  firmaOzetleri,
  gelirHareketi,
  gelirSerisi,
  yaklasanYenilemeler,
} from "@/sunucu/db";
import { Ikon } from "../../bilesenler/Ikon";
import { Kivilcim } from "../Kivilcim";
import { para } from "../MusteriTablosu";
import { AbonelikDuzenle } from "./AbonelikSatiri";
import { Selale } from "./Selale";

/**
 * Abonelikler - prototipteki aboneHTML() ekrani.
 *
 * Prototipin duzeni: dort kart, gelir selalesi, yaklasan yenilemeler, plan
 * dagilimi, altinda firma listesi. Firma duzenleme (plan/durum/ucret) zaten
 * calisiyordu ve korundu - prototipte o yoktu, burada gercek bir is yapiyor.
 *
 * **Selale gercek (madde 4).** abonelik_gecmisi tablosundan hesaplaniyor:
 * her firmanin donem basindaki ve bugunku aboneligi karsilastirilip fark dort
 * kaleme ayriliyor. Toplam gelir tek basina "artti" der; bu ayrim **neden**
 * arttigini soyler. Gecmis kaydi yoksa selale cizilmiyor, sebebi yaziliyor.
 *
 * **Tahsilat hala bagli degil**, o yuzden prototipteki "tahsil edilen" ve
 * "churn" kartlarinin yerinde gercek sorgudan gelen sayilar var.
 */
export const dynamic = "force-dynamic";

const DURUM_ROZET: Record<string, string> = {
  etkin: "r-bitti",
  deneme: "r-bilgi",
  duraklatildi: "r-uyari",
  ayrildi: "r-kapali",
};

export function lira(kurus: number): string {
  return (kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2 });
}

export default async function Abonelikler() {
  const firmalar = firmaOzetleri();
  const planlar = PLANLAR.map((p) => ({ deger: p, ad: PLAN_AD[p] ?? p }));
  const durumlar = FIRMA_DURUMLARI.map((d) => ({ deger: d, ad: FIRMA_DURUM_AD[d] ?? d }));

  const odeyen = firmalar.filter((f) => f.durum === "etkin" && f.aylik_kurus > 0);
  const aylikToplam = odeyen.reduce((t, f) => t + f.aylik_kurus, 0);
  const ucretsiz = firmalar.filter((f) => f.durum === "etkin" && f.aylik_kurus === 0);

  const hareket = gelirHareketi();
  const seri = gelirSerisi();
  const yenilemeler = yaklasanYenilemeler();
  const degisim =
    hareket.baz > 0 ? Math.round(((hareket.son - hareket.baz) / hareket.baz) * 100) : 0;

  return (
    <div className="sayfa">
      <div className="sayfa-ust">
        <div>
          <h1>Abonelikler</h1>
          <p>Firmaların planı, durumu ve aylık ücreti.</p>
        </div>
      </div>

      <dl className="kartlar">
        <div className="skart">
          <dt>Aylık gelir</dt>
          <div className="deger">
            <dd>{para(aylikToplam)}</dd>
            {seri.length > 1 ? (
              <span className="kivilcim">
                <Kivilcim dizi={seri} renk="var(--olumlu)" />
              </span>
            ) : null}
          </div>
          <div className="not">
            {hareket.gecmisYok ? (
              `${odeyen.length} ödeyen firma`
            ) : (
              <>
                <span className={degisim >= 0 ? "yon iyi" : "yon kotu"}>
                  {degisim >= 0 ? "+" : ""}
                  {degisim}%
                </span>
                son 30 günde
              </>
            )}
          </div>
        </div>
        <div className="skart">
          <dt>Etkin firma</dt>
          <div className="deger">
            <dd>{firmalar.filter((f) => f.durum === "etkin").length}</dd>
          </div>
          <div className="not">{firmalar.length} kayıtlı firmadan</div>
        </div>
        <div className="skart">
          <dt>Denemede</dt>
          <div className="deger">
            <dd>{firmalar.filter((f) => f.durum === "deneme").length}</dd>
          </div>
          <div className="not">henüz ücretlenmiyor</div>
        </div>
        <div className="skart">
          <dt>Ücreti yazılmamış</dt>
          <div className="deger">
            <dd style={ucretsiz.length ? { color: "var(--uyari)" } : undefined}>
              {ucretsiz.length}
            </dd>
          </div>
          <div className="not">etkin ama ücreti 0</div>
        </div>
      </dl>

      <div className="pizgara p32">
        <div className="kt">
          <div className="kt-ust">
            <span className="kt-ad">Gelir nasıl değişti</span>
            <span className="kt-not">son 30 gün</span>
          </div>
          <div className="kt-ic">
            <Selale hareket={hareket} />
            <p className="dip">
              {hareket.gecmisYok ? (
                <>
                  <b>Henüz geçmiş yok.</b> Bu şelale <code>abonelik_gecmisi</code>{" "}
                  tablosundan çiziliyor ve tablo abonelik her değiştirildiğinde
                  doluyor. İlk plan ya da ücret değişikliğinden sonra gelirin{" "}
                  <b>neden</b> değiştiği burada görünecek.
                </>
              ) : (
                <>
                  Toplam gelir tek başına &quot;arttı&quot; der; bu ayrım <b>neden</b>{" "}
                  arttığını söyler. Büyüme yeni müşteriden geliyorsa satış, plan
                  yükseltmesinden geliyorsa ürün kendi içinde derinleşiyor demektir.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="kt">
          <div className="kt-ust">
            <span className="kt-ad">Yaklaşan yenilemeler</span>
          </div>
          <div className="kt-ic">
            {yenilemeler.length ? (
              yenilemeler.map((y) => (
                <div className="tak-satir" key={y.firmaId}>
                  <span className="gun">{y.gun === 0 ? "bugün" : `${y.gun} gün`}</span>
                  <span className="frm">{y.ad}</span>
                  {y.durum === "deneme" ? (
                    <span className="plan p-deneme">deneme</span>
                  ) : null}
                  <span className="tut">{para(y.kurus)}</span>
                </div>
              ))
            ) : (
              <p className="dip">Ücreti yazılmış etkin firma yok.</p>
            )}
            <p className="dip">
              Ayrı bir yenileme tarihi alanı yok; tarih <b>aboneliğin başladığı günün
              aylık yıldönümünden</b> türetiliyor. Tahsilat bağlandığında sağlayıcının
              kendi tarihi buranın yerini alacak.
            </p>
          </div>
        </div>
      </div>

      <h2 className="bolum">
        Plan dağılımı
        <span className="aciklayici">ücret kuruş olarak saklanır</span>
      </h2>

      <div className="kt plan-dagilim">
        <div className="kt-ic">
          {PLANLAR.map((pl) => {
            const grup = firmalar.filter((f) => f.plan === pl);
            const gelir = grup.reduce((t, f) => t + (f.aylik_kurus ?? 0), 0);
            return (
              <div className="mal-satir" key={pl}>
                <span className="ad">
                  <span className={`plan p-${pl}`}>{PLAN_AD[pl] ?? pl}</span>
                </span>
                <span className="ek">{grup.length} müşteri</span>
                <span className="tut">{gelir ? para(gelir) : "—"}</span>
              </div>
            );
          })}
        </div>
      </div>

      <h2 className="bolum">
        Firmalar
        <span className="sayi">{firmalar.length}</span>
      </h2>

      {firmalar.length ? (
        <div className="kural-liste">
          {firmalar.map((f) => (
            <div className="kutu abonelik-kart" key={f.id}>
              <div className="hesap-ust" style={{ marginBottom: 12 }}>
                <span className="av kare">{f.ad.trim().charAt(0).toUpperCase()}</span>
                <div className="hesap-kim">
                  <b>{f.ad}</b>
                  <span>
                    {f.alan_adi}
                    <span className="ayrac">·</span>
                    {f.kutu} kutu
                    <span className="ayrac">·</span>
                    {f.kullanici} kullanıcı
                    <span className="ayrac">·</span>
                    {f.olusma.slice(0, 10)} tarihinde eklendi
                  </span>
                </div>
                <span className={`rozet ${DURUM_ROZET[f.durum] ?? "r-kapali"}`}>
                  {FIRMA_DURUM_AD[f.durum] ?? f.durum}
                </span>
                <span className="rozet r-kapali">{PLAN_AD[f.plan] ?? f.plan}</span>
                <span className="abonelik-ucret">
                  {f.aylik_kurus ? `${lira(f.aylik_kurus)} ₺/ay` : "ücret yazılmadı"}
                </span>
                <AbonelikDuzenle
                  firmaId={f.id}
                  plan={f.plan}
                  durum={f.durum}
                  aylikKurus={f.aylik_kurus}
                  planlar={planlar}
                  durumlar={durumlar}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="talep-bos">
          <Ikon ad="bina" boyut={22} />
          <b>Kayıtlı firma yok</b>
          <span>İlk müşteri kurulduğunda burada görünür.</span>
        </div>
      )}

      <div className="kutu-bilgi">
        <span className="ikn">
          <Ikon ad="bilgi" boyut={16} />
        </span>
        <span>
          <b>Burası fatura kesmiyor.</b> Tahsilat bağlı değil; bu ekran ne
          anlaştığınızın kaydı ve gelirin toplamı. Ücret <b>kuruş</b> olarak saklanır,
          ondalıklı sayı kullanılmaz — toplamada kuruş kaybolmasın diye.
        </span>
      </div>
    </div>
  );
}

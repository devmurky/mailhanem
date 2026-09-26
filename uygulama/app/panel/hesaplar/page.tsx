import { kutuOzetleri, sonCekimler } from "@/sunucu/db";
import { durum as zamanlayiciDurumu } from "@/sunucu/zamanlayici";
import { KutuFormu, ParolaFormu } from "./KutuFormu";
import { Ikon } from "../../bilesenler/Ikon";
import { kurulumGorur, panelOturumu } from "../yetki";

export const dynamic = "force-dynamic";

type Rozet = { sinif: string; ad: string };

const KURULMADI: Rozet = { sinif: "r-kapali", ad: "Kurulmadı" };

const DURUM_ROZET: Record<string, Rozet> = {
  iyi: { sinif: "r-bitti", ad: "Bağlı" },
  yavas: { sinif: "r-uyari", ad: "Yavaş" },
  kopuk: { sinif: "r-kritik", ad: "Bağlantı kopuk" },
  kurulmadi: KURULMADI,
};

export default async function Hesaplar() {
  const { kullanici, firmaId } = await panelOturumu();
  const kutular = kutuOzetleri(firmaId);
  const ayrinti = kurulumGorur(kullanici);

  const kendiKutulari = new Set(kutular.map((k) => k.id));
  const cekimler = sonCekimler(30).filter((c) => kendiKutulari.has(c.kutu_id)).slice(0, 6);
  const kopuk = kutular.filter((k) => k.durum === "kopuk");
  const zaman = zamanlayiciDurumu();

  return (
    <div className="sayfa">
      <div className="sayfa-ust">
        <div>
          <h1>Mail hesapları</h1>
          <p>Panelin okuduğu posta kutuları ve bağlantılarının durumu.</p>
        </div>
        {ayrinti ? (
          <span className="ust-ekle">
            <KutuFormu />
          </span>
        ) : null}
      </div>

      {kopuk.length ? (
        <div className="kutu-uyari" style={{ marginTop: 0, marginBottom: 22 }}>
          <span className="ikn">
            <Ikon ad="uyari" boyut={16} />
          </span>
          <span>
            <b>{kopuk[0]!.adres}</b> bağlantısı kopuk görünüyor. Bu kutuya gelen mailler
            panele düşmüyor. Parola değiştiyse kurulum ekibinizin yeniden bağlaması gerekir.
          </span>
        </div>
      ) : null}

      {kutular.length ? (
        <div className="hesap-liste">
          {kutular.map((k) => {
            const r = DURUM_ROZET[k.durum] ?? KURULMADI;
            return (
              <div className="kutu hesap-kart" key={k.id}>
                <div className="hesap-ust">
                  <span className="av kare">
                    <Ikon ad="zarf" boyut={17} />
                  </span>
                  <div className="hesap-kim">
                    <b>{k.adres}</b>
                    <span>
                      {k.saglayici || "sağlayıcı yazılmadı"}
                      {ayrinti && k.imap_sunucu ? (
                        <>
                          <span className="ayrac">·</span>
                          <code>
                            {k.imap_sunucu}:{k.imap_port}
                          </code>
                        </>
                      ) : null}
                    </span>
                  </div>
                  <span className={`rozet ${r.sinif}`}>{r.ad}</span>
                </div>

                {ayrinti && k.durum === "kopuk" ? (
                  <div className="kutu-uyari" style={{ marginTop: 0, marginBottom: 16 }}>
                    <span className="ikn">
                      <Ikon ad="uyari" boyut={16} />
                    </span>
                    <span>
                      Bu kutuya bağlanılamıyor. En sık sebep parola değişikliği.
                      <ParolaFormu kutuId={k.id} adres={k.adres} />
                    </span>
                  </div>
                ) : null}

                <dl className="hesap-sayilar">
                  <div>
                    <dt>Gelen kutusunda</dt>
                    <dd>{k.gelen}</dd>
                  </div>
                  <div>
                    <dt>Elenen</dt>
                    <dd>{k.elenen}</dd>
                  </div>
                  <div>
                    <dt>Toplam çekilen</dt>
                    <dd>{k.toplam}</dd>
                  </div>
                  <div>
                    <dt>Son çekim</dt>
                    <dd className="ufak">{k.son_cekim ? k.son_cekim.slice(0, 16) : "hiç"}</dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="talep-bos">
          <Ikon ad="zarf" boyut={22} />
          <b>Henüz posta kutusu bağlı değil</b>
          <span>Kutu bağlama, kurulum görüşmesinde birlikte yapılıyor.</span>
        </div>
      )}

      {cekimler.length ? (
        <>
          <h2 className="bolum">Son çekimler</h2>
          <div className="liste">
            {cekimler.map((c) => (
              <div className="liste-satir" key={c.id}>
                <span className={`nb ${c.hata ? "kopuk" : ""}`} />
                <span className="liste-ad">
                  <b>{c.adres}</b>
                  <small>
                    {c.hata
                      ? c.hata
                      : `${c.bulunan} bulundu · ${c.yeni} yeni · ${c.elenen} elendi`}
                  </small>
                </span>
                <span className="liste-son">{c.baslangic.slice(0, 16)}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div className="kutu-bilgi">
        <span className="ikn">
          <Ikon ad="bilgi" boyut={16} />
        </span>
        <span>
          <b>Mailleriniz kendi sunucunuzda kalır.</b> Panel kutuyu salt okunur açar:
          maili okundu işaretlemez, taşımaz, silmez. Parola AES-256-GCM ile
          şifrelenerek saklanır ve bir daha panele gösterilmez. Bağlı bir kutuyu
          kaldırmak bu ekranda yok — kutuyla birlikte o kutunun bütün mail kaydı
          da silineceği için kurulum ekibinizden geçiyor.{" "}
          {zaman.acik
            ? `Kutular ${zaman.aralik} dakikada bir taranıyor.`
            : "Otomatik tarama şu an kapalı; turları kurulum ekibiniz başlatıyor."}
        </span>
      </div>
    </div>
  );
}

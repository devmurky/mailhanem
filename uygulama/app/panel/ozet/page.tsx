import Link from "next/link";
import {
  DURUMLAR,
  DURUM_AD,
  GECIKME_SAAT,
  KATEGORILER,
  KATEGORI_AD,
  bugunGelen,
  bugunYanit,
  durumDagilimi,
  gecikenSay,
  gelenKutusu,
  gelenSay,
  kategoriDagilimi,
  type Kategori,
  type MailDurum,
} from "@/sunucu/db";
import { Ikon } from "../../bilesenler/Ikon";
import { kurulumGorur, panelOturumu } from "../yetki";
import { Halka, type Dilim } from "./Halka";

export const dynamic = "force-dynamic";

/** Panelin jetonlarından; grafik için yeni renk uydurulmadı. */
const DURUM_RENK: Record<string, string> = {
  yeni: "var(--murekkep)",
  islemde: "var(--uyari)",
  yanitlandi: "var(--olumlu)",
  kapandi: "var(--ayrac)",
};

const KATEGORI_RENK: Record<string, string> = {
  satis: "var(--murekkep)",
  destek: "var(--olumlu)",
  fatura: "var(--uyari)",
  sikayet: "var(--kritik)",
  diger: "var(--ayrac)",
  kategorisiz: "var(--cizgi2)",
};

export default async function GenelBakis() {
  const { kullanici, firmaId } = await panelOturumu();

  const durumlar = durumDagilimi(firmaId);
  const kategoriler = kategoriDagilimi(firmaId);
  const toplam = gelenSay(firmaId);

  const sahipsiz = gelenSay(firmaId, { sahipsiz: true });
  const bana = gelenSay(firmaId, { sahipId: kullanici.id });
  const geciken = gecikenSay(firmaId);
  const bugun = bugunGelen(firmaId);
  const yanitlanan = bugunYanit(firmaId);

  const sonMailler = gelenKutusu(firmaId).slice(0, 6);
  /* Bilgi deposu yönetim ekranı; personele bağlantı göstermiyoruz (sayfa da
     ona kapalı, bağlantı tıklanınca gelen kutusuna düşerdi). */
  const bilgiGorur = kurulumGorur(kullanici);

  const dilimler: Dilim[] = DURUMLAR.map((d) => ({
    ad: DURUM_AD[d as MailDurum],
    adet: durumlar[d] ?? 0,
    renk: DURUM_RENK[d] ?? "var(--ayrac)",
  }));

  /* Kategorisiz de bir kategori kadar gerçek; listeden düşürmek onu
     görünmez yapardı ve "neden toplam tutmuyor" sorusunu doğururdu. */
  const katSatirlari = [...KATEGORILER, "kategorisiz"].map((k) => ({
    anahtar: k,
    ad: k === "kategorisiz" ? "Kategorisiz" : (KATEGORI_AD[k as Kategori] ?? k),
    adet: kategoriler[k] ?? 0,
    renk: KATEGORI_RENK[k] ?? "var(--ayrac)",
  }));
  const katToplam = katSatirlari.reduce((t, k) => t + k.adet, 0);

  return (
    <div className="sayfa">
      <div className="sayfa-ust">
        <div>
          <h1>Genel bakış</h1>
          <p>Kutunun bugünkü hâli. Önce bekleyenler.</p>
        </div>
      </div>

      <dl className="kartlar">
        <div className="skart">
          <dt>Sahipsiz</dt>
          <div className="deger">
            <dd style={sahipsiz ? { color: "var(--uyari)" } : undefined}>{sahipsiz}</dd>
          </div>
          <div className="not">
            <Link href="/panel?sekme=sahipsiz">kimse üstlenmedi</Link>
          </div>
        </div>
        <div className="skart">
          <dt>Geciken</dt>
          <div className="deger">
            <dd style={geciken ? { color: "var(--kritik)" } : undefined}>{geciken}</dd>
          </div>
          <div className="not">
            <Link href="/panel?sekme=geciken">{GECIKME_SAAT} saatten uzun</Link>
          </div>
        </div>
        <div className="skart">
          <dt>Bana atanan</dt>
          <div className="deger">
            <dd>{bana}</dd>
          </div>
          <div className="not">
            <Link href="/panel?sekme=bana">{kullanici.ad || kullanici.eposta}</Link>
          </div>
        </div>
        <div className="skart">
          <dt>Son 24 saat</dt>
          <div className="deger">
            <dd>{bugun}</dd>
          </div>
          <div className="not">
            {yanitlanan} yanıt gönderildi
          </div>
        </div>
      </dl>

      <div className="izgara-iki">
        <div className="kutu">
          <div className="kutu-ust">
            <Ikon ad="saat" boyut={14} />
            <span className="kutu-ad">Durum dağılımı</span>
            <span className="kutu-not">{toplam} mail</span>
          </div>
          {toplam ? (
            <Halka dilimler={dilimler} toplam={toplam} altYazi="mail" />
          ) : (
            <p className="kutu-not-metin" style={{ marginTop: 0 }}>
              Kutuda henüz mail yok. Çekim yapıldıkça burası dolacak.
            </p>
          )}
        </div>

        <div className="kutu">
          <div className="kutu-ust">
            <Ikon ad="grafik" boyut={14} />
            <span className="kutu-ad">Kategori dağılımı</span>
            <span className="kutu-not">{katToplam} mail</span>
          </div>
          {katToplam ? (
            <div className="dagilim">
              {katSatirlari.map((k) => (
                <div key={k.anahtar}>
                  <div className="dag-ust">
                    <span className="dag-ad">{k.ad}</span>
                    <span className="dag-say">{k.adet} mail</span>
                    <span className="dag-yuzde">
                      %{Math.round((k.adet / katToplam) * 100)}
                    </span>
                  </div>
                  <div className="ray">
                    <i
                      style={{
                        width: `${(k.adet / katToplam) * 100}%`,
                        background: k.renk,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="kutu-not-metin" style={{ marginTop: 0 }}>
              Kutuda henüz mail yok.
            </p>
          )}
        </div>
      </div>

      <h2 className="bolum">
        Son mailler
        <span className="sayi">{sahipsiz} sahipsiz</span>
        <span style={{ marginLeft: "auto" }}>
          <Link className="dugme ufak" href="/panel">
            Gelen kutusu
          </Link>
        </span>
      </h2>

      {sonMailler.length ? (
        <div className="triyaj">
          {sonMailler.map((m) => (
            <Link className="talep-satir" key={m.id} href={`/panel?mail=${m.id}`}>
              <span className="av kare">
                {(m.gonderen_ad || m.gonderen).trim().charAt(0).toUpperCase()}
              </span>
              <div className="talep-ne">
                <span className="talep-kim">
                  <b>{m.konu || "(konu yok)"}</b>
                  <span className="ad">{m.gonderen_ad || m.gonderen}</span>
                </span>
                <span className="talep-bilgi">
                  <span>{m.kutu_adres}</span>
                  <span className="ayrac">·</span>
                  <span>{m.sahip_ad ? `${m.sahip_ad} üzerinde` : "sahipsiz"}</span>
                </span>
              </div>
              <span className="sure">{m.tarih.slice(0, 16)}</span>
              <span
                className={
                  m.durum === "kapandi" || m.durum === "yanitlandi"
                    ? "rozet r-bitti"
                    : m.durum === "islemde"
                      ? "rozet r-uyari"
                      : "rozet r-kapali"
                }
              >
                {DURUM_AD[m.durum as MailDurum] ?? m.durum}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="talep-bos">
          <Ikon ad="zarf" boyut={22} />
          <b>Gelen kutusu boş</b>
          <span>Kutulardan çekilen mailler kuraldan geçtikçe burada görünür.</span>
        </div>
      )}

      {/* Prototipteki "onay durumu" halkasının gerçek karşılığı burada yok:
          taslak diye bir kayıt henüz üretilmiyor. Sayı uydurmak yerine ne
          olacağını söylüyoruz. */}
      <div className="kutu yer-tutucu">
        <div className="kutu-ust">
          <Ikon ad="soru" boyut={14} />
          <span className="kutu-ad">Yanıt taslakları</span>
          <span className="rozet r-kapali">henüz yok</span>
        </div>
        <p className="kutu-not-metin" style={{ marginTop: 0 }}>
          Yapay zekâ adımı bağlandığında burada <b>onay bekleyen taslak sayısı</b>,
          gönderilen ve reddedilenlerin oranı ve modelin güven düzeyi görünecek.
          Şu an taslak üretilmediği için burada gösterilecek bir sayı yok —
          sıfır yazmak &quot;bekleyen taslağınız yok&quot; demek olurdu, oysa
          özellik hiç çalışmıyor.
        </p>
        {/* Depo o güne hazırlanan tek somut şey; yönetici görüyorsa bağlantı da
            görsün. Personelde sayfa kapalı olduğu için bağlantı da çıkmıyor. */}
        {bilgiGorur ? (
          <p className="kutu-not-metin">
            Bugünden yapılabilecek şey <Link href="/panel/bilgi">Bilgi Deposu</Link>&apos;nu
            doldurmak: taslak adımı bağlandığında model önce oradan okuyacak.
          </p>
        ) : null}
      </div>
    </div>
  );
}

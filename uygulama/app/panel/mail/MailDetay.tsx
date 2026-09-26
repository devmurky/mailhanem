import Link from "next/link";
import {
  DURUMLAR,
  DURUM_AD,
  KATEGORILER,
  KATEGORI_AD,
  firmaKullanicilari,
  firmaKutusu,
  gelenKutusu,
  konusmaMailleri,
  konusmaYanitlari,
  mailGetir,
  mailEkleri,
  mailNotlari,
  sablonlariGetir,
  taslakGetir,
  type MailDurum,
} from "@/sunucu/db";
import { boyutYaz } from "@/sunucu/ekDosya";
import { KUYRUK_AD, imzaAyir, kuyrukKatlanir, type KuyrukSebebi } from "@/sunucu/posta/imza";
import { Ikon } from "../../bilesenler/Ikon";
import { panelOturumu } from "../yetki";
import { DurumSecici, KategoriSecici, Sahiplik, VipDugmesi } from "./MailEylemleri";
import { YanitFormu } from "./YanitFormu";
import { Notlar } from "./Notlar";

/**
 * Mail detayı — iki yerde kullanılıyor.
 *
 * `gomulu` açıkken gelen kutusunun sağ sütununda yaşıyor: kendi başlığı
 * küçülüyor, "geri" bağlantısı yalnızca dar ekranda görünüyor ve içerideki
 * mail bağlantıları listeyi kaybetmemek için `/panel?mail=` biçiminde kuruluyor.
 * Kapalıyken `/panel/mail/[id]` tam sayfasıdır — paylaşılabilir adres.
 *
 * Tek kopya olmasının sebebi: iki yerde iki ayrı detay ekranı tutmak, birinde
 * düzeltilen şeyin ötekinde kalmasına yol açardı.
 *
 * ── Düzen kararı ──────────────────────────────────────────
 * Önceki hâlde sahiplik şeridi, kategori kartı ve durum kartı ekranın ilk
 * ~420 pikselini yiyordu; mailin kendisi dördüncü bloktu ve yanıt kutusu
 * katlanmanın çok altında kalıyordu. Üç karar:
 *
 * 1. **Triyaj tek şeritte.** Sahip, kategori ve durum üç ayrı kart değil, saç
 *    teliyle bölünmüş tek bir şeridin üç satırı. Aynı işi ~140 pikselde yapıyor
 *    ve üçü birlikte okunuyor — biri boşsa hemen görülüyor.
 * 2. **Gövde hemen altında.** Ekrana gelen kişi maili okumaya geliyor;
 *    triyaj şeridi bittiği yerde mail başlıyor.
 * 3. **Notlar ait oldukları satıra indi.** Üç paragraf (yapay zekâ, durum
 *    otomatiği, "Gönderilmiş Öğeler") silinmedi — ilgili kontrolün yanında
 *    birer satıra indi. Ürün gerçeği duruyor, mobilyası gitti.
 */
/** Konuşma akışının bir satırı: ya gelen bir mail ya bizim gönderdiğimiz yanıt. */
type AkisOgesi = {
  tip: "mail" | "yanit";
  id: number;
  kim: string;
  konu: string;
  ozet: string;
  /** Sıralama buna göre; iki tablonun damgası da aynı biçimde. */
  zaman: string;
  hata: string | null;
};

export async function MailDetay({
  mailId,
  gomulu = false,
  suzgecSorgusu = "",
}: {
  mailId: number;
  gomulu?: boolean;
  /** Listeye dönerken süzgeçleri koruyan sorgu dizgisi. */
  suzgecSorgusu?: string;
}) {
  const { kullanici, firma, firmaId } = await panelOturumu();
  const mail = mailGetir(mailId, firmaId);
  if (!mail) {
    return (
      <div className="detay-bos">
        <Ikon ad="zarf" boyut={22} />
        <b>Mail bulunamadı</b>
        <span>Silinmiş ya da başka bir firmaya ait olabilir.</span>
      </div>
    );
  }

  /* Devretme listesinde yalnız ekipte olanlar; çıkarılmış birine mail atanmaz. */
  const ekip = firmaKullanicilari(firmaId, true).map((k) => ({
    id: k.id,
    ad: k.ad,
    eposta: k.eposta,
  }));

  const kutu = firmaKutusu(mail.kutu_id, firmaId);
  const notlar = mailNotlari(mail.id, firmaId);
  const ekler = mailEkleri(mail.id, firmaId);

  /* ── Konuşma (madde 2) ──────────────────────────────────
     Zincirdeki gelen mailler ve giden yanıtlar tek bir akışta. "Giden
     yanıtlar" bölümü de artık **konuşmanın** yanıtlarını gösteriyor: yanıt
     hangi mailin altına yazılmış olursa olsun aynı yazışmanın parçası. */
  const zincir = konusmaMailleri(firmaId, mail.konusma);
  const yanitlar = konusmaYanitlari(firmaId, mail.konusma);

  const akis: AkisOgesi[] = [
    ...zincir.map((m) => ({
      tip: "mail" as const,
      id: m.id,
      kim: m.gonderen_ad || m.gonderen,
      konu: m.konu,
      ozet: m.ozet,
      zaman: m.tarih,
      hata: null as string | null,
    })),
    ...yanitlar.map((y) => ({
      tip: "yanit" as const,
      id: y.id,
      kim: y.yazan_ad || "Ekipten biri",
      konu: y.konu,
      ozet: y.metin.replace(/\s+/g, " ").trim(),
      zaman: y.olusma,
      hata: y.hata,
    })),
  ].sort((a, b) => (a.zaman < b.zaman ? -1 : a.zaman > b.zaman ? 1 : 0));

  /* Mailin kategorisine bağlı şablonlar önce; kategorisizler her mailde var. */
  const sablonlar = sablonlariGetir(firmaId)
    .filter((s) => !s.kategori || s.kategori === mail.kategori)
    .sort((a, b) => (b.kategori ? 1 : 0) - (a.kategori ? 1 : 0))
    .map((s) => ({ id: s.id, ad: s.ad, kategori: s.kategori, metin: s.metin }));

  /* Aynı gönderenden gelen diğer mailler — "bu kişiyle geçmişimiz ne" sorusu.
     Bu konuşmanın kendi mailleri düşülüyor: onlar zaten yukarıdaki akışta. */
  const gecmis = gelenKutusu(firmaId, { arama: mail.gonderen }).filter(
    (m) => m.id !== mail.id && m.konusma !== mail.konusma,
  );

  /* Gövdenin imza/alıntı kuyruğu (madde 1). Veritabanındaki gövdeye
     dokunulmuyor; ayırma her gösterimde yapılıyor, böylece kural değişince
     eski mailler de düzeliyor. */
  const ayrik = imzaAyir(mail.govde);
  const katlanir = kuyrukKatlanir(ayrik);
  const kuyrukSatiri = ayrik.kuyruk.split("\n").filter((s) => s.trim()).length;

  /* Yarım kalan yanıt (madde 3). Kişiye ait: başkasının taslağı okunmuyor. */
  const taslak = taslakGetir(mail.id, firmaId, kullanici.id);

  const yol = (id: number) =>
    gomulu ? `/panel?${suzgecSorgusu ? suzgecSorgusu + "&" : ""}mail=${id}` : `/panel/mail/${id}`;

  return (
    <div className={gomulu ? "detay-govde" : "sayfa dar"}>
      <Link
        className={gomulu ? "geri yalniz-dar" : "geri"}
        href={suzgecSorgusu ? `/panel?${suzgecSorgusu}` : "/panel"}
      >
        <Ikon ad="sagok" boyut={15} className="ters" />
        Gelen kutusu
      </Link>

      <div className="d-ust">
        <h1>{mail.konu || "(konu yok)"}</h1>
        <div className="d-meta">
          <span className="av kare kucuk">
            {(mail.gonderen_ad || mail.gonderen).trim().charAt(0).toUpperCase()}
          </span>
          <strong>{mail.gonderen_ad || mail.gonderen}</strong>
          <span className="d-adres">&lt;{mail.gonderen}&gt;</span>
          <span className="ayrac">→</span>
          <span className="d-adres">{mail.kutu_adres}</span>
          <span className="sure">{mail.tarih.slice(0, 16)}</span>
          <VipDugmesi mailId={mail.id} vip={Boolean(mail.vip)} gonderen={mail.gonderen} />
        </div>
      </div>

      {/* Triyaj: üç karar tek şeritte, üstelik aynı hizada. */}
      <div className="triyaj-bar">
        <Sahiplik
          mailId={mail.id}
          sahipId={mail.sahip_id}
          sahipAd={mail.sahip_ad}
          benimId={kullanici.id}
          ekip={ekip}
        />

        <div className="t-satir">
          <span className="t-et">Kategori</span>
          <div className="t-ic">
            <KategoriSecici
              mailId={mail.id}
              secili={mail.kategori}
              secenekler={KATEGORILER.map((k) => ({ deger: k, ad: KATEGORI_AD[k] }))}
            />
            {/* Not yalnız boşken: kategori seçiliyken bu cümle her mailde
                tekrarlanan mobilyaya dönüşüyor. */}
            {mail.kategori ? null : (
              <span className="t-not">Model bağlanınca hazır gelir.</span>
            )}
          </div>
        </div>

        <div className="t-satir">
          <span className="t-et">Durum</span>
          <div className="t-ic">
            <DurumSecici
              mailId={mail.id}
              secili={mail.durum}
              secenekler={DURUMLAR.map((d) => ({ deger: d, ad: DURUM_AD[d as MailDurum] }))}
            />
            {/* Yanıt gidince ne olacağını yalnız henüz yanıtlanmamışken söyle. */}
            {mail.durum === "yanitlandi" ? null : (
              <span className="t-not">Yanıt gidince kendiliğinden değişir.</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Konuşma akışı (madde 2) ──────────────────────────
          Yalnız çok mesajlı yazışmada görünüyor: tek mailde "1 mesaj" yazan
          bir şerit, hiçbir şey söylemeden yer kaplardı. Her satır bir mesaj —
          gelen mail ya da bizim yanıtımız — ve şu an okunan işaretli. */}
      {akis.length > 1 ? (
        <div className="konusma">
          <div className="konusma-ust">
            <span className="kutu-ad">Konuşma</span>
            <span className="kutu-not">{akis.length} mesaj</span>
          </div>
          <ol className="konusma-akis">
            {akis.map((o) => {
              const acik = o.tip === "mail" && o.id === mail.id;
              const ic = (
                <>
                  <span className={o.tip === "yanit" ? "k-im giden" : "k-im"} />
                  <span className="k-kim">
                    {o.tip === "yanit" ? `${o.kim} → yanıt` : o.kim}
                  </span>
                  <span className="k-ozet">{o.ozet || o.konu || "(metin yok)"}</span>
                  {o.hata ? <span className="k-hata">gitmedi</span> : null}
                  <span className="sure">{o.zaman.slice(5, 16)}</span>
                </>
              );

              return (
                <li className={acik ? "k-satir acik" : "k-satir"} key={`${o.tip}-${o.id}`}>
                  {o.tip === "mail" && !acik ? (
                    <Link href={yol(o.id)}>{ic}</Link>
                  ) : (
                    <span className="k-durum">{ic}</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      {/* Ekranın asıl işi. Triyajın hemen altında, okuma ölçüsünde. */}
      <div className="kutu mesaj-kutu">
        <div className="kutu-ust">
          <span className="kutu-ad">Gelen mesaj</span>
          <span className="kutu-not">{mail.kutu_adres}</span>
        </div>
        {mail.govde ? (
          /* İmza/alıntı kuyruğu katlanıyor (madde 1). Katlamaya değmeyen kısa
             imza olduğu gibi duruyor — iki satır için düğme koymak, kazandığı
             yerden fazlasını harcıyor. */
          katlanir ? (
            <>
              <div className="govde-metin">{ayrik.metin}</div>
              <details className="kuyruk">
                <summary>
                  <Ikon ad="sagok" boyut={13} />
                  {KUYRUK_AD[ayrik.sebep as KuyrukSebebi]}
                  <span className="sayi">{kuyrukSatiri} satır</span>
                </summary>
                <div className="govde-metin kuyruk-metin">{ayrik.kuyruk}</div>
              </details>
            </>
          ) : (
            <div className="govde-metin">{mail.govde}</div>
          )
        ) : (
          <div className="govde-yok">
            <p>
              Bu mailin gövdesi kaydedilmemiş — gövde saklanmaya başlamadan önce
              çekilmiş. Elde yalnızca özeti var:
            </p>
            <blockquote>{mail.ozet || "özet de yok"}</blockquote>
          </div>
        )}
      </div>

      {/* Madde 10 — gelen mailin ekleri. Gövdenin hemen altında: eki olan
          mailde "ekte gönderiyorum" cümlesiyle dosya yan yana okunmalı. */}
      {ekler.length ? (
        <div className="kutu ek-kutu">
          <div className="kutu-ust">
            <span className="kutu-ad">Ekler</span>
            <span className="kutu-not">{ekler.length} dosya</span>
          </div>
          <div className="ek-listesi">
            {ekler.map((e) => (
              <a className="ek-satiri" key={e.id} href={`/ek/${e.id}`}>
                <Ikon ad="liste" boyut={14} />
                <b>{e.ad}</b>
                <span className="sayi-h">{boyutYaz(e.boyut)}</span>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      <Notlar mailId={mail.id} notlar={notlar} benimId={kullanici.id} />

      {yanitlar.length ? (
        <>
          <h2 className="bolum">
            Giden yanıtlar
            <span className="sayi">{yanitlar.length}</span>
          </h2>
          <div className="triyaj">
            {yanitlar.map((y) => (
              <div className={y.hata ? "yanit-satir hatali" : "yanit-satir"} key={y.id}>
                <div className="yanit-ust">
                  <b>{y.yazan_ad || "Ekipten biri"}</b>
                  <span>→ {y.kime}</span>
                  <span className="sure">{y.olusma.slice(0, 16)}</span>
                </div>
                <p className="yanit-metin">{y.metin}</p>
                {y.hata ? (
                  <p className="sonuc kotu">
                    <Ikon ad="uyari" boyut={15} />
                    <span>Gönderilemedi: {y.hata}</span>
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* `key` şart: gömülü kullanımda maildan maile geçerken bileşen aynı
          yerde duruyor ve React onu **yeniden kullanıyor** — anahtar olmasa
          bir mailin taslağı ötekinin kutusunda görünürdü. */}
      <YanitFormu
        key={mail.id}
        mailId={mail.id}
        kime={mail.gonderen}
        kutuAdres={mail.kutu_adres}
        smtpVar={Boolean(kutu?.smtp_sunucu && kutu?.parola_sifreli)}
        sablonlar={sablonlar}
        taslak={taslak}
        degerler={{
          ad: mail.gonderen_ad || mail.gonderen,
          eposta: mail.gonderen,
          konu: mail.konu,
          ben: kullanici.ad || kullanici.eposta,
          firma: firma.ad,
        }}
      />

      {/* Bağlam, ana olay değil: kapalı açılır, sayısı dışarıda duruyor. */}
      {gecmis.length ? (
        <details className="gecmis">
          <summary>
            <Ikon ad="sagok" boyut={14} />
            Aynı gönderenden
            <span className="sayi">{gecmis.length}</span>
          </summary>
          <div className="triyaj">
            {gecmis.slice(0, 6).map((g) => (
              <Link className="talep-satir" key={g.id} href={yol(g.id)}>
                <span className="av kare">
                  {(g.gonderen_ad || g.gonderen).trim().charAt(0).toUpperCase()}
                </span>
                <div className="talep-ne">
                  <span className="talep-kim">
                    <b>{g.konu || "(konu yok)"}</b>
                  </span>
                  <span className="talep-bilgi">
                    <span>{g.kutu_adres}</span>
                    <span className="ayrac">·</span>
                    <span>{g.sahip_ad ? `${g.sahip_ad} üzerinde` : "sahipsiz"}</span>
                  </span>
                </div>
                <span className="sure">{g.tarih.slice(0, 16)}</span>
              </Link>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

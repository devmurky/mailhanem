import { ACIK_AYARLAR, ayarOku, ayarlariOku, sorgu } from "@/sunucu/db";
import { gonderimDurumu, POSTA_AYAR_ANAHTARLARI } from "@/sunucu/posta/gonderim";
import { anahtarVarMi } from "@/sunucu/kasa";
import { turnstileAcikMi } from "@/sunucu/turnstile";
import { durum as zamanlayiciDurumu } from "@/sunucu/zamanlayici";
import { zekaBagliMi, zekaModeli } from "@/sunucu/zeka/istemci";
import { Ikon } from "../../bilesenler/Ikon";
import { AyarFormu } from "./AyarFormu";
import { Entegrasyonlar, type Entegrasyon } from "./Entegrasyonlar";

/**
 * Sistem ve Anahtarlar - prototipteki sistemHTML() ekrani.
 *
 * Prototipin duzeni: kilit uyarisi, bagli servis kartlari, "sir nerede durur"
 * bolumu. Uygulamanin kendi Site Ayarlari formu da burada kaldi - prototipte
 * yoktu ama gercek bir is yapiyor ve gidecek baska yeri yok.
 *
 * ── Ekranin tek kurali ────────────────────────────────────
 * Anahtar degeri **gosterilmiyor ve kabul edilmiyor**. Gorunen tek sey
 * anahtarin tanimli olup olmadigi ve o servisin bugun ne yaptigi. Degerler
 * ortam degiskenlerinde duruyor; tarayiciya gonderilmiyor, veritabanina
 * yazilmiyor, gunluge dusmuyor.
 */
export const dynamic = "force-dynamic";

export default async function Ayarlar() {
  const a = ayarlariOku(ACIK_AYARLAR);
  const posta = gonderimDurumu();
  const sonGonderim = ayarOku(POSTA_AYAR_ANAHTARLARI.SON_GONDERIM);
  const sonHata = ayarOku(POSTA_AYAR_ANAHTARLARI.SON_HATA);
  const zaman = zamanlayiciDurumu();

  /* Olcumler gercek sorgudan; anahtarin kendisi degil yalnizca varligi. */
  const aiSatir = sorgu<{ n: number; kurus: number | null }>(
    `SELECT COUNT(*) AS n, SUM(kurus) AS kurus FROM ai_kullanim
     WHERE olusma >= datetime('now', '-30 days')`,
  )[0];
  const mailAy = sorgu<{ n: number }>(
    `SELECT COUNT(*) AS n FROM mailler WHERE olusma >= datetime('now', '-30 days')`,
  )[0];
  const kutuSayisi = sorgu<{ n: number; sifreli: number }>(
    `SELECT COUNT(*) AS n, SUM(CASE WHEN parola_sifreli IS NOT NULL THEN 1 ELSE 0 END) AS sifreli
     FROM kutular`,
  )[0];
  const hataAy = sorgu<{ n: number }>(
    `SELECT COUNT(*) AS n FROM gunluk WHERE tip = 'hata' AND olusma >= datetime('now', '-30 days')`,
  )[0];

  const entegrasyonlar: Entegrasyon[] = [
    {
      ad: "Anthropic API",
      ne: "Bilgi deposu çıkarımı · (sırada: sınıflandırma ve taslak)",
      ikon: "kalkan",
      /* İki ad da kabul ediliyor; durum da o ortak kapıdan okunuyor
         (`zekaBagliMi`). Bu satır eskiden yalnız ANTHROPIC_API_KEY'e bakıyordu
         ve öteki adla girilen anahtarı "bağlı değil" gösteriyordu. */
      env: "ANTHROPIC_ANAHTAR (ya da ANTHROPIC_API_KEY)",
      bagli: zekaBagliMi(),
      not: "Anahtar tanımlı değil: müşteri panelindeki Bilgi Deposu çıkarımı çalışmıyor, depo elle doldurulabiliyor. Sınıflandırma ve taslak adımları zaten yazılmadı; kural motoru ve elle kurulmuş yönlendirme çalışmaya devam ediyor.",
      olcum: [
        ["Model", zekaModeli()],
        ["Bu ay çağrı", (aiSatir?.n ?? 0).toLocaleString("tr-TR")],
        [
          "Bu ay tutar",
          aiSatir?.n ? `₺${((aiSatir.kurus ?? 0) / 100).toLocaleString("tr-TR")}` : "—",
        ],
        ["İşlenen mail", (mailAy?.n ?? 0).toLocaleString("tr-TR")],
      ],
    },
    {
      ad: "Posta gönderimi",
      ne: "Giriş bağlantısı, davet ve yanıtlar",
      ikon: "zarf",
      env: "SMTP_SUNUCU",
      bagli: posta.acik,
      not: "SMTP tanımlı değil: giriş bağlantıları ve davetler gönderilemiyor, konsola ve veri/giden-mailler.log dosyasına yazılıyor.",
      olcum: [
        ["Son gönderim", sonGonderim ? sonGonderim.slice(0, 16) : "hiç"],
        ["Son hata", sonHata ? sonHata.slice(0, 60) : "yok"],
      ],
    },
    {
      ad: "Kutu parolası kasası",
      ne: "Müşteri posta şifrelerinin zarf şifrelemesi",
      ikon: "kilit",
      env: "MAILHANEM_ANAHTAR",
      bagli: anahtarVarMi(),
      not: "Ana anahtar yok: yeni kutu bağlanamıyor ve kayıtlı parolalar çözülemiyor. Bu anahtarı kaybetmek, kayıtlı bütün kutu parolalarını kalıcı olarak okunamaz yapar.",
      olcum: [
        ["Kayıtlı kutu", String(kutuSayisi?.n ?? 0)],
        ["Parolası şifreli", String(kutuSayisi?.sifreli ?? 0)],
        ["Yöntem", "AES-256-GCM"],
      ],
    },
    {
      ad: "Cloudflare Turnstile",
      ne: "Giriş ve demo formunun bot koruması",
      ikon: "kalkan",
      env: "NEXT_PUBLIC_TURNSTILE_SITE + TURNSTILE_GIZLI",
      bagli: turnstileAcikMi(),
      not: "İki anahtardan biri eksik: koruma kapalı, formlar çalışmaya devam ediyor. Yarım kurulum açık sayılmıyor — tarayıcıda bulmaca çıkıp sunucu doğrulayamazsa güvenlik hissi verip hiçbir şey yapmaz.",
      olcum: [["Korunan form", "giriş · demo talebi"]],
    },
    {
      ad: "Zamanlayıcı",
      ne: "Kutuların periyodik taranması",
      ikon: "saat",
      env: "veritabanı ayarı",
      bagli: zaman.acik,
      not: "Aralık kapalı: kutular kendiliğinden taranmıyor, çekim Posta Akışı ekranından elle başlatılıyor.",
      olcum: [
        ["Aralık", zaman.acik ? `${zaman.aralik} dakika` : "kapalı"],
        ["Son çalışma", zaman.sonCalisma ? zaman.sonCalisma.slice(0, 16) : "hiç"],
        ["Son sonuç", zaman.sonSonuc || "—"],
      ],
    },
    {
      ad: "Tahsilat",
      ne: "Abonelik faturası ve ödeme",
      ikon: "kart",
      env: "—",
      bagli: false,
      not: "Hiç bağlanmadı. Abonelik ekranı ne anlaşıldığının kaydını tutuyor; fatura kesilmiyor, kart çekilmiyor.",
      olcum: [["Bu ay hata", String(hataAy?.n ?? 0)]],
    },
  ];

  const bagliSayisi = entegrasyonlar.filter((e) => e.bagli).length;

  return (
    <div className="sayfa">
      <div className="sayfa-ust">
        <div>
          <h1>Sistem ve Anahtarlar</h1>
          <p>Servisin bağlı olduğu dış sistemler ve sağlık durumları</p>
        </div>
      </div>

      <div className="kural-kutu">
        <Ikon ad="kilit" boyut={19} />
        <div>
          <h3>Anahtarlar buradan girilmez — ve hiçbir arayüzden girilmez</h3>
          <p>
            Bu ekran anahtar değeri göstermez, kabul de etmez. Değerler sunucudaki
            ortam değişkenlerinde durur; yalnızca sunucu süreci okur, tarayıcıya
            gönderilmez, veritabanına yazılmaz, günlüklere düşmez. Burada gördüğün tek
            şey <b>anahtarın tanımlı olup olmadığı</b>.
          </p>
        </div>
      </div>

      <h2 className="bolum">
        Bağlı servisler
        <span className="sayi">
          {bagliSayisi}/{entegrasyonlar.length}
        </span>
        <span className="aciklayici">hepsi senin hesabın</span>
      </h2>

      <Entegrasyonlar liste={entegrasyonlar} />

      <h2 className="bolum" style={{ marginTop: 26 }}>
        Sır nerede durur
      </h2>
      <p className="dip" style={{ marginTop: 0, marginBottom: 11 }}>
        Tek bir kural iki tür sırrı ayırır: <b>sana ait olan ortam değişkenine</b>,{" "}
        <b>müşteriye ait olan veritabanına şifreli</b> gider. Senin anahtarların nadiren
        değişir ve açılışta okunur; müşterinin posta şifresi ise her firma için ayrıdır,
        çalışma anında eklenir — ortam değişkenine sığmaz.
      </p>

      <div className="kod">
        <span className="yorum"># sunucu · .env.local — servise ait sırlar, koda ve panele girmez</span>
        {"\n"}
        <span className="ad">ANTHROPIC_ANAHTAR</span>=sk-ant-…{"  "}
        <span className="yorum"># ANTHROPIC_API_KEY adı da okunur</span>
        {"\n"}
        <span className="ad">SMTP_SUNUCU</span>=…{"\n"}
        <span className="ad">MAILHANEM_ANAHTAR</span>=…{"      "}
        <span className="yorum"># müşteri şifrelerini açan kök anahtar</span>
        {"\n\n"}
        <span className="yorum"># sqlite · kutular — müşteriye ait sırlar, şifreli</span>
        {"\n"}
        firma_id | adres · · · · · · · · · | parola_sifreli{"\n"}
        ─────────────────────────────────────────────────{"\n"}
        1 · · · ·| info@arkunmobilya.com · | AES-256-GCM ▓▓▓▓▓▓▓▓{"\n"}
        1 · · · ·| satis@arkunmobilya.com ·| AES-256-GCM ▓▓▓▓▓▓▓▓
      </div>

      <h2 className="bolum" style={{ marginTop: 26 }}>
        Site ayarları
      </h2>

      <div className="kutu-bilgi" style={{ marginBottom: 22, maxWidth: 720 }}>
        <span className="ikn">
          <Ikon ad="bilgi" boyut={16} />
        </span>
        <span>
          Site bu değerleri <code>/api/site-ayar</code> ucundan çekiyor. Yalnızca buradaki
          alanlar dışarı açılır; veritabanındaki başka hiçbir şey o uçtan görünmez.
        </span>
      </div>

      <AyarFormu eposta={a.iletisim_eposta ?? ""} telefon={a.iletisim_telefon ?? ""} />

      <div className="kutu-bilgi" style={{ marginBottom: 22, maxWidth: 720 }}>
        <span className="ikn">
          <Ikon ad="bilgi" boyut={16} />
        </span>
        <span>
          Site bu değerleri <code>/api/site-ayar</code> ucundan çekiyor. Yalnızca buradaki
          alanlar dışarı açılır; veritabanındaki başka hiçbir şey o uçtan görünmez.
        </span>
      </div>

      <h2 className="bolum" style={{ marginTop: 26 }}>
        Posta gönderimi ayrıntısı
      </h2>
      <div className="kutu" style={{ maxWidth: 720 }}>
        <div className="kutu-ust">
          <span className={posta.acik ? "nb" : "nb sonuk"} />
          <span className="kutu-ad">{posta.acik ? "Bağlı" : "Tanımlı değil"}</span>
        </div>

        {posta.acik ? (
          <dl className="zaman-sayilar" style={{ borderTop: 0, paddingTop: 0, marginTop: 0 }}>
            <div>
              <dt>Sunucu</dt>
              <dd>{posta.sunucu}</dd>
            </div>
            <div>
              <dt>Gönderen</dt>
              <dd>{posta.gonderen}</dd>
            </div>
            <div className="genis">
              <dt>Son gönderim</dt>
              <dd>{sonGonderim || "henüz gönderilmedi"}</dd>
            </div>
            {sonHata ? (
              <div className="genis">
                <dt>Son hata</dt>
                <dd style={{ color: "var(--kritik)" }}>{sonHata}</dd>
              </div>
            ) : null}
          </dl>
        ) : (
          <p className="kutu-not-metin" style={{ marginTop: 0 }}>
            <code>SMTP_SUNUCU</code> tanımlı olmadığı için uygulama mail göndermiyor:
            giriş bağlantıları ve ekip davetleri sunucu günlüğüne yazılıyor. Ayarlar
            ortam değişkeninde durur (<code>.env.local</code>), panelden değiştirilmez —
            parola veritabanına yazılmasın diye.
          </p>
        )}
      </div>

      <div className="kutu-bilgi" style={{ maxWidth: 720 }}>
        <span className="ikn">
          <Ikon ad="bilgi" boyut={16} />
        </span>
        <span>
          Buradan giden mailler yalnızca <b>uygulamanın kendi mailleridir</b>: giriş
          bağlantısı ve ekip daveti. Müşterinin kendi yanıtları buradan geçmiyor — mail
          yanıtlama henüz yazılmadı.
        </span>
      </div>
    </div>
  );
}

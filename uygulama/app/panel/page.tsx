import Link from "next/link";
import {
  DURUM_AD,
  GECIKME_SAAT,
  KATEGORILER,
  KATEGORI_AD,
  gelenKutusu,
  gelenSay,
  konusmaSayilari,
  kutulariGetir,
  taslakliMailler,
  type GelenSuzgec,
  type Kategori,
  type MailDurum,
} from "@/sunucu/db";
import { Ikon } from "../bilesenler/Ikon";
import { TopluCubuk } from "./TopluCubuk";
import { panelOturumu } from "./yetki";
import { MailDetay } from "./mail/MailDetay";

export const dynamic = "force-dynamic";

/* Sekmeler süzgeç değil, kuyruğun okunma biçimi: "kim bakacak" sorusu. */
const SEKMELER = ["hepsi", "sahipsiz", "geciken", "bana", "islemde", "kapandi"] as const;
type Sekme = (typeof SEKMELER)[number];

const SEKME_AD: Record<Sekme, string> = {
  hepsi: "Tümü",
  sahipsiz: "Sahipsiz",
  geciken: "Geciken",
  bana: "Bana atanan",
  islemde: "İşlemde",
  kapandi: "Kapandı",
};

/** Kategori noktalarının rengi. Panelin jetonlarından; yeni renk uydurulmadı. */
const KATEGORI_RENK: Record<string, string> = {
  satis: "var(--murekkep)",
  destek: "var(--olumlu)",
  fatura: "var(--uyari)",
  sikayet: "var(--kritik)",
  diger: "var(--ayrac)",
};

function sekmeSuzgeci(sekme: Sekme, benimId: number): GelenSuzgec {
  if (sekme === "sahipsiz") return { sahipsiz: true };
  if (sekme === "geciken") return { geciken: true };
  if (sekme === "bana") return { sahipId: benimId };
  if (sekme === "islemde") return { durum: "islemde" };
  if (sekme === "kapandi") return { durum: "kapandi" };
  return {};
}

/** Bir parametreyi değiştirip geri kalanı koruyan adres. */
function adres(mevcut: Record<string, string>, degisen: Record<string, string>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...mevcut, ...degisen })) {
    if (v) p.set(k, v);
  }
  const q = p.toString();
  return q ? `/panel?${q}` : "/panel";
}

/**
 * Açık bir mailin ne kadardır beklediği. Kapanmış ya da yanıtlanmış mailde
 * bekleme diye bir şey yok — iş bitmiştir.
 *
 * Yapay zekâya bağlı değil: mailin kendi tarihinden hesaplanıyor.
 */
function bekleme(tarih: string, durum: string): { metin: string; gecikti: boolean } | null {
  if (durum !== "yeni" && durum !== "islemde") return null;
  const gecen = Date.now() - Date.parse(tarih + "Z");
  if (!Number.isFinite(gecen) || gecen < 0) return null;

  const dakika = Math.floor(gecen / 60000);
  const saat = Math.floor(dakika / 60);
  const gun = Math.floor(saat / 24);
  const metin = gun >= 1 ? `${gun} gün` : saat >= 1 ? `${saat} sa` : `${dakika} dk`;
  return { metin, gecikti: saat >= GECIKME_SAAT };
}

/** "2026-09-11 10:02" → bugünse saat, değilse gün. Listede yer dar. */
function kisaZaman(tarih: string): string {
  const bugun = new Date().toISOString().slice(0, 10);
  return tarih.slice(0, 10) === bugun ? tarih.slice(11, 16) : tarih.slice(5, 10);
}

export default async function GelenKutusu({
  searchParams,
}: {
  searchParams: Promise<{
    sekme?: string;
    kategori?: string;
    kutu?: string;
    q?: string;
    mail?: string;
  }>;
}) {
  const { kullanici, firmaId } = await panelOturumu();
  const ham = await searchParams;

  const sekme: Sekme = (SEKMELER as readonly string[]).includes(ham.sekme ?? "")
    ? (ham.sekme as Sekme)
    : "hepsi";
  const kutular = kutulariGetir(firmaId);
  const kutuId = kutular.some((k) => String(k.id) === ham.kutu) ? Number(ham.kutu) : undefined;
  const kategori = (KATEGORILER as readonly string[]).includes(ham.kategori ?? "")
    ? (ham.kategori as Kategori)
    : undefined;
  const arama = (ham.q ?? "").slice(0, 120);

  /* Sekmelerin yanındaki rakam, o sekmeye geçilince görülecek sayı olmalı:
     kategori, kutu ve arama süzgeçleri sayıma da uygulanıyor. */
  const ortak: GelenSuzgec = { kategori, kutuId, arama };
  const mevcutParam = {
    sekme: sekme === "hepsi" ? "" : sekme,
    kategori: kategori ?? "",
    kutu: kutuId ? String(kutuId) : "",
    q: arama,
  };
  const suzgecSorgusu = new URLSearchParams(
    Object.entries(mevcutParam).filter(([, v]) => v),
  ).toString();

  const mailler = gelenKutusu(firmaId, { ...ortak, ...sekmeSuzgeci(sekme, kullanici.id) });

  /* Yarım kalan yanıtlarım (madde 3). Tek sorgu, sonra küme: satır başına
     sorgu atmak listeyi iki yüz sorguya çıkarırdı. */
  const taslakli = taslakliMailler(firmaId, kullanici.id);

  /* Çok mesajlı konuşmalar (madde 2): zincir kimliği → mesaj sayısı. Satır,
     ait olduğu yazışmanın kaç mesaj olduğunu söylüyor. */
  const konusmaSayi = konusmaSayilari(firmaId);

  const sayilar = Object.fromEntries(
    SEKMELER.map((s) => [s, gelenSay(firmaId, { ...ortak, ...sekmeSuzgeci(s, kullanici.id) })]),
  ) as Record<Sekme, number>;

  /* Kategori rakamları sekmeden bağımsız: "şu kategoriye geçersem kaç tane". */
  const kategoriSayilari = Object.fromEntries(
    KATEGORILER.map((k) => [
      k,
      gelenSay(firmaId, { kutuId, arama, kategori: k, ...sekmeSuzgeci(sekme, kullanici.id) }),
    ]),
  ) as Record<string, number>;

  const suzgecAcik = Boolean(kategori || kutuId || arama || sekme !== "hepsi");

  /* İki ayrı soru, ikisini karıştırmamak gerekiyor:
     · Sağ sütunda ne gösterilecek? Adreste mail yoksa ilk satır — geniş ekranda
       sağ sütun boş durmasın diye.
     · Kullanıcı bir mail *seçti* mi? Bunu yalnızca adresteki `mail` söyler.
       Dar ekranda liste bu bayrağa göre gizleniyor; kendiliğinden seçilen mail
       listeyi gizleseydi telefonda hiç liste görülemezdi. */
  const istenen = Number(ham.mail);
  const acikSecim = Number.isInteger(istenen) && mailler.some((m) => m.id === istenen);
  const secili = acikSecim ? istenen : (mailler[0]?.id ?? 0);

  if (!kutular.length) {
    return (
      <div className="sayfa">
        <div className="talep-bos" style={{ padding: "58px 20px" }}>
          <Ikon ad="zarf" boyut={24} />
          <b>Henüz posta kutusu bağlı değil</b>
          <span>
            Panel çalışmaya başlamak için en az bir posta kutusuna ihtiyaç duyuyor.
          </span>
          <Link className="dugme" href="/panel/hesaplar" style={{ marginTop: 12 }}>
            Mail hesapları
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={acikSecim ? "kutu-govde secili-var" : "kutu-govde"}>
      {/* ── sol: liste ── */}
      <section className="sutun liste-sutun">
        <div className="liste-ust">
          <div className="liste-baslik">
            <span className="ad">Gelen kutusu</span>
            <form method="get" action="/panel" className="kutu-sec">
              {sekme !== "hepsi" ? <input type="hidden" name="sekme" value={sekme} /> : null}
              {kategori ? <input type="hidden" name="kategori" value={kategori} /> : null}
              {arama ? <input type="hidden" name="q" value={arama} /> : null}
              <label className="gizli" htmlFor="kutu-suz">
                Kutuya göre süz
              </label>
              <select id="kutu-suz" name="kutu" defaultValue={kutuId ? String(kutuId) : ""}>
                <option value="">tüm kutular</option>
                {kutular.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.adres.split("@")[0]}@
                  </option>
                ))}
              </select>
              <button className="gizli" type="submit">
                Süz
              </button>
            </form>
            <span className="adet">{mailler.length} mail</span>
          </div>

          <TopluCubuk mailIdleri={mailler.map((m) => m.id)} />

          <div className="suzgec serit-kaydir">
            {SEKMELER.map((s) => (
              <Link
                key={s}
                className={`sekme${s === sekme ? " aktif" : ""}${sayilar[s] ? "" : " bos"}`}
                href={adres(mevcutParam, { sekme: s === "hepsi" ? "" : s, mail: "" })}
              >
                {SEKME_AD[s]}
                <i>{sayilar[s]}</i>
              </Link>
            ))}
          </div>

          <form className="suz2" method="get" action="/panel">
            {sekme !== "hepsi" ? <input type="hidden" name="sekme" value={sekme} /> : null}
            {kategori ? <input type="hidden" name="kategori" value={kategori} /> : null}
            {kutuId ? <input type="hidden" name="kutu" value={kutuId} /> : null}
            <span className="arama">
              <Ikon ad="ara" boyut={13} />
              <input
                type="search"
                name="q"
                defaultValue={arama}
                placeholder="gönderen, konu ya da özet"
                aria-label="Maillerde ara"
              />
            </span>
            <button className="dugme ufak" type="submit">
              Ara
            </button>
          </form>

          <div className="katsuz serit-kaydir">
            {KATEGORILER.map((k) => (
              <Link
                key={k}
                className={`kcip${k === kategori ? " secili" : ""}${
                  kategoriSayilari[k] ? "" : " bos"
                }`}
                href={adres(mevcutParam, { kategori: k === kategori ? "" : k, mail: "" })}
              >
                <i style={{ background: KATEGORI_RENK[k] ?? "var(--ayrac)" }} />
                {KATEGORI_AD[k]}
                <b>{kategoriSayilari[k]}</b>
              </Link>
            ))}
            {suzgecAcik ? (
              <Link className="kcip temizle" href="/panel">
                <Ikon ad="carpi" boyut={12} />
                temizle
              </Link>
            ) : null}
          </div>
        </div>

        {mailler.length ? (
          <div className="liste">
            {mailler.map((m) => (
              /* Kutucuk bağlantının **dışında**: içine koymak, seçmek isterken
                 maili açmaya yol açardı. */
              <div className="satir-sar" key={m.id}>
                <label className="satir-kutucuk">
                  <span className="gizli">{m.konu || "(konu yok)"} — seç</span>
                  <input className="satir-secim" type="checkbox" value={m.id} />
                </label>
              <Link
                className={`satir${m.id === secili ? " secili" : ""}${
                  m.durum === "yeni" ? " okunmamis" : ""
                }`}
                href={adres(mevcutParam, { mail: String(m.id) })}
              >
                <span className="av kare">
                  {(m.gonderen_ad || m.gonderen).trim().charAt(0).toUpperCase()}
                </span>
                <span className="govde">
                  <span className="konu">
                    {m.vip ? (
                      <span className="vip-yildiz" title="VIP gönderen">
                        <Ikon ad="yildiz-dolu" boyut={12} />
                      </span>
                    ) : null}
                    {m.konu || "(konu yok)"}
                  </span>
                  <span className="s1">
                    <span
                      className="kat-im"
                      style={{
                        background: m.kategori
                          ? (KATEGORI_RENK[m.kategori] ?? "var(--ayrac)")
                          : "var(--cizgi2)",
                      }}
                      title={
                        m.kategori
                          ? (KATEGORI_AD[m.kategori as Kategori] ?? m.kategori)
                          : "kategorisiz"
                      }
                    />
                    <span className="gonderen">{m.gonderen_ad || m.gonderen}</span>
                    <span className="zaman">{kisaZaman(m.tarih)}</span>
                  </span>
                  <span className="onizleme">{m.ozet || "(özet yok)"}</span>
                  <span className="s3">
                    {/* Konuşmanın uzunluğu (madde 2). Tek mesajlık yazışmada
                        hiç yazılmıyor — "1 mesaj" bilgi değil, gürültü. */}
                    {konusmaSayi.has(m.konusma) ? (
                      <span className="cip konusma-cip" title="Bu yazışmadaki mesaj sayısı">
                        <Ikon ad="kisiler" boyut={11} />
                        {konusmaSayi.get(m.konusma)} mesaj
                      </span>
                    ) : null}
                    {/* Yarım bıraktığım yanıt (madde 3). Yalnız bana görünüyor:
                        küme benim taslaklarımdan kuruluyor. */}
                    {taslakli.has(m.id) ? (
                      <span className="cip taslak" title="Yarım kalan yanıtınız var">
                        <Ikon ad="kalem" boyut={11} />
                        taslak
                      </span>
                    ) : null}
                    {m.durum !== "yeni" ? (
                      <span className={`cip d-${m.durum}`}>
                        {DURUM_AD[m.durum as MailDurum] ?? m.durum}
                      </span>
                    ) : null}
                    {(() => {
                      const b = bekleme(m.tarih, m.durum);
                      return b ? (
                        <span className={b.gecikti ? "bekleme gecikti" : "bekleme"}>
                          {b.metin}
                        </span>
                      ) : null;
                    })()}
                    {m.sahip_ad ? (
                      <span className="rozet-sahip">
                        <span className="av">{m.sahip_ad.trim().charAt(0).toUpperCase()}</span>
                        {m.sahip_ad.split(" ")[0]}
                      </span>
                    ) : (
                      <span className="rozet-sahip sahipsiz">sahipsiz</span>
                    )}
                  </span>
                </span>
              </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="liste-bos">
            Bu süzgeçte mail yok.
            <Link className="dugme ufak" href="/panel">
              Süzgeci temizle
            </Link>
          </div>
        )}
      </section>

      {/* ── sağ: detay ── */}
      <main className="sutun detay-sutun">
        {secili ? (
          <MailDetay mailId={secili} gomulu suzgecSorgusu={suzgecSorgusu} />
        ) : (
          <div className="detay-bos">
            <Ikon ad="zarf" boyut={22} />
            <b>Soldan bir mail seçin</b>
            <span>Seçtiğiniz mailin tamamı, sahibi ve yanıt kutusu burada açılır.</span>
          </div>
        )}
      </main>
    </div>
  );
}

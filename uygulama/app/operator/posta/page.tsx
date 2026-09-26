import { sorgu, tek } from "@/sunucu/db";
import { KURAL_AD, type KuralAdi } from "@/sunucu/posta/kural";
import { Ikon } from "../../bilesenler/Ikon";
import { CekimDugmesi } from "./CekimDugmesi";
import { Zamanlayici } from "./Zamanlayici";
import { ARALIKLAR, ARALIK_AD, durum as zamanlayiciDurumu } from "@/sunucu/zamanlayici";

export const dynamic = "force-dynamic";

type Satir = {
  id: number;
  gonderen_ad: string;
  gonderen: string;
  konu: string;
  ozet: string;
  tarih: string;
  elendi: string | null;
  eleme_sebep: string;
  adres: string;
  firma: string;
};

const KATEGORI_RENK: Record<string, string> = {
  bulten: "r-kapali",
  "no-reply": "r-kapali",
  "otomatik-yanit": "r-kapali",
  "ic-yazisma": "r-kapali",
  "gonderen-yok": "r-uyari",
};

export default async function Posta({
  searchParams,
}: {
  searchParams: Promise<{ suzgec?: string }>;
}) {
  const { suzgec } = await searchParams;
  const gorunum = suzgec === "elenen" ? "elenen" : suzgec === "tum" ? "tum" : "gelen";

  const kosul =
    gorunum === "gelen" ? "WHERE m.elendi IS NULL" : gorunum === "elenen" ? "WHERE m.elendi IS NOT NULL" : "";

  const mailler = sorgu<Satir>(`
    SELECT m.id, m.gonderen_ad, m.gonderen, m.konu, m.ozet, m.tarih, m.elendi, m.eleme_sebep,
           k.adres, f.ad AS firma
    FROM mailler m
      JOIN kutular k ON k.id = m.kutu_id
      JOIN firmalar f ON f.id = m.firma_id
    ${kosul}
    ORDER BY m.tarih DESC LIMIT 100`);

  const say = (k: string) =>
    tek<{ n: number }>(`SELECT COUNT(*) AS n FROM mailler ${k}`)?.n ?? 0;
  const toplam = say("");
  const gelen = say("WHERE elendi IS NULL");
  const elenen = say("WHERE elendi IS NOT NULL");
  const kutuAdedi = tek<{ n: number }>("SELECT COUNT(*) AS n FROM kutular")?.n ?? 0;

  const kaynak = process.env.POSTA_KAYNAGI ?? "";
  const dosyaModu = kaynak.startsWith("dosya:");
  const zaman = zamanlayiciDurumu();

  return (
    <div className="sayfa">
      <div className="sayfa-ust">
        <div>
          <h1>Posta akışı</h1>
          <p>Kutulardan çekilen mailler ve kural motorunun kararları.</p>
        </div>
        <CekimDugmesi />
      </div>

      {dosyaModu ? (
        <div className="kutu-uyari" style={{ marginTop: 0, marginBottom: 22 }}>
          <span className="ikn">
            <Ikon ad="bilgi" boyut={16} />
          </span>
          <span>
            <b>Dosya kaynağı açık.</b> Gerçek IMAP yerine <code>{kaynak.slice(6)}</code>{" "}
            klasöründeki <code>.eml</code> dosyaları okunuyor. Canlı kutuya geçmek için
            <code>POSTA_KAYNAGI</code> değişkenini boş bırakın.
          </span>
        </div>
      ) : null}

      <Zamanlayici
        aralik={zaman.aralik}
        secenekler={ARALIKLAR.map((a) => ({ deger: a, ad: ARALIK_AD[a] ?? `${a} dakika` }))}
        sonCalisma={zaman.sonCalisma}
        sonSonuc={zaman.sonSonuc}
        siradaki={zaman.siradaki}
      />

      <dl className="kartlar">
        <div className="skart">
          <dt>Gelen kutusu</dt>
          <div className="deger">
            <dd>{gelen}</dd>
          </div>
          <div className="not">kuraldan geçti, işlenecek</div>
        </div>
        <div className="skart">
          <dt>Elenen</dt>
          <div className="deger">
            <dd style={{ color: "var(--soluk)" }}>{elenen}</dd>
          </div>
          <div className="not">modele hiç gitmedi</div>
        </div>
        <div className="skart">
          <dt>Toplam çekilen</dt>
          <div className="deger">
            <dd>{toplam}</dd>
          </div>
          <div className="not">{kutuAdedi} kutudan</div>
        </div>
        <div className="skart">
          <dt>Eleme oranı</dt>
          <div className="deger">
            <dd>%{toplam ? Math.round((elenen / toplam) * 100) : 0}</dd>
          </div>
          <div className="not">bu kadarı ücretlendirilmez</div>
        </div>
      </dl>

      <h2 className="bolum">
        Mailler
        <span className="sayi">{mailler.length}</span>
        <span className="talep-suz">
          <a className={gorunum === "gelen" ? "etkin" : ""} href="/operator/posta">
            Gelen
          </a>
          <a
            className={gorunum === "elenen" ? "etkin" : ""}
            href="/operator/posta?suzgec=elenen"
          >
            Elenen
          </a>
          <a className={gorunum === "tum" ? "etkin" : ""} href="/operator/posta?suzgec=tum">
            Tümü
          </a>
        </span>
      </h2>

      {mailler.length ? (
        <div className="triyaj">
          {mailler.map((m) => (
            <div className={`talep-satir${m.elendi ? " kapandi" : ""}`} key={m.id}>
              <span className="av kare">
                {(m.gonderen_ad || m.gonderen).trim().charAt(0).toUpperCase()}
              </span>
              <div className="talep-ne">
                <span className="talep-kim">
                  <b>{m.konu || "(konu yok)"}</b>
                  <span className="ad">{m.gonderen_ad || m.gonderen}</span>
                </span>
                <span className="talep-bilgi">
                  <span>{m.gonderen}</span>
                  <span className="ayrac">·</span>
                  <span>{m.adres}</span>
                  <span className="ayrac">·</span>
                  <span>{m.firma}</span>
                </span>
                {m.ozet ? <span className="talep-not">{m.ozet}</span> : null}
              </div>
              <span className="sure">{m.tarih.slice(0, 16)}</span>
              {m.elendi ? (
                <span
                  className={`rozet ${KATEGORI_RENK[m.elendi] ?? "r-kapali"}`}
                  title={m.eleme_sebep}
                >
                  {KURAL_AD[m.elendi as KuralAdi] ?? m.elendi}
                </span>
              ) : (
                <span className="rozet r-bitti">Geçti</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="talep-bos">
          <Ikon ad="zarf" boyut={22} />
          <b>Henüz çekilmiş mail yok</b>
          <span>Yukarıdaki &quot;Çekimi çalıştır&quot; düğmesiyle bir tur başlatın.</span>
        </div>
      )}

      <div className="kutu-uyari">
        <span className="ikn">
          <Ikon ad="bilgi" boyut={16} />
        </span>
        <span>
          <b>Sınıflandırma henüz bağlanmadı.</b> Şu an yalnızca kural motoru çalışıyor:
          bülten, no-reply, otomatik yanıt ve iç yazışma eleniyor. Geçen maillerin
          kategorisi ve yanıt taslağı, yapay zekâ adımı bağlandığında gelecek.
        </span>
      </div>
    </div>
  );
}

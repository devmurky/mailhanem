import Link from "next/link";
import {
  TICKET_DURUM_AD,
  TICKET_KATEGORI_AD,
  TICKET_ONCELIK_AD,
  ticketGetir,
  ticketMesajlari,
  ticketlariGetir,
  ticketSayilari,
  destekDakika,
  ticketEkleri,
  mailGetir,
} from "@/sunucu/db";
import { boyutYaz } from "@/sunucu/ekDosya";
import { Ikon } from "../../bilesenler/Ikon";
import { OpTicketYaniti, TicketDenetim } from "./TicketDenetim";
import { DestekZamani } from "./DestekZamani";

/**
 * Operatörün destek kuyruğu.
 *
 * Müşteri panelinden açılan talepler buraya **tamamıyla** düşüyor: hangi
 * firma, kim açtı, hangi kategori, hangi öncelik ve yazışmanın tamamı.
 *
 * Sıralama `guncelleme`ye göre: en son hareket eden üstte. Kuyrukta önce
 * "bizde" olanlar aranır, o yüzden durum rozeti satırın en görünür yerinde.
 */
export const dynamic = "force-dynamic";

function sure(damga: string): string {
  const fark = Date.now() - new Date(damga.replace(" ", "T") + "Z").getTime();
  const dk = Math.round(fark / 60000);
  if (dk < 60) return `${dk} dk`;
  const sa = Math.round(dk / 60);
  if (sa < 24) return `${sa} sa`;
  return `${Math.round(sa / 24)} gün`;
}

export default async function OperatorTicketlar({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; suzgec?: string }>;
}) {
  const { t, suzgec } = await searchParams;
  const yalnizAcik = suzgec !== "tum";

  const hepsi = ticketlariGetir(undefined, true);
  const gorunen = yalnizAcik
    ? hepsi.filter((x) => !["kapandi", "cozuldu"].includes(x.durum))
    : hepsi;

  const s = ticketSayilari();
  /* "Bizde" = yanıtı bizden bekleyenler. Yeni açılmış talep de buna dahil:
     `acik` henüz kimsenin yazmadığı ilk hâl, top yine bizde. */
  const bizde = (s.operatorde ?? 0) + (s.acik ?? 0);
  const acik = bizde + (s.musteride ?? 0);

  const secili = t ? ticketGetir(Number(t)) : gorunen[0];
  const mesajlar = secili ? ticketMesajlari(secili.id) : [];
  const ekler = secili ? ticketEkleri(secili.id) : [];
  /* Operatörde firma sınırı yok; bağlı mail ticketın kendi firmasından. */
  const bagliMail = secili?.mail_id ? mailGetir(secili.mail_id, secili.firma_id) : undefined;

  return (
    <div className="sayfa">
      <div className="sayfa-ust">
        <div>
          <h1>Destek Talepleri</h1>
          <p>Müşteri panelinden açılan talepler. Yanıt bekleyenler en üstte.</p>
        </div>
      </div>

      {/* İnce kartlar: bu ekranın konusu kuyruk, sayılar değil. Dört rakam da
          duruyor ama kuyruğu aşağı itmiyorlar. */}
      <dl className="kartlar ince">
        <div className="skart">
          <dt>Bizde</dt>
          <div className="deger">
            <dd style={bizde ? { color: "var(--uyari)" } : undefined}>{bizde}</dd>
          </div>
          <div className="not">yanıt bekliyor</div>
        </div>
        <div className="skart">
          <dt>Müşteride</dt>
          <div className="deger">
            <dd>{s.musteride ?? 0}</dd>
          </div>
          <div className="not">bizden çıktı</div>
        </div>
        <div className="skart">
          <dt>Açık toplam</dt>
          <div className="deger">
            <dd>{acik}</dd>
          </div>
          <div className="not">{hepsi.length} talebin</div>
        </div>
        <div className="skart">
          <dt>Çözüldü</dt>
          <div className="deger">
            <dd style={{ color: "var(--olumlu)" }}>{(s.cozuldu ?? 0) + (s.kapandi ?? 0)}</dd>
          </div>
          <div className="not">kapanmış talep</div>
        </div>
      </dl>

      <h2 className="bolum">
        Kuyruk
        <span className="sayi">{gorunen.length}</span>
        <span className="talep-suz">
          <Link className={yalnizAcik ? "etkin" : ""} href="/operator/ticketlar">
            Açık
          </Link>
          <Link className={!yalnizAcik ? "etkin" : ""} href="/operator/ticketlar?suzgec=tum">
            Tümü
          </Link>
        </span>
      </h2>

      {gorunen.length ? (
        <div className="destek-duzen">
          <div className="destek-liste">
            {gorunen.map((x) => (
              <Link
                key={x.id}
                className={`destek-satir${secili?.id === x.id ? " secili" : ""}`}
                href={`/operator/ticketlar?t=${x.id}${yalnizAcik ? "" : "&suzgec=tum"}`}
              >
                <span className="destek-ust">
                  <b>{x.konu}</b>
                  <span className="sure">{sure(x.guncelleme)}</span>
                </span>
                <span className="destek-alt">
                  <span className="firma-adi">{x.firma_ad}</span>
                  <span className="ayrac">·</span>
                  <span className={`rozet r-${x.durum}`}>{TICKET_DURUM_AD[x.durum]}</span>
                  {x.oncelik === "acil" || x.oncelik === "yuksek" ? (
                    <>
                      <span className="ayrac">·</span>
                      <span className="oncelik-vur">{TICKET_ONCELIK_AD[x.oncelik]}</span>
                    </>
                  ) : null}
                  <span className="mesaj-adet">
                    <Ikon ad="zarf" boyut={12} />
                    {x.mesaj_adedi}
                  </span>
                </span>
              </Link>
            ))}
          </div>

          <div className="destek-govde">
            {secili ? (
              <>
                {/* Başlık şerit, kollar tek satır. Üçü ayrı kutuyken yazışmadan
                    çok yer tutuyorlardı. */}
                <div className="t-ust">
                  <h2 className="destek-konu">{secili.konu}</h2>
                  <p className="destek-meta">
                    <b>{secili.firma_ad}</b>
                    <span className="t-no">#{secili.id}</span>
                    <span className="ayrac">·</span>
                    {TICKET_KATEGORI_AD[secili.kategori]}
                    <span className="ayrac">·</span>
                    {secili.acan_ad || "ekipten biri"}
                    {secili.acan_eposta ? (
                      <>
                        {" "}
                        <a href={`mailto:${secili.acan_eposta}`}>{secili.acan_eposta}</a>
                      </>
                    ) : null}
                    <span className="sure">{sure(secili.olusma)} önce açıldı</span>
                  </p>
                </div>

                <div className="t-serit">
                  <TicketDenetim
                    ticketId={secili.id}
                    durum={secili.durum}
                    oncelik={secili.oncelik}
                  />

                  <DestekZamani
                    ticketId={secili.id}
                    firmaAd={secili.firma_ad}
                    toplamDakika={destekDakika(secili.firma_id)}
                  />
                </div>

                {bagliMail ? (
                  <div className="bagli-mail sabit">
                    <Ikon ad="zarf" boyut={15} />
                    <span>
                      <small>Talebin bağlandığı mail</small>
                      <b>{bagliMail.konu || "(konu yok)"}</b>
                      <small>
                        {bagliMail.gonderen} → {bagliMail.kutu_adres}
                      </small>
                    </span>
                  </div>
                ) : null}

                {ekler.length ? (
                  <div className="ek-listesi">
                    {ekler.map((e) => (
                      <a className="ek-satiri" key={e.id} href={`/ek/${e.id}`}>
                        <Ikon ad="liste" boyut={14} />
                        <b>{e.ad}</b>
                        <span className="sayi-h">{boyutYaz(e.boyut)}</span>
                      </a>
                    ))}
                  </div>
                ) : null}

                <div className="yazisma">
                  {mesajlar.map((m) => (
                    <div className={m.operator ? "balon servis" : "balon firma"} key={m.id}>
                      <div className="balon-ust">
                        <b>{m.operator ? "Sen" : m.yazan_ad || secili.firma_ad}</b>
                        <span className="sure">{sure(m.olusma)}</span>
                      </div>
                      <p>{m.metin}</p>
                    </div>
                  ))}
                </div>

                <OpTicketYaniti ticketId={secili.id} />
              </>
            ) : (
              <p className="destek-bos">Soldan bir talep seçin.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="talep-bos">
          <Ikon ad="onay" boyut={22} />
          <b>Bekleyen destek talebi yok</b>
          <span>Bir müşteri panelinden talep açtığında burada belirir.</span>
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import {
  TICKET_DURUM_AD,
  TICKET_KATEGORI_AD,
  TICKET_ONCELIK_AD,
  gelenKutusu,
  mailGetir,
  ticketEkleri,
  ticketGetir,
  ticketMesajlari,
  ticketlariGetir,
} from "@/sunucu/db";
import { boyutYaz } from "@/sunucu/ekDosya";
import { Ikon } from "../../bilesenler/Ikon";
import { panelOturumu } from "../yetki";
import { TicketFormu, TicketYaniti } from "./TicketFormu";

/**
 * Müşterinin destek ekranı.
 *
 * Mailden ayrı bir kanal: gelen kutusu müşterinin **kendi müşterisiyle**
 * yazışmasıdır, burası müşterinin **Mailhanem ile** yazışması. İkisini
 * karıştırmamak için ayrı tabloda ve ayrı ekranda.
 *
 * Düzen gelen kutusuyla aynı mantıkta iki sütun: solda talepler, sağda seçili
 * talebin yazışması. Seçim adreste (`?t=`) duruyor — paylaşılabilir ve JS'siz
 * çalışıyor.
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

export default async function Destek({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; yeni?: string }>;
}) {
  const { t, yeni } = await searchParams;
  const { kullanici, firmaId } = await panelOturumu();

  const ticketlar = ticketlariGetir(firmaId);
  const acikAdet = ticketlar.filter((x) => !["kapandi", "cozuldu"].includes(x.durum)).length;

  const yeniFormu = yeni === "1" || (!t && !ticketlar.length);
  const secili = t ? ticketGetir(Number(t), firmaId) : (!yeniFormu ? ticketlar[0] : undefined);
  const mesajlar = secili ? ticketMesajlari(secili.id) : [];
  const ekler = secili ? ticketEkleri(secili.id) : [];
  const bagliMail = secili?.mail_id ? mailGetir(secili.mail_id, firmaId) : undefined;

  /* Yeni talep formunda bağlanabilecek mailler: son gelenler yeter, tamamını
     listelemek seçiciyi kullanılmaz yapardı. */
  const baglanabilir = yeniFormu
    ? gelenKutusu(firmaId, {}).slice(0, 25).map((m) => ({
        id: m.id,
        konu: m.konu,
        gonderen: m.gonderen,
        tarih: m.tarih,
      }))
    : [];

  return (
    <div className="sayfa">
      <div className="sayfa-ust">
        <div>
          <h1>Destek</h1>
          <p>
            Kurulum, hata ve sorularınız için. Maillerinizden ayrı bir kanal — burada
            bizimle yazışıyorsunuz.
          </p>
        </div>
        <Link className="dugme ana" href="/panel/destek?yeni=1">
          <Ikon ad="kalem" boyut={15} />
          Yeni talep
        </Link>
      </div>

      <div className="destek-duzen">
        <div className="destek-liste">
          <div className="liste-ust">
            <b>Talepleriniz</b>
            <span className="sayi">{acikAdet} açık</span>
          </div>

          {ticketlar.length ? (
            ticketlar.map((x) => {
              const bizde = x.durum === "operatorde";
              return (
                <Link
                  key={x.id}
                  className={`destek-satir${secili?.id === x.id ? " secili" : ""}`}
                  href={`/panel/destek?t=${x.id}`}
                >
                  <span className="destek-ust">
                    <b>{x.konu}</b>
                    <span className="sure">{sure(x.guncelleme)}</span>
                  </span>
                  <span className="destek-alt">
                    <span className={`rozet r-${x.durum}`}>{TICKET_DURUM_AD[x.durum]}</span>
                    <span className="ayrac">·</span>
                    <span>{TICKET_KATEGORI_AD[x.kategori]}</span>
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
                  {bizde ? <span className="destek-nb">bizde</span> : null}
                </Link>
              );
            })
          ) : (
            <p className="destek-bos">Henüz bir talebiniz yok.</p>
          )}
        </div>

        <div className="destek-govde">
          {yeniFormu ? (
            <TicketFormu mailler={baglanabilir} />
          ) : secili ? (
            <>
              {/* Başlık şerit: kutu çerçevesi ve ayrı "Talep #1" satırı yer
                  yiyordu, aynı bilgi iki satırda duruyor. */}
              <div className="t-ust">
                <h2 className="destek-konu">{secili.konu}</h2>
                <p className="destek-meta">
                  <span className={`rozet r-${secili.durum}`}>
                    {TICKET_DURUM_AD[secili.durum]}
                  </span>
                  <span className="t-no">#{secili.id}</span>
                  <span className="ayrac">·</span>
                  {TICKET_KATEGORI_AD[secili.kategori]}
                  <span className="ayrac">·</span>
                  {TICKET_ONCELIK_AD[secili.oncelik]}
                  <span className="ayrac">·</span>
                  {secili.acan_ad || secili.acan_eposta || "ekipten biri"} açtı
                  <span className="sure">{sure(secili.olusma)} önce</span>
                </p>
              </div>

              {bagliMail ? (
                <Link className="bagli-mail" href={`/panel/mail/${bagliMail.id}`}>
                  <Ikon ad="zarf" boyut={15} />
                  <span>
                    <small>Bu talep şu maile bağlı</small>
                    <b>{bagliMail.konu || "(konu yok)"}</b>
                    <small>{bagliMail.gonderen}</small>
                  </span>
                </Link>
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
                      <b>{m.operator ? "Mailhanem" : m.yazan_ad || "Ekibiniz"}</b>
                      <span className="sure">{sure(m.olusma)}</span>
                    </div>
                    <p>{m.metin}</p>
                  </div>
                ))}
              </div>

              {secili.durum === "kapandi" ? (
                <div className="kutu-bilgi">
                  <span className="ikn">
                    <Ikon ad="bilgi" boyut={16} />
                  </span>
                  <span>
                    <b>Bu talep kapandı.</b> Yeni bir mesaj yazarsanız kendiliğinden
                    yeniden açılır.
                  </span>
                </div>
              ) : null}

              <TicketYaniti ticketId={secili.id} kapali={secili.durum === "kapandi"} />
            </>
          ) : (
            <p className="destek-bos">Soldan bir talep seçin.</p>
          )}
        </div>
      </div>
    </div>
  );
}

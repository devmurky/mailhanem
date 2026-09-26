import { redirect } from "next/navigation";
import { suankiKullanici } from "@/sunucu/oturum";
import { db, gunlukSayilari, talepSayilari, ticketSayilari } from "@/sunucu/db";
import { Ikon } from "../bilesenler/Ikon";
import { TemaDugmesi } from "../bilesenler/Tema";
import { OpNav } from "./OpNav";
import { cikisYap } from "../giris/eylemler";
import "./operator.css";

/**
 * Operatör kabuğu — `tasarim/operator.html` prototipinden birebir.
 *
 * Prototipteki iskelet: üstte koyu şerit ("Operatör paneli · Mailhanem ·
 * servis yönetimi" + sağda "canlı ortam"), altında 232px'lik yan menü ve
 * kayan sahne. Menü "Servis" başlığı altında sekiz ekran, altında kimlik
 * satırı ve çıkış düğmesi.
 *
 * Stiller `operator.css`te ve hepsi `.op` altına kapsamlı — bu yüzden kök
 * sarmalayıcı o sınıfı taşıyor. Ayrıntı için o dosyanın başındaki nota bak.
 *
 * **Prototipten tek ayrılık:** "canlı ortam" rozeti. Prototip sabit yazıyordu;
 * burada gerçek ortama bakıyor, çünkü geliştirmede "canlı ortam" yazmak yalan
 * olurdu.
 */
export const dynamic = "force-dynamic";

export default async function OperatorDuzeni({ children }: { children: React.ReactNode }) {
  const kullanici = await suankiKullanici();
  if (!kullanici) redirect("/giris");
  if (kullanici.operator !== 1) redirect("/panel");

  const sayilar = talepSayilari();
  const firmaAdedi = (db.prepare("SELECT COUNT(*) AS n FROM firmalar").get() as { n: number }).n;
  const kopuk = (
    db.prepare("SELECT COUNT(*) AS n FROM kutular WHERE durum = 'kopuk'").get() as { n: number }
  ).n;
  const hataAdedi = gunlukSayilari().hata ?? 0;
  /* "Bizde" = müşteri yazdı, yanıt bekliyor. Kuyrukta aranan tek sayı bu. */
  const bizdeTicket = (ticketSayilari().operatorde ?? 0) + (ticketSayilari().acik ?? 0);

  /* Prototipin sırası: Genel Bakış · Demo Talepleri · Müşteriler · Bağlantı
     Sağlığı · Maliyet ve Marj · Abonelikler · Sistem ve Anahtarlar · Sistem
     Günlüğü. Uygulamanın fazladan "Posta Akışı" ekranı var — prototipte yok
     ama gerçek bir iş yapıyor, o yüzden silinmedi, sona eklendi. */
  const ogeler = [
    { yol: "/operator/ara", ad: "Ara", ikon: "ara", sayi: 0, dikkat: false },
    { yol: "/operator", ad: "Genel Bakış", ikon: "pano", sayi: kopuk + sayilar.yeni, dikkat: true },
    { yol: "/operator/talepler", ad: "Demo Talepleri", ikon: "zarf", sayi: sayilar.yeni, dikkat: true },
    { yol: "/operator/ticketlar", ad: "Destek Talepleri", ikon: "soru", sayi: bizdeTicket, dikkat: true },
    { yol: "/operator/musteriler", ad: "Müşteriler", ikon: "bina", sayi: firmaAdedi, dikkat: false },
    { yol: "/operator/saglik", ad: "Bağlantı Sağlığı", ikon: "nabiz", sayi: kopuk, dikkat: true },
    { yol: "/operator/maliyet", ad: "Maliyet ve Marj", ikon: "grafik", sayi: 0, dikkat: false },
    { yol: "/operator/abonelikler", ad: "Abonelikler", ikon: "kart", sayi: 0, dikkat: false },
    { yol: "/operator/ayarlar", ad: "Sistem ve Anahtarlar", ikon: "anahtar", sayi: 0, dikkat: false },
    { yol: "/operator/gunluk", ad: "Sistem Günlüğü", ikon: "liste", sayi: hataAdedi, dikkat: true },
    { yol: "/operator/posta", ad: "Posta Akışı", ikon: "liste", sayi: 0, dikkat: false },
  ];

  const bas = (kullanici.ad || kullanici.eposta).trim().slice(0, 2).toUpperCase();
  const canli = process.env.NODE_ENV === "production" && process.env.UYGULAMA_KOKU?.startsWith("https");

  return (
    <div className="op">
      <div className="uygulama">
        <div className="serit">
          <b>Operatör paneli</b>
          <span className="ayrac" />
          <span>Mailhanem · servis yönetimi</span>
          <span className={canli ? "ortam" : "ortam yerel"}>
            <i />
            {canli ? "canlı ortam" : "yerel ortam"}
          </span>
        </div>

        <div className="govde">
          <nav className="yannav">
            <div className="nav-marka">
              <span className="amblem">
                <Ikon ad="anahtar" boyut={15} />
              </span>
              <div>
                <b>Mailhanem</b>
                <small>yönetim</small>
              </div>
            </div>

            <div className="nav-bolum">Servis</div>
            <OpNav ogeler={ogeler} />

            <div className="nav-alt">
              <span className="av">{bas}</span>
              <span className="kim">
                <b>{kullanici.ad || kullanici.eposta}</b>
                <small>Servis sahibi</small>
              </span>
              {/* Müşteri panelindekiyle aynı düğme, aynı yerde: operatör de
                  gün boyu bu ekranda oturuyor. */}
              <TemaDugmesi />
              <form action={cikisYap}>
                <button className="cikis" type="submit" title="Çıkış yap" aria-label="Çıkış yap">
                  <Ikon ad="cikis" boyut={16} />
                </button>
              </form>
            </div>
          </nav>

          <div className="sahne">{children}</div>
        </div>
      </div>
    </div>
  );
}

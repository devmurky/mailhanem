import Link from "next/link";
import { redirect } from "next/navigation";
import { suankiKullanici } from "@/sunucu/oturum";
import { siteAnahtari, turnstileAcikMi } from "@/sunucu/turnstile";
import { Ikon } from "../bilesenler/Ikon";
import { GirisFormu } from "./GirisFormu";
import { PanelSimgeleri } from "./PanelSimgeleri";

export const dynamic = "force-dynamic";

function Marka({ sinif }: { sinif?: string }) {
  return (
    <Link className={sinif ? `marka ${sinif}` : "marka"} href="/">
      <span className="im">
        <Ikon ad="zarf" boyut={15} />
      </span>
      <span className="ad">Mailhanem</span>
    </Link>
  );
}

export default async function GirisSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ durum?: string }>;
}) {
  /* Oturumu açık olan giriş formunu görmesin, doğrudan kendi paneline gitsin.
     Ana sayfadaki "Giriş" bağlantısı bu yüzden tek tıkla panele bırakıyor. */
  const kullanici = await suankiKullanici();
  if (kullanici) redirect(kullanici.operator === 1 ? "/operator" : "/panel");

  const { durum } = await searchParams;

  return (
    <div className="giris-sayfa">
      <aside className="sol">
        <div className="yikama" aria-hidden="true">
          <span className="y1" />
          <span className="y2" />
          <span className="y3" />
        </div>

        <div className="sol-ic">
          <Marka />
          <div>
            <span className="rzt">
              <span className="nokta" />
              Erken erişim
            </span>
          </div>
          <h1>
            Ortak kutunuz
            <em>düzende bekliyor.</em>
          </h1>
          <p>
            Kimin neye baktığı, hangi mailin ne kadar beklediği ve hangi maile yanıt
            yazıldığı panelde duruyor.
          </p>

          <PanelSimgeleri />

          <ul className="guvence">
            <li>
              <span className="im">
                <Ikon ad="kilit" boyut={14} />
              </span>
              <span>
                <b>Şifre yok.</b> E-posta adresinize tek kullanımlık giriş linki
                gönderiyoruz.
              </span>
            </li>
            <li>
              <span className="im">
                <Ikon ad="kalkan" boyut={14} />
              </span>
              <span>
                <b>Mailleriniz kendi sunucunuzda kalır.</b> Bu giriş yalnızca panele
                erişim içindir; posta kutunuzun şifresiyle ilgisi yoktur.
              </span>
            </li>
          </ul>
        </div>
      </aside>

      <main className="sag">
        <Link className="geri" href="/">
          <Ikon ad="sagok" boyut={13} className="ters" />
          mailhanem.app
        </Link>

        <div className="sag-ic">
          <Marka sinif="mobil-marka" />
          <GirisFormu
            gecersiz={durum === "gecersiz"}
            firmasiz={durum === "firmasiz"}
            /* İki anahtar birden yoksa koruma kapalı; yarım kurulumda widget
               çizip sunucuda doğrulamamak güvenlik hissi verip hiçbir şey
               yapmazdı. */
            turnstileAnahtari={turnstileAcikMi() ? siteAnahtari() : ""}
          />

          <p className="uyari-not">
            <span className="ikn">
              <Ikon ad="bilgi" boyut={15} />
            </span>
            <span>
              Mailhanem&apos;de kendi kendine hesap açılmıyor. Kurulumu ekran
              paylaşımıyla birlikte yapıyoruz; kutunuz bağlandıktan sonra bu adres
              çalışmaya başlıyor.
            </span>
          </p>
        </div>
      </main>
    </div>
  );
}

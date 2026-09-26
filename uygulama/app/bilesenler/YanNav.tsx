"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ikon } from "./Ikon";
import { cikisYap } from "../giris/eylemler";

export type NavOge = { yol: string; ad: string; ikon: string; sayi?: number; dikkat?: boolean };

/**
 * İki panelin de sol menüsü. Operatör arka ofisi ile müşteri paneli aynı
 * bileşeni kullanır; aralarındaki fark yalnızca marka altyazısı, kök yolu ve
 * alttaki kimlik satırı.
 */
export function YanNav({
  ogeler,
  kullanici,
  kok,
  altBaslik,
  bolum,
}: {
  ogeler: NavOge[];
  kullanici: { ad: string; eposta: string; rol: string };
  /** Markaya tıklayınca gidilen yer. */
  kok: string;
  /** Marka adının altındaki mono satır. */
  altBaslik: string;
  /** Menü başlığı — "Servis", "Firma" gibi. */
  bolum: string;
}) {
  const yol = usePathname();
  const bas = (kullanici.ad || kullanici.eposta).trim().charAt(0).toUpperCase();

  return (
    <nav className="yannav" aria-label="Panel bölümleri">
      <Link className="nav-marka" href={kok}>
        <span className="amblem">
          <Ikon ad="zarf" boyut={18} />
        </span>
        <span>
          <b>Mailhanem</b>
          <small>{altBaslik}</small>
        </span>
      </Link>

      <p className="nav-bolum">{bolum}</p>
      {ogeler.map((o) => {
        const aktif = yol === o.yol || (o.yol !== kok && yol.startsWith(o.yol));
        return (
          <Link key={o.yol} className={aktif ? "nav-oge aktif" : "nav-oge"} href={o.yol}>
            <span className="ikn">
              <Ikon ad={o.ikon} boyut={17} />
            </span>
            <span className="et-ad">{o.ad}</span>
            {o.sayi ? (
              <span className={o.dikkat ? "sayi dikkat" : "sayi"}>{o.sayi}</span>
            ) : null}
          </Link>
        );
      })}

      <div className="nav-alt">
        <span className="av">{bas}</span>
        <span className="kim">
          <b>{kullanici.ad || kullanici.eposta}</b>
          <small>{kullanici.rol}</small>
        </span>
        <form action={cikisYap}>
          <button className="cikis" type="submit" aria-label="Çıkış yap" title="Çıkış yap">
            <Ikon ad="cikis" boyut={17} />
          </button>
        </form>
      </div>
    </nav>
  );
}

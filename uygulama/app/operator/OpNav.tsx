"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ikon } from "../bilesenler/Ikon";

export type OpNavOge = {
  yol: string;
  ad: string;
  ikon: string;
  sayi: number;
  dikkat: boolean;
};

/**
 * Operatör yan menüsü — prototipteki `navCiz()`in karşılığı.
 *
 * Prototip düğme kullanıyordu çünkü tek sayfaydı; burada gerçek rotalar var,
 * o yüzden `Link`. Görünüm birebir: ikon, etiket, sağda sayı rozeti.
 *
 * Aktif satır `usePathname` ile bulunuyor. Kök `/operator` her alt yolun da
 * öneki olduğu için tam eşleşme aranıyor; yoksa Genel Bakış hep yanardı.
 */
export function OpNav({ ogeler }: { ogeler: OpNavOge[] }) {
  const yol = usePathname();

  return (
    <div>
      {ogeler.map((o) => {
        const aktif = yol === o.yol;
        return (
          <Link key={o.yol} className={aktif ? "nav-oge aktif" : "nav-oge"} href={o.yol}>
            <span className="ikon">
              <Ikon ad={o.ikon} boyut={16} />
            </span>
            <span className="et">{o.ad}</span>
            {o.sayi > 0 ? (
              <span className={o.dikkat ? "sayi dikkat" : "sayi"}>{o.sayi}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

import type { GelirHareketi } from "@/sunucu/db";
import { para } from "../MusteriTablosu";

/**
 * Gelir şelalesi (madde 4) — prototipteki `selale`.
 *
 * Dönem başındaki gelirden bugünküne nasıl gelindiğini gösteriyor: baz, yeni
 * müşteri, plan yükseltme, plan düşürme, ayrılan, son. Çubuk yüksekliği en
 * büyük harekete göre ölçekleniyor.
 *
 * **Sıfır olan kalem çizilmiyor.** Yüksekliği sıfır bir çubuk ve yanında
 * "₺0" yazısı, ekranda bir şey olduğunu ama ne olduğunu söylemeyen gürültü
 * üretirdi; baz ve son her zaman duruyor çünkü onlar şelalenin iki ucu.
 *
 * Grafik kütüphanesi yok — sunucuda çizilen birkaç div. Panelin geri kalanı da
 * böyle (bkz. genel bakıştaki durum halkası).
 */
export function Selale({ hareket }: { hareket: GelirHareketi }) {
  if (hareket.gecmisYok) return null;

  const kalemler = [
    { ad: "Dönem başı", tur: "baz", d: hareket.baz },
    { ad: "Yeni müşteri", tur: "arti", d: hareket.yeni },
    { ad: "Plan yükseltme", tur: "arti", d: hareket.yukseltme },
    { ad: "Plan düşürme", tur: "eksi", d: hareket.dusurme },
    { ad: "Ayrılan", tur: "eksi", d: hareket.ayrilan },
    { ad: "Bugün", tur: "son", d: hareket.son },
  ].filter((k) => k.d !== 0 || k.tur === "baz" || k.tur === "son");

  const enB = Math.max(...kalemler.map((k) => Math.abs(k.d)), 1);

  return (
    <div className="selale">
      {kalemler.map((k) => (
        <div className={`sel ${k.tur}`} key={k.ad}>
          <span className="deg">
            {k.tur === "arti" && k.d > 0 ? "+" : ""}
            {para(k.d)}
          </span>
          <div
            className="cub"
            style={{ height: `${Math.max(3, Math.round((Math.abs(k.d) / enB) * 100))}%` }}
          />
          <span className="et">{k.ad}</span>
        </div>
      ))}
    </div>
  );
}

import Link from "next/link";
import { Kivilcim } from "./Kivilcim";

/**
 * Operatörün müşteri tablosu — prototipteki `tabloHTML()` / `musSatir()`.
 *
 * Dokuz sütun, prototipteki sırayla: Müşteri · Plan · Sağlık · Mail/ay ·
 * Yapay zekâ · Destek sa. · Abonelik · Net marj · Durum.
 *
 * ── Dokuz sütunun dokuzu da gerçek sorgudan ────────────────
 * Hiçbir hücrede sabit değer yok. Sağlık skoru `saglikSkoru()`, yapay zekâ
 * `ai_kullanim`, destek `destek_kayitlari`, net marj bu ikisinin hesabı.
 *
 * Bugün bazıları tire gösteriyor çünkü o tablolarda **henüz satır yok**.
 * Sağlık skoru şimdiden çalışıyor: ölçülebilen bileşenlere (hacim eğilimi,
 * aktif kullanıcı oranı) göre hesaplanıyor ve `kapsam` kaç puanlık bölümün
 * gerçekten ölçüldüğünü söylüyor — eksik bileşen sıfır sayılmıyor, çünkü veri
 * yokluğunu kötü performans gibi göstermek yanlış olurdu. Model bağlanınca
 * kapsam kendiliğinden 100'e çıkar.
 */

export type MusteriSatiri = {
  id: number;
  ad: string;
  alan_adi: string;
  plan: string;
  durum: string;
  aylik_kurus: number;
  gelen_ay: number;
  hacim: number[];
  /** Ölçülemiyorsa null — sıfır değil. */
  skor: number | null;
  kapsam: number;
  ai_kurus: number | null;
  destek_dk: number | null;
  net_yuzde: number | null;
};

function skorSinif(s: number): string {
  return s >= 70 ? "s-iyi" : s >= 45 ? "s-orta" : "s-kotu";
}

const PLAN_AD: Record<string, string> = {
  kurumsal: "Kurumsal",
  pro: "Pro",
  baslangic: "Başlangıç",
  deneme: "Deneme",
};

/* Prototipteki DURUM_AD: [nokta sınıfı, etiket]. */
const DURUM_AD: Record<string, [string, string]> = {
  etkin: ["", "Aktif"],
  deneme: ["bekle", "Deneme"],
  duraklatildi: ["bekle", "Duraklatıldı"],
  ayrildi: ["kotu", "Ayrıldı"],
};

export function para(kurus: number): string {
  return (
    "₺" +
    (kurus / 100).toLocaleString("tr-TR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  );
}

const SUTUNLAR: { ad: string; sag: boolean }[] = [
  { ad: "Müşteri", sag: false },
  { ad: "Plan", sag: false },
  { ad: "Sağlık", sag: true },
  { ad: "Mail / ay", sag: true },
  { ad: "Yapay zekâ", sag: true },
  { ad: "Destek sa.", sag: true },
  { ad: "Abonelik", sag: true },
  { ad: "Net marj", sag: true },
  { ad: "Durum", sag: false },
];

export function MusteriTablosu({ satirlar }: { satirlar: MusteriSatiri[] }) {
  if (!satirlar.length) {
    return (
      <div className="tablo-sar">
        <p className="bos-satir">Henüz müşteri yok. İlk firma kurulduğunda burada görünecek.</p>
      </div>
    );
  }

  return (
    <div className="tablo-sar">
      <table>
        <thead>
          <tr>
            {SUTUNLAR.map((s) => (
              <th key={s.ad} className={s.sag ? "dokunma sag" : "dokunma"}>
                {s.ad}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {satirlar.map((m) => {
            const d = DURUM_AD[m.durum] ?? ["bekle", m.durum];
            const bas = m.ad.trim().slice(0, 2).toUpperCase();
            return (
              <tr key={m.id}>
                <td>
                  <Link className="mus" href={`/operator/musteriler?firma=${m.id}`}>
                    <span className="av kare">{bas}</span>
                    <span>
                      <b>{m.ad}</b>
                      <small>{m.alan_adi}</small>
                    </span>
                  </Link>
                </td>
                <td>
                  <span className={`plan p-${m.plan}`}>{PLAN_AD[m.plan] ?? m.plan}</span>
                </td>
                <td className="sag">
                  {m.skor === null ? (
                    <span className="olcusuz" title="Skorun hiçbir bileşeni henüz ölçülemiyor">
                      —
                    </span>
                  ) : (
                    <span
                      className={`saglik ${skorSinif(m.skor)}`}
                      title={`Skorun %${m.kapsam}'lık bölümü ölçülebiliyor`}
                    >
                      <span className="ray">
                        <i style={{ width: `${m.skor}%` }} />
                      </span>
                      <b>{m.skor}</b>
                    </span>
                  )}
                </td>
                <td className="sag">
                  <span className="sayi-h">{m.gelen_ay.toLocaleString("tr-TR")}</span>{" "}
                  <Kivilcim dizi={m.hacim} renk="var(--soluk)" genislik={42} yukseklik={16} />
                </td>
                <td className="sag">
                  {m.ai_kurus === null ? (
                    <span className="olcusuz" title="Model henüz işlem yazmadı">
                      —
                    </span>
                  ) : (
                    <span className="sayi-h">{para(m.ai_kurus)}</span>
                  )}
                </td>
                <td className="sag">
                  {m.destek_dk === null ? (
                    <span className="olcusuz" title="Bu firmaya destek dakikası girilmemiş">
                      —
                    </span>
                  ) : (
                    <span className="sayi-h">
                      {(m.destek_dk / 60).toLocaleString("tr-TR", {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}
                    </span>
                  )}
                </td>
                <td className="sag sayi-h">{m.aylik_kurus ? para(m.aylik_kurus) : "—"}</td>
                <td className="sag">
                  {m.net_yuzde === null ? (
                    <span className="olcusuz" title="Yapay zekâ ve destek ölçüsü bekliyor">
                      —
                    </span>
                  ) : (
                    <span
                      className={
                        m.net_yuzde < 0 ? "marj eksi" : m.net_yuzde < 55 ? "marj dusuk" : "marj"
                      }
                    >
                      %{m.net_yuzde}
                    </span>
                  )}
                </td>
                <td>
                  <span className={`durum-n ${d[0]}`}>
                    <i />
                    {d[1]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

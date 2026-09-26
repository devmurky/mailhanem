import Link from "next/link";
import { GUNLUK_TIPLERI, gunlukGetir, gunlukSayilari } from "@/sunucu/db";
import { Ikon } from "../../bilesenler/Ikon";

export const dynamic = "force-dynamic";

const TIP_AD: Record<string, string> = {
  kurulum: "Kurulum",
  posta: "Posta",
  giris: "Giriş",
  hata: "Hata",
  abonelik: "Abonelik",
  zeka: "Yapay zekâ",
  veri: "Veri kopyası",
};

const TIP_ROZET: Record<string, string> = {
  kurulum: "r-bilgi",
  posta: "r-kapali",
  giris: "r-kapali",
  hata: "r-kritik",
  abonelik: "r-bitti",
  zeka: "r-bilgi",
  veri: "r-bilgi",
};

export default async function SistemGunlugu({
  searchParams,
}: {
  searchParams: Promise<{ tip?: string }>;
}) {
  const { tip: hamTip } = await searchParams;
  const tip = (GUNLUK_TIPLERI as readonly string[]).includes(hamTip ?? "") ? hamTip : undefined;

  const satirlar = gunlukGetir(tip);
  const sayilar = gunlukSayilari();
  const toplam = Object.values(sayilar).reduce((t, n) => t + n, 0);

  return (
    <div className="sayfa">
      <div className="sayfa-ust">
        <div>
          <h1>Sistem Günlüğü</h1>
          <p>Ne oldu, ne zaman, kim yaptı — denetim izi</p>
        </div>
      </div>

      {/* Prototipteki kilit uyarısı. Operatör müşterinin bütün yazışmasını
          okuyabiliyor; bunu gizlemek, öğrenildiği gün şirketi bitirir. */}
      <div className="kural-kutu uyari-kutu">
        <Ikon ad="kilit" boyut={19} />
        <div>
          <h3>Hesaba giriş kayıtları silinemez</h3>
          <p>
            Bir müşteri paneline yapılan her giriş bu listede sarı zeminle işaretli.
            Bu satırlar değiştirilemez ve silinemez. Müşterinin tüm yazışmasını
            okuyabildiğin bir sistemde giriş kaydını gizlemek, öğrenildiği gün
            şirketi bitirir.
          </p>
        </div>
      </div>

      <h2 className="bolum">
        Olaylar
        <span className="sayi">{satirlar.length}</span>
        <span className="talep-suz">
          <Link className={!tip ? "etkin" : ""} href="/operator/gunluk">
            Tümü <span className="sayi-h">{toplam}</span>
          </Link>
          {GUNLUK_TIPLERI.map((t) => (
            <Link
              key={t}
              className={tip === t ? "etkin" : ""}
              href={`/operator/gunluk?tip=${t}`}
            >
              {TIP_AD[t] ?? t} <span className="sayi-h">{sayilar[t] ?? 0}</span>
            </Link>
          ))}
        </span>
      </h2>

      {satirlar.length ? (
        <div className="tablo-sar">
          {satirlar.map((g) => (
            /* Giriş olayları vurgulu: denetimde ilk bakılacak satırlar onlar. */
            <div className={g.tip === "giris" ? "olay vurgu" : "olay"} key={g.id}>
              <span className="vakit">{g.olusma.slice(0, 16)}</span>
              <span className={`tur t-${g.tip}`}>{TIP_AD[g.tip] ?? g.tip}</span>
              <span className="ic">{g.mesaj}</span>
              <span className="kim">{g.firma_ad ?? "sistem"}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="talep-bos">
          <Ikon ad="liste" boyut={22} />
          <b>{tip ? "Bu türde kayıt yok" : "Günlük boş"}</b>
          <span>
            Kutu bağlandığında, çekim düştüğünde ya da abonelik değiştiğinde buraya
            satır düşer.
          </span>
        </div>
      )}

      <p className="dip">
        <b>Her istek buraya yazılmıyor.</b> Yalnızca anlamı olan olaylar: kutu
        bağlandı, parola güncellendi, çekim düştü, yanıt gönderilemedi, ekip
        değişti, abonelik güncellendi. Her şeyi yazmak, önemli satırı görünmez
        ederdi. Günlük şu an temizlenmiyor — saklama süresi ve arşive taşıma
        gerektiğinde eklenecek; <b>giriş kayıtları o zaman da silinmeyecek</b>.
      </p>
    </div>
  );
}

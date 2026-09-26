import Link from "next/link";
import { talepleriGetir, talepSayilari } from "@/sunucu/db";
import { Ikon } from "../../bilesenler/Ikon";
import { TalepSatiri } from "./TalepSatiri";

export const dynamic = "force-dynamic";

export default async function Talepler({
  searchParams,
}: {
  searchParams: Promise<{ suzgec?: string }>;
}) {
  const { suzgec } = await searchParams;
  const yalnizAcik = suzgec !== "tum";

  const hepsi = talepleriGetir(false);
  const acik = hepsi.filter((t) => t.durum !== "kapandi");
  const gorunen = yalnizAcik ? acik : hepsi;
  const s = talepSayilari();
  const donusum = hepsi.length ? Math.round((s.kuruldu / hepsi.length) * 100) : 0;

  const enEski = acik
    .filter((t) => t.durum === "yeni")
    .map((t) => t.olusma)
    .sort()[0];

  return (
    <div className="sayfa">
      <div className="sayfa-ust">
        <div>
          <h1>Demo Talepleri</h1>
          <p>Tanıtım sayfasındaki formdan düşer. Yanıtlamadığın her saat bir müşteri kaybı.</p>
        </div>
      </div>

      <dl className="kartlar">
        <div className="skart">
          <dt>Yanıt bekleyen</dt>
          <div className="deger">
            <dd style={s.yeni ? { color: "var(--uyari)" } : undefined}>{s.yeni}</dd>
          </div>
          <div className="not">
            {enEski ? `en eskisi ${new Date(enEski.replace(" ", "T") + "Z").toLocaleDateString("tr-TR")}` : "kuyruk boş"}
          </div>
        </div>
        <div className="skart">
          <dt>Saat önerildi</dt>
          <div className="deger">
            <dd>{s.yazildi}</dd>
          </div>
          <div className="not">cevap bekleniyor</div>
        </div>
        <div className="skart">
          <dt>Görüşme kuruldu</dt>
          <div className="deger">
            <dd style={{ color: "var(--olumlu)" }}>{s.kuruldu}</dd>
          </div>
          <div className="not">takvime girdi</div>
        </div>
        <div className="skart">
          <dt>Talepten görüşmeye</dt>
          <div className="deger">
            <dd>%{donusum}</dd>
          </div>
          <div className="not">
            {hepsi.length} talebin {s.kuruldu} tanesi
          </div>
        </div>
      </dl>

      <h2 className="bolum">
        Kuyruk
        <span className="sayi">{acik.length} açık</span>
        <span className="talep-suz">
          <Link className={yalnizAcik ? "etkin" : ""} href="/operator/talepler">
            Açık
          </Link>
          <Link className={!yalnizAcik ? "etkin" : ""} href="/operator/talepler?suzgec=tum">
            Tümü
          </Link>
        </span>
      </h2>

      <div className="triyaj">
        {gorunen.length ? (
          gorunen.map((t) => <TalepSatiri key={t.id} talep={t} />)
        ) : (
          <div className="talep-bos">
            <Ikon ad="onay" boyut={22} />
            <b>Bekleyen talep yok</b>
            <span>Siteden yeni bir form düştüğünde burada belirir.</span>
          </div>
        )}
      </div>

      <div className="kutu-uyari">
        <span className="ikn">
          <Ikon ad="bilgi" boyut={16} />
        </span>
        <span>
          <b>Bu ekran sitenin formuyla eşleşir.</b> Alanlar birebir aynı: ad, firma, e-posta,
          telefon, posta sağlayıcısı, kutuya bakan kişi sayısı ve serbest not. Sitedeki
          iletişim bilgileri <Link href="/operator/ayarlar">Site Ayarları</Link>&apos;ndan
          yönetilir; boş bırakılan bir alan sayfada hiç görünmez.
        </span>
      </div>
    </div>
  );
}

import Link from "next/link";
import { GUNLUK_TIPLERI, firmaGunlugu, firmaGunlukSayilari } from "@/sunucu/db";
import { Ikon } from "../../bilesenler/Ikon";
import { kurulumGorur, panelOturumu } from "../yetki";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Hesap kaydı — müşterinin kendi denetim izi (madde 11).
 *
 * Operatör panelindeki günlük ekranı şunu yazıyor: "Müşterinin tüm yazışmasını
 * okuyabildiğin bir sistemde giriş kaydını gizlemek, öğrenildiği gün şirketi
 * bitirir." Aynı ekran müşterinin de aynı kayıtları gördüğünü söylüyordu;
 * **söylüyordu ama görmüyordu.** Bu sayfa o sözün tutulduğu yer.
 *
 * Üç karar:
 *
 * 1. **Aynı satırlar, süzülmüş kopya değil.** Operatörün gördüğü satırın
 *    aynısı burada; firmaya ait olmayanlar hiç gelmiyor. Müşteriye özel,
 *    törpülenmiş bir sürüm hazırlamak denetim kaydını anlamsız kılardı.
 * 2. **Sahip ve yönetici görür.** Kayıtta ekip değişiklikleri, kutu parolası
 *    güncellemeleri ve giriş satırları var; bunlar yönetim bilgisi.
 * 3. **Ne yazılmadığı da yazıyor.** Sayfanın dibinde hangi olayların kayda
 *    girdiği açıkça duruyor — "her şey kaydediliyor" izlenimi vermek, kaydı
 *    olduğundan geniş göstermek olurdu.
 */
const TIP_AD: Record<string, string> = {
  kurulum: "Kurulum",
  posta: "Posta",
  giris: "Giriş",
  hata: "Hata",
  abonelik: "Abonelik",
  zeka: "Yapay zekâ",
};

const TIP_ANLAM: Record<string, string> = {
  kurulum: "Kutu bağlandı, parola güncellendi, ekip değişti",
  posta: "Çekim sırasında atlanan ek gibi posta olayları",
  giris: "Hesabınıza yapılan girişler",
  hata: "Çekim düştü, yanıt gönderilemedi",
  abonelik: "Plan ve ücret değişiklikleri",
  zeka: "Bilgi deposu için maillerin modele okutulduğu turlar",
};

export default async function HesapKaydi({
  searchParams,
}: {
  searchParams: Promise<{ tip?: string }>;
}) {
  const { kullanici, firma, firmaId } = await panelOturumu();
  /* Personel kendi işini yapar; hesabın denetim kaydı yönetim bilgisidir. */
  if (!kurulumGorur(kullanici)) redirect("/panel");

  const { tip: hamTip } = await searchParams;
  const tip = (GUNLUK_TIPLERI as readonly string[]).includes(hamTip ?? "") ? hamTip : undefined;

  const satirlar = firmaGunlugu(firmaId, tip);
  const sayilar = firmaGunlukSayilari(firmaId);
  const toplam = Object.values(sayilar).reduce((t, n) => t + n, 0);

  return (
    <div className="sayfa">
      <div className="sayfa-ust">
        <div>
          <h1>Hesap Kaydı</h1>
          <p>{firma.ad} hesabında ne oldu, ne zaman oldu</p>
        </div>
      </div>

      {/* Aynı vaat operatör tarafında da yazılı; burada müşterinin dilinden. */}
      <div className="kural-kutu uyari-kutu">
        <Ikon ad="kilit" boyut={19} />
        <div>
          <h3>Bu liste bizim ekranımızdakiyle aynı</h3>
          <p>
            Mailhanem ekibi de aynı satırları görüyor — sizin için ayrı, süzülmüş
            bir kopya hazırlanmıyor. Hesabınıza yapılan girişler{" "}
            <b>silinemez ve değiştirilemez</b>: yazışmanızın tamamını
            okuyabildiğimiz bir sistemde giriş kaydını gizlemek kabul edilemez.
          </p>
        </div>
      </div>

      <h2 className="bolum">
        Olaylar
        <span className="sayi">{satirlar.length}</span>
        <span className="talep-suz">
          <Link className={!tip ? "etkin" : ""} href="/panel/gunluk">
            Tümü <span className="sayi-h">{toplam}</span>
          </Link>
          {GUNLUK_TIPLERI.filter((t) => sayilar[t]).map((t) => (
            <Link
              key={t}
              className={tip === t ? "etkin" : ""}
              href={`/panel/gunluk?tip=${t}`}
              title={TIP_ANLAM[t]}
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
            </div>
          ))}
        </div>
      ) : (
        <div className="talep-bos">
          <Ikon ad="liste" boyut={22} />
          <b>{tip ? "Bu türde kayıt yok" : "Henüz kayıt yok"}</b>
          <span>
            Panele girildiğinde, kutu bağlandığında ya da ekip değiştiğinde buraya
            satır düşer.
          </span>
        </div>
      )}

      <p className="dip">
        <b>Her istek buraya yazılmıyor.</b> Kayda giren olaylar: panele giriş, kutu
        bağlama ve parola güncelleme, ekip değişiklikleri, çekim hataları,
        gönderilemeyen yanıtlar, destek talebi açılması, abonelik değişiklikleri ve
        bilgi deposu için çalıştırılan yapay zekâ turları.
        Mail okuma ve mail üzerinde yapılan işlemler (sahiplenme, kategori, durum)
        bu listeye düşmüyor — hepsini yazmak önemli satırı görünmez ederdi.
      </p>
    </div>
  );
}

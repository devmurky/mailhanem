/**
 * Zamanlayıcının çalışan yarısı: nabız ve çekim.
 *
 * `zamanlayici.ts`'den ayrı durmasının sebebi teknik ama önemli. Panel
 * ekranları zamanlayıcının **durumunu** okuyor; o dosyayı bir sayfa import
 * ettiğinde, buradaki mail hattı (imapflow, mailparser) da sayfanın modül
 * grafiğine giriyor ve derleme kırılıyordu. Ayar tarafı saf kaldı; ağır taraf
 * yalnızca `instrumentation.ts` tarafından, sunucu açılışında yükleniyor.
 */
import { ayarOku, ayarYaz } from "./db.ts";
import { hepsiniCek } from "./posta/isci.ts";
import { gecikenleriBildir } from "./bildirim.ts";
import { ARALIK_AD, araligiOku, SON_CALISMA, SON_SONUC } from "./zamanlayici.ts";

const NABIZ_MS = 60_000;

let kurulu = false;
let calisiyor = false;

function simdi(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

/** Aralık dolduysa çekimi çalıştırır. Dakikada bir çağrılır. */
export async function nabiz(): Promise<void> {
  const aralik = araligiOku();
  if (aralik === 0 || calisiyor) return;

  const sonCalisma = ayarOku(SON_CALISMA);
  if (sonCalisma) {
    const gecen = Date.now() - Date.parse(sonCalisma + "Z");
    if (gecen < aralik * 60_000) return;
  }

  calisiyor = true;
  try {
    const sonuc = await hepsiniCek();
    const yeni = sonuc.reduce((t, s) => t + s.yeni, 0);
    const hatali = sonuc.filter((s) => s.hata);
    const ozet = sonuc.length
      ? `${sonuc.length} kutu · ${yeni} yeni mail` +
        (hatali.length ? ` · ${hatali.length} kutuda hata: ${hatali[0]?.hata ?? ""}` : "")
      : "bağlı kutu yok";
    ayarYaz(SON_SONUC, ozet);
    console.log(`[zamanlayıcı] çekim bitti — ${ozet}`);

    /* Çekimden **sonra** bakılıyor: az önce gelen mail de sayıma girsin.
       Bildirimin kendi sessizlik damgası var, her turda mail çıkmıyor.
       Hatası çekimi düşürmemeli — bildirim gönderilememesi, maillerin
       çekilmemiş sayılmasına yol açmamalı. */
    try {
      const bildirimler = await gecikenleriBildir();
      const gidenler = bildirimler.filter((b) => b.gonderildi);
      if (gidenler.length) {
        console.log(
          `[bildirim] ${gidenler.length} firmaya geciken mail özeti gönderildi`,
        );
      }
    } catch (e) {
      console.error(
        `[bildirim] gönderilemedi — ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  } catch (e) {
    const hata = e instanceof Error ? e.message : String(e);
    ayarYaz(SON_SONUC, `hata: ${hata}`);
    console.error(`[zamanlayıcı] çekim düştü — ${hata}`);
  } finally {
    /* Damga başarıda da hatada da atılır: düşen bir kutu yüzünden zamanlayıcı
       her nabızda yeniden denemeye girip IMAP'i dövmesin. */
    ayarYaz(SON_CALISMA, simdi());
    calisiyor = false;
  }
}

/** Sunucu açılışında bir kez çağrılır (`instrumentation.ts`). */
export function zamanlayiciyiBaslat(): void {
  if (kurulu) return;
  kurulu = true;

  const sayac = setInterval(() => {
    void nabiz();
  }, NABIZ_MS);
  /* Zamanlayıcı süreci ayakta tutmasın; sunucu kapanırken beklenmesin. */
  sayac.unref?.();

  const aralik = araligiOku();
  console.log(
    aralik > 0
      ? `[zamanlayıcı] kuruldu — ${ARALIK_AD[aralik] ?? aralik + " dakika"}`
      : "[zamanlayıcı] kuruldu — kapalı, çekim yalnızca elle",
  );

  /* Sunucu kapalıyken aralık dolmuş olabilir; ilk nabzı beklemeden atıyoruz. */
  void nabiz();
}

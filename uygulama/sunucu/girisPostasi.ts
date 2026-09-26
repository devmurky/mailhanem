/**
 * Giriş bağlantısının mailini kuran yer.
 *
 * İki çağıranı var — panelin kendi giriş formu ve siteden gelen
 * `/api/giris-linki` ucu — ve ikisinin de aynı metni göndermesi gerekiyor.
 *
 * Kullanıcıya dönen cevap **adres tanınsa da tanınmasa da aynıdır**; burası
 * yalnızca tanınan adres için çağrılır. Gönderim başarısız olursa bile dışarı
 * farklı bir şey söylenmez: hata günlüğe ve operatör paneline gider.
 */
import { girisLinkiUret } from "./oturum.ts";
import { gonder } from "./posta/gonderim.ts";
import type { Kullanici } from "./db.ts";
import { uygulamaKoku } from "./koku.ts";

/* Geriye dönük: bu adı buradan alan çağıranlar var. */
export { uygulamaKoku };

const GECERLILIK_DK = 15;



function metin(ad: string, baglanti: string): string {
  const merhaba = ad.trim() ? `Merhaba ${ad.trim()},` : "Merhaba,";
  return [
    merhaba,
    "",
    "Mailhanem paneline giriş bağlantınız hazır. Aşağıdaki adrese tıklayın:",
    "",
    baglanti,
    "",
    `Bağlantı ${GECERLILIK_DK} dakika geçerli ve yalnızca bir kez kullanılabilir.`,
    "Bu isteği siz yapmadıysanız bu maili yok sayabilirsiniz; hesabınıza",
    "bağlantı olmadan girilemez.",
    "",
    "Mailhanem",
  ].join("\n");
}

/**
 * Bağlantıyı üretir ve gönderir. SMTP kapalıyken bağlantı sunucu günlüğüne
 * yazılır — geliştirmede giriş yapmanın yolu budur.
 */
export async function girisPostasiGonder(kullanici: Kullanici): Promise<void> {
  /* Ekipten çıkarılmış kişiye bağlantı üretmiyoruz. Dışarıya dönen cevap yine
     değişmiyor; "bu hesap kapalı" demek de kimin müşteri olduğunu ele verirdi. */
  if (kullanici.durum !== "etkin") {
    console.log(`[giris] kapalı hesap, bağlantı üretilmedi: ${kullanici.eposta}`);
    return;
  }

  const { jeton } = girisLinkiUret(kullanici.id);
  const baglanti = `${uygulamaKoku()}/giris/dogrula?jeton=${jeton}`;

  /* SMTP kapalıyken de `gonder` çağrılıyor: orası mesajı hem konsola hem
     `veri/giden-mailler.log`'a yazıyor. Önceden burada erken dönülüyordu ve
     bağlantı yalnızca konsola düşüyordu — sunucuyu arka planda çalıştıran
     kimse onu göremiyordu. */
  const sonuc = await gonder({
    kime: kullanici.eposta,
    konu: "Mailhanem paneline giriş bağlantınız",
    metin: metin(kullanici.ad, baglanti),
  });

  /* Gönderilemeyen bağlantı da günlüğe düşsün: operatör müşteriye elden
     iletebilsin diye. Dışarıya söylenen cevap değişmiyor. */
  if (!sonuc.gercek) {
    console.log(`[giris] gönderilemedi, bağlantı: ${kullanici.eposta} → ${baglanti}`);
  }
}

/**
 * Ekip daveti. Girişten iki farkı var: metin "seni şu firma davet etti" diyor,
 * ve **sonuç çağırana dönüyor**. Burada gizlenecek bir şey yok — daveti veren
 * adresi zaten kendisi yazdı, gidip gitmediğini bilmeye hakkı var.
 */
export async function davetPostasiGonder(
  kullanici: Kullanici,
  davetEden: string,
  firmaAd: string,
): Promise<{ gonderildi: boolean; baglanti: string }> {
  const { jeton } = girisLinkiUret(kullanici.id);
  const baglanti = `${uygulamaKoku()}/giris/dogrula?jeton=${jeton}`;

  const govde = [
    kullanici.ad.trim() ? `Merhaba ${kullanici.ad.trim()},` : "Merhaba,",
    "",
    `${davetEden}, sizi ${firmaAd} adına Mailhanem paneline davet etti.`,
    "Panel firmanızın ortak posta kutularını tek yerden yönetmek için kullanılıyor.",
    "",
    "Girmek için aşağıdaki bağlantıya tıklayın:",
    "",
    baglanti,
    "",
    `Bağlantı ${GECERLILIK_DK} dakika geçerli. Süresi geçerse panelin giriş`,
    "sayfasından adresinizle yeni bir bağlantı isteyebilirsiniz; şifre yok.",
    "",
    "Mailhanem",
  ].join("\n");

  const sonuc = await gonder({
    kime: kullanici.eposta,
    konu: `${firmaAd} sizi Mailhanem paneline davet etti`,
    metin: govde,
  });

  if (!sonuc.gercek) {
    console.log(`[davet] gönderilemedi, bağlantı: ${kullanici.eposta} → ${baglanti}`);
  }
  return { gonderildi: sonuc.gercek, baglanti };
}

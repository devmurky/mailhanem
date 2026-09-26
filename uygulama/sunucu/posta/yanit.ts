/**
 * Mail yanıtlama.
 *
 * Yanıt **müşterinin kendi kutusundan** çıkar, Mailhanem'in sistem SMTP'sinden
 * değil. Sebebi basit: müşteriye cevap veren firma, Mailhanem değil. `From`
 * kutunun adresi, kimlik kutunun kendi SMTP kimliği, parola da kutu bağlanırken
 * şifrelenmiş olan parola.
 *
 * Zincir korunuyor: `In-Reply-To` ve `References` gelen mailin Message-ID'sine
 * bakıyor, böylece karşı taraftaki istemci yanıtı aynı konuşmanın altına koyuyor.
 *
 * Gönderilen yanıt veritabanına da yazılıyor. Kutuyu salt okunur açtığımız için
 * yanıtı "Gönderilmiş Öğeler" klasörüne koyamıyoruz; panelde ne yazıldığının
 * kaydı olmasaydı ekip kendi yazdığını göremezdi.
 */
import { zarfiAc } from "../kasa.ts";
import { gonderIle, type PostaAyari } from "./gonderim.ts";
import type { Kutu, Mail } from "../db.ts";

/** Konu zaten "Re:" ile başlıyorsa ikinci kez eklenmez. */
export function yanitKonusu(konu: string): string {
  const temiz = konu.trim();
  if (!temiz) return "Re: (konu yok)";
  return /^(re|ynt|yan)\s*:/i.test(temiz) ? temiz : `Re: ${temiz}`;
}

/** Gelen mailin gövdesini alıntılar — yanıtın altındaki "> " blokları. */
export function alintila(mail: Pick<Mail, "gonderen_ad" | "gonderen" | "tarih" | "govde">): string {
  const kim = mail.gonderen_ad || mail.gonderen;
  const govde = (mail.govde || "").trim();
  if (!govde) return "";
  const satirlar = govde.split("\n").map((s) => `> ${s}`).join("\n");
  return `\n\n${mail.tarih.slice(0, 16)} tarihinde ${kim} yazdı:\n${satirlar}`;
}

export type YanitSonucu = { tamam: boolean; hata?: string; mesajKimlik?: string };

/**
 * Kutunun SMTP ayarını kurar. Parola çözülemezse ya da SMTP yazılmamışsa
 * `undefined` döner — çağıran neden gönderemediğini kullanıcıya söyler.
 */
export function kutuAyari(kutu: Kutu): PostaAyari | undefined {
  if (!kutu.smtp_sunucu || !kutu.parola_sifreli) return undefined;
  return {
    sunucu: kutu.smtp_sunucu,
    port: kutu.smtp_port,
    guvenli: kutu.smtp_port === 465,
    kullanici: kutu.kullanici_adi || kutu.adres,
    parola: zarfiAc(kutu.parola_sifreli),
    gonderen: kutu.adres,
  };
}

export async function yanitGonder(
  kutu: Kutu,
  mail: Mail,
  metin: string,
  yazanAd: string,
  alintiEkle = true,
): Promise<YanitSonucu> {
  if (!kutu.smtp_sunucu) {
    return {
      tamam: false,
      hata:
        "Bu kutu için SMTP sunucusu tanımlı değil, yanıt gönderilemez. " +
        "Mail Hesapları ekranından kutuyu yeniden bağlayın.",
    };
  }
  if (!kutu.parola_sifreli) {
    return { tamam: false, hata: "Bu kutunun parolası kayıtlı değil; kutu henüz kurulmadı." };
  }

  let ayar: PostaAyari | undefined;
  try {
    ayar = kutuAyari(kutu);
  } catch (e) {
    return { tamam: false, hata: e instanceof Error ? e.message : String(e) };
  }
  if (!ayar) return { tamam: false, hata: "Kutunun gönderim ayarı eksik." };

  const govde = metin.trimEnd() + (alintiEkle ? alintila(mail) : "");

  const sonuc = await gonderIle(ayar, {
    kime: mail.gonderen,
    konu: yanitKonusu(mail.konu),
    metin: govde,
    /* Görünen ad yazan kişi, adres kutunun adresi: müşteri kime yazdığını bilsin. */
    gonderen: yazanAd ? `${yazanAd} <${kutu.adres}>` : kutu.adres,
    basliklar: mail.mesaj_kimlik
      ? { "In-Reply-To": mail.mesaj_kimlik, References: mail.mesaj_kimlik }
      : undefined,
  });

  return sonuc.gercek
    ? { tamam: true, mesajKimlik: sonuc.mesajKimlik }
    : { tamam: false, hata: sonuc.hata ?? "Gönderilemedi." };
}

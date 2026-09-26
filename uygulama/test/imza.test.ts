/**
 * İmza ayırma (madde 1).
 *
 * Testlerin yarısı "kesilmeli" diyor, yarısı "kesilmemeli". İkincisi daha
 * önemli: yanlış kesme mesajın son paragrafını gizler, kesmemek yalnızca
 * özeti kirletir. O yüzden her kesme kuralının bir de negatif örneği var.
 *
 * Veritabanı yok — `imza.ts` saf metin modülü.
 */
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { imzaAyir, kuyrukKatlanir } from "../sunucu/posta/imza.ts";
import { ozetCikar } from "../sunucu/posta/kaynak.ts";

test("RFC ayracı (--) imzayı keser", () => {
  const a = imzaAyir("Merhaba,\n\nFiyat listesini rica ediyorum.\n\n--\nAyşe Demir\nSatın Alma\nTel: 0212 555 44 33");
  assert.equal(a.sebep, "ayrac");
  assert.equal(a.metin, "Merhaba,\n\nFiyat listesini rica ediyorum.");
  assert.ok(a.kuyruk.startsWith("--"));
  assert.ok(a.kuyruk.includes("0212"), "kuyruk atılmıyor, ayrılıyor");
});

test("kapanış cümlesi + kısa blok imza sayılır", () => {
  const a = imzaAyir("Merhaba,\n\nKoltuğu iade etmek istiyorum.\n\nTeşekkürler,\nAyşe Demir");
  assert.equal(a.sebep, "kapanis");
  assert.equal(a.metin, "Merhaba,\n\nKoltuğu iade etmek istiyorum.");
});

test("Türkçe karakter taşımayan kapanış da yakalanır", () => {
  const a = imzaAyir("Merhaba,\n\nIade kargo ucreti bana mi ait?\n\nTesekkurler,\nAyse Demir");
  assert.equal(a.sebep, "kapanis");
  assert.ok(!a.metin.includes("Ayse"));
});

test("kapanıştan sonra paragraf devam ediyorsa kesilmez", () => {
  const govde =
    "Teşekkürler, konuyu ilettim.\n\n" +
    "Ancak burada bir ayrıntı var: sipariş numarası yanlış girilmiş ve bu " +
    "yüzden kargo şubesi ürünü teslim edemedi. Yeni numarayı bugün " +
    "göndereceğim, ardından teslimatın tekrar planlanması gerekiyor.\n\n" +
    "Bu arada faturayı da yeniden düzenlemek gerekecek mi, onu da sorayım.";
  const a = imzaAyir(govde);
  assert.equal(a.sebep, "", "mesajın gövdesi kesilmemeli");
  assert.equal(a.kuyruk, "");
});

test("mailin başındaki selam kesim noktası değildir", () => {
  const a = imzaAyir("Iyi gunler,\n\nYeni ofisimiz icin 40 adet koltuk almayi planliyoruz.\nToplu alimda fiyat nedir?");
  assert.equal(a.sebep, "", "önünde mesaj olmayan satır kesmez");
  assert.ok(a.metin.includes("40 adet"));
});

test("alıntı başlığı (… yazdı:) kuyruğu başlatır", () => {
  const a = imzaAyir("Evet, uygun.\n\n11.09.2026 10:22 tarihinde Murat Şen yazdı:\n> Numune görebilir miyiz?");
  assert.equal(a.sebep, "alinti");
  assert.equal(a.metin, "Evet, uygun.");
});

test("İngilizce alıntı başlığı da yakalanır", () => {
  const a = imzaAyir("Sure, that works.\n\nOn Thu, 11 Sep 2026 at 10:22, Murat Sen wrote:\n> Can we see a sample?");
  assert.equal(a.sebep, "alinti");
  assert.equal(a.metin, "Sure, that works.");
});

test("Outlook başlık bloğu alıntı sayılır", () => {
  const a = imzaAyir("Bilginize.\n\nFrom: Murat Şen\nSent: 11 Eylül 2026 10:22\nSubject: Toplu alım\n\nMerhaba...");
  assert.equal(a.sebep, "alinti");
  assert.equal(a.metin, "Bilginize.");
});

test("satır arası yanıt: ilk alıntı satırı tek başına kesmiyor", () => {
  /* Alıntının **altına** yazan insanlar var; ilk `>` satırında kesseydik
     onların kendi cümlesi kaybolurdu. */
  const a = imzaAyir("Merhaba\n> eski mail\nEvet, bu tarih bize uygun.");
  assert.equal(a.sebep, "");
  assert.ok(a.metin.includes("uygun"));
});

test("yasal uyarı kuyruğa gider", () => {
  const a = imzaAyir(
    "Ekte şubat faturaları var.\n\nBu e-posta ve ekleri gizlidir, yalnızca muhatabına yöneliktir; yanlışlıkla ulaştıysa siliniz.",
  );
  assert.equal(a.sebep, "yasal");
  assert.equal(a.metin, "Ekte şubat faturaları var.");
});

test("iletişim izi taşıyan son blok ayracsız da kesilir", () => {
  const a = imzaAyir("Merhaba,\n\nTeklifi bekliyoruz.\n\nMurat Şen\nSatınalma\nTel: 0532 111 22 33\nwww.teknoyapi.com");
  assert.equal(a.sebep, "iletisim");
  assert.equal(a.metin, "Merhaba,\n\nTeklifi bekliyoruz.");
});

test("iletişim izi yoksa son blok kesilmez", () => {
  const a = imzaAyir("Merhaba,\n\nTeklifi bekliyoruz.\n\nMurat Şen\nSatınalma");
  assert.equal(a.sebep, "", "yalnız ad ve unvan imza sayılmıyor");
  assert.ok(a.metin.includes("Murat"));
});

test("çizgi ayracı yalnız arkasından imza gelirse keser", () => {
  const imzali = imzaAyir("Fiyatlar ektedir.\n\n-----\nErgün Denetim\nTel: 0216 000 00 00");
  assert.equal(imzali.sebep, "ayrac");

  const bolum = imzaAyir(
    "Birinci bölüm: teslim koşulları aşağıda ayrıntılı olarak yazıyor.\n" +
      "-----\n" +
      "İkinci bölüm: ödeme planı üç taksit hâlinde ilerliyor ve ilk taksit " +
      "sözleşme imzalandığı gün kesiliyor, ikincisi teslimde, üçüncüsü " +
      "montajdan sonra. Bu plan değişirse yazılı bildirim gerekiyor.",
  );
  assert.equal(bolum.sebep, "", "mesaj bölümü ayracı kesim değil");
});

test("gövdenin tamamı imzaya benziyorsa kesilmez", () => {
  const a = imzaAyir("--\nAyşe Demir\nTel: 0212 555 44 33");
  assert.equal(a.sebep, "", "kesim mesajı yok ediyorsa yapılmaz");
  assert.ok(a.metin.includes("Ayşe"));
});

test("boş gövde patlamaz", () => {
  assert.deepEqual(imzaAyir(""), { metin: "", kuyruk: "", sebep: "" });
  assert.deepEqual(imzaAyir("   \n\n  "), { metin: "", kuyruk: "", sebep: "" });
});

test("CRLF satır sonları aynı sonucu verir", () => {
  const a = imzaAyir("Merhaba,\r\n\r\nRica ederim.\r\n\r\n--\r\nAyşe\r\nTel: 0212 555 44 33");
  assert.equal(a.sebep, "ayrac");
  assert.equal(a.metin, "Merhaba,\n\nRica ederim.");
});

test("katlama eşiği: kısa imza katlanmaz, alıntı her boyda katlanır", () => {
  const kisa = imzaAyir("Merhaba,\n\nİade edeceğim.\n\nTeşekkürler,\nAyşe Demir");
  assert.equal(kuyrukKatlanir(kisa), false, "iki satırlık imza düğmeye değmez");

  const uzun = imzaAyir("Merhaba,\n\nİade edeceğim.\n\n--\nAyşe Demir\nSatın Alma\nTel: 0212 555 44 33");
  assert.equal(kuyrukKatlanir(uzun), true);

  const alinti = imzaAyir("Evet.\n\n11.09.2026 tarihinde Murat Şen yazdı:\n> Olur mu?");
  assert.equal(kuyrukKatlanir(alinti), true, "alıntı kısa da olsa katlanır");
});

test("özet imzayı taşımıyor", () => {
  const ozet = ozetCikar(
    "Merhaba,\n\nKoltuğu iade etmek istiyorum.\n\n--\nAyşe Demir\nSatın Alma\nTel: 0212 555 44 33\nwww.ornekmusteri.com",
  );
  assert.equal(ozet, "Merhaba, Koltuğu iade etmek istiyorum.");
  assert.ok(!ozet.includes("0212"));
});

/**
 * Demo vitrini.
 *
 * Sitedeki "Demoda deneyimleyin" düğmesi ziyaretçiyi giriş istemeden dolu bir
 * müşteri paneline bırakır. Boş panel göstermek ürünü anlatmaz: gelen kutusu
 * boşken sekmeler, süzgeçler, geciken rozeti ve genel bakış halkası hiçbir şey
 * söylemez. O yüzden burada gerçekçi ama **tamamen uydurma** bir firma kuruluyor.
 *
 * Üç kural:
 *
 * 1. **Veri demo olduğunu saklamıyor.** Firma `demo=1` bayrağı taşıyor; panel bu
 *    bayrağı görünce tepeye "örnek verilerle çalışıyor" şeridi koyuyor. Ziyaretçi
 *    gerçek bir müşterinin kutusuna baktığını sanmasın.
 * 2. **Her ziyarette sıfırlanıyor.** Demo firma silinip yeniden yazılıyor; bir
 *    önceki ziyaretçinin sahiplendiği, kapattığı, yanıtladığı mailler sonrakine
 *    kalmıyor. Silme `ON DELETE CASCADE` ile kullanıcıları, kutuları, mailleri
 *    ve oturumları da götürüyor.
 * 3. **Gerçek veriye dokunmuyor.** Yalnızca `demo=1` olan satır siliniyor;
 *    gerçek müşterinin kaydı bu koddan etkilenmiyor.
 *
 * Bilinen sınır: tek bir demo firma var. Aynı anda iki ziyaretçi girerse ikincisi
 * birincinin panelini sıfırlar. Tek haneli müşteri sayısında sorun değil;
 * ziyaretçi başına ayrı vitrin gerekirse burası bölünecek yer.
 */
import { db, kullaniciIdIle, type Kullanici } from "./db.ts";
import { zarfla } from "./kasa.ts";

export const DEMO_FIRMA = "Vadi Mobilya";
export const DEMO_ALAN = "vadimobilya.com";

/* Ziyaretçinin kimliğine büründüğü hesap. Adresler demo alan adında: gerçek
   bir kutuya mail gitme ihtimali olmasın. */
const DEMO_SAHIP = "selin@demo.mailhanem.app";

/** Panelin demo şeridini göstereceği yer. */
export function demoMu(firma: { demo?: number }): boolean {
  return firma.demo === 1;
}

/* ── vitrin içeriği ─────────────────────────────────────────
   Saat cinsinden geriye yayılıyor: hepsi aynı ana damgalanırsa liste
   "az önce" diye okunur ve geciken sekmesi boş kalır. 24 saati geçen açık
   mailler (GECIKME_SAAT) gecikmiş sayılıyor — demo onları da göstersin. */

type DemoMail = {
  kutu: 0 | 1;
  ad: string;
  adres: string;
  konu: string;
  ozet: string;
  govde: string;
  saatOnce: number;
  kategori: string | null;
  /** 0 = sahipsiz, 1 = sahip, 2 = yönetici, 3 = personel */
  sahip: 0 | 1 | 2 | 3;
  durum: string;
  elendi?: string;
  /**
   * Konuşma etiketi (madde 2). Aynı etiketi taşıyan mailler tek yazışma
   * sayılıyor. Dizi indisine göre kurulan Message-ID'ye bağlamıyoruz: araya
   * bir mail eklenince bütün zincirler kayardı.
   */
  zincir?: string;
};

const MAILLER: DemoMail[] = [
  {
    kutu: 1, ad: "Ayça Tuncel", adres: "ayca.tuncel@gmail.com",
    konu: "Vadi koltuk takımı stokta var mı?",
    ozet: "İnternet sitesinde gördüğüm üçlü koltuk takımının antrasit rengi stokta var mı acaba?",
    govde: "Merhaba,\n\nİnternet sitesinde gördüğüm üçlü koltuk takımının antrasit rengi stokta var mı acaba? Ankara'ya teslimat süresi ne kadar olur?\n\nTeşekkürler,\nAyça Tuncel",
    saatOnce: 26, kategori: "satis", sahip: 1, durum: "islemde", zincir: "koltuk",
  },
  /* Aynı yazışmanın ikinci mesajı (madde 2): araya bizim yanıtımız giriyor ve
     panelde üç mesajlık bir konuşma oluyor. Vitrin bunu göstermezse konuşma
     görünümü demoda hiç görünmezdi. */
  {
    kutu: 1, ad: "Ayça Tuncel", adres: "ayca.tuncel@gmail.com",
    konu: "Re: Vadi koltuk takımı stokta var mı?",
    ozet: "Antrasit uygun, peki 3+2+1 takım hâlinde alırsam bir indirim oluyor mu?",
    govde: "Teşekkürler, hızlı dönüş için.\n\nAntrasit rengi bizim için uygun. 3+2+1 takım hâlinde alırsam bir indirim oluyor mu? Ayrıca montaj ücrete dahil mi?\n\nAyça Tuncel",
    saatOnce: 2, kategori: "satis", sahip: 1, durum: "islemde", zincir: "koltuk",
  },
  {
    kutu: 1, ad: "Kemal Arslan", adres: "kemal@ofisyapi.com.tr",
    konu: "Toplu sipariş için fiyat listesi",
    ozet: "Yeni ofisimiz için 40 çalışma masası ve sandalye alacağız, kurumsal fiyat listeniz var mı?",
    /* İmzası bilinçli olarak altı satır + yasal uyarı: madde 1'in kuyruk
       katlaması vitrinde de görünsün. Kurumsal mailin gerçek hâli bu. */
    govde: "İyi günler,\n\nYeni ofisimiz için yaklaşık 40 çalışma masası ve sandalye alacağız. Kurumsal fiyat listeniz varsa paylaşabilir misiniz? Montaj da sizde mi?\n\n--\nKemal Arslan\nSatınalma Uzmanı | Ofis Yapı A.Ş.\nTel: 0216 555 12 34 · GSM: 0532 111 22 33\nwww.ofisyapi.com.tr\n\nBu e-posta ve ekleri gizlidir, yalnızca muhatabına yöneliktir. Yanlışlıkla ulaştıysa siliniz.",
    saatOnce: 5, kategori: "satis", sahip: 0, durum: "yeni",
  },
  {
    kutu: 0, ad: "Hatice Yalçın", adres: "hatice.yalcin@outlook.com",
    konu: "Teslim edilen ürün hasarlı geldi",
    ozet: "Dün teslim alınan yemek masasının kenarında derin bir çizik var, fotoğrafları ektedir.",
    govde: "Merhaba,\n\nDün teslim aldığım yemek masasının kenarında derin bir çizik var. Kargo görevlisi tutanak tutmadı. Değişim yapabilir misiniz?\n\nSipariş no: VM-20418\n\nHatice Yalçın",
    saatOnce: 30, kategori: "sikayet", sahip: 3, durum: "islemde",
  },
  {
    kutu: 0, ad: "Turhost Muhasebe", adres: "muhasebe@turhost.com",
    konu: "Şubat ayı hosting fatura bilgilendirmesi",
    ozet: "Şubat dönemi faturanız oluşturuldu. Ödeme için son tarih 28 Şubat.",
    govde: "Sayın yetkili,\n\nŞubat dönemi hosting faturanız oluşturulmuştur. Ödeme için son tarih 28 Şubat'tır.\n\nTurhost",
    saatOnce: 26, kategori: "fatura", sahip: 0, durum: "yeni",
  },
  {
    kutu: 0, ad: "Serkan Öz", adres: "serkan@vadiyapi.com",
    konu: "Montaj randevusu değişikliği",
    ozet: "Perşembe için verdiğiniz montaj randevusunu cumaya alabilir miyiz?",
    govde: "Merhaba,\n\nPerşembe için verdiğiniz montaj randevusunu cumaya alabilir miyiz? Şantiyede o gün kimse olmayacak.\n\nSerkan Öz",
    saatOnce: 8, kategori: "destek", sahip: 2, durum: "islemde",
  },
  {
    kutu: 1, ad: "Nur Banu Şahin", adres: "nurbanu.sahin@gmail.com",
    konu: "Kumaş rengi değişimi mümkün mü?",
    ozet: "Sipariş verdiğim berjerin kumaşını krem yerine gri yapmak istiyorum, üretime girdi mi?",
    govde: "İyi akşamlar,\n\nGeçen hafta sipariş verdiğim berjerin kumaşını krem yerine gri yapmak istiyorum. Üretime girdiyse haber verir misiniz?\n\nNur Banu Şahin",
    saatOnce: 12, kategori: "destek", sahip: 1, durum: "islemde",
  },
  {
    kutu: 1, ad: "Emre Çetin", adres: "emre.cetin@kurumsalalim.com",
    konu: "Bayilik başvurusu — İzmir bölgesi",
    ozet: "İzmir'de mobilya mağazamız var, bayilik koşullarınızı öğrenmek istiyoruz.",
    govde: "Merhaba,\n\nİzmir Bornova'da 400 m² mobilya mağazamız var. Bayilik koşullarınızı ve bölge kısıtlarınızı öğrenmek istiyoruz. Uygunsanız bir görüşme ayarlayalım.\n\nEmre Çetin",
    saatOnce: 50, kategori: "satis", sahip: 0, durum: "yeni",
  },
  {
    kutu: 1, ad: "Zeynep Aydın", adres: "zeynep@aydindekor.com",
    konu: "Numune talebi",
    ozet: "Müşteri sunumu için üç kumaş numunesi rica ediyoruz, kargo bize ait.",
    govde: "Merhaba,\n\nMüşteri sunumu için üç kumaş numunesi rica ediyoruz. Kargo bizim hesabımıza olabilir.\n\nZeynep Aydın\nAydın Dekorasyon",
    saatOnce: 20, kategori: "satis", sahip: 3, durum: "yanitlandi",
  },
  {
    kutu: 0, ad: "Ali Rıza Köse", adres: "aliriza.kose@gmail.com",
    konu: "Kargo takip numarası",
    ozet: "Siparişimin kargo takip numarasını alabilir miyim?",
    govde: "Merhaba, siparişimin kargo takip numarasını alabilir miyim?\n\nAli Rıza Köse",
    saatOnce: 40, kategori: "destek", sahip: 2, durum: "kapandi",
  },
  {
    kutu: 0, ad: "Fatma Güneş", adres: "fatma@gunesmobilya.com",
    konu: "İade süreci hakkında",
    ozet: "14 gün içinde iade hakkımı kullanmak istiyorum, süreç nasıl işliyor?",
    govde: "Merhaba,\n\n14 gün içinde iade hakkımı kullanmak istiyorum. Ürün kullanılmadı, kutusu duruyor. Süreç nasıl işliyor?\n\nFatma Güneş",
    saatOnce: 3, kategori: "sikayet", sahip: 0, durum: "yeni",
  },
  {
    kutu: 1, ad: "Okan Demirtaş", adres: "okan@ticaretodasi.org.tr",
    konu: "Mobilya fuarı davetiyesi",
    ozet: "Nisan ayındaki bölgesel mobilya fuarı için stant başvuruları açıldı.",
    govde: "Sayın üyemiz,\n\nNisan ayında düzenlenecek bölgesel mobilya fuarı için stant başvuruları açılmıştır. Son başvuru tarihi 15 Mart'tır.\n\nTicaret Odası",
    saatOnce: 60, kategori: "diger", sahip: 1, durum: "islemde",
  },

  /* ── kural motorunun elediği mailler ──────────────────────
     Panelde görünmüyorlar; Posta Akışı ekranında "neden gelmedi" sorusunun
     cevabı olarak duruyorlar. Eleme oranı demoda da gerçek görünsün. */
  {
    kutu: 1, ad: "Trendyol", adres: "no-reply@trendyol.com",
    konu: "Bu hafta size özel fırsatlar",
    ozet: "Haftanın indirimleri ve size özel kuponlar.",
    govde: "", saatOnce: 4, kategori: null, sahip: 0, durum: "yeni", elendi: "bulten",
  },
  {
    kutu: 0, ad: "LinkedIn", adres: "messages-noreply@linkedin.com",
    konu: "Profilinizi bu hafta 12 kişi görüntüledi",
    ozet: "Bağlantılarınızdan haberler.",
    govde: "", saatOnce: 7, kategori: null, sahip: 0, durum: "yeni", elendi: "bulten",
  },
  {
    kutu: 0, ad: "Mail Delivery Subsystem", adres: "mailer-daemon@vadimobilya.com",
    konu: "Undelivered Mail Returned to Sender",
    ozet: "Adres bulunamadı.",
    govde: "", saatOnce: 9, kategori: null, sahip: 0, durum: "yeni", elendi: "otomatik-yanit",
  },
  {
    kutu: 1, ad: "Selin Vardar", adres: "selin@vadimobilya.com",
    konu: "Haftalık toplantı notları",
    ozet: "Dünkü toplantının notlarını ekte paylaşıyorum.",
    govde: "", saatOnce: 6, kategori: null, sahip: 0, durum: "yeni", elendi: "ic-yazisma",
  },
];

/**
 * Demo firmayı sıfırdan kurar ve ziyaretçinin gireceği hesabı döner.
 *
 * Tek işlemde yapılıyor: yarıda kalırsa ziyaretçi yarım kurulmuş bir panele
 * düşmesin.
 */
export function demoKur(): Kullanici {
  /* `node:sqlite`'da better-sqlite3'ün `transaction()` yardımcısı yok;
     işlem sınırı elle çiziliyor. */
  db.exec("BEGIN IMMEDIATE");
  let kullaniciId: number;
  try {
    kullaniciId = vitriniYaz();
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  const kullanici = kullaniciIdIle(kullaniciId);
  if (!kullanici) throw new Error("Demo hesabı kurulamadı.");
  return kullanici;
}

/** Bütün yazma işi. Çağıran açık bir işlemin içinde olmalı. */
function vitriniYaz(): number {
  {
    /* Önceki ziyaretin izini sil. Yalnızca demo bayraklı satır; CASCADE
       kullanıcıları, kutuları, mailleri ve açık oturumları da götürüyor. */
    db.prepare("DELETE FROM firmalar WHERE demo = 1").run();

    const firma = db
      .prepare(
        `INSERT INTO firmalar (ad, alan_adi, plan, durum, demo, aylik_kurus)
         VALUES (?, ?, 'pro', 'etkin', 1, 249000) RETURNING id`,
      )
      .get(DEMO_FIRMA, DEMO_ALAN) as { id: number };

    /* Ekip: ziyaretçi sahibin gözünden bakıyor, ötekiler atama hedefi olsun diye. */
    const kisiler = [
      [DEMO_SAHIP, "Selin Vardar", "sahip"],
      ["burak@demo.mailhanem.app", "Burak Doğan", "yonetici"],
      ["merve@demo.mailhanem.app", "Merve Kılıç", "personel"],
    ] as const;

    const kisiId: number[] = [];
    for (const [eposta, ad, rol] of kisiler) {
      const s = db
        .prepare(
          `INSERT INTO kullanicilar (firma_id, eposta, ad, rol, operator, durum)
           VALUES (?, ?, ?, ?, 0, 'etkin') RETURNING id`,
        )
        .get(firma.id, eposta, ad, rol) as { id: number };
      kisiId.push(s.id);
    }

    /* Kutular SMTP bilgisiyle kuruluyor: yanıt kutusu demoda da görünsün.
       Parola uydurma ama kasadan geçiyor — şemada düz metin parola durmuyor.
       Gerçekten "gönder"e basılırsa bağlantı kurulamaz ve ekran bunu dürüstçe
       söyler; olmayan bir yetenek "gönderildi" diye gösterilmiyor. */
    const kutuId: number[] = [];
    for (const [adres, durum, saatOnce] of [
      ["info@vadimobilya.com", "iyi", 0.2],
      ["satis@vadimobilya.com", "iyi", 0.4],
    ] as const) {
      const s = db
        .prepare(
          `INSERT INTO kutular (firma_id, adres, saglayici, imap_sunucu, smtp_sunucu,
                                kullanici_adi, parola_sifreli, durum, son_cekim)
           VALUES (?, ?, 'cPanel — Turhost', 'imap.turhost.com', 'smtp.turhost.com', ?, ?, ?,
                   datetime('now', ?)) RETURNING id`,
        )
        .get(
          firma.id,
          adres,
          adres,
          zarfla("demo-parolasi-gecersiz"),
          durum,
          `-${Math.round(saatOnce * 60)} minutes`,
        ) as { id: number };
      kutuId.push(s.id);
    }

    /* Dizi indisleri `number | undefined` dönüyor; kurulumun eksiksiz olduğunu
       burada bir kez doğrulayıp aşağıda tekrar tekrar kontrol etmiyoruz. */
    const [kutuInfo, kutuSatis] = kutuId;
    const demoSahip = kisiId[0];
    if (kutuInfo === undefined || kutuSatis === undefined || demoSahip === undefined) {
      throw new Error("Demo vitrini eksik kuruldu.");
    }

    MAILLER.forEach((m, i) => {
      const sahipId = m.sahip === 0 ? null : (kisiId[m.sahip - 1] ?? null);
      db.prepare(
        `INSERT INTO mailler (kutu_id, firma_id, mesaj_kimlik, gonderen_ad, gonderen, konu,
                              ozet, govde, tarih, kategori, sahip_id, durum, elendi, eleme_sebep,
                              konusma)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), ?, ?, ?, ?, ?, ?)`,
      ).run(
        m.kutu === 0 ? kutuInfo : kutuSatis,
        firma.id,
        `<demo-${i}@vadimobilya.com>`,
        m.ad,
        m.adres,
        m.konu,
        m.ozet,
        m.govde,
        `-${m.saatOnce} hours`,
        m.kategori,
        sahipId,
        m.durum,
        m.elendi ? new Date().toISOString().replace("T", " ").slice(0, 19) : null,
        m.elendi ?? "",
        /* Zinciri olmayan mail kendi kimliğini taşıyor: tek mesajlık konuşma. */
        m.zincir ? `<demo-zincir-${m.zincir}@vadimobilya.com>` : `<demo-${i}@vadimobilya.com>`,
      );
    });

    /* Konuşmanın ortasındaki bizim yanıtımız (madde 2). `yanitlar` tablosu
       gerçek gönderimin kaydı; demoda da oradan okunuyor ki konuşma akışı
       uydurma bir yerden değil, ürünün kendi verisinden çıksın. */
    const ilkKoltuk = db
      .prepare(
        "SELECT id FROM mailler WHERE firma_id = ? AND konusma = ? ORDER BY tarih LIMIT 1",
      )
      .get(firma.id, "<demo-zincir-koltuk@vadimobilya.com>") as { id: number } | undefined;

    if (ilkKoltuk) {
      db.prepare(
        `INSERT INTO yanitlar (mail_id, firma_id, kullanici_id, kime, konu, metin,
                               mesaj_kimlik, hata, olusma)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, datetime('now', '-20 hours'))`,
      ).run(
        ilkKoltuk.id,
        firma.id,
        demoSahip,
        "ayca.tuncel@gmail.com",
        "Re: Vadi koltuk takımı stokta var mı?",
        "Merhaba Ayça Hanım,\n\nAntrasit renk stokta mevcut. Ankara'ya teslimat " +
          "5 iş günü sürüyor. Ölçüleri ve kumaş bilgisini ekteki katalogda " +
          "bulabilirsiniz.\n\nİyi çalışmalar,\nSelin Vardar",
        "<demo-yanit-koltuk@vadimobilya.com>",
      );
    }

    /* ── Bilgi deposu ──────────────────────────────────────
       Vitrinde dolu görünmesi gerekiyor: boş bir depo ekranı özelliğin ne işe
       yaradığını anlatmıyor. Bilerek karışık: bazı alanlar elle yazılmış, bazısı
       çıkarımdan onaylanmış, ve **onay bekleyen iki öneri** duruyor — akışın
       kendisi de vitrinde görünsün. */
    const karakter = [
      ["tanim", "Ofis ve ev mobilyası üretiyoruz; müşterilerimiz kurumsal firmalar ve son kullanıcılar.", "elle"],
      ["ton", "Kısa ve net yazıyoruz, fazla resmi değil. Verilen tarih mutlaka yazılır.", "cikarim"],
      ["hitap", "“Merhaba <ad> Bey/Hanım” ile başlıyoruz, siz diliyle devam ediyoruz.", "cikarim"],
      ["imza", "İyi çalışmalar,\nVadi Mobilya · Müşteri İlişkileri", "elle"],
    ] as const;
    for (const [alan, deger, kaynak] of karakter) {
      db.prepare(
        `INSERT INTO karakter_alanlari (firma_id, alan, deger, kaynak, guncelleyen_id)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(firma.id, alan, deger, kaynak, demoSahip);
    }

    for (const [baslik, icerik, kategori, kaynak, dayanak] of [
      ["Kargo ve teslimat süresi",
       "İstanbul ve Ankara'ya 5 iş günü, diğer illere 7 iş günü. Montaj fiyata dahildir.",
       "destek", "cikarim", "Teslimat sorulan 6 mailden"],
      ["İade koşulu",
       "14 gün içinde iade kabul ediliyor; ürünün kutusu duruyorsa kargo ücreti bize ait.",
       "sikayet", "elle", ""],
      ["Toplu alım",
       "20 adetten fazla siparişlerde fiyat maille verilmiyor, satış ekibi teklif hazırlıyor.",
       "satis", "cikarim", "Toplu alım soran 3 mailden"],
    ] as const) {
      db.prepare(
        `INSERT INTO bilgi_kartlari (firma_id, baslik, icerik, kategori, kaynak, dayanak,
                                     guncelleyen_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(firma.id, baslik, icerik, kategori, kaynak, dayanak, demoSahip);
    }

    for (const [tur, alan, baslik, icerik, kategori, dayanak] of [
      ["karakter", "kurallar", "",
       "Stok teyidi alınmadan “mevcut” yazılmıyor; depo onayı sonrası bilgi veriliyor.",
       "", "Stok sorulan 4 yanıttan"],
      ["kart", "", "Montaj randevusu",
       "Montaj randevusu teslimattan sonra planlanıyor ve müşteriye telefonla teyit ediliyor.",
       "destek", "Montaj konulu 3 mailden"],
    ] as const) {
      db.prepare(
        `INSERT INTO bilgi_onerileri (firma_id, tur, alan, baslik, icerik, kategori, dayanak)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(firma.id, tur, alan, baslik, icerik, kategori, dayanak);
    }

    db.prepare(
      `INSERT INTO bilgi_cikarimlari (firma_id, baslatan_id, okunan_mail, okunan_yanit,
                                      oneri, model, olusma)
       VALUES (?, ?, 48, 9, 6, 'claude-sonnet-5', datetime('now', '-3 days'))`,
    ).run(firma.id, demoSahip);

    /* VIP: maile değil gönderenin adresine bağlı. Bayilik başvurusu ve toplu
       sipariş demoda yıldızlı görünsün. */
    for (const adres of ["emre.cetin@kurumsalalim.com", "kemal@ofisyapi.com.tr"]) {
      db.prepare(
        "INSERT INTO vip_gonderenler (firma_id, adres, ekleyen) VALUES (?, ?, ?)",
      ).run(firma.id, adres, demoSahip);
    }

    for (const [ad, kategori, metin] of [
      ["Stok teyidi", "satis",
       "Merhaba {ad},\n\n{konu} hakkındaki sorunuz için teşekkürler. Ürün şu anda stoklarımızda mevcut; siparişi bugün verirseniz 3 iş günü içinde kargoya veriyoruz.\n\nİyi günler,\n{ben}\n{firma}"],
      ["İade bilgilendirme", "sikayet",
       "Merhaba {ad},\n\nİade talebinizi aldık. Ürünü kutusuyla birlikte anlaşmalı kargomuza teslim etmeniz yeterli; kargo ücreti bize ait. Ürün tarafımıza ulaştıktan sonra 5 iş günü içinde ödemeniz iade edilir.\n\n{ben}\n{firma}"],
      ["Montaj randevusu", "destek",
       "Merhaba {ad},\n\nMontaj ekibimiz için uygun gününüzü iletirseniz randevuyu oluşturalım. Montaj ortalama 2 saat sürüyor.\n\n{ben}\n{firma}"],
    ] as const) {
      db.prepare(
        "INSERT INTO sablonlar (firma_id, ad, kategori, metin, kullanim) VALUES (?, ?, ?, ?, ?)",
      ).run(firma.id, ad, kategori, metin, 0);
    }

    for (const [tip, kalip, kategori, sahipSira, sira] of [
      ["alan", "ofisyapi.com.tr", "satis", 2, 1],
      ["konu", "fatura", "fatura", 0, 2],
      ["konu", "iade", "sikayet", 3, 3],
      ["gonderen", "muhasebe@turhost.com", "fatura", 0, 4],
    ] as const) {
      db.prepare(
        `INSERT INTO yonlendirmeler (firma_id, tip, kalip, kategori, sahip_id, sira)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        firma.id,
        tip,
        kalip,
        kategori,
        sahipSira === 0 ? null : (kisiId[sahipSira - 1] ?? null),
        sira,
      );
    }

    /* Mail Hesapları ekranındaki "son çekimler" boş kalmasın. */
    kutuId.forEach((id, i) => {
      db.prepare(
        `INSERT INTO cekimler (kutu_id, baslangic, bitis, bulunan, yeni, elenen)
         VALUES (?, datetime('now', ?), datetime('now', ?), ?, ?, ?)`,
      ).run(id, `-${12 + i * 5} minutes`, `-${11 + i * 5} minutes`, 9 - i, 6 - i, 3);
    });

    return demoSahip;
  }
}

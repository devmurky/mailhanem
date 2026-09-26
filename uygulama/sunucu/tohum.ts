/**
 * İlk açılış.
 *
 * İki ayrı iş: (1) hiç kullanıcı yoksa operatörü oluşturmak — bu her ortamda
 * yapılır, yoksa panele kimse giremez; (2) örnek firma ve talepleri yazmak —
 * bu yalnızca geliştirmede olur, üretime uydurma veri girmez.
 */
import { db } from "./db.ts";

export function tohumlaGerekirse(): void {
  const sayi = db.prepare("SELECT COUNT(*) AS n FROM kullanicilar").get() as { n: number };
  if (sayi.n > 0) return;

  const operatorEposta = (process.env.OPERATOR_EPOSTA ?? "operator@mailhanem.app")
    .trim()
    .toLowerCase();
  const operatorAd = process.env.OPERATOR_AD ?? "Operatör";

  db.prepare(
    "INSERT INTO kullanicilar (firma_id, eposta, ad, rol, operator) VALUES (NULL, ?, ?, 'sahip', 1)",
  ).run(operatorEposta, operatorAd);
  console.log(`[kurulum] operatör oluşturuldu: ${operatorEposta}`);

  if (process.env.NODE_ENV === "production") return;

  const firma = db
    .prepare("INSERT INTO firmalar (ad, alan_adi, plan, durum) VALUES (?, ?, ?, ?) RETURNING id")
    .get("Arkun Mobilya", "arkunmobilya.com", "pro", "etkin") as { id: number };

  for (const [eposta, ad, rol] of [
    ["enes@arkunmobilya.com", "Enes Işhak", "sahip"],
    ["elif@arkunmobilya.com", "Elif Aktaş", "yonetici"],
    ["ayse@arkunmobilya.com", "Ayşe Demir", "personel"],
  ] as const) {
    db.prepare(
      "INSERT INTO kullanicilar (firma_id, eposta, ad, rol, operator) VALUES (?, ?, ?, ?, 0)",
    ).run(firma.id, eposta, ad, rol);
  }

  for (const [adres, saglayici, sunucu, smtp, durum] of [
    ["info@arkunmobilya.com", "cPanel — Turhost", "imap.turhost.com", "smtp.turhost.com", "iyi"],
    ["satis@arkunmobilya.com", "cPanel — Turhost", "imap.turhost.com", "smtp.turhost.com", "iyi"],
  ] as const) {
    db.prepare(
      `INSERT INTO kutular (firma_id, adres, saglayici, imap_sunucu, smtp_sunucu,
                            kullanici_adi, durum)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(firma.id, adres, saglayici, sunucu, smtp, adres, durum);
  }

  const talepler = [
    ["Murat Şen", "Arkun Mobilya", "murat@arkunmobilya.com", "0532 114 22 08",
     "cPanel tabanlı yerel hosting", "3–5 kişi",
     "Fatura mailleri kargo sorularının arasında kalıyor, muhasebe günde iki kez tarıyor.", "yeni"],
    ["Zeynep Kaya", "Kaya Isı Sistemleri", "zeynep@kayaisi.com.tr", "",
     "Microsoft 365", "6–10 kişi", "", "yeni"],
    ["Hakan Yılmaz", "Yıldırım Ofis", "h.yilmaz@yildirimofis.com", "0216 447 91 30",
     "Google Workspace", "1–2 kişi",
     "Bayi başvuruları ile müşteri şikayetleri aynı kutuya düşüyor.", "yazildi"],
    ["Elif Aktaş", "Aktaş İnşaat", "elif@aktasinsaat.com", "0312 285 60 14",
     "Bilmiyorum", "10 kişiden fazla", "Şube bazlı ayırma mümkün mü diye soruyor.", "kuruldu"],
    ["Burak Erdem", "Erdem Lojistik", "burak@erdemlojistik.com", "0224 512 77 05",
     "Microsoft 365", "1–2 kişi",
     "Kendi geliştirdikleri sistem varmış, şimdilik bakmak istemiyor.", "kapandi"],
  ] as const;

  /* Hepsi aynı ana damgalanırsa kuyruk "0 dakika önce" diye okunuyor; geriye yayıyoruz. */
  const dakikaOnce = [41, 190, 1180, 2870, 12960];

  talepler.forEach(([ad, firmaAd, eposta, telefon, saglayici, kisi, aciklama, durum], i) => {
    db.prepare(
      `INSERT INTO talepler (ad, firma, eposta, telefon, saglayici, kisi, aciklama, kaynak, durum,
                             olusma, guncelleme)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'site/index.html', ?,
               datetime('now', ?), datetime('now', ?))`,
    ).run(ad, firmaAd, eposta, telefon, saglayici, kisi, aciklama, durum,
          `-${dakikaOnce[i] ?? 60} minutes`, `-${dakikaOnce[i] ?? 60} minutes`);
  });

  console.log("[tohum] geliştirme örnek verisi yazıldı");
}

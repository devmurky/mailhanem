/**
 * Veri dışa aktarma (madde 12).
 *
 * Ürün sözü şu: **verileriniz sizde kalır, gitmek isterseniz alıp gidersiniz.**
 * Ortak posta kutusunu bir servise taşımanın en büyük korkusu kilitlenmek;
 * "çıkışı var mı" sorusunun cevabı bir satış cümlesi değil, çalışan bir düğme
 * olmalı.
 *
 * ── İki biçim, iki okuyucu ────────────────────────────────
 * - **CSV** insanın Excel'de açacağı kopya. Ayraç **noktalı virgül** ve dosya
 *   BOM ile başlıyor: Türkçe Windows'ta Excel'in varsayılan liste ayracı `;`
 *   ve BOM'suz UTF-8'i Latin-1 sanıyor. Virgül + BOM'suz "standart" CSV,
 *   müşterinin ekranında tek sütunda bozuk karakterler demekti.
 * - **JSON** makinenin okuyacağı tam kopya: bir başka sisteme taşımak,
 *   yedeklemek ya da kendi aracına vermek için.
 *
 * ── Neyin dışarıda kaldığı da sözün parçası ───────────────
 * Kutu parolaları dışa aktarılmıyor (kasada şifreli duruyor, çözülüp dosyaya
 * yazılması gereken bir şey değil), oturum jetonları ve giriş bağlantıları da
 * yok. Bunu dosyanın kendisi söylüyor: JSON'un başındaki künyede yazıyor.
 */
import { db, sorgu, type Firma } from "./db.ts";

/** Excel'in Türkçe yerelinde beklediği ayraç. */
const AYRAC = ";";
/** UTF-8 imzası: Excel bu olmadan Türkçe karakterleri bozuk açıyor. */
const BOM = "﻿";

/**
 * Bir hücreyi CSV'ye güvenli yazar.
 *
 * Tırnak ikileniyor, ayraç/satır sonu taşıyan hücre tırnağa alınıyor. Satır
 * sonu **silinmiyor**: mail gövdesindeki paragraflar verinin kendisi, onları
 * düzleştirmek dışa aktarmayı eksik yapardı — tırnak içinde satır sonu
 * taşımak CSV'nin kendi kuralı.
 */
export function csvHucre(deger: unknown): string {
  if (deger === null || deger === undefined) return "";
  const metin = String(deger);
  if (!/["\r\n;,\t]/.test(metin)) return metin;
  return `"${metin.replace(/"/g, '""')}"`;
}

export function csvYap(basliklar: string[], satirlar: unknown[][]): string {
  const govde = [basliklar, ...satirlar]
    .map((s) => s.map(csvHucre).join(AYRAC))
    /* CRLF: Excel ve Notepad'in beklediği satır sonu. */
    .join("\r\n");
  return BOM + govde + "\r\n";
}

/* ── mailler ───────────────────────────────────────────────
   Gövde de içeride: eksik kopya, kopya değildir. */

export const MAIL_BASLIKLARI = [
  "no", "tarih", "kutu", "gonderen_ad", "gonderen", "konu", "kategori", "durum",
  "sahip", "konusma", "elendi_mi", "eleme_sebep", "ozet", "govde",
];

type MailSatiri = {
  id: number; tarih: string; kutu_adres: string; gonderen_ad: string; gonderen: string;
  konu: string; kategori: string | null; durum: string; sahip_ad: string | null;
  konusma: string; elendi: string | null; eleme_sebep: string; ozet: string; govde: string;
};

export function mailSatirlari(firmaId: number): unknown[][] {
  const satirlar = sorgu<MailSatiri>(
    `SELECT m.id, m.tarih, k.adres AS kutu_adres, m.gonderen_ad, m.gonderen, m.konu,
            m.kategori, m.durum, u.ad AS sahip_ad, m.konusma, m.elendi, m.eleme_sebep,
            m.ozet, m.govde
     FROM mailler m
       JOIN kutular k ON k.id = m.kutu_id
       LEFT JOIN kullanicilar u ON u.id = m.sahip_id
     WHERE m.firma_id = ?
     ORDER BY m.tarih DESC`,
    firmaId,
  );

  return satirlar.map((m) => [
    m.id, m.tarih, m.kutu_adres, m.gonderen_ad, m.gonderen, m.konu,
    m.kategori ?? "", m.durum, m.sahip_ad ?? "", m.konusma,
    m.elendi ? "evet" : "hayır", m.eleme_sebep, m.ozet, m.govde,
  ]);
}

/* ── ticketlar ─────────────────────────────────────────────
   Bir ticket bir satır; yazışma tek hücrede, mesajlar arasında boş satır.
   Mesaj başına satır açmak "kaç talebim var" sorusunu okunmaz yapardı —
   mesajların tek tek hâli JSON'da zaten var. */

export const TICKET_BASLIKLARI = [
  "no", "acilma", "son_guncelleme", "konu", "kategori", "oncelik", "durum",
  "acan", "mesaj_sayisi", "yazisma",
];

type TicketSatiri = {
  id: number; olusma: string; guncelleme: string; konu: string; kategori: string;
  oncelik: string; durum: string; acan_ad: string | null;
};

export function ticketSatirlari(firmaId: number): unknown[][] {
  const ticketlar = sorgu<TicketSatiri>(
    `SELECT t.id, t.olusma, t.guncelleme, t.konu, t.kategori, t.oncelik, t.durum,
            u.ad AS acan_ad
     FROM ticketlar t
       LEFT JOIN kullanicilar u ON u.id = t.acan_id
     WHERE t.firma_id = ?
     ORDER BY t.olusma DESC`,
    firmaId,
  );

  return ticketlar.map((t) => {
    const mesajlar = sorgu<{ olusma: string; operator: number; ad: string | null; metin: string }>(
      `SELECT m.olusma, m.operator, u.ad, m.metin
       FROM ticket_mesajlari m
         LEFT JOIN kullanicilar u ON u.id = m.yazan_id
       WHERE m.ticket_id = ? ORDER BY m.olusma`,
      t.id,
    );

    const yazisma = mesajlar
      .map((m) => `[${m.olusma}] ${m.operator ? "Mailhanem" : (m.ad ?? "Ekipten biri")}:\n${m.metin}`)
      .join("\n\n");

    return [
      t.id, t.olusma, t.guncelleme, t.konu, t.kategori, t.oncelik, t.durum,
      t.acan_ad ?? "", mesajlar.length, yazisma,
    ];
  });
}

/* ── tam kopya (JSON) ──────────────────────────────────────── */

/** Dosyanın başındaki künye: ne var, ne yok, ne zaman alındı. */
function kunye(firma: Firma) {
  return {
    uygulama: "Mailhanem",
    bicim_surumu: 1,
    firma: { ad: firma.ad, alan_adi: firma.alan_adi },
    alindi: new Date().toISOString(),
    kapsam: [
      "mailler (gövdeleriyle)", "gönderilen yanıtlar", "ekip notları",
      "ek künyeleri (dosyaların kendisi değil)", "destek talepleri ve yazışmaları",
      "yanıt şablonları", "yönlendirme kuralları", "VIP gönderenler",
      "bilgi deposu", "ekip listesi", "posta kutusu ayarları", "hesap kaydı",
    ],
    disarida: [
      "posta kutusu parolaları — kasada şifreli duruyor, çözülüp dosyaya yazılmıyor",
      "oturum jetonları ve giriş bağlantıları",
      "eklerin kendisi — panelden tek tek indiriliyor, künyeleri burada",
    ],
  };
}

export function tamKopya(firmaId: number, firma: Firma): Record<string, unknown> {
  const al = <T,>(sql: string) => sorgu<T>(sql, firmaId);

  return {
    _kunye: kunye(firma),
    mailler: al(
      `SELECT id, kutu_id, mesaj_kimlik, gonderen_ad, gonderen, konu, ozet, govde, tarih,
              kategori, sahip_id, durum, elendi, eleme_sebep, konusma
       FROM mailler WHERE firma_id = ? ORDER BY tarih DESC`,
    ),
    yanitlar: al(
      `SELECT id, mail_id, kullanici_id, kime, konu, metin, mesaj_kimlik, hata, olusma
       FROM yanitlar WHERE firma_id = ? ORDER BY olusma`,
    ),
    notlar: al(
      "SELECT id, mail_id, yazan_id, metin, olusma FROM mail_notlari WHERE firma_id = ? ORDER BY olusma",
    ),
    ekler: al(
      `SELECT id, mail_id, ticket_id, ad, tip, boyut, olusma
       FROM ekler WHERE firma_id = ? ORDER BY olusma`,
    ),
    ticketlar: al(
      `SELECT id, acan_id, konu, kategori, oncelik, durum, olusma, guncelleme
       FROM ticketlar WHERE firma_id = ? ORDER BY olusma`,
    ),
    ticket_mesajlari: sorgu(
      `SELECT m.id, m.ticket_id, m.yazan_id, m.operator, m.metin, m.olusma
       FROM ticket_mesajlari m JOIN ticketlar t ON t.id = m.ticket_id
       WHERE t.firma_id = ? ORDER BY m.olusma`,
      firmaId,
    ),
    sablonlar: al("SELECT * FROM sablonlar WHERE firma_id = ? ORDER BY id"),
    yonlendirmeler: al("SELECT * FROM yonlendirmeler WHERE firma_id = ? ORDER BY sira"),
    vip_gonderenler: al("SELECT * FROM vip_gonderenler WHERE firma_id = ? ORDER BY adres"),
    karakter_alanlari: al("SELECT * FROM karakter_alanlari WHERE firma_id = ? ORDER BY alan"),
    bilgi_kartlari: al("SELECT * FROM bilgi_kartlari WHERE firma_id = ? ORDER BY id"),
    ekip: al(
      `SELECT id, eposta, ad, rol, durum, son_giris, olusma
       FROM kullanicilar WHERE firma_id = ? ORDER BY id`,
    ),
    /* Parola sütunu **seçilmiyor**: kasadaki şifreli değer bile dosyaya
       girmemeli — dosya paylaşılabilir bir şey, kasa değil. */
    kutular: al(
      `SELECT id, adres, saglayici, imap_sunucu, imap_port, smtp_sunucu, smtp_port,
              kullanici_adi, durum, son_cekim, olusma
       FROM kutular WHERE firma_id = ? ORDER BY adres`,
    ),
    okumalar: al(
      "SELECT mail_id, kullanici_id, ilk_okuma, son_okuma FROM mail_okumalari WHERE firma_id = ?",
    ),
    hesap_kaydi: al(
      "SELECT id, tip, mesaj, olusma FROM gunluk WHERE firma_id = ? ORDER BY olusma DESC",
    ),
  };
}

/** Dosya adı: firma ve tarih taşısın ki indirilenler klasöründe karışmasın. */
export function dosyaAdi(firma: Firma, parca: string, uzanti: string): string {
  const slug = (firma.alan_adi || firma.ad)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const gun = new Date().toISOString().slice(0, 10);
  return `mailhanem-${slug || "firma"}-${parca}-${gun}.${uzanti}`;
}

/** Kaç satır dışa aktarılacağı — ekran indirmeden önce bunu söylüyor. */
export function aktarimSayilari(firmaId: number): { mail: number; ticket: number } {
  const say = (sql: string) =>
    (db.prepare(sql).get(firmaId) as { n: number }).n;
  return {
    mail: say("SELECT COUNT(*) AS n FROM mailler WHERE firma_id = ?"),
    ticket: say("SELECT COUNT(*) AS n FROM ticketlar WHERE firma_id = ?"),
  };
}

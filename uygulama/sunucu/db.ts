/**
 * Veri katmanı.
 *
 * SQLite seçildi çünkü Mailhanem'in bugünkü ihtiyacı bu: geliştirme Windows'ta
 * yapılıyor, ilk müşteriler tek haneli, ve kurulacak ayrı bir veritabanı sunucusu
 * istemiyoruz. Node 24'ün yerleşik `node:sqlite`'ı native derleme gerektirmiyor —
 * Windows'ta node-gyp derdi çıkmıyor.
 *
 * Bütün SQL bu dosyada duruyor. Hacim büyüyüp Postgres'e geçmek gerektiğinde
 * değişecek tek yer burasıdır; uygulamanın geri kalanı buradaki fonksiyonları çağırır.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { konuKoku } from "./posta/konusma.ts";
import { OZEL_ONEK } from "./bilgiSabitleri.ts";
import { ozetCikar } from "./posta/kaynak.ts";

const YOL = process.env.DB_YOLU ?? resolve(process.cwd(), "veri", "mailhanem.db");
mkdirSync(dirname(YOL), { recursive: true });

/**
 * `timeout`: kilitli veritabanında hemen pes etme, bekle.
 *
 * Next'in üretim derlemesi rotaları ayrı süreçlerde topluyor; hepsi aynı anda
 * bu dosyayı açıp şemayı kuruyor. Biri yazma kilidini alırken ötekiler
 * "database is locked" ile düşüyordu. Beklemek doğru davranış: şema kurulumu
 * milisaniyelik bir iş.
 */
export const db = new DatabaseSync(YOL, { timeout: 10000 });

db.exec(`
PRAGMA busy_timeout = 10000;
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── kiracılar ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS firmalar (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ad        TEXT NOT NULL,
  alan_adi  TEXT NOT NULL UNIQUE,
  plan      TEXT NOT NULL DEFAULT 'baslangic',   -- baslangic | pro | kurumsal
  durum     TEXT NOT NULL DEFAULT 'deneme',      -- deneme | etkin | duraklatildi | ayrildi
  olusma    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── kullanıcılar ──────────────────────────────────────────
-- operator=1 olan servis tarafıdır ve firma_id'si yoktur.
CREATE TABLE IF NOT EXISTS kullanicilar (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  firma_id   INTEGER REFERENCES firmalar(id) ON DELETE CASCADE,
  eposta     TEXT NOT NULL UNIQUE,
  ad         TEXT NOT NULL DEFAULT '',
  rol        TEXT NOT NULL DEFAULT 'personel',   -- sahip | yonetici | personel
  operator   INTEGER NOT NULL DEFAULT 0,
  son_giris  TEXT,
  olusma     TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (operator = 1 OR firma_id IS NOT NULL)
);

-- ── sihirli bağlantı ──────────────────────────────────────
-- Jetonun kendisi saklanmaz, yalnızca SHA-256 özeti.
CREATE TABLE IF NOT EXISTS giris_linkleri (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  kullanici_id INTEGER NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
  jeton_ozet   TEXT NOT NULL UNIQUE,
  gecerlilik   TEXT NOT NULL,
  kullanildi   TEXT,
  olusma       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS oturumlar (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  kullanici_id INTEGER NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
  jeton_ozet   TEXT NOT NULL UNIQUE,
  gecerlilik   TEXT NOT NULL,
  son_gorulme  TEXT NOT NULL DEFAULT (datetime('now')),
  olusma       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── posta kutuları ────────────────────────────────────────
-- Parola burada düz durmaz: kasa.ts ile AES-256-GCM zarf şifreleme uygulanır.
CREATE TABLE IF NOT EXISTS kutular (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  firma_id       INTEGER NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  adres          TEXT NOT NULL,
  saglayici      TEXT NOT NULL DEFAULT '',
  imap_sunucu    TEXT NOT NULL DEFAULT '',
  imap_port      INTEGER NOT NULL DEFAULT 993,
  smtp_sunucu    TEXT NOT NULL DEFAULT '',
  smtp_port      INTEGER NOT NULL DEFAULT 465,
  kullanici_adi  TEXT NOT NULL DEFAULT '',
  parola_sifreli TEXT,
  durum          TEXT NOT NULL DEFAULT 'kurulmadi',  -- kurulmadi | iyi | yavas | kopuk
  son_cekim      TEXT,
  olusma         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (firma_id, adres)
);

-- ── siteden gelen demo talepleri ──────────────────────────
CREATE TABLE IF NOT EXISTS talepler (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ad          TEXT NOT NULL,
  firma       TEXT NOT NULL,
  eposta      TEXT NOT NULL,
  telefon     TEXT NOT NULL DEFAULT '',
  saglayici   TEXT NOT NULL DEFAULT '',
  kisi        TEXT NOT NULL DEFAULT '',
  aciklama    TEXT NOT NULL DEFAULT '',
  kaynak      TEXT NOT NULL DEFAULT '',
  durum       TEXT NOT NULL DEFAULT 'yeni',   -- yeni | yazildi | kuruldu | kapandi
  olusma      TEXT NOT NULL DEFAULT (datetime('now')),
  guncelleme  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS talep_durum ON talepler(durum, olusma DESC);

-- ── mailler ───────────────────────────────────────────────
-- elendi doluysa mail kural motorundan geri çevrilmiştir; modele hiç gitmemiştir.
CREATE TABLE IF NOT EXISTS mailler (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kutu_id       INTEGER NOT NULL REFERENCES kutular(id) ON DELETE CASCADE,
  firma_id      INTEGER NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  mesaj_kimlik  TEXT NOT NULL,
  uid           INTEGER,
  gonderen_ad   TEXT NOT NULL DEFAULT '',
  gonderen      TEXT NOT NULL,
  konu          TEXT NOT NULL DEFAULT '',
  ozet          TEXT NOT NULL DEFAULT '',
  govde         TEXT NOT NULL DEFAULT '',
  tarih         TEXT NOT NULL,
  kategori      TEXT,
  sahip_id      INTEGER REFERENCES kullanicilar(id) ON DELETE SET NULL,
  durum         TEXT NOT NULL DEFAULT 'yeni',
  elendi        TEXT,
  eleme_sebep   TEXT NOT NULL DEFAULT '',
  konusma       TEXT NOT NULL DEFAULT '',
  olusma        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (kutu_id, mesaj_kimlik)
);
CREATE INDEX IF NOT EXISTS mail_kutu ON mailler(kutu_id, tarih DESC);
CREATE INDEX IF NOT EXISTS mail_gelen ON mailler(firma_id, elendi, tarih DESC);
-- Konuşma zinciri (madde 2): zincirin ilk mailinin Message-ID'si, zincirdeki
-- her maile yazılıyor. Kendi başına gelen mail de kendi kimliğini taşıyor —
-- "konuşması olmayan mail" diye bir durum yok, tek mesajlık konuşma var.
-- Sütunun dizini burada değil, sütun eklendikten sonra kuruluyor: bu blok
-- eski bir veritabanında da çalışıyor ve orada konusma sütunu henüz yok.

-- ── mail tam metin araması (FTS5) ─────────────────────────
-- Önceki arama LIKE'dı ve gövdeyi hiç taramıyordu: "şu siparişte ne yazmıştı"
-- sorusunun cevabı aramada çıkmıyordu.
--
-- Tablo **bağımsız** (content= değil) ve metni TypeScript tarafı yazıyor.
-- Sebebi Türkçe: unicode61'in remove_diacritics'i ç/ş/ö/ü/ğ'yi katlıyor ama
-- noktasız ı'yı katlamıyor — o ayrı bir harf, aksanlı i değil. Sonuç olarak
-- "çalışma" araması "calisma" yazan maili bulamıyordu. Katlamayı kendimiz
-- yapınca iki taraf da aynı biçime iniyor (bkz. turkceKatla).
--
-- Bedeli metnin iki kez saklanması. Gövde zaten 20 000 karakterle sınırlı ve
-- müşteri sayısı tek haneli; doğru arama bu alana değer.
CREATE VIRTUAL TABLE IF NOT EXISTS mail_fts USING fts5(
  metin,
  mail_id UNINDEXED,
  tokenize = "unicode61 remove_diacritics 2"
);

-- Silme tetikleyicide kalıyor: firma ya da kutu silinince mailler CASCADE ile
-- gidiyor ve o silmeler SQL tarafında oluyor, TypeScript hiç görmüyor.
-- Yazma ise mailEkle'de — normalleştirmeyi SQL yapamaz.
CREATE TRIGGER IF NOT EXISTS mail_fts_sil AFTER DELETE ON mailler BEGIN
  DELETE FROM mail_fts WHERE mail_id = old.id;
END;

-- ── çekim turları ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cekimler (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kutu_id    INTEGER NOT NULL REFERENCES kutular(id) ON DELETE CASCADE,
  baslangic  TEXT NOT NULL DEFAULT (datetime('now')),
  bitis      TEXT,
  bulunan    INTEGER NOT NULL DEFAULT 0,
  yeni       INTEGER NOT NULL DEFAULT 0,
  elenen     INTEGER NOT NULL DEFAULT 0,
  hata       TEXT
);

-- ── giden yanıtlar ────────────────────────────────────────
-- Kutuyu salt okunur açtığımız için yanıtı "Gönderilmiş Öğeler"e koyamıyoruz;
-- ekip kendi yazdığını görebilsin diye kaydı burada tutuyoruz.
CREATE TABLE IF NOT EXISTS yanitlar (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  mail_id      INTEGER NOT NULL REFERENCES mailler(id) ON DELETE CASCADE,
  firma_id     INTEGER NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  kullanici_id INTEGER REFERENCES kullanicilar(id) ON DELETE SET NULL,
  kime         TEXT NOT NULL,
  konu         TEXT NOT NULL DEFAULT '',
  metin        TEXT NOT NULL,
  mesaj_kimlik TEXT NOT NULL DEFAULT '',
  hata         TEXT,
  olusma       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS yanit_mail ON yanitlar(mail_id, olusma);

-- ── VIP gönderenler ───────────────────────────────────────
-- Firmanın "bu adresten gelen öne çıksın" dediği adresler. Elle işaretlenir;
-- yapay zekâya bağlı değil.
CREATE TABLE IF NOT EXISTS vip_gonderenler (
  firma_id INTEGER NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  adres    TEXT NOT NULL,
  ekleyen  INTEGER REFERENCES kullanicilar(id) ON DELETE SET NULL,
  olusma   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (firma_id, adres)
);

-- ── ekler ─────────────────────────────────────────────────
-- Hem gelen mailin ekleri hem ticketa iliştirilen dosyalar burada. Tek tablo,
-- çünkü ikisi de "bir kayda bağlı ikili dosya" ve saklama kuralı aynı.
-- İçerik veritabanında değil diskte (veri/ekler/); SQLite'a megabaytlık blob
-- koymak dosyayı şişirir ve yedeklemeyi ağırlaştırır.
CREATE TABLE IF NOT EXISTS ekler (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  mail_id    INTEGER REFERENCES mailler(id) ON DELETE CASCADE,
  ticket_id  INTEGER REFERENCES ticketlar(id) ON DELETE CASCADE,
  firma_id   INTEGER NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  ad         TEXT NOT NULL,
  tip        TEXT NOT NULL DEFAULT '',
  boyut      INTEGER NOT NULL DEFAULT 0,
  dosya      TEXT NOT NULL,              -- veri/ekler/ altındaki ad
  olusma     TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (mail_id IS NOT NULL OR ticket_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS ek_mail ON ekler(mail_id);
CREATE INDEX IF NOT EXISTS ek_ticket ON ekler(ticket_id);

-- ── ekip içi not ──────────────────────────────────────────
-- Mailin altına yazılan, müşteriye gitmeyen not. Yanıt değil: yanitlar
-- tablosu gönderilen maili tutar, burası hiç gönderilmeyecek olanı.
CREATE TABLE IF NOT EXISTS mail_notlari (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  mail_id  INTEGER NOT NULL REFERENCES mailler(id) ON DELETE CASCADE,
  firma_id INTEGER NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  yazan_id INTEGER REFERENCES kullanicilar(id) ON DELETE SET NULL,
  metin    TEXT NOT NULL,
  olusma   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS not_mail ON mail_notlari(mail_id, olusma);

-- ── yanıt taslakları ──────────────────────────────────────
-- Yazılmış ama gönderilmemiş yanıt metni. Uzun bir cevabın ortasında sekme
-- kapanınca her şeyin gitmesi, bu işte en pahalı kayıp: mail hâlâ cevapsız
-- ama emek gitmiş oluyor.
--
-- Anahtar (mail, kullanıcı) çifti: aynı maile iki kişi ayrı ayrı yazmaya
-- başlayabilir ve birinin metni ötekinin üstüne yazmamalı. "Aynı anda kim
-- bakıyor" sorusu ayrı bir iş; burada yalnız kimsenin metnini kaybetmemek var.
--
-- Bu tablo **yapay zekâ taslağı değildir**. Genel Bakış'taki "yanıt taslakları"
-- kartı modelin üreteceği önerileri anlatıyor; burası insanın yarım bıraktığı
-- metin. İkisi karışmasın diye tablo adı da ekran metni de ayrı.
CREATE TABLE IF NOT EXISTS yanit_taslaklari (
  mail_id      INTEGER NOT NULL REFERENCES mailler(id) ON DELETE CASCADE,
  firma_id     INTEGER NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  kullanici_id INTEGER NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
  metin        TEXT NOT NULL DEFAULT '',
  guncelleme   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (mail_id, kullanici_id)
);
CREATE INDEX IF NOT EXISTS taslak_kisi ON yanit_taslaklari(firma_id, kullanici_id);

-- ── bilgi deposu ──────────────────────────────────────────
-- Firmanın karakteri ve tekrar eden gerçekleri. Yanıt taslağı adımı
-- bağlandığında model önce buradan okuyacak: kim olduğumuz, nasıl
-- konuştuğumuz, kargonun kaç günde gittiği.
--
-- Üç tablo, tek sebep: **modelin ürettiği hiçbir şey onaylanmadan depoya
-- girmiyor.** Çıkarım önce bilgi_onerileri tablosuna yazar; yönetici
-- onaylayınca satır karakterin ya da kartın kendi tablosuna geçer. Ürün
-- İlkesi 1'in ("insan onayı olmadan hiçbir şey gitmez") bu ekrandaki karşılığı.

-- Karakter alanları satır olarak: her alan kendi kaynağını ve damgasını
-- taşısın, ve yeni alan eklemek şema göçü gerektirmesin.
CREATE TABLE IF NOT EXISTS karakter_alanlari (
  firma_id       INTEGER NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  -- Hazır beş alan için bkz. bilgiSabitleri.ts. Yönetici kendi maddesini de
  -- ekleyebiliyor; onların anahtarı ozel:<slug> ve başlığı aşağıdaki sütunda.
  alan           TEXT NOT NULL,
  baslik         TEXT NOT NULL DEFAULT '',
  deger          TEXT NOT NULL DEFAULT '',
  kaynak         TEXT NOT NULL DEFAULT 'elle',  -- elle | cikarim
  guncelleme     TEXT NOT NULL DEFAULT (datetime('now')),
  guncelleyen_id INTEGER REFERENCES kullanicilar(id) ON DELETE SET NULL,
  PRIMARY KEY (firma_id, alan)
);

CREATE TABLE IF NOT EXISTS bilgi_kartlari (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  firma_id       INTEGER NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  baslik         TEXT NOT NULL,
  icerik         TEXT NOT NULL,
  kategori       TEXT NOT NULL DEFAULT '',
  kaynak         TEXT NOT NULL DEFAULT 'elle',
  -- Çıkarımla gelen kartın neye dayandığı; elle yazılanda boş.
  dayanak        TEXT NOT NULL DEFAULT '',
  olusma         TEXT NOT NULL DEFAULT (datetime('now')),
  guncelleme     TEXT NOT NULL DEFAULT (datetime('now')),
  guncelleyen_id INTEGER REFERENCES kullanicilar(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS bilgi_firma ON bilgi_kartlari(firma_id, kategori);

CREATE TABLE IF NOT EXISTS bilgi_onerileri (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  firma_id  INTEGER NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  tur       TEXT NOT NULL,                -- karakter | kart
  alan      TEXT NOT NULL DEFAULT '',     -- tur=karakter ise hangi alan
  baslik    TEXT NOT NULL DEFAULT '',
  icerik    TEXT NOT NULL,
  kategori  TEXT NOT NULL DEFAULT '',
  dayanak   TEXT NOT NULL DEFAULT '',
  olusma    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS oneri_firma ON bilgi_onerileri(firma_id, id);

-- Çıkarım turlarının kaydı: ne zaman, kim başlattı, neye bakıldı, ne çıktı.
-- Hem "en son ne zaman çalıştı" sorusunun cevabı hem günde bir kez sınırının
-- dayanağı. Hatalı tur da yazılıyor — sessiz başarısızlık bırakmıyoruz.
CREATE TABLE IF NOT EXISTS bilgi_cikarimlari (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  firma_id     INTEGER NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  baslatan_id  INTEGER REFERENCES kullanicilar(id) ON DELETE SET NULL,
  okunan_mail  INTEGER NOT NULL DEFAULT 0,
  okunan_yanit INTEGER NOT NULL DEFAULT 0,
  oneri        INTEGER NOT NULL DEFAULT 0,
  model        TEXT NOT NULL DEFAULT '',
  hata         TEXT NOT NULL DEFAULT '',
  olusma       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS cikarim_firma ON bilgi_cikarimlari(firma_id, id);

-- ── destek ticketları ─────────────────────────────────────
-- Müşteri panelinden açılır, operatör panelinde görünür. Maillerden ayrı bir
-- kanal: mail müşterinin kendi müşterisiyle yazışmasıdır, ticket müşterinin
-- Mailhanem ile yazışmasıdır. İkisini aynı tabloda tutmak, firma sınırını ve
-- "bu kimin işi" sorusunu karıştırırdı.
CREATE TABLE IF NOT EXISTS ticketlar (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  firma_id   INTEGER NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  acan_id    INTEGER REFERENCES kullanicilar(id) ON DELETE SET NULL,
  konu       TEXT NOT NULL,
  kategori   TEXT NOT NULL DEFAULT 'soru',    -- kurulum | hata | soru | fatura | ozellik
  oncelik    TEXT NOT NULL DEFAULT 'normal',  -- dusuk | normal | yuksek | acil
  durum      TEXT NOT NULL DEFAULT 'acik',    -- acik | operatorde | musteride | cozuldu | kapandi
  olusma     TEXT NOT NULL DEFAULT (datetime('now')),
  guncelleme TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ticket_firma ON ticketlar(firma_id, guncelleme DESC);
CREATE INDEX IF NOT EXISTS ticket_durum ON ticketlar(durum, guncelleme DESC);

-- Yazışma. İlk mesaj ticketı açan metindir; ayrı bir govde sütunu yok ki
-- "ilk mesaj" ile "sonraki mesajlar" iki ayrı biçimde saklanmasın.
CREATE TABLE IF NOT EXISTS ticket_mesajlari (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES ticketlar(id) ON DELETE CASCADE,
  yazan_id  INTEGER REFERENCES kullanicilar(id) ON DELETE SET NULL,
  operator  INTEGER NOT NULL DEFAULT 0,       -- 1 ise servis tarafı yazdı
  metin     TEXT NOT NULL,
  olusma    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ticket_mesaj ON ticket_mesajlari(ticket_id, olusma);

-- ── yapay zekâ kullanımı ──────────────────────────────────
-- Model henüz bağlı değil ve buraya hiç satır yazılmıyor. Tablo yine de
-- kuruluyor: operatör ekranlarındaki maliyet ve marj sayıları bu tablodan
-- okuyor, yani model bağlandığı ve yazmaya başladığı anda rakamlar
-- kendiliğinden dolacak. Sabit bir "0" ya da uydurma bir rakam yerine
-- gerçek bir kaynağın bugün boş olması tercih edildi.
CREATE TABLE IF NOT EXISTS ai_kullanim (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  firma_id    INTEGER NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  mail_id     INTEGER REFERENCES mailler(id) ON DELETE SET NULL,
  is_turu     TEXT NOT NULL DEFAULT '',      -- karakter | siniflandirma | taslak | ek-analizi
  model       TEXT NOT NULL DEFAULT '',
  girdi_token INTEGER NOT NULL DEFAULT 0,
  cikti_token INTEGER NOT NULL DEFAULT 0,
  kurus       INTEGER NOT NULL DEFAULT 0,    -- para her yerde kuruş
  olusma      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ai_firma ON ai_kullanim(firma_id, olusma DESC);

-- ── destek zamanı ─────────────────────────────────────────
-- Operatörün bir müşteriye harcadığı dakika. Net marj bunu düşüyor; kayıt
-- olmadan marj "senin zamanını bedava sayan" brüt marja döner.
CREATE TABLE IF NOT EXISTS destek_kayitlari (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  firma_id INTEGER NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  dakika   INTEGER NOT NULL DEFAULT 0,
  konu     TEXT NOT NULL DEFAULT '',
  olusma   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS destek_firma ON destek_kayitlari(firma_id, olusma DESC);

-- ── abonelik geçmişi ──────────────────────────────────────
-- Gelir eğilimi (kıvılcım çizgisi ve şelale) için. firmalar.aylik_kurus tek
-- bir anlık değer; geçmişi olmadan 'gelir nasıl değişti' sorusu cevapsız kalır.
CREATE TABLE IF NOT EXISTS abonelik_gecmisi (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  firma_id INTEGER NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  plan     TEXT NOT NULL DEFAULT '',
  durum    TEXT NOT NULL DEFAULT '',
  kurus    INTEGER NOT NULL DEFAULT 0,
  olusma   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS abonelik_gec ON abonelik_gecmisi(firma_id, olusma DESC);

-- ── sistem günlüğü ────────────────────────────────────────
-- Hata izleyici değil: "dün ne oldu" sorusuna bakılacak yer.
CREATE TABLE IF NOT EXISTS gunluk (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  tip      TEXT NOT NULL,                -- kurulum | posta | giris | hata | abonelik
  mesaj    TEXT NOT NULL,
  firma_id INTEGER REFERENCES firmalar(id) ON DELETE SET NULL,
  olusma   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS gunluk_tip ON gunluk(tip, id DESC);

-- ── yönlendirme kuralları ─────────────────────────────────
-- Elle kurulan eşleştirmeler: "şu alan adından gelen fatura, Elif'e".
-- Kural motorundan (kural.ts) ayrıdır: o eleme yapar, bu sınıflandırır.
CREATE TABLE IF NOT EXISTS yonlendirmeler (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  firma_id  INTEGER NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  tip       TEXT NOT NULL,                -- gonderen | alan | konu
  kalip     TEXT NOT NULL,
  kategori  TEXT,
  sahip_id  INTEGER REFERENCES kullanicilar(id) ON DELETE SET NULL,
  sira      INTEGER NOT NULL DEFAULT 0,
  etkin     INTEGER NOT NULL DEFAULT 1,
  eslesme   INTEGER NOT NULL DEFAULT 0,
  olusma    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS yonlendirme_firma ON yonlendirmeler(firma_id, sira, id);

-- ── yanıt şablonları ──────────────────────────────────────
-- Firmanın sık yazdığı cevaplar. Kategori bağlıysa o kategorideki mailde
-- önce gösterilir; bağlı değilse her mailde listelenir.
CREATE TABLE IF NOT EXISTS sablonlar (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  firma_id   INTEGER NOT NULL REFERENCES firmalar(id) ON DELETE CASCADE,
  ad         TEXT NOT NULL,
  kategori   TEXT,
  metin      TEXT NOT NULL,
  kullanim   INTEGER NOT NULL DEFAULT 0,
  olusma     TEXT NOT NULL DEFAULT (datetime('now')),
  guncelleme TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS sablon_firma ON sablonlar(firma_id, ad COLLATE NOCASE);

-- ── anahtar/değer ayarları (sitenin okuduğu iletişim bilgileri dahil) ──
CREATE TABLE IF NOT EXISTS ayarlar (
  anahtar    TEXT PRIMARY KEY,
  deger      TEXT NOT NULL DEFAULT '',
  guncelleme TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

/**
 * Şemaya sonradan eklenen sütunlar.
 *
 * `CREATE TABLE IF NOT EXISTS` var olan tabloyu değiştirmez; önceden kurulmuş
 * bir veritabanı yeni sütunu kendiliğinden edinmez. Göç aracı kurmak bu boyda
 * bir proje için erken, ama sütunu sessizce kaybetmek de olmaz — eksikse
 * ekliyoruz. Yalnızca varsayılanı olan, geriye dönük uyumlu sütunlar buraya.
 */
function sutunEkleGerekirse(tablo: string, sutun: string, tanim: string): void {
  const varOlan = db.prepare(`PRAGMA table_info(${tablo})`).all() as unknown as {
    name: string;
  }[];
  if (varOlan.some((s) => s.name === sutun)) return;

  /*
   * "Bak, yoksa ekle" tek başına yetmiyor: `next build` rotaları on dokuz ayrı
   * işçide topluyor, hepsi aynı anda bakıp aynı anda eklemeye kalkıyor ve biri
   * "duplicate column name" ile düşüyordu. Sütunun **sonuçta var olması**
   * önemli, ekleyenin kim olduğu değil — o yüzden bu hatayı yutuyoruz.
   * Başka bir hata (yazım yanlışı, bozuk tanım) yutulmuyor.
   */
  try {
    db.exec(`ALTER TABLE ${tablo} ADD COLUMN ${sutun} ${tanim}`);
    console.log(`[şema] ${tablo}.${sutun} eklendi`);
  } catch (e) {
    const mesaj = e instanceof Error ? e.message : String(e);
    if (!mesaj.includes("duplicate column name")) throw e;
  }
}

sutunEkleGerekirse("mailler", "govde", "TEXT NOT NULL DEFAULT ''");
/* Yanıtlar müşterinin kendi kutusundan çıkar; SMTP bilgisi kutuyla birlikte durur. */
sutunEkleGerekirse("kutular", "smtp_sunucu", "TEXT NOT NULL DEFAULT ''");
sutunEkleGerekirse("kutular", "smtp_port", "INTEGER NOT NULL DEFAULT 465");
/* Ayrılan kişi silinmiyor, kapatılıyor: sildiğimizde onun sahiplendiği maillerin
   geçmişi de "kimse" oluyordu. Kapalı kullanıcı giremez ama kayıtta kalır. */
sutunEkleGerekirse("kullanicilar", "durum", "TEXT NOT NULL DEFAULT 'etkin'");
/* Abonelik ücreti kuruş cinsinden; ondalıklı para saklamıyoruz. */
sutunEkleGerekirse("firmalar", "aylik_kurus", "INTEGER NOT NULL DEFAULT 0");
/* Sitedeki "Demoda deneyimleyin" düğmesinin açtığı vitrin firması. Bayrak
   gerçek müşteriden ayırmak için: panel bu firmada demo şeridini gösteriyor ve
   veri her ziyarette sıfırlanıyor. Gerçek firmalarda 0. */
sutunEkleGerekirse("firmalar", "demo", "INTEGER NOT NULL DEFAULT 0");
/* Konuşma zinciri (madde 2). Sütun sonradan eklendi; eski mailler aşağıdaki
   geri doldurmayla zincirlerine bağlanıyor. */
sutunEkleGerekirse("mailler", "konusma", "TEXT NOT NULL DEFAULT ''");
/* Yöneticinin kendi eklediği karakter maddesinin başlığı. */
sutunEkleGerekirse("karakter_alanlari", "baslik", "TEXT NOT NULL DEFAULT ''");
/* Dizin sütundan sonra: şema bloğunda dursaydı, sütunu henüz olmayan eski bir
   veritabanında "no such column" ile açılışı düşürürdü. */
db.exec("CREATE INDEX IF NOT EXISTS mail_konusma ON mailler(firma_id, konusma, tarih)");

/**
 * Sütun eklenmeden önce çekilmiş mailleri zincirlerine bağlar (madde 2).
 *
 * Elde yalnız konu ve gönderen var: `In-Reply-To` başlıkları hiç saklanmadı,
 * onları geri getirmenin yolu yok. O yüzden burada yalnız **yedek kural**
 * çalışıyor — aynı kutu, aynı adres, aynı konu kökü.
 *
 * Boş `konusma` ile tek bir satır bile kalmıyor: zinciri bulunamayan mail
 * kendi kimliğini alıyor, yani tek mesajlık bir konuşma oluyor. "Konuşması
 * olmayan mail" diye bir durum bırakmamak, her ekranda ayrı bir boş dal
 * yazmaktan ucuz.
 */
function konusmalariGeriDoldur(): void {
  try {
    const bos = (
      db.prepare("SELECT COUNT(*) AS n FROM mailler WHERE konusma = ''").get() as { n: number }
    ).n;
    if (!bos) return;

    const satirlar = db
      .prepare(
        `SELECT id, kutu_id, firma_id, mesaj_kimlik, gonderen, konu, tarih
         FROM mailler WHERE konusma = '' ORDER BY tarih, id`,
      )
      .all() as {
      id: number;
      kutu_id: number;
      firma_id: number;
      mesaj_kimlik: string;
      gonderen: string;
      konu: string;
      tarih: string;
    }[];

    const yaz = db.prepare("UPDATE mailler SET konusma = ? WHERE id = ?");
    /* Eskiden yeniye gidiliyor: her mail kendinden önce yazılmış zinciri
       görebilsin. Ters sırada ilerleseydik hiçbiri ötekini bulamazdı. */
    for (const m of satirlar) {
      const zincir =
        konusmaCoz({
          firmaId: m.firma_id,
          kutuId: m.kutu_id,
          kimlikler: [],
          gonderen: m.gonderen,
          konu: m.konu,
          tarih: m.tarih,
        }) || m.mesaj_kimlik;
      yaz.run(zincir, m.id);
    }
    console.log(`[şema] ${satirlar.length} mail konuşma zincirine bağlandı`);
  } catch (e) {
    /* Geri doldurma açılışı düşürmemeli: konuşma görünümü eksik çalışır,
       panel çalışmaya devam eder. */
    console.error(`[şema] konuşmalar doldurulamadı: ${e instanceof Error ? e.message : e}`);
  }
}

/**
 * FTS dizinini gerektiğinde geri doldurur (madde 11).
 *
 * Tetikleyiciler yalnız kurulduktan sonra yazılan maili yakalıyor; dizin
 * eklenmeden önce çekilmiş mailler arama dışında kalırdı.
 *
 * **Dikkat: `SELECT COUNT(*) FROM mail_fts` dizini saymıyor.** `content=`
 * tablosunda o sorgu içerik tablosuna (mailler) gidiyor ve her zaman eşit
 * çıkıyor — ilk yazışta bu yüzden rebuild hiç çalışmadı ve arama sessizce boş
 * döndü. Onun yerine en son kaç mail için dizin kurulduğu `ayarlar`a
 * yazılıyor; kıyas ona göre.
 *
 * Her açılışta koşulsuz yeniden kurmak, on binlerce mailde açılışı
 * dakikalara çıkarırdı.
 */
/**
 * Arama dizininin şeması değiştiyse tabloyu yeniden kurar.
 *
 * İlk sürüm `content=mailler` ile yazılmıştı ve Türkçe ı/i ayrımı yüzünden
 * terk edildi. `CREATE VIRTUAL TABLE IF NOT EXISTS` eski tabloyu olduğu gibi
 * bırakır, o yüzden burada açıkça bakılıyor. Dizin türetilmiş veri — atmakta
 * sakınca yok, geri doldurma zaten arkasından çalışıyor.
 */
function ftsSemasiniDenkle(): void {
  try {
    const satir = db
      .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'mail_fts'")
      .get() as { sql: string } | undefined;
    if (!satir || satir.sql.includes("mail_id")) return;

    /* **Tetikleyiciler tablodan ayrı yaşıyor.** İlk göçte yalnız tablo
       bırakılmıştı; `mailler` üstündeki eski tetikleyiciler kaldı ve artık var
       olmayan sütunlara yazmaya çalışıp **her mail yazmasını düşürdü**
       ("table mail_fts has no column named konu"). Hatayı sistem günlüğü
       gösterdi.

       `CREATE TRIGGER IF NOT EXISTS` eskisini değiştirmiyor, o yüzden üçü de
       açıkça bırakılıyor; şema bloğundaki tanım sonra yeniden kuruyor. */
    db.exec("DROP TRIGGER IF EXISTS mail_fts_ekle");
    db.exec("DROP TRIGGER IF EXISTS mail_fts_sil");
    db.exec("DROP TRIGGER IF EXISTS mail_fts_guncelle");

    db.exec("DROP TABLE IF EXISTS mail_fts");
    db.exec(
      `CREATE VIRTUAL TABLE mail_fts USING fts5(
         metin, mail_id UNINDEXED,
         tokenize = "unicode61 remove_diacritics 2"
       )`,
    );
    db.exec(
      `CREATE TRIGGER mail_fts_sil AFTER DELETE ON mailler BEGIN
         DELETE FROM mail_fts WHERE mail_id = old.id;
       END`,
    );

    ayarYaz(FTS_DAMGA, "-1");
    console.log("[arama] eski FTS şeması ve tetikleyicileri bırakıldı, yenisi kuruldu");
  } catch (e) {
    console.error(`[arama] FTS şeması denklenemedi: ${e instanceof Error ? e.message : e}`);
  }
}

const FTS_DAMGA = "fts_dizin_sayisi";

function ftsGeriDoldur(): void {
  try {
    const mail = (db.prepare("SELECT COUNT(*) AS n FROM mailler").get() as { n: number }).n;
    const kurulu = Number(ayarOku(FTS_DAMGA) || "-1");

    /* Dizinin kendisi de sayılıyor, yalnız damgaya bakılmıyor. Tablo bağımsız
       olduğu için bu sayı gerçekten dizindeki satırı verir (content= tablosunda
       vermiyordu — ilk sürümde arama tam bu yüzden sessizce boş dönmüştü).
       Damga tutsa bile dizin boşalmışsa yeniden kuruluyor: şema göçü ya da elle
       müdahale sonrası arama sessizce çalışmaz kalmasın. */
    const dizin = (db.prepare("SELECT COUNT(*) AS n FROM mail_fts").get() as { n: number }).n;
    if (kurulu === mail && dizin === mail) return;

    /* Bağımsız tablo olduğu için 'rebuild' komutu yok: satırları kendimiz
       yazıyoruz, çünkü normalleştirmeyi yalnız TypeScript yapabiliyor. */
    db.exec("DELETE FROM mail_fts");
    const satirlar = db
      .prepare("SELECT id, konu, gonderen, gonderen_ad, ozet, govde FROM mailler")
      .all() as {
      id: number;
      konu: string;
      gonderen: string;
      gonderen_ad: string;
      ozet: string;
      govde: string;
    }[];
    for (const r of satirlar) {
      ftsYaz(r.id, [r.konu, r.gonderen, r.gonderen_ad, r.ozet, r.govde]);
    }
    ayarYaz(FTS_DAMGA, String(mail));
    console.log(`[arama] FTS dizini kuruldu — ${mail} mail`);
  } catch (e) {
    /* Dizin kurulamazsa uygulama açılmamazlık etmemeli; arama boş döner ve
       sebebi günlükte durur. */
    console.error(`[arama] FTS dizini kurulamadı: ${e instanceof Error ? e.message : e}`);
  }
}
/**
 * Eski maillerin özetini imza kırpmasıyla yeniden üretir (madde 1).
 *
 * Özet **çekim anında** yazılıyor, yani kural sonradan değişince eski satırlar
 * eski hâliyle kalıyor. Listedeki asıl kazanç da tam orada görülüyordu: yeni
 * mail gelene kadar hiçbir şey düzelmiş görünmüyordu.
 *
 * Gövdesi saklanan her mail için özet yeniden çıkarılıyor; gövdesi olmayan
 * (sütun eklenmeden önce çekilmiş) mailde elde yalnız eski özet var, ona
 * dokunulmuyor. Arama dizini de birlikte yazılıyor.
 *
 * Damga `ayarlar`da: kural bir daha değişirse sürüm numarası artırılır ve pas
 * bir kez daha atılır. Her açılışta yeniden hesaplamak, on binlerce mailde
 * açılışı uzatmaktan başka işe yaramazdı.
 */
const OZET_SURUM = "ozet_imza_surumu";
const OZET_SURUM_NO = "1";

function ozetleriTazele(): void {
  try {
    if (ayarOku(OZET_SURUM) === OZET_SURUM_NO) return;

    const satirlar = db
      .prepare(
        "SELECT id, konu, gonderen, gonderen_ad, govde FROM mailler WHERE govde <> ''",
      )
      .all() as {
      id: number;
      konu: string;
      gonderen: string;
      gonderen_ad: string;
      govde: string;
    }[];

    const yaz = db.prepare("UPDATE mailler SET ozet = ? WHERE id = ?");
    let degisen = 0;
    for (const m of satirlar) {
      const yeni = ozetCikar(m.govde);
      /* Kırpma her şeyi yedirdiyse eski özet dursun: boş özet, imzalı özetten
         kötü. */
      if (!yeni) continue;
      yaz.run(yeni, m.id);
      ftsYaz(m.id, [m.konu, m.gonderen, m.gonderen_ad, yeni, m.govde]);
      degisen++;
    }

    ayarYaz(OZET_SURUM, OZET_SURUM_NO);
    if (degisen) console.log(`[şema] ${degisen} mailin özeti imza kırpmasıyla yenilendi`);
  } catch (e) {
    /* Özet türetilmiş veri; tazelenemezse eski özet kalır, panel çalışır. */
    console.error(`[şema] özetler tazelenemedi: ${e instanceof Error ? e.message : e}`);
  }
}

ftsSemasiniDenkle();
ftsGeriDoldur();

/**
 * node:sqlite satırları null prototiple döner; React onları Server'dan
 * Client bileşenine geçirmez. Okuyan her şey buradan geçsin.
 */
function duz<T>(satir: unknown): T {
  return { ...(satir as object) } as T;
}
function duzler<T>(satirlar: unknown[]): T[] {
  return satirlar.map((s) => duz<T>(s));
}

/* ══════════════════════════════════════════════════════════
   Tipler
   ══════════════════════════════════════════════════════════ */

export type Rol = "sahip" | "yonetici" | "personel";
export type TalepDurum = "yeni" | "yazildi" | "kuruldu" | "kapandi";

export type Kullanici = {
  id: number;
  firma_id: number | null;
  eposta: string;
  ad: string;
  rol: Rol;
  operator: number;
  /** etkin | kapali — kapalı kullanıcı giriş yapamaz ama kayıtta kalır. */
  durum: string;
  son_giris: string | null;
  olusma: string;
};

export type Talep = {
  id: number;
  ad: string;
  firma: string;
  eposta: string;
  telefon: string;
  saglayici: string;
  kisi: string;
  aciklama: string;
  kaynak: string;
  durum: TalepDurum;
  olusma: string;
  guncelleme: string;
};

export type Kutu = {
  id: number;
  firma_id: number;
  adres: string;
  saglayici: string;
  imap_sunucu: string;
  imap_port: number;
  smtp_sunucu: string;
  smtp_port: number;
  kullanici_adi: string;
  parola_sifreli: string | null;
  durum: string;
  son_cekim: string | null;
  olusma: string;
};

export type Mail = {
  id: number;
  kutu_id: number;
  firma_id: number;
  mesaj_kimlik: string;
  uid: number | null;
  gonderen_ad: string;
  gonderen: string;
  konu: string;
  ozet: string;
  /** Düz metin gövde. Mail panelde okunabilsin diye saklanıyor. */
  govde: string;
  tarih: string;
  kategori: string | null;
  sahip_id: number | null;
  durum: string;
  elendi: string | null;
  eleme_sebep: string;
  /** Konuşma zincirinin kimliği (madde 2); tek mesajlık mailde kendi kimliği. */
  konusma: string;
  olusma: string;
};

export type Firma = {
  id: number;
  ad: string;
  alan_adi: string;
  plan: string;
  durum: string;
  /** 1 ise sitedeki demo vitrini; verisi her ziyarette sıfırlanır. */
  demo: number;
  olusma: string;
};

/* ══════════════════════════════════════════════════════════
   Ayarlar
   ══════════════════════════════════════════════════════════ */

/** Sitenin açıkta okuyabileceği anahtarlar. Buraya yazmayan hiçbir şey dışarı çıkmaz. */
export const ACIK_AYARLAR = ["iletisim_eposta", "iletisim_telefon"] as const;

export function ayarOku(anahtar: string): string {
  const s = db.prepare("SELECT deger FROM ayarlar WHERE anahtar = ?").get(anahtar) as
    | { deger: string }
    | undefined;
  return s?.deger ?? "";
}

export function ayarlariOku(anahtarlar: readonly string[]): Record<string, string> {
  const cikti: Record<string, string> = {};
  for (const a of anahtarlar) cikti[a] = ayarOku(a);
  return cikti;
}

export function ayarYaz(anahtar: string, deger: string): void {
  db.prepare(
    `INSERT INTO ayarlar (anahtar, deger, guncelleme) VALUES (?, ?, datetime('now'))
     ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger, guncelleme = datetime('now')`,
  ).run(anahtar, deger);
}

/* ══════════════════════════════════════════════════════════
   Demo talepleri
   ══════════════════════════════════════════════════════════ */

export type YeniTalep = Omit<Talep, "id" | "durum" | "olusma" | "guncelleme">;

export function talepEkle(t: YeniTalep): number {
  const s = db
    .prepare(
      `INSERT INTO talepler (ad, firma, eposta, telefon, saglayici, kisi, aciklama, kaynak)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(t.ad, t.firma, t.eposta, t.telefon, t.saglayici, t.kisi, t.aciklama, t.kaynak) as {
    id: number;
  };
  return s.id;
}

export function talepleriGetir(yalnizAcik = false): Talep[] {
  const sql = yalnizAcik
    ? `SELECT * FROM talepler WHERE durum != 'kapandi' ORDER BY olusma DESC`
    : `SELECT * FROM talepler ORDER BY olusma DESC`;
  return duzler<Talep>(db.prepare(sql).all());
}

export function talepDurumYaz(id: number, durum: TalepDurum): void {
  db.prepare(
    `UPDATE talepler SET durum = ?, guncelleme = datetime('now') WHERE id = ?`,
  ).run(durum, id);
}

export function talepSayilari(): Record<TalepDurum, number> {
  const satirlar = db
    .prepare(`SELECT durum, COUNT(*) AS adet FROM talepler GROUP BY durum`)
    .all() as unknown as { durum: TalepDurum; adet: number }[];  // sayaç, sınır geçmiyor
  const cikti: Record<TalepDurum, number> = { yeni: 0, yazildi: 0, kuruldu: 0, kapandi: 0 };
  for (const s of satirlar) cikti[s.durum] = s.adet;
  return cikti;
}

/* ══════════════════════════════════════════════════════════
   Kullanıcılar ve firmalar
   ══════════════════════════════════════════════════════════ */

export function kullaniciEpostaIle(eposta: string): Kullanici | undefined {
  const s = db.prepare("SELECT * FROM kullanicilar WHERE eposta = ?").get(eposta.trim().toLowerCase());
  return s ? duz<Kullanici>(s) : undefined;
}

export function kullaniciIdIle(id: number): Kullanici | undefined {
  const s = db.prepare("SELECT * FROM kullanicilar WHERE id = ?").get(id);
  return s ? duz<Kullanici>(s) : undefined;
}

export function firmaGetir(id: number): Firma | undefined {
  const s = db.prepare("SELECT * FROM firmalar WHERE id = ?").get(id);
  return s ? duz<Firma>(s) : undefined;
}

/** Sayfa bileşenlerinin serbest sorgu için kullanacağı, sınır güvenli okuyucular. */
export function sorgu<T>(sql: string, ...p: unknown[]): T[] {
  return duzler<T>(db.prepare(sql).all(...(p as never[])));
}
export function tek<T>(sql: string, ...p: unknown[]): T | undefined {
  const s = db.prepare(sql).get(...(p as never[]));
  return s ? duz<T>(s) : undefined;
}

/* ══════════════════════════════════════════════════════════
   Kutular ve mailler
   ══════════════════════════════════════════════════════════ */

export function kutulariGetir(firmaId?: number): Kutu[] {
  return firmaId === undefined
    ? duzler<Kutu>(db.prepare("SELECT * FROM kutular ORDER BY adres COLLATE NOCASE").all())
    : duzler<Kutu>(
        db
          .prepare("SELECT * FROM kutular WHERE firma_id = ? ORDER BY adres COLLATE NOCASE")
          .all(firmaId),
      );
}

export function kutuGetir(id: number): Kutu | undefined {
  const s = db.prepare("SELECT * FROM kutular WHERE id = ?").get(id);
  return s ? duz<Kutu>(s) : undefined;
}

export type YeniKutu = {
  firma_id: number;
  adres: string;
  saglayici: string;
  imap_sunucu: string;
  imap_port: number;
  smtp_sunucu: string;
  smtp_port: number;
  kullanici_adi: string;
  parola_sifreli: string | null;
};

export function kutuEkle(k: YeniKutu): number {
  const s = db
    .prepare(
      `INSERT INTO kutular (firma_id, adres, saglayici, imap_sunucu, imap_port,
                            smtp_sunucu, smtp_port, kullanici_adi, parola_sifreli, durum)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'kurulmadi') RETURNING id`,
    )
    .get(
      k.firma_id, k.adres, k.saglayici, k.imap_sunucu, k.imap_port,
      k.smtp_sunucu, k.smtp_port, k.kullanici_adi, k.parola_sifreli,
    ) as { id: number };
  return s.id;
}

/**
 * Kutuyu firma sınırı içinde bulur. Müşteri panelinin her kutu işlemi bundan
 * geçer; `kutuGetir` sınır bilmiyor, o yalnız işçinin kullandığı okuyucu.
 */
export function firmaKutusu(kutuId: number, firmaId: number): Kutu | undefined {
  const s = db.prepare("SELECT * FROM kutular WHERE id = ? AND firma_id = ?").get(kutuId, firmaId);
  return s ? duz<Kutu>(s) : undefined;
}

/** Parola güncelleme — bağlantı yeniden denendikten sonra çağrılır. */
export function kutuParolaYaz(kutuId: number, firmaId: number, sifreli: string): void {
  db.prepare(
    "UPDATE kutular SET parola_sifreli = ?, durum = 'iyi' WHERE id = ? AND firma_id = ?",
  ).run(sifreli, kutuId, firmaId);
}

export function kutuDurumYaz(id: number, durum: string, sonCekim?: string): void {
  if (sonCekim) {
    db.prepare("UPDATE kutular SET durum = ?, son_cekim = ? WHERE id = ?").run(durum, sonCekim, id);
  } else {
    db.prepare("UPDATE kutular SET durum = ? WHERE id = ?").run(durum, id);
  }
}

export type YeniMail = Omit<Mail, "id" | "olusma" | "kategori" | "sahip_id" | "durum" | "konusma"> & {
  /** Bağlı olduğu konuşma; verilmezse mail kendi zincirini açar (madde 2). */
  konusma?: string;
};

/** Aynı Message-ID ikinci kez gelirse yazılmaz. Yazıldıysa true döner. */
export function mailEkle(m: YeniMail): boolean {
  const s = db
    .prepare(
      `INSERT OR IGNORE INTO mailler
         (kutu_id, firma_id, mesaj_kimlik, uid, gonderen_ad, gonderen, konu, ozet,
          govde, tarih, elendi, eleme_sebep, konusma)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      m.kutu_id, m.firma_id, m.mesaj_kimlik, m.uid, m.gonderen_ad, m.gonderen,
      m.konu, m.ozet, m.govde, m.tarih, m.elendi, m.eleme_sebep,
      m.konusma || m.mesaj_kimlik,
    );

  const yazildi = Number(s.changes) > 0;

  /* Arama dizini burada yazılıyor, tetikleyicide değil: metin Türkçe için
     normalleştiriliyor ve SQL bunu yapamaz (bkz. turkceKatla). Elenen mail de
     dizine giriyor — Posta Akışı ekranında "neden gelmedi" diye aranıyor. */
  if (yazildi) {
    const id = Number(s.lastInsertRowid);
    if (id) ftsYaz(id, [m.konu, m.gonderen, m.gonderen_ad, m.ozet, m.govde]);
  }

  return yazildi;
}

export function mailleriGetir(firmaId: number, elenenlerDahil = false): Mail[] {
  const sql = elenenlerDahil
    ? "SELECT * FROM mailler WHERE firma_id = ? ORDER BY tarih DESC LIMIT 200"
    : "SELECT * FROM mailler WHERE firma_id = ? AND elendi IS NULL ORDER BY tarih DESC LIMIT 200";
  return duzler<Mail>(db.prepare(sql).all(firmaId));
}

export function cekimBasla(kutuId: number): number {
  const s = db
    .prepare("INSERT INTO cekimler (kutu_id) VALUES (?) RETURNING id")
    .get(kutuId) as { id: number };
  return s.id;
}

export function cekimBitir(
  id: number,
  o: { bulunan: number; yeni: number; elenen: number; hata?: string },
): void {
  db.prepare(
    `UPDATE cekimler SET bitis = datetime('now'), bulunan = ?, yeni = ?, elenen = ?, hata = ?
     WHERE id = ?`,
  ).run(o.bulunan, o.yeni, o.elenen, o.hata ?? null, id);
}

export function sonCekimler(limit = 12): Array<{
  id: number; kutu_id: number; adres: string; baslangic: string; bitis: string | null;
  bulunan: number; yeni: number; elenen: number; hata: string | null;
}> {
  return duzler(
    db
      .prepare(
        `SELECT c.*, k.adres FROM cekimler c JOIN kutular k ON k.id = c.kutu_id
         ORDER BY c.baslangic DESC LIMIT ?`,
      )
      .all(limit),
  );
}

/* ══════════════════════════════════════════════════════════
   Müşteri paneli: sahiplenme, kategori, durum
   ══════════════════════════════════════════════════════════ */

/* Kategori ve durum sabitleri ayrı dosyada: `"use client"` bileşenleri onları
   alırken `db.ts`i — ve `node:sqlite`i — tarayıcı grafiğine sokmasın. Sunucu
   tarafı buradan almaya devam edebilsin diye yeniden dışa aktarılıyorlar. */
export {
  KATEGORILER,
  KATEGORI_AD,
  DURUMLAR,
  DURUM_AD,
  type Kategori,
  type MailDurum,
} from "./kategoriler.ts";

import { DURUMLAR, KATEGORILER } from "./kategoriler.ts";

export type Yanit = {
  id: number;
  mail_id: number;
  firma_id: number;
  kullanici_id: number | null;
  kime: string;
  konu: string;
  metin: string;
  mesaj_kimlik: string;
  hata: string | null;
  olusma: string;
};

/**
 * Gönderilen yanıtın kaydı. Başarısız denemeler de yazılıyor (`hata` dolu):
 * "yazdım ama gitmemiş" durumu görünür olsun diye.
 */
export function yanitEkle(y: Omit<Yanit, "id" | "olusma">): number {
  const s = db
    .prepare(
      `INSERT INTO yanitlar (mail_id, firma_id, kullanici_id, kime, konu, metin,
                             mesaj_kimlik, hata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(
      y.mail_id, y.firma_id, y.kullanici_id, y.kime, y.konu, y.metin,
      y.mesaj_kimlik, y.hata,
    ) as { id: number };
  return s.id;
}

export type YanitSatiri = Yanit & { yazan_ad: string | null };

export function mailYanitlari(mailId: number, firmaId: number): YanitSatiri[] {
  return duzler<YanitSatiri>(
    db
      .prepare(
        `SELECT y.*, u.ad AS yazan_ad
         FROM yanitlar y LEFT JOIN kullanicilar u ON u.id = y.kullanici_id
         WHERE y.mail_id = ? AND y.firma_id = ?
         ORDER BY y.olusma`,
      )
      .all(mailId, firmaId),
  );
}

export type GelenSatir = Mail & {
  sahip_ad: string | null;
  kutu_adres: string;
  /** Gönderen VIP listesinde mi (0/1). */
  vip: number;
};

export type GelenSuzgec = {
  kategori?: string;
  /** "yok" verilirse kategorisi hiç atanmamış olanlar gelir. */
  kategoriYok?: boolean;
  durum?: string;
  sahipsiz?: boolean;
  sahipId?: number;
  kutuId?: number;
  arama?: string;
  /** Açık olup GECIKME_SAAT'ten uzun süredir bekleyenler. */
  geciken?: boolean;
};

/** Süzgeci SQL koşullarına çevirir. Sayaç ve liste aynı mantığı paylaşsın diye ayrı. */
function gelenKosul(firmaId: number, s: GelenSuzgec): { sql: string; p: unknown[] } {
  const kosullar = ["m.firma_id = ?", "m.elendi IS NULL"];
  const p: unknown[] = [firmaId];
  if (s.kategori) {
    kosullar.push("m.kategori = ?");
    p.push(s.kategori);
  }
  if (s.kategoriYok) kosullar.push("m.kategori IS NULL");
  if (s.durum) {
    kosullar.push("m.durum = ?");
    p.push(s.durum);
  }
  if (s.sahipsiz) kosullar.push("m.sahip_id IS NULL");
  if (s.geciken) {
    kosullar.push("m.durum IN ('yeni','islemde')");
    kosullar.push("m.tarih <= datetime('now', ?)");
    p.push(`-${GECIKME_SAAT} hours`);
  }
  if (s.sahipId !== undefined) {
    kosullar.push("m.sahip_id = ?");
    p.push(s.sahipId);
  }
  if (s.kutuId !== undefined) {
    kosullar.push("m.kutu_id = ?");
    p.push(s.kutuId);
  }
  const q = s.arama?.trim();
  if (q) {
    const fts = ftsSorgusu(q);
    if (fts) {
      /* Alt sorgu olarak: FTS tablosuna JOIN atmak sıralamayı ve LIMIT'i
         karıştırıyordu, IN listesi düzeni bozmadan aynı işi yapıyor. */
      kosullar.push("m.id IN (SELECT mail_id FROM mail_fts WHERE mail_fts MATCH ?)");
      p.push(fts);
    } else {
      /* Girdide aranabilir hiçbir şey yok (yalnız noktalama): hiçbir şey
         eşleşmesin. Süzgeci sessizce yok saymak, kullanıcıya aradığı kelimenin
         her maili getirdiğini düşündürürdü. */
      kosullar.push("1 = 0");
    }
  }
  return { sql: kosullar.join(" AND "), p };
}

/**
 * Türkçe harfleri ASCII karşılığına katlar (madde 11).
 *
 * Neden tokenizer'a bırakılmadı: `unicode61 remove_diacritics 2` ç/ş/ö/ü/ğ'yi
 * katlıyor ama **noktasız ı'yı katlamıyor** — Unicode'da ı aksanlı bir i değil,
 * kendi başına bir harf. Ölçüldü: "çalışma" araması "calisma" yazan maili
 * bulamıyordu.
 *
 * Aynı işlev hem dizine yazarken hem ararken çağrılıyor; iki taraf da aynı
 * biçime indiği sürece hangi biçimde yazıldığı önemsiz oluyor.
 */
export function turkceKatla(metin: string): string {
  return metin
    .replace(/[İIıi]/g, "i")
    .replace(/[Şş]/g, "s")
    .replace(/[Çç]/g, "c")
    .replace(/[Ğğ]/g, "g")
    .replace(/[Öö]/g, "o")
    .replace(/[Üü]/g, "u")
    .toLowerCase();
}

/** Bir mailin aranabilir metnini dizine yazar. */
function ftsYaz(mailId: number, parcalar: (string | null | undefined)[]): void {
  const metin = turkceKatla(parcalar.filter(Boolean).join(" | "));
  db.prepare("DELETE FROM mail_fts WHERE mail_id = ?").run(mailId);
  db.prepare("INSERT INTO mail_fts (metin, mail_id) VALUES (?, ?)").run(metin, mailId);
}

/**
 * Kullanıcının yazdığını güvenli bir FTS5 sorgusuna çevirir (madde 11).
 *
 * Ham girdi doğrudan MATCH'e verilemez: tek bir çift tırnak sorguyu
 * "unterminated string" ile düşürüyor, OR/NOT/NEAR operatör olarak
 * yorumlanıyor ve boş girdi sözdizimi hatası veriyor. Kelimeler burada
 * ayrıştırılıp her biri tırnak içine alınıyor — böylece operatörler sıradan
 * kelimeye dönüşüyor.
 *
 * **Her kelimeye yıldız ekleniyor.** Türkçe eklemeli bir dil: "şikayet"
 * araması, tam eşleşme olsaydı "şikayetim"i bulamazdı. Önek araması bu yüzden
 * tercih değil zorunluluk.
 *
 * En çok sekiz kelime alınıyor; daha uzun girdi aramayı yavaşlatmaktan başka
 * işe yaramıyor.
 */
export function ftsSorgusu(metin: string): string {
  const parcalar = turkceKatla(metin)
    .split(/[^\p{L}\p{N}@._-]+/u)
    .map((x) => x.replace(/"/g, "").trim())
    .filter(Boolean)
    .slice(0, 8);

  if (!parcalar.length) return "";
  return parcalar.map((x) => `"${x}"*`).join(" ");
}

export function gelenKutusu(firmaId: number, suzgec: GelenSuzgec = {}): GelenSatir[] {
  const { sql, p } = gelenKosul(firmaId, suzgec);
  return duzler<GelenSatir>(
    db
      .prepare(
        `SELECT m.*, u.ad AS sahip_ad, k.adres AS kutu_adres,
                (v.adres IS NOT NULL) AS vip
         FROM mailler m
           LEFT JOIN kullanicilar u ON u.id = m.sahip_id
           JOIN kutular k ON k.id = m.kutu_id
           LEFT JOIN vip_gonderenler v
             ON v.firma_id = m.firma_id AND v.adres = LOWER(m.gonderen)
         WHERE ${sql}
         ORDER BY m.tarih DESC LIMIT 200`,
      )
      .all(...(p as never[])),
  );
}

/** Aynı süzgeçle kaç mail olduğunu sayar; sekmelerin yanındaki rakam budur. */
export function gelenSay(firmaId: number, suzgec: GelenSuzgec = {}): number {
  const { sql, p } = gelenKosul(firmaId, suzgec);
  const s = db
    .prepare(`SELECT COUNT(*) AS n FROM mailler m WHERE ${sql}`)
    .get(...(p as never[])) as { n: number };
  return s.n;
}

export function mailGetir(id: number, firmaId: number): GelenSatir | undefined {
  const s = db
    .prepare(
      `SELECT m.*, u.ad AS sahip_ad, k.adres AS kutu_adres,
              (v.adres IS NOT NULL) AS vip
       FROM mailler m
         LEFT JOIN kullanicilar u ON u.id = m.sahip_id
         JOIN kutular k ON k.id = m.kutu_id
         LEFT JOIN vip_gonderenler v
           ON v.firma_id = m.firma_id AND v.adres = LOWER(m.gonderen)
       WHERE m.id = ? AND m.firma_id = ?`,
    )
    .get(id, firmaId);
  return s ? duz<GelenSatir>(s) : undefined;
}

/* ══════════════════════════════════════════════════════════
   Konuşma zinciri (madde 2)

   Kural `posta/konusma.ts`te, eşleştirme burada: kurala veritabanı, sorguya
   ayrıştırma bulaşmasın.
   ══════════════════════════════════════════════════════════ */

/** Yedek eşleşmenin zaman penceresi. Altı ay önceki aynı konu yeni bir iştir. */
const KONUSMA_PENCERE_GUN = 60;

/**
 * Yeni gelen mailin hangi konuşmaya ait olduğunu bulur.
 *
 * Bulamazsa `null` döner ve mail kendi zincirini açar. Sıra önemli: başlık
 * zinciri kesin bilgi, konu benzerliği tahmin — tahmin yalnız kesin bilgi
 * yokken kullanılıyor.
 */
export function konusmaCoz(v: {
  firmaId: number;
  kutuId: number;
  /** `In-Reply-To` + `References` kimlikleri, en yakın atadan başlayarak. */
  kimlikler: string[];
  gonderen: string;
  konu: string;
  tarih: string;
}): string | null {
  for (const kimlik of v.kimlikler) {
    /* Gelen mailin cevapladığı mesaj bizde duruyor mu? */
    const mail = tek<{ konusma: string }>(
      "SELECT konusma FROM mailler WHERE firma_id = ? AND mesaj_kimlik = ? LIMIT 1",
      v.firmaId,
      kimlik,
    );
    if (mail?.konusma) return mail.konusma;

    /* Ya da **bizim gönderdiğimiz** bir yanıtı cevaplıyor olabilir. Bu dal
       olmazsa zincir tam bizim yazdığımız yerde kopardı: müşteri bizim
       cevabımıza cevap verdiğinde yeni bir konuşma açılırdı. */
    const yanit = tek<{ konusma: string }>(
      `SELECT m.konusma FROM yanitlar y
         JOIN mailler m ON m.id = y.mail_id
       WHERE y.firma_id = ? AND y.mesaj_kimlik = ? LIMIT 1`,
      v.firmaId,
      kimlik,
    );
    if (yanit?.konusma) return yanit.konusma;
  }

  /* Yedek yol: aynı kutuya, aynı adresten, aynı konu köküyle. Gönderen şartı
     bilinçli — "Merhaba" konulu iki müşteriyi birleştirmek, ayrı bırakmaktan
     çok daha kötü bir hata olurdu. */
  const kok = konuKoku(v.konu);
  if (!kok) return null;

  /* `konusma <> ''` şart: geri doldurma sırasında zinciri **henüz kurulmamış**
     satırlar da aday oluyor ve boş bir zincir dönerse onu maile yazardık.
     Bir kez oldu: bütün eski mailler boş zincirle işaretlendi, hiçbiri
     konuşmaya girmedi ve kayıt "bağlandı" diye görünüyordu. */
  const adaylar = sorgu<{ konu: string; konusma: string }>(
    `SELECT konu, konusma FROM mailler
     WHERE firma_id = ? AND kutu_id = ? AND gonderen = ? AND konusma <> ''
       AND tarih >= datetime(?, ?)
     ORDER BY tarih DESC LIMIT 20`,
    v.firmaId,
    v.kutuId,
    v.gonderen,
    v.tarih,
    `-${KONUSMA_PENCERE_GUN} days`,
  );

  return adaylar.find((a) => konuKoku(a.konu) === kok)?.konusma || null;
}

/** Zincirdeki mailler, eskiden yeniye. Konuşma ekranının omurgası. */
export function konusmaMailleri(firmaId: number, konusma: string): GelenSatir[] {
  if (!konusma) return [];
  return duzler<GelenSatir>(
    db
      .prepare(
        `SELECT m.*, u.ad AS sahip_ad, k.adres AS kutu_adres,
                (v.adres IS NOT NULL) AS vip
         FROM mailler m
           LEFT JOIN kullanicilar u ON u.id = m.sahip_id
           JOIN kutular k ON k.id = m.kutu_id
           LEFT JOIN vip_gonderenler v
             ON v.firma_id = m.firma_id AND v.adres = LOWER(m.gonderen)
         WHERE m.firma_id = ? AND m.konusma = ?
         ORDER BY m.tarih, m.id`,
      )
      .all(firmaId, konusma),
  );
}

export type KonusmaYaniti = Yanit & { yazan_ad: string | null };

/** Zincirdeki bütün giden yanıtlar — hangi maile verildiği fark etmeksizin. */
export function konusmaYanitlari(firmaId: number, konusma: string): KonusmaYaniti[] {
  if (!konusma) return [];
  return duzler<KonusmaYaniti>(
    db
      .prepare(
        `SELECT y.*, u.ad AS yazan_ad FROM yanitlar y
           JOIN mailler m ON m.id = y.mail_id
           LEFT JOIN kullanicilar u ON u.id = y.kullanici_id
         WHERE y.firma_id = ? AND m.konusma = ?
         ORDER BY y.olusma, y.id`,
      )
      .all(firmaId, konusma),
  );
}

/**
 * Firmanın çok mesajlı konuşmaları: zincir kimliği → mesaj sayısı.
 *
 * Listedeki "3 mesaj" rozeti bunu okuyor. Tek mesajlık konuşmalar hiç
 * dönmüyor; onlar için söylenecek bir şey yok. Gelen mail ve giden yanıt
 * birlikte sayılıyor — konuşmanın uzunluğu ikisinden oluşuyor.
 */
export function konusmaSayilari(firmaId: number): Map<string, number> {
  const sayi = new Map<string, number>();

  for (const r of sorgu<{ k: string; n: number }>(
    `SELECT konusma AS k, COUNT(*) AS n FROM mailler
     WHERE firma_id = ? AND elendi IS NULL AND konusma <> '' GROUP BY konusma`,
    firmaId,
  )) {
    sayi.set(r.k, r.n);
  }

  for (const r of sorgu<{ k: string; n: number }>(
    `SELECT m.konusma AS k, COUNT(*) AS n FROM yanitlar y
       JOIN mailler m ON m.id = y.mail_id
     WHERE y.firma_id = ? AND m.konusma <> '' GROUP BY m.konusma`,
    firmaId,
  )) {
    sayi.set(r.k, (sayi.get(r.k) ?? 0) + r.n);
  }

  for (const [k, n] of sayi) if (n < 2) sayi.delete(k);
  return sayi;
}

/** Sahiplenme. kullaniciId null verilirse sahiplik bırakılır. */
export function sahipYaz(mailId: number, firmaId: number, kullaniciId: number | null): void {
  db.prepare("UPDATE mailler SET sahip_id = ? WHERE id = ? AND firma_id = ?").run(
    kullaniciId,
    mailId,
    firmaId,
  );
}

export function kategoriYaz(mailId: number, firmaId: number, kategori: string | null): void {
  db.prepare("UPDATE mailler SET kategori = ? WHERE id = ? AND firma_id = ?").run(
    kategori,
    mailId,
    firmaId,
  );
}

export function mailDurumYaz(mailId: number, firmaId: number, durum: string): void {
  db.prepare("UPDATE mailler SET durum = ? WHERE id = ? AND firma_id = ?").run(
    durum,
    mailId,
    firmaId,
  );
}

export function firmaKullanicilari(firmaId: number, yalnizEtkin = false): Kullanici[] {
  const kosul = yalnizEtkin ? "AND durum = 'etkin'" : "";
  return duzler<Kullanici>(
    db
      .prepare(
        `SELECT * FROM kullanicilar WHERE firma_id = ? ${kosul} ORDER BY ad COLLATE NOCASE`,
      )
      .all(firmaId),
  );
}

/**
 * Ekipten çıkarma ve geri alma. Kayıt silinmiyor: sildiğimizde o kişinin
 * sahiplendiği maillerin geçmişi de kaybolurdu. Kapatılan kişinin açık
 * oturumları da düşürülüyor — "yarın erişimi kesilsin" diye bir şey yok.
 */
export function kullaniciDurumYaz(
  kullaniciId: number,
  firmaId: number,
  durum: "etkin" | "kapali",
): void {
  db.prepare(
    "UPDATE kullanicilar SET durum = ? WHERE id = ? AND firma_id = ? AND operator = 0",
  ).run(durum, kullaniciId, firmaId);
  if (durum === "kapali") oturumlariSil(kullaniciId);
}

export function oturumlariSil(kullaniciId: number): void {
  db.prepare("DELETE FROM oturumlar WHERE kullanici_id = ?").run(kullaniciId);
  db.prepare(
    "DELETE FROM giris_linkleri WHERE kullanici_id = ? AND kullanildi IS NULL",
  ).run(kullaniciId);
}

/**
 * Ekibe yeni kullanıcı. Adres sistemde varsa `undefined` döner — başka bir
 * firmanın kullanıcısını kendi firmasına çekmek mümkün olmamalı, ve aynı
 * adresi ikinci kez davet etmek de yeni bir kayıt açmamalı.
 */
export function kullaniciEkle(
  firmaId: number,
  eposta: string,
  ad: string,
  rol: Rol,
): Kullanici | undefined {
  const temiz = eposta.trim().toLowerCase();
  if (kullaniciEpostaIle(temiz)) return undefined;

  const s = db
    .prepare(
      `INSERT INTO kullanicilar (firma_id, eposta, ad, rol, operator)
       VALUES (?, ?, ?, ?, 0) RETURNING id`,
    )
    .get(firmaId, temiz, ad.trim(), rol) as { id: number };
  return kullaniciIdIle(s.id);
}

/** Rol değişikliği. Firma sınırı sorgunun içinde; başka firmanın kaydı dönmez. */
export function rolYaz(kullaniciId: number, firmaId: number, rol: Rol): void {
  db.prepare(
    "UPDATE kullanicilar SET rol = ? WHERE id = ? AND firma_id = ? AND operator = 0",
  ).run(rol, kullaniciId, firmaId);
}

export type KutuOzet = Kutu & { gelen: number; elenen: number; toplam: number };

/** Kutu kartlarındaki sayılar. Kutusu olup hiç maili olmayan da listede kalır. */
export function kutuOzetleri(firmaId: number): KutuOzet[] {
  return duzler<KutuOzet>(
    db
      .prepare(
        `SELECT k.*,
                COUNT(m.id)                                       AS toplam,
                COALESCE(SUM(m.elendi IS NULL), 0)                AS gelen,
                COALESCE(SUM(m.elendi IS NOT NULL), 0)            AS elenen
         FROM kutular k LEFT JOIN mailler m ON m.kutu_id = k.id
         WHERE k.firma_id = ?
         GROUP BY k.id
         ORDER BY k.adres COLLATE NOCASE`,
      )
      .all(firmaId),
  );
}

export function girisDamgala(kullaniciId: number): void {
  db.prepare("UPDATE kullanicilar SET son_giris = datetime('now') WHERE id = ?").run(kullaniciId);
}

/* Geliştirmede boş veritabanını doldur; üretimde hiç çalışmaz. */
import { tohumlaGerekirse } from "./tohum.ts";
tohumlaGerekirse();

/* ══════════════════════════════════════════════════════════
   Yanıt şablonları
   ══════════════════════════════════════════════════════════ */

export type Sablon = {
  id: number;
  firma_id: number;
  ad: string;
  kategori: string | null;
  metin: string;
  kullanim: number;
  olusma: string;
  guncelleme: string;
};

export function sablonlariGetir(firmaId: number): Sablon[] {
  return duzler<Sablon>(
    db
      .prepare("SELECT * FROM sablonlar WHERE firma_id = ? ORDER BY ad COLLATE NOCASE")
      .all(firmaId),
  );
}

export function sablonEkle(
  firmaId: number,
  ad: string,
  kategori: string | null,
  metin: string,
): number {
  const s = db
    .prepare(
      "INSERT INTO sablonlar (firma_id, ad, kategori, metin) VALUES (?, ?, ?, ?) RETURNING id",
    )
    .get(firmaId, ad, kategori, metin) as { id: number };
  return s.id;
}

export function sablonYaz(
  id: number,
  firmaId: number,
  ad: string,
  kategori: string | null,
  metin: string,
): void {
  db.prepare(
    `UPDATE sablonlar SET ad = ?, kategori = ?, metin = ?, guncelleme = datetime('now')
     WHERE id = ? AND firma_id = ?`,
  ).run(ad, kategori, metin, id, firmaId);
}

export function sablonSil(id: number, firmaId: number): void {
  db.prepare("DELETE FROM sablonlar WHERE id = ? AND firma_id = ?").run(id, firmaId);
}

/** Şablon yanıta eklendiğinde sayaç artar; hangisinin işe yaradığı görünsün diye. */
export function sablonKullanildi(id: number, firmaId: number): void {
  db.prepare(
    "UPDATE sablonlar SET kullanim = kullanim + 1 WHERE id = ? AND firma_id = ?",
  ).run(id, firmaId);
}

/* ══════════════════════════════════════════════════════════
   Yönlendirme kuralları
   ══════════════════════════════════════════════════════════ */

export const YONLENDIRME_TIPLERI = ["gonderen", "alan", "konu"] as const;
export type YonlendirmeTipi = (typeof YONLENDIRME_TIPLERI)[number];

export const YONLENDIRME_TIP_AD: Record<YonlendirmeTipi, string> = {
  gonderen: "Gönderen adresi",
  alan: "Gönderenin alan adı",
  konu: "Konuda geçen kelime",
};

export type Yonlendirme = {
  id: number;
  firma_id: number;
  tip: string;
  kalip: string;
  kategori: string | null;
  sahip_id: number | null;
  sira: number;
  etkin: number;
  eslesme: number;
  olusma: string;
};

export type YonlendirmeSatiri = Yonlendirme & { sahip_ad: string | null };

export function yonlendirmeleriGetir(firmaId: number, yalnizEtkin = false): YonlendirmeSatiri[] {
  const kosul = yalnizEtkin ? "AND y.etkin = 1" : "";
  return duzler<YonlendirmeSatiri>(
    db
      .prepare(
        `SELECT y.*, u.ad AS sahip_ad
         FROM yonlendirmeler y LEFT JOIN kullanicilar u ON u.id = y.sahip_id
         WHERE y.firma_id = ? ${kosul}
         ORDER BY y.sira, y.id`,
      )
      .all(firmaId),
  );
}

export function yonlendirmeEkle(
  firmaId: number,
  tip: string,
  kalip: string,
  kategori: string | null,
  sahipId: number | null,
): number {
  const enSon = db
    .prepare("SELECT COALESCE(MAX(sira), 0) AS s FROM yonlendirmeler WHERE firma_id = ?")
    .get(firmaId) as { s: number };
  const s = db
    .prepare(
      `INSERT INTO yonlendirmeler (firma_id, tip, kalip, kategori, sahip_id, sira)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(firmaId, tip, kalip, kategori, sahipId, enSon.s + 1) as { id: number };
  return s.id;
}

export function yonlendirmeSil(id: number, firmaId: number): void {
  db.prepare("DELETE FROM yonlendirmeler WHERE id = ? AND firma_id = ?").run(id, firmaId);
}

export function yonlendirmeEtkin(id: number, firmaId: number, etkin: boolean): void {
  db.prepare("UPDATE yonlendirmeler SET etkin = ? WHERE id = ? AND firma_id = ?").run(
    etkin ? 1 : 0,
    id,
    firmaId,
  );
}

/**
 * Sıra değişimi. Kurallar ilk eşleşende duruyor, o yüzden sıra anlamlı.
 * Komşuyla yer değiştirme: listedeki bir kuralı bir adım yukarı/aşağı taşır.
 */
export function yonlendirmeTasi(id: number, firmaId: number, yon: "yukari" | "asagi"): void {
  const liste = yonlendirmeleriGetir(firmaId);
  const i = liste.findIndex((y) => y.id === id);
  if (i === -1) return;
  const j = yon === "yukari" ? i - 1 : i + 1;
  if (j < 0 || j >= liste.length) return;

  const a = liste[i]!;
  const b = liste[j]!;
  const yaz = db.prepare("UPDATE yonlendirmeler SET sira = ? WHERE id = ? AND firma_id = ?");
  /* Sıra değerleri eşit olabilir (elle eklenmiş kayıtlar); indeksi yazıyoruz. */
  liste.forEach((y, k) => yaz.run(k + 1, y.id, firmaId));
  yaz.run(j + 1, a.id, firmaId);
  yaz.run(i + 1, b.id, firmaId);
}

export function yonlendirmeEslesti(id: number, firmaId: number): void {
  db.prepare(
    "UPDATE yonlendirmeler SET eslesme = eslesme + 1 WHERE id = ? AND firma_id = ?",
  ).run(id, firmaId);
}

/** Çekim sırasında yeni yazılan mailin kimliğini bulur. */
export function mailIdBul(kutuId: number, mesajKimlik: string): number | undefined {
  const s = db
    .prepare("SELECT id FROM mailler WHERE kutu_id = ? AND mesaj_kimlik = ?")
    .get(kutuId, mesajKimlik) as { id: number } | undefined;
  return s?.id;
}

/**
 * Yönlendirmenin sonucunu yazar. **Dolu alanın üstüne yazmaz**: kural
 * insanın seçimini ezmemeli, yalnızca boş bırakılanı doldurmalı.
 */
export function mailSinifla(
  mailId: number,
  firmaId: number,
  kategori: string | null,
  sahipId: number | null,
): void {
  if (kategori) {
    db.prepare(
      "UPDATE mailler SET kategori = ? WHERE id = ? AND firma_id = ? AND kategori IS NULL",
    ).run(kategori, mailId, firmaId);
  }
  if (sahipId) {
    db.prepare(
      "UPDATE mailler SET sahip_id = ? WHERE id = ? AND firma_id = ? AND sahip_id IS NULL",
    ).run(sahipId, mailId, firmaId);
  }
}

/** Kural henüz uygulanmamış (kategorisiz ya da sahipsiz) gelen mailler. */
export function sinifsizMailler(firmaId: number, limit = 500): Mail[] {
  return duzler<Mail>(
    db
      .prepare(
        `SELECT * FROM mailler
         WHERE firma_id = ? AND elendi IS NULL AND (kategori IS NULL OR sahip_id IS NULL)
         ORDER BY tarih DESC LIMIT ?`,
      )
      .all(firmaId, limit),
  );
}

/* ══════════════════════════════════════════════════════════
   Abonelik, maliyet ve sistem günlüğü (operatör tarafı)
   ══════════════════════════════════════════════════════════ */

export const PLANLAR = ["baslangic", "pro", "kurumsal"] as const;
export const FIRMA_DURUMLARI = ["deneme", "etkin", "duraklatildi", "ayrildi"] as const;

export const PLAN_AD: Record<string, string> = {
  baslangic: "Başlangıç",
  pro: "Pro",
  kurumsal: "Kurumsal",
};

export const FIRMA_DURUM_AD: Record<string, string> = {
  deneme: "Deneme",
  etkin: "Etkin",
  duraklatildi: "Duraklatıldı",
  ayrildi: "Ayrıldı",
};

/**
 * Aylık ücret **kuruş** cinsinden tutuluyor.
 *
 * Para birimini ondalıklı sayıyla saklamak, toplama çıkarmada kuruş kaybettiren
 * klasik hatadır; tam sayı kuruş bunu baştan keser. Görüntülerken 100'e bölünür.
 */
export function firmaAboneligiYaz(
  firmaId: number,
  plan: string,
  durum: string,
  aylikKurus: number,
): void {
  db.prepare(
    "UPDATE firmalar SET plan = ?, durum = ?, aylik_kurus = ? WHERE id = ?",
  ).run(plan, durum, aylikKurus, firmaId);

  /* Her değişiklik geçmişe de düşüyor: gelir eğilimi ancak böyle çizilebilir.
     `firmalar.aylik_kurus` yalnız bugünü bilir. */
  db.prepare(
    "INSERT INTO abonelik_gecmisi (firma_id, plan, durum, kurus) VALUES (?, ?, ?, ?)",
  ).run(firmaId, plan, durum, aylikKurus);
}

/* ══════════════════════════════════════════════════════════
   Ölçüm — yapay zekâ, destek, gelir geçmişi

   Üçü de bugün boş tablolardan okuyor. Kasıtlı: ekranlar sabit sıfır ya da
   uydurma rakam göstermiyor, **gerçek sorgunun bugünkü cevabını** gösteriyor.
   Model bağlanıp `ai_kullanim`a yazmaya başladığında, operatör destek dakikası
   girdiğinde ya da abonelik değiştiğinde rakamlar kendiliğinden dolar.
   ══════════════════════════════════════════════════════════ */

/** Bir firmanın son 30 gündeki yapay zekâ maliyeti (kuruş). Satır yoksa null. */
export function aiMaliyet(firmaId: number, gun = 30): number | null {
  const s = db
    .prepare(
      `SELECT SUM(kurus) AS k, COUNT(*) AS n FROM ai_kullanim
       WHERE firma_id = ? AND olusma >= datetime('now', ?)`,
    )
    .get(firmaId, `-${gun} days`) as { k: number | null; n: number };
  return s.n ? (s.k ?? 0) : null;
}

/** Bütün firmalar için toplam yapay zekâ maliyeti. Hiç kayıt yoksa null. */
export function aiMaliyetToplam(gun = 30): number | null {
  const s = db
    .prepare(
      `SELECT SUM(kurus) AS k, COUNT(*) AS n FROM ai_kullanim
       WHERE olusma >= datetime('now', ?)`,
    )
    .get(`-${gun} days`) as { k: number | null; n: number };
  return s.n ? (s.k ?? 0) : null;
}

/**
 * Model çağrılarının iş türleri ve okunur adları.
 *
 * Maliyet ekranı bu sözlükten okuyor; tanınmayan bir tür gelirse ham değeri
 * yazıyor — sessizce "diğer" demek, yeni bir iş türünün gözden kaçması demek
 * olurdu. Bugün yalnız `karakter` yazılıyor; ötekiler model adımı bağlandığında
 * dolacak.
 */
export const AI_IS_TURU_AD: Record<string, string> = {
  karakter: "Bilgi deposu çıkarımı",
  siniflandirma: "Mail sınıflandırma",
  taslak: "Yanıt taslağı",
  "ek-analizi": "Ek analizi",
};

export type AiIsTuru = { is_turu: string; model: string; cagri: number; token: number; kurus: number };

/** Maliyet ekranındaki "iş türüne göre" tablosu. Boşsa boş dizi. */
export function aiIsTurleri(gun = 30): AiIsTuru[] {
  return duzler<AiIsTuru>(
    db
      .prepare(
        `SELECT is_turu, model,
                COUNT(*) AS cagri,
                SUM(girdi_token + cikti_token) AS token,
                SUM(kurus) AS kurus
         FROM ai_kullanim WHERE olusma >= datetime('now', ?)
         GROUP BY is_turu, model ORDER BY kurus DESC`,
      )
      .all(`-${gun} days`),
  );
}

/** Firmaya harcanan destek dakikası. Kayıt yoksa null — sıfır değil. */
export function destekDakika(firmaId: number, gun = 30): number | null {
  const s = db
    .prepare(
      `SELECT SUM(dakika) AS d, COUNT(*) AS n FROM destek_kayitlari
       WHERE firma_id = ? AND olusma >= datetime('now', ?)`,
    )
    .get(firmaId, `-${gun} days`) as { d: number | null; n: number };
  return s.n ? (s.d ?? 0) : null;
}

export function destekDakikaToplam(gun = 30): number | null {
  const s = db
    .prepare(
      `SELECT SUM(dakika) AS d, COUNT(*) AS n FROM destek_kayitlari
       WHERE olusma >= datetime('now', ?)`,
    )
    .get(`-${gun} days`) as { d: number | null; n: number };
  return s.n ? (s.d ?? 0) : null;
}

/** Aylık gelir serisi — abonelik geçmişinden. Geçmiş yoksa boş dizi. */
export function gelirSerisi(dilim = 6): number[] {
  const kayitVar = (
    db.prepare("SELECT COUNT(*) AS n FROM abonelik_gecmisi").get() as { n: number }
  ).n;
  if (!kayitVar) return [];

  const seri: number[] = [];
  for (let i = dilim - 1; i >= 0; i--) {
    /* O ana kadarki son kayıt her firma için ayrı ayrı alınıyor: gelir, o
       tarihte yürürlükte olan aboneliklerin toplamıdır. */
    const s = db
      .prepare(
        `SELECT COALESCE(SUM(g.kurus), 0) AS k FROM abonelik_gecmisi g
         JOIN (SELECT firma_id, MAX(olusma) AS son FROM abonelik_gecmisi
               WHERE olusma < datetime('now', ?) GROUP BY firma_id) x
           ON x.firma_id = g.firma_id AND x.son = g.olusma
         WHERE g.durum != 'ayrildi'`,
      )
      .get(`-${i * 30} days`) as { k: number };
    seri.push(s.k);
  }
  return seri;
}

export type GelirHareketi = {
  /** Dönem başındaki toplam (kuruş). */
  baz: number;
  yeni: number;
  yukseltme: number;
  dusurme: number;
  ayrilan: number;
  /** Dönem sonundaki toplam. */
  son: number;
  /** Geçmiş kaydı hiç yoksa true: şelale çizilmez. */
  gecmisYok: boolean;
};

/**
 * Gelirin dönem içinde nasıl değiştiği (madde 4) — prototipteki şelale.
 *
 * Her firmanın **dönem başındaki** ve **bugünkü** aboneliği karşılaştırılıyor;
 * fark nereden geldiğine göre dört kaleme ayrılıyor: yeni müşteri, plan
 * yükseltme, plan düşürme, ayrılan. Toplam gelir tek başına "arttı" der,
 * bu ayrım **neden** arttığını söyler — yeni müşteriden mi, mevcut müşterinin
 * derinleşmesinden mi.
 *
 * Kaynak `abonelik_gecmisi`: `firmalar.aylik_kurus` yalnız bugünü bilir.
 * Tablo `firmaAboneligiYaz` ile doluyor, yani abonelik ilk kez yazıldığı
 * andan itibaren geçmiş birikiyor.
 */
export function gelirHareketi(gun = 30): GelirHareketi {
  const kayitVar = (
    db.prepare("SELECT COUNT(*) AS n FROM abonelik_gecmisi").get() as { n: number }
  ).n;

  const simdi = db
    .prepare("SELECT id, aylik_kurus, durum FROM firmalar")
    .all() as { id: number; aylik_kurus: number; durum: string }[];

  const son = simdi
    .filter((f) => f.durum !== "ayrildi")
    .reduce((t, f) => t + (f.aylik_kurus ?? 0), 0);

  if (!kayitVar) {
    return { baz: son, yeni: 0, yukseltme: 0, dusurme: 0, ayrilan: 0, son, gecmisYok: true };
  }

  /* Dönem başındaki durum: o tarihten önceki **son** kayıt, firma başına. */
  const oncekiler = db
    .prepare(
      `SELECT g.firma_id, g.kurus, g.durum FROM abonelik_gecmisi g
       JOIN (SELECT firma_id, MAX(olusma) AS son FROM abonelik_gecmisi
             WHERE olusma < datetime('now', ?) GROUP BY firma_id) x
         ON x.firma_id = g.firma_id AND x.son = g.olusma`,
    )
    .all(`-${gun} days`) as { firma_id: number; kurus: number; durum: string }[];

  const once = new Map<number, { kurus: number; durum: string }>();
  for (const o of oncekiler) once.set(o.firma_id, { kurus: o.kurus, durum: o.durum });

  let baz = 0;
  let yeni = 0;
  let yukseltme = 0;
  let dusurme = 0;
  let ayrilan = 0;

  for (const f of simdi) {
    const eski = once.get(f.id);
    const eskiTutar = eski && eski.durum !== "ayrildi" ? eski.kurus : 0;
    const yeniTutar = f.durum !== "ayrildi" ? (f.aylik_kurus ?? 0) : 0;
    baz += eskiTutar;

    const fark = yeniTutar - eskiTutar;
    if (fark === 0) continue;

    if (eskiTutar === 0) yeni += fark;
    else if (yeniTutar === 0) ayrilan += fark;
    else if (fark > 0) yukseltme += fark;
    else dusurme += fark;
  }

  return { baz, yeni, yukseltme, dusurme, ayrilan, son, gecmisYok: false };
}

export type Yenileme = { firmaId: number; ad: string; kurus: number; gun: number; durum: string };

/**
 * Yaklaşan yenilemeler.
 *
 * Ayrı bir "yenileme tarihi" alanı yok; tarih **aboneliğin başladığı günün
 * aylık yıldönümünden** türetiliyor. Uydurma bir tarih yazmaktansa gerçek
 * başlangıcı kullanmak doğru olan — tahsilat bağlandığında sağlayıcının kendi
 * tarihi buranın yerini alacak.
 */
export function yaklasanYenilemeler(limit = 6): Yenileme[] {
  const firmalar = db
    .prepare(
      `SELECT id, ad, aylik_kurus, durum, olusma FROM firmalar
       WHERE durum IN ('etkin','deneme') AND aylik_kurus > 0`,
    )
    .all() as {
    id: number;
    ad: string;
    aylik_kurus: number;
    durum: string;
    olusma: string;
  }[];

  const bugun = new Date();
  const cikti: Yenileme[] = firmalar.map((f) => {
    const bas = new Date(f.olusma.replace(" ", "T") + "Z");
    const gunu = bas.getUTCDate();

    /* Bu ayki yıldönümü geçtiyse gelecek ay. */
    let hedef = new Date(
      Date.UTC(bugun.getUTCFullYear(), bugun.getUTCMonth(), gunu),
    );
    if (hedef.getTime() < bugun.getTime()) {
      hedef = new Date(Date.UTC(bugun.getUTCFullYear(), bugun.getUTCMonth() + 1, gunu));
    }

    return {
      firmaId: f.id,
      ad: f.ad,
      kurus: f.aylik_kurus,
      gun: Math.max(0, Math.round((hedef.getTime() - bugun.getTime()) / 86400000)),
      durum: f.durum,
    };
  });

  return cikti.sort((a, b) => a.gun - b.gun).slice(0, limit);
}

export type SaglikSkoru = {
  /** 0–100. Hiçbir bileşen ölçülemiyorsa null. */
  skor: number | null;
  /** Skora giren bileşenlerin toplam ağırlığı (100 üzerinden). */
  kapsam: number;
  kirilim: { ad: string; agirlik: number; deger: number | null }[];
};

/**
 * Müşteri sağlık skoru — prototipteki dört bileşen.
 *
 * Hacim eğilimi (35) · aktif kullanıcı oranı (30) · taslak onay oranı (20) ·
 * destek yükü (15).
 *
 * **Ölçülemeyen bileşen skora girmiyor**, sıfır sayılmıyor: veri yokluğunu
 * kötü performans gibi göstermek yanlış olurdu. Onun yerine skor, ölçülebilen
 * bileşenlerin ağırlığına göre normalize ediliyor ve `kapsam` kaç puanlık
 * bölümün gerçekten ölçüldüğünü söylüyor. Model bağlanıp taslak onayları
 * birikmeye başlayınca kapsam kendiliğinden 100'e çıkar.
 */
export function saglikSkoru(firmaId: number): SaglikSkoru {
  const kirilim: SaglikSkoru["kirilim"] = [];

  /* 1. Hacim eğilimi: son 30 gün, önceki 30 güne göre. */
  const seri = firmaHacimSerisi(firmaId, 2);
  const onceki = seri[0] ?? 0;
  const simdi = seri[1] ?? 0;
  let hacim: number | null = null;
  if (onceki > 0 || simdi > 0) {
    if (onceki === 0) hacim = 100;
    else {
      const oran = simdi / onceki;
      hacim = Math.max(0, Math.min(100, Math.round(oran * 70)));
    }
  }
  kirilim.push({ ad: "Hacim eğilimi", agirlik: 35, deger: hacim });

  /* 2. Aktif kullanıcı oranı: son 30 günde giriş yapmış etkin kullanıcı. */
  const k = db
    .prepare(
      `SELECT COUNT(*) AS toplam,
              SUM(CASE WHEN son_giris >= datetime('now', '-30 days') THEN 1 ELSE 0 END) AS aktif
       FROM kullanicilar WHERE firma_id = ? AND durum = 'etkin'`,
    )
    .get(firmaId) as { toplam: number; aktif: number | null };
  const aktifOran = k.toplam ? Math.round(((k.aktif ?? 0) / k.toplam) * 100) : null;
  kirilim.push({ ad: "Aktif kullanıcı", agirlik: 30, deger: aktifOran });

  /* 3. Taslak onay oranı: yapay zekâ adımına bağlı, tablo bugün boş. */
  const t = db
    .prepare(
      `SELECT COUNT(*) AS n FROM ai_kullanim
       WHERE firma_id = ? AND is_turu = 'taslak' AND olusma >= datetime('now', '-30 days')`,
    )
    .get(firmaId) as { n: number };
  kirilim.push({ ad: "Taslak onayı", agirlik: 20, deger: t.n ? 100 : null });

  /* 4. Destek yükü: az destek = yüksek puan. Kayıt yoksa ölçülemiyor. */
  const dk = destekDakika(firmaId);
  const destek = dk === null ? null : Math.max(0, 100 - Math.min(100, Math.round(dk / 3)));
  kirilim.push({ ad: "Destek yükü", agirlik: 15, deger: destek });

  const olculen = kirilim.filter((b) => b.deger !== null);
  const kapsam = olculen.reduce((t2, b) => t2 + b.agirlik, 0);
  if (!kapsam) return { skor: null, kapsam: 0, kirilim };

  const toplam = olculen.reduce((t2, b) => t2 + (b.deger as number) * b.agirlik, 0);
  return { skor: Math.round(toplam / kapsam), kapsam, kirilim };
}

export type FirmaOzet = Firma & {
  aylik_kurus: number;
  kutu: number;
  kullanici: number;
  gelen_ay: number;
  elenen_ay: number;
  gelen_toplam: number;
};

/**
 * Operatörün abonelik ve maliyet ekranlarının okuduğu satır.
 *
 * "Bu ay" = son 30 gün. Takvim ayı değil, çünkü fatura dönemleri firma başına
 * farklı başlıyor ve ay başında bütün sayılar sıfırlanmış görünürdü.
 */
export function firmaOzetleri(): FirmaOzet[] {
  return duzler<FirmaOzet>(
    db
      .prepare(
        `SELECT f.*,
                (SELECT COUNT(*) FROM kutular k WHERE k.firma_id = f.id)              AS kutu,
                (SELECT COUNT(*) FROM kullanicilar u
                  WHERE u.firma_id = f.id AND u.durum = 'etkin')                      AS kullanici,
                (SELECT COUNT(*) FROM mailler m
                  WHERE m.firma_id = f.id AND m.elendi IS NULL
                    AND m.olusma >= datetime('now', '-30 days'))                      AS gelen_ay,
                (SELECT COUNT(*) FROM mailler m
                  WHERE m.firma_id = f.id AND m.elendi IS NOT NULL
                    AND m.olusma >= datetime('now', '-30 days'))                      AS elenen_ay,
                (SELECT COUNT(*) FROM mailler m
                  WHERE m.firma_id = f.id AND m.elendi IS NULL)                       AS gelen_toplam
         FROM firmalar f
         ORDER BY f.ad COLLATE NOCASE`,
      )
      .all(),
  );
}

/**
 * Firma başına aylık mail hacmi — operatör tablosundaki kıvılcım çizgisi.
 *
 * Altı dilim, her biri 30 gün. Takvim ayı değil: `firmaOzetleri`'deki "bu ay"
 * ile aynı ölçü olsun, son dilim oradaki `gelen_ay` ile tutsun.
 *
 * Eski dilimlerde firma henüz müşteri değilse sayı sıfır çıkar; bu uydurma
 * değil, gerçekten mail yoktu.
 */
export function firmaHacimSerisi(firmaId: number, dilim = 6): number[] {
  const satirlar: number[] = [];
  for (let i = dilim - 1; i >= 0; i--) {
    const n = (
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM mailler
           WHERE firma_id = ? AND elendi IS NULL
             AND olusma >= datetime('now', ?) AND olusma < datetime('now', ?)`,
        )
        .get(firmaId, `-${(i + 1) * 30} days`, `-${i * 30} days`) as { n: number }
    ).n;
    satirlar.push(n);
  }
  return satirlar;
}

/* ══════════════════════════════════════════════════════════
   Destek ticketları

   Firma sınırı burada da tek kapıdan geçiyor: müşteri tarafındaki her okuma
   `firmaId` alıyor ve sorgunun koşuluna giriyor. Operatör tarafı `firmaId`
   vermeden okuyor — servis sahibi hepsini görür.
   ══════════════════════════════════════════════════════════ */

/* Ticket bir maile bağlanabiliyor: müşteri "şu mail gelmedi" derken hangi
   mailden söz ettiğini gösterebilsin, operatör de ticketta doğrudan o maile
   bakabilsin. Sonradan eklendiği için göç yardımcısıyla. */
sutunEkleGerekirse("ticketlar", "mail_id", "INTEGER REFERENCES mailler(id) ON DELETE SET NULL");

/* Sabitler ayrı dosyada: `"use client"` bileşenleri onları alırken `db.ts`i
   — ve `node:sqlite`i — tarayıcı grafiğine sokmasın. Sunucu tarafı buradan
   almaya devam edebilsin diye yeniden dışa aktarılıyorlar. */
export {
  TICKET_KATEGORILERI,
  TICKET_ONCELIKLERI,
  TICKET_DURUMLARI,
  TICKET_KATEGORI_AD,
  TICKET_ONCELIK_AD,
  TICKET_DURUM_AD,
} from "./ticketSabitleri.ts";

/* Arama sonuçlarında durum adını yazmak için bu dosyanın kendisine de lazım;
   `export ... from` yalnız dışarı açar, içeri getirmez. */
import { TICKET_DURUM_AD } from "./ticketSabitleri.ts";

export type Ticket = {
  id: number;
  firma_id: number;
  acan_id: number | null;
  /** Ticketın bağlandığı mail (madde 3). Bağ yoksa null. */
  mail_id: number | null;
  konu: string;
  kategori: string;
  oncelik: string;
  durum: string;
  olusma: string;
  guncelleme: string;
  firma_ad: string;
  acan_ad: string | null;
  acan_eposta: string | null;
  mesaj_adedi: number;
  son_yazan_operator: number | null;
};

export type TicketMesaji = {
  id: number;
  ticket_id: number;
  yazan_id: number | null;
  operator: number;
  metin: string;
  olusma: string;
  yazan_ad: string | null;
};

const TICKET_SECIM = `
  SELECT t.*, f.ad AS firma_ad,
         u.ad AS acan_ad, u.eposta AS acan_eposta,
         (SELECT COUNT(*) FROM ticket_mesajlari m WHERE m.ticket_id = t.id) AS mesaj_adedi,
         (SELECT m.operator FROM ticket_mesajlari m WHERE m.ticket_id = t.id
           ORDER BY m.olusma DESC, m.id DESC LIMIT 1)                       AS son_yazan_operator
  FROM ticketlar t
  JOIN firmalar f ON f.id = t.firma_id
  LEFT JOIN kullanicilar u ON u.id = t.acan_id`;

/** Ticket açar ve ilk mesajı yazar. Dönen değer yeni ticketın numarası. */
export function ticketAc(
  firmaId: number,
  acanId: number,
  konu: string,
  metin: string,
  kategori: string,
  oncelik: string,
): number {
  const t = db
    .prepare(
      `INSERT INTO ticketlar (firma_id, acan_id, konu, kategori, oncelik, durum)
       VALUES (?, ?, ?, ?, ?, 'acik') RETURNING id`,
    )
    .get(firmaId, acanId, konu, kategori, oncelik) as { id: number };

  db.prepare(
    "INSERT INTO ticket_mesajlari (ticket_id, yazan_id, operator, metin) VALUES (?, ?, 0, ?)",
  ).run(t.id, acanId, metin);

  gunlukYaz("kurulum", `Destek talebi açıldı: ${konu}`, firmaId);
  return t.id;
}

/** Müşteri tarafı: yalnız kendi firması. Operatör tarafı: `firmaId` verilmez. */
export function ticketlariGetir(firmaId?: number, kapaliDahil = true): Ticket[] {
  const kosul: string[] = [];
  const p: unknown[] = [];
  if (firmaId !== undefined) {
    kosul.push("t.firma_id = ?");
    p.push(firmaId);
  }
  if (!kapaliDahil) kosul.push("t.durum NOT IN ('kapandi', 'cozuldu')");

  return duzler<Ticket>(
    db
      .prepare(
        `${TICKET_SECIM}
         ${kosul.length ? "WHERE " + kosul.join(" AND ") : ""}
         ORDER BY t.guncelleme DESC`,
      )
      .all(...(p as never[])),
  );
}

export function ticketGetir(id: number, firmaId?: number): Ticket | undefined {
  const s = db
    .prepare(
      `${TICKET_SECIM} WHERE t.id = ?${firmaId !== undefined ? " AND t.firma_id = ?" : ""}`,
    )
    .get(...(firmaId !== undefined ? [id, firmaId] : [id]));
  return s ? duz<Ticket>(s) : undefined;
}

export function ticketMesajlari(ticketId: number): TicketMesaji[] {
  return duzler<TicketMesaji>(
    db
      .prepare(
        `SELECT m.*, u.ad AS yazan_ad FROM ticket_mesajlari m
         LEFT JOIN kullanicilar u ON u.id = m.yazan_id
         WHERE m.ticket_id = ? ORDER BY m.olusma, m.id`,
      )
      .all(ticketId),
  );
}

/**
 * Mesaj ekler ve durumu **yazan tarafa göre** çevirir: müşteri yazdıysa top
 * bizde, operatör yazdıysa müşteride. Kapanmış ticket yeniden açılıyor —
 * kapalıya yazılan mesajın görünmez kalması en kötü hâl olurdu.
 */
export function ticketMesajEkle(
  ticketId: number,
  yazanId: number | null,
  operator: boolean,
  metin: string,
): void {
  db.prepare(
    "INSERT INTO ticket_mesajlari (ticket_id, yazan_id, operator, metin) VALUES (?, ?, ?, ?)",
  ).run(ticketId, yazanId, operator ? 1 : 0, metin);

  db.prepare(
    "UPDATE ticketlar SET durum = ?, guncelleme = datetime('now') WHERE id = ?",
  ).run(operator ? "musteride" : "operatorde", ticketId);
}

export function ticketDurumYaz(ticketId: number, durum: string): void {
  db.prepare(
    "UPDATE ticketlar SET durum = ?, guncelleme = datetime('now') WHERE id = ?",
  ).run(durum, ticketId);
}

/** Operatör kuyruğunun sayaçları. */
export function ticketSayilari(): Record<string, number> {
  const satirlar = db
    .prepare("SELECT durum, COUNT(*) AS n FROM ticketlar GROUP BY durum")
    .all() as { durum: string; n: number }[];
  const cikti: Record<string, number> = {};
  for (const s of satirlar) cikti[s.durum] = s.n;
  return cikti;
}

/* ══════════════════════════════════════════════════════════
   Ekler · ekip içi notlar · destek zamanı
   ══════════════════════════════════════════════════════════ */

export type Ek = {
  id: number;
  mail_id: number | null;
  ticket_id: number | null;
  firma_id: number;
  ad: string;
  tip: string;
  boyut: number;
  dosya: string;
  olusma: string;
};

export function ekEkle(v: {
  mailId?: number | null;
  ticketId?: number | null;
  firmaId: number;
  ad: string;
  tip: string;
  boyut: number;
  dosya: string;
}): number {
  const s = db
    .prepare(
      `INSERT INTO ekler (mail_id, ticket_id, firma_id, ad, tip, boyut, dosya)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(
      v.mailId ?? null,
      v.ticketId ?? null,
      v.firmaId,
      v.ad,
      v.tip,
      v.boyut,
      v.dosya,
    ) as { id: number };
  return s.id;
}

/** Firma sınırı koşulda: başka firmanın eki listelenemez. */
export function mailEkleri(mailId: number, firmaId: number): Ek[] {
  return duzler<Ek>(
    db
      .prepare("SELECT * FROM ekler WHERE mail_id = ? AND firma_id = ? ORDER BY id")
      .all(mailId, firmaId),
  );
}

export function ticketEkleri(ticketId: number): Ek[] {
  return duzler<Ek>(
    db.prepare("SELECT * FROM ekler WHERE ticket_id = ? ORDER BY id").all(ticketId),
  );
}

/** Tek ek; indirme ucu bununla yetki kontrolü yapıyor. */
export function ekGetir(id: number): Ek | undefined {
  const s = db.prepare("SELECT * FROM ekler WHERE id = ?").get(id);
  return s ? duz<Ek>(s) : undefined;
}

export type MailNotu = {
  id: number;
  mail_id: number;
  yazan_id: number | null;
  metin: string;
  olusma: string;
  yazan_ad: string | null;
};

export function mailNotlari(mailId: number, firmaId: number): MailNotu[] {
  return duzler<MailNotu>(
    db
      .prepare(
        `SELECT n.*, u.ad AS yazan_ad FROM mail_notlari n
         LEFT JOIN kullanicilar u ON u.id = n.yazan_id
         WHERE n.mail_id = ? AND n.firma_id = ? ORDER BY n.olusma, n.id`,
      )
      .all(mailId, firmaId),
  );
}

export function mailNotuEkle(
  mailId: number,
  firmaId: number,
  yazanId: number,
  metin: string,
): void {
  db.prepare(
    "INSERT INTO mail_notlari (mail_id, firma_id, yazan_id, metin) VALUES (?, ?, ?, ?)",
  ).run(mailId, firmaId, yazanId, metin);
}

export function mailNotuSil(notId: number, firmaId: number, yazanId: number): void {
  /* Yalnız kendi notunu silebiliyor: başkasının notunu silmek geçmişi bozar. */
  db.prepare(
    "DELETE FROM mail_notlari WHERE id = ? AND firma_id = ? AND yazan_id = ?",
  ).run(notId, firmaId, yazanId);
}

/* ── yanıt taslakları ──────────────────────────────────────
   Metin sahibinin kendisine ait: her sorgunun koşulunda hem firma hem kişi
   var. Başkasının yarım yazısı ne okunuyor ne siliniyor. */

export type Taslak = { metin: string; guncelleme: string };

export function taslakGetir(
  mailId: number,
  firmaId: number,
  kullaniciId: number,
): Taslak | undefined {
  return tek<Taslak>(
    `SELECT metin, guncelleme FROM yanit_taslaklari
     WHERE mail_id = ? AND firma_id = ? AND kullanici_id = ?`,
    mailId,
    firmaId,
    kullaniciId,
  );
}

/** Taslağı yazar ve kaydın damgasını döner. Boş metin taslağı siler. */
export function taslakYaz(
  mailId: number,
  firmaId: number,
  kullaniciId: number,
  metin: string,
): string {
  if (!metin.trim()) {
    taslakSil(mailId, firmaId, kullaniciId);
    return "";
  }

  const damga = new Date().toISOString().replace("T", " ").slice(0, 19);
  db.prepare(
    `INSERT INTO yanit_taslaklari (mail_id, firma_id, kullanici_id, metin, guncelleme)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (mail_id, kullanici_id)
       DO UPDATE SET metin = excluded.metin, guncelleme = excluded.guncelleme`,
  ).run(mailId, firmaId, kullaniciId, metin, damga);
  return damga;
}

export function taslakSil(mailId: number, firmaId: number, kullaniciId: number): void {
  db.prepare(
    "DELETE FROM yanit_taslaklari WHERE mail_id = ? AND firma_id = ? AND kullanici_id = ?",
  ).run(mailId, firmaId, kullaniciId);
}

/**
 * Kişinin taslağı olan maillerin numaraları — listedeki "taslak" rozeti bunu
 * okuyor. Tek sorgu: satır başına sorgu atmak listeyi iki yüz sorguya çıkarırdı.
 */
export function taslakliMailler(firmaId: number, kullaniciId: number): Set<number> {
  const satirlar = sorgu<{ mail_id: number }>(
    "SELECT mail_id FROM yanit_taslaklari WHERE firma_id = ? AND kullanici_id = ?",
    firmaId,
    kullaniciId,
  );
  return new Set(satirlar.map((s) => s.mail_id));
}

/* ══════════════════════════════════════════════════════════
   Bilgi deposu

   Her sorgunun koşulunda firma var. Yazma yetkisi çağıranın işi (ekran
   `kurulumGorur` ile kapıyı tutuyor), ama **firma sınırı** burada — unutulacak
   bir şey olmasın.
   ══════════════════════════════════════════════════════════ */

export type KarakterAlaniSatiri = {
  alan: string;
  /** Yalnız yöneticinin eklediği maddelerde dolu; hazır alanların adı sabit. */
  baslik: string;
  deger: string;
  kaynak: string;
  guncelleme: string;
  guncelleyen_ad: string | null;
};

/** Firmanın karakteri: alan → satır. Hiç yazılmamış alan sözlükte yoktur. */
export function karakterGetir(firmaId: number): Map<string, KarakterAlaniSatiri> {
  const satirlar = duzler<KarakterAlaniSatiri>(
    db
      .prepare(
        `SELECT k.alan, k.baslik, k.deger, k.kaynak, k.guncelleme, u.ad AS guncelleyen_ad
         FROM karakter_alanlari k
           LEFT JOIN kullanicilar u ON u.id = k.guncelleyen_id
         WHERE k.firma_id = ? ORDER BY k.rowid`,
      )
      .all(firmaId),
  );
  return new Map(satirlar.map((s) => [s.alan, s]));
}

/* Önek `bilgiSabitleri.ts`te tanımlı: düzenleme ekranı da aynı dizgiye bakıyor
   ve o dosya `"use client"` tarafından import edilebiliyor. Buradan yeniden
   dışa aktarılıyor ki sunucu tarafı tek yerden alsın. */
export { OZEL_ONEK } from "./bilgiSabitleri.ts";

/**
 * Yöneticinin kendi karakter maddesi.
 *
 * Hazır beş alan her firmaya uymuyor: birinin "kampanya dili", ötekinin
 * "bayi yazışması" diye bir başlığa ihtiyacı oluyor. Anahtar başlıktan
 * türetiliyor; aynı başlık ikinci kez eklenirse sonuna sayı ekleniyor.
 */
export function karakterMaddeEkle(
  firmaId: number,
  baslik: string,
  deger: string,
  kullaniciId: number,
): string {
  const kok =
    turkceKatla(baslik)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "madde";

  const varOlan = new Set(karakterGetir(firmaId).keys());
  let alan = OZEL_ONEK + kok;
  for (let i = 2; varOlan.has(alan); i++) alan = `${OZEL_ONEK}${kok}-${i}`;

  db.prepare(
    `INSERT INTO karakter_alanlari (firma_id, alan, baslik, deger, kaynak, guncelleyen_id)
     VALUES (?, ?, ?, ?, 'elle', ?)`,
  ).run(firmaId, alan, baslik.trim().slice(0, 80), deger.trim().slice(0, 4000), kullaniciId);
  return alan;
}

/**
 * Madde silme — yalnız yöneticinin eklediği maddeler.
 *
 * Hazır beş alan silinmiyor; onların boşaltılması zaten satırı kaldırıyor ve
 * ekranda "henüz yazılmadı" olarak duruyorlar. Listeyi kalıcı olarak eksiltmek
 * bir sonraki kişi için anlaşılmaz olurdu.
 */
export function karakterMaddeSil(firmaId: number, alan: string): void {
  if (!alan.startsWith(OZEL_ONEK)) return;
  db.prepare("DELETE FROM karakter_alanlari WHERE firma_id = ? AND alan = ?").run(firmaId, alan);
}

/**
 * Bir karakter alanını yazar. Boş değer satırı siler — boş bir alanı "elle
 * yazıldı" diye kaydetmek, yazılmamış olanı yazılmış göstermek olurdu.
 */
export function karakterYaz(
  firmaId: number,
  alan: string,
  deger: string,
  kullaniciId: number,
  kaynak: "elle" | "cikarim" = "elle",
): void {
  const temiz = deger.trim();
  if (!temiz) {
    /* Hazır alanda boşaltmak satırı siler; ekranda "henüz yazılmadı" olarak
       yerinde durmaya devam eder. Yöneticinin kendi maddesinde silmiyoruz:
       başlık onun emeği, boşaltmak silmek değil — silme ayrı düğmede. */
    if (alan.startsWith(OZEL_ONEK)) {
      db.prepare(
        `UPDATE karakter_alanlari
           SET deger = '', kaynak = 'elle', guncelleme = datetime('now'), guncelleyen_id = ?
         WHERE firma_id = ? AND alan = ?`,
      ).run(kullaniciId, firmaId, alan);
    } else {
      db.prepare("DELETE FROM karakter_alanlari WHERE firma_id = ? AND alan = ?").run(
        firmaId,
        alan,
      );
    }
    return;
  }
  db.prepare(
    `INSERT INTO karakter_alanlari (firma_id, alan, deger, kaynak, guncelleme, guncelleyen_id)
     VALUES (?, ?, ?, ?, datetime('now'), ?)
     ON CONFLICT (firma_id, alan) DO UPDATE SET
       deger = excluded.deger, kaynak = excluded.kaynak,
       guncelleme = excluded.guncelleme, guncelleyen_id = excluded.guncelleyen_id`,
  ).run(firmaId, alan, temiz.slice(0, 4000), kaynak, kullaniciId);
  /* Başlık yalnız eklenirken yazılıyor; düzenleme onu korumalı. */
}

export type BilgiKarti = {
  id: number;
  firma_id: number;
  baslik: string;
  icerik: string;
  kategori: string;
  kaynak: string;
  dayanak: string;
  olusma: string;
  guncelleme: string;
  guncelleyen_ad: string | null;
};

export function bilgiKartlari(firmaId: number): BilgiKarti[] {
  return duzler<BilgiKarti>(
    db
      .prepare(
        `SELECT b.*, u.ad AS guncelleyen_ad FROM bilgi_kartlari b
           LEFT JOIN kullanicilar u ON u.id = b.guncelleyen_id
         WHERE b.firma_id = ? ORDER BY b.kategori, b.baslik`,
      )
      .all(firmaId),
  );
}

export type YeniKart = {
  baslik: string;
  icerik: string;
  kategori: string;
  kaynak?: "elle" | "cikarim";
  dayanak?: string;
};

export function bilgiKartiEkle(firmaId: number, k: YeniKart, kullaniciId: number): number {
  const s = db
    .prepare(
      `INSERT INTO bilgi_kartlari (firma_id, baslik, icerik, kategori, kaynak, dayanak,
                                   guncelleyen_id)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(
      firmaId,
      k.baslik.trim().slice(0, 120),
      k.icerik.trim().slice(0, 4000),
      k.kategori,
      k.kaynak ?? "elle",
      k.dayanak ?? "",
      kullaniciId,
    ) as { id: number };
  return s.id;
}

/** Kart düzenleme. Elle düzenlenen kart artık "elle" sayılır — kaynak yalan söylemesin. */
export function bilgiKartiYaz(
  id: number,
  firmaId: number,
  k: { baslik: string; icerik: string; kategori: string },
  kullaniciId: number,
): void {
  db.prepare(
    `UPDATE bilgi_kartlari
       SET baslik = ?, icerik = ?, kategori = ?, kaynak = 'elle',
           guncelleme = datetime('now'), guncelleyen_id = ?
     WHERE id = ? AND firma_id = ?`,
  ).run(
    k.baslik.trim().slice(0, 120),
    k.icerik.trim().slice(0, 4000),
    k.kategori,
    kullaniciId,
    id,
    firmaId,
  );
}

export function bilgiKartiSil(id: number, firmaId: number): void {
  db.prepare("DELETE FROM bilgi_kartlari WHERE id = ? AND firma_id = ?").run(id, firmaId);
}

export type BilgiOnerisi = {
  id: number;
  firma_id: number;
  tur: string;
  alan: string;
  baslik: string;
  icerik: string;
  kategori: string;
  dayanak: string;
  olusma: string;
};

export function onerileriGetir(firmaId: number): BilgiOnerisi[] {
  return duzler<BilgiOnerisi>(
    db
      .prepare("SELECT * FROM bilgi_onerileri WHERE firma_id = ? ORDER BY tur, id")
      .all(firmaId),
  );
}

export function oneriSayisi(firmaId: number): number {
  const s = db
    .prepare("SELECT COUNT(*) AS n FROM bilgi_onerileri WHERE firma_id = ?")
    .get(firmaId) as { n: number };
  return s.n;
}

export function oneriEkle(
  firmaId: number,
  o: {
    tur: "karakter" | "kart";
    alan?: string;
    baslik?: string;
    icerik: string;
    kategori?: string;
    dayanak?: string;
  },
): number {
  const s = db
    .prepare(
      `INSERT INTO bilgi_onerileri (firma_id, tur, alan, baslik, icerik, kategori, dayanak)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(
      firmaId,
      o.tur,
      o.alan ?? "",
      (o.baslik ?? "").slice(0, 120),
      o.icerik.slice(0, 4000),
      o.kategori ?? "",
      (o.dayanak ?? "").slice(0, 500),
    ) as { id: number };
  return s.id;
}

export function oneriSil(id: number, firmaId: number): void {
  db.prepare("DELETE FROM bilgi_onerileri WHERE id = ? AND firma_id = ?").run(id, firmaId);
}

/**
 * Öneriyi depoya geçirir ve öneriyi siler.
 *
 * Karakter önerisi ilgili alana, kart önerisi yeni bir karta yazılıyor; ikisi
 * de `kaynak = 'cikarim'` damgasıyla, böylece ekranda "çıkarımdan onaylandı"
 * yazabiliyoruz. Onaylanmayan öneri hiçbir yere dokunmuyor.
 */
export function oneriOnayla(id: number, firmaId: number, kullaniciId: number): boolean {
  const oneri = tek<BilgiOnerisi>(
    "SELECT * FROM bilgi_onerileri WHERE id = ? AND firma_id = ?",
    id,
    firmaId,
  );
  if (!oneri) return false;

  if (oneri.tur === "karakter") {
    if (!oneri.alan) return false;
    karakterYaz(firmaId, oneri.alan, oneri.icerik, kullaniciId, "cikarim");
  } else {
    bilgiKartiEkle(
      firmaId,
      {
        baslik: oneri.baslik || oneri.icerik.slice(0, 60),
        icerik: oneri.icerik,
        kategori: oneri.kategori,
        kaynak: "cikarim",
        dayanak: oneri.dayanak,
      },
      kullaniciId,
    );
  }

  oneriSil(id, firmaId);
  return true;
}

export type BilgiOzeti = {
  /** Dolu karakter maddesi sayısı (hazır beşli + yöneticinin eklediği). */
  alan: number;
  kart: number;
  oneri: number;
  sonCikarim: string | null;
};

/**
 * Bir firmanın deposunun doluluğu — operatörün müşteri çekmecesi okuyor.
 *
 * Operatörün sorusu şu: bu müşteri taslak adımına hazır mı? Boş depo, model
 * bağlandığı gün firmayı tanımayan bir taslak demek; kurulum görüşmesinde
 * konuşulacak şey bu.
 */
export function bilgiOzeti(firmaId: number): BilgiOzeti {
  const say = (sql: string): number =>
    (tek<{ n: number }>(sql, firmaId)?.n ?? 0);

  return {
    alan: say("SELECT COUNT(*) AS n FROM karakter_alanlari WHERE firma_id = ? AND deger <> ''"),
    kart: say("SELECT COUNT(*) AS n FROM bilgi_kartlari WHERE firma_id = ?"),
    oneri: say("SELECT COUNT(*) AS n FROM bilgi_onerileri WHERE firma_id = ?"),
    sonCikarim:
      tek<{ olusma: string }>(
        "SELECT olusma FROM bilgi_cikarimlari WHERE firma_id = ? AND hata = '' ORDER BY id DESC LIMIT 1",
        firmaId,
      )?.olusma ?? null,
  };
}

export type Cikarim = {
  id: number;
  baslatan_ad: string | null;
  okunan_mail: number;
  okunan_yanit: number;
  oneri: number;
  model: string;
  hata: string;
  olusma: string;
};

export function cikarimYaz(v: {
  firmaId: number;
  baslatanId: number;
  okunanMail: number;
  okunanYanit: number;
  oneri: number;
  model: string;
  hata?: string;
}): void {
  db.prepare(
    `INSERT INTO bilgi_cikarimlari (firma_id, baslatan_id, okunan_mail, okunan_yanit,
                                    oneri, model, hata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    v.firmaId,
    v.baslatanId,
    v.okunanMail,
    v.okunanYanit,
    v.oneri,
    v.model,
    (v.hata ?? "").slice(0, 300),
  );
}

/** En son çıkarım turu — hatalı da olsa. Ekran "en son ne oldu" diye soruyor. */
export function sonCikarim(firmaId: number): Cikarim | undefined {
  return tek<Cikarim>(
    `SELECT c.id, c.okunan_mail, c.okunan_yanit, c.oneri, c.model, c.hata, c.olusma,
            u.ad AS baslatan_ad
     FROM bilgi_cikarimlari c
       LEFT JOIN kullanicilar u ON u.id = c.baslatan_id
     WHERE c.firma_id = ? ORDER BY c.id DESC LIMIT 1`,
    firmaId,
  );
}

/**
 * Son 24 saatte **başarılı** bir çıkarım oldu mu?
 *
 * Sınır token maliyeti için: depo günde bir kez tazelenir. Hatalı tur sayılmaz;
 * model bir kez patladı diye kullanıcıyı ertesi güne kilitlemek olmaz.
 */
export function bugunCikarimYapildi(firmaId: number): boolean {
  const s = tek<{ n: number }>(
    `SELECT COUNT(*) AS n FROM bilgi_cikarimlari
     WHERE firma_id = ? AND hata = '' AND olusma > datetime('now', '-1 day')`,
    firmaId,
  );
  return (s?.n ?? 0) > 0;
}

/**
 * Çıkarımın okuyacağı derlem.
 *
 * İki kaynak, iki ayrı iş için:
 * - **Giden yanıtlar**: firmanın kendi sesi burada. Karakter bunlardan çıkıyor.
 *   Gönderilemeyenler alınmıyor — gitmemiş bir metin firmanın sesi değil.
 * - **Gelen mailler**: müşterilerin ne sorduğu. Bilgi kartları bunlardan çıkıyor.
 *   Elenenler (bülten, no-reply) hiç girmiyor.
 *
 * Gövdeler burada ham geliyor; imza kırpması çağıran tarafta (`imzaAyir`).
 */
export function cikarimDerlemi(
  firmaId: number,
  sinir: { mail: number; yanit: number },
): {
  yanitlar: { metin: string; konu: string }[];
  mailler: { id: number; konu: string; govde: string; ozet: string; kategori: string | null }[];
} {
  const yanitlar = sorgu<{ metin: string; konu: string }>(
    `SELECT metin, konu FROM yanitlar
     WHERE firma_id = ? AND hata IS NULL ORDER BY id DESC LIMIT ?`,
    firmaId,
    sinir.yanit,
  );
  const mailler = sorgu<{
    id: number;
    konu: string;
    govde: string;
    ozet: string;
    kategori: string | null;
  }>(
    `SELECT id, konu, govde, ozet, kategori FROM mailler
     WHERE firma_id = ? AND elendi IS NULL ORDER BY tarih DESC LIMIT ?`,
    firmaId,
    sinir.mail,
  );
  return { yanitlar, mailler };
}

/**
 * Bir model çağrısının kaydı (token ve kuruş).
 *
 * Kuruş, ortamda birim fiyat tanımlıysa hesaplanıyor; tanımlı değilse **sıfır**
 * yazılıyor ve token yine duruyor. Uydurma bir fiyatla marj hesaplatmaktansa
 * "fiyat girilmemiş" demek doğru: operatör maliyet ekranı zaten varsayımla
 * çalıştığını söylüyor.
 */
export function aiKullanimYaz(v: {
  firmaId: number;
  mailId?: number | null;
  isTuru: string;
  model: string;
  girdiToken: number;
  ciktiToken: number;
  kurus: number;
}): void {
  db.prepare(
    `INSERT INTO ai_kullanim (firma_id, mail_id, is_turu, model, girdi_token, cikti_token, kurus)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    v.firmaId,
    v.mailId ?? null,
    v.isTuru,
    v.model,
    v.girdiToken,
    v.ciktiToken,
    Math.round(v.kurus),
  );
}

/** Operatörün bir firmaya harcadığı zamanı kaydeder (madde 2). */
export function destekKaydiEkle(firmaId: number, dakika: number, konu: string): void {
  db.prepare(
    "INSERT INTO destek_kayitlari (firma_id, dakika, konu) VALUES (?, ?, ?)",
  ).run(firmaId, dakika, konu);
}

export type DestekKaydi = {
  id: number;
  firma_id: number;
  dakika: number;
  konu: string;
  olusma: string;
  firma_ad: string;
};

export function destekKayitlari(firmaId?: number, limit = 50): DestekKaydi[] {
  return duzler<DestekKaydi>(
    db
      .prepare(
        `SELECT d.*, f.ad AS firma_ad FROM destek_kayitlari d
         JOIN firmalar f ON f.id = d.firma_id
         ${firmaId !== undefined ? "WHERE d.firma_id = ?" : ""}
         ORDER BY d.olusma DESC LIMIT ?`,
      )
      .all(...((firmaId !== undefined ? [firmaId, limit] : [limit]) as never[])),
  );
}

/* ── sistem günlüğü ────────────────────────────────────── */

/* "zeka" bilgi deposu çıkarımıyla geldi: modele giden her tur kayda düşüyor —
   müşterinin maillerini bir dil modeline okutan bir işin izsiz kalması olmaz. */
export const GUNLUK_TIPLERI = ["kurulum", "posta", "giris", "hata", "abonelik", "zeka"] as const;
export type GunlukTipi = (typeof GUNLUK_TIPLERI)[number];

export type Gunluk = {
  id: number;
  tip: string;
  mesaj: string;
  firma_id: number | null;
  firma_ad: string | null;
  olusma: string;
};

/**
 * Günlüğe bir satır yazar.
 *
 * Bu bir hata izleyici değil; "dün ne oldu" sorusuna bakılacak yer. O yüzden
 * yalnızca **anlamı olan** olaylar yazılıyor: kutu bağlandı, çekim düştü,
 * abonelik değişti. Her isteği buraya yazmak, önemli satırı görünmez ederdi.
 */
export function gunlukYaz(tip: GunlukTipi, mesaj: string, firmaId?: number | null): void {
  db.prepare("INSERT INTO gunluk (tip, mesaj, firma_id) VALUES (?, ?, ?)").run(
    tip,
    mesaj.slice(0, 500),
    firmaId ?? null,
  );
}

export function gunlukGetir(tip?: string, limit = 200): Gunluk[] {
  const kosul = tip ? "WHERE g.tip = ?" : "";
  const p = tip ? [tip, limit] : [limit];
  return duzler<Gunluk>(
    db
      .prepare(
        `SELECT g.*, f.ad AS firma_ad
         FROM gunluk g LEFT JOIN firmalar f ON f.id = g.firma_id
         ${kosul}
         ORDER BY g.id DESC LIMIT ?`,
      )
      .all(...(p as never[])),
  );
}

/**
 * Firmanın kendi denetim kaydı (madde 11).
 *
 * Operatör ekranı "firmanın yöneticisi de aynı kayıtları görür" diyor; bu
 * fonksiyon o sözün tutulduğu yer. Koşulda `firma_id = ?` var: sistem satırları
 * (firma_id boş) ve başka firmaların satırları buraya hiç girmiyor.
 *
 * Aynı satırlar operatörde de duruyor — müşteriye ayrı, süzülmüş bir kopya
 * gösterilmiyor. Denetim kaydının anlamı iki tarafın aynı şeyi görmesi.
 */
export function firmaGunlugu(firmaId: number, tip?: string, limit = 200): Gunluk[] {
  const kosul = tip ? "AND g.tip = ?" : "";
  const p: unknown[] = tip ? [firmaId, tip, limit] : [firmaId, limit];
  return duzler<Gunluk>(
    db
      .prepare(
        `SELECT g.*, f.ad AS firma_ad
         FROM gunluk g LEFT JOIN firmalar f ON f.id = g.firma_id
         WHERE g.firma_id = ? ${kosul}
         ORDER BY g.id DESC LIMIT ?`,
      )
      .all(...(p as never[])),
  );
}

/**
 * Panele girişi denetim kaydına yazar (madde 11).
 *
 * Oturum açan kod `sunucu/oturum.ts`te ama kural burada: o dosya `next/headers`
 * import ettiği için düz Node'da açılamıyor ve testle çivilenemiyordu. Kayıt
 * kuralı — kimin, hangi firmaya, hangi cümleyle yazıldığı — veri katmanında
 * durunca hem sınanabiliyor hem tek yerde kalıyor.
 */
export function girisKaydiYaz(kullaniciId: number): void {
  const k = kullaniciIdIle(kullaniciId);
  if (!k) return;
  gunlukYaz(
    "giris",
    /* Operatörün girişi firmaya bağlanmıyor: arka ofise girmek müşterinin
       hesabına girmek değil. Müşteri paneline giriş yolu açıldığında o satır
       firma numarasıyla yazılacak — kaydın anlamı orada başlıyor. */
    k.operator === 1 ? `Operatör ${k.eposta} arka ofise girdi` : `${k.eposta} panele girdi`,
    k.firma_id,
  );
}

export function firmaGunlukSayilari(firmaId: number): Record<string, number> {
  const satirlar = sorgu<{ tip: string; adet: number }>(
    "SELECT tip, COUNT(*) AS adet FROM gunluk WHERE firma_id = ? GROUP BY tip",
    firmaId,
  );
  const cikti: Record<string, number> = {};
  for (const s of satirlar) cikti[s.tip] = s.adet;
  return cikti;
}

export function gunlukSayilari(): Record<string, number> {
  const satirlar = db
    .prepare("SELECT tip, COUNT(*) AS adet FROM gunluk GROUP BY tip")
    .all() as unknown as { tip: string; adet: number }[];
  const cikti: Record<string, number> = {};
  for (const s of satirlar) cikti[s.tip] = s.adet;
  return cikti;
}

/* ══════════════════════════════════════════════════════════
   Genel bakış sayıları
   ══════════════════════════════════════════════════════════ */

/**
 * Bir mailin "geciktiği" kabul edilen süre.
 *
 * Yapay zekâya bağlı değil: mailin kendi tarihinden hesaplanıyor. Kapanmış ya
 * da yanıtlanmış mail gecikmiş sayılmaz — iş bitmiştir.
 */
export const GECIKME_SAAT = 24;

export function durumDagilimi(firmaId: number): Record<string, number> {
  const satirlar = db
    .prepare(
      `SELECT durum, COUNT(*) AS adet FROM mailler
       WHERE firma_id = ? AND elendi IS NULL GROUP BY durum`,
    )
    .all(firmaId) as unknown as { durum: string; adet: number }[];
  const cikti: Record<string, number> = {};
  for (const d of DURUMLAR) cikti[d] = 0;
  for (const s of satirlar) cikti[s.durum] = s.adet;
  return cikti;
}

/** Kategorisi olmayanlar `kategorisiz` anahtarında toplanıyor. */
export function kategoriDagilimi(firmaId: number): Record<string, number> {
  const satirlar = db
    .prepare(
      `SELECT COALESCE(kategori, 'kategorisiz') AS k, COUNT(*) AS adet FROM mailler
       WHERE firma_id = ? AND elendi IS NULL GROUP BY k`,
    )
    .all(firmaId) as unknown as { k: string; adet: number }[];
  const cikti: Record<string, number> = { kategorisiz: 0 };
  for (const k of KATEGORILER) cikti[k] = 0;
  for (const s of satirlar) cikti[s.k] = s.adet;
  return cikti;
}

/** Açık işlerden GECIKME_SAAT'ten uzun süredir bekleyenler. */
export function gecikenSay(firmaId: number): number {
  const s = db
    .prepare(
      `SELECT COUNT(*) AS n FROM mailler
       WHERE firma_id = ? AND elendi IS NULL AND durum IN ('yeni','islemde')
         AND tarih <= datetime('now', ?)`,
    )
    .get(firmaId, `-${GECIKME_SAAT} hours`) as { n: number };
  return s.n;
}

/** Son 24 saatte kutuya düşen ve kuraldan geçen mailler. */
export function bugunGelen(firmaId: number): number {
  const s = db
    .prepare(
      `SELECT COUNT(*) AS n FROM mailler
       WHERE firma_id = ? AND elendi IS NULL AND olusma >= datetime('now', '-1 day')`,
    )
    .get(firmaId) as { n: number };
  return s.n;
}

/** Son 24 saatte gönderilen yanıtlar — "bugün ne yaptık" sorusu. */
export function bugunYanit(firmaId: number): number {
  const s = db
    .prepare(
      `SELECT COUNT(*) AS n FROM yanitlar
       WHERE firma_id = ? AND hata IS NULL AND olusma >= datetime('now', '-1 day')`,
    )
    .get(firmaId) as { n: number };
  return s.n;
}

/* ══════════════════════════════════════════════════════════
   VIP gönderenler
   ══════════════════════════════════════════════════════════ */

/**
 * "Bu adresten gelen öne çıksın" işareti.
 *
 * Adresin kendisine bağlı, maile değil: aynı kişiden gelen her mail VIP olur,
 * gelecekte gelecekler dahil. Firma sınırı birincil anahtarın içinde.
 */
export function vipYaz(firmaId: number, adres: string, vip: boolean, ekleyen: number): void {
  const temiz = adres.trim().toLowerCase();
  if (vip) {
    db.prepare(
      `INSERT INTO vip_gonderenler (firma_id, adres, ekleyen) VALUES (?, ?, ?)
       ON CONFLICT(firma_id, adres) DO NOTHING`,
    ).run(firmaId, temiz, ekleyen);
  } else {
    db.prepare("DELETE FROM vip_gonderenler WHERE firma_id = ? AND adres = ?").run(
      firmaId,
      temiz,
    );
  }
}

export function vipListesi(firmaId: number): string[] {
  return (
    db
      .prepare("SELECT adres FROM vip_gonderenler WHERE firma_id = ? ORDER BY adres")
      .all(firmaId) as unknown as { adres: string }[]
  ).map((s) => s.adres);
}

/* ══════════════════════════════════════════════════════════
   Operatör araması (madde 9)

   Dört kaynakta birden arıyor: firma, posta kutusu, destek talebi ve demo
   talebi. Tek uçtan aramanın sebebi, operatörün elinde çoğu zaman yalnız bir
   ipucu olması — bir adres, bir firma adı, bir konu. Hangi ekranda aranacağını
   bilmek zorunda kalmamalı.

   LIKE jokerleri kaçırılıyor: "%"" yazan biri bütün tabloyu getirmesin.
   ══════════════════════════════════════════════════════════ */

export type AramaSonucu = {
  tur: "firma" | "kutu" | "ticket" | "talep";
  id: number;
  baslik: string;
  alt: string;
  yol: string;
};

function likeKacir(metin: string): string {
  return metin.replace(/[\%_]/g, (k) => "\\" + k);
}

export function operatorArama(metin: string, limit = 8): AramaSonucu[] {
  const q = metin.trim();
  if (q.length < 2) return [];
  const k = `%${likeKacir(q)}%`;
  const cikti: AramaSonucu[] = [];

  const firmalar = db
    .prepare(
      `SELECT id, ad, alan_adi, plan FROM firmalar
       WHERE ad LIKE ? ESCAPE '\\' OR alan_adi LIKE ? ESCAPE '\\'
       ORDER BY ad COLLATE NOCASE LIMIT ?`,
    )
    .all(k, k, limit) as { id: number; ad: string; alan_adi: string; plan: string }[];
  for (const f of firmalar) {
    cikti.push({
      tur: "firma",
      id: f.id,
      baslik: f.ad,
      alt: `${f.alan_adi} · ${f.plan}`,
      yol: `/operator/musteriler?acik=${f.id}`,
    });
  }

  const kutular = db
    .prepare(
      `SELECT k.id, k.adres, k.durum, f.id AS firma_id, f.ad AS firma
       FROM kutular k JOIN firmalar f ON f.id = k.firma_id
       WHERE k.adres LIKE ? ESCAPE '\\' OR k.imap_sunucu LIKE ? ESCAPE '\\'
       ORDER BY k.adres COLLATE NOCASE LIMIT ?`,
    )
    .all(k, k, limit) as {
    id: number;
    adres: string;
    durum: string;
    firma_id: number;
    firma: string;
  }[];
  for (const x of kutular) {
    cikti.push({
      tur: "kutu",
      id: x.id,
      baslik: x.adres,
      alt: `${x.firma} · ${x.durum}`,
      yol: `/operator/saglik?acik=${x.firma_id}`,
    });
  }

  const ticketlar = db
    .prepare(
      `SELECT t.id, t.konu, t.durum, f.ad AS firma FROM ticketlar t
       JOIN firmalar f ON f.id = t.firma_id
       WHERE t.konu LIKE ? ESCAPE '\\'
          OR EXISTS (SELECT 1 FROM ticket_mesajlari m
                      WHERE m.ticket_id = t.id AND m.metin LIKE ? ESCAPE '\\')
       ORDER BY t.guncelleme DESC LIMIT ?`,
    )
    .all(k, k, limit) as { id: number; konu: string; durum: string; firma: string }[];
  for (const t of ticketlar) {
    cikti.push({
      tur: "ticket",
      id: t.id,
      baslik: t.konu,
      alt: `${t.firma} · ${TICKET_DURUM_AD[t.durum] ?? t.durum}`,
      yol: `/operator/ticketlar?t=${t.id}&suzgec=tum`,
    });
  }

  const talepler = db
    .prepare(
      `SELECT id, ad, firma, eposta, durum FROM talepler
       WHERE ad LIKE ? ESCAPE '\\' OR firma LIKE ? ESCAPE '\\' OR eposta LIKE ? ESCAPE '\\'
       ORDER BY olusma DESC LIMIT ?`,
    )
    .all(k, k, k, limit) as {
    id: number;
    ad: string;
    firma: string;
    eposta: string;
    durum: string;
  }[];
  for (const t of talepler) {
    cikti.push({
      tur: "talep",
      id: t.id,
      baslik: t.firma || t.ad,
      alt: `${t.ad} · ${t.eposta}`,
      yol: "/operator/talepler",
    });
  }

  return cikti;
}

/* ══════════════════════════════════════════════════════════
   Geri doldurmalar — dosyanın SONUNDA

   Bunlar aşağıdaki `konusmaCoz`u çağırıyor, o da bölümünün başındaki
   `const KONUSMA_PENCERE_GUN`u okuyor. Yukarıdan çağrılınca sabit henüz
   tanımlı olmuyor ve "Cannot access ... before initialization" ile patlıyordu;
   hata yutuluyor, geri doldurma her açılışta sessizce başarısız oluyordu.
   `function` bildirimleri yukarı taşınır, `const` taşınmaz.
   ══════════════════════════════════════════════════════════ */
konusmalariGeriDoldur();
ozetleriTazele();

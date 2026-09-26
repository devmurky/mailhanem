/**
 * Veri dışa aktarma (madde 12).
 *
 * İki şey çiviliyor. Biri **doğru CSV**: mail gövdesi tırnak, noktalı virgül
 * ve satır sonu taşır; kaçırılan bir tırnak dosyanın geri kalanını kaydırır ve
 * müşteri bunu ancak Excel'de açınca fark eder. Öteki **sızıntı olmaması**:
 * kutu parolası kasadan çıkıp dosyaya girmemeli ve bir firmanın kopyasında
 * başka firmanın maili görünmemeli.
 */
import { strict as assert } from "node:assert";
import { randomBytes } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* Modul **dinamik** yukleniyor: statik import, asagidaki DB_YOLU satiri
   calismadan db.ts'i acar ve testler gercek veritabanina baglanirdi. */

describe("CSV biçimi", () => {
  test("sade hücre tırnaklanmıyor", () => {
    assert.equal(a.csvHucre("Merhaba"), "Merhaba");
    assert.equal(a.csvHucre(42), "42");
    assert.equal(a.csvHucre(null), "");
    assert.equal(a.csvHucre(undefined), "");
  });

  test("ayraç, virgül, sekme ve satır sonu tırnağa alınıyor", () => {
    assert.equal(a.csvHucre("a;b"), '"a;b"');
    assert.equal(a.csvHucre("a,b"), '"a,b"');
    assert.equal(a.csvHucre("a\tb"), '"a\tb"');
    assert.equal(a.csvHucre("iki\nsatır"), '"iki\nsatır"');
  });

  test("tırnak ikileniyor — kaçırılan tırnak dosyanın kalanını kaydırır", () => {
    assert.equal(a.csvHucre('o "dedi"'), '"o ""dedi"""');
  });

  test("dosya BOM ile başlıyor ve satırlar CRLF — Excel böyle istiyor", () => {
    const cikti = a.csvYap(["a", "b"], [["1", "2"]]);
    assert.ok(cikti.startsWith("﻿"), "BOM yok");
    assert.equal(cikti, "﻿a;b\r\n1;2\r\n");
  });

  test("Türkçe karakterler olduğu gibi kalıyor", () => {
    assert.ok(a.csvYap(["konu"], [["Şubat teklifi — ığdır"]]).includes("Şubat teklifi — ığdır"));
  });
});

/* ── veritabanı tarafı ───────────────────────────────────── */

const klasor = mkdtempSync(join(tmpdir(), "mailhanem-aktar-"));
process.env.DB_YOLU = join(klasor, "deneme.db");
process.env.MAILHANEM_ANAHTAR = randomBytes(32).toString("base64");
Object.assign(process.env, { NODE_ENV: "production" });

type DB = typeof import("../sunucu/db.ts");
type Aktar = typeof import("../sunucu/disaAktar.ts");
type Kasa = typeof import("../sunucu/kasa.ts");
let d: DB;
let a: Aktar;
let kasa: Kasa;
let firma = 0, digerFirma = 0, kisi = 0, kutu = 0, ticket = 0;

before(async () => {
  d = await import("../sunucu/db.ts");
  a = await import("../sunucu/disaAktar.ts");
  kasa = await import("../sunucu/kasa.ts");

  const firmaAc = (ad: string, alan: string) =>
    (d.db
      .prepare("INSERT INTO firmalar (ad, alan_adi) VALUES (?, ?) RETURNING id")
      .get(ad, alan) as { id: number }).id;

  firma = firmaAc("Arkun Mobilya", "arkunmobilya.com");
  digerFirma = firmaAc("Başka Ltd", "baska.com");

  kisi = (d.db
    .prepare("INSERT INTO kullanicilar (firma_id, eposta, ad, rol) VALUES (?, ?, ?, ?) RETURNING id")
    .get(firma, "ayse@arkunmobilya.com", "Ayşe Demir", "sahip") as { id: number }).id;

  const kutuAc = (firmaId: number, adres: string) =>
    d.kutuEkle({
      firma_id: firmaId, adres, saglayici: "cPanel",
      imap_sunucu: "imap.turhost.com", imap_port: 993, smtp_sunucu: "smtp.turhost.com",
      smtp_port: 465, kullanici_adi: adres,
      /* Parolanın kasadan geçmiş hâli: dosyaya sızmadığını denemek için. */
      parola_sifreli: kasa.zarfla("cok-gizli-parola"),
    });

  kutu = kutuAc(firma, "info@arkunmobilya.com");
  const digerKutu = kutuAc(digerFirma, "info@baska.com");

  d.mailEkle({
    kutu_id: kutu, firma_id: firma, mesaj_kimlik: "<a1@ornek.com>", uid: null,
    gonderen_ad: "Ayça Tuncel", gonderen: "ayca@ornek.com",
    konu: 'Teklif; "acil" mi?', ozet: "kısa özet",
    govde: 'Merhaba,\n\nFiyat "net" mi?\nSaygılar;\nAyça',
    tarih: "2026-09-20 09:00:00", elendi: null, eleme_sebep: "", konusma: "<a1@ornek.com>",
  });

  d.mailEkle({
    kutu_id: digerKutu, firma_id: digerFirma, mesaj_kimlik: "<b1@ornek.com>", uid: null,
    gonderen_ad: "", gonderen: "biri@baska.com", konu: "Başka firmanın maili", ozet: "",
    govde: "görünmemeli", tarih: "2026-09-21 09:00:00", elendi: null, eleme_sebep: "",
    konusma: "<b1@ornek.com>",
  });

  ticket = (d.db
    .prepare(
      `INSERT INTO ticketlar (firma_id, acan_id, konu, kategori, oncelik, durum)
       VALUES (?, ?, ?, 'soru', 'normal', 'acik') RETURNING id`,
    )
    .get(firma, kisi, "Kutu bağlanmıyor") as { id: number }).id;

  const mesajEkle = (metin: string, operator: number) =>
    d.db
      .prepare(
        `INSERT INTO ticket_mesajlari (ticket_id, yazan_id, operator, metin)
         VALUES (?, ?, ?, ?)`,
      )
      .run(ticket, operator ? null : kisi, operator, metin);

  mesajEkle("Şifreyi girdim ama bağlanmadı.", 0);
  mesajEkle("Port 993 mü? Bir de uygulama parolası deneyin.", 1);
});

after(() => {
  d.db.close();
  rmSync(klasor, { recursive: true, force: true });
});

describe("mail kopyası", () => {
  test("yalnız kendi firmasının maili çıkıyor", () => {
    const satirlar = a.mailSatirlari(firma);
    assert.equal(satirlar.length, 1);
    assert.ok(!JSON.stringify(satirlar).includes("Başka firmanın maili"));
  });

  test("gövde de dosyada — eksik kopya kopya değildir", () => {
    const csv = a.csvYap(a.MAIL_BASLIKLARI, a.mailSatirlari(firma));
    assert.ok(csv.includes('Fiyat ""net"" mi?'), "gövde yok ya da tırnak kaçtı");
    assert.ok(csv.includes("info@arkunmobilya.com"), "kutu adresi yok");
  });

  test("başlık satırı sütun sayısıyla uyuşuyor", () => {
    const satirlar = a.mailSatirlari(firma);
    assert.ok(satirlar.every((s) => s.length === a.MAIL_BASLIKLARI.length));
  });
});

describe("ticket kopyası", () => {
  test("yazışma tek hücrede, mesaj sayısı doğru", () => {
    const satirlar = a.ticketSatirlari(firma);
    assert.equal(satirlar.length, 1);

    const satir = satirlar[0] ?? [];
    assert.equal(satir.length, a.TICKET_BASLIKLARI.length);
    assert.equal(satir[a.TICKET_BASLIKLARI.indexOf("mesaj_sayisi")], 2);

    const yazisma = String(satir[a.TICKET_BASLIKLARI.indexOf("yazisma")]);
    assert.ok(yazisma.includes("Şifreyi girdim"));
    /* Operatörün yazdığı mesaj kimin olduğunu söylüyor. */
    assert.ok(yazisma.includes("Mailhanem:"));
  });
});

describe("tam kopya", () => {
  test("kutu parolası dosyaya girmiyor", () => {
    const firmaKaydi = d.firmaGetir(firma);
    assert.ok(firmaKaydi);
    const metin = JSON.stringify(a.tamKopya(firma, firmaKaydi));

    assert.ok(!metin.includes("parola_sifreli"), "parola sütunu dosyada");
    assert.ok(!metin.includes("cok-gizli-parola"), "parolanın kendisi dosyada");
  });

  test("künye ne olmadığını da yazıyor", () => {
    const firmaKaydi = d.firmaGetir(firma);
    assert.ok(firmaKaydi);
    const kopya = a.tamKopya(firma, firmaKaydi) as {
      _kunye: { disarida: string[]; kapsam: string[] };
      mailler: unknown[];
    };

    assert.ok(kopya._kunye.disarida.some((x) => x.includes("parola")));
    assert.ok(kopya._kunye.kapsam.length > 0);
    assert.equal(kopya.mailler.length, 1);
  });

  test("başka firmanın satırı hiçbir bölümde yok", () => {
    const firmaKaydi = d.firmaGetir(firma);
    assert.ok(firmaKaydi);
    assert.ok(!JSON.stringify(a.tamKopya(firma, firmaKaydi)).includes("baska.com"));
  });
});

describe("dosya adı", () => {
  test("firma ve tarih taşıyor", () => {
    const firmaKaydi = d.firmaGetir(firma);
    assert.ok(firmaKaydi);
    const ad = a.dosyaAdi(firmaKaydi, "mailler", "csv");

    assert.ok(ad.startsWith("mailhanem-arkunmobilya-com-mailler-"));
    assert.ok(ad.endsWith(".csv"));
  });

  test("alan adı yoksa firma adından slug üretiliyor", () => {
    const ad = a.dosyaAdi(
      { id: 9, ad: "Vadi Mobilya", alan_adi: "" } as never,
      "tum-veri",
      "json",
    );
    assert.ok(ad.startsWith("mailhanem-vadi-mobilya-tum-veri-"));
  });
});

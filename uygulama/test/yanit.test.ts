/**
 * Mail yanıtlama.
 *
 * İki soru var. Birincisi metin: konu "Re:" ile iki kez etiketleniyor mu,
 * alıntı doğru kuruluyor mu. İkincisi ve önemlisi **kimlik**: yanıt gerçekten
 * müşterinin kutusundan mı çıkıyor, zincir başlıkları gidiyor mu. İkincisi
 * sahte bir SMTP sunucusuyla sınanıyor.
 */
import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { createServer, type Server, type Socket } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const klasor = mkdtempSync(join(tmpdir(), "mailhanem-yanit-"));
process.env.DB_YOLU = join(klasor, "deneme.db");
process.env.MAILHANEM_ANAHTAR = randomBytes(32).toString("base64");
Object.assign(process.env, { NODE_ENV: "production" });

let d: typeof import("../sunucu/db.ts");
let y: typeof import("../sunucu/posta/yanit.ts");
let kasa: typeof import("../sunucu/kasa.ts");

const gelenler: string[] = [];
let sunucu: Server;
let port = 0;

function sahteSmtp(): Promise<void> {
  sunucu = createServer((soket: Socket) => {
    let veriModu = false;
    let govde = "";
    soket.write("220 sahte SMTP\r\n");
    soket.on("data", (parca) => {
      for (const satir of parca.toString("utf8").split("\r\n")) {
        if (veriModu) {
          if (satir === ".") {
            veriModu = false;
            gelenler.push(govde);
            govde = "";
            soket.write("250 OK\r\n");
          } else govde += satir + "\n";
          continue;
        }
        if (!satir) continue;
        const k = satir.slice(0, 4).toUpperCase();
        if (k === "EHLO" || k === "HELO") soket.write("250 sahte\r\n");
        else if (k === "DATA") {
          veriModu = true;
          soket.write("354 Gonder\r\n");
        } else if (k === "QUIT") {
          soket.write("221 Hosca kal\r\n");
          soket.end();
        } else soket.write("250 OK\r\n");
      }
    });
    soket.on("error", () => {});
  });
  return new Promise((coz) =>
    sunucu.listen(0, "127.0.0.1", () => {
      const a = sunucu.address();
      port = typeof a === "object" && a ? a.port : 0;
      coz();
    }),
  );
}

/** Quoted-printable çözücü — testin gövdeyi okuyabilmesi için. */
function qpCoz(ham: string): string {
  const duz = ham.replace(/=\n/g, "");
  const bayt = Buffer.from(
    Array.from(duz.replace(/=([0-9A-F]{2})/g, (_, k: string) => String.fromCharCode(parseInt(k, 16)))).map(
      (c) => c.charCodeAt(0) & 0xff,
    ),
  );
  return bayt.toString("utf8");
}

let firmaId = 0;
let kutuId = 0;
let mailId = 0;

before(async () => {
  d = await import("../sunucu/db.ts");
  y = await import("../sunucu/posta/yanit.ts");
  kasa = await import("../sunucu/kasa.ts");
  await sahteSmtp();

  firmaId = (d.db
    .prepare("INSERT INTO firmalar (ad, alan_adi) VALUES (?, ?) RETURNING id")
    .get("Arkun Mobilya", "arkunmobilya.com") as { id: number }).id;

  kutuId = d.kutuEkle({
    firma_id: firmaId,
    adres: "info@arkunmobilya.com",
    saglayici: "cPanel",
    imap_sunucu: "imap.ornek.com",
    imap_port: 993,
    smtp_sunucu: "127.0.0.1",
    smtp_port: port,
    kullanici_adi: "info@arkunmobilya.com",
    parola_sifreli: kasa.zarfla("gizli-parola"),
  });

  d.mailEkle({
    kutu_id: kutuId,
    firma_id: firmaId,
    mesaj_kimlik: "<musteri-1@teknoyapi.com.tr>",
    uid: null,
    gonderen_ad: "Murat Şen",
    gonderen: "murat@teknoyapi.com.tr",
    konu: "Toplu alım talebi",
    ozet: "40 adet koltuk",
    govde: "Merhaba,\n\n40 adet koltuk için fiyat alabilir miyim?\n\nMurat",
    tarih: "2026-09-11 09:12:00",
    elendi: null,
    eleme_sebep: "",
  });
  mailId = (d.db
    .prepare("SELECT id FROM mailler WHERE mesaj_kimlik = ?")
    .get("<musteri-1@teknoyapi.com.tr>") as { id: number }).id;
});

after(async () => {
  await new Promise<void>((coz) => sunucu.close(() => coz()));
  d.db.close();
  rmSync(klasor, { recursive: true, force: true });
});

describe("yanıt metni", () => {
  test("konu iki kez Re: ile etiketlenmez", () => {
    assert.equal(y.yanitKonusu("Toplu alım talebi"), "Re: Toplu alım talebi");
    assert.equal(y.yanitKonusu("Re: Toplu alım"), "Re: Toplu alım");
    assert.equal(y.yanitKonusu("RE: Toplu alım"), "RE: Toplu alım");
    /* Türkçe istemcilerin kullandığı "Ynt:" de yeniden etiketlenmemeli. */
    assert.equal(y.yanitKonusu("Ynt: Toplu alım"), "Ynt: Toplu alım");
    assert.equal(y.yanitKonusu("   "), "Re: (konu yok)");
  });

  test("alıntı her satırı > ile işaretler", () => {
    const a = y.alintila({
      gonderen_ad: "Murat Şen",
      gonderen: "murat@teknoyapi.com.tr",
      tarih: "2026-09-11 09:12:00",
      govde: "birinci satır\nikinci satır",
    });
    assert.ok(a.includes("Murat Şen yazdı:"));
    assert.ok(a.includes("> birinci satır"));
    assert.ok(a.includes("> ikinci satır"));
  });

  test("gövdesi olmayan mail alıntılanmaz", () => {
    const a = y.alintila({
      gonderen_ad: "",
      gonderen: "x@y.com",
      tarih: "2026-09-11 09:12:00",
      govde: "",
    });
    assert.equal(a, "");
  });
});

describe("gönderim", () => {
  test("yanıt müşterinin kutusundan, zincir başlıklarıyla çıkar", async () => {
    const kutu = d.kutuGetir(kutuId);
    const mail = d.mailGetir(mailId, firmaId);
    assert.ok(kutu && mail);

    const sonuc = await y.yanitGonder(kutu, mail, "Merhaba Murat Bey, fiyat ektedir.", "Enes Işhak");
    assert.equal(sonuc.tamam, true, sonuc.hata ?? "");
    assert.equal(gelenler.length, 1);

    const ham = gelenler[0] ?? "";
    /* From Mailhanem değil, firmanın kendi kutusu olmalı. */
    assert.match(ham, /From: .*<info@arkunmobilya\.com>/);
    assert.ok(!ham.includes("mailhanem"), "Mailhanem adresi görünmemeli");
    assert.match(ham, /To: murat@teknoyapi\.com\.tr/);
    assert.match(ham, /In-Reply-To: <musteri-1@teknoyapi\.com\.tr>/);
    assert.match(ham, /References: <musteri-1@teknoyapi\.com\.tr>/);

    const govde = qpCoz(ham);
    assert.ok(govde.includes("Merhaba Murat Bey"));
    assert.ok(govde.includes("> 40 adet koltuk"), "alıntı gitmeli");
  });

  test("alıntı kapatılabilir", async () => {
    const kutu = d.kutuGetir(kutuId);
    const mail = d.mailGetir(mailId, firmaId);
    assert.ok(kutu && mail);

    await y.yanitGonder(kutu, mail, "Kısa cevap.", "Enes Işhak", false);
    const govde = qpCoz(gelenler[gelenler.length - 1] ?? "");
    assert.ok(govde.includes("Kısa cevap."));
    /* Ham mailde "<info@...>" gibi başlıklar da ">" taşır; alıntı bloğuna bakıyoruz. */
    assert.ok(!govde.includes("> 40 adet koltuk"), "alıntı eklenmemeli");
    assert.ok(!govde.includes("yazdı:"), "alıntı başlığı da olmamalı");
  });

  test("SMTP yazılmamış kutudan yanıt gönderilmez", async () => {
    const smtpsiz = d.kutuEkle({
      firma_id: firmaId, adres: "eski@arkunmobilya.com", saglayici: "",
      imap_sunucu: "imap.ornek.com", imap_port: 993,
      smtp_sunucu: "", smtp_port: 465,
      kullanici_adi: "", parola_sifreli: kasa.zarfla("x"),
    });
    const kutu = d.kutuGetir(smtpsiz);
    const mail = d.mailGetir(mailId, firmaId);
    assert.ok(kutu && mail);

    const sonuc = await y.yanitGonder(kutu, mail, "deneme", "Enes");
    assert.equal(sonuc.tamam, false);
    assert.match(sonuc.hata ?? "", /SMTP sunucusu tanımlı değil/);
  });

  test("parolası olmayan kutudan yanıt gönderilmez", async () => {
    const parolasiz = d.kutuEkle({
      firma_id: firmaId, adres: "yeni@arkunmobilya.com", saglayici: "",
      imap_sunucu: "imap.ornek.com", imap_port: 993,
      smtp_sunucu: "127.0.0.1", smtp_port: port,
      kullanici_adi: "", parola_sifreli: null,
    });
    const kutu = d.kutuGetir(parolasiz);
    const mail = d.mailGetir(mailId, firmaId);
    assert.ok(kutu && mail);

    const sonuc = await y.yanitGonder(kutu, mail, "deneme", "Enes");
    assert.equal(sonuc.tamam, false);
    assert.match(sonuc.hata ?? "", /parolası kayıtlı değil/);
  });
});

describe("yanıt kaydı", () => {
  test("gönderilen ve gönderilemeyen yanıtlar ayrı ayrı yazılır", () => {
    d.yanitEkle({
      mail_id: mailId, firma_id: firmaId, kullanici_id: null,
      kime: "murat@teknoyapi.com.tr", konu: "Re: Toplu alım talebi",
      metin: "giden", mesaj_kimlik: "<giden-1@arkunmobilya.com>", hata: null,
    });
    d.yanitEkle({
      mail_id: mailId, firma_id: firmaId, kullanici_id: null,
      kime: "murat@teknoyapi.com.tr", konu: "Re: Toplu alım talebi",
      metin: "giden değil", mesaj_kimlik: "", hata: "bağlantı reddedildi",
    });

    const kayitlar = d.mailYanitlari(mailId, firmaId);
    assert.equal(kayitlar.length, 2);
    assert.equal(kayitlar[0]?.hata, null);
    assert.equal(kayitlar[1]?.hata, "bağlantı reddedildi");
  });

  test("başka firmanın yanıtları okunamaz", () => {
    assert.equal(d.mailYanitlari(mailId, firmaId + 99).length, 0);
  });
});

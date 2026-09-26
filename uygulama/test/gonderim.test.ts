/**
 * Giden posta.
 *
 * Sahte bir SMTP sunucusu kurulup gerçekten konuşuluyor: nodemailer'ın
 * yapılandırması doğru mu, mail hangi adrese hangi konuyla gidiyor, ve
 * **hata fırlatıp çağıran akışı kırıyor mu.** Sonuncusu önemli: giriş akışı
 * bir posta sunucusu yüzünden yarıda kalmamalı.
 */
import { strict as assert } from "node:assert";
import { after, before, describe, test } from "node:test";
import { createServer, type Server, type Socket } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const klasor = mkdtempSync(join(tmpdir(), "mailhanem-posta-"));
process.env.DB_YOLU = join(klasor, "deneme.db");
Object.assign(process.env, { NODE_ENV: "production" });

let d: typeof import("../sunucu/db.ts");
let g: typeof import("../sunucu/posta/gonderim.ts");

/** Kabul edilen mailler; her biri DATA aşamasında toplanan ham metin. */
const gelenler: string[] = [];
let sunucu: Server;
let port = 0;

/**
 * Konuşabilecek kadar SMTP. AUTH ve STARTTLS duyurulmuyor; nodemailer
 * kimlik doğrulaması istemediğimiz için doğrudan MAIL FROM'a geçiyor.
 */
function sahteSmtp(): Promise<number> {
  sunucu = createServer((soket: Socket) => {
    let veriModu = false;
    let govde = "";

    soket.write("220 sahte.mailhanem.test SMTP\r\n");
    soket.on("data", (parca) => {
      for (const satir of parca.toString("utf8").split("\r\n")) {
        if (veriModu) {
          if (satir === ".") {
            veriModu = false;
            gelenler.push(govde);
            govde = "";
            soket.write("250 OK teslim alindi\r\n");
          } else if (satir.length || govde) {
            govde += satir + "\n";
          }
          continue;
        }
        if (!satir) continue;
        const komut = satir.slice(0, 4).toUpperCase();
        if (komut === "EHLO" || komut === "HELO") soket.write("250 sahte.mailhanem.test\r\n");
        else if (komut === "MAIL" || komut === "RCPT") soket.write("250 OK\r\n");
        else if (komut === "DATA") {
          veriModu = true;
          soket.write("354 Gonder, nokta ile bitir\r\n");
        } else if (komut === "QUIT") {
          soket.write("221 Hosca kal\r\n");
          soket.end();
        } else soket.write("250 OK\r\n");
      }
    });
    soket.on("error", () => {});
  });

  return new Promise((coz) => {
    sunucu.listen(0, "127.0.0.1", () => {
      const adres = sunucu.address();
      port = typeof adres === "object" && adres ? adres.port : 0;
      coz(port);
    });
  });
}

/** Quoted-printable çözücü — yalnız testin okuyabilmesi için, kaba ama yeterli. */
function qpCoz(ham: string): string {
  return ham
    .replace(/=\n/g, "")
    .replace(/=([0-9A-F]{2})/g, (_, k: string) => String.fromCharCode(parseInt(k, 16)));
}

before(async () => {
  d = await import("../sunucu/db.ts");
  g = await import("../sunucu/posta/gonderim.ts");
  await sahteSmtp();
});

after(async () => {
  await new Promise<void>((coz) => sunucu.close(() => coz()));
  d.db.close();
  rmSync(klasor, { recursive: true, force: true });
});

function smtpKapat(): void {
  delete process.env.SMTP_SUNUCU;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_GUVENLI;
  delete process.env.SMTP_KULLANICI;
}

function smtpAc(p: number): void {
  process.env.SMTP_SUNUCU = "127.0.0.1";
  process.env.SMTP_PORT = String(p);
  process.env.SMTP_GUVENLI = "0";
  process.env.SMTP_GONDEREN = "Mailhanem <bildirim@mailhanem.test>";
  delete process.env.SMTP_KULLANICI;
}

describe("yapılandırma", () => {
  test("SMTP_SUNUCU boşsa posta kapalıdır", () => {
    smtpKapat();
    assert.equal(g.postaAcikMi(), false);
    assert.equal(g.postaAyari(), undefined);
    assert.equal(g.gonderimDurumu().acik, false);
  });

  test("465 örtük TLS, 587 STARTTLS sayılır", () => {
    process.env.SMTP_SUNUCU = "posta.ornek.com";
    process.env.SMTP_PORT = "465";
    delete process.env.SMTP_GUVENLI;
    assert.equal(g.postaAyari()?.guvenli, true);

    process.env.SMTP_PORT = "587";
    assert.equal(g.postaAyari()?.guvenli, false);

    /* Elle verilen ayar porttan önce gelir. */
    process.env.SMTP_GUVENLI = "1";
    assert.equal(g.postaAyari()?.guvenli, true);
    smtpKapat();
  });

  test("bozuk port varsayılana düşer", () => {
    process.env.SMTP_SUNUCU = "posta.ornek.com";
    process.env.SMTP_PORT = "bilmemne";
    assert.equal(g.postaAyari()?.port, 587);
    smtpKapat();
  });
});

describe("gönderim", () => {
  test("SMTP kapalıyken patlamaz ve 'gönderdim' demez", async () => {
    smtpKapat();
    const s = await g.gonder({ kime: "ayse@ornek.com", konu: "Deneme", metin: "merhaba" });
    assert.equal(s.gercek, false);
    assert.equal(s.hata, undefined, "yapılandırma eksikliği bir hata değil");
  });

  test("SMTP açıkken mail gerçekten teslim edilir", async () => {
    smtpAc(port);
    const s = await g.gonder({
      kime: "ayse@ornek.com",
      konu: "Giriş bağlantınız",
      metin: "Bağlantı: http://127.0.0.1:3100/giris/dogrula?jeton=abc",
    });
    assert.equal(s.gercek, true, s.hata ?? "");
    assert.equal(gelenler.length, 1);

    const ham = gelenler[0] ?? "";
    assert.match(ham, /To: ayse@ornek\.com/);
    assert.match(ham, /From: Mailhanem <bildirim@mailhanem\.test>/);
    assert.ok(/Subject:.+/.test(ham), "konu başlığı olmalı");
    /* Gövde quoted-printable kodlanıyor ("=" → "=3D"); çözmeden bakmak yanıltır. */
    assert.ok(qpCoz(ham).includes("jeton=abc"), "gövde gitmeli");
  });

  test("başarılı gönderim damgalanır", () => {
    const damga = d.ayarOku("posta_son_gonderim");
    assert.ok(damga.includes("ayse@ornek.com"), damga);
    assert.equal(d.ayarOku("posta_son_hata"), "");
  });

  test("sunucuya ulaşılamazsa hata fırlatmaz, sonuç nesnesine yazar", async () => {
    /* Kapalı bir port: bağlantı reddedilir. */
    smtpAc(1);
    const s = await g.gonder({ kime: "ayse@ornek.com", konu: "Deneme", metin: "x" });
    assert.equal(s.gercek, false);
    assert.ok(s.hata, "hata metni dönmeli");
    assert.ok(d.ayarOku("posta_son_hata").includes("ayse") === false);
    assert.ok(d.ayarOku("posta_son_hata").length > 0, "hata damgalanmalı");
    smtpKapat();
  });
});

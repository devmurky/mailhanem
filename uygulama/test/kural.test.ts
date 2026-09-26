import { strict as assert } from "node:assert";
import { test } from "node:test";
import { kararVer, type Girdi } from "../sunucu/posta/kural.ts";

const temel: Girdi = {
  gonderen: "ayse@musteri.com",
  konu: "İade prosedürü hakkında bilgi",
  basliklar: {},
  kendiAlanlar: ["arkunmobilya.com"],
};

const ile = (parca: Partial<Girdi>): Girdi => ({ ...temel, ...parca });

test("gerçek müşteri maili geçer", () => {
  assert.deepEqual(kararVer(temel), { gecer: true });
});

test("List-Unsubscribe olan bülten elenir", () => {
  const k = kararVer(ile({ basliklar: { "List-Unsubscribe": "<https://x/u>" } }));
  assert.equal(k.gecer, false);
  assert.equal(k.gecer === false && k.kural, "bulten");
});

test("List-Id de bülten sayılır", () => {
  const k = kararVer(ile({ basliklar: { "list-id": "<duyuru.x.com>" } }));
  assert.equal(k.gecer === false && k.kural, "bulten");
});

test("Auto-Submitted otomatik yanıt sayılır", () => {
  const k = kararVer(ile({ basliklar: { "Auto-Submitted": "auto-replied" } }));
  assert.equal(k.gecer === false && k.kural, "otomatik-yanit");
});

test("Auto-Submitted: no elemez — bu insan mailidir", () => {
  assert.equal(kararVer(ile({ basliklar: { "Auto-Submitted": "no" } })).gecer, true);
});

test("Precedence: bulk elenir", () => {
  const k = kararVer(ile({ basliklar: { Precedence: "bulk" } }));
  assert.equal(k.gecer === false && k.kural, "otomatik-yanit");
});

test("boş Return-Path teslimat bildirimidir", () => {
  const k = kararVer(ile({ basliklar: { "Return-Path": "<>" } }));
  assert.equal(k.gecer === false && k.kural, "otomatik-yanit");
});

test("dolu Return-Path elemez", () => {
  assert.equal(kararVer(ile({ basliklar: { "Return-Path": "<a@b.com>" } })).gecer, true);
});

test("no-reply yazımlarının hepsi yakalanır", () => {
  for (const adres of [
    "no-reply@kargo.com",
    "noreply@kargo.com",
    "no_reply@kargo.com",
    "do-not-reply@banka.com",
    "donotreply@banka.com",
    "MAILER-DAEMON@sunucu.com",
    "postmaster@sunucu.com",
  ]) {
    const k = kararVer(ile({ gonderen: adres }));
    assert.equal(k.gecer, false, adres + " geçmemeliydi");
    assert.equal(k.gecer === false && k.kural, "no-reply", adres);
  }
});

test("adında reply geçen gerçek kişi elenmez", () => {
  assert.equal(kararVer(ile({ gonderen: "replyhan@musteri.com" })).gecer, true);
  assert.equal(kararVer(ile({ gonderen: "ayse.noreplyoglu@musteri.com" })).gecer, true);
});

test("kendi alan adından gelen iç yazışmadır", () => {
  const k = kararVer(ile({ gonderen: "elif@arkunmobilya.com" }));
  assert.equal(k.gecer === false && k.kural, "ic-yazisma");
});

test("kendi alan adının alt alanı da iç yazışmadır", () => {
  const k = kararVer(ile({ gonderen: "sistem@posta.arkunmobilya.com" }));
  assert.equal(k.gecer === false && k.kural, "ic-yazisma");
});

test("benzeyen ama başka bir alan adı iç yazışma değildir", () => {
  assert.equal(kararVer(ile({ gonderen: "x@notarkunmobilya.com" })).gecer, true);
  assert.equal(kararVer(ile({ gonderen: "x@arkunmobilya.com.tr" })).gecer, true);
});

test("başlık adı büyük/küçük harften etkilenmez", () => {
  const k = kararVer(ile({ basliklar: { "LIST-UNSUBSCRIBE": "<https://x/u>" } }));
  assert.equal(k.gecer === false && k.kural, "bulten");
});

test("bozuk gönderen elenir", () => {
  for (const g of ["", "   ", "adres-degil"]) {
    const k = kararVer(ile({ gonderen: g }));
    assert.equal(k.gecer === false && k.kural, "gonderen-yok", JSON.stringify(g));
  }
});

test("bülten kuralı no-reply'dan önce gelir — sebep bülten yazmalı", () => {
  const k = kararVer(
    ile({ gonderen: "no-reply@duyuru.com", basliklar: { "List-Unsubscribe": "<x>" } }),
  );
  assert.equal(k.gecer === false && k.kural, "bulten");
});

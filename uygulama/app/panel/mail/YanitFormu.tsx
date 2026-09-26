"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Ikon } from "../../bilesenler/Ikon";
import { taslakKaydet, yanitla, type YanitDurumu } from "../eylemler";
import { sablonSayaci } from "../sablonlar/eylemler";
import { doldur, type YerTutucuDegerleri } from "../sablonlar/yerTutucular";

export type SablonSecenegi = { id: number; ad: string; kategori: string | null; metin: string };

function Gonder({ kime }: { kime: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="dugme ana" type="submit" disabled={pending}>
      <Ikon ad="sagok" boyut={15} />
      {pending ? "Gönderiliyor…" : `${kime} adresine gönder`}
    </button>
  );
}

/** Yazmayı bitirmeyi bu kadar bekliyoruz. Her tuşta sunucuya gitmek gereksiz. */
const BEKLEME = 1200;

type KayitDurumu = "bos" | "bekliyor" | "kaydediliyor" | "kayitli" | "hata";

/** "2026-09-25 14:32:10" → "14:32". Saniye taslak satırında gürültü. */
function saat(damga: string): string {
  return damga.slice(11, 16);
}

/**
 * Yanıt kutusu. Onay basamağı yok — yazan ile gönderen aynı kişi; araya
 * girecek bir yapay zekâ taslağı henüz olmadığı için onay şartı da uydurma
 * olurdu.
 *
 * ── Taslak otomatik kaydı (madde 3) ──────────────────────
 * Uzun bir yanıtın ortasında sekme kapanınca metnin gitmesi, bu üründe en
 * pahalı kayıp: mail hâlâ cevapsız ama emek gitmiş oluyor. Yazma durduktan
 * 1,2 saniye sonra metin sunucuya yazılıyor; sekme arkaya atılınca ve bileşen
 * kapanınca bekleyen metin hemen gönderiliyor.
 *
 * Taslak satırı **ne olduğunu olduğu gibi** yazıyor ("kaydedildi 14:32"),
 * çünkü kaydedilmemiş bir metni kaydedilmiş göstermek, hiç göstermemekten
 * kötü. Kayıt başarısızsa satır bunu söylüyor ve metni kopyalamayı öneriyor.
 */
export function YanitFormu({
  mailId,
  kime,
  kutuAdres,
  smtpVar,
  sablonlar,
  degerler,
  taslak,
}: {
  mailId: number;
  kime: string;
  kutuAdres: string;
  smtpVar: boolean;
  sablonlar: SablonSecenegi[];
  degerler: YerTutucuDegerleri;
  /** Sunucuda duran yarım yanıt. Yoksa kutu boş açılır. */
  taslak?: { metin: string; guncelleme: string };
}) {
  const [durum, eylem] = useActionState<YanitDurumu, FormData>(yanitla, {});
  const kutu = useRef<HTMLTextAreaElement>(null);
  const [secili, setSecili] = useState("");

  const baslangic = durum.taslak ?? taslak?.metin ?? "";
  const [kayit, setKayit] = useState<KayitDurumu>(taslak?.metin ? "kayitli" : "bos");
  const [damga, setDamga] = useState(taslak?.guncelleme ?? "");
  /* Geri yüklendiği ilk anda söyleniyor; kullanıcı yazmaya başlayınca susuyor. */
  const [geriYuklendi, setGeriYuklendi] = useState(Boolean(taslak?.metin));

  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* Sunucudaki metnin ne olduğu: aynı metni iki kez yazmayalım. */
  const kayitli = useRef(taslak?.metin ?? "");
  /* Kaydedilmeyi bekleyen metin — bileşen kapanırken bu gönderiliyor. */
  const bekleyen = useRef(taslak?.metin ?? "");

  const kaydet = useCallback(
    async (metin: string) => {
      if (metin === kayitli.current) return;
      setKayit("kaydediliyor");
      try {
        const sonuc = await taslakKaydet(mailId, metin);
        if (sonuc.hata) {
          setKayit("hata");
          return;
        }
        kayitli.current = metin;
        setDamga(sonuc.damga ?? "");
        setKayit(metin.trim() ? "kayitli" : "bos");
      } catch {
        /* Ağ koptu ya da oturum düştü. Metin tarayıcıda duruyor; satır bunu
           söylüyor ve kullanıcı kopyalayabiliyor. */
        setKayit("hata");
      }
    },
    [mailId],
  );

  const yazildi = (metin: string) => {
    bekleyen.current = metin;
    setGeriYuklendi(false);
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    setKayit(metin === kayitli.current ? (metin.trim() ? "kayitli" : "bos") : "bekliyor");
    zamanlayici.current = setTimeout(() => void kaydet(metin), BEKLEME);
  };

  /* Sekme arkaya atılınca beklemeyi bitirmeden yaz: kapatma çoğu tarayıcıda
     önce "hidden" olarak görünüyor. */
  useEffect(() => {
    const gorunurluk = () => {
      if (document.visibilityState !== "hidden") return;
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
      void kaydet(bekleyen.current);
    };
    document.addEventListener("visibilitychange", gorunurluk);
    return () => document.removeEventListener("visibilitychange", gorunurluk);
  }, [kaydet]);

  /* Bileşen kapanırken (başka maile geçiş) bekleyen metin kaybolmasın. */
  useEffect(() => {
    return () => {
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
      if (bekleyen.current !== kayitli.current) {
        void taslakKaydet(mailId, bekleyen.current).catch(() => {});
      }
    };
  }, [mailId]);

  /* Gönderim başarılıysa kutu ve taslak birlikte boşalıyor: sunucudaki kayıt
     `yanitla` içinde siliniyor, buradaki metin de kalmamalı. */
  useEffect(() => {
    if (!durum.tamam) return;
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    if (kutu.current) kutu.current.value = "";
    kayitli.current = "";
    bekleyen.current = "";
    setDamga("");
    setKayit("bos");
    setGeriYuklendi(false);
  }, [durum.tamam]);

  /* Şablon metnin üstüne yazmaz, imlecin olduğu yere eklenir: yazılmış bir
     cevabın üstüne yanlışlıkla şablon basmak istemiyoruz. */
  const sablonEkle = (id: string) => {
    const s = sablonlar.find((v) => String(v.id) === id);
    const alan = kutu.current;
    if (!s || !alan) return;

    const metin = doldur(s.metin, degerler);
    const bas = alan.selectionStart ?? alan.value.length;
    const son = alan.selectionEnd ?? alan.value.length;
    const oncesi = alan.value.slice(0, bas);
    const sonrasi = alan.value.slice(son);
    const ayrac = oncesi && !oncesi.endsWith("\n") ? "\n\n" : "";

    alan.value = oncesi + ayrac + metin + sonrasi;
    const imlec = (oncesi + ayrac + metin).length;
    alan.focus();
    alan.setSelectionRange(imlec, imlec);
    /* Şablon da yazmaktır: eklenen metin de taslağa girsin. */
    yazildi(alan.value);

    void sablonSayaci(s.id).catch(() => {});
    setSecili("");
  };

  if (!smtpVar) {
    return (
      <div className="kutu-uyari">
        <span className="ikn">
          <Ikon ad="uyari" boyut={16} />
        </span>
        <span>
          <b>Bu kutudan yanıt gönderilemiyor.</b> <code>{kutuAdres}</code> için SMTP
          sunucusu tanımlı değil. Mail Hesapları ekranından kutuyu yeniden bağlayıp
          SMTP alanlarını doldurun.
        </span>
      </div>
    );
  }

  return (
    <div className="kutu yanit-kutu">
      <div className="kutu-ust">
        <span className="kutu-ad">Yanıtla</span>
        <span className="kutu-not">
          {kutuAdres} · {kime}
        </span>
      </div>

      {durum.tamam ? (
        <p className="sonuc iyi" style={{ marginBottom: 12 }}>
          <Ikon ad="onay" boyut={16} />
          <span>{durum.tamam}</span>
        </p>
      ) : null}

      {durum.hata ? (
        <p className="sonuc kotu" style={{ marginBottom: 12 }}>
          <Ikon ad="uyari" boyut={16} />
          <span>{durum.hata}</span>
        </p>
      ) : null}

      <form action={eylem}>
        <input type="hidden" name="mail_id" value={mailId} />
        <label className="gizli" htmlFor={`yanit-${mailId}`}>
          Yanıt metni
        </label>
        <textarea
          id={`yanit-${mailId}`}
          ref={kutu}
          name="metin"
          rows={7}
          required
          defaultValue={baslangic}
          placeholder="Yanıtınızı buraya yazın…"
          onChange={(e) => yazildi(e.target.value)}
          onBlur={(e) => {
            if (zamanlayici.current) clearTimeout(zamanlayici.current);
            void kaydet(e.target.value);
          }}
        />

        <TaslakSatiri durum={kayit} damga={damga} geriYuklendi={geriYuklendi} />

        {sablonlar.length ? (
          <div className="sablon-sec">
            <label htmlFor={`sablon-${mailId}`}>Şablon ekle</label>
            <select
              id={`sablon-${mailId}`}
              value={secili}
              onChange={(e) => sablonEkle(e.target.value)}
            >
              <option value="">seçin…</option>
              {sablonlar.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.ad}
                  {s.kategori ? " ·" : ""}
                </option>
              ))}
            </select>
            <span className="ipuc">İmlecin olduğu yere eklenir, üstüne yazmaz.</span>
          </div>
        ) : null}

        <div className="form-alt-satir">
          <Gonder kime={kime} />
          <label className="kutucuk">
            <input type="checkbox" name="alinti" value="1" defaultChecked />
            Gelen maili alıntıla
          </label>
        </div>

        {/* Yanıtla ilgili üç gerçek, eskiden ekranın altındaki ayrı bir bantta
            duruyordu. Yeri burası: yazarken okunur. */}
        <p className="yanit-dipnot">
          Mail firmanızın kendi kutusundan çıkar, Mailhanem adresi görünmez.
          <span className="ayrac">·</span>
          Kutu salt okunur açıldığı için yanıt “Gönderilmiş Öğeler”e yazılmaz, kaydı
          bu ekranda durur.
        </p>
      </form>
    </div>
  );
}

/** Taslağın hâli. Boşken hiçbir şey yazmıyor — kutu boşken söylenecek şey yok. */
function TaslakSatiri({
  durum,
  damga,
  geriYuklendi,
}: {
  durum: KayitDurumu;
  damga: string;
  geriYuklendi: boolean;
}) {
  if (durum === "bos") return null;

  if (durum === "hata") {
    return (
      <p className="taslak-satiri kotu">
        <Ikon ad="uyari" boyut={13} />
        Taslak kaydedilemedi — bağlantı koptuysa metni kopyalayıp saklayın.
      </p>
    );
  }

  const metin =
    durum === "bekliyor" || durum === "kaydediliyor"
      ? "Taslak kaydediliyor…"
      : geriYuklendi
        ? `Yarım kalan yanıtınız geri yüklendi${damga ? ` · ${saat(damga)}` : ""}`
        : `Taslak kaydedildi${damga ? ` · ${saat(damga)}` : ""}`;

  return (
    <p className="taslak-satiri">
      <Ikon ad={durum === "kayitli" ? "onay" : "saat"} boyut={13} />
      {metin}
    </p>
  );
}

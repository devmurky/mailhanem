"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { girisLinkiIste, type GirisDurumu } from "./eylemler";
import { Ikon } from "../bilesenler/Ikon";
import { Turnstile } from "./Turnstile";

function Gonder() {
  const { pending } = useFormStatus();
  return (
    <button className="dug koyu" type="submit" disabled={pending}>
      {pending ? "Gönderiliyor…" : "Giriş linki gönder"}
    </button>
  );
}

/** Microsoft'un dört karesi. Tek yerde duruyor; marka rengi başka yerde kullanılmıyor. */
function MicrosoftAmblem() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

export function GirisFormu({
  gecersiz,
  firmasiz,
  turnstileAnahtari,
}: {
  gecersiz: boolean;
  firmasiz?: boolean;
  /** Boşsa bot koruması kurulmamış demektir; widget hiç çizilmez. */
  turnstileAnahtari: string;
}) {
  const [durum, eylem] = useActionState<GirisDurumu, FormData>(girisLinkiIste, {
    asama: "form",
    hata: gecersiz
      ? "Bu bağlantı geçersiz ya da süresi dolmuş. Yeni bir tane isteyin."
      : firmasiz
        ? "Hesabınız bir firmaya bağlı değil, o yüzden panel açılamadı. Kurulum ekibinize yazın."
        : undefined,
  });

  /* Microsoft ile giriş tasarımda var ama ucu bağlanmadı. Düğmeyi çalışıyormuş
     gibi göstermek yerine ne olduğunu söylüyoruz. */
  const [msNotu, setMsNotu] = useState(false);

  if (durum.asama === "gonderildi") {
    return (
      <div className="gitti">
        <div className="im" aria-hidden="true">
          <Ikon ad="onay" boyut={24} />
        </div>
        <h1>Linki gönderdik</h1>
        <p>
          <b>{durum.eposta}</b> adresine tek kullanımlık giriş linki gitti. Link 15
          dakika geçerli; gelen kutunuzda görmüyorsanız spam klasörüne de bakın.
        </p>
        <a className="dug" href="/giris">
          Farklı adres kullan
        </a>

        {durum.postaAcik ? null : (
          <p className="durum bilgi" style={{ textAlign: "left" }}>
            Bu sunucuda posta gönderimi tanımlı değil; bağlantı maille gitmedi.
            Sunucuda <code>veri/giden-mailler.log</code> dosyasına yazıldı.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <h1>Panele giriş</h1>
      <p>Şifre yok. Adresinizi yazın, tek kullanımlık giriş linkini gönderelim.</p>

      <div className="kart-sar">
        <div className="kart">
          <form action={eylem}>
            <div className={durum.hata ? "alan hata" : "alan"}>
              <label htmlFor="eposta">İş e-postanız</label>
              <input
                id="eposta"
                name="eposta"
                type="email"
                autoComplete="email"
                placeholder="ad@firmaniz.com"
                required
                autoFocus
              />
              <span className="alan-hata">{durum.hata ?? ""}</span>
            </div>
            <Turnstile siteAnahtari={turnstileAnahtari} />
            <Gonder />
          </form>

          <div className="ayirac">
            <span>veya</span>
          </div>

          <button className="dug" type="button" onClick={() => setMsNotu(true)}>
            <MicrosoftAmblem />
            Microsoft ile giriş yap
          </button>

          {msNotu ? (
            <p className="durum bilgi">
              Microsoft ile giriş henüz bağlanmadı. Şimdilik e-posta adresinizle
              devam edin — aynı panele girersiniz.
            </p>
          ) : null}

          {/* Bulmaca çoğu ziyaretçide hiç görünmüyor; korumanın varlığını
              söyleyen tek satır. Cloudflare de gizlendiğinde bunu istiyor. */}
          {turnstileAnahtari ? (
            <p className="koruma-notu">Cloudflare Turnstile ile korunuyor</p>
          ) : null}
        </div>

        <div className="kart-dip">
          Hesabınız yok mu?{" "}
          <a className="bag" href="/#randevu">
            Demo talebi bırakın
          </a>
        </div>
      </div>
    </>
  );
}

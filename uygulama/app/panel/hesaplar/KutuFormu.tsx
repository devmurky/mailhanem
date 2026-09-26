"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Ikon } from "../../bilesenler/Ikon";
import { kutuBagla, kutuParola, type KutuDurumu } from "./eylemler";

/**
 * Bilinen sağlayıcıların sunucu bilgileri. Elle yazmayı azaltır; listede
 * olmayan için alanlar açık duruyor.
 *
 * `uyari` alanı olanlar, o sağlayıcıda düz parolanın çalışmayacağını söylüyor —
 * kullanıcı "yanlış parola" hatasıyla baş başa kalmasın.
 */
const SAGLAYICILAR: Record<
  string,
  { imap: string; imapPort: number; smtp: string; smtpPort: number; uyari?: string }
> = {
  "cPanel — Turhost": { imap: "imap.turhost.com", imapPort: 993, smtp: "smtp.turhost.com", smtpPort: 465 },
  "cPanel — Natro": { imap: "imap.natrohost.com", imapPort: 993, smtp: "smtp.natrohost.com", smtpPort: 465 },
  "Yandex Mail": { imap: "imap.yandex.com.tr", imapPort: 993, smtp: "smtp.yandex.com.tr", smtpPort: 465 },
  "Google Workspace": {
    imap: "imap.gmail.com",
    imapPort: 993,
    smtp: "smtp.gmail.com",
    smtpPort: 465,
    uyari:
      "Google hesabın normal parolasını kabul etmez. Google hesabınızdan bir " +
      "uygulama parolası oluşturup buraya yapıştırın.",
  },
  "Microsoft 365": {
    imap: "outlook.office365.com",
    imapPort: 993,
    smtp: "smtp.office365.com",
    smtpPort: 587,
    uyari:
      "Microsoft çoğu kiracıda parolayla IMAP erişimini kapattı ve Mailhanem'in " +
      "Microsoft ile oturum açma bağlantısı henüz yok. Bağlantı kurulamazsa " +
      "sebep budur; kurulum ekibinize yazın.",
  },
};

function Gonder({ yazi, bekleyen }: { yazi: string; bekleyen: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="dugme ana" type="submit" disabled={pending}>
      {pending ? bekleyen : yazi}
    </button>
  );
}

function Sonuc({ durum }: { durum: KutuDurumu }) {
  if (durum.tamam) {
    return (
      <span className="sonuc iyi">
        <Ikon ad="onay" boyut={15} />
        {durum.tamam}
      </span>
    );
  }
  if (durum.hata) {
    return (
      <span className="sonuc kotu">
        <Ikon ad="uyari" boyut={15} />
        {durum.hata}
      </span>
    );
  }
  return null;
}

export function KutuFormu() {
  const [acik, setAcik] = useState(false);
  const [durum, eylem] = useActionState<KutuDurumu, FormData>(kutuBagla, {});
  const [saglayici, setSaglayici] = useState("");

  const on = SAGLAYICILAR[saglayici];

  if (!acik) {
    return (
      <button className="dugme" type="button" onClick={() => setAcik(true)}>
        <Ikon ad="zarf" boyut={15} />
        Kutu bağla
      </button>
    );
  }

  return (
    <div className="kutu-form-sar">
      <div className="kutu-form-ust">
        <b>Yeni posta kutusu</b>
        <button className="dugme sade ufak" type="button" onClick={() => setAcik(false)}>
          Kapat
        </button>
      </div>

      <p className="kutu-form-not">
        Bağlantı önce denenir; çalışmazsa <b>hiçbir şey kaydedilmez</b>. Parola
        AES-256-GCM ile şifrelenerek saklanır ve bir daha panele gösterilmez.
        Mailhanem kutunuzu <b>salt okunur</b> açar.
      </p>

      <form action={eylem}>
        <div className="ikili">
          <div className={durum.alanlar?.adres ? "form-satir hata" : "form-satir"}>
            <label htmlFor="k-adres">Kutu adresi</label>
            <input id="k-adres" name="adres" type="email" placeholder="info@firmaniz.com" required />
            <span className="alan-hata">{durum.alanlar?.adres ?? ""}</span>
          </div>

          <div className="form-satir">
            <label htmlFor="k-saglayici">Sağlayıcı</label>
            <select
              id="k-saglayici"
              name="saglayici"
              value={saglayici}
              onChange={(e) => setSaglayici(e.target.value)}
            >
              <option value="">Diğer / elle gireceğim</option>
              {Object.keys(SAGLAYICILAR).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {on?.uyari ? (
            <div className="kutu-uyari tam" style={{ marginTop: 0, marginBottom: 16 }}>
              <span className="ikn">
                <Ikon ad="uyari" boyut={16} />
              </span>
              <span>{on.uyari}</span>
            </div>
          ) : null}

          <div className={durum.alanlar?.imap_sunucu ? "form-satir hata" : "form-satir"}>
            <label htmlFor="k-imap">IMAP sunucusu — mail okumak için</label>
            <input
              id="k-imap"
              name="imap_sunucu"
              key={saglayici + "-imap"}
              defaultValue={on?.imap ?? ""}
              placeholder="imap.sunucunuz.com"
              required
            />
            <span className="alan-hata">{durum.alanlar?.imap_sunucu ?? ""}</span>
          </div>

          <div className="form-satir">
            <label htmlFor="k-imap-port">IMAP portu</label>
            <input
              id="k-imap-port"
              name="imap_port"
              type="number"
              key={saglayici + "-imapport"}
              defaultValue={on?.imapPort ?? 993}
            />
            <span className="ipuc">993 = TLS · 143 = STARTTLS</span>
          </div>

          <div className="form-satir">
            <label htmlFor="k-smtp">
              SMTP sunucusu <span className="ops">— yanıt göndermek için</span>
            </label>
            <input
              id="k-smtp"
              name="smtp_sunucu"
              key={saglayici + "-smtp"}
              defaultValue={on?.smtp ?? ""}
              placeholder="smtp.sunucunuz.com"
            />
            <span className="ipuc">Boş bırakırsanız bu kutudan yanıt gönderilemez.</span>
          </div>

          <div className="form-satir">
            <label htmlFor="k-smtp-port">SMTP portu</label>
            <input
              id="k-smtp-port"
              name="smtp_port"
              type="number"
              key={saglayici + "-smtpport"}
              defaultValue={on?.smtpPort ?? 465}
            />
            <span className="ipuc">465 = TLS · 587 = STARTTLS</span>
          </div>

          <div className="form-satir">
            <label htmlFor="k-kullanici">
              Kullanıcı adı <span className="ops">— boşsa adres kullanılır</span>
            </label>
            <input id="k-kullanici" name="kullanici_adi" autoComplete="off" />
          </div>

          <div className={durum.alanlar?.parola ? "form-satir hata" : "form-satir"}>
            <label htmlFor="k-parola">Kutu parolası</label>
            <input id="k-parola" name="parola" type="password" autoComplete="new-password" required />
            <span className="alan-hata">{durum.alanlar?.parola ?? ""}</span>
          </div>
        </div>

        <div className="form-alt-satir">
          <Gonder yazi="Bağlantıyı test et ve kaydet" bekleyen="Bağlantı deneniyor…" />
          <Sonuc durum={durum} />
        </div>
      </form>
    </div>
  );
}

/** Kopuk kutular için: yalnızca parolayı yeniler, diğer bilgilere dokunmaz. */
export function ParolaFormu({ kutuId, adres }: { kutuId: number; adres: string }) {
  const [acik, setAcik] = useState(false);
  const [durum, eylem] = useActionState<KutuDurumu, FormData>(kutuParola, {});

  if (!acik) {
    return (
      <button className="dugme ana ufak" type="button" onClick={() => setAcik(true)}>
        Parolayı güncelle
      </button>
    );
  }

  return (
    <form className="parola-formu" action={eylem}>
      <input type="hidden" name="kutu_id" value={kutuId} />
      <label className="gizli" htmlFor={`p-${kutuId}`}>
        {adres} için yeni parola
      </label>
      <input
        id={`p-${kutuId}`}
        name="parola"
        type="password"
        placeholder="Yeni kutu parolası"
        autoComplete="new-password"
        required
      />
      <Gonder yazi="Dene ve kaydet" bekleyen="Deneniyor…" />
      <button className="dugme sade ufak" type="button" onClick={() => setAcik(false)}>
        Vazgeç
      </button>
      <Sonuc durum={durum} />
    </form>
  );
}

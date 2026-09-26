"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { kutuBagla, type KutuDurumu } from "../posta/eylemler";
import { Ikon } from "../../bilesenler/Ikon";

/** Bilinen sağlayıcıların IMAP bilgileri; elle yazmayı azaltır. */
const SAGLAYICILAR: Record<string, { sunucu: string; port: number }> = {
  "cPanel — Turhost": { sunucu: "imap.turhost.com", port: 993 },
  "cPanel — Natro": { sunucu: "imap.natrohost.com", port: 993 },
  "Microsoft 365": { sunucu: "outlook.office365.com", port: 993 },
  "Google Workspace": { sunucu: "imap.gmail.com", port: 993 },
  Yandex: { sunucu: "imap.yandex.com.tr", port: 993 },
};

function Gonder() {
  const { pending } = useFormStatus();
  return (
    <button className="dugme ana" type="submit" disabled={pending}>
      {pending ? "Bağlantı deneniyor…" : "Bağlantıyı test et ve kaydet"}
    </button>
  );
}

export function KutuBagla({ firmalar }: { firmalar: { id: number; ad: string }[] }) {
  const [acik, setAcik] = useState(false);
  const [durum, eylem] = useActionState<KutuDurumu, FormData>(kutuBagla, {});
  const [saglayici, setSaglayici] = useState("");

  const onerilen = SAGLAYICILAR[saglayici];

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
        Bağlantı önce denenir, çalışmazsa hiçbir şey kaydedilmez. Parola{" "}
        <b>AES-256-GCM ile şifrelenerek</b> saklanır ve panele geri gösterilmez.
      </p>

      <form action={eylem}>
        <div className="ikili">
          <div className="form-satir">
            <label htmlFor="firma_id">Firma</label>
            <select id="firma_id" name="firma_id" defaultValue="" required>
              <option value="" disabled>
                Seçin
              </option>
              {firmalar.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.ad}
                </option>
              ))}
            </select>
            <span className="alan-hata">{durum.alanlar?.firma_id ?? ""}</span>
          </div>

          <div className="form-satir">
            <label htmlFor="adres">Kutu adresi</label>
            <input id="adres" name="adres" type="email" placeholder="info@firma.com" required />
            <span className="alan-hata">{durum.alanlar?.adres ?? ""}</span>
          </div>

          <div className="form-satir">
            <label htmlFor="saglayici">Sağlayıcı</label>
            <select
              id="saglayici"
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

          <div className="form-satir">
            <label htmlFor="imap_sunucu">IMAP sunucusu</label>
            <input
              id="imap_sunucu"
              name="imap_sunucu"
              key={saglayici + "-sunucu"}
              defaultValue={onerilen?.sunucu ?? ""}
              placeholder="imap.sunucunuz.com"
              required
            />
            <span className="alan-hata">{durum.alanlar?.imap_sunucu ?? ""}</span>
          </div>

          <div className="form-satir">
            <label htmlFor="imap_port">Port</label>
            <input
              id="imap_port"
              name="imap_port"
              type="number"
              key={saglayici + "-port"}
              defaultValue={onerilen?.port ?? 993}
            />
            <span className="ipuc">993 = TLS · 143 = STARTTLS</span>
          </div>

          <div className="form-satir">
            <label htmlFor="kullanici_adi">
              Kullanıcı adı <span className="ops">— boşsa adres kullanılır</span>
            </label>
            <input id="kullanici_adi" name="kullanici_adi" autoComplete="off" />
          </div>

          <div className="form-satir tam">
            <label htmlFor="parola">Kutu parolası</label>
            <input
              id="parola"
              name="parola"
              type="password"
              autoComplete="new-password"
              required
            />
            <span className="alan-hata">{durum.alanlar?.parola ?? ""}</span>
            <span className="ipuc">
              Microsoft 365 ve Google Workspace için hesabın normal parolası değil,
              uygulama parolası gerekir.
            </span>
          </div>
        </div>

        <div className="form-alt-satir">
          <Gonder />
          {durum.tamam ? (
            <span className="sonuc iyi">
              <Ikon ad="onay" boyut={15} />
              {durum.tamam}
            </span>
          ) : null}
          {durum.hata ? (
            <span className="sonuc kotu">
              <Ikon ad="uyari" boyut={15} />
              {durum.hata}
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}

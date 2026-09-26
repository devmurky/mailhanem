"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Ikon } from "../../bilesenler/Ikon";
import {
  gecmiseUygula,
  kuralAcKapat,
  kuralEkle,
  kuralSil,
  kuralTasi,
  type KuralDurumu,
} from "./eylemler";

type Secenek = { deger: string; ad: string };

function Kaydet() {
  const { pending } = useFormStatus();
  return (
    <button className="dugme ana" type="submit" disabled={pending}>
      {pending ? "Ekleniyor…" : "Kuralı ekle"}
    </button>
  );
}

/** Tipe göre değişen örnek metin; kullanıcı ne yazacağını tahmin etmesin. */
const ORNEK: Record<string, string> = {
  gonderen: "muhasebe@tedarikci.com",
  alan: "tedarikci.com",
  konu: "fatura",
};

export function YeniKural({
  kategoriler,
  kisiler,
}: {
  kategoriler: Secenek[];
  kisiler: Secenek[];
}) {
  const [acik, setAcik] = useState(false);
  const [durum, eylem] = useActionState<KuralDurumu, FormData>(kuralEkle, {});
  const [tip, setTip] = useState("alan");

  if (!acik) {
    return (
      <button className="dugme" type="button" onClick={() => setAcik(true)}>
        <Ikon ad="liste" boyut={15} />
        Kural ekle
      </button>
    );
  }

  return (
    <div className="kutu">
      <div className="kutu-ust">
        <span className="kutu-ad">Yeni kural</span>
        <button
          className="dugme sade ufak"
          type="button"
          style={{ marginLeft: "auto" }}
          onClick={() => setAcik(false)}
        >
          Kapat
        </button>
      </div>

      <form action={eylem}>
        <div className="ikili">
          <div className={durum.alanlar?.tip ? "form-satir hata" : "form-satir"}>
            <label htmlFor="k-tip">Neye baksın</label>
            <select id="k-tip" name="tip" value={tip} onChange={(e) => setTip(e.target.value)}>
              <option value="alan">Gönderenin alan adı</option>
              <option value="gonderen">Gönderen adresi</option>
              <option value="konu">Konuda geçen kelime</option>
            </select>
            <span className="alan-hata">{durum.alanlar?.tip ?? ""}</span>
          </div>

          <div className={durum.alanlar?.kalip ? "form-satir hata" : "form-satir"}>
            <label htmlFor="k-kalip">Eşleşecek metin</label>
            <input
              id="k-kalip"
              name="kalip"
              key={tip}
              placeholder={ORNEK[tip] ?? ""}
              maxLength={200}
              required
            />
            <span className="alan-hata">{durum.alanlar?.kalip ?? ""}</span>
            <span className="ipuc">
              {tip === "konu"
                ? "Konunun içinde geçmesi yeterli, büyük/küçük harf önemsiz."
                : tip === "alan"
                  ? "Alt alan adları da yakalanır: firma.com kuralı posta.firma.com'u da tutar."
                  : "Tam adres eşleşmesi aranır."}
            </span>
          </div>

          <div className="form-satir">
            <label htmlFor="k-kategori">
              Kategori <span className="ops">— isteğe bağlı</span>
            </label>
            <select id="k-kategori" name="kategori" defaultValue="">
              <option value="">değiştirme</option>
              {kategoriler.map((k) => (
                <option key={k.deger} value={k.deger}>
                  {k.ad}
                </option>
              ))}
            </select>
          </div>

          <div className={durum.alanlar?.sahip_id ? "form-satir hata" : "form-satir"}>
            <label htmlFor="k-sahip">
              Kime atansın <span className="ops">— isteğe bağlı</span>
            </label>
            <select id="k-sahip" name="sahip_id" defaultValue="">
              <option value="">kimseye</option>
              {kisiler.map((k) => (
                <option key={k.deger} value={k.deger}>
                  {k.ad}
                </option>
              ))}
            </select>
            <span className="alan-hata">{durum.alanlar?.sahip_id ?? ""}</span>
          </div>
        </div>

        <div className="form-alt-satir">
          <Kaydet />
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

export function KuralEylemleri({
  id,
  etkin,
  ilkMi,
  sonMu,
}: {
  id: number;
  etkin: boolean;
  ilkMi: boolean;
  sonMu: boolean;
}) {
  const [bekliyor, basla] = useTransition();
  const [soruyor, setSoruyor] = useState(false);

  const calistir = (is: () => Promise<unknown>) => basla(async () => void (await is()));

  return (
    <span className="kural-eylem">
      <button
        className="dugme sade ufak"
        type="button"
        disabled={bekliyor || ilkMi}
        aria-label="Yukarı taşı"
        title="Yukarı taşı"
        onClick={() => calistir(() => kuralTasi(id, "yukari"))}
      >
        ↑
      </button>
      <button
        className="dugme sade ufak"
        type="button"
        disabled={bekliyor || sonMu}
        aria-label="Aşağı taşı"
        title="Aşağı taşı"
        onClick={() => calistir(() => kuralTasi(id, "asagi"))}
      >
        ↓
      </button>
      <button
        className="dugme ufak"
        type="button"
        disabled={bekliyor}
        onClick={() => calistir(() => kuralAcKapat(id, !etkin))}
      >
        {etkin ? "Duraklat" : "Çalıştır"}
      </button>
      {soruyor ? (
        <>
          <button
            className="dugme ufak"
            type="button"
            disabled={bekliyor}
            onClick={() => calistir(() => kuralSil(id))}
          >
            Evet, sil
          </button>
          <button className="dugme sade ufak" type="button" onClick={() => setSoruyor(false)}>
            Vazgeç
          </button>
        </>
      ) : (
        <button className="dugme sade ufak" type="button" onClick={() => setSoruyor(true)}>
          Sil
        </button>
      )}
    </span>
  );
}

/** Kuralları zaten kutuda duran maillere uygular. */
export function GecmiseUygula() {
  const [bekliyor, basla] = useTransition();
  const [sonuc, setSonuc] = useState("");

  return (
    <span className="gecmis-uygula">
      <button
        className="dugme"
        type="button"
        disabled={bekliyor}
        onClick={() =>
          basla(async () => {
            const s = await gecmiseUygula();
            setSonuc(
              s.degisen
                ? `${s.taranan} mail tarandı, ${s.degisen} tanesi sınıflandı.`
                : `${s.taranan} mail tarandı, eşleşen olmadı.`,
            );
          })
        }
      >
        <Ikon ad="yenile" boyut={15} />
        {bekliyor ? "Taranıyor…" : "Kutudakilere de uygula"}
      </button>
      {sonuc ? <span className="ipuc">{sonuc}</span> : null}
    </span>
  );
}

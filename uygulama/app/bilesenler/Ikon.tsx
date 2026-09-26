/** Tek çizgi kalınlığında, tek ailede ikonlar. Emoji ya da hazır set yok. */
const YOL: Record<string, React.ReactNode> = {
  zarf: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M3.6 7.6l7.5 5a1.6 1.6 0 0 0 1.8 0l7.5-5" />
    </>
  ),
  pano: (
    <>
      <rect x="3" y="3" width="7.5" height="8.5" rx="1.8" />
      <rect x="13.5" y="3" width="7.5" height="5" rx="1.8" />
      <rect x="3" y="14.5" width="7.5" height="6.5" rx="1.8" />
      <rect x="13.5" y="11" width="7.5" height="10" rx="1.8" />
    </>
  ),
  bina: (
    <>
      <path d="M4 21V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15" />
      <path d="M14 10h4a2 2 0 0 1 2 2v9" />
      <path d="M3 21h18M7.5 8h3M7.5 12h3M7.5 16h3M17 14h.5M17 17.5h.5" />
    </>
  ),
  nabiz: <path d="M2.5 12h4l2.5-6 4 12 2.5-6h6" />,
  grafik: (
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 20v-6M12.5 20V8M17 20v-9" />
    </>
  ),
  kart: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 9.5h19M6 14.5h4" />
    </>
  ),
  anahtar: (
    <>
      <circle cx="8" cy="12" r="4" />
      <path d="M12 12h9M18 12v3.5M15.5 12v2.5" />
    </>
  ),
  liste: <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  ayar: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-1 1.47V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9.1 19.4a1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.47-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.47-1.02 1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.77.32H9.1A1.6 1.6 0 0 0 10.1 3.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.47 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.77V9.1a1.6 1.6 0 0 0 1.47 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </>
  ),
  uyari: (
    <>
      <path d="M10.3 3.9L2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4M12 17h.01" />
    </>
  ),
  onay: <path d="M4.5 12.5l5 5 10-11" />,
  carpi: <path d="M6 6l12 12M18 6L6 18" />,
  bilgi: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.6v.6" />
    </>
  ),
  soru: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .9-1 1.6v.3M12 17h.01" />
    </>
  ),
  cikis: (
    <>
      <path d="M9 4.5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h3" />
      <path d="M15.5 16l4-4-4-4M19.5 12H9" />
    </>
  ),
  kalem: (
    <>
      <path d="M4 20h4l10-10-4-4L4 16v4z" />
      <path d="M14 6l4 4" />
    </>
  ),
  kisiler: (
    <>
      <circle cx="9.5" cy="8" r="3.4" />
      <path d="M3 20a6.5 6.5 0 0 1 13 0" />
      <path d="M16.5 5.2a3.4 3.4 0 0 1 0 5.6M18 20a6.6 6.6 0 0 0-1.6-4.3" />
    </>
  ),
  saat: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.3 2" />
    </>
  ),
  kilit: (
    <>
      <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  yenile: (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v5h-5" />
    </>
  ),
  sagok: <path d="M5 12h13M13 6l6 6-6 6" />,
  yildiz: <path d="M12 3.5l2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85z" />,
  "yildiz-dolu": (
    <path
      d="M12 3.5l2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.65l5.9-.85z"
      fill="currentColor"
    />
  ),
  kalkan: <path d="M12 3l8 3v6c0 4.4-3.2 8.2-8 9-4.8-.8-8-4.6-8-9V6z" />,
  sunucu: (
    <>
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="13" width="18" height="7" rx="2" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </>
  ),
  ara: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.4 15.4L21 21" />
    </>
  ),
};

export function Ikon({
  ad,
  boyut = 18,
  className,
}: {
  ad: keyof typeof YOL | string;
  boyut?: number;
  className?: string;
}) {
  return (
    <svg
      className={className ? `ikn ${className}` : "ikn"}
      width={boyut}
      height={boyut}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {YOL[ad] ?? null}
    </svg>
  );
}

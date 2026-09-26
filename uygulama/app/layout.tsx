import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";

/* Fontlar Next tarafından barındırılıyor: dış istek yok, düzen kayması yok. */
const govde = Instrument_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-govde",
  display: "swap",
});

/* Giriş sayfasının başlığındaki italik satır için; tanıtım sayfasıyla aynı aile. */
const serif = Instrument_Serif({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mailhanem",
  description: "Ortak posta kutusu yönetimi.",
  robots: { index: false, follow: false },
  icons: {
    icon:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%231D4E7C'/%3E%3Crect x='6.5' y='9.5' width='19' height='13' rx='2.5' fill='none' stroke='%23fff' stroke-width='2'/%3E%3Cpath d='M7.6 11.8l7.2 4.9a2 2 0 0 0 2.4 0l7.2-4.9' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E",
  },
};

export default function KokDuzen({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${govde.variable} ${serif.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

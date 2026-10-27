import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "./_components/ServiceWorkerRegister";
import { PortalNavServer } from "./_components/portal/PortalNavServer";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
  axes: ["wdth"],
});

// Aplica el tema antes de que React hidrate, para evitar flash.
const themeBootstrap = `
try {
  var t = localStorage.getItem('rsg-theme') || 'system';
  var d = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (d) document.documentElement.classList.add('dark');
} catch (e) {}
`.trim();

export const metadata: Metadata = {
  title: "Panel RSG",
  description: "Panel de la iglesia RSG: reservas, calendario, servicio y más.",
  appleWebApp: {
    capable: true,
    title: "RSG",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E9E7E2" },
    { media: "(prefers-color-scheme: dark)", color: "#071A15" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={instrument.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        {/* Filtro de refracción para el liquid glass (solo lo usan navegadores que
            admiten url() en backdrop-filter; los demás lo ignoran). */}
        <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
          <filter id="liquid-refract" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.006 0.018" numOctaves="2" seed="11" result="noise" />
            <feGaussianBlur in="noise" stdDeviation="2.5" result="map" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale="26" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        <div className="md:pl-[232px]">
          {children}
        </div>
        <PortalNavServer />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

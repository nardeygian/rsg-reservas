import type { Metadata, Viewport } from "next";
import { Public_Sans, Sora } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "./_components/ServiceWorkerRegister";
import { PortalNav } from "./_components/portal/PortalNav";

const publicSans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
  weight: ["500", "600", "700"],
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
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F5F4" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1311" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${publicSans.variable} ${sora.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <div className="md:pl-[220px]">
          {children}
        </div>
        <PortalNav />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "./_components/ServiceWorkerRegister";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

// Cuando agregues los archivos a /public/fonts/, descomenta y enchúfalos:
//
// import localFont from "next/font/local";
// const riccione = localFont({
//   variable: "--font-riccione",
//   src: [
//     { path: "../public/fonts/RiccioneSerial-Regular.ttf", weight: "400" },
//     { path: "../public/fonts/RiccioneSerial-Light.ttf", weight: "300" },
//     // ...
//   ],
// });
// const fk = localFont({
//   variable: "--font-fk",
//   src: "../public/fonts/FKDisplay-Regular.otf",
// });
// const compendium = localFont({
//   variable: "--font-compendium",
//   src: "../public/fonts/Compendium-Regular.ttf",
// });

// Aplica el tema antes de que React hidrate, para evitar flash.
const themeBootstrap = `
try {
  var t = localStorage.getItem('rsg-theme') || 'system';
  var d = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (d) document.documentElement.classList.add('dark');
} catch (e) {}
`.trim();

export const metadata: Metadata = {
  title: "RSG Reservas",
  description: "Plataforma de reservas de espacios de la iglesia RSG.",
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
    { media: "(prefers-color-scheme: light)", color: "#f3f2e7" },
    { media: "(prefers-color-scheme: dark)", color: "#001a14" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={manrope.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

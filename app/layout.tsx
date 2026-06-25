import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "./_components/ServiceWorkerRegister";

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
  themeColor: "#003b2d",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

import type { MetadataRoute } from "next";

// Verde profundo del logo (#003B2D aproximado del PNG).
const BRAND_COLOR = "#003b2d";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Panel RSG",
    short_name: "Panel RSG",
    description:
      "Panel de la iglesia RSG: reservas, calendario, servicio y más.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BRAND_COLOR,
    theme_color: BRAND_COLOR,
    lang: "es-CO",
    icons: [
      {
        src: "/icons/icon-512.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

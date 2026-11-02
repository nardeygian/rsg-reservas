import Link from "next/link";
import { getUserCaps } from "@/lib/auth";
import { reservasEnCalendario } from "./navItems";

// Para quien tiene todos los destinos, Reservas vive dentro de Calendario:
// este selector pasa de los eventos (Asana) a los espacios (Reservas).
export async function EventosEspacios({ actual }: { actual: "eventos" | "espacios" }) {
  const caps = await getUserCaps();
  if (!caps || !reservasEnCalendario(caps)) return null;
  return (
    <div className="px-4 pt-4 max-w-md md:max-w-[1180px] md:px-[clamp(12px,3vw,40px)] mx-auto w-full">
      <nav className="segmented" aria-label="Calendario">
        <Link href="/calendario" className="segmented-link" aria-current={actual === "eventos" ? "page" : undefined}>Eventos</Link>
        <Link href="/reservas" className="segmented-link" aria-current={actual === "espacios" ? "page" : undefined}>Espacios</Link>
      </nav>
    </div>
  );
}

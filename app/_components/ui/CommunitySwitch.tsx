import Link from "next/link";
import { SERVICIO_OCULTO } from "@/lib/portal/modulos";

// Comunidad tiene dos vistas independientes: Discipulados (grupos y sus
// miembros) y Servidores (todos los que sirven, sean o no discípulos).
export function CommunitySwitch({ active }: { active: "servidores" | "discipulados" }) {
  if (SERVICIO_OCULTO) return null;
  return (
    <nav className="segmented self-start" aria-label="Comunidad">
      <Link href="/discipulos" prefetch aria-current={active === "discipulados" ? "page" : undefined} className="segmented-link">
        Discipulados
      </Link>
      <Link href="/servicio" prefetch aria-current={active === "servidores" ? "page" : undefined} className="segmented-link">
        Servidores
      </Link>
    </nav>
  );
}

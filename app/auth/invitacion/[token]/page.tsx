import Link from "next/link";
import type { Metadata } from "next";
import { Icon } from "@/app/_components/ui/Icon";
import { BotonesProveedor } from "@/app/(auth)/_components/BotonesProveedor";
import { salirYVolver } from "@/lib/cuentas/acciones";
import { cuentasClient, RUTA_INVITACION } from "@/lib/cuentas/db";
import { AceptarInvitacion } from "./AceptarInvitacion";

export const metadata: Metadata = { title: "Invitación · Panel Resurgencia", robots: { index: false } };

const ESTADOS: Record<string, { titulo: string; texto: string }> = {
  vencida: { titulo: "Esta invitación venció", texto: "Pide a tu líder que te comparta un enlace nuevo." },
  revocada: { titulo: "Este enlace ya no sirve", texto: "Tu líder generó uno más nuevo. Pídeselo otra vez." },
  aceptada: { titulo: "Esta invitación ya se usó", texto: "Si eres tú, entra con la misma cuenta que usaste." },
  ya_tiene_cuenta: { titulo: "Esta persona ya tiene cuenta", texto: "Entra con la cuenta que ya está unida." },
};

function Aviso({ titulo, texto, children }: { titulo: string; texto: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center gap-3">
      <span className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-text)" }}>
        <Icon name="clock" size={22} />
      </span>
      <h2 className="text-[19px] font-semibold" style={{ color: "var(--color-ink)" }}>{titulo}</h2>
      <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>{texto}</p>
      {children}
    </div>
  );
}

export default async function InvitacionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw);
  const ruta = `${RUTA_INVITACION}${encodeURIComponent(token)}`;
  const qsNext = `?next=${encodeURIComponent(ruta)}`;

  const supabase = await cuentasClient();
  const [{ data: filas }, { data: { user } }] = await Promise.all([
    supabase.rpc("ver_invitacion", { p_token: token }),
    supabase.auth.getUser(),
  ]);
  const inv = filas?.[0];

  if (!inv) {
    return (
      <Aviso titulo="Este enlace no es válido" texto="Revisa que lo copiaste completo o pide a tu líder uno nuevo.">
        <Link href="/login" className="btn-secondary w-full mt-2">Ir a entrar</Link>
      </Aviso>
    );
  }

  // es_mia: la cuenta actual ya es esta persona (reabrir el enlace después de aceptar).
  if (inv.status !== "pendiente" && !inv.es_mia) {
    const e = ESTADOS[inv.status] ?? ESTADOS.vencida;
    return (
      <Aviso titulo={e.titulo} texto={e.texto}>
        <Link href={user ? "/" : "/login"} className="btn-secondary w-full mt-2">{user ? "Ir al inicio" : "Entrar"}</Link>
      </Aviso>
    );
  }

  const saludo = (
    <div className="flex flex-col gap-1.5 text-center">
      <h2 className="text-[21px] font-semibold tracking-[-0.02em]" style={{ color: "var(--color-ink)" }}>
        Hola, {inv.first_name}
      </h2>
      <p className="text-[14px]" style={{ color: "var(--color-muted)" }}>
        {inv.invited_by_name ? <><strong style={{ color: "var(--color-ink)" }}>{inv.invited_by_name}</strong> te invitó</> : "Te invitaron"}{" "}
        a entrar al portal para ver tus servicios, aceptarlos y recibir avisos.
      </p>
    </div>
  );

  if (!user) {
    return (
      <div className="flex flex-col gap-5">
        {saludo}
        <BotonesProveedor next={ruta} back={ruta} />
        <div className="flex flex-col gap-2.5">
          <Link href={`/signup${qsNext}`} className="btn-primary w-full">Crear cuenta con mi correo</Link>
          <Link href={`/login${qsNext}`} className="btn-ghost w-full">Ya tengo cuenta</Link>
        </div>
        <p className="text-[12px] text-center" style={{ color: "var(--color-faint)" }}>
          Este enlace es solo para ti. Vence el{" "}
          {new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "long" }).format(new Date(inv.expires_at))}.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {saludo}
      <AceptarInvitacion token={token} cuenta={user.email ?? "tu cuenta"} yaUnida={inv.es_mia} />
      <form action={salirYVolver}>
        <input type="hidden" name="next" value={ruta} />
        <button type="submit" className="btn-ghost w-full text-[14px]" style={{ color: "var(--color-muted)" }}>
          No soy yo, usar otra cuenta
        </button>
      </form>
    </div>
  );
}

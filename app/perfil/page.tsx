import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "../_components/ThemeToggle";
import {
  autoLinkSlackByEmailAction,
  regenerateFeedTokenAction,
  signOutAction,
  updateSlackUserIdAction,
} from "./actions";

const ROLE_LABELS: Record<string, string> = {
  leader: "Líder",
  mentor: "Líder de Discipulado",
  pastor_ministerio: "Pastor de ministerio",
  pastor_sede: "Pastor de sede",
  admin_casa: "Admin de casa",
  studio_admin: "Admin del Estudio",
  super_admin: "Super admin",
  planeacion: "Planeación",
  fundador: "Fundador",
  servidor: "Servidor",
};

const APPROVER_ROLES = ["pastor_sede", "admin_casa", "super_admin", "pastor_ministerio"];

function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "·";
}

// ── Piezas de lista agrupada (estilo Ajustes de iOS) ─────────────────────────

function Group({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {title && <h2 className="px-4 text-[13px] font-medium" style={{ color: "var(--color-muted)" }}>{title}</h2>}
      <div className="card overflow-hidden divide-y">{children}</div>
      {footer && <div className="px-4 text-[12px] leading-relaxed" style={{ color: "var(--color-faint)" }}>{footer}</div>}
    </section>
  );
}

function RowIcon({ children, tone = "accent" }: { children: ReactNode; tone?: "accent" | "down" | "info" }) {
  const bg = tone === "down" ? "var(--color-down-soft)" : tone === "info" ? "var(--color-info-soft)" : "var(--color-accent-soft)";
  const fg = tone === "down" ? "var(--color-down)" : tone === "info" ? "var(--color-info)" : "var(--color-accent)";
  return (
    <span className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-none" style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}

function RowBody({ icon, label, detail, trailing }: { icon?: ReactNode; label: ReactNode; detail?: ReactNode; trailing?: ReactNode }) {
  return (
    <span className="flex items-center gap-3 px-4 min-h-[56px] w-full text-left">
      {icon}
      <span className="flex-1 min-w-0 py-2.5">
        <span className="block text-[15px] font-medium" style={{ color: "var(--color-ink)" }}>{label}</span>
        {detail && <span className="block text-[13px] truncate" style={{ color: "var(--color-muted)" }}>{detail}</span>}
      </span>
      {trailing}
    </span>
  );
}

const Chevron = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--color-faint)" }}>
    <polyline points="9 6 15 12 9 18" />
  </svg>
);

const icon = (d: ReactNode) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, calendar_feed_token, slack_user_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost";
  const proto =
    hdrs.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const feedHttpUrl = `${proto}://${host}/api/feed/${profile.calendar_feed_token}`;
  const feedWebcalUrl = feedHttpUrl.replace(/^https?:\/\//, "webcal://");
  const isLocalhost = host.includes("localhost") || host.startsWith("127.");

  const isAdmin = profile.role === "super_admin";
  const canApprove = APPROVER_ROLES.includes(profile.role);

  return (
    <main className="min-h-dvh px-4 pt-6 pb-8 max-w-lg mx-auto flex flex-col gap-7">
      {/* Encabezado: avatar, nombre y rol */}
      <header className="flex flex-col items-center text-center gap-3 pt-2">
        <span
          className="w-[84px] h-[84px] rounded-full flex items-center justify-center text-[30px] font-semibold"
          style={{ background: "var(--grad-hero)", color: "#F6F5F1", boxShadow: "inset 0 1px 0 rgba(255,255,255,.25), var(--glass-shadow)" }}
          aria-hidden
        >
          {initials(profile.full_name)}
        </span>
        <div className="flex flex-col items-center gap-1.5">
          <h1 className="text-[26px] font-semibold tracking-[-0.025em]" style={{ color: "var(--color-ink)" }}>
            {profile.full_name}
          </h1>
          <span className="chip chip-accent">{ROLE_LABELS[profile.role] ?? profile.role}</span>
          {user.email && <span className="text-[13px]" style={{ color: "var(--color-muted)" }}>{user.email}</span>}
        </div>
      </header>

      {(ok || error) && (
        <p
          role={error ? "alert" : "status"}
          className="card px-4 py-3 text-sm"
          style={{ color: error ? "var(--color-down)" : "var(--color-up)" }}
        >
          {error ?? ok}
        </p>
      )}

      {(isAdmin || canApprove) && (
        <Group title="Gestión">
          {canApprove && (
            <Link href="/aprobaciones" className="block">
              <RowBody
                icon={<RowIcon>{icon(<><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>)}</RowIcon>}
                label="Aprobaciones"
                detail="Reservas que esperan tu respuesta"
                trailing={Chevron}
              />
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin" className="block">
              <RowBody
                icon={<RowIcon>{icon(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>)}</RowIcon>}
                label="Administración"
                detail="Usuarios, espacios, catálogo y discipulados"
                trailing={Chevron}
              />
            </Link>
          )}
        </Group>
      )}

      <Group
        title="Calendario"
        footer={
          isLocalhost
            ? "Estás en un entorno local: Apple y Google Calendar solo aceptan la suscripción desde la versión publicada."
            : "Tus reservas aparecen solas en Apple, Google u Outlook y se mantienen al día."
        }
      >
        <a href={feedWebcalUrl} className="block">
          <RowBody
            icon={<RowIcon>{icon(<><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>)}</RowIcon>}
            label="Suscribir mi calendario"
            detail="Apple, Google u Outlook"
            trailing={Chevron}
          />
        </a>
        <details className="group">
          <summary className="list-none cursor-pointer">
            <RowBody
              icon={<RowIcon tone="info">{icon(<><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></>)}</RowIcon>}
              label="Ver enlace"
              detail="Si tu calendario no abre el botón de arriba"
              trailing={Chevron}
            />
          </summary>
          <div className="px-4 pb-4 flex flex-col gap-2">
            <input readOnly value={feedHttpUrl} className="input text-[13px]" aria-label="Enlace https del calendario" />
            <input readOnly value={feedWebcalUrl} className="input text-[13px]" aria-label="Enlace webcal del calendario" />
          </div>
        </details>
        <form action={regenerateFeedTokenAction}>
          <button type="submit" className="block w-full">
            <RowBody
              icon={<RowIcon tone="down">{icon(<><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></>)}</RowIcon>}
              label={<span style={{ color: "var(--color-down)" }}>Regenerar enlace</span>}
              detail="El enlace anterior deja de funcionar"
            />
          </button>
        </form>
      </Group>

      <Group title="Cuenta">
        <Link href="/perfil/cuenta" className="block">
          <RowBody
            icon={<RowIcon>{icon(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>)}</RowIcon>}
            label="Cuenta y formas de entrar"
            detail="Google, Apple, correo, tu registro de servidor y eliminar cuenta"
            trailing={Chevron}
          />
        </Link>
      </Group>

      <Group
        title="Notificaciones"
        footer="Con Slack vinculado te llega un mensaje directo cuando aprueban o rechazan tus reservas."
      >
        <Link href="/tu/notificaciones" className="block">
          <RowBody
            icon={<RowIcon>{icon(<><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z" /></>)}</RowIcon>}
            label="Avisos"
            detail="Tu bandeja y las notificaciones en este dispositivo"
            trailing={Chevron}
          />
        </Link>
        <RowBody
          icon={<RowIcon>{icon(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>)}</RowIcon>}
          label="Slack"
          detail={profile.slack_user_id ? `Vinculado · ${profile.slack_user_id}` : "Sin vincular"}
          trailing={
            <span className={`chip ${profile.slack_user_id ? "chip-up" : "chip-muted"}`}>
              {profile.slack_user_id ? "Activo" : "Inactivo"}
            </span>
          }
        />
        <form action={autoLinkSlackByEmailAction}>
          <button type="submit" className="block w-full">
            <RowBody label={<span style={{ color: "var(--color-accent)" }}>Vincular con mi email</span>} />
          </button>
        </form>
        <details>
          <summary className="list-none cursor-pointer">
            <RowBody label="Escribir mi Slack ID" detail="Empieza con U, por ejemplo U0123ABC" trailing={Chevron} />
          </summary>
          <form action={updateSlackUserIdAction} className="px-4 pb-4 flex flex-col gap-2">
            <input
              id="slack_user_id"
              name="slack_user_id"
              type="text"
              defaultValue={profile.slack_user_id ?? ""}
              placeholder="U0123ABC"
              pattern="[UWuw][A-Za-z0-9]{6,20}"
              className="input text-sm"
              aria-label="Slack ID"
            />
            <button type="submit" className="btn-primary">Guardar</button>
            <p className="text-[12px]" style={{ color: "var(--color-faint)" }}>
              En Slack: tu foto → Perfil → los tres puntos → Copiar ID de miembro. Si lo dejas vacío y guardas, se desvincula.
            </p>
          </form>
        </details>
      </Group>

      <Group title="Apariencia">
        <RowBody
          icon={<RowIcon>{icon(<><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" /></>)}</RowIcon>}
          label="Tema"
          detail="Claro, oscuro o el de tu teléfono"
          trailing={<ThemeToggle />}
        />
      </Group>

      <Group>
        <form action={signOutAction}>
          <button type="submit" className="w-full min-h-[52px] text-[15px] font-medium" style={{ color: "var(--color-down)" }}>
            Cerrar sesión
          </button>
        </form>
      </Group>
    </main>
  );
}

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  autoLinkSlackByEmailAction,
  regenerateFeedTokenAction,
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
};

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

  return (
    <main className="min-h-dvh px-4 py-4 max-w-md mx-auto space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="eyebrow">Cuenta</p>
          <h1 className="font-serif text-2xl mt-1 tracking-[-0.02em]">
            Mi perfil
          </h1>
        </div>
        <Link href="/" className="text-sm underline text-fg2">
          Inicio
        </Link>
      </header>

      <section className="card space-y-1">
        <p className="eyebrow">Sesión</p>
        <p className="font-serif text-2xl mt-1">{profile.full_name}</p>
        <p className="text-sm text-fg2">
          {ROLE_LABELS[profile.role] ?? profile.role}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow">Suscripción al calendario</h2>
        <p className="text-sm text-fg2">
          Suscribe tu calendario (Apple, Google, Outlook) con el enlace de
          abajo. Las reservas se mantienen al día solas.
        </p>

        {ok && (
          <p
            role="status"
            className="text-sm rounded-[14px] px-4 py-3 border border-[color:var(--color-sage-200)] bg-sage-100"
          >
            {ok}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="text-sm rounded-[14px] px-4 py-3"
            style={{ background: "#f2e3dd", color: "var(--color-critical)" }}
          >
            {error}
          </p>
        )}

        <div>
          <label
            htmlFor="feed-url"
            className="block text-xs text-fg2 mb-1"
          >
            Enlace (webcal://)
          </label>
          <input
            id="feed-url"
            readOnly
            value={feedWebcalUrl}
            className="input !text-xs font-mono"
          />
        </div>

        <a
          href={feedWebcalUrl}
          className="btn-primary"
        >
          Suscribirme
        </a>

        {isLocalhost && (
          <p
            className="text-xs rounded-[14px] px-4 py-3"
            style={{ background: "#f3ecdc", color: "var(--color-notice)" }}
          >
            En desarrollo (localhost), Apple/Google Calendar bloquean
            suscripciones por seguridad. Prueba con un túnel
            (<code className="font-mono">cloudflared tunnel --url http://localhost:3010</code>)
            o espera al deploy.
          </p>
        )}

        <details className="text-xs text-fg2">
          <summary className="cursor-pointer">
            Si tu calendario no acepta webcal, usa el enlace https
          </summary>
          <p className="mt-2 break-all font-mono">{feedHttpUrl}</p>
        </details>

        <form action={regenerateFeedTokenAction} className="pt-2">
          <button
            type="submit"
            className="text-sm underline"
            style={{ color: "var(--color-critical)" }}
          >
            Regenerar enlace (revoca el anterior)
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow">Notificaciones por Slack</h2>
        <p className="text-sm text-fg2">
          Vincula tu Slack para recibir un DM cuando aprueben o rechacen tus
          reservas. Sin esto, los mensajes solo van al canal del staff.
        </p>

        {profile.slack_user_id ? (
          <p className="text-sm rounded-[14px] px-4 py-3 border border-[color:var(--color-sage-200)] bg-sage-100">
            Vinculado a{" "}
            <span className="font-mono">{profile.slack_user_id}</span>.
          </p>
        ) : (
          <p className="text-sm rounded-[14px] px-4 py-3 border border-line bg-bg-muted">
            Sin vincular.
          </p>
        )}

        <form action={autoLinkSlackByEmailAction}>
          <button
            type="submit"
            className="btn-secondary !h-11"
          >
            Vincular automáticamente (por mi email)
          </button>
        </form>

        <form action={updateSlackUserIdAction} className="space-y-2">
          <label htmlFor="slack_user_id" className="block text-xs text-fg2">
            O pega tu Slack ID manual
          </label>
          <input
            id="slack_user_id"
            name="slack_user_id"
            type="text"
            defaultValue={profile.slack_user_id ?? ""}
            placeholder="U0123ABC..."
            pattern="[UWuw][A-Za-z0-9]{6,20}"
            className="input !h-11 font-mono text-sm"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="btn-primary !h-11 !px-5 !text-sm"
            >
              Guardar
            </button>
            <span className="text-xs text-fg3">
              Dejarlo vacío y guardar desvincula.
            </span>
          </div>
        </form>

        <details className="text-xs text-fg2">
          <summary className="cursor-pointer">
            ¿Cómo encuentro mi Slack ID?
          </summary>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li>En Slack, click en tu foto de perfil arriba a la derecha.</li>
            <li>Profile → click los tres puntos &quot;...&quot; → Copy member ID.</li>
            <li>Pégalo arriba (empieza con U).</li>
          </ol>
        </details>
      </section>
    </main>
  );
}

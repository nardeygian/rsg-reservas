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
        <h1 className="text-xl font-semibold">Mi perfil</h1>
        <Link
          href="/"
          className="text-sm underline text-gray-600 dark:text-gray-400"
        >
          Inicio
        </Link>
      </header>

      <section className="rounded-md border border-gray-200 dark:border-gray-800 p-4 space-y-1">
        <p className="text-sm text-gray-500">Sesión</p>
        <p className="font-medium">{profile.full_name}</p>
        <p className="text-sm">
          Rol: <strong>{ROLE_LABELS[profile.role] ?? profile.role}</strong>
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Suscripción al calendario</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Suscribe tu calendario (Apple, Google, Outlook) con el enlace de
          abajo. Las reservas se mantienen al día solas.
        </p>

        {ok && (
          <p
            role="status"
            className="text-sm rounded-md border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40 px-3 py-2"
          >
            {ok}
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="text-sm rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 px-3 py-2"
          >
            {error}
          </p>
        )}

        <div>
          <label
            htmlFor="feed-url"
            className="block text-xs text-gray-500 mb-1"
          >
            Enlace (webcal://)
          </label>
          <input
            id="feed-url"
            readOnly
            value={feedWebcalUrl}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-xs font-mono"
          />
        </div>

        <a
          href={feedWebcalUrl}
          className="inline-block rounded-md bg-black text-white px-4 py-2 text-sm dark:bg-white dark:text-black"
        >
          Suscribirme
        </a>

        {isLocalhost && (
          <p className="text-xs rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 px-3 py-2 text-amber-900 dark:text-amber-200">
            En desarrollo (localhost), Apple/Google Calendar bloquean
            suscripciones por seguridad. Prueba con un túnel
            (<code className="font-mono">cloudflared tunnel --url http://localhost:3010</code>)
            o espera al deploy.
          </p>
        )}

        <details className="text-xs text-gray-600 dark:text-gray-400">
          <summary className="cursor-pointer">
            Si tu calendario no acepta webcal, usa el enlace https
          </summary>
          <p className="mt-2 break-all font-mono">{feedHttpUrl}</p>
        </details>

        <form action={regenerateFeedTokenAction} className="pt-2">
          <button
            type="submit"
            className="text-sm underline text-red-700 dark:text-red-300"
          >
            Regenerar enlace (revoca el anterior)
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Notificaciones por Slack</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Vincula tu Slack para recibir un DM cuando aprueben o rechacen tus
          reservas. Sin esto, los mensajes solo van al canal del staff.
        </p>

        {profile.slack_user_id ? (
          <p className="text-sm rounded-md border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 px-3 py-2">
            Vinculado a{" "}
            <span className="font-mono">{profile.slack_user_id}</span>.
          </p>
        ) : (
          <p className="text-sm rounded-md border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/40 px-3 py-2">
            Sin vincular.
          </p>
        )}

        <form action={autoLinkSlackByEmailAction}>
          <button
            type="submit"
            className="rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm"
          >
            Vincular automáticamente (por mi email)
          </button>
        </form>

        <form action={updateSlackUserIdAction} className="space-y-2">
          <label htmlFor="slack_user_id" className="block text-xs text-gray-500">
            O pega tu Slack ID manual
          </label>
          <input
            id="slack_user_id"
            name="slack_user_id"
            type="text"
            defaultValue={profile.slack_user_id ?? ""}
            placeholder="U0123ABC..."
            pattern="[UWuw][A-Za-z0-9]{6,20}"
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm font-mono"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md bg-black text-white px-3 py-2 text-sm dark:bg-white dark:text-black"
            >
              Guardar
            </button>
            <span className="text-xs text-gray-500">
              Dejarlo vacío y guardar desvincula.
            </span>
          </div>
        </form>

        <details className="text-xs text-gray-600 dark:text-gray-400">
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

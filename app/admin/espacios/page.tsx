import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateSpaceRateAction } from "./actions";

const STAFF_ROLES = ["pastor_sede", "admin_casa", "super_admin"];

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  disabled: "Deshabilitado",
  external: "Administrado por externo",
};

export default async function SpacesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    redirect("/?error=Sin%20permiso");
  }

  const { data: spaces } = await supabase
    .from("spaces")
    .select("id, name, slug, status, hourly_rate_cents")
    .order("name");

  return (
    <main className="min-h-dvh px-4 py-4 max-w-2xl mx-auto space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Espacios y tarifas</h1>
        <Link
          href="/admin"
          className="text-sm underline text-gray-600 dark:text-gray-400"
        >
          ← Admin
        </Link>
      </header>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        Define la tarifa por hora de cada espacio. Si dejas el campo vacío y
        guardas, el espacio queda como{" "}
        <strong>no rentable</strong> por la plataforma.
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

      <ul className="space-y-3">
        {(spaces ?? []).map((s) => {
          const isExternal = s.status === "external";
          return (
            <li
              key={s.id}
              className="rounded-md border border-gray-200 dark:border-gray-800 p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium">{s.name}</p>
                <span className="text-[10px] uppercase tracking-wide text-gray-500">
                  {STATUS_LABELS[s.status] ?? s.status}
                </span>
              </div>

              {isExternal ? (
                <p className="text-xs text-gray-500 mt-2">
                  Este espacio lo administra un tercero. No se renta por la
                  plataforma.
                </p>
              ) : (
                <form
                  action={updateSpaceRateAction}
                  className="mt-2 flex items-end gap-2"
                >
                  <input type="hidden" name="id" value={s.id} />
                  <div className="flex-1">
                    <label
                      htmlFor={`rate-${s.id}`}
                      className="block text-xs text-gray-500 mb-1"
                    >
                      Tarifa por hora (COP)
                    </label>
                    <input
                      id={`rate-${s.id}`}
                      name="hourly_rate"
                      type="text"
                      inputMode="numeric"
                      placeholder="Vacío = no rentable"
                      defaultValue={
                        s.hourly_rate_cents != null
                          ? String(s.hourly_rate_cents / 100)
                          : ""
                      }
                      className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-md bg-black text-white px-3 py-2 text-sm dark:bg-white dark:text-black"
                  >
                    Guardar
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}

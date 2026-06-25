import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  toggleSpaceStatusAction,
  updateSpaceRateAction,
} from "./actions";

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
        <div>
          <p className="eyebrow">Catálogo</p>
          <h1 className="font-serif text-2xl mt-1 tracking-[-0.02em]">
            Espacios y tarifas
          </h1>
        </div>
        <Link href="/admin" className="text-sm underline text-fg2">
          ← Admin
        </Link>
      </header>

      <p className="text-sm text-fg2">
        Define la tarifa por hora de cada espacio. Si dejas el campo vacío y
        guardas, el espacio queda como <strong>no rentable</strong> por la
        plataforma.
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

      <ul className="space-y-3">
        {(spaces ?? []).map((s) => {
          const isExternal = s.status === "external";
          const isDisabled = s.status === "disabled";
          return (
            <li
              key={s.id}
              className={`rounded-[14px] border bg-bg-elev p-3 ${
                isDisabled ? "border-line opacity-60" : "border-line"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium">{s.name}</p>
                <span className="eyebrow">
                  {STATUS_LABELS[s.status] ?? s.status}
                </span>
              </div>

              {isExternal ? (
                <p className="text-xs text-fg3 mt-2">
                  Este espacio lo administra un tercero. No se renta por la
                  plataforma.
                </p>
              ) : (
                <>
                  <form
                    action={updateSpaceRateAction}
                    className="mt-2 flex items-end gap-2"
                  >
                    <input type="hidden" name="id" value={s.id} />
                    <div className="flex-1">
                      <label
                        htmlFor={`rate-${s.id}`}
                        className="block text-xs text-fg2 mb-1"
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
                        className="input !h-11 text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn-primary !h-11 !px-5 !text-sm"
                    >
                      Guardar
                    </button>
                  </form>
                  <form
                    action={toggleSpaceStatusAction}
                    className="mt-2 inline-block"
                  >
                    <input type="hidden" name="id" value={s.id} />
                    <input
                      type="hidden"
                      name="next_status"
                      value={isDisabled ? "active" : "disabled"}
                    />
                    <button
                      type="submit"
                      className="text-xs underline text-fg2"
                    >
                      {isDisabled
                        ? "Reactivar espacio"
                        : "Pausar espacio (no aparecerá en reservas)"}
                    </button>
                  </form>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  formatDateLong,
  formatTime,
  toDateParam,
} from "@/lib/datetime";
import {
  approveBookingAction,
  rejectBookingAction,
} from "./actions";

const STAFF_ROLES = ["pastor_sede", "admin_casa", "super_admin"];

const USE_TYPE_LABELS: Record<string, string> = {
  reunion_departamento: "Reunión de departamento",
  reunion_ministerio: "Reunión de ministerio",
  consejeria: "Consejería",
  discipulado: "Discipulado",
  evento: "Evento",
  externo: "Externo",
  studio_negocio: "Studio (negocio)",
  otro: "Otro",
};

const REQUESTED_ROLE_LABELS: Record<string, string> = {
  lider_departamento: "Líder de departamento",
  pastor_ministerio: "Pastor de ministerio",
  pastor_sede: "Pastor de sede",
};

type PendingBooking = {
  id: string;
  starts_at: string;
  ends_at: string;
  use_type: string;
  title: string | null;
  expected_attendance: number | null;
  created_at: string;
  spaces: { name: string } | null;
  creator: {
    full_name: string;
    requested_role: string | null;
  } | null;
  ministry: { name: string } | null;
};

export default async function ApprovalsPage({
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
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    redirect("/?error=Sin%20permiso");
  }

  const { data: pending, error: queryError } = await supabase
    .from("bookings_staff")
    .select(
      `id, starts_at, ends_at, use_type, title, expected_attendance, created_at,
       spaces:space_id(name),
       creator:created_by(full_name, requested_role),
       ministry:ministry_id(name)`
    )
    .eq("status", "requested")
    .order("starts_at", { ascending: true })
    .returns<PendingBooking[]>();

  return (
    <main className="min-h-dvh px-4 py-4 max-w-2xl mx-auto space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Aprobaciones pendientes</h1>
        <Link
          href="/"
          className="text-sm underline text-gray-600 dark:text-gray-400"
        >
          Inicio
        </Link>
      </header>

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

      {queryError ? (
        <p className="text-sm text-red-600">
          No se pudo cargar la lista: {queryError.message}
        </p>
      ) : (pending ?? []).length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No hay reservas pendientes.
        </p>
      ) : (
        <ul className="space-y-3">
          {(pending ?? []).map((b) => (
            <li
              key={b.id}
              className="rounded-md border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20 p-4 space-y-3"
            >
              <div className="space-y-1">
                <p className="font-semibold capitalize">
                  {formatDateLong(b.starts_at)}
                </p>
                <p className="text-sm tabular-nums">
                  {formatTime(b.starts_at)} – {formatTime(b.ends_at)}
                  <span className="text-gray-500"> · </span>
                  <span className="font-medium">{b.spaces?.name ?? "—"}</span>
                </p>
              </div>

              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="text-gray-500">Solicita</dt>
                <dd>
                  {b.creator?.full_name ?? "—"}
                  {b.creator?.requested_role && (
                    <span className="text-gray-500">
                      {" "}
                      ·{" "}
                      {REQUESTED_ROLE_LABELS[b.creator.requested_role] ??
                        b.creator.requested_role}
                    </span>
                  )}
                </dd>

                <dt className="text-gray-500">Tipo</dt>
                <dd>
                  {USE_TYPE_LABELS[b.use_type] ?? b.use_type}
                  {b.ministry && (
                    <span className="text-gray-500">
                      {" "}
                      · {b.ministry.name}
                    </span>
                  )}
                </dd>

                {b.title && (
                  <>
                    <dt className="text-gray-500">Título</dt>
                    <dd>{b.title}</dd>
                  </>
                )}

                {b.expected_attendance != null && (
                  <>
                    <dt className="text-gray-500">Asistencia</dt>
                    <dd>{b.expected_attendance}</dd>
                  </>
                )}
              </dl>

              <div className="flex items-center gap-2">
                <form action={approveBookingAction}>
                  <input type="hidden" name="id" value={b.id} />
                  <button
                    type="submit"
                    className="rounded-md bg-green-600 text-white px-3 py-1.5 text-sm font-medium"
                  >
                    ✓ Aprobar
                  </button>
                </form>
                <form action={rejectBookingAction}>
                  <input type="hidden" name="id" value={b.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-1.5 text-sm font-medium"
                  >
                    ✗ Rechazar
                  </button>
                </form>
                <Link
                  href={`/calendario?view=dia&date=${toDateParam(
                    new Date(b.starts_at)
                  )}`}
                  className="ml-auto text-xs underline text-gray-600 dark:text-gray-400"
                >
                  Ver en calendario
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

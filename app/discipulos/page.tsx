import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { svReadData } from "@/app/servicio/_lib/data";
import { donReadData, donacionesParaLider } from "@/app/donaciones/_lib/data";
import { DiscipulosShell } from "./_components/DiscipulosShell";
import { DiscipulosAdminShell } from "./_components/DiscipulosAdminShell";

export default async function DiscipulosPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string; grupo?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "";
  const isAdmin = ["super_admin", "pastor_sede"].includes(role);

  const [svData, donaciones, { preview, grupo: previewGrupoId }] = await Promise.all([
    svReadData(), donReadData(), searchParams,
  ]);
  const grupos = svData.grupos ?? {};
  const miembros = svData.miembros ?? {};

  // Super-admin previewing a specific group as its leader
  const previewGroup = (isAdmin && preview === "lider" && previewGrupoId)
    ? (grupos[previewGrupoId] ?? null)
    : null;

  const myGroup = previewGroup ?? Object.values(grupos).find((g) => g.lider_user_ids.includes(user.id)) ?? null;

  const miembrosDeMiGrupo = myGroup
    ? Object.values(miembros).filter((m) => m.grupo_id === myGroup.id)
    : [];

  const miembrosPorGrupo: Record<string, typeof miembros[string][]> = {};
  for (const m of Object.values(miembros)) {
    if (!miembrosPorGrupo[m.grupo_id]) miembrosPorGrupo[m.grupo_id] = [];
    miembrosPorGrupo[m.grupo_id].push(m);
  }

  const gruposOrdenados = Object.values(grupos).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es")
  );

  return (
    <main className="min-h-dvh" style={{ background: "var(--color-bg)" }}>
      {isAdmin && !previewGroup ? (
        <DiscipulosAdminShell
          grupos={gruposOrdenados}
          miembrosPorGrupo={miembrosPorGrupo}
          svData={svData}
          donaciones={donaciones}
        />
      ) : myGroup ? (
        <DiscipulosShell
          grupo={myGroup}
          miembros={miembrosDeMiGrupo}
          svData={svData}
          donaciones={donacionesParaLider(donaciones, miembrosDeMiGrupo)}
          canEdit={!previewGroup}
        />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[60dvh] px-6 text-center gap-3">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--color-faint)" }}
          >
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
            <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" />
          </svg>
          <p className="text-base font-semibold" style={{ color: "var(--color-ink)" }}>
            Sin grupo asignado
          </p>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Tu usuario no está registrado como líder de ningún discipulado. Pide a administración que te asigne tu grupo.
          </p>
        </div>
      )}
    </main>
  );
}

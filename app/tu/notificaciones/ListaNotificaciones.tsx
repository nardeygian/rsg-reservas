"use client";

import { useEffect, useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { marcarLeidas } from "@/lib/notificaciones/acciones";
import { ICONOS, ICONO_TIPO, IconoFila, Grupo, svg } from "./_ui";

export type FilaBandeja = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

const TZ = "America/Bogota";
const dia = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });
const hora = (d: Date) => d.toLocaleTimeString("es-CO", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

function cuando(iso: string): string {
  const d = new Date(iso);
  const ahora = new Date();
  const min = Math.round((ahora.getTime() - d.getTime()) / 60000);
  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min} min`;
  if (dia(d) === dia(ahora)) return `Hoy, ${hora(d)}`;
  const ayer = new Date(ahora.getTime() - 86400000);
  if (dia(d) === dia(ayer)) return `Ayer, ${hora(d)}`;
  return d.toLocaleDateString("es-CO", { timeZone: TZ, day: "numeric", month: "short" }) + `, ${hora(d)}`;
}

export function ListaNotificaciones({ filas, userId }: { filas: FilaBandeja[]; userId: string }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [vista, marcar] = useOptimistic(filas, (actual, ids: string[] | "todas") =>
    actual.map((f) => (ids === "todas" || ids.includes(f.id)) && !f.read_at ? { ...f, read_at: new Date().toISOString() } : f),
  );

  // Una notificación nueva aparece sin recargar (Realtime con RLS).
  useEffect(() => {
    const sb = createClient();
    const canal = sb
      .channel(`bandeja-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => router.refresh())
      .subscribe();
    return () => { sb.removeChannel(canal); };
  }, [router, userId]);

  const nuevas = vista.filter((f) => !f.read_at);
  const anteriores = vista.filter((f) => f.read_at);

  function abrir(f: FilaBandeja) {
    startTransition(async () => {
      if (!f.read_at) {
        marcar([f.id]);
        await marcarLeidas([f.id]);
      }
      if (f.link) router.push(f.link);
    });
  }

  function marcarTodas() {
    startTransition(async () => {
      marcar("todas");
      await marcarLeidas("todas");
    });
  }

  if (vista.length === 0) {
    return (
      <div className="card px-6 py-10 flex flex-col items-center text-center gap-3">
        <IconoFila>{svg(ICONOS.campana)}</IconoFila>
        <p className="text-[15px] font-medium" style={{ color: "var(--color-ink)" }}>No tienes notificaciones</p>
        <p className="text-[13px]" style={{ color: "var(--color-muted)" }}>Aquí verás tus asignaciones, recordatorios y avisos de tu equipo.</p>
      </div>
    );
  }

  const fila = (f: FilaBandeja) => {
    const tipo = ICONO_TIPO[f.kind] ?? { icono: ICONOS.campana, tono: "accent" as const };
    return (
      <button
        key={f.id}
        type="button"
        onClick={() => abrir(f)}
        className="flex items-start gap-3 px-4 py-3 w-full text-left min-h-[64px]"
        aria-label={`${f.read_at ? "" : "Sin leer: "}${f.title}`}
      >
        <IconoFila tono={tipo.tono}>{svg(tipo.icono)}</IconoFila>
        <span className="flex-1 min-w-0">
          <span className="flex items-baseline gap-2">
            <span className={`flex-1 min-w-0 text-[15px] ${f.read_at ? "font-medium" : "font-semibold"}`} style={{ color: "var(--color-ink)" }}>
              {f.title}
            </span>
            <span className="text-[12px] flex-none tabular" style={{ color: "var(--color-faint)" }}>{cuando(f.created_at)}</span>
          </span>
          {f.body && <span className="block text-[13px] leading-snug mt-0.5" style={{ color: "var(--color-muted)" }}>{f.body}</span>}
        </span>
        {!f.read_at && <span className="mt-2 w-2.5 h-2.5 rounded-full flex-none" style={{ background: "var(--color-accent)" }} aria-hidden />}
      </button>
    );
  };

  return (
    <>
      {nuevas.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-4">
            <h2 className="text-[13px] font-medium" style={{ color: "var(--color-muted)" }}>Nuevas · {nuevas.length}</h2>
            <button type="button" onClick={marcarTodas} disabled={pendiente} className="text-[13px] font-medium min-h-[44px] -my-3 flex items-center gap-1" style={{ color: "var(--color-accent)" }}>
              {svg(ICONOS.check, 15)} Marcar todas como leídas
            </button>
          </div>
          <div className="card overflow-hidden divide-y">{nuevas.map(fila)}</div>
        </section>
      )}
      {anteriores.length > 0 && <Grupo titulo="Anteriores">{anteriores.map(fila)}</Grupo>}
    </>
  );
}

// Importar reunión desde PDF · de la lectura al borrador que se revisa.
// Sin dependencias de servidor: lo usan la pantalla de revisión y la acción.

import type { TipoItemOrden } from "@/lib/servir/contratos";
import type { Lectura, ResponsableLeido } from "@/lib/servir/importar-pdf";

export type CancionCatalogo = { id: string; title: string; default_key: string | null };

// Qué hacer con una canción del PDF: enlazarla a una del catálogo, crearla
// o dejar el renglón sin canción enlazada.
export type DecisionCancion = { modo: "enlazar"; songId: string } | { modo: "crear" } | { modo: "omitir" };

export type ItemBorrador = {
  key: string;
  incluir: boolean;
  kind: TipoItemOrden;
  title: string;
  duration_sec: number;
  song_key: string | null;
  notes: string | null;
  cancion: { titulo: string; decision: DecisionCancion } | null;
};

const MAX_HUECO_SEG = 3 * 3600;

// "Gracias, Cristo!" → "gracias cristo"
export function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function emparejarCancion(titulo: string, catalogo: CancionCatalogo[]): string | null {
  const n = normalizar(titulo);
  if (!n) return null;
  return catalogo.find((c) => normalizar(c.title) === n)?.id ?? null;
}

function minutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

// El editor del orden calcula la hora de cada renglón sumando duraciones.
// Para que cuadre con el PDF, la duración de un renglón con hora es el hueco
// hasta el siguiente renglón con hora, menos lo que duran las canciones que
// quedan en medio. La hora del PDF queda al frente del título.
export function armarOrden(lectura: Lectura, catalogo: CancionCatalogo[]): ItemBorrador[] {
  const orden = lectura.orden;
  return orden.map((it, i) => {
    let dur = it.duracion_seg ?? 0;
    if (it.hora && it.tipo !== "cancion" && !it.duracion_seg) {
      let canciones = 0;
      for (let j = i + 1; j < orden.length; j++) {
        const sig = orden[j];
        if (sig.hora) {
          const hueco = (minutos(sig.hora) - minutos(it.hora)) * 60;
          dur = hueco > 0 && hueco <= MAX_HUECO_SEG ? Math.max(0, hueco - canciones) : 0;
          break;
        }
        canciones += sig.duracion_seg ?? 0;
      }
    }

    const songId = it.cancion ? emparejarCancion(it.cancion.titulo, catalogo) : null;
    return {
      key: `i${i}`,
      incluir: true,
      kind: it.tipo,
      title: it.cancion ? it.cancion.titulo : it.hora ? `${it.hora} · ${it.titulo}` : it.titulo,
      duration_sec: dur,
      song_key: it.cancion?.tono ?? null,
      notes: it.cancion?.dirige ? `Dirige: ${it.cancion.dirige}` : null,
      cancion: it.cancion
        ? { titulo: it.cancion.titulo, decision: songId ? { modo: "enlazar", songId } : { modo: "crear" } }
        : null,
    };
  });
}

// Responsables del PDF como texto para las notas de la reunión.
export function textoResponsables(responsables: ResponsableLeido[]): string {
  const grupos = new Map<string, string[]>();
  for (const r of responsables) {
    const g = r.grupo ?? "Otros";
    grupos.set(g, [...(grupos.get(g) ?? []), `${r.rol}: ${r.personas.join(", ")}`]);
  }
  return [...grupos].map(([g, roles]) => `${g}\n${roles.map((r) => `· ${r}`).join("\n")}`).join("\n\n");
}

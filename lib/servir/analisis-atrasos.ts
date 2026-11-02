// Análisis de atrasos de las reuniones con Claude.
//
// Solo servidor (usa ANTHROPIC_API_KEY). Recibe los motivos registrados en
// vivo (categoría, nota, minutos, punto y reunión) y devuelve un informe en
// texto plano para quien dirige la iglesia: patrones, causas que se repiten
// y recomendaciones. No toca la base: la acción guarda el informe.

import Anthropic from "@anthropic-ai/sdk";

export const MODELO_ANALISIS = "claude-opus-5-5";

export type MotivoAtraso = {
  fecha: string; reunion: string; tipo: string | null; punto: string | null;
  minutos: number; categoria: string | null; nota: string | null;
};

const SISTEMA = `Eres un asesor que ayuda al equipo de Planeación de una iglesia a mejorar la puntualidad y la salud de sus reuniones.
Recibes la lista de ajustes de tiempo hechos en vivo (minutos que se sumaron a un punto o a la reunión), con su categoría, una nota opcional, el punto del orden, el tipo de reunión y la fecha.

Escribe un informe breve en español, en texto plano (sin Markdown: nada de #, ** ni tablas). Usa estas secciones, cada título en su propia línea terminado en dos puntos, y viñetas que empiecen con "• ":
Resumen: dos o tres frases con el total de minutos perdidos, en cuántas reuniones y la tendencia.
Causas principales: las que más minutos suman, con cifras.
Patrones: en qué tipo de reunión, en qué puntos del orden o en qué fechas se repite el atraso.
Recomendaciones: tres a cinco acciones concretas y realistas para el equipo.
Basa todo en los datos; si son pocos para concluir algo, dilo. No inventes nombres ni cifras.`;

export class ErrorAnalisis extends Error {}

export async function analizarAtrasos(motivos: MotivoAtraso[], periodo: { desde: string; hasta: string }) {
  const client = new Anthropic();
  const datos = motivos.map((m) => [m.fecha, m.reunion, m.tipo ?? "", m.punto ?? "", `+${m.minutos} min`, m.categoria ?? "sin motivo", m.nota ?? ""].join(" | "));

  let respuesta: Anthropic.Beta.BetaMessage;
  try {
    respuesta = await client.beta.messages.create({
      model: MODELO_ANALISIS,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: SISTEMA,
      messages: [{
        role: "user",
        content: `Periodo: ${periodo.desde} a ${periodo.hasta}. ${motivos.length} ajustes.\nfecha | reunión | tipo | punto | minutos | categoría | nota\n${datos.join("\n")}`,
      }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new ErrorAnalisis("La clave de la API de Claude no es válida.");
    if (e instanceof Anthropic.RateLimitError) throw new ErrorAnalisis("Claude está ocupado. Intenta de nuevo en un minuto.");
    if (e instanceof Anthropic.APIError) throw new ErrorAnalisis(`Claude respondió con un error (${e.status ?? "sin conexión"}).`);
    throw e;
  }
  if (respuesta.stop_reason === "refusal") throw new ErrorAnalisis("Claude no pudo hacer este análisis.");
  const texto = respuesta.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
  if (!texto) throw new ErrorAnalisis("Claude no devolvió nada.");
  return { texto, modelo: respuesta.model };
}

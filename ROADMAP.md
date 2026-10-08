# Roadmap del Portal RSG

Una sola app para líderes, pastores, Planeación y administración: Reservas, Calendario RSG, Servicio, Donaciones y Mis discípulos. Todo con un solo inicio de sesión (Google o correo) y cada persona ve solo lo que le corresponde.

Este roadmap manda. Los detalles de cada etapa están en `docs/portal/`.

## Cómo se trabaja

**Todo se construye en paralelo, sin tocar lo que hoy funciona.** Las reservas en producción y el panel PHP de Hostinger siguen funcionando igual durante toda la construcción. Cada módulo se pasa a producción solo cuando cumple su criterio de "terminado", y cada paso tiene vuelta atrás. Ver `docs/portal/02-construccion-en-paralelo.md`.

Antes de cada etapa, lee:

1. `docs/portal/00-vision-y-arquitectura.md`
2. `docs/portal/01-reglas-que-no-se-rompen.md`
3. `docs/portal/02-construccion-en-paralelo.md`
4. El documento de la etapa.

## Etapas

| Etapa | Qué entrega | Documento | Toca producción |
|---|---|---|---|
| 0 | Bases: entorno paralelo, roles múltiples, directorio de personas, sistema visual, respaldos diarios | `etapa-0-bases.md` | Solo migraciones aditivas y el respaldo |
| 1 | Calendario RSG y módulo de Servicio | `etapa-1-calendario-y-servicio.md` | Al final, con el paso a producción |
| 2 | Donaciones | `etapa-2-donaciones.md` | Al final, con el paso a producción |
| 3 | Mis discípulos e Inicio personalizado | `etapa-3-mis-discipulos-e-inicio.md` | Sí, es nuevo |
| 4 | Retiro del panel PHP | `etapa-4-retiro-del-panel.md` | Sí |

El rediseño visual de Reservas entra con el sistema visual de la etapa 0, sin cambiar su lógica.

## Reglas para Claude Code

- **Una etapa a la vez.** No empieces la siguiente sin que Gian dé por cerrada la anterior.
- **Plan antes de código.** Al iniciar cada etapa, propone el plan con las migraciones y espera aprobación.
- **Migraciones solo aditivas** hasta el paso a producción de cada módulo: tablas nuevas, columnas nuevas que acepten nulos. No se borra ni se renombra nada que use la app actual.
- **Nunca corras una migración ni cambies datos en el proyecto de Supabase de producción sin permiso explícito.**
- **Nada de claves en el código ni en el chat.** Van en `.env.local`, en Vercel o en los secrets de GitHub y Supabase.
- **Rama `portal`** para todo el trabajo. `main` solo recibe cambios en los pasos a producción.
- **Lo de Hostinger** (`resurgencia/resurgencia-web`) va en ramas propias y se revisa antes de unir: cada push a `main` de ese repo se publica en vivo, incluido el cobro de Wompi.

## Estado

Actualiza esta tabla al cerrar cada punto.

| Etapa | Estado | Notas |
|---|---|---|
| 0 | Por empezar | |
| 1 | Por empezar | |
| 2 | Por empezar | |
| 3 | Por empezar | |
| 4 | Por empezar | |

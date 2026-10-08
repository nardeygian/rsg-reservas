# Etapa 3: Mis discípulos e Inicio personalizado

Objetivo: aprovechar que servicio y donaciones ya viven en la misma base.

## 3.1 Mis discípulos

Para cada mentor, y para super_admin (todos los discipulados):

- Lista de sus discípulos. Al tocar uno se ve su ficha:
  - **Servicio:** veces en reuniones de ministerio, veces en Servolución, ausencias, último servicio y el detalle por reunión.
  - **Aportes:** total del periodo por concepto, solo Módulo Dar, y su historial. Sin correo ni cédula para el mentor.
  - **Tendencia:** si viene sirviendo o aportando menos que antes, una señal discreta. Nunca un juicio.
- Selector de periodo, igual al del resto del portal.
- Las reglas de conteo y de privacidad son las mismas de las etapas 1 y 2. Esta vista solo junta lo que ya existe, no inventa cálculos nuevos.

Antes de construirla, confirma con Gian qué ven los pastores de sede.

## 3.2 Inicio personalizado

Lo primero que ve cada persona al entrar, armado según sus roles:

- **Para todos:** reuniones de hoy y de los próximos días, y mis reservas próximas.
- **Si la persona es servidor** (su usuario enlazado a un servidor): las reuniones donde le toca servir.
- **Mentor:** resumen de su discipulado este mes (cuántos sirvieron, aportes del discipulado) con acceso a Mis discípulos.
- **Planeación y super_admin:** la vista Hoy de servicio.
- **super_admin:** total del mes de donaciones y la última donación recibida.

Enlazar personas con servidores: `servidores.user_id` nulo por defecto. Se sugiere por nombre y se confirma a mano en `/admin/usuarios`.

## Terminado cuando

- [ ] Un mentor ve la ficha de cada uno de sus discípulos, con servicio y aportes, y nada de otros grupos.
- [ ] El Inicio cambia correctamente según los roles de quien entra, probado con una cuenta de cada rol.
- [ ] Todo funciona bien en el celular.

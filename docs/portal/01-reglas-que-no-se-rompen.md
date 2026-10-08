# Reglas que no se rompen

Estas reglas están implementadas hoy en PHP (`resurgencia-web/pago/panel-lib.php`, `pago/panel-servicio.php`, `pago/panel/api.php`) y la gente confía en sus números. El portal debe dar **exactamente** los mismos resultados. Ante cualquier duda, el código PHP es la referencia.

## Privacidad y permisos

Lo que ve cada persona lo deciden sus permisos (ver `00-vision-y-arquitectura.md`). Estas reglas valen para los paquetes por defecto y para cómo se cumplen:

1. **Quien no tiene ningún permiso de donaciones no recibe ningún dato de donaciones**, ni siquiera listas vacías con la estructura. Por defecto, Servidor Planeación no tiene ninguno.
2. **Con `donaciones.discipulado`, solo se ven donaciones del Módulo Dar de los discípulos de ese discipulado.** Nunca formularios ni otros discipulados.
3. **Correo, cédula y referencia solo con `donaciones.datos_personales`.** Las demás vistas de donaciones no traen esas columnas.
4. **Las notas de servicio** (por reunión y por persona) solo con `servicio.ver`.
5. **Todo se cumple en Supabase con RLS**, cerrado por defecto, usando `has_permission()`. Esconder un botón no cuenta como permiso.

## Donaciones

### Datos guardados hoy

Donación en línea (`pago/datos/panel/donaciones.jsonl`, una línea JSON por evento; el mismo `id` puede repetirse y la línea más reciente completa a la anterior):

```json
{ "id": "12345-1696...-WOMPI", "fecha": "2026-10-04T10:12:00-05:00", "monto": 50000, "estado": "APPROVED",
  "tipo": "Diezmo", "nombre": "Nombre Apellido", "email": "x@y.com", "doc": "1234567890",
  "metodo": "CARD", "ref": "RSG-...", "link": "", "fuente": "webhook" }
```

- Solo cuentan las de `estado = APPROVED`.
- Al fusionar por `id`, los campos vacíos de la línea nueva no borran los de la anterior.
- `fuente` puede ser `webhook` o `importado`.

Efectivo (`pago/datos/panel/efectivo.json`, se reemplaza completo cada vez que la hoja de Google envía):

```json
{ "id": "EFE-...", "fecha": "...", "monto": 20000, "estado": "APPROVED", "tipo": "Diezmo",
  "nombre": "...", "email": "", "doc": "...", "metodo": "Efectivo", "ref": "", "link": "", "fuente": "efectivo" }
```

Ajustes (`pago/datos/panel/ajustes.json`): `grupos` (discipulados), `discipulos`, `formularios`, `asignaciones` (llave de donante a discípulo, o `__ninguno__`), `segmentos` (Pastores & Líderes) y `servidor_discipulo` (correcciones manuales de servicio).

### Origen y concepto (`panel_origen`)

En este orden:

1. `fuente = efectivo` → origen **Módulo Dar**, concepto = `tipo`.
2. Si `link` coincide con el link de un formulario registrado, o `ref` empieza con su prefijo → origen y concepto = nombre del formulario.
3. Si tiene `link` sin formulario → "Link de pago {link}".
4. Si `ref` está vacía o empieza con `RSG-` → **Módulo Dar**. El concepto es uno de Diezmo, Diezmo + Ofrenda, Ofrenda, Pro Casa (comparando normalizado), o el `tipo` tal cual.
5. Si no → "Otro origen".

### Un donante = una persona

La misma persona dona a veces con cédula, a veces solo con correo, o escribe su nombre distinto. Se agrupan **todas** sus donaciones con unión de conjuntos (union-find) por cualquiera de estos identificadores:

- `c:{cédula}`
- `e:{correo en minúsculas}`
- `n:{nombre normalizado}`, solo si el nombre tiene 2 o más palabras útiles.

Si no tiene ninguno, la donación queda sola. La llave del donante es la unión ordenada de sus identificadores.

### Cruce donante y discípulo

1. **Asignación manual primero**: si cualquiera de los identificadores del donante tiene asignación, gana. `__ninguno__` significa "no es discípulo".
2. **Si no hay, por nombre** (`panel_cruce_nombre`):
   - Normalizar: minúsculas, sin tildes, solo letras. Ignorar de, del, la, las, los, y, da, do y palabras de una letra.
   - El donante debe tener al menos 2 palabras.
   - Parecido entre palabras: `1 - levenshtein(a, b) / max(len)`. Coincide si es ≥ 0,75.
   - Debe coincidir **el primer nombre del discípulo** y al menos `min(2, palabras del discípulo)` palabras.
   - Puntaje: coincidencias + promedio del parecido. Si dos discípulos empatan (diferencia ≤ 0,001), **no se asigna**.
3. Solo las donaciones del **Módulo Dar** se asignan a discípulos.

### Grupos especiales: Pastores & Líderes

- Vista solo para super_admin, con 18 personas, por nombre.
- Muchas de ellas también son discípulos. **Nunca se suman dos veces en ningún total.** Es una vista que filtra, no una bolsa de dinero aparte.

### Tarjetas que existen hoy (vista admin)

Total del periodo (mes, trimestre, semestre, año) con comparación contra el periodo anterior, gráfico por día o por mes, por concepto, de dónde viene, en línea y efectivo, discípulos y resto de la congregación (porcentaje y monto), ranking por monto y por frecuencia, discipulados, Pastores & Líderes, registro completo con filtros. Vista mentor: total de su discipulado, por concepto, sus discípulos.

## Servicio

### Datos guardados hoy (`pago/datos/panel/servicio.json`)

```json
{
  "reuniones": { "<id>": { "id": "<gid de Asana o m...>", "nombre": "[Ministerio RSG] Reunión Central",
                           "fecha": "2026-10-11", "seccion": "Ministerios", "origen": "asana", "fuera_de_asana": false } },
  "servidores": { "<sid>": { "id": "<sid>", "nombre": "Nombre Apellido" } },
  "registros":  { "<id de reunión>": { "cuando": "...", "por": "planeacion", "nota": "...",
                  "filas": [ { "sid": "...", "roles": ["Sonido", "Cámara"], "aus": true, "nota": "..." } ] } },
  "sync": 1696000000, "sync_error": ""
}
```

### Asana

- Proyecto "Calendario RSG", gid `1214245218084418`.
- Secciones: Entrenamientos, Ministerios, Formación, Comunidad, Eventos, Servolución.
- Fecha: `due_on`, o `due_at` convertido a America/Bogota. Casi nunca hay hora.
- Las tareas que desaparecen de Asana se quitan, salvo que tengan listado cargado: esas quedan marcadas `fuera_de_asana`.
- El id de la reunión es el gid de la tarea de Asana. Así coinciden los datos de PHP y de Supabase.

### Conteo

- **Varios roles en una misma reunión = un servicio.**
- **Las Reuniones Centrales de un mismo día cuentan como una** (unidad `central|fecha` si el nombre contiene "reunion central"; si no, `r|id`).
- **Tipo**: `serv` si la sección o el nombre empieza con Servolución, si no `min`. **Ministerio y Servolución se cuentan y muestran por separado**, nunca sumados en una sola cifra.
- **Ausente**: estaba asignado y no llegó. Queda registrado, pero **no cuenta como servicio**.

### Cruce servidor y discípulo

Igual que en donaciones, pero admite el nombre de pila abreviado (Zai ~ Zaira): si las dos palabras tienen al menos 3 letras y una empieza con la otra, el parecido vale 0,8. Las correcciones manuales (`servidor_discipulo`) ganan siempre.

### Listados

- Planeación sube el PDF de WorshipTools (Planning) de cada reunión. Se lee **en el navegador** con pdf.js y **el archivo no se guarda**.
- El lector ya existe en el panel PHP (`svInterpretarPlanning` en `pago/panel/index.html`): sección "Roles", líneas "Equipo | Rol: Nombre, Nombre". También acepta pegar una lista. Pórtalo tal cual.
- Al guardar, los nombres se limpian: mayúsculas y minúsculas normales, y "de", "del", "la" en minúscula. Si hay un servidor con el nombre parecido, se sugiere usarlo.

### Vista "Hoy"

Solo para super_admin y Planeación. Es el primer bloque al entrar: fecha, cuántas reuniones hay hoy, cuántas tienen listado y, por reunión, el botón "Subir listado" o "Ver o marcar ausencias". En días sin reuniones, una línea discreta con la próxima.

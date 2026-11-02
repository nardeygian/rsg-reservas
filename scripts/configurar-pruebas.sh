#!/bin/sh
# Prepara el proyecto de Supabase de PRUEBAS para probar push en un celular.
#
# Antes (una vez, en esta carpeta):
#   npx supabase login
#   npx supabase link --project-ref <ref-del-proyecto-de-pruebas>
#
# Uso:  sh scripts/configurar-pruebas.sh
#
# Hace: recrea la base de pruebas (migraciones + seed), publica el
# notificador, genera las llaves VAPID y el secreto del notificador y los
# guarda como secretos del proyecto. Al final imprime lo que falta pegar en
# Vercel y en el editor SQL del proyecto de pruebas.
#
# Se niega a correr contra producción.
set -eu

PROD="yuhfntejqkgajmacqmix"
REF=$(cat supabase/.temp/project-ref 2>/dev/null || true)
if [ -z "$REF" ]; then echo "✗ Esta carpeta no está vinculada. Corre: npx supabase link --project-ref <ref>"; exit 1; fi
if [ "$REF" = "$PROD" ]; then echo "✗ Está vinculada a PRODUCCIÓN ($PROD). No se hace nada."; exit 1; fi
echo "Proyecto de pruebas: $REF"

echo "1/4 Recreando la base de pruebas (migraciones + seed)…"
npx supabase db reset --linked --yes

echo "2/4 Publicando el notificador…"
npx supabase functions deploy notificador --project-ref "$REF"

echo "3/4 Generando llaves VAPID y secreto…"
KEYS=$(npx --yes web-push@3.6.7 generate-vapid-keys --json)
PUB=$(printf '%s' "$KEYS" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).publicKey))')
PRIV=$(printf '%s' "$KEYS" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).privateKey))')
SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')

npx supabase secrets set --project-ref "$REF" \
  VAPID_PUBLIC_KEY="$PUB" VAPID_PRIVATE_KEY="$PRIV" \
  VAPID_SUBJECT="mailto:${VAPID_CORREO:-admin@resurgencia.com}" \
  NOTIFICADOR_SECRET="$SECRET" >/dev/null

echo "4/4 Listo. Falta:"
echo
echo "A) En el editor SQL del proyecto de PRUEBAS ($REF), pega y corre:"
echo "   select vault.create_secret('https://$REF.supabase.co/functions/v1/notificador', 'notificador_url');"
echo "   select vault.create_secret('$SECRET', 'notificador_secret');"
echo
echo "B) En Vercel, variables del entorno Preview (solo Preview, no Production):"
echo "   NEXT_PUBLIC_SUPABASE_URL=https://$REF.supabase.co"
echo "   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key del proyecto de pruebas: Settings → API>"
echo "   SUPABASE_SERVICE_ROLE_KEY=<service_role key del proyecto de pruebas>"
echo "   NEXT_PUBLIC_VAPID_PUBLIC_KEY=$PUB"
echo "   SLACK_BOT_TOKEN=desactivado"
echo "   SLACK_RESERVAS_CHANNEL_ID=desactivado"

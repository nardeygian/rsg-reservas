import "server-only";

import { createPrivateKey, sign } from "node:crypto";

// Revocar la autorización de "Entrar con Apple" al eliminar la cuenta
// (App Store 5.1.1(v)). https://developer.apple.com/documentation/sign_in_with_apple/revoke_tokens
//
// Variables de entorno (las mismas credenciales del proveedor Apple de Supabase):
//   APPLE_TEAM_ID       Team ID de la cuenta de desarrollador
//   APPLE_KEY_ID        Key ID de la llave "Sign in with Apple"
//   APPLE_SERVICES_ID   Services ID (client_id web), p. ej. com.resurgencia.portal.web
//   APPLE_PRIVATE_KEY   Contenido del .p8 (los saltos de línea pueden ir como \n)

type Config = { teamId: string; keyId: string; clientId: string; privateKey: string };

function config(): Config | null {
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const clientId = process.env.APPLE_SERVICES_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!teamId || !keyId || !clientId || !privateKey) return null;
  return { teamId, keyId, clientId, privateKey };
}

export function appleConfigurado(): boolean {
  return config() !== null;
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

// client_secret: JWT ES256 firmado con la llave .p8, válido 5 minutos.
function clientSecret(c: Config): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: c.keyId }));
  const payload = b64url(JSON.stringify({
    iss: c.teamId, iat: now, exp: now + 300, aud: "https://appleid.apple.com", sub: c.clientId,
  }));
  const data = `${header}.${payload}`;
  const firma = sign("sha256", Buffer.from(data), {
    key: createPrivateKey(c.privateKey),
    dsaEncoding: "ieee-p1363",
  });
  return `${data}.${b64url(firma)}`;
}

export async function revocarTokenApple(refreshToken: string): Promise<{ ok: boolean; error?: string }> {
  const c = config();
  if (!c) return { ok: false, error: "Apple no está configurado (faltan APPLE_* en el entorno)" };
  const res = await fetch("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: clientSecret(c),
      token: refreshToken,
      token_type_hint: "refresh_token",
    }),
  });
  return res.ok ? { ok: true } : { ok: false, error: `Apple respondió ${res.status}` };
}

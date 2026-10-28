"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/supabase";
import type { EmailOtpType } from "@supabase/supabase-js";
import { guardarTokenApple } from "@/lib/cuentas/acciones";

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid credentials"))
    return "Email o contraseña incorrectos";
  if (m.includes("email not confirmed"))
    return "Confirma tu email antes de ingresar";
  if (m.includes("token has expired") || m.includes("expired"))
    return "El enlace ha expirado. Solicita uno nuevo";
  if (m.includes("user not found"))
    return "No existe una cuenta con ese email";
  if (m.includes("code verifier") || m.includes("pkce"))
    return "Abre el enlace en el mismo navegador donde lo pediste, o solicita uno nuevo";
  return msg;
}

// Solo rutas internas: "//evil.com" o "/\evil.com" saldrían del sitio.
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    handle();
  });

  async function handle() {
    // Cliente propio sin detección automática de la URL: el cliente de
    // @supabase/ssr es PKCE y rechazaría los tokens del fragmento (#access_token)
    // que traen los enlaces de recuperación e invitación.
    const supabase = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { isSingleton: false, auth: { detectSessionInUrl: false } }
    );
    const code      = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    const type      = searchParams.get("type") as EmailOtpType | null;
    const next      = safeNext(searchParams.get("next"));
    const isRecoveryNext = type === "recovery" ? "/reset-password" : next;

    // 1. PKCE flow (code in query params)
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        router.replace(`/login?error=${encodeURIComponent(translateAuthError(error.message))}`);
        return;
      }
      // Entrar con Apple: guardar su token para revocarlo si la persona
      // elimina su cuenta (App Store 5.1.1(v)). Si falla, la sesión sigue.
      const appleToken = data.session?.provider_refresh_token;
      if (searchParams.get("proveedor") === "apple" && appleToken) {
        await guardarTokenApple(appleToken).catch(() => undefined);
      }
      router.replace(isRecoveryNext);
      return;
    }

    // 2. OTP / email-link flow (token_hash + type in query params)
    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) {
        router.replace(`/login?error=${encodeURIComponent(translateAuthError(error.message))}`);
        return;
      }
      router.replace(isRecoveryNext);
      return;
    }

    // 3. Flujo implícito: tokens en el fragmento (#access_token=…&type=recovery).
    //    Lo usan la recuperación de contraseña y las invitaciones del admin.
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const hashError = hash.get("error_description");
    if (hashError) {
      router.replace(`/login?error=${encodeURIComponent(translateAuthError(hashError))}`);
      return;
    }
    const accessToken  = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        router.replace(`/login?error=${encodeURIComponent(translateAuthError(error.message))}`);
        return;
      }
      const hashType = hash.get("type");
      const isRecovery = hashType === "recovery" || hashType === "invite";
      router.replace(isRecovery ? "/reset-password" : next);
      return;
    }

    router.replace("/login?error=El%20enlace%20ha%20expirado%20o%20es%20inv%C3%A1lido");
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100dvh", background: "var(--color-bg)",
    }}>
      <p style={{ fontSize: 14, color: "var(--color-muted)" }}>Verificando…</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <AuthCallbackInner />
    </Suspense>
  );
}

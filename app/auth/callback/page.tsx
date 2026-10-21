"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { EmailOtpType } from "@supabase/supabase-js";

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
  return msg;
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
    const supabase = createClient();
    const code      = searchParams.get("code");
    const tokenHash = searchParams.get("token_hash");
    const type      = searchParams.get("type") as EmailOtpType | null;
    const next      = searchParams.get("next") ?? "/";
    const isRecoveryNext = type === "recovery" ? "/reset-password" : next;

    // 1. PKCE flow (code in query params)
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        router.replace(`/login?error=${encodeURIComponent(translateAuthError(error.message))}`);
        return;
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

    // 3. Implicit / hash-based flow — Supabase client reads the hash automatically
    //    Give the client a tick to parse the fragment before calling getSession
    await new Promise(r => setTimeout(r, 100));
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      const isRecovery = hash.includes("type=recovery");
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

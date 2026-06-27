import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resetPasswordAction } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?error=Enlace%20de%20recuperaci%C3%B3n%20inv%C3%A1lido%20o%20expirado"
    );
  }

  return (
    <form action={resetPasswordAction} className="space-y-4">
      <p className="text-sm text-fg2 text-center">
        Define una contraseña nueva para tu cuenta.
      </p>

      <label className="block">
        <span className="eyebrow">Nueva contraseña</span>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          className="input mt-2"
        />
        <span className="block text-xs text-fg3 mt-1">
          Mínimo 6 caracteres.
        </span>
      </label>

      <label className="block">
        <span className="eyebrow">Repítela</span>
        <input
          id="password_confirm"
          name="password_confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          className="input mt-2"
        />
      </label>

      {error && (
        <p
          className="text-sm rounded-[14px] px-4 py-3"
          style={{
            background: "#f2e3dd",
            color: "var(--color-critical)",
          }}
          role="alert"
        >
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full">
        Guardar contraseña
      </button>
    </form>
  );
}

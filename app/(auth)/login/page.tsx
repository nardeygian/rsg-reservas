import Link from "next/link";
import { loginAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <form action={loginAction} className="space-y-4">
      <label className="block">
        <span className="eyebrow">Email</span>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="input mt-2"
        />
      </label>

      <label className="block">
        <span className="eyebrow">Contraseña</span>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
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
        Entrar
      </button>

      <p className="text-sm text-center">
        <Link href="/forgot-password" className="text-fg2 underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </p>

      <p className="text-sm text-center text-fg2">
        ¿No tienes cuenta?{" "}
        <Link href="/signup" className="underline">
          Regístrate
        </Link>
      </p>
    </form>
  );
}

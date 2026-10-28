import Link from "next/link";
import { loginAction } from "./actions";
import { BotonesProveedor } from "../_components/BotonesProveedor";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  // Solo rutas internas (la acción vuelve a validarlo).
  const destino = next?.startsWith("/") && !next.startsWith("//") ? next : undefined;
  const qsNext = destino ? `?next=${encodeURIComponent(destino)}` : "";

  return (
    <div className="space-y-4">
      <BotonesProveedor next={destino} back={`/login${qsNext}`} />

      <form action={loginAction} className="space-y-4">
        {destino && <input type="hidden" name="next" value={destino} />}
        <label className="block">
          <span className="field-label">Email</span>
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
          <span className="field-label">Contraseña</span>
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
            className="text-sm rounded-[var(--radius-control)] px-4 py-3"
            style={{
              background: "var(--color-down-soft)",
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
          <Link href={`/signup${qsNext}`} className="underline">
            Regístrate
          </Link>
        </p>
      </form>
    </div>
  );
}

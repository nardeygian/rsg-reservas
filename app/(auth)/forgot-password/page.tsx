import Link from "next/link";
import { forgotPasswordAction } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;

  if (ok) {
    return (
      <div className="space-y-4 text-center">
        <p className="font-serif text-xl">
          Listo. Si el correo está registrado, te enviamos un enlace para
          restablecer tu contraseña.
        </p>
        <p className="text-sm text-fg2">
          Revisa tu bandeja de entrada y también la carpeta de spam.
        </p>
        <Link href="/login" className="btn-secondary inline-flex">
          Volver a login
        </Link>
      </div>
    );
  }

  return (
    <form action={forgotPasswordAction} className="space-y-4">
      <p className="text-sm text-fg2 text-center">
        Ingresa tu correo y te enviamos un enlace para crear una nueva
        contraseña.
      </p>

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
        Enviar enlace
      </button>

      <p className="text-sm text-center text-fg2">
        ¿Recordaste tu contraseña?{" "}
        <Link href="/login" className="underline">
          Volver a login
        </Link>
      </p>
    </form>
  );
}

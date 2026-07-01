import Link from "next/link";
import { signupAction } from "./actions";

const ROLE_OPTIONS = [
  { value: "lider_departamento", label: "Líder de departamento" },
  { value: "mentor", label: "Mentor" },
  { value: "pastor_ministerio", label: "Pastor de ministerio" },
  { value: "pastor_sede", label: "Pastor de sede" },
];

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;

  if (ok) {
    return (
      <div className="space-y-4 text-center">
        <p className="font-serif text-xl">
          Listo. Te enviamos un correo para confirmar tu cuenta.
        </p>
        <p className="text-sm text-fg2">
          Tu rol queda como <strong>líder</strong> hasta que un administrador
          lo revise.
        </p>
        <Link href="/login" className="btn-secondary inline-flex">
          Volver a login
        </Link>
      </div>
    );
  }

  return (
    <form action={signupAction} className="space-y-4">
      <label className="block">
        <span className="eyebrow">Nombre completo</span>
        <input
          id="full_name"
          name="full_name"
          type="text"
          autoComplete="name"
          required
          className="input mt-2"
        />
      </label>

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
          autoComplete="new-password"
          required
          minLength={6}
          className="input mt-2"
        />
        <span className="block text-xs text-fg3 mt-1">
          Mínimo 6 caracteres.
        </span>
      </label>

      <fieldset>
        <legend className="eyebrow">Yo en RSG soy</legend>
        <div className="space-y-2 mt-2">
          {ROLE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="radio"
                name="requested_role"
                value={opt.value}
                required
                className="accent-[var(--color-forest)]"
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-fg3 mt-2">
          Solo se usa para que el administrador te asigne el rol correcto.
        </p>
      </fieldset>

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
        Crear cuenta
      </button>

      <p className="text-sm text-center text-fg2">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="underline">
          Entra
        </Link>
      </p>
    </form>
  );
}

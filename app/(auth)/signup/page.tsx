import Link from "next/link";
import { signupAction } from "./actions";

const ROLE_OPTIONS = [
  { value: "lider_departamento", label: "Líder de departamento" },
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
        <p className="text-base">
          Listo. Te enviamos un correo para confirmar tu cuenta.
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Tu rol queda como <strong>líder</strong> hasta que un administrador lo
          revise.
        </p>
        <Link href="/login" className="inline-block underline text-sm">
          Volver a login
        </Link>
      </div>
    );
  }

  return (
    <form action={signupAction} className="space-y-4">
      <div>
        <label htmlFor="full_name" className="block text-sm mb-1">
          Nombre completo
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          autoComplete="name"
          required
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm mb-1">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
        />
        <p className="text-xs text-gray-500 mt-1">Mínimo 6 caracteres.</p>
      </div>

      <fieldset>
        <legend className="block text-sm mb-2">Yo en RSG soy</legend>
        <div className="space-y-2">
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
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Solo se usa para que el administrador te asigne el rol correcto.
        </p>
      </fieldset>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="w-full rounded-md bg-black text-white py-2 font-medium dark:bg-white dark:text-black"
      >
        Crear cuenta
      </button>

      <p className="text-sm text-center">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="underline">
          Entra
        </Link>
      </p>
    </form>
  );
}

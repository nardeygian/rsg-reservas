import Link from "next/link";

export default async function ExitoPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="min-h-dvh px-4 py-8 max-w-md mx-auto space-y-4 text-center">
      <h1 className="text-2xl font-semibold">¡Solicitud enviada!</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Tu reserva quedó en revisión. Quedará aprobada una vez confirmemos tu
        pago y te avisaremos por email.
      </p>
      {token && (
        <div className="space-y-2 rounded-md border border-gray-200 dark:border-gray-800 p-4">
          <p className="text-xs text-gray-500">
            Guarda este enlace para consultar el estado de tu reserva:
          </p>
          <Link
            href={`/alquilar/${token}`}
            className="block break-all text-sm underline font-mono"
          >
            /alquilar/{token}
          </Link>
        </div>
      )}
      <Link
        href="/alquilar"
        className="inline-block text-sm underline text-gray-600 dark:text-gray-400"
      >
        Hacer otra reserva
      </Link>
    </main>
  );
}

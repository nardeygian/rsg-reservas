import Link from "next/link";

export default async function ExitoPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="min-h-dvh px-4 py-8 max-w-md mx-auto space-y-4 text-center">
      <p className="eyebrow">Listo</p>
      <h1 className="font-serif text-3xl mt-1 tracking-[-0.02em]">
        Solicitud enviada
      </h1>
      <p className="text-sm text-fg2">
        Tu reserva quedó en revisión. Quedará aprobada una vez confirmemos tu
        pago y te avisaremos por email.
      </p>
      {token && (
        <div className="card space-y-2 text-left">
          <p className="eyebrow">Tu enlace</p>
          <p className="text-xs text-fg3">
            Guárdalo para consultar el estado de tu reserva.
          </p>
          <Link
            href={`/alquilar/${token}`}
            className="block break-all text-sm underline font-mono"
          >
            /alquilar/{token}
          </Link>
        </div>
      )}
      <Link href="/alquilar" className="btn-secondary inline-flex">
        Hacer otra reserva
      </Link>
    </main>
  );
}

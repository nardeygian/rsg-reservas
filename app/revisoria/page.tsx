import { redirect } from "next/navigation";
import { getUserCaps } from "@/lib/auth";
import { leerTransaccionesFiscales } from "./_lib/data";
import { filtrosDesdeParams } from "./_lib/fiscal-logic";
import { RevisoriaShell } from "./_components/RevisoriaShell";

export const metadata = { title: "Revisoría · Panel RSG" };

export default async function RevisoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const caps = await getUserCaps();
  if (!caps) redirect("/login");
  if (!caps.revisoria) redirect("/?error=Sin+acceso+a+Revisor%C3%ADa");

  const transacciones = await leerTransaccionesFiscales();
  const filtros = filtrosDesdeParams(await searchParams);

  return (
    <main className="min-h-dvh">
      {transacciones === null ? (
        <div className="max-w-xl mx-auto px-4 py-16 text-center">
          <p className="text-sm rounded-[var(--radius-card)] px-4 py-4"
            style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-text)", border: "1px solid var(--color-gold)" }}>
            Tu usuario no tiene acceso al reporte de donaciones. Pídele a un administrador que revise tu rol.
          </p>
        </div>
      ) : (
        <RevisoriaShell transacciones={transacciones} filtrosIniciales={filtros} />
      )}
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCents } from "@/lib/money";
import { createItemAction, toggleItemActiveAction } from "./actions";

const STAFF_ROLES = ["pastor_sede", "admin_casa", "super_admin"];

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !STAFF_ROLES.includes(profile.role)) {
    redirect("/?error=Sin%20permiso");
  }

  const { data: items } = await supabase
    .from("rentable_items")
    .select("id, name, description, unit_price_cents, total_quantity, active")
    .order("active", { ascending: false })
    .order("name");

  return (
    <main className="min-h-dvh px-4 py-4 max-w-2xl mx-auto space-y-4">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="eyebrow">Catálogo</p>
          <h1 className="font-serif text-2xl mt-1 tracking-[-0.02em]">
            Items
          </h1>
        </div>
        <Link href="/admin" className="text-sm underline text-fg2">
          ← Admin
        </Link>
      </header>

      {ok && (
        <p
          role="status"
          className="text-sm rounded-[14px] px-4 py-3 border border-[color:var(--color-sage-200)] bg-sage-100"
        >
          {ok}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="text-sm rounded-[14px] px-4 py-3"
          style={{ background: "#f2e3dd", color: "var(--color-critical)" }}
        >
          {error}
        </p>
      )}

      <section className="card space-y-3">
        <h2 className="eyebrow">Agregar item</h2>
        <form action={createItemAction} className="space-y-3">
          <div>
            <label htmlFor="name" className="block text-xs text-fg2 mb-1">
              Nombre
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="Sillas plegables"
              className="input"
            />
          </div>
          <div>
            <label
              htmlFor="description"
              className="block text-xs text-fg2 mb-1"
            >
              Descripción <span className="opacity-60">(opcional)</span>
            </label>
            <input
              id="description"
              name="description"
              type="text"
              placeholder="Sillas para hasta 80 personas"
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="unit_price"
                className="block text-xs text-fg2 mb-1"
              >
                Precio (COP por reserva)
              </label>
              <input
                id="unit_price"
                name="unit_price"
                type="text"
                inputMode="numeric"
                required
                placeholder="50000"
                className="input"
              />
            </div>
            <div>
              <label
                htmlFor="total_quantity"
                className="block text-xs text-fg2 mb-1"
              >
                Cantidad disponible
              </label>
              <input
                id="total_quantity"
                name="total_quantity"
                type="number"
                min={0}
                required
                placeholder="100"
                className="input"
              />
            </div>
          </div>
          <button
            type="submit"
            className="btn-primary"
          >
            Crear
          </button>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="eyebrow">Items existentes</h2>
        {(items ?? []).length === 0 ? (
          <p className="text-sm text-fg3">Aún no hay items.</p>
        ) : (
          <ul className="space-y-2">
            {(items ?? []).map((item) => (
              <li
                key={item.id}
                className={`rounded-[14px] border bg-bg-elev p-3 ${
                  item.active ? "border-line" : "border-line opacity-60"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/admin/items/${item.id}`}
                    className="font-medium underline"
                  >
                    {item.name}
                  </Link>
                  {!item.active && (
                    <span className="eyebrow">Inactivo</span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-fg2">{item.description}</p>
                )}
                <p className="text-xs text-fg2 mt-1">
                  {formatCents(item.unit_price_cents)} · {item.total_quantity}{" "}
                  unidades
                </p>
                <form
                  action={toggleItemActiveAction}
                  className="mt-2 inline-block"
                >
                  <input type="hidden" name="id" value={item.id} />
                  <input
                    type="hidden"
                    name="next_active"
                    value={item.active ? "false" : "true"}
                  />
                  <button
                    type="submit"
                    className="text-xs underline text-fg2"
                  >
                    {item.active ? "Desactivar" : "Activar"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

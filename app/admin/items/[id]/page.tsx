import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateItemAction } from "../actions";

const STAFF_ROLES = ["pastor_sede", "admin_casa", "super_admin"];

export default async function EditItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
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

  const { data: item } = await supabase
    .from("rentable_items")
    .select("id, name, description, unit_price_cents, total_quantity, active")
    .eq("id", id)
    .maybeSingle();

  if (!item) notFound();

  return (
    <main className="min-h-dvh px-4 py-4 max-w-md mx-auto space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Editar item</h1>
        <Link
          href="/admin/items"
          className="text-sm underline text-gray-600 dark:text-gray-400"
        >
          ← Items
        </Link>
      </header>

      {ok && (
        <p
          role="status"
          className="text-sm rounded-md border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/40 px-3 py-2"
        >
          {ok}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="text-sm rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 px-3 py-2"
        >
          {error}
        </p>
      )}

      <form action={updateItemAction} className="space-y-3">
        <input type="hidden" name="id" value={item.id} />
        <div>
          <label htmlFor="name" className="block text-xs text-gray-500 mb-1">
            Nombre
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={item.name}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
          />
        </div>
        <div>
          <label
            htmlFor="description"
            className="block text-xs text-gray-500 mb-1"
          >
            Descripción <span className="opacity-60">(opcional)</span>
          </label>
          <input
            id="description"
            name="description"
            type="text"
            defaultValue={item.description ?? ""}
            className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="unit_price"
              className="block text-xs text-gray-500 mb-1"
            >
              Precio (COP)
            </label>
            <input
              id="unit_price"
              name="unit_price"
              type="text"
              inputMode="numeric"
              required
              defaultValue={String(item.unit_price_cents / 100)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
            />
          </div>
          <div>
            <label
              htmlFor="total_quantity"
              className="block text-xs text-gray-500 mb-1"
            >
              Cantidad
            </label>
            <input
              id="total_quantity"
              name="total_quantity"
              type="number"
              min={0}
              required
              defaultValue={item.total_quantity}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-3 py-2"
            />
          </div>
        </div>
        <button
          type="submit"
          className="rounded-md bg-black text-white px-4 py-2 text-sm font-medium dark:bg-white dark:text-black"
        >
          Guardar cambios
        </button>
      </form>
    </main>
  );
}

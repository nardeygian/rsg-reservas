"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parsePesosToCents } from "@/lib/money";

const STAFF_ROLES = ["pastor_sede", "admin_casa", "super_admin"];

async function requireStaff() {
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
  return supabase;
}

function back(params: Record<string, string>, id?: string): never {
  const sp = new URLSearchParams(params);
  const path = id ? `/admin/items/${id}` : "/admin/items";
  redirect(`${path}?${sp.toString()}`);
}

type ItemFields = {
  name: string;
  description: string | null;
  unitPriceCents: number;
  totalQuantity: number;
};

type ParseResult =
  | { ok: true; data: ItemFields }
  | { ok: false; error: string };

function parseForm(formData: FormData): ParseResult {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const priceRaw = String(formData.get("unit_price") ?? "");
  const qtyRaw = String(formData.get("total_quantity") ?? "");

  if (!name) return { ok: false, error: "El nombre es obligatorio." };

  const unitPriceCents = parsePesosToCents(priceRaw);
  if (unitPriceCents === null) {
    return { ok: false, error: "Precio inválido." };
  }

  const totalQuantity = Number(qtyRaw);
  if (!Number.isInteger(totalQuantity) || totalQuantity < 0) {
    return { ok: false, error: "Cantidad inválida." };
  }

  return {
    ok: true,
    data: { name, description, unitPriceCents, totalQuantity },
  };
}

export async function createItemAction(formData: FormData) {
  const parsed = parseForm(formData);
  if (!parsed.ok) back({ error: parsed.error });

  const supabase = await requireStaff();
  const { error } = await supabase.from("rentable_items").insert({
    name: parsed.data.name,
    description: parsed.data.description,
    unit_price_cents: parsed.data.unitPriceCents,
    total_quantity: parsed.data.totalQuantity,
  });
  if (error) back({ error: `No se pudo crear: ${error.message}` });

  revalidatePath("/admin/items");
  back({ ok: "Item creado." });
}

export async function updateItemAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) back({ error: "Item no encontrado." });

  const parsed = parseForm(formData);
  if (!parsed.ok) back({ error: parsed.error }, id);

  const supabase = await requireStaff();
  const { error } = await supabase
    .from("rentable_items")
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      unit_price_cents: parsed.data.unitPriceCents,
      total_quantity: parsed.data.totalQuantity,
    })
    .eq("id", id);
  if (error) back({ error: `No se pudo guardar: ${error.message}` }, id);

  revalidatePath(`/admin/items`);
  revalidatePath(`/admin/items/${id}`);
  back({ ok: "Cambios guardados." }, id);
}

export async function toggleItemActiveAction(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const nextActive = String(formData.get("next_active") ?? "") === "true";
  if (!id) back({ error: "Item no encontrado." });

  const supabase = await requireStaff();
  const { error } = await supabase
    .from("rentable_items")
    .update({ active: nextActive })
    .eq("id", id);
  if (error) back({ error: `No se pudo cambiar el estado: ${error.message}` });

  revalidatePath("/admin/items");
  back({ ok: nextActive ? "Item activado." : "Item desactivado." });
}

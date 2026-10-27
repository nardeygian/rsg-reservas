import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { svReadData } from "@/app/servicio/_lib/data";
import { DiscipuladosShell } from "./DiscipuladosShell";

const ALLOWED = ["super_admin", "pastor_sede"];

export default async function DiscipuladosAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) redirect("/?error=Sin+permiso");

  const svData = await svReadData();

  return <DiscipuladosShell svData={svData} />;
}

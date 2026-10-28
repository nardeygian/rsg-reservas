"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { revocarInvitacion } from "@/lib/cuentas/acciones";

export function RevocarInvitacion({ id }: { id: string }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pendiente}
      className="btn-ghost text-[14px] min-h-[40px] px-3"
      style={{ color: "var(--color-down)" }}
      onClick={() =>
        start(async () => {
          const r = await revocarInvitacion(id);
          if (!r.ok) alert(r.error);
          router.refresh();
        })
      }
    >
      {pendiente ? "…" : "Anular"}
    </button>
  );
}

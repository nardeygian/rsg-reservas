"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";

/* ── Buscador de usuarios ── */
export function UserSearch({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (timer.current) clearTimeout(timer.current);
    const val = e.target.value;
    timer.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (val) next.set("q", val);
      else next.delete("q");
      startTransition(() => router.replace(`?${next.toString()}`));
    }, 280);
  }

  return (
    <div style={{ position: "relative" }}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--color-faint)",
          pointerEvents: "none",
        }}
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="search"
        placeholder="Buscar por nombre…"
        defaultValue={defaultValue}
        onChange={onChange}
        className="input w-full"
        style={{ paddingLeft: 38 }}
        aria-label="Buscar usuarios"
      />
    </div>
  );
}

/* ── Formulario de invitación (colapsable) ── */
export function InviteSection({
  roles,
  inviteAction,
}: {
  roles: { value: string; label: string }[];
  inviteAction: (data: FormData) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "14px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span className="font-semibold text-sm" style={{ color: "var(--color-ink)" }}>
          + Invitar usuario
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{
            color: "var(--color-muted)",
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--color-line)" }}>
          <p className="text-sm mt-3 mb-4" style={{ color: "var(--color-muted)" }}>
            Le enviamos un correo con un enlace para que defina su contraseña.
            Útil para admin del Estudio, admin de casa o pastores de sede que
            no se registran solos.
          </p>
          <form action={inviteAction} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Nombre completo</span>
              <input name="full_name" type="text" required className="input" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Email</span>
              <input name="email" type="email" required className="input" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="eyebrow">Rol</span>
              <select name="role" required defaultValue="studio_admin" className="input">
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-primary w-full mt-1">
              Enviar invitación
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

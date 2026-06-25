"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type Space = { id: string; name: string };

export function SpaceFilter({
  spaces,
  current,
}: {
  spaces: Space[];
  current: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  return (
    <select
      aria-label="Filtrar por espacio"
      value={current ?? ""}
      disabled={pending}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        if (e.target.value) next.set("space", e.target.value);
        else next.delete("space");
        startTransition(() => {
          router.push(`?${next.toString()}`);
        });
      }}
      className="rounded-md border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-sm"
    >
      <option value="">Todos los espacios</option>
      {spaces.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

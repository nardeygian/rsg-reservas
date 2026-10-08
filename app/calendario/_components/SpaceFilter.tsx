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

  function navigate(spaceId: string) {
    const next = new URLSearchParams(params.toString());
    if (spaceId) next.set("space", spaceId);
    else next.delete("space");
    startTransition(() => router.push(`?${next.toString()}`));
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <button
        type="button"
        onClick={() => navigate("")}
        disabled={pending}
        className="inline-flex items-center px-3 py-[5px] rounded-full text-[12.5px] font-semibold border transition"
        style={
          !current
            ? {
                background: "var(--color-accent-soft)",
                color: "var(--color-accent)",
                borderColor: "var(--color-accent)",
              }
            : {
                background: "var(--color-surface)",
                color: "var(--color-muted)",
                borderColor: "var(--color-line)",
              }
        }
      >
        Todos
      </button>
      {spaces.map((s) => {
        const active = current === s.id;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => navigate(s.id)}
            disabled={pending}
            className="inline-flex items-center px-3 py-[5px] rounded-full text-[12.5px] font-semibold border transition"
            style={
              active
                ? {
                    background: "var(--color-accent-soft)",
                    color: "var(--color-accent)",
                    borderColor: "var(--color-accent)",
                  }
                : {
                    background: "var(--color-surface)",
                    color: "#3E4A45",
                    borderColor: "var(--color-line)",
                  }
            }
          >
            {s.name}
          </button>
        );
      })}
    </div>
  );
}

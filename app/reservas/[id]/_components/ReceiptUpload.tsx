"use client";

import { useRef, useState } from "react";

export function ReceiptUpload({
  bookingId,
  action,
}: {
  bookingId: string;
  action: (fd: FormData) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={bookingId} />

      <button
        type="button"
        className="rounded-[12px] border-2 border-dashed px-4 py-5 flex flex-col items-center gap-2 w-full text-left transition"
        style={{
          borderColor: file ? "var(--color-accent)" : "var(--color-line)",
          background: file ? "var(--color-accent-soft)" : "var(--color-surface-2)",
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          name="receipt"
          accept="image/png,image/jpeg,application/pdf"
          required
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: file ? "var(--color-accent)" : "var(--color-muted)" }}
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span
          className="text-sm font-medium"
          style={{ color: file ? "var(--color-accent)" : "var(--color-muted)" }}
        >
          {file ? file.name : "Toca para elegir archivo"}
        </span>
        <span className="text-xs" style={{ color: "var(--color-muted)" }}>
          PDF, PNG o JPG · máx. 5 MB
        </span>
      </button>

      {file && (
        <button type="submit" className="btn-primary">
          Subir comprobante
        </button>
      )}
    </form>
  );
}

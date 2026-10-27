"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "rsg-theme";

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle({
  className = "",
}: {
  className?: string;
}) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  // Lee preferencia al montar.
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
    setThemeState(stored);
    setMounted(true);
  }, []);

  function setTheme(next: Theme) {
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
    setThemeState(next);
  }

  // Cuando el modo system está activo, escucha cambios del SO.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  if (!mounted) {
    // Placeholder mismo tamaño para no causar layout shift.
    return (
      <div
        aria-hidden
        className={`inline-flex items-center justify-center w-9 h-9 ${className}`}
      />
    );
  }

  const next: Theme =
    theme === "light" ? "dark" : theme === "dark" ? "system" : "light";

  const icon = theme === "light" ? <SunIcon /> : theme === "dark" ? <MoonIcon /> : <SystemIcon />;
  const label =
    theme === "light"
      ? "Tema: claro"
      : theme === "dark"
        ? "Tema: oscuro"
        : "Tema: sistema";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`${label}. Cambiar a ${
        next === "light" ? "claro" : next === "dark" ? "oscuro" : "sistema"
      }.`}
      title={label}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-[var(--color-bg-muted)] transition ${className}`}
      style={{ color: "var(--color-muted)" }}
    >
      <span aria-hidden>{icon}</span>
    </button>
  );
}

const iconProps = {
  width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
};

function SunIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

// Sistema: círculo mitad lleno (sigue el modo del teléfono o computador).
function SystemIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

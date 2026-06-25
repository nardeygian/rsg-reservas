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

  const icon = theme === "light" ? "☀" : theme === "dark" ? "☾" : "✦";
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
      className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-base hover:bg-[var(--color-bg-muted)] transition ${className}`}
    >
      <span aria-hidden>{icon}</span>
    </button>
  );
}

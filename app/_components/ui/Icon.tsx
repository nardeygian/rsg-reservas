import type { CSSProperties } from "react";

// Set de íconos del portal: un solo trazo (1.9), esquinas redondeadas y
// color heredado (currentColor). Reemplaza emojis y símbolos de texto.

const PATHS = {
  "chevron-left":  <polyline points="15 18 9 12 15 6" />,
  "chevron-right": <polyline points="9 6 15 12 9 18" />,
  "chevron-down":  <polyline points="6 9 12 15 18 9" />,
  "chevron-up":    <polyline points="6 15 12 9 18 15" />,
  "arrow-right":   <><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>,
  close:           <><path d="M18 6 6 18" /><path d="M6 6l12 12" /></>,
  check:           <polyline points="20 6 9 17 4 12" />,
  "check-circle":  <><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></>,
  "x-circle":      <><circle cx="12" cy="12" r="9" /><path d="M15 9l-6 6M9 9l6 6" /></>,
  repeat:          <><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></>,
  lock:            <><rect x="4" y="11" width="16" height="10" rx="2.5" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  "calendar-plus": <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5" /></>,
  "map-pin":       <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  paperclip:       <path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9" />,
  copy:            <><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></>,
  clock:           <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  users:           <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
  plus:            <><path d="M12 5v14" /><path d="M5 12h14" /></>,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 16,
  strokeWidth = 1.9,
  className,
  style,
  label,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
  /** Texto para lectores de pantalla cuando el ícono va solo. */
  label?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flex: "none", ...style }}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {PATHS[name]}
    </svg>
  );
}

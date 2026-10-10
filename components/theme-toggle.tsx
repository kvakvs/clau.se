"use client";

import { useEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { isTheme, THEME_KEY, themes, type Theme } from "@/lib/theme";

type Props = { label: string; names: Record<Theme, string> };

const listeners = new Set<() => void>();
// Fallback when localStorage is unavailable (private mode, blocked storage).
let memoryTheme: Theme = "auto";

function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return isTheme(stored) ? stored : "auto";
  } catch {
    return memoryTheme;
  }
}

function writeTheme(theme: Theme) {
  memoryTheme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "auto" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

const icons: Record<Theme, React.ReactNode> = {
  light: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  auto: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </>
  ),
  dark: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
};

export function ThemeToggle({ label, names }: Props) {
  const theme = useSyncExternalStore(subscribe, readTheme, (): Theme => "auto");

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "auto") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => applyTheme("auto");
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  }, [theme]);

  return (
    <div
      role="group"
      aria-label={label}
      className="flex rounded-full border border-border bg-card p-0.5"
    >
      {themes.map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={theme === t}
          aria-label={names[t]}
          title={names[t]}
          onClick={() => writeTheme(t)}
          className={cn(
            "rounded-full p-1.5 transition-colors",
            theme === t
              ? "bg-accent-soft text-accent"
              : "text-muted hover:text-fg",
          )}
        >
          <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {icons[t]}
          </svg>
        </button>
      ))}
    </div>
  );
}

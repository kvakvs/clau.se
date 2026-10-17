"use client";

import { usePathname } from "next/navigation";
import {
  isLocale,
  LOCALE_KEY,
  localeNames,
  locales,
  switchLocalePath,
  type Locale,
} from "@/lib/i18n";

type Props = { locale: Locale; label: string };

export function LanguageSelect({ locale, label }: Props) {
  const pathname = usePathname();

  function change(value: string) {
    if (!isLocale(value)) return;
    try {
      localStorage.setItem(LOCALE_KEY, value);
    } catch {}
    window.location.assign(
      switchLocalePath(pathname, value) + window.location.hash,
    );
  }

  return (
    <label className="relative flex items-center">
      <span className="sr-only">{label}</span>
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-2.5 size-4 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
      <select
        value={locale}
        onChange={(e) => change(e.target.value)}
        className="appearance-none rounded-full border border-border bg-card py-1.5 pr-3 pl-8 text-sm text-fg hover:border-muted"
      >
        {locales.map((l) => (
          <option key={l} value={l} lang={l}>
            {localeNames[l]}
          </option>
        ))}
      </select>
    </label>
  );
}

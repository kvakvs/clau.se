"use client";

import { cn } from "@/lib/cn";
import type { Consent } from "@/lib/consent";
import { setConsent, useConsent } from "@/lib/use-consent";
import type { Messages } from "@/messages/en";

type Props = { t: Messages["cookies"] };

/** The current analytics choice with buttons to change it. */
export function CookieSettings({ t }: Props) {
  const consent = useConsent();
  const state =
    consent === "granted"
      ? t.granted
      : consent === "denied"
        ? t.denied
        : t.unset;
  const choices: [Consent, string][] = [
    ["denied", t.decline],
    ["granted", t.accept],
  ];

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted">
        {t.current.replace("{state}", consent === undefined ? "" : state)}
      </span>
      {choices.map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={consent === value}
          onClick={() => setConsent(value)}
          className={cn(
            "rounded-md border px-3 py-1 font-medium",
            consent === value
              ? "border-accent text-accent"
              : "border-border hover:border-accent",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

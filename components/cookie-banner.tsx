"use client";

import { setConsent, useConsent } from "@/lib/use-consent";
import type { Messages } from "@/messages/en";

type Props = { lang: string; t: Messages["cookies"] };

const button =
  "rounded-md border border-border px-2.5 py-1 font-medium text-fg hover:border-accent";

/** Small corner notice asking for analytics consent until a choice is made. */
export function CookieBanner({ lang, t }: Props) {
  const consent = useConsent();
  if (consent !== null) return null;

  return (
    <div
      role="region"
      aria-label={t.title}
      className="fixed inset-x-2 bottom-2 z-50 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted shadow-lg sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-md"
    >
      <p className="flex-1 basis-56">
        {t.banner}{" "}
        <a href={`/${lang}/cookies/`} className="text-accent hover:underline">
          {t.policyLink}
        </a>
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className={button}
          onClick={() => setConsent("denied")}
        >
          {t.decline}
        </button>
        <button
          type="button"
          className={button}
          onClick={() => setConsent("granted")}
        >
          {t.accept}
        </button>
      </div>
    </div>
  );
}

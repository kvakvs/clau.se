"use client";

import { useSyncExternalStore } from "react";
import { CONSENT_KEY, type Consent } from "@/lib/consent";

type AnalyticsWindow = Window & { clauseAnalytics?: () => void };

const listeners = new Set<() => void>();
// Fallback when localStorage is unavailable (private mode, blocked storage).
let memoryConsent: Consent | null = null;

function readConsent(): Consent | null {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    return stored === "granted" || stored === "denied" ? stored : null;
  } catch {
    return memoryConsent;
  }
}

function subscribe(notify: () => void) {
  listeners.add(notify);
  window.addEventListener("storage", notify);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", notify);
  };
}

/** Removes the Google Analytics cookies (_ga, _ga_<id>) on every domain level. */
function clearAnalyticsCookies() {
  const host = location.hostname;
  const domains = ["", host, `.${host.split(".").slice(-2).join(".")}`];
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (!name?.startsWith("_ga")) continue;
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain ? `; domain=${domain}` : ""}`;
    }
  }
}

/**
 * Records the visitor's choice. Accepting loads Google Analytics right away;
 * withdrawing an earlier consent deletes its cookies and reloads the page so
 * the loaded tag stops.
 */
export function setConsent(consent: Consent) {
  const previous = readConsent();
  memoryConsent = consent;
  try {
    localStorage.setItem(CONSENT_KEY, consent);
  } catch {}
  listeners.forEach((notify) => notify());
  if (consent === "granted") {
    (window as AnalyticsWindow).clauseAnalytics?.();
  } else if (previous === "granted") {
    clearAnalyticsCookies();
    location.reload();
  }
}

/** The stored choice: undefined before hydration, null when not made yet. */
export function useConsent(): Consent | null | undefined {
  return useSyncExternalStore(subscribe, readConsent, () => undefined);
}

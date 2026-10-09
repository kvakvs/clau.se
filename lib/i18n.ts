export const locales = ["en", "sv", "es", "uk", "fr", "de", "pt"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const LOCALE_KEY = "locale";

export const localeNames = {
  en: "English",
  sv: "Svenska",
  es: "Español",
  uk: "Українська",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
} as const satisfies Record<Locale, string>;

export function isLocale(value: unknown): value is Locale {
  return (locales as readonly unknown[]).includes(value);
}

/** Replaces the locale (first path segment) of a site path. */
export function switchLocalePath(pathname: string, locale: Locale): string {
  const [, , ...rest] = pathname.split("/");
  const tail = rest.join("/");
  return `/${locale}/${tail}`.replace(/\/?$/, "/");
}

/**
 * Inline script for the site root: picks the saved locale, else the first
 * supported browser language, else the default, and redirects there.
 */
export const localeRedirectScript = `(function(){
var l=${JSON.stringify(locales)},s;
try{s=localStorage.getItem(${JSON.stringify(LOCALE_KEY)})}catch(e){}
if(l.indexOf(s)<0){s=${JSON.stringify(defaultLocale)};
var n=navigator.languages||[navigator.language];
for(var i=0;i<n.length;i++){var p=String(n[i]).toLowerCase().split("-")[0];if(l.indexOf(p)>=0){s=p;break}}}
location.replace("/"+s+"/"+location.search+location.hash)})()`;

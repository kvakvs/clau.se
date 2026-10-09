export const themes = ["light", "auto", "dark"] as const;

export type Theme = (typeof themes)[number];

export const THEME_KEY = "theme";

export function isTheme(value: unknown): value is Theme {
  return (themes as readonly unknown[]).includes(value);
}

/** Inline script run before first paint so the page never flashes the wrong theme. */
export const themeInitScript = `(function(){var t;
try{t=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}
var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);
var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light"})()`;

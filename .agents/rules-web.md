# Web Coding Rules (Next.js / TypeScript / React / Tailwind CSS)

Rules for agents writing code in this repository. Keep the site minimal: few
dependencies, few components, no speculative abstractions.

## Stack and Hosting

- Next.js latest stable, App Router only (`app/`), no Pages Router.
- React latest stable, TypeScript latest stable, Tailwind CSS v4.
- Package manager: `pnpm` (on windows host). Commit `package-lock.json`. No yarn/pnpm lockfiles.
- Main branch is `master`. Hosting is Nginx on virtual dedicated host, uploaded via SSH.
  - Forbidden: API routes, route handlers with dynamic behavior, middleware,
    server actions, `cookies()`, `headers()`, ISR/`revalidate`, runtime
    `fetch` on the server, `next/image` optimization (set
    `images.unoptimized: true` if `next/image` is used at all).
  - Dynamic routes must define `generateStaticParams`.
  - If deployed under a sub-path, set `basePath` in one place; never hardcode
    the prefix in links or asset URLs.
  - Drop static export only after an explicit hosting decision; record it here.
- Everything that depends on the visitor (theme, language) is resolved on the
  client. Build-time data (docs content) is read in Server Components at build.

## Project Layout

```
app/                 routes (layout.tsx, page.tsx, docs/, resources/)
components/          shared UI components (one component per file)
lib/                 non-UI code: i18n, theme, docs loading, helpers
messages/            translation dictionaries: en.ts, sv.ts, es.ts, uk.ts
content/docs/        Markdown copied from ../clau/docs (see Documentation)
public/              static assets
scripts/             build helper scripts (e.g. docs sync)
```

- Use the `@/` import alias for project-root imports; no deep `../../..`.
- File names: `kebab-case.tsx`; component names `PascalCase`; hooks
  `useSomething` in `lib/` or next to their only consumer.

## TypeScript

- `strict: true`, plus `noUncheckedIndexedAccess` and
  `noImplicitOverride`. Build must pass `tsc --noEmit` with zero errors.
- No `any`. Use `unknown` and narrow. No `@ts-ignore`; `@ts-expect-error`
  only with a comment explaining why.
- Prefer `type` aliases; use `interface` only when declaration merging is
  needed. Export types used across files.
- Prefer union string literals and `as const` objects over `enum`.
- Use `satisfies` to type-check constant tables (e.g. dictionaries, feature
  lists) without widening.
- Named exports everywhere, except where Next.js requires default exports
  (`page.tsx`, `layout.tsx`, `not-found.tsx`, `next.config.ts`).

## React

- Server Components by default. Add `"use client"` only to the smallest leaf
  that needs state, effects, browser APIs or event handlers (theme toggle,
  language dropdown). Never mark a layout or page as a client component.
- Function components only. Props typed inline or via a named `type`.
- No `useEffect` for derived state; compute during render. Use effects only
  to sync with external systems (`matchMedia`, `localStorage`,
  `navigator.languages`).
- Access `window`, `document`, `localStorage`, `navigator` only inside effects
  or event handlers, never during render (static export prerenders on build).
- Keys are stable IDs, never array indices for reorderable lists.
- No global state library. React context only for theme and locale.
- Accessibility: semantic elements (`header`, `nav`, `main`, `footer`,
  `button`, `a`), visible focus styles, `aria-label` on icon-only buttons,
  `lang` attribute on `<html>` updated to the active locale.
- Use `next/link` for internal navigation, plain `<a>` with
  `rel="noopener noreferrer"` for external links.

## Tailwind CSS

- Tailwind v4 CSS-first configuration in `app/globals.css` (`@import
  "tailwindcss";`, `@theme { ... }`). No `tailwind.config.js` unless a plugin
  requires it.
- Dark mode is class-based so the manual toggle works:
  `@custom-variant dark (&:where(.dark, .dark *));`
- Define colors as semantic tokens (`--color-bg`, `--color-fg`,
  `--color-muted`, `--color-accent`, `--color-border`, `--color-card`) in
  `@theme`, override them under `.dark`. Components use the tokens
  (`bg-bg`, `text-fg`), not raw palette colors, so both themes stay
  consistent. Use `dark:` variants only for one-off exceptions.
- Utility classes in markup; no CSS modules, no styled-components. Use
  `@apply` sparingly, only in `globals.css` for prose/base element styles.
- Long or conditional class lists: use a tiny `cn()` helper in `lib/` (plain
  join of truthy strings). Add `clsx`/`tailwind-merge` only if really needed.
- Mobile first: base styles for small screens, `sm:`/`md:`/`lg:` for larger.
  No horizontal scroll at 360px width.
- Markdown docs rendering: `@tailwindcss/typography` (`prose
  dark:prose-invert`) is allowed.

## Theme (Light / Auto / Dark)

- Selector in the top right of the header, three states: `light`, `auto`,
  `dark`. Default `auto`. Persist choice in `localStorage` key `theme`.
- `auto` follows `window.matchMedia("(prefers-color-scheme: dark)")` and
  reacts to its `change` event live.
- Prevent flash of wrong theme: a small inline blocking `<script>` in
  `<head>` of the root layout reads `localStorage` and sets the `dark` class
  on `<html>` before first paint. Add `suppressHydrationWarning` on `<html>`.
- Wrap all `localStorage` access in `try/catch` (private mode, blocked
  storage).

## Internationalization

- Locales: `en` (default), `sv`, `es`, `uk`. Locale type is the union
  `"en" | "sv" | "es" | "uk"`; one source list in `lib/i18n.ts`.
- No i18n library unless requirements grow; dictionaries are plain typed
  objects in `messages/<locale>.ts`. `en.ts` is the source of truth; other
  dictionaries are typed `satisfies Messages` (derived from `en`) so a missing
  key is a compile error.
- Detection on the client: saved choice in `localStorage` key `locale` wins;
  otherwise the first entry of `navigator.languages` whose primary subtag
  (`sv-SE` -> `sv`) is supported; otherwise `en`.
- Language dropdown sits in the top right, next to the theme selector. Show
  each language in its own name (English, Svenska, Español, Українська).
- Never hardcode user-visible strings in components; all text goes through
  the dictionary. Technical names (Erlang, LLVM, OTP, Clause, `clau`) stay
  untranslated.
- Documentation Markdown from `../clau/docs` is not translated; only the
  surrounding UI (headings, notices, navigation) is.

## Documentation Pages

- Source of truth is `../clau/docs`. It is outside this repository and absent
  in CI, so copy it into `content/docs/` with a script in `scripts/`
  (`npm run sync-docs`) and commit the copy. Never import from `../clau`
  directly in app code.
- Table of contents order is defined explicitly in `lib/docs.ts` (Getting
  started, Building the compiler, Using the compiler, Interpreting results,
  Differences from Erlang/OTP, then remaining files alphabetically).
- Render each doc page as a static route via `generateStaticParams`. Render
  Markdown on the server at build time (e.g. `react-markdown` + `remark-gfm`);
  no client-side Markdown parsing. Rewrite relative `.md` links between docs to
  site routes.

## Quality Gates

Before declaring work done, run and pass:

```
npm run lint        # ESLint (next/core-web-vitals + typescript rules)
npx tsc --noEmit
npm run build       # must produce the static export in out/
```

- Format with Prettier (`prettier-plugin-tailwindcss` to sort classes).
- No console errors or hydration warnings in the browser on any page, in both
  themes and all four locales.
- Check pages at mobile (360px) and desktop widths in light and dark.

## Dependencies

- Add a dependency only when it removes real complexity. Justify each new
  package in the commit message.
- No UI kits (MUI, Chakra, shadcn bulk installs), no icon packs for a handful
  of icons (inline SVG instead), no analytics or trackers.

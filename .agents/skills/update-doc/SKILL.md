---
name: update-doc
description: Refresh the clau.se front page (intro, status, feature cards, feature details) and the documentation summaries from the current state of ../clau (docs/, README.md, .agents/00-finished.md, .agents/01-todo.md), then translate every changed string into all site languages. Use when the user runs /update-doc or asks to update the front page or features from the project.
disable-model-invocation: true
argument-hint: "[docs] [full]"
---

# Update the front page from ../clau

Brings the site's description of Clause in line with the project: what it
does, what works now and what is still missing. Edits the dictionaries in
`messages/`, never the page components, unless a new kind of content needs
markup.

Arguments (`$ARGUMENTS`, any order):

- `docs`: also bring the translated documentation in `content/docs/<locale>/`
  up to date after the sync (step 7).
- `full`: ignore the last recorded source commit and review all text against
  the whole project, not only what changed since.

## Sources

All in `../clau` (stop and report if it is missing):

- `README.md`: project summary, prerequisites, build and usage.
- `docs/*.md`: current behavior; `docs/features.md` and `docs/differences.md`
  matter most for the front page.
- `.agents/00-finished.md`: delivered work. Its table and "Still unfinished"
  paragraph give the overall status.
- `.agents/01-todo.md`: remaining work and deferred scope (D01–D07).

The files in `.agents/` are internal planning notes. Use them for facts
(what is delivered, what is missing), never copy their wording, plan step
numbers, feature IDs (`F13`, `D02`) or dates into the site.

## What gets updated

All in `messages/en.ts` first; it is the source of truth:

- `meta.description`, `footer.tagline`: only if the project summary changed.
  Also always set last updated date in footer (in YYYY-MM-DD format): the
  footer shows `updatedAt` of `content/home-meta.json` (step 6) after
  `footer.updated`.
- `home.title`, `home.intro`: what Clause is.
- `home.status`: what works today and what is still missing, in one or two
  sentences. Mention the main gaps (for example platforms not validated yet)
  in general terms.
- `home.cards`: 6 headline features (keep 6, or 9 for a 3-column grid). Each
  has a stable `id` (kebab-case, keep existing ids when the feature is the
  same, so React keys and translations line up), a short `property` (a fact,
  number, command or keyword shown large in monospace: keep it short, at most
  about 20 characters, and language-neutral where possible), a `title` and one
  sentence of `text`.
- `home.details`: grouped feature list (Frontend, Compiler, Runtime, Projects
  and tooling; add a group only when a new area appears). One line per
  feature, plain statements of what works, no qualifiers like "partial" unless
  the limitation is important to a user.
- `docs.featured.*.text`: one-line summaries of the featured doc pages, if
  their content changed (prerequisites, build steps, options).
- The paragraphs of documentation (typically first) which state implementation
  date, referring to plan steps - should not be displayed in the web.
  `pnpm sync-docs` strips them (`stripPlanReferences` in
  `scripts/sync-docs.mjs`): paragraph lead-ins such as `Plan 11 step 41T
(paths).` and parenthetical references such as `(plan step 37)`,
  `(OPT0.2A)`. Extend its patterns when a new form shows up in the copy.

Only claim what `docs/` or `00-finished.md` shows as delivered. Items that are
open in `01-todo.md` or listed as unfinished are not features, those can only be mentioned as planned; at most they appear in `home.status` as remaining work. When a source says a feature is
limited to a subset, describe it as a subset.

Style: technical, concise, neutral; no marketing words ("blazing",
"powerful", "seamless"). Technical names stay as written: Erlang, OTP, ERTS,
BEAM, LLVM, Clang, CMake, Clause, `clau`.

## Benchmarks Page

- IMPORTANT: Updating benchmarks requires recent benchmark results within last 3 hours. Skip the
  update if the results are too old.
- Use 🔺 emoji instead of asterisk to mark runs with unstable results.
- The geometric mean card needs to state whether we're on average slower or faster than BEAM JIT.
- Create a component for comparison bar diagrams
  - The blue bars (where Clause is faster) should say 'faster' in small font to the right
    of the bar left aligned to the zero line
  - The red bars (where Clause is slower) should say 'slower' in small font to the right
    of the bar, right aligned to the zero line
  - Whole programs chart also needs comparison bar diagrams added
- Latest benchmarks, summarize differences with latest benchmark report in Clause -O2 and OTP,
  this page can have a top menu item for it. The page is
  `app/[lang]/benchmarks/`, with strings in `benchmarks.*` and data in
  `content/benchmarks.json`, written by `pnpm sync-benchmarks` from the newest
  report in `../clau/benchmarks/history/reports/` (gitignored, so only on the
  host that ran it; if missing, keep the committed JSON and say so).

## Steps

1. **Find what changed.** Read `content/home-meta.json` (`{ "commit": "...",
"updatedAt": "YYYY-MM-DD" }`; missing on the first run, then treat as
   `full`). Unless `full`, list the changes since that commit:

   ```bash
   git -C ../clau log --oneline <commit>..HEAD -- README.md docs .agents/00-finished.md .agents/01-todo.md
   git -C ../clau diff <commit> -- README.md docs .agents/00-finished.md .agents/01-todo.md
   ```

   Also note uncommitted changes in those paths (`git -C ../clau status
--short -- ...`): read them, but mention to the user that the source is
   dirty. If nothing changed and not `full`, report that and stop.

2. **Sync the docs.** Run `pnpm sync-docs`, then `pnpm docs-status`, and keep
   the list of outdated and missing translations for the report. Run
   `pnpm sync-benchmarks`; if the geometric mean or the kernel list changed
   noticeably, check that `home.status` and `benchmarks.*` still read right.
3. **Read the sources.** With `full` or on the first run read all of them.
   Otherwise read the diffs from step 1 and as much of the surrounding files
   as needed to judge them; always reread `00-finished.md` (summary table and
   "Still unfinished") and the head of `01-todo.md`, since `home.status`
   depends on them.
4. **Compare and edit `messages/en.ts`.** Check every string listed under
   "What gets updated" against the sources: add newly delivered features,
   correct outdated claims, drop anything no longer true, update `status`.
   Keep unchanged strings byte-identical so step 5 can see what changed.
   Then show the user a short summary of the English changes (added, changed,
   removed strings).
5. **Translate.** Get the changed keys with `git diff messages/en.ts`. For
   each locale `sv`, `es`, `uk`, `fr`, `de`, `pt`, update
   `messages/<locale>.ts` so it has the same structure as `en.ts` (same keys,
   same card and detail ids in the same order, same array lengths) and
   translate only the changed or new strings; leave the other translations
   untouched. Follow `.agents/translation.md` ("What stays in English" and
   "Language notes"): `property` values that are code, commands or names stay
   as in English; translate words in them (such as "Per-process GC" or
   "7 targets"). Apply the Erlang terms rules (record, map, fun, bitstring,
   comprehension stay in English). Write UTF-8 with LF line endings. Work on
   the six files in parallel with subagents when there are many strings,
   giving each the changed English strings, the target file and
   `.agents/translation.md`.
6. **Record the source commit.** Write `content/home-meta.json` with the
   short `git -C ../clau rev-parse --short HEAD` and today's date
   (`updatedAt`), formatted like `content/docs-meta.json`.
7. **Docs translations (only with `docs`).** For each file that step 2 listed
   as outdated or missing, translate or update it per `.agents/translation.md`
   (one subagent per locale), stamp it with `pnpm -s docs-stamp <locale>
<file>.md...`, then rerun `pnpm docs-status` until it shows no `ERROR` and
   no outdated files. Without `docs`, only report the outdated list.
8. **Quality gates.** Run, stopping at the first failure and fixing it:

   ```powershell
   pnpm exec prettier --write messages content/home-meta.json content/benchmarks.json
   pnpm lint
   pnpm typecheck
   pnpm build
   ```

   A dictionary that lost or gained a key fails `typecheck` (`satisfies
Messages`). Do not open a browser.

9. **Report.** Source commit range used, English changes, locales updated,
   docs sync result and outdated translations left, gate results. Do not
   commit or deploy unless the user asks; suggest `/deploy` when done.

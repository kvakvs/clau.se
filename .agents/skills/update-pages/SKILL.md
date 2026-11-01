---
name: update-pages
description: Refresh the clau.se front page (intro, status, feature cards, feature details) and the documentation summaries from the current state of ../clau (docs/, README.md and the plan records in .agents/), then translate every changed string into all site languages. Use when the user runs /update-pages or asks to update the front page or features from the project.
disable-model-invocation: true
argument-hint: "[full]"
---

# Update the front page from ../clau

Brings the site's description of Clause in line with the project: what it
does, what works now and what is still missing. Edits the dictionaries in
`messages/`, never the page components, unless a new kind of content needs
markup.

Arguments (`$ARGUMENTS`):

- `full`: ignore the last recorded source commit and review all text against
  the whole project, not only what changed since.

The documentation pages and their translations are a separate skill,
`/update-docs` (`.agents/skills/update-docs/`); this one only syncs the
English copy it reads (step 2).

## Sources

All in `../clau` (stop and report if it is missing):

- `README.md`: project summary, prerequisites, build and usage.
- `docs/*.md`: current behavior; `docs/features.md` and `docs/differences.md`
  matter most for the front page.
- `.agents/00-finished.md`: index of delivered work. Its "Outstanding work
  to finish" list and "Deferred" paragraph give the overall status; it links
  the per-plan records (`.agents/<NN>-finished.md`).
- `.agents/<NN>-<name>.md` (`11-plan.md`, `30-dist.md`, ...): the open plans,
  one per area. The head of each (its "Today" summary) and its open steps
  give remaining work.

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
- `home.details`: grouped feature list (Frontend, Erlang semantics, Compiler,
  Runtime, OTP library, Projects and tooling; add a group only when a new area
  appears). One short line per feature, plain statements of what works, no
  qualifiers like "partial" unless the limitation is important to a user.
  Library support is named by module or OTP application (`ets`, `dets`,
  stdlib), never by function lists; details already in the docs stay there.
- `docs.featured.*.text`: one-line summaries of the featured doc pages, if
  their content changed (prerequisites, build steps, options).

Only claim what `docs/` or the finished records show as delivered. Items that are
open in a plan file or listed as unfinished are not features, those can only be mentioned as planned; at most they appear in `home.status` as remaining work. When a source says a feature is
limited to a subset, describe it as a subset.

Style: the front page is marketing for developers: highlights, not a
detailed overview; the docs hold the details. Technical and concise; no hype
words ("blazing", "powerful", "seamless"). Technical names stay as written: Erlang, OTP, ERTS,
BEAM, LLVM, Clang, CMake, Clause, `clau`.

The benchmarks page (`benchmarks.*`, `content/benchmarks.json`) is not part
of this skill: it is refreshed with `/update-benchmarks`
(`.agents/skills/update-benchmarks/`).

## Steps

1. **Find what changed.** Read `content/home-meta.json` (`{ "commit": "...",
"updatedAt": "YYYY-MM-DD" }`; missing on the first run, then treat as
   `full`). Unless `full`, list the changes since that commit:

   ```bash
   git -C ../clau log --oneline <commit>..HEAD -- README.md docs '.agents/[0-9]*.md'
   git -C ../clau diff <commit> -- README.md docs '.agents/[0-9]*.md'
   ```

   Also note uncommitted changes in those paths (`git -C ../clau status
--short -- ...`): read them, but mention to the user that the source is
   dirty. If nothing changed and not `full`, report that and stop.

2. **Sync the docs.** Follow steps 1–3 of `.agents/skills/update-docs/SKILL.md`
   (its `sync` mode: sync, check the copy, status) and keep the list of
   outdated and missing translations for the report.
3. **Read the sources.** With `full` or on the first run read all of them.
   Otherwise read the diffs from step 1 and as much of the surrounding files
   as needed to judge them; always reread `00-finished.md` (outstanding and
   deferred work) and the head of each open plan file, since `home.status`
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
7. **Quality gates.** Run, stopping at the first failure and fixing it:

   ```powershell
   pnpm exec prettier --write messages content/home-meta.json
   pnpm lint
   pnpm typecheck
   pnpm build
   ```

   A dictionary that lost or gained a key fails `typecheck` (`satisfies
Messages`). Do not open a browser.

8. **Report.** Source commit range used, English changes, locales updated,
   docs sync result and outdated translations left, gate results. Do not
   commit or deploy unless the user asks; suggest `/update-docs` when
   translations are outdated or missing, and `/deploy` when done.

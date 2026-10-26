---
name: update-docs
description: Sync the clau.se documentation pages from ../clau (docs/, docs/libraries/, the README's Quick start) into content/docs/en/ and bring the translations in content/docs/<locale>/ up to date. Use when the user runs /update-docs or asks to sync or translate the documentation.
disable-model-invocation: true
argument-hint: "[sync] [<locale>...] [<file>.md...]"
---

# Update the documentation from ../clau

Copies the developer notes of Clause into the site and keeps every
translation current with its English original. The front page text is a
separate skill, `/update-pages` (`.agents/skills/update-pages/`).

Arguments (`$ARGUMENTS`, any order):

- `sync`: sync and report only; translate nothing (steps 1–3).
- locale codes (`sv`, `es`, `uk`, `fr`, `de`, `pt`): translate only these.
  Default: all six.
- file names (`builtins.md`): translate only these. Default: every outdated
  or missing file.

## Sources and copies

- `../clau/docs/*.md` and `../clau/docs/libraries/*.md` (stop and report if
  `../clau` is missing). `pnpm sync-docs` (`scripts/sync-docs.mjs`) copies
  them into one flat directory, `content/docs/en/`, and rewrites relative
  links to be relative to `docs/` as if every page lived there. Subdirectories
  served this way are listed in `SUBDIRS`; two pages with the same file name
  fail the sync.
- The `## Quick start` section of `../clau/README.md` becomes
  `getting-started.md` (the `derived` table in the script).
- `content/docs-meta.json` records the source commit, a dirty flag and the
  sync date. Never edit `content/docs/en/` by hand.
- Translations: `content/docs/<locale>/<same name>.md`, stamped with
  frontmatter by `pnpm docs-stamp`. How to translate: `.agents/translation.md`.

## Steps

1. **Check the source.** Read `content/docs-meta.json` and list the changes
   since its commit:

   ```bash
   git -C ../clau log --oneline <commit>..HEAD -- README.md docs
   git -C ../clau status --short -- README.md docs
   ```

   Uncommitted changes are synced too and set `dirty`; tell the user, since
   translations then stamp a `-dirty` commit.

2. **Sync.** Run `pnpm sync-docs` and read its warnings. Then check the copy:
   - Plan references must not reach the site. `stripPlanReferences` removes
     paragraph lead-ins such as `Plan 11 step 41T (paths).` and parenthetical
     references such as `(plan step 37)`, `(OPT0.2A)`, `(plan 21, LIB80)`.
     Search the copy for what is left
     (`grep -nE "[Pp]lan [0-9]+|[Ss]teps? [0-9]|\bLIB[0-9]|\bOPT[A-Z0-9]*\.[0-9]" content/docs/en/*.md`)
     and extend the patterns for each new form. Dated history tables (the
     validation history, the OTP reference log) may keep their step names.
   - When the upstream layout changes (a new subdirectory of `docs/`, a README
     section renamed or removed), adapt `scripts/sync-docs.mjs`. Keep file
     names stable where the page is the same, so existing translations still
     match. If a page disappears, `git rm` its orphaned translations, and
     update `featuredDocs` in `lib/docs.ts` if it was featured.

3. **Status.** Run `pnpm docs-status` and note, per locale, the outdated,
   missing and orphaned files and every `ERROR`. With `sync`, report and stop.

4. **English diffs.** A translation's `sourceCommit` is a `../clau` commit. The
   English text it was made from is in the site commit whose
   `content/docs-meta.json` names that commit, so map them and write one diff
   per outdated file into the scratchpad:

   ```bash
   for c in $(git log --format=%h -- content/docs-meta.json); do
     echo "$c $(git show $c:content/docs-meta.json | node -e 'process.stdin.on("data", d => console.log(JSON.parse(d).commit))')"
   done   # site commit, then ../clau commit; the newest site commit wins
   git diff <site commit> -- content/docs/en/<file>.md > <scratchpad>/diffs/<locale>/<file>.md.diff
   ```

   A file renamed or moved upstream has no useful old English: treat it as
   missing and translate it whole. So does a `-dirty` stamp without a
   matching site commit.

5. **Translate.** One subagent per locale (local Codex, see `AGENTS.md`),
   locales in parallel. Within a locale, split the files into batches of
   about 100 KB of English (the largest files alone) and run the batches one
   after another. Give each agent: the locale, its files, the diff paths,
   `.agents/translation.md` and these rules:
   - Outdated file: change only what the diff changes; keep the translated
     text of unchanged parts as it is.
   - Missing file: translate the whole English file.
   - Afterwards `pnpm -s docs-stamp <locale> <files>` and
     `pnpm -s docs-status <locale>`; fix every `ERROR` in its files and stamp
     again.

6. **Verify.** `pnpm docs-status` shows no `ERROR` and no outdated or missing
   file in the selected scope. Spot-check a few updated files against their
   diffs: no English paragraphs left, code and link targets unchanged.

7. **Quality gates.** Content is not formatted by prettier. Run, stopping at
   the first failure:

   ```powershell
   pnpm lint
   pnpm typecheck
   pnpm build
   ```

   Do not open a browser.

8. **Report.** Source commit and dirty state, script changes, translations
   updated per locale, what is still outdated or missing, gate results. Do not
   commit or deploy unless the user asks; suggest `/deploy` when done.

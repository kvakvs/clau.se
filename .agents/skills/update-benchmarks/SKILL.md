---
name: update-benchmarks
description: Refresh the clau.se benchmarks page from the newest benchmark report of ../clau (content/benchmarks.json via pnpm sync-benchmarks), check that the page text still matches the numbers, and translate changed strings into all site languages. Use when the user runs /update-benchmarks or asks to update the benchmarks page.
disable-model-invocation: true
---

# Update the benchmarks page from ../clau

The page is `app/[lang]/benchmarks/`, with strings in `benchmarks.*` of
`messages/<locale>.ts` and data in `content/benchmarks.json`. The data is
written by `pnpm sync-benchmarks` from the newest report in
`../clau/benchmarks/history/reports/<host>/<day>-<hash>.txt` (newest by file
name over every host) plus the per-day history in
`../clau/benchmarks/history/<host>.json`. The reports are gitignored, so they
exist only on the host that ran the benchmarks; if they are missing, keep the
committed JSON, say so and stop.

IMPORTANT: update only from results recorded within the last 3 hours. If the
newest report is older, skip the update, report its timestamp and stop
without touching `content/benchmarks.json`.
SUBAGENTS: When using subagents, switch to a faster model such as Sonnet.

## Page requirements

Keep these when editing the page or its strings:

- Clause -O2 is compared with the BEAM JIT (OTP). The page summarizes how the
  latest report's Clause -O2 times differ from OTP's.
- The geometric mean card states whether Clause is on average slower or faster
  than the BEAM JIT (`slowerOnAverage` / `fasterOnAverage`).
- Unstable runs (spread above `NOISY_SPREAD` percent of the median) are marked
  with the 🔺 emoji, not an asterisk.
- Explain in the headnotes, the 'baseline' is the previous Clause commit (newest
  commit at least one day older than HEAD, or --baseline REV), built at -O2 to 
  catch regressions.
- Both the kernel table and the "whole programs" table show the Clause/OTP ratio
  with the `Bar` component on a shared log scale (`Axis`):
  - blue bars (Clause faster) run left of the 1× line, with "faster" in small
    font to the right of the bar, left aligned to the 1× line;
  - red bars (Clause slower) run right of it, with "slower" in small font,
    right aligned to the 1× line.
  - Expand "Whole programs" table to full page width
- Kernel names are `<program>.<kernel>`; rows are grouped by program, with
  group titles in `benchmarks.groups`. A program without a title there shows
  its raw name.
- The host name is never published (`sync-benchmarks` leaves it out).
- The size comparisons for `clau.exe` in different build modes, and for `bench_*` executables
  should have their own table showing the historical change of the sizes (hopefully towards
  being smaller with every new benchmark). A vertical bar SVG chart will suit here, adding
  a group of 6 bars per each `bench_*` per last 6 benchmarks .

## Steps

1. **Check freshness.** Find the newest report and its timestamp without
   writing anything:

   ```bash
   for f in ../clau/benchmarks/history/reports/*/*.txt; do echo "$(basename "$f") $f"; done \
     | sort | tail -1 | cut -d' ' -f2- | xargs -I{} grep -m1 '^Clause benchmarks,' "{}"
   ```

   Compare the timestamp with the current time. Stop if there is no report,
   if it is older than 3 hours, or if it equals `runAt` in the committed
   `content/benchmarks.json` (nothing new).
2. **Sync.** Run `pnpm sync-benchmarks`, then `git diff --stat
content/benchmarks.json`. Note the Clause commit, run count, new or removed
   kernels and programs, and the old and new geometric mean of the kernel
   ratios (Clause / OTP), and which kernels changed side (faster ↔ slower).
3. **Check the text.** Read `benchmarks.*` in `messages/en.ts` against the
   new data and edit where needed:
   - add a `groups` title for every new program prefix, drop titles of
     programs that are gone;
   - `intro`, `kernelsNote`, `programsNote`, `historyNote`: still true for the
     report (run count, units, what is measured);
   - `home.status` mentions the benchmarks page: check it still reads right
     if the overall picture changed (for example Clause now faster on
     average).

   Keep unchanged strings byte-identical. If no string needs a change, skip
   step 4.
4. **Translate.** For each locale `sv`, `es`, `uk`, `fr`, `de`, `pt`, update
   `messages/<locale>.ts` with the changed or new strings only, keeping the
   same keys and order as `en.ts`. Follow `.agents/translation.md`; program
   and kernel names, `OTP`, `BEAM`, `Clause`, `-O2` stay as written. Write
   UTF-8 with LF line endings.
5. **Quality gates.** Run, stopping at the first failure and fixing it:

   ```powershell
   pnpm exec prettier --write messages content/benchmarks.json
   pnpm lint
   pnpm typecheck
   pnpm build
   ```

   Do not open a browser.

6. **Report.** Report timestamp and Clause commit, geometric mean before and
   after, kernels that changed side, new or removed kernels and programs,
   strings changed and locales updated, gate results. Do not commit or
   deploy unless the user asks; suggest `/deploy` when done.

# Translating the documentation

English originals: `content/docs/en/*.md`, copied from `../clau/docs` (and the
project README) by `pnpm sync-docs`. Never edit them by hand.

Translations: `content/docs/<locale>/<same file name>.md` for `sv`, `es`, `uk`,
`fr`, `de`, `pt`. A missing translation falls back to English on the site.

## Workflow

1. Translate the whole English file into `content/docs/<locale>/<file>.md`
   (UTF-8, LF line endings). Do not write frontmatter yourself.
2. `pnpm -s docs-stamp <locale> <file>.md...` records the English commit and
   SHA-256 the translation was made from.
3. `pnpm -s docs-status <locale>` must show no `ERROR` for your files. Errors
   mean the Markdown structure differs from the English original; fix the
   translation, then stamp again.

When the English original changes, `pnpm docs-status` lists the translation as
`outdated` and the site shows an "out of date" notice. Update the translation
(compare with `git diff` of `content/docs/en/<file>.md` since the stamped
`sourceCommit`), then stamp again.

## Structure must match the original

Heading anchors are taken from the English original by position, and
`docs-status` compares structure, so:

- Same headings: same count, levels and order. Translate heading text.
- Same fenced code blocks, unchanged inside.
- Same link targets (every `](target)` exactly as in English). Translate the
  link text only.
- Same tables (rows, columns), lists and paragraphs in the same order. Do not
  add, drop, merge or reorder content; no translator notes.
- Wrap prose at about 80 columns like the original; line counts may differ.

## What stays in English

- Everything in inline code and code blocks, file names and paths, URLs,
  identifiers, CLI options, function names such as `spawn/1`, atoms, macros,
  error reasons, environment variables, commit hashes, version numbers, plan
  step numbers (`step 57B`, `phase C`).
- Product and tool names: Erlang, OTP, ERTS, BEAM, LLVM, Clang, clang-cl, CMake,
  Ninja, Boost, toml++, Visual Studio, Clause, `clau`.
- Erlang terms the community keeps in English, written without code formatting
  unless the original has it: record, native record, map, fun, bitstring,
  binary, guard, BIF, comprehension, `notimpl`, catch/try/after clause keywords.
  Ordinary computing terms are translated: process, message, scheduler, worker
  thread, heap, garbage collector, tail call, compiler, tuple, list, atom,
  integer, float, pattern, clause, term.
- The first use of a translated technical term that readers may search for in
  English can add the English term in parentheses, as in "sänkning (lowering)".
  Do this sparingly.

## Language notes

- Technical, concise, neutral register like the original; no marketing tone.
- `sv`: Swedish technical prose; "runtime" stays in English.
- `es`: neutral international Spanish, "tú" form avoided (impersonal style).
- `uk`: modern Ukrainian technical style, no Russianisms; "runtime" stays in
  English.
- `fr`: French typography (space before `;`, `:`, `?`, `!`); "runtime" stays in
  English.
- `de`: impersonal style (no "Sie"/"du" where avoidable); compound nouns with
  hyphens for English parts (`Runtime-Bibliothek`).
- `pt`: European Portuguese (ficheiro, registar, ecrã).

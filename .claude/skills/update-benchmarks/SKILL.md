---
name: update-benchmarks
description: Refresh the clau.se benchmarks page from the newest benchmark report of ../clau (content/benchmarks.json via pnpm sync-benchmarks), check that the page text still matches the numbers, and translate changed strings into all site languages. Use when the user runs /update-benchmarks or asks to update the benchmarks page.
disable-model-invocation: true
---

The skill lives in `.agents/skills/update-benchmarks/`. Read
`.agents/skills/update-benchmarks/SKILL.md` and follow it, passing on these
arguments: $ARGUMENTS

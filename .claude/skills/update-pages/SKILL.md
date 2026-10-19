---
name: update-pages
description: Refresh the clau.se front page (intro, status, feature cards, feature details) and the documentation summaries from the current state of ../clau (docs/, README.md, .agents/00-finished.md, .agents/01-todo.md), then translate every changed string into all site languages. Use when the user runs /update-pages or asks to update the front page or features from the project.
disable-model-invocation: true
argument-hint: "[docs] [full]"
---

The skill lives in `.agents/skills/update-pages/`. Read
`.agents/skills/update-pages/SKILL.md` and follow it, passing on these arguments:
$ARGUMENTS

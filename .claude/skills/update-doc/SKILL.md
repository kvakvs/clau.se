---
name: update-doc
description: Refresh the clau.se front page (intro, status, feature cards, feature details) and the documentation summaries from the current state of ../clau (docs/, README.md, .agents/00-finished.md, .agents/01-todo.md), then translate every changed string into all site languages. Use when the user runs /update-doc or asks to update the front page or features from the project.
disable-model-invocation: true
argument-hint: "[docs] [full]"
---

The skill lives in `.agents/skills/update-doc/`. Read
`.agents/skills/update-doc/SKILL.md` and follow it, passing on these arguments:
$ARGUMENTS

---
name: deploy
description: Build the clau.se static site locally and deploy it to the web server pupa (/home/clause/www) over SSH from WSL, replacing the old files. Use only when the user runs /deploy or explicitly asks to deploy.
disable-model-invocation: true
argument-hint: "[dry-run] [sync]"
---

The skill lives in `.agents/skills/deploy/`. Read
`.agents/skills/deploy/SKILL.md` and follow it, passing on these arguments:
$ARGUMENTS

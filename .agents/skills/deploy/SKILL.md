---
name: deploy
description: Build the clau.se static site locally and deploy it to the web server pupa (/home/clause/www) over SSH from WSL, replacing the old files. Use only when the user runs /deploy or explicitly asks to deploy.
disable-model-invocation: true
argument-hint: "[dry-run] [sync]"
---

# Deploy clau.se

Builds the static export and replaces the site on `pupa:/home/clause/www`.
Deploying publishes to the live site: run it only when the user asked.

Arguments (`$ARGUMENTS`, any order):

- `dry-run`: build and upload, check remote access, change nothing.
- `sync`: refresh `content/docs/` from `../clau` first (`pnpm sync-docs`).

## Steps

1. If `sync` was given and `../clau` exists, run `pnpm sync-docs` and report
   which docs changed (`git status --short content/`). Then run
   `pnpm docs-status` and report outdated translations; they deploy with an
   "out of date" notice, so this does not block.
2. Run the quality gates from the repository root (PowerShell), stopping at
   the first failure and reporting its output:

   ```powershell
   pnpm lint
   pnpm typecheck
   pnpm build
   ```

3. Mention uncommitted changes (`git status --short`): the deployed site then
   does not match any commit. Do not block on it.
4. Run the upload script in WSL (add `--dry-run` for `dry-run`):

   ```powershell
   wsl --cd "F:\CLAUSE\clau.se" -e bash .agents/skills/deploy/deploy.sh
   ```

   The script, [deploy.sh](deploy.sh):
   - refuses to run without a build in `out/`, or with a web root other than
     `/home/*/www`;
   - packs `out/` into a tarball, uploads it with `scp` to `/tmp` on `pupa`;
   - on the server, picks a write mode: as root (the current SSH user for
     `pupa`) and then `chown` to `clause`; directly if the login user can
     write; otherwise `sudo -n -u clause`;
   - unpacks into `/home/clause/www.new` first, then deletes the old contents
     of `/home/clause/www` and moves the new files in. The web root directory
     itself is kept.

   SSH runs with `BatchMode=yes`, so it fails instead of prompting. If it
   fails on authentication, a key passphrase or a sudo password, do not retry
   in a loop: ask the user to run the same command themselves with the `!`
   prefix in the prompt.

5. Report the script's summary lines (file counts, write mode). Optionally
   check the live site with `curl -sI https://clau.se/en/` (status line
   only). Do not launch a browser.

Overrides for a different target: environment variables `DEPLOY_HOST`,
`DEPLOY_DEST`, `DEPLOY_OWNER`, set inside WSL, for example
`wsl --cd "F:\CLAUSE\clau.se" -e env DEPLOY_HOST=other bash .agents/skills/deploy/deploy.sh`.

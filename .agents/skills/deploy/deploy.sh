#!/usr/bin/env bash
# Uploads the static export in out/ to the web server, replacing the old site.
# Runs inside WSL. Usage: deploy.sh [--dry-run]
#
# Environment overrides: DEPLOY_HOST (ssh host, default pupa),
# DEPLOY_DEST (web root, default /home/clause/www),
# DEPLOY_OWNER (owner of deployed files, default clause).

set -euo pipefail

HOST="${DEPLOY_HOST:-pupa}"
DEST="${DEPLOY_DEST:-/home/clause/www}"
OWNER="${DEPLOY_OWNER:-clause}"
DRY=0
[[ "${1:-}" == "--dry-run" ]] && DRY=1

die() { echo "deploy: $*" >&2; exit 1; }

root="$(cd "$(dirname "$0")/../../.." && pwd)"
out="$root/out"

[[ -f "$out/index.html" && -f "$out/en/index.html" ]] ||
  die "no build in $out; run pnpm build first"
case "$DEST" in
  /home/*/www) ;;
  *) die "refusing unexpected DEST=$DEST" ;;
esac

archive="$(mktemp --suffix=.tar.gz)"
trap 'rm -f "$archive"' EXIT
tar -C "$out" -czf "$archive" .
files="$(find "$out" -type f | wc -l)"
echo "deploy: $files files, $(du -h "$archive" | cut -f1) archive -> $HOST:$DEST"

ssh_opts=(-o BatchMode=yes -o ConnectTimeout=15)
remote_archive="/tmp/clause-www-$$-$(date +%s).tar.gz"
scp -q "${ssh_opts[@]}" "$archive" "$HOST:$remote_archive"

ssh "${ssh_opts[@]}" "$HOST" bash -s -- \
  "$DEST" "$OWNER" "$remote_archive" "$DRY" <<'REMOTE'
set -euo pipefail
dest=$1 owner=$2 archive=$3 dry=$4
staging="$dest.new"
trap 'rm -f "$archive"' EXIT

[ -d "$dest" ] || { echo "remote: $dest does not exist" >&2; exit 2; }

# Pick how to write: as root (then hand files to the owner), directly when the
# login user can write, else through passwordless sudo as the owner.
chown_to=""
if [ "$(id -u)" -eq 0 ]; then
  mode="root"
  as_owner() { "$@"; }
  id "$owner" >/dev/null 2>&1 && chown_to="$owner"
elif [ -w "$dest" ] && [ -w "$(dirname "$dest")" ]; then
  mode="direct as $(id -un)"
  as_owner() { "$@"; }
elif sudo -n -u "$owner" true 2>/dev/null; then
  mode="sudo -u $owner"
  as_owner() { sudo -n -u "$owner" "$@"; }
  chmod a+r "$archive"
else
  echo "remote: $(id -un) cannot write $dest and has no passwordless sudo to $owner" >&2
  exit 3
fi

old=$(find "$dest" -mindepth 1 | wc -l)
echo "remote: $mode; $dest has $old entries"
if [ "$dry" = 1 ]; then
  echo "remote: dry run, nothing changed"
  exit 0
fi

# Unpack into a sibling staging directory first, so a broken upload leaves
# the old site in place. The web root directory itself is kept (same inode,
# permissions and owner); only its contents are replaced.
as_owner rm -rf "$staging"
as_owner mkdir "$staging"
as_owner tar -xzf "$archive" -C "$staging" --no-same-owner
[ -f "$staging/index.html" ] || { echo "remote: bad archive" >&2; exit 4; }
[ -n "$chown_to" ] && chown -R "$chown_to:" "$staging"

as_owner find "$dest" -mindepth 1 -delete
as_owner find "$staging" -mindepth 1 -maxdepth 1 -exec mv -t "$dest" {} +
as_owner rmdir "$staging"
echo "remote: deployed $(find "$dest" -type f | wc -l) files to $dest"
REMOTE

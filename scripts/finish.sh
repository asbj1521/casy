#!/usr/bin/env bash
# Finishes the feature branch you are on (npm run finish): pushes it, waits
# for every GitHub Actions run on it (CI, and the screenshot workflow on a
# [screenshots] commit), takes the screenshot bot's commit if it made one, and
# fast-forwards main to it, which deploys casy.app. Stops before touching main
# at the first thing that isn't right, so a failure leaves main as it was.
#
# Needs the GitHub CLI, signed in (gh auth status).
set -euo pipefail

REPO=asbj1521/casy

die() {
  echo "finish: $*" >&2
  exit 1
}
say() { echo "finish: $*"; }

branch=$(git branch --show-current)
[ -n "$branch" ] && [ "$branch" != main ] || die "run this on a feature branch, not '${branch:-a detached HEAD}'"
[ -z "$(git status --porcelain --untracked-files=no)" ] || die "commit or stash your changes first"
command -v gh >/dev/null || die "the GitHub CLI (gh) isn't installed"

# main must not have moved since the branch left it: a fast-forward merges
# exactly what CI checked, and nothing else.
git fetch --quiet origin main
git merge-base --is-ancestor origin/main HEAD ||
  die "main has moved on; rebase the branch on origin/main (or merge it in) and run this again"

sha=$(git rev-parse HEAD)
say "pushing $branch (${sha:0:7})"
git push --quiet -u origin "$branch"

# Every push to a branch starts both workflows; the screenshot one skips its
# job unless the commit asks for [screenshots]. Wait until both are listed.
runs=""
for _ in $(seq 1 30); do
  runs=$(gh run list -R "$REPO" --commit "$sha" --event push --json databaseId -q '.[].databaseId')
  [ "$(echo "$runs" | grep -c .)" -ge 2 ] && break
  sleep 2
done
[ "$(echo "$runs" | grep -c .)" -ge 2 ] || die "GitHub hasn't started the checks for ${sha:0:7} after a minute; see https://github.com/$REPO/actions"

say "waiting for the checks on ${sha:0:7}"
for id in $runs; do
  gh run watch "$id" -R "$REPO" --interval 5 >/dev/null || true
done
failed=0
for id in $runs; do
  read -r name conclusion < <(gh run view "$id" -R "$REPO" --json workflowName,conclusion -q '"\(.workflowName | gsub(" "; "_")) \(.conclusion)"')
  say "  ${name//_/ }: $conclusion"
  case "$conclusion" in
    success | skipped) ;;
    *) failed=1 ;;
  esac
done
[ "$failed" = 0 ] || die "a check failed; main is untouched. Details: https://github.com/$REPO/actions?query=branch%3A$branch"

# The screenshot workflow commits new images onto the branch; take them.
git fetch --quiet origin "$branch"
if [ "$(git rev-parse "origin/$branch")" != "$sha" ]; then
  # Anything but the bot's images wasn't checked: stop rather than ship it.
  others=$(git log --format=%an "$sha..origin/$branch" | grep -vc '^github-actions\[bot\]$' || true)
  [ "$others" = 0 ] || die "the branch on GitHub has commits CI didn't check; look before merging"
  git merge --quiet --ff-only "origin/$branch" || die "the branch on GitHub has moved apart from yours; look before merging"
  say "took the new reference screenshots ($(git rev-parse --short HEAD))"
fi

say "fast-forwarding main"
git checkout --quiet main
git merge --quiet --ff-only origin/main
git merge --quiet --ff-only "$branch" || die "main can't be fast-forwarded to $branch"
git push --quiet origin main
git branch --quiet -d "$branch"
git push --quiet origin --delete "$branch"
say "done: main is at $(git rev-parse --short HEAD), and Vercel is deploying it"

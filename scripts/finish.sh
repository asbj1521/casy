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

# CI's quick checks here first (#208): half a minute on this Mac, where a
# mistake found in CI costs a push and five minutes.
say "running npm run check"
bash scripts/check.sh || die "a check failed here; nothing was pushed"

sha=$(git rev-parse HEAD)
say "pushing $branch (${sha:0:7})"
git push --quiet -u origin "$branch"

# Every push to a branch starts both workflows; the screenshot one skips its
# job unless the commit asks for [screenshots]. Wait until both are listed.
runs_for() {
  local commit=$1 tries=$2 found=""
  for _ in $(seq 1 "$tries"); do
    # A passing server error is asked again on the next try, not the end of it.
    found=$(gh run list -R "$REPO" --commit "$commit" --event push --json databaseId -q '.[].databaseId' || true)
    [ "$(echo "$found" | grep -c .)" -ge 2 ] && break
    sleep 2
  done
  echo "$found"
}
check="$sha"
# The screenshot bot's own push starts no checks: when the last commit is its
# and holds only reference images, and has no checks of its own (a person
# pushing it after a rebase does start them), the checks that count are
# those of the commit it was made for.
bot_images_only=false
if [ "$(git log -1 --format=%an "$sha")" = "github-actions[bot]" ] &&
  [ -z "$(git diff --name-only "$sha~1" "$sha" | grep -v '^e2e/__screenshots__/' || true)" ]; then
  bot_images_only=true
fi
runs=$(runs_for "$sha" "$([ "$bot_images_only" = true ] && echo 10 || echo 30)")
if [ "$(echo "$runs" | grep -c .)" -lt 2 ] && [ "$bot_images_only" = true ]; then
  check=$(git rev-parse "$sha~1")
  say "the last commit is the screenshot bot's; using the checks of ${check:0:7}, which made it"
  runs=$(runs_for "$check" 30)
fi
[ "$(echo "$runs" | grep -c .)" -ge 2 ] || die "GitHub hasn't started the checks for ${check:0:7} after a minute; see https://github.com/$REPO/actions"

say "waiting for the checks on ${check:0:7}"
watch_runs() {
  for id in $runs; do
    gh run watch "$id" -R "$REPO" --interval 5 >/dev/null || true
  done
}
watch_runs
# A run's result, asked again when GitHub answers with a server error (a 502
# during an outage once read as a failed check): empty only after a minute.
result_of() {
  local answer=""
  for _ in 1 2 3 4 5 6; do
    answer=$(gh run view "$1" -R "$REPO" --json workflowName,conclusion -q '"\(.workflowName | gsub(" "; "_")) \(.conclusion)"' 2>/dev/null || true)
    [ -n "${answer#* }" ] && break
    sleep 10
  done
  echo "$answer"
}
# Each run's result: `failed` when any didn't pass, `broken` when one failed
# for real, `stalled` the runs GitHub cancelled or timed out (#208).
judge_runs() {
  failed=0 broken=0 stalled=""
  for id in $runs; do
    read -r name conclusion < <(result_of "$id")
    say "  ${name//_/ }: ${conclusion:-no answer from GitHub}"
    case "$conclusion" in
      success | skipped) ;;
      cancelled | timed_out)
        failed=1
        stalled="$stalled $id"
        ;;
      *) failed=1 broken=1 ;;
    esac
  done
}
judge_runs
# A run GitHub cancelled or let time out says nothing about the code (a stuck
# runner, an outage): run it once more. A failed test is never run again.
if [ "$failed" = 1 ] && [ "$broken" = 0 ] && [ -n "$stalled" ]; then
  say "GitHub cancelled or timed out a run; running it once more"
  for id in $stalled; do
    gh run rerun "$id" -R "$REPO" >/dev/null || die "couldn't start run $id again; see https://github.com/$REPO/actions"
    # Until the new attempt has started, watching would see the old one.
    for _ in $(seq 1 30); do
      [ "$(gh run view "$id" -R "$REPO" --json status -q .status 2>/dev/null || true)" != completed ] && break
      sleep 2
    done
  done
  watch_runs
  judge_runs
fi
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

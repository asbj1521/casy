#!/usr/bin/env bash
# CI's quick checks, on this Mac (npm run check, #208): the type check,
# ESLint, knip, Prettier, the unit tests and the Edge Functions' check and
# tests. A minute or two, so a mistake fails here rather than in CI after
# five. npm run finish runs it before pushing. The browser tests are left to
# CI (npm run e2e runs them here).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

step() { echo "check: $*"; }
die() {
  echo "check: $*" >&2
  exit 1
}

step "type check"
npx tsc -b || die "the type check failed"
step "ESLint"
npx eslint . || die "ESLint failed"
step "knip"
npx knip || die "knip found unused files, exports or dependencies"
step "Prettier"
npx prettier --check . >/dev/null || die "formatting differs; run npm run format"
step "unit tests"
npx vitest run --reporter=dot || die "a unit test failed"

if command -v deno >/dev/null; then
  # Deno rewrites deno.lock to match package.json; that rewrite is never the
  # point, so it is undone, but only when the file was unchanged before.
  lock_clean=false
  git diff --quiet -- deno.lock && lock_clean=true
  step "Edge Functions"
  (
    cd supabase/functions
    deno check --node-modules-dir=none -q */index.ts _shared/*.ts ../review/*.ts &&
      deno test --node-modules-dir=none --allow-all -q _shared/ ../review/ >/dev/null
  ) || die "the Edge Functions' check or tests failed"
  [ "$lock_clean" = true ] && git checkout -q -- deno.lock
else
  step "Edge Functions skipped: Deno isn't installed (CI still runs them)"
fi

step "all passed"

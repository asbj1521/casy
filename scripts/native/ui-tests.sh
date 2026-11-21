#!/usr/bin/env bash
# The app's UI tests (#198) on a simulator, against the fake backend. Run from
# anywhere. UI_TEST_DEVICE picks the simulator's name, UI_TESTS one class or test
# (AppUITests/HomeUITests), CASY_SHOTS_DIR a folder for the tests' shot() images.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# The whole suite on several simulators at once (ui-tests-parallel.py), unless
# one class or test is asked for, or UI_TEST_WORKERS=1 asks for one after another.
if [ -z "${UI_TESTS:-}" ] && [ -z "${UI_TEST_DEVICE:-}" ] && [ "${UI_TEST_WORKERS:-3}" != 1 ]; then
  exec python3 -I scripts/native/ui-tests-parallel.py
fi

# iPhone 17e by default, the parity shots' simulator: never the one a person
# uses with the real app (iPhone 17 here), where the page is signed in for real
# and draws its own home page under the native sheets (a trip test found two
# "lørdag 17. oktober", 18 Nov 2026), and where the run replaces their app.
DEVICE="${UI_TEST_DEVICE:-iPhone 17e}"
BUNDLE="$(mktemp -d)/fake-backend.mjs"

npx esbuild scripts/native/fake-backend.ts --bundle --platform=node --format=esm \
  --outfile="$BUNDLE" --log-level=warning
SLOW_ACTIONS=push-set node "$BUNDLE" &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT

# The app reads what is built into it: never the live project in these tests.
TEST_RUNNER_CASY_SHOTS="${CASY_SHOTS_DIR:-}" xcodebuild test -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination "platform=iOS Simulator,name=$DEVICE" \
  -only-testing:"${UI_TESTS:-AppUITests}" -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO

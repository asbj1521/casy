#!/usr/bin/env bash
# The app's UI tests (#198) on a simulator, against the fake backend. Run from
# anywhere. UI_TEST_DEVICE picks the simulator's name.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

DEVICE="${UI_TEST_DEVICE:-iPhone 17}"
BUNDLE="$(mktemp -d)/fake-backend.mjs"

npx esbuild scripts/native/fake-backend.ts --bundle --platform=node --format=esm \
  --outfile="$BUNDLE" --log-level=warning
SLOW_ACTIONS=push-set node "$BUNDLE" &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT

# The app reads what is built into it: never the live project in these tests.
xcodebuild test -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination "platform=iOS Simulator,name=$DEVICE" \
  -only-testing:AppUITests -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO

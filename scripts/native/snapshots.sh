#!/usr/bin/env bash
# CasyUI's snapshot tests (#197), on the one simulator their images were made
# on. Run from anywhere; `--record` draws the images anew. Not on CI yet: its
# Xcode has an older iOS, which draws glass differently (docs/native-ios-plan.md).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)/ios/Packages/CasyUI"

DESTINATION="platform=iOS Simulator,name=${SNAPSHOT_DEVICE:-iPhone 17},OS=${SNAPSHOT_OS:-27.2}"
[ "${1:-}" = "--record" ] && export TEST_RUNNER_SNAPSHOT_TESTING_RECORD=all

xcodebuild test -scheme CasyUI -destination "$DESTINATION" CODE_SIGNING_ALLOWED=NO \
  -only-testing:CasyUISnapshotTests

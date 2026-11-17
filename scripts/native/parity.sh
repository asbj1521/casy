#!/usr/bin/env bash
# The native screens' look against the web's (#280, docs/native-visual-parity.md).
#
#   scripts/native/parity.sh                                  # every parity test
#   scripts/native/parity.sh ParityUITests/testHomeMonthLight # one
#
# Builds the website against the fake backend into the app (npm run ios:parity;
# PARITY_NO_WEB_BUILD=1 skips it when the page hasn't changed), starts the fake
# backend, builds the app once, then runs the tests on iPhone 17e twice: web only
# and native. For each shot it writes <name>-web.png, <name>-native.png,
# <name>-pair.png and <name>-diff.png to PARITY_OUT (default
# $TMPDIR/casy-parity), and prints the share of pixels that differ.
#
# Afterwards the app holds the test build: `npm run ios` puts the real site back.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

DEVICE="iPhone 17e"
TESTS="AppUITests/${1:-ParityUITests}"
OUT="${PARITY_OUT:-${TMPDIR:-/tmp}/casy-parity}"
DESTINATION="platform=iOS Simulator,name=$DEVICE"

python3 -c "import PIL" 2>/dev/null || {
  echo "parity: Python's image library is missing; install it with: python3 -m pip install pillow" >&2
  exit 1
}

[ "${PARITY_NO_WEB_BUILD:-}" = 1 ] || npm run --silent ios:parity

BUNDLE="$(mktemp -d)/fake-backend.mjs"
npx esbuild scripts/native/fake-backend.ts --bundle --platform=node --format=esm \
  --outfile="$BUNDLE" --log-level=warning
node "$BUNDLE" >/dev/null &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT
# Ready before the first test resets it.
for _ in $(seq 50); do
  curl -sf -o /dev/null -X POST http://localhost:4318/reset && break
  sleep 0.2
done

rm -rf "$OUT" && mkdir -p "$OUT"
# Xcode's default DerivedData, never a folder in the repo (iCloud breaks signing).
xcodebuild build-for-testing -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination "$DESTINATION" CODE_SIGNING_ALLOWED=NO -quiet

# Why a test failed, read from its result bundle.
failures() {
  xcrun xcresulttool get test-results tests --path "$1" | python3 -I -c '
import json, sys
def walk(node, test):
    if node.get("nodeType") == "Test Case":
        test = node.get("name")
    if node.get("nodeType") == "Failure Message":
        print("parity:   " + str(test) + ": " + str(node.get("name")))
    for child in node.get("children", []):
        walk(child, test)
for node in json.load(sys.stdin)["testNodes"]:
    walk(node, None)
' >&2
}

for mode in web native; do
  echo "parity: $mode"
  if ! TEST_RUNNER_CASY_PARITY_MODE=$mode TEST_RUNNER_CASY_SHOTS="$OUT" \
    xcodebuild test-without-building -project ios/App/App.xcodeproj -scheme App \
    -configuration Debug -destination "$DESTINATION" -only-testing:"$TESTS" \
    -resultBundlePath "$OUT/$mode.xcresult" \
    -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO -quiet >"$OUT/$mode.log" 2>&1; then
    echo "parity: the $mode run failed:" >&2
    failures "$OUT/$mode.xcresult"
    exit 1
  fi
done

shopt -s nullglob
compared=0
for web in "$OUT"/*-web.png; do
  name="$(basename "$web" -web.png)"
  if [ -f "$OUT/$name-native.png" ]; then
    python3 scripts/native/parity-compare.py "$OUT" "$name"
    compared=$((compared + 1))
  else
    echo "parity: $name: no native shot" >&2
  fi
done
[ "$compared" -gt 0 ] || { echo "parity: no shots were taken" >&2; exit 1; }
echo "parity: images in $OUT"

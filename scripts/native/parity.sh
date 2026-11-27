#!/usr/bin/env bash
# The native screens' look against the web's (#280, docs/native-visual-parity.md).
#
#   scripts/native/parity.sh                                  # every parity test
#   scripts/native/parity.sh ParityUITests/testHomeMonthLight # one
#   scripts/native/parity.sh ParityUITests/testProfileLight ParityUITests/testProfileDark # several
#
# Builds the website against the fake backend (npm run ios:parity, into
# dist-parity; PARITY_NO_WEB_BUILD=1 keeps the last one when the page hasn't
# changed) and puts it in the reference app (scripts/native/reference-app.sh:
# the app as it was with its page, #202), starts the fake backend, builds the
# app once, then runs the tests on iPhone 17e twice: the web side in the
# reference app, the native side in this one. For each shot it writes
# <name>-web.png, <name>-native.png, <name>-pair.png and <name>-diff.png to
# PARITY_OUT (default $TMPDIR/casy-parity), and prints the share of pixels
# that differ.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

DEVICE="iPhone 17e"
ONLY=()
for test in "${@:-ParityUITests}"; do ONLY+=(-only-testing:"AppUITests/$test"); done
OUT="${PARITY_OUT:-${TMPDIR:-/tmp}/casy-parity}"
DESTINATION="platform=iOS Simulator,name=$DEVICE"

python3 -c "import PIL" 2>/dev/null || {
  echo "parity: Python's image library is missing; install it with: python3 -m pip install pillow" >&2
  exit 1
}

# The website's test build, for the reference app: built afresh, or the last one
# (PARITY_NO_WEB_BUILD=1) when the page hasn't changed.
if [ "${PARITY_NO_WEB_BUILD:-}" != 1 ] || [ ! -d dist-parity ]; then
  npm run --silent ios:parity
fi

BUNDLE="$(mktemp -d)/fake-backend.mjs"
npx esbuild scripts/native/fake-backend.ts --bundle --platform=node --format=esm \
  --outfile="$BUNDLE" --log-level=warning
node "$BUNDLE" >/dev/null &
SERVER=$!
finish() {
  kill "$SERVER" 2>/dev/null || true
  # A film still running (a test failed): ended, so it is a readable file.
  [ -z "${RECORDER:-}" ] || { kill -INT "$RECORDER" 2>/dev/null; wait "$RECORDER" 2>/dev/null; } || true
}
trap finish EXIT
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

# PARITY_VIDEO=1 films each run (rule 6, moving parts): <mode>.mp4, and the
# timing of every motion in it (parity-frames.swift).
DEVICE_ID="$(xcrun simctl list devices available | grep -m1 "    $DEVICE (" | grep -oE '[0-9A-F-]{36}')"
RECORDER=""
film() {
  [ "${PARITY_VIDEO:-}" = 1 ] || return 0
  xcrun simctl boot "$DEVICE_ID" 2>/dev/null || true
  xcrun simctl io "$DEVICE_ID" recordVideo --force "$OUT/$1.mp4" >/dev/null 2>&1 &
  RECORDER=$!
  sleep 2
}
cut() {
  [ -n "$RECORDER" ] || return 0
  kill -INT "$RECORDER" 2>/dev/null || true
  wait "$RECORDER" 2>/dev/null || true
  RECORDER=""
  echo "parity: $1 film:"
  swift -suppress-warnings scripts/native/parity-frames.swift "$OUT/$1.mp4" | sed 's/^/parity:   /'
}

# The web side's app: the app as it was with its page, today's page put in it (#202).
bash scripts/native/reference-app.sh "$DEVICE_ID"

for mode in web native; do
  echo "parity: $mode"
  film "$mode"
  if ! TEST_RUNNER_CASY_PARITY_MODE=$mode TEST_RUNNER_CASY_SHOTS="$OUT" \
    xcodebuild test-without-building -project ios/App/App.xcodeproj -scheme App \
    -configuration Debug -destination "$DESTINATION" "${ONLY[@]}" \
    -resultBundlePath "$OUT/$mode.xcresult" \
    -parallel-testing-enabled NO CODE_SIGNING_ALLOWED=NO -quiet >"$OUT/$mode.log" 2>&1; then
    echo "parity: the $mode run failed:" >&2
    failures "$OUT/$mode.xcresult"
    exit 1
  fi
  cut "$mode"
  # Closed, so the native run's app isn't opened "from" it (iOS's ◀ back link under the clock).
  [ "$mode" = web ] && xcrun simctl terminate "$DEVICE_ID" app.casy.reference 2>/dev/null || true
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
[ "$compared" -gt 0 ] || [ "${PARITY_VIDEO:-}" = 1 ] || { echo "parity: no shots were taken" >&2; exit 1; }
echo "parity: images in $OUT"

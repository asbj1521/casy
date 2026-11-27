#!/usr/bin/env bash
# The web reference app (#202): the parity shots' web side once the app has no
# page. It is this app as it was at the last commit that still had its page
# (scripts/native/reference-commit), built once, cached outside the repo, and
# installed on the parity simulator as its own app (app.casy.reference), never
# shipped. Each run copies the website's current test build (dist-parity) into
# it, so the reference is always today's page, drawn in the same web view, at
# the same size, as people had it in the app.
#
#   scripts/native/reference-app.sh <simulator udid>   # build if needed, fill, install
#
# CASY_REFERENCE_DIR picks the cache (default ~/Library/Caches/casy-reference).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
UDID="${1:?give the simulator udid}"
REF="$(tr -d '[:space:]' < scripts/native/reference-commit)"
CACHE="${CASY_REFERENCE_DIR:-$HOME/Library/Caches/casy-reference}/$REF"
APP="$CACHE/App.app"
BUNDLE_ID="app.casy.reference"

[ -d dist-parity ] || { echo "reference: no dist-parity; run npm run ios:parity first" >&2; exit 1; }

if [ ! -d "$APP" ]; then
  echo "reference: building the app as of ${REF:0:7} (once)"
  work="$(mktemp -d)"
  trap 'git worktree remove --force "$work/src" >/dev/null 2>&1 || true; rm -rf "$work"' EXIT
  git worktree add --detach "$work/src" "$REF" >/dev/null
  # What the build reads from outside git: the packages, and what `cap sync` wrote (kept here).
  # Its own commit's packages, not this checkout's: the app has since dropped Capacitor's.
  (cd "$work/src" && npm ci --ignore-scripts --no-audit --no-fund --loglevel=error)
  cp scripts/native/reference-capacitor.config.json "$work/src/ios/App/App/capacitor.config.json"
  cp scripts/native/reference-config.xml "$work/src/ios/App/App/config.xml"
  mkdir -p "$work/src/ios/App/App/public"
  cp -R dist-parity/. "$work/src/ios/App/App/public/"
  [ -f "$work/src/scripts/native/project-endpoint.sh" ] && (cd "$work/src" && bash scripts/native/project-endpoint.sh)
  # Its own build folder, outside the repo (iCloud breaks signing inside it).
  xcodebuild build -project "$work/src/ios/App/App.xcodeproj" -scheme App -configuration Debug \
    -destination "generic/platform=iOS Simulator" -derivedDataPath "$work/dd" CODE_SIGNING_ALLOWED=NO -quiet
  mkdir -p "$CACHE"
  cp -R "$work/dd/Build/Products/Debug-iphonesimulator/App.app" "$APP"
  # Its own app beside the real one: its own name, storage and login.
  /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier $BUNDLE_ID" "$APP/Info.plist"
  /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Reference" "$APP/Info.plist" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string Reference" "$APP/Info.plist"
fi

# Today's page in it.
rm -rf "$APP/public"
cp -R dist-parity "$APP/public"
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl install "$UDID" "$APP"
xcrun simctl privacy "$UDID" grant calendar "$BUNDLE_ID" 2>/dev/null || true
echo "reference: installed $BUNDLE_ID with today's page"

#!/usr/bin/env bash
# The iPhone app with live reload (npm run ios:live): runs the Vite dev server
# and installs the app in the iOS Simulator pointed at it, so every save shows
# up in the real iOS web view within a second. Build again (run this again)
# only when native Swift code changes.
#
#   npm run ios:live                  # the default simulator (iPhone 17)
#   npm run ios:live -- "iPhone Air"  # another simulator, by name
#   npm run ios:live -- --device      # a real phone: points the app at this Mac,
#                                     # then opens Xcode for the one ▶ press
#
# The dev address reaches the app only through ios/App/App/capacitor.config.json
# (git-ignored; capacitor.config.ts reads CAP_LIVE_URL), and the next
# `npm run ios` writes it back without one. A real build never points at a dev
# server.
#
# The build goes to Xcode's default DerivedData, not ios/DerivedData where
# `cap run` would put it: the repo sits in iCloud-synced Desktop, and code
# signing rejects files carrying iCloud's attributes.
set -euo pipefail

cd "$(dirname "$0")/.."

PORT=8080
SIMULATOR="iPhone 17"
APP_ID=app.casy
device=false

if [ "${1:-}" = "--device" ]; then
  device=true
  # A phone can't reach the Mac's "localhost"; use its address on the Wi-Fi.
  host=$(ipconfig getifaddr en0 || true)
  [ -n "$host" ] || {
    echo "ios-live: no Wi-Fi address found (is the Mac on Wi-Fi?)" >&2
    exit 1
  }
else
  [ -z "${1:-}" ] || SIMULATOR="$1"
  host=localhost
fi

# Reuse a dev server that is already running; otherwise start one and stop it
# again when this script ends.
dev_pid=""
if curl -s -o /dev/null "http://localhost:$PORT"; then
  echo "ios-live: using the dev server already on port $PORT"
else
  npm run dev >/dev/null 2>&1 &
  dev_pid=$!
  trap 'kill $dev_pid 2>/dev/null || true' EXIT
  until curl -s -o /dev/null "http://localhost:$PORT"; do
    kill -0 "$dev_pid" 2>/dev/null || {
      echo "ios-live: the dev server did not start" >&2
      exit 1
    }
    sleep 0.5
  done
fi

# `cap sync` copies the web build, which must exist even though the app won't
# use it while pointed at the dev server.
if [ ! -f dist/index.html ]; then
  mkdir -p dist
  echo "<!doctype html>" >dist/index.html
fi
CAP_LIVE_URL="http://$host:$PORT" npx cap sync ios

if $device; then
  echo "ios-live: the app now points at http://$host:$PORT."
  echo "ios-live: in Xcode pick your phone and press ▶ once; after that, edits show on the phone."
  npx cap open ios
else
  xcrun simctl boot "$SIMULATOR" 2>/dev/null || true
  # Xcode 27 no longer ships Simulator.app; DeviceHub.app is what shows the screen.
  open -a Simulator 2>/dev/null || open "$(xcode-select -p)/../Applications/DeviceHub.app"

  udid=$(xcrun simctl list devices available | grep -F "$SIMULATOR (" | head -1 | grep -oE '[0-9A-F]{8}-([0-9A-F]{4}-){3}[0-9A-F]{12}')
  [ -n "$udid" ] || {
    echo "ios-live: no simulator called '$SIMULATOR' (see: xcrun simctl list devices available)" >&2
    exit 1
  }

  xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
    -destination "id=$udid" -quiet build
  products=$(xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
    -destination "id=$udid" -showBuildSettings 2>/dev/null |
    sed -n 's/^ *BUILT_PRODUCTS_DIR = //p' | head -1)
  xcrun simctl install "$udid" "$products/App.app"
  xcrun simctl launch "$udid" "$APP_ID"
  echo "ios-live: running on $SIMULATOR; edit code and watch it update."
fi

if [ -n "$dev_pid" ]; then
  echo "ios-live: Ctrl+C stops the dev server."
  wait "$dev_pid"
fi

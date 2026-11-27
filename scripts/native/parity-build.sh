#!/usr/bin/env bash
# npm run ios:parity (#280): the website built against the app's fake backend
# (scripts/native/fake-backend.ts on port 4318) and copied into the iPhone app,
# so the web screens the app draws under `-casyWebOnly YES` are the reference
# for the native screens' look (docs/native-visual-parity.md).
#
# It builds into dist-parity/, never dist/, so a test build never stands in for
# a real one. Debug only: the next `npm run ios`, and every `npm run release:ios`,
# builds the real site and copies that back in.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Set here, these win over .env.local (Vite never overwrites what is already set).
VITE_SUPABASE_URL=http://localhost:4318 \
  VITE_SUPABASE_ANON_KEY=test-publishable-key \
  VITE_APP_BUILD=parity \
  npx vite build --outDir dist-parity --emptyOutDir --logLevel warn

env -u CAP_LIVE_URL CAP_WEB_DIR=dist-parity npx cap sync ios
bash scripts/native/project-endpoint.sh
echo "ios:parity: the app now holds the test build (fake backend on port 4318)."
echo "ios:parity: run 'npm run ios' to put the real site back (parity.sh does it itself)."

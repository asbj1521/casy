#!/usr/bin/env bash
# npm run ios:parity (#280): the website built against the app's fake backend
# (scripts/native/fake-backend.ts on port 4318), for the reference app the
# parity shots take their web side from (scripts/native/reference-app.sh, #202;
# docs/native-visual-parity.md). Into dist-parity/, never dist/.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Set here, these win over .env.local (Vite never overwrites what is already set).
VITE_SUPABASE_URL=http://localhost:4318 \
  VITE_SUPABASE_ANON_KEY=test-publishable-key \
  VITE_APP_BUILD=parity \
  npx vite build --outDir dist-parity --emptyOutDir --logLevel warn

echo "ios:parity: dist-parity holds the test build (fake backend on port 4318), for the reference app."

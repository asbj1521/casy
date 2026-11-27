#!/usr/bin/env bash
# The project the app talks to (#202): the Supabase address and its publishable
# key, from .env.local as the web build reads them (VITE_SUPABASE_URL and
# VITE_SUPABASE_ANON_KEY), written into a Swift file git leaves out. Without its
# page, the app has no one else to learn them from. Every iOS build runs it.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
OUT=ios/App/App/Native/Session/ProjectBuiltIn.generated.swift

value() { grep -E "^$1=" .env.local 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'"'"'\r' || true; }
url="${VITE_SUPABASE_URL:-$(value VITE_SUPABASE_URL)}"
key="${VITE_SUPABASE_ANON_KEY:-$(value VITE_SUPABASE_ANON_KEY)}"
case "$url" in https://*) ;; *) url="" ;; esac
case "$key" in *[!A-Za-z0-9._-]*) key="" ;; esac

next=$(cat <<SWIFT
// Written by scripts/native/project-endpoint.sh from .env.local; not in git.
// Empty without .env.local: the app then uses what its page said (ProjectEndpoint).
enum ProjectBuiltIn {
    static let url = "$url"
    static let apiKey = "$key"
}
SWIFT
)
# Rewritten only when it changes, so Xcode doesn't rebuild for nothing.
if [ ! -f "$OUT" ] || [ "$(cat "$OUT")" != "$next" ]; then printf '%s\n' "$next" > "$OUT"; fi

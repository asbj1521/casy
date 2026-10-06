/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { execSync } from "node:child_process";

/**
 * Which code a build was made from, shown on the phone profile and sent with
 * feedback (src/lib/feedback.ts): the short commit id, Vercel's own when it
 * builds (it may not have the git history), or "dev" without one.
 */
function buildId(): string {
  const vercel = process.env.VERCEL_GIT_COMMIT_SHA;
  if (vercel) return vercel.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}
process.env.VITE_APP_BUILD ??= buildId();

/**
 * Libraries the first page needs, each in a chunk of its own: they change far
 * less often than the app, so a deploy leaves them cached. Only packages the
 * entry loads anyway belong here; one used only by a lazy page (react-icons)
 * would otherwise be downloaded by every visitor.
 */
const VENDOR_CHUNKS: Record<string, string[]> = {
  react: ["react", "react-dom", "scheduler", "react-router", "react-router-dom"],
  motion: ["framer-motion", "motion-dom", "motion-utils"],
  auth: ["@supabase/auth-js", "tslib"],
  query: ["@tanstack/query-core", "@tanstack/react-query"],
};

const CHUNK_OF_PACKAGE = new Map(
  Object.entries(VENDOR_CHUNKS).flatMap(([chunk, pkgs]) => pkgs.map((p) => [p, chunk])),
);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 8080,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const pkg = id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1];
          return pkg ? CHUNK_OF_PACKAGE.get(pkg) : undefined;
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // The tests never talk to a real project, so they get a made-up one
    // instead of whatever a developer's .env.local holds (CI has none).
    env: {
      VITE_SUPABASE_URL: "https://test-project.supabase.co",
      VITE_SUPABASE_ANON_KEY: "test-publishable-key",
      // Far from Danish time, on every machine: code that slips back into the
      // browser's own zone (getHours, new Date(y, m, d)) then fails here, not
      // only for someone abroad. Everything should name its zone (lib/zone.ts).
      TZ: "America/New_York",
    },
  },
});

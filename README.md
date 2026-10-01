# Casy

Casy (short for Calendar Syncing) finds dates that work for a whole group. Everyone links their calendars, and Casy finds the first time the group is free, suggests it to them, and puts the agreed event in their calendars.

Live at **[casy.app](https://casy.app)**, in Danish with an English switch. [How it works](https://casy.app/how-it-works) walks through it step by step.

## What it does

- **Calendars:** Google, Outlook, iCloud, or any calendar link (ICS), re-synced every hour. Casy stores only the start and end of busy times, never what the events are.
- **Groups:** made with an invite link. Members see each other's names and busy times, nothing more.
- **Scheduling:** name the plan, set its start time, length and days (or a multi-day trip), and the first date everyone can make appears at once, with the month drawn day by day under it. Each calendar can be marked as work or school (time you could take off for a trip) and as skippable, normal or never to skip.
- **Agreeing:** a suggested date goes to the group, who accept or decline it. A decline swaps in the next date that works. Once everyone has accepted, Casy can add the event to an iCloud calendar, or hand out an .ics file.

## Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, Framer Motion. Hosted on Vercel.
- **Backend:** Supabase: Postgres (every table closed to the browser by RLS), Auth, Edge Functions in Deno, Vault, and pg_cron for the hourly sync.
- Calendar credentials are encrypted at rest with AES-256-GCM.

## Running it locally

You need Node and the Supabase CLI, plus a `.env.local` with at least:

```bash
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key>
VITE_TURNSTILE_SITE_KEY=<optional; without it sign-in has no CAPTCHA>
```

```bash
npm install
npm run dev         # http://localhost:8080
npm run build       # type-check and production build
npm run test:run    # frontend tests (Vitest)
npm run lint
npm run format      # Prettier

# Edge Functions, from supabase/functions/
deno test --node-modules-dir=none --allow-all _shared/
```

CI runs lint, the Prettier check, the build, and both test suites on every push and pull request to `main`.

## Deploying

Pushing to `main` deploys the site on Vercel. Database migrations and Edge Functions are deployed by hand with `supabase db push` and `supabase functions deploy`, migrations first.

## More

[CLAUDE.md](CLAUDE.md) has the full picture: architecture, data model, auth, sync and the conventions the code follows.

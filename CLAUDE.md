# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Claude Operational Rules

- Execute tools and commands without asking for permission first
- Prioritize methodical execution over speed; explain reasoning as you go
- Treat the user as a capable engineer; avoid over-explaining obvious concepts
- Explain code changes as you would to a junior engineer: clear, educational, thorough
- Commit on the feature branch whenever a step is done and checks pass; no need to ask
- Never merge into `main` (or push `main`) unless the user explicitly says so: it deploys to casy.app
- Provide critical, honest analysis; prioritize solution quality over convenience
- Ask clarifying questions when intent is ambiguous rather than assuming
- Website copy: no emojis, and no em or en dashes, in both Danish and English (`plan-ai` strips dashes from what the AI writes too)
- Apple's calendar is "Apple Calendar" / "Apple-kalender" and its account an "Apple account" / "Apple-konto" in all copy, Edge Function messages included; never "Apple iCloud Calendar" or "iCloud" as its name (code names and `/help/connect-icloud` keep "icloud")
- The site is Danish by default with an English switch: every new piece of text needs both languages (see Languages below)

## Project Overview

**Casy** (short for Calendar Syncing; formerly Autodate) is a scheduling tool that helps groups of people find dates that work for everyone. Live at **https://casy.app** (`www.casy.app` 308s to the apex; the older `casy-red.vercel.app` still serves, so invite links sent before the move keep working). The Supabase project, folder, git remote URL and internal code names still say "autodate" on purpose (board IDs and links depend on them); only user-facing text says Casy. The GitHub repo itself is now `asbj1521/casy`; the old `asbj1521/Autodate` URLs redirect, which is why the git remote still works. Never change the `"autodate lookup hash v1"` label in `secretBox.ts`: it would change every stored ICS-link hash.

Casy Users sign in, link their calendars (Google, Outlook, Apple Calendar, any ICS link, or in the iPhone app the phone's own), join friend groups, and Casy finds the dates everyone is free. Dates are suggested as a vote, swiped on, and the agreed event goes into everyone's calendar. Signed in, AI features (planning by text or speech, labels, trips, Tell Casy) build on Claude Haiku. The website has a computer and a phone layout; the iPhone app (Capacitor) uses the phone layout, which is one home page (My calendar, with Aftaler, Planlæg and Profil along its bottom and their sheets over it, #169). The full tour of every page is `docs/architecture/overview.md`.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite, React Router v7 (`BrowserRouter`), TanStack Query, Framer Motion, Tailwind with hand-built components (the shared ones in `src/components/ui/`), lucide-react icons (brand marks from `react-icons`)
- **Backend:** Supabase: Postgres (RLS on, no policies), Auth, Edge Functions (Deno), Realtime (broadcast only), Vault, pg_cron + pg_net. Hosting: Vercel (project `casy`), auto-deploys `main`
- **AI:** Claude Haiku 5.5 (`claude-haiku-5-5`), only from Edge Functions, through `runSkill()` in `_shared/ai.ts`; paid from prepaid Console credits
- **iPhone app:** Capacitor 8 in `ios/` (bundle id `app.casy`), Swift Package Manager, the app's own plugins in `ios/App/App/`
- **Testing:** Vitest (`src/**/*.test.ts`, pinned to New York time), Deno test (`supabase/functions/_shared/*_test.ts`), Playwright (`e2e/`, a fake backend, screenshot comparisons at 1440 and 390 wide made on Linux only; a `[screenshots]` commit makes CI draw new ones)
- **Linting and formatting:** ESLint (TypeScript + React Hooks); Prettier at 100 columns with the Tailwind class-order plugin

The details and their rules (dark mode, the CSP, the app's build, the test setup): `docs/architecture/platform.md`.

## Design language (phone and app)

The phone and the iPhone app follow one design language, taken from the newest screens (#126 Planlæg, #136 My calendar's glass header, #115 the trip sheet): Apple's Liquid Glass as far as a web view allows, little text, everything lined up. Older screens are brought into it (#153). Follow these rules for any new or changed phone screen; computers change only on purpose.

1. **Pages and sheets.** A page is the page's background with grouped lists (`ui/ListGroup`). Anything opened on top of a page is a glass sheet from the bottom (`ui/BottomSheet`, or `ui/Sheet` when a computer shows the same content as a centred dialog), never a card in the middle of a phone's screen. A sheet opens from where it was pressed (#169): it grows out of its button and shrinks back into it (`origin`), from the bottom for a button down there, from the top for one up there (`edge="top"`, only as tall as it needs). A sheet has its title on the left and one text action on the right (Annuller, Færdig).
2. **One main action per sheet or screen**, a full-width glass capsule with bold orange text, pinned along the sheet's bottom (`ui/FlowButton`; its `quiet` version, the second choice beside it, has the text's own colour). Everything else is a smaller glass capsule or orange text. Solid orange is kept for the one button meant to catch the eye: Planlæg med AI's shimmer.
3. **Standalone buttons are glass capsules** with orange text and icon (`ui/GlassButton`, the `glass-pill` class), like the home page's Planlæg pill. Glass only shines with something behind it; on a plain page it is a soft capsule with a bright rim, which is fine.
4. **Orange:** orange text and icons are `text-primary`. Where a solid orange fill remains, it is `bg-cta` (its contrast with white text is checked), never `bg-primary`.
5. **Choices are list rows.** Picking puts an orange tick at the end of the row (`ListPickRow`, with a real visually hidden checkbox or radio inside, for screen readers and tests); on/off is a switch on the row (`ListSwitchRow`). No checkbox squares, no radio dots, no box that scrolls inside the sheet.
6. **Fields** are the Planlæg name field: `h-12 rounded-xl`, 17px text, a small uppercase label above (`ui/field.ts`: `FIELD`, `TEXTAREA`, `FIELD_LABEL`).
7. **Text:** no intro sentence that repeats what the screen shows. A sentence that is a promise (what others see, who is told) stays, once, as a footnote under the section it is about, shown when it matters.
8. **Order:** what most people do first at the top; leaving and deleting last.
9. **Shapes and sizes:** buttons are capsules (`rounded-full`), lists and cards `rounded-2xl`, sheets 28px at the top; 17px for sheet titles and main buttons, 15px for rows, 13px for a row's detail, 12px for footnotes.

## Common Commands

```bash
npm run dev              # Dev server on port 8080 (the user runs this in their own terminal)
npm run ios              # Build the site and copy it into the iPhone app; then ▶ in Xcode (npx cap open ios)
npm run ios:live         # Dev server + iOS Simulator with live reload (#125): edits show in the real iOS web view in about a second; run again only after Swift changes. `-- "iPhone Air"` picks another simulator, `-- --device` points a real phone at the Mac (then ▶ once in Xcode). Builds into Xcode's default DerivedData (never `cap run`, whose ios/DerivedData fails code signing in iCloud). Xcode 27 has no Simulator.app; DeviceHub.app shows the screen
npm run build            # Type-check + production build
npm run test:run         # Frontend tests once
npm run e2e              # Browser tests (builds into dist-e2e/, serves it on port 4317)
npm run lint             # ESLint
npm run knip             # Unused files, exports and dependencies in src/ and e2e/ (CI runs it; an export used only in its own file loses its `export`)
npm run format           # Prettier (format:check is what CI runs)
npx tsc -b               # Type-check only

# Edge Functions (run from supabase/functions/). --node-modules-dir=none stops Deno
# from using the frontend's node_modules. The tracked root deno.lock pins the functions'
# jsr versions (without it Deno can pick one too new for its minimum dependency age, here
# and in CI), so keep it, but Deno also rewrites it to match the web app's package.json:
# commit it only for a new function dependency, `git checkout deno.lock` otherwise.
deno test --node-modules-dir=none --allow-all _shared/
deno check --node-modules-dir=none */index.ts _shared/*.ts

# AI eval sets (#111): real calls, a cent or so per run; never in CI
ANTHROPIC_API_KEY=$(grep '^ANTHROPIC_API_KEY=' .env.local | cut -d= -f2-) \
  deno run --node-modules-dir=none --allow-net --allow-env --allow-read supabase/evals/run.ts [skill]   # plan-ai, calendar-categorize, event-label, event-profile, entries-ai, trip-legs, occasions

supabase migration list  # Read-only: which migrations are applied remotely
supabase db push --dry-run
```

## Architecture

### Directory structure
```
src/
├── api/          # Every Edge Function call: groups, events, calendars (status, busy, settings, connect, primary calendar), account, admin; mockData (example groups), currentUser
├── components/   # Hand-built UI components; RequireAuth guards signed-in routes; AdminPanel is lazy-loaded; ui/ holds the shared pieces (Notice, ConfirmPanel, Collapse, Avatar, Switch, CopyField, Bone, BottomSheet, FitSelect: a native select as wide as its choice, AiReadout: what the AI made of something, folded away; and the design language's pieces (#153): Sheet (a glass bottom sheet on a phone, a dialog on a computer), FlowButton (the main glass capsule), GlassButton, ListPickRow and ListSwitchRow in ListGroup, field.ts): use them rather than restyling a box or a confirm by hand. One page's own pieces get a folder (findDate/, myEvents/, appleWalkthrough/, profile/, groups/: GroupList and GroupDetails, shared by both layouts). The phone layout's pieces: calendarView/HomeBar (the home page's Aftaler, Planlæg and Profil buttons; no tab bar, #169), PhoneHeader (TopNav on a phone), PhoneSubHeader (a screen's back button and title), and ui/ListGroup (iPhone-style grouped rows, ListRow inside), which every phone screen is built from. A section or row owns its queries and mutations (GroupList, GroupDetails, CalendarsSection, PasswordSection, CalendarListPanel's rows, GroupPanel, My events' rows); pages compose them instead of passing handlers down
├── context/      # Auth: AuthProvider (session) + auth.ts (useAuth; useSignedInUser for pages behind RequireAuth; displayName)
├── hooks/        # usePhoneLayout (phone or computer), useCalendarsHome (where connecting calendars happens), useCalendarReturn (back from Google or Outlook), useSchedulingGroups (real vs example groups), useDateSearch (the scheduling page's answer), usePlanning (a plan's state, search and sending: the scheduler and My calendar's Planlæg share it), useExampleCarousel, useEventChange (one change to a suggested event), useCopy, useCaptcha
├── i18n/         # Languages: da.tsx (the shape) + en.tsx, useT/useLang, current.ts for code outside React
├── lib/          # Pure logic + clients (see below); tests sit next to the code
├── pages/        # Landing (/ signed out), FindDate (/plan, and / signed in), MyEvents (/events), SignIn, Profile, CalendarOverview, JoinGroup (/join/:token), Privacy, Terms, HowItWorks; lazyPages.ts holds the one loader per lazy page (App.tsx and prefetching share it)
└── types/        # Core data model (BusyInterval, Participant, TimeSlot, ...)
e2e/              # Browser tests (Playwright): world.ts (made-up data), backend.ts (fake Edge Functions), fixtures.ts, specs, __screenshots__/
ios/              # The iPhone app's Xcode project (Capacitor); App/App/public is the copied build, not in git
supabase/
├── functions/    # One folder per Edge Function; _shared/ holds what they share: the HTTP shell (http.ts), the caller check (auth.ts), provider adapters and helpers
└── migrations/   # Schema history; applied with `supabase db push`
```

### Where to read more

Before changing an area, read its doc; when the behaviour changes, update the doc in the same commit (it holds what used to be here).

- **Scheduling** (the engine, the scheduler page, who an event is for, votes): `docs/architecture/scheduling.md`. Main files: `src/lib/availability.ts`, `eventSearch.ts`, `scheduler.ts`, `candidates.ts`, `vote.ts`, `src/hooks/usePlanning.ts`, `src/components/findDate/`, `swipe/`
- **My calendar and Planlæg** (both layouts, the phone's home page and its sheets, the paper pile, sending): `docs/architecture/my-calendar.md`. Main files: `src/components/calendarView/`, `planFromCalendar/`, `swipe/MonthView.tsx`
- **AI** (foundation and consent, Planlæg med AI, sorting, labels, profiles, warnings, ranking, corrections, trips, occasions, Tell Casy): `docs/architecture/ai.md`. Main files: `supabase/functions/_shared/ai.ts` and the skills beside it, `src/hooks/useAiPlanner.ts`, `useEventLabels.ts`, `useTrips.ts`, `useTellCasy.ts`
- **Platform** (theme, hosting and CSP, the iPhone app, tests, storage, live updates, landing, legal pages, sign-in helpers, the layout switch, connecting calendars): `docs/architecture/platform.md`
- **Backend** (every function's actions, invitations, report and block, events, accounts, auth emails, admin, data model, calendar writes, backups, retention, secrets, sync): `docs/architecture/backend.md`
- **The product tour** (what each page does today): `docs/architecture/overview.md`

### Rules that span the code

Each is explained in its area's doc; these hold everywhere.

- **Time:** all local-time arithmetic goes through `src/lib/zone.ts`, and every date shown is Danish time (`APP_TIME_ZONE`). Never step days by adding 86 400 000 ms, and never use a `Date`'s local getters (`getHours`, `new Date(y, m, d)`): the Vitest run is pinned to New York so such a slip fails.
- **Computers change only on purpose:** where the phone differs, it gets its own component, chosen with `usePhoneLayout`; the computer's reference images must not move on phone work.
- **Dark mode:** write colours as for light mode (the Tailwind families in `tailwind.config.js` mirror themselves in dark), keep white text on buttons in `cta`, check the page in dark; light mode stays pixel for pixel.
- **The browser's outside services:** a new one must be added to the Content-Security-Policy in `vercel.json` first, or it is blocked on the live site only.
- **The iPhone app:** plugins are imported dynamically and only their module goes through promises; a new Swift file is added to `project.pbxproj`; `npx cap sync ios` after adding a plugin; the permission texts and `PrivacyInfo.xcprivacy` stay true; build into Xcode's default DerivedData, never a folder inside the repo (iCloud breaks code signing).
- **Edge Functions:** written with `serve()` (`_shared/http.ts`) and `requireCaller()`; never take a user id from a request body or query; a new function or action needs a case in `e2e/backend.ts`; shared data that should update live goes into `live_pulse()` with a `pulse_on_change()` trigger.
- **Personal data:** a new kind of stored data goes into `_shared/myData.ts` (Your data and the export) and the privacy policy, with a retention period there too; the periods in the privacy policy and the code change together.
- **AI:** every call goes through `runSkill()`; anything that sends calendar content to the AI needs `aiContentAllowed` (the person's consent), and letting the AI do more with it raises `CONSENT_VERSION` and `AI_CONSENT_VERSION` together; an admin-only AI feature is for AI testers too; the privacy policy's "AI i Casy" stays true; eval cases are made up (the repo is public).
- **Pairs kept equal by tests, so change both sides:** `eventVocabulary` (src and `_shared`), the day scores (`supabase/testdata/dayScoreCases.json`), the phone's busy rules (`src/lib/phoneBusy.ts` and Swift `PhoneBusy`), the settings validation (`_shared/events.ts`), the trip note (`TRIP_NOTES`).
- **The first load:** only the landing page, the shell and Danish are in the entry chunk (#157). A new page goes through `lazyPages.ts`, app-only work through `AppBackground`, and anything heavy that opens on demand is `lazy()`; Casy's own random choices use `appRandom`/`oncePerLoad` (`lib/appRandom.ts`), never `Math.random`, so the browser tests stay the same on every load.
- **Remembered queries** (`queryPersistence.ts`) are only ever about the signed-in user themself.
- **Never change:** the `"autodate lookup hash v1"` label in `secretBox.ts`, or the auth storage key in `src/lib/supabase.ts` (everyone would be signed out).
- **Releases:** `package.json`'s version equals the Xcode project's `MARKETING_VERSION`; the backend keeps working for every app at or above `MIN_APP_VERSION`.
- **Pages that make promises:** the landing page's data claims, Support, Terms and Privacy stay true to the code; a change to the terms updates its date, and one that matters is announced 30 days ahead.
- **Sign-in in the app:** no Google button unless Sign in with Apple comes first (App Store guideline 4.8).

### Languages
- Danish is the default; the choice is remembered in localStorage (`casy-lang`), and `?lang=en` forces English for that visit (Google's privacy link uses it). Signed in, language is chosen in Settings under the profile (#129: the profile's "Indstillinger" row, `profile/SettingsRow`, opens `/profile/settings`, `pages/Settings`: Sprog and Udseende, `profile/SettingsGroups`; a page with a back button on a phone and the app, a page on a computer); the DA | EN switch in the header (`LanguageToggle`) is only for someone signed out, who has no profile.
- Shared UI text lives in `src/i18n/da.tsx`, which defines the shape; `en.tsx` is typed against it, so a missing key fails the build. Components read it with `const t = useT()`. Sentences with a link inside take the link as an argument. Long single-page text (Privacy, Terms, How it works, the four help guides) keeps its own `da`/`en` objects in the page file, typed the same way.
- Plain helpers in `src/lib` take a `Lang` (from `src/i18n/locale.ts`, which has no React) or the words they need; dates use `LOCALE[lang]` (da-DK / en-GB), times always read "16:00".
- A suggested event stores the name typed on the scheduling page as its title, shown as written. Left empty, it stores the matching event type's English name (`storedEventTitle`, see `fallbackTitleId`), which is shown translated (`eventTitle`), so mixed-language groups each read their own language; events suggested before names could be typed work the same way.
- Edge Functions keep writing errors in English; `_shared/http.ts` translates each one as it answers (`translateError` in `_shared/i18n.ts`) when the call asked for `lang=da`. `i18n_test.ts` fails if a translated English message no longer appears in the code. Supabase Auth errors are translated on the page by code (`src/i18n/authError.ts`). The auth emails are written in code, in both languages: see Auth emails below.

### Auth and data access
- Every table has RLS enabled with **no** policies: the browser can't read or write any table. All data goes through Edge Functions using the service role. The one policy is on Realtime's own `realtime.messages`: a signed-in person may receive broadcasts on `pulse:<their id>` and nothing else (no insert policy, so no browser can send). Realtime's "Allow public access" setting is off.
- Every function the site calls is written with `serve()` from `_shared/http.ts`: CORS, the one method, the JSON body, and every error answer. Throw `HttpError` for anything the caller should read; anything else is logged under the function and action and answered with a plain 500, as is a missing secret (`requireEnv`, named in the log). Work after the answer goes through `afterResponse()`.
- Every Edge Function identifies the caller with `requireCaller()` (`_shared/auth.ts`, a 401 without a valid login), which verifies the `Authorization: Bearer <access token>` with Supabase Auth. Never take a user id from a request body or query string. `verify_jwt = false` in `supabase/config.toml` is intentional: the publishable key is not a JWT, so functions check the login in code.
- Every function's actions, invitations, report and block, accounts, auth emails and admin mode: `docs/architecture/backend.md`.

### TypeScript configuration
- Path alias `@/*` maps to `src/*`
- Full strict mode (`strict`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`). Pages behind `RequireAuth` read the user with `useSignedInUser()`, which is never null there; TanStack Query types errors as `Error`, so `mutation.error?.message` needs no `instanceof` check.

## Environment Variables

All secrets live in `.env.local` (never committed). The file always contains a `GitHub repo token=` key used for the GitHub Projects workflow.

- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (a publishable key, not a JWT), `VITE_TURNSTILE_SITE_KEY` (Cloudflare Turnstile's public site key; its secret key is set only in the Supabase dashboard, Authentication > Attack Protection)
- Local copies of server secrets: `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `MICROSOFT_OAUTH_CLIENT_ID/SECRET`, `OAUTH_STATE_SECRET`, `CALDAV_ENCRYPTION_KEY`, `CALENDAR_SYNC_SECRET`
- Edge Function secrets (set with `supabase secrets set`): the ones above plus `FUNCTIONS_BASE_URL`, `ADMIN_USER_IDS` (comma-separated user ids with admin mode; not kept in `.env.local`), and `FRONTEND_ORIGINS` (comma-separated sites OAuth may return to, default first: `https://casy.app,https://casy-red.vercel.app,http://localhost:8080`; `FRONTEND_URL` is the older single-site fallback), `APNS_KEY_ID` and `APNS_KEY` (#139: the APNs key, `.p8`'s contents, for push notifications), `APPLE_TEAM_ID`, `APPLE_KEY_ID` and `APPLE_SIGN_IN_KEY` (#138: the Sign in with Apple key, for keeping and revoking an Apple sign-in; the `.p8` file's contents), `MIN_APP_VERSION` and `APP_STORE_URL` (#143: the oldest app release still supported and the App Store page; unset until v1 is live, read without a deploy), and `ANTHROPIC_API_KEY` (the Console key `plan-ai` uses; a local copy is in `.env.local` for trying prompts)
- Auth email through the hook (function secrets): `RESEND_SEND_KEY` (a Resend API key with sending access only, for casy.app; #78's notifications will share it) and `SEND_EMAIL_HOOK_SECRET` (the hook's signing secret, `v1,whsec_...`, from Authentication > Hooks in the dashboard).
- Auth email fallback (Supabase Auth SMTP, used only while the hook is off; set in the Supabase **dashboard**, not with `supabase secrets set`): host `smtp.resend.com`, port 587, user `resend` (the literal word), password `RESEND_API_KEY` (kept in `.env.local`, never a function secret), sender `noreply@casy.app`, sender name `Casy`. The sending domain must be **verified in Resend** or it delivers only to the Resend account owner, which is the same dead end as Supabase's built-in mailer. `supabase/config.toml` records the same settings and reads the key as `env(RESEND_API_KEY)`.
- Vercel project environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY` (a change needs a redeploy to take effect)

Handling rules:
- Read the GitHub token into a shell variable inside the command; never write a token or key into a command line that gets saved (e.g. permission rules in `.claude/settings.local.json`) or print it.
- To hand a secret to the user, put it on the clipboard (`pbcopy`) and clear the clipboard afterwards; don't print it in the chat.

**If a required key is missing:** stop immediately and show this message. Do not attempt to work around it or proceed:

> "This action requires a key that isn't in your `.env.local`. You may not have access to this part of the project. Reach out to the project owner to get the correct credentials."

Never guess, hardcode, or substitute a missing key.

## Deploying

The website deploys itself: every push to `main` makes Vercel build and publish it (check the Deployments tab if the live site doesn't update). A new site address must also be added to Supabase Auth's Site URL / Redirect URLs, to `FRONTEND_ORIGINS`, and to the Google OAuth branding (home page, privacy link, authorized domain).

Changes under `supabase/` only take effect once deployed. Claude Code's auto mode blocks Claude from changing (or reading) the live database and functions, so **the user runs the deploy commands** in their own terminal; give them the exact commands and what to expect:

```bash
supabase db push                          # apply new migrations (after `--dry-run` shows which)
supabase functions deploy [name]          # all functions, or one by name
```

Order: migrations before the functions that depend on them. Afterwards, `supabase migration list` confirms what is applied. Docker is not installed, so migrations can't be tested on a local database; write them to fail safely (check preconditions, raise instead of guessing).

## CI/CD

GitHub Actions workflow at `.github/workflows/ci.yml` runs on every push to any branch and on PRs to `main`, in three jobs: the web app (ESLint, knip, the Prettier check, `npm run build`, which type-checks first, `e2e/` included, and the Vitest suite), the browser tests (Playwright in its Docker image, whose version must match the pinned `@playwright/test`; on failure the report with screenshot diffs is uploaded as `browser-test-results`), and the Edge Functions (`deno check` and the Deno tests). `.github/workflows/screenshots.yml` makes new reference screenshots on a branch (never `main`), running the whole browser suite: it is where a `[screenshots]` commit's browser tests run, since CI's browser job skips that commit and the bot's commit starts no CI. Run the same locally before handing work over (`npm run e2e` covers the behaviour tests). CI never builds the iPhone app; ESLint and Prettier skip `ios/`.

---

## Session-Start Workflow

**Run all of these steps automatically at the start of every session — no need for the user to ask.**

### Step 1 — Read the Codebase

Scan the directory structure and key files (`App.tsx`, `src/api/`, `src/context/`, `src/pages/`) to understand current state. This should be silent — don't narrate it, just do it.

### Step 2 — Git Housekeeping

```bash
git status
git pull origin main
```

### Step 3 — Load GitHub Token

Read `.env.local` and extract the value after `GitHub repo token=`. Use it as the Bearer token for all GitHub API calls in this session.

### Step 4 — Present Session Options

Fetch the project board (query below), then greet the user with exactly two options:

> **What would you like to work on today?**
>
> **Option 1 — Something new:** Tell me what you want to build, fix, or explore and we'll design it together.
>
> **Option 2 — Pick a TO-DO:** Here are the open items on the board:
> 1. #XX — [title]
> 2. #XX — [title]
> 3. #XX — [title]
> *(show up to 3; if none exist, say so and default to Option 1)*

**Query to fetch TO-DO items:**
```
POST https://api.github.com/graphql
Authorization: Bearer <token>

{
  node(id: "PVT_kwHOD5fAM84BbNZz") {
    ... on ProjectV2 {
      items(last: 100) {
        nodes {
          id
          fieldValues(first: 10) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2SingleSelectField { name } }
              }
            }
          }
          content {
            ... on Issue { title number state url body }
            ... on DraftIssue { title body }
          }
        }
      }
    }
  }
}
```

### Step 5 — Agree on a Plan

Before writing any code, discuss the approach. Be critical — push back on bad ideas, flag complexity, suggest robust alternatives. Only proceed once the user has explicitly agreed on the implementation plan.

### Step 6 — Branch Setup

```bash
# If on main, create a feature branch:
git checkout -b feature/[task-name]
```

If the user picked an existing TO-DO, **clean it up first** before touching the board:

- Rewrite the title if it's messy, vague, or typo-ridden — keep it short and descriptive
- Rewrite or write the body as a clean `## Problem / Feature` section — max 5 lines, no filler
- Patch the issue via REST:
  ```bash
  PATCH https://api.github.com/repos/asbj1521/casy/issues/<NUMBER>
  { "title": "Clean title", "body": "## Problem / Feature\n\nConcise description..." }
  ```
- Show the user the cleaned title + description and confirm before proceeding

Then move it to **In Progress** on the board:
```
mutation {
  updateProjectV2ItemFieldValue(input: {
    projectId: "PVT_kwHOD5fAM84BbNZz"
    itemId: "<ITEM_ID>"
    fieldId: "PVTSSF_lAHOD5fAM84BbNZzzhV_jKU"
    value: { singleSelectOptionId: "47fc9ee4" }
  }) {
    projectV2Item { id }
  }
}
```

If it's something new, create a GitHub issue for it first, add it to the board, then move it to In Progress:
```bash
POST https://api.github.com/repos/asbj1521/casy/issues
{ "title": "...", "body": "## Problem / Feature\n\n..." }

# Then add to board:
mutation { addProjectV2ItemById(input: { projectId: "PVT_kwHOD5fAM84BbNZz" contentId: "<ISSUE_NODE_ID>" }) { item { id } } }
```

### Step 7 — During Work

- One step at a time — explain what you're about to do before doing it
- User tests locally with `npm run dev` in a separate terminal
- Commit freely on the feature branch once checks pass; never commit directly to main
- Changes under `supabase/` need deploying before the user can test them (see Deploying)

### Step 8 — Wrap Up (only when the user explicitly says so, e.g. "finish the workflow")

All the waiting is CI's (about two minutes); never block the session on it.

1. **Start the merge in the background:** `npm run finish` with `run_in_background: true`, from the feature branch with everything committed and the local checks passing. `scripts/finish.sh` pushes the branch, waits for every Actions run on that commit (`gh run watch`), takes the screenshot bot's commit if there is one, then fast-forwards `main`, pushes it and deletes the branch. It stops before touching `main` if a check fails, if `main` has moved on (rebase on `origin/main` and run it again), or if the branch on GitHub holds commits CI didn't check. Never wait by hand with `sleep` loops; you are told when it exits.
2. **Meanwhile, update the issue body:** append a `## What was done` section (3–5 bullet points) to the original description:
   ```bash
   PATCH https://api.github.com/repos/asbj1521/casy/issues/<NUMBER>
   { "body": "<original body>\n\n---\n\n## What was done\n\n- ..." }
   ```
3. **Once `finish` has succeeded,** move the card to Done (`value: { singleSelectOptionId: "98236657" }`) and close the issue (`PATCH .../issues/<NUMBER>` with `{ "state": "closed" }`), in one command. If it failed, say why (the run's link is in its output), fix it on the branch and run it again.

### Project IDs Reference

| Field | ID |
|---|---|
| Project | `PVT_kwHOD5fAM84BbNZz` |
| Status field | `PVTSSF_lAHOD5fAM84BbNZzzhV_jKU` |
| Status: TO-DO's | `f75ad846` |
| Status: In progress | `47fc9ee4` |
| Status: Done | `98236657` |
| Repo | `asbj1521/casy` (renamed from `asbj1521/Autodate`, which redirects) |

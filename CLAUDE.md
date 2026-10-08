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
- Website copy: no emojis, and no em or en dashes, in both Danish and English
- Apple's calendar is "Apple Calendar" / "Apple-kalender" and its account an "Apple account" / "Apple-konto" in all copy, Edge Function messages included; never "Apple iCloud Calendar" or "iCloud" as its name (code names and `/help/connect-icloud` keep "icloud")
- The site is Danish by default with an English switch: every new piece of text needs both languages (see Languages below)

## Project Overview

**Casy** (short for Calendar Syncing; formerly Autodate) is a scheduling tool that helps groups of people find dates that work for everyone. Live at **https://casy.app** (`www.casy.app` 308s to the apex; the older `casy-red.vercel.app` still serves, so invite links sent before the move keep working). The Supabase project, folder, git remote URL and internal code names still say "autodate" on purpose (board IDs and links depend on them); only user-facing text says Casy. The GitHub repo itself is now `asbj1521/casy`; the old `asbj1521/Autodate` URLs redirect, which is why the git remote still works. Never change the `"autodate lookup hash v1"` label in `secretBox.ts`: it would change every stored ICS-link hash.

Casy Users sign in, link their calendars (Google, Outlook, Apple Calendar, or any ICS link), and the app finds the earliest shared free window in their busy times.

**Current state:** a signed-out visitor to `/` sees the landing page (`src/pages/Landing.tsx`: what Casy is for, a short "your data" section, and "Go to Casy" to the scheduler at `/plan`); a signed-in person gets the scheduler at `/` directly. Everything a signed-in user touches is real: their calendars (stored in Supabase, re-synced hourly), friend groups with invite links (`/join/:token`), and group availability built from every member's real busy times. Someone with no groups yet sees ten generated example groups (`src/api/mockData.ts`), each labelled "Example", with their own real calendar swapped into the "you" slot. My groups (`/groups`) lists your groups and the invitations waiting for you, with each group's members and its invite, rename, leave and delete (delete only for groups you created); connecting calendars is a page of its own opened from My calendar (`/calendar-overview/accounts`), and someone with no calendar connected is asked to connect one: on a phone by being sent there once after sign-in, on a computer by a pop-up once per visit; the profile is just you: your display name, sign-in and security, feedback, sharing, help, deleting the account, and, for admins only, admin mode. The scheduling page puts the answer first: you name the event yourself and set start time, length and weekdays (or, with the "Tur / ferie" switch, a number of days and a start day), and when ("Hvornår": any time, or a run of months), and the first date everyone can make updates as you change them, with the month drawn day by day under it. "Suggest dates" (arrows beside it step through dates) sends that date and up to four more good ones in the period as a vote (#74): everyone, the suggester too, swipes through them once (`/events/:eventId/dates` on a phone; the open event's pane on a computer), right "can", left "can't", up "can, but rather not", with their own calendar around each date under the card, and the date nobody declined with the fewest "rather not" is chosen (the suggester picks if every date has a no). Events suggested before #74 offer one date at a time, accepted or declined on My events (`/events`), a decline swapping in the next date. Once everyone has accepted, "Add to my calendar" puts the event into the person's primary calendar (iCloud only so far; chosen on the calendars page or My calendar), or on its own with "Add automatically" on; without a writable calendar the button downloads an .ics file instead.

On a phone (below 768px, the website and the iPhone app alike) the same pages are laid out like an app: a tab bar along the bottom (Groups, Events, Scheduler in the middle, Calendar, Profile), a compact header, and screens that open into their own screens with a back button (a group, the profile's sign-in and security, connecting calendars). The scheduler is a flow of four steps, one screen each (#101): the group (a tap picks, Next moves on), what and when, the optional details (Deltagere in a sheet, place and note), and the dates, which the suggester swipes first exactly as the group will, their own calendar under each card (a "can't" takes a date out and the next good one takes its place), then a summary with their answers, how many dates and how long to answer, and "Send datoer til afstemning", their answers going with the dates; the first date is shown live above the button while setting up. Groups and invitations get their own tab, connecting calendars moves into the Calendar tab, and the profile is a short list (security, feedback, share, help, sign out, delete). Computers have the same structure (My groups in the header, calendars under My calendar, a short profile) laid out for a wide screen, with a list on the left and its detail on the right: My groups shows the list and the open group side by side, My events the events and the open one (`/events/:eventId`, in depth: answers, earlier dates, actions; phones show every event as one list of compact rows instead, #103: newest first, yellow while pending, green once agreed, past ones greyed at the bottom for a week (`phoneEventList`), each opening in place, `components/myEvents/phone/`), and My calendar Apple Calendar's month view as a Mac draws it, the calendars in a sidebar beside it (#104: `components/calendarView/ComputerCalendar.tsx`; a phone gets the iPhone's, `PhoneCalendar.tsx`). The iPhone app (`ios/`, Capacitor) is a spike (#63): it runs on a phone from Xcode with a free Apple ID; reading the phone's calendars, the reason for an app, is not built yet.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite, React Router v7
- **UI:** Tailwind CSS with hand-built components (`src/components/`), no component library; icons from lucide-react, except the real Google/Microsoft/Apple brand marks (`src/components/calendarProviders.tsx`, for the calendars page and the connect pop-up), which come from `react-icons` (`si`/`fa6`)
- **Animations:** Framer Motion
- **State:** component state plus TanStack Query for server data, with a few of the user's own answers remembered across reloads (`src/lib/queryPersistence.ts`); two React contexts: auth (`src/context/`) and language (`src/i18n/`)
- **Hosting:** Vercel (project `casy`), auto-deploys `main`; `vercel.json` rewrites every path to `index.html` for the SPA and sets the security headers (no framing, nosniff, referrer, permissions, HSTS, and a Content-Security-Policy, #86: scripts only from the site and Cloudflare Turnstile, no inline or eval; connections only to the site, the Supabase project over HTTPS and WebSocket, and Have I Been Pwned; `src/lib/securityHeaders.test.ts` guards it). A new outside service the browser talks to must be added there first, or it is blocked on the live site only; the project's Supabase URL is written into it. The iPhone app serves the build itself, so these headers don't apply there
- **Backend:** Supabase: Postgres, Auth (Google sign-in + email magic link), Edge Functions (Deno), Realtime (broadcast only), Vault, pg_cron + pg_net
- **iPhone app:** Capacitor 8 (`capacitor.config.ts`, bundle id `app.casy`): `ios/` is an Xcode project that packages the same Vite build. Swift Package Manager, no CocoaPods. Native touches live in `ios/App/App/MainViewController.swift`; plugins (`@capacitor/share`, `@capacitor/haptics`) are imported dynamically so the website never downloads them; after adding one, `npx cap sync ios` updates the checked-in `ios/App/CapApp-SPM/Package.swift`. Build into Xcode's default DerivedData, never a folder inside the repo: the repo sits in iCloud-synced Desktop, and code signing rejects files carrying iCloud's attributes ("resource fork, Finder information, or similar detritus")
- **Testing:** Vitest (frontend, `src/**/*.test.ts`), Deno test (Edge Functions, `supabase/functions/_shared/*_test.ts`) and Playwright (browser tests of the built site, `e2e/`, see `e2e/README.md`): behaviour tests and whole-page screenshot comparisons at 1440 and 390 wide, against a fake backend answering every Edge Function from made-up data typed with `src/api`'s types (a new function or action needs a case in `e2e/backend.ts`). Reference images are made on Linux only (a Mac skips the comparison): a commit message with `[screenshots]` makes CI's "Update screenshots" workflow commit new ones to the branch. A change that moves pixels on purpose comes with new images; the computer's images changing on phone work is the signal that something slipped
- **Linting and formatting:** ESLint (TypeScript + React Hooks); Prettier at 100 columns with the Tailwind class-order plugin (`.prettierrc.json`); the Prettier commit is listed in `.git-blame-ignore-revs`

## Common Commands

```bash
npm run dev              # Dev server on port 8080 (the user runs this in their own terminal)
npm run ios              # Build the site and copy it into the iPhone app; then ▶ in Xcode (npx cap open ios)
npm run build            # Type-check + production build
npm run test:run         # Frontend tests once
npm run e2e              # Browser tests (builds into dist-e2e/, serves it on port 4317)
npm run lint             # ESLint
npm run format           # Prettier (format:check is what CI runs)
npx tsc -b               # Type-check only

# Edge Functions (run from supabase/functions/). --node-modules-dir=none stops Deno
# from using the frontend's node_modules; delete any deno.lock it leaves behind.
deno test --node-modules-dir=none --allow-all _shared/
deno check --node-modules-dir=none */index.ts _shared/*.ts

supabase migration list  # Read-only: which migrations are applied remotely
supabase db push --dry-run
```

## Architecture

### Directory structure
```
src/
├── api/          # Every Edge Function call: groups, events, calendars (status, busy, settings, connect, primary calendar), account, admin; mockData (example groups), currentUser
├── components/   # Hand-built UI components; RequireAuth guards signed-in routes; AdminPanel is lazy-loaded; ui/ holds the shared pieces (Notice, ConfirmPanel, Collapse, Avatar, Switch, CopyField, Bone, BottomSheet): use them rather than restyling a box or a confirm by hand. One page's own pieces get a folder (findDate/, myEvents/, appleWalkthrough/, profile/, groups/: GroupList and GroupDetails, shared by both layouts). The phone layout's pieces: TabBar, PhoneHeader (TopNav on a phone), PhoneSubHeader (a screen's back button and title), and ui/ListGroup (iPhone-style grouped rows, ListRow inside), which every phone screen is built from. A section or row owns its queries and mutations (GroupList, GroupDetails, CalendarsSection, PasswordSection, CalendarListPanel's rows, GroupPanel, My events' rows); pages compose them instead of passing handlers down
├── context/      # Auth: AuthProvider (session) + auth.ts (useAuth; useSignedInUser for pages behind RequireAuth; displayName)
├── hooks/        # usePhoneLayout (phone or computer), useCalendarsHome (where connecting calendars happens), useCalendarReturn (back from Google or Outlook), useSchedulingGroups (real vs example groups), useDateSearch (the scheduling page's answer), useExampleCarousel, useEventChange (one change to a suggested event), useCopy, useCaptcha
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

### Key modules
- `src/lib/availability.ts`: the scheduling engine. Pure functions over epoch ms: single meetings, whole-day spans (vacations), weekly spans (weekend trips), vacation suggestions. Work/school blocks are "soft" (need time off), all-day absences are "hard". Each calendar's priority (`skip` / `normal` / `never`, on `BusyInterval.priority`) overrides that: `skip` never blocks, `never` always blocks, trips included. A single meeting skips `skip` blocks only when the earliest date nobody skips for is more than a week later (`findMeetingSlot`), and reports who would skip as `conflicts`.
- `src/lib/zone.ts`: all local-time arithmetic (local midnight, clock hours, weekdays, months) via Intl. Days are local midnight to local midnight, so DST days are 23/25 hours. The engine, the day chart's numbers and My calendar (`calendarOverview.ts`, `danishHolidays.ts`) take a **required** `timeZone`, and `format.ts` writes dates and times in `APP_TIME_ZONE` (Europe/Copenhagen) unless given another: every date Casy shows is Danish time, never the browser's own. Busy blocks are always UTC instants. Never step days by adding 86 400 000 ms, and never use a `Date`'s local getters (`getHours`, `new Date(y, m, d)`): the Vitest run is pinned to New York (`vite.config.ts`) so such a slip fails on every machine. `src/lib/viewerTime.ts` is for someone whose clock isn't Danish time (`sameClock`, mid-winter and mid-summer offsets): `DanishTimeNote` ("All times are Danish time") under the scheduler's settings and on My events and My calendar, and `YourTime` ("12:00-14:00 your time") under an event's time on the scheduler's answer and My events; both render nothing in Denmark. A time zone per group or event is #95.
- `src/lib/monthAvailability.ts`: how many people are free on each day of a month (and who only by skipping or taking time off), from the same `EventSettings` the search runs, drawn by `src/components/DayChart.tsx` as the scheduling page's day by day bar chart. The bars rise left to right when the chart appears or its data arrives, and a month change slides like a carousel (`nextChartMotion` in `src/lib/barRise.ts`, which also holds the rise timing the landing page's copy shares); a group switch only fades; a settings change glides every bar to its new height and fades its colour (`--free`/`--cond` animated per bar, `BAR_SETTLE_SECONDS`). While a group's calendars load, the page keeps its finished layout: the answer card, chart and "Also possible" cards are drawn with placeholders (`ui/Bone.tsx`), and the answer card's warnings sit side by side in a strip along its bottom with one line always reserved, so nothing jumps when the data or a warning arrives.
- `src/lib/earlyMorning.ts`: a single meeting's edge warnings (`edgeWarnings()`, drawn by `EdgeWarningList`), for everyone still invited. Early morning: it ends at 23:00 or later (`LATE_FROM_HOUR`) and someone has something starting at 10:00 or earlier the next morning (`EARLY_UNTIL_HOUR`). Back to back: someone has something ending exactly when it starts. All-day entries never count; skippable calendars do (skipping is about planning over a block, not about being tired or rushed). Only notes: shown in the scheduling page's answer and on My events, where a meeting's card fetches its group's calendars (the same cached data a decline uses).
- `src/lib/scheduler.ts`: the scheduling page's settings turned into a search (`settingsToSearch`: the Tur / ferie switch with a start day is a trip, with "any day" a holiday), the name stored when none is typed (`fallbackTitleId`), the later dates under the answer (`laterSlots`), and how the answer stands (`reviewAnswer`: clean, skip, approve your own time off, others under review, or none; what it costs you and what it costs the rest). The dates stepped through are plain data in `src/lib/answerSteps.ts` (back only replays, every move clears a sign-off); `src/hooks/useDateSearch.ts` runs the search for the step on screen; `src/components/findDate/` draws the answer card, its buttons, the later dates and the group boxes. `src/components/SchedulerSettings.tsx` draws the settings three ways (#98, #101): on wide screens (`xl`) `SettingsPanel`, a box beside the answer and exactly as tall (a two-column grid in `FindDate.tsx`), with the group and name on top and tabs below (Tidspunkt, with a Møde | Tur / ferie choice, then Deltagere, Sted og note, Gentagelse, Afstemning and Hensyn, which are coming soon: `findDate/ComingSoonSettings.tsx`); every tab is drawn in one grid cell so switching never changes the height. Tablets (768px up to `xl`) get a fill-in sentence, whose "Mere" button opens Flere indstillinger (`?settings`, `findDate/MoreSettingsScreen.tsx`, laid over the page). Phones get `StepSettings`, the second step of the phone flow: `FindDate.tsx` keeps every bit of state and search and, on a phone, renders `findDate/phoneFlow/` instead of the page (`FlowShell`: header, progress and the button pinned above the tab bar; `GroupStep`, `DetailsStep`, `DraftDeck` for the dates, `LiveAnswer`, and `FieldRow` for a setting in a list row). The vote's settings are on the dates step on purpose: among the details they made no sense to someone who doesn't yet know Casy sends several dates. The dates swiped are `pickCandidates` less the ones taken out (asked for that many more, then filtered), and the answers and removals (`Draft` in `FindDate.tsx`) belong to the search they were given for: a change of group, settings or period starts them afresh. The step is in the address (`?step=what|details|dates`, none for the group; `src/lib/schedulerFlow.ts`), so the phone's back button goes a step back; the dates step sends exactly the dates swiped, with the answers. The chart must stay on the first screen of a 1440 x 800 window, meeting or trip: `e2e/scheduler.spec.ts` checks it, so a new setting gets a tab, never a row. The answer follows the settings through `useDeferredValue`; a meeting search starts from now, so a time already gone today is never offered; a meeting day picked in the chart (or an "Also possible" card) is searched on its own first, so it shows even when it needs someone to skip and a clean date follows within the week; and there is no answer while a group's calendars are loading or failed to load. The page keeps its state (settings, name, group, the date stepped to, the month paged to) across moves around the site in memory only (`pageMemory` in `FindDate.tsx`, per account), so a reload starts fresh with random settings.
- Who an event is for (#89): `EventSettings.people` (`members`, `optional` among them, `atLeast` for meetings only), set in the Deltagere tab (`findDate/ParticipantSettings.tsx`: chips cycle Med, Valgfri, Ikke med; you can't leave yourself out; kept per group in the page's memory, `PeopleChoice` → `peopleFromChoice`, undefined at the defaults so ordinary events are stored as before). `peopleForSearch` (eventSearch.ts) is the one place it is applied: only required members are searched, members without a calendar count as able (the quorum asked of the others shrinks), and a meeting's quorum is searched by `earliestQuorumMeeting` (availability.ts: the same people free throughout, tried at window openings and block ends), reporting `absent`. The chart greens days at `enough`, not `total`; the answer says "Første dato hvor mindst N kan" and names who can't; `eventConflicts.ts` checks each person alone, without the rules. The server validates it (`_shared/events.ts` `isPeopleSettings`, UUIDs) and invites only the members named (`suggest_vote_event` `p_members`, all in the group, the suggester among them). `decide_vote` (participants migration): optional members never block or are waited for; without a quorum as before, with one the date most can make among those where N required can; whoever declined the chosen date is dropped from the event and their calendar (`drop_invitee`). After a decision, an optional member's "no", or a required one's while enough still come, drops only them; otherwise the vote reopens as before. `src/lib/vote.ts` mirrors it for display.
- Votes (#74): `src/lib/candidates.ts` picks a vote's dates (`pickCandidates`: the date on screen, then clean dates before ones needing a skip or time off, meetings 2+ days apart on new weekdays where possible, trips and holidays never overlapping, consecutive days only to fill a short period; 5 at most). `src/lib/vote.ts` mirrors the database's decision (`leader`, `bestPick`, `voteStage`: answer / waiting / choose / waitingForChoice) for display only; `decide_vote` in the `swipe_dates` migration is what counts. The scheduler's period is `SchedulerSettings.period` (`PeriodPicker`, turned into the search's window by `periodWindow`; `useDateSearch` and `findAnswer` take that window, and the chart marks days outside it excluded). The swipe screen is `src/components/swipe/`: `SwipeCard.tsx` (the card that follows the thumb, the three answer buttons, `AnswerIcon`) and `clash.ts` (what a date runs into in your calendar), shared with the phone flow's `DraftDeck`; `DateDeck` (the cards, Framer Motion drag, answers saved per swipe without waiting, back to change one, arrow keys), `DayColumns` (your calendar drawn like Apple Calendar's day view, on purpose, so people trust it is their real calendar: hours down the left, today in red, Apple's red now-line, blocks tinted with a bar and their calendar's name, overlaps side by side or indented as Apple draws them (`lib/dayStrip.ts`), names kept in view while scrolling by CSS `sticky` (inside `overflow-clip`, not `hidden`, which would break it; never a scroll listener, which ghosts on iOS momentum scrolling), the suggested date pencilled in dashed; the days are one continuous track moved by a motion value, so they slide whole under the finger and settle on whole days, clipped clear of the hours; widths are measured with `offsetWidth`, which a morph's scale doesn't affect), `CalendarStrip` (the day before, of and after under the card, opened on the suggested time) and `CalendarSheet` (the same days on the whole screen, zoomed out of the strip: the whole calendar scaled down evenly and clipped to the strip's shape grows to the screen through the Web Animations API (`swipe/morph.ts`), never a box resize, which stretches text; Apple's week row with the middle day in a black circle, a band that slides, and a swipe turning the week; the month name opens `MonthView`, Apple's month view laid out by `lib/monthGrid.ts` (bars across days, lanes, "+n"), where a tapped day opens in the day view; "Færdig" closes, a pill always goes back to the suggested date's day view) and `Celebration` (confetti, Framer Motion rather than Lottie: no extra library, no `eval` under the CSP). Your calendar there comes from `useMyCalendarDays` (included calendars plus holidays, calendar names only). `src/lib/haptics.ts`: Capacitor haptics in the app, the Vibration API where a browser has one, nothing in iPhone Safari. My events files votes as `toSwipe` / `voting` (`lib/myEvents.ts`): on a phone a row (`myEvents/phone/EventRows`; a vote to answer goes straight to swiping, an answered one opens to `VoteSummary`, which shows Choose only when no date can win, and marks the date ahead only once half the group has answered), `VoteDetails` (the deck, or `VoteTallies` with the suggester's Choose) on a computer. On a computer the deck is laid out side by side (the card and its buttons, your calendar beside it with the whole day fitted, `fitDay`), the card isn't draggable (buttons and arrow keys), and the calendar opens to fill the open event's box (`contained`; the details section is `relative overflow-hidden` for it) rather than the screen. The deck takes the window's remaining height (`useFillViewport`), so it all fits on one screen; in the opened calendar, ‹ › turn the week, ← → move a day, Esc closes, and a trackpad's two-finger sideways swipe (horizontal wheel events, listened to non-passively so Safari doesn't take it as "back") moves the days like a drag.
- My calendar (#104): `CalendarOverview` picks `PhoneCalendar` (below `md`) or `ComputerCalendar`, both fed by `useMyCalendarView` (your calendar over `SEARCH_WINDOW`, the holiday tick applied, the calendar list). The computer's is a Mac's month view filling the window beside the calendars sidebar, one month at a time over the 12 synced (‹ I dag ›, arrow keys, a trackpad's sideways swipe, non-passive like the swipe screen's); timed blocks are a dot, name and start, whole days a tinted bar (`isWholeDays`), as many lanes as the row height fits, weeks memoised (`WeekRow`, so `pickDay` and the week arrays stay stable); a clicked day opens a popover beside it, placed in percentages of the grid (a click elsewhere or Esc closes it). On a phone: It is the swipe screen's `MonthView` (Apple's month view, `pencil` and `marked` optional) filling the screen under a toolbar ("Kalendere", "I dag"), scrolling inside itself; a tapped day (`selected`, orange; today is a grey circle, `todayTone`) lists its busy time in `calendarView/DayPanel` along the bottom, with no backdrop so other days stay tappable (the same day again, a blank part of the month or Færdig closes it); it is always mounted and only slides by a CSS transition, and `pickDay` must stay stable (`useCallback`) or every memoised month redraws on each tap, and the calendar list with its ticks, categories and priorities (`CalendarListPanel`) lives in the "Kalendere" sheet, which is in the address (`?calendars`) so the way back from Connected calendars returns to it, its intro sentence behind the (i). `MonthView`'s months are memoised (a tap redraws one or two, not twelve) and its weekday row sits above the months' scroller, not sticky inside it (iOS left a sliver over a sticky row). `BottomSheet` slides up as one `transform` string, which Framer Motion hands to the compositor; `y` was stepped from JavaScript and jumped on an iPhone. Ticks go through `useCalendarVisibility` on both layouts; `useMyCalendarDays` also hands over the calendars, error and truncation. Planned next: a Month | Day | List switch.
- `src/lib/holidayBlocks.ts`: the times nobody is free, whatever their calendars say: 23 to 26 December all day, and 31 December 18:00 to 1 January 12:00. `withHolidayBlocks` adds them to every participant's busy time as `never` blocks marked `holiday`, in `participantsFromGroup` (every real-group search, a decline's included) and for the example groups; the edge warnings (`earlyMorning.ts`) skip `holiday` blocks.
- `src/lib/realCalendar.ts`: maps the user's stored blocks into the engine's shape (calendar purpose work/school -> category) and swaps them into an example group's "you" slot.
- `src/lib/eventSearch.ts`: `findEventSlot(participants, settings, …)`, the one search both the scheduling page and a decline run, and `SEARCH_WINDOW`, the months every search covers (this month's 1st plus twelve; the example groups are generated for the same range). A suggested event stores its `EventSettings`, so the replacement date is found by exactly the same rules as the first. `supabase/functions/_shared/events.ts` repeats the settings validation for the server (Edge Functions can't import from `src/`).
- `src/hooks/useSchedulingGroups.ts`: which groups the scheduling page searches. Real groups carry every member's busy time; a member with no calendar is left out of the search (the same dates as counting them free, without the chart's "everyone can" claiming them) and named in `waitingFor`: they check suggested dates themselves and answer on My events (#82). The answer's headline then says "for everyone with a calendar" and a note names them. If nobody in the group has a calendar, `participantsFromGroup` searches everyone as free, so the group (and a decline) still gets dates to answer by hand. With no real groups, the labelled examples cycle instead. Only the group on screen is fetched.
- `src/lib/storage.ts`: `readStored`/`writeStored`, browser storage that never throws (blocked storage reads as empty); every other remembered setting goes through it.
- `src/lib/queryPersistence.ts`: remembers only the `groups`, `calendar-status`, `primary-calendar`, `admin-status` and `whoami` queries in localStorage (keys include the user id, wiped on sign-out, dropped after 7 days), so reloads show them at once; a restored answer is always marked out of date, so the real one is fetched behind it. Only ever add queries about the signed-in user themself: never other people's busy times or the admin overview.
- `src/hooks/useLiveUpdates.ts` (mounted once in `App.tsx`): keeps open pages up to date with what other people do, by watching `live_pulse()`, a hash of the rows the person can see change (groups, members and names, invitations, open events with dates, invitees and answers, their calendar writes), read through the `groups` function's `pulse` action (saves nothing, one read-only query). When it moves, events, invitations and groups are fetched again; group calendars only when membership changed. When to ask: while the tab is visible (and a minute after it is hidden) the page is subscribed to Supabase Realtime (`src/lib/livePush.ts`, `@supabase/realtime-js` loaded only after sign-in): database triggers (`live_push` migration) send an empty broadcast on the private topic `pulse:<user id>` to everyone a write concerns, once per transaction, and the page then asks the pulse; on its own it asks only every 5 minutes. Without Realtime it falls back to polling with backoff (`src/lib/livePace.ts`): every 5 seconds for a minute after activity (the pulse moved, any mutation, back in the tab), then 15, 30, at most 60. A new kind of shared data that should update live must be added to `live_pulse()` and get a `pulse_on_change()` trigger.
- `src/lib/adminOverview.ts`: patches the admin overview after an action so the row disappears at once, while the real overview refetches in the background.
- `src/pages/Landing.tsx`: the front page for signed-out visitors (`Home` in `App.tsx` picks it or the scheduler by login; blank while the session loads). Its data claims (EU/Frankfurt, only busy start/end stored, AES-256 for calendar access, no browser table access, no ads or tracking) must stay true to the code like the privacy policy's. The hero's chart is a hand-made copy of `DayChart` cycling made-up groups with the page's own carousel timing and `FadeSwap` (with `playChildrenOnLoad`, since `AnimatePresence initial={false}` also silences children's entrance animations), so a change to DayChart's look needs copying there.
- `src/pages/Terms.tsx` (`/terms`) and `src/pages/Privacy.tsx` (`/privacy`) share `src/components/LegalPage.tsx` (layout, `CONTACT_EMAIL`). The terms are linked from the footer, the profile's help list (`HelpGroup`, phone, app and computer) and under the sign-in card ("By signing in, you accept..."; the invite page signs in there too). They point to the privacy policy for anything about data rather than repeating it, and are written to hold for what is planned: the app and its App Store section (Apple's required licence terms, so they can stand as the app's EULA), other sign-in and calendar methods, notifications people can switch off, and a free core with paid extras only after the terms get a price section. Before payments start they need the operator's name, address and CVR, and a lawyer's read. A change to either page changes its "Last updated" date; a change to the terms that matters to people must be announced 30 days ahead, as they say.
- `src/lib/cardTransition.ts`: the landing chart's card flying into the scheduler's chart ("Go to Casy") or the sign-in box (both of the landing page's "Sign in" links), through `document.startViewTransition` called by hand: React Router's `viewTransition` only works with its data router, and the app uses `<BrowserRouter>`. A page marks one card `vt-card` (a destination also wraps its contents in `vt-card-content` and calls `cardArrived()` once mounted); a lazy destination's code is loaded first (`prepare`). Links use `flyOnClick()`, which leaves new-tab clicks to the browser. The timeline is in `index.css` under `html.card-flight`. Without browser support, with reduced motion, or with the card out of view, it's a plain navigation.
- `src/pages/ConnectIcloudHelp.tsx` + `src/components/appleWalkthrough/`: the step-by-step iCloud setup (`/help/connect-icloud`, step in `?step=`): what an app-specific password is, an animated drawing of Apple's pages (a Mac and an iPhone version, picked from the browser; `timeline.ts` holds the pointer's beats and is tested), the link to Apple, then connecting through `connectApple()` (`src/api/calendars.ts`, shared with the profile card's quick form). Apple won't make the password after a Face ID, Touch ID or passkey sign-in, so the copy says to sign in with email and password.
- `supabase/functions/_shared/calendarWrites.ts`: putting agreed events into primary calendars and taking cancelled ones out. Rows in `calendar_event_writes` say what should be (`wanted`) and what is (`added`); `processWrites` works off the difference over CalDAV (`putEvent`/`deleteEvent` in `caldav.ts`, never overwriting, so retries can't duplicate). An added row marked `refresh` (its place or note changed) is rewritten in place (`putEvent` with `replace`: `If-Match: *`, so an entry deleted by hand isn't brought back); `added` stays true meanwhile, so a cancel or leave still takes it out. The entry carries the place as `LOCATION` and the note above "Agreed in Casy with…". `catchUpWrites` queues the automatic adds and works off the rows: the events function runs it after its answer is sent (`afterResponse` in `_shared/http.ts`); the hourly sync and "Sync now" retry. Each iCloud sync also compares the UIDs it read with what Casy added (`markGoneEntries`): an entry deleted by hand closes its row with `gone_at`, My events offers "Add it again", and "Add automatically" leaves it alone. `_shared/eventIcs.ts` builds the entry (and the .ics download), titled in the person's language (`primary_calendars.lang`).
- `src/lib/passwordRules.ts`: what a password must be (8+ characters, an a-z letter and a digit like Supabase's `letters_digits`, not the person's email or name, not in Have I Been Pwned's leaks via the k-anonymity range API: only 5 hash characters leave the browser, fails open). Used by `PasswordForm` everywhere a password is chosen, and after a password sign-in to set the weak-password note (`src/lib/weakPassword.ts`, `WeakPasswordNotice` above every page).
- `src/hooks/useCaptcha.ts`: Cloudflare Turnstile on the sign-in page; every email/password auth call sends its one-time token. Without `VITE_TURNSTILE_SITE_KEY` there is no widget and calls go without one.
- `src/lib/supabaseFunctions.ts`: `callFunction()`, the only way the frontend calls Edge Functions, used only by `src/api/`. It attaches the session's access token and `?lang=` (a query parameter, not a header, so no CORS change is needed).
- `src/hooks/usePhoneLayout.ts`: the phone layout's switch (below Tailwind's `md`, 768px; `--tab-bar-height` in `index.css` uses the same line). Where a page differs on a phone, the phone version is a separate component chosen in JavaScript (`Profile` picks `ProfileHub` or the computer's page; `Groups` the list and a group screen, or both side by side), so a computer never renders the phone's parts: change the computer's version only on purpose. `/profile/:screen` is phone-only and sends a computer to the profile. Links into the profile (`?password`, `?mode=admin`, and the calendar arrivals `?connected`, `?error`, `?onboarding`, see `isCalendarArrival`) are answered in place on a computer or passed on to the matching phone screen by `ProfileHub`; calendar arrivals always go on to `/calendar-overview/accounts`, since the OAuth callbacks still return to `/profile`.
- `src/components/CalendarsSection.tsx` (the page at `/calendar-overview/accounts`, phone and computer alike): your accounts as one list whatever the provider, ending in Sync now (`calendars/AccountList`), then Add a calendar (`calendars/AddCalendar`: four tiles on a computer, list rows on a phone; Apple's and the link's forms open under it), then the primary calendar once something is connected. With nothing connected, the onboarding note and the providers taking turns glowing.
- `src/components/ConnectCalendarPrompt.tsx` (mounted once in `App.tsx`, computers only): "Connect your calendar" for anyone signed in with no connected account, on the main pages only (`promptsOnPage` in `src/lib/calendarPrompt.ts`), and only on a `calendar-status` answer fetched on this page load, never the remembered copy. Closed either way, it stays closed for the visit (sessionStorage). A choice opens `/calendar-overview/accounts?connect=<provider>`, where that provider is marked under Add a calendar and Apple's or the link's form opens. The box (`ConnectCalendarChoices`) is lazy, so the landing page's entry chunk stays small. Phones instead keep the one redirect after sign-in (`?onboarding=1`, `calendarOnboarding.ts`), except when signing in on the way somewhere (`next`, such as an invite link), since taking part needs no calendar. The providers' marks and guides are shared in `src/components/calendarProviders.tsx`.
- `src/lib/nativeApp.ts`: `isNativeApp` (read from the bridge the app injects, not `@capacitor/core`, to keep it off the website's first load) and `fitToApp()`, which marks the app's page (`html.native-app`, padded by the safe areas in `index.css`). `src/lib/viewport.ts` writes the viewport tag: `viewport-fit=cover` in the app, and `maximum-scale=1` in the app and on any iPhone or iPad (`isAppleTouch`), which stops iOS zooming into text fields under 16px and staying zoomed (#96) while Safari still allows pinching; never on Android, where it would block pinching. `src/lib/share.ts` (the share sheet, or false so the caller shows the link) and `src/lib/feedback.ts` (the feedback email, with `APP_BUILD`, the commit id `vite.config.ts` stamps on every build) serve the phone profile.
- `src/lib/supabase.ts`: `supabaseAuth`, the browser's only Supabase client: `@supabase/auth-js` on its own, not supabase-js (tables are not read from the browser, so the other clients were dead weight). `authOptions()` repeats what supabase-js's `createClient()` passed; its storage key (`sb-<ref>-auth-token`) must never change or everyone is signed out. `vite.config.ts` puts the libraries the first page loads (react, motion, auth, query) in chunks of their own so deploys leave them cached.

### Languages
- Danish is the default; the DA | EN switch in the header (`LanguageToggle`) is remembered in localStorage (`casy-lang`), and `?lang=en` forces English for that visit (Google's privacy link uses it).
- Shared UI text lives in `src/i18n/da.tsx`, which defines the shape; `en.tsx` is typed against it, so a missing key fails the build. Components read it with `const t = useT()`. Sentences with a link inside take the link as an argument. Long single-page text (Privacy, Terms, How it works, the four help guides) keeps its own `da`/`en` objects in the page file, typed the same way.
- Plain helpers in `src/lib` take a `Lang` (from `src/i18n/locale.ts`, which has no React) or the words they need; dates use `LOCALE[lang]` (da-DK / en-GB), times always read "16:00".
- A suggested event stores the name typed on the scheduling page as its title, shown as written. Left empty, it stores the matching event type's English name (`storedEventTitle`, see `fallbackTitleId`), which is shown translated (`eventTitle`), so mixed-language groups each read their own language; events suggested before names could be typed work the same way.
- Edge Functions keep writing errors in English; `_shared/http.ts` translates each one as it answers (`translateError` in `_shared/i18n.ts`) when the call asked for `lang=da`. `i18n_test.ts` fails if a translated English message no longer appears in the code. Supabase Auth errors are translated on the page by code (`src/i18n/authError.ts`). The auth emails are written in code, in both languages: see Auth emails below.

### Auth and data access
- Every table has RLS enabled with **no** policies: the browser can't read or write any table. All data goes through Edge Functions using the service role. The one policy is on Realtime's own `realtime.messages`: a signed-in person may receive broadcasts on `pulse:<their id>` and nothing else (no insert policy, so no browser can send). Realtime's "Allow public access" setting is off.
- Every function the site calls is written with `serve()` from `_shared/http.ts`: CORS, the one method, the JSON body, and every error answer. Throw `HttpError` for anything the caller should read; anything else is logged under the function and action and answered with a plain 500, as is a missing secret (`requireEnv`, named in the log). Work after the answer goes through `afterResponse()`.
- Every Edge Function identifies the caller with `requireCaller()` (`_shared/auth.ts`, a 401 without a valid login), which verifies the `Authorization: Bearer <access token>` with Supabase Auth. Never take a user id from a request body or query string. `verify_jwt = false` in `supabase/config.toml` is intentional: the publishable key is not a JWT, so functions check the login in code.
- OAuth connect: the four `oauth-*` functions are `_shared/oauth.ts` with the provider filled in, and `google.ts`/`outlook.ts` share one adapter shape. The page POSTs to `oauth-<provider>-start` (signed in) and gets the consent URL back; the verified user id and the site the request came from (`Origin`) travel to the callback inside the HMAC-signed `state` (`_shared/state.ts`). The callback returns there only if it is in `FRONTEND_ORIGINS` (`_shared/frontend.ts`), otherwise to the first entry.
- `calendar_connections.profile_id` is a uuid referencing `auth.users` (cascading deletes).
- The `groups` function handles every group action, picked by `action` in the POST body: list, create (optionally with invitees), rename (any member), invite (a link), invite-members, invitations, accept-invitation, decline-invitation, preview, join, leave, delete (creator only), busy, refresh, whoami, set-name. `preview` is the only one that works signed out (an invite link shows the group's name and size); every other action checks membership. Members see each other's names and busy ranges, never emails, calendar names or event titles.
- Invitations from inside Casy: any member can invite people they already share a group with, or an exact email (`find_user_by_email()`, confirmed accounts only). The invited person accepts or declines on My groups (`InvitationsSection`, counted in the My groups badge); nobody joins without their yes. An email invite must never reveal whether the address has an account: the answer is the same whatever happened (`send_group_invitations()` skips members, repeats and people with 20 open invitations without a word), the email limit counts every lookup in `group_email_lookups` (no address stored) rather than matches, and a group's `invited` list only names people the caller already shares a group with. A declined invitation stays and blocks re-invites to that group until the nightly cleanup deletes it, 6 months after it was sent; joining by link clears it. The New group dialog and each group's Invite button share `InvitePicker`; the Invite dialog also makes the link. No search by name, and admins get no extra powers here.
- The `events` function handles suggested events: list (deciding the caller's votes past their deadline first), suggest (`dates`: a vote, with an optional `place`, `note` and `answerDays` 1 to 7, default 3, #99; on a phone each date carries the suggester's own `answer`, accepted or maybe, #101, stored by `suggest_vote_event` (`suggester_answers` migration), which then decides as an answer would; a single `date`: the old flow, for pages loaded before #74), answer (one date of a vote: accepted, maybe or declined; also after it is decided, where declining the decided date reopens the vote and decides it again, "moved"), choose (the suggester settles a vote on a date; whoever declined it is taken off the event), respond (single-date events: accept, or decline with the next date attached), cancel (suggester only, also once scheduled), edit (suggester only: the place and note, #84; `edit_event_details()` marks entries already in calendars `refresh`), leave (anyone else: `leave_event()` drops them, takes it out of their calendar, and schedules a pending event if everyone left has accepted), add-to-calendar (into your primary calendar, waiting for iCloud's answer), ics (the same entry as a file).
- The `calendar-primary` function reads and sets your primary calendar (only your own, connected, `writable` calendars) and "Add automatically" (get, set, auto-add); switching auto-add on also adds already scheduled events. The next date is found in the decliner's browser (it already has the group's calendars) and checked by the server: a valid future date after the declined one.
- The `account` function acts on the caller's own account: `data` (everything Casy holds about them for the profile's Your data at `/profile/data`, following the privacy policy's "What Casy stores"; credentials only by kind, never read), `export` (the same plus every busy time, downloaded as JSON), and `delete` (after a typed confirmation on the profile, `confirm: true`). A new kind of stored personal data belongs in `_shared/myData.ts` and the privacy policy alike. It and the admin delete share `_shared/accounts.ts`, which leaves each group through `leave_friend_group()` first (so pending events waiting on them get scheduled) and then deletes the auth user.
- Auth settings (dashboard, recorded in `config.toml`): email confirmation on for new password accounts, `secure_password_change` (a code by email before changing a password more than a day after signing in; `PasswordCodeStep`), a "password changed" notification, CAPTCHA (Turnstile), passwords 8+ with letters and digits. Changing or resetting a password signs out other devices; the profile has "Sign out on all devices".
- Auth emails: Supabase Auth's Send Email hook hands every one (sign-in link, confirmation, reset, the security code, "password changed", and the notices for changed emails, linked sign-ins and two-step sign-in) to the `auth-email` function, which writes it in Danish or English (`_shared/authEmails.ts`) and sends it through Resend's API (`_shared/resend.ts`, from noreply@casy.app). Every call must carry Auth's signature with the hook's secret (`_shared/webhookSignature.ts`); each send uses the call's `webhook-id` as Resend's idempotency key, so Auth's retries never send twice. The language is the page's when the email was asked for (the sign-in page puts `lang` in its return address, which the email's link also opens the site in), else `user_metadata.lang` (saved at sign-up and kept current by `useAccountLanguage`), else Danish. With the hook switched off, Auth falls back to SMTP and the old English templates still in the dashboard; nothing is pasted there any more.
- Admin mode: the `admin` function treats the user ids in the `ADMIN_USER_IDS` secret as admins (`_shared/admin.ts`) and re-checks it on every action; `status` only answers yes or no. The profile's admin button is a convenience, the function is the lock. Admin views show names, dates, counts and sync health; never emails (a Google or Outlook connection's `account_label` is an email), busy times or event details.

### Data model
- Calendars: `calendar_connections` (one per linked account) -> `calendar_sources` (one per calendar, with a user-set `purpose`, `priority`, `included` and `custom_name`, all set on My calendar through `calendar-set-purpose`; an unticked calendar keeps syncing but counts nowhere; `display_name` stays the provider's own name; `writable` says Casy may add events to it, read from iCloud's privileges on every sync) -> `calendar_busy_cache` (start/end only; **no event titles are ever stored**). Credentials live in `calendar_secrets`.
- Groups: `friend_groups` (named so because GROUPS is a Postgres keyword; `created_by` is set null if the creator's account goes) -> `group_members` (a trigger caps groups at 20 members and each person at 20 groups) and `group_invites` (only an HMAC of the invite token is stored; links last 7 days and anyone holding one can join) and `group_invitations` (one per person per group: `pending` or `declined`, `via_email`; accepting deletes it and adds the membership in `accept_group_invitation()`). `profiles` holds each user's display name, copied from their own login by the `groups` function (`remember_login_name()`) unless `name_is_custom` says they chose one; it deliberately has no email.
- Primary calendar: `primary_calendars` (one row per person: `source_id`, `auto_add`, `lang`; removing the calendar removes the row; a trigger checks the calendar is the person's own) and `calendar_event_writes` (per event and person: `wanted`, `added`, the calendar it went into, attempts, the last error, and `gone_at` once its owner deleted the entry by hand).
- Events: `event_proposals` (group, suggester, title, an optional `place` (100) and `note` (500) shown as written, #84, the search `settings` as jsonb, status pending / scheduled / no_date / cancelled, `mode` single or vote, a vote's `answer_by` deadline (3 days); max 20 pending per group) -> `event_proposal_dates` (every date offered; the current one is the newest not declined, or for a vote the one with `chosen_at`) and `event_invitees` (everyone in the group when it was suggested). `event_responses` are per date (accepted, maybe or declined; maybe only in votes), so a new date starts with no answers. A vote is decided by `decide_vote` once everyone still invited has answered every date to come or its deadline passes (`respond_to_vote` with the event locked, `decide_due_votes` on every list and in the hourly sync); leaving an event or group decides it too (`refresh_event_status` hands votes to `decide_vote`). Answers can be changed after a vote is decided (`change_vote_answers` migration): only declining the decided date moves anything; the vote reopens and `decide_vote` runs forced. Calendar entries move with it: added ones are taken out with `calendar_event_writes.requeue` set, and once out their rows are deleted so `catchUpWrites` queues the new date at once (it queues again after processing); rows not yet added are dropped. `suggest_event()` and `respond_to_event()` do the writes in one transaction; `respond_to_event()` locks the event and answers `stale` if someone else changed the date first.
- `leave_friend_group()` removes a member and deletes the group if they were the last one; it also drops them from the group's pending events (which may then become scheduled). Deleting an account cascades everything it owns; the admin delete also removes groups it leaves empty.

### Backups and health (#88)
- `.github/workflows/backup.yml` dumps the database nightly (roles, schema, data with the auth schema), encrypts it with `age` to the operator's public key and keeps it 30 days as an artifact. The repo is public, so only the encryption keeps it private; secrets `SUPABASE_DB_URL` (Session pooler) and `BACKUP_AGE_RECIPIENT`. Restoring, and what a backup doesn't hold (Vault, function secrets, `CALDAV_ENCRYPTION_KEY`): `docs/backups.md`.
- The public `health` function (GET, no login, `_shared/health.ts`) answers 200 `{ ok: true }` or 503 with `stale` (nothing synced for 3 hours) or `failing` (over 30% of at least 4 accounts failing, not counting those needing a reconnect). An uptime monitor watches it and casy.app; admin mode shows the same status. It judges the result, not the job, so a stopped scheduler shows up too.

### Retention (#81)
- `cleanup_old_data(dry_run)` (migration `cleanup_old_data`) deletes what nobody needs: events whose every date ended 12+ months ago, cancelled and no-date events 30 days after their last change, invite links 30 days after expiring, `group_email_lookups` after a day, connections stuck in `pending`/`error` after 7 days (a connection is only marked connected once stored, and never goes back), declined invitations 6 months after they were sent. An event with calendar work left (`calendar_event_writes.wanted <> added`) waits. Busy times, groups and accounts are never touched. Dry run is the default: the deletes run in a block a dry run rolls back, so its counts are exact. pg_cron runs it for real nightly at 02:45 UTC (`cleanup-old-data-nightly`, migration `cleanup_schedule`); each run's counts go in `cleanup_runs` (kept 90 days). The periods are stated in the privacy policy's "How long Casy keeps things": change both together, and a new kind of stored data needs a period there too.

### Secrets
- Every credential in `calendar_secrets` is encrypted with `_shared/secretBox.ts` (AES-256-GCM, format `v1:<nonce>:<ciphertext>`); a check constraint rejects anything else. The key is the `CALDAV_ENCRYPTION_KEY` function secret (the name is historical; it protects all secrets).
- ICS links are looked up by `ics_url_hash` (HMAC with an HKDF-derived subkey), since encrypted values can't be compared.

### Sync
- `calendar-sync` refreshes accounts: Google/Outlook via refresh token (rotated tokens are stored again), iCloud via app password, ICS by re-fetching. Busy times are swapped in one transaction (`replace_busy_blocks`); a failed sync keeps the old data.
- Every fetch (connecting and syncing) covers a week back to 12 months ahead (`_shared/syncWindow.ts`). Starting "now" cut events under way at the sync (stored as starting at xx:17); a week back, recent events are fetched whole again each time. Token expiry is still checked against the real time.
- iCloud subscriptions (ICS links subscribed in Apple Calendar) hold no events in iCloud, only their feed address (`CS:source`), so `appleBusy.ts` fetches the feed itself with the ICS fetcher (never sending the iCloud password). A feed that fails keeps that calendar's old blocks while the rest of the account syncs. Calendars that don't list their component types (shared calendars) are kept, per RFC 4791.
- All-day events block even when marked free (Apple and Outlook make them free by default), in the ICS parser and the Outlook adapter; timed free events don't. Dates and floating times without a zone are read in Europe/Copenhagen (`DEFAULT_ZONE` in `_shared/timezones.ts`). Google can't follow this: its free/busy scope never returns free events.
- A sync never adds calendars new to an account; those appear after reconnecting.
- Results are stored per connection: `last_synced_at`, `sync_error`, `needs_reconnect` (credential refused).
- Fresh while planning (#85): the `groups` function's `refresh` action (`_shared/groupRefresh.ts`) syncs a group's members' accounts not tried for `freshForSeconds` (kept to 1-10 minutes), claimed in one update so two callers never sync one twice, at most 8 at once, answering within 10 seconds (slower syncs finish after the answer) with only `complete` and `synced`, never whose. `useGroupRefresh` starts it at most once a minute per group: on the scheduling page on every change once planning has begun for a real group (not on merely opening it) and on returning to the tab; on My events for the groups of pending events, on opening and on returning. If a background refresh moves the scheduler's answer, the hint says so. "Suggest this date" never syncs: it waits at most 2 seconds for a refresh already running, re-runs the page's own search (`findAnswer` in `useDateSearch.ts`) on the cached busy times and only sends if `answerKey` (date and who it costs what) is unchanged, else it shows the new answer with a note. An appointment made seconds before pressing can still slip through; then `DateConflicts` (My events cards and detail) warns, from `cantMake` in `src/lib/eventConflicts.ts` (each invitee searched alone on exactly the date by the event's rules; trips and holidays in whole days), with "Find a new date" (a decline, so the next date is found and the event stays, unlike cancelling) for you if you said yes, and on the right your first clashing block's time and calendar name from your own calendar data (`clashingBlocks`, `formatBlockTime`; never a title, which Casy doesn't store, and never for others, whose calendar names members don't see), and the My events badge (`useEventsBadge`, from your own calendar) counts such dates. Pending events only: a scheduled event is in people's calendars and would clash with itself. A refresh that fails changes nothing.
- pg_cron runs it at 17 past every hour, authenticated by `x-sync-secret`; the URL and secret are read from Vault (`calendar_sync_url`, `calendar_sync_secret`). The calendars page's "Sync now" syncs the signed-in user's accounts.
- **Google OAuth is In production but unverified** (since 2026-09-19): connecting Google Calendar shows "Google hasn't verified this app" (Advanced > Go to Casy), and at most 100 users can connect until the app is verified. Refresh tokens no longer expire after 7 days.

### TypeScript configuration
- Path alias `@/*` maps to `src/*`
- Full strict mode (`strict`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`). Pages behind `RequireAuth` read the user with `useSignedInUser()`, which is never null there; TanStack Query types errors as `Error`, so `mutation.error?.message` needs no `instanceof` check.

## Environment Variables

All secrets live in `.env.local` (never committed). The file always contains a `GitHub repo token=` key used for the GitHub Projects workflow.

- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (a publishable key, not a JWT), `VITE_TURNSTILE_SITE_KEY` (Cloudflare Turnstile's public site key; its secret key is set only in the Supabase dashboard, Authentication > Attack Protection)
- Local copies of server secrets: `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_OAUTH_CLIENT_ID/SECRET`, `MICROSOFT_OAUTH_CLIENT_ID/SECRET`, `OAUTH_STATE_SECRET`, `CALDAV_ENCRYPTION_KEY`, `CALENDAR_SYNC_SECRET`
- Edge Function secrets (set with `supabase secrets set`): the ones above plus `FUNCTIONS_BASE_URL`, `ADMIN_USER_IDS` (comma-separated user ids with admin mode; not kept in `.env.local`), and `FRONTEND_ORIGINS` (comma-separated sites OAuth may return to, default first: `https://casy.app,https://casy-red.vercel.app,http://localhost:8080`; `FRONTEND_URL` is the older single-site fallback)
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

GitHub Actions workflow at `.github/workflows/ci.yml` runs on every push to any branch and on PRs to `main`, in three jobs: the web app (ESLint, the Prettier check, `npm run build`, which type-checks first, `e2e/` included, and the Vitest suite), the browser tests (Playwright in its Docker image, whose version must match the pinned `@playwright/test`; on failure the report with screenshot diffs is uploaded as `browser-test-results`), and the Edge Functions (`deno check` and the Deno tests). `.github/workflows/screenshots.yml` makes new reference screenshots on a branch (never `main`). Run the same locally before handing work over (`npm run e2e` covers the behaviour tests). CI never builds the iPhone app; ESLint and Prettier skip `ios/`.

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

1. **Update the issue body** — append a `## What was done` section (3–5 bullet points) to the original description:
   ```bash
   PATCH https://api.github.com/repos/asbj1521/casy/issues/<NUMBER>
   { "body": "<original body>\n\n---\n\n## What was done\n\n- ..." }
   ```
2. **Move card to Done:**
   ```
   value: { singleSelectOptionId: "98236657" }
   ```
3. **Close the issue:**
   ```bash
   PATCH https://api.github.com/repos/asbj1521/casy/issues/<NUMBER>
   { "state": "closed" }
   ```
4. **Merge to main:**
   ```bash
   git checkout main
   git pull origin main
   git merge feature/[task-name]
   git push origin main
   git branch -d feature/[task-name]
   git push origin --delete feature/[task-name]   # only if the branch was ever pushed
   ```

### Project IDs Reference

| Field | ID |
|---|---|
| Project | `PVT_kwHOD5fAM84BbNZz` |
| Status field | `PVTSSF_lAHOD5fAM84BbNZzzhV_jKU` |
| Status: TO-DO's | `f75ad846` |
| Status: In progress | `47fc9ee4` |
| Status: Done | `98236657` |
| Repo | `asbj1521/casy` (renamed from `asbj1521/Autodate`, which redirects) |

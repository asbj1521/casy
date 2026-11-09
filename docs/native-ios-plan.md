# Casy as a native iPhone app: the plan (#192)

Written 2026-11-02, before any of it is built. The epic is #192; each phase below has its own issue. Read this before starting a phase, and keep it true: when a decision changes, change it here first.

## Where we are and where we are going

Today the iPhone app is the website in a Capacitor web view (`ios/`), with about 1,600 lines of Swift for what a web page can't do: the phone's calendars (EventKit, reading, writing and the background refresh), Sign in with Apple, contacts and Messages, Apple's Liquid Glass laid over the page, and the status bar tap. Everything else, about 60,000 lines of TypeScript, is shared with the website.

The goal is the same app written in Swift and SwiftUI: Apple's real Liquid Glass everywhere (the web view app has none since 2026-11-05: laid over the page it lagged and blinked, so all its glass is CSS; `GlassPlugin.swift` is in git history at 3710c5f), system sheets, navigation and scrolling, and later widgets, Siri (App Intents) and Live Activities. What does not change:

- **The backend.** Every Edge Function, table, migration and cron job stays. The native app calls the same functions with the same JSON; no backend change is planned, and one that turns out to be needed gets its own step and must keep every app release at or above `MIN_APP_VERSION` working.
- **The website.** casy.app stays React: computers, invite links for people without the app, Android friends, the legal pages, the Apple walkthrough.
- **The bundle id** `app.casy`, the App Store record, push, universal links and Sign in with Apple: the native app ships as an update of the same app.

## Decisions (agreed 2026-11-02)

1. **Screen by screen, not a big bang.** Native SwiftUI screens replace web screens inside today's app, one at a time, every step shippable. The web view stays underneath until the home page itself is native; then Capacitor goes. A temporary bridge connects the two (below).
2. **iOS 18 at the least, iOS 26's features where the phone has them** (changed 2026-11-03; it was iOS 26 at the least). The user wants older phones kept: iOS 18 runs on every iPhone iOS 17 did, the XS and XR among them, which are the ones iOS 26 left behind, and it brings `@Observable` and the zoom transition. On iOS 26 and later a phone gets real Liquid Glass, sheets that grow out of their toolbar button and DictationTranscriber; before it, frosted material, the iOS 18 zoom or a plain sheet, and SFSpeechRecognizer. Every such choice is made in one place, CasyUI (`.casyGlass()`, the sheet and speech pieces), never with `#available` in a screen, so a screen is written once. The cost is testing: each screen's snapshots run on an iOS 18 simulator as well as the newest. Built with the newest Xcode (27 at the time of writing), deployment target 18.0. v1 (`main`, iOS 15) is untouched; the first release with a native screen raises it to 18, and phones below that keep the release before.
3. **The engine is ported to Swift, kept equal by shared fixtures.** `src/lib`'s logic becomes a pure Swift package, `CasyCore`. A Vitest file runs the TypeScript over generated cases and stores inputs and answers as JSON; the Swift tests must give the same answers. CI regenerates the JSON and fails on any difference, so a rule changed on one side only cannot ship. This is the `supabase/testdata/dayScoreCases.json` pattern, grown to the whole engine.
4. **The website's phone layout is kept, frozen.** It keeps working for Android friends, invite links opened without the app and iPhone people who never install it. New phone features land in the native app; the web phone gets one only when people without the app need it (joining, answering a vote, seeing events, connecting a calendar). App-only web code (labels, trips, the phone's calendar, the glass plugin, push) is deleted from `src/` once native has it (Phase 6).

Smaller decisions that follow from these:

- **SwiftUI first**, UIKit only where SwiftUI can't (the contact picker and Messages already are UIKit; the month view may need a `UICollectionView` if SwiftUI's lazy stacks stutter on a real phone, decided in Phase 5 by measuring).
- **Swift 6 language mode** for the new packages. The app target stays in Swift 5 mode while Capacitor is in it, and moves to 6 in Phase 6.
- **No SwiftData or Core Data.** The server is the truth, as on the web: `@Observable` stores per kind of data, each with a staleness time like TanStack Query's (30 s by default), invalidated by mutations and the live pulse. Only the same five answers the web remembers (`queryPersistence.ts`: groups, calendar status, primary calendar, admin status, whoami) are kept on disk, per user, wiped on sign-out.
- **Auth has one owner at any time.** Supabase rotates refresh tokens, so two clients refreshing the same session sign the person out. Until Phase 6 the web view owns the session and the native side borrows the access token through the bridge, in memory only. In Phase 6 the native side takes it over (supabase-swift's `Auth`, in the Keychain) and the web view is gone.
- **The design language stays**: CLAUDE.md's nine rules hold, and most become plain SwiftUI (table below). Where iOS 26 has a system way of doing exactly what a rule says, the system way wins, because that is the point of going native.
- **Copy** lives in a String Catalog (`Localizable.xcstrings`, Danish and English), written from `da.tsx`/`en.tsx` as each screen is ported. The rules stay: no emojis, no em or en dashes (a test checks the catalog), "Apple Calendar"/"Apple-kalender", never "iCloud".
- **Time** follows the web's rule: every date is Danish time. `CasyCore` builds its `Calendar` with `TimeZone(identifier: "Europe/Copenhagen")` explicitly and never touches `Calendar.current` or `TimeZone.current`; the test schemes run with `TZ=America/New_York`, as Vitest does, so a slip fails.

## Repository layout

```
ios/
  App/                         the Xcode project (as now); the App target hosts the web view and the native screens until Phase 6
    App/                       the old group, as it was (it holds public/, copied as one folder, which a synchronized folder would break)
      Native/                  a synchronized folder (Phase 0): new files need no project.pbxproj edit; the app's own SwiftUI: Bridge/, Screens/, Background/
  Packages/                    local Swift packages (new)
    CasyCore/                  pure logic: types, time, the engine, ranking, trips, labels; Swift Testing; no UIKit or SwiftUI
      Tests/CasyCoreTests/Parity/   the JSON fixtures written by Vitest
    CasyAPI/                   the Edge Function client and every request and answer as Codable
      Tests/CasyAPITests/Answers/   the fake backend's answers as JSON
    CasyUI/                    the design language: colours, glass pieces, list rows, fields, strings
src/lib/parity/                the parity cases (TypeScript) and parity.test.ts, which writes or checks the fixtures
scripts/native/                the fake backend served over HTTP, and the answers dump, for the native tests
```

Packages keep Xcode's project file out of most work: a package's files are found by folder. Never run `swift build` or `swift test` inside the repo without `--scratch-path` outside it: the repo is in iCloud-synced Desktop, and a `.build` folder there is both slow and the cause of the code-signing failures CLAUDE.md warns about. Use `xcodebuild` with Xcode's default DerivedData, as for the app.

## The bridge (Phases 0 to 5)

While web and native screens live side by side, the web view stays in charge of three things, and native screens borrow them:

- **The session.** `src/lib/nativeBridge.ts` (app only, imported dynamically like every plugin) sends the access token, its expiry and the user id to the `NativeBridge` plugin on every auth change (`onAuthStateChange`: sign-in, refresh, sign-out). The native side keeps it in memory only. A native call that finds it expired asks the web for a fresh one (`needSession`) and waits; auth-js refreshes it. Signing out from a native screen asks the web to sign out.
- **The address.** Sheets are in the address today (`?profile`, `?events`, `?calendars`, `?plan`, `?vote`). For a screen that is native, the web's sheet component is replaced in the app by a stub that asks `NativeBridge.open({ screen, params })` and, when the native sheet is dismissed (`closed`), steps the address back. Push notifications, universal links and `PushLinks`/`AppLinks` keep working unchanged, since they set the address. A native screen that needs a web one (answering a vote, say, until the home page is native) sends `navigate` with the path.
- **The data.** A native mutation sends `changed` with the query keys it touched, and the web invalidates them; the web forwards every live pulse (`useLiveUpdates`) as `pulse`, and native stores refetch what they show. Language and theme are sent on change (`setPreferences`); the theme already reaches iOS today (`setNativeAppearance`, `AppAppearance`).

Which screens are native is asked once at launch (`NativeBridge.screens()`), so a web build served by `npm run ios:live` against an older native build never opens a screen that isn't there.

The bridge files: `ios/App/App/Native/Bridge/NativeBridgePlugin.swift` (the plugin: `setSession`, `setPreferences`, `open`, `screens`; events `closed`, `changed`, `navigate`, `needSession`), `Native/Bridge/SessionBox.swift` (the borrowed token, an actor), `Native/Bridge/ScreenPresenter.swift` (presents a `UIHostingController` as a sheet over `MainViewController`), and on the web `src/lib/nativeBridge.ts` and `src/components/NativeBridgeSync.tsx` (mounted in `AppBackground`, app only). All of it is deleted in Phase 6.

## The design language in SwiftUI

| Rule (CLAUDE.md) | Web piece | Native |
|---|---|---|
| 1. Pages | `ui/ListGroup`, `ListRow` | `List` with `.listStyle(.insetGrouped)` |
| 1. Sheets from where they were pressed | `ui/BottomSheet` `origin`, `edge` | `.sheet` with `.presentationDetents`, the source button marked `matchedTransitionSource(id:in:)` and the sheet `.navigationTransition(.zoom(sourceID:in:))`; iOS 26 sheets are glass at partial heights. A known bug: the zoom misbehaves with a `.medium` detent; test it, use `.fraction` or `.large` if it does |
| 1. Title left, one text action right | sheet header | `.navigationTitle`, `ToolbarItem(placement: .cancellationAction)` "Annuller", `.confirmationAction` "Færdig" |
| 1. Pickers grow out of their row | `ui/AnchoredPanel` | `.popover` with `.presentationCompactAdaptation(.popover)`, or a `Menu` where it is a plain choice |
| 2. One main action, pinned | `ui/FlowButton` | `.safeAreaInset(edge: .bottom)` holding a full-width `Button` with `.buttonStyle(.glassProminent)` tinted Casy's orange (or `.glass` with orange text, decided in Phase 1 by looking at both); `quiet` is `.glass` |
| 3. Standalone glass capsules | `ui/GlassButton`, `.glass-pill` | `.buttonStyle(.glass)`, orange foreground |
| 4. Orange | `text-primary`, `bg-cta` | colour assets `Primary` and `CTA` (light and dark) in CasyUI |
| 5. Choices are rows | `ListPickRow`, `ListSwitchRow` | a row with a trailing `checkmark` in orange (`.accessibilityAddTraits(.isSelected)`), `Toggle` |
| 6. Fields | `ui/field.ts` | `TextField` in a list section, 17 pt, the small uppercase label as the section header |
| 9. Sizes | 17/15/13/12 px | `.body` (17), `.subheadline` (15), `.footnote` (13), `.caption` (12): Dynamic Type comes with them |
| Home page buttons | `calendarView/HomeBar` | the bottom toolbar (`ToolbarItemGroup(placement: .bottomBar)`, glass in iOS 26), each item the source of its sheet's zoom |
| Status bar tap | `StatusTapCatcher`, `useStatusTap` | free: a native `ScrollView` scrolls to the top by itself |
| Haptics | `lib/haptics.ts` | `.sensoryFeedback` |
| Wheels | `WheelPicker` | `Picker` with `.pickerStyle(.wheel)`, `DatePicker` |
| Share, QR | `@capacitor/share`, `uqr` | `ShareLink`; Core Image's `CIQRCodeGenerator` |
| Pictures | file field, `PictureCropSheet` | `PhotosPicker`, then the crop as a SwiftUI gesture view (the rules in `lib/pictureCrop.ts` ported) |
| Speech | `@capgo/capacitor-speech-recognition` | `SpeechAnalyzer` with `DictationTranscriber` (`.progressiveShortDictation`), `SFSpeechRecognizer` (what the plugin uses now) as the fallback. Decided in Phase 0: `SpeechTranscriber` has no Danish, even on iOS 27; `DictationTranscriber` has it installed and transcribed Danish correctly on the user's phone |

The animations that make Casy Casy (the sheet growing out of its button, the day zooming out of its cell, the paper pile, the send flight, the date flying into its day) become the system's own transitions where one exists (the first two) and `keyframeAnimator`/`PhaseAnimator` or Core Animation otherwise. The timings in `lib/paperPile.ts` (`pileTimeline`, `PILE_TIMING`), `lib/sendFlight.ts`, `lib/dayTravel.ts` and `swipe/morph.ts` are ported with them; the pile stays slow on purpose.

## Keeping the engine equal: parity fixtures

- `src/lib/parity/<module>.cases.ts` builds each module's cases from a seeded random generator (a copy of the one in `e2e/fixtures.ts`, which `src/` can't import): calendars of made-up busy blocks across daylight-saving changes, Christmas and New Year, settings across every option, groups of 1 to 20. Each case is `{ name, input, output }`, instants as epoch ms, floats as written.
- `src/lib/parity/parity.test.ts` runs every case through the TypeScript and compares with `ios/Packages/CasyCore/Tests/CasyCoreTests/Parity/<module>.json`. With `UPDATE_PARITY=1` it writes the files instead. A rule changed in TypeScript therefore fails Vitest until the fixtures are written again, and then fails the Swift tests until Swift is changed too.
- `ios/Packages/CasyCore/Tests/CasyCoreTests/ParityTests.swift` reads every file and checks the Swift functions give the same output (exact for integers and instants, 1e-9 for floats).
- Each module is ported with its own Vitest tests rewritten in Swift Testing too, where they say something the generated cases don't (an edge found by a bug, a named rule).
- The existing pairs (`eventVocabulary`, the day scores, `phoneBusy.ts` and Swift `PhoneBusy`, the trip note) join this scheme as their module is ported; `PhoneBusy` moves into CasyCore.

## Testing the native app

- **CasyCore and CasyAPI:** Swift Testing, run by `xcodebuild test` on the packages; the parity and the answers fixtures above.
- **The API contract:** `e2e/apiAnswers.parity.ts`, run by Vitest in the ordinary CI so a change to an answer's shape fails there, asks `e2e/backend.ts`'s `FakeBackend` (the same made-up world as the browser tests, Mia and her groups) for every function and action and writes each answer to `CasyAPI/Tests/CasyAPITests/Answers/`; a Swift test decodes all of them. `backend.ts` is typed with `src/api`'s types, so a change to an answer's shape on the web reaches the Swift decoders. Each answer must read and write back with nothing lost, so a field the web's types have and Swift's don't fails. The fake is not the real server: a screen's first run against the live functions is still the real test.
- **Screens:** snapshot tests (pointfreeco's `swift-snapshot-testing`) of each screen in light and dark at one pinned iPhone simulator, fed by the decoded answers, so they show the same world as the web's screenshots. Reference images are made on CI's macOS runner only, like the Linux screenshots, by the same `[screenshots]` commit.
- **Flows:** XCUITest against the fake backend served over HTTP (`scripts/native/fake-backend.ts` on port 4318, also answering `/auth/v1/*` as `e2e/fixtures.ts` does). Only a Debug build reads the launch arguments that point it there and give it the fake session (`-casyBackend`, `-casyFakeSession`); a Release build cannot be pointed anywhere but the real project.
- **The clock:** a `Now` dependency, fixed at the world's `NOW` (Wednesday 7 October 2026, 10:00 Danish time) in every test.
- **CI:** a new job on GitHub's macOS runner (free for a public repo), only when `ios/**`, `src/lib/**` or the fixtures change: builds the app, runs the package tests and the snapshots. The Xcode version and the simulator are pinned in the workflow and moved on purpose.
- **Looking at it:** `xcodebuild` builds into the simulator, `xcrun simctl io booted screenshot` saves the screen, and the image can be read and checked, which is how Claude sees a native screen. The user tests on the phone from Xcode, and friends through TestFlight.

## Moving the data the app keeps

The web view keeps some things on the phone, in its localStorage at `capacitor://localhost`. Lost, they would cost a sign-in, AI calls to label everything again and the trip answers:

- the session (`sb-<ref>-auth-token`), `casy-device-id`, `casy-phone-calendar:<user>`
- `casy-event-labels:<user>`, `casy-label-corrections:<user>`, `casy-trip-legs:<user>`, `casy-trip-answers:<user>`
- `casy-lang`, `casy-theme` (already native), `casy-day-span`, `casy-decided-seen`, `casy-push-ask`, `casy-push-token`, `casy-ai-consent-asked:<user>`, `casy-swipe-hint-seen`, `casy-hide-holidays`, `casy-last-group:<user>`, `casy-calendar-onboarding-seen:<user>`

Two ways, both built: during the bridge phases `nativeBridge.ts` mirrors these keys to the native side (UserDefaults, the session's refresh token to the Keychain) whenever they change, so anyone who opened a bridge release arrives at Phase 6 with everything already native. And the first launch of the fully native release reads whatever is left straight from the web view's storage once (a hidden `WKWebView` on the default data store with a `capacitor` scheme handler serving an empty page at `capacitor://localhost`, then `localStorage` read by script), checked in the Phase 0 spike. If both fail, the person signs in again (one tap with Apple) and labels are made again in the background; nothing on the server is lost.

## The phases

Sizes are rough: S a few sessions, M one to two weeks of sessions, L two to four, XL more. All together, likely three to five months of steady work; Phase 5 is half of it. Each phase is an issue, planned in detail (per-file steps) at its start, because the web code it replaces keeps changing until then. v1 on the App Store (#148) comes first; nothing here starts before it is out.

### Phase 0: spike (S)

Prove the hard parts before building on them; throw away anything that doesn't hold.

1. Raise the app's deployment target on a branch; build and run on the user's phone. Done 2026-11-02 at 26.0, lowered to 18.0 on 2026-11-03 (decision 2): only the Debug labs used iOS 26 unchecked (now guarded); the bridge and the native Settings built for 18 unchanged. As at 26.0, the target is set in the Xcode project only, which `cap sync` copies into `CapApp-SPM/Package.swift` (`.iOS(.v18)` now), a name Capacitor's default Swift tools (5.9, up to `.v17`) don't know, so `capacitor.config.ts` raises them to 6.2 (`experimental.ios.spm.swiftToolsVersion`). Builds and runs on the iOS 27 simulator and the user's phone.
2. A synchronized folder for new Swift files, and an empty local package `ios/Packages/CasyUI`; update CLAUDE.md's iPhone rule. Done 2026-11-02: only the new subfolder `App/Native/` is synchronized, since `App` itself holds `public/` (copied as one folder, which Capacitor needs) and `Info.plist`. Xcode offers synchronized folders only in its 16 format, so the project moved to it (objectVersion 77) by hand, with the package wired like `CapApp-SPM`; `Native/Native.swift` importing CasyUI builds without a further edit.
3. The bridge, minimally: `NativeBridgePlugin` with `setSession`, `open` and `closed`; a native Settings screen (Sprog and Udseende only, `List`, the system sheet from the bottom) opened from the web profile's Indstillinger row; it calls `whoami` with the borrowed token. Prove the round trip: open, change the theme natively, close, the web follows.
4. Try the zoom-from-toolbar sheet on a native bottom bar laid over the web view, with `.medium`, `.fraction` and `.large` detents.
5. Speech: `SpeechTranscriber.supportedLocale(equivalentTo: Locale(identifier: "da_DK"))`, then a real Danish transcription on the user's phone (the asset download can fail for a listed language). Write down which API Phase 4 uses. Done 2026-11-02: `SpeechTranscriber` has no Danish; `DictationTranscriber` does (installed on the phone, transcribed correctly), so Phase 4 uses it with `SFSpeechRecognizer` as the fallback, and compares their quality side by side there.
6. Sign-in natively: does Supabase Auth ask a native password sign-in for the Turnstile CAPTCHA token, and does `signInWithIdToken` (Apple) need one? If a password sign-in does, Phase 5's native sign-in shows Turnstile in a small web view, or keeps email sign-in on the web view until Phase 6 decides. CAPTCHA was then removed for good (#203), so no native sign-in needs Turnstile. Found 2026-11-02: CAPTCHA protection is off on the live project (a password sign-in and a password reset without a token, and one with a made-up token, were all let through to the next check), though `config.toml` and the docs say it is on. So today a native sign-in needs no token; whether it should be switched on is the user's call (#196), and if it is, Phase 5 needs Turnstile in the native sign-in.
7. Read the web view's localStorage from native as described above, on the simulator and on the phone. Done 2026-11-03: works on both, a marker stored by the page found again after a relaunch that stored nothing, and on the phone all 18 keys (the session with its refresh token, the labels). The phone holds keys of two accounts, so Phase 6 moves only the signed-in person's.
8. A first macOS CI job that builds the app. Done 2026-11-03: `.github/workflows/ios.yml`, Debug and Release for the simulator without signing, only when `ios/`, the Capacitor config or the npm packages change; `macos-latest` with the newest Xcode 26 picked (26.6), since a job asking for `macos-26` got no runner; about 8 minutes.

Done when each point has a written answer in the issue, and the plan here is corrected where one surprised us.

### Phase 1: foundations (M)

Started from `main`, not from `feature/native-spike` (changed 2026-11-08). People use the app now, and the packages sit beside it unlinked, so each slice merges to `main` while the app stays on iOS 15. The spike's bridge and the raise to iOS 18 come over in Phase 2, with the first release that has a native screen. Run the packages' tests with `swift test --package-path ios/Packages/CasyCore --scratch-path ~/Library/Developer/Xcode/DerivedData/CasyCore-scratch`, in `TZ=America/New_York`; CI's `native.yml` does the same. `browserTimeZone` isn't ported to CasyCore, which never reads the device's zone: the app passes it in. Dates are written from names kept in `Format.swift` rather than from the system's formatter, whose wording changes between iOS versions. `newYear.ts`'s `bigOnNewYearsDay` waits for `eventImpact.ts` (Phase 3). The app's own Swift `PhoneBusy` stays where it is until the background work goes native (Phase 5); CasyCore has its copy beside it, so nothing the app runs today changes.

1. `CasyAPI`: the client (`EdgeFunctions.call(name, params:, body:)`, mirroring `callFunction`: the `lang` parameter, 60 s, the function's own `error` text, "offline" and "timed out" in the person's language), the borrowed-session provider, and the Codable types for `whoami`, `groups` (list, members, invitations), `account` (data, delete) and `admin` status; more types come with the screens that need them.
2. `e2e/apiAnswers.parity.ts` and the decoding test. `scripts/native/fake-backend.ts` comes with the XCUITest setup (item 5), the first thing that needs it.
3. `CasyCore`, first modules: the types (`src/types`), `zone.ts`, `format.ts`, `danishHolidays.ts`, `holidayBlocks.ts`, `newYear.ts`, `periodText.ts`, `viewerTime.ts`, `vote.ts`, `myEvents.ts`, `phoneBusy.ts` (moving `PhoneBusy` out of the app), with the parity pipeline (`src/lib/parity/`) running for each.
4. `CasyUI` (built 2026-11-08: colours are a table in `Theme.swift` rather than colour assets, the web's phone values, kept equal by `src/lib/parity/theme.test.ts`; `ConfirmButton` is the system's `confirmationDialog`; `FlowButton` is glass with orange text, as CLAUDE.md's rule 2 says, until the two looks are compared on a phone in Phase 2): colours (light and dark, from `theme.css` and `tailwind.config.js`), the glass buttons, the list rows, fields, `Avatar` (the picture or the letter), `Notice`, a `ConfirmButton` (asked first), the String Catalog with its no-dashes and no-emojis test.
5. The snapshot test setup, run by `scripts/native/snapshots.sh` on this Mac. Moved to Phase 2 (changed 2026-11-08): the XCUITest target and `scripts/native/fake-backend.ts`, since a UI test needs a target in the app's Xcode project and a screen to test, and Phase 1 leaves the app untouched; and snapshots on CI, whose Xcode has an older iOS than the images are made on. Snapshots are drawn off screen, where Liquid Glass doesn't show, so the glass is judged on the phone.
6. `docs/architecture/native.md`: how the native side is built (this plan's living half), linked from CLAUDE.md.

### Phase 2: the Profil sheet (M)

Started 2026-11-09 with the bridge and iOS 18 from the spike (its labs left out); a native screen stays Debug-only until it does everything the web's does. First, what Phase 1 left for it: the spike's bridge from `feature/native-spike` and the raise to iOS 18, the XCUITest target with the fake backend over HTTP, snapshots on CI, and the look of `FlowButton` (glass with orange text, or solid) compared on a phone.

Native, behind the home page's Profil button (still the web's button until Phase 5, so the sheet slides up rather than growing out of it): the profile list (`ProfileHubList` in `profile/ProfileHub.tsx`), Indstillinger (Sprog, Udseende, Notifikationer), Grupper and a group (members, invitations, rename, description, picture with the crop, Tid til hinanden switch, invite by link, QR and contacts, leave, delete, report and block), Dine data (with the AI consent rows, blocked people, the export shared as a file), Slet konto, Admin on a phone, Support, Sådan virker det, Vilkår and Privatliv opened in `SFSafariViewController` at casy.app, feedback by mail, share Casy, sign out. Log ind og sikkerhed stays the web's screen until Phase 6 (it is Supabase Auth with codes): its row hands over to the web's sheet. Replaces, in the app: `profile/ProfileSheet` and the phone screens it pushes.

### Phase 3: the Aftaler sheet (M)

The rows in Svar nu, Kommende and Tidligere (`myEvents/phone/EventsSheet`, `EventRows`, `DateTile`), an agreed event's screen (`DatedScreen`: the day around it as a first native `DayColumns`, read-only, which Phase 5 grows into the day view; `PeopleRow`; place and note; Tilføj til min kalender, writing with `PhoneCalendarWriter` or sharing the .ics), a vote's screen (`VoteScreen`: the bars, `Countdown`, Casys vurdering, Svarfrist and Afgør nu, Aflys or Forlad), Rapportér, Kan ikke alligevel. Answering a vote stays on the home page (web) until Phase 5: its row navigates there. CasyCore gains `homeVotes.ts`, `dayStrip.ts`, `dayColumns.ts`, `eventImpact.ts`, `comfortNotes.ts` as needed.

### Phase 4: the small sheets (M to L)

Kalendere (`CalendarListPanel`: ticks, categories, priorities, the primary calendar), the calendars page (`CalendarsSection`: Denne telefon, Apple Calendar's form, an ICS link, Synkronisér nu, remove; Google and Outlook still not offered in the app), Tilføj til kalender (`TellCasySheet` with native speech), the trip sheet, Tid til hinanden's sheet (Planlæg hands back to the web's plan until Phase 5), the guided calendar setup (#221), the AI consent ask, the push ask, Opdater Casy (`UpdateRequired`). CasyCore gains `casyEntries.ts`, `trips.ts`, `tripLegBook.ts`, `tripView.ts`, `casyTripEntry.ts`, `primeDates.ts`.

### Phase 5: the home page (XL)

The core, built behind a switch (Admin, "Native forside", off for everyone else) while the web home page stays what everyone sees; the web view keeps running hidden underneath while the switch is on, still owning the session and the background work. In this order, each step usable on its own with the switch on:

1. The month view (`swipe/MonthView`, `PhoneCalendar`): the months scrolling under the glass header with the month's name following the scroll, the weekday row, I dag, the phone's own events read natively with their titles (`readDetails` moves into a native store), holidays, Casy's entries, trips, votes and stars; the bottom toolbar with Aftaler, Planlæg and Profil, their badges, each the zoom source of its native sheet from Phases 2 to 4. Measured on the user's phone: twelve months scrolling at 120 Hz, or a `UICollectionView` instead.
2. The day view (`dayView/DayView`): zooming out of the day's cell (the zoom transition from the cell as source), the week row, one or two days, the now-line, Casy's events, `DayRow`'s details with Casys vurdering.
3. Votes on the home page (`useHomeVotes`, `VotePill`, `HomeVote` over the day view, `useVoteDeck`, the days gliding to the next date, the warnings, `AgreedCard` and the date flying into its day, the confetti).
4. Planlæg (`PlanSetup`, `TimeRows`, `PlanMonths`, `MoreDetails`, `PeopleRows`, Genveje, Planlæg med AI in the name field with speech, the questions sheet, the sheet filling itself in) on a native `usePlanning`; CasyCore gains the whole engine (`availability.ts`, `eventSearch.ts`, `scheduler.ts`, `candidates.ts`, `dateComfort.ts`, `widen.ts`, `startFlex.ts`, `monthAvailability.ts`, `earlyMorning.ts`, `eventWarnings.ts`, `aiPlan.ts`, `shortcuts.ts`, `answerSteps.ts`), each with its parity fixtures before the screen uses it.
5. The paper pile and the send flight (`PileScreen` with its `MonthLayer`, `pile/SharedCalendar`, `pile/DateList`, the checks, `findDate/LaterDates`, the widen options, the flight into Aftaler), with `paperPile.ts` and `sendFlight.ts` ported.
6. The background work, native: the phone's calendar push (`usePhoneCalendarSync`; `PhoneCalendarBackground` already is), calendar writes (`calendar-phone`), labels (`useAutoLabel` in `hooks/useEventLabels.ts`, `eventLabels.ts`), trips (`useAutoTripLegs` in `hooks/useTrips.ts`), day facts (`useDayFactsSync`, `dayFacts.ts`), sorting calendars (`useAutoCategorize`), the live pulse (Realtime's `pulse:<user id>` with supabase-swift's Realtime, polling as `livePace.ts` when it can't connect), push registration and opening a tapped notification.
7. Signed out: the welcome screen (`AppWelcome`, `WelcomeStage`: the drawn phone, the group, the paper calendars, the vote), sign-in (email and Sign in with Apple), the join page for an invite link (`/join/<token>`, universal links handled natively).

Done when the user has lived on the switch for a while and nothing sends them back to the web.

### Phase 6: the switch (M)

1. The session moves to native (supabase-swift `Auth`, Keychain), taken from the mirrored keys or the one-time read; Log ind og sikkerhed ported (password change with its code, sign out everywhere).
2. The web view, Capacitor, its plugins, `capacitor.config.ts`, `npm run ios` and `ios:live`, the bridge and `CapApp-SPM` are removed; the plugins' Swift (`PhoneCalendarPlugin`, `InvitePlugin`, `AppleSignInPlugin`, `GlassPlugin`, `MainViewController`) is folded into plain Swift or deleted; the app target moves to Swift 6.
3. `PrivacyInfo.xcprivacy`, the permission texts and App Store Connect's privacy answers checked against what the native code does.
4. Release 2.0 through TestFlight to friends first, then App Review.
5. The website loses what only the app used: every `isNativeApp` branch (about 40 files), `nativeApp.ts`, `push.ts`, `pushAsk.ts`, `components/push/`, `contactInvite.ts`, `appleSignIn.ts`, `statusTap.ts`, `appLinksNative.ts`, `AppLinks`, `AppBackground`, `welcome/`, `UpdateRequired`, the labels, trips and day facts code and their hooks, `phoneCalendar.ts`, `phoneEvents.ts`, `phoneBusy.ts` (its rules live on in CasyCore and the server), and the Capacitor packages. Each checked with grep and knip at the time; the parity fixtures stay for what both still share.
6. CLAUDE.md, `docs/architecture/platform.md` and `overview.md` rewritten for two clients: the website (React) and the iPhone app (Swift).

### Later (not part of #192)

Widgets (the next agreed event, votes waiting; needs an App Group for the stores), App Intents and Siri ("Planlæg fredagsbar med Fredagsbar"), a Live Activity counting down a vote's deadline, Control Center and Lock Screen controls, and Apple's on-device model (Foundation Models) for labels or Tilføj til kalender if it reads Danish well enough, which would keep calendar titles on the phone entirely.

## Risks, and what is done about them

- **Every phone feature twice for a while.** Accepted with decision 4: the web phone is frozen, so new work lands once. During Phases 2 to 5 a fix to a screen already native is made natively; the web's copy of it only gets what Android friends need.
- **The two engines drifting.** The parity fixtures and CI (above). A rule may never be changed in one language only; CLAUDE.md's "pairs kept equal" list gets the parity folder in Phase 1.
- **The session.** One owner at a time (above); a refresh token is never used by two clients.
- **Danish speech.** Answered in Phase 0; three APIs to fall back through.
- **The month view's speed in SwiftUI.** Measured on the user's phone in Phase 5 step 1, with `UICollectionView` as the way out.
- **The animations.** The hardest part to get as good as the web's; Phase 5 keeps the web home page live until the native one is at least as good, and the switch makes it possible to compare on the same phone.
- **iCloud and builds.** DerivedData stays outside the repo, `swift test` gets a scratch path outside it, and package build folders are git-ignored.
- **Two looks, one tested on a phone.** iOS 18 to 25 get the fallbacks, and the user's phone runs iOS 26: the older look is checked by snapshots on an iOS 18 simulator (Xcode downloads the runtime; this Mac has only iOS 27's) and, where it matters, a friend's older phone through TestFlight. Phones below iOS 18 keep the release before; App Store Connect handles that, checked at the first bridge release.
- **The newest SDK.** Each phase starts by checking Apple's "What's new in SwiftUI" for the current Xcode against the table above, so a system piece that now does what we built by hand replaces it.

# Native screens look exactly like the web's: the guide

Every native screen in the Swift rewrite (#192) is a **translation, not a redesign**. Only the
programming language changes; what a person sees does not. A screen is done when its Swift
screenshot matches the web's screenshot of the same screen, not before, whatever the tests say.

Read this before porting or touching any native screen, and follow it step by step.

## Why this guide exists

The first native screens (Profil, Aftaler, Kalendere, the small sheets, the home page's month and
day) were rebuilt from what the web screens *do*, then checked only against themselves. Each one
lost the details that make Casy look like Casy: the exact sizes, borders, separator lines, small
icons, capsules, one-line titles cut with "...", header rows. Swift can draw all of it; the method
dropped it. This guide is the method.

## What is native on purpose: the frame is iOS's, the content is the web's

Casy is rewritten in Swift *for* a few things the web view can only imitate (#192). Those are
the one place where the native screen is meant to differ from the web, and there the native
version wins: never copy the web's imitation of them.

- **Liquid Glass:** Apple's real glass (`.casyGlass()`, with the iOS 18 fallback chosen in
  CasyUI), not the web's CSS glass, its blur, rim or shine.
- **Sheets:** the system's sheet: how it opens (growing out of its button on iOS 26), its
  heights, grabber, corner, dimming behind it and dragging it away.
- **Navigation:** pushing a screen and going back, the system back arrow, swiping back.
- **Scrolling:** the system's scrolling, its bounce and its edge effects.
- **System pieces:** the keyboard, alerts, menus, the switch (`Toggle`), date and time pickers,
  haptics, the status bar.

Everything those frames hold matches the web, value for value: the layout, sizes, spacing,
fonts, colours, borders, separators, icons, header rows, capsules, text and where it is cut.
Where a screen's frame is native on purpose, its comparison masks or ignores that area, and
the screen's section of `docs/architecture/native.md` says what differs and why. Anything not
on this list that differs is a mistake.

## The rules

These hold for everything inside the frame above.

1. **The web screen is the specification.** Not the plan, not iOS's defaults, not taste. If the web
   draws a 1-point border at 10 % opacity, so does Swift. If the web has a header row, a week
   number, a clock icon, a separator, so does Swift.
2. **Translate component by component, value by value.** For each web component, open its TSX and
   every class it uses (Tailwind classes, `theme.css`, `tailwind.config.js`, any inline style) and
   write down each value before writing Swift: sizes, paddings, margins, gaps, corner radii,
   borders and their colour and opacity, font size, weight, tracking, line height, colours in both
   themes, shadows, blur, opacity, icons (lucide name and size), truncation and line limits. Then
   write the Swift with those values. Keep the list in the commit message or the PR, so a reviewer
   can check it.
3. **No system defaults where the web chose something**, except the frame above. A SwiftUI `List`, `Form`, `Label`,
   navigation bar or sheet brings Apple's own spacing, colours, fonts and backgrounds, which change
   with iOS versions and sheet heights. Use them only where the web looks the same; otherwise draw
   the piece explicitly (stacks, shapes, fixed sizes) so nothing depends on iOS's taste.
   Rem in the web is 16 points (it follows Dynamic Type the same way: `lib/textSize.ts`).
4. **Same data, same clock, same size, same theme.** Both screenshots come from the same made-up
   world (`e2e/world.ts` through `scripts/native/fake-backend.ts`), the same frozen time
   (`-casyNow`, the world's `NOW`), the same simulator, the same theme and text size.
5. **Done means matching, in light and in dark.** The comparison below must pass for both themes
   before the screen is committed as done. Never report a native screen as done, or ask the user to
   test its look, without showing the side-by-side images.
6. **Moving parts match too.** Animations (zooms, sheets growing out of buttons, slides, the paper
   pile), their timings (`morph.ts`, `paperPile.ts`, `sendFlight.ts`, `dayTravel.ts`, the springs in
   the components) and their smoothness. Smooth means 120 Hz on the user's phone: nothing heavy
   recomputed in `body`; data a view draws is prepared once, off the main thread, and cached.
7. **Behaviour is still tested** as before (UI tests, parity fixtures). The look is an extra gate,
   not a replacement.

## The reference: the web screen as the app draws it

The reference is the web screen **inside the iPhone app, in the same simulator**: WebKit, the
iPhone's system font, the app's own layout (`isNativeApp`), the real safe areas and status bar.
The e2e reference images (`e2e/__screenshots__/*-phone.png`) are not the reference: they are Linux
Chromium with other fonts and the website's phone layout. They are only a quick first look.

The simulator is **iPhone 17e** (390 x 844 points, the e2e phone size) for every parity shot.

### The setup

Run `scripts/native/parity.sh` (every parity test) or `scripts/native/parity.sh
ParityUITests/<test>` (one). It needs Python's image library (`python3 -m pip install pillow`).
Its pieces:

1. **The web build against the fake backend.** `npm run ios:parity`
   (`scripts/native/parity-build.sh`) builds the site with `VITE_SUPABASE_URL=http://localhost:4318`
   and the e2e publishable key into `dist-parity/`, never `dist/`, and copies it into the app.
   Debug only, never released: `npm run ios` and `npm run release:ios` put the real site back.
   The fake backend (`scripts/native/fake-backend.ts`) answers every function and Supabase Auth
   (`/auth/v1/user`, `token`, `logout`), with the CORS headers the app's page needs.
2. **`-casyWebOnly YES`** (TestLaunch): `NativeBridge.screens()` answers `[]`, the native home page
   stays off and no native screen opens, so the page draws every screen itself.
3. **The page signed in and its clock frozen:** with `-casyWebSession <base64>` (the fake backend's
   `/parity/session`: the storage key and Mia's session from `e2e/session.ts`, which the browser
   tests use too), the app adds a `WKUserScript` before the page's first line that empties the
   page's storage once per launch, puts the session in, stops `Date` at `-casyNow`, seeds
   `Math.random` and `appRandom` as `e2e/fixtures.ts` does, and sets the theme (`-casyTheme`) and
   language (`-casyLang`). It runs in **both** modes: web only, the page draws the screen; native,
   the page hands the native screen its data over the bridge as in real use, so both shots show the
   same world (the native run turns the home page on with `-casy.nativeHome YES`, Admin's switch,
   not the made-up page of `HomeUITests`).
4. **Opening a screen on the page:** `-casyWebPath <path and query>` (`/?day=2026-10-15`,
   `/?profile`) is put in place with `history.replaceState` before the router reads it.
5. **`parity.sh`** builds the app once, starts the fake backend, runs the tests on iPhone 17e with
   `CASY_PARITY_MODE=web` and then `native`, and for each shot writes `<name>-web.png`,
   `<name>-native.png`, `<name>-pair.png` (side by side, web left) and `<name>-diff.png` (the web
   shot faded, every pixel more than 2 of 255 apart in red; the status bar and home indicator left
   out) to `PARITY_OUT` (default `$TMPDIR/casy-parity`), and prints the share that differs
   (`scripts/native/parity-compare.py`). `PARITY_NO_WEB_BUILD=1` skips step 1.
6. **The parity tests** (`ios/App/AppUITests/ParityUITests.swift`): one test per screen, state and
   theme, written once for both modes: `launch(path, theme:)`, then `shoot(app, name, when:)`,
   which waits for a text both draw and lets the screen settle. Skipped in the ordinary UI test run.
   **The reference is never a Swift screen.** `shoot` takes an element only the Swift screen has
   (`native: "home.title"`): in the web run the text must be found inside the web view and that
   element must be absent, before and after settling, or the test fails and no web shot is saved;
   in the native run it must be there. The web screens are the ones the App Store build shows
   (a Release build has no native screens), so the reference is the original, as people have it.

## The loop, for each screen

1. **List the screen's states**: light and dark, empty and full, each sheet height, loading,
   errors that can show, large text. Each is a parity shot.
2. **Take the web reference** of each state (`parity.sh`; the `-web.png` shots). Look at it closely; write down
   every element top to bottom.
3. **Write down the web's values** (rule 2) for every element in the list.
4. **Write the Swift** from those values.
5. **Compare** (`parity.sh`): open `-pair.png` and `-diff.png` and look, element by element, top to
   bottom: position, size, corner, border, colour, font, weight, spacing, icon, truncation.
6. **Fix and repeat** from 4 until the screen passes:
   - every element present, in the same place (within 1 point) and the same size;
   - the same colours (within 2 of 255 per channel), borders, radii, icons and fonts;
   - the same text, wrapped and cut the same way;
   - `-diff.png` shows nothing but antialiasing at edges, the clock and system-owned pixels
     (the status bar, the home indicator, real Liquid Glass refraction where the web imitates it).
7. **Both themes**, then **moving parts** (rule 6): record both in the simulator
   (`xcrun simctl io booted recordVideo`) and compare the timings frame by frame, then try it on
   the phone for smoothness.
8. **Commit** with the pair images' names and the value list, and show the user the pairs when
   asking them to test.

When a difference is on purpose (iOS's own sheet, keyboard or alert, real Liquid Glass), write it
down in the screen's section of `docs/architecture/native.md` with the reason. Nothing differs by
accident.

## Where the rewrite stands (#280)

Everything native before this guide was written must be brought back through the loop, screen by
screen, before new screens are ported: the home page's month and day view (#201), Profil and its
screens (#198), Aftaler (#199), Kalendere and the small sheets (#200). Phase 5 continues with step 3
(votes) only after that.

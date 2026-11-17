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

### Setting it up (once, before the first screen is compared)

These pieces do not exist yet; build them first, in this order, each tested:

1. **The web build against the fake backend.** `npm run ios:parity`: builds the site with
   `VITE_SUPABASE_URL=http://localhost:4318` and the e2e publishable key, and copies it into the
   app (`npx cap sync ios`). Debug only; never released. The fake backend already answers
   `/auth/v1/*` and every function (`scripts/native/fake-backend.ts`).
2. **`-casyWebOnly YES`** (TestLaunch): `NativeBridge.screens()` answers `[]`, so the page draws
   every screen itself, as it did before the rewrite.
3. **The page signed in and its clock frozen** under a test launch: a `WKUserScript` added by the
   app before the page loads that puts the fake session in `localStorage` (the auth storage key in
   `src/lib/supabase.ts`) and fixes `Date` at `-casyNow`, as `e2e/fixtures.ts` does in Playwright.
   The page's theme follows `-casy.appearance` (already honoured under a test launch).
4. **Opening a screen on the page:** `-casyWebPath <path and query>` (for example `/?day=2026-10-15`,
   `/?profile`, `/?events`) loads that address, so the web reference opens on the same screen and
   state as the native test.
5. **`scripts/native/parity.sh <Test class>/<test> <shot name>`**: runs the UI test twice on iPhone
   17e, once with `-casyWebOnly YES -casyWebPath ...` and once native, saves both screenshots,
   and writes three images to the scratchpad: `<name>-web.png`, `<name>-native.png`,
   `<name>-pair.png` (side by side) and `<name>-diff.png` (what differs, in red), plus the share
   of pixels that differ.
6. **The parity tests** (`ios/App/AppUITests/ParityUITests.swift`): one test per screen and state
   that opens it and takes `shot(name)`, written so the same test runs in both modes.

## The loop, for each screen

1. **List the screen's states**: light and dark, empty and full, each sheet height, loading,
   errors that can show, large text. Each is a parity shot.
2. **Take the web reference** of each state (`parity.sh`, web mode). Look at it closely; write down
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

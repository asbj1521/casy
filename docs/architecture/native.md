# The native iPhone app: how it is built

The living half of `docs/native-ios-plan.md`, which says where this is going. The app is still the web view; since Phase 2 (#198) it needs iOS 18 and links the packages below, and native screens open over the page through a bridge.

## The packages

| Package | What it holds | Mirrors |
|---|---|---|
| `CasyCore` | Pure logic, no UI: the engine's types, Danish time (`Zone`), dates as text (`Format`), holidays, periods and the viewer's clock, `PhoneBusy`, votes and the event lists (`Events`) | `src/lib`, `src/types` |
| `CasyAPI` | `EdgeFunctions.call` (the web's `callFunction`), and the answers as Codable types | `src/lib/supabaseFunctions.ts`, `src/api` |
| `CasyUI` | `Theme` (colours), `FlowButton`, `GlassButton`, `casyGlass()`, `ListRow`, `ListPickRow`, `ListSwitchRow`, `CasyField`, `Avatar`, `Notice`, `ConfirmButton`, the String Catalog | `src/index.css`, `src/theme.css`, `src/components/ui` |

Rules for code in them:

- Every date is Danish time, or a zone passed in. Never `Calendar.current` or `TimeZone.current`: the tests run in New York so a slip fails. The app passes in the device's zone where it matters (`yourTime`).
- Every choice between iOS 26 and earlier is made in CasyUI, never with `#available` in a screen.
- A successful answer of the wrong shape is an error, never a crash. Words a screen only displays (a provider, a status) stay strings, so a new value from the server can't stop an answer from reading.
- Dates are written from the names in `Format.swift`, not the system's formatter, whose wording changes between iOS versions.
- New copy goes into `Localizable.xcstrings` in Danish and English. A test fails on a missing language, a dash, an emoji or "iCloud".

## The bridge

`ios/App/App/Native/` is a synchronized folder: a new Swift file there needs no edit to `project.pbxproj`. `Bridge/NativeBridgePlugin.swift` and `src/lib/nativeBridge.ts` (with `NativeBridgeSync`, mounted in `AppBackground`) are the two ends.

- The web view owns the login. It lends the access token (`SessionBox`, in memory only); one about to run out is asked for again (`needSession`), never refreshed natively, as Supabase rotates refresh tokens.
- Language and theme are the web view's too: a choice made natively is sent back and applied as its own rows do. Strings follow Casy's language (`CasyStrings.language`), not the phone's.
- **A screen reaches people only when it does everything the web's does.** `nativeScreens` lists it for `DEBUG` until then, so TestFlight and App Store builds keep the web's. The web asks once which screens exist (`useNativeScreen`), so a web build never opens one its app doesn't have.

## What keeps it equal to the web

| Kept equal | Written by | Checked in Swift by |
|---|---|---|
| The engine | `src/lib/parity/*.cases.ts`, `parity.test.ts` | `CasyCoreTests` (`Parity/*.json`) |
| The API's answers | `e2e/apiAnswers.parity.ts`, from the browser tests' fake backend | `CasyAPITests` (`Answers/*.json`), each read and written back with nothing lost |
| The colours | `src/lib/parity/theme.test.ts`, from the stylesheets | `CasyUITests` (`Fixtures/colors.json`) |

Change a rule in TypeScript and Vitest fails until the files are written again, then the Swift tests fail until Swift changes too:

```bash
UPDATE_PARITY=1 npx vitest run src/lib/parity e2e/apiAnswers
```

The fake backend is not the real server: a screen's first run against the live functions is still the real test.

## Running the tests

Never run `swift build` or `swift test` in the repo without `--scratch-path` outside it (iCloud, see the plan).

```bash
TZ=America/New_York swift test --package-path ios/Packages/CasyCore \
  --scratch-path ~/Library/Developer/Xcode/DerivedData/CasyCore-scratch
scripts/native/snapshots.sh            # CasyUI's pictures; --record draws them anew
```

CI's `native.yml` tests all three packages on a Mac (CasyUI through `xcodebuild`, as its Xcode's plain `swift test` doesn't compile the String Catalog) and builds them for the iOS simulator, whenever `ios/Packages` or `src/lib` change.

The snapshots (`CasyUISnapshotTests`) check layout, colours and words on the pinned simulator (iPhone 17, iOS 27.2), and are not on CI: its Xcode has an older iOS. They are drawn off screen, where **Liquid Glass doesn't show**, so glass is judged on a real phone.

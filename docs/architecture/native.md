# The native iPhone app: how it is built

The living half of `docs/native-ios-plan.md`, which says where this is going. Today the packages below sit beside the app in `ios/Packages/` and are **not linked into it**: the App Store app is still the web view, on iOS 15. The first native screen comes in Phase 2 (#198), with the bridge and the raise to iOS 18.

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

CI's `native.yml` tests all three packages on a Mac and builds them for the iOS simulator, whenever `ios/Packages` or `src/lib` change.

The snapshots (`CasyUISnapshotTests`) check layout, colours and words on the pinned simulator (iPhone 17, iOS 27.2), and are not on CI: its Xcode has an older iOS. They are drawn off screen, where **Liquid Glass doesn't show**, so glass is judged on a real phone.

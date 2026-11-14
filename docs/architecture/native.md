# The native iPhone app: how it is built

The living half of `docs/native-ios-plan.md`, which says where this is going. The app is still the web view; since Phase 2 (#198) it needs iOS 18 and links the packages below, and native screens open over the page through a bridge.

## The packages

| Package | What it holds | Mirrors |
|---|---|---|
| `CasyCore` | Pure logic, no UI: the engine's types, Danish time (`Zone`), dates as text (`Format`), holidays, periods and the viewer's clock, `PhoneBusy`, votes and the event lists (`Events`), what a swipe on a group does and its member line (`Groups`), who can be invited, an email's look, a link's life and whom a text goes to (`Invite`) | `src/lib`, `src/types` |
| `CasyAPI` | `EdgeFunctions.call` (the web's `callFunction`), and the answers as Codable types | `src/lib/supabaseFunctions.ts`, `src/api` |
| `CasyUI` | `Theme` (colours), `casySheetBar` and `casyPushedBar` (every sheet's top bar, design rule 11), `FlowButton` (glass, or `.solid` orange for an invitation's yes), `GlassButton`, `casyGlass()`, `ListRow`, `ListAvatarRow` (a picture in front), `ListPickRow`, `ListSwitchRow`, `CasyField`, `Avatar`, `Notice`, `ConfirmButton`, the String Catalog | `src/index.css`, `src/theme.css`, `src/components/ui` |

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
- **The rewrite reaches people all at once, as its own update (decided 2026-11-09).** `nativeScreens` is empty in a Release build, so TestFlight and App Store builds keep the web's screens and `main` can ship fixes and features meanwhile; native screens show when running a Debug build from Xcode. The web asks once which screens exist (`useNativeScreen`), so a web build never opens one its app doesn't have.

- **The Profil list** (`Screens/ProfileScreen.swift`, Debug only until the whole sheet is native) opens from `?profile` through `profile/NativeProfile.tsx`. Indstillinger is pushed inside it; a row whose screen is still the web's closes the sheet and `closed` carries `next` (the address), so the page goes there as one step; `signOut` is the page's too, as it owns the login. The web's sheet answers `?profile=<screen>` as before, and its way back to `?profile` opens the native list again. The app never opens Safari: help pages are the page's own screens inside the app until they are rebuilt in Swift. The picture on the name card (add, crop, remove) is native too.
- **Grupper** (`Screens/GroupsScreen.swift`) is pushed inside the Profil list: the invitations, then your groups, each swiped left to leave or delete (asked first when it takes the group from others, `groupSwipe`). An invitation opens its own screen (Bliv medlem, Nej tak, blocking the sender behind the ?); joining closes the sheet with `joined`, and the page offers notifications as its own invitation does. Lav en gruppe opens `NewGroupSheet`: the picture, name and description, Næste makes it, and the same sheet goes on to its invite.
- **A group** (`Screens/GroupScreen.swift`) is pushed from its row: the picture, name, size and age, the members (what they see behind the ?), Rediger gruppe (picture, name and description in one sheet, only what changed saved), Tid til hinanden for groups of four or more, Rapportér eller bloker (`ReportSheet`: the group or a member, why, a note, blocking and leaving with it), and leaving or deleting, asked first. Left or gone from elsewhere, it goes back to Grupper, though only once a sheet over it has closed.
- **Inviting** (`Screens/InviteSheet.swift`, `InviteModel`) is the web's InviteBody: from the contacts (`ContactInviter`: iOS's picker, then Messages, or the share sheet on a phone that can't text; what is picked never leaves the phone), by email, a link with copy, share and its QR code (Core Image), and the people from your groups and friends ticked (`knownPeople` in CasyCore), folded past four. After an invite the page is sent `inviteSent`, so its home page's nudge to invite people goes as after its own. Not yet: the notifications ask the web makes after sending (the push ask is Native 4's).
- **Venner** (`Screens/FriendsScreen.swift`) is pushed from Profil: everyone you share a group with or once did, each with where from, and Fjern for a friend from a group since gone only (anyone else would come back). Tilføj en ven is the invite sheet made for a friend (`InviteModel.forFriend()`): the contacts and a link, no email and no people.
- `GroupsModel` keeps the Profil row's count, and every change sends `dataChanged`, on which the page fetches its groups, invitations and blocked people again.

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

The app's UI tests (`ios/App/AppUITests`, a synchronized folder) open native screens signed in, against the browser tests' fake backend over HTTP (`scripts/native/fake-backend.ts`; a test that changes its world calls `POST /reset` first), locally: for each step only the screens it touched (`-only-testing:AppUITests/<Class>`), the whole suite every three or four steps and always before a merge; and on CI (`ios.yml`) on `main` only, after the merge, so a merge doesn't wait the 9 minutes they take on GitHub's Mac:

```bash
scripts/native/ui-tests.sh             # UI_TEST_DEVICE picks the simulator
```

A Debug build reads the launch arguments that make this possible (`TestLaunch.swift`: `-casyBackend`, `-casyOpenScreen`, `-casyPushPermission`, `-casyLang`), and then ignores what the web view sends. A Release build has none of it. Each new screen gets its tests here: both bugs found by hand in Notifikationer (the section never loading, a switch waiting for the server) are the kind they catch. `Info.plist` allows local networking so the app can reach the fake backend; it opens nothing else.

The snapshots (`CasyUISnapshotTests`) check layout, colours and words on the pinned simulator (iPhone 17, iOS 27.2), and are not on CI: its Xcode has an older iOS. They are drawn off screen, where **Liquid Glass doesn't show**, so glass is judged on a real phone.

# Releasing the iPhone app (#143)

The website and the app ship differently. Every push to `main` deploys
casy.app at once. The app ships a copy of the site frozen into the build, and
people keep an old build until they update, sometimes for months. So a release
is a deliberate step, and the backend has to keep working for builds already
out there.

## What a release is

- **The version** (`1.0.0`) is what the App Store shows. It lives in two places
  that must agree: `package.json`'s `version` and Xcode's `MARKETING_VERSION`.
  `src/lib/releaseVersion.test.ts` fails in CI when they don't. Raise both
  together for each App Store version; TestFlight builds of the same version
  share it.
- **The build number** is the commit count (`git rev-list --count HEAD`), set
  only when archiving, so it always rises and needs no commit. The project's own
  `CURRENT_PROJECT_VERSION` (1) is only for builds run from Xcode.
- **The tag** `app-<version>-<build>` (for example `app-1.0.0-587`) marks the
  commit every uploaded build came from. Never move or delete one.

## The order

1. **The backend first.** Apply migrations (`supabase db push`), then deploy the
   functions the new app needs (`supabase functions deploy`). An app that calls
   an action the server doesn't have yet fails for everyone who updates.
2. **Older apps keep working.** A function change must still answer every build
   at or above `MIN_APP_VERSION`: add fields and actions rather than change or
   remove them. Removing something an old build uses means raising
   `MIN_APP_VERSION` first, which shows that build "Opdater Casy" and sends its
   users to the App Store (`APP_STORE_URL`). Raise it only once the version
   that replaces it is live on the App Store.
3. **Then the app**, from `main` with everything merged and CI green.

## Making the release

```bash
git checkout main && git pull
npm run release:ios
```

`scripts/release-ios.sh` refuses, before building anything, unless:
- the tree is clean;
- the branch is `main` or a `release/` branch;
- the branch is level with GitHub;
- CI passed for that commit;
- the two versions agree.

Then it:
1. builds the site;
2. copies it into the app;
3. makes sure no `npm run ios:live` server address is left in it;
4. archives;
5. tags and pushes the tag;
6. uploads to App Store Connect.

The upload uses the Apple account signed in to Xcode (Settings > Accounts).
When it fails, the archive opens in Xcode's Organizer, where Distribute App >
App Store Connect does the same by hand. `npm run release:ios -- --no-upload`
stops there on purpose, for a first try.

Apple then processes the build (often 10 to 30 minutes) before it shows in
TestFlight. Testers added as App Store Connect users get it at once; testers
invited by email or link need Beta App Review the first time a version is
tested. Submitting for the App Store (#147) picks one of these builds.

The first upload needs the app's record in App Store Connect (bundle id
`app.casy`), made once by hand.

## A hotfix

When a shipped version needs a fix but `main` holds app changes not ready to
ship:

```bash
git checkout -b release/1.0.1 app-1.0.0-587   # from the shipped build's tag
# raise package.json and MARKETING_VERSION to 1.0.1, fix, commit, push; CI runs on the branch
npm run release:ios
```

Then merge the fix back into `main` through a feature branch, as always. When
`main` has nothing unshipped, there is no need for a branch: fix on `main` and
release from it.

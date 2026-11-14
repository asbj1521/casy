#!/usr/bin/env bash
# Releases the iPhone app (npm run release:ios, #143): the one way a build
# reaches TestFlight and the App Store. Checks first, then builds the site,
# copies it into the app, archives it, tags the commit and uploads the build
# to App Store Connect. See docs/releases.md for the routine around it.
#
# Refuses, before building anything, unless: the tree is clean; the branch is
# main or a release/ branch (a hotfix) and level with GitHub; CI passed for
# this exact commit; package.json's version equals Xcode's MARKETING_VERSION;
# and this commit wasn't released already.
#
# The build number is the commit count (git rev-list --count HEAD), set only
# for the archive, so it always rises and leads back to its commit without a
# commit of its own. Each release is tagged app-<version>-<build>.
#
#   npm run release:ios                 # check, archive, tag, upload
#   npm run release:ios -- --no-upload  # check and archive; open it in Xcode's Organizer
#
# Needs Xcode signed in to the Apple Developer account (Settings > Accounts)
# and the GitHub CLI (gh auth status). The archive goes to Xcode's own
# Archives folder: never a folder in the repo, where iCloud breaks signing.
set -euo pipefail

REPO=asbj1521/casy
PROJECT=ios/App/App.xcodeproj
CONFIG_COPY=ios/App/App/capacitor.config.json

die() {
  echo "release: $*" >&2
  exit 1
}
say() { echo "release: $*"; }

upload=true
for arg in "$@"; do
  case "$arg" in
    --no-upload) upload=false ;;
    *) die "unknown option '$arg' (only --no-upload)" ;;
  esac
done

cd "$(git rev-parse --show-toplevel)"
command -v gh >/dev/null || die "the GitHub CLI (gh) isn't installed"
command -v xcodebuild >/dev/null || die "Xcode's command line tools aren't installed"

# --- Checks: nothing is built until all of them pass ---------------------

branch=$(git branch --show-current)
case "$branch" in
  main | release/*) ;;
  *) die "release from main, or a release/ branch for a hotfix, not '${branch:-a detached HEAD}'" ;;
esac
[ -z "$(git status --porcelain)" ] || die "commit or stash your changes first (untracked files too)"
git fetch --quiet origin "$branch"
sha=$(git rev-parse HEAD)
[ "$sha" = "$(git rev-parse "origin/$branch")" ] || die "$branch isn't level with GitHub; pull or push first"

# CI must have passed for this commit. A screenshot bot commit holding only
# reference images has no checks of its own: then its parent's count.
check=$sha
if [ "$(git log -1 --format=%an "$sha")" = "github-actions[bot]" ] &&
  [ -z "$(git diff --name-only "$sha~1" "$sha" | grep -v '^e2e/__screenshots__/' || true)" ]; then
  check=$(git rev-parse "$sha~1")
fi
# A commit merged by npm run finish has two runs: the branch's, which passed
# before the merge, and main's own, which may still be going. One success and
# no failure is enough; the same code can't pass once and fail once.
ci=$(gh run list -R "$REPO" --commit "$check" --workflow CI --json conclusion \
  -q 'if any(.[]; .conclusion == "failure" or .conclusion == "timed_out") then "failed"
      elif any(.[]; .conclusion == "success") then "passed"
      elif length == 0 then "not found" else "still running" end' 2>/dev/null || true)
[ "$ci" = "passed" ] ||
  die "CI for ${check:0:7} has ${ci:-no answer from GitHub}, not passed; see https://github.com/$REPO/actions"

version=$(node -p "require('./package.json').version")
marketing=$(grep -o 'MARKETING_VERSION = [^;]*' "$PROJECT/project.pbxproj" | sed 's/.*= //' | sort -u)
[ "$marketing" = "$version" ] ||
  die "package.json says $version but Xcode's MARKETING_VERSION says '$(echo $marketing)'; raise both together"
team=$(grep -o 'DEVELOPMENT_TEAM = [^;]*' "$PROJECT/project.pbxproj" | sed 's/.*= //' | sort -u)
[ -n "$team" ] && [ "$(echo "$team" | wc -l)" -eq 1 ] || die "the Xcode project has no single DEVELOPMENT_TEAM"

# The App Store's icon (#206): 1024 px, opaque (Apple refuses transparency),
# and not Capacitor's placeholder, which build 591 still had. Since the new
# identity (#269) it is three: light (the one the App Store shows), dark and
# tinted, each listed in the set's Contents.json.
PLACEHOLDER_ICON=29e4777e319de3ee5a52c3a8004ec19d0568414004257e36d7c94a077d71c93b
for look in light dark tinted; do
  icon=ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-$look.png
  grep -q "\"AppIcon-$look.png\"" ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json ||
    die "$icon isn't in the icon set's Contents.json"
  [ "$(sips -g pixelWidth "$icon" | awk '/pixelWidth/ {print $2}')" = 1024 ] || die "$icon isn't 1024 px wide"
  [ "$(sips -g hasAlpha "$icon" | awk '/hasAlpha/ {print $2}')" = no ] || die "$icon has transparency, which the App Store refuses"
  [ "$(shasum -a 256 "$icon" | cut -c1-64)" != "$PLACEHOLDER_ICON" ] || die "$icon is still Capacitor's placeholder"
done

build=$(git rev-list --count HEAD)
tag="app-$version-$build"
if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  [ "$(git rev-parse "$tag^{commit}")" = "$sha" ] || die "tag $tag already exists on another commit"
  say "$tag is already this commit's tag; building it again"
fi
say "releasing Casy $version ($build) from $branch at ${sha:0:7}"

# --- Build the site and copy it into the app -----------------------------

npm run build
# Without CAP_LIVE_URL the copied config has no server address. An address
# left there by npm run ios:live would make the app load from this Mac.
env -u CAP_LIVE_URL npx cap sync ios
! grep -q '"server"' "$CONFIG_COPY" || die "$CONFIG_COPY still has a server address; the app would load from this Mac"

# --- Archive ---------------------------------------------------------------

archive="$HOME/Library/Developer/Xcode/Archives/$(date +%Y-%m-%d)/Casy $version ($build).xcarchive"
say "archiving to $archive"
xcodebuild -quiet -project "$PROJECT" -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$archive" \
  -allowProvisioningUpdates CURRENT_PROJECT_VERSION="$build" archive
archived=$(/usr/libexec/PlistBuddy -c 'Print :ApplicationProperties:CFBundleVersion' "$archive/Info.plist")
[ "$archived" = "$build" ] || die "the archive's build number is '$archived', not $build"

# The archive is what this commit built: tag it before the upload, so a
# build in App Store Connect can always be traced to its code.
git tag -a "$tag" -m "Casy $version ($build)" "$sha" 2>/dev/null || true
git push --quiet origin "refs/tags/$tag"
say "tagged $tag"

# --- Upload ----------------------------------------------------------------

if [ "$upload" = false ]; then
  open "$archive"
  say "archived, not uploaded: in Xcode's Organizer press Distribute App > App Store Connect"
  exit 0
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cat >"$work/ExportOptions.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>app-store-connect</string>
  <key>destination</key>
  <string>upload</string>
  <key>teamID</key>
  <string>$team</string>
  <key>manageAppVersionAndBuildNumber</key>
  <false/>
</dict>
</plist>
EOF
say "uploading to App Store Connect"
if xcodebuild -quiet -exportArchive -archivePath "$archive" -exportPath "$work/export" \
  -exportOptionsPlist "$work/ExportOptions.plist" -allowProvisioningUpdates; then
  say "done: Casy $version ($build) is uploaded; it shows in TestFlight once Apple has processed it (often 10 to 30 minutes)"
else
  open "$archive"
  die "the upload failed (output above); the archive is open in Xcode's Organizer: press Distribute App > App Store Connect"
fi

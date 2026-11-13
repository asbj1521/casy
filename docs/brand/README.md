# The icon and the wordmark (#269)

The masters for "Vi finder lige en dag"'s icon, as shapes (no font needed):

- `icon.svg`: the icon, 1024 × 1024, full bleed. iOS rounds the corners itself, so it has none.
- `icon-letters.svg`: the same letters on nothing, for anything that sets its own background.

The letters are Anton (SIL Open Font License, allowed in a logo), "VI FINDER" over
"LIGE EN DAG", each line as wide as the icon minus a 10% margin and stretched up to fill
it, the first line about 1.6 times as tall as the second. The orange is `#FF4D00`, brighter
than the buttons' `cta` (which keeps its checked contrast with white text).

Made from them:

| File | What |
|---|---|
| `ios/App/App/Assets.xcassets/AppIcon.appiconset` | light (white on orange), dark (orange on `#16110E`) and tinted (grey on `#1C1C1E`), 1024, no alpha |
| `public/favicon.svg` | the icon with its own rounded corners, for a browser tab |
| `public/apple-touch-icon.png` | 180, full bleed, for "Add to Home Screen" |
| `public/og-image.png` | 1200 × 630, the letters on orange: what a shared link shows |

The site's wordmark (`ui/Wordmark`) is the same font, live text, from `@fontsource/anton`.

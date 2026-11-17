"""The web and native shots of one parity test, compared (#280).

    python3 scripts/native/parity-compare.py <folder> <name>

Reads <name>-web.png and <name>-native.png in <folder> and writes beside them:
  <name>-pair.png  the two side by side, web on the left
  <name>-diff.png  the web shot faded, with every pixel that differs in red
and prints the share of pixels that differ. A pixel differs when any channel
is more than 2 of 255 apart (docs/native-visual-parity.md, step 6). The status
bar and the home indicator (iOS's own, the clock above all) are left out.
"""

import sys

from PIL import Image, ImageChops

TOLERANCE = 2
# iPhone 17e in points: the status bar's height and the home indicator's strip.
STATUS_BAR_PT = 47
HOME_INDICATOR_PT = 34
GAP = 24


def main() -> None:
    folder, name = sys.argv[1], sys.argv[2]
    web = Image.open(f"{folder}/{name}-web.png").convert("RGB")
    native = Image.open(f"{folder}/{name}-native.png").convert("RGB")
    if web.size != native.size:
        sys.exit(f"parity: {name}: the shots differ in size, {web.size} and {native.size}")

    width, height = web.size
    scale = width / 390  # points to pixels: 390 points wide
    top = round(STATUS_BAR_PT * scale)
    bottom = height - round(HOME_INDICATOR_PT * scale)

    pair = Image.new("RGB", (width * 2 + GAP, height), "white")
    pair.paste(web, (0, 0))
    pair.paste(native, (width + GAP, 0))
    pair.save(f"{folder}/{name}-pair.png")

    # A pixel differs when its largest channel difference passes the tolerance.
    channels = ImageChops.difference(web, native).split()
    largest = ImageChops.lighter(ImageChops.lighter(channels[0], channels[1]), channels[2])
    mask = largest.point(lambda value: 255 if value > TOLERANCE else 0)
    mask.paste(0, (0, 0, width, top))
    mask.paste(0, (0, bottom, width, height))

    faded = Image.blend(web, Image.new("RGB", web.size, "white"), 0.7)
    faded.paste(Image.new("RGB", web.size, (230, 0, 0)), (0, 0), mask)
    faded.save(f"{folder}/{name}-diff.png")

    counted = width * (bottom - top)
    differing = mask.histogram()[255]
    print(f"parity: {name}: {differing / counted:.2%} of pixels differ")


if __name__ == "__main__":
    main()

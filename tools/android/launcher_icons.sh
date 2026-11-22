#!/bin/bash
# Android launcher icon for both apps (android/ = TWA, native/ = native beta).
# Bubblewrap's template paints a WHITE layer and draws the icon inset by 8.5dp on it: launchers that show more
# than the standard 72dp (zoomed-out / custom shapes) then show white at the middle of each side (feedback 11-22).
# Instead: one full-bleed layer from app/icons/icon-launcher.svg (gradient to the edge, art scaled inside the
# round-mask safe zone), no white. Run by build_apk.sh and build_native.sh, and after gen_twa.mjs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
# Chrome can't screenshot windows under ~500 px wide: render at 512, then scale down with sips
"$CHROME" --headless --disable-gpu --hide-scrollbars --window-size=512,512 --screenshot="$TMP/full.png" \
  "file://$ROOT/app/icons/icon-launcher.svg" >/dev/null 2>&1
[ -s "$TMP/full.png" ] || { echo "launcher icon render failed" >&2; exit 1; }
for proj in android native; do
  RES="$ROOT/$proj/app/src/main/res"
  [ -d "$RES" ] || continue
  # 108dp adaptive layer: mdpi 108 px … xxxhdpi 432 px
  for d in mdpi:108 hdpi:162 xhdpi:216 xxhdpi:324 xxxhdpi:432; do
    mkdir -p "$RES/mipmap-${d%%:*}"
    sips -z "${d##*:}" "${d##*:}" "$TMP/full.png" --out "$RES/mipmap-${d%%:*}/ic_launcher_full.png" >/dev/null
  done
  for x in "$RES"/mipmap-anydpi-v26/ic_launcher*.xml; do
    cat > "$x" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<!-- Full-bleed launcher icon from app/icons/icon-launcher.svg (tools/android/launcher_icons.sh). No white layer. -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_full" />
    <foreground android:drawable="@android:color/transparent" />
</adaptive-icon>
XML
  done
done
echo "launcher icons written (android/, native/)"

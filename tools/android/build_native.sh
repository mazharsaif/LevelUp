#!/bin/bash
# Builds the signed native Android app (beta) from native/ → app/download/levelup-native.apk.
# Release build: id de.com.levelup.app.native ("LevelUp Native"), talks to https://levelrise.org, installs next to the TWA app.
# Same signing key as the TWA (~/.levelup-android/levelup-release.keystore, alias levelup).
set -euo pipefail
T="$HOME/.levelup-android"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
export JAVA_HOME="$(dirname "$(dirname "$(find "$T/jdk" -name java -path '*/bin/*' | head -1)")")"
export ANDROID_HOME="$T/sdk"
BT="$(ls -d "$T"/sdk/build-tools/* | sort -V | tail -1)"
PW="$(cat "$T/keystore-password.txt")"
VER="${VERSION:-$("$ROOT/tools/next_version.sh" 2>/dev/null | sed 's/^v//' || date +%Y.%m.%d.01)}"
CODE="$(echo "$VER" | tr -d . )"
"$ROOT/tools/android/launcher_icons.sh"   # full-bleed launcher icon, no white edges
cd "$ROOT/native"
./gradlew -q clean :app:assembleRelease -Plu.versionCode="$CODE" -Plu.versionName="$VER-native"
OUT="app/build/outputs/apk/release"
"$BT/zipalign" -f -p 4 "$OUT/app-release-unsigned.apk" "$OUT/aligned.apk"
"$BT/apksigner" sign --ks "$T/levelup-release.keystore" --ks-key-alias levelup \
  --ks-pass "pass:$PW" --key-pass "pass:$PW" --v4-signing-enabled false --out "$ROOT/app/download/levelup-native.apk" "$OUT/aligned.apk"
"$BT/apksigner" verify "$ROOT/app/download/levelup-native.apk"
# what the app checks at start to offer an update (NOTES="…" adds a line about what's new)
python3 - "$ROOT/app/download/native.json" "$CODE" "$VER" "${NOTES:-}" <<'PY'
import json, sys
p, code, ver, notes = sys.argv[1:5]
json.dump({"versionCode": int(code), "versionName": ver + "-native-beta", "url": "download/levelup-native.apk", "notes": notes}, open(p, "w"), indent=1)
PY
"$BT/aapt2" dump badging "$ROOT/app/download/levelup-native.apk" | head -1
ls -la "$ROOT/app/download/levelup-native.apk"

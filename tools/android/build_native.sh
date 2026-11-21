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
cd "$ROOT/native"
./gradlew -q :app:assembleRelease -Plu.versionCode="$CODE" -Plu.versionName="$VER-native"
OUT="app/build/outputs/apk/release"
"$BT/zipalign" -f -p 4 "$OUT/app-release-unsigned.apk" "$OUT/aligned.apk"
"$BT/apksigner" sign --ks "$T/levelup-release.keystore" --ks-key-alias levelup \
  --ks-pass "pass:$PW" --key-pass "pass:$PW" --out "$ROOT/app/download/levelup-native.apk" "$OUT/aligned.apk"
"$BT/apksigner" verify "$ROOT/app/download/levelup-native.apk"
"$BT/aapt2" dump badging "$ROOT/app/download/levelup-native.apk" | head -1
ls -la "$ROOT/app/download/levelup-native.apk"

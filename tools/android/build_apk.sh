#!/usr/bin/env bash
# Builds the LevelUp Android app (TWA) and puts it on the website:
#   app/download/levelup.apk          the sideloadable APK (download button in the web app)
#   app/.well-known/assetlinks.json   proves the APK owns app.level-up.com.de (no URL bar)
# Toolchain + signing key live in ~/.levelup-android (JDK 17, Android SDK, Bubblewrap, keystore).
# Usage: tools/android/build_apk.sh            (bump versionCode in android/twa-manifest.json for updates)
# KEEP ~/.levelup-android/levelup-release.keystore + keystore-password.txt BACKED UP: without them no update installs.
set -euo pipefail
T="$HOME/.levelup-android"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PW="$(cat "$T/keystore-password.txt")"
export JAVA_HOME="$T/jdk/Contents/Home" ANDROID_HOME="$T/sdk"
export BUBBLEWRAP_KEYSTORE_PASSWORD="$PW" BUBBLEWRAP_KEY_PASSWORD="$PW"

# Chrome reads the web manifest from the app's own host
sed -i '' "s|https://dev.level-up.com.de/manifest.webmanifest|https://app.level-up.com.de/manifest.webmanifest|" "$ROOT/android/app/build.gradle"

cd "$ROOT/android"
BT="$T/sdk/build-tools/36.1.0"
# Gradle straight away (bubblewrap build asks questions; this is the same build without prompts)
./gradlew --quiet assembleRelease
"$BT/zipalign" -f -p 4 app/build/outputs/apk/release/app-release-unsigned.apk app-release-aligned.apk
"$BT/apksigner" sign --ks "$T/levelup-release.keystore" --ks-key-alias levelup \
  --ks-pass "pass:$PW" --key-pass "pass:$PW" --out app-release-signed.apk app-release-aligned.apk
rm -f app-release-aligned.apk app-release-signed.apk.idsig

mkdir -p "$ROOT/app/download" "$ROOT/app/.well-known"
cp app-release-signed.apk "$ROOT/app/download/levelup.apk"

FP="$("$JAVA_HOME/bin/keytool" -list -v -keystore "$T/levelup-release.keystore" -alias levelup -storepass "$PW" | awk '/SHA256:/{print $2; exit}')"
PKG="$(python3 -c "import json;print(json.load(open('twa-manifest.json'))['packageId'])")"
cat > "$ROOT/app/.well-known/assetlinks.json" <<EOF
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {"namespace": "android_app", "package_name": "$PKG", "sha256_cert_fingerprints": ["$FP"]}
}]
EOF
"$T/sdk/build-tools/36.1.0/apksigner" verify --print-certs "$ROOT/app/download/levelup.apk" | head -3
ls -la "$ROOT/app/download/levelup.apk"

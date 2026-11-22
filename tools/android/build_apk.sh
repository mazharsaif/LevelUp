#!/usr/bin/env bash
# Builds the LevelUp Android app (TWA) and puts it on the website:
#   app/download/levelup.apk          the sideloadable APK (download button in the web app)
#   app/.well-known/assetlinks.json   proves the APK owns levelrise.org (no URL bar)
# Toolchain + signing key live in ~/.levelup-android (JDK 17, Android SDK, Bubblewrap, keystore).
# Usage: tools/android/build_apk.sh            (stamps the next release version, see tools/next_version.sh)
#        VERSION=2026.11.20.02 tools/android/build_apk.sh   (a specific version; YYYY.MM.DD.NN)
# versionName = the version, versionCode = its digits (2026.11.20.02 -> 2026112002), so updates always install.
# KEEP ~/.levelup-android/levelup-release.keystore + keystore-password.txt BACKED UP: without them no update installs.
set -euo pipefail
T="$HOME/.levelup-android"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PW="$(cat "$T/keystore-password.txt")"
export JAVA_HOME="$T/jdk/Contents/Home" ANDROID_HOME="$T/sdk"
export BUBBLEWRAP_KEYSTORE_PASSWORD="$PW" BUBBLEWRAP_KEY_PASSWORD="$PW"

# Chrome reads the web manifest from the app's own host
sed -i '' -E "s|https://[a-z0-9.-]+/manifest.webmanifest|https://levelrise.org/manifest.webmanifest|" "$ROOT/android/app/build.gradle"

# Version: calendar versioning, same scheme as the release tags
VERSION="${VERSION:-$("$ROOT/tools/next_version.sh")}"
[[ "$VERSION" =~ ^20[0-9]{2}\.[01][0-9]\.[0-3][0-9]\.[0-9]{2}$ ]] || { echo "VERSION must be YYYY.MM.DD.NN, got $VERSION" >&2; exit 1; }
CODE="${VERSION//./}"
sed -i '' -E "s/versionCode [0-9]+/versionCode $CODE/; s/versionName \"[^\"]*\"/versionName \"$VERSION\"/" "$ROOT/android/app/build.gradle"
# the start URL carries the APK version so the web app (bug reports) knows which APK it runs in
sed -i '' -E "s|launchUrl: '/\?src=apk[^']*'|launchUrl: '/?src=apk\&v=$VERSION'|" "$ROOT/android/app/build.gradle"
python3 - "$ROOT/android/twa-manifest.json" "$VERSION" "$CODE" <<'PY'
import json, sys
p, v, c = sys.argv[1], sys.argv[2], int(sys.argv[3])
m = json.load(open(p))
m["appVersionName"], m["appVersionCode"], m["appVersion"] = v, c, v
m["startUrl"] = f"/?src=apk&v={v}"
json.dump(m, open(p, "w"), indent=2)
open(p, "a").write("\n")
PY
echo "APK version $VERSION (versionCode $CODE)"

"$ROOT/tools/android/launcher_icons.sh"   # full-bleed launcher icon, no white edges
cd "$ROOT/android"
BT="$T/sdk/build-tools/36.1.0"
# Gradle straight away (bubblewrap build asks questions; this is the same build without prompts)
./gradlew --quiet clean assembleRelease
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

// Generates the Android (TWA) project in android/ from the web manifest.
// Run: node tools/android/gen_twa.mjs   (needs ~/.levelup-android/tools with @bubblewrap/cli installed)
// The APK opens https://levelrise.org (main domain from 11-20); icons are read from ICONS_FROM (any live copy of the app).
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(path.join(os.homedir(), ".levelup-android/tools/node_modules/"));
const { TwaManifest, TwaGenerator, ConsoleLog } = require("@bubblewrap/core");

const HOST = "levelrise.org";
const ICONS_FROM = process.env.ICONS_FROM || "https://levelrise.org";
const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.join(ROOT, "android");

const web = JSON.parse(fs.readFileSync(path.join(ROOT, "app/manifest.webmanifest"), "utf8"));
const m = TwaManifest.fromWebManifestJson(new URL(`${ICONS_FROM}/manifest.webmanifest`), web);
Object.assign(m, {
  packageId: "de.com.levelup.app", // permanent: Android and Play identify the app by it
  host: HOST,
  name: "LevelUp",
  launcherName: "LevelUp",
  startUrl: "/?src=apk", // lets the web app know it runs inside the APK (no download button there)
  webManifestUrl: new URL(`${ICONS_FROM}/manifest.webmanifest`), // read when generating; same file on every host
  fullScopeUrl: new URL(`https://${HOST}/`),
  minSdkVersion: 24, // androidbrowserhelper 2.7 needs Android 7.0+
  fallbackType: "customtabs",
  orientation: "portrait",
  enableNotifications: false,
  signingKey: { path: path.join(os.homedir(), ".levelup-android/levelup-release.keystore"), alias: "levelup" },
  // build_apk.sh stamps the real release version (YYYY.MM.DD.NN, code = its digits) before every build
  appVersionCode: +(process.env.VERSION_CODE || 1),
  appVersionName: process.env.VERSION_NAME || "1.0.0",
});
fs.mkdirSync(OUT, { recursive: true });
await m.saveToFile(path.join(OUT, "twa-manifest.json"));
await new TwaGenerator().createTwaProject(OUT, m, new ConsoleLog("gen"));
console.log("Android project written to", OUT);

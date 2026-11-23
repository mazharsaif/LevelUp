# LevelUp native (Android)

A native Android app that shows **the same web app** (levelrise.org) inside a WebView, so screens, icons and
pop-ups are identical to the PWA by construction. Native code adds only what the web can't do. Since 11-21 this
replaces the first version's hand-built Compose screens, which looked different from the web.

* `app/`: `MainActivity` (WebView + the `LevelUpNative` bridge) and `WidgetStore`. Icons are copied from the TWA (`android/`).
* `core/`: pure-Kotlin port of `store.js` / `lesson.js` + the sync client, golden-tested against the real JS.
  Not used by the UI; it's there for widgets, reminders and alarms, which need progress numbers without the page.

## How it works

* Opens `SERVER_URL/?src=native` (release: https://levelrise.org, the one live app; the debug build is only for emulator/widget
  work and points at http://10.0.2.2:8899 = the Mac's scratch server; override with `-Plevelup.server=http://<mac-ip>:8899` for a phone).
* User agent ends with `LevelUpNative/<version>`; the web uses it (and `?src=native`) to hide APK download offers.
* Offline: the web's service worker caches the app after the first start (WebView supports service workers).
  With no network on the very first start a small "You're offline · Try again" page shows.
* Web updates arrive instantly (same as the PWA); only native changes need a new APK.
* Back gesture → `history.back()` in the page (sheets close, "Quit this lesson?", "swipe back again"); at the
  first page it closes the app.

## Bridge (`window.LevelUpNative`)

| Method | Use |
|---|---|
| `share(text)` | Android share sheet. A document-start script also defines `navigator.share` with it (WebView lacks the Web Share API), so the invite works unchanged. |
| `saveFile(name, text)` | Backup export through Android's save dialog (blob downloads don't work in WebView). |
| `openExternal(url)` | Opens a link in the browser (also done automatically for other sites and `/download/…`). |
| `version()` | APK version name. |
| `deviceInfo()` | JSON for bug reports: APK version/code/id, manufacturer, brand, model, Android, SDK, WebView version, mic, speech, locale. |
| `setWidgetData(json)` | Stores a progress summary (see core `WidgetSnapshot`) in SharedPreferences `levelup.widget` for widgets/reminders. Not called by the web yet. |
| `retry()` | Used by the offline page. |
| `micGranted()`, `requestMic()` | The web asks for the mic right after a language course is picked (`askMicForSpeakIt`, at most twice per device). |
| `speechAvailable()`, `speechStart(id, lang, max)`, `speechStop(id)`, `speechAbort(id)` | 🎤 Speak it: a document-start script defines `webkitSpeechRecognition` on top of these (Android `SpeechRecognizer`, mic permission asked on first tap), so lesson.js runs unchanged. Events come back through `window.__luSpeech(id, "result"/"error"/"end", data)`. |

File inputs (backup import) open Android's file picker.

## Build, test

```sh
export JAVA_HOME=<~/.levelup-android/jdk/…/Contents/Home> ANDROID_HOME=~/.levelup-android/sdk
./gradlew :app:assembleDebug        # de.com.levelup.app.dev, "LevelUp dev", installs next to everything
./gradlew test                      # core golden + engine tests (server tests skip without LU_TEST_SERVER)
LU_TEST_SERVER=http://127.0.0.1:8899 ./gradlew test   # with the scratch server (never the live site)
../tools/android/build_native.sh    # signed beta → app/download/levelup-native.apk (de.com.levelup.app.native, "LevelUp")
```

Regenerate the goldens after changing web logic: `cd tools/golden && npm install && node gen.mjs`.

## Known limits of the WebView

* 🎤 Speak it uses Android's speech recognition (Google's, usually online); the phone needs the course language (de-DE, fr-FR) available in voice typing. Debug builds over plain http hide it (the web requires a secure context).
* The `speechSynthesis` fallback (only for clips without an mp3) may be silent; mp3 audio plays normally.

## Reminders, alarms, widgets (next)

* Widgets: Jetpack Glance, designs in `../docs/design/widgets/`. Data: the page calls
  `LevelUpNative.setWidgetData(JSON)` after each save (to add in app.js), or a WorkManager job loads the
  progress file through `core` (`Sync`/`Store`) and builds a `WidgetSnapshot` with the app closed.
* Reminders/alarms: `POST_NOTIFICATIONS` (Android 13+), `SCHEDULE_EXACT_ALARM`; schedule from the snapshot
  (`goalReached`, `streak`, `dueWords`); a bridge method lets Settings set the reminder time.

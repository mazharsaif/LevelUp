# LevelUp native (Android, Kotlin + Jetpack Compose)

A second client for the same LevelUp server and the **same progress files** as the web app in `../app/`
(which stays the main client). Feature status: `../docs/native/parity.md`.

```
native/
  core/          pure Kotlin (JVM) port of app/js/store.js + the logic of lesson.js, lang.js, hero.js, the tree code
                 of app.js, and the account/sync half of store.js (ApiClient + SyncEngine, OkHttp)
  app/           the Android app (Compose UI, audio, speech, WorkManager sync, widget snapshot)
  tools/golden/  node scripts that run the REAL web modules on fixture states and write golden JSON for the tests
```

## Build, install, run

Toolchain: `~/.levelup-android/` (JDK 17, SDK). Every shell needs:

```sh
export JAVA_HOME=~/.levelup-android/jdk/Contents/Home ANDROID_HOME=~/.levelup-android/sdk
echo "sdk.dir=$ANDROID_HOME" > local.properties   # once (git-ignored)
./gradlew :app:assembleDebug          # → app/build/outputs/apk/debug/app-debug.apk
./gradlew test                        # all unit tests (JVM)
$ANDROID_HOME/platform-tools/adb install -r app/build/outputs/apk/debug/app-debug.apk
```

* **Debug** = `de.com.levelup.app.dev` ("LevelUp dev"), installs next to the TWA app. Server: `http://10.0.2.2:8899`
  (the Mac seen from the emulator; cleartext allowed in debug only). Other server at build time:
  `./gradlew :app:assembleDebug -Plevelup.server=http://192.168.1.20:8899`, or at run time: login screen →
  "Debug · server" (stored as `server.url`).
* **Release** = `de.com.levelup.app` (same id as the TWA in `../android/`, so it can later install over it),
  server `https://levelrise.org`, `versionCode 2026112150` (above the TWA's calendar codes). **No signing is
  configured and no release has been built.** When it's time: sign with `~/.levelup-android/levelup-release.keystore`
  (same key as the TWA, or Android refuses the update), passing the passwords on the command line / env, never in a file.
* Content: the course files (`app/data/courses.json`, `content.json`, `fr-a1.json`, `se-path.json`, `math-path.json`,
  `stories.json`) are copied into the APK at build time (`copyWebData` task) so the first start works offline;
  the app refreshes them from the server. Reading chapters (`data/se|math/<branch>/NN.json`) and audio clips
  (`audio/<id>.mp3`) download on demand and stay on the phone (Branch screen: Download all / Remove;
  Settings: Download all audio).

## Tests

```sh
./gradlew test                                   # golden + engine tests; server tests are skipped
# with the local test server (never the live site):
cd ../server_fastapi && A1_DATA=$(mktemp -d) LU_MASTER_PASSWORD=admin uv run main.py 8899   # in another shell
LU_TEST_SERVER=http://127.0.0.1:8899 ./gradlew test
```

| Suite | What it checks |
|---|---|
| `core` `GoldenStoreTest` (7) | German + French: path expansion (grammar parts via jsoup, spread, I/II numbering), item weights, and for 6 fixture states each (fresh, early, manual goal + penalties, Quest Mode off, an old Leitner/pre-xp2/5-phrase-bits save, A1 complete): normalize (incl. migrations), progress, memory, retention, history, pace, level, rank, streak, XP, due words, auto goal, parts goal, nextPick, planParts, week plan, summary, checkMissed, checkRewards; SM-2 grade sequences, completeBit/completeItem. Expected values come from the real `store.js`. |
| `core` `GoldenLessonTest` (2) | norm, checkTyped (typos, articles, accents), checkSay, meanings/overlaps (1,900 pairs), sameMeaningDe, answerVariants, sayItems, glossOf (~3,000 tokens), speakable, numWord (de + fr), spellDE, bitsOf, nextIvl. |
| `core` `EngineTest` (6) | JSON round trip, a vocab part passed/failed (retry, pass mark, XP), review grades + relearn, phrase/grammar steps, tree reader + quiz XP, widget snapshot. |
| `core` `SyncIntegrationTest` (1) | against 8899: login (wrong + master password), cookie kept, load, save, unknown fields survive a second device, **409** → newer copy taken, 403 on someone else's file, per-course files, logout. |
| `app` `AppFlowTest` (2, Robolectric) | the real Compose screens on the JVM against 8899: intro → login → course picker → setup → Today → a whole vocab part through the UI → finish screen → progress reached the server → every tab, Ranks, Stories → Software Engineering home, branch, reader, practice. And guest mode + French A1. |

Regenerate the goldens after changing the web logic (they are the contract):

```sh
cd tools/golden && npm install && node gen.mjs          # writes core/src/test/resources/golden/*.json
node webread.mjs <progress.json> [course]               # does the web store.js still load a file the app wrote?
```

`gen.mjs` copies `app/js` to `tools/golden/.cache/js` (exporting a few private helpers there); it never changes `app/`.

## Architecture

* **State = the raw progress JSON.** `core/Js.kt` parses into LinkedHashMaps/ArrayLists with every number a
  Double, and writes numbers the way `JSON.stringify` does. `Store` works on that object directly (same field
  names as store.js), so fields the native app doesn't know are written back untouched and both clients can
  share one file. All "today" logic goes through a `DayClock` (tests pin 2026-11-21).
* **`Store`** = store.js (normalize + migrations, XP/streak, penalties, level/rank, diamonds/gifts, SM-2, memory
  decay, A1 %, pace, week plan, auto goal, parts goal, nextPick/planParts, bits, name spelling).
  **`Text`** = lesson.js/lang.js text logic. **`Builder`/`LessonRun`/`Lessons`** = the step builders, the run
  (`answered`, retries, combo, override, review grades) and the XP rules on finish (pass mark 60 %).
  **`Tree`** = skill-tree courses (parts, reader positions, continue target, quizzes with gap nodes).
* **`SyncEngine`** = the account/sync half of store.js with the same rules: newest of server/local copy wins, a
  newer local copy is uploaded, **409 → take the server's newer copy**, 401/403 keeps the change pending and asks
  for a login, offline keeps it pending. Local cache keys are the web's localStorage names (`a1.state.<uid>[@course]`,
  `a1.user`, `a1.guest`, …) in SharedPreferences. Network runs on IO threads; every read/write of the state hops
  to the UI thread (`MainRunner`), where the screens change it.
* **App**: `AppGraph` (no UI: prefs, API, store, sync, content, audio, widgets) and `AppState` (Compose state +
  actions: boot, login/guest, course switch, navigation stack, sheets, toasts, lesson runs, debounced push 600 ms,
  bug reports, party, time tracking). Screens read `app.tick` and redraw after every change.
* **Audio**: MediaPlayer with clips cached in `filesDir/audio`, on-demand download, TTS fallback in the course
  language, a token so late clips never play over newer ones. **Speak it**: the system speech recogniser
  (`RecognizerIntent`, no mic permission needed), same word check as the web.

## Reminders, alarms, widgets (later)

Everything they need is already computed and stored; nothing has to load a course:

* `WidgetSnapshot` (core): user, course, day, `streak`, `xpToday`, `xpGoal`, `dueWords`, `level`, `rank`,
  `aura` (0..1), `pctA1`, `nextTitle` (next lesson part / skill), `partsToday`, `partsGoal`, `questMode`,
  `goalReached`, `updatedAt`.
* `WidgetSnapshotRepository` (app/sync/Background.kt): written ~1 s after every save, course switch and login,
  cleared on logout. Read it with `LevelUpApp.graph(ctx).widgets.load()` or the `snapshot` StateFlow, or register
  in `listeners` (e.g. to call `AppWidgetManager.updateAppWidget` / Glance `updateAll`). Stored in
  SharedPreferences `levelup.widget` → `snapshot` (JSON), so a widget receiver or an alarm can read it cold.
* `SyncWorker` (WorkManager): one-off upload of offline changes (network constraint, backoff) and a 6-hourly
  periodic job (`levelup-sync-periodic`): the natural place to refresh widgets and (re)schedule reminders.
* Reminders/alarms: add `POST_NOTIFICATIONS` (Android 13+) and, for exact alarms, `SCHEDULE_EXACT_ALARM` /
  `USE_EXACT_ALARM` in the manifest (comment marks the spot); schedule from the snapshot (`goalReached`,
  `streak`, `dueWords`) in the periodic job and after `widgets.save`. Widget designs: `../docs/design/widgets/`.

## Found while porting

* Web bug: `partsGoal()` throws in **manual goal mode** when `goalDay` was never set (`goalFor` returns early),
  so Today's daily quest can crash for manual-goal learners. The Kotlin port creates the missing `goalDay`.
* Grammar parts with no pass mark: a grammar part counts at any accuracy (web behaviour, alpha review B1); kept
  as is for parity.
* Compose note: with Kotlin 2.x strong skipping, composables taking `AppState` are skipped unless they read
  `app.tick`; the UI test caught this (login never left the login screen).

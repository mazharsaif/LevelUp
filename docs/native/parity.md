# Native Android app: parity with the web app

Status of every web feature in the native app (`native/`, see `native/README.md`).

* **done**: built, and covered by a JVM test (golden test against the real JS, engine test, sync test against the
  local test server, or the Robolectric UI flow test).
* **built**: implemented, compiles, but not exercised by a test.
* **partial**: works in a simpler form than the web, or part of it is missing (the note says what).
* **todo**: not built.

**Nothing has been run on a phone or an emulator** (none available): layout, fonts, WebView rendering, audio,
TTS, speech recognition and the back gesture are unverified on a device. The Robolectric test renders the real
Compose screens on the JVM, which catches crashes and wiring bugs but not how things look.

## Accounts, sync, data

| Web feature | Native | Notes |
|---|---|---|
| Login / sign-up (HttpOnly `lu_session`, 90 days) | done | cookie persisted across restarts (SyncIntegrationTest, AppFlowTest) |
| Guest mode, progress only on the phone | done | AppFlowTest (guest + French) |
| Sign up while a guest keeps the progress (`claimGuest`) | built | |
| Forgot password (request via `/api/bugs`) | built | |
| Logout, change password | done / built | logout tested; change password not |
| Old server without accounts → player picker | built | |
| Intro page, theme gear on login / picker | built | |
| Course picker (once per session, per-course progress, `?c=`) | done | |
| Load: newest of server / local wins, newer local uploaded | done | |
| Save: debounced PUT, **409 → take the newer copy**, 401/403 → ask to log in | done | SyncIntegrationTest |
| Unknown fields preserved, same JSON as store.js | done | golden `normalized`/`after`, sync test, `webread.mjs` |
| Offline: pending changes kept, upload later | partial | WorkManager job retries with network; not tested on a device |
| Refresh from server when the app comes back to the foreground | built | |
| Missed-review penalties (`checkMissed`) | done | golden |
| Backup export | partial | copies the JSON to the clipboard (no file save) |
| Backup import | todo | |
| Reset progress | built | |
| Bug / feedback button (🐞) with draft + offline queue | partial | sends page, user, course, lesson step, device; no screen HTML/text snapshot |
| Time tracking `S.time` (15 s ticks, idle after 90 s) | built | |

## Store logic (store.js) — all golden-tested for German and French

| Feature | Native |
|---|---|
| normalize + migrations (settings merge, xp2 goal scaling, split grammar chapters, 5→3 phrase bits, streakFrom) | done |
| Grammar parts (`splitGrammar`), path spread, topic numbering | done |
| SM-2 (Again/Hard/Good/Easy), Leitner migration, memory decay / health | done |
| A1 % (vocab 55 / grammar 30 / phrases 15), coverage, history, pace | done |
| Level (1→100, then +1 per 200 XP), rank E→S, aura | done |
| XP scheme 2, penalties, daily goal (auto, frozen per day; manual) | done |
| Streak (goal days from 11-20, any XP before / Quest Mode off) | done |
| Diamonds, daily-quest gems, streak gift boxes | done (logic) / built (sheets) |
| Week plan, this week, parts goal, parts today | done (parts goal: web crashes in manual mode, native doesn't) |
| nextPick (alternating lessons), planParts, lastPartToday | done |
| Learner's name in Ch 1 (`personalize`, name-spelling question) | done |

## Screens

| Web screen | Native | Notes |
|---|---|---|
| Setup (target date, daily goal choices) | done | date typed as YYYY-MM-DD (+1/3/6-month buttons), no date picker |
| Today: top bar (user/course chips, XP, 💎, 🎁, sync), player bar | done | |
| Today: daily quest (3 quests, reward, streak warning, time left) | done | |
| Today: next quest card with part bar, Today's plan, memory training, level-down sheet | done | |
| Today: gift earned / open gift / treasure sheet | built | no box animation |
| Today: Stories card → stories list → story (words, listen, slow, questions, transcript) | partial | list tested; playback untested; text only, no XP (as web) |
| Path: weeks, nodes with part rings, START tip, pace card | done | zig-zag layout simplified (no diamond nodes) |
| Path sheet: parts, practise again, mark done / undo | built | |
| Quest Mode off: skill map (rings) + recommended order, free Today | built | |
| Grammar reader (HTML parts, examples, mistakes, done reading) | partial | HTML in a WebView; audio buttons inside the HTML are hidden (examples below have 🔊) |
| Lessons list (filters, weeks, XP per lesson) | done | |
| Words (search, filters, sort, collapsible topics, word sheet) | done | |
| Progress: status window, A1 ring + bars, pace chart, stats, activity calendar, memory, XP, penalties | done | chart drawn on Canvas, no text labels on the points |
| Ranks page | done | |
| Settings: Quest Mode, goal & pace, theme, Hindi hints, autoplay, sounds, speaking, offline audio, invite, backup, account | done | invite = Android share sheet |
| Party: list, create, request/cancel, accept/decline, leave, comparison (language + tree) | partial | tested render only; no 5-minute polling / "wants to join" toast (refreshes on open and foreground) |
| Install banners (APK / iOS), service worker | n/a | not needed in a native app |
| Android back: closes sheets, asks before quitting a lesson, back twice to exit | built | |

## Lesson engine (lesson.js)

| Feature | Native |
|---|---|
| Vocab parts (4 words): intro → test → mix → match → build → gap fill → hard round → second build | done (built + played through in AppFlowTest) |
| MC with overlap filtering, distractor pools | done |
| Listen, gender (der/die/das, le/la, un/une), typing with synonyms/typos/articles/accents | done |
| Complete the sentence (tiles), fill the gap, tap a word to see its meaning | done | meaning shows as a toast, not a bubble |
| Retry of missed items, combo cheers, "I was right" override, 0.45 s tap guard | done |
| Review: active recall, type mode, Again/Hard/Good/Easy with intervals, relearn | done |
| Grammar practice: typed (lenient) + MC with audio prompt | built |
| Phrases: flip card, MC/listen, Say it (tiles / typing, siblings note), guided Say it, spaced phrases | built (steps golden-tested via `sayItems`/`checkSay`) |
| 🎤 Speak it (word check, 1 miss at 6+ words, +1 XP, skip) | built | uses the system recogniser dialog, unverified on a device |
| Pass mark 60 %, failed-part screen, try again | done |
| Finish: XP, accuracy, best combo, words practised, level up/down, rank up, goal reached, next part (alternating) | done |
| Audio: clip per word/example/phrase, on-demand download + cache, TTS fallback, stale-clip guard | built | MediaPlayer/TTS untested on a device |
| UI sounds (right/wrong) | partial | system tones, not the web's two-note blips |

## Skill-tree courses (Software Engineering, Maths)

| Feature | Native |
|---|---|
| Course home: continue card, branch grid with rings, coming-soon sheet, party link | done |
| Branch: Map (orbit) and Path (prerequisite edges) layouts, ‹ › and swipe between branches, About | done (render) |
| Node sheet: learn, key ideas, parts, practice / concept check, read, undo | built |
| Reader: cards by part, resume position, swipe, finish part / skill (+15 XP), branch complete | done (reader opened + paged in AppFlowTest; part/skill finish in EngineTest) |
| Offline chapters: saved on the phone, Download all / Remove | built |
| Practice + concept checks (mc, myth/fact, true/false, number, always/sometimes/never, find the wrong line), +5 XP at 80 %, retry missed, foundations to revisit | partial | opened in AppFlowTest; quizDone XP in EngineTest; answer UI untested |

## Look

| Feature | Native |
|---|---|
| Themes: Hunter System, Hunter Mid, Hunter Simple, Calm (light/dark), Eurozeit, Classic (light/dark) | partial | colours from styles.css; no Rajdhani font, simpler glow and frames |
| Purple aura that grows with level (background, particles, accent) | partial | Canvas approximation of the CSS |
| Rank emblem E→S with halo | partial | Compose drawing of the CSS emblem |
| App icon | partial | vector version of the progress-ring icon |

## Native only (for later)

* `WidgetSnapshot` + `WidgetSnapshotRepository` for widgets / reminders / alarms, WorkManager sync job (see README).

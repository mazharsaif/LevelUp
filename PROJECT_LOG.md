# Project log – Rankwise (multi-course learning app; German A1 live)

Read this first. Open code only for the part you're changing. Update **State**, **Pending** and **Changelog** at the end of each session (keep it short).

## What it is
Mobile web app (plain JS PWA, no build step), now **multi-course**: German A1 is live; Spanish, French, Data Science, Python and Maths are "coming soon" placeholders. Two learners (Taha, Batul) use it in Android Chrome over home Wi-Fi.
Content comes from `../Data/Iteration_v3/_source` (the books): 821 words in 63 lessons, 20 grammar chapters, 14 phrase topics (97 path items).

## Run
- **Live server = FastAPI on 8766** (`cd A1-App/server_fastapi && uv run main.py 8766`, from 11-15). The old `server.py` (8765) is kept but no longer run.
- Old server: `cd A1-App && /usr/bin/python3 server.py` → http://192.168.1.4:8765 (port 8765; Mac IP may change).
  Must be Apple's `/usr/bin/python3`: the Mac firewall blocks Homebrew Python.
- **FastAPI alternative** (same app/API/files, plus docs, gzip, locks, backups API): `cd server_fastapi && uv run main.py` → port 8766 (`/docs`). See `server_fastapi/README.md`.
- Test server with scratch data (never touch real progress): `A1_DATA=<tmpdir> /usr/bin/python3 server.py 8899`.
- Rebuild content: `python3 tools/export_data.py`; audio: `tools/.venv/bin/python tools/fetch_audio.py` (edge-tts, de-DE-KatjaNeural, only fetches missing clips).
- UI testing: headless Chrome via puppeteer-core in the session scratchpad (the Chrome extension can't open localhost).

## Map
- `server_fastapi/main.py`: FastAPI twin of server.py (uv project, Python 3.9 = Apple's python for the firewall). Extras: `/api/health`, `/api/backups/{id}[/{day}]`.
- **SE reading (on demand, not bundled)**: source `content/se/<branch>/NN.md` (full guide also saved as `docs/guides/authentication-guide.md`). `python3 tools/build_se_content.py` → one small file per chapter `app/data/se/<branch>/NN.json` (~60–150-word cards) + `index.json` (sizes). The app fetches a chapter only when a skill is opened; never precached. Over HTTPS the SW keeps downloads in cache `a1-content-v1` (stale-while-revalidate, offline OK); branch card shows "On this phone: x/13 · Download all · Remove". Over plain HTTP (today) there's no SW/CacheStorage, so chapters stream from the Mac each time. Reader `openReader()`: Back/Next, swipe, resume (`S.read`), last card = skill learned.
- **Bug reports**: 🐞 tab on every screen (`app/js/bugreport.js`) snapshots page, user, course, lesson step (`lessonDebug()`), screen text + HTML, recent JS errors, then POSTs to `/api/bugs` (FastAPI; when opened from another local port, e.g. 8765, the client posts to :8766 and FastAPI allows it via CORS) → `progress/bugs/<id>.json`; `GET /api/bugs` lists them. Offline/unreachable → queued in localStorage `a1.bugQueue`, flushed later. To review: read the JSON files (render `screenHtml` with the app CSS to see the screen).
- `server.py`: static files plus `/api/users`, `/api/states`, `GET/PUT /api/state/<id>`. Writes `progress/<id>.json` with a daily backup in `progress/backups/`. Rejects stale writes (409).
- `progress/users.json`: learners `{id,name,color,demo?}`. Real ids: `taha`, `batul`. Demo profiles `demo1..5` (flag `demo:true`, hidden from the comparison) are temporary.
- `app/js/store.js`: state, sync, SRS (SM-2), progress/A1 %, memory decay, penalties, level/rank, diamonds/gifts, lesson bits, week plan, auto daily goal.
- `app/js/lesson.js`: exercise engine (all step types), review recall, finish screen (XP/combo/cheers/level-up/evolution card).
- `app/js/app.js`: router and views: who/setup, Today, Path, Lessons, Words, Progress, Settings, grammar reader, sheets, treasure.
- `app/js/hero.js`: aura (0→1 by level), particles layer `#aura-fx`, hero SVG (6 forms), custom avatar images via `app/avatars/manifest.json`.
- `app/js/audio.js`: mp3 clips `app/audio/<sha1-12>.mp3` with a speechSynthesis fallback (token guard against stale clips).
- `app/styles.css`: base plus themes `theme-sl` (Hunter), `theme-sl3` (Mid), `theme-sl2` (Simple), `theme-calm`, classic (no class).
- `tools/export_data.py` → `app/data/content.json` plus `tools/audio_manifest.json` (2,720 clips).
- `app/data/courses.json`: course registry `{id,title,subtitle,group,icon,color,status:ready|soon,type,content}`. German = `de-a1` → `data/content.json`.
- **Software Engineering** course (`se-path`, `type: "tree"`, `data/se-path.json`): skill tree with 8 branches; only Authentication is open (12 skills = guide chapters, with prerequisites; boss node last). `treeView()`/`nodeSheet()` in app.js; progress in `S.tree` (node → date), +15 XP per skill; "Mark as learned" for now (exercises planned, not built). Language views are bypassed for tree courses.
- Courses: flow is player select → course picker (once per session per learner, `sessionStorage a1.picked.<user>`) → Today; course chip on Today reopens the picker. Progress is per learner per course: `progress/<user>.json` for de-a1 (legacy name), `progress/<user>@<course>.json` for the rest (API `?c=<course>`). `switchCourse()` saves the old course before loading the new one. Engine is still language-shaped (words/grammar/phrases); new subject types will need their own item kinds.

## Key mechanics (one line each)
- **Say it in German** (phrases): English situation → whole German phrase. New phrase = word bubbles (+2–3 distractors); once produced correctly (`S.say[de]` count) = mix of bubbles/typing (typing 45→65 %). Replaces the final-round MC in phrase bits, plus 2 spaced phrases from earlier parts. `sayItems()` skips phrases with …, (), mid-sentence a / b (129 of 167 usable).
- **Pass mark**: a lesson part counts only at ≥60% first-try accuracy (`PASS_ACC` in lesson.js); otherwise "Almost there!" + Try again, small XP, no completion/level/learnWord. Long new phrases get `guidedSayStep` (2–3 key words blank) before full Say-it. Lesson steps ignore taps for 0.45 s (`.arming`) to stop double-tap skips.
- Lessons are split into **bits** (vocab: 4 words, phrases: ~5); interleaved teach→test; sentence "Complete the sentence" (only known words are blanks) plus gap-fill.
- MC options are filtered so no distractor shares a meaning (`overlaps()`, synonyms); typing accepts same-meaning words.
- **A1 %** = vocab 55 (by words × memory health) + grammar 30 + phrases 15. Coverage (lessons done) drives pace and weeks.
- **Level** 1→100 = A1 % (level 100 = A1 reached); after that +1 level per 200 XP (`a1XP` marks the XP when A1 was reached). Rank E/D/C/B/A/S at 0/10/25/45/70/95 %.
- **Reviews**: active recall, Again/Hard/Good/Easy, SM-2. Overdue words fade (−1/14 per day, floor 25 %); "Again" counts half → level can drop (level-down sheet).
- **XP**: lesson bit 4+correct (max 16), +10 per finished lesson; review +1 Good/Easy, −1 Again, ±5 bonus; missed review day −10…−30 (`pen`).
- **Daily goal**: auto by default = remaining lesson XP ÷ days to target + review allowance (20–300, set once per day); manual option.
- **Weeks**: Monday-start, from the user's start date to target date; each lesson goes into the week where the linear pace reaches it.
- **Diamonds**: +5 for a cleared daily quest; streak gift boxes at 7/14/21/30/45/60/75/90/120/150/180/365 days.
- **Hero choice**: Hunter (`m`) or Huntress (`f`, long hair, flared battle-dress, star clip, feminine German form names via `form(i)`). Picked once after login (`heroPickView`), changeable on the course picker chip and in Settings. Stored in `settings.hero` + `localStorage a1.hero.<user>` (copied into other courses).
- **Hero**: original "Quill Sentinel" (faceted figure, quill-staff, rune circle) with 6 forms by rank: Novice/Initiate/Adept/Seeker/Vanguard/Sovereign, each with a German name and meaning (shown when the form evolves).

## State (2026-11-15)
- All of the above works; tested via puppeteer on the 8899 test server.
- FastAPI server built and tested (API diff vs server.py identical; full lesson in headless Chrome OK). server.py is still the one running on 8765.
- Real profiles: Taha (fresh, reset 14 Nov; old file in backups), Batul. Demo profiles 1–5 still present.
- Demo deck (Slides artifact): https://claude.ai/artifact/3yvVK1M9tscXwQdgLz1Ewn (13 slides, Hunter style, level-100 version; still shows the OLD hooded hero and the "Deutsch A1" name).

## Pending / ideas
- TODO (user, 11-15): **push notifications / reminders** (later). PWA route: Web Push + service worker for daily review/streak reminders — needs HTTPS and a small push server (schedule sends server-side; no true exact alarm when app is closed). APK route (Capacitor): Local Notifications plugin = real scheduled local alarms/reminders, work offline & app-closed, no server; exact timing on Android 12+ needs SCHEDULE_EXACT_ALARM/USE_EXACT_ALARM. Do after logins + HTTPS.
- UX from alpha test (11-15, 4 persona subagents → report https://claude.ai/artifact/Fh74AhsjVcJH8J17eX8bAb). Quick wins — DONE 11-15 (branch alpha-fixes): 💬 "Feedback" tab; warmer fail screen (celebrates right answers); plainer words ("Review … to remember"); chip-wrap; download "reading files" (12-vs-13 reconciled); brighter pulsing Start in Hunter themes; XP sheet trimmed to big numbers + "How XP works ›". Medium: onboarding leads with "Create profile" (demos behind a link) + Playful/Plain theme toggle + light theme; hero/aura visible & reactive on Today; diamonds purpose/shop + gift rarity; real review-summary screen; honest weekly gates; verify reward-modal-over-reviews + wrong streak (may be seed). Core: tune SR (learning steps, per-card ease, reachable Mastered); reconcile progress ETA/pace math + retention %; rebalance early path off numbers + noun gender/plural; build SE-track exercises & gate "Learned" on them; even card density + mobile code/table + search/bookmarks.
- TODO (user, 11-15): write the **Networking & HTTPS** learning track (placeholder branch `net` in se-path.json): HTTPS & certificates, CAs / Let's Encrypt / mkcert, DNS & local names, VPNs / WireGuard / Tailscale, local vs public hosting. Same pipeline: content/se/net/NN.md → build_se_content.py → nodes in se-path.json.
- SE path exercises: build the plan (concept check, myth/fact, match, order the flow, fill the code, spot the bug, fix the code, attack↔defence, scenario, design decision, threat-model, capstone review) as JSON items per node + new step renderers; then fill the other 7 branches.
- Login system (not built): options explained 11-15 (local username+password/PIN in server.py vs Google via a hosted HTTPS auth service). Awaiting the user's choice.
- Add a real second course (needs a content format per course type; e.g. maths/data science = concept + quiz items).
- Decide whether XP/streak/diamonds should be global per learner (currently per course).
- Remove demo profiles when the user is done (restore `progress/backups/users-before-demos.json` or drop `demo:true` users and their files).
- Update the deck screenshots: new hero forms, Settings tab, auto goal, Rankwise icon (deck text is already renamed).
- 🎤 "Speak it" pronunciation exercise (needs HTTPS or the Chrome insecure-origin flag; see README "Later").
- Before selling: Goethe word-list licence, edge-tts is not licensed for commercial use, keep Solo Leveling out of marketing.

## Decisions & gotchas
- Phone times out on the LAN but the internet works → Android 16 local-network permission: Settings › Apps › Chrome › Permissions › **Nearby devices = Allow** (fixed Taha's Nothing Phone 3).
- No copyrighted characters or art (user asked for Jinwoo; declined, built an original hero instead).
- The "Hallo/Guten Tag" class of bug = overlapping meanings → always run new exercise types through `overlaps()`.
- Enter in typed inputs must `preventDefault` (otherwise it skips the feedback screen).
- A gradient on a perfectly flat or vertical SVG line renders nothing → use a solid colour.
- After changing the level scale, set `lvScale` so users don't get a false level-down.
- Service worker cache name `a1-shell-vN` in `app/sw.js`: bump it when shell files change (only matters over HTTPS).

## Changelog (newest first, one line per session)
- 11-15: git repo init + initial commit; alpha-test Quick Wins implemented on branch alpha-fixes (feedback tab, warmer fail screen, plainer words, simpler XP sheet, brighter Start, chip wrap).
- 11-15: logged push-notifications/reminders as a later todo (PWA web-push vs Capacitor local alarms).
- 11-15: alpha test — 4 persona subagents (beginner/kid/serious/SE) reviewed recorded sessions; feedback report + prioritised fixes in a Claude doc.
- 11-15: Batul's 2 reports fixed: 60% pass mark per lesson part (no level-up on a failed part), guided step for long phrases, tap guard + labelled answer box in reviews.
- 11-15: SE reading split per chapter and downloaded on demand (not bundled/precached), download/remove per branch; guide saved locally in docs/guides/. SW v8.
- 11-15: bug #1 fixed: auth guide now readable in-app as 416 bite-sized cards (replaces private claude.ai link); SW cache v7.
- 11-15: stopped the old server.py on 8765; FastAPI on 8766 is the only live server.
- 11-15: 🐞 bug report button on all screens with screen snapshot, saved via FastAPI `/api/bugs` (queued on the phone when offline). SW cache v6.
- 11-15: Software Engineering skill-tree course with the Authentication branch (12 skills from the auth guide).
- 11-15: hero faces redesigned (skin face, eyes/brows/mouth, glowing eyes from Seeker instead of a visor); Hunter swept spiky hair, Huntress side-parted fringe + framing strands. Old version: scratchpad hero_v3_before_faces.js.
- 11-15: Huntress hero variant + hero choice at login (picker screen, course-picker chip, Settings).
- 11-15: new exercise "Say it in German" (phrase bubbles → mixed with full typing as the learner improves).
- 11-15: solved the second-phone issue (Chrome lacked Android's Nearby devices / local network permission).
- 11-15: "Coming Soon" on both sides of the course picker; the ⚡/💎 chip sheet is now "XP & Diamonds" (total, today vs goal, last 7 days, "How you earn / lose XP" tables, link to How XP works).
- 11-15: added `server_fastapi/` (uv, FastAPI 0.128): same behaviour as server.py plus docs, validation, write locks, gzip, audio caching, health/backup endpoints.
- 11-15: renamed to **Rankwise** (title/manifest/player screen/deck text), new chevron icon set (icons/icon.svg, -maskable, 192/512/apple-touch), course-aware quest text.
- 11-15: multi-course structure (courses.json, picker homepage, course chip, per-course progress/API), name ideas.
- 11-15: started this log plus CLAUDE.md pointer.
- 11-14: themes Mid/Simple/Calm, lesson icons, level 100 = A1 plus post-A1 levels, particles layer, hero redesign → Quill Sentinel with 6 forms (German names), cape fix, Settings tab, Monday weeks from pace, auto daily goal, diamonds/gift boxes, bits plus sentence exercises, exercise audit (meaning overlap), audio lag fix, SM-2 reviews plus penalties, profiles taha/batul, sales deck, icon concepts.
- 11-13: first build: data export, audio, PWA, path/lessons/reviews/progress/pace, server-side progress.

# Project log – LevelUp (multi-course learning app; German A1 live)

Read this first. Open code only for the part you're changing. Update **State**, **Pending** and **Changelog** at the end of each session (keep it short).

## What it is
Mobile web app (plain JS PWA, no build step), now **multi-course**: German A1 is live; Spanish, French, Data Science, Python and Maths are "coming soon" placeholders. Two learners (Taha, Batul) use it in Android Chrome over home Wi-Fi.
Content comes from `../German Learning/legacy/Data/Iteration_v3/_source` (the books): 821 words in 63 lessons, 20 grammar chapters, 14 phrase topics (97 path items).

## Run
- **One uv env for everything** (from 11-16): repo-root `pyproject.toml` / `uv.lock` / `.python-version`, env `.venv/` (`uv sync`). Deps: fastapi, uvicorn, edge-tts. **Pinned to 3.9 (Apple's) for now**; 3.13 tested OK, switch = `echo 3.13 > .python-version && uv sync` + firewall.
- **Live server = FastAPI on 8766** (`cd LevelUp/server_fastapi && nohup uv run main.py 8766 >> ~/Library/Logs/levelup-server.log 2>&1 &`). The old `server.py` (8765, `uv run server.py`) is kept but no longer run.
- **Dev droplet (DigitalOcean, Ubuntu 26.04)**: https://dev.level-up.com.de (Caddy → 127.0.0.1:8000; raw http://168.144.78.71:8000 still open), `ssh levelup-droplet` (user mazhar, agent forwarding) → `levelup-deploy` to pull + restart. systemd `levelup` (restart on crash), data in `~/levelup-data` (copied from Mac `progress/` 11-18; the two now diverge). Setup = `deploy/cloud-init.yaml` (paste as user data; must stay pure ASCII). Root SSH login off.
  On 3.13 the Mac firewall must allow `~/.local/share/uv/python/cpython-3.13-macos-aarch64-none/bin/python3.13`, else phones can't connect (Apple's 3.9 is already allowed).
- **FastAPI alternative** (same app/API/files, plus docs, gzip, locks, backups API): `cd server_fastapi && uv run main.py` → port 8766 (`/docs`). See `server_fastapi/README.md`.
- Test server with scratch data (never touch real progress): `A1_DATA=<tmpdir> uv run server.py 8899`.
- Rebuild content: `uv run tools/export_data.py`; audio: `uv run tools/fetch_audio.py` (edge-tts, de-DE-KatjaNeural, only fetches missing clips).
- UI testing: headless Chrome via puppeteer-core in the session scratchpad (the Chrome extension can't open localhost).

## Map
- `server_fastapi/main.py`: FastAPI twin of server.py (uses the repo-root uv env). Extras: `/api/health`, `/api/backups/{id}[/{day}]`.
- **SE reading (on demand, not bundled)**: source `content/se/<branch>/NN.md` (full guide also saved as `docs/guides/authentication-guide.md`). `uv run tools/build_se_content.py` → one small file per chapter `app/data/se/<branch>/NN.json` (~60–150-word cards) + `index.json` (sizes). The app fetches a chapter only when a skill is opened; never precached. Over HTTPS the SW keeps downloads in cache `a1-content-v1` (stale-while-revalidate, offline OK); branch card shows "On this phone: x/13 · Download all · Remove". Over plain HTTP (today) there's no SW/CacheStorage, so chapters stream from the Mac each time. Reader `openReader()`: Back/Next, swipe, resume (`S.read`), last card = skill learned.
- **New skill trees**: use the project skill `.claude/skills/levelup-skill-tree` (in this repo) (split_doc.py → build → add_branch.py with `content/se/<branch>/_tree.json` → tree_check.mjs on 8899).
- **Bug reports**: 🐞 tab on every screen (`app/js/bugreport.js`) snapshots page, user, course, lesson step (`lessonDebug()`), screen text + HTML, recent JS errors, then POSTs to `/api/bugs` (FastAPI; when opened from another local port, e.g. 8765, the client posts to :8766 and FastAPI allows it via CORS) → `progress/bugs/<id>.json`; `GET /api/bugs` lists them. Offline/unreachable → queued in localStorage `a1.bugQueue`, flushed later. To review: read the JSON files (render `screenHtml` with the app CSS to see the screen).
- `server.py`: static files plus `/api/users`, `/api/states`, `GET/PUT /api/state/<id>`. Writes `progress/<id>.json` with a daily backup in `progress/backups/`. Rejects stale writes (409).
- `progress/users.json`: learners `{id,name,color,demo?}`. Real ids: `taha`, `batul`. Demo profiles `demo1..5` (flag `demo:true`, hidden from the comparison) are temporary.
- `app/js/store.js`: state, sync, SRS (SM-2), progress/A1 %, memory decay, penalties, level/rank, diamonds/gifts, lesson bits, week plan, auto daily goal.
- `app/js/lesson.js`: exercise engine (all step types), review recall, finish screen (XP/combo/cheers/level-up/evolution card).
- `app/js/app.js`: router and views: who/setup, Today, Path, Lessons, Words, Progress, Settings, grammar reader, sheets, treasure.
- `app/js/hero.js`: aura (0→1 by level), particles layer `#aura-fx`, hero SVG (6 forms), custom avatar images via `app/avatars/manifest.json`.
- `app/js/audio.js`: mp3 clips `app/audio/<sha1-12>.mp3` with a speechSynthesis fallback (token guard against stale clips).
- `app/styles.css`: base plus themes `theme-sl` (Hunter), `theme-sl3` (Mid), `theme-sl2` (Simple), `theme-calm`, `theme-ez` (Eurozeit partner theme = `theme-calm theme-ez`, block at the end of the file), classic (no class).
- `tools/export_data.py` → `app/data/content.json` plus `tools/audio_manifest.json` (2,720 clips).
- `app/data/courses.json`: course registry `{id,title,subtitle,group,icon,color,status:ready|soon,type,content}`. German = `de-a1` → `data/content.json`.
- **Software Engineering** course (`se-path`, `type: "tree"`, `data/se-path.json`): skill tree with 13 branches; open: **CI/CD for ML** (`cicd`, 20 skills, 489 cards, verbatim from the user's book `cicd-tutorial/` (Typst) via `_group.py` + skill's `typ2md.py`, 23 SVG diagrams in `img/`), Authentication (12 skills), **systemd & Supervisor** (`sysd`, 12 skills, guide https://claude.ai/artifact/Kmo2TaSfYLU5okPVFTJE5p), **JWT for AI Services** (`jwt`, 6 skills from the user's Claude Doc https://claude.ai/artifact/CXX4eW3WeMusVNNskWp5Qy; doc's sections 7–12 not written yet) and **AWS ML Engineer** (`awsml`, 14 skills + About; AIF-C01 → MLA-C02 cert track, chapters in content/se/awsml/, full plan/labs in the Claude doc https://claude.ai/artifact/Th9jtKUAgCeEFsYUdMBHEP). Prerequisites per node; boss node last. **Parts**: every skill is split into 3–4 sub-topics at `###` sections by build_se_content.py (`parts` [{t,a,b}] in chapter JSON and on each node in se-path.json); segmented ring in the tree, part list in the sheet, reader goes part by part; progress in `S.parts[node][k]`; skill learned (+15 XP) when all parts are done. **Navigation**: `#/home` = `seHome()` (Continue card from `S.lastRead` + grid of open branches with progress rings + coming-soon tags → planned-skills sheet); `#/branch/<id>` = `treeView(id)` (‹ All branches, ‹ › arrows/dots/swipe between open branches, layout toggle **Map** (`treeOrbit`: skills orbit the branch core on an oval, in skill order) / **Path** (`treeSVG`, exact prereq edges), saved in localStorage `a1.treeLayout`). `nodeSheet()` in app.js; progress in `S.tree` (node → date), +15 XP per skill; "Mark as learned" for now (exercises planned, not built). Language views are bypassed for tree courses.
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

## State (2026-11-19)
- **Quest Mode** (Settings, per learner per course, `settings.quest`, default on). Off = language skill map like the SE track (`skillMapView`/`skillSheet`/`freeToday` in app.js; Path tab becomes 🧩 Skills; skills = vocab topics, grammar chapters, phrase topics; rings by parts); no daily goal, quests, diamonds or missed-review penalties (`checkMissed` skips, `penChecked` reset when turned back on). XP, level, reviews unchanged.
- **Grammar parts**: `splitGrammar()` (store.js, at load) cuts chapters with ≥900 chars of text at headings, big tables by rows (parts ≈250–700 chars); questions go to the part whose text contains their answer/options. 7 chapters split (g1, g5, g6, g8, g10, g16, g20 → 2–3 parts), each part its own path item `g1.1`…; parts with no question = "Done reading ✓" (+5 XP). Old `done.g1` → all parts done (normalize). **Spread**: `spreadPath()` reorders so no topic repeats within 2 items and a chapter's parts are ≥4 apart (look-ahead 8); vocab lessons renumbered. SW v17. Tested on 8899 with a copy of real progress (no JS errors, no sideways scroll at 360 px).
- App icon = progress-ring design (chevrons inside an 80 % ring, star at its tip), all art inside the maskable safe zone so round launchers don't clip it. Sources `app/icons/icon.svg` (rounded) + `icon-maskable.svg` (full bleed); PNGs rendered with headless Chrome at 512 px, then `sips` down to 192/180 (Chrome can't screenshot windows under ~500 px wide).
- Feedback fixed (4 reports → status fixed): Fill-the-gap English line same size as German; tap a German word in Fill-the-gap / Complete-the-sentence to see its meaning (`glossOf()` in lesson.js: word list + FORMS for ist/den/zum…, simple ending stripping, Ihr*/Sie mid-sentence = formal); Herzlich willkommen = "A warm (hearty) welcome!" + new phrase "Willkommen!" (source edits in legacy/Data …/build/phrases.py, work/v1_entries.json, work/sup2.txt; audio fetched).
- Folder renamed A1-App → **LevelUp**; Data/Job Hunting/learning/linkedin_jobs moved to `../legacy/` (export_data.py now reads `../legacy/Data`); `legacy/` in .gitignore. Live FastAPI must be restarted from the new path.
- CI/CD for ML branch (20 skills) + builder: images (`![cap](img/x.svg)`) and code inside bold; map side labels wrap to 3 lines. All 5 open branches pass tree_check on 8899; SW v11.
- SE course home + branch map live (A+C home, B-style orbit inside a branch, Path toggle); tree_check also checks home cards, Continue card, layout toggle and arrows; all 4 branches pass on 8899; SW v10. Design options PDF: docs/design/branch-picker.pdf.
- Skill parts live: 44 skills split into 3–4 parts (27×3, 17×4); tree_check covers parts; SW cache v9. Old progress still valid (done skills = full ring; reading positions kept).
- systemd & Supervisor branch (doc written first, then tree); 4 open branches pass tree_check. add_branch.py now refuses crossing edges / col 0↔2 jumps and keeps key order on --update.
- JWT branch added + levelup-skill-tree skill; all 3 open branches pass tree_check on 8899. AWS node renamed "GenAI & FM basics" (old title was cut off).
- AWS ML Engineer branch added (uncommitted, on branch alpha-fixes); tested on 8899: tree, node sheet, reader, finish → next skill unlocks, About, all 15 chapters load.
- All of the above works; tested via puppeteer on the 8899 test server.
- FastAPI server built and tested (API diff vs server.py identical; full lesson in headless Chrome OK). server.py is still the one running on 8765.
- Real profiles: Taha (fresh, reset 14 Nov; old file in backups), Batul, Yusuf (droplet only, added 11-18). Demos 1–5 removed on the droplet, still on the Mac.
- Demo deck (Slides artifact): https://claude.ai/artifact/3yvVK1M9tscXwQdgLz1Ewn (13 slides, Hunter style, level-100 version; still shows the OLD hooded hero and the "Deutsch A1" name).

## Pending / ideas
- Domain/HTTPS — DONE 11-19: `level-up.com.de` (Cloudflare registrar + DNS). `dev` A record DNS-only → droplet; apex proxied (orange) → Caddy redirects to dev until a main copy exists. Caddy 2.11 (official apt repo) + Let's Encrypt, config `deploy/Caddyfile` (installed by `levelup-deploy` when changed). Still to decide: close ports 8000–8100 (apps bound to 127.0.0.1), set Cloudflare SSL to Full (strict), confirm domain auto-renew. Avoid ports <1024, 32768–60999 and common defaults for new apps; new app = Caddyfile block + DNS record.
- TODO (user, 11-18, later): **two droplet instances**: `dev` = manual pulls via SSH agent forwarding (current `deploy/cloud-init.yaml`, `levelup-deploy`, port 8000); `main` = automatic deploys (GitHub Actions SSH → pull + restart, so the droplet holds no GitHub creds; or a read-only deploy key). Each needs its own port/subdomain, service name and `A1_DATA` folder.
- Python 3.13 switch (on hold, 11-16: user can't change the firewall yet): set `.python-version` to 3.13 + `uv sync`, allow the 3.13 Python in the Mac firewall, restart 8766, check a phone connects. main.py keeps `Optional[...]` (3.9 can't evaluate `X | None`); switch to `X | None` after the move.
- TODO (user, 11-15): **push notifications / reminders** (later). PWA route: Web Push + service worker for daily review/streak reminders — needs HTTPS and a small push server (schedule sends server-side; no true exact alarm when app is closed). APK route (Capacitor): Local Notifications plugin = real scheduled local alarms/reminders, work offline & app-closed, no server; exact timing on Android 12+ needs SCHEDULE_EXACT_ALARM/USE_EXACT_ALARM. Do after logins + HTTPS.
- UX from alpha test (11-15, 4 persona subagents → report https://claude.ai/artifact/Fh74AhsjVcJH8J17eX8bAb). Quick wins — DONE 11-15 (branch alpha-fixes): 💬 "Feedback" tab (button reverted to the original 🐞 on user request; dialog text still says "Send feedback"); warmer fail screen (celebrates right answers); plainer words ("Review … to remember"); chip-wrap; download "reading files" (12-vs-13 reconciled); brighter pulsing Start in Hunter themes; XP sheet trimmed to big numbers + "How XP works ›". Medium: onboarding leads with "Create profile" (demos behind a link) + Playful/Plain theme toggle + light theme; hero/aura visible & reactive on Today; diamonds purpose/shop + gift rarity; real review-summary screen; honest weekly gates; verify reward-modal-over-reviews + wrong streak (may be seed). Core: tune SR (learning steps, per-card ease, reachable Mastered); reconcile progress ETA/pace math + retention %; rebalance early path off numbers + noun gender/plural; build SE-track exercises & gate "Learned" on them; even card density + mobile code/table + search/bookmarks.
- TODO (user, 11-15): write the **Networking & HTTPS** learning track (placeholder branch `net` in se-path.json): HTTPS & certificates, CAs / Let's Encrypt / mkcert, DNS & local names, VPNs / WireGuard / Tailscale, local vs public hosting. Same pipeline: content/se/net/NN.md → build_se_content.py → nodes in se-path.json.
- SE path exercises: build the plan (concept check, myth/fact, match, order the flow, fill the code, spot the bug, fix the code, attack↔defence, scenario, design decision, threat-model, capstone review) as JSON items per node + new step renderers; then fill the other 7 branches.
- Login system (not built): options explained 11-15 (local username+password/PIN in server.py vs Google via a hosted HTTPS auth service). Awaiting the user's choice.
- Add a real second course (needs a content format per course type; e.g. maths/data science = concept + quiz items).
- Decide whether XP/streak/diamonds should be global per learner (currently per course).
- Demo profiles: removed on the droplet 11-18 (files in `~/levelup-data/backups/demos-removed-2026-11-18/`, Yusuf added); still on the Mac `progress/`.
- Update the deck screenshots: new hero forms, Settings tab, auto goal, LevelUp icon (deck text is already renamed).
- 🎤 "Speak it" pronunciation exercise (needs HTTPS or the Chrome insecure-origin flag; see README "Later").
- Before selling: Goethe word-list licence, edge-tts is not licensed for commercial use, keep Solo Leveling out of marketing.

## Decisions & gotchas
- Server paths (APP, progress) are fixed when it starts: after moving or renaming the repo, restart the server, or it keeps using (and recreating) the old folder.
- Phone times out on the LAN but the internet works → Android 16 local-network permission: Settings › Apps › Chrome › Permissions › **Nearby devices = Allow** (fixed Taha's Nothing Phone 3).
- No copyrighted characters or art (user asked for Jinwoo; declined, built an original hero instead).
- The "Hallo/Guten Tag" class of bug = overlapping meanings → always run new exercise types through `overlaps()`.
- Enter in typed inputs must `preventDefault` (otherwise it skips the feedback screen).
- A gradient on a perfectly flat or vertical SVG line renders nothing → use a solid colour.
- After changing the level scale, set `lvScale` so users don't get a false level-down.
- Service worker cache name `a1-shell-vN` in `app/sw.js`: bump it when shell files change (only matters over HTTPS).

## Changelog (newest first, one line per session)
- 11-19: Quest Mode switch (off = skill map like SE), long grammar chapters split into parts, path spread so topics don't repeat back-to-back. Not yet deployed to the droplet.
- 11-18: repo pushed to personal GitHub (mazharsaif/LevelUp, private, `github-personal` SSH alias); dev droplet live via `deploy/cloud-init.yaml` (gotcha: pbcopy mangled non-ASCII → cloud-init skipped the file; DO root key needed PermitRootLogin no).
- 11-18: new app icon (progress ring, circle-safe; picked from 4 options https://claude.ai/artifact/E6mHhZZ5epmLyB8Q9EQvLj). SW shell v16.
- 11-18: renamed the app **Rankwise → LevelUp** everywhere (UI, manifest, server, docs, guides' example names, skill `levelup-skill-tree`, uv project); older changelog lines keep the old name. SW shell v15.
- 11-17: no sideways scrolling on phones (checked 360/412/560 px × 6 themes × 6 screens): top row name chip ends in … and course chip is flag-only under 460 px, compact ⚡/💎 chip under 430 px; Words/Lessons filter bars scroll again (tree Map/Path switch renamed `.seg` → `.segt`, it had overridden them); long names wrap on Progress; Calm/Eurozeit path labels fit. SW shell v14.
- 11-17: 🎓 Eurozeit theme (partner look after knowledgecenter.eurozeitglobal.com: navy #00339b, green #3ab500, gold #ffb606, grey #f1f2f8, Urbanist font; light only; built on Calm). SW shell v13.
- 11-17: live 8766 server was still using the pre-move path (`German Learning/Rankwise/progress`, recreated empty → phones saw no progress; nothing lost). Restarted from `Rankwise/server_fastapi` (log `~/Library/Logs/rankwise-server.log`), stray folder removed. Gotcha: restart the server after moving the repo.
- 11-16: one repo-root uv project (fastapi, uvicorn, edge-tts) replaces `server_fastapi`'s project and `tools/.venv`; 3.13 tested OK but pinned back to 3.9 until the firewall can allow it; docs/run commands now `uv run …`.
- 11-16: repo moved to `Personal Projects/Rankwise` (sibling of German Learning; export_data.py and cicd `_group.py` point at `../German Learning/`); workspace = repo: CLAUDE.md and `.claude/` (settings, rankwise-skill-tree skill) moved into Rankwise/; skill and cicd `_group.py` paths made repo-relative; `.claude/settings.local.json` ignored.
- 11-16: feedback fixes: equal-size cloze translation, tap-for-meaning on German words, warm/hearty welcome wording + plain Willkommen phrase.
- 11-16: renamed to Rankwise/, legacy/ folder; CI/CD for ML branch (20 skills, 489 cards, diagrams) from the user's Typst book.
- 11-16: SE navigation redesign: course home (Continue + branch cards), branch view with orbit map / path toggle and swipe between branches; options deck PDF.
- 11-16: skills split into 3–4 parts (segmented ring, part list, part-by-part reader); build + add_branch + tree_check updated.
- 11-16: systemd & Supervisor guide (Claude Doc, 12 chapters + labs + final quiz) and its 12-skill branch (151 cards); skill-tree validator learned edge checks.
- 11-16: JWT for AI Services branch (6 skills, 92 cards, verbatim from the user's doc) + reusable rankwise-skill-tree skill (split/add/check scripts, per-branch _tree.json).
- 11-15: bug button back to the original 🐞 icon (as on main).
- 11-15: new SE branch **AWS ML Engineer** (14 skills: AIF-C01 then MLA-C02; 136 reading cards with labs + self-checks).
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

# LevelUp

LevelUp is a learning app you can play like a game. It has short lessons, spaced-repetition reviews, XP, levels, ranks, streaks and daily quests. It runs in any modern browser and can be installed on a phone.

**Use it at https://levelrise.org.** Sign up, or try it first as a guest (guest progress stays on that device until you sign up).

## Courses
| Course | What's inside |
|---|---|
| 🇩🇪 **German A1** | Goethe A1 level: 821 words in 63 lessons, 20 grammar chapters and 14 phrase topics, with audio for every word, example and phrase |
| 🇫🇷 **French A1** | DELF A1 level: 897 words, 23 grammar chapters and 16 phrase topics, with audio |
| 🛠️ **Software Engineering** | A skill tree with these branches: CI/CD for ML, Authentication, JWT for AI services, systemd & Supervisor, Networking & HTTPS, SSH keys & deploys, and AWS ML Engineer |
| ➗ **Mathematics** | A skill tree with these branches: Foundations, Algebra & Matrices, Calculus for Economics, Probability & Statistics, and Monte Carlo Simulations, with practice questions and concept checks |
| ⚔️ **Hunter's Path** | Personal quests for habits, quitting something, weekly targets and big goals, played as ranked "gates" (E 7 days … S 180 days) with shields, cracks and party runs |

Spanish, Data Science and Python are listed as "coming soon".

## How it works
- **Language courses**: each lesson is split into short parts. You meet new words on cards with audio, then practise them with multiple choice, listening, der/die/das (or le/la), typing, pair matching, sentence building, "Say it" phrases and 🎤 *Speak it* (speech recognition). Typing is lenient: `ae` counts as `ä`, and one-letter typos and missing French accents are accepted. A part counts as done at 60 % first-try accuracy.
- **Reviews**: spaced repetition (SM-2). Words you don't review fade over time, so your level can drop as well as rise.
- **Skill trees**: each skill is split into 3–4 short reading parts, followed by practice questions. A skill unlocks once its prerequisites are done, and each branch ends with a boss skill.
- **Progress**: XP, level 1–100 (level 100 = A1 reached), ranks E → S, daily XP goal, streak, diamonds 💎 and gift boxes. You can set a target date, and the app shows your pace against it with a projected finish date.
- **Quest Mode** (on by default) adds daily goals, quests, diamonds and penalties for missed reviews. If you switch it off, a course becomes a plain skill map that you can learn at your own pace.
- **Party**: compare progress with other learners and run Hunter's Path gates as a team (if one member fails, the whole team fails), with nudges.
- **Help in the app**: the welcome tour and the "How LevelUp works" guide (Settings → About), a text-size button (Aa), light and dark themes, and a 🐞 button on every screen to send feedback.

## Install on your phone
- **Android**: download the LevelUp app from the banner or Settings at levelrise.org (`/download/levelup-native.apk`), then allow installs from your browser. It shows the same app and adds home-screen widgets, reminders and nudge notifications. When a new version is out, the app offers the update.
- **iPhone**: open levelrise.org in Safari, then tap Share → **Add to Home Screen**. There is a step-by-step guide at `/download/levelup-iphone-guide.pdf`.
- **Any browser**: Chrome and Edge can also install the site as an app (menu → Install). Once installed, it works offline after the first visit.

## Your data
- Progress is saved on the server for each learner and course, and a copy is kept on the device. If you study offline, the app syncs the next time you open it. When two devices both changed something, the app merges the changes instead of dropping one side.
- Passwords are stored only as salted PBKDF2 hashes, and a learner can read and write only their own progress. Your name and progress do show up in the Party comparison to other logged-in learners.
- No e-mail address is stored. "Forgot password" sends a reset request to the admin.
- Settings → Export/Import makes or restores a backup file. The server also keeps one backup per learner per day.

---

## For developers

The app is plain JavaScript with no build step (`app/`). The server is FastAPI (`server_fastapi/`), and the Python tools generate the course content and audio (`tools/`). One uv environment covers everything (Python 3.13, `pyproject.toml` + `uv.lock` in the repo root, run `uv sync`).

### Run locally
```sh
uv sync
cd server_fastapi
A1_DATA=/tmp/lu-test uv run main.py 8899            # http://localhost:8899, API docs at /docs
A1_DATA=/tmp/lu-test LU_PASSWORD=secret uv run python auth.py <user>   # set a password
```
- `A1_DATA` is the data folder (users, logins, progress, backups, bug reports). It defaults to `progress/`, which is git-ignored. Use a scratch folder for local trials.
- **There is one real environment: the live site.** Testing happens there with developer accounts (usernames start with `_`, e.g. `_test_user1`). Sign-up refuses `_` names; the accounts are created from code and hidden from other learners. See "Developer accounts" below.
- `LU_MASTER_PASSWORD=admin` lets any existing username log in with `admin` (for testing only; it is off when the variable is unset).
- `LEVELUP_HOST=127.0.0.1` binds to loopback only (use this behind a reverse proxy).
- **Audio is not in git** (about 48 MB). Run `uv run tools/fetch_audio.py` (German) and `uv run tools/fetch_audio.py --lang fr` (French) to fetch it. Without audio the app falls back to the browser's speech voice.
- Installing the app, offline caching and the microphone all need HTTPS (or localhost).
- The old stdlib `server.py` still works but has no logins. With it, the app falls back to a player picker.

### Layout
```
app/                 the web app (served as is)
  index.html, js/, styles.css, sw.js     shell; bump the cache name in sw.js when shell files change
  data/courses.json  course registry (id, title, type: language | tree | life, content file)
  data/*.json        generated course content (German, French, SE + maths trees, Hunter's Path)
  audio/             generated mp3 clips (git-ignored)
  download/          Android APK + native.json (latest version), iPhone guide
server_fastapi/      FastAPI server (main.py) and accounts (auth.py)
content/             hand-written sources: fr-a1/, se/<branch>/, math/<branch>/, stories/
tools/               content builders, audio fetcher, Android build scripts, feedback.sh
native/              Android app (WebView shell + widgets, reminders, speech bridge), see native/README.md
deploy/              Caddyfile and cloud-init for the server
docs/                guides, design notes, reviews, French plan
```

### Content
| Task | Command |
|---|---|
| German (from the A1 source books in `../German Learning/legacy/`) | `uv run tools/export_data.py` |
| French (from `content/fr-a1/`) | `uv run tools/build_fr_content.py` (`--check` validates only) |
| SE / maths skill trees | `uv run tools/build_se_content.py` (`--tree math` for maths) |
| Audio (edge-tts; only fetches missing clips) | `uv run tools/fetch_audio.py [--lang fr]` |

New skill-tree branches are added with the `levelup-skill-tree` Claude Code skill (`.claude/skills/`). To add a course, add an entry to `app/data/courses.json` plus its content file.

The audio comes from edge-tts, which is meant for personal use. Before any commercial use, regenerate it with `--engine azure` (needs a licensed Azure Speech key), and check the rights to the Goethe A1 word list.

### Android app
`tools/android/build_native.sh` builds and signs `app/download/levelup-native.apk` and writes `native.json`. The signing key lives outside the repo; without it, updates won't install over the existing app. See `native/README.md`.

### Deploy
The live site runs on a small Ubuntu server: Caddy (automatic HTTPS) → the app on `127.0.0.1:8000` (systemd unit `levelup`). To deploy, push to GitHub, then run `ssh levelup-droplet levelup-deploy` (git pull, `uv sync`, Caddyfile update, restart). Audio is synced separately with `rsync -az app/audio/ levelup-droplet:LevelUp/app/audio/`. To set up a new server, use `deploy/cloud-init.yaml` (it must stay pure ASCII). Every deploy is tagged `vYYYY.MM.DD.NN` (`tools/next_version.sh`), and `/api/health` reports the version.

Project history, current state and open items are in `PROJECT_LOG.md`.

### Developer accounts (testing on live)
We run a single environment, so testing happens on the live site with accounts that real learners can't create or see.
```sh
# on the droplet, in the repo, with the live data folder
A1_DATA=~/levelup-data uv run python server_fastapi/devaccounts.py create 3            # _test_user1.._test_user3, random passwords printed once
A1_DATA=~/levelup-data uv run python server_fastapi/devaccounts.py nudge _test_user1 mazhar   # a test notification
```
- Usernames starting with `_` cannot be signed up (server + app both refuse), so only this script makes them.
- `/api/users` hides them from ordinary learners; other `_` accounts still see them.
- Test nudges reach the native app's notification within about 15 minutes (it polls in the background).
- Why one environment: `docs/guides/single-environment.md`.

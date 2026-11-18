# LevelUp – mobile learning app (German A1 first)

A small, installable web app (PWA) for mobile Chrome built from the Iteration_v3 books
(`Data/Iteration_v3/_source`): 821 words in the books' 63 daily batches, 20 grammar chapters
with practice questions, and 14 phrase topics, in the same order as the 84-day roadmap.

## What's inside
- **Today** – daily XP goal ring, streak, next lesson, due reviews, A1 % vs expected, and the book plan for today.
- **Path** – every lesson (🔤 vocabulary · 📐 grammar · 💬 phrases) grouped by week. All lessons are open, and any of them can be marked as already known.
- **Lessons** – new-word cards with audio, gender colours, plural/verb forms, examples and Hindi hints, followed by
  multiple choice, listening, der/die/das, typing (lenient: `ae`=`ä`, one-letter typos) and pair matching. Missed items come back at the end.
- **Reviews** – spaced repetition (Leitner boxes: 1 → 3 → 7 → 14 → 30 → 60 → 120 days).
- **Progress** – A1 % = vocabulary 55 % (by words) + grammar 30 % + phrases 15 %. You can set a target date, see expected vs actual pace on a chart,
  the lessons/week needed, your 14-day pace and a projected finish date. Also: memory stats, settings, offline audio download, and backup export/import.

**Two learners (Taha, Batul).** The app opens on a "Wer lernt heute?" picker. You can switch with the name chip at the top of Today/Progress.
A "Taha & Batul" card compares XP today, total XP, streak, lessons done, words learned, A1 % and pace.

**Progress is saved on the Mac** by `server.py` in `progress/<user>.json`, with one backup per user per day in `progress/backups/`.
The phone keeps a cached copy, so a lesson finished while the Mac is off syncs the next time the app is opened.
To rename users or add one, edit `progress/users.json`.

## Layout
```
app/            static site – deploy this folder as is
  data/content.json   generated lesson data
  audio/*.mp3         generated pronunciation clips (one per word / example / phrase)
tools/
  export_data.py      books → app/data/content.json + tools/audio_manifest.json
  fetch_audio.py      downloads the audio (edge-tts, voice de-DE-KatjaNeural); safe to re-run
```

## Rebuild after changing the books
```sh
uv run tools/export_data.py
uv run tools/fetch_audio.py      # only fetches clips that are missing
```
One uv environment for everything: Python 3.9 for now (Apple's, which the firewall allows; 3.13 tested and ready), `pyproject.toml` + `uv.lock` in the repo root, env in `.venv/` (`uv sync` recreates it).

## Run
```sh
cd server_fastapi && uv run main.py      # live server, port 8766 (old stdlib one: uv run server.py → 8765)
```
Open http://localhost:8766 on the Mac, or `http://<mac-ip>:8766` on a phone on the same Wi-Fi.
To move to 3.13: `echo 3.13 > .python-version && uv sync`, then allow `~/.local/share/uv/python/cpython-3.13-macos-aarch64-none/bin/python3.13` in System Settings › Network › Firewall, or phones can't connect.
Over plain-HTTP Wi-Fi the browser can't install the app or cache audio for offline use (both need HTTPS). Saving progress works without HTTPS.

## Later / to-do
- **🎤 "Speak it" pronunciation exercise** (Chrome Web Speech API, `de-DE`). Optional and lenient: mainly phrases and short sentences, shows "Heard: …", +1 XP when understood, never a penalty, can be switched off in Settings.
  Needs the microphone, which Chrome only allows on HTTPS. Use the `chrome://flags` "Insecure origins treated as secure" entry for `http://<mac-ip>:8765` on each phone for testing, or serve over HTTPS.
  Caveats: it recognises words rather than scoring sounds, is weak on single short words, needs internet, and sends audio to Google.
- Second phone can't reach the server: check that it's on the same Wi-Fi/subnet, has no VPN, and note the exact Chrome error code.

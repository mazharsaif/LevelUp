# LevelUp – FastAPI server

A drop-in replacement for `../server.py` (that one is untouched and still works).
It serves the same `../app`, uses the same API and reads and writes the same `../progress` files, so the phones behave exactly the same.

## Run (uv)
```bash
cd LevelUp/server_fastapi
uv run main.py            # http://<mac-ip>:8766   (API docs: /docs)
uv run main.py 8765       # use the old port instead (stop server.py first)
A1_DATA=/tmp/a1test uv run main.py 8899      # test server with scratch data
uv run uvicorn main:app --host 0.0.0.0 --port 8766 --reload   # dev: restarts when you edit main.py
```
It uses the repo's single uv project: Python 3.9 for now (`../.python-version`; Apple's `/usr/bin/python3`, which the Mac firewall allows), `../pyproject.toml` / `../uv.lock`, env in `../.venv` (created on first `uv run`, or `uv sync`).
3.13 is tested and ready: `echo 3.13 > ../.python-version && uv sync`, then allow `~/.local/share/uv/python/cpython-3.13-macos-aarch64-none/bin/python3.13` in the Mac firewall (System Settings › Network › Firewall), or phones can't connect.

## Same as server.py
- `GET /api/users`, `GET /api/states?c=`, `GET /api/state/{id}?c=` and `PUT /api/state/{id}?c=`, with the same JSON shapes.
- PUT rejects stale writes (409, returns the newer copy). It keeps one backup per learner per day and writes atomically, with a 5 MB limit.
- Files: `progress/<id>.json` for German A1 and `progress/<id>@<course>.json` for other courses.

## FastAPI extras
| | |
|---|---|
| `/docs`, `/redoc` | Interactive API docs (try every endpoint in the browser) |
| Validation | Bad user or course ids are rejected with a clear 422 instead of being silently ignored |
| Write lock per learner | Two phones saving at the same moment can't overwrite each other (the stale check and the write are atomic) |
| Gzip | `content.json` (~490 KB) and the JS are sent compressed, so the first load is faster |
| Caching | Audio is cached by phones for a year (the file names are content hashes). App files use ETag → `304` when nothing changed |
| `GET /api/health` | Up or down, uptime, data folder |
| `GET /api/backups/{id}?c=` | Lists the daily backups |
| `GET /api/backups/{id}/{YYYY-MM-DD}?c=` | Downloads one backup; restore it with Settings › Import in the app |
| Log | One line per request: IP, method, path, status, ms (audio hidden unless it errors) |

"""LevelUp FastAPI server: a drop-in replacement for ../server.py.

Same app, same API, same progress files; the phone sees no difference.
FastAPI extras: interactive API docs (/docs), validated inputs, per-learner write locks,
gzip, smarter caching, health/backup endpoints, and request timing in the log.

Python 3.9 for now (3.13-ready; see ../.python-version), uv project in the repo root (../pyproject.toml, env ../.venv).
Run (from this folder):   uv run main.py            -> port 8766
                           uv run main.py 8899       -> any port
Test data:                 A1_DATA=<tmpdir> uv run main.py 8899
Dev auto-reload:           uv run uvicorn main:app --host 0.0.0.0 --port 8766 --reload
"""
import json
import os
import re
import shutil
import sys
import threading
import time
from datetime import date
from typing import Optional

from fastapi import FastAPI, Path, Query, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # LevelUp/
APP = os.path.join(ROOT, "app")
DATA = os.environ.get("A1_DATA") or os.path.join(ROOT, "progress")  # same files as server.py
BACKUPS = os.path.join(DATA, "backups")
USERS_FILE = os.path.join(DATA, "users.json")
DEFAULT_USERS = [{"id": "taha", "name": "Taha", "color": "#1c7cd6"}, {"id": "batul", "name": "Batul", "color": "#ce4fa0"}]
DEFAULT_COURSE = "de-a1"  # German A1 keeps the original file names (progress/<user>.json)
MAX_BODY = 5_000_000
STARTED = time.time()

ID_RE = r"^[a-z0-9_-]{1,32}$"
COURSE_RE = r"^[a-z0-9_-]{1,40}$"


# ---------- storage (identical file layout to server.py) ----------
def ensure_dirs():
    os.makedirs(BACKUPS, exist_ok=True)
    if not os.path.exists(USERS_FILE):
        with open(USERS_FILE, "w") as f:
            json.dump(DEFAULT_USERS, f, indent=1)


def users() -> list[dict]:
    ensure_dirs()
    with open(USERS_FILE) as f:
        return json.load(f)


def user_ok(uid: str) -> bool:
    return bool(re.fullmatch(ID_RE, uid or "")) and any(u["id"] == uid for u in users())


def tag_of(uid: str, course: str) -> str:
    return uid if course == DEFAULT_COURSE else f"{uid}@{course}"


def state_path(uid: str, course: str = DEFAULT_COURSE) -> str:
    return os.path.join(DATA, tag_of(uid, course) + ".json")


def read_state(uid: str, course: str = DEFAULT_COURSE) -> Optional[dict]:
    try:
        with open(state_path(uid, course)) as f:
            return json.load(f)
    except (FileNotFoundError, ValueError):
        return None


# One lock per learner+course: the "is it stale?" check and the write happen together,
# so two phones saving at the same moment can't overwrite each other.
_locks: dict[str, threading.Lock] = {}
_locks_guard = threading.Lock()


def lock_for(key: str) -> threading.Lock:
    with _locks_guard:
        return _locks.setdefault(key, threading.Lock())


def err(msg: str, code: int) -> JSONResponse:
    return JSONResponse({"error": msg}, status_code=code)


# ---------- models (shown in /docs) ----------
class User(BaseModel):
    id: str
    name: str
    color: str
    demo: Optional[bool] = None


class StateEnvelope(BaseModel):
    state: Optional[dict]


class SaveOk(BaseModel):
    ok: bool = True
    saved: int


class SaveConflict(BaseModel):
    ok: bool = False
    conflict: bool = True
    state: dict


class ErrorOut(BaseModel):
    error: str


class Health(BaseModel):
    ok: bool
    uptime_s: int
    data_dir: str
    users: int
    version: str


class Backup(BaseModel):
    name: str
    day: str
    bytes: int


# ---------- app ----------
app = FastAPI(
    title="LevelUp API",
    version="1.0.0",
    description="Progress sync for the LevelUp learning app. Same API as the original stdlib server.",
)
app.add_middleware(GZipMiddleware, minimum_size=1000)  # content.json and JS shrink a lot over Wi-Fi
# Let the same app opened from another local server (e.g. the old one on :8765) send bug reports here.
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware, allow_origin_regex=r"^http://(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|localhost|127\.0\.0\.1)(:\d+)?$",
                   allow_methods=["POST"], allow_headers=["Content-Type"])


@app.middleware("http")
async def cache_and_log(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    path = request.url.path
    if "/audio/" in path:
        # clip names are content hashes, so a clip never changes: let phones keep it
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    else:
        response.headers["Cache-Control"] = "no-cache"  # always pick up app updates (ETag makes it cheap)
    if "/audio/" not in path or response.status_code >= 400:
        ms = (time.perf_counter() - t0) * 1000
        ip = request.client.host if request.client else "?"
        q = f"?{request.url.query}" if request.url.query else ""
        print(f"{time.strftime('%d/%b/%Y %H:%M:%S')} {ip} {request.method} {path}{q} -> {response.status_code} ({ms:.0f} ms)",
              file=sys.stderr, flush=True)
    return response


CourseQ = Query(DEFAULT_COURSE, pattern=COURSE_RE, description="Course id, e.g. de-a1")


@app.get("/api/users", response_model=list[User], response_model_exclude_none=True, tags=["learners"])
def get_users():
    """All learner profiles."""
    return users()


@app.get("/api/states", response_model=dict[str, Optional[dict]], tags=["progress"])
def get_states(c: str = CourseQ):
    """Every learner's progress for one course (used by the Party comparison)."""
    return {u["id"]: read_state(u["id"], c) for u in users()}


@app.get("/api/state/{uid}", response_model=StateEnvelope, responses={404: {"model": ErrorOut}}, tags=["progress"])
def get_state(uid: str = Path(...), c: str = CourseQ):
    """One learner's progress (null if they haven't started this course)."""
    if not user_ok(uid):
        return err("unknown user", 404)
    return {"state": read_state(uid, c)}


@app.put(
    "/api/state/{uid}",
    response_model=SaveOk,
    responses={409: {"model": SaveConflict, "description": "A newer copy exists (another device). It is returned."},
               404: {"model": ErrorOut}, 400: {"model": ErrorOut}, 413: {"model": ErrorOut}},
    tags=["progress"],
)
async def put_state(request: Request, uid: str = Path(...), c: str = CourseQ):
    """Save progress. Rejects stale writes (409) and keeps one backup per learner per day."""
    if not user_ok(uid):
        return err("unknown user", 404)
    if int(request.headers.get("content-length") or 0) > MAX_BODY:
        return err("too large", 413)
    body = await request.body()
    if len(body) > MAX_BODY:
        return err("too large", 413)
    try:
        new = json.loads(body)
        assert isinstance(new, dict) and "settings" in new and "words" in new
    except Exception:
        return err("bad state", 400)
    with lock_for(tag_of(uid, c)):
        old = read_state(uid, c)
        if old and old.get("updated", 0) > new.get("updated", 0):
            return JSONResponse({"ok": False, "conflict": True, "state": old}, status_code=409)
        path = state_path(uid, c)
        backup = os.path.join(BACKUPS, f"{tag_of(uid, c)}-{date.today().isoformat()}.json")
        if old and not os.path.exists(backup):
            shutil.copy(path, backup)
        tmp = path + ".tmp"
        with open(tmp, "w") as f:
            json.dump(new, f, ensure_ascii=False)
        os.replace(tmp, path)
    return {"ok": True, "saved": int(time.time() * 1000)}


# ---------- extras ----------
@app.get("/api/health", response_model=Health, tags=["server"])
def health():
    """Quick check that the server is up (handy from a phone: /api/health)."""
    return {"ok": True, "uptime_s": int(time.time() - STARTED), "data_dir": DATA, "users": len(users()), "version": app.version}


@app.get("/api/backups/{uid}", response_model=list[Backup], responses={404: {"model": ErrorOut}}, tags=["backups"])
def list_backups(uid: str = Path(...), c: str = CourseQ):
    """Daily backups for a learner and course, newest first."""
    if not user_ok(uid):
        return err("unknown user", 404)
    ensure_dirs()
    pat = re.compile(re.escape(tag_of(uid, c)) + r"-(\d{4}-\d{2}-\d{2})\.json$")
    out = []
    for name in os.listdir(BACKUPS):
        m = pat.fullmatch(name)
        if m:
            out.append({"name": name, "day": m.group(1), "bytes": os.path.getsize(os.path.join(BACKUPS, name))})
    return sorted(out, key=lambda b: b["day"], reverse=True)


@app.get("/api/backups/{uid}/{day}", responses={404: {"model": ErrorOut}}, tags=["backups"])
def get_backup(uid: str = Path(...), day: str = Path(..., pattern=r"^\d{4}-\d{2}-\d{2}$"), c: str = CourseQ):
    """Download one day's backup (JSON). Import it in the app's Settings to restore."""
    if not user_ok(uid):
        return err("unknown user", 404)
    name = f"{tag_of(uid, c)}-{day}.json"
    path = os.path.join(BACKUPS, name)
    if not os.path.isfile(path):
        return err("no backup for that day", 404)
    return FileResponse(path, media_type="application/json", filename=name)


# ---------- bug reports (alpha testing) ----------
BUGS = os.path.join(DATA, "bugs")
_bug_hits: dict[str, list[float]] = {}


class BugIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    category: str = Field("bug", pattern=r"^(bug|content|idea)$")
    ctx: dict = Field(default_factory=dict, description="Screen snapshot: page, url, user, course, lesson step, screen text/HTML, errors")


class BugSaved(BaseModel):
    ok: bool = True
    id: str


class BugSummary(BaseModel):
    id: str
    received: str
    category: str
    user: Optional[str]
    page: Optional[str]
    text: str


@app.post("/api/bugs", response_model=BugSaved, responses={413: {"model": ErrorOut}, 429: {"model": ErrorOut}}, tags=["bugs"])
async def report_bug(request: Request, bug: BugIn):
    """Save a tester's bug report with a snapshot of the screen they were on."""
    if int(request.headers.get("content-length") or 0) > 1_000_000:
        return err("too large", 413)
    ip = request.client.host if request.client else "?"
    now = time.time()
    hits = [t for t in _bug_hits.get(ip, []) if now - t < 3600]
    if len(hits) >= 30:
        return err("too many reports, try later", 429)
    _bug_hits[ip] = hits + [now]
    os.makedirs(BUGS, exist_ok=True)
    user = str(bug.ctx.get("user") or "anon")
    user = re.sub(r"[^a-z0-9_-]", "", user.lower())[:32] or "anon"
    bid = f"{time.strftime('%Y%m%d-%H%M%S')}-{user}-{os.urandom(2).hex()}"
    rec = {"id": bid, "received": time.strftime("%Y-%m-%d %H:%M:%S"), "ip": ip, "status": "new",
           "category": bug.category, "text": bug.text, "ctx": bug.ctx}
    with open(os.path.join(BUGS, bid + ".json"), "w") as f:
        json.dump(rec, f, ensure_ascii=False, indent=1)
    print(f"BUG {bid} [{bug.category}] {rec['ctx'].get('page', '?')}: {bug.text[:80]!r}", file=sys.stderr, flush=True)
    return {"ok": True, "id": bid}


@app.get("/api/bugs", response_model=list[BugSummary], tags=["bugs"])
def list_bugs(limit: int = Query(100, ge=1, le=1000)):
    """Newest bug reports first (summary only; full snapshot is in progress/bugs/<id>.json)."""
    if not os.path.isdir(BUGS):
        return []
    out = []
    for name in sorted(os.listdir(BUGS), reverse=True)[:limit]:
        try:
            with open(os.path.join(BUGS, name)) as f:
                r = json.load(f)
            out.append({"id": r["id"], "received": r["received"], "category": r["category"],
                        "user": r["ctx"].get("user"), "page": r["ctx"].get("page"), "text": r["text"][:200]})
        except (ValueError, KeyError, OSError):
            continue
    return out


@app.api_route("/api/{rest:path}", methods=["GET", "PUT", "POST", "DELETE"], include_in_schema=False)
def api_404(rest: str):
    return err("not found", 404)


# The app itself (index.html, JS, CSS, audio). Mounted last so /api and /docs win.
app.mount("/", StaticFiles(directory=APP, html=True), name="app")

ensure_dirs()

if __name__ == "__main__":
    import uvicorn

    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
    print(f"LevelUp (FastAPI) on http://localhost:{port}  ·  API docs /docs  ·  progress in {DATA}", flush=True)
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")

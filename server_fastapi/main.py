"""LevelUp FastAPI server: a drop-in replacement for ../server.py.

Same app, same API, same progress files; the phone sees no difference.
FastAPI extras: interactive API docs (/docs), validated inputs, per-learner write locks,
gzip, smarter caching, health/backup endpoints, and request timing in the log.

Python 3.13 (see ../.python-version), uv project in the repo root (../pyproject.toml, env ../.venv).
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

import auth
from fastapi import FastAPI, Path, Query, Request
from fastapi.middleware.cors import CORSMiddleware
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
def ensure_dirs() -> None:
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


def read_state(uid: str, course: str = DEFAULT_COURSE) -> dict | None:
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
    demo: bool | None = None


class StateEnvelope(BaseModel):
    state: dict | None


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
def release() -> str:
    """Release version (calendar versioning YYYY.MM.DD.NN) from the git tag on the deployed commit.
    Untagged commit -> 'dev-<short hash>'; no git -> 'unknown'."""
    import subprocess
    try:
        def git(*a: str) -> str:
            return subprocess.run(["git", "-C", ROOT, *a], capture_output=True, text=True, timeout=5).stdout.strip()
        tag = git("tag", "--points-at", "HEAD", "--list", "v[0-9]*.[0-9]*.[0-9]*.[0-9]*", "--sort=-v:refname").split("\n")[0]
        return tag[1:] if tag else f"dev-{git('rev-parse', '--short', 'HEAD') or 'unknown'}"
    except (OSError, subprocess.SubprocessError):
        return "unknown"


RELEASE = release()

app = FastAPI(
    title="LevelUp API",
    version=RELEASE,
    description="Progress sync for the LevelUp learning app. Same API as the original stdlib server.",
)
app.add_middleware(GZipMiddleware, minimum_size=1000)  # content.json and JS shrink a lot over Wi-Fi
# Let the same app opened from another local server (e.g. the old one on :8765) send bug reports here.
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


# ---------- accounts (see auth.py) ----------
COLORS = ["#1c7cd6", "#ce4fa0", "#2f9e6b", "#e8590c", "#7048e8", "#0c8599", "#d6336c", "#5c940d", "#f08c00", "#495057"]


def me(request: Request) -> str | None:
    uid = auth.session_uid(DATA, request.cookies.get(auth.COOKIE))
    return uid if uid and user_ok(uid) else None


def is_https(request: Request) -> bool:
    return request.url.scheme == "https" or request.headers.get("x-forwarded-proto", "").startswith("https")


def client_ip(request: Request) -> str:
    return request.headers.get("x-forwarded-for", "").split(",")[0].strip() or (request.client.host if request.client else "?")


def logged_in(request: Request, uid: str) -> JSONResponse:
    """Response that starts a session for uid (cookie) and returns the profile."""
    token = auth.new_session(DATA, uid)
    u = next(x for x in users() if x["id"] == uid)
    r = JSONResponse({k: u[k] for k in ("id", "name", "color")})
    r.set_cookie(auth.COOKIE, token, max_age=auth.SESSION_DAYS * 86400, httponly=True, samesite="lax",
                 secure=is_https(request), path="/")
    return r


def need(request: Request, uid: str | None = None) -> JSONResponse | None:
    """None when allowed; otherwise the 401/403 response to return."""
    who = me(request)
    if not who:
        return err("login required", 401)
    if uid is not None and uid != who:
        return err("not your account", 403)
    return None


class LoginIn(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=200)


class SignupIn(BaseModel):
    username: str = Field(..., pattern=r"^[A-Za-z0-9_-]{3,32}$", description="3-32 letters, digits, _ or -")
    name: str = Field(..., min_length=1, max_length=40)
    password: str = Field(..., min_length=auth.MIN_PASSWORD, max_length=200)


class PasswordIn(BaseModel):
    old: str = Field(..., min_length=1, max_length=200)
    new: str = Field(..., min_length=auth.MIN_PASSWORD, max_length=200)


_signups: dict[str, list[float]] = {}
RESERVED = {"guest", "admin", "anon"}  # "guest" = the app's offline guest mode


@app.get("/api/auth/me", response_model=User, responses={401: {"model": ErrorOut}}, tags=["accounts"])
def auth_me(request: Request):
    """The logged-in learner, or 401."""
    uid = me(request)
    if not uid:
        return err("not logged in", 401)
    return next(u for u in users() if u["id"] == uid)


@app.post("/api/auth/login", response_model=User, tags=["accounts"],
          responses={401: {"model": ErrorOut}, 429: {"model": ErrorOut}})
def auth_login(request: Request, body: LoginIn):
    """Check username + password; on success set the session cookie."""
    uid, ip = body.username.strip().lower(), client_ip(request)
    if auth.throttled(ip, uid):
        return err("too many attempts, wait 15 minutes", 429)
    if not (user_ok(uid) and auth.check_password(DATA, uid, body.password)):
        auth.note_failure(ip, uid)
        return err("wrong username or password", 401)
    auth.clear_failures(uid)
    return logged_in(request, uid)


@app.post("/api/auth/signup", response_model=User, tags=["accounts"],
          responses={409: {"model": ErrorOut}, 429: {"model": ErrorOut}})
def auth_signup(request: Request, body: SignupIn):
    """Create a learner with a password and log them in."""
    ip, now = client_ip(request), time.time()
    hits = [t for t in _signups.get(ip, []) if now - t < 3600]
    if len(hits) >= 5:
        return err("too many sign-ups from here, try later", 429)
    uid, name = body.username.lower(), body.name.strip()
    if not name:
        return err("name required", 400)
    with lock_for("__users__"):
        us = users()
        if uid in RESERVED or any(u["id"] == uid for u in us) or auth.has_password(DATA, uid):
            return err("that username is taken", 409)
        used = {u.get("color") for u in us}
        color = next((c for c in COLORS if c not in used), COLORS[len(us) % len(COLORS)])
        us.append({"id": uid, "name": name, "color": color})
        tmp = USERS_FILE + ".tmp"
        with open(tmp, "w") as f:
            json.dump(us, f, indent=1, ensure_ascii=False)
        os.replace(tmp, USERS_FILE)
        auth.set_password(DATA, uid, body.password)
    _signups[ip] = hits + [now]
    print(f"SIGNUP {uid} ({name}) from {ip}", file=sys.stderr, flush=True)
    return logged_in(request, uid)


@app.post("/api/auth/logout", tags=["accounts"])
def auth_logout(request: Request):
    """End this device's session."""
    auth.end_session(DATA, request.cookies.get(auth.COOKIE))
    r = JSONResponse({"ok": True})
    r.delete_cookie(auth.COOKIE, path="/")
    return r


@app.post("/api/auth/password", responses={401: {"model": ErrorOut}, 403: {"model": ErrorOut}}, tags=["accounts"])
def auth_password(request: Request, body: PasswordIn):
    """Change your password (logs out your other devices)."""
    uid = me(request)
    if not uid:
        return err("login required", 401)
    if not auth.check_password(DATA, uid, body.old):
        auth.note_failure(client_ip(request), uid)
        return err("current password is wrong", 403)
    auth.set_password(DATA, uid, body.new)
    auth.end_other_sessions(DATA, uid, request.cookies.get(auth.COOKIE))
    return {"ok": True}


@app.get("/api/users", response_model=list[User], response_model_exclude_none=True, tags=["learners"])
def get_users(request: Request):
    """All learner profiles (login required)."""
    return need(request) or users()


@app.get("/api/states", response_model=dict[str, dict | None], tags=["progress"])
def get_states(request: Request, c: str = CourseQ):
    """Progress for one course of you and your party members (the Party comparison; login required)."""
    denied = need(request)
    if denied:
        return denied
    who = me(request)
    p = party_of(load_parties(), who)
    ids = p["members"] if p else [who]
    return {uid: read_state(uid, c) for uid in ids if user_ok(uid)}


# ---------- parties: up to 10 learners who compare progress ----------
# parties.json = {"<id>": {"name", "members": [uid], "requests": [{"uid", "at"}], "created"}}
# A learner is in at most one party. Joining = request, then any member accepts.
PARTIES_FILE = os.path.join(DATA, "parties.json")
PARTY_MAX = 10
_party_lock = threading.Lock()


def load_parties() -> dict:
    try:
        with open(PARTIES_FILE) as f:
            return json.load(f)
    except (FileNotFoundError, ValueError):
        return {}


def save_parties(d: dict) -> None:
    tmp = PARTIES_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(d, f, indent=1)
    os.replace(tmp, PARTIES_FILE)


def party_of(d: dict, uid: str) -> dict | None:
    return next((dict(p, id=k) for k, p in d.items() if uid in p["members"]), None)


class PartyIn(BaseModel):
    name: str = Field(..., min_length=2, max_length=40)


class PartyUid(BaseModel):
    uid: str = Field(..., pattern=ID_RE)


def party_view(d: dict, who: str) -> dict:
    names = {u["id"]: u["name"] for u in users()}
    mine = party_of(d, who)
    out = {"max": PARTY_MAX, "mine": None, "parties": []}
    for k, p in sorted(d.items(), key=lambda kv: kv[1]["name"].lower()):
        out["parties"].append({"id": k, "name": p["name"], "count": len(p["members"]), "full": len(p["members"]) >= PARTY_MAX,
                               "requested": any(r["uid"] == who for r in p.get("requests", []))})
    if mine:
        out["mine"] = {"id": mine["id"], "name": mine["name"],
                       "members": [{"id": m, "name": names.get(m, m)} for m in mine["members"]],
                       "requests": [{"id": r["uid"], "name": names.get(r["uid"], r["uid"]), "at": r["at"]} for r in mine.get("requests", [])]}
    return out


@app.get("/api/parties", tags=["parties"])
def get_parties(request: Request):
    """All parties (name, member count), your party with its members and join requests. Login required."""
    denied = need(request)
    if denied:
        return denied
    return party_view(load_parties(), me(request))


@app.post("/api/parties", tags=["parties"], responses={409: {"model": ErrorOut}})
def create_party(request: Request, body: PartyIn):
    """Start a party (you become its first member)."""
    denied = need(request)
    if denied:
        return denied
    who = me(request)
    with _party_lock:
        d = load_parties()
        if party_of(d, who):
            return err("you are already in a party", 409)
        if any(p["name"].strip().lower() == body.name.strip().lower() for p in d.values()):
            return err("that name is taken", 409)
        pid = re.sub(r"[^a-z0-9]+", "-", body.name.lower()).strip("-")[:24] or "party"
        base, n = pid, 2
        while pid in d:
            pid, n = f"{base}-{n}", n + 1
        for p in d.values():                                    # starting your own party withdraws your requests
            p["requests"] = [r for r in p.get("requests", []) if r["uid"] != who]
        d[pid] = {"name": body.name.strip(), "members": [who], "requests": [], "created": date.today().isoformat()}
        save_parties(d)
        return party_view(d, who)


@app.post("/api/parties/{pid}/request", tags=["parties"], responses={404: {"model": ErrorOut}, 409: {"model": ErrorOut}})
def request_join(request: Request, pid: str = Path(..., pattern=ID_RE)):
    """Ask to join a party; any member can accept."""
    denied = need(request)
    if denied:
        return denied
    who = me(request)
    with _party_lock:
        d = load_parties()
        if pid not in d:
            return err("no such party", 404)
        if party_of(d, who):
            return err("you are already in a party", 409)
        p = d[pid]
        if len(p["members"]) >= PARTY_MAX:
            return err("that party is full", 409)
        if not any(r["uid"] == who for r in p.setdefault("requests", [])):
            p["requests"].append({"uid": who, "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
            save_parties(d)
        return party_view(d, who)


@app.post("/api/parties/{pid}/cancel", tags=["parties"])
def cancel_request(request: Request, pid: str = Path(..., pattern=ID_RE)):
    """Withdraw your join request."""
    denied = need(request)
    if denied:
        return denied
    who = me(request)
    with _party_lock:
        d = load_parties()
        if pid in d:
            d[pid]["requests"] = [r for r in d[pid].get("requests", []) if r["uid"] != who]
            save_parties(d)
        return party_view(d, who)


def _answer(request: Request, pid: str, uid: str, accept: bool):
    denied = need(request)
    if denied:
        return denied
    who = me(request)
    with _party_lock:
        d = load_parties()
        p = d.get(pid)
        if not p or who not in p["members"]:
            return err("you are not in that party", 403)
        if not any(r["uid"] == uid for r in p.get("requests", [])):
            return err("no such request", 404)
        if accept:
            if len(p["members"]) >= PARTY_MAX:
                return err("the party is full", 409)
            if party_of(d, uid):
                p["requests"] = [r for r in p["requests"] if r["uid"] != uid]
                save_parties(d)
                return err("they already joined another party", 409)
            p["members"].append(uid)
            for q in d.values():                                # one party per learner: drop their other requests
                q["requests"] = [r for r in q.get("requests", []) if r["uid"] != uid]
        else:
            p["requests"] = [r for r in p["requests"] if r["uid"] != uid]
        save_parties(d)
        return party_view(d, who)


@app.post("/api/parties/{pid}/accept", tags=["parties"], responses={403: {"model": ErrorOut}, 404: {"model": ErrorOut}, 409: {"model": ErrorOut}})
def accept_request(request: Request, body: PartyUid, pid: str = Path(..., pattern=ID_RE)):
    """Any member accepts a join request (up to 10 members)."""
    return _answer(request, pid, body.uid, True)


@app.post("/api/parties/{pid}/decline", tags=["parties"], responses={403: {"model": ErrorOut}, 404: {"model": ErrorOut}})
def decline_request(request: Request, body: PartyUid, pid: str = Path(..., pattern=ID_RE)):
    """Any member declines a join request."""
    return _answer(request, pid, body.uid, False)


@app.post("/api/parties/{pid}/leave", tags=["parties"])
def leave_party(request: Request, pid: str = Path(..., pattern=ID_RE)):
    """Leave your party (an empty party is removed)."""
    denied = need(request)
    if denied:
        return denied
    who = me(request)
    with _party_lock:
        d = load_parties()
        p = d.get(pid)
        if p and who in p["members"]:
            p["members"].remove(who)
            if not p["members"]:
                del d[pid]
            save_parties(d)
        return party_view(d, who)


@app.get("/api/state/{uid}", response_model=StateEnvelope, responses={404: {"model": ErrorOut}}, tags=["progress"])
def get_state(request: Request, uid: str = Path(...), c: str = CourseQ):
    """Your progress (null if you haven't started this course)."""
    denied = need(request, uid)
    if denied:
        return denied
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
    """Save your progress. Rejects stale writes (409) and keeps one backup per learner per day."""
    denied = need(request, uid)
    if denied:
        return denied
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
def list_backups(request: Request, uid: str = Path(...), c: str = CourseQ):
    """Your daily backups for a course, newest first."""
    denied = need(request, uid)
    if denied:
        return denied
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
def get_backup(request: Request, uid: str = Path(...), day: str = Path(..., pattern=r"^\d{4}-\d{2}-\d{2}$"), c: str = CourseQ):
    """Download one day's backup (JSON). Import it in the app's Settings to restore."""
    denied = need(request, uid)
    if denied:
        return denied
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
    ctx: dict = Field(default_factory=dict,
                      description="Screen snapshot: page, url, user, course, lesson step, screen text/HTML, errors")


class BugSaved(BaseModel):
    ok: bool = True
    id: str


class BugSummary(BaseModel):
    id: str
    received: str
    category: str
    user: str | None
    page: str | None
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
def list_bugs(request: Request, limit: int = Query(100, ge=1, le=1000)):
    """Newest bug reports first (summary only; full snapshot is in progress/bugs/<id>.json). Login required."""
    denied = need(request)
    if denied:
        return denied
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


# Android app (TWA): Digital Asset Links proves levelrise.org belongs to the APK, so it opens without a URL bar.
@app.get("/.well-known/assetlinks.json", include_in_schema=False)
def assetlinks():
    return FileResponse(os.path.join(APP, ".well-known", "assetlinks.json"), media_type="application/json")


# The sideloadable APK (built locally by tools/android/build_apk.sh, committed in app/download/).
@app.get("/download/levelup.apk", include_in_schema=False)
def apk():
    path = os.path.join(APP, "download", "levelup.apk")
    if not os.path.isfile(path):
        return err("no APK built yet", 404)
    return FileResponse(path, media_type="application/vnd.android.package-archive", filename="LevelUp.apk",
                        headers={"Cache-Control": "no-cache"})


# The native Android app (beta, installs next to the TWA app), built by tools/android/build_native.sh.
@app.get("/download/levelup-native.apk", include_in_schema=False)
def apk_native():
    path = os.path.join(APP, "download", "levelup-native.apk")
    if not os.path.isfile(path):
        return err("no native APK built yet", 404)
    return FileResponse(path, media_type="application/vnd.android.package-archive", filename="LevelUp-Native.apk",
                        headers={"Cache-Control": "no-cache"})


# The app itself (index.html, JS, CSS, audio). Mounted last so /api and /docs win.
app.mount("/", StaticFiles(directory=APP, html=True), name="app")

ensure_dirs()

if __name__ == "__main__":
    import uvicorn

    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
    # behind Caddy on the droplet: LEVELUP_HOST=127.0.0.1, so only the HTTPS proxy can reach the app
    host = os.environ.get("LEVELUP_HOST", "0.0.0.0")
    print(f"LevelUp (FastAPI) on http://{host}:{port}  ·  API docs /docs  ·  progress in {DATA}", flush=True)
    uvicorn.run(app, host=host, port=port, log_level="warning", proxy_headers=True, forwarded_allow_ips="127.0.0.1")

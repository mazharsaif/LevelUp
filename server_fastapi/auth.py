"""Accounts for LevelUp: password hashes, sessions and login throttling.

Files (in the data folder, next to users.json; both chmod 600, never served):
  auth.json      {uid: {"salt": hex, "hash": hex, "iter": int, "changed": "YYYY-MM-DD"}}
  sessions.json  {sha256(token): {"uid": str, "exp": unix seconds}}
Passwords: PBKDF2-HMAC-SHA256 with a random 16-byte salt (stdlib only, no extra dependency).
Sessions: a random token in an HttpOnly cookie; only its SHA-256 is stored, so a leaked
sessions.json can't be replayed.

Testing: start the server with LU_MASTER_PASSWORD=admin and any existing username logs in
with "admin" (also as the old password in Change password). Never set it on a public server.

Set a password from the command line (also creates nothing else):
    uv run python server_fastapi/auth.py <uid>            # prompts twice
    A1_DATA=<dir> uv run python server_fastapi/auth.py <uid>
"""
import hashlib
import hmac
import json
import os
import secrets
import threading
import time
from datetime import date

ITERATIONS = 200_000
SESSION_DAYS = 90
COOKIE = "lu_session"
MIN_PASSWORD = 6
_lock = threading.Lock()


def _paths(data: str) -> tuple[str, str]:
    return os.path.join(data, "auth.json"), os.path.join(data, "sessions.json")


def _load(path: str) -> dict:
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _save(path: str, obj: dict) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(obj, f, indent=1)
    os.chmod(tmp, 0o600)
    os.replace(tmp, path)


def _hash(password: str, salt: bytes, iterations: int) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)


# ---------- passwords ----------
def set_password(data: str, uid: str, password: str) -> None:
    salt = os.urandom(16)
    rec = {"salt": salt.hex(), "hash": _hash(password, salt, ITERATIONS).hex(), "iter": ITERATIONS,
           "changed": date.today().isoformat()}
    auth_file, _ = _paths(data)
    with _lock:
        a = _load(auth_file)
        a[uid] = rec
        _save(auth_file, a)


def _master_ok(password: str) -> bool:
    """Testing only: LU_MASTER_PASSWORD (e.g. "admin") logs in as any existing learner. Unset = off."""
    master = os.environ.get("LU_MASTER_PASSWORD")
    return bool(master) and hmac.compare_digest(password.encode(), master.encode())


def check_password(data: str, uid: str, password: str) -> bool:
    if _master_ok(password):
        return True
    rec = _load(_paths(data)[0]).get(uid)
    if not rec:
        _hash(password, b"0" * 16, ITERATIONS)  # same work either way, so timing doesn't reveal unknown users
        return False
    got = _hash(password, bytes.fromhex(rec["salt"]), int(rec["iter"]))
    return hmac.compare_digest(got.hex(), rec["hash"])


def has_password(data: str, uid: str) -> bool:
    return uid in _load(_paths(data)[0])


def remove_account(data: str, uid: str) -> None:
    auth_file, sess_file = _paths(data)
    with _lock:
        a = _load(auth_file)
        a.pop(uid, None)
        _save(auth_file, a)
        s = _load(sess_file)
        _save(sess_file, {k: v for k, v in s.items() if v.get("uid") != uid})


# ---------- sessions ----------
def _th(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_session(data: str, uid: str) -> str:
    token = secrets.token_urlsafe(32)
    _, sess_file = _paths(data)
    now = time.time()
    with _lock:
        s = {k: v for k, v in _load(sess_file).items() if v.get("exp", 0) > now}  # prune expired
        s[_th(token)] = {"uid": uid, "exp": int(now + SESSION_DAYS * 86400)}
        _save(sess_file, s)
    return token


def session_uid(data: str, token: str | None) -> str | None:
    if not token:
        return None
    rec = _load(_paths(data)[1]).get(_th(token))
    if not rec or rec.get("exp", 0) < time.time():
        return None
    return rec.get("uid")


def end_session(data: str, token: str | None) -> None:
    if not token:
        return
    _, sess_file = _paths(data)
    with _lock:
        s = _load(sess_file)
        if s.pop(_th(token), None) is not None:
            _save(sess_file, s)


def end_other_sessions(data: str, uid: str, keep_token: str | None) -> None:
    """After a password change: log out every other device of this user."""
    _, sess_file = _paths(data)
    keep = _th(keep_token) if keep_token else None
    with _lock:
        s = _load(sess_file)
        _save(sess_file, {k: v for k, v in s.items() if v.get("uid") != uid or k == keep})


# ---------- throttling (in memory; resets on restart) ----------
_fails: dict[tuple[str, str], list[float]] = {}
WINDOW, MAX_PER_NAME, MAX_PER_IP = 15 * 60, 5, 20


def throttled(ip: str, name: str) -> bool:
    now = time.time()
    for k in (("ip", ip), ("name", name)):
        _fails[k] = [t for t in _fails.get(k, []) if now - t < WINDOW]
    return len(_fails[("name", name)]) >= MAX_PER_NAME or len(_fails[("ip", ip)]) >= MAX_PER_IP


def note_failure(ip: str, name: str) -> None:
    now = time.time()
    for k in (("ip", ip), ("name", name)):
        _fails.setdefault(k, []).append(now)


def clear_failures(name: str) -> None:
    _fails.pop(("name", name), None)


if __name__ == "__main__":
    import getpass
    import sys

    if len(sys.argv) != 2:
        sys.exit(__doc__)
    here = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.environ.get("A1_DATA") or os.path.join(os.path.dirname(here), "progress")
    uid = sys.argv[1]
    with open(os.path.join(data_dir, "users.json")) as f:
        if not any(u["id"] == uid for u in json.load(f)):
            sys.exit(f"no learner '{uid}' in {data_dir}/users.json")
    pw = os.environ.get("LU_PASSWORD") or getpass.getpass(f"New password for {uid}: ")
    if not os.environ.get("LU_PASSWORD") and pw != getpass.getpass("Again: "):
        sys.exit("passwords don't match")
    if len(pw) < MIN_PASSWORD:
        sys.exit(f"at least {MIN_PASSWORD} characters")
    set_password(data_dir, uid, pw)
    print(f"password set for {uid} in {data_dir}/auth.json")

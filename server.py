#!/usr/bin/env python3
"""Deutsch A1 server: serves app/ and stores each learner's progress on this Mac.

Run:  /usr/bin/python3 server.py            (port 8765, reachable on your Wi-Fi)
Progress files: progress/<user>.json  ·  one backup per user per day in progress/backups/
Uses only the Python standard library (works with macOS's built-in /usr/bin/python3).
"""
import json, os, re, shutil, sys, time
from datetime import date
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(ROOT, "app")
DATA = os.environ.get("A1_DATA") or os.path.join(ROOT, "progress")
BACKUPS = os.path.join(DATA, "backups")
USERS_FILE = os.path.join(DATA, "users.json")
DEFAULT_USERS = [{"id": "taha", "name": "Taha", "color": "#1c7cd6"}, {"id": "batul", "name": "Batul", "color": "#ce4fa0"}]
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765

os.makedirs(BACKUPS, exist_ok=True)
if not os.path.exists(USERS_FILE):
    json.dump(DEFAULT_USERS, open(USERS_FILE, "w"), indent=1)


def ensure_dirs():
    os.makedirs(BACKUPS, exist_ok=True)
    if not os.path.exists(USERS_FILE):
        json.dump(DEFAULT_USERS, open(USERS_FILE, "w"), indent=1)


def users():
    ensure_dirs()
    return json.load(open(USERS_FILE))


def user_ok(uid):
    return re.fullmatch(r"[a-z0-9_-]{1,32}", uid or "") and any(u["id"] == uid for u in users())


DEFAULT_COURSE = "de-a1"  # German A1 keeps the original file names (progress/<user>.json)


def course_of(handler):
    m = re.search(r"[?&]c=([a-z0-9_-]{1,40})", handler.path)
    return m.group(1) if m else DEFAULT_COURSE


def state_path(uid, course=DEFAULT_COURSE):
    return os.path.join(DATA, uid + (".json" if course == DEFAULT_COURSE else f"@{course}.json"))


def read_state(uid, course=DEFAULT_COURSE):
    try:
        return json.load(open(state_path(uid, course)))
    except (FileNotFoundError, ValueError):
        return None


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=APP, **kw)

    def log_message(self, fmt, *args):  # keep the terminal quiet except for API writes / errors
        if "/audio/" not in self.path or (args and str(args[1])[:1] in "45"):
            sys.stderr.write("%s from %s: %s\n" % (self.log_date_time_string(), self.client_address[0], fmt % args))
            sys.stderr.flush()

    def end_headers(self):
        if "/audio/" not in self.path:
            self.send_header("Cache-Control", "no-cache")  # always pick up app updates
        super().end_headers()

    def send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        p = self.path.split("?")[0]
        if p == "/api/users":
            return self.send_json(users())
        if p == "/api/states":
            c = course_of(self)
            return self.send_json({u["id"]: read_state(u["id"], c) for u in users()})
        m = re.fullmatch(r"/api/state/([^/]+)", p)
        if m:
            if not user_ok(m.group(1)):
                return self.send_json({"error": "unknown user"}, 404)
            return self.send_json({"state": read_state(m.group(1), course_of(self))})
        return super().do_GET()

    def do_PUT(self):
        m = re.fullmatch(r"/api/state/([^/]+)", self.path.split("?")[0])
        if not m or not user_ok(m.group(1)):
            return self.send_json({"error": "unknown user"}, 404)
        uid, course = m.group(1), course_of(self)
        try:
            n = int(self.headers.get("Content-Length", 0))
            if n > 5_000_000:
                return self.send_json({"error": "too large"}, 413)
            new = json.loads(self.rfile.read(n))
            assert isinstance(new, dict) and "settings" in new and "words" in new
        except Exception:
            return self.send_json({"error": "bad state"}, 400)
        old = read_state(uid, course)
        if old and old.get("updated", 0) > new.get("updated", 0):
            return self.send_json({"ok": False, "conflict": True, "state": old}, 409)  # another device saved newer data
        path = state_path(uid, course)
        tag = uid if course == DEFAULT_COURSE else f"{uid}@{course}"
        backup = os.path.join(BACKUPS, f"{tag}-{date.today().isoformat()}.json")
        if old and not os.path.exists(backup):
            shutil.copy(path, backup)
        tmp = path + ".tmp"
        with open(tmp, "w") as f:
            json.dump(new, f, ensure_ascii=False)
        os.replace(tmp, path)
        return self.send_json({"ok": True, "saved": int(time.time() * 1000)})


if __name__ == "__main__":
    srv = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Deutsch A1 running on http://localhost:{PORT}  (progress saved in {DATA})", flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass

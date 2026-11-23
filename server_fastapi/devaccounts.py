"""Developer accounts for testing on the live app (usernames start with "_", e.g. _test_user1).

Sign-up refuses usernames starting with "_", so these only exist because this script creates them. They are hidden
from /api/users for ordinary learners. Run it on the machine that holds the data (the droplet: A1_DATA=~/levelup-data).

    uv run python server_fastapi/devaccounts.py create [N]          # _test_user1.._test_userN (default 3); new ones get a random password, printed once
    uv run python server_fastapi/devaccounts.py nudge <from> <to>   # a test party nudge to <to>; their phone shows it within ~15 min
    LU_PASSWORD=<pw> ...  create                                    # use one password for the new accounts instead
"""
import json
import os
import secrets
import sys
import time
from datetime import date

import auth

PREFIX = "_"
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get("A1_DATA") or os.path.join(os.path.dirname(HERE), "progress")
USERS = os.path.join(DATA, "users.json")
PGATES = os.path.join(DATA, "party_gates.json")


def _write(path: str, obj) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(obj, f, indent=1, ensure_ascii=False)
    os.replace(tmp, path)


def _load(path: str, default):
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, ValueError):
        return default


def create(n: int) -> None:
    us = _load(USERS, [])
    for i in range(1, n + 1):
        uid = f"{PREFIX}test_user{i}"
        if any(u["id"] == uid for u in us):
            print(f"{uid}: exists, left as it is")
            continue
        us.append({"id": uid, "name": f"Test user {i}", "color": "#64748b"})
        pw = os.environ.get("LU_PASSWORD") or secrets.token_urlsafe(9)
        auth.set_password(DATA, uid, pw)
        print(f"{uid}: created, password {pw}")
    _write(USERS, us)


def nudge(frm: str, to: str) -> None:
    us = {u["id"]: u for u in _load(USERS, [])}
    if frm not in us or to not in us:
        sys.exit(f"unknown learner: {frm if frm not in us else to}")
    if not frm.startswith(PREFIX):
        sys.exit("a test nudge must come from a developer account (name starts with _)")
    d = _load(PGATES, {})
    d.setdefault("gates", {})
    d.setdefault("nudges", [])
    now = int(time.time() * 1000)
    d["nudges"].append({"id": "n" + format(now, "x"), "from": frm, "to": to, "gate": "_test", "title": "Test notification",
                        "icon": "🔔", "day": date.today().isoformat(), "at": now, "seen": False})
    _write(PGATES, d)
    print(f"nudge queued from {frm} to {to}")


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["create"]:
        create(int(a[1]) if len(a) > 1 else 3)
    elif a[:1] == ["nudge"] and len(a) == 3:
        nudge(a[1], a[2])
    else:
        sys.exit(__doc__)

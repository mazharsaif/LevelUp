"""Time per card (feedback 5028): how many seconds each learner spends on each reader card and lesson step.

The app sends small batches to POST /api/cardtime. This module appends them to <data>/cardtime/YYYY-MM.jsonl,
one line per card visit: {t, user, course, card, title, kind, s, asked}. Nothing the learner typed is stored.

Read the log on the droplet (slowest cards first):
    cd ~/LevelUp/server_fastapi && A1_DATA=~/levelup-data uv run python cardtime.py [--days 30] [--course ds-basics] [--top 30]
Developer accounts (user ids that start with "_") are left out of the summary.
"""

import argparse
import json
import os
import statistics
import threading
import time
from collections import defaultdict
from datetime import datetime, timedelta

MAX_S = 600          # one visit counts at most 10 minutes (a phone left open on a card)
MAX_BATCH = 100      # records per request
MAX_PER_HOUR = 2000  # records per learner per hour
_lock = threading.Lock()
_hits: dict[str, list[tuple[float, int]]] = {}


def _dir(data: str) -> str:
    d = os.path.join(data, "cardtime")
    os.makedirs(d, exist_ok=True)
    return d


def allowed(uid: str, n: int) -> bool:
    """Rate limit per learner: at most MAX_PER_HOUR records in the last hour."""
    now = time.time()
    with _lock:
        hits = [(t, k) for t, k in _hits.get(uid, []) if now - t < 3600]
        if sum(k for _, k in hits) + n > MAX_PER_HOUR:
            _hits[uid] = hits
            return False
        _hits[uid] = hits + [(now, n)]
        return True


def record(data: str, uid: str, recs: list[dict]) -> int:
    """Append the visits to this month's log. Returns how many lines were written."""
    t = datetime.now().isoformat(timespec="seconds")
    lines = []
    for r in recs:
        s = int(r.get("s") or 0)
        if s < 1:
            continue
        lines.append(json.dumps({"t": t, "user": uid, "course": r.get("course", ""), "card": r.get("card", ""),
                                 "title": r.get("title", ""), "kind": r.get("kind", ""), "s": min(s, MAX_S),
                                 "asked": bool(r.get("asked"))}, ensure_ascii=False))
    if lines:
        with _lock, open(os.path.join(_dir(data), datetime.now().strftime("%Y-%m") + ".jsonl"), "a", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
    return len(lines)


def load(data: str, days: int) -> list[dict]:
    """All visits from the last `days` days, developer accounts left out."""
    since = (datetime.now() - timedelta(days=days)).isoformat(timespec="seconds")
    d = os.path.join(data, "cardtime")
    out: list[dict] = []
    if not os.path.isdir(d):
        return out
    for name in sorted(os.listdir(d)):
        if not name.endswith(".jsonl"):
            continue
        with open(os.path.join(d, name), encoding="utf-8") as f:
            for line in f:
                try:
                    r = json.loads(line)
                except ValueError:
                    continue
                if r.get("t", "") >= since and not str(r.get("user", "")).startswith("_"):
                    out.append(r)
    return out


def summary(recs: list[dict], course: str = "", top: int = 30) -> list[dict]:
    """One row per card: visits, learners, median and longest seconds, how often the helper was opened. Slowest first."""
    by: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for r in recs:
        if course and r.get("course") != course:
            continue
        by[(r.get("course", ""), r.get("card", ""))].append(r)
    rows = []
    for (c, card), rs in by.items():
        secs = [r["s"] for r in rs]
        rows.append({"course": c, "card": card, "title": rs[-1].get("title", ""), "kind": rs[-1].get("kind", ""),
                     "visits": len(rs), "learners": len({r.get("user") for r in rs}),
                     "median_s": statistics.median(secs), "max_s": max(secs), "asked": sum(1 for r in rs if r.get("asked"))})
    rows.sort(key=lambda x: (x["median_s"], x["visits"]), reverse=True)
    return rows[:top]


def main() -> None:
    p = argparse.ArgumentParser(description="Slowest cards from the time-per-card log.")
    p.add_argument("--days", type=int, default=30)
    p.add_argument("--course", default="")
    p.add_argument("--top", type=int, default=30)
    a = p.parse_args()
    data = os.environ.get("A1_DATA") or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "progress")
    rows = summary(load(data, a.days), a.course, a.top)
    if not rows:
        print("No card times in this period.")
        return
    print(f"{'median':>6} {'max':>4} {'visits':>6} {'people':>6} {'asked':>5}  course / card / title")
    for r in rows:
        print(f"{r['median_s']:>5.0f}s {r['max_s']:>3}s {r['visits']:>6} {r['learners']:>6} {r['asked']:>5}  "
              f"{r['course']} / {r['card']} ({r['kind']}) {r['title'][:60]}")


if __name__ == "__main__":
    main()

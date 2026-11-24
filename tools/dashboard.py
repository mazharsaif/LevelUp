#!/usr/bin/env python3
"""Usage dashboard for the live app (read-only).

    uv run tools/dashboard.py            # fetch from the droplet, write private/dashboard.html, open it
    uv run tools/dashboard.py --no-open

Runs a small aggregation script on the droplet over ssh and brings back only counts, dates and track titles
(no password hashes, no session tokens, no private-track titles). Dev accounts (`_...`) are left out.
Last login = newest session cookie's start (session expiry minus 90 days); sessions are pruned only at the
next login, so this is exact for anyone who has logged in within 90 days.
"""
import html, json, subprocess, sys, datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "private" / "dashboard.html"
SESSION_DAYS = 90

REMOTE = r'''
import json, os, time, glob
D = os.path.expanduser("~/levelup-data")
def load(f, d=None):
    try: return json.load(open(os.path.join(D, f)))
    except Exception: return d
users = load("users.json", [])
sess = load("sessions.json", {})
act = load("activity.json", {})
last_exp = {}
for v in sess.values():
    last_exp[v["uid"]] = max(last_exp.get(v["uid"], 0), v.get("exp", 0))
out = []
for u in users:
    uid = u["id"]
    if uid.startswith("_"): continue
    courses = []
    for f in sorted(glob.glob(os.path.join(D, uid + ".json")) + glob.glob(os.path.join(D, uid + "@*.json"))):
        cid = os.path.basename(f)[:-5]
        cid = cid.split("@", 1)[1] if "@" in cid else "de-a1"
        try: st = json.load(open(f))
        except Exception: continue
        xp = st.get("xp") or {}
        tracks = []
        for t in (st.get("tracks") or {}).values():
            if t.get("status") == "active":
                tracks.append({"title": None if t.get("private") else (t.get("title") or ""), "days": t.get("days"), "start": t.get("start")})
        courses.append({"course": cid, "updated": st.get("updated"), "created": st.get("created"),
                        "xp": {k: v for k, v in xp.items()}, "words": len(st.get("words") or {}),
                        "done": len(st.get("done") or {}), "setup": bool(st.get("setup")), "tracks": tracks})
    out.append({"id": uid, "name": u.get("name"), "color": u.get("color"), "last_exp": last_exp.get(uid), "last_login": (act.get(uid) or {}).get("last_login"), "logins": (act.get(uid) or {}).get("logins"), "last_seen": (act.get(uid) or {}).get("last_seen"), "courses": courses})
print(json.dumps({"now": int(time.time()), "users": out}))
'''

def fetch():
    r = subprocess.run(["ssh", "levelup-droplet", "python3", "-"], input=REMOTE, text=True, capture_output=True)
    if r.returncode:
        sys.exit("ssh failed (see the deploy skill, step 3: ssh-add):\n" + r.stderr)
    return json.loads(r.stdout)

def course_names():
    c = json.load(open(ROOT / "app/data/courses.json"))
    return {x["id"]: x["title"] for x in (c if isinstance(c, list) else c.get("courses", c))}

def ago(sec):
    if sec is None: return "never"
    d = sec / 86400
    if sec < 3600: return "just now"
    if sec < 86400: return f"{int(sec // 3600)} h ago"
    if d < 60: return f"{int(d)} d ago"
    return f"{int(d // 30)} mo ago"

def build(data):
    names, now = course_names(), data["now"]
    today = dt.datetime.fromtimestamp(now).date()
    days14 = [(today - dt.timedelta(days=i)).isoformat() for i in range(13, -1, -1)]
    def xp_in(c, n): return sum(c["xp"].get(d, 0) for d in [(today - dt.timedelta(days=i)).isoformat() for i in range(n)])
    rows, active7 = [], 0
    for u in data["users"]:
        login = u.get("last_login") or ((u["last_exp"] - SESSION_DAYS * 86400) if u["last_exp"] else None)
        cs = []
        best_act = None
        for c in u["courses"]:
            upd = c["updated"] / 1000 if c.get("updated") else None
            if upd: best_act = max(best_act or 0, upd)
            cs.append({**c, "x7": xp_in(c, 7), "x30": xp_in(c, 30), "upd": upd,
                       "bars": [c["xp"].get(d, 0) for d in days14],
                       "last_xp_day": max((d for d, v in c["xp"].items() if v), default=None)})
        used7 = any(c["x7"] > 0 for c in cs)
        active7 += used7
        status = "active" if used7 else ("idle" if best_act and now - best_act < 30 * 86400 else ("dormant" if best_act else "never started"))
        rows.append({**u, "login": login, "cs": cs, "act": best_act, "status": status, "x7": sum(c["x7"] for c in cs)})
    order = {"active": 0, "idle": 1, "dormant": 2, "never started": 3}
    rows.sort(key=lambda r: (order[r["status"]], -(r["act"] or 0)))
    e = html.escape
    def bars(v):
        m = max(max(v), 1)
        return '<span class="bars">' + "".join(f'<i style="height:{max(2, int(18 * x / m)) if x else 2}px" class="{"on" if x else ""}" title="{x} XP"></i>' for x in v) + "</span>"
    cards = []
    for r in rows:
        crs = ""
        for c in sorted(r["cs"], key=lambda c: -c["x7"]):
            tr = c["tracks"]
            tr_html = ""
            if tr:
                tr_html = '<div class="tr">Active gates: ' + ", ".join(e(t["title"]) if t["title"] else "🔒 private" for t in tr) + "</div>"
            use = "using" if c["x7"] else ("used " + ago(now - c["upd"]) if c["upd"] else "not started")
            crs += (f'<div class="crs {"hot" if c["x7"] else ""}"><div class="cn"><b>{e(names.get(c["course"], c["course"]))}</b>'
                    f'<span class="tag {"t-on" if c["x7"] else ""}">{use}</span></div>'
                    f'<div class="cm">{bars(c["bars"])}<span>{c["x7"]} XP · 7 d &nbsp; {c["x30"]} XP · 30 d &nbsp; {c["words"]} words &nbsp; {c["done"]} items done</span></div>{tr_html}</div>')
        login_s = (ago(now - r["login"]) + ("" if r.get("last_login") else " (est.)")) if r["login"] else "no valid session"
        seen_s = ago(now - r["last_seen"]) if r.get("last_seen") else "not recorded yet"
        act_s = ago(now - r["act"]) if r["act"] else "never"
        cards.append(f'''<div class="u s-{r["status"].replace(" ", "-")}"><div class="uh"><span class="dot" style="background:{e(r["color"] or "#888")}"></span>
<b>{e(r["name"] or r["id"])}</b> <span class="id">@{e(r["id"])}</span><span class="st">{r["status"]}</span></div>
<div class="ur"><span>Last login <b>{login_s}</b></span><span>Last opened <b>{seen_s}</b></span><span>Last activity <b>{act_s}</b></span><span>XP 7 d <b>{r["x7"]}</b></span></div>{crs or '<div class="crs">No course started</div>'}</div>''')
    n = len(rows)
    stamp = dt.datetime.fromtimestamp(now).strftime("%d %b %Y %H:%M")
    return f'''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LevelUp users</title>
<style>:root{{--bg:#f6f6f4;--card:#fff;--ink:#1c1c1a;--mut:#6b6b66;--ln:#e4e4df;--on:#1f9d55;--idle:#c98a00;--dorm:#b0443a}}
@media(prefers-color-scheme:dark){{:root{{--bg:#151514;--card:#1f1f1d;--ink:#ecece8;--mut:#9a9a93;--ln:#32322f}}}}
body{{margin:0;font:15px/1.45 system-ui,sans-serif;background:var(--bg);color:var(--ink)}}main{{max-width:880px;margin:0 auto;padding:24px 16px 48px}}
h1{{margin:0 0 4px}}.sub{{color:var(--mut);margin:0 0 18px}}.kpi{{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}}
.kpi div{{background:var(--card);border:1px solid var(--ln);border-radius:10px;padding:10px 14px;min-width:120px}}.kpi b{{display:block;font-size:24px}}.kpi span{{color:var(--mut);font-size:13px}}
.u{{background:var(--card);border:1px solid var(--ln);border-left:4px solid var(--ln);border-radius:10px;padding:12px 14px;margin-bottom:10px}}
.s-active{{border-left-color:var(--on)}}.s-idle{{border-left-color:var(--idle)}}.s-dormant,.s-never-started{{border-left-color:var(--dorm)}}
.uh{{display:flex;align-items:center;gap:8px;flex-wrap:wrap}}.dot{{width:12px;height:12px;border-radius:50%}}.id{{color:var(--mut);font-size:13px}}
.st{{margin-left:auto;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:var(--mut)}}.s-active .st{{color:var(--on)}}.s-idle .st{{color:var(--idle)}}.s-dormant .st,.s-never-started .st{{color:var(--dorm)}}
.ur{{display:flex;gap:18px;flex-wrap:wrap;color:var(--mut);font-size:13px;margin:6px 0 4px}}.ur b{{color:var(--ink)}}
.crs{{border-top:1px solid var(--ln);padding:8px 0 2px;margin-top:6px;opacity:.75}}.crs.hot{{opacity:1}}.cn{{display:flex;gap:8px;align-items:center}}
.tag{{font-size:12px;color:var(--mut);border:1px solid var(--ln);border-radius:20px;padding:0 8px}}.t-on{{color:var(--on);border-color:var(--on)}}
.cm{{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;color:var(--mut);font-size:13px;margin-top:4px}}.tr{{font-size:13px;margin-top:4px}}
.bars{{display:inline-flex;gap:2px;align-items:flex-end;height:18px}}.bars i{{width:5px;background:var(--ln);border-radius:1px;display:block}}.bars i.on{{background:var(--on)}}</style>
<main><h1>LevelUp users</h1><p class="sub">Live app · generated {stamp} · dev accounts left out · private data, keep this file local</p>
<div class="kpi"><div><b>{n}</b><span>signed-up learners</span></div><div><b>{active7}</b><span>earned XP in the last 7 days</span></div>
<div><b>{sum(r["status"]=="idle" for r in rows)}</b><span>idle (active in 30 d)</span></div><div><b>{sum(r["status"] in ("dormant","never started") for r in rows)}</b><span>dormant / never started</span></div></div>
{"".join(cards)}<p class="sub">Active = earned XP in the last 7 days. Bars = XP per day for the last 14 days. Last login and last opened come from activity.json (recorded since this release; "(est.)" = estimated from the newest session cookie for logins before that).</p></main>'''

if __name__ == "__main__":
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(build(fetch()), encoding="utf-8")
    print("wrote", OUT)
    if "--no-open" not in sys.argv:
        subprocess.run(["open", str(OUT)])

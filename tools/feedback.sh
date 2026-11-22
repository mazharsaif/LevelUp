#!/usr/bin/env bash
# List open in-app feedback reports from the droplet (~/levelup-data/bugs/*.json).
#   tools/feedback.sh            short list of open reports (used by the SessionStart hook)
#   tools/feedback.sh --full ID  one report's full JSON
#   tools/feedback.sh --fix ID…  set "status": "fixed" on those reports
# Read-only unless --fix. Never fails loudly: an unreachable droplet prints one line.
set -u
SSH=(ssh -o ConnectTimeout=6 -o BatchMode=yes levelup-droplet)

case "${1:-}" in
  --full)
    shift; "${SSH[@]}" "cat ~/levelup-data/bugs/$1.json"; exit ;;
  --fix)
    shift
    "${SSH[@]}" "cd ~/levelup-data/bugs && python3 - $*" <<'PY'
import json, sys
for i in sys.argv[1:]:
    p = f"{i}.json"
    d = json.load(open(p))
    d["status"] = "fixed"
    json.dump(d, open(p, "w"), indent=1, ensure_ascii=False)
    print("fixed", i)
PY
    exit ;;
esac

out=$("${SSH[@]}" "cd ~/levelup-data/bugs && python3 -" 2>/dev/null <<'PY'
import json, glob
OWN = {"taha", "mazhar"}
rows = []
for f in sorted(glob.glob("*.json")):
    try:
        d = json.load(open(f))
    except Exception:
        continue
    if d.get("status") == "fixed":
        continue
    ctx = d.get("ctx") or {}
    user = ctx.get("user") or "?"
    text = " ".join((d.get("text") or "").split())
    if len(text) > 220:
        text = text[:217] + "..."
    tag = "" if user in OWN else "  [needs approval]"
    rows.append(f"- {d.get('id')} | {d.get('status')} | {d.get('category')} | {user} | "
                f"{ctx.get('page') or ''}{tag}\n    {text}")
if rows:
    print(f"LevelUp open feedback ({len(rows)} reports, oldest first):")
    print("\n".join(rows))
    print("Details: tools/feedback.sh --full <id>. Handle with the `feedback` skill.")
else:
    print("LevelUp feedback: no open reports.")
PY
) || out="LevelUp feedback: could not reach the droplet (ssh levelup-droplet); run tools/feedback.sh later."
echo "$out"

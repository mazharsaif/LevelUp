#!/usr/bin/env python3
"""Add (or update) one skill-tree branch in LevelUp's app/data/se-path.json from a spec file.

    python3 add_branch.py <LevelUp dir> <spec.json> [--update]

spec.json:
{
  "branch": {"id": "jwt", "title": "JWT Auth for AI", "icon": "🎟️", "color": "#8BD450"},   # order/status/reading/intro are filled in
  "nodes": [
    {"key": "foundations", "level": 0, "col": 1, "req": [], "icon": "🪪", "title": "...", "short": "...",
     "learn": ["...", "...", "...", "..."], "concepts": ["..."], "exercises": ["Concept check", "..."],
     "chapter": 1, "mins": 10, "boss": false},
    ...
  ]
}
- Node ids become "<branch>.<key>"; req lists keys. n = position in the list (1-based).
- "mins" may be omitted: an existing node keeps its current value; a new node gets ~200 words a minute
  from content/se/<branch>/NN.md.
- Without --update the branch must not exist yet. With --update, existing node ids are kept (learner progress is
  keyed by node id), new nodes are added, and nodes missing from the spec are refused (never silently dropped).
Validates: unique ids, req exist and sit on a lower level, col in 0..2, no two nodes on the same level+col,
chapter files exist, title fits two 15-char lines, no crossing edges, no col 0<->2 jump over a node in col 1
(warns when an edge skips a row). Writes JSON with indent=2, ensure_ascii=False.
"""
import json
import math
import os
import re
import sys


def fits(title: str) -> bool:
    lines, cur = [], ""
    for w in title.split(" "):
        if len((cur + " " + w).strip()) > 15:
            lines.append(cur)
            cur = w
        else:
            cur = (cur + " " + w).strip()
    lines.append(cur)
    return len([l for l in lines if l]) <= 2


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    app, spec_path = sys.argv[1], sys.argv[2]
    update = "--update" in sys.argv
    p = os.path.join(app, "app", "data", "se-path.json")
    raw = open(p, encoding="utf-8").read()
    d = json.loads(raw)
    spec = json.load(open(spec_path, encoding="utf-8"))
    b = dict(spec["branch"])
    bid = b["id"]
    errs = []
    existing = next((x for x in d["branches"] if x["id"] == bid), None)
    if existing and not update:
        sys.exit(f"branch '{bid}' already exists: use --update")
    content = os.path.join(app, "content", "se", bid)
    prev = {n["id"]: n for n in d["nodes"] if n["branch"] == bid}
    nodes, seen, pos = [], set(), {}
    for i, s in enumerate(spec["nodes"], 1):
        nid = f"{bid}.{s['key']}"
        if nid in seen:
            errs.append(f"duplicate node {nid}")
        seen.add(nid)
        ch = s.get("chapter", i)
        f = os.path.join(content, f"{ch:02d}.md")
        if not os.path.exists(f):
            errs.append(f"{nid}: missing chapter file {f}")
            mins = s.get("mins", 10)
        else:
            mins = s.get("mins") or prev.get(nid, {}).get("mins") or \
                max(5, math.ceil(len(re.findall(r'\w+', open(f, encoding='utf-8').read())) / 200))
        if s["col"] not in (0, 1, 2):
            errs.append(f"{nid}: col must be 0, 1 or 2")
        if (s["level"], s["col"]) in pos:
            errs.append(f"{nid}: same level/col as {pos[(s['level'], s['col'])]}")
        pos[(s["level"], s["col"])] = nid
        if not fits(s["title"]):
            errs.append(f"{nid}: title '{s['title']}' needs more than two 15-char lines")
        n = {"id": nid, "branch": bid, "n": i, "level": s["level"], "col": s["col"], "icon": s["icon"],
             "req": [f"{bid}.{r}" for r in s.get("req", [])], "mins": mins, "chapter": ch,
             "title": s["title"], "short": s["short"], "learn": s["learn"], "concepts": s["concepts"],
             "exercises": s["exercises"]}
        if s.get("boss"):
            n["boss"] = True
        if prev.get(nid, {}).get("parts"):   # parts come from tools/build_se_content.py; keep them
            n["parts"] = prev[nid]["parts"]
        if nid in prev:                      # keep the existing key order so git diffs stay minimal
            n = {**{k: n[k] for k in prev[nid] if k in n}, **n}
        nodes.append(n)
    lv = {n["id"]: n["level"] for n in nodes}
    for n in nodes:
        for r in n["req"]:
            if r not in lv:
                errs.append(f"{n['id']}: unknown req {r}")
            elif lv[r] >= n["level"]:
                errs.append(f"{n['id']}: req {r} must be on a lower level")
    # drawing checks: the tree is drawn with curved edges between rows; keep them readable
    at = {n["id"]: (n["level"], n["col"]) for n in nodes}
    edges = [(at[r], at[n["id"]], r, n["id"]) for n in nodes for r in n["req"] if r in at]
    occupied = {(l, c) for l, c in at.values()}
    warns = []
    for (pl, pc), (cl, cc), r, nid in edges:
        if cl - pl > 1:
            warns.append(f"{r} -> {nid} skips {cl - pl - 1} row(s); the line runs past the rows in between")
        if abs(cc - pc) == 2 and cl - pl == 1 and (cl, 1) in occupied:
            errs.append(f"{r} -> {nid} jumps col {pc} to {cc} over the node in col 1 on its row; move a node or change req")
    for i, (a1, a2, ar, an) in enumerate(edges):
        for b1, b2, br, bn in edges[i + 1:]:
            if a1[0] == b1[0] and a2[0] == b2[0] and (a1[1] - b1[1]) * (a2[1] - b2[1]) < 0:
                errs.append(f"edges {ar}->{an} and {br}->{bn} cross")
    for w in warns:
        print("warning:", w)
    if not any(not n["req"] for n in nodes):
        errs.append("no starting node (a node with req [])")
    if update and existing:
        old = {n["id"] for n in d["nodes"] if n["branch"] == bid}
        gone = old - seen
        if gone:
            errs.append(f"--update would drop nodes {sorted(gone)} (learner progress is keyed by id); keep them in the spec")
    if not os.path.exists(os.path.join(content, "00.md")):
        print("note: no 00.md, the branch gets no About button")
    if errs:
        sys.exit("refused:\n  " + "\n  ".join(errs))
    # keep the file's node order: the branch's nodes stay where they were, new ones follow its last node
    out, placed = [], False
    for n in d["nodes"]:
        if n["branch"] != bid:
            out.append(n)
        elif not placed:
            out.extend(nodes)
            placed = True
    if not placed:
        out.extend(nodes)
    d["nodes"] = out
    b.setdefault("status", "open")
    b.setdefault("reading", f"data/se/{bid}/")
    if os.path.exists(os.path.join(content, "00.md")):
        b.setdefault("intro", 0)
    if existing:
        b.setdefault("order", existing["order"])
        b = {**{k: b[k] for k in existing if k in b}, **b}      # keep the existing key order
        d["branches"] = [b if x["id"] == bid else x for x in d["branches"]]
    else:
        b.setdefault("order", max(x["order"] for x in d["branches"]) + 1)
        used = {x["color"].lower() for x in d["branches"]}
        if b["color"].lower() in used:
            sys.exit(f"refused: colour {b['color']} is already used by another branch")
        d["branches"].append(b)
    with open(p, "w", encoding="utf-8") as f:
        f.write(json.dumps(d, ensure_ascii=False, indent=2) + ("\n" if raw.endswith("\n") else ""))
    print(f"{'updated' if existing else 'added'} branch {bid}: {len(nodes)} nodes, order {b['order']}, "
          f"{sum(n['mins'] for n in nodes)} min of reading")


if __name__ == "__main__":
    main()

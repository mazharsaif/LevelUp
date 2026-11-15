#!/usr/bin/env python3
"""Turn the Software Engineering guide (content/se/<branch>/NN.md) into bite-sized reading cards for the app.

Output: app/data/se/<branch>/NN.json  ->  {"title", "cards": [{"s", "sub", "html", "words"}]}  plus  <branch>/index.json (sizes)
Each card is one idea: roughly 60-150 words of text, or one table, or one code example with its lead-in.
Standard library only.  Run:  python3 tools/build_se_content.py
"""
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "content", "se")
OUT = os.path.join(ROOT, "app", "data", "se")
TARGET, MIN_FLUSH = 130, 45          # words per card: aim, and the least we flush before a big block


def inline(text: str) -> str:
    """Escape, then apply `code`, **bold**, *italic*, [links](url)."""
    parts = re.split(r"(`[^`]+`)", text)
    out = []
    for p in parts:
        if p.startswith("`") and p.endswith("`") and len(p) > 1:
            out.append("<code>" + html.escape(p[1:-1]) + "</code>")
            continue
        p = html.escape(p, quote=False)
        p = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r'<a href="\2" target="_blank" rel="noopener">\1</a>', p)
        p = re.sub(r"(?<![\w\"'>])(https?://[^\s<)]+[^\s<).,;:])", r'<a href="\1" target="_blank" rel="noopener">\1</a>', p)
        p = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", p)
        p = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<i>\1</i>", p)
        out.append(p)
    return "".join(out)


def words(s: str) -> int:
    return len(re.findall(r"\w+", re.sub(r"<[^>]+>", " ", s)))


def parse_blocks(md: str):
    """Yield (kind, data) blocks: h2/h3/h4, p, ul, ol, table, code."""
    lines = md.splitlines()
    i, n = 0, len(lines)
    while i < n:
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        m = re.match(r"^(#{2,4})\s+(.*)", line)
        if m:
            yield ("h%d" % len(m.group(1)), m.group(2).strip())
            i += 1
            continue
        if line.startswith("```"):
            lang = line[3:].strip()
            body = []
            i += 1
            while i < n and not lines[i].startswith("```"):
                body.append(lines[i])
                i += 1
            i += 1
            yield ("code", (lang, "\n".join(body)))
            continue
        if line.lstrip().startswith("|"):
            rows = []
            while i < n and lines[i].lstrip().startswith("|"):
                rows.append(lines[i].strip())
                i += 1
            yield ("table", rows)
            continue
        if re.match(r"^\s*([-*]|\d+\.)\s+", line):
            ordered = bool(re.match(r"^\s*\d+\.", line))
            start = int(re.match(r"^\s*(\d+)", line).group(1)) if ordered else 1
            items = []
            while i < n and lines[i].strip() and (re.match(r"^\s*([-*]|\d+\.)\s+", lines[i]) or lines[i].startswith("    ")):
                if re.match(r"^\s*([-*]|\d+\.)\s+", lines[i]) and not lines[i].startswith("    "):
                    items.append(re.sub(r"^\s*([-*]|\d+\.)\s+", "", lines[i]))
                else:
                    items[-1] += " " + lines[i].strip()
                i += 1
            yield ("ol" if ordered else "ul", (items, start))
            continue
        para = [line.strip()]
        i += 1
        while i < n and lines[i].strip() and not re.match(r"^(#{2,4}\s|```|\s*\||\s*([-*]|\d+\.)\s)", lines[i]):
            para.append(lines[i].strip())
            i += 1
        yield ("p", " ".join(para))


def render(kind, data) -> str:
    if kind == "p":
        return "<p>" + inline(data) + "</p>"
    if kind in ("ul", "ol"):
        items, start = data
        attr = f' start="{start}"' if kind == "ol" and start != 1 else ""
        return f"<{kind}{attr}>" + "".join("<li>" + inline(x) + "</li>" for x in items) + f"</{kind}>"
    if kind == "code":
        lang, body = data
        return f'<pre class="code" data-lang="{html.escape(lang)}"><code>{html.escape(body)}</code></pre>'
    if kind == "table":
        cells = [[c.strip() for c in r.strip("|").split("|")] for r in data if not re.match(r"^\|[\s:|-]+\|$", r)]
        head, body = cells[0], cells[1:]
        return ('<div class="tablewrap"><table><thead><tr>' + "".join("<th>" + inline(c) + "</th>" for c in head) +
                "</tr></thead><tbody>" + "".join("<tr>" + "".join("<td>" + inline(c) + "</td>" for c in r) + "</tr>" for r in body) +
                "</tbody></table></div>")
    raise ValueError(kind)


def block_weight(kind, data, rendered) -> int:
    if kind == "code":
        return 25 + 4 * data[1].count("\n")            # code reads slowly: count lines heavily
    if kind == "table":
        return 20 + words(rendered)
    return words(rendered)


def split_big(blocks):
    """Long lists split into groups of items; long tables split into row groups (header repeated)."""
    for kind, data in blocks:
        if kind in ("ul", "ol"):
            items, start = data
            group, gw = [], 0
            for it in items:
                w = words(inline(it))
                if group and gw + w > TARGET:
                    yield (kind, (group, start)); start += len(group); group, gw = [], 0
                group.append(it); gw += w
            if group:
                yield (kind, (group, start))
        elif kind == "table":
            rows = [r for r in data]
            head, sep, body = rows[0], rows[1] if len(rows) > 1 else "|---|", rows[2:]
            group, gw = [], 0
            for r in body:
                w = words(inline(r))
                if group and (gw + w > TARGET + 40 or len(group) >= 8):
                    yield ("table", [head, sep] + group); group, gw = [], 0
                group.append(r); gw += w
            yield ("table", [head, sep] + group)
        else:
            yield (kind, data)


def chapter_cards(md: str):
    title, cards = "", []
    section, sub, cur, cur_w = None, None, [], 0

    def flush():
        nonlocal cur, cur_w
        if cur:
            h = "".join(cur)
            cards.append({"s": section or title, "sub": sub, "html": h, "words": words(h)})
        cur, cur_w = [], 0

    for kind, data in split_big(parse_blocks(md)):
        if kind == "h2":
            title = re.sub(r"^\d+\.\s*", "", data)
            continue
        if kind == "h3":
            flush()
            section, sub = data, None
            continue
        if kind == "h4":
            flush()
            sub = data
            continue
        rendered = render(kind, data)
        w = block_weight(kind, data, rendered)
        big = kind in ("code", "table")
        if cur and (cur_w + w > TARGET and cur_w >= MIN_FLUSH or (big and cur_w + w > TARGET * 1.6)):
            # a lead-in ending with ":" belongs on the same card as the block it introduces
            lead = cur.pop() if len(cur) > 1 and kind != "p" and re.search(r":</p>$", cur[-1]) else None
            if lead:
                cur_w -= words(lead)
            flush()
            if lead:
                cur.append(lead)
                cur_w += words(lead)
        cur.append(rendered)
        cur_w += w
        if big and cur_w >= TARGET:          # a code block or table closes its card
            flush()
    flush()
    # merge tiny tail cards into the previous card of the same section
    merged = []
    for c in cards:
        if merged and c["words"] < 25 and merged[-1]["s"] == c["s"] and merged[-1]["sub"] == c["sub"]:
            merged[-1]["html"] += c["html"]
            merged[-1]["words"] += c["words"]
        else:
            merged.append(c)
    return title, merged


def main():
    """One small file per chapter (downloaded only when a learner opens that skill) + a tiny index."""
    import shutil
    os.makedirs(OUT, exist_ok=True)
    for branch in sorted(os.listdir(SRC)):
        bdir = os.path.join(SRC, branch)
        if not os.path.isdir(bdir):
            continue
        odir = os.path.join(OUT, branch)
        shutil.rmtree(odir, ignore_errors=True)
        os.makedirs(odir)
        index = {}
        for name in sorted(os.listdir(bdir)):
            m = re.match(r"^(\d+)\.md$", name)
            if not m:
                continue
            with open(os.path.join(bdir, name), encoding="utf-8") as f:
                title, cards = chapter_cards(f.read())
            n = str(int(m.group(1)))
            body = json.dumps({"title": title, "cards": cards}, ensure_ascii=False, separators=(",", ":"))
            with open(os.path.join(odir, f"{int(n):02d}.json"), "w", encoding="utf-8") as f:
                f.write(body)
            index[n] = {"title": title, "cards": len(cards), "bytes": len(body.encode())}
            print(f"{branch}/{name}: {len(cards):3d} cards, {len(body.encode()) // 1024:3d} KB")
        with open(os.path.join(odir, "index.json"), "w", encoding="utf-8") as f:
            json.dump({"chapters": index}, f, ensure_ascii=False, separators=(",", ":"))
        old = os.path.join(OUT, branch + ".json")          # the earlier all-in-one file
        if os.path.exists(old):
            os.remove(old)
        print(f"-> app/data/se/{branch}/  ({sum(c['cards'] for c in index.values())} cards, {sum(c['bytes'] for c in index.values()) // 1024} KB total)")


if __name__ == "__main__":
    main()

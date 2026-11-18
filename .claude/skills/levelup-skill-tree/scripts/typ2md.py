#!/usr/bin/env python3
"""Convert the CI/CD book's Typst chapters to LevelUp-style Markdown, keeping the text verbatim.
Book `==` -> `###`, `===` -> `####` (the caller groups sections into skills). Boxes become labelled paragraphs.
usage: typ2md.py <source dir> <out dir>
"""
import json, os, re, sys

SRC, OUT = sys.argv[1], sys.argv[2]
CODE = os.path.join(SRC, "..", "code")
FIGS = set()
EXT = {"py": "python", "toml": "toml", "yml": "yaml", "yaml": "yaml", "json": "json", "sh": "bash", "tf": "hcl",
       "md": "markdown", "txt": "text", "cfg": "ini", "ini": "ini", "Dockerfile": "dockerfile"}


def match(s, i, o, c):
    """index just past the bracket that closes s[i] (== o), skipping strings and raw."""
    d, j = 0, i
    while j < len(s):
        ch = s[j]
        if ch == '"' and o in "({":
            j += 1
            while s[j] != '"':
                j += 2 if s[j] == "\\" else 1
        elif ch == "`":
            if s.startswith("```", j):
                j = s.index("```", j + 3) + 2
            else:
                k = s.find("`", j + 1)
                j = k if k > 0 else j
        elif ch == "\\" and o == "[":
            j += 1
        elif ch == o:
            d += 1
        elif ch == c:
            d -= 1
            if d == 0:
                return j + 1
        elif ch in "([{" and ch != o:
            j = match(s, j, ch, {"(": ")", "[": "]", "{": "}"}[ch]) - 1
        j += 1
    raise ValueError("unbalanced at %d: %r" % (i, s[i:i + 60]))


def split_args(s):
    """'a, b: c, [x]' -> [(None,'a'), ('b','c'), (None,'[x]')] at depth 0."""
    out, cur, i = [], "", 0
    while i < len(s):
        ch = s[i]
        if ch in "([{":
            j = match(s, i, ch, {"(": ")", "[": "]", "{": "}"}[ch]); cur += s[i:j]; i = j; continue
        if ch == '"':
            j = i + 1
            while s[j] != '"':
                j += 2 if s[j] == "\\" else 1
            cur += s[i:j + 1]; i = j + 1; continue
        if ch == ",":
            out.append(cur); cur = ""; i += 1; continue
        cur += ch; i += 1
    if cur.strip():
        out.append(cur)
    res = []
    for a in out:
        a = a.strip()
        m = re.match(r"^([a-z][\w-]*)\s*:\s*(.*)$", a, re.S)
        if m and not a.startswith(("[", '"', "(")):
            res.append((m.group(1), m.group(2).strip()))
        elif a.startswith(".."):
            res.append((None, a[2:]))
        else:
            res.append((None, a))
    return res


def string(v):
    v = v.strip()
    assert v.startswith('"'), v[:40]
    return re.sub(r'\\(.)', lambda m: {"n": "\n", "t": "\t", '"': '"', "\\": "\\"}.get(m.group(1), m.group(1)), v[1:-1])


def value(v):
    """an argument -> markdown text"""
    v = v.strip()
    if v.startswith("["):
        return conv(v[1:-1])
    if v.startswith('"'):
        return string(v)
    if v.startswith("("):
        return "\n\n".join(value(x) for _, x in split_args(v[1:-1]))
    m = re.match(r"^([a-z][\w.-]*)", v)
    if m:
        return call(m.group(1), v[m.end():])[0]
    return v


def tuple_items(v):
    v = v.strip()
    return [x for _, x in split_args(v[1:-1])] if v.startswith("(") else [v]


def one_line(md):
    return re.sub(r"\s*\n\s*", " ", md).replace("|", "∣").strip()


def code_block(src, lang, title):
    lead = f"*{title}:*\n\n" if title else ""
    return f"\n\n{lead}```{lang or ''}\n{src.rstrip()}\n```\n\n"


def label(txt, body):
    return f"\n\n**{txt}**\n\n{body.strip()}\n\n"


CHAPTER = {}


def call(name, rest):
    """name + text after it -> (markdown, chars of rest consumed). Reads (args) and [content] groups."""
    i, args, blocks = 0, [], []
    while i < len(rest) and rest[i] in "([":
        j = match(rest, i, rest[i], ")" if rest[i] == "(" else "]")
        if rest[i] == "(":
            args += split_args(rest[i + 1:j - 1])
        else:
            blocks.append("[" + rest[i + 1:j - 1] + "]")
        i = j
    pos = [v for k, v in args if k is None] + blocks
    kw = {k: v for k, v in args if k}
    n = name
    if n in ("v", "pagebreak", "set", "show", "import", "context", "appendix-mode.update", "h"):
        return "", i
    if n in ("happens", "why", "fix"):
        return "\n\n**" + {"happens": "What happens:", "why": "Why:", "fix": "What you do:"}[n] + "** ", i
    if n == "chapter":
        CHAPTER.update(key=string(pos[0]), kicker=string(pos[1]), title=string(pos[2]),
                       intro=one_line(value(kw["intro"])) if "intro" in kw else "",
                       goals=[one_line(value(g)) for g in tuple_items(kw.get("goals", "()")) if g.strip()],
                       builds=one_line(value(kw["builds"])) if "builds" in kw else "")
        return "", i
    if n == "code":
        return code_block(string(pos[0]), string(kw["lang"]) if "lang" in kw else "", string(kw["title"]) if "title" in kw else ""), i
    if n == "term":
        return code_block(string(pos[0]), "bash", string(kw["title"]) if "title" in kw else "terminal"), i
    if n == "out":
        return code_block(string(pos[0]), "text", "expected output"), i
    if n == "file":
        path = string(pos[0]); src = open(os.path.join(CODE, path)).read()
        if "lines" in kw:
            a, b = [int(x) for x in tuple_items(kw["lines"])]
            src = "\n".join(src.split("\n")[a - 1:b])
        base = path.split("/")[-1]; ext = base.rsplit(".", 1)[-1] if "." in base else base
        title = string(kw["title"]) if "title" in kw and kw["title"].startswith('"') else "/".join(path.split("/")[1:])
        return code_block(src, EXT.get(ext, ""), title), i
    if n == "fig":
        FIGS.add(string(pos[0]))
        return f"\n\n![{one_line(value(pos[1]))}](img/{string(pos[0])}.svg)\n\n", i
    if n == "figure":
        img = re.search(r'image\("(?:\.\./)?diagrams/([\w-]+)\.svg"', rest[:i])
        FIGS.add(img.group(1))
        return f"\n\n![{one_line(value(kw['caption'])) if 'caption' in kw else ''}](img/{img.group(1)}.svg)\n\n", i
    if n in ("grid", "two", "text", "block", "box", "align", "pad", "stack"):
        return "\n\n".join(value(v) for v in pos), i
    if n == "tbl":
        head = [one_line(value(h)) for h in tuple_items(kw["header"])]
        cells = [one_line(value(c)) for c in pos]
        rows = [cells[k:k + len(head)] for k in range(0, len(cells), len(head))]
        t = "| " + " | ".join(head) + " |\n|" + "---|" * len(head) + "\n" + "\n".join("| " + " | ".join(r) + " |" for r in rows)
        return "\n\n" + t + "\n\n", i
    if n == "sheet":
        out, rows = [], []
        def flush():
            if rows:
                out.append("| Command | What it does |\n|---|---|\n" + "\n".join(f"| {a} | {b} |" for a, b in rows)); rows.clear()
        for v in pos:
            if v.strip().startswith('"'):
                flush(); out.append("#### " + string(v))
            else:
                a, b = [one_line(value(x)) for x in tuple_items(v)]
                rows.append((a, b))
        flush()
        return "\n\n" + "\n\n".join(out) + "\n\n", i
    if n == "de":
        return f" (*{one_line(value(pos[0]))}*)", i
    if n == "kbd":
        return f"`{string(pos[0])}`", i
    if n in ("concept", "tryit", "watch", "tip"):
        lab = {"concept": "Concept", "tryit": "Try it", "watch": "Watch out", "tip": "Interview tip"}[n]
        t = one_line(value(kw["title"])) if "title" in kw else ""
        return label(f"{lab}: {t}" if t else lab, value(pos[-1])), i
    if n == "callout":
        lab = {"concept": "Concept", "try": "Try it", "watch": "Watch out", "tip": "Interview tip", "check": "Checkpoint"}[string(pos[0])]
        t = one_line(value(kw["title"])) if "title" in kw else ""
        return label(f"{lab}: {t}" if t else lab, value(pos[-1])), i
    if n == "checkpoint":
        return label("Checkpoint: you should now be able to…", value(pos[0])), i
    if n == "whatif":
        return label("What if… " + one_line(value(pos[0])), value(pos[1])), i
    if n == "exercise":
        return label("Exercise: " + one_line(value(pos[0])), value(pos[1])), i
    if n == "qa":
        return label(one_line(value(pos[0])), value(pos[1])), i
    if n == "sol":
        return f"**{string(pos[0]) if pos[0].startswith(chr(34)) else pos[0]} · {one_line(value(pos[1]))}.** ", i
    if n == "topic":
        t, p, m, s = [value(x) for x in pos]
        return f"\n\n#### {one_line(t)}\n\n**Problem:** {one_line(p)}\n\n**You meet it when:** {one_line(m)}\n\n**Say it:** *{one_line(s)}*\n\n", i
    raise ValueError(f"unknown #{n}: {rest[:80]!r}")


def skip_let(s, i):
    """skip a `#let ...` definition starting at s[i] ('#'). Returns the index after it."""
    j = s.index("=", i + 4)
    while s[j + 1] == "=" or s[j - 1] in "!<>=":  # not ==, <=, etc.
        j = s.index("=", j + 2)
    j += 1
    while j < len(s) and s[j] in " \t":
        j += 1
    while j < len(s):
        if s[j] in "([{":
            j = match(s, j, s[j], {"(": ")", "[": "]", "{": "}"}[s[j]])
        elif re.match(r"[\w.\"-]", s[j]):
            m = re.match(r'"(?:\\.|[^"\\])*"|[\w.-]+', s[j:]); j += m.end()
        else:
            break
        if j < len(s) and s[j] == "\n":
            break
    return j


def conv(s):
    out, i, strong, emph = [], 0, False, False
    while i < len(s):
        ch = s[i]
        if s.startswith("```", i):
            j = s.index("```", i + 3) + 3; out.append("\n" + s[i:j] + "\n"); i = j; continue
        if ch == "`":
            j = s.index("`", i + 1) + 1; out.append(s[i:j]); i = j; continue
        if s.startswith("//", i) and (i == 0 or s[i - 1] in " \t\n"):
            j = s.find("\n", i); i = len(s) if j < 0 else j; continue
        if s.startswith("/*", i):
            i = s.index("*/", i) + 2; continue
        if ch == "\\":
            nx = s[i + 1] if i + 1 < len(s) else ""
            if nx in "\n " or nx == "":
                out.append("\n"); i += 2; continue
            out.append(nx); i += 2; continue
        if s.startswith("#{", i):
            j = match(s, i + 1, "{", "}"); body = s[i:j]; i = j
            rows = re.findall(r'\("([^"]*)",\s*"([^"]*)",\s*"([^"]*)"\)', body)
            if rows:
                out.append("\n\n| English | Deutsch | Meaning |\n|---|---|---|\n" + "\n".join(f"| {a} | *{b}* | {c} |" for a, b, c in rows) + "\n\n")
            continue
        if ch == "#":
            m = re.match(r"#([a-z][\w-]*(?:\.[a-z][\w-]*)?)", s[i:])
            if m:
                if m.group(1) == "context":
                    k = i + m.end()
                    while s[k] in " \t": k += 1
                    i = match(s, k, s[k], {"(": ")", "[": "]", "{": "}"}[s[k]]); continue
                if m.group(1) == "let":
                    i = skip_let(s, i); continue
                if m.group(1) in ("set", "show", "import"):
                    j = s.find("\n", i); j = len(s) if j < 0 else j
                    k = i
                    while k < j:
                        if s[k] in "([{":
                            k = match(s, k, s[k], {"(": ")", "[": "]", "{": "}"}[s[k]]); j = max(j, s.find("\n", k) if s.find("\n", k) > 0 else len(s))
                        else:
                            k += 1
                    i = j; continue
                md, used = call(m.group(1), s[i + m.end():]); out.append(md); i += m.end() + used; continue
        if ch == "*":
            out.append("**"); strong = not strong; i += 1; continue
        if ch == "_" and not (i > 0 and s[i - 1].isalnum() and i + 1 < len(s) and s[i + 1].isalnum()):
            out.append("*"); emph = not emph; i += 1; continue
        if ch == "~":
            out.append("\u00a0"); i += 1; continue
        if s.startswith("---", i):
            out.append("—"); i += 3; continue
        if s.startswith("--", i):
            out.append("–"); i += 2; continue
        if s.startswith("...", i):
            out.append("…"); i += 3; continue
        if ch == "\n":
            # headings / list markers at line starts
            j = i + 1
            m = re.match(r"(=+) ", s[j:])
            out.append("\n")
            if m:
                out.append("#" * (len(m.group(1)) + 1) + " "); i = j + m.end(); continue
            m = re.match(r"([ \t]*)\+ ", s[j:])
            if m:
                out.append(m.group(1) + "1. "); i = j + m.end(); continue
            m = re.match(r"([ \t]*)/ ([^:\n]+):", s[j:])
            if m:
                out.append(m.group(1) + "- **" + conv(m.group(2)).strip() + ":**"); i = j + m.end(); continue
            i += 1; continue
        out.append(ch); i += 1
    return "".join(out)


def tidy(md):
    md = re.sub(r"[ \t]+\n", "\n", md)
    lines, res, in_code, in_list = md.split("\n"), [], False, False
    for ln in lines:
        if ln.startswith("```"):
            in_code = not in_code; res.append(ln); in_list = False; continue
        if in_code:
            res.append(ln); continue
        s = ln.strip()
        if re.match(r"^\s*([-*]|\d+\.)\s+", ln) and not s.startswith("**"):
            in_list = True; res.append(s if not ln.startswith("    ") else ln); continue
        if re.match(r"^- \*\*", s):
            in_list = True; res.append(s); continue
        if in_list and s and ln[:1] in " \t" and not s.startswith(("#", "|", "`", "!")):
            res[-1] += " " + s; continue
        if not s:
            in_list = False
        res.append(s if not s.startswith("#") else s)
    md = "\n".join(res)
    return re.sub(r"\n{3,}", "\n\n", md).strip() + "\n"


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    meta = {}
    for f in sorted(os.listdir(os.path.join(SRC, "chapters"))):
        CHAPTER.clear()
        md = tidy(conv("\n" + open(os.path.join(SRC, "chapters", f)).read()))
        name = f.rsplit(".", 1)[0]
        open(os.path.join(OUT, name + ".md"), "w").write(md)
        meta[name] = dict(CHAPTER)
    json.dump({"chapters": meta, "figs": sorted(FIGS)}, open(os.path.join(OUT, "_meta.json"), "w"), indent=1, ensure_ascii=False)
    print("figs:", len(FIGS))

"""Build the French A1 course: content/fr-a1/*.md  ->  app/data/fr-a1.json (+ tools/audio_manifest_fr.json).

Run:  uv run tools/build_fr_content.py            (then: uv run tools/fetch_audio.py --lang fr)
      uv run tools/build_fr_content.py --check    (only validate and print counts)

Sources (all hand-written study material, see docs/french/a1-plan.md):
  content/fr-a1/words/NN-<topic>.md   one file per vocabulary theme
  content/fr-a1/grammar/NN.md         one file per grammar chapter
  content/fr-a1/phrases.md            all phrase topics
  content/fr-a1/path.md               lesson order (V <topic> / G <num> / P <topic>)

The app engine reads the target language from the field `de` (German came first), so the French text is stored in
`de` too; `lang: "fr"` at the top of the file switches the app's language profile (app/js/lang.js).

Audio ids: sha1("fr-FR-DeniseNeural|" + text)[:12], so a French clip can never collide with a German one
(German ids are sha1(text)[:12]) even for identical text ("Taxi", "Paris").

Word line format (one word, then its examples indented with "> "):
  la mère | mother | noun:f | MEHR | note=…; pl=…; fem=…; forms=…; perf=…; alt=a, b; core=no; hi=…; say=…
    > Ma mère est professeure. | My mother is a teacher.
  type: noun:m / noun:f / noun:mpl / noun:fpl, verb, adj., adv., number, prep., pron., phrase, question, exclam., conj., det.
  hint: Latin-letter pronunciation, stressed (last) syllable in CAPITALS. Nasal vowels: ahñ (an/en), ohñ (on), añ (in/ain/un);
        ü = French u (lips round, say "ee"); uh = the soft e / eu; zh = the s in "measure". hintHi is made from it.
"""
import hashlib, html, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "content", "fr-a1")
OUT = os.path.join(ROOT, "app", "data", "fr-a1.json")
MANIFEST = os.path.join(ROOT, "tools", "audio_manifest_fr.json")
VOICE = "fr-FR-DeniseNeural"
CHECK = "--check" in sys.argv
ERR = []

# ---------------------------------------------------------------- French typography
def fr_typo(s):
    """French puts a (no-break) space before ? ! : ; – written as a plain space in the sources, stored as U+00A0
    so the mark never wraps onto its own line on a phone."""
    return re.sub(r" ([?!:;])", "\u00a0\\1", s)

# ---------------------------------------------------------------- audio
AUDIO = {}
def clean_speech(t):
    t = re.sub(r"<[^>]+>", "", t)
    t = html.unescape(t).replace("…", " ").replace("___", " ")
    t = re.sub(r"\s*\([^()]*\)", "", t)          # "(polite)", "(friends)", "(f.)"
    t = re.sub(r"\s+", " ", t).strip(" ,;/")
    return t
def say(text):
    t = clean_speech(text)
    if not t or not re.search(r"[A-Za-zÀ-ÿœŒ]", t):
        return None
    i = hashlib.sha1(f"{VOICE}|{t}".encode("utf-8")).hexdigest()[:12]
    AUDIO[i] = t
    return i

# ---------------------------------------------------------------- Latin hint -> Devanagari (for Hindi speakers)
VOW = {  # token: (independent, matra)
    "ahñ": ("आं", "ां"), "ohñ": ("ओं", "ों"), "oñ": ("ओं", "ों"), "añ": ("ऐं", "ैं"), "uhñ": ("अं", "ं"), "uñ": ("अं", "ं"),
    "ah": ("आ", "ा"), "eh": ("ऐ", "ै"), "ay": ("ए", "े"), "ee": ("ई", "ी"), "oh": ("ओ", "ो"),
    "oo": ("ऊ", "ू"), "uh": ("अ", ""), "ü": ("यू", "्यू"), "o": ("ऑ", "ॉ"), "i": ("इ", "ि"), "e": ("ऐ", "ै"), "a": ("आ", "ा"), "u": ("अ", ""),
}
CON = {"zh": "ज़्ह", "sh": "श", "ny": "न्य", "kw": "क्व", "b": "ब", "d": "द", "f": "फ़", "g": "ग", "k": "क", "l": "ल", "m": "म", "n": "न",
       "p": "प", "r": "र", "s": "स", "t": "त", "v": "व", "w": "व", "y": "य", "z": "ज़", "h": "ह", "j": "ज"}
TOKS = sorted(list(VOW) + list(CON), key=len, reverse=True)
def deva_word(w):
    """One hint word ("kah-truh-VAÑ", lower-cased) -> Devanagari; hyphens stay as syllable breaks."""
    toks, i = [], 0
    while i < len(w):
        if w[i] == "-":
            toks.append("-"); i += 1; continue
        for t in TOKS:
            if w.startswith(t, i):
                toks.append(t); i += len(t); break
        else:
            i += 1  # apostrophes etc.
    out, prev_con = "", False
    for k, t in enumerate(toks):
        if t == "-":
            out += "-"; prev_con = False
        elif t in CON:
            if prev_con:
                out += "्"
            out += CON[t]; prev_con = True
        else:
            ind, mat = VOW[t]
            if prev_con:
                # a soft e at the very end of the word: written like the German hints (डअ)
                out += ("अ" if t in ("uh", "u") and k == len(toks) - 1 else mat)
            else:
                out += ind
            prev_con = False
    return out
def to_deva(hint):
    parts = re.split(r"(\s+|/|,)", hint.lower())
    return "".join(deva_word(p) if re.search(r"[a-zü]", p) else p for p in parts)

# ---------------------------------------------------------------- tiny markdown -> HTML (grammar reader)
def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"\{say:([^}]+)\}", lambda m: f'<button class="spk sm" data-a="{say(html.unescape(m.group(1))) or ""}" data-t="{m.group(1)}">🔊</button> {m.group(1)}', s)
    s = re.sub(r"\{hi:([^}]+)\}", r'<span class="hi">\1</span>', s)
    s = re.sub(r"\{(m|f|pl):([^}]+)\}", lambda m: f'<span class="a{m.group(1)}">{m.group(2)}</span>', s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?!\w)", r"<i>\1</i>", s)
    return s
def ex_html(fr, en):
    return (f'<div class="ex"><button class="spk sm" data-a="{say(fr) or ""}" data-t="{html.escape(fr)}">🔊</button>'
            f'<div class="t"><div>{inline(fr)}</div><div class="muted small">{inline(en)}</div></div></div>')
def md(text):
    out, lines, i = [], text.split("\n"), 0
    while i < len(lines):
        ln = lines[i].rstrip()
        if not ln.strip():
            i += 1; continue
        if ln.startswith("### "):
            out.append(f"<h3>{inline(ln[4:])}</h3>"); i += 1; continue
        m = re.match(r"^\[\[(.+?)\s*\|\s*(.+?)\]\]$", ln.strip())
        if m:
            out.append(ex_html(m.group(1), m.group(2))); i += 1; continue
        if ln.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].startswith("|"):
                rows.append([c.strip() for c in lines[i].strip().strip("|").split("|")]); i += 1
            head, body = rows[0], [r for r in rows[1:] if not re.match(r"^:?-{2,}", r[0] or "--")]
            out.append("<table><thead><tr>" + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr></thead><tbody>"
                       + "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in body) + "</tbody></table>")
            continue
        if ln.startswith(">"):
            buf = []
            while i < len(lines) and lines[i].startswith(">"):
                buf.append(lines[i][1:].strip()); i += 1
            t = " ".join(buf)
            kind = ""
            mk = re.match(r"^(tip|warn|new):\s*(.*)$", t)
            if mk:
                kind, t = " " + mk.group(1), mk.group(2)
            out.append(f'<div class="box{kind}">{inline(t)}</div>'); continue
        if ln.startswith("- "):
            buf = []
            while i < len(lines) and lines[i].startswith("- "):
                buf.append(f"<li>{inline(lines[i][2:])}</li>"); i += 1
            out.append("<ul>" + "".join(buf) + "</ul>"); continue
        buf = []
        while i < len(lines) and lines[i].strip() and not re.match(r"^(### |\||>|- |\[\[)", lines[i]):
            buf.append(lines[i].strip()); i += 1
        out.append(f"<p>{inline(' '.join(buf))}</p>")
    return "".join(out)

# ---------------------------------------------------------------- words
TYPES = {"noun", "verb", "adj.", "adv.", "number", "prep.", "pron.", "phrase", "question", "exclam.", "conj.", "det.", "article"}
def plural(de, g):
    m = re.match(r"^(le|la|l')\s?(.*)$", de)
    if not m:
        return None
    n = m.group(2)
    if " " in n or "(" in n:
        return None
    if re.search(r"[sxz]$", n): p = n
    elif re.search(r"(eau|au|eu)$", n) and n not in ("pneu", "bleu"): p = n + "x"
    elif n.endswith("al") and n not in ("festival", "carnaval", "bal"): p = n[:-2] + "aux"
    else: p = n + "s"
    return "les " + p

TOPICS = {}  # key -> {fr, en, words: [...]}
def parse_words():
    words, n = [], 0
    for fn in sorted(os.listdir(os.path.join(SRC, "words"))):
        if not fn.endswith(".md"):
            continue
        cur, topic = None, None
        for k, raw in enumerate(open(os.path.join(SRC, "words", fn), encoding="utf-8").read().split("\n"), 1):
            line = raw.rstrip()
            where = f"{fn}:{k}"
            if not line.strip() or line.lstrip().startswith("<!--"):
                continue
            if line.startswith("# "):
                key, fr, en = [x.strip() for x in line[2:].split("|")]
                topic = TOPICS.setdefault(key, {"key": key, "fr": fr, "en": en, "words": []})
                continue
            if line.lstrip().startswith(">"):
                if not cur:
                    ERR.append(f"{where}: example before a word"); continue
                fr, _, en = line.lstrip()[1:].partition("|")
                fr, en = fr.strip(), en.strip()
                if not en:
                    ERR.append(f"{where}: example without English")
                cur["ex"].append(dict(de=fr_typo(fr), en=en, a=say(fr)))
                continue
            cols = [c.strip() for c in line.split("|")]
            if len(cols) < 4:
                ERR.append(f"{where}: needs fr | en | type | hint"); continue
            fr, en, typ, hint = cols[:4]
            extra = {}
            if len(cols) > 4 and cols[4]:
                for kv in re.split(r";\s*(?=\w+=)", cols[4]):
                    kk, _, vv = kv.partition("=")
                    extra[kk.strip()] = vv.strip()
            base, _, g = typ.partition(":")
            if base not in TYPES:
                ERR.append(f"{where}: unknown type {typ}")
            w = {"id": f"w{n}", "de": fr, "en": en, "type": base, "topic": topic["en"], "core": extra.get("core") != "no",
                 "hint": hint, "hintHi": extra.get("hi") or to_deva(hint)}
            n += 1
            if base == "noun":
                gg = {"m": "m", "f": "f", "mpl": "pl", "fpl": "pl"}.get(g)
                if not gg:
                    ERR.append(f"{where}: noun needs :m / :f / :mpl / :fpl")
                else:
                    w["g"] = gg
                    if gg != "pl" and not re.match(r"^(le |la |l')", fr) and extra.get("art") != "no":
                        ERR.append(f"{where}: noun should start with le / la / l'")
                    if gg == "pl" and not fr.startswith("les "):
                        ERR.append(f"{where}: plural noun should start with les")
                    if fr.startswith("l'") and gg in ("m", "f"):
                        w["labels"] = ["MASCULINE" if gg == "m" else "FEMININE"]
                pl = extra.get("pl") or (plural(fr, gg) if gg in ("m", "f") else None)
                if pl and pl != "-":
                    w["pl"] = pl
            for kk in ("fem", "forms", "perf"):
                if extra.get(kk):
                    w[kk] = extra[kk]
            if extra.get("note"):
                w["notes"] = [extra["note"]]
            alt = [a.strip() for a in extra.get("alt", "").split(",") if a.strip()]
            if w.get("fem") and base != "noun":
                alt.append(w["fem"])
            elif w.get("fem"):
                alt.append(w["fem"])
            if alt:
                w["alt"] = alt
            w["ex"] = []
            ta = re.sub(r"\s*\([^)]*\)", "", fr).strip()
            if ta and "/" not in ta and "…" not in ta:
                w["type_ans"] = ta
            w["a"] = say(extra.get("say") or fr)
            cur = w
            words.append(w); topic["words"].append(w["id"])
    for w in words:
        if len(w["ex"]) < 2:
            ERR.append(f"{w['de']}: needs 2 examples (has {len(w['ex'])})")
    return words

# ---------------------------------------------------------------- grammar
def parse_grammar():
    out = []
    files = sorted(f for f in os.listdir(os.path.join(SRC, "grammar")) if f.endswith(".md"))
    for fn in files:
        num = int(fn.split(".")[0])
        text = open(os.path.join(SRC, "grammar", fn), encoding="utf-8").read()
        secs = re.split(r"^---(\w*)\s*$", text, flags=re.M)
        head, rest = secs[0], dict(zip(secs[1::2], secs[2::2]))
        title = re.search(r"^# (.+)$", head, re.M).group(1).strip()
        meta = dict(re.findall(r"^(\w+):\s*(.+)$", head, re.M))
        g = {"id": f"g{num}", "num": num, "title": title, "intro": meta.get("intro", ""), "body": "", "after": "", "ex": [], "mist": [], "q": []}
        body = rest.get("", "")
        if meta.get("gap"):
            g["gap"] = int(meta["gap"])
        # manual parts: "## Part: title" headings
        chunks = re.split(r"^## Part:\s*(.+)$", body, flags=re.M)
        if len(chunks) > 1:
            g["parts"] = [{"t": t.strip(), "html": md(h), "q": []} for t, h in zip(chunks[1::2], chunks[2::2])]
            g["body"] = "".join(f"<h3>{html.escape(p['t'])}</h3>" + p["html"] for p in g["parts"])
        else:
            g["body"] = md(body)
        for ln in rest.get("examples", "").strip().split("\n"):
            if ln.startswith("- "):
                fr, _, en = ln[2:].partition("|")
                g["ex"].append(dict(de=fr_typo(fr.strip()), en=en.strip(), a=say(fr.strip())))
        for ln in rest.get("mistakes", "").strip().split("\n"):
            if ln.startswith("- "):
                c = [x.strip() for x in ln[2:].split("|")]
                if len(c) != 3:
                    ERR.append(f"{fn}: mistake needs wrong | right | why: {ln}")
                    continue
                g["mist"].append(dict(wrong=c[0], right=c[1], why=c[2]))
        q = None
        for ln in rest.get("questions", "").split("\n"):
            if ln.startswith("- "):
                qq, _, a = ln[2:].partition("::")
                if not a.strip():
                    ERR.append(f"{fn}: question without answer: {ln}")
                q = {"q": qq.strip(), "a": a.strip()}
                g["q"].append(q)
            elif ln.strip() and q is not None:
                k, _, v = ln.strip().partition(":")
                v = v.strip()
                if k == "opts":
                    opts = [o.strip() for o in v.split(";") if o.strip()]
                    if q["a"] not in opts:
                        opts = [q["a"]] + opts
                    q["opts"] = opts
                elif k == "note":
                    q["note"] = v
                elif k == "say":
                    q["audio"] = say(v); q["say"] = v
                elif k == "part":
                    q["_part"] = int(v) - 1
                else:
                    ERR.append(f"{fn}: unknown question field {k}")
        if g.get("parts"):
            for i, x in enumerate(g["q"]):
                p = x.pop("_part", None)
                if p is None or p >= len(g["parts"]):
                    ERR.append(f"{fn}: question {i + 1} needs a valid part:")
                    continue
                g["parts"][p]["q"].append(i)
        else:
            for x in g["q"]:
                x.pop("_part", None)
        if len(g["q"]) < 5:
            ERR.append(f"{fn}: only {len(g['q'])} questions")
        out.append(g)
    return out

# ---------------------------------------------------------------- phrases
def parse_phrases():
    out, cur, grp = [], None, None
    for k, ln in enumerate(open(os.path.join(SRC, "phrases.md"), encoding="utf-8").read().split("\n"), 1):
        if ln.startswith("# "):
            key, title = [x.strip() for x in ln[2:].split("|")]
            cur = {"id": f"p{len(out)}", "key": key, "title": title, "tip": "", "items": []}
            out.append(cur); grp = None
        elif ln.startswith("tip:"):
            cur["tip"] = ln[4:].strip()
        elif ln.startswith("## "):
            grp = ln[3:].strip()
        elif ln.startswith("- "):
            fr, _, en = ln[2:].partition("|")
            fr, en = fr.strip(), en.strip()
            if not en:
                ERR.append(f"phrases.md:{k}: no English")
            it = {"de": fr_typo(fr), "en": en, "grp": grp, "a": say(fr)}
            if not grp:
                del it["grp"]
            cur["items"].append(it)
    return out

# ---------------------------------------------------------------- path
def chunks(ids, size=12):
    k = max(1, round(len(ids) / size))
    per = len(ids) / k
    return [ids[round(i * per):round((i + 1) * per)] for i in range(k)]

def build_path(grammar, phrases):
    by_key = {p["key"]: p for p in phrases}
    lessons = {k: chunks(t["words"]) for k, t in TOPICS.items()}
    used = {k: 0 for k in TOPICS}
    path, day, nv, seen = [], -1, 0, set()
    for k, ln in enumerate(open(os.path.join(SRC, "path.md"), encoding="utf-8").read().split("\n"), 1):
        ln = ln.split("#")[0].strip()
        if not ln:
            continue
        kind, _, arg = ln.partition(" ")
        arg = arg.strip()
        if kind == "V":
            if arg not in lessons or used[arg] >= len(lessons[arg]):
                ERR.append(f"path.md:{k}: no lesson left for topic {arg}"); continue
            ws = lessons[arg][used[arg]]; used[arg] += 1
            day += 1; nv += 1
            t = TOPICS[arg]
            path.append({"id": f"v{nv}", "kind": "vocab", "n": nv, "title": f"{t['fr']} ({t['en']})", "words": ws})
        elif kind == "G":
            g = next((x for x in grammar if x["num"] == int(arg)), None)
            if not g:
                ERR.append(f"path.md:{k}: no chapter {arg}"); continue
            path.append({"id": g["id"], "kind": "grammar", "title": f"Ch {g['num']}: {g['title']}"}); seen.add(g["id"])
        elif kind == "P":
            p = by_key.get(arg)
            if not p:
                ERR.append(f"path.md:{k}: no phrase topic {arg}"); continue
            path.append({"id": p["id"], "kind": "phrases", "title": p["title"]}); seen.add(p["id"])
        else:
            ERR.append(f"path.md:{k}: unknown line {ln}")
            continue
        path[-1]["week"], path[-1]["day"] = max(0, day) // 7 + 1, max(0, day)
    for k, n in used.items():
        if n < len(lessons[k]):
            ERR.append(f"path.md: topic {k} has {len(lessons[k]) - n} lesson(s) not on the path")
    for x in grammar + phrases:
        if x["id"] not in seen:
            ERR.append(f"path.md: {x['id']} ({x['title']}) not on the path")
    return path

def lint(words, phrases, grammar):
    seen = {}
    for w in words:
        key = (w["de"], w["en"])
        if w["de"] in seen:
            ERR.append(f"duplicate word: {w['de']}")
        seen[w["de"]] = 1
        for e in w["ex"]:
            if re.search(r"[^\s ]([?!:;])(\s|$)", e["de"]) and not re.search(r"https?:", e["de"]):
                ERR.append(f"{w['de']}: put a space before ? ! : ; in French: {e['de']}")
    for p in phrases:
        for it in p["items"]:
            if re.search(r"[^\s ]([?!;])(\s|$)", it["de"]):
                ERR.append(f"phrase: space before ? ! ; : {it['de']}")

# ---------------------------------------------------------------- main
GOALS = [
    "Sounds and the alphabet, numbers 0–20, greetings, tu / vous, introduce yourself.",
    "Être and avoir, -er verbs, articles and gender, nationalities, countries and cities.",
    "Family, possessives (mon / ma / mes), numbers to 100, age and phone numbers, describing people.",
    "Questions (est-ce que, question words), professions, c'est / il est, classroom and belongings.",
    "Adjective agreement, colours, negation, home and furniture, il y a.",
    "Irregular verbs (aller, faire, venir, prendre), time and dates, days, months, daily routine.",
    "Food and drink, the partitive (du / de la / des), quantities, café and restaurant.",
    "Shopping and prices, demonstratives (ce / cette), polite requests (je voudrais), clothes.",
    "Town and directions, prepositions of place, à / en / au with places, transport, the imperative.",
    "Weather and seasons, hobbies, likes and dislikes, accepting and refusing, connectors.",
    "Futur proche and a first passé composé, writing postcards, messages and emails, forms.",
    "DELF A1 practice: listening, reading, writing, speaking; review and rest.",
]
def main():
    words = parse_words()
    grammar = parse_grammar()
    phrases = parse_phrases()
    path = build_path(grammar, phrases)
    lint(words, phrases, grammar)
    for p in phrases:
        del p["key"]
    data = {"version": 1, "lang": "fr", "planStart": "2026-11-23", "goals": GOALS, "words": words, "grammar": grammar,
            "phrases": phrases, "path": path, "roadmap": []}
    nphr = sum(len(p["items"]) for p in phrases)
    print(f"words {len(words)} · topics {len(TOPICS)} · grammar {len(grammar)} · phrase topics {len(phrases)} ({nphr} phrases) · "
          f"path items {len(path)} ({sum(1 for p in path if p['kind'] == 'vocab')} vocab lessons) · audio clips {len(AUDIO)}")
    if ERR:
        print(f"{len(ERR)} problem(s):")
        for e in ERR[:80]:
            print("  -", e)
        sys.exit(1)
    if CHECK:
        return
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(AUDIO, f, ensure_ascii=False, indent=0)
    print("wrote", os.path.relpath(OUT, ROOT), "and", os.path.relpath(MANIFEST, ROOT))

if __name__ == "__main__":
    main()

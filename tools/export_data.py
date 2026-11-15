"""Export the Iteration_v3 book sources into the app's content.json (+ an audio manifest).

Run:  python3 tools/export_data.py
"""
import hashlib, html, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "..", "Data", "Iteration_v3", "_source", "build")
OUT = os.path.join(ROOT, "app", "data")
sys.path.insert(0, SRC)
os.chdir(SRC)  # the build modules open files relative to their own folder

import vocab_data as V  # noqa: E402
import grammar as G  # noqa: E402
import phrases as P  # noqa: E402
import roadmap as R  # noqa: E402

# ------------------------------------------------------------------ helpers
def strip_tags(s):
    s = re.sub(r'<span class="v2">.*?</span>', "", s)
    s = re.sub(r'<span class="blank"></span>', "___", s)
    return html.unescape(re.sub(r"<[^>]+>", "", s)).strip()

def audio_id(text):
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:12]

AUDIO = {}  # id -> text to speak

def say(text):
    """Register a text for TTS and return its audio id (or None)."""
    t = clean_speech(text)
    if not t or not re.search(r"[A-Za-zÄÖÜäöüß]", t):
        return None
    i = audio_id(t)
    AUDIO[i] = t
    return i

def clean_speech(t):
    t = strip_tags(t)
    t = t.replace("…", " ").replace("___", " ").replace("‑", "-")
    t = re.sub(r"\s*\((?:[^()]*\d[^()]*|pl\.|under [^)]*|same|formal|informal|polite|friends?)\)", "", t)
    t = re.sub(r"\s+", " ", t).strip(" ,;")
    return t

SPEAK_OVERRIDE = {
    "der/die Deutsche (ein Deutscher, eine Deutsche, Deutsche)": "der Deutsche, die Deutsche",
    "die (Kredit-)Karte": "die Kreditkarte, die Karte",
    "ein Kilo(gramm) (1 kg)": "ein Kilogramm",
    "gern(e)": "gern, gerne",
    "zum Beispiel (z. B.)": "zum Beispiel",
    "circa (ca.)": "circa",
    "ein halb; halb …": "ein halb",
    "ein Viertel; Viertel …": "ein Viertel",
    "der/die/das erste": "der erste, die erste, das erste",
    "deutsch / Deutsch": "deutsch",
    "fünf Minuten vor/ nach eins": "fünf Minuten vor eins, fünf nach eins",
    "Viertel vor/nach zwei": "Viertel vor zwei, Viertel nach zwei",
    "der, die, das": "der, die, das",
    "weh tun (wehtun)": "weh tun",
    "sich kümmern (um)": "sich kümmern um",
    "an sein (under \"sein\")": "an sein",
    "auf sein (under \"sein\")": "auf sein",
    "der/das Grad (Celsius)": "das Grad Celsius",
}

def speak_word(e):
    de = e["de"]
    if de in SPEAK_OVERRIDE:
        return SPEAK_OVERRIDE[de]
    s = de
    s = re.sub(r"\((sich|ein)\)\s*", r"\1 ", s) if s.startswith("(sich)") else s
    s = s.replace("(ein)", "ein")
    m = re.match(r"^(\w+)-\s*\((.*)\)$", s)  # "dies- (dieser, diese, dieses)"
    if m:
        return m.group(2)
    s = re.sub(r"\s*\((pl\.|under [^)]*)\)", "", s)
    s = re.sub(r"\s*\([^()]*\d[^()]*\)", "", s)
    if e["type"] == "noun":
        s = re.sub(r"\s*\([^()]*\)", "", s)  # der Tag (Tageszeit) -> der Tag
    else:
        s = re.sub(r"\s*\(([^()]*)\)", r", \1", s)  # kein (keine) -> kein, keine
    s = re.sub(r"\bder/die/das\b|\bder/die\b|\bder/das\b", "der", s)
    s = s.replace(" / ", ", ").replace(";", ",")
    return re.sub(r"\s+", " ", s).strip(" ,")

def typeable(e):
    """The canonical answer for typing exercises, or None if the entry is too irregular to type."""
    de = e["de"]
    if re.search(r"[()/…;,+]", de) or de.endswith("-") or len(de) > 28:
        return None
    if e["type"] in ("phrase",) and len(de.split()) > 3:
        return None
    return de

GENDER = {"m": "der", "f": "die", "n": "das", "pl": "die"}

# Notes that only describe the printed PDF (misprints, page numbers, line breaks) are dropped or
# reduced to the useful learner tip.
NOTE_FIX = {
    "null": [],
    "ein Viertel; Viertel …": [],
    "die Woche": [],
    "ein Liter (1 l)": [],
    "Indien": ["You'll need this to say where you come from: Ich komme aus Indien."],
    "die Ehefrau / der Ehemann": ["In everyday speech people just say \"mein Mann / meine Frau\"."],
    "der Partner / die Partnerin": [],
    "der Anrufbeantworter": [],
    "die Lebensmittel (pl.)": [],
    "die Hausfrau / der Hausmann": [],
    "die Disco": ["Also spelled \"Disko\"."],
    "der Satz": [],
    "hoch": ["Before a noun it becomes \"hoh-\": ein hohes Haus."],
}
PRINT_NOTE = re.compile(r"\bPDF\b|printed|print error|misprint|siehe Seite|this list|the list's|not in the list", re.I)

# ------------------------------------------------------------------ vocabulary
E = V.fix(V.load())
by_de = {e["de"]: e for e in E}
batches = json.load(open(os.path.join(SRC, "batches.json")))

words = []
wid = {}
for e in E:
    w = dict(
        id=f"w{e['idx']}",
        de=e["de"],
        en=e["en"],
        type=e["type"],
        topic=e["topic"],
        core=bool(e["core"]),
        hint=e["hint_en"],
        hintHi=e["hint_hi"],
        g=e["genders"][0] if e["type"] == "noun" and e["genders"] and len(set(e["genders"])) == 1 and e["genders"][0] in GENDER else None,
        pl=e["plural"] or None,
        forms=e["forms"] or None,
        perf=e["perfekt"] or None,
        labels=e["labels"] or None,
        notes=NOTE_FIX[e["de"]] if e["de"] in NOTE_FIX else [n for n in e["notes"] if not PRINT_NOTE.search(n)],
        ex=[dict(de=d, en=en, a=say(d)) for d, en, _ in e["ex"]][:3],
        type_ans=typeable(e),
        a=say(speak_word(e)),
    )
    w = {k: v for k, v in w.items() if v not in (None, [], "")}
    words.append(w)
    wid[e["de"]] = w["id"]

# ------------------------------------------------------------------ grammar
grammar = []
for c in G.CH:
    grammar.append(dict(
        id=f"g{c['num']}",
        num=c["num"],
        title=c["title"],
        watch=c["watch"],
        intro=strip_tags(c["intro"]),
        body=re.sub(r'<span class="v2">.*?</span>', "", c["body"]),
        after=re.sub(r'<span class="v2">.*?</span>', "", c.get("after") or ""),
        ex=[dict(de=strip_tags(d), en=strip_tags(en), a=say(d)) for d, en in c["examples"]],
        mist=[dict(wrong=strip_tags(a), right=strip_tags(b), why=strip_tags(w)) for a, b, w in c["mist"]],
        q=[dict(q=strip_tags(q), a=strip_tags(a)) for q, a in zip(c["practice"], c["answers"])],
    ))

# ---- practice questions that can't be typed become multiple choice / listening ----
LETTER_NAME = {  # how German says each letter (written so the TTS voice reads the name, not a sound)
    "A": "Ah", "B": "Beh", "C": "Zeh", "D": "Deh", "E": "Eh", "F": "Eff", "G": "Geh", "H": "Hah", "I": "Ih", "J": "Jott",
    "K": "Kah", "L": "Ell", "M": "Emm", "N": "Enn", "O": "Oh", "P": "Peh", "Q": "Kuh", "R": "Err", "S": "Ess", "T": "Teh",
    "U": "Uh", "V": "Vau", "W": "Weh", "X": "Ix", "Y": "Ypsilon", "Z": "Zett", "Ä": "Ä", "Ö": "Ö", "Ü": "Ü", "ß": "Eszett"}
# letters that English speakers mix up – each question offers the confusable set
LETTER_QS = [("E", ["A", "E", "I", "Y"]), ("I", ["A", "E", "I", "Y"]), ("A", ["A", "E", "H", "R"]), ("V", ["F", "V", "W", "U"]),
             ("W", ["F", "V", "W", "B"]), ("Z", ["C", "S", "Z", "T"]), ("J", ["G", "J", "Y", "I"]), ("G", ["G", "J", "K", "Q"]),
             ("C", ["C", "Z", "S", "K"]), ("R", ["A", "E", "R", "H"])]
SPELL_QS = [("BERLIN", ["BERLIN", "BARLIN", "BIRLEN", "BERLEN"]), ("WASSER", ["WASSER", "VASSER", "WASZER", "FASSER"]),
            ("JUNI", ["JUNI", "GUNI", "JUNE", "YUNI"]), ("ZEIT", ["ZEIT", "CEIT", "ZAIT", "SEIT"])]

def spell(word):
    return ", ".join(LETTER_NAME[c] for c in word)

def ch1_questions():
    # reading-based only – the listening/spelling drills were removed (synthetic letter names were hard to understand)
    return [dict(q="Which word has the “eye” sound (ei)?", a="drei", opts=["drei", "vier"], note="ei = “eye”, ie = long “ee”."),
            dict(q="Which word has the throat ch (kh / ख़)?", a="Buch", opts=["Buch", "ich"], note="ch after a, o, u, au is the throat sound."),
            dict(q="German w sounds like English …", a="v", opts=["v", "w", "f", "u"], note="wohnen = VOH-nen."),
            dict(q="German v (as in vier, Vater) usually sounds like English …", a="f", opts=["f", "v", "w", "b"], note="vier = FEE-uh."),
            dict(q="German z (as in zehn, Zug) sounds like …", a="ts", opts=["ts", "z", "s", "dz"], note="zehn = TSAYN."),
            dict(q="German j (as in ja, Jahr) sounds like English …", a="y", opts=["y", "j", "h", "g"], note="ja = YAA.")]

def or_question(q):
    """'Which word …: vier or drei?' → multiple choice."""
    m = re.search(r":\s*([\wäöüÄÖÜß]+) or ([\wäöüÄÖÜß]+)\?$", q["q"])
    if m and q["a"] in m.groups():
        return dict(q=q["q"], a=q["a"], opts=list(m.groups()))
    return q

for g in grammar:
    g["q"] = ch1_questions() if g["num"] == 1 else [or_question(q) for q in g["q"] if not q["a"].startswith("(your own")]

# ------------------------------------------------------------------ phrases
phrases = []
for n, sec in enumerate(P.SECTIONS):
    title, groups = sec[0], sec[1]
    tip = sec[2] if len(sec) > 2 else ""
    items = []
    for g, its in groups:
        for de, en in its:
            d = strip_tags(de)
            items.append(dict(de=d, en=strip_tags(en), grp=g or None, a=say(d)))
    phrases.append(dict(id=f"p{n}", title=title, tip=strip_tags(tip), items=[{k: v for k, v in i.items() if v} for i in items]))

# ------------------------------------------------------------------ path (lesson order, follows the 84-day roadmap)
first_ch = {}
for i, (v, g, p) in enumerate(R.P):
    for m in re.findall(r"Ch (\d+)(?:[–-](\d+))?", g + " " + p):
        a, b = int(m[0]), int(m[1] or m[0])
        for c in range(a, b + 1):
            first_ch.setdefault(c, i)
PHRASE_DAY = {0: 0, 1: 1, 2: 2, 3: 5, 4: 6, 5: 29, 6: 46, 7: 38, 8: 47, 9: 55, 10: 33, 11: 40, 12: 28, 13: 14}
start = R.START
items = []
for k, b in enumerate(batches):
    day = (__import__("datetime").date.fromisoformat(b["date"]) - start).days
    topics = []
    for s in b["segs"]:
        t = R.short_topic(s["topic"])
        if t not in topics:
            topics.append(t)
    items.append((day, 0, dict(id=f"v{k + 1}", kind="vocab", n=k + 1, title=" · ".join(topics), words=[wid[w] for w in b["words"]])))
for c in grammar:
    items.append((first_ch[c["num"]], 1, dict(id=c["id"], kind="grammar", title=f"Ch {c['num']}: {c['title']}")))
for n, d in PHRASE_DAY.items():
    items.append((d, 2, dict(id=f"p{n}", kind="phrases", title=phrases[n]["title"])))
items.sort(key=lambda t: (t[0], t[1]))
path = []
for day, _, it in items:
    it["week"] = day // 7 + 1
    it["day"] = day
    path.append(it)

roadmap = [dict(video=v, grammar=g, practice=p) for v, g, p in R.P]

content = dict(
    version=1,
    planStart=start.isoformat(),
    goals=R.GOALS,
    words=words,
    grammar=grammar,
    phrases=phrases,
    path=path,
    roadmap=roadmap,
)
os.makedirs(OUT, exist_ok=True)
json.dump(content, open(os.path.join(OUT, "content.json"), "w"), ensure_ascii=False, separators=(",", ":"))
json.dump(AUDIO, open(os.path.join(ROOT, "tools", "audio_manifest.json"), "w"), ensure_ascii=False, indent=0)
print(f"words {len(words)} · grammar {len(grammar)} · phrase sections {len(phrases)} · path items {len(path)} · audio clips {len(AUDIO)}")
print("typeable words:", sum(1 for w in words if "type_ans" in w), "· nouns with single gender:", sum(1 for w in words if "g" in w))

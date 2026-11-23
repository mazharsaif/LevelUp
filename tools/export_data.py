"""Export the Iteration_v3 book sources into the app's content.json (+ an audio manifest).

Run:  uv run tools/export_data.py
"""
import hashlib, html, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "..", "German Learning", "legacy", "Data", "Iteration_v3", "_source", "build")
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
def no_playlist(t: str) -> str:
    """drop references to the old video playlist (feedback 11-22: "it says playlist lesson x, remove it everywhere")"""
    t = re.sub(r"\s*\(playlist lessons? [\d, ]+\)", "", t, flags=re.I)
    return re.sub(r"\s*[–-]\s*playlist lessons? [\d, ]+\.", ".", t, flags=re.I)


grammar = []
for c in G.CH:
    grammar.append(dict(
        id=f"g{c['num']}",
        num=c["num"],
        title=c["title"],
        intro=strip_tags(c["intro"]),
        body=no_playlist(re.sub(r'<span class="v2">.*?</span>', "", c["body"])),
        after=no_playlist(re.sub(r'<span class="v2">.*?</span>', "", c.get("after") or "")),
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

# ---- Ch 17 prices (feedback 11-23: "why is the euro between the numbers? explain") ----
PRICE_NOTE = ("<div class=\"note\"><p><b>Why is “Euro” between the numbers?</b> Germans <i>say</i> a price the way English says "
              "“3 dollars 50”: the money word goes in the middle, and “cents” is left out. <b>zwei Euro fünfzig</b> = 2 euros, 50 (cents). "
              "In <i>writing</i> it flips: a comma instead of the middle word, and the € sign after the number: <b>2,50 €</b> (German uses a comma "
              "as the decimal point).</p><p>Under one euro you say only the cents: <b>neunundneunzig Cent</b> (0,99 €). <b>zwölf Euro fünf</b> "
              "(12,05 €) means 12 euros and 5 cents. After a number the word stays <b>Euro</b>, never “Euros”.</p></div>")
for g in grammar:
    if g["id"] == "g17" and "Why is “Euro” between" not in g["body"]:
        assert "</tbody></table><h3>Phone numbers</h3>" in g["body"]
        g["body"] = g["body"].replace("</tbody></table><h3>Phone numbers</h3>", "</tbody></table>" + PRICE_NOTE + "<h3>Phone numbers</h3>", 1)

for g in grammar:
    g["q"] = ch1_questions() if g["num"] == 1 else [or_question(q) for q in g["q"] if not q["a"].startswith("(your own")]

# ---- Ch 1 (pronunciation) in small bites (feedback 11-19: "too much to read in one sitting") ----
# 7 short parts, each a few sounds with 🔊 examples and its own questions. The app spreads the parts out
# (g["gap"] = other lessons between two parts), so you learn a few sounds, do some words, then come back.
def _ex(de, hint):
    return (f'<div class="ex"><button class="spk sm" data-a="{say(de) or ""}" data-t="{html.escape(de)}">🔊</button>'
            f'<div class="t"><div>{html.escape(de)}</div><div class="muted small">{hint}</div></div></div>')

def _rows(rows, head):
    th = "".join(f"<th>{h}</th>" for h in head)
    return "<table><thead><tr>" + th + "</tr></thead><tbody>" + "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows) + "</tbody></table>"

def _letters(pairs):
    return _rows([(f"<b>{l}</b>", n, f'<span class="hi">{h}</span>') for l, n, h in pairs], ["Letter", "Name (say)", "Hindi"])

def ch1_parts():
    Q = lambda q, a, opts, note, **kw: dict(q=q, a=a, opts=opts, note=note, **kw)
    parts = [
        ("Letter names: the A – E – I trap",
         '<div class="box warn"><b>The letter-name trap</b><br>It is a triangle, not a simple swap: German <b>I</b> is said “ee” '
         '(like English E), German <b>E</b> is said “ay” (like English A), and German <b>A</b> is said “aa”.</div>'
         '<p>You will need this to spell your name. Example: LEA = el – ay – aa (the E is “ay”, the A is “aa”).</p>'
         + _ex("Wie schreibt man das?", "How do you spell that?") + _ex("Mein Name ist Lea: L – E – A.", "el – ay – aa")
         + '<div class="box"><b>Your turn, {{Name}}:</b> say your name letter by letter out loud – {{NAME}}. '
           'Use the triangle above for every A, E and I. The practice will check it.</div>',
         [Q("The German letter E is said …", "ay", ["ay", "ee", "eye", "aa"], "E = “ay”, like the English letter A."),
          Q("The German letter I is said …", "ee", ["ee", "eye", "ay", "aa"], "I = “ee”, like the English letter E."),
          # built in the app from the learner's own name (store.js nameSpellQuestion); TAHA is only the fallback text
          Q("How do you spell TAHA in German?", "tay – aa – haa – aa", ["tay – aa – haa – aa", "tee – ay – aitch – ay", "tay – ay – haa – ay"], "A = “aa”, H = “haa”, T = “tay”.", myName=True)]),
        ("The alphabet: A to M",
         "<p>Most letter names are close to English. Watch the ones in bold.</p>" + _letters([
            ("A", "aa", "आ"), ("B", "bay", "बे"), ("C", "<b>tsay</b>", "त्से"), ("D", "day", "डे"), ("E", "<b>ay</b>", "ए"), ("F", "ef", "एफ़"),
            ("G", "<b>gay</b>", "गे"), ("H", "haa", "हा"), ("I", "<b>ee</b>", "ई"), ("J", "<b>yot</b>", "यॉट"), ("K", "kaa", "का"), ("L", "el", "एल"), ("M", "em", "एम")]),
         [Q("The letter J is said …", "yot", ["yot", "jay", "jee", "hot"], "J = “yot”, like the y in “yes”."),
          Q("The letter G is said …", "gay", ["gay", "jee", "gee", "jay"], "G = “gay”, always a hard g."),
          Q("The letter C is said …", "tsay", ["tsay", "see", "kay", "say"], "C = “tsay”.")]),
        ("The alphabet: N to Z and Ä Ö Ü ß",
         _letters([("N", "en", "एन"), ("O", "oh", "ओ"), ("P", "pay", "पे"), ("Q", "koo", "कू"), ("R", "air (throat r)", "एअ(र)"), ("S", "es", "एस"),
                   ("T", "tay", "टे"), ("U", "oo", "ऊ"), ("V", "<b>fow</b>", "फ़ाउ"), ("W", "<b>vay</b>", "वे"), ("X", "iks", "इक्स"),
                   ("Y", "üp-si-lon", "ई°प-सि-लॉन"), ("Z", "<b>tset</b>", "त्सेट")])
         + "<p>Four extra letters:</p>" + _letters([("Ä", "a-umlaut (like e in “bed”)", "ए / ऐ"), ("Ö", "o-umlaut", "ए° (lips round)"),
                                                    ("Ü", "u-umlaut", "ई° (lips round)"), ("ß", "ess-tset (sharp s)", "एस-त्सेट")]),
         [Q("The letter V is said …", "fow", ["fow", "vee", "vay", "oo"], "V = “fow”."),
          Q("The letter W is said …", "vay", ["vay", "double-u", "fow", "way"], "W = “vay”."),
          Q("The letter Z is said …", "tset", ["tset", "zed", "zee", "set"], "Z = “tset”.")]),
        ("Four consonants: w, v, z, j",
         "<p>These four letters sound different from English, and they are everywhere.</p>"
         + _rows([("<b>w</b>", "like English <b>v</b>"), ("<b>v</b>", "like English <b>f</b> (foreign words: November, Vase)"),
                  ("<b>z / tz</b>", "<b>ts</b>, as in “cats”"), ("<b>j</b>", "like English <b>y</b> (foreign words: Job, Jeans)")], ["Spelling", "Sound"])
         + _ex("Wasser", "VAS-ser · water") + _ex("vier", "FEE-uh · four") + _ex("zehn", "TSAYN · ten") + _ex("ja", "YAA · yes"),
         [Q("German w sounds like English …", "v", ["v", "w", "f", "u"], "Wasser = VAS-ser."),
          Q("German v (as in vier, Vater) usually sounds like English …", "f", ["f", "v", "w", "b"], "vier = FEE-uh."),
          Q("German z (as in zehn, Zug) sounds like …", "ts", ["ts", "z", "s", "dz"], "zehn = TSAYN."),
          Q("German j (as in ja, Jahr) sounds like English …", "y", ["y", "j", "h", "g"], "ja = YAA.")]),
        ("Vowel pairs: ei, ie, eu",
         "<p>Two vowels together make one sound. Say the <b>second</b> letter: ei → “eye”, ie → “ee”.</p>"
         + _rows([("<b>ei / ai</b>", "“eye”", "drei, nein, Mai"), ("<b>ie</b>", "long “ee”", "vier, Bier, sieben"),
                  ("<b>eu / äu</b>", "“oy”", "neu, heute, Häuser")], ["Spelling", "Sound", "Examples"])
         + _ex("drei", "DRAI · three") + _ex("Bier", "BEE-uh · beer") + _ex("heute", "HOY-tuh · today"),
         [Q("Which word has the “eye” sound (ei)?", "drei", ["drei", "vier"], "ei = “eye”, ie = long “ee”."),
          Q("eu in heute sounds like …", "oy", ["oy", "yoo", "eh-oo", "oo"], "heute = HOY-tuh."),
          Q("Listen. Which word is it?", "nein", ["nein", "nie"], "nein = NAIN (eye sound), nie = NEE.", audio=say("nein"), say="nein")]),
        ("sch, st / sp and the two ch sounds",
         _rows([("<b>sch</b>", "sh", "Schule, Tisch"), ("<b>st / sp</b> at the start", "sht / shp", "Straße, sprechen"),
                ("<b>ch</b> after a, o, u, au", "throat sound (kh, ख़)", "Buch, acht, auch"),
                ("<b>ch</b> after e, i, ä, ö, ü; -ig", "soft, like the h in “huge” (hy, ह्य). Never k!", "ich, nicht, zwanzig")], ["Spelling", "Sound", "Examples"])
         + _ex("Schule", "SHOO-luh · school") + _ex("Straße", "SHTRAA-suh · street") + _ex("Buch", "BOOKH · book") + _ex("ich", "IHY · I"),
         [Q("Which word has the throat ch (kh / ख़)?", "Buch", ["Buch", "ich"], "ch after a, o, u, au is the throat sound."),
          Q("The ch in ich and nicht sounds like …", "the h in “huge”", ["the h in “huge”", "k", "sh", "tch"], "Soft ch: never a k."),
          Q("Straße starts with the sound …", "sht", ["sht", "st", "s", "tsh"], "st / sp at the start = sht / shp.")]),
        ("r, -er and quiet endings",
         _rows([("<b>-er</b> at the end", "not an r: a soft “uh”", "Vater = FAA-tuh, vier = FEE-uh"),
                ("<b>r</b> at the start of a syllable", "throat r (soft gargle), never rolled", "rot, Reis"),
                ("<b>b / d / g</b> at the end", "p / t / k", "halb, Kind, Tag"),
                ("<b>h</b> after a vowel", "silent, makes the vowel long", "Bahn, Uhr, zehn"),
                ("<b>ß / ss</b>", "sharp s", "Straße, essen")], ["Spelling", "Sound", "Examples"])
         + _ex("Vater", "FAA-tuh · father") + _ex("Tag", "TAAK · day") + _ex("Bahn", "BAAN · train"),
         [Q("Vater ends with …", "a soft “uh”", ["a soft “uh”", "a clear “er”", "“a”", "a rolled r"], "-er at the end = “uh”: FAA-tuh."),
          Q("Tag ends with the sound …", "k", ["k", "g", "kh", "h"], "b / d / g at the end sound like p / t / k."),
          Q("In Bahn, the h is …", "silent, the a is long", ["silent, the a is long", "said like English h", "said like ch"], "h after a vowel is silent.")]),
    ]
    qs, out = [], []
    for t, body, pq in parts:
        out.append(dict(t=t, html=body, q=list(range(len(qs), len(qs) + len(pq)))))
        qs += pq
    return out, qs

for g in grammar:
    if g["num"] == 1:
        g["parts"], g["q"] = ch1_parts()
        g["gap"] = 4          # at least 4 other lessons between two pronunciation parts
        g["ex"] = []          # the spelling examples now live in part 1

# ------------------------------------------------------------------ phrases
def split_alternatives(de: str, en: str) -> list[tuple[str, str]]:
    """One item per phrase, so a lesson asks for one at a time (tester feedback 11-18).

    "Bitte. / Danke." + "Please. / Thanks."   -> paired one to one
    "Bitte schön. / Gern geschehen." + "You're welcome."   -> both get the one meaning
    "Danke, gut. Und Ihnen? / Und dir?"   -> FRAGMENT_SPLITS: polite and friends forms as two phrases (feedback 11-20)
    """
    if de in FRAGMENT_SPLITS:
        return FRAGMENT_SPLITS[de]
    des = [x.strip() for x in de.split(" / ")]
    if len(des) < 2 or not all(map(_whole_phrase, des)):
        return [(de, en)]  # "Ich bin verheiratet / ledig." swaps one word inside a sentence: keep it whole
    if de in SAME_MEANING:
        return [(x, en) for x in des]
    ens = [x.strip() for x in en.split(" / ")]
    if len(ens) == len(des) and all(e[:1].isupper() for e in ens):
        return list(zip(des, ens))
    return [(x, en) for x in des] if len(ens) == 1 else [(de, en)]


# "a / b" where b is only a fragment: spelled out by hand (keep store.js OLD_SPLIT in step when adding one)
FRAGMENT_SPLITS = {
    # feedback 11-23: "Is Entschuldigung the same as apology?" / "It should mention formally"
    "Entschuldigung! / Entschuldigen Sie!": [("Entschuldigung!", "Excuse me! / Sorry! (short for “an apology”; fine with anyone)"),
                                             ("Entschuldigen Sie!", "Excuse me! (formal: to someone you call Sie)")],
    "Danke, gut. Und Ihnen? / Und dir?": [("Danke, gut. Und Ihnen?", "Fine, thanks. And you? (polite)"),
                                          ("Danke, gut. Und dir?", "Fine, thanks. And you? (friends)")],
}

# alternatives that all carry the whole English meaning, rather than one part each
SAME_MEANING = {"Entschuldigung! / Entschuldigen Sie!"}


def _whole_phrase(x: str) -> bool:
    """Starts like a sentence, ends like one, and is a single sentence ("Danke, gut. Und Ihnen?" is two)."""
    return (x[:1].isupper() or x[:1].isdigit()) and x[-1:] in ".!?…" and not re.search(r"[.!?] \S", x)


phrases = []
for n, sec in enumerate(P.SECTIONS):
    title, groups = sec[0], sec[1]
    tip = sec[2] if len(sec) > 2 else ""
    items = []
    for g, its in groups:
        for de, en in its:
            for d, e in split_alternatives(strip_tags(de), strip_tags(en)):
                items.append(dict(de=d, en=e, grp=g or None, a=say(d)))
    phrases.append(dict(id=f"p{n}", title=title, tip=strip_tags(tip), items=[{k: v for k, v in i.items() if v} for i in items]))

# ------------------------------------------------------------------ path (lesson order, follows the 84-day roadmap)
first_ch = {}
for i, (v, g, p) in enumerate(R.P):
    for m in re.findall(r"Ch (\d+)(?:[–-](\d+))?", g + " " + p):
        a, b = int(m[0]), int(m[1] or m[0])
        for c in range(a, b + 1):
            first_ch.setdefault(c, i)
PHRASE_DAY = {0: 0, 1: 1, 2: 2, 3: 5, 4: 6, 5: 29, 6: 46, 7: 38, 8: 47, 9: 55, 10: 33, 11: 40, 12: 28, 13: 14}
def lesson_topic(t: str) -> str:
    """Short topic for a lesson title. Appendix topics get their English too (feedback 11-20: "Zahlen" alone is unclear):
    "A1. Zahlen – Numbers" -> "Zahlen (Numbers)"; others as before ("Family, people & relationships" -> "Family")."""
    m = re.match(r"^A\d+\. (.+?) – (.+)$", t)
    if m:
        return f"{m[1].split(' / ')[0]} ({m[2].split(' & ')[0]})"
    return R.short_topic(t)


start = R.START
items = []
for k, b in enumerate(batches):
    day = (__import__("datetime").date.fromisoformat(b["date"]) - start).days
    topics = []
    for s in b["segs"]:
        t = lesson_topic(s["topic"])
        if t not in topics:
            topics.append(t)
    items.append((day, 0, dict(id=f"v{k + 1}", kind="vocab", n=k + 1, title=" · ".join(topics), words=[wid[w] for w in b["words"]])))
CH_DAY = {1: 28}   # feedback 11-22: pronunciation and the alphabet after many lessons, not at the very start (week 5)
for c in grammar:
    items.append((CH_DAY.get(c["num"], first_ch[c["num"]]), 1, dict(id=c["id"], kind="grammar", title=f"Ch {c['num']}: {c['title']}")))
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

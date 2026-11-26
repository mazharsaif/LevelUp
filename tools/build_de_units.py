"""German A1 roadmap v2: turn the exported book content into 34 situation units (docs/german/a1-situation-roadmap.md).

Called at the end of tools/export_data.py as `apply(content, say, notes)`. Reads content/de-a1/{units,word_units,new_chapters}.py and
replaces `path`, `phrases`, `goals`, `roadmap` and adds `units`. Words and old grammar chapters keep their ids, so audio and word cards are
unchanged; phrase sections become one per unit (`u<N>p`), vocab items one per unit (`u<N>v`), grammar items stay `g<N>`.
Fails loudly if a word is unplaced or ambiguous, or if a unit is badly sized.
"""
import copy, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "content", "de-a1")
sys.path.insert(0, DATA)
from units import STAGES, UNITS, PH, NEW, GR, REVISIT  # noqa: E402
from word_units import W as WORD_KW  # noqa: E402
from new_chapters import CHAPTERS  # noqa: E402

STUDY_UNITS = sorted(UNITS)   # unit 35 (mock exams) has no vocab item, only phrases + two mock papers


def _place_words(words):
    kws = [(k, u, i) for u, ks in WORD_KW.items() for i, k in enumerate(ks)]
    out, bad = {}, []
    for w in words:
        hits = [(len(k), k, u, i) for k, u, i in kws if w["de"].startswith(k)]
        if not hits:
            bad.append(("unplaced", w["de"])); continue
        m = max(h[0] for h in hits)
        top = {(h[2], h[3]) for h in hits if h[0] == m}
        if len({u for u, _ in top}) > 1:
            bad.append(("ambiguous", w["de"], sorted(top))); continue
        out[w["id"]] = min(top)
    if bad:
        raise SystemExit("build_de_units: word placement problems: %r" % bad[:10])
    return out


def _calendar():
    """Reference 12-week template: 6 learning days + 1 checkpoint day a week; units 1-32 over weeks 1-10, exam units after."""
    days = [d for d in range(70) if d % 7 != 6]
    per = len(days) / 32
    start = {}
    for i, d in enumerate(days):
        start.setdefault(min(32, int(i / per) + 1), d)
    start[33], start[34], start[35] = 70, 72, 74
    return start


def apply(content, say, notes):
    words = content["words"]
    placed = _place_words(words)
    by_unit = {u: [] for u in STUDY_UNITS}
    for w in words:
        u, i = placed[w["id"]]
        if u not in by_unit:
            raise SystemExit(f"build_de_units: word {w['de']!r} placed in unit {u}, which has no study items")
        by_unit[u].append((0 if w.get("core") else 1, i, w["id"]))
    start = _calendar()
    week = lambda u: start[u] // 7 + 1

    # --- phrase sections: one per unit; existing phrases keep their audio id and tidbit
    old = {p["id"]: p for p in content["phrases"]}
    sections = {}
    for u in STUDY_UNITS:
        items = []
        for sid, idx in PH.get(u, []):
            items += [copy.deepcopy(old[sid]["items"][i]) for i in idx]
        for n in NEW.get(u, []):
            it = dict(de=n["de"], en=n["en"])
            a = say(n["de"])
            if a:
                it["a"] = a
            items.append(it)
        sections[u] = dict(id=f"u{u}p", title=UNITS[u][1], tip="", items=items)
    placed_old = sum(len(i) for u in PH if u != 35 for _, i in PH[u])   # unit 35 reuses phrases for its speaking mock
    if placed_old != sum(len(p["items"]) for p in content["phrases"]):
        raise SystemExit("build_de_units: not every existing phrase is placed")

    # --- grammar: old chapters g1-g20 plus the new g21-g26 (their example sentences get audio)
    for ch in CHAPTERS:
        c = copy.deepcopy(ch)
        for e in c["ex"]:
            a = say(e["de"])
            if a:
                e["a"] = a
        for q in c["q"]:                      # listening questions: the text is spoken, never shown
            if "audio_text" in q:
                q["say"] = q.pop("audio_text")
                q["audio"] = say(q["say"])
        content["grammar"].append(c)
    gnum = {g["num"]: g for g in content["grammar"]}
    placed_g = sorted(n for ns in GR.values() for n in ns)
    if placed_g != sorted(gnum):
        raise SystemExit(f"build_de_units: grammar chapters placed {placed_g} != existing {sorted(gnum)}")

    # --- teaching cards from the old path (keyed by old item id) go to the unit that now holds their word / phrase
    word_unit = {wid: placed[wid][0] for wid in placed}
    notes_new = {}
    old_vocab_words = {it["id"]: it["words"] for it in content["path"] if it["kind"] == "vocab"}
    NOTE_UNIT = {"v4": 1}   # the "learn every noun with its der/die/das" cards: start of the German track (feedback 68f2, 11-24)
    for oid, lst in notes.items():
        for n in lst:
            if oid in NOTE_UNIT:
                notes_new.setdefault(f"u{NOTE_UNIT[oid]}v", []).append(dict(n, at="start"))
            elif oid.startswith("v"):
                wid = n["at"] if n["at"] != "start" else old_vocab_words[oid][0]
                u = word_unit[wid]
                notes_new.setdefault(f"u{u}v", []).append(n if n["at"] != "start" else dict(n, at=wid))
            else:
                de = n["at"]
                for uu, s in sections.items():
                    if any(i["de"] == de for i in s["items"]):
                        notes_new.setdefault(f"u{uu}p", []).append(n)
                        break

    # extra teaching cards, placed right before the word's card (feedback 1d53 and 5a3a, 11-24)
    EXTRA = [
        ("einundzwanzig", [dict(h="21 to 99: the ones come first", p="From 21 on, German says the small number first, then “und”, then the tens: 21 is “one-and-twenty”. The tens themselves (20, 30, 40…) are separate words you learn next. So read these numbers backwards from how you write them.",
            ex=[("einundzwanzig", "21 = one-and-twenty"), ("vierunddreißig", "34 = four-and-thirty"), ("neunundneunzig", "99 = nine-and-ninety")])]),
        ("das Wiedersehen (Auf Wiedersehen)", [dict(h="Why is “Auf Wiedersehen” in brackets?", p="The word itself is “das Wiedersehen”, a noun meaning “seeing each other again”. Germans almost never say it alone: they say “Auf Wiedersehen” (literally “until seeing again”), which is the polite way to say goodbye. The brackets only show where you will meet the word. In a conversation, say the whole phrase.",
            ex=[("Auf Wiedersehen!", "Goodbye! (polite)"), ("Tschüss!", "Bye! (casual)")])]),
        # educator review (11-26): overview cards that tie together what the word cards show one by one
        ("bitte", [dict(h="Six sounds to get right from day one", p="German is spelled almost the way it sounds, so once you know the sounds you can read any word aloud. These six work differently from English; get them right now and every new word is easier. Chapter 1 (week 2) covers the whole alphabet.",
            ex=[("Wie geht's?", "w sounds like English v"), ("zwei", "z sounds like ts"), ("drei · vier", "ei sounds like “eye”, ie like “ee”"),
                ("ich · acht", "ch: soft after i and e, from the throat after a, o, u"), ("Schule · sprechen", "sch = sh; sp and st at the start = shp, sht"), ("Vater", "-er at the end sounds like “uh”: FAA-tuh")])]),
        ("der Inder / die Inderin", [dict(h="One role, two words: the -in ending", p="Most words for jobs, nationalities and roles have a female form ending in -in. It is always a die word, and its plural ends in -innen. Some add an umlaut, and words ending in -e drop the e. When you say what you are, use no article: Ich bin Inderin.",
            ex=[("der Lehrer, die Lehrerin", "teacher (man, woman)"), ("die Lehrerinnen", "teachers (women, plural)"), ("der Arzt, die Ärztin", "doctor (umlaut added)"), ("der Kollege, die Kollegin", "colleague (the -e goes)")])]),
        ("der Bruder", [dict(h="Plurals: the article is easy, the ending isn't", p="In the plural the article is always die. The ending has to be learnt with each noun, which is why every noun card shows its plural. Five patterns cover most nouns, and most feminine nouns take -n or -en.",
            ex=[("der Tisch, die Tische", "-e"), ("die Schwester, die Schwestern", "-n / -en: most feminine nouns"), ("der Bruder, die Brüder", "no ending, maybe an umlaut: der and das words in -er, -el, -en"),
                ("das Kind, die Kinder", "-er, often with an umlaut (das Buch, die Bücher)"), ("das Handy, die Handys", "-s: mostly foreign words")])]),
        ("die Wohnung", [dict(h="Endings that give the gender away", p="You can't guess every gender, but some endings are reliable. -ung, -heit, -keit, -ion and -ei are die words. -chen and -lein are always das. Days, months and seasons are der. In a compound word, the last part decides the gender.",
            ex=[("die Wohnung", "-ung → die"), ("die Information", "-ion → die"), ("das Brötchen", "-chen → always das"), ("der Kühlschrank", "kühl + der Schrank → der")])]),
        ("bekommen", [dict(h="False friends: they look English, but they aren't", p="Some German words look like English ones and mean something else. These come up at A1, so learn the trap with the word.",
            ex=[("bekommen", "to get, to receive (“to become” is werden)"), ("also", "so, therefore (“also” is auch)"), ("wer · wo", "who · where"),
                ("Er will Kaffee.", "He wants coffee (not “he will”)"), ("bald · fast", "soon · almost"), ("das Handy · der Chef", "mobile phone · boss")])]),
    ]
    for de, cards in EXTRA:
        w = next(x for x in content["words"] if x["de"] == de)
        notes_new.setdefault(f"u{word_unit[w['id']]}v", []).append(dict(at=w["id"], cards=cards))

    # --- path
    path, units, order = [], [], {}
    for u in STUDY_UNITS:
        stage, title, cando = UNITS[u]
        ws = [x[2] for x in sorted(by_unit[u])]
        # words and phrases first, then the grammar tip: a tip explains what the learner has just met
        ids = ([dict(id=f"u{u}v", kind="vocab", n=u, title=title, words=ws)] if ws else []) + [dict(id=f"u{u}p", kind="phrases", title=f"{title} · phrases")]
        for num in GR.get(u, []):
            g = gnum[num]
            ids.append(dict(id=g["id"], kind="grammar", title=f"Ch {num}: {g['title']}"))
        for it in ids:
            it["unit"] = u
            it["week"], it["day"] = week(u), start[u]
            if it["id"] in notes_new:
                it["notes"] = notes_new[it["id"]]
            path.append(it)
        first_use = {n: uu for uu, ns in GR.items() for n in ns}
        rev = [f"g{n}" for n in REVISIT.get(u, [])]
        if any(first_use[n] >= u for n in REVISIT.get(u, [])):
            raise SystemExit(f"build_de_units: unit {u} revisits a chapter that is not taught earlier")
        units.append(dict(n=u, stage=stage, stageTitle=STAGES[stage], title=title, cando=cando, week=week(u), day=start[u], revisit=rev,
                          items=[i["id"] for i in ids], keys=list(range(min(5, len(sections[u]["items"])))),
                          nWords=len(ws), nCore=sum(1 for x in by_unit[u] if x[0] == 0), nPhrases=len(sections[u]["items"])))
    # size checks
    for un in units:
        if un["n"] == 35:
            continue
        if not (4 <= un["nCore"] <= 25) or un["nWords"] > 35:
            raise SystemExit(f"build_de_units: unit {un['n']} badly sized: {un['nCore']} core / {un['nWords']} words")
    # weekly goals for the reference calendar
    goals = []
    for w in range(1, 13):
        us = [un["title"] for un in units if un["week"] == w]
        goals.append(" · ".join(us) if us else "Mock exams, weak spots and a final sweep (no new words).")
    # checkpoints: after every third unit a mixed recall of that block's words (no new words, never changes the review schedule)
    checks = []
    for k in range(1, 12):
        a, b = 3 * k - 2, 3 * k
        checks.append(dict(n=k, from_=a, after=b, words=[x[2] for u in range(a, b + 1) for x in sorted(by_unit[u])]))
    for c in checks:
        c["from"] = c.pop("from_")
    content.update(version=2, path=path, units=units, phrases=[sections[u] for u in STUDY_UNITS], goals=goals, roadmap=[], checkpoints=checks)
    return content

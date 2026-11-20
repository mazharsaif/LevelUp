#!/usr/bin/env python3
"""Build the optional listening stories: content/stories/stories.json -> app/data/stories.json (+ audio clips).

Each line gets two clips (normal and slow), each new word one clip, in the speaker's voice.
Clip id = sha1("voice|rate|text")[:12], stored as app/audio/<id>.mp3 like the course audio (not in git:
rsync app/audio/ to the droplet after fetching).
Run:  uv run tools/build_stories.py            (JSON only)
      uv run tools/build_stories.py --audio    (also fetch missing clips with edge-tts)
"""
import asyncio, hashlib, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "content", "stories", "stories.json")
OUT = os.path.join(ROOT, "app", "data", "stories.json")
AUDIO = os.path.join(ROOT, "app", "audio")
RATE, SLOW, WORD = "-8%", "-30%", "-12%"
PRE_VOICE = "de-DE-KatjaNeural"


def aid(voice, rate, text):
    return hashlib.sha1(f"{voice}|{rate}|{text}".encode("utf-8")).hexdigest()[:12]


def main():
    src = json.load(open(SRC, encoding="utf-8"))
    voices, names, clips, out = src["voices"], src["names"], {}, []
    for s in src["stories"]:
        for i, q in enumerate(s["q"], 1):
            ok = q.get("t") in ("mc", "tf") and q.get("q") and "a" in q and 0 <= q.get("line", -1) < len(s["lines"])
            if q.get("t") == "mc":
                ok = ok and isinstance(q["a"], int) and 0 <= q["a"] < len(q.get("o", []))
            if not ok:
                sys.exit(f"{s['id']}: question {i} is malformed: {q}")
        st = {k: s[k] for k in ("id", "title", "titleEn", "scene", "minWords")}
        st["pre"] = []
        for w in s.get("pre", []):
            a = aid(PRE_VOICE, WORD, w["de"]); clips[a] = (PRE_VOICE, WORD, w["de"])
            st["pre"].append({**w, "a": a})
        st["lines"] = []
        for ln in s["lines"]:
            v, say = voices[ln["sp"]], ln.get("say", ln["de"])
            a, sl = aid(v, RATE, say), aid(v, SLOW, say)
            clips[a], clips[sl] = (v, RATE, say), (v, SLOW, say)
            st["lines"].append({"sp": names[ln["sp"]], "de": ln["de"], "en": ln["en"], "a": a, "s": sl})
        st["q"] = s["q"]
        out.append(st)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump({"stories": out}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(out)} stories, {sum(len(s['lines']) for s in out)} lines, {len(clips)} clips -> app/data/stories.json")
    if "--audio" in sys.argv:
        asyncio.run(fetch(clips))


async def fetch(clips):
    import edge_tts
    os.makedirs(AUDIO, exist_ok=True)
    sem, new, fail = asyncio.Semaphore(6), [0], []

    async def one(a, voice, rate, text):
        p = os.path.join(AUDIO, a + ".mp3")
        if os.path.exists(p) and os.path.getsize(p) > 500:
            return
        async with sem:
            for k in range(4):
                try:
                    await edge_tts.Communicate(text, voice, rate=rate).save(p + ".part")
                    os.replace(p + ".part", p); new[0] += 1
                    return
                except Exception as e:  # network blips
                    err = e; await asyncio.sleep(2 * (k + 1))
            fail.append((a, text, repr(err)))
    await asyncio.gather(*(one(a, *c) for a, c in clips.items()))
    print(f"audio: {new[0]} new clips, {len(fail)} failed")
    for f in fail[:10]:
        print("  FAILED", f)


if __name__ == "__main__":
    main()

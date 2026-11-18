"""Download German pronunciation audio for every word, example and phrase (Microsoft neural TTS via edge-tts).

Run:  uv run tools/fetch_audio.py [--voice de-DE-KatjaNeural]
Skips files that already exist, so it is safe to re-run after a network hiccup.
"""
import asyncio, json, os, sys
import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "app", "audio")
VOICE = sys.argv[sys.argv.index("--voice") + 1] if "--voice" in sys.argv else "de-DE-KatjaNeural"
CONCURRENCY = 6

async def one(sem, aid, text, stats):
    path = os.path.join(OUT, aid + ".mp3")
    if os.path.exists(path) and os.path.getsize(path) > 500:
        stats["skip"] += 1
        return
    async with sem:
        for attempt in range(4):
            try:
                # single words get a slightly slower rate so every sound is audible
                rate = "-12%" if len(text.split()) <= 3 else "-5%"
                await edge_tts.Communicate(text, VOICE, rate=rate).save(path + ".part")
                os.replace(path + ".part", path)
                stats["ok"] += 1
                if stats["ok"] % 100 == 0:
                    print(f"  {stats['ok']} downloaded…", flush=True)
                return
            except Exception as ex:  # network blips: back off and retry
                await asyncio.sleep(2 * (attempt + 1))
                err = ex
        stats["fail"].append((aid, text, repr(err)))

async def main():
    os.makedirs(OUT, exist_ok=True)
    manifest = json.load(open(os.path.join(ROOT, "tools", "audio_manifest.json")))
    stats = {"ok": 0, "skip": 0, "fail": []}
    sem = asyncio.Semaphore(CONCURRENCY)
    await asyncio.gather(*(one(sem, a, t, stats) for a, t in manifest.items()))
    print(f"done: {stats['ok']} new, {stats['skip']} already there, {len(stats['fail'])} failed (voice {VOICE})")
    for f in stats["fail"][:20]:
        print("  FAILED", f)

asyncio.run(main())

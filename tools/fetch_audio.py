"""Download German pronunciation audio for every word, example and phrase (Microsoft neural TTS).

Run:  uv run tools/fetch_audio.py [--engine edge|azure] [--voice de-DE-KatjaNeural] [--out DIR] [--limit N]
  edge  (default): edge-tts, free but unofficial (personal use only; see PROJECT_LOG "Before selling").
  azure: licensed Azure AI Speech, same voices. Needs env AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.
  --out: write somewhere else (e.g. a fresh folder to regenerate everything with Azure, then swap it in).
  --limit: only the first N clips (for trying a voice).
Skips files that already exist, so it is safe to re-run after a network hiccup.
"""
import asyncio, json, os, sys, urllib.request
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def arg(name, default=None):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default

OUT = os.path.abspath(arg("--out", os.path.join(ROOT, "app", "audio")))
VOICE = arg("--voice", "de-DE-KatjaNeural")
ENGINE = arg("--engine", "edge")
LIMIT = int(arg("--limit", "0"))
if ENGINE == "azure":
    AZ_KEY, AZ_REGION = os.environ.get("AZURE_SPEECH_KEY"), os.environ.get("AZURE_SPEECH_REGION")
    if not (AZ_KEY and AZ_REGION):
        sys.exit("Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION (from the Speech resource's Keys and Endpoint page).")
elif ENGINE == "edge":
    import edge_tts
else:
    sys.exit("--engine must be edge or azure")

def azure_tts(text, rate, path):
    ssml = (f'<speak version="1.0" xml:lang="de-DE"><voice name="{VOICE}">'
            f'<prosody rate="{rate}">{escape(text)}</prosody></voice></speak>')
    req = urllib.request.Request(
        f"https://{AZ_REGION}.tts.speech.microsoft.com/cognitiveservices/v1", data=ssml.encode("utf-8"),
        headers={"Ocp-Apim-Subscription-Key": AZ_KEY, "Content-Type": "application/ssml+xml",
                 "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3", "User-Agent": "levelup-audio"})
    with urllib.request.urlopen(req, timeout=30) as r, open(path, "wb") as f:
        f.write(r.read())
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
                if ENGINE == "azure":
                    await asyncio.to_thread(azure_tts, text, rate, path + ".part")
                else:
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
    if LIMIT:
        manifest = dict(list(manifest.items())[:LIMIT])
    stats = {"ok": 0, "skip": 0, "fail": []}
    sem = asyncio.Semaphore(CONCURRENCY)
    await asyncio.gather(*(one(sem, a, t, stats) for a, t in manifest.items()))
    print(f"done: {stats['ok']} new, {stats['skip']} already there, {len(stats['fail'])} failed (voice {VOICE}, {ENGINE})")
    for f in stats["fail"][:20]:
        print("  FAILED", f)

asyncio.run(main())

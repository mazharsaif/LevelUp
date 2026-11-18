#!/usr/bin/env python3
"""Split one Markdown guide (e.g. a Claude Doc exported as markdown) into LevelUp chapter files.

    python3 split_doc.py <guide.md> <LevelUp>/content/se/<branch> [--intro-title "How to use this guide"] [--dry-run]

Rules (match tools/build_se_content.py):
  * The H1 title and the byline under it are dropped.
  * Text before the first H2, plus the first H2 if it is a "how to read/use" section, becomes 00.md (the branch's About).
  * Every other H2 becomes NN.md, headed "## N. Title". H3 stays ###, H4 stays ####.
  * Bold/italic markers and backticks are stripped from headings (the reader shows headings as plain text).
  * Markdown escapes such as \\_ and \\* are removed outside code blocks.
  * Existing NN.md files are overwritten only for chapters present in the source; nothing is deleted.
Standard library only. Prints a summary (chapter, title, words).
"""
import os
import re
import sys

INTRO = re.compile(r"^(how to (read|use)|about|introduction|overview|start here)\b", re.I)


def clean_heading(t: str) -> str:
    t = re.sub(r"\*\*(.+?)\*\*|__(.+?)__", lambda m: m.group(1) or m.group(2), t)
    t = re.sub(r"(?<!\w)[*_](.+?)[*_](?!\w)", r"\1", t)
    t = t.replace("`", "")
    return re.sub(r"^\d+\.\s+", "", t.strip())


def unescape(line: str) -> str:
    return re.sub(r"\\([_*\[\]#`\-.!()>|{}+])", r"\1", line)


def split(md: str):
    lines, out, cur, in_code = md.splitlines(), [], None, False
    for line in lines:
        if line.startswith("```"):
            in_code = not in_code
        if not in_code:
            if line.startswith("# "):                       # document title
                continue
            m = re.match(r"^##\s+(.*)", line)
            if m:
                cur = {"title": clean_heading(m.group(1)), "body": []}
                out.append(cur)
                continue
            h = re.match(r"^(#{3,4})\s+(.*)", line)
            if h:
                line = f"{h.group(1)} {clean_heading(h.group(2))}"
            else:
                line = unescape(line)
        if cur is None:                                     # preamble (byline etc.) before the first H2
            if not out:
                out.append({"title": None, "body": []})
            cur = out[0]
        cur["body"].append(line)
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 2:
        sys.exit(__doc__)
    src, dest = args
    dry = "--dry-run" in sys.argv
    intro_title = None
    if "--intro-title" in sys.argv:
        intro_title = sys.argv[sys.argv.index("--intro-title") + 1]
    secs = split(open(src, encoding="utf-8").read())
    # drop a preamble that is only a byline / blank lines
    if secs and secs[0]["title"] is None and len(re.findall(r"\w+", "\n".join(secs[0]["body"]))) < 25:
        secs = secs[1:]
    chapters = []
    if secs and (secs[0]["title"] is None or INTRO.match(secs[0]["title"])):
        first = secs.pop(0)
        chapters.append((0, intro_title or first["title"] or "How to use this guide", first["body"]))
    for i, s in enumerate(secs, 1):
        chapters.append((i, s["title"], s["body"]))
    if not dry:
        os.makedirs(dest, exist_ok=True)
    for n, title, body in chapters:
        head = f"## {title}" if n == 0 else f"## {n}. {title}"
        text = head + "\n\n" + "\n".join(body).strip() + "\n"
        words = len(re.findall(r"\w+", text))
        print(f"{n:02d}.md  {words:5d} words  {title}")
        if not dry:
            with open(os.path.join(dest, f"{n:02d}.md"), "w", encoding="utf-8") as f:
                f.write(text)


if __name__ == "__main__":
    main()

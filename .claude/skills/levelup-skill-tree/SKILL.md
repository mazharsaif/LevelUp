---
name: levelup-skill-tree
description: Turn a learning guide (usually a Claude Doc link, or a topic the user names) into a new branch of the LevelUp app's Software Engineering skill tree, or update an existing branch when the guide grows. Use whenever the user asks to "create a skill tree", "add a branch / track / topic to the SE path", "make this doc a skill tree", or to add new chapters from an updated guide to the app.
---

# LevelUp skill trees

LevelUp (this repo) has a **Software Engineering** course (`se-path`) that is a skill tree: branches (topics) hold skills (nodes). Each skill opens one chapter of reading, shown as bite-sized cards and downloaded only when opened. Every skill is split into **3–4 parts** (sub-topics) that can be read separately and in any order. The tree shows them as a segmented ring around the skill, and the skill sheet lists them. Finishing the last part marks the skill learned (+15 XP) and unlocks the skills that depend on it. Live examples: `cicd` (20 skills from a Typst book, with diagrams), `auth` (12 skills from a guide), `awsml` (14 skills written for a cert track), `jwt` (6 skills from the user's Claude Doc) and `sysd` (12 skills: Claude Doc written first, then the tree).

Read `PROJECT_LOG.md` first (the project's CLAUDE.md requires it). Then follow the steps below. The scripts are in this skill's `scripts/` folder.

## The pipeline

```
source guide (Claude Doc / topic)
  → content/se/<branch>/NN.md          00 = About, 01.. = one chapter per skill
  → uv run tools/build_se_content.py  → app/data/se/<branch>/NN.json + index.json (cards + parts),
                                         and copies each chapter's parts onto its node in se-path.json
  → nodes + branch in app/data/se-path.json   (scripts/add_branch.py from a spec)
  → test on the scratch server (scripts/tree_check.mjs) → update PROJECT_LOG.md
```

The FastAPI server on port 8766 serves `app/` straight from disk, so new files are live as soon as they're written. No restart is needed, and there's no service-worker cache over plain HTTP.

## Step 1: Get the source

- **Claude Doc link** (`claude.ai/artifact/...`): never web-fetch it. Load the docs skill and tools, `read` the project to get the tab, then `export` the tab as `markdown`. A large export is saved to a tool-results file as JSON. Decode `data.bytes_b64` with base64 into the session scratchpad (for example `jwt.md`). Read the whole file before planning.
- **A topic with no doc** (like `sysd`): the user's preference is **reading document first, tree second**. Create a Claude Doc guide: the skeleton first (title, byline, one pending block per chapter, with a "How to read this guide" section first), open it, then fill **one chapter per call** while they watch. Research official sources (man pages, product docs) before writing, and follow "Writing new content". Then export the finished doc and continue from Step 2, exactly as for a user's doc. Avoid `|` inside table cells (even in code); it breaks the card builder's table split.
- **A Typst book** (like `../German Learning/cicd-tutorial/source`): `scripts/typ2md.py <source> <out>` converts every chapter verbatim (book `==` → `###`, boxes such as What-if / Watch out / exercises → labelled paragraphs, `#file` listings read from `../code`, `#tbl` → tables, `#fig` → `![caption](img/x.svg)`). Then group the sections into skills with a small script; `content/se/cicd/_group.py` is the worked example. Copy the listed diagrams into `content/se/<branch>/img/`.
- **Images**: a line `![caption](img/name.svg)` becomes a figure card (white background, caption below); the build copies `content/se/<branch>/img/` to `app/data/se/<branch>/img/`.
- Check for **sections the guide promises but doesn't contain yet** (reading maps, "see section X"). Build only what exists, and tell the user which chapters are missing. Don't invent content for the user's own guide unless they ask.

## Step 2: Split into chapters

The user's own guide is kept **verbatim**: same words, same examples, same tables. Only the headings get normalised.

```bash
uv run .claude/skills/levelup-skill-tree/scripts/split_doc.py <guide.md> content/se/<branch> --dry-run   # look first
uv run .claude/skills/levelup-skill-tree/scripts/split_doc.py <guide.md> content/se/<branch>
```

- Each H2 becomes one chapter, `## N. Title`. A leading "How to read / use this guide" section, or text before the first H2, becomes `00.md`, which is the branch's About button.
- H3 headings are card sections and H4 headings are card sub-headings. Bold, italics and backticks are stripped from headings because the reader shows them as plain text. Markdown escapes such as `\_` are removed.
- **Parts are automatic.** The build splits each chapter at its `###` sections into 3 parts (4 when a chapter has 15 or more cards), balanced by words. So give every chapter **at least 3–4 `###` sections**; a chapter with fewer sections gets fewer parts. Re-run the build after any content change: it rewrites the parts in both the chapter files and `se-path.json`. Don't edit `parts` by hand, and run the build after `add_branch.py` (which keeps existing parts but can't compute new ones).
- A chapter of about 900–1,500 words reads well. If one H2 is far bigger (over 3,000 words), suggest splitting it into two skills; don't split silently.

## Step 3: Design the tree (a spec file)

Write the spec to **`content/se/<branch>/_tree.json`**, next to the chapters, so later updates reuse it. The format is in `scripts/add_branch.py`'s docstring; `auth`, `awsml` and `jwt` already have one each to copy from. `build_se_content.py` ignores the file. Preferences:

- **Branch**: a short `id` (lowercase, e.g. `jwt`), a title of 3 words or fewer, one emoji, and a colour **not used by another branch** (the script refuses duplicates). `order` defaults to the end of the list.
- **Shape**: 3 columns (col 0, 1, 2), one level per row. Start with a single node in col 1. Fan out into parallel skills that don't depend on each other (col 0 and col 2), and merge them back into col 1. Never cross edges. Put prerequisites only where the reading really builds on an earlier chapter.
- **Boss node**: when the guide has a final review, quiz or capstone chapter, make it the last node (`"boss": true`). Don't fake one.
- **Node title**: must fit on two lines of 15 characters (the script checks). Keep it plain: "Anatomy of a JWT", "JWKS & key rotation". `short` is a 3–6 word subtitle.
- **learn**: 4 bullets of what the reader will be able to do, in the guide's own terms. **concepts**: up to 5 key terms. **exercises**: 2–3 from the planned exercise types: Concept check, Myth or fact, Match the terms, Order the flow, Fill the code, Spot the bug, Fix the code, Attack ↔ defence, Scenario, Design decision, Threat-model it, Capstone review, Practice exam. (Exercises are listed but not built yet; finishing the reading is what marks a skill learned.)
- **Icons**: one distinct emoji per node that hints at the topic.
- Leave `mins` out: new nodes get about 200 words a minute, and existing nodes keep their value.

```bash
uv run .claude/skills/levelup-skill-tree/scripts/add_branch.py . content/se/<branch>/_tree.json
uv run tools/build_se_content.py            # add --tree math for the Mathematics course
```

The script validates the spec (unique ids, prerequisites on lower levels, free grid slots, chapter files present, title length, crossing edges, and col 0↔2 jumps over a node in col 1). It also warns when an edge skips a row. Good shapes: a spine in col 1, a fan-out to 2–3 parallel skills, then a merge back into col 1 and writes `se-path.json` with `indent=2, ensure_ascii=False`. The git diff of `se-path.json` should be insertions only.

## Step 3b: Practice questions (every skill)

Each skill gets 4–8 questions in `content/<tree>/<branch>/NN.q.json`. Write them in Python with the helpers in `tools/quiz_src/_q.py` (`MC`, `MF`/`TF`, `NUM`) and keep the source next to the others there (`math_*.py`, `se_*.py`), then rebuild. Types: `mc` (concept check, one right option), `mf` (myth or fact), `tf`, `num` (type a number; `tol` optional, default 0.5 %). Every question needs a one-sentence `why`, shown after answering. Questions must match the chapter's own terms and examples; check every numeric answer by hand. The build validates them, puts them in the chapter file (`quiz`) and the count on the node (`quiz`); `tree_check.mjs` answers skill 1's set and expects +5 XP. Self-check answers written as `**Answers.** ...` are hidden behind a tap in the reader automatically.

## Step 4: Test on the scratch server only

Never test against real progress (`progress/`).

```bash
T=<scratchpad>/t; mkdir -p $T/data
cd LevelUp && (A1_DATA=$T/data uv run server.py 8899 > $T/server.log 2>&1 &)
# puppeteer-core: reuse an existing node_modules, or `cd $T && npm i puppeteer-core`
PUPPETEER_CORE=$T/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js \
  node <skill>/scripts/tree_check.mjs <branch> $T/shots
pkill -f "server.py 8899"
```

`tree_check.mjs` checks the following and exits non-zero on any failure:
- the branch renders the right number of nodes, with only the first open, and each ring has one segment per part;
- part-by-part reading works: after part 1 the skill isn't done yet; parts can be read out of order; the skill completes after the last one;
- the node sheet and reader open;
- finishing skill 1 unlocks its dependants;
- About opens;
- every chapter file loads with cards;
- there are no JS errors.

Then **look at the screenshots** (`1_tree.png`, `4_reader_mid.png`, `5_after_finish.png`): labels must not overlap, and headings must have no stray `**` or backticks. Run server.py with `uv run` (repo-root uv env); the 8899 test server is only opened from localhost, so the firewall doesn't matter.

## Step 5: Finish

- Update `PROJECT_LOG.md`: the Software Engineering line in **Map** (branch count and open branches, with the source doc link), **State** (what was added and tested), and **Changelog** (one line). Keep it short.
- **Don't commit** unless the user asks. Say what is uncommitted and on which git branch.
- Report back briefly: the branch name, the number of skills and cards, the test result, any missing chapters, and that it's live on 8766.

## Updating a branch when the guide grows

1. Export the doc again and re-run `split_doc.py`. Chapter numbers must stay stable: new H2 sections should append as new chapters. If the doc author inserted a section in the middle, write the files by hand so existing `NN.md` numbers keep their content.
2. Add the new nodes to `content/se/<branch>/_tree.json` (keep every existing `key`) and run `add_branch.py . content/se/<branch>/_tree.json --update`. Learner progress (`S.tree`) and reading position (`S.read`) are keyed by node id, so the script refuses to drop or rename nodes. Existing nodes keep their place in the file and their `mins`, so a re-run with an unchanged spec changes nothing.
3. Rebuild the cards, re-run `tree_check.mjs`, and update the log.

## Writing new content (when there's no source doc)

Follow the `awsml` chapters as the model:
- 700–1,200 words per chapter, in plain English. The first sentence says what the skill covers and why it matters.
- Use `###` sections: the ideas (with tables for comparisons), the AWS or tool specifics, a **Lab** (numbered steps, with the cost if there is one), and a **Self-check** with **Answers**.
- Facts come from official sources opened during the session. Label anything from memory as approximate.
- Code blocks are short. Use tables instead of long bullet lists.

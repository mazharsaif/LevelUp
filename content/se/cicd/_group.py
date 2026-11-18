"""Rebuild content/se/cicd/NN.md from the CI/CD book (cicd-tutorial/source, Typst).
1) python3 .claude/skills/levelup-skill-tree/scripts/typ2md.py "../German Learning/cicd-tutorial/source" <tmp>/cicd_md   (run from the repo root)
2) python3 content/se/cicd/_group.py <tmp>/cicd_md        -> 00..20.md (sections grouped into skills below)
Diagrams: copy the SVGs listed in <tmp>/cicd_md/_meta.json ("figs") into content/se/cicd/img/.
"""
import re, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.abspath(os.path.join(HERE, "../../..")); WS = os.path.join(os.path.dirname(REPO), "German Learning")
M = sys.argv[1]
sys.argv = ["x", os.path.join(WS, "cicd-tutorial/source"), M]
exec(open(os.path.join(REPO, ".claude/skills/levelup-skill-tree/scripts/typ2md.py")).read().split("if __name__")[0])
OUT = HERE
meta = json.load(open(f"{M}/_meta.json"))["chapters"]
secs = {}
for f in sorted(os.listdir(M)):
    if not f.endswith(".md"): continue
    s = open(f"{M}/{f}").read()
    for x in re.split(r"^### ", s, flags=re.M)[1:]:
        secs[(f[:-3], x.split("\n")[0].strip())] = "### " + x.strip()
def S(ch, *titles):
    out = []
    for t in titles:
        k = next(k for k in secs if k[0] == ch and k[1].startswith(t)); out.append(k)
    return out
SK = [  # (title, sections)
 ("What CI/CD is", S("01-intro", "A tale", "The vocabulary", "Why ML", "The map")),
 ("Merge & rebase", S("02-git", "The team workflow", "Merge vs.", "Interactive rebase", "Commit messages")),
 ("Merge conflicts", S("02-git", "Merge conflicts")),
 ("Stash & recovery", S("02-git", "`git stash`", "`git worktree`", "Recovery")),
 ("Tests with pytest", S("03-level1", "The running example", "pytest from zero")),
 ("First CI pipeline", S("03-level1", "Your first GitHub", "The CI badge")),
 ("Lint, cache & matrix", S("04-level2", "Linting", "Faster", "The complete CI")),
 ("Protected PRs & secrets", S("04-level2", "Branch protection", "Secrets", "Speed and cost", "Testing strategy")),
 ("AWS setup & Docker", S("05-level3", "AWS account", "Docker for")),
 ("Keyless OIDC to AWS", S("05-level3", "Keyless", "Choosing a deployment")),
 ("Deploy & roll back", S("05-level3", "The deployment workflow", "Cleanup")),
 ("Data & model gates", S("06-level4", "Part A", "Training in CI")),
 ("MLflow & registry", S("06-level4", "Experiment tracking")),
 ("Evaluating RAG", S("06-level4", "Part B", "Controlling LLM", "Operating ML")),
 ("Operate in production", S("065-operate", "Why operating", "Logs", "SLOs", "Watching", "Game day", "Runbooks", "Cost governance", "Compliance")),
 ("DevOps overview", S("07-level5", "Running", "Releasing", "Security,", "Capstone")),
 ("Cheat sheets & fixes", S("08-appendix", "Cheat sheet: Git", "Cheat sheet: GitHub", "Cheat sheet: Docker", "Cheat sheet: AWS", "Troubleshooting", "Glossary")),
 ("System design", S("075-senior", "What \"senior\"", "System design") + S("06-level4", "Explaining your pipeline")),
 ("Senior interview", S("075-senior", "Fifteen", "Your stories", "Turn the repositories")),
 ("Boss: Exercise review", S("08-appendix", "Solutions")),
]
used = [k for _, ks in SK for k in ks]
missing = [k for k in secs if k not in used and k[1] not in ("What-if index", "Study plan: four weeks, about 45 hours")]
assert not missing, missing
assert len(used) == len(set(used))
os.makedirs(OUT, exist_ok=True)
seen_ch = set(); report = []
for n, (title, ks) in enumerate(SK, 1):
    body = "\n\n".join(secs[k] for k in ks)
    if body.count("\n### ") + 1 < 3:   # too few sections for 3 parts: promote sub-sections
        body = re.sub(r"^#### ", "### ", body, flags=re.M)
    head = ""
    ch = ks[0][0]
    if ch not in seen_ch and meta[ch].get("intro"):
        m = meta[ch]; seen_ch.add(ch)
        head = f"*{m['kicker']}: {m['title']}.* {m['intro']}\n\n"
        if m.get("goals"): head += "**After this level you can:**\n\n" + "\n".join("- " + g for g in m["goals"]) + "\n\n"
        if m.get("builds"): head += f"**What you build:** {m['builds']}\n\n"
    md = f"## {n}. {title}\n\n{head}{body}\n"
    open(f"{OUT}/{n:02d}.md", "w").write(md)
    report.append((n, title, len(md.split()), md.count("\n### ")))
# About = the book's "How to use this book" page + the study plan
b = open(os.path.join(WS, "cicd-tutorial/source/book.typ")).read()
k = b.index("How to use this book]"); k = b.index("\n", k)
start = b.rfind("[", 0, b.index("How to use this book]") - 60)
end = match(b, start, "[", "]")
how = tidy(conv(b[k:end - 1]))
how = re.sub(r"^#{2,} ", "### ", how, flags=re.M)
study = secs[("08-appendix", "Study plan: four weeks, about 45 hours")]
open(f"{OUT}/00.md", "w").write("## How to use this guide\n\nThis branch is the full text of *CI/CD for ML Engineers* (Edition November 2026), split into 20 skills. The companion code lives in `cicd-tutorial/code/credit-api` and `cicd-tutorial/code/rag-api`.\n\n### How to use this book\n\n" + how.strip() + "\n\n" + study + "\n")
for r in report: print(r)

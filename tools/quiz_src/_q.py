"""Helpers for writing practice questions in Python, then saving them as content/<tree>/<branch>/NN.q.json."""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _g(d, gap):
    """gap: id of the earlier skill a wrong answer points back to (concept checks), e.g. "found.fractions"."""
    if gap: d["gap"] = gap
    return d
def MC(q, o, a, why, gap=None): return _g({"t": "mc", "q": q, "o": o, "a": a, "why": why}, gap)
def TF(q, a, why, gap=None): return _g({"t": "tf", "q": q, "a": a, "why": why}, gap)
def MF(q, a, why, gap=None): return _g({"t": "mf", "q": q, "a": a, "why": why}, gap)
def NUM(q, a, why, tol=None, unit=None, gap=None):
    d = {"t": "num", "q": q, "a": a, "why": why}
    if tol is not None: d["tol"] = tol
    if unit: d["unit"] = unit
    return _g(d, gap)
# concept checks
def ASN(q, a, why, gap=None):
    """Always, sometimes or never true? a = "always" | "sometimes" | "never"."""
    assert a in ("always", "sometimes", "never"), a
    return _g({"t": "asn", "q": q, "a": a, "why": why}, gap)
def STEP(q, lines, a, why, gap=None):
    """Find the first wrong line in a worked solution. a = index into lines (line 0 is usually the question, kept right)."""
    assert 0 <= a < len(lines), (q, a)
    return _g({"t": "step", "q": q, "lines": lines, "a": a, "why": why}, gap)


def save(tree, branch, quizzes, kind="q"):
    """quizzes: {chapter number: [questions]}; kind "q" = practice (NN.q.json), "c" = concept check (NN.c.json)"""
    for ch, qs in quizzes.items():
        p = os.path.join(ROOT, "content", tree, branch, f"{ch:02d}.{kind}.json")
        with open(p, "w", encoding="utf-8") as f:
            json.dump(qs, f, ensure_ascii=False, indent=1)
    print(f"{tree}/{branch} ({kind}): {len(quizzes)} skills, {sum(len(q) for q in quizzes.values())} questions")

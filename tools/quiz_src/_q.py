"""Helpers for writing practice questions in Python, then saving them as content/<tree>/<branch>/NN.q.json."""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def MC(q, o, a, why): return {"t": "mc", "q": q, "o": o, "a": a, "why": why}
def TF(q, a, why): return {"t": "tf", "q": q, "a": a, "why": why}
def MF(q, a, why): return {"t": "mf", "q": q, "a": a, "why": why}
def NUM(q, a, why, tol=None, unit=None):
    d = {"t": "num", "q": q, "a": a, "why": why}
    if tol is not None: d["tol"] = tol
    if unit: d["unit"] = unit
    return d


def save(tree, branch, quizzes):
    """quizzes: {chapter number: [questions]}"""
    for ch, qs in quizzes.items():
        p = os.path.join(ROOT, "content", tree, branch, f"{ch:02d}.q.json")
        with open(p, "w", encoding="utf-8") as f:
            json.dump(qs, f, ensure_ascii=False, indent=1)
    print(f"{tree}/{branch}: {len(quizzes)} skills, {sum(len(q) for q in quizzes.values())} questions")

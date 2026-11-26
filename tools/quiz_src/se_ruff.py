from _q import MC, MF, save
RUFF = {
1: [MC("Which pair of commands are Ruff's two main jobs?", ["ruff check and ruff format", "ruff lint and ruff style", "ruff test and ruff build", "ruff scan and ruff sort"], 0, "check lints (and fixes); format rewrites layout."),
    MC("Ruff replaces which formatter?", ["Black", "isort", "Flake8", "pytest"], 0, "ruff format is built as a drop-in replacement for Black."),
    MC("How do you run Ruff once without adding it to the project?", ["uvx ruff check .", "uv add ruff check", "pip run ruff", "ruff --install check"], 0, "uvx downloads Ruff into a cache and runs it."),
    MC("In 'F401 [*] `os` imported but unused', what does [*] mean?", ["Ruff has an automatic fix", "The rule is unsafe", "The finding is a warning only", "The rule is new"], 0, "[*] marks findings that --fix can fix."),
    MC("ruff check exits with code 1. What happened?", ["It found problems", "Ruff crashed", "The config is broken", "Everything is clean"], 0, "1 means findings; 2 means Ruff itself failed; 0 means clean."),
    MF("To learn what a rule like F401 checks, you have to search the web.", False, "Myth: ruff rule F401 prints the rule's full explanation.")],
2: [MC("Which prefix is the isort family (import sorting)?", ["I", "F", "UP", "B"], 0, "I001 is unsorted-imports."),
    MC("select = [\"E\", \"F\"] with ignore = [\"F401\"] runs …", ["all E and F rules except F401", "only F401", "E, F and the defaults", "nothing"], 0, "select replaces the set; ignore removes from it."),
    MC("You want to add the B rules on top of the defaults. Use …", ["extend-select = [\"B\"]", "select = [\"B\"]", "ignore = [\"B\"]", "per-file-ignores"], 0, "select = [\"B\"] would run only B."),
    MC("Which comment silences only unused-import on one line?", ["# noqa: F401", "# noqa", "# ruff: off", "# type: ignore"], 0, "Always name the code; a bare noqa hides everything on the line."),
    MC("LevelUp's pyproject.toml has requires-python >=3.13 and no target-version. Ruff assumes …", ["Python 3.13", "Python 3.11", "the newest Python", "Python 3.7"], 0, "Ruff reads requires-python when no Ruff config sets target-version."),
    MF("E501 (line too long) is in Ruff's default rule set.", False, "Myth: you add it with extend-select if you want line length enforced.")],
3: [MC("By default, ruff check --fix applies …", ["only safe fixes", "safe and unsafe fixes", "only formatting", "nothing until you confirm"], 0, "Unsafe fixes need --unsafe-fixes as well."),
    MC("Why is the B006 fix (cache={} to cache=None) unsafe?", ["Code may rely on the shared default object", "It deletes the function", "It breaks the syntax", "It changes the line length"], 0, "Unsafe fixes may change what the code does at run time."),
    MC("Which command shows what --fix would change without writing anything?", ["ruff check --diff", "ruff check --watch", "ruff format --check", "ruff check --statistics"], 0, "--diff prints a unified diff and changes no files."),
    MC("In CI, which command fails when a file isn't formatted?", ["ruff format --check", "ruff format", "ruff check --fix", "ruff format --fix"], 0, "--check writes nothing and exits 1 if a file would change."),
    MF("ruff format also sorts your imports.", False, "Myth: sorting is lint rule I001; run ruff check --select I --fix, then ruff format."),
    MF("ruff format changes layout but never what the code does.", True, "Fact: that is the difference between a formatter and a lint fix.")],
4: [MC("What gives you Ruff findings as you type in the editor?", ["ruff server, the language server", "pre-commit", "ruff format --check", "a CI job"], 0, "The editor plugin talks to ruff server."),
    MC("In .pre-commit-config.yaml, ruff-check uses --fix. Where does it go?", ["Before ruff-format", "After ruff-format", "Order doesn't matter", "In a separate file"], 0, "Fixes can leave code that the formatter then tidies."),
    MC("Which flag makes GitHub show findings as notes on the pull request?", ["--output-format github", "--diff", "--statistics", "--show-fixes"], 0, "GitHub Actions turns that format into inline notes."),
    MC("Why pin the Ruff version (rev, uv add --dev ruff)?", ["New versions can change defaults and fail unchanged code", "Newer versions are slower", "Pinning makes Ruff skip files", "Unpinned Ruff can't fix"], 0, "Ruff 0.16 grew the default rule set from 59 to 413 rules."),
    MC("Adopting Ruff on an old repo: what goes in its own commit?", ["The first ruff format run", "Each single fix", "The CI step and the fixes together", "Nothing; do it all at once"], 0, "It touches many lines but no behaviour, so it is easy to review and skip."),
    MC("CI must go green today, but 50 old findings remain. Which command helps?", ["ruff check --add-noqa", "ruff check --unsafe-fixes", "ruff format --check", "ruff check --exit-zero forever"], 0, "It writes a noqa on each remaining finding, to remove later.")],
}


def _spread(qs, k):
    """Move each right answer to a varied position (all are written first above)."""
    for i, q in enumerate(qs):
        if q["t"] == "mc":
            r = (i + k) % len(q["o"])
            q["o"] = q["o"][1:r + 1] + [q["o"][0]] + q["o"][r + 1:]
            q["a"] = r
    return qs


save("se", "ruff", {ch: _spread(qs, ch) for ch, qs in RUFF.items()})

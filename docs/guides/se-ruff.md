# Ruff

## How to use this track

This short track is about **Ruff**, the Python linter and formatter made by Astral (the company behind uv). It takes about 15 minutes to read, in four skills of three or four minutes each.

Read the **Linting** branch first. It explains what a linter is, what rules and ignores are, and where linting fits in your workflow. This track assumes all of that and shows how one real tool does it.

The running example is the LevelUp repo itself: a FastAPI server in `server_fastapi/`, Python 3.13, managed with uv. Today it is linted with one long command and has no Ruff config file. By the end you will know how to move that command into `pyproject.toml` and run Ruff in the editor, before each commit and in CI.

### What the four skills cover

| Skill | You will learn |
|---|---|
| Meet Ruff | Install it, run it, read its output |
| Rules & config | Rule codes, select and ignore, pyproject.toml |
| Fixes & format | Safe and unsafe fixes, the formatter |
| Ruff everywhere | Editor, pre-commit, CI, an existing repo |

### Order

Start with **Meet Ruff**. **Rules & config** and **Fixes & format** can be read in either order. **Ruff everywhere** puts them together.

The facts here match Ruff 0.17 (November 2026). Ruff changes quickly, and version 0.16 changed which rules are on by default, so check `ruff --version` when your results differ.

## 1. Meet Ruff

This skill covers what Ruff is, how to install and run it, and how to read what it prints. After it you can lint any Python folder in a few seconds.

### One tool instead of many

A **linter** reads your code without running it and reports likely mistakes and style problems. Python projects used to need several tools for this, each with its own config and its own install. Ruff replaces most of them with one program.

| Old tool | What it did | Ruff |
|---|---|---|
| Flake8 + plugins | Lint rules | `ruff check` |
| isort | Sort imports | the `I` rules |
| pyupgrade | Modernise syntax | the `UP` rules |
| autoflake | Remove unused imports | `F401` with a fix |
| Black | Format code | `ruff format` |

Ruff is written in Rust. The Ruff docs say it is 10 to 100 times faster than Flake8 and Black, and it caches results so unchanged files are not checked again. It has over 900 rules. For a small project like LevelUp the speed hardly matters; for a large codebase it is the main reason people switch. The other reason is simpler: one tool, one config, one version to pin.

The cost: Ruff is young and moves fast. New releases add rules and sometimes change defaults, so the same command can give different results after an upgrade. You handle that by pinning the version (see **Ruff everywhere**).

### Install and run

With uv you do not even need to install it. `uvx` downloads Ruff into a cache and runs it:

```bash
uvx ruff check .
```

To make Ruff part of the project, so everyone uses the same version, add it as a development dependency:

```bash
uv add --dev ruff
uv run ruff check .
```

Without uv, `pip install ruff` or `pipx install ruff` work too. Ruff has two main commands:

| Command | Job |
|---|---|
| `ruff check` | Lint: report (and fix) problems |
| `ruff format` | Format: rewrite layout |

Both take files or folders; with none, they use the current folder. Ruff skips folders such as `.venv` and `.git`, and anything listed in `.gitignore`.

### Read the output

Here is a small file `x.py`. Ruff reports two findings for it; this is one of them:

```python
import os

def load(path):
    return open(path).read()
```

```text
F401 [*] `os` imported but unused
 --> x.py:1:8
  |
1 | import os
  |        ^^
help: Remove unused import: `os`
```

Read it top to bottom:

- `F401` is the **rule code**. The letters say which family the rule comes from (`F` is Pyflakes), the number picks the rule.
- `[*]` means Ruff has an automatic fix for it.
- `x.py:1:8` is the file, line and column.
- The snippet and `help:` line show what is wrong and what the fix would do.

At the end Ruff prints a summary, here `Found 2 errors.` and `[*] 2 fixable with --fix`. For a short one-line-per-finding view, add `--output-format concise`. To learn what any rule means, ask Ruff: `ruff rule F401` prints its full explanation.

The **exit code** is what scripts and CI look at: `0` means no problems (or all were fixed), `1` means problems were found, `2` means Ruff itself failed (for example a broken config).

### Try it

1. In the LevelUp repo, run `uvx ruff --version`.
2. Run `uvx ruff check server_fastapi/ --output-format concise`.
3. Pick one rule code from the output and run `uvx ruff rule <CODE>`.
4. Run `echo $?` straight after a check to see the exit code.

### Check yourself

1. Which older tools does Ruff replace for linting, import sorting and formatting?
2. What does `[*]` next to a rule code mean?
3. How do you run Ruff without adding it to the project?
4. What does exit code 1 from `ruff check` tell a CI job?

**Answers.** 1. Flake8 (with plugins), isort and Black, plus pyupgrade and autoflake. 2. Ruff has an automatic fix for that finding. 3. `uvx ruff check .` 4. Ruff ran fine but found problems, so the job should fail.

## 2. Rules & config

This skill covers how Ruff names its rules, how you choose which ones run, how you silence one finding, and how to put all of it in `pyproject.toml` instead of on the command line.

### Rule codes and prefixes

Every rule has a code: a prefix of letters for the family, then a number. Most families are ports of older Flake8 plugins, so the prefixes will look familiar.

| Prefix | Family | Catches, for example |
|---|---|---|
| `F` | Pyflakes | Unused imports, undefined names |
| `E`, `W` | pycodestyle | Long lines, whitespace |
| `I` | isort | Unsorted imports |
| `UP` | pyupgrade | Old syntax, like `List[str]` |
| `B` | flake8-bugbear | Likely bugs, like `cache={}` |
| `SIM` | flake8-simplify | Code that can be simpler |
| `RUF` | Ruff's own | Ruff-specific checks |

`ruff linter` lists every prefix. A **selector** can be a whole family (`B`), a narrower prefix (`E4`) or one rule (`F401`). `ALL` means every rule, which is very noisy and rarely what you want.

### The default rule set

With no config, Ruff runs its **default rule set**. In Ruff 0.16 this grew from 59 rules to 413, across many families, and some opinionated rules were dropped from it (for example `E711`, comparing with `== None`). So the defaults are now a sensible, broad starting point, but they depend on your Ruff version.

If you want the old, small set back, the Ruff team gives this:

```toml
[tool.ruff.lint]
select = ["E4", "E7", "E9", "F"]
```

### select, extend-select, ignore

Three settings shape the rule set:

| Setting | Effect |
|---|---|
| `select` | Replace the set: only these run |
| `extend-select` | Add these to the current set |
| `ignore` | Turn these off |

For example, `select = ["E", "F"]` with `ignore = ["F401"]` runs all E and F rules except F401. The Ruff docs prefer `select` when you want the rule set to be explicit, because `extend-select` depends on what the default happens to be. The same names work as flags: `ruff check --select F401` runs only F401. Flags win over the config file.

### Silencing one finding

Sometimes a finding is wrong for one line. Add a `noqa` comment with the code:

```python
import app  # noqa: F401
```

Always name the code. A bare `# noqa` hides every finding on that line, including ones you have not seen yet. Ruff can also check your comments: rule `RUF100` reports `noqa` comments that no longer hide anything.

For whole files or folders, use **per-file-ignores** in the config instead of comments:

```toml
[tool.ruff.lint.per-file-ignores]
"__init__.py" = ["F401"]
"tests/*" = ["S101"]
```

Ruff 0.16 also added `# ruff: ignore[CODE]` comments, which can sit at the end of a line or on the line above. `noqa` still works and is what most existing code uses.

### Config in pyproject.toml

LevelUp's current command is:

```bash
uvx ruff check --target-version py313 \
  --line-length 130 server_fastapi/
```

The same settings belong in `pyproject.toml`, under `[tool.ruff]` (shared by linter and formatter) and `[tool.ruff.lint]` (linter only):

```toml
[tool.ruff]
line-length = 130
target-version = "py313"

[tool.ruff.lint]
extend-select = ["E501"]
```

Now the command is just `uvx ruff check`. The settings that matter most:

| Key | Default | Meaning |
|---|---|---|
| `line-length` | 88 | Same as Black |
| `target-version` | `py311` | Oldest Python to support |
| `exclude` | `.venv`, `.git`, … | Folders to skip |

You can often leave `target-version` out: when no Ruff config sets it, Ruff reads `requires-python` from `pyproject.toml`. LevelUp's says `>=3.13`, so Ruff already assumes Python 3.13. `E501` (line too long) is not in the default set, so it has to be added if you want the 130 limit enforced.

A separate `ruff.toml` works too. It holds the same keys without the `tool.ruff` prefix: `[lint]` instead of `[tool.ruff.lint]`. If a folder has both, `ruff.toml` wins over `pyproject.toml`.

### Try it

1. Copy `server_fastapi/` and `pyproject.toml` into a scratch folder.
2. Add the `[tool.ruff]` block above to the copy.
3. Run `uvx ruff check` there with no flags.
4. Add one code to `ignore` and run it again.

### Check yourself

1. What is the difference between `select` and `extend-select`?
2. Why write `# noqa: F401` and not `# noqa`?
3. Where does Ruff get the target Python version if you never set it?
4. In `ruff.toml`, what is the section for linter settings called?

**Answers.** 1. `select` replaces the rule set; `extend-select` adds to it. 2. A bare `noqa` hides every rule on the line, even future findings. 3. From `requires-python` in `pyproject.toml` (otherwise the default, py311). 4. `[lint]`.

## 3. Fixes & format

This skill covers how Ruff changes your code for you: lint fixes (safe and unsafe), previewing them, and the formatter, which is a separate job from linting.

### Safe fixes with --fix

Many rules come with a fix (the `[*]` in the output). `--fix` applies them:

```bash
uvx ruff check --fix .
```

Ruff marks each fix as **safe** or **unsafe**. A safe fix keeps what the code does at run time: removing an unused import, sorting imports, writing `list[str]` instead of `List[str]`. By default `--fix` applies only safe fixes. After fixing, Ruff reports what is left, for example `Found 6 errors (4 fixed, 2 remaining).`

### Unsafe fixes

An **unsafe** fix might change what the code does. Take this function, flagged by `B006` (mutable default argument):

```python
def load(path, cache={}):
    ...
```

The fix rewrites it to `cache=None` and adds `if cache is None: cache = {}` in the body. That is usually what you meant, but if some code relied on the shared dictionary, behaviour changes. So Ruff shows the fix with the note "This is an unsafe fix and may change runtime behavior" and only applies it when you ask:

```bash
uvx ruff check --fix --unsafe-fixes
```

Use unsafe fixes one rule at a time and read the diff, for example with `--select B006`. A project can also move rules between the groups with the `extend-safe-fixes` and `extend-unsafe-fixes` settings.

### Look before you leap: --diff

`--diff` prints the changes `--fix` would make, as a unified diff, and writes nothing:

```bash
uvx ruff check --diff .
```

It is the safe way to try fixes on a repo you do not know well. Other useful flags:

| Flag | Effect |
|---|---|
| `--diff` | Show fixes, change nothing |
| `--fix-only` | Fix, don't list what is left |
| `--statistics` | Count findings per rule |
| `--watch` | Re-run on every save |

### The formatter

`ruff format` is a **formatter**: it rewrites the layout of your code (quotes, spaces, line breaks, blank lines) and never changes what it does. It is built to be a drop-in replacement for Black, with almost the same output.

```python
x = {'a':1,
  'b':2}
def f(a,b): return a+b
```

becomes

```python
x = {"a": 1, "b": 2}


def f(a, b):
    return a + b
```

It uses double quotes by default and reads the shared `line-length` from `[tool.ruff]`. Its own options (such as `quote-style`) go in `[tool.ruff.format]`.

| What | `ruff check` | `ruff format` |
|---|---|---|
| Job | Find likely bugs and style | Fix layout only |
| Changes code | Only with `--fix` | Yes, by default |
| Preview | `--diff` | `--diff` |
| CI mode | exit code 1 | `--check` |

`ruff format --check` writes nothing and exits with 1 if any file would be reformatted. That is the CI version.

Two things to know:

- **The formatter does not sort imports.** Import sorting is a lint rule (`I001`). To do both, run `ruff check --select I --fix` and then `ruff format`.
- Since Ruff 0.16, `ruff format` also formats Python code blocks inside Markdown files. In a repo full of guides, like LevelUp, add `extend-exclude = ["*.md"]` if you don't want that.

Some lint rules fight the formatter (for example `W191`, tabs, and `COM812`, trailing commas); the docs say to turn them off when you use both, and `ruff format` warns when they are on.

### Try it

1. In a scratch folder, save the messy `x = {'a':1, …}` example as `f.py`.
2. Run `uvx ruff format --diff f.py`, then `uvx ruff format f.py`.
3. Add two unsorted imports and run `uvx ruff format` again: they stay unsorted.
4. Run `uvx ruff check --select I --fix f.py` and look at the imports.

### Check yourself

1. Which fixes does `--fix` apply by default?
2. Why is the B006 fix unsafe?
3. Which command shows what `--fix` would change without writing anything?
4. You ran `ruff format` but imports are still out of order. Why, and what do you run?

**Answers.** 1. Only safe fixes. 2. Code may rely on the shared default object, so replacing it with `None` can change behaviour. 3. `ruff check --diff`. 4. Sorting imports is a lint rule (I001), not formatting; run `ruff check --select I --fix`, then `ruff format`.

## 4. Ruff everywhere

This skill puts Ruff in the three places it pays off: your editor (as you type), pre-commit (before each commit) and CI (before each merge). It ends with how to adopt Ruff on a repo that already has a lot of code, like LevelUp.

### In the editor

Ruff has a built-in **language server** (`ruff server`), stable since Ruff 0.5.3. Editors talk to it to show findings as you type, offer quick fixes, and format the file. You rarely start it yourself: the editor plugin does.

| Editor | How |
|---|---|
| VS Code | The "Ruff" extension (`charliermarsh.ruff`) |
| Zed, Neovim, Helix, PyCharm, … | See the Ruff docs, Editors → Setup |

The older `ruff-lsp` server has been replaced by `ruff server`.

### Before each commit

**pre-commit** is a tool that runs checks when you type `git commit`. Ruff's official hooks live in the `ruff-pre-commit` repo. Put this in `.pre-commit-config.yaml`:

```yaml
repos:
- repo: https://github.com/astral-sh/ruff-pre-commit
  rev: v0.17.6
  hooks:
    - id: ruff-check
      args: [ --fix ]
    - id: ruff-format
```

Then run `pre-commit install` once. Two details from the Ruff docs:

- `rev` is the Ruff version. Pin it, and bump it on purpose.
- When `ruff-check` runs with `--fix`, put it **before** `ruff-format`, because a fix can leave code the formatter then tidies.

### In CI

CI is the check that cannot be skipped. With uv, two lines are enough:

```bash
uvx ruff check --output-format github
uvx ruff format --check
```

`--output-format github` prints findings in the form GitHub Actions turns into notes on the pull request's changed lines. Both commands exit with 1 on a problem, so the job fails.

Astral also publishes a ready-made action:

```yaml
- uses: astral-sh/ruff-action@v4.1.0
- uses: astral-sh/ruff-action@v4.1.0
  with:
    args: "format --check --diff"
```

By default it runs `ruff check`. If you didn't set a `version`, it uses the Ruff version from your `pyproject.toml` (for example from `uv add --dev ruff`), else the latest. Pinning matters: the 0.16 change to the default rule set would otherwise fail builds on unchanged code.

### Adopting Ruff on an existing repo

Running Ruff 0.17 with its defaults over LevelUp's `server_fastapi/` today gives six findings (blocking `open` in async functions, a blind `except Exception`, and others), and four of its five files would be reformatted. A good order:

1. **Pin and configure.** `uv add --dev ruff`, then add the `[tool.ruff]` block from **Rules & config**.
2. **Format in one commit.** Run `ruff format`, commit it alone with a clear message, and nothing else. Reviewers can skip it.
3. **Apply safe fixes.** `ruff check --fix`, read the diff, run the tests, commit.
4. **Decide on the rest.** Fix what is real. For rules you disagree with, add them to `ignore`. For one-off exceptions, use a `noqa` with the code.
5. **Freeze the leftovers if needed.** `ruff check --add-noqa` writes a `noqa` comment on every remaining finding, so CI can go green today and you remove them later.
6. **Turn on the gates.** Add the pre-commit hooks and the CI step.

Keep the first config small. You can `extend-select` more families (like `S` for security) later, one at a time.

### Try it

1. In a scratch copy of the repo, add the pre-commit config above.
2. Run `uvx pre-commit run --all-files` and watch both hooks run.
3. Run `uvx ruff check --output-format github` and look at one line.
4. Run `uvx ruff check --add-noqa` and count the new comments with `git diff --stat`.

### Check yourself

1. What does the editor use to show Ruff findings as you type?
2. In pre-commit, which hook goes first when the lint hook uses `--fix`, and why?
3. Which output format adds notes to a pull request on GitHub?
4. Why put the first `ruff format` run in a commit of its own?

**Answers.** 1. Ruff's built-in language server, `ruff server`, through the editor plugin. 2. `ruff-check` goes before `ruff-format`, because fixes can leave code that the formatter then cleans up. 3. `--output-format github`. 4. It touches many lines but changes no behaviour, so it is easy to review, and to skip when reading history.

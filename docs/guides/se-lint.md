# Linting

## How to use this track

This short track explains **linting**: running a tool that reads your code, without running it, and points at likely bugs and messy patterns. It takes about 15 minutes to read, in four skills.

The running example is the LevelUp repo itself. It has a FastAPI server in Python (`server_fastapi/`) and a plain-JavaScript app (`app/js/`) with no build step. Today the project checks Python with one command:

```bash
uvx ruff check \
  --target-version py313 \
  --line-length 130 \
  server_fastapi/
```

and checks JavaScript only with `node --check`, which catches syntax errors and nothing else.

### What you will be able to do

| Skill | You can |
|---|---|
| What linting is | Say what a linter catches and what it can't |
| Rules & config | Pick rules, set severity, ignore wisely |
| Linters by language | Choose a linter for Python, JS or shell |
| Lint in your workflow | Run it in the editor, on commit and in CI |

### Order

Read **What linting is** first. **Rules & config** and **Linters by language** can be read in any order. **Lint in your workflow** brings them together.

This track stays general and works for any language. The **Ruff** branch goes deep on one tool: Ruff's rule codes, its config and its commands.

## 1. What linting is

This skill covers what a linter is, what kinds of problems it catches, and how it differs from a formatter, a type checker and tests. Knowing the difference stops you expecting one tool to do another tool's job.

### A linter reads code without running it

A **linter** is a program that reads your source code and reports patterns that are often mistakes. It never runs your program. This is called **static analysis**: checking code by looking at it, not by executing it.

Because nothing runs, a linter is fast and safe. It needs no database, no API keys and no test data. You can run it on every file in the LevelUp repo in about a second.

Here is a Python function from a server like LevelUp's, with three problems:

```python
import os, json

def load(uid):
    path = f"data/{uid}.json"
    with open(path) as f:
        data = json.load(f)
    return dat
```

A linter reports:

| Line | Problem |
|---|---|
| 1 | `os` is imported but never used |
| 6 | `data` is assigned but never used |
| 7 | `dat` is an undefined name |

The third one is a real bug. Python would only fail when someone calls `load()`, maybe on the live server. The linter finds it before you commit.

### Bugs versus style

Linter findings fall into two broad groups.

| Kind | Examples | Why it matters |
|---|---|---|
| Likely bugs | Undefined name, unreachable code, a key repeated in a dict | The program may crash or do the wrong thing |
| Style and smells | Unused import, a too-long function, a confusing name | Harder to read and change later |

The bug group is the most valuable. Style findings are useful too, but they are a matter of taste, so teams argue about them. A good start is to turn on the bug rules first and add style rules slowly (see **Rules & config**).

### Linter, formatter, type checker, tests

Four kinds of tools check code. Each one answers a different question.

| Tool | Question it answers | Runs code? |
|---|---|---|
| Linter | Does this look like a mistake? | No |
| Formatter | Is the layout consistent? | No |
| Type checker | Do the types fit together? | No |
| Tests | Does it do the right thing? | Yes |

A **formatter** (such as Black or Prettier) rewrites spacing, quotes and line breaks so all code looks the same. It does not look for bugs. The Prettier docs put it simply: use a formatter for formatting and a linter for catching bugs.

A **type checker** (such as mypy for Python or the TypeScript compiler) checks that you pass the right kinds of values, for example a string where a string is expected. A linter does a little of this, but much less.

**Tests** run your code with real inputs and check the output. Only tests can tell you that `load()` returns the right user. A linter can only tell you that it looks wrong.

So the tools do not replace each other. A linter is the cheapest layer. It catches the silly mistakes in seconds, which leaves your tests and reviewers free for the real logic.

### What a linter cannot do

A linter works from patterns, so it has limits:

- It can't know your intent. Code that is clean but wrong passes.
- It gives **false positives**: warnings about code that is actually fine. You will need a way to silence these.
- In dynamic languages like Python and JavaScript, it can't always tell what a name refers to at runtime.

LevelUp's JavaScript shows the gap. `node --check app/js/app.js` only confirms the file parses. A typo in a variable name inside a function still passes, and fails only in a learner's browser. A JavaScript linter would flag it.

### Try it

1. In the LevelUp repo, run `uvx ruff check server_fastapi/`.
2. Read each finding. For each one, decide: likely bug or style? (One flags an `if`/`else` whose two branches give the same value. Is that style, or a sign of a bug?)
3. Now run `node --check app/js/app.js`. Note that it prints nothing when the file parses.
4. Add the line `let x = undefinedThing;` inside a function in a scratch copy of a JS file and run `node --check` on it. It still passes.

### Check yourself

1. What does "static analysis" mean?
2. Which is more valuable: a rule that finds undefined names, or one that limits line length? Why?
3. Name one thing tests can find that a linter cannot.
4. Why doesn't `node --check` count as linting?

**Answers.** 1. Checking code by reading it, without running it. 2. The undefined-name rule, because it finds code that will crash; line length is only style. 3. Wrong results from correct-looking code, such as `load()` returning the wrong user. 4. It only checks that the file parses; it doesn't look for patterns such as unused or undefined variables.

## 2. Rules & config

This skill covers how a linter decides what to report: rules, severity, the config file and ignore comments. It also shows how to add a linter to an existing codebase without drowning in thousands of warnings.

### Rules and severity

A linter is a collection of **rules**. Each rule looks for one pattern, such as "unused variable" or "comparison with `==` instead of `===`". Each rule has a name or a code, so you can turn it on or off on its own.

Most linters let you set a **severity** for each rule. ESLint, for example, has three levels:

| Severity | Meaning | Fails the run? |
|---|---|---|
| off | Rule is not checked | No |
| warn | Reported, shown in yellow | No |
| error | Reported, shown in red | Yes |

"Fails the run" means the linter exits with a non-zero code. That exit code is what makes a pre-commit hook or a CI job stop (see **Lint in your workflow**). A warning is a hint; an error is a gate.

Keep the list of errors short and real. If every rule is an error, people stop reading the output and start ignoring it.

### The config file

Rules live in a config file in the repo, so every developer and the CI server use the same settings. Common names:

| Linter | Config file |
|---|---|
| ESLint | `eslint.config.js` |
| Ruff | `pyproject.toml` or `ruff.toml` |
| Biome | `biome.json` |
| ShellCheck | `.shellcheckrc` |

A config usually says three things: which rules are on, which files to check, and a few options. LevelUp passes its options on the command line instead (`--line-length 130`). That works, but a config file is better: the editor and the CI server then read the same settings without anyone copying flags.

Most linters ship a **recommended** set: rules the authors think almost everyone wants. ESLint's `js/recommended` is one. Start there rather than picking rules one by one.

### Ignoring one line, with a reason

Sometimes the linter is wrong for one line, or the code is odd on purpose. Every linter has an **inline ignore** comment that silences one rule on one line:

```python
import site_setup  # noqa: F401
```

```js
// eslint-disable-next-line no-alert
alert("Saved");
```

```bash
# shellcheck disable=SC2086
rm $FILES
```

Three habits keep ignores honest:

1. **Name the rule.** A bare `# noqa` silences every rule on the line, including ones you didn't mean to hide.
2. **Say why.** ESLint lets you add a reason after `--`: `// eslint-disable-next-line no-alert -- shown on purpose`. In other linters, add a normal comment.
3. **Clean up.** ESLint can report ignore comments that no longer hide anything (`reportUnusedDisableDirectives`).

An ignore without a reason is a small piece of debt. The next reader can't tell if it is still needed.

### Adopting a linter on an old codebase

Run a linter on a large project for the first time and you may get thousands of findings. Fixing them all at once is a huge, risky change, and blocking every commit until then stops all work. Instead:

| Step | What you do |
|---|---|
| Start small | Turn on only the bug rules at first |
| Auto-fix | Let the tool fix the safe, mechanical ones |
| Baseline | Record the old findings so only new ones fail |
| Ratchet | Add one more rule at a time, later |

A **baseline** is a saved list of existing problems that the linter will not report again. New code must be clean; old code is fixed when someone touches it. ESLint has this built in (`--suppress-all` writes `eslint-suppressions.json`). Ruff can write an ignore comment on every current finding (`--add-noqa`). The **Ruff** branch shows that in detail.

LevelUp's Python is close to clean: its lint command reports only a handful of findings, few enough to fix or ignore by hand, so it needs no baseline. Its JavaScript has never been linted, so it is the place where "start small" matters.

### Try it

1. Run `uvx ruff check server_fastapi/ --statistics`. It shows a count per rule, not each finding.
2. Look at the count. Would you fix these by hand, auto-fix them, or baseline them?
3. Search the repo for `noqa` comments: `grep -rn "noqa" server_fastapi/`. If you find any, does each one name a rule and say why? If there are none, decide how you would silence a finding you judge to be fine.

### Check yourself

1. What is the difference between a warning and an error, for a CI job?
2. Why is a bare `# noqa` risky?
3. What is a baseline?
4. You add a linter and get 2,000 findings. What do you do first?

**Answers.** 1. Only an error makes the linter exit with a failure code, so only errors stop the job. 2. It hides every rule on that line, including real bugs you didn't mean to hide. 3. A saved list of existing findings that are not reported again, so only new problems fail. 4. Turn on only the bug rules, auto-fix what is safe, and baseline the rest rather than fixing everything in one change.

## 3. Linters by language

This skill is a short map of the common linters, so you can pick one for each language in a project. Each language has one or two leading tools; you rarely need more than one per language.

### Python

| Linter | What it is | Choose it when |
|---|---|---|
| Ruff | Linter and formatter written in Rust; very fast | Default choice for new projects |
| Pylint | Thorough analyser that infers values | You want deep, opinionated checks |
| Flake8 | Wraps pyflakes and pycodestyle, plus plugins | An older project already uses it |

**Ruff** is the one LevelUp uses. Its docs say it is 10 to 100 times faster than Flake8, has over 900 built-in rules, and can replace Flake8 and many of its plugins, plus Black and isort. The **Ruff** branch covers it in depth.

**Pylint** works harder. It tries to infer what each value really is, even in code without type hints. Its own docs say this makes it slower but lets it find more issues. It also has many opinionated checks, so it is noisier at first. Its messages are grouped by letter: C (convention), R (refactor), W (warning), E (error), F (fatal).

**Flake8** combines two older tools: **pyflakes**, which finds likely bugs (the `F` codes), and **pycodestyle**, which checks style (the `E` and `W` codes). Ruff reuses many of the same codes, which makes moving from Flake8 to Ruff easy.

### JavaScript and TypeScript

| Linter | What it is | Choose it when |
|---|---|---|
| ESLint | The standard JS linter; huge plugin set | You need plugins or custom rules |
| Biome | Linter and formatter in one tool | You want one fast tool, little setup |

**ESLint** is the long-standing standard. Every rule is a plugin, so there are rule sets for React, Node, TypeScript and much more. It needs Node.js and a `package.json` to install.

**Biome** is newer. One tool formats and lints JavaScript, TypeScript, JSON, CSS and more. `biome check` runs the formatter and linter in one pass. It has fewer plugins than ESLint, but needs much less setup.

For LevelUp's `app/js/`, either would find what `node --check` misses: unused variables, undefined names, `==` where `===` was meant. Both work on plain JavaScript with no build step.

### Shell scripts

**ShellCheck** is the linter for bash and sh scripts. Its site says it "finds bugs in your shell scripts". It is good at the mistakes shell makes easy:

- missing quotes around variables, so a filename with a space breaks the command;
- bash-only syntax in a script that starts with `#!/bin/sh`;
- fragile patterns such as looping over the output of `ls`.

Shell scripts often run deploys and backups, where a quoting bug can delete the wrong files. LevelUp has a few in `tools/` (for example `tools/feedback.sh`), and they are a good first target.

### Other languages in one line

| Language | Common linter |
|---|---|
| Go | `go vet`, staticcheck |
| Rust | Clippy |
| Ruby | RuboCop |
| SQL | SQLFluff |
| Dockerfile | Hadolint |

These are names to look up, not recommendations to adopt all at once.

### How to choose

A few questions settle most cases:

1. **What does the team already use?** Switching has a cost. Keep a working setup unless it is too slow or too noisy.
2. **One tool or two?** Ruff and Biome both lint and format. That means fewer configs and less to install.
3. **How fast is it?** A linter that takes 30 seconds won't run on every save. Speed decides whether people actually use it.
4. **Does it need plugins?** If you need framework rules (React, Django), check that they exist for your choice.

For LevelUp that gives: Ruff for Python (already in place), ShellCheck for `tools/*.sh`, and ESLint or Biome for `app/js/`.

### Try it

1. Paste one script from `tools/` into the web editor at shellcheck.net.
2. Read each warning's code (such as SC2086) and its short message.
3. Decide for each one: real risk, or fine here?

### Check yourself

1. Which two older tools does Flake8 combine, and what does each check?
2. Why is Pylint slower than Ruff, and what does it get in return?
3. Name one tool that both lints and formats JavaScript.
4. What kind of bug is ShellCheck best known for?

**Answers.** 1. Pyflakes (likely bugs) and pycodestyle (style). 2. It infers the real value of names, which takes more work but finds more issues in untyped code. 3. Biome. 4. Quoting mistakes, such as an unquoted variable that splits on spaces.

## 4. Lint in your workflow

This skill covers where a linter runs: in your editor, before each commit, and in CI. It also covers auto-fix and keeping the linter fast. A linter only helps if it runs without anyone having to remember it.

### Three places to run it

| Where | When it runs | What it gives you |
|---|---|---|
| Editor | As you type or save | Instant feedback, a squiggle under the line |
| Pre-commit hook | On `git commit` | Bad code never enters history |
| CI | On every push or pull request | A gate no one can skip |

Each place catches what the one before missed. The editor is fastest but only works for people who set it up. The pre-commit hook works for everyone who installs it, but can be skipped. CI is the only check that always runs, so CI is the real rule; the other two just make it pass the first time.

All three should read **the same config file**. If the editor uses different rules from CI, people get surprised by failures they never saw locally.

### The editor

Most linters have an editor extension, or speak the editor's standard protocol. Findings appear as you type, with the rule name and often a quick fix. This is where most problems should be fixed: the code is still in your head and the fix takes seconds.

### A pre-commit hook

A **git hook** is a script git runs at a set moment, such as just before a commit. The **pre-commit** framework manages these hooks from one file, `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://example.com/x
    rev: v1.2.3
    hooks:
      - id: some-linter
```

Run `pre-commit install` once, and the hooks run on every `git commit`. By default they check only the **staged** files, so they stay fast. When you first add a hook, run `pre-commit run --all-files` to check the whole repo once.

A hook can be skipped (`git commit --no-verify`), so treat it as a helper, not a guarantee.

### A CI gate

In CI the linter runs on a clean machine for every push. If it exits with a failure code, the job fails and the change can't merge. That is the **gate**.

LevelUp has no CI server yet, so today its lint runs only when someone remembers. A deploy script could do the same job: run the lint command first, and stop if it fails.

```bash
uvx ruff check server_fastapi/ \
  || exit 1
```

Decide which findings fail the gate. A common choice: errors fail, warnings don't. ESLint's `--max-warnings 0` makes warnings fail too, which is useful once a codebase is clean.

### Auto-fix

Many findings have one obvious fix: remove the unused import, sort the imports, change `==` to `===`. Linters can apply these for you. ESLint and Ruff use `--fix`; Biome uses `--write`.

| Fix type | Example | Safe to auto-apply? |
|---|---|---|
| Safe | Remove an unused import | Yes |
| Unsafe | Change code whose meaning might shift | Review first |

Ruff only applies safe fixes unless you ask for unsafe ones. A good habit: auto-fix in the editor or in a hook, then read the diff before you commit. In CI, don't auto-fix; just report, so the fix is a visible commit.

### Keep it fast

A slow linter gets turned off. Some ways to keep it quick:

- **Lint only changed files** on commit (pre-commit does this by default).
- **Use a cache.** ESLint's `--cache` re-checks only changed files; Ruff caches by default.
- **Pick fast tools.** Ruff and Biome are built for speed.
- **Exclude what isn't yours**: generated files, vendored libraries, built output.

The target is that the full lint of the repo takes a few seconds, so nobody feels it.

### Try it

1. Write down the lint commands LevelUp would need: one for `server_fastapi/`, one for `app/js/`, one for `tools/*.sh`.
2. Decide where each should run first: editor, hook, or a deploy-time gate.
3. Time the Python one: `time uvx ruff check server_fastapi/`. Is it fast enough for every commit?

### Check yourself

1. Why is CI the only check you can rely on?
2. What does pre-commit check by default: all files or staged files?
3. Why not auto-fix in CI?
4. Name two ways to keep a linter fast.

**Answers.** 1. It always runs on a clean machine; the editor needs setup and a hook can be skipped with `--no-verify`. 2. Only the staged files. 3. Silent changes in CI hide what changed; reporting makes the fix a visible commit someone reviews. 4. Any two of: lint only changed files, use a cache, pick a fast tool, exclude generated and vendored files.

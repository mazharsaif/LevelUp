---
name: feedback
description: Fetch and handle LevelUp in-app feedback reports from the droplet (~/levelup-data/bugs). Use when the user asks to fetch, check, read, triage, fix or "handle the feedback" / "new reports" / "bug reports", or when the session-start feedback list shows open reports the user wants worked on.
---

# LevelUp feedback

Reports are JSON files on the droplet in `~/levelup-data/bugs/<id>.json` (posted by the app's 🐞 button to `/api/bugs`).
Fields that matter: `id`, `status` (`new` / `fixed`), `category` (bug, idea, content…), `text`, and in `ctx`:
`user`, `course`, `page`, `url`, `screenText`, `errors`, `env.webVersion`.

A SessionStart hook already runs `tools/feedback.sh` and puts the open list in context. Don't fetch it again
unless the user asks or time has passed.

## Commands

```bash
tools/feedback.sh               # open reports, one line each (oldest first)
tools/feedback.sh --full <id>   # one report's full JSON (screenText, errors, env)
tools/feedback.sh --fix <id>…   # set status "fixed" (only after the fix is deployed)
```

If ssh fails, see the `deploy` skill (step 3, ssh-add) and ask the user to run the `ssh-add` command themselves if needed.

## Who decides

- Reports from `taha` or `mazhar` (both the user): implement directly.
- Any other user (batul, guest, …): don't implement. List them under **Waiting for approval** and wait.
- Reports the user has called "later" (see PROJECT_LOG.md **Pending**, "Feedback waiting") stay open; don't
  start them without being asked. Mention them in one line, not one per report.
- "Password reset request for X" reports: tell the user. The reset is `auth.py <uid>` on the droplet, and the user runs it.

## Workflow

1. Group the open reports: **To do now** (own, not "later"), **Later** (own, deferred), **Waiting for approval** (others).
   Show the user this triage before you change anything big.
2. For each to-do report, read `--full` for context (screenText shows exactly what they saw), find the code, fix it,
   and test on the 8899 test server with scratch data (never real progress, see CLAUDE.md).
3. Bump `app/sw.js` `SHELL` if anything under `app/` changed.
4. Deploy with the `deploy` skill when the user asks or the batch is done. Then `tools/feedback.sh --fix <ids>`
   for the reports that were actually fixed and deployed.
5. Update PROJECT_LOG.md: a changelog line "feedback (user): …", and the "Feedback waiting" line in Pending.

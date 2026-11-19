---
name: deploy
description: Push LevelUp to GitHub and deploy it to the dev droplet (https://dev.level-up.com.de) with levelup-deploy, then check it is live. Use whenever the user asks to deploy, ship, release, push and deploy, "run deploy", or update the droplet / live app.
---

# Deploy LevelUp to the droplet

Live = the DigitalOcean droplet only (`ssh levelup-droplet`, app behind Caddy at https://dev.level-up.com.de).
The droplet pulls from GitHub itself over a forwarded SSH agent, so the order is always: commit → push → deploy → verify.

## 1. Pre-flight (local)

```bash
cd "<repo root>"
git status --short          # must be empty
git branch --show-current   # must be main
```

- Uncommitted changes: stop and ask, unless the user asked you to commit in the same request (then commit first,
  following the repo's commit conventions and attribution lines).
- Not on `main`: stop and ask. The droplet deploys `main` only.
- Check the app code is sane: `node --check app/js/*.js` and
  `uv run python -c "import ast,sys;[ast.parse(open(f).read()) for f in sys.argv[1:]]" server_fastapi/*.py`.
- If any file under `app/` (js, css, html, data) changed since the last deploy, `app/sw.js` `SHELL` must have
  been bumped (`a1-shell-vN`); otherwise phones keep the old cached code. Check with
  `git diff origin/main --stat -- app/` and `git diff origin/main -- app/sw.js`. If not bumped, bump it and commit.

## 2. Push

```bash
git push origin main        # remote = git@github-personal:mazharsaif/LevelUp.git (personal key)
```

If push is rejected (remote ahead): `git pull --rebase origin main`, re-run the checks, push again. Never force-push.

## 3. Load the personal key into the agent

The droplet's `git pull` uses the forwarded agent (`ForwardAgent yes` is set for `levelup-droplet` in `~/.ssh/config`).

```bash
ssh-add -T ~/.ssh/id_ed25519_personal.pub 2>/dev/null || ssh-add --apple-use-keychain ~/.ssh/id_ed25519_personal
# (ssh-add -l shows the key comment, not the file name, so don't grep it for the path)
```

If `ssh-add` asks for a passphrase and fails non-interactively, ask the user to run
`! ssh-add --apple-use-keychain ~/.ssh/id_ed25519_personal` and continue after.

## 4. Deploy

```bash
ssh levelup-droplet levelup-deploy
```

It does: `git pull --ff-only`, `uv sync`, installs `deploy/Caddyfile` if changed (validates first), restarts the
`levelup` systemd service, prints its status. "No forwarded SSH agent" = step 3 didn't work.

**Audio is not in git.** If new clips were fetched (`app/audio/` changed locally), also run:

```bash
rsync -az app/audio/ levelup-droplet:LevelUp/app/audio/
```

Check with `rsync -azn --itemize-changes app/audio/ levelup-droplet:LevelUp/app/audio/ | head` (dry run).

## 5. Verify

```bash
ssh levelup-droplet 'systemctl is-active levelup; git -C LevelUp log -1 --oneline'
curl -s -o /dev/null -w "%{http_code}\n" https://dev.level-up.com.de/              # 200
curl -s -o /dev/null -w "%{http_code}\n" https://dev.level-up.com.de/api/auth/me   # 401 (logged out) = server up
curl -s https://dev.level-up.com.de/sw.js | head -2                                # shows the new SHELL version
```

- The droplet's commit must equal local `git rev-parse --short HEAD`.
- Service not active: `ssh levelup-droplet 'journalctl -u levelup -n 40 --no-pager'`, report the error, don't retry blindly.

## 6. After

- If the deploy shipped fixes for feedback reports, set `"status": "fixed"` on those files in
  `~/levelup-data/bugs/<id>.json` on the droplet (only the ones actually fixed).
- Never touch `~/levelup-data` otherwise (real progress, passwords, sessions).
- Never set `LU_MASTER_PASSWORD` on the droplet unless the user explicitly asks.
- Add one Changelog line to `PROJECT_LOG.md` if the deploy itself was notable (new server setup, Caddy change).
- Tell the user: commit deployed, URL, whether audio was synced, and that phones pick up the new version on the
  next open (service-worker update).

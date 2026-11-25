---
name: deploy
description: Push LevelUp to GitHub and deploy it to the dev droplet (https://levelrise.org) with levelup-deploy, then check it is live. Use whenever the user asks to deploy, ship, release, push and deploy, "run deploy", or update the droplet / live app.
---

# Deploy LevelUp to the droplet

Live = the DigitalOcean droplet only (`ssh levelup-droplet`, app behind Caddy at https://levelrise.org).
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

## 2. Tag the release and push

Releases use calendar versioning `YYYY.MM.DD.NN` (NN = 01..99, the Nth release that day), as annotated tags `vYYYY.MM.DD.NN`.

```bash
git fetch --tags origin
git tag --points-at HEAD --list 'v20*'      # already tagged (a re-deploy)? then skip the tag
V="$(tools/next_version.sh)"                # e.g. 2026.11.20.02
git tag -a "v$V" -m "Release $V"
git push origin main "v$V"                  # remote = https://github.com/mazharsaif/LevelUp.git (auth via gh)
```

If push is rejected (remote ahead): delete the local tag (`git tag -d "v$V"`), `git pull --rebase origin main`,
re-run the checks, tag again, push again. Never force-push, never move a pushed tag.
The server reads the tag on its commit at startup and reports it in `/api/health` (`"version"`).

## 3. Load the personal key into the agent

The droplet's `git pull` uses the forwarded agent (`ForwardAgent yes` is set for `levelup-droplet` in `~/.ssh/config`
on the Lenovo laptop; the Mac is gone since 11-26). The key is `~/.ssh/id_ed25519` (label `LenovoLaptop`), the only key
the droplet and GitHub accept.

```bash
ssh-add -T ~/.ssh/id_ed25519.pub 2>/dev/null || ssh-add ~/.ssh/id_ed25519
# (ssh-add -l shows the key comment, not the file name, so don't grep it for the path)
```

If `ssh-add` says it can't connect to an agent, or asks for a passphrase and fails non-interactively, ask the user to run
`! ssh-add ~/.ssh/id_ed25519` and continue after. If `levelup-droplet` doesn't resolve, the alias is missing from
`~/.ssh/config` (host 206.189.213.12, user mazhar, ForwardAgent yes); see PROJECT_LOG Run.

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
curl -s -o /dev/null -w "%{http_code}\n" https://levelrise.org/              # 200
curl -s -o /dev/null -w "%{http_code}\n" https://levelrise.org/api/auth/me   # 401 (logged out) = server up
curl -s https://levelrise.org/sw.js | head -2                                # shows the new SHELL version
curl -s https://levelrise.org/api/health                                     # "version": the new tag (no v)
```

If `/api/health` shows `dev-<hash>` instead of the version, the droplet pulled before the tag existed:
`ssh levelup-droplet 'git -C LevelUp fetch --tags' && ssh levelup-droplet levelup-deploy` (restarts the service).

- The droplet's commit must equal local `git rev-parse --short HEAD`.
- Service not active: `ssh levelup-droplet 'journalctl -u levelup -n 40 --no-pager'`, report the error, don't retry blindly.

## 6. After

- If the deploy shipped fixes for feedback reports, set `"status": "fixed"` on those files in
  `~/levelup-data/bugs/<id>.json` on the droplet (only the ones actually fixed).
- Never touch `~/levelup-data` otherwise (real progress, passwords, sessions).
- Never set `LU_MASTER_PASSWORD` on the droplet unless the user explicitly asks.
- Add one Changelog line to `PROJECT_LOG.md` if the deploy itself was notable (new server setup, Caddy change).
- Tell the user: release version, commit deployed, URL, whether audio was synced, and that phones pick up the new version on the
  next open (service-worker update).

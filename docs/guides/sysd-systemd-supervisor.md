# Process Supervision on Linux: systemd, systemctl and Supervisor

Nov 16, 2026 · @Mazhar Mumbaiwala

## How to read this guide

A server program is only useful if it keeps running: after a crash, after a reboot, and after you log out of SSH. **Process supervision** is the job of starting programs, watching them, restarting them when they die and collecting their logs. On Linux, **systemd** does this for the whole machine, and **Supervisor** is a smaller tool that does it for a handful of apps. This guide teaches both, so you can put any service (a FastAPI app, a worker, a bot) on a server and trust it to stay up.

It assumes you can use a terminal and edit files, and that you know roughly what a process is. No Linux admin experience is needed.

### The running example

The example service is the **Rankwise FastAPI server**: today it runs by hand on a Mac (`uv run main.py 8766`). The capstone moves it to a Linux server, where it must start at boot, restart on crash, log to the journal and run as an unprivileged user. Every chapter adds one piece of that.

### Reading map

| Chapter | What you will learn | Minutes |
| --- | --- | --- |
| 1. Processes, daemons and supervision | PID 1, signals, exit codes, foreground vs daemonising, restart policies | 8 |
| 2. systemd, the big picture | Units, unit types, targets, dependencies, where unit files live | 7 |
| 3. systemctl day to day | The 15 commands you will actually use | 7 |
| 4. Writing service units | Type=, ExecStart, users, environment, Restart=, start limits, a FastAPI unit | 9 |
| 5. Logs with journald | journalctl filters, following, persistence, disk limits | 6 |
| 6. Timers, sockets and other unit types | Timers instead of cron, socket and path activation | 6 |
| 7. Hardening and resource control | Sandboxing settings, memory and CPU limits, security scores | 7 |
| 8. User services and other platforms | systemctl --user, lingering, launchd on macOS | 5 |
| 9. Supervisor | supervisord.conf, program options, process states, supervisorctl | 8 |
| 10. Choosing a supervisor | systemd vs Supervisor vs containers vs PM2 | 5 |
| 11. Troubleshooting playbook | Failed units, exit codes, start limits, BACKOFF and FATAL | 7 |
| 12. Capstone | Rankwise under systemd and under Supervisor, plus a final quiz | 8 |

Total: about an hour and a half of reading, plus the labs.

### Suggested paths

**"I just need my app to stay up on a server."** Read chapters 1, 4 and 5, then do the capstone. About 35 minutes.

**"My company uses Supervisor."** Read chapter 1, then chapters 9, 10 and 11.

**"I want to understand Linux services properly."** Read in order. Chapters 2, 4 and 7 hold most of the depth.

### Your lab machine

systemd only runs on Linux, and most Docker containers don't run it. On a Mac, the easiest lab is a small Ubuntu virtual machine with **Multipass** (free):

```bash
brew install --cask multipass
multipass launch --name lab 24.04
multipass shell lab
```

Everything in the labs runs inside that VM. When you're done, `multipass delete --purge lab` removes it. Any Ubuntu or Debian server you already have works too.

### How each chapter works

Each chapter has the ideas first, then a **lab** you type out in the VM, then a **self-check** with answers. A chapter counts as learned when you can answer its self-check without looking back. Official sources: the systemd man pages at freedesktop.org (`systemd.service`, `systemd.unit`, `systemd.exec`, `systemd.timer`, `systemctl`, `journalctl`) and the Supervisor documentation at supervisord.org.

## Processes, daemons and supervision

Before any tool, you need four ideas: what a process is, how it ends, how it is told to stop, and why something has to watch it. Every option in systemd and Supervisor is an answer to one of these.

### Processes and PID 1

A **process** is a running program with its own memory and a numeric **process ID (PID)**. Every process except the first has a **parent**: the process that started it. When you type `uvicorn app:app` in a shell, the shell is the parent.

The very first process, started by the kernel at boot, is **PID 1**, also called **init**. It starts everything else, and it adopts orphans: if a parent dies, its children are re-parented to PID 1. On almost every modern Linux distribution (Ubuntu, Debian, Fedora, Arch, RHEL), PID 1 is **systemd**.

Try it: `ps -p 1 -o pid,comm` shows `systemd`. `pstree -p | head` shows the whole family tree hanging from it.

### Daemons and why logging out kills your app

A **daemon** is a background process with no terminal, such as a web server, a database or a scheduler. If you start an app in an SSH session and then log out, the session ends, the terminal sends **SIGHUP** ("hang-up") to its processes, and your app usually dies. Tricks such as `nohup`, `&`, `screen` or `tmux` keep it alive, but nothing restarts it after a crash or a reboot, and its logs end up wherever you remembered to point them.

That gap is what a **process supervisor** fills. It:

1. starts the program in a clean, known environment (user, directory, variables);
2. notices immediately when it exits, because it is the parent and gets the **SIGCHLD** signal;
3. decides whether to restart it, and how quickly;
4. captures its standard output and errors as logs;
5. stops it cleanly on request or at shutdown.

### Foreground, not self-daemonising

Old Unix daemons **daemonised themselves**: they forked, the parent exited, and the child carried on detached. A supervisor wants the opposite. The program should stay in the **foreground**, write logs to stdout and stderr, and simply exit when something goes wrong. The supervisor does the rest.

The Supervisor docs give a simple test: run the command in a shell. If you have to press Ctrl-C to get your prompt back, it runs in the foreground. If the prompt comes back while the program keeps running, it daemonised itself, and that is almost always wrong under a supervisor. Most programs have a foreground flag (`nginx -g 'daemon off;'`, `redis-server --daemonize no`). Uvicorn and Gunicorn already run in the foreground.

### Signals: how a process is asked to stop

A **signal** is a small message the kernel delivers to a process. The ones that matter:

| Signal | Number | Meaning | Can the process catch it? |
| --- | --- | --- | --- |
| SIGTERM | 15 | "Please stop": finish requests, close files, exit | Yes; the polite default |
| SIGINT | 2 | Interrupt, what Ctrl-C sends | Yes |
| SIGHUP | 1 | Terminal hang-up; many daemons treat it as "reload config" | Yes |
| SIGKILL | 9 | Die now; the kernel removes the process | No |
| SIGCHLD | 17 | Sent to a parent when a child exits | Yes; how supervisors notice |
| SIGUSR1 / SIGUSR2 | 10 / 12 | App-defined | Yes |

Every supervisor stops services the same way: send **SIGTERM**, wait a grace period, then send **SIGKILL** if the process is still alive. In systemd the wait is `TimeoutStopSec=` (90 seconds by default on most systems); in Supervisor it is `stopwaitsecs` (default 10). A well-behaved app handles SIGTERM by finishing in-flight work quickly.

### Exit codes

When a process ends, it leaves an **exit status**: `0` means success, and anything from 1 to 255 means failure. A process killed by a signal is reported as "killed by signal N"; shells show this as 128 + N (so 137 = SIGKILL, 143 = SIGTERM).

Supervisors use the exit status to decide what happened: a **clean exit** (0, or a stop the supervisor asked for) versus an **unclean** one (a non-zero code, a crash signal such as SIGSEGV, a timeout).

### Restart policies

Every supervisor answers the same question: when the process exits, should it start again?

| Policy | systemd | Supervisor | Use it for |
| --- | --- | --- | --- |
| Never | `Restart=no` (default) | `autorestart=false` | One-off jobs |
| Only after a failure | `Restart=on-failure` | `autorestart=unexpected` (default) | Most web apps and workers |
| Always | `Restart=always` | `autorestart=true` | Things that must never stay down |

Two more controls stop a broken program from restarting forever in a tight loop: a **delay** between restarts (`RestartSec=`, Supervisor's backoff) and a **limit** on start attempts (systemd's `StartLimitBurst=` per `StartLimitIntervalSec=`, Supervisor's `startretries`). Chapters 4 and 9 cover them.

### Lab: watch signals and exit codes (VM, free)

1. Run `sleep 300 &`, note the PID, then `kill -TERM <pid>` and `wait <pid>; echo $?`. You should see 143.
2. Save this as `trap.sh`, run `bash trap.sh &`, then send it SIGTERM:

```bash
trap 'echo "got SIGTERM, cleaning up"; exit 0' TERM
while true; do sleep 1; done
```

3. Do the same with `kill -KILL`. The trap never runs, because SIGKILL can't be caught.
4. Run `ps -o pid,ppid,comm -p $$` and `pstree -p $$` to see your shell's parent chain up to PID 1.

### Self-check

1. Why does an app started in an SSH session often die when you log out?
2. Which signal can never be caught or ignored?
3. What order of signals does a supervisor use to stop a service?
4. A program gives you your prompt back but keeps running. Is that good under a supervisor?
5. A process exited with status 137. What happened?

**Answers.** 1: The session ends and the processes in it get SIGHUP. 2: SIGKILL (and SIGSTOP). 3: SIGTERM, then a grace period, then SIGKILL. 4: No. It daemonised itself; run it in the foreground instead. 5: It was killed by signal 9 (SIGKILL): 128 + 9.

## systemd, the big picture

systemd is PID 1 on most Linux systems: it boots the machine, then starts, supervises and stops everything on it. It models all of that as **units** described in small text files, joined by **dependencies**. Once you see units and dependencies, every systemd command and option fits into place.

### What systemd replaced

Older systems used **SysV init**: shell scripts in `/etc/init.d/` run one after another at boot, each one daemonising its program and writing a PID file. Scripts had no shared way to restart crashed services, track child processes or collect logs. systemd replaced them with declarative unit files, parallel start-up, automatic restarts, **cgroups** that track every process a service spawns, and a central log (the **journal**). The commands `service` and `/etc/init.d/x start` still exist on many systems, but they now just call systemd.

### Units and unit types

A **unit** is anything systemd manages. Its type is the file extension:

| Type | Represents | Example |
| --- | --- | --- |
| `.service` | A process or group of processes | `nginx.service`, `rankwise.service` |
| `.socket` | A listening socket that can start a service on demand | `docker.socket` |
| `.timer` | A schedule that starts another unit (a cron replacement) | `logrotate.timer` |
| `.target` | A named group of units, a synchronisation point | `multi-user.target` |
| `.path` | A file or directory to watch | `cups.path` |
| `.mount` / `.automount` | A filesystem mount point | `home.mount` |
| `.slice` | A cgroup branch for grouping resource limits | `system.slice` |
| `.scope` | Processes started outside systemd, such as login sessions | `session-3.scope` |
| `.device` / `.swap` | Kernel devices and swap space | `dev-sda.device` |

In practice you will write `.service` and `.timer` units, and sometimes `.socket` and `.path`.

### Where unit files live

| Directory | Who puts files there | Priority |
| --- | --- | --- |
| `/etc/systemd/system/` | You, the administrator | Highest: overrides the others |
| `/run/systemd/system/` | Runtime-generated units, gone at reboot | Middle |
| `/usr/lib/systemd/system/` (or `/lib/systemd/system/`) | Installed packages | Lowest |
| `~/.config/systemd/user/` | A user's own services (chapter 8) | Per user |

Never edit files under `/usr/lib`: a package upgrade overwrites them. Put your own units in `/etc/systemd/system/`, and change packaged units with **drop-in** files (`systemctl edit`, chapter 3). After any change, run `systemctl daemon-reload` so systemd reads the files again.

### Anatomy of a unit file

Unit files are INI-style: sections in brackets, `Key=value` lines.

```ini
[Unit]
Description=Rankwise API
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=/opt/rankwise/.venv/bin/uvicorn main:app --port 8766
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

- **\[Unit\]**: description, documentation and dependencies, shared by all unit types.
- **\[Service\]** (or `[Timer]`, `[Socket]` and so on): what the unit does.
- **\[Install\]**: what `systemctl enable` should hook the unit into. Without it, a unit can be started but not enabled.

### Dependencies: requirement and order are separate

This is the part that surprises people. systemd has two independent kinds of dependency:

| Directive | Kind | Meaning |
| --- | --- | --- |
| `Wants=` | Requirement (weak) | Start these too; carry on if they fail. The usual choice. |
| `Requires=` | Requirement (strong) | Start these too; if they fail to start or are stopped, stop me as well |
| `BindsTo=` | Requirement (stronger) | Like Requires=, and also stop me if the other unit disappears |
| `PartOf=` | Propagation | Stopping or restarting the other unit does the same to me |
| `Conflicts=` | Negative | Starting me stops the other, and the reverse |
| `After=` / `Before=` | Ordering only | If both start in the same transaction, wait for the other first |

`Wants=postgresql.service` without `After=postgresql.service` starts both **at the same time**. If your app needs the database to be up first, you need both lines. And `After=` alone pulls nothing in: it only orders units that are starting anyway.

### Targets and boot

A **target** is a named group of units, like a run level. At boot systemd starts `default.target`, which on a server is usually `multi-user.target` (everything except the graphical desktop). `WantedBy=multi-user.target` in `[Install]` means "start me during a normal boot". When you run `systemctl enable`, systemd creates a symlink in `/etc/systemd/system/multi-user.target.wants/`, and that symlink is all "enabled" means.

`network.target` only means networking has started being configured. If your service needs a real network (for example to reach an API at start-up), use `After=network-online.target` together with `Wants=network-online.target`.

### cgroups: no escaped processes

Every service runs in its own **control group (cgroup)** under `system.slice`. Every child, grandchild and forked worker stays in that cgroup, so `systemctl stop` can find and kill all of them, and `systemctl status` lists them. This is why systemd services can't leak orphaned workers the way old init scripts did. It is also how resource limits work (chapter 7).

### Lab: explore your system (VM, free)

1. `systemctl list-units --type=service --state=running` lists what is running now.
2. `systemctl cat ssh.service` shows a real unit file and its location.
3. `systemctl list-dependencies multi-user.target | head -30` shows the boot tree.
4. `ls /etc/systemd/system/multi-user.target.wants/` shows the symlinks behind "enabled".
5. `systemd-cgls --no-pager | head -40` shows the cgroup tree with every process under its service.
6. `systemd-analyze blame | head` lists what made boot slow.

### Self-check

1. Where do you put your own unit files, and why not in `/usr/lib/systemd/system`?
2. Your unit has `Wants=postgresql.service` but no `After=`. What happens at boot?
3. What does `systemctl enable` actually create?
4. Which target should a service that needs a working network order itself after?
5. Why can't a systemd service leave orphaned worker processes behind when it stops?

**Answers.** 1: In `/etc/systemd/system/`; package upgrades overwrite `/usr/lib`. 2: Both start in parallel, so the app may start before the database is ready. 3: A symlink in the `.wants/` directory of the target named in `WantedBy=`. 4: `network-online.target` (with `Wants=` as well). 5: Every process the service spawns stays in its cgroup, and stopping the unit kills the whole cgroup.

## systemctl day to day

`systemctl` is the command you use to talk to systemd. About fifteen subcommands cover nearly all daily work. The most important distinction is between **now** (start, stop) and **at boot** (enable, disable): they are separate, and forgetting one of them is the most common mistake.

### Now vs at boot

| Command | Effect now | Effect at next boot |
| --- | --- | --- |
| `systemctl start x` | Starts it | None |
| `systemctl stop x` | Stops it | None |
| `systemctl enable x` | None | Starts it |
| `systemctl disable x` | None | Won't start it |
| `systemctl enable --now x` | Starts it | Starts it |
| `systemctl disable --now x` | Stops it | Won't start it |

System services need root, so in practice you type `sudo systemctl …`. The `.service` suffix is optional: `systemctl status nginx` means `nginx.service`.

### Starting, stopping, restarting

- `restart`: stop, then start. Use it after changing the program or its environment.
- `reload`: ask the running service to reload its configuration without stopping, through `ExecReload=` (often SIGHUP). It only works if the unit defines a reload.
- `reload-or-restart`: reload if the unit supports it, otherwise restart. Safe in scripts.
- `try-restart`: restart only if it is already running.
- `kill --signal=SIGUSR1 x`: send a signal to the service's processes.

### Reading the status

`systemctl status x` is the first thing to run when something is wrong:

```text
● rankwise.service - Rankwise API
     Loaded: loaded (/etc/systemd/system/rankwise.service; enabled; preset: enabled)
     Active: active (running) since Mon 2026-11-16 09:12:03 UTC; 2h ago
   Main PID: 4123 (uvicorn)
      Tasks: 5 (limit: 2307)
     Memory: 61.2M
     CGroup: /system.slice/rankwise.service
             └─4123 /opt/rankwise/.venv/bin/python /opt/rankwise/.venv/bin/uvicorn main:app

Nov 16 09:12:03 lab uvicorn[4123]: INFO:     Uvicorn running on http://0.0.0.0:8766
```

- **Loaded**: which file it read, and whether it is enabled. `not-found` means a typo in the name or a missing file.
- **Active**: the state. `active (running)`, `inactive (dead)`, `activating (auto-restart)` (it crashed and is waiting to restart) or `failed`.
- **Main PID** and **CGroup**: the processes that belong to the service.
- The last lines are the newest journal entries. For more, use `journalctl -u x` (chapter 5).

For scripts, use the quiet checks: `systemctl is-active x`, `is-enabled x` and `is-failed x` print one word and set the exit code.

### Listing things

| Command | Shows |
| --- | --- |
| `systemctl` or `systemctl list-units` | Loaded units that are active |
| `systemctl list-units --type=service --all` | All service units, including inactive ones |
| `systemctl --failed` | Units in the failed state |
| `systemctl list-unit-files` | Every unit file and its enable state (enabled, disabled, static, masked) |
| `systemctl list-timers` | Timers with their next and last run |
| `systemctl cat x` | The unit file plus all its drop-ins |
| `systemctl show x -p Restart,MainPID` | Any property as `Key=value` |

A **static** unit has no `[Install]` section: it can't be enabled, and is only started by other units (a timer, a socket, a dependency).

### daemon-reload

systemd caches unit files in memory. After you create or edit a unit file by hand, run `sudo systemctl daemon-reload`. Then restart the service for changes to `[Service]` to take effect. If you forget, `systemctl status` warns: "Warning: The unit file … changed on disk. Run 'systemctl daemon-reload'." (`systemctl edit` reloads for you.)

### Changing a unit safely: drop-ins

To change a packaged unit, or to keep your own changes separate, don't edit the original. Use:

```bash
sudo systemctl edit nginx
```

This opens an empty override file, `/etc/systemd/system/nginx.service.d/override.conf`. Anything you write there is merged on top of the original:

```ini
[Service]
Restart=always
RestartSec=3
```

List-type settings such as `ExecStart=` add up rather than replace. To replace one, first clear it with an empty line, then set the new value:

```ini
[Service]
ExecStart=
ExecStart=/usr/sbin/nginx -g 'daemon off;' -c /etc/nginx/custom.conf
```

`systemctl edit --full x` copies the whole unit to `/etc/systemd/system/` for editing instead. `systemctl revert x` removes your overrides and goes back to the packaged version.

### Masking: disabled for good

`disable` only removes the boot symlink: the unit can still be started by hand or pulled in by another unit. `systemctl mask x` links the unit to `/dev/null`, so nothing can start it at all. `unmask` undoes it. Use masking for services that must never run (for example a conflicting firewall daemon).

### Other things systemctl does

- `systemctl reboot`, `poweroff`, `suspend`: power actions.
- `systemctl reset-failed x`: clear the failed state and the start-limit counter (chapter 11).
- `systemctl --user …`: manage your own user services (chapter 8).
- `-H user@host`: run the same command against a remote machine over SSH.

### Lab: drive a real service (VM, free)

1. `sudo apt install -y nginx`, then `systemctl status nginx`. It is enabled and running already.
2. `sudo systemctl stop nginx` and check `is-active`. Then `sudo systemctl disable nginx`, `sudo reboot` (with Multipass, `multipass restart lab`) and check that it stayed off.
3. `sudo systemctl enable --now nginx`.
4. `sudo systemctl edit nginx` and add `Restart=always` under `[Service]`. Check it with `systemctl cat nginx` and `systemctl show nginx -p Restart`.
5. Kill the master process: `sudo kill -9 $(systemctl show -p MainPID --value nginx)`. Run `systemctl status nginx` a few seconds later. A new PID means systemd restarted it.
6. `sudo systemctl revert nginx`, and repeat step 5. The packaged unit has no `Restart=` line, so the default `Restart=no` applies: nginx stays down and `systemctl status` shows `failed`. Bring it back with `sudo systemctl start nginx`. This is why your own units should always set `Restart=`.

### Self-check

1. You enabled a service but it isn't running. Why?
2. You edited `/etc/systemd/system/app.service`, but nothing changed after a restart. What did you forget?
3. How do you change one setting of a packaged unit without editing its file?
4. Why must you write `ExecStart=` with an empty value in an override before setting a new one?
5. What is the difference between `disable` and `mask`?

**Answers.** 1: `enable` only acts at boot; use `start` or `enable --now`. 2: `sudo systemctl daemon-reload`. 3: `sudo systemctl edit <unit>`, which creates a drop-in override. 4: `ExecStart=` is a list, so a new value is added; the empty line clears the list first. 5: `disable` removes the boot link only; `mask` makes the unit impossible to start by any means.

## Writing service units

A good service unit answers five questions: how to start the program, as which user, in what environment, what counts as "started", and what to do when it dies. This chapter goes through the `[Service]` options that answer them, then builds a complete unit for a FastAPI app.

### Type=: when is the service "started"?

`Type=` tells systemd how to know that start-up has finished. That matters for `systemctl start` (which waits) and for units ordered `After=` this one.

| Type | Started when | Use it for |
| --- | --- | --- |
| `simple` (default) | Immediately after systemd forks the process | Foreground programs; works, but a missing binary still looks "started" |
| `exec` | After the program is successfully executed | Foreground programs: the better default, because a typo in `ExecStart` fails the start |
| `notify` | The program sends `READY=1` through sd\_notify | Programs with systemd support that need time to warm up |
| `forking` | The launched process forks and the parent exits | Old self-daemonising programs (add `PIDFile=`) |
| `oneshot` | The process exits | Scripts and set-up steps; add `RemainAfterExit=yes` to keep it "active" |
| `dbus` / `idle` | A D-Bus name is taken / the boot is idle | Rare |

For Uvicorn, Gunicorn, Node, Go binaries and most modern programs, use `Type=exec`.

### Exec lines

- `ExecStart=` is the command. It needs an **absolute path** (or a binary on systemd's fixed search path) and is **not run by a shell**: pipes, `>` redirection, `&&` and globbing don't work. If you really need a shell, write `ExecStart=/bin/sh -c '…'`, but a small script file is clearer.
- `ExecStartPre=` / `ExecStartPost=` run before and after it, for example to run database migrations. A leading `-` (`ExecStartPre=-/usr/bin/foo`) means "ignore failure".
- `ExecReload=` defines what `systemctl reload` does, often `/bin/kill -HUP $MAINPID`.
- `ExecStop=` is rarely needed: by default systemd sends `KillSignal=` (SIGTERM) to the cgroup.

Use `$MAINPID` for the main process ID. Write variables as `${VAR}`, which systemd expands from `Environment=` and `EnvironmentFile=`.

### Who and where

```ini
User=rankwise
Group=rankwise
WorkingDirectory=/opt/rankwise
Environment=PYTHONUNBUFFERED=1 APP_ENV=production
EnvironmentFile=/etc/rankwise/rankwise.env
```

- **Never run an app as root.** Create a system user (`sudo useradd --system --home /opt/rankwise --shell /usr/sbin/nologin rankwise`), or use `DynamicUser=yes` (chapter 7).
- `WorkingDirectory=` sets the current directory, so relative paths in your app work.
- `Environment=` is fine for non-secret settings. Put secrets in `EnvironmentFile=` with permissions `600`, owned by root. A `-` prefix (`EnvironmentFile=-/etc/…`) makes the file optional.
- A service does **not** read your shell's `~/.bashrc` or `~/.profile`. Anything set there (PATH changes, API keys) must be in the unit or the env file. "It works in my terminal but not as a service" is almost always this.
- `PYTHONUNBUFFERED=1` makes Python print logs immediately instead of buffering them, so they appear in the journal right away.

### Restarting: Restart= and its brakes

Which exits trigger a restart, from the `systemd.service` man page:

| Exit cause | `no` | `always` | `on-success` | `on-failure` | `on-abnormal` | `on-abort` |
| --- | --- | --- | --- | --- | --- | --- |
| Clean exit (code 0) |  | yes | yes |  |  |  |
| Non-zero exit code |  | yes |  | yes |  |  |
| Killed by a signal |  | yes |  | yes | yes | yes |
| Timeout |  | yes |  | yes | yes |  |
| Watchdog |  | yes |  | yes | yes |  |

A stop you asked for (`systemctl stop`) never triggers a restart. For web apps and workers, `Restart=on-failure` is the usual choice. Use `always` for things that must come back even after a clean exit.

Then add the brakes:

- `RestartSec=2`: wait 2 seconds before restarting (the default is only 100 ms, which can hammer a database that is down).
- `StartLimitIntervalSec=` and `StartLimitBurst=` go in **`[Unit]`**: no more than *Burst* starts within *Interval*, otherwise the unit enters the failed state with result `start-limit-hit`. The system defaults are usually 5 starts in 10 seconds. With `RestartSec=2`, five starts take at least 10 seconds, so the default limit is rarely hit. Set the limit explicitly so you know what happens.
- `TimeoutStartSec=` and `TimeoutStopSec=` cap how long start and stop may take before systemd gives up (and, for stop, sends SIGKILL).

### A complete unit for a FastAPI app

`/etc/systemd/system/rankwise.service`:

```ini
[Unit]
Description=Rankwise API (FastAPI)
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=300
StartLimitBurst=10

[Service]
Type=exec
User=rankwise
Group=rankwise
WorkingDirectory=/opt/rankwise/server_fastapi
Environment=PYTHONUNBUFFERED=1
EnvironmentFile=-/etc/rankwise/rankwise.env
ExecStart=/opt/rankwise/server_fastapi/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8766
Restart=on-failure
RestartSec=3
TimeoutStopSec=20

[Install]
WantedBy=multi-user.target
```

In plain words: start after the network is up; run Uvicorn from the app's virtual environment as the `rankwise` user; restart it 3 seconds after any failure; give up (failed state) after 10 starts in 5 minutes; give it 20 seconds to shut down cleanly; start at boot.

For several worker processes, run Gunicorn with Uvicorn workers instead: `ExecStart=…/gunicorn -k uvicorn.workers.UvicornWorker -w 4 -b 0.0.0.0:8766 main:app`. All the workers stay in the service's cgroup.

### Instances: one file, many services

A unit named with `@`, such as `worker@.service`, is a **template**. `systemctl start worker@1 worker@2` starts two instances. Inside the file, `%i` is the instance name: `ExecStart=/opt/app/worker --queue %i`. This is the systemd way to run several copies of a worker.

### Lab: your first unit (VM, free)

1. Install Python tools: `sudo apt install -y python3-venv`. Create the user and app directory: `sudo useradd --system --home /opt/demo --shell /usr/sbin/nologin demo && sudo mkdir -p /opt/demo && cd /opt/demo`.
2. `sudo python3 -m venv .venv && sudo .venv/bin/pip install fastapi uvicorn`. Write `main.py` with one route that returns `{"ok": true}`, plus a `/crash` route that calls `os._exit(1)`.
3. Write `/etc/systemd/system/demo.service` modelled on the unit above (port 8000, user `demo`).
4. `sudo systemctl daemon-reload && sudo systemctl enable --now demo`, then `curl localhost:8000`.
5. `curl localhost:8000/crash`, then watch `systemctl status demo`. You should see `activating (auto-restart)` and, 3 seconds later, a new PID.
6. Break it on purpose: set the `ExecStart` path to a wrong file, reload and restart. With `Type=exec`, `systemctl start` fails immediately with status 203/EXEC.

### Self-check

1. Why is `Type=exec` a better default than `simple`?
2. `ExecStart=/opt/app/run.sh > /var/log/app.log` doesn't create the log. Why?
3. Your app finds its API key when you run it by hand but not as a service. Why, and what is the fix?
4. Which `Restart=` value restarts after a crash but not after a clean exit with code 0?
5. In which section do `StartLimitBurst=` and `StartLimitIntervalSec=` go?

**Answers.** 1: With `exec`, a missing or broken binary makes the start fail, instead of looking started. 2: ExecStart is not run by a shell, so `>` is passed as an argument; stdout already goes to the journal. 3: Services don't read your shell profile; put the key in an `EnvironmentFile=`. 4: `on-failure`. 5: `[Unit]`.

## Logs with journald

Under systemd, an app doesn't need to manage log files at all. Everything a service writes to stdout and stderr is captured by **journald**, stored with the unit name, PID, timestamp and priority, and read back with `journalctl`. Learning a dozen `journalctl` flags is the single biggest speed-up when debugging a service.

### How logs reach the journal

- A service's stdout and stderr go to the journal by default (`StandardOutput=journal`). Just print, or configure your logging library to write to stdout.
- Each line is tagged with metadata: `_SYSTEMD_UNIT=rankwise.service`, `_PID`, `_UID`, `_HOSTNAME`, the boot ID and more.
- Syslog messages, kernel messages and systemd's own messages ("Started…", "Main process exited…") go to the same place, so one query shows your app's crash next to systemd's reaction to it.
- A line can carry a priority by starting with `<N>`, where N is 0 to 7 (for example `<3>` for an error). Python's standard logging doesn't do this by itself, but you can add the prefix in a formatter if you want to filter by level.

### The journalctl flags you will use

| Command | Shows |
| --- | --- |
| `journalctl -u rankwise` | All logs for one unit, oldest first |
| `journalctl -u rankwise -f` | Follow live, like `tail -f` |
| `journalctl -u rankwise -n 100` | The last 100 lines |
| `journalctl -u rankwise -b` | Since the current boot (`-b -1` = the previous boot) |
| `journalctl -u rankwise --since "1 hour ago"` | A time window (`--until` closes it; dates like `"2026-11-16 09:00"` work) |
| `journalctl -u rankwise -p err` | Only priority err and worse |
| `journalctl -u rankwise -g Traceback` | Lines matching a pattern (grep) |
| `journalctl -u rankwise -u nginx` | Two units interleaved by time |
| `journalctl -xe` | The latest entries, with explanations: the classic "what just failed?" |
| `journalctl -k` | Kernel messages only (for example out-of-memory kills) |
| `journalctl -u rankwise -o json-pretty` | Every field of every entry |
| `journalctl -u rankwise -o cat` | Messages only, no prefix: good for piping |
| `journalctl _PID=4123` | Filter on any field |

Add `--no-pager` in scripts. Flags combine: `journalctl -u rankwise -b -p warning --since today`.

### Priorities

| Number | Name | Typical use |
| --- | --- | --- |
| 0–2 | emerg, alert, crit | The system or service is unusable |
| 3 | err | An error the service reports |
| 4 | warning | Something odd, still working |
| 5–6 | notice, info | Normal operation |
| 7 | debug | Developer detail |

`-p err` means "0 to 3". `-p warning..err` gives a range.

### Is the journal kept after a reboot?

journald stores logs either in memory (`/run/log/journal`, lost at reboot) or on disk (`/var/log/journal`). With the default `Storage=auto`, it writes to disk only if `/var/log/journal` exists. Ubuntu and Debian create it, so logs persist there. On a system without it:

```bash
sudo mkdir -p /var/log/journal
sudo systemctl restart systemd-journald
```

### Keeping disk use under control

The journal rotates and limits itself: by default it uses at most 10% of the filesystem (capped at 4 GB). To check and trim:

- `journalctl --disk-usage` shows the current size.
- `sudo journalctl --vacuum-time=2weeks` deletes archived entries older than two weeks.
- `sudo journalctl --vacuum-size=500M` shrinks archives to 500 MB.

For a permanent limit, set it in a drop-in file such as `/etc/systemd/journald.conf.d/size.conf`:

```ini
[Journal]
SystemMaxUse=500M
MaxRetentionSec=1month
```

Then run `sudo systemctl restart systemd-journald`.

### Rate limiting and lost lines

journald drops messages from a service that logs too fast, and records a line like "Suppressed 1234 messages from rankwise.service". The limits are set in `journald.conf` (`RateLimitIntervalSec=`, `RateLimitBurst=`), and per unit with `LogRateLimitIntervalSec=` and `LogRateLimitBurst=` in `[Service]`. If you see suppression, the real fix is usually logging less: no debug output in production, and no logging inside tight loops.

### Who can read the journal

Root can read everything. Users in the `systemd-journal` group (and the `adm` group on Debian and Ubuntu) can read the system journal without sudo, and every user can read their own user services' logs. Treat logs as sensitive: never log tokens, passwords or personal data.

### Shipping logs elsewhere

For more than one server, send logs to a central system: `systemd-journal-upload`, or agents such as Vector, Fluent Bit or Promtail that read the journal and forward it to Loki, Elasticsearch or CloudWatch. Locally, the journal is still where you look first.

### Lab: find a crash in the logs (VM, free)

1. Use the demo service from chapter 4. In one terminal, run `journalctl -u demo -f`.
2. In another, `curl localhost:8000` a few times, then `curl localhost:8000/crash`. Watch the crash, systemd's "Main process exited, status=1/FAILURE" message, the wait and the restart appear in order.
3. `journalctl -u demo -b -o short-iso | tail -20` shows the same history with ISO timestamps.
4. `journalctl -u demo -o json-pretty -n 1` shows every field stored for one line.
5. `journalctl --disk-usage`, then `sudo journalctl --vacuum-time=1d`.

### Self-check

1. Where should a service write its logs under systemd?
2. Which command follows one unit's logs live?
3. Which command shows only errors from the current boot for `rankwise`?
4. Logs disappear after every reboot. What is the likely cause and fix?
5. You see "Suppressed 5000 messages" for your service. What does it mean?

**Answers.** 1: stdout and stderr; journald captures them. 2: `journalctl -u <unit> -f`. 3: `journalctl -u rankwise -b -p err`. 4: The journal is only in memory; create `/var/log/journal` and restart systemd-journald. 5: The service logged faster than the rate limit, so journald dropped lines; log less.

## Timers, sockets and other unit types

A service doesn't have to start at boot and run forever. systemd can start it **on a schedule** (a timer), **on the first network connection** (a socket) or **when a file appears** (a path). Each one is a small extra unit that triggers a service, and the service itself stays a normal `.service` file.

### Timers: cron, with logs and dependencies

A timer is a pair of units with the same name: `backup.timer` holds the schedule, and `backup.service` does the work.

`/etc/systemd/system/backup.service`:

```ini
[Unit]
Description=Back up Rankwise progress files

[Service]
Type=oneshot
User=rankwise
ExecStart=/opt/rankwise/tools/backup.sh
```

`/etc/systemd/system/backup.timer`:

```ini
[Unit]
Description=Nightly Rankwise backup

[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true
RandomizedDelaySec=10min

[Install]
WantedBy=timers.target
```

Enable the **timer**, not the service: `sudo systemctl enable --now backup.timer`. The service has no `[Install]` section and runs only when the timer fires. To test the job right away, run `sudo systemctl start backup.service`.

### Timer options

| Option | Meaning | Example |
| --- | --- | --- |
| `OnCalendar=` | Wall-clock schedule | `daily`, `weekly`, `Mon..Fri 09:00`, `*-*-* 03:30:00`, `*:0/15` (every 15 minutes) |
| `OnBootSec=` | Time after boot | `OnBootSec=5min` |
| `OnUnitActiveSec=` | Time after the service last started | `OnUnitActiveSec=1h` (every hour, counted from the last run) |
| `Persistent=true` | If the machine was off at the scheduled time, run once as soon as it's back | Laptops, VMs that get stopped |
| `RandomizedDelaySec=` | Add a random delay | Stops 100 servers hitting a backup target at the same second |
| `AccuracySec=` | How precisely to fire (default 1 minute) | `AccuracySec=1s` for precise jobs |
| `Unit=` | Which unit to start, if the name differs | `Unit=cleanup.service` |

Check a calendar expression before using it: `systemd-analyze calendar "Mon..Fri 09:00"` prints when it next fires. `systemctl list-timers` shows every timer with its last and next run.

### Timers vs cron

|  | cron | systemd timer |
| --- | --- | --- |
| Set-up | One line in a crontab | Two small files |
| Output | Emailed, or lost | In the journal, under the unit name |
| Missed runs (machine off) | Skipped | Caught up with `Persistent=true` |
| Overlapping runs | Possible if a job is slow | Never: a running service isn't started again |
| Dependencies, user, limits, sandboxing | Do it yourself | Every service option applies |
| Testing the job | Wait, or copy the command | `systemctl start x.service` |

cron is fine for a quick personal job. For anything on a server that you need to trust, use a timer.

### One-off and transient units: systemd-run

`systemd-run` creates a temporary unit without writing a file:

- `sudo systemd-run --unit=reindex /opt/app/reindex.sh` runs a script as a supervised service, with logs in `journalctl -u reindex`. It survives your SSH session closing.
- `sudo systemd-run --on-calendar="2026-11-20 02:00" /opt/app/migrate.sh` runs it once at a set time.
- `sudo systemd-run -p MemoryMax=500M --wait --pty python heavy.py` runs a command with a memory limit (chapter 7) and waits for it.

### Socket activation

A `.socket` unit makes **systemd** open the listening port. The service is started on the first connection and inherits the open socket.

```ini
# /etc/systemd/system/rankwise.socket
[Socket]
ListenStream=8766

[Install]
WantedBy=sockets.target
```

What it gives you:

- **On-demand start**: a rarely used service costs nothing until someone connects.
- **Restarts without refused connections**: the socket stays open while the service restarts, and new connections wait in the queue instead of failing.
- **Low ports without root**: systemd binds port 80 or 443, and the service runs as an ordinary user.

The program must accept a socket passed in by systemd (the `LISTEN_FDS` protocol). Gunicorn supports this. Uvicorn can take an inherited socket with `--fd 3`. Many simple apps don't support it, and for those a normal service is the right choice.

### Path units

A `.path` unit watches the filesystem and starts a service when something changes:

```ini
# /etc/systemd/system/import.path
[Path]
DirectoryNotEmpty=/srv/uploads/incoming

[Install]
WantedBy=multi-user.target
```

When a file lands in the folder, `import.service` runs. Other triggers are `PathExists=`, `PathChanged=` (the file was written and closed) and `PathModified=` (any write).

### Lab: a timer and a socket (VM, free)

1. Write a `hello.service` (`Type=oneshot`, `ExecStart=/bin/sh -c 'date >> /tmp/hello.log'`) and a `hello.timer` with `OnCalendar=*:*:0/30` (every 30 seconds) and `AccuracySec=1s`.
2. `sudo systemctl daemon-reload && sudo systemctl enable --now hello.timer`, then watch `systemctl list-timers hello*` and `tail -f /tmp/hello.log`.
3. Run `systemd-analyze calendar "Mon..Fri 09:00" "*-*-01 00:00"` and read the next fire times.
4. Run `sudo systemd-run --unit=slowjob sleep 120`, close your SSH session, reconnect, and check `systemctl status slowjob`: it is still running.
5. Clean up: `sudo systemctl disable --now hello.timer`.

### Self-check

1. You enabled `backup.service`, but the schedule never runs. What should you have enabled?
2. The server was off at 03:30. Which option makes the backup run when it comes back?
3. Name two advantages of timers over cron.
4. What does a `.socket` unit let a service do during a restart?
5. How do you check when `Mon..Fri 09:00` will next fire?

**Answers.** 1: `backup.timer` (the service has no `[Install]` section). 2: `Persistent=true`. 3: Any two of: logs in the journal, catch-up of missed runs, no overlapping runs, easy manual testing, all service options (user, limits, sandboxing). 4: Keep the port open and queue new connections, so clients don't see refused connections. 5: `systemd-analyze calendar "Mon..Fri 09:00"`.

## Hardening and resource control

systemd can sandbox a service and cap its resources with a few lines in the unit, and no changes to the app. If the app is ever compromised, a hardened unit limits what the attacker can touch. If it leaks memory, a limit stops it from taking the whole server down with it.

### Start by measuring

`systemd-analyze security` scores every service from 0 (locked down) to 10 (fully exposed), and `systemd-analyze security rankwise` lists each setting it checked. A fresh unit usually scores around 9 ("UNSAFE"). Adding the settings below typically brings a web app to about 2–4. Treat the score as a checklist, not a target: some settings break some apps.

### Users and directories

- `User=` with a dedicated system user (chapter 4) is the baseline.
- `DynamicUser=yes` goes further: systemd creates a throwaway user each time the service starts, and it switches on several protections automatically. Combine it with:
- `StateDirectory=rankwise`, which creates `/var/lib/rankwise` owned by the service user, for data that must persist. Also `CacheDirectory=`, `LogsDirectory=` and `RuntimeDirectory=` (under `/run`, cleared on stop).

### Filesystem and privilege settings

| Setting | What it does | Breaks |
| --- | --- | --- |
| `NoNewPrivileges=yes` | The process and its children can never gain privileges (setuid binaries stop working) | Apps that call sudo or setuid helpers |
| `ProtectSystem=strict` | The whole filesystem is read-only except `/dev`, `/proc`, `/sys` | Apps that write anywhere not listed below |
| `ReadWritePaths=/opt/rankwise/progress` | Writable exceptions to the above |  |
| `ProtectHome=yes` | `/home`, `/root` and `/run/user` look empty | Apps that read files in home directories |
| `PrivateTmp=yes` | A private `/tmp` that other services can't see | Sharing files through `/tmp` |
| `PrivateDevices=yes` | No access to physical devices | GPU or hardware access |
| `ProtectKernelTunables=yes`, `ProtectKernelModules=yes`, `ProtectControlGroups=yes` | No changes to kernel settings, modules or cgroups | Almost nothing |
| `RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6` | Only normal network sockets | Apps using raw or netlink sockets |
| `CapabilityBoundingSet=` (empty) | Drops all Linux capabilities | Apps that need, for example, port 80 as root |
| `AmbientCapabilities=CAP_NET_BIND_SERVICE` | Lets a non-root service bind ports below 1024 |  |
| `SystemCallFilter=@system-service` | Allows only system calls a normal service needs | Unusual low-level software |

### A hardened block for a Python web app

Add this to the `[Service]` section of the chapter 4 unit:

```ini
NoNewPrivileges=yes
ProtectSystem=strict
ReadWritePaths=/opt/rankwise/progress
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
CapabilityBoundingSet=
SystemCallFilter=@system-service
```

Add settings a few at a time. After each step run `daemon-reload` and `restart`, exercise the app, and check `journalctl -u rankwise` for "Permission denied" or "Read-only file system". Each error points at the setting to relax or the path to add to `ReadWritePaths=`.

### Resource limits

These use the service's cgroup, so they cover every process the service starts:

| Setting | Meaning |
| --- | --- |
| `MemoryHigh=400M` | Soft limit: above it, the kernel reclaims memory aggressively and slows the service down |
| `MemoryMax=512M` | Hard limit: above it, the kernel's out-of-memory killer kills a process in the service |
| `CPUQuota=50%` | At most half of one CPU (`200%` = two CPUs) |
| `CPUWeight=` / `IOWeight=` | A relative share when the machine is busy (default 100) |
| `TasksMax=200` | At most 200 processes and threads: stops fork bombs and runaway threads |
| `LimitNOFILE=65536` | Maximum open files and sockets per process; raise it for busy servers |

When `MemoryMax=` is hit, the journal shows an out-of-memory kill, and with `Restart=on-failure` the service comes back. So a slow leak becomes a restart every few hours instead of a dead server. Fix the leak anyway.

Watch live use with `systemd-cgtop`, or for one service with `systemctl status` (the Memory, CPU and Tasks lines).

### Slices: limits for a group

Services run in `system.slice` by default. You can create your own slice, for example `apps.slice` with `MemoryMax=2G`, and put several services in it with `Slice=apps.slice`. Together they can't use more than 2 GB, however the memory is split between them.

### Lab: harden the demo and hit a limit (VM, free)

1. `systemd-analyze security demo` and note the score.
2. Add the hardened block above (with `ReadWritePaths=` set to a folder the demo writes to, or left out). Reload, restart and score it again.
3. Add a `/leak` route to the demo that keeps appending 10 MB strings to a global list. Set `MemoryMax=150M` and `Restart=on-failure`.
4. Call `/leak` in a loop, `while true; do curl -s localhost:8000/leak; done`, and watch `journalctl -u demo -f`. You will see the out-of-memory kill and the restart.
5. Try `ProtectHome=yes` with an app that reads from `/home/ubuntu` to see what a permission error looks like in the journal.

### Self-check

1. What does `systemd-analyze security` measure?
2. Your app fails with "Read-only file system" after you add `ProtectSystem=strict`. What is the fix?
3. Which setting lets a non-root service listen on port 443?
4. What is the difference between `MemoryHigh=` and `MemoryMax=`?
5. Why add hardening settings a few at a time?

**Answers.** 1: How exposed a service is, from 0 (locked down) to 10, based on its sandboxing settings. 2: Add the folder the app writes to with `ReadWritePaths=` (or use `StateDirectory=`). 3: `AmbientCapabilities=CAP_NET_BIND_SERVICE`. 4: `MemoryHigh` slows the service by reclaiming memory; `MemoryMax` triggers the out-of-memory killer. 5: So when something breaks, you know which setting caused it.

## User services and other platforms

Not every service needs root or a server. systemd can run services for one user, without sudo, and macOS has its own supervisor, **launchd**, which is the right tool for keeping Rankwise running on the Mac it lives on today. The ideas from the earlier chapters carry over almost one to one.

### systemd user services

Every logged-in user gets their own systemd instance, the **user manager**. You manage it with `systemctl --user`, no sudo needed:

|  | System service | User service |
| --- | --- | --- |
| Unit files | `/etc/systemd/system/` | `~/.config/systemd/user/` |
| Command | `sudo systemctl …` | `systemctl --user …` |
| Logs | `journalctl -u x` | `journalctl --user -u x` |
| Runs as | Whatever `User=` says | You (no `User=` line) |
| Boot target | `WantedBy=multi-user.target` | `WantedBy=default.target` |

A user unit looks the same as a system unit:

```ini
# ~/.config/systemd/user/notes-bot.service
[Unit]
Description=My notes bot

[Service]
ExecStart=%h/bots/notes/.venv/bin/python %h/bots/notes/bot.py
Restart=on-failure

[Install]
WantedBy=default.target
```

`%h` expands to your home directory. Then: `systemctl --user daemon-reload && systemctl --user enable --now notes-bot`.

### Lingering: keep running after logout

By default the user manager starts when you log in and **stops when your last session ends**, taking your services with it. To keep them running without a login, and to start them at boot, turn on **lingering**:

```bash
sudo loginctl enable-linger $USER
```

`loginctl show-user $USER -p Linger` confirms it. This is the usual set-up for rootless Podman containers and personal bots on a shared server.

One gotcha: `systemctl --user` needs your session's environment (`XDG_RUNTIME_DIR`). Running it through `sudo -u otheruser` fails with "Failed to connect to bus". Log in as that user properly, or use `sudo machinectl shell otheruser@` instead.

### launchd on macOS

macOS doesn't use systemd. Its PID 1 is **launchd**, configured with XML **property list** (plist) files:

|  | LaunchAgent | LaunchDaemon |
| --- | --- | --- |
| Folder | `~/Library/LaunchAgents/` | `/Library/LaunchDaemons/` |
| Runs as | You, when you are logged in | root (or `UserName`), from boot |
| systemd equivalent | A user service | A system service |

A LaunchAgent that keeps Rankwise's FastAPI server running on the Mac:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.rankwise.api</string>
  <key>ProgramArguments</key><array>
    <string>/Users/you/.local/bin/uv</string><string>run</string>
    <string>main.py</string><string>8766</string>
  </array>
  <key>WorkingDirectory</key><string>/Users/you/Rankwise/A1-App/server_fastapi</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/Users/you/Library/Logs/rankwise.log</string>
  <key>StandardErrorPath</key><string>/Users/you/Library/Logs/rankwise.log</string>
</dict></plist>
```

| plist key | systemd equivalent |
| --- | --- |
| `Label` | The unit name |
| `ProgramArguments` | `ExecStart=` (an array, no shell) |
| `WorkingDirectory`, `EnvironmentVariables` | `WorkingDirectory=`, `Environment=` |
| `RunAtLoad` | `enable` (start when loaded) |
| `KeepAlive` = true | `Restart=always` |
| `KeepAlive` = `{SuccessfulExit: false}` | `Restart=on-failure` |
| `ThrottleInterval` (default 10 s) | `RestartSec=` |
| `StandardOutPath` / `StandardErrorPath` | The journal (launchd writes plain files) |
| `StartCalendarInterval` | A timer's `OnCalendar=` |

The modern `launchctl` commands (`gui/$(id -u)` is your login session):

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.rankwise.api.plist   # load and start
launchctl kickstart -k gui/$(id -u)/com.rankwise.api                             # restart
launchctl print gui/$(id -u)/com.rankwise.api                                    # status, PID, last exit
launchctl bootout gui/$(id -u)/com.rankwise.api                                  # stop and unload
```

The older `launchctl load` and `unload` still work. `plutil -lint file.plist` checks the XML. Remember the Mac-specific catch from the Rankwise log: the firewall blocks Homebrew Python from accepting connections, which is why the server runs on Apple's Python.

### Windows, briefly

Windows has the Service Control Manager. Ordinary programs are usually wrapped as services with **NSSM** or **WinSW**. `sc.exe query` and the Services app are the equivalents of `systemctl status`.

### Lab: a user service, then launchd (VM and Mac, free)

1. In the VM, as the `ubuntu` user, write the `notes-bot` unit with a script that prints the time every 10 seconds. Enable it with `systemctl --user enable --now notes-bot` and follow it with `journalctl --user -u notes-bot -f`.
2. Log out and back in without lingering, and check whether it kept running. Then `sudo loginctl enable-linger ubuntu`, restart the VM and check again.
3. On the Mac, save a LaunchAgent for a tiny script (`while true; do date; sleep 10; done`), `bootstrap` it, and read the log file.
4. `launchctl print gui/$(id -u)/<label>` and find the PID and "last exit code". Kill the PID and check that launchd started it again.
5. `bootout` it and delete the plist.

### Self-check

1. Where do user unit files live, and which target do they hook into?
2. Your user service stops every time you log out. What is missing?
3. Which launchd folder do you use for something that must run before anyone logs in?
4. Which plist key gives the same effect as `Restart=always`?
5. What is the modern command to restart a LaunchAgent?

**Answers.** 1: `~/.config/systemd/user/`, with `WantedBy=default.target`. 2: Lingering: `sudo loginctl enable-linger <user>`. 3: `/Library/LaunchDaemons/`. 4: `KeepAlive` set to true. 5: `launchctl kickstart -k gui/$(id -u)/<label>`.

## Supervisor

**Supervisor** is a small, Python-based process manager. A daemon, **supervisord**, starts the programs listed in an INI file as its children, restarts them when they die and captures their output. A client, **supervisorctl**, controls them. It is not an init system: it manages a handful of app processes, usually on a server where systemd (or a container) runs supervisord itself. It is common in older Python and PHP stacks, Laravel queue workers and Docker images.

### Install and layout

```bash
sudo apt install -y supervisor        # Debian / Ubuntu package (or: pip install supervisor)
systemctl status supervisor           # the package runs supervisord as a systemd service
```

On Debian and Ubuntu:

| Path | Contents |
| --- | --- |
| `/etc/supervisor/supervisord.conf` | Main config: the socket, log locations, and an `[include]` of conf.d |
| `/etc/supervisor/conf.d/*.conf` | One file per program: put yours here |
| `/var/log/supervisor/` | supervisord's own log, plus each program's stdout and stderr logs |
| `/var/run/supervisor.sock` | The UNIX socket supervisorctl talks to |

### A program section

`/etc/supervisor/conf.d/rankwise.conf`:

```ini
[program:rankwise]
command=/opt/rankwise/server_fastapi/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8766
directory=/opt/rankwise/server_fastapi
user=rankwise
environment=PYTHONUNBUFFERED="1",APP_ENV="production"
autostart=true
autorestart=true
startsecs=5
startretries=5
stopsignal=TERM
stopwaitsecs=20
stopasgroup=true
killasgroup=true
redirect_stderr=true
stdout_logfile=/var/log/supervisor/rankwise.log
stdout_logfile_maxbytes=20MB
stdout_logfile_backups=5
```

### The options that matter, with their defaults

| Option | Default | Meaning |
| --- | --- | --- |
| `command` | (required) | The program in the foreground; no shell features |
| `directory`, `user` | none | Working directory; the account to switch to (supervisord must run as root to switch) |
| `environment` | none | `KEY="value",KEY2="value"`, added to supervisord's own environment |
| `autostart` | true | Start when supervisord starts |
| `autorestart` | unexpected | `false`, `unexpected` (exit code not in `exitcodes`) or `true` (always) |
| `exitcodes` | 0 | The "expected" exit codes for `autorestart=unexpected` |
| `startsecs` | 1 | Seconds the program must stay up for the start to count as a success |
| `startretries` | 3 | Failed start attempts before giving up (FATAL) |
| `stopsignal`, `stopwaitsecs` | TERM, 10 | Stop signal, and how long to wait before SIGKILL |
| `stopasgroup`, `killasgroup` | false | Signal the whole process group, so child processes die too |
| `redirect_stderr` | false | Merge stderr into stdout (like `2>&1`) |
| `stdout_logfile` | AUTO | Log file; AUTO puts a randomly named file in the child log directory |
| `stdout_logfile_maxbytes`, `_backups` | 50MB, 10 | Rotation |
| `numprocs`, `process_name` | 1, `%(program_name)s` | Run N copies; the name must include `%(process_num)s` when N > 1 |
| `priority` | 999 | Start order (lower starts first, stops last) |

Two gotchas from the docs:

- `user=` only switches the user ID. It doesn't start a login shell, so `HOME`, `USER` and anything in the user's profile are **not** set. Set what the app needs with `environment=`.
- Without `stopasgroup` and `killasgroup`, programs that spawn children (Gunicorn workers, multiprocessing, Flask in debug mode) can leave orphans behind when stopped. systemd's cgroups avoid this; with Supervisor you turn these on yourself.

### Process states

| State | Meaning |
| --- | --- |
| STOPPED | Not running: stopped on request, or never started |
| STARTING | Started, still inside the `startsecs` window |
| RUNNING | Stayed up for `startsecs`: a successful start |
| BACKOFF | Exited too quickly during STARTING; supervisord will retry, waiting longer each time |
| STOPPING | A stop was requested, waiting for it to exit |
| EXITED | Exited from RUNNING; `autorestart` decides what happens next |
| FATAL | Failed to start `startretries` times in a row; supervisord gave up |
| UNKNOWN | Supervisor's own error state |

The important path: `STARTING → (exits within startsecs) → BACKOFF → STARTING → … → FATAL`. A program that crashes on start, for example from a missing environment variable, ends in FATAL after a few seconds. A program that crashes after hours goes RUNNING → EXITED → restarted.

### supervisorctl

| Command | Does |
| --- | --- |
| `sudo supervisorctl status` | Every program, its state, PID and uptime |
| `start x`, `stop x`, `restart x` | Control one program (`all` for every program, `group:*` for a group) |
| `reread` | Read the config files again and **show** what changed; changes nothing |
| `update` | **Apply** the changes: start new programs, restart changed ones, remove deleted ones |
| `reload` | Restart supervisord itself, which restarts every program |
| `tail -f x` | Follow a program's stdout (`tail -f x stderr` for stderr) |
| `signal HUP x` | Send a signal, for example to make a program reload its config |
| `pid x`, `avail` | A program's PID; every configured program |
| `supervisorctl` (alone) | An interactive shell for the same commands |

The classic mistake: you edit a `.conf` file and run `restart x`. `restart` does **not** read the config again, so nothing changes. The right sequence is `reread` and then `update`.

### Groups and event listeners

- `[group:web]` with `programs=rankwise,worker` lets you `restart web:*` together.
- `[eventlistener:x]` sections run programs that receive supervisord events (process state changes, ticks). The **superlance** package adds ready-made listeners: `crashmail` emails on crashes, `memmon` restarts programs that use too much memory, and `httpok` restarts a program when its health URL stops answering.

### The web UI and security

An `[inet_http_server]` section adds a web UI and an XML-RPC API on a TCP port. Anyone who can reach it can stop and start your programs, so if you turn it on, bind it to `127.0.0.1` and set a username and password. The default UNIX socket is safer: access to it is controlled by file permissions.

### Lab: run the demo under Supervisor (VM, free)

1. `sudo systemctl disable --now demo` (so port 8000 is free), then `sudo apt install -y supervisor`.
2. Write `/etc/supervisor/conf.d/demo.conf` for the chapter 4 app, modelled on the example above.
3. `sudo supervisorctl reread` (it lists `demo: available`), then `sudo supervisorctl update`, then `status`.
4. `curl localhost:8000/crash` and watch `status`: EXITED, then RUNNING again with a new PID.
5. Break the command path, then `reread` and `update`. Watch the program go through BACKOFF to FATAL, and read `/var/log/supervisor/supervisord.log` to see why.
6. `sudo supervisorctl tail -f demo` while you send requests.

### Self-check

1. You edited a program's `.conf` file and ran `restart`, but nothing changed. Why, and what should you run?
2. A program crashes 0.5 seconds after starting, every time. Which state does it end in?
3. What is the default `autorestart`, and what does it mean?
4. Why turn on `stopasgroup` and `killasgroup` for Gunicorn?
5. The app can't find `HOME` under Supervisor even though `user=` is set. Why?

**Answers.** 1: `restart` doesn't re-read config; run `supervisorctl reread` then `update`. 2: FATAL, after `startretries` attempts through BACKOFF. 3: `unexpected`: restart only when the exit code isn't in `exitcodes` (default 0). 4: So stop and kill signals reach the worker processes, not just the master, and no orphans are left. 5: `user=` only changes the user ID; it doesn't set `HOME` or other environment variables, so set them with `environment=`.

## Choosing a supervisor

On a plain Linux server, use **systemd**: it is already PID 1, it already supervises everything else, and it does more than Supervisor. Supervisor still makes sense in a few places, and in containers the container platform becomes the supervisor. This chapter gives you a way to decide, and shows how the tools fit together when you use more than one.

### The options side by side

|  | systemd | Supervisor | Docker / Compose | Kubernetes | PM2 | launchd |
| --- | --- | --- | --- | --- | --- | --- |
| Where | Every modern Linux | Any Unix with Python | Anywhere Docker runs | Clusters | Node.js apps | macOS |
| Starts at boot | Itself (PID 1) | Needs systemd to start it | Docker daemon (via systemd) | The cluster | `pm2 startup` writes a systemd unit | Itself (PID 1) |
| Restart policy | `Restart=` | `autorestart` | `restart: unless-stopped` | `restartPolicy`, CrashLoopBackOff | Built in | `KeepAlive` |
| Health checks that restart | Watchdog (needs app support), or a timer | superlance `httpok` | `HEALTHCHECK` marks the container unhealthy but doesn't restart it | Liveness probes do restart | Built-in monitoring | No |
| Child process tracking | cgroups, complete | Process groups, if turned on | Container | Container | Its own | Process groups |
| Logs | Journal | Files per program | `docker logs` | `kubectl logs` | `pm2 logs` | Files |
| Resource limits and sandboxing | Extensive | None | cgroups per container | Per pod | Memory restart only | Few |
| Non-root users can manage it | `--user` services | With socket permissions | Docker group (effectively root) | RBAC | Yes | LaunchAgents |

### Choosing

1. **Is it a container image?** Then the platform supervises it: Docker restart policies or Kubernetes. Run **one process per container**, in the foreground, and don't put systemd or Supervisor inside.
2. **Is it a plain Linux server or VM?** Use a **systemd** unit. Most of the time this is the answer.
3. **Does a team or project already use Supervisor**, for example Laravel queue workers, or an image that runs several processes? Keep Supervisor, and run supervisord itself under systemd, which is what the Debian package does.
4. **Is it a Node.js app whose team likes PM2?** PM2 is fine. Run `pm2 startup`, which generates a systemd unit for PM2 itself.
5. **Is it on a Mac?** Use launchd (chapter 8).

### Why systemd usually wins on a server

- It is already there and already PID 1. Supervisor adds a Python daemon that itself needs supervising.
- cgroups track every child, so stops are complete. Supervisor relies on process groups, and only if you set `stopasgroup` and `killasgroup`.
- Sandboxing, resource limits, timers, socket activation, ordering against the network or a database, and journald logging are all built in.
- Supervisor's advantages: its config is simple and portable to other Unix systems, `numprocs` makes it easy to run N copies, and its web UI and XML-RPC API are handy for teams who already use them.

### Inside containers: PID 1 is special

In a container, your app usually *is* PID 1, and PID 1 has two extra duties. It must **reap zombie** children (collect the exit status of children that have died), and it gets **no default signal handling**, so a program that doesn't explicitly handle SIGTERM ignores `docker stop`, and Docker kills it after 10 seconds. The fixes:

- Run a tiny init as PID 1: `docker run --init`, or `ENTRYPOINT ["tini", "--"]`. It forwards signals and reaps zombies.
- Use the exec form `CMD ["uvicorn", "main:app"]`, not the shell form `CMD uvicorn main:app`, so the app gets the signals instead of an intermediate shell.
- If a container really must run several processes, a small init such as **s6-overlay** or Supervisor can do it, but a second container is usually cleaner.

Docker restart policies: `no` (default), `on-failure[:max-retries]`, `always`, and `unless-stopped` (like always, except after you stop it by hand). The Docker daemon itself is a systemd service, so the chain is still systemd → dockerd → your container.

### Layering: who supervises whom

```text
systemd (PID 1)
├── nginx.service
├── rankwise.service            ← the app directly under systemd (recommended)
├── supervisor.service           ← supervisord, started and restarted by systemd
│   ├── program:queue-worker_00
│   └── program:queue-worker_01
└── docker.service
    └── container: redis         ← restarted by Docker's restart policy
```

Each level restarts the level below it. Never supervise the same program twice, for example with both a systemd unit and a Supervisor program: they will fight over the port and restart each other's copy.

### Health checks, not just liveness

All of these tools notice a process that **exits**. A process that is alive but stuck (deadlocked, or answering every request with errors) needs a **health check**. Options:

- systemd: `WatchdogSec=` with an app that sends sd\_notify keep-alive pings, or a timer that runs `curl -fsS localhost:8766/api/health || systemctl restart rankwise`.
- Supervisor: superlance `httpok`.
- Kubernetes: liveness probes restart the container; readiness probes only take it out of the load balancer.
- Docker: `HEALTHCHECK` only marks the container unhealthy. Something else (Compose with an orchestrator, or a watcher) has to act on it.

Rankwise's FastAPI server already has `/api/health`, which is a ready-made target for any of these.

### Self-check

1. On a fresh Ubuntu server, what should keep a FastAPI app running?
2. Why not run systemd or Supervisor inside a typical Docker container?
3. What two jobs does PID 1 have inside a container, and what is the simple fix?
4. What does PM2's `pm2 startup` actually create?
5. Your app is alive but returns 500 on every request. Which feature catches that?

**Answers.** 1: A systemd service unit. 2: The container platform already supervises the container; run one foreground process per container. 3: Reaping zombie children and handling signals; use `--init` or tini. 4: A systemd unit that starts PM2 at boot. 5: A health check (watchdog, httpok or a liveness probe), not just exit-based restarts.

## Troubleshooting playbook

When a service won't start or keeps dying, the same four steps solve almost every case: read the state, read the logs, decode the exit status, and reproduce the start by hand in the service's exact conditions. This chapter is a checklist you can follow under pressure, plus a table of the failures you will meet most often.

### The four steps (systemd)

1. **State**: `systemctl status rankwise`. Look at Active, the `code=` and `status=` on the "Main PID" or "Process" line, and the last log lines.
2. **Logs**: `journalctl -u rankwise -b -n 100 --no-pager`, or `journalctl -xe` right after a failure. Read **upwards from systemd's "Failed" line** to the first error your app printed.
3. **Decode**: `systemctl show rankwise -p Result,ExecMainCode,ExecMainStatus`. `Result=` is one of `success`, `exit-code`, `signal`, `timeout`, `core-dump`, `watchdog`, `oom-kill` or `start-limit-hit`.
4. **Reproduce** as the service user, in its directory, with its environment, not as yourself in your shell:

```bash
sudo -u rankwise env -i PYTHONUNBUFFERED=1 \
  bash -c 'cd /opt/rankwise/server_fastapi && .venv/bin/uvicorn main:app --port 8766'
```

`env -i` starts from an empty environment, as systemd does, so missing variables and PATH problems show up here too.

Two more tools: `systemd-analyze verify /etc/systemd/system/rankwise.service` catches typos and unknown options in a unit file, and `systemctl cat rankwise` shows the unit as systemd actually sees it, drop-ins included.

### Common failures (systemd)

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `status=203/EXEC` | `ExecStart` path wrong, file not executable, bad shebang, or script lacks `chmod +x` | Check the path with `ls -l`; use an absolute path to the venv's binary |
| `status=200/CHDIR` | `WorkingDirectory=` doesn't exist, or the user can't enter it | Create it; fix ownership and permissions |
| `status=217/USER` | `User=` names an account that doesn't exist | Create the user, or fix the name |
| `status=226/NAMESPACE` | A sandboxing path (for example in `ReadWritePaths=`) doesn't exist | Create the directory, or use `StateDirectory=` |
| `status=1/FAILURE` | The app itself exited with an error | Read its traceback in the journal |
| `code=killed, status=9/KILL` | Out-of-memory kill (`MemoryMax=` or system OOM), or it ignored SIGTERM until `TimeoutStopSec=` | `journalctl -k` for OOM; handle SIGTERM in the app |
| `Result: start-limit-hit` | It crashed too often within `StartLimitIntervalSec=` | Fix the cause, then `systemctl reset-failed rankwise` and start it |
| `activating (auto-restart)` forever | It starts and crashes in a loop | Read the first error in the logs; it repeats every cycle |
| "Address already in use" | Another process holds the port, maybe a copy you started by hand | `sudo ss -ltnp 'sport = :8766'` to find it |
| "Permission denied" or "Read-only file system" | File ownership, or `ProtectSystem=` / `ProtectHome=` | `chown` the data directory; add `ReadWritePaths=` |
| `ModuleNotFoundError` | Wrong Python: the system one instead of the venv's | Point `ExecStart=` at `.venv/bin/…` |
| Works in the terminal, fails as a service | Environment: PATH, API keys, HOME | `EnvironmentFile=`; absolute paths |
| Edits have no effect | Forgot `daemon-reload`, or edited a file systemd isn't using | `systemctl cat` to see the file in use |
| `Unit rankwise.service not found` | Wrong name, or the file is in the wrong folder or lacks `.service` | `ls /etc/systemd/system/` |
| Timer never runs | You enabled the service instead of the timer | `systemctl enable --now x.timer`; check `list-timers` |

### The four steps (Supervisor)

1. `sudo supervisorctl status` shows the state: FATAL, BACKOFF or EXITED.
2. `sudo supervisorctl tail rankwise stderr` (or `stdout` with `redirect_stderr`) shows the app's own output.
3. `/var/log/supervisor/supervisord.log` shows Supervisor's view: spawn errors, "exited: … (exit status 1; not expected)", "gave up: … entered FATAL state, too many start retries too quickly".
4. Reproduce with `sudo -u rankwise env -i …`, as above.

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `FATAL Exited too quickly (process log may have details)` | It crashes within `startsecs` on every try | Read the program log; fix the crash |
| `spawn error` / "can't find command" | `command` path wrong, or not executable | Absolute path to the binary |
| `ERROR (no such process)` | The new program was never loaded | `supervisorctl reread` then `update` |
| `unix:///var/run/supervisor.sock no such file` | supervisord isn't running | `sudo systemctl start supervisor` |
| Edits to `.conf` have no effect | You ran `restart` instead of `reread` + `update` | `reread`, then `update` |
| Workers keep running after a stop | Children weren't signalled | `stopasgroup=true`, `killasgroup=true` |
| App can't find HOME or its config | `user=` doesn't set environment variables | `environment=HOME="/opt/rankwise",…` |

### Questions that find the cause fast

- What changed? A deploy, a package upgrade, an edited config, a full disk (`df -h`), an expired certificate?
- Does it fail at start, after a fixed time, or under load? Start-up failures are config; failures after a fixed time are memory or timeouts; failures under load are limits (file descriptors, tasks, memory).
- Is it the same error each restart? Read the first one, not the last one.

### Lab: break it five ways (VM, free)

For each step, break the demo unit, run `daemon-reload` and `restart`, diagnose with the four steps, write down the status you saw, then fix it:

1. Point `ExecStart` at a file that doesn't exist.
2. Set `User=nobodyhere`.
3. Set `WorkingDirectory=/opt/missing`.
4. Make the app read `os.environ["API_KEY"]` at start-up and don't provide it. Watch it loop, then hit `start-limit-hit`. Recover with `reset-failed`.
5. Start a second copy by hand on port 8000, then restart the service: "Address already in use".

Repeat steps 1 and 4 under Supervisor and compare what `status` and the logs show.

### Self-check

1. What does `status=203/EXEC` usually mean?
2. Your service shows `start-limit-hit`. You fixed the bug. What must you run before it will start again?
3. Which command shows the unit file systemd is really using, drop-ins included?
4. Why reproduce with `sudo -u <user> env -i …` rather than just running the command?
5. Supervisor says `ERROR (no such process)` for a program you just added. What did you skip?

**Answers.** 1: The program couldn't be executed: wrong path, not executable, or a bad shebang. 2: `systemctl reset-failed <unit>` (then start it). 3: `systemctl cat <unit>`. 4: It reproduces the service's user and empty environment, which is where most "works for me" failures come from. 5: `supervisorctl reread` and `update`.

## Capstone: Rankwise on a Linux server

This chapter puts everything together. You deploy Rankwise's real FastAPI server on the lab VM so that it starts at boot, restarts on crash, keeps learners' progress in a protected data directory, logs to the journal, is sandboxed and memory-capped, and is health-checked every five minutes. Then you run the same app under Supervisor to compare, and finish with the final quiz.

### The target

| Requirement | How |
| --- | --- |
| Starts at boot, after the network | `WantedBy=multi-user.target`, `After=`/`Wants=network-online.target` |
| Restarts on crash, without looping forever | `Restart=on-failure`, `RestartSec=3`, start limit 10 in 5 minutes |
| Runs unprivileged | System user `rankwise` |
| Progress stored safely and persistently | `StateDirectory=rankwise` → `/var/lib/rankwise`, passed as `A1_DATA` |
| Logs in the journal | stdout, plus `PYTHONUNBUFFERED=1` |
| Sandboxed and capped | The chapter 7 block, `MemoryMax=300M` |
| Health-checked | A timer that calls `/api/health` |

### Step 1: install the app

```bash
sudo useradd --system --home /opt/rankwise --shell /usr/sbin/nologin rankwise
sudo mkdir -p /opt/rankwise && sudo chown $USER /opt/rankwise
# copy A1-App into /opt/rankwise (from the Mac: multipass transfer, scp or git clone)
cd /opt/rankwise/server_fastapi
curl -LsSf https://astral.sh/uv/install.sh | sh && ~/.local/bin/uv sync --python /usr/bin/python3   # .venv on the system Python
sudo chown -R root:root /opt/rankwise    # code is read-only to the service user
```

The server is started with `python main.py <port>` (it calls `uvicorn.run` itself) and reads its data folder from `A1_DATA`.

Why `--python /usr/bin/python3`: by default uv links the venv to a Python it downloaded into *your* home folder, and the `ProtectHome=yes` sandbox below hides home folders from the service, which would fail with 203/EXEC. Building the venv on the system Python avoids that trap.

### Step 2: the unit

`/etc/systemd/system/rankwise.service`:

```ini
[Unit]
Description=Rankwise learning app (FastAPI)
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=300
StartLimitBurst=10

[Service]
Type=exec
User=rankwise
Group=rankwise
WorkingDirectory=/opt/rankwise/server_fastapi
StateDirectory=rankwise
Environment=PYTHONUNBUFFERED=1 A1_DATA=/var/lib/rankwise
ExecStart=/opt/rankwise/server_fastapi/.venv/bin/python main.py 8766
Restart=on-failure
RestartSec=3
TimeoutStopSec=20

# sandbox
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
CapabilityBoundingSet=
SystemCallFilter=@system-service

# limits
MemoryMax=300M
TasksMax=100

[Install]
WantedBy=multi-user.target
```

`StateDirectory=` makes `/var/lib/rankwise` writable even under `ProtectSystem=strict`, so no `ReadWritePaths=` line is needed. To keep existing progress, copy the Mac's `progress/` files into `/var/lib/rankwise/` and `chown -R rankwise:rankwise` them.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now rankwise
curl -s localhost:8766/api/health
systemd-analyze security rankwise
```

### Step 3: the health check

`/etc/systemd/system/rankwise-health.service`:

```ini
[Unit]
Description=Restart Rankwise if /api/health stops answering

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'curl -fsS --max-time 5 http://127.0.0.1:8766/api/health >/dev/null || systemctl restart rankwise'
```

`/etc/systemd/system/rankwise-health.timer`:

```ini
[Timer]
OnBootSec=2min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
```

Run `sudo systemctl enable --now rankwise-health.timer`. The check runs as root, so it is allowed to restart the service. Its runs appear in `journalctl -u rankwise-health`.

### Step 4: prove it

1. **Crash**: `sudo kill -9 $(systemctl show -p MainPID --value rankwise)`. A new PID about 3 seconds later.
2. **Reboot**: `sudo reboot`, then `systemctl is-active rankwise` and `curl` the health endpoint.
3. **Logs**: `journalctl -u rankwise -b` shows the kill, systemd's reaction and the restart.
4. **Hang**: `sudo kill -STOP $(systemctl show -p MainPID --value rankwise)` freezes the process without killing it. Within 5 minutes the health timer restarts it. A plain `Restart=` never would, because the process never exits.
5. **Data**: use the app from your phone or browser (`http://<vm-ip>:8766`), then restart the service and check the progress is still there in `/var/lib/rankwise`.

### Step 5: the same app under Supervisor

`sudo systemctl disable --now rankwise rankwise-health.timer`, then write `/etc/supervisor/conf.d/rankwise.conf`:

```ini
[program:rankwise]
command=/opt/rankwise/server_fastapi/.venv/bin/python main.py 8766
directory=/opt/rankwise/server_fastapi
user=rankwise
environment=PYTHONUNBUFFERED="1",A1_DATA="/var/lib/rankwise",HOME="/opt/rankwise"
autorestart=true
startsecs=5
stopwaitsecs=20
stopasgroup=true
killasgroup=true
redirect_stderr=true
stdout_logfile=/var/log/supervisor/rankwise.log
```

Run `sudo supervisorctl reread && sudo supervisorctl update`, then repeat the crash test and `tail -f`. Write down three things systemd gave you that Supervisor didn't: the sandbox, the memory limit and the journal are the obvious ones. Then switch back to the systemd unit, the recommended set-up.

### Final quiz

1. Which process is PID 1 on Ubuntu, and why does that matter for supervision?
2. In what order does a supervisor send signals to stop a service, and which systemd and Supervisor settings control the wait?
3. `Wants=postgresql.service` is set but `After=` isn't. What can go wrong?
4. You ran `systemctl enable app` but it isn't running. Why?
5. Which `Type=` should a foreground Uvicorn service use, and why that one over the default?
6. Your unit has `ExecStart=/opt/app/run.sh >> /var/log/app.log`. What happens?
7. Which `Restart=` value restarts after a crash but not after a clean exit?
8. A service shows `Result: start-limit-hit`. How do you recover once the bug is fixed?
9. Which command shows only errors for `rankwise` since the last boot?
10. You enabled `backup.service`, but nothing runs at 03:30. What is wrong?
11. What does `ProtectSystem=strict` do, and how does the app still write its data?
12. A Supervisor program is in FATAL after a config change. Name the two commands you should have used, and where to look for the cause.
13. Why shouldn't a Docker container run systemd or Supervisor inside it, and what should PID 1 be instead?
14. The process is alive but every request hangs. Why doesn't `Restart=` help, and what does?
15. On your Mac, which launchd folder and plist key keep the Rankwise server always running for your user?

**Answers.**

1. systemd; it is the parent of every service, so it sees every exit and can restart and track them.
2. SIGTERM, a grace period, then SIGKILL; `TimeoutStopSec=` and `stopwaitsecs`.
3. Both start in parallel, so the app can start before the database is ready.
4. `enable` only acts at boot; use `start` or `enable --now`.
5. `Type=exec`: a broken `ExecStart` makes the start fail instead of looking successful.
6. ExecStart isn't run by a shell, so `>>` and the path are passed as arguments; output goes to the journal anyway.
7. `on-failure`.
8. `systemctl reset-failed rankwise`, then start it.
9. `journalctl -u rankwise -b -p err`.
10. You must enable the timer (`backup.timer`), not the service.
11. It makes the whole filesystem read-only for the service; data goes in `StateDirectory=` or a `ReadWritePaths=` folder.
12. `supervisorctl reread` and `update`; look at the program's log (`tail x stderr`) and `supervisord.log`.
13. The container platform already supervises it, and you should run one foreground process per container; use a tiny init such as tini (`--init`) as PID 1.
14. The process never exits, so nothing triggers a restart; add a health check (a timer with curl, a watchdog, httpok or a liveness probe).
15. `~/Library/LaunchAgents/`, with `KeepAlive` set to true (and `RunAtLoad`).

Score 12 or more out of 15 and you have mastered this branch.

# One environment: why LevelUp has no dev/staging copy

**Decision (2026-11-23):** LevelUp runs as a single live app (https://levelrise.org). There is no separate dev or staging instance. We test on live, using developer accounts that real learners can't create or see.

## How it works
- **Developer accounts** have usernames starting with `_` (`_test_user1`, `_test_user2`, …). `server_fastapi/devaccounts.py` creates them from code.
- **Sign-up refuses `_` names** (server returns 400 "username cannot start with _"; the app checks first). So no learner can ever take or imitate one.
- **Hidden from learners:** `/api/users` leaves `_` accounts out unless the caller is a `_` account too.
- **Real learners' progress is never touched.** Test data lives in `_` accounts only.
- A local scratch server stays available for trying risky code, but it is a tool, not an environment.

## How to explain it in an interview
**One-sentence version:** "With a handful of users, a second environment costs more than it protects, so I run one environment and make testing safe inside it."

**The structure that lands well:**
1. **Context first.** Tiny user base (friends and family), one developer, a 6 USD droplet. Say the numbers.
2. **The cost of staging.** A second environment means a second droplet and domain, duplicated config and data, drift between the two, and a "works on staging" that proves less than it seems because staging has no real data or traffic. For one person it also means deploy steps doubled.
3. **The risk you actually have, and what you did about it.** The real danger of testing in production is touching real users' data. So I isolated test data instead of isolating servers: reserved `_` usernames, created only by code, blocked at sign-up, hidden from other users. Isolation by data, not by infrastructure.
4. **Other safety nets still exist.** Calendar-versioned git tags per deploy (rollback = redeploy the previous tag), one backup per learner per day, atomic writes, a service that restarts on crash, and a local scratch server for risky changes.
5. **Say when you'd change it.** "If we had paying users, several developers, or data migrations that can't be undone, I'd add staging, and probably feature flags and automated deploys (the earlier two-instance plan was dropped for now, not forgotten)."

**Trade-offs to name honestly (interviewers like this):**
- A bad deploy hits everyone at once. Mitigation: small releases, versioned tags, quick rollback.
- Test accounts live in the production database. Mitigation: the `_` rule makes them identifiable, filterable and deletable; they are hidden from learners and excluded from anything user-facing.
- No pre-production check of migrations. Mitigation: try them on the local scratch server with a copy of the data first.

**Likely follow-ups:**
- *"Isn't testing in production bad practice?"* Not by itself. Big companies test in production too (canaries, feature flags, synthetic users). The bad practice is testing on real users' data without isolation. Synthetic `_` users are the synthetic-user pattern.
- *"What if someone guesses a `_` name?"* They can't sign up with it. Passwords are random and hashed (PBKDF2), logins are throttled, and the accounts have no special privileges, so even a compromised one only sees its own data.
- *"How do you know it's safe to ship?"* Local checks, a quick run with a `_` account on live right after deploy, a health endpoint that reports the version, and a fast rollback.
- *"What would make you add staging?"* More users, more developers, paid features, or irreversible data changes.

The principle to leave them with: **match the process to the risk.** Process that protects nothing is overhead; process that protects real data is worth paying for.

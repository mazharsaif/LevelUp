# LevelUp

- Read `PROJECT_LOG.md` first for what's done, pending and where things live. Open source files only for the part you're changing.
- At the end of a session that changed the app, update the log's **State**, **Pending** and **Changelog** (one line), and keep it short.
- Never test against real progress: use the test server (`cd server_fastapi && A1_DATA=<tmp> uv run main.py 8899`, repo-root uv env, Python 3.13). Logins are on: set test passwords with `A1_DATA=<tmp> LU_PASSWORD=<pw> uv run python auth.py <uid>`. The old `server.py` has no logins (the app falls back to the player picker).
- Material outside the repo lives in `../German Learning/`: `cicd-tutorial/` (CI/CD book source) and `legacy/` (A1 source books, used by export_data.py).

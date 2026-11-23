# LevelUp

- Read `PROJECT_LOG.md` first for what's done, pending and where things live. Open source files only for the part you're changing.
- Todos and feedback live in `TODOS.md`: **Mine** (Mazhar) and **Others** (with the suggester's name). Add new ones there, move finished ones to Done.
- At the end of a session that changed the app, update the log's **State**, **Pending** and **Changelog** (one line), and keep it short.
- **One environment: live (https://levelrise.org).** No separate dev/staging copy. Test on live with the developer accounts `_test_user1…` (usernames starting with `_`, created only by `server_fastapi/devaccounts.py`; sign-up refuses `_`). Never touch real learners' progress (mazhar, taha, batul, …). Rationale: `docs/guides/single-environment.md`.
- A local scratch server (`cd server_fastapi && A1_DATA=<tmp> uv run main.py 8899`, Python 3.13) is only for trying risky code before it ships; it is not a second instance. Set test passwords with `A1_DATA=<tmp> LU_PASSWORD=<pw> uv run python auth.py <uid>`. The old `server.py` has no logins.
- Material outside the repo lives in `../German Learning/`: `cicd-tutorial/` (CI/CD book source) and `legacy/` (A1 source books, used by export_data.py).

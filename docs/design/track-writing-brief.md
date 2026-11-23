# Brief: a Firebase course for anyone in the world

You are writing part of a self-study course on **Firebase** that is read on a phone, in short parts of a few minutes. It replaces a weak first draft. Do not reuse the old text; write fresh, better material.

## Who the reader is
Anyone, anywhere. Assume:
- They can read basic code (a little JavaScript or Python) and have built, or want to build, a simple app.
- They have **never used Firebase**, and may not know words like "backend", "SDK", "index", "token", "JWT", "CDN", "serverless".
- English may be their second language. Many read on a small phone screen, on a slow connection.
- They are **not** a data scientist, not an AWS user, not anyone in particular. Do not mention any specific company, app, person, repository, file path, or "this guide / this track / the author / I". Never write dates like "checked 2026-11-23" or notes like "this was not tested". Write as a calm, confident teacher speaking to "you".

## Language rules
- Short sentences. Plain words. Define each new term the first time you use it, in a few words, in bold: **security rules** (the rules that decide who may read or write your data).
- No idioms, slang, jokes that need culture, or metaphors that need explaining. One simple analogy per chapter at most, only if it truly helps.
- Say what to do, then why. Prefer a concrete example over an abstract statement.
- Be honest about trade-offs: every benefit gets its cost. Say clearly when NOT to use something.

## The one running example (use it in EVERY chapter)
A small **Notes app**: people sign in, write notes, attach a photo to a note, and get a reminder push notification. Use these names consistently:
- Firebase project id: `notes-demo`
- Firestore collection `notes`, document fields: `ownerId` (the signed-in user's uid), `text`, `createdAt`, `photoPath`
- Per-user data: `users/{uid}` and `users/{uid}/tokens` (push tokens)
- Storage path for photos: `photos/{uid}/{noteId}.jpg`
The reader should feel one app growing across the course. Other examples (a shop, a habit tracker) may appear briefly for contrast.

## The whole course (12 skills, in reading order). Cross-refer by skill title only.
1. Why Firebase exists: the problem, what Firebase is, the product catalogue, the trade-offs, what you will build.
2. Project & plans: create a project, register an app, the config object, install and initialise the SDK, the CLI, the Emulator Suite, Spark vs Blaze.
3. Sign-in (Auth): email/password and Google sign-in, auth state, the uid, ID tokens, verifying on a server, limits.
4. Firestore data: documents and collections, create/read/update/delete, queries, live listeners, indexes, modelling without joins, cost per read/write.
5. Security rules: why they matter, how to write them, the mistakes, testing in the emulator.
6. Functions & Hosting: Cloud Functions (triggers, when you need one, deploy), Hosting (deploy a web app), Cloud Storage for photos (and its rules).
7. Push basics: how push works, registration tokens, permission, receiving messages, saving tokens.
8. Sending push: sending from a server or a function, data vs notification messages, priority/TTL, topics, errors and stale tokens.
9. Measure & protect: Analytics, Crashlytics, Performance Monitoring, Remote Config, App Check.
10. Costs & safety: how billing works, estimating, budgets and alerts, pre-launch security checklist, exit strategy, common mistakes.
11. Use it, or not?: a decision framework, honest limits, alternatives, four scenarios with a verdict.
12. Final project: put it all together as a build plan and checklist for the Notes app, then a final self-test.

## Technical rules for accuracy
- **Verify facts** about products, plan requirements, limits, quotas, API names and code against the official Firebase documentation (firebase.google.com/docs) and Google Cloud docs, using web search and page fetch tools. Today is November 2026 and Firebase changes often.
- Web client code: use the **modular JavaScript SDK** (`import { ... } from "firebase/..."`). Confirm current import paths and function names in the docs. Server code: the **Admin SDK** (Node.js and/or Python; confirm names). Give a one-line pointer for Android/iOS only where it matters.
- If you cannot verify a specific number or name, do NOT state it. Say it generally ("a daily free quota; check the pricing page for the current numbers"). Never invent a number, price, limit, flag, URL or quote. You may name official docs sections ("Firebase docs → Authentication → Web → Get started") and the root firebase.google.com/docs, nothing deeper.
- A Python SDK release (firebase-admin 7.8.0) was seen warning that `Message.token` is deprecated in favour of `fid` (a Firebase installation ID). Check the current Admin SDK docs; if confirmed, mention it neutrally in the "Sending push" skill.
- All code must be correct and realistic. Use placeholder values for secrets and ids (`"YOUR_API_KEY"`). Never show a real key. The web `apiKey`/config is not a secret, but a service-account key is.

## Format rules (the app builds cards from your markdown; follow exactly)
- File `content/se/fcm/NN.md` where NN is the skill number above (01 to 12), two digits. First line: `## N. Title` using the exact skill title from the list above (N is the number).
- Then one short intro paragraph (2–3 sentences): what the reader will be able to do after this skill.
- Then **at least 4, preferably 5 or 6, sections** starting with `### Heading` (plain text headings: no bold, no backticks, no emoji in headings). Each section is about 180–350 words so the app can split the skill into 3–4 balanced parts. Use `####` only for small sub-headings.
- **Length: 1,300–1,800 words per skill** including code. This is a real lesson, not notes.
- Every skill must include: (a) at least one **worked example** from the Notes app with working code or steps; (b) a section called `### Try it` with a hands-on mini-lab (about 10 minutes, free, using the **Emulator Suite** or the free plan, with exact commands and what you should see); skills 1, 11 and 12 may use a thinking exercise or checklist instead of commands; (c) `### Common mistakes` (3–5 items, each: the mistake, what you will see, the fix); (d) the last section `### Check yourself`: 4 questions as a numbered list, then ONE paragraph starting with `**Answers.**` containing short answers to all four (the app hides this paragraph behind a tap).
- Tables: maximum **3 columns**, short cells, never put the pipe character inside a cell. Avoid tables over 6 rows.
- Code blocks: fenced with a language tag, **no line longer than 38 characters** (phones are narrow; break lines), under about 20 lines each. Comments in code in plain English.
- ASCII diagrams must be **38 characters wide or less**.
- No images. No HTML. No emoji except none at all in headings; at most an occasional one in body text is fine but avoid.
- Do not use the words "leaf", "roots", "blast radius" or other metaphors from an older draft.

## Practice questions (a second file per skill)
Write `content/se/fcm/NN.q.json`: a JSON list, **8 questions** per skill (10 for skill 12), mixing about 6 multiple-choice and 2 myth/fact. Schemas:
- `{"t":"mc","q":"question","o":["opt A","opt B","opt C","opt D"],"a":<index of the right option>,"why":"one or two sentences"}`
- `{"t":"mf","q":"statement","a":true|false,"why":"one or two sentences"}`
Rules: test understanding and judgment (scenarios, "what would you do", "what goes wrong"), not trivia; every question answerable from the skill text; four plausible options with one clearly best; vary the position of the right answer; no option "all of the above"; keep options short (phones). Valid JSON, UTF-8, `indent=1`.

## What you must NOT do
- Do not run the build, tests, git, or any command that changes files other than your own `NN.md` and `NN.q.json`. Other writers are working on other chapters in the same folder at the same time. Do not read other writers' unfinished chapters for content; use the course list above for scope. Do not edit `_tree.json`, `00.md`, app code, or any other file.
- Do not repeat what another skill owns (see the course list). Refer to it by title instead ("see Security rules").
- Do not pad. If a section is already clear, stop.

## Quality bar
A stranger with no Firebase experience should be able to follow your skill on their phone, understand why each step exists, try the lab, and make a sound decision afterwards. Read two existing chapters for the tone and card format only (do not copy their content): `content/se/keys/02.md` and `content/se/sysd/03.md` in the repo at `/Users/mazhar/Personal Projects/LevelUp`.

## Final reply
Reply with: the files you wrote, word count per chapter, and a short list of any claims you could not verify (so a reviewer can check them). No other text.

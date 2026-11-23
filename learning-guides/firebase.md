# Firebase
> Reading time: ~40 min (~4,600 words) | Level: DS with 5 yrs | Takeaway: Firebase is Google's managed backend kit for apps. It is brilliant when you have no backend and need one this week, and risky when its database and security rules become the foundation you cannot leave. Know which pieces are easy to swap (push, hosting) and which are not (database, login).

**Budget:** I sized it as a 60-minute topic (a broad catalogue of a dozen products), then cut it to about 40 minutes of reading because the 20% that drives decisions fits. I give each major product that 20%, plus real depth on the three things that hurt people: security rules, billing, and lock-in. Tags used below: [consensus] widely agreed, [depends] context-dependent, [fast-moving] verify before relying on it, [unsure] not confident. Where I checked a fact against Google's docs on 2026-11-23 I say so; prices and quotas change, so treat every number as a snapshot.

## 1. The problem this exists to solve (story)

You have built a model, or a small tool, and a handful of people want to use it from their phones. You are a data scientist. You can train the model; you have never run a login system, a database that thousands of phones talk to, a push service, or a crash reporter.

You write the obvious thing: a FastAPI service with a users table. Then the list grows. Password reset emails. Social login. Sessions that expire. A database exposed to the internet. Notifications when a job finishes. File uploads. A way to see why the app crashes on one particular phone. Each piece is a week of unglamorous work that is not your product, and each is a place to leak user data if you get it wrong.

Firebase is Google's answer for this exact gap: a bundle of **managed backend services**, each solving one of those chores, that the app talks to directly through ready-made SDKs. You trade control and portability for speed and a much smaller operations burden.

## 2. The core idea in plain words

**Firebase is a catalogue of separable managed services under one project.** Sign-in, a database, file storage, serverless functions, hosting, push, analytics and crash reporting are different products. You can use one and ignore the rest.

**Its signature move is that the client talks to the services directly.** In the classic setup there is no server you write between the app and the database. The phone reads and writes Firestore itself, and a small policy language called **security rules** decides, per request, what each signed-in user may touch. That removes the backend, and it also moves your entire authorization layer into a rules file.

```
 Classic                               Firebase (direct-to-service)
 ───────                               ────────────────────────────
 App ─► Your API ─► Your DB            App ─► Auth    (who are you?)
        (you write auth,                App ─► Firestore (reads/writes, checked by rules)
         validation, scaling)           App ─► Storage / Functions / FCM ...
                                        (Google runs and scales them)
```

Hold on to three facts: (1) services are separable, so adopt only what you need; (2) with direct access, **the rules are your security**, not an afterthought; (3) every product has a billing model, and the database bills per operation, so usage patterns become cost.

## 3. The 20% that gets used 80% of the time

**Concept: project, apps and plans.** A Firebase **project** is a Google Cloud project with Firebase turned on. You register one or more **apps** (Android, iOS, web) in it and get a config file (`google-services.json` for Android) that identifies your app to Google. There are two pricing plans: **Spark** (no cost, with free usage quotas) and **Blaze** (pay as you go, a billing account attached). Some products need Blaze (Cloud Functions does) and some are free on both (Analytics, Crashlytics, App Check, Cloud Messaging, A/B Testing, Performance Monitoring). [consensus, fast-moving; checked 2026-11-23] The config file is not a secret: it names your project, it does not grant access. The rules and App Check are what protect you.

**Concept: Firebase Authentication.** Managed sign-in: email and password, phone (SMS), Google, Apple and other providers, anonymous accounts. The client SDK signs the user in and gets an **ID token**, a short-lived signed JWT that proves who they are. Your own backend can verify that token with the Admin SDK, so a Firebase login can sit in front of your existing API. [consensus]

```python
# pip install firebase-admin   (needs a service-account key / project, not runnable standalone)
import firebase_admin
from fastapi import Depends, FastAPI, Header, HTTPException
from firebase_admin import auth

firebase_admin.initialize_app()  # picks up credentials from the environment
app = FastAPI()

def current_uid(authorization: str = Header(...)) -> str:
    try:
        token = authorization.removeprefix("Bearer ")
        return auth.verify_id_token(token, check_revoked=True)["uid"]
    except Exception:
        raise HTTPException(status_code=401, detail="invalid token")

@app.get("/me")
def me(uid: str = Depends(current_uid)):
    return {"uid": uid}
```

`check_revoked=True` costs an extra lookup but catches tokens revoked after a password change or sign-out; the default is off. Phone sign-in sends SMS, which is billed and abused by bots, so it needs App Check and limits. [fast-moving]

**Concept: Cloud Firestore.** A managed **document database**. Data lives in *documents* (a bag of fields, up to about 1 MiB) grouped into *collections*, and documents can contain sub-collections. Its two selling points are **real-time listeners** (the app is notified when data changes) and **offline support** (mobile and web SDKs cache locally and sync later). [consensus; 1 MiB document limit checked 2026-11-23]

What it is *not*: a relational database. There are no joins. You design collections around the queries you will run, duplicating data where needed. Every query uses an index, and queries on several fields need a composite index you define. Firestore also now comes in more than one **edition** with different limits and a MongoDB-compatible option [fast-moving, unsure of details], so read the current edition docs before you plan.

**Concept: billing by operation.** Firestore charges per document read, write and delete, plus storage and network. On the free tier the standard edition allowed 50,000 reads, 20,000 writes and 20,000 deletes per day [checked 2026-11-23, fast-moving]. The consequence is the one thing to internalise: **a screen that listens to a 500-document query costs 500 reads every time it loads**, and a bug that loops costs money fast. Estimate before you build:

```python
def monthly_reads(users: int, opens_per_day: int, docs_per_open: int, days: int = 30) -> int:
    return users * opens_per_day * docs_per_open * days

reads = monthly_reads(users=2_000, opens_per_day=4, docs_per_open=100)
price_per_100k = 0.06  # PLACEHOLDER: look up the current price for your region
print(f"{reads:,} reads/month, about ${reads / 100_000 * price_per_100k:,.2f} at ${price_per_100k}/100k")
```

The price here is a placeholder, not a quote. The shape of the maths (users x opens x documents) is the part that carries over. Free quota amounts differ by plan and edition.

**Concept: Security Rules.** A small declarative language, evaluated by Google on every client request, that decides who may read or write what. This is the heart of Firebase's risk. Rules see `request.auth` (the signed-in user), the incoming data (`request.resource`) and the existing data (`resource`).

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /notes/{noteId} {
      allow read, update, delete: if request.auth != null
                                  && request.auth.uid == resource.data.owner;
      allow create: if request.auth != null
                    && request.resource.data.owner == request.auth.uid;
    }
  }
}
```

Note `create` is separate: on a brand-new document `resource` is null, so a combined rule fails. The dangerous opposite is the "test mode" rule `allow read, write: if true;`, which makes your database public. Project templates often start there, and teams ship it. Rules are not a filter either: a query must be provably allowed by the rules or the whole query is rejected, so rules and queries are designed together. [consensus]

**Concept: modelling for the query.** Because there are no joins, you decide the screens first and shape the documents to serve them. Take "show my last 20 orders with the product name". The relational habit is `orders` joined to `products`. In Firestore you copy the product name and the price paid *into the order document*. It is not just a speed trick: it is also correct, because an order should keep the price at purchase time even if the product changes later.

```python
# needs initialize_app() and a project (or the emulator)
from firebase_admin import firestore

db = firestore.client()

def last_orders(uid: str, n: int = 20) -> list[dict]:
    q = (db.collection("orders")
           .where("uid", "==", uid)                                    # filter on one field ...
           .order_by("created", direction=firestore.Query.DESCENDING)  # ... sort on another: needs a composite index
           .limit(n))                                                  # always cap what you read
    return [d.to_dict() for d in q.stream()]                           # n documents = n billed reads
```

The first time this runs without its composite index the call fails with an error that links straight to creating it. Two habits pay off: always `limit`, and store what the screen needs in the document it reads. The cost of denormalising is on the write side: renaming a product means updating every order copy you decided to keep in sync.

**Concept: rules gotchas.** Four facts that surprise people. (1) **Rules are not filters**: a query is allowed only if the rules would allow *every* document it could return, so a query for "all notes" is rejected even if you only own some; query by `owner == uid` instead. (2) **Rules do not cascade**: allowing a collection does not allow its sub-collections, which need their own `match`. (3) **The Admin SDK bypasses rules entirely**: server code with a service account has full access, which is why that key is so sensitive. [consensus] (4) Rules that look up other documents (`get()`, `exists()`) are convenient for roles and membership but add reads you pay for and make rules harder to reason about. [fast-moving, verify the billing detail] Test rules in the emulator with a small set of allowed and denied cases, the way you would unit-test a function.

**Concept: Firebase sits on Google Cloud.** A Firebase project *is* a Google Cloud project, so the same billing account, IAM roles, service accounts and logs apply, and you can mix in Cloud Run, BigQuery or Pub/Sub when you outgrow the Firebase wrappers. Upgrading to Blaze means linking a Cloud Billing account. This is both the escape hatch (you can grow into Google Cloud) and the reason bills and permissions can feel more complicated than "an app SDK" suggests. [consensus]

**Concept: Cloud Storage for Firebase.** User-uploaded files (images, audio, PDFs) stored in a Google Cloud Storage bucket, protected by its own rules language and signed-in identity. Use it for blobs, never as a database. On the day I checked, search results said it is available on Spark within a quota, but plan requirements for new buckets have changed before, so confirm at project creation. [fast-moving, unsure]

**Concept: Cloud Functions.** Serverless code (Node.js or Python) that runs on triggers: an HTTP request, a new Firestore document, a new user, a schedule. This is where trusted logic lives, because client code can be tampered with. It requires the Blaze plan [checked 2026-11-23]. The usual costs apply: cold starts (the first call after idle is slower), per-invocation billing, and debugging in a remote environment. If you already run a backend, you may not need it.

**Concept: Hosting.** Fast static hosting on a CDN with free HTTPS, and rewrites that can route paths to a function or container. Low lock-in: it serves files, and you can move them anywhere. There is also a newer **App Hosting** for server-rendered web frameworks [fast-moving].

**Concept: Cloud Messaging (FCM).** Free push notifications from your server to an app install. Your server hands Google a message for a *registration token* (one app install on one device); Google delivers it over the phone's shared connection and wakes the app. It only transports: you keep the user-to-token table, and delivery is best-effort. Two details cause most bugs: send **data messages** if you want your code to run in the background (notification messages are shown by the OS and skip your handler), and delete tokens that return `UNREGISTERED`.

```python
import datetime, sqlite3
from firebase_admin import messaging

db = sqlite3.connect("tokens.db")
db.execute("create table if not exists tokens(user text, token text primary key)")

def send_to_user(user: str, data: dict[str, str]) -> None:
    for (tok,) in db.execute("select token from tokens where user=?", (user,)).fetchall():
        try:
            messaging.send(messaging.Message(token=tok, data=data, android=messaging.AndroidConfig(
                priority="high", ttl=datetime.timedelta(minutes=2))))
        except messaging.UnregisteredError:
            db.execute("delete from tokens where token=?", (tok,)); db.commit()
```

(I ran this with `messaging.send` mocked: the dead token was deleted and the live one kept.) Heads-up [fast-moving]: in `firebase-admin` 7.8.0 `Message.token` raised a deprecation warning pointing to `fid` (a Firebase installation ID); I only built a message and did not send one, so read the current SDK docs. Use high priority and a short TTL for "ring now" messages, keep payloads small (about 4 KB, rule of thumb), put no secrets in them, and on Android 13+ the app needs the notification permission. A user does **not** need a Google login to receive FCM pushes; the token comes from the app's Firebase config. [consensus; not tested on a phone with no Google account]

**Concept: observability and growth.** Free on both plans [checked 2026-11-23]: **Crashlytics** (crash reports grouped by cause), **Analytics** (events and audiences, exportable to BigQuery, which is the natural bridge for a data scientist), **Remote Config** (change app behaviour or flags without a release), **A/B Testing**, **Performance Monitoring**, and **App Check**. App Check proves a request comes from your genuine app (Play Integrity, App Attest) and not a script; it is a layer on top of rules, not a replacement. [consensus]

**Concept: the Emulator Suite and the CLI.** `firebase-tools` runs local emulators for Auth, Firestore, Functions and more, so you can test rules and code without touching production or spending money. Test your rules in the emulator before every deploy; it is the cheapest insurance in the whole platform. [consensus]

## 4. When to use it, and when NOT to

**Use Firebase when:**
- You are a small team or one person and need auth, data and push this week, with no backend to run.
- The data is document-shaped and driven by the app (profiles, notes, chats, to-do lists), with few cross-document queries.
- You want real-time sync or offline support almost for free.
- Your users are mostly on mobile, where the SDKs are strongest.
- You want one free crash reporter and analytics source for a published app.

**Do NOT use Firebase (or not that part) when:**
- Your data is relational and you need joins, transactions across many rows, or ad-hoc SQL and reporting. Firestore will fight you; use Postgres.
- You already run a backend and database that work. Adding Firestore creates two sources of truth. Take only the leaf (push, Crashlytics, Hosting).
- You cannot accept vendor lock-in for the data layer, or need to self-host or meet a data-residency rule you cannot satisfy.
- Your read patterns are large and unpredictable, so per-operation billing is a risk you cannot cap.
- You need heavy server-side compute or ML serving. Run that on your own infrastructure or a dedicated service; Functions are for glue.

**Decision table**

| Option | Best when | Breaks when | Cost / complexity |
|---|---|---|---|
| Own backend (FastAPI + Postgres) | You want control, SQL, portability | You are one person who must also run it | Your time; hosting cost is small and predictable |
| **Firebase** | Small team, mobile app, no backend, real-time/offline | Relational data, huge or unpredictable reads, must stay portable | Free to start; database billed per operation; high lock-in on Firestore and Auth |
| Supabase (Postgres + auth + storage, open source) | You like Firebase's speed but want SQL and an exit | You need Firebase's mobile offline sync maturity | Hosted tiers, or self-host; lower lock-in [depends] |
| Appwrite / PocketBase (self-hosted) | You want to own the box; PocketBase is a single binary with SQLite | You cannot or will not operate a server | Free software; you run and patch it |
| Cloud-provider mobile backends (e.g. AWS Amplify) | You are already deep in that cloud | You want Firebase's polish and simple SDKs | Powerful but more moving parts |
| Do nothing new (keep your backend, add just FCM) | You have a working backend and need only push | You wanted a whole backend replaced | Near zero; the lowest lock-in |

**Worked decision: LevelUp.** The app already has a FastAPI backend, its own accounts (PBKDF2 hashes and sessions), progress stored per learner, and a tested merge for offline edits. Walking the catalogue: Authentication and Firestore would duplicate the accounts and the progress store and create a second source of truth, so skip them. Hosting is already covered by Caddy. FCM is the one thing the app lacks: nudges currently wait for a 15-minute poll. Verdict: adopt **only FCM** (the leaf), keep the user-to-token table in the existing backend, and revisit Crashlytics when there is a published app. This is the "do nothing new except push" row of the table, and it is the cheapest, lowest-lock-in answer.

## 5. Trade-offs and complexity

- **Speed versus control.** You skip building auth, storage and sync, and you accept Google's data model, limits and roadmap. Products get renamed, retired and re-tiered; Firebase has changed its offering many times. [consensus]
- **Lock-in is uneven.** Hosting and FCM are easy to leave. Firestore's document model and query limits, Authentication's user records, and rules logic are *your application*, written in Google's terms. Exporting data is possible; rewriting the query layer for a relational database is a project. [consensus]
- **Cost grows with usage, not with servers.** There are no servers to size, so the bill is per read, write, invocation and GB. It is cheap at small scale and can surprise at large scale or after a bug. Blaze has budget alerts, not a hard cap by default, so set alerts on day one. [consensus, fast-moving]
- **Security is your job, in a new language.** Rules replace the backend authorization code you would have written. They are short, easy to get subtly wrong, and invisible to casual review. [consensus]
- **Data modelling is denormalised.** Duplicating data speeds reads and makes updates and consistency harder. Plan for writes that fan out.
- **Limits shape design.** Documents are about 1 MiB, there is no join, there are index limits, and sustained writes to one document are rate-limited [unsure of the current figure, check the scale docs]. Hot documents (a global counter) need sharding.
- **Skills needed.** App developers like it. A data team used to SQL will find analysis awkward unless data is exported to BigQuery.
- **Privacy.** Tokens, analytics and your data live on Google's infrastructure. Choose the region deliberately (it is hard to change later) and check it against your obligations.

**Billing guardrails (do these on day one if you use Blaze).** Create a budget with alert thresholds in Google Cloud Billing, and know that alerts notify you rather than stop spending. Put `limit` on every query and avoid listeners on unbounded collections. Add App Check so scripts cannot hammer your database or your SMS sign-in. Watch the usage dashboard in the first week of any release. If you want a hard stop, you have to build one, for example a function that disables billing when a budget alert fires, which is advanced and carries its own risk of taking the app down. [consensus, fast-moving]

**Exit strategy (decide before you need it).** Firebase does let you leave, but not for free. You can export Firestore data to a bucket (and on to BigQuery), export user records with the CLI (`firebase auth:export`), and keep Cloud Storage files, which are ordinary Google Cloud Storage objects. The hard parts are yours to write: re-creating the query layer on a new database, rebuilding rules as backend authorization code, and handling password hashes, which use a Firebase-specific scrypt variant you must support or replace by forcing a reset. [consensus; verify the current export docs] A useful test before adopting any root product: "if I had to leave in six months, what would I rewrite?" If the answer is "everything", that is the lock-in price.

## 6. Pitfalls and failure modes

1. **Shipping open rules ("test mode").** *Symptom:* anyone with your app's public config can read or wipe the database; security researchers regularly find such databases exposed. *Fix:* start from deny-all, write per-collection rules, test them in the emulator, add App Check. [consensus]
2. **Treating the config file as a secret, or the opposite.** *Symptom:* either panic over `google-services.json` or false safety. *Fix:* it only identifies the project. Protection comes from rules and App Check. *Do* protect service-account keys, which grant admin power and must never be committed to git.
3. **A query that reads everything.** *Symptom:* a surprise bill; a screen opens and reads thousands of documents. *Fix:* paginate, add `limit`, avoid listeners on huge collections, estimate reads per screen, set budget alerts.
4. **Designing the data like SQL.** *Symptom:* you need a join and cannot do one. *Fix:* design collections around screens and queries, duplicate deliberately, or pick a relational backend.
5. **Trusting the client for rules of the game.** *Symptom:* users edit their own score, role or balance. *Fix:* keep authoritative values writable only by trusted code (a function or your backend through the Admin SDK), and make rules forbid client writes to those fields.
6. **Using notification messages and expecting code to run, or never deleting dead FCM tokens.** *Symptom:* works in the foreground, plain banner in the background; send errors and duplicates pile up. *Fix:* use data messages; delete tokens on `UNREGISTERED` and on logout; treat push as best-effort and keep the truth in your database.
7. **Adopting the whole platform when you needed one piece.** *Symptom:* two databases, two login systems, a migration nobody wants. *Fix:* choose per product; if you have a backend, take push and crash reporting only.
8. **Ignoring that phones and plans change.** *Symptom:* pushes never arrive on certain brands (aggressive battery managers), or a feature moves behind the paid plan. *Fix:* test on real devices, read plan requirements when you create the project, and re-check pricing before launch.

## 7. Deliberately left out

- **Realtime Database (the older JSON-tree database):** learn this when you need very low-latency presence or simple sync, or you inherit an app that uses it.
- **Firestore editions, MongoDB compatibility, advanced indexes and transactions:** learn this when you plan a non-trivial data model or migration.
- **Data Connect (Postgres on Cloud SQL, behind a typed API):** learn this when you want Firebase's SDK style but need relational data. [fast-moving]
- **Identity Platform, multi-tenancy, custom claims and blocking functions:** learn this when you need enterprise sign-in, roles or per-tenant isolation.
- **App Hosting and Cloud Run integration:** learn this when you host a server-rendered web app.
- **AI features (Firebase AI Logic, Genkit):** learn this when you call generative models from a client app; their naming and status move quickly. [fast-moving]
- **Test Lab, App Distribution, In-App Messaging, A/B testing details:** learn these when you run a release pipeline for a published app.
- **iOS push (APNs), full-screen call UI and always-on audio:** learn this when you build an iPhone app or real incoming-call screens.
- **Extensions and the Admin SDK in depth:** learn this when you automate or script your project.

## 8. Self-check (answer out loud, no peeking)

1. What problem does Firebase solve, and what does it make you give up?
2. Why do security rules matter more than in a normal backend design?
3. You need to show a user their last 20 orders with the product name from another collection. How does Firestore handle that, and what does it cost in reads?
4. Choose between Firebase, Supabase and your own FastAPI + Postgres for: (a) a mobile habit tracker for 500 friends, (b) an analytics-heavy internal tool with SQL reporting, (c) an existing backend that needs push notifications.
5. A teammate says "we sent a push notification but our handler never fires in the background." Why?
6. What goes wrong if you never delete `UNREGISTERED` tokens, or never set a budget alert?
7. Which Firebase products are hard to leave, which are easy, and why?
8. Does a user need a Google account to receive FCM pushes, and what does an ID token let your own backend do?

<details>
<summary>Answer key</summary>

1. It replaces the chores of a backend (login, database, storage, push, hosting, crash reports) with managed services you call directly. You give up control, portability and, for the database and login, an easy exit; you accept Google's data model, limits and pricing.
2. The client talks to the database directly, so rules are the only authorization layer. A missing or over-broad rule is a data leak, and rules are short, subtle and easy to skim past.
3. There are no joins. Either duplicate the product name into each order document, or fetch the 20 orders and then read each product (about 20 more reads, so ~40 total, and the extra round trips). Denormalising is the usual answer.
4. (a) Firebase fits: mobile, document-shaped, real-time or offline, small scale. (b) Supabase or Postgres: relational data and SQL reporting. (c) Keep your backend and add only FCM, the leaf, with no second database.
5. You sent a notification message, which the OS tray shows in the background without calling your handler. Send a data message and build the notification yourself.
6. Dead tokens pile up, fan-out slows, and you get errors and duplicates. With no budget alert, a bug or a heavy query can run up a bill unnoticed, because Blaze has no hard cap by default.
7. Hard: Firestore, Authentication, and the rules logic, because they are your data and identity in Google's terms. Easy: Hosting (static files) and FCM (a leaf), because swapping them touches only the sender or the deploy step.
8. No: the token comes from the app's Firebase config and Play Services (untested here without a signed-in Google account). An ID token is a signed JWT your backend can verify with the Admin SDK to learn which user is calling.

</details>

## 9. One-page cheat sheet

- **What it is:** Google's catalogue of managed app services (auth, Firestore, storage, functions, hosting, push, analytics, crash reporting) used directly from the app.
- **Use when:** small team, mobile app, document-shaped data, real-time or offline, no backend to run.
- **Avoid when:** relational data and SQL, an existing working backend, strict portability, unbounded or unpredictable reads.
- **Key terms:** project and Spark/Blaze; ID token; document and collection; security rules; registration token and data message; App Check; emulator.
- **Gotchas:**
  1. Never ship open (test-mode) rules.
  2. Estimate reads per screen; set budget alerts.
  3. No joins, so denormalise on purpose.
  4. Keep trusted values writable only by trusted code.
  5. Delete dead FCM tokens, push is best-effort, and keep service-account keys out of git.
- **Decision rule of thumb:** adopt the leaves (push, hosting, crash reporting) freely. Think hard before adopting the roots (Firestore and Authentication), because they become your application. If you already have a backend, take only what it lacks.

## 10. Further reading (ranked, max 4)

1. **Firebase documentation, firebase.google.com/docs** [skim, then deep dive on Authentication, Firestore security rules and Cloud Messaging]: the primary source. Check it for anything tagged fast-moving.
2. **Firebase pricing plans page, firebase.google.com/docs/projects/billing/firebase-pricing-plans** [skim]: the authoritative list of what needs the Blaze plan and what is free on both.
3. **Firestore quotas and limits, firebase.google.com/docs/firestore/quotas** [skim]: document size, index limits and the free quota, which shape the data model.
4. **Firebase Emulator Suite documentation, firebase.google.com/docs/emulator-suite** [deep dive]: how to test rules and functions locally before they cost money or leak data.

# Firebase (and Cloud Messaging push for an app with its own backend)
> Reading time: 30 min (~3,500 words) | Level: DS with 5 yrs | Takeaway: Firebase is Google's app-backend kit, but the one piece most small teams should adopt is FCM, the free pipe that lets your own server wake a closed phone. Use that, and think hard before buying into the rest.

**Budget:** 30 min. The topic is wide (a dozen products), but we only need judgment on the product map plus depth on one product (FCM), so I cut the rest hard. Tags used below: [consensus] widely agreed, [depends] context-dependent, [fast-moving] verify before relying on it, [unsure] not confident.

## 1. The problem this exists to solve (story)

You ship a small app with your own login and your own FastAPI backend. One feature needs to tell a user something *now*: a friend nudged you, a long job finished, a model drifted. The phone is in a pocket, the app is closed.

First attempt: the app polls `GET /api/nudges` every few minutes. It works, but Android will not let a background job run more often than about every 15 minutes, so "now" means "within a quarter of an hour". Second attempt: keep a socket open from a background service. That works until the OS, or the phone maker's battery saver, kills it, and every app doing this drains the battery.

Phones solved this by running **one** shared, OS-managed connection to a push gateway, and letting every app ride it. On Android, Google's gateway is **Firebase Cloud Messaging (FCM)**. It is part of **Firebase**, Google's bundle of app-backend services.

## 2. The core idea in plain words

**Firebase is a catalogue, not a single thing.** Google bundles a dozen services (auth, databases, hosting, analytics, push...) under one console. They are separable: you can adopt one and ignore the rest. Most of the confusion about "using Firebase" comes from forgetting this.

**FCM is a mailbox service with a courier you do not control.** Your server hands FCM a message addressed to one app install. Google's courier delivers it over the phone's already-open connection, wakes your app for a few seconds, and your code decides what to show.

```
 Your server (FastAPI)                 Google                    Phone
 ─────────────────────        ─────────────────────      ──────────────────
 "user bob → token T9"  ───►  FCM gateway           ───►  Play Services (one shared
  POST messages:send          (stores it, retries)         always-on connection)
                                                              │
                                                              ▼
                                                        your app wakes: onMessageReceived()
                                                        → shows notification / rings
```

Two facts to hold on to: (1) FCM only **transports**; your accounts, rules and data stay in your own backend. (2) Delivery is **best-effort**, not guaranteed. Design as if a message can be late or lost.

## 3. The 20% that gets used 80% of the time

**Concept: registration token.** An opaque string identifying *one app install on one device*. The app asks the Firebase SDK for it and uploads it to your server along with the logged-in user id. It is not a user id: one user can have several tokens, and a token can change. [consensus]

**Concept: your server holds the mapping.** Firebase never learns your usernames. You keep a table `user → tokens`, add on login, delete on logout. This is also why the user does *not* need a Google login: the token comes from the app's embedded Firebase config, not from a signed-in Google account. [consensus] (Confirm on a phone with no Google account signed in; I did not test that.)

**Concept: send through the HTTP v1 API with a service account.** Your server authenticates with a Google *service-account key* (a JSON file) and calls the v1 endpoint, directly or via the `firebase-admin` SDK. The older "legacy" server-key API was shut down. [fast-moving]

```python
# pip install firebase-admin   (needs a real service-account key, so not runnable without one)
import datetime
import firebase_admin
from firebase_admin import credentials, messaging

firebase_admin.initialize_app(credentials.Certificate("service-account.json"))

def ring(token: str, from_name: str, gate_id: str) -> str:
    msg = messaging.Message(
        token=token,
        data={"type": "nudge", "from": from_name, "gate": gate_id},  # values must be strings
        android=messaging.AndroidConfig(priority="high", ttl=datetime.timedelta(minutes=2)),
    )
    return messaging.send(msg)  # message id on success, raises on failure
```

Heads-up [fast-moving]: running `firebase-admin` 7.8.0 I saw a `DeprecationWarning` saying `Message.token` is deprecated in favour of `Message.fid` (a Firebase installation ID). I only constructed a message, I did not send one, so read the current SDK docs before wiring this in.

**Concept: notification message vs data message.** The most important distinction in FCM.

| Type | Who shows it | When your app code runs | Use for |
|---|---|---|---|
| **Notification** message | The OS tray, automatically | Only if the app is in the foreground | Simple "you have news" banners |
| **Data** message | Nobody; your app decides | Always (even in background), for a short window | Custom UI, ringing, silent sync, rate-limiting logic |

A data message gives you control and a small amount of code; a notification message is zero code but you lose control when the app is backgrounded. [consensus]

**Concept: priority and TTL.** `high` priority can wake a phone in Doze (battery-saving idle) and is what you want for "ring now"; `normal` is batched to save power. **TTL** (time to live) is how long FCM keeps trying; a stale "ring" is useless, so set minutes, not the default of up to 4 weeks. [fast-moving] Android may *demote* repeated high-priority messages that don't produce something the user sees. [consensus]

**Concept: stale tokens are normal; clean them.** Tokens change (reinstall, restore to a new phone, cleared data, long inactivity). FCM tells you with an `UNREGISTERED` error (`UnregisteredError` in the SDK) when a token is dead. Delete it, or your fan-out slows and wastes quota forever.

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

(I ran this with `messaging.send` mocked: the dead token is removed, the good one stays.)

**Concept: topics and device groups.** Send once to a named topic ("everyone in party 7") and FCM fans out. Convenient for broadcasts, but you lose per-user control and it is awkward when membership must be exactly right. For small apps, sending per token from your own table is simpler and safer. [depends]

**Concept: payload limit.** About 4 KB per message [rule of thumb, verify in current docs]. Send an id and a short label, let the app fetch details from your server. Never send secrets.

**Concept: Android 13+ notification permission.** The app must ask for `POST_NOTIFICATIONS`. No permission, no visible notification, regardless of how well FCM delivers.

## 4. When to use it, and when NOT to

**Use FCM when:**
- You need to reach a user whose app is closed, within seconds.
- Your backend already exists; you only want the delivery pipe.
- Android is your main platform (it is the native route; Play Services is the carrier).
- Message volume is small to moderate and the content is not highly sensitive.
- You can accept best-effort delivery.

**Do NOT use FCM (or not alone) when:**
- Users are on phones without Google Play Services (some Chinese-market devices, de-Googled ROMs). Needs another route.
- Delivery must be guaranteed or auditable (payments, safety alerts). Use SMS, or an in-app inbox as the source of truth, with push only as the "go look" signal.
- The message body is private and you do not want it passing through Google. Send "you have a message" and fetch the content over your own TLS connection.
- You want a true real-time audio stream or live state. Push only *wakes* the app; the live part needs a socket or WebRTC after it wakes.
- Your whole audience is the web, and a browser notification is enough (see Web Push below).

**Decision table**

| Option | Best when | Breaks when | Cost / complexity |
|---|---|---|---|
| Polling (do nothing special) | Seconds do not matter; a few users | You want sub-minute latency; Android caps background work ~15 min | Free, trivial |
| **FCM** | Android/native app, own backend, wake the app | No Play Services; guaranteed delivery needed | Free pipe; Firebase project + SDK + key handling |
| Web Push (VAPID, browser standard) | Web/PWA users, no Google account | Browser closed or suspended; weaker on iOS/Android background; cannot show a full-screen call UI | Free; you manage keys + subscriptions |
| Own foreground service + socket | Walkie-talkie style always-on | Battery, OS kills, maker battery savers | Free; most native code and testing |
| Self-hosted push (e.g. UnifiedPush, ntfy) | No-Google, privacy-first audiences | Users must install a distributor app | Free; you run a server |
| Hosted wrapper (OneSignal and similar) | Marketing pushes, dashboards, segments | You want control or zero third-party data | Free tier then paid [fast-moving]; still rides FCM on Android |

## 5. Trade-offs and complexity

- **Pricing:** FCM itself is free, with no per-message charge, and is available on the no-cost Spark plan. [consensus, fast-moving: check Firebase's pricing page]. Other Firebase products (databases, functions, storage, SMS-based phone auth) are where bills appear, and some require the pay-as-you-go Blaze plan with a card on file. If your server sends the pushes and you use none of those, you pay nothing.
- **Lock-in is low for push, high for the rest.** Push is a leaf: swapping FCM later means changing the sender and the client registration. Firestore, Realtime Database and Firebase Auth *are* your data and identity layer; migrating those is a real project. [consensus]
- **Privacy:** token and payload transit Google's infrastructure. Treat it as a postal service that can read postcards.
- **Operational burden:** a service-account key to protect and rotate, a token table, stale-token cleanup, handling for permission-denied users. A day of work for a first integration, then low maintenance. [rule of thumb]
- **The hidden tax is the phone, not Google.** Aggressive battery managers on some phone brands delay or drop pushes for apps that are not whitelisted. You cannot fix this server-side. [consensus]
- **Doze and priority:** use high priority sparingly; abuse gets you throttled.
- **Calls and always-on audio add Android rules** (full-screen intent permission, foreground service types, limits on starting the microphone from the background) that tighten with each Android version. Ringing via a high-priority push is the standard pattern, but starting mic capture from the background is restricted, so the user usually taps to answer and the app comes to the front first. [fast-moving, verify on your target Android versions]

## 6. Pitfalls and failure modes

1. **Using notification messages and expecting your code to run.** *Symptom:* works in the foreground, a plain banner appears in background with none of your logic. *Fix:* send data messages and build the notification yourself.
2. **Never deleting dead tokens.** *Symptom:* sends slow down, error logs fill with `UNREGISTERED`, some users receive duplicates (old and new install). *Fix:* delete on that error; also drop tokens on logout.
3. **Treating FCM as guaranteed.** *Symptom:* "I never got it" reports with no trace. *Fix:* keep the truth in your backend (an inbox or unseen list the app also reads on open); push only prompts a look.
4. **Committing the service-account key.** *Symptom:* a leaked key lets anyone send pushes as you and use that project. *Fix:* keep it out of git, load from an env var or a root-only file, rotate if exposed.
5. **Long TTL on time-sensitive messages.** *Symptom:* a "ring" arrives hours later when the phone reconnects. *Fix:* set TTL to what the message is worth (minutes).
6. **Forgetting the notification permission and token refresh.** *Symptom:* new Android users get nothing; tokens in your table go stale silently. *Fix:* ask for `POST_NOTIFICATIONS` at a sensible moment; re-upload the token whenever the SDK reports a new one and on each login.
7. **Stuffing private data or large blobs in the payload.** *Symptom:* hits the size cap or leaks content to a third party. *Fix:* send ids; fetch details over your own API.

## 7. Deliberately left out

- **Firestore / Realtime Database:** learn this when you want a managed database with live listeners and are happy to lock into it.
- **Firebase Authentication:** learn this when you have no accounts system and want social/phone sign-in handled for you.
- **Cloud Functions and Hosting:** learn this when you want serverless endpoints without running your own server (pay-as-you-go).
- **Crashlytics, Analytics, Remote Config, App Check:** learn these when you need crash reports, usage data, feature flags, or abuse protection on a published app.
- **iOS and APNs setup:** learn this when you build an iPhone app; FCM can route to Apple's push service but needs an Apple developer account.
- **Topics at scale, analytics labels, delivery reports:** learn this when you send broadcast campaigns.
- **Full-screen call UI and ConnectionService:** learn this when you build real incoming-call screens.

## 8. Self-check (answer out loud, no peeking)

1. Why can a closed app receive a push, when it cannot poll more often than every ~15 minutes?
2. What is a registration token, and why is it not a user id?
3. A teammate says "we sent a notification message but our `onMessageReceived` never fires in the background". Why?
4. Choose: Web Push, FCM, or a foreground-service socket, for (a) "your report is ready", (b) a walkie-talkie, (c) a PWA with no native app.
5. What goes wrong if you never handle `UNREGISTERED`?
6. Your payments app wants push for fraud alerts. What is the right architecture?
7. Does the user need a Google account to receive FCM pushes? What did you *not* verify?
8. What does using FCM commit you to, and what does it not (compare with adopting Firestore)?

<details>
<summary>Answer key</summary>

1. The phone keeps one shared, OS-managed connection to Google; FCM sends down it and Android wakes your app on arrival. Polling is your app's own scheduled work, which the OS rate-limits.
2. An opaque identifier for one app install on one device. A user may have several, tokens change, and Firebase never knows your user ids; your server stores the mapping.
3. Notification messages are shown by the OS tray when the app is backgrounded and do not invoke your handler; only data messages do.
4. (a) FCM or even plain email; best-effort is fine. (b) Foreground-service socket for the live audio, with FCM as the wake-up. (c) Web Push.
5. Dead tokens accumulate, fan-out slows, errors pile up, and users with old and new installs may get duplicates.
6. Keep the alert in your own backend (inbox/SMS/email as the source of truth); push is only a "check the app" signal with no sensitive content.
7. No, not for current Android; the token comes from the app's Firebase config and Play Services. Untested here on a phone with no Google account signed in.
8. FCM commits you to a sender, a token table and Google as a transport. It does not touch your data or identity, so it is easy to remove. Firestore or Firebase Auth would own your data or logins.

</details>

## 9. One-page cheat sheet

- **What it is:** Firebase = Google's bundle of app services. FCM = free push transport from your server to an app install.
- **Use when:** you need to wake a closed Android app quickly and you already run your own backend.
- **Avoid when:** no Play Services, guaranteed delivery needed, private payloads, or you need live streams (push only wakes).
- **Key terms:** registration token; data vs notification message; priority and TTL; service account (HTTP v1); `UNREGISTERED`.
- **Gotchas:**
  1. Use data messages for control.
  2. Delete dead tokens.
  3. Push is best-effort; keep truth in your DB.
  4. Keep the service-account key out of git.
  5. Short TTL for time-sensitive messages; ask for notification permission.
- **Rule of thumb:** adopt FCM (the leaf), and think carefully before adopting Firebase's data and identity products (the roots). Push says "look now"; your backend says what.

## 10. Further reading (ranked, max 4)

1. **Firebase Cloud Messaging documentation, firebase.google.com/docs/cloud-messaging** [skim, then deep dive on "Android client" and "Send messages"]: the primary source for message types, priority, TTL and the HTTP v1 API; check it for the current state of anything tagged [fast-moving].
2. **Firebase pricing page, firebase.google.com/pricing** [skim]: the authoritative answer on what is free on Spark and what needs Blaze.
3. **Android developer docs: "Doze and App Standby" and background-work limits, developer.android.com** [deep dive]: explains why high priority exists and why background work is restricted.
4. **dontkillmyapp.com** [skim]: a community-maintained list of phone-maker battery behaviours that delay pushes, useful for diagnosing "it works on my phone".

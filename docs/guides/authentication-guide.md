# Authentication and User Accounts: A Practical Guide

_Saved from the Claude document https://claude.ai/artifact/AP1nRHpLDy4WKjhsLFwYDj on 2026-11-15 (revision 16). Source chapters: content/se/auth/*.md._

## How to use this guide

This guide is for a developer who can build a web app and now has to decide how people log in, stay logged in, get back in after forgetting a password, and what each person may see. It assumes Python, HTTP, and the basics of salted hashing and session cookies, but no prior auth design experience.

The running example is Rankwise, a plain-JavaScript progressive web app (PWA) served by FastAPI on a Mac over home Wi-Fi, with two learners, Taha and Batul, today and perhaps thousands of public users later. Most auth decisions differ between those two worlds; the guide shows how to reason about both. Each chapter ends with pitfalls, a decision guide and key takeaways; code is Python 3.10+, and anything labelled "the wrong way" is followed by the fix.

### Reading map

| Chapter | What you will learn | Minutes |
|---|---|---|
| 1. The mental model | The vocabulary, the account lifecycle, threat modelling, trust boundaries, recurring principles | 10 |
| 2. Storing passwords | Argon2id, salts, peppers, parameters, rehashing, migration, NIST password policy, breached-password checks | 15 |
| 3. The login flow end to end | Users table, sign-up, login, logout, enumeration, rate limiting, logging, a complete FastAPI example | 18 |
| 4. Sessions and tokens | Server-side sessions, cookie attributes, CSRF, XSS, JWT, refresh rotation, when to use which | 20 |
| 5. Forgot password and account recovery | Reset tokens done right, email verification, magic links, recovery codes, recovery without email | 13 |
| 6. Other ways to log in | OAuth 2.0 and OpenID Connect, Google sign-in, passkeys, TOTP, PINs | 17 |
| 7. Authorisation | Ownership checks, IDOR, RBAC/ABAC/ReBAC, policy functions, admin impersonation, row-level security | 12 |
| 8. Build vs buy | DIY versus Supabase, Firebase, Auth0, Clerk, Cognito, Keycloak, and a decision framework | 13 |
| 9. What can go wrong | Over 20 failure scenarios and an incident response checklist | 15 |
| 10. Scaling and operations | Cost model, capacity numbers, multi-server sessions, secret rotation, monitoring, GDPR, testing | 12 |
| 11. Worked design: Rankwise | A two-phase design for the example app, with data model, endpoints and plan | 12 |
| 12. Self-check, glossary and further reading | Questions with answers, 40+ terms, authoritative sources | 10 |

Total: roughly two and a half to three hours at a steady pace.

### Suggested paths

**"I need to ship login this week."** Read chapter 2 (sections on Argon2id and password policy), chapter 3 in full, chapter 4 up to and including CSRF, and chapter 7's section on ownership checks. Then skim the catalogue in chapter 9. About an hour.

**"I want to design auth systems myself."** Read everything in order. Chapters 1, 4, 6 and 8 hold most of the judgement. Finish with the self-check in chapter 12.

**"I am deciding whether to use a hosted provider."** Read chapter 1, chapter 8, then chapter 11's phase 2. Then chapters 4 and 7: a provider handles login, not your API's sessions and authorisation.

**"I only care about Rankwise."** Read chapter 11 first and follow its cross-references.

### What you will be able to do afterwards

- Explain why an auth design is safe or unsafe, and what it defends against.
- Implement password login, server-side sessions, password reset and ownership checks in FastAPI without copying code you do not understand.
- Choose between sessions and JWTs, building and buying, and passwords, passkeys and social login, based on your conditions.
- Spot common failures in review, and know what to do in the first hour of an incident.


## 1. The mental model

Before writing any code, you need a precise vocabulary. Most auth bugs are not clever cryptographic breaks. They come from mixing up two of the ideas below, for example treating "the request says it is user 7" (a claim) as "this is user 7" (an authenticated fact).

### Five ideas that are easy to blur

#### Identity

An **identity** is the record that represents one person or thing inside your system: a row in a users table with a stable, internal ID. The identity is not the email address or the username. Those are **identifiers**: labels a person can use to point at their identity. Identifiers can change (a new email) while the identity stays the same.

Keep a separate, never-reused internal ID (an integer or a random UUID). Every other table should reference that ID, not the email. This makes email changes, account merging and erasure much simpler.

#### Authentication

**Authentication** (often shortened to "authn") is proving that the person making a request really is the holder of a given identity. You do this with one or more **authenticators**, also called factors:

- Something you know: a password or PIN.
- Something you have: a phone with an authenticator app, a security key, a device holding a passkey.
- Something you are: a fingerprint or face, almost always used to unlock a "something you have" device rather than sent to your server.

Using two different kinds is **multi-factor authentication** (MFA). Two passwords are not MFA, because one attacker technique (phishing or a database leak) defeats both.

#### Authorisation

**Authorisation** ("authz") is deciding what an authenticated identity may do. "Batul is logged in" is authentication. "Batul may read Batul's progress but not Taha's" is authorisation. Authentication answers *who*; authorisation answers *may they*.

A system can authenticate perfectly and still leak everything if it forgets to authorise. Chapter 7 is entirely about this, because it is the most common serious bug in real APIs.

#### Session

Authentication is expensive and annoying, so you do it once and then remember the result. A **session** is that memory: a server-side record (or a signed token) saying "requests carrying this secret belong to identity 7 until this time." The secret the browser holds is a **session token** or **session ID**, usually stored in a cookie.

The session is now as valuable as the password. Anyone who steals the session token can act as the user until it expires, without ever knowing the password. Chapter 4 covers how to protect it.

#### Recovery

**Account recovery** is how someone regains access when they lose their authenticator: forgotten password, lost phone, new device. Recovery is a second way in, so it is also a second way for an attacker to get in. A system is only as strong as its weakest recovery path. Chapter 5 covers this.

| Concept | Question it answers | Typical artefact | Main risk if wrong |
|---|---|---|---|
| Identity | Which account is this? | users.id | Duplicate or merged accounts |
| Authentication | Is this really them? | Password hash, passkey public key | Account takeover |
| Session | Are they still the same person as earlier? | Session cookie, token | Session hijacking |
| Authorisation | May they do this? | Role, ownership, policy | Data leaks between users |
| Recovery | How do they get back in? | Reset token, recovery code | Takeover through the back door |

### The lifecycle of an account

Every account moves through a predictable sequence. Designing auth means deciding what happens at each step and who can trigger it.

1. **Registration.** Someone creates an account. You choose identifiers, collect an initial authenticator, and decide whether the account is usable immediately or only after verification.
2. **Verification.** You confirm that the person controls the identifier they gave (for example, by clicking a link sent to an email address). Unverified identifiers should not be trusted for recovery or for linking accounts.
3. **Authentication.** The person logs in, and you create a session.
4. **Use.** Each request carries the session token; your server looks up the identity and checks authorisation.
5. **Change.** The person changes password, email, or adds a second factor. Sensitive changes should require re-authentication ("enter your current password") because a stolen session should not be enough to lock the real owner out.
6. **Recovery.** The person loses an authenticator and proves their identity some other way.
7. **Suspension.** An admin or automated system disables the account temporarily.
8. **Deletion.** The account and its personal data are removed, subject to legal retention rules.

A useful exercise for any design: walk an attacker through each step and ask "what is the cheapest way to get through this step as somebody else?"

### Threat modelling basics

**Threat modelling** is the structured habit of asking: what are we protecting, from whom, and how might they get it? You do not need a formal methodology for a small app. You need to answer four questions honestly.

#### What are we protecting?

List your assets. For Rankwise: each learner's progress, the ability to change it, the users list, and later email addresses and possibly payment data. Also list things that are not data: the server's availability, and your reputation.

Not all assets are equal. A family German-learning app's progress data is low sensitivity, but people reuse passwords, so the **password** a user types into your app may be the same as their email or bank password. That makes password handling high stakes even when the app's own data is not.

#### Who attacks?

| Attacker | Capability | Typical goal |
|---|---|---|
| Automated bots | Huge lists of leaked email/password pairs, many IP addresses | Find accounts where reused passwords work, resell them |
| Opportunistic attacker | Scanners, public exploit kits | Any vulnerable server, any data |
| Targeted attacker | Time, research, phishing, social engineering | One specific account |
| Someone on the same network | Can see or alter unencrypted traffic | Read cookies and passwords on plain HTTP |
| Insider | Legitimate access to servers, database or admin tools | Curiosity, revenge, profit |
| A curious family member | Physical access to a shared device | Look at or change someone else's progress |

For a home LAN app, the last two rows and "someone on the same network" matter most. For a public app, bots matter most, because they attack every site on the internet all the time.

#### Online versus offline attacks

This distinction drives most password-storage decisions.

- An **online attack** happens against your live login endpoint. The attacker sends guesses and your server answers. You control the speed: rate limiting, delays and lockouts all work.
- An **offline attack** happens after the attacker has obtained your password hashes (from a database leak or a backup). They guess on their own hardware, as fast as it allows, and you cannot slow them down. Only the cost of the hash function protects users now.

That is why you need both rate limiting (against online attacks) and slow hashing (against offline attacks). Neither replaces the other.

#### What can the attacker do?

Be explicit about capabilities, because each one implies a defence:

- Can read network traffic: you need HTTPS.
- Can run JavaScript in your page (cross-site scripting, XSS): tokens readable by JavaScript can be stolen.
- Can make a victim's browser send requests to your site (cross-site request forgery, CSRF): cookie-based sessions need protection.
- Can read your database: hashes must be slow, and tokens should be stored hashed.
- Can read your logs or backups: these must never contain secrets.
- Can trick a support person: recovery procedures need rules that staff follow.

### Trust boundaries: never trust the client

A **trust boundary** is a line where data passes from something you do not control to something you do. The most important one in a web app is between the browser and your server.

Everything that arrives from the browser is a claim, not a fact. That includes form fields, JSON bodies, URL paths, query strings, headers, cookies, and hidden fields. A user can change all of them with the browser's developer tools or a tool like curl. Your PWA's JavaScript runs on the user's device, so it is part of the client, too.

Practical consequences:

- If the URL says `/api/state/taha`, that is the client asking for Taha's state. Whether the requester *is* Taha must come from the session, which the server looked up itself.
- Hiding a button in the UI is not access control. The API must enforce the rule.
- Client-side validation is for user experience. The server repeats every check that matters.
- The client never decides its own role. "isAdmin: true" in a request body or in localStorage means nothing.

The rule of thumb: **the server derives identity from a secret it can verify (the session) and derives permissions from its own data**. Nothing else.

### Principles that recur through this guide

#### Defence in depth

Assume any single control can fail, and layer several so that one failure is not a catastrophe. Example: passwords are hashed with Argon2id (layer 1), with a pepper kept outside the database (layer 2), behind an API with rate limiting (layer 3), with breached-password checks so the weakest passwords never exist (layer 4).

#### Least privilege

Give each person, process and key only the access it needs. The web server's database user does not need permission to drop tables. A learner account does not need the admin role. A support tool does not need to see password hashes. When something is compromised, least privilege limits how far the damage spreads.

#### Fail closed

When something unexpected happens, deny access rather than allow it. If the session store is unreachable, return an error, do not treat the user as logged in. If a token fails to parse, reject it. If a policy function raises an exception, the answer is "no."

Here is the wrong way and the fix:

```python
# WRONG: fails open. Any error in the check grants access.
def can_edit(user, doc) -> bool:
    try:
        return doc.owner_id == user.id or user.role == "admin"
    except Exception:
        return True   # "don't break the app"

# RIGHT: fails closed. Errors deny, and are visible in logs.
def can_edit(user, doc) -> bool:
    if user is None or doc is None:
        return False
    return doc.owner_id == user.id or user.role == "admin"
```

#### Secure defaults

The easy path should be the safe path. New endpoints should require login unless explicitly marked public. New cookies should be HttpOnly and Secure unless there is a reason not to. New users should get the lowest role. If someone forgets to think, the system should still be safe.

#### Keep it simple and use proven components

Auth code is unusually unforgiving: a single missing check is a breach. Fewer moving parts means fewer places to forget a check. Use well-reviewed libraries for cryptography (argon2-cffi, PyJWT, `secrets`) and never invent your own hashing, token format or encryption.

### Rules of thumb

- Separate identity (internal ID) from identifiers (email, username).
- Every request is anonymous until the server verifies a session token it issued.
- Every data access asks two questions: who is this, and may they do this?
- Design recovery with the same care as login. It is another front door.
- Write down your attackers and their capabilities, even as five bullet points. It turns vague worry into a checklist.

### Key takeaways

- Authentication proves who someone is; authorisation decides what they may do; a session remembers the authentication; recovery is a second way in.
- Online attacks are stopped by rate limiting; offline attacks (after a leak) are slowed only by slow hashing. You need both.
- The client is untrusted. Identity comes from the server-verified session, permissions from server-side data.
- Defence in depth, least privilege, fail closed and secure defaults are the lenses for every later decision.
- Most real-world auth failures are missing checks, not broken cryptography.


## 2. Storing passwords

Your database will leak one day. That might happen through a SQL injection bug, a stolen laptop, a misconfigured backup bucket or a disgruntled insider. The goal of password storage is simple to state: **when the database leaks, attackers should still be unable to recover most users' passwords in any useful amount of time.** This chapter explains how to get there and why each piece is needed.

### Why the obvious approaches are wrong

#### Plaintext

Storing the password as typed means a leak exposes every password immediately. Because people reuse passwords, you have also leaked access to their email, shopping and bank accounts. There is no situation where this is acceptable.

#### Encryption

Encryption is reversible by design: whoever has the key can decrypt. The key has to live on the server so the app can check logins, so an attacker who gets the database often gets the key too. Even if they do not, insiders with key access can read every password. You never need to know a user's password, only whether a new attempt matches. That is a job for a one-way function, not encryption.

#### Fast hashes (MD5, SHA-1, SHA-256)

A **hash function** turns any input into a fixed-size output (the digest), and you cannot run it backwards. That sounds perfect, but general-purpose hashes like SHA-256 are designed to be *fast*. A single modern graphics card can compute many billions of SHA-256 hashes per second. An attacker with a leaked list of SHA-256 password hashes can try every common password, every dictionary word with variations, and every short random string very quickly.

Fast is good for checking file integrity. For passwords, fast is the enemy.

### Salts

If two users choose the same password and you hash it the same way, they get the same hash. An attacker can then crack both at once, and can use **rainbow tables** (precomputed tables mapping hashes back to passwords).

A **salt** is a random value, unique per password, stored next to the hash and mixed into it. With a salt:

- Identical passwords produce different hashes.
- Precomputed tables are useless, because the attacker would need a table per salt.
- The attacker must attack each user's hash separately.

A salt is not secret. Its job is uniqueness, not secrecy. Sixteen random bytes from a cryptographically secure generator is standard. Modern password hashing libraries generate and store the salt for you, so you should never handle it manually.

### Slow, memory-hard hashing

A **password hashing function** (also called a key derivation function, KDF) is deliberately expensive. If one hash takes 50 milliseconds on your server, a login costs you 50 ms, which a user never notices. But an attacker trying a billion guesses now needs a billion times that work.

**Memory-hardness** means the function also needs a lot of RAM per hash. This matters because attackers use GPUs and custom chips that have huge numbers of cores but limited fast memory per core. A function that needs 64 MiB per guess stops a GPU from running thousands of guesses in parallel cheaply.

#### The four algorithms you will meet

| Algorithm | Year | Memory-hard? | Tunable parameters | Use it when |
|---|---|---|---|---|
| Argon2id | 2015 (RFC 9106, 2021) | Yes | Memory, iterations, parallelism | Default choice for new systems |
| scrypt | 2009 | Yes | N (cost), r (block size), p (parallelism) | Argon2 unavailable; some platforms prefer it |
| bcrypt | 1999 | Slightly (4 KiB) | Cost factor (work = 2^cost) | Existing systems, frameworks that default to it |
| PBKDF2 | 2000 | No | Iterations, underlying hash | FIPS-140 compliance is required |

**Argon2id** won the Password Hashing Competition in 2015 and is what OWASP's Password Storage Cheat Sheet recommends first. The "id" variant mixes two approaches to resist both GPU cracking and side-channel attacks. Use it for new code.

**scrypt** is memory-hard and solid, but its parameters are less intuitive and it is less common in Python web stacks. Fine if a platform gives it to you (Firebase uses a modified scrypt, for example).

**bcrypt** has protected passwords for over two decades and is still acceptable. It has one well-known trap: **it only uses the first 72 bytes of the input**. Bytes after that are ignored, so two long passwords sharing the same first 72 bytes produce the same hash. Non-ASCII characters take several bytes each in UTF-8, so the limit can be hit with fewer than 72 characters. Older versions of the Python `bcrypt` package silently truncated; recent versions raise an error for over-long input instead. Some systems pre-hash with SHA-256 to get around this, but that has its own pitfalls (null bytes, and "password shucking" if the pre-hash was ever stored unsalted elsewhere). If you are starting fresh, choose Argon2id and avoid the question.

**PBKDF2** applies HMAC many times. It is not memory-hard, so GPUs crack it far more efficiently than the others. It survives because it is approved under FIPS 140, which some government and regulated environments require. If you must use it, OWASP's guidance has been around 600,000 iterations of PBKDF2-HMAC-SHA256; check the current cheat sheet because these numbers rise over time.

### Using Argon2id in Python

Install with `pip install argon2-cffi`. The library exposes a `PasswordHasher` class with sensible defaults (in current versions these follow RFC 9106's low-memory recommendation: 64 MiB memory, 3 iterations, parallelism 4).

```python
# pip install argon2-cffi
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

# One shared instance. Parameters are encoded into every hash it creates,
# so you can change them later without breaking old hashes.
ph = PasswordHasher(
    time_cost=3,          # iterations
    memory_cost=64 * 1024,  # in KiB, so 64 MiB
    parallelism=4,        # lanes
)

def hash_password(password: str) -> str:
    # A fresh random salt is generated inside hash() every time.
    return ph.hash(password)

def verify_password(stored_hash: str, password: str) -> bool:
    try:
        return ph.verify(stored_hash, password)  # constant-time compare inside
    except VerifyMismatchError:
        return False          # wrong password: the normal failure case
    except (VerificationError, InvalidHashError):
        return False          # corrupt or unsupported hash: fail closed

def needs_rehash(stored_hash: str) -> bool:
    # True if the hash was made with different parameters than `ph` now uses.
    return ph.check_needs_rehash(stored_hash)

if __name__ == "__main__":
    h = hash_password("correct horse battery staple")
    print(h)
    print(verify_password(h, "correct horse battery staple"))  # True
    print(verify_password(h, "wrong"))                          # False
```

Notice that `verify()` raises on mismatch rather than returning `False`. Wrapping it as above keeps call sites simple and makes sure a corrupt hash never accidentally counts as success.

### The encoded hash string

A hash from argon2-cffi looks like this:

```text
$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$Zm9vYmFyYmF6cXV4...
```

Each `$`-separated part means something:

| Part | Meaning |
|---|---|
| `argon2id` | Algorithm and variant |
| `v=19` | Argon2 version (0x13) |
| `m=65536,t=3,p=4` | Memory in KiB, iterations, parallelism |
| `c2FsdHNh...` | The salt, base64 without padding |
| `Zm9vYmFy...` | The hash output, base64 without padding |

This **PHC string format** (from the Password Hashing Competition) is self-describing. You store the whole string in one column. The verifier reads the algorithm, parameters and salt from the string itself, which is what lets you change parameters later and still verify old hashes. bcrypt uses a similar format starting `$2b$12$`, where 12 is the cost.

Store it in a text column of generous width (255 characters is plenty). Never truncate it.

### Choosing parameters and benchmarking

The right parameters depend on your hardware and load. The process:

1. Decide your memory budget per hash. More memory is stronger, but concurrent logins multiply it (8 simultaneous logins at 64 MiB is 512 MiB).
2. Decide your time budget. A common target is somewhere between about 50 and 500 ms per hash on the production machine. Interactive logins tolerate this easily.
3. Fix memory and parallelism, then raise iterations until you hit the time budget.

OWASP's cheat sheet lists several equivalent minimum configurations for Argon2id, for example 19 MiB with 2 iterations and parallelism 1, or 46 MiB with 1 iteration. These are floors, not targets. The argon2-cffi defaults are above them.

A benchmark you can run on your own machine:

```python
# pip install argon2-cffi
import time
from argon2 import PasswordHasher

def bench(memory_mib: int, time_cost: int, parallelism: int, runs: int = 5) -> float:
    ph = PasswordHasher(memory_cost=memory_mib * 1024, time_cost=time_cost,
                        parallelism=parallelism)
    ph.hash("warm-up")  # first call pays one-off setup costs
    start = time.perf_counter()
    for _ in range(runs):
        ph.hash("benchmark password 123")
    return (time.perf_counter() - start) / runs * 1000  # ms per hash

if __name__ == "__main__":
    for mem in (19, 46, 64, 128):
        for t in (1, 2, 3, 4):
            ms = bench(mem, t, parallelism=4 if mem >= 64 else 1)
            print(f"m={mem:>3} MiB  t={t}  -> {ms:6.1f} ms")
```

Run it on the machine that will serve logins, not your fastest laptop. On a recent Mac, the defaults typically land in the tens of milliseconds; a small cloud VM may be several times slower. Pick the strongest setting that stays inside your time budget at your expected concurrency.

Re-run this benchmark every year or two, or when you change hardware, and raise parameters if you can. Rehash-on-login (next section) moves users to the new parameters automatically.

### Rehash on login

You can only compute a new hash when you know the plaintext password, and the only time you know it is at login. So the pattern is:

1. Verify the password against the stored hash.
2. If correct, check whether the stored hash uses outdated parameters or an outdated algorithm.
3. If so, hash the password again with current settings and update the row.

```python
def login_check(db, user_row, password: str) -> bool:
    stored = user_row["password_hash"]
    if not verify_password(stored, password):
        return False
    # Upgrade silently while we still hold the plaintext.
    if needs_rehash(stored):
        db.execute("UPDATE users SET password_hash = ? WHERE id = ?",
                   (hash_password(password), user_row["id"]))
        db.commit()
    return True
```

Users who never log in keep old hashes. That is usually acceptable. If the old algorithm is truly weak, see the next section.

### Migrating legacy hashes

Suppose you inherit a database of unsalted SHA-1 hashes, or bcrypt hashes, and want Argon2id.

**Option A: verify-then-rehash.** Keep a column saying which scheme each hash uses. At login, verify with the old scheme; on success, replace with Argon2id. Simple, but weak hashes stay in the database until each user logs in.

**Option B: wrap the old hash.** Immediately compute `argon2id(old_hash)` for every user and store that, marking the row as "wrapped". At login, compute the old hash of the typed password, then verify it against the Argon2id wrapper. On success, replace with a plain `argon2id(password)`. This protects every account at once, including inactive ones. It is the better choice when the legacy scheme is weak (MD5, SHA-1, unsalted anything).

```python
import hashlib

def verify_and_migrate(db, row, password: str) -> bool:
    scheme = row["hash_scheme"]
    if scheme == "argon2id":
        return login_check(db, row, password)
    if scheme == "wrapped_sha1":
        # Legacy: the stored value is argon2id(sha1_hex(password)).
        legacy = hashlib.sha1(password.encode()).hexdigest()
        if not verify_password(row["password_hash"], legacy):
            return False
        db.execute("UPDATE users SET password_hash = ?, hash_scheme = 'argon2id' "
                   "WHERE id = ?", (hash_password(password), row["id"]))
        db.commit()
        return True
    return False  # unknown scheme: fail closed
```

For bcrypt to Argon2id, argon2-cffi cannot verify bcrypt hashes, so use the `bcrypt` package (or `passlib`/`pwdlib`, which can hold several schemes) for the legacy check.

### Peppers

A **pepper** is a secret value, the same for all users, that is mixed into password hashing and stored *outside* the database: in an environment variable, a secrets manager, or a hardware security module. The idea: if only the database leaks (a common case, for example through SQL injection or a backup), the attacker cannot even begin cracking, because every hash depends on a secret they do not have.

A pepper is defence in depth. It does not help if the attacker gets the whole server, and it adds operational burden: lose the pepper and every password becomes unverifiable. For a small app it is optional; for a public app holding many accounts it is worth considering.

#### How to apply a pepper safely

There are two sound patterns.

**HMAC before hashing.** Compute `HMAC-SHA256(pepper, password)` and feed that to Argon2id. The HMAC output is a fixed 32 bytes, which also avoids any length issues.

**Encrypt the hash.** Hash normally with Argon2id, then encrypt the resulting string with a key held outside the database (for example with AES-GCM via the `cryptography` package). The advantage is rotation: you can decrypt and re-encrypt all hashes with a new key without knowing any passwords.

Do not just concatenate the pepper to the password (`password + pepper`). It works with Argon2id but becomes a problem with bcrypt's 72-byte limit and makes it unclear where the boundary is. HMAC is cleaner.

```python
# pip install argon2-cffi
import hmac, hashlib, os, base64
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

ph = PasswordHasher()

# Loaded from the environment or a secrets manager, never from the database.
# Generate once with: python -c "import secrets; print(secrets.token_hex(32))"
PEPPERS = {
    "p1": bytes.fromhex(os.environ["PEPPER_P1"]),
}
CURRENT_PEPPER_ID = "p1"

def _peppered(password: str, pepper_id: str) -> str:
    mac = hmac.new(PEPPERS[pepper_id], password.encode("utf-8"), hashlib.sha256)
    return base64.b64encode(mac.digest()).decode("ascii")

def hash_password(password: str) -> str:
    # Store the pepper ID with the hash so the pepper can be rotated later.
    return CURRENT_PEPPER_ID + ":" + ph.hash(_peppered(password, CURRENT_PEPPER_ID))

def verify_password(stored: str, password: str) -> bool:
    pepper_id, _, argon_hash = stored.partition(":")
    if pepper_id not in PEPPERS:
        return False  # unknown pepper: fail closed
    try:
        return ph.verify(argon_hash, _peppered(password, pepper_id))
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False
```

With the HMAC pattern, rotating the pepper requires rehash-on-login (you need the plaintext), so keep old peppers available until migration completes. That is why each hash records its pepper ID.

### Password policy: what current NIST guidance says

NIST Special Publication 800-63B is the US government's digital identity guideline, and it has become the reference point for password policy worldwide. Its fourth revision (SP 800-63-4) was finalised in 2025. The guidance has changed a lot since the old "8 characters with a capital, a digit and a symbol, changed every 90 days" era, and it is worth knowing why.

| Old practice | Current guidance | Why it changed |
|---|---|---|
| Composition rules (upper, digit, symbol) | Do not impose composition rules | People respond with predictable patterns like `Password1!`; it adds annoyance, not strength |
| Forced change every 60 or 90 days | No periodic rotation; force a change only on evidence of compromise | Forced rotation produces `Summer2025!` then `Autumn2025!` |
| Short maximum lengths | Allow long passwords (at least 64 characters) | Passphrases are strong and memorable |
| Password hints and security questions | Do not use them | Answers are guessable or public |
| Block paste into password fields | Allow paste and password managers | Password managers produce the strongest passwords |
| 8-character minimum | 15 characters minimum when the password is the only factor; 8 when used with MFA | Length is the main driver of strength |

Rev. 4 also requires checking new passwords against a **blocklist** of commonly used, expected or compromised passwords, and says all printing characters, spaces and Unicode should be accepted. Normalise Unicode (NFKC) before hashing so the same password typed on different keyboards hashes identically.

For a family app, a 15-character minimum may feel heavy. That is a legitimate trade-off to make consciously: for a LAN app with two learners and rate limiting, a shorter minimum plus a blocklist is reasonable. For a public app, follow the guidance.

### Checking breached passwords with Have I Been Pwned

The **Have I Been Pwned (HIBP) Pwned Passwords** service holds hundreds of millions of passwords seen in real breaches. Checking against it is the most effective blocklist available, and it is free, needs no API key for the password range endpoint, and never sees the user's password.

It uses **k-anonymity**:

1. Compute the SHA-1 of the password and write it in uppercase hex (40 characters).
2. Send only the first 5 characters to `https://api.pwnedpasswords.com/range/{prefix}`.
3. The service returns every hash suffix that starts with that prefix (several hundred), each with a count of how many times it was seen.
4. You look for your suffix locally.

The service learns only a 5-character prefix shared by hundreds of unrelated passwords. SHA-1 is fine here because this is a lookup key, not password storage.

```python
# pip install httpx
import hashlib
import httpx

HIBP_URL = "https://api.pwnedpasswords.com/range/{}"

def pwned_count(password: str, timeout: float = 3.0) -> int | None:
    """Return how often the password appears in breaches, or None if unknown."""
    sha1 = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()
    prefix, suffix = sha1[:5], sha1[5:]
    try:
        resp = httpx.get(
            HIBP_URL.format(prefix),
            headers={
                "Add-Padding": "true",          # hides response size from observers
                "User-Agent": "rankwise-password-check",
            },
            timeout=timeout,
        )
        resp.raise_for_status()
    except httpx.HTTPError:
        return None  # service unreachable: let the caller decide
    for line in resp.text.splitlines():
        candidate, _, count = line.partition(":")
        if candidate == suffix:
            return int(count)  # padded entries have count 0
    return 0

def password_problems(password: str) -> list[str]:
    problems = []
    if len(password) < 12:
        problems.append("Use at least 12 characters. A short phrase works well.")
    if len(password) > 256:
        problems.append("That is longer than we accept.")
    n = pwned_count(password)
    if n:
        problems.append("This password has appeared in data breaches. Please choose another.")
    return problems
```

Decide what to do when HIBP is unreachable. For sign-up, allowing the password but logging the miss is reasonable (fail open on a non-security-critical enrichment, with a local blocklist as backup). You can also download the full dataset for offline checking if you do not want any external dependency, which suits a LAN app.

Call this check at sign-up and password change, not at every login. Some services also check at login and nudge users whose existing password has since appeared in a breach.

### Pitfalls

- Using `hashlib.sha256(password)` "because it is a hash". It is fast, so it is wrong for passwords.
- Writing your own salt handling. The library does it; doing it yourself invites mistakes.
- Comparing hashes with `==`. Use the library's verify, which compares in constant time.
- Truncating the stored hash string to fit a short column.
- Setting Argon2 memory so high that a few concurrent logins exhaust RAM, turning login into a denial-of-service vector (see chapter 10).
- Losing the pepper. Back it up separately from the database, with care.
- Enforcing a maximum password length of 16 or 20. Allow at least 64.
- Logging the request body of the login endpoint, which logs passwords.

### Decision guide

- New system: Argon2id with argon2-cffi defaults or stronger, verified by benchmark.
- Existing bcrypt system: keep bcrypt, raise the cost if fast, migrate to Argon2id gradually if convenient.
- FIPS requirement: PBKDF2-HMAC-SHA256 with current OWASP iteration counts.
- Small private app: pepper optional. Public app with many users: consider a pepper, preferably via encrypting the hash so it can rotate.
- Always: length over complexity, no forced rotation, breached-password check, paste allowed.

### Key takeaways

- Never store plaintext or encrypted passwords, and never use fast hashes. Use Argon2id.
- Salts make each hash unique and are handled by the library. Peppers are an optional secret layer kept outside the database.
- Parameters live inside the encoded hash, so you can raise them over time and rehash on login.
- Migrate weak legacy hashes by wrapping them immediately, not by waiting for logins.
- Modern policy is length plus a breached-password check, with no composition rules and no forced rotation.


## 3. The login flow end to end

This chapter builds a complete password login: the data model, sign-up, login, logout and password change. Along the way it covers the attacks that target these endpoints (user enumeration, credential stuffing, brute force) and the controls that stop them (uniform responses, rate limiting, logging). It ends with a small, runnable FastAPI and SQLite application you can study and adapt.

### The data model

#### The users table

A users table should separate the internal identity from the identifiers, record enough state to make security decisions, and nothing more.

```sql
CREATE TABLE IF NOT EXISTS users (
    id                  INTEGER PRIMARY KEY,          -- internal identity, never shown
    public_id           TEXT NOT NULL UNIQUE,         -- random ID safe to expose in URLs
    email               TEXT NOT NULL,                -- as the user typed it, for display
    email_normalized    TEXT NOT NULL UNIQUE,         -- lookup key, see below
    display_name        TEXT NOT NULL,
    password_hash       TEXT,                         -- NULL if the user only uses passkeys/OAuth
    email_verified_at   INTEGER,                      -- epoch seconds, NULL until verified
    role                TEXT NOT NULL DEFAULT 'learner'
                        CHECK (role IN ('learner', 'admin')),
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'disabled')),
    password_changed_at INTEGER,
    last_login_at       INTEGER,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);
```

Why each choice:

- **Two IDs.** `id` is a compact integer for joins. `public_id` is random (for example `secrets.token_urlsafe(12)`), so exposing it in a URL does not reveal how many users you have or let anyone guess neighbours. Guessable IDs are not a vulnerability by themselves (authorisation is what protects data, see chapter 7), but random public IDs remove an easy reconnaissance step.
- **Display email and normalised email.** The user sees what they typed; lookups and the uniqueness constraint use the normalised form.
- **Nullable password hash.** Users who sign in only with Google or passkeys have no password. Do not store an empty string or a fake hash, which could accidentally verify.
- **role and status as constrained text.** The `CHECK` constraint makes invalid values impossible, which is a secure default at the database level.
- **Timestamps as integers.** Epoch seconds avoid time-zone mistakes in comparisons. Use whatever your team handles correctly, but be consistent.

#### Normalising identifiers

If one person signs up with an address typed with a capital first letter and someone else later types the same address in lower case, you almost certainly want those to be the same account. **Normalisation** turns every variant into one canonical form before lookup and before the uniqueness check.

- **Trim whitespace.** Copy-paste adds trailing spaces.
- **Unicode normalisation (NFKC).** Different byte sequences can display as the same character (for example an accented letter as one code point or as letter-plus-accent). NFKC makes them identical.
- **Case-folding.** `str.casefold()` is a stronger version of `lower()` designed for case-insensitive comparison, and handles characters like the German sharp s.

Technically the part of an email address before the `@` can be case-sensitive, but virtually no real provider treats it that way, and treating it as case-insensitive avoids duplicate accounts. Do not strip dots or `+tags` for Gmail-style addresses: that is provider-specific and can merge different people's accounts.

For usernames, also consider **confusable characters**: Cyrillic `а` looks exactly like Latin `a`. If usernames are shown to other users, restrict them to a safe character set or use a confusables check, so nobody can impersonate `taha` with a look-alike.

#### The sessions table

Login creates a session. The full design is in chapter 4; here is the minimum.

```sql
CREATE TABLE IF NOT EXISTS sessions (
    token_hash    TEXT PRIMARY KEY,     -- SHA-256 of the cookie value, never the raw token
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at    INTEGER NOT NULL,
    last_seen_at  INTEGER NOT NULL,
    expires_at    INTEGER NOT NULL,     -- absolute expiry
    user_agent    TEXT,
    ip            TEXT
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS auth_events (
    id         INTEGER PRIMARY KEY,
    at         INTEGER NOT NULL,
    event      TEXT NOT NULL,           -- login_ok, login_failed, logout, ...
    user_id    INTEGER,                 -- NULL when the account is unknown
    ip         TEXT,
    detail     TEXT                     -- never passwords or tokens
);
```

Storing only a hash of the session token means a database leak does not hand out live sessions. The token is high-entropy random data, so a single fast SHA-256 is enough here (unlike passwords, it cannot be guessed).

### The flows

#### Sign-up

1. Validate input: email shape, password length, display name length.
2. Normalise the email.
3. Check the password policy, including the breached-password check from chapter 2.
4. Hash the password with Argon2id.
5. Insert the user. Rely on the `UNIQUE` constraint to catch duplicates, not on a "check then insert" query, which has a race condition between two simultaneous sign-ups.
6. Either log the user in immediately, or send a verification email first (chapter 5).

#### Login

1. Rate-limit by IP address and by account identifier.
2. Normalise the email and look up the user.
3. If the user does not exist, verify the password against a dummy hash anyway (explained below) and fail.
4. Verify the password. If the account is disabled, fail the same way.
5. On success: reset the per-account failure counter, rehash if needed, record `last_login_at`.
6. Destroy any session the browser already had and create a fresh one (prevents session fixation, chapter 4).
7. Set the session cookie and log the event.

#### Logout

Delete the session record on the server, then clear the cookie. Deleting only the cookie is not logout: if the token was copied elsewhere, it would still work.

#### Change password

1. Require the current password, even though the user is logged in. A stolen session must not be enough to lock the owner out.
2. Apply the password policy to the new password.
3. Update the hash and `password_changed_at`.
4. Delete all of the user's other sessions, and rotate the current one. If an attacker had a session, it ends here.
5. Notify the user by email if you have one ("your password was changed; if this was not you...").

### User enumeration

**User enumeration** is when an attacker can find out whether a given email or username has an account. That matters because it lets them build a list of valid targets for credential stuffing or phishing, and for some apps (dating, health, debt advice) the mere fact of having an account is sensitive.

Enumeration leaks through four channels.

#### Messages

The wrong way:

```text
POST /login  ->  "No account with that email"
POST /login  ->  "Wrong password"
```

The fix is one message for every failure: "Email or password is incorrect." Use the same HTTP status and the same response body shape.

#### Timing

Even with identical messages, the response time can differ. If an unknown email returns in 2 ms (nothing to verify) and a known email takes 80 ms (Argon2 runs), the attacker can tell them apart with a stopwatch.

The fix is to run a password verification in both cases. At startup, hash a random throwaway password to create a **dummy hash** with the same parameters. When the user is not found, verify the submitted password against the dummy hash and discard the result. Both paths now cost one Argon2 verification.

Timing also leaks through rehashing (only for real users), database lookups and email sending. Moving slow side effects like email to a background task helps keep response times uniform.

#### Sign-up forms

Sign-up is harder: if someone registers with an email that already has an account, saying "that email is taken" reveals it. The only complete fix needs email: always respond "Check your inbox to continue." Then send either a "finish signing up" link to a new address or a "you already have an account, here is how to log in" message to an existing one. Only the owner of the inbox learns the answer.

If you cannot send email (like a home LAN app), accept the enumeration risk on sign-up and compensate with rate limiting and monitoring. Be honest with yourself that the trade-off exists.

#### Password reset forms

"We sent a reset link to that address" versus "no such account" is the same leak. Always say: "If an account exists for that address, we have sent a link." Chapter 5 covers this in detail.

#### How much does enumeration matter for you?

| App type | Enumeration impact | Recommendation |
|---|---|---|
| Private family app | Negligible: everyone knows who uses it | Uniform login messages, do not over-engineer |
| General public app | Moderate: feeds credential stuffing | Uniform messages, dummy hash, rate limiting |
| Sensitive service | High: membership itself is private | Full email-based uniform flows everywhere |

### Constant-time comparison

When you compare two secrets byte by byte with `==`, Python stops at the first differing byte. In principle an attacker can measure how long the comparison took and learn how many leading bytes were right, then guess the next byte. Over a network this is hard but not impossible, especially with many measurements.

Use `hmac.compare_digest(a, b)` (or `secrets.compare_digest`, the same function) whenever you compare a secret supplied by the client with a stored secret, such as API keys, CSRF tokens or recovery codes. Password libraries already do this inside `verify()`.

A simpler pattern often removes the need entirely: hash the incoming token and look the hash up in the database by primary key. The lookup does not leak useful timing information about the secret, because an attacker cannot control the hash's bytes.

### Rate limiting in depth

Rate limiting is the main defence against **online attacks**: guessing passwords against your live login endpoint. Without it, an attacker can try thousands of passwords per minute against one account, or one common password against thousands of accounts.

#### What to limit on

| Dimension | Stops | Weakness |
|---|---|---|
| Per account (normalised email) | Brute force against one account | Can be used to lock out a victim (see below) |
| Per IP address | One machine hammering many accounts | Botnets use thousands of IPs; shared IPs (offices, mobile carriers, CGNAT) hit innocent users |
| Per IP and account pair | Repeated guesses from one place at one account | Weak alone |
| Global (all logins) | Large distributed waves; protects server CPU | Throttles everyone during an attack |

Use several together. A typical starting point for a small app: 10 attempts per minute per IP, 5 failures per 15 minutes per account, and a global ceiling sized to your server's hashing capacity (chapter 10).

#### Algorithms

**Fixed window.** Count requests per key per calendar minute. Simple but bursty: an attacker can send the full allowance at 12:00:59 and again at 12:01:00.

**Sliding window.** Keep timestamps of recent attempts per key and count those within the last N seconds. Accurate and easy in memory; storage grows with the limit, which is fine for small limits like login attempts.

**Token bucket.** Each key has a bucket that refills at a steady rate up to a maximum. Each request takes a token; an empty bucket means wait. It allows short bursts while enforcing an average rate, and it needs only two numbers per key (tokens and last refill time). Good for API rate limits generally.

For login, a sliding window over failures is the most intuitive: "at most 5 failed attempts in any 15-minute period."

#### Progressive delays instead of hard stops

Rather than allowing 5 attempts and then blocking, you can add a growing delay: no delay for the first 3 failures, then 1 second, 2, 4, 8, capped at, say, 30 seconds. This makes brute force impractical while a real user who mistypes a few times barely notices. Implement it as "the next attempt is not allowed before time T" rather than by sleeping inside the request handler, which would tie up server workers.

#### Why permanent lockouts are dangerous

"Lock the account after 5 failures until an admin unlocks it" sounds secure but creates a **denial-of-service** weapon: anyone who knows a user's email can lock them out forever by typing wrong passwords. Attackers can lock out every account they can enumerate.

Use temporary, self-expiring limits instead (15 minutes, growing for repeat offenders). Consider counting failures per account *and source*, so an attacker hammering from one IP range does not lock out the real user logging in from home. A successful login from a device that previously logged in successfully (recognised by a long-lived device cookie) can bypass the per-account limit; this is sometimes called a **device cookie** approach and OWASP describes it.

#### CAPTCHA as escalation

A **CAPTCHA** is a challenge meant to separate humans from bots. They annoy users, fail accessibility, and are increasingly solved by machine learning or cheap human farms. Use them as an escalation, not a default: show one only after several failures for an account or IP, or during a detected attack wave. Privacy-friendlier options (such as proof-of-work or "invisible" challenges from CDN providers) reduce friction.

#### Where to store counters

| Store | Pros | Cons | Use when |
|---|---|---|---|
| Process memory (dict) | Zero setup, fastest | Lost on restart; not shared between processes or servers | One process, small app (Rankwise phase 1) |
| SQLite or Postgres table | Survives restarts; shared across processes on one database | Extra write per attempt; needs cleanup of old rows | Few servers, modest traffic |
| Redis | Fast, atomic increments, built-in expiry, shared across servers | Another service to run and secure | Multiple servers, real traffic |

Note that running uvicorn with several worker processes gives each worker its own memory, so in-memory limits multiply by the number of workers. That is fine to know about for a tiny app and a reason to move to a shared store later.

#### Trusting the right IP address

`request.client.host` is the IP of whatever connected to your server. Behind a reverse proxy or load balancer, that is the proxy. The real client IP is then in the `X-Forwarded-For` header, but clients can forge that header. Only trust it when it was set by your own proxy: run uvicorn with `--proxy-headers --forwarded-allow-ips=<proxy IP>` so it rewrites `request.client` safely, and never parse the header yourself from arbitrary requests.

### Credential stuffing

**Credential stuffing** is logging in with email and password pairs leaked from *other* sites. It works because people reuse passwords. Unlike brute force, each account gets only one or two attempts, from a large pool of IP addresses, so per-account and per-IP limits barely trigger.

Signals and defences:

- **A spike in failed logins across many accounts**, especially for emails that do not exist in your system. Global rate limits and alerts catch this.
- **Breached-password checks** at sign-up and password change mean fewer reused passwords exist in your system to begin with.
- **MFA or passkeys** make a correct password insufficient.
- **New-device notifications** ("a new sign-in to your account") let users react.
- **Bot detection** (CAPTCHA escalation, CDN bot management) for public apps.

### Logging and auditing

Security logs answer "what happened?" after an incident, and power alerts while an attack is happening.

#### What to log

- Login success and failure, with timestamp, user ID (if known), IP, user agent, and the reason category (unknown user, bad password, throttled, disabled).
- Logout, session revocation, "log out everywhere".
- Password change, password reset requested and completed, email change, MFA enrolled or removed.
- Role changes and admin actions, especially impersonation.
- Rate-limit triggers.

#### What never to log

- Passwords, including failed ones. A failed password is often a typo of the real one, or the user's password for a different site.
- Session tokens, reset tokens, API keys, JWTs, recovery codes, TOTP secrets.
- Full request bodies or headers of auth endpoints. `Authorization` and `Cookie` headers contain secrets.

The classic failure is a debug middleware that logs every request body, deployed to production. Make the safe behaviour structural: log explicit, named fields, never whole objects.

For failed logins with unknown accounts, consider logging a keyed hash of the submitted email rather than the email itself, so the log does not become a list of addresses people typed (including typos of real people's addresses).

Keep logs for a defined period (for example 90 days), restrict access, and remember logs containing IP addresses are personal data under GDPR (chapter 10).

### A complete minimal example

The following application implements everything above with FastAPI, stdlib `sqlite3` and argon2-cffi. It has four files in one folder. Install with:

```text
pip install fastapi "uvicorn[standard]" argon2-cffi
```

Run with `COOKIE_SECURE=0 uvicorn main:app --port 8899` for local HTTP testing, or with HTTPS and the default `COOKIE_SECURE=1` in any real deployment.

#### db.py

```python
# db.py - SQLite connection handling and schema
import os
import sqlite3
import time
from collections.abc import Iterator

DB_PATH = os.environ.get("AUTH_DB", "auth.db")

def now() -> int:
    return int(time.time())

def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")   # enforce ON DELETE CASCADE
    conn.execute("PRAGMA journal_mode = WAL")  # readers do not block writers
    return conn

def init_db(schema_path: str = "schema.sql") -> None:
    conn = connect()
    try:
        with open(schema_path, encoding="utf-8") as f:
            conn.executescript(f.read())
        conn.commit()
    finally:
        conn.close()

def get_db() -> Iterator[sqlite3.Connection]:
    """FastAPI dependency: one connection per request, always closed."""
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()

def audit(conn: sqlite3.Connection, event: str, user_id: int | None,
          ip: str | None, detail: str = "") -> None:
    # Only explicit, non-secret fields are recorded.
    conn.execute(
        "INSERT INTO auth_events (at, event, user_id, ip, detail) VALUES (?, ?, ?, ?, ?)",
        (now(), event, user_id, ip, detail[:200]),
    )
    conn.commit()
```

Save the three `CREATE TABLE` statements from earlier in this chapter (users, sessions, auth_events) as `schema.sql` next to it.

#### security.py

```python
# security.py - hashing, normalisation, session tokens
import hashlib
import secrets
import unicodedata

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

ph = PasswordHasher()  # argon2id with library defaults; benchmark and tune (chapter 2)

# Same parameters as real hashes, so unknown-user logins cost the same time.
DUMMY_HASH = ph.hash(secrets.token_urlsafe(32))

def normalize_email(email: str) -> str:
    return unicodedata.normalize("NFKC", email.strip()).casefold()

def normalize_password(password: str) -> str:
    # NFKC so the same password typed on different keyboards matches.
    return unicodedata.normalize("NFKC", password)

def hash_password(password: str) -> str:
    return ph.hash(normalize_password(password))

def verify_password(stored_hash: str | None, password: str) -> bool:
    try:
        return ph.verify(stored_hash or DUMMY_HASH, normalize_password(password))
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False

def burn_time_for_unknown_user(password: str) -> None:
    verify_password(DUMMY_HASH, password)  # result deliberately ignored

def needs_rehash(stored_hash: str) -> bool:
    return ph.check_needs_rehash(stored_hash)

def new_token() -> str:
    return secrets.token_urlsafe(32)  # 256 bits from the OS CSPRNG

def token_hash(token: str) -> str:
    # Tokens are random, so a fast hash is enough; we never store raw tokens.
    return hashlib.sha256(token.encode("ascii")).hexdigest()

def password_problem(password: str) -> str | None:
    if len(password) < 12:
        return "Use at least 12 characters. A short phrase works well."
    if len(password) > 256:
        return "Password is too long."
    return None  # add the HIBP check from chapter 2 here
```

Note that `verify_password` with a `None` hash (a passwordless account) verifies against the dummy hash, which always fails but costs the same time. This avoids a timing difference for passkey-only accounts.

#### ratelimit.py

```python
# ratelimit.py - in-memory sliding-window limiter (single process only)
import threading
import time
from collections import defaultdict, deque

class SlidingWindowLimiter:
    def __init__(self, max_events: int, window_seconds: float):
        self.max_events = max_events
        self.window = window_seconds
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()  # sync endpoints run in a thread pool

    def _prune(self, q: deque[float], now: float) -> None:
        while q and q[0] <= now - self.window:
            q.popleft()

    def blocked(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            q = self._events[key]
            self._prune(q, now)
            return len(q) >= self.max_events

    def record(self, key: str) -> None:
        with self._lock:
            self._events[key].append(time.monotonic())

    def hit(self, key: str) -> bool:
        """Record an event and return True if it is still within the limit."""
        now = time.monotonic()
        with self._lock:
            q = self._events[key]
            self._prune(q, now)
            if len(q) >= self.max_events:
                return False
            q.append(now)
            return True

    def reset(self, key: str) -> None:
        with self._lock:
            self._events.pop(key, None)

    def retry_after(self, key: str) -> int:
        with self._lock:
            q = self._events.get(key)
            if not q:
                return 0
            return max(1, int(q[0] + self.window - time.monotonic()) + 1)
```

Memory grows with the number of distinct keys. For a small app that is fine; a production limiter would also evict empty keys periodically, or use Redis with key expiry.

#### main.py, part 1: setup and sign-up

```python
# main.py - FastAPI app: sign-up, login, logout, change password
import os
import secrets
import sqlite3
from contextlib import asynccontextmanager

from fastapi import Cookie, Depends, FastAPI, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

import security as sec
from db import audit, get_db, init_db, now
from ratelimit import SlidingWindowLimiter

COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "1") == "1"
# __Host- prefix requires Secure; fall back to a plain name for local HTTP only.
COOKIE_NAME = "__Host-session" if COOKIE_SECURE else "session"
SESSION_TTL = 30 * 24 * 3600   # absolute lifetime
GENERIC_LOGIN_ERROR = "Email or password is incorrect."

ip_limiter = SlidingWindowLimiter(max_events=20, window_seconds=60)        # all attempts
account_limiter = SlidingWindowLimiter(max_events=5, window_seconds=900)   # failures only
global_limiter = SlidingWindowLimiter(max_events=300, window_seconds=60)   # whole server

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(lifespan=lifespan)

class SignupIn(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=1024)
    display_name: str = Field(min_length=1, max_length=50)

class LoginIn(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=1024)

def client_ip(request: Request) -> str:
    # Behind a proxy, configure uvicorn --proxy-headers instead of reading headers here.
    return request.client.host if request.client else "unknown"

@app.post("/auth/signup", status_code=201)
def signup(body: SignupIn, request: Request, db: sqlite3.Connection = Depends(get_db)):
    ip = client_ip(request)
    if not ip_limiter.hit("signup:" + ip):
        raise HTTPException(429, "Too many attempts. Try again later.")
    email_n = sec.normalize_email(body.email)
    if "@" not in email_n:
        raise HTTPException(422, "Enter a valid email address.")
    if problem := sec.password_problem(body.password):
        raise HTTPException(422, problem)
    t = now()
    try:
        db.execute(
            "INSERT INTO users (public_id, email, email_normalized, display_name,"
            " password_hash, password_changed_at, created_at, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (secrets.token_urlsafe(12), body.email.strip(), email_n,
             body.display_name.strip(), sec.hash_password(body.password), t, t, t),
        )
        db.commit()
    except sqlite3.IntegrityError:
        # The UNIQUE constraint catches duplicates without a race condition.
        # NOTE: this reveals that the email exists. Without email sending this is
        # the honest trade-off; with email, respond "check your inbox" instead.
        raise HTTPException(409, "An account with this email already exists.")
    audit(db, "signup", None, ip)
    return {"ok": True}
```

#### main.py, part 2: sessions and login

```python
def create_session(db: sqlite3.Connection, user_id: int, request: Request,
                   response: Response) -> None:
    token = sec.new_token()
    t = now()
    db.execute(
        "INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at,"
        " expires_at, user_agent, ip) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (sec.token_hash(token), user_id, t, t, t + SESSION_TTL,
         request.headers.get("user-agent", "")[:200], client_ip(request)),
    )
    db.commit()
    response.set_cookie(
        COOKIE_NAME, token,
        max_age=SESSION_TTL,
        httponly=True,          # JavaScript cannot read it, so XSS cannot steal it
        secure=COOKIE_SECURE,   # only sent over HTTPS
        samesite="lax",         # not sent on cross-site POSTs (CSRF defence)
        path="/",
    )

def destroy_session(db: sqlite3.Connection, token: str | None) -> None:
    if token:
        db.execute("DELETE FROM sessions WHERE token_hash = ?", (sec.token_hash(token),))
        db.commit()

@app.post("/auth/login")
def login(body: LoginIn, request: Request, response: Response,
          db: sqlite3.Connection = Depends(get_db),
          old_token: str | None = Cookie(default=None, alias=COOKIE_NAME)):
    ip = client_ip(request)
    email_n = sec.normalize_email(body.email)
    acct_key = "acct:" + email_n
    if (not global_limiter.hit("login") or not ip_limiter.hit("login:" + ip)
            or account_limiter.blocked(acct_key)):
        audit(db, "login_throttled", None, ip)
        raise HTTPException(429, "Too many attempts. Try again later.",
                            headers={"Retry-After": str(account_limiter.retry_after(acct_key) or 60)})

    row = db.execute("SELECT id, password_hash, status FROM users WHERE email_normalized = ?",
                     (email_n,)).fetchone()
    if row is None:
        sec.burn_time_for_unknown_user(body.password)   # equalise timing
        account_limiter.record(acct_key)
        audit(db, "login_failed", None, ip, "unknown_user")
        raise HTTPException(401, GENERIC_LOGIN_ERROR)

    ok = sec.verify_password(row["password_hash"], body.password)
    if not ok or row["status"] != "active":
        account_limiter.record(acct_key)
        audit(db, "login_failed", row["id"], ip, "bad_password" if not ok else "disabled")
        raise HTTPException(401, GENERIC_LOGIN_ERROR)   # same message either way

    account_limiter.reset(acct_key)
    if sec.needs_rehash(row["password_hash"]):
        db.execute("UPDATE users SET password_hash = ? WHERE id = ?",
                   (sec.hash_password(body.password), row["id"]))
    db.execute("UPDATE users SET last_login_at = ? WHERE id = ?", (now(), row["id"]))
    db.commit()
    destroy_session(db, old_token)          # never reuse a pre-login session ID
    create_session(db, row["id"], request, response)
    audit(db, "login_ok", row["id"], ip)
    return {"ok": True}
```

#### main.py, part 3: current user, logout, change password

```python
def current_user(request: Request, db: sqlite3.Connection = Depends(get_db),
                 token: str | None = Cookie(default=None, alias=COOKIE_NAME)) -> sqlite3.Row:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not logged in.")
    row = db.execute(
        "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id"
        " WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'",
        (sec.token_hash(token), now()),
    ).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not logged in.")  # fail closed
    return row

@app.get("/me")
def me(user: sqlite3.Row = Depends(current_user)):
    return {"id": user["public_id"], "display_name": user["display_name"], "role": user["role"]}

@app.post("/auth/logout")
def logout(request: Request, response: Response, db: sqlite3.Connection = Depends(get_db),
           token: str | None = Cookie(default=None, alias=COOKIE_NAME)):
    destroy_session(db, token)               # server-side deletion is the real logout
    response.delete_cookie(COOKIE_NAME, path="/", secure=COOKIE_SECURE,
                           httponly=True, samesite="lax")
    audit(db, "logout", None, client_ip(request))
    return {"ok": True}

class ChangePasswordIn(BaseModel):
    current_password: str = Field(max_length=1024)
    new_password: str = Field(max_length=1024)

@app.post("/auth/change-password")
def change_password(body: ChangePasswordIn, request: Request, response: Response,
                    user: sqlite3.Row = Depends(current_user),
                    db: sqlite3.Connection = Depends(get_db)):
    ip = client_ip(request)
    if not ip_limiter.hit("chpw:" + ip):
        raise HTTPException(429, "Too many attempts. Try again later.")
    if not sec.verify_password(user["password_hash"], body.current_password):
        audit(db, "password_change_failed", user["id"], ip)
        raise HTTPException(403, "Current password is incorrect.")
    if problem := sec.password_problem(body.new_password):
        raise HTTPException(422, problem)
    t = now()
    db.execute("UPDATE users SET password_hash = ?, password_changed_at = ?, updated_at = ?"
               " WHERE id = ?", (sec.hash_password(body.new_password), t, t, user["id"]))
    db.execute("DELETE FROM sessions WHERE user_id = ?", (user["id"],))  # end ALL sessions
    db.commit()
    create_session(db, user["id"], request, response)  # fresh session for this device
    audit(db, "password_changed", user["id"], ip)
    return {"ok": True}
```

Two dependencies in one request (`current_user` and the endpoint) both ask for `get_db`. FastAPI caches dependencies per request by default, so they share one connection.

This example does not yet include CSRF protection beyond `SameSite=Lax`, idle timeouts, or session rotation on privilege change. Chapter 4 adds those. It also counts unknown-user failures per email, which means an attacker can still pre-throttle a victim's email for 15 minutes; that is the accepted trade-off of a temporary limit.

### Using slowapi instead of a hand-written limiter

**slowapi** is a rate-limiting library for Starlette and FastAPI, adapted from Flask-Limiter. It supports in-memory, Redis and Memcached storage through the `limits` package, and it is a sensible choice once you want shared counters across workers.

```python
# pip install slowapi
from fastapi import FastAPI, Request
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# storage_uri="redis://localhost:6379" shares counters across processes.
limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.post("/auth/login")
@limiter.limit("10/minute")          # per client IP
def login(request: Request):         # slowapi needs the `request` argument
    ...
```

slowapi's decorator limits by a key derived from the request (IP by default). Per-account limiting needs the email from the body, which is easier to do inside the handler with your own limiter or direct Redis calls. A common combination is slowapi for per-IP limits and a small custom check for per-account failures.

### Pitfalls

- Different error messages or status codes for unknown user versus wrong password.
- Skipping the password hash for unknown users, leaking existence through timing.
- "Check if exists, then insert" for sign-up, which races under concurrent requests.
- Permanent account lockout after N failures.
- Rate limiting by `X-Forwarded-For` read directly from the request, which attackers set to anything.
- Logout that only clears the cookie.
- Password change without the current password, or without ending other sessions.
- Logging request bodies on auth routes.

### Rules of thumb

- One generic failure message, one status code, one code path cost.
- Limit per IP, per account and globally; make every limit expire on its own.
- Use the database's unique constraint for duplicate detection.
- Every security-relevant action produces an audit event with no secrets in it.
- Re-authenticate before sensitive changes, and end other sessions after them.

### Key takeaways

- Store a normalised identifier with a unique constraint, a nullable password hash, and an internal ID separate from identifiers.
- Defeat enumeration with uniform messages and a dummy hash for unknown users; sign-up and reset need email-based flows to be fully uniform.
- Rate limiting is layered (account, IP, global), temporary, and stored where all your processes can see it.
- Credential stuffing defeats simple per-account limits; breached-password checks, MFA and monitoring are the real answers.
- Log events, never secrets.


## 4. Sessions and tokens

After a successful login, every later request must prove it comes from the same authenticated person. This chapter covers the two main ways to do that, **server-side sessions** and **self-contained tokens (JWT)**, plus the browser mechanics that make either safe or unsafe: cookies, CSRF and XSS. By the end you should be able to choose a pattern for a given app and defend the choice.

### Server-side sessions

In a **server-side session**, the server generates a random session ID at login, stores a record that maps it to the user, and gives the ID to the browser in a cookie. On each request the server looks the ID up. The ID itself means nothing; all meaning lives on the server.

#### Generating session IDs

The ID must be unguessable. Use Python's `secrets` module, which draws from the operating system's cryptographically secure random number generator (CSPRNG). Never use `random`, timestamps, user IDs, UUID version 1, or hashes of predictable data.

```python
import secrets
token = secrets.token_urlsafe(32)  # 32 random bytes = 256 bits, URL-safe text
```

OWASP asks for at least 64 bits of entropy; 128 to 256 bits is common and costs nothing. As in chapter 3, store only `sha256(token)` in the database, so a leaked sessions table does not contain usable tokens.

#### Where to store sessions

| Store | Pros | Cons |
|---|---|---|
| SQL table (SQLite, Postgres) | Durable, queryable ("list my devices"), no extra service | One read per request; cleanup job needed for expired rows |
| Redis | Very fast, native expiry, shared across servers | Another service; data loss on restart unless persistence is on |
| In-memory dict | Trivial | Everyone is logged out on restart; one process only |
| Signed cookie (all data in the cookie) | No server storage | Cannot revoke individual sessions; size limits; this is really a token, not a server-side session |

For most apps under tens of thousands of active users, a SQL table with an index on the token hash is perfectly fast.

#### Expiry: idle and absolute timeouts

Sessions need two clocks:

- **Idle timeout**: the session ends after a period with no activity. It limits the damage from a forgotten logged-in device.
- **Absolute timeout**: the session ends a fixed time after login, however active. It limits how long a stolen token is useful and forces periodic re-authentication.

Values depend on risk. A bank might use 10 minutes idle and 8 hours absolute. A language-learning app on a personal phone can reasonably use 14 days idle and 60 to 90 days absolute, because the cost of a stolen session is low and logging in on a phone is annoying. Choose deliberately and write the numbers down.

#### Rotation and session fixation

**Session fixation** is an attack where the attacker gets a victim to use a session ID the attacker already knows (for example by planting a cookie through a subdomain or a URL parameter), then waits for the victim to log in. If the server keeps the same ID after login, the attacker's copy is now authenticated.

The fix is simple: **always issue a brand-new session ID at login**, and delete the old one. Do the same whenever privilege changes: after a password change, after enabling MFA, and when an admin starts impersonating someone. Never accept session IDs from URL parameters.

#### Logout and "log out everywhere"

Logout deletes the server record and clears the cookie. "Log out everywhere" deletes all session records for the user. Because sessions live on the server, both take effect instantly, which is the single biggest advantage of server-side sessions over stateless tokens.

Store a little metadata (created time, last seen, user agent, coarse IP) so you can show users a "devices" list with a button to revoke each one.

#### A session implementation for FastAPI

This builds on the schema and helpers from chapter 3 and adds idle timeouts, throttled activity updates, and reusable dependencies.

```python
# sessions.py - server-side sessions as FastAPI dependencies
import sqlite3
from fastapi import Cookie, Depends, HTTPException, Request, Response
import security as sec
from db import get_db, now

COOKIE_NAME = "__Host-session"
IDLE_TIMEOUT = 14 * 24 * 3600
ABSOLUTE_TIMEOUT = 60 * 24 * 3600
TOUCH_EVERY = 300  # only write last_seen_at every 5 minutes, to save writes

def issue_session(db: sqlite3.Connection, user_id: int, request: Request,
                  response: Response, old_token: str | None = None) -> None:
    if old_token:  # rotation: the pre-login or pre-change ID dies here
        db.execute("DELETE FROM sessions WHERE token_hash = ?", (sec.token_hash(old_token),))
    token, t = sec.new_token(), now()
    db.execute("INSERT INTO sessions (token_hash, user_id, created_at, last_seen_at,"
               " expires_at, user_agent, ip) VALUES (?, ?, ?, ?, ?, ?, ?)",
               (sec.token_hash(token), user_id, t, t, t + ABSOLUTE_TIMEOUT,
                request.headers.get("user-agent", "")[:200],
                request.client.host if request.client else None))
    db.commit()
    response.set_cookie(COOKIE_NAME, token, max_age=ABSOLUTE_TIMEOUT, path="/",
                        httponly=True, secure=True, samesite="lax")

def optional_user(db: sqlite3.Connection = Depends(get_db),
                  token: str | None = Cookie(default=None, alias=COOKIE_NAME)):
    """Returns the user row or None. Never raises for 'not logged in'."""
    if not token or len(token) > 100:
        return None
    th, t = sec.token_hash(token), now()
    row = db.execute(
        "SELECT s.last_seen_at, s.expires_at, u.* FROM sessions s"
        " JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?", (th,)).fetchone()
    if row is None:
        return None
    expired = row["expires_at"] <= t or row["last_seen_at"] + IDLE_TIMEOUT <= t
    if expired or row["status"] != "active":
        db.execute("DELETE FROM sessions WHERE token_hash = ?", (th,))
        db.commit()
        return None
    if t - row["last_seen_at"] > TOUCH_EVERY:
        db.execute("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?", (t, th))
        db.commit()
    return row

def require_user(user=Depends(optional_user)):
    if user is None:
        raise HTTPException(401, "Not logged in.")  # fail closed
    return user

def require_admin(user=Depends(require_user)):
    if user["role"] != "admin":
        raise HTTPException(403, "Forbidden.")
    return user

def logout_everywhere(db: sqlite3.Connection, user_id: int) -> int:
    cur = db.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    db.commit()
    return cur.rowcount
```

Using it is one line per route, and the security decision is visible in the signature:

```python
from fastapi import FastAPI, Depends
from sessions import require_user, require_admin

app = FastAPI()

@app.get("/api/me")
def me(user=Depends(require_user)):
    return {"display_name": user["display_name"]}

@app.get("/api/admin/users")
def list_users(admin=Depends(require_admin)):
    ...
```

A good secure default is to put `require_user` on a whole router (`APIRouter(dependencies=[Depends(require_user)])`) and create public routes on a separate router, so a forgotten dependency means "requires login" rather than "public".

Run a periodic cleanup, for example at startup and once a day: `DELETE FROM sessions WHERE expires_at < ? OR last_seen_at < ?`.

### Cookies in depth

A **cookie** is a small name and value the server asks the browser to store and send back on later requests to the same site. Session security depends heavily on the attributes you set.

```http
Set-Cookie: __Host-session=Qm9vb...; Path=/; Max-Age=5184000; HttpOnly; Secure; SameSite=Lax
```

| Attribute | What it does | Recommended |
|---|---|---|
| `HttpOnly` | JavaScript cannot read the cookie via `document.cookie` | Always, for session cookies |
| `Secure` | Sent only over HTTPS | Always in production |
| `SameSite=Lax` | Not sent on cross-site subrequests or cross-site POSTs; sent on top-level navigations (clicking a link) | Good default |
| `SameSite=Strict` | Never sent on any cross-site request, even clicking a link from another site | Extra-sensitive apps; users arriving from a link appear logged out on the first page |
| `SameSite=None` | Sent on all cross-site requests; requires `Secure` | Only for genuine cross-site use (embedded widgets, a frontend on a different site) |
| `Domain` | Shares the cookie with subdomains | Omit it, so the cookie is host-only |
| `Path` | Restricts which paths get the cookie | `/` for sessions; a narrow path for refresh tokens |
| `Max-Age` / `Expires` | Persistent cookie; without them it is a session cookie deleted when the browser fully closes | Match your absolute timeout |

#### What "site" means for SameSite

For SameSite, a **site** is the registrable domain plus scheme: `app.rankwise.example` and `api.rankwise.example` are the same site, while `rankwise.example` and `evil.example` are different sites. That is broader than an **origin** (scheme, host and port must all match). Keep this in mind: a vulnerable sibling subdomain counts as same-site.

#### SameSite defaults changed

Historically, cookies without a SameSite attribute were sent on every cross-site request, which made CSRF easy. Starting in 2020, Chrome (and other Chromium browsers) began treating cookies without the attribute as `Lax` by default, with a short-lived exception that allows top-level cross-site POSTs for about two minutes after the cookie is set. Firefox and Safari have their own protections but did not adopt the same default uniformly. Never rely on defaults: set `SameSite` explicitly.

#### The `__Host-` prefix

A cookie whose name starts with `__Host-` is only accepted by the browser if it has `Secure`, `Path=/`, and no `Domain`, and was set from an HTTPS page. That guarantees the cookie is host-only and cannot be overwritten by a subdomain or by an insecure page, which shuts down several cookie-injection and fixation tricks. There is also `__Secure-`, which only requires `Secure`. Use `__Host-` for session cookies whenever you serve over HTTPS.

#### Cookies on plain HTTP

Browsers refuse to set `Secure` cookies from `http://` pages, with an exception for `localhost`. So an app served at `http://192.168.1.4:8766` cannot use `Secure` or `__Host-` cookies at all. That is one of several reasons (along with passwords crossing the Wi-Fi unencrypted) why chapter 11 adds local HTTPS for Rankwise.

### CSRF

**Cross-site request forgery (CSRF)** is when a malicious site makes the victim's browser send a request to your site. The browser automatically attaches your site's cookies, so your server sees an authenticated request the user never intended.

```text
1. Victim is logged in to rankwise.example (session cookie stored).
2. Victim visits evil.example, which contains:
   <form action="https://rankwise.example/api/reset-progress" method="POST"> ... auto-submit
3. Browser sends the POST to rankwise.example WITH the session cookie.
4. Server sees a valid session and resets the victim's progress.
```

The attacker cannot read the response (the same-origin policy blocks that), but they do not need to: the side effect has happened.

CSRF only matters when the browser attaches credentials automatically, which means cookies (and HTTP basic auth). If your API uses `Authorization: Bearer` headers that JavaScript adds explicitly, a cross-site form cannot add them, so CSRF does not apply. That is a real advantage of bearer tokens, paid for with the XSS risk discussed below.

#### When SameSite is enough

`SameSite=Lax` stops cross-site POST, PUT, PATCH and DELETE requests from carrying the cookie. If you follow two rules, Lax alone defeats classic CSRF:

1. **No state changes on GET.** Lax still sends cookies on top-level GET navigations, so `GET /api/delete?id=3` remains vulnerable. GET must be safe and read-only.
2. **No vulnerable same-site neighbours.** SameSite cannot protect against attacks from another subdomain of the same site, because it is the same site.

Also remember older browsers and in-app web views may not honour SameSite. For a public app, add a second layer.

#### Second layers

**Check the Origin or Fetch Metadata headers.** Browsers send an `Origin` header on cross-origin and on POST requests, and modern browsers send `Sec-Fetch-Site` (`same-origin`, `same-site`, `cross-site`, or `none`). Rejecting unsafe-method requests whose `Sec-Fetch-Site` is `cross-site`, or whose `Origin` is not yours, is simple and effective. OWASP's CSRF cheat sheet now describes Fetch Metadata as a solid primary defence for modern browsers.

**Require a custom header on API calls.** Plain HTML forms cannot set custom headers, and a cross-origin `fetch` with a custom header triggers a CORS preflight that your server will refuse (as long as you do not enable permissive CORS). Requiring `X-Requested-With: rankwise` on every unsafe request is a cheap guard for JSON APIs.

**Synchronizer token pattern.** The server generates a random CSRF token per session, stores it with the session, and embeds it in pages or sends it to the frontend. Every unsafe request must include it (in a header or form field), and the server compares it with the stored copy. An attacker's site cannot read it.

**Signed double-submit cookie.** For stateless setups: the server sets a cookie containing a random value plus an HMAC of that value bound to the session ID. The frontend reads the cookie (so it is *not* HttpOnly) and copies it into a header. The server checks that header and cookie match and that the HMAC is valid for this session. The older "naive" double-submit (just comparing a cookie and a header with no signature) is weaker, because an attacker who can write cookies (via a subdomain) can set both.

A small middleware that combines Fetch Metadata, Origin checking and a custom header:

```python
# csrf.py - defence in depth for cookie-authenticated JSON APIs
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

ALLOWED_ORIGINS = {"https://rankwise.example"}
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

def install_csrf_guard(app: FastAPI) -> None:
    @app.middleware("http")
    async def csrf_guard(request: Request, call_next):
        if request.method not in SAFE_METHODS:
            site = request.headers.get("sec-fetch-site")
            origin = request.headers.get("origin")
            if site is not None and site not in ("same-origin", "none"):
                return JSONResponse({"detail": "Cross-site request blocked."}, 403)
            if origin is not None and origin not in ALLOWED_ORIGINS:
                return JSONResponse({"detail": "Bad origin."}, 403)
            # Custom header: HTML forms cannot send it; cross-origin fetch needs CORS.
            if request.headers.get("x-requested-with") != "rankwise":
                return JSONResponse({"detail": "Missing CSRF header."}, 403)
        return await call_next(request)
```

The frontend adds `headers: {"X-Requested-With": "rankwise"}` to every `fetch`. Exempt nothing by accident: if you need an endpoint that external services POST to (a webhook), authenticate it a different way and mount it outside this guard deliberately.

### XSS and where to keep tokens

**Cross-site scripting (XSS)** is when an attacker gets their JavaScript to run in your page, typically by injecting it through content your app displays without escaping (a display name like `<img src=x onerror=...>`). Script running in your page can do anything your page can do.

Where you store the session token decides how bad XSS is:

| Storage | Readable by injected script? | Sent automatically? | Notes |
|---|---|---|---|
| HttpOnly cookie | No | Yes (needs CSRF defence) | Script can still make requests *while the page is open*, but cannot take the token away |
| localStorage / sessionStorage | Yes | No | Script can copy the token to the attacker, who uses it from anywhere until it expires |
| JavaScript memory (a variable) | Yes, with effort | No | Lost on reload; often paired with a refresh token in an HttpOnly cookie |

The key insight: with an HttpOnly cookie, XSS is still serious, but the attack ends when the victim closes the tab. With localStorage, the attacker exfiltrates a token and keeps using it. That is why OWASP and most security reviewers advise against keeping long-lived tokens in localStorage.

Prevent XSS itself, too: escape all output (use `textContent`, never `innerHTML`, for user data in plain JS), set a **Content Security Policy** (CSP) header that forbids inline scripts, and keep dependencies minimal.

### JWT in depth

A **JSON Web Token (JWT)**, defined in RFC 7519, is a compact, signed set of claims. The server can verify it without a database lookup, because the signature proves the server (or a trusted issuer) created it and nobody changed it.

#### Structure

A JWT is three base64url-encoded parts separated by dots: `header.payload.signature`.

```text
Header:   {"alg": "HS256", "typ": "JWT", "kid": "2026-11"}
Payload:  {"iss": "https://rankwise.example", "aud": "rankwise-api", "sub": "42",
           "iat": 1763200000, "exp": 1763200900, "jti": "q3Jk...", "role": "learner"}
Signature: HMAC-SHA256(base64url(header) + "." + base64url(payload), key)
```

The payload is **encoded, not encrypted**. Anyone holding the token can read it. Never put secrets or sensitive personal data in a JWT.

Registered claims you should use:

| Claim | Meaning | Validate? |
|---|---|---|
| `iss` | Issuer: who created the token | Must equal your expected issuer |
| `aud` | Audience: who the token is for | Must include your service, so a token for another API is refused |
| `sub` | Subject: the user ID (a string) | Required |
| `exp` | Expiry time (epoch seconds) | Must be in the future (with small leeway) |
| `nbf` | Not before | Must be in the past |
| `iat` | Issued at | Useful for "tokens issued before password change are invalid" |
| `jti` | Unique token ID | Enables deny-lists and replay detection |

#### Signing: HS256 versus RS256 and EdDSA

- **HS256** (HMAC with SHA-256) uses one shared secret to sign and verify. Simple and fast. Anyone who can verify can also forge, so only use it when the same service (or tightly trusted services) both issue and verify.
- **RS256** (RSA) and **ES256** (ECDSA) use a private key to sign and a public key to verify. Many services can verify without being able to forge. Identity providers like Google use these, and publish their public keys at a **JWKS** (JSON Web Key Set) URL.
- **EdDSA** (Ed25519) is a modern asymmetric option with small keys and fast, misuse-resistant signatures. Support across libraries and providers is good but not universal.

For a single FastAPI backend, HS256 with a strong random key (at least 32 bytes) is fine. Once a second service must verify tokens, switch to asymmetric signing.

#### The `alg` pitfalls

The header says which algorithm was used, and the header is attacker-controlled. Two famous attacks follow:

- **`alg: none`**: the JWT spec allows unsigned tokens. Libraries that honoured the header would accept a token with the signature removed and `"alg": "none"`. Anyone could forge anything.
- **Algorithm confusion**: a server expects RS256 and verifies with its *public* key. The attacker changes the header to HS256 and signs with the public key as the HMAC secret. A naive library uses "the key" with "the header's algorithm" and the forgery verifies.

The defence is the same for both: **the verifier decides the algorithm, never the token**. In PyJWT, `algorithms=[...]` is a required argument to `decode` for exactly this reason. Pass a single expected algorithm. PyJWT also refuses to use PEM-formatted public keys as HMAC secrets, but do not rely on library details: pin the algorithm.

#### The revocation problem

A JWT is valid until it expires, because nothing is checked except the signature and claims. If a user logs out, changes their password, or is banned, an already-issued JWT keeps working. Options:

1. **Short lifetimes.** Access tokens that live 5 to 15 minutes limit the window.
2. **A deny-list** of revoked `jti` values, checked on every request. This reintroduces a lookup, which removes much of the point of a stateless token.
3. **A per-user "tokens valid after" timestamp**, compared with `iat`. One cached lookup per user; revokes all of a user's tokens at once.

The common production design combines short-lived access JWTs with long-lived, revocable refresh tokens.

#### Access and refresh tokens with rotation and reuse detection

- The **access token** is a short-lived JWT sent in `Authorization: Bearer`. The API verifies it statelessly.
- The **refresh token** is a long-lived, random, opaque value, stored hashed on the server, used only at a refresh endpoint to get a new access token.
- **Rotation**: each time a refresh token is used, it is marked used and a new one is issued.
- **Reuse detection**: if a refresh token that was already used is presented again, someone has a copy. You cannot tell whether the attacker or the user is presenting it, so you revoke the whole **token family** (every refresh token descended from the same login). Both parties must log in again; only the real user can.

The RFC 9700 OAuth security best practice describes this pattern for public clients. Note the one practical complication: two browser tabs refreshing at the same moment can look like reuse. Coordinate refreshes in the frontend (one refresh in flight at a time), or allow a very short grace period during which the immediately previous token returns the same new token.

#### Implementation with PyJWT

```python
# tokens.py - access JWTs (PyJWT) and rotating refresh tokens with reuse detection
# pip install "pyjwt[crypto]"
import os
import secrets
import time
import jwt
import security as sec

ISSUER, AUDIENCE = "https://rankwise.example", "rankwise-api"
ACCESS_TTL = 10 * 60                 # 10 minutes
REFRESH_TTL = 30 * 24 * 3600         # family lifetime
# Keys keyed by ID so they can rotate (chapter 10). 32+ random bytes each.
KEYS = {"2026-11": os.environ["JWT_KEY_2026_11"]}
CURRENT_KID = "2026-11"

def issue_access_token(user_id: int, role: str) -> str:
    t = int(time.time())
    claims = {"iss": ISSUER, "aud": AUDIENCE, "sub": str(user_id), "role": role,
              "iat": t, "nbf": t, "exp": t + ACCESS_TTL, "jti": secrets.token_urlsafe(12)}
    return jwt.encode(claims, KEYS[CURRENT_KID], algorithm="HS256",
                      headers={"kid": CURRENT_KID})

def verify_access_token(token: str) -> dict:
    """Raises jwt.InvalidTokenError (or a subclass) on any problem."""
    kid = jwt.get_unverified_header(token).get("kid")  # only used to pick a key
    key = KEYS.get(kid)
    if key is None:
        raise jwt.InvalidTokenError("unknown key id")
    return jwt.decode(
        token, key,
        algorithms=["HS256"],          # pinned: the token cannot choose
        audience=AUDIENCE, issuer=ISSUER,
        options={"require": ["exp", "iat", "nbf", "sub", "iss", "aud"]},
        leeway=30,                     # tolerate small clock skew
    )

REFRESH_SCHEMA = """
CREATE TABLE IF NOT EXISTS refresh_tokens (
    token_hash  TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id   TEXT NOT NULL,
    expires_at  INTEGER NOT NULL,      -- inherited from the family's first login
    used_at     INTEGER,
    revoked_at  INTEGER
);
CREATE INDEX IF NOT EXISTS refresh_family ON refresh_tokens(family_id);
"""

def new_refresh_token(db, user_id: int, family_id: str | None = None,
                      expires_at: int | None = None) -> str:
    token = secrets.token_urlsafe(32)
    db.execute("INSERT INTO refresh_tokens (token_hash, user_id, family_id, expires_at)"
               " VALUES (?, ?, ?, ?)",
               (sec.token_hash(token), user_id, family_id or secrets.token_urlsafe(12),
                expires_at or int(time.time()) + REFRESH_TTL))
    db.commit()
    return token
```

The rotation function is where reuse detection lives:

```python
class RefreshError(Exception):
    pass

def rotate_refresh_token(db, presented: str) -> tuple[int, str]:
    """Consume a refresh token; return (user_id, new_refresh_token)."""
    t = int(time.time())
    th = sec.token_hash(presented)
    row = db.execute("SELECT * FROM refresh_tokens WHERE token_hash = ?", (th,)).fetchone()
    if row is None:
        raise RefreshError("unknown token")
    if row["revoked_at"] is not None or row["expires_at"] <= t:
        raise RefreshError("revoked or expired")
    # Mark used atomically: only one request can win this UPDATE.
    cur = db.execute("UPDATE refresh_tokens SET used_at = ? WHERE token_hash = ?"
                     " AND used_at IS NULL", (t, th))
    if cur.rowcount != 1:
        # Already used: a copy exists somewhere. Kill the whole family.
        db.execute("UPDATE refresh_tokens SET revoked_at = ? WHERE family_id = ?",
                   (t, row["family_id"]))
        db.commit()
        raise RefreshError("reuse detected; family revoked")
    db.commit()
    new = new_refresh_token(db, row["user_id"], row["family_id"], row["expires_at"])
    return row["user_id"], new

def revoke_all_for_user(db, user_id: int) -> None:
    db.execute("UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ?"
               " AND revoked_at IS NULL", (int(time.time()), user_id))
    db.commit()
```

And the FastAPI wiring. The refresh token lives in an HttpOnly cookie scoped to the refresh path, so it is never visible to JavaScript and never sent to other endpoints. The access token is returned in the response body and kept in a JavaScript variable.

```python
# api.py - wiring tokens.py into FastAPI
import jwt
from fastapi import Cookie, Depends, FastAPI, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from db import get_db
import tokens

app = FastAPI()
bearer = HTTPBearer(auto_error=False)
REFRESH_COOKIE = "__Host-refresh"   # __Host- requires Path=/; see note below

def require_claims(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict:
    if creds is None:
        raise HTTPException(401, "Missing token.", headers={"WWW-Authenticate": "Bearer"})
    try:
        return tokens.verify_access_token(creds.credentials)
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token.", headers={"WWW-Authenticate": "Bearer"})

@app.post("/auth/refresh")
def refresh(response: Response, db=Depends(get_db),
            rt: str | None = Cookie(default=None, alias=REFRESH_COOKIE)):
    if not rt:
        raise HTTPException(401, "No refresh token.")
    try:
        user_id, new_rt = tokens.rotate_refresh_token(db, rt)
    except tokens.RefreshError:
        response.delete_cookie(REFRESH_COOKIE, path="/", secure=True, httponly=True)
        raise HTTPException(401, "Please log in again.")
    role = db.execute("SELECT role FROM users WHERE id = ? AND status = 'active'",
                      (user_id,)).fetchone()
    if role is None:
        raise HTTPException(401, "Please log in again.")
    response.set_cookie(REFRESH_COOKIE, new_rt, max_age=tokens.REFRESH_TTL, path="/",
                        httponly=True, secure=True, samesite="strict")
    return {"access_token": tokens.issue_access_token(user_id, role["role"]),
            "token_type": "bearer", "expires_in": tokens.ACCESS_TTL}

@app.get("/api/me")
def me(claims: dict = Depends(require_claims)):
    return {"user_id": claims["sub"], "role": claims["role"]}
```

Notes on this design:

- `SameSite=Strict` on the refresh cookie plus the CSRF guard from earlier protects the refresh endpoint, which is the only cookie-authenticated route.
- The `__Host-` prefix forces `Path=/`. If you want the refresh cookie sent only to `/auth/refresh`, use a `__Secure-refresh` name with `path="/auth/refresh"` instead; that trades the host-only guarantee for narrower exposure.
- The role is read fresh from the database at each refresh, so a role change takes effect within one access-token lifetime.
- Login issues the first refresh token with `new_refresh_token(db, user_id)` and sets the cookie; logout calls `revoke_all_for_user` or revokes the family.

### Opaque tokens versus JWT

An **opaque token** is a random string with no meaning on its own, like a session ID. The server looks it up. A JWT is **self-contained**: the meaning is inside it.

| Property | Opaque token / server session | JWT access token |
|---|---|---|
| Verification | Database or cache lookup | Signature check, no lookup |
| Revocation | Instant: delete the row | Only at expiry, unless you add a lookup |
| Size | Small (around 43 characters) | Larger (hundreds of bytes), grows with claims |
| Readable by holder | No | Yes (base64), never put secrets inside |
| Works across many services | Each needs the store | Any service with the key or public key |
| Failure mode of key leak | Not applicable | Attacker can mint tokens for anyone |
| Operational complexity | Low | Moderate: key rotation, clock skew, refresh logic |

### When each pattern fits

| Situation | Recommended pattern | Why |
|---|---|---|
| One backend, browser frontend on the same site (Rankwise) | Server-side session in HttpOnly cookie | Simplest, instant revocation, no token in JS |
| Native mobile app talking to your API | Opaque or JWT access token plus rotating refresh token, stored in the OS keychain | No cookie jar to rely on; secure storage exists |
| Many microservices verifying users | Short JWT access tokens (asymmetric), refresh at a central auth service | Services verify without calling auth on every request |
| Third parties calling your API | OAuth 2.0 access tokens (often JWT) with scopes | Standard, delegable, revocable at the issuer |
| Frontend and API on different sites | Prefer putting them on the same site via a reverse proxy; otherwise bearer tokens | Cross-site cookies need SameSite=None and are increasingly restricted |

### Pitfalls

- Generating session IDs with `random` or `uuid1`.
- Not rotating the session ID at login (fixation).
- Changing state on GET, which bypasses SameSite=Lax.
- Long-lived JWTs in localStorage, readable by any XSS.
- `jwt.decode` without pinning `algorithms`, or with `options={"verify_signature": False}` left in from debugging.
- Not validating `aud` and `iss`, so a token for a different service is accepted.
- Treating JWT logout as done because the client forgot the token.
- Refresh tokens without rotation, or rotation without reuse detection.

### Decision guide

- Default for a web app with one backend: server-side sessions in `__Host-` HttpOnly, Secure, SameSite=Lax cookies, plus a CSRF guard.
- Choose JWTs when you have a concrete need for stateless verification across services, and then keep them short-lived with rotating refresh tokens.
- Pick timeouts from risk: idle and absolute, written down.
- Rotate the session at login and at privilege changes.

### Key takeaways

- A session token is as valuable as a password: random from `secrets`, stored hashed, rotated at login, revocable.
- HttpOnly, Secure, SameSite and the `__Host-` prefix together make cookies the safest place for browser session tokens.
- CSRF is the price of cookies: SameSite=Lax plus no state-changing GETs plus an Origin, Fetch Metadata or custom-header check.
- JWTs trade revocation for statelessness; pin the algorithm, validate `iss`, `aud` and `exp`, and keep them short.
- Rotating refresh tokens with family-wide revocation on reuse turns token theft into a detectable event.


## 5. Forgot password and account recovery

Every authentication system needs a way back in for people who lose their password or device. Recovery is also, by design, a way to get into an account *without* the normal credential. That makes it one of the most attacked parts of any system. This chapter shows how to build recovery that helps real users without giving attackers an easier door.

### The principle: recovery is authentication too

A password reset flow is an alternative login method. Its strength is the strength of whatever it relies on: usually control of an email inbox. If an attacker can reset a password with less effort than guessing it, your password policy is irrelevant.

So when you design recovery, ask the same questions as for login: what does the person have to prove, how easily can someone else prove it, how is it rate-limited, and what is logged?

### The reset-token flow done right

The standard flow sends a single-use link to the account's verified email address.

```text
User                    Server                         Email inbox
 |  POST /auth/reset/request {email}                       |
 |----------------------->|                                |
 |                        | look up user (silently)        |
 |                        | create random token T          |
 |                        | store sha256(T), user, expiry  |
 |                        | send link with T ------------->|
 |  "If an account exists, we sent a link."                |
 |<-----------------------|                                |
 |                  user opens link from inbox             |
 |  GET /reset?token=T  (page with new-password form)      |
 |  POST /auth/reset/confirm {token: T, new_password}      |
 |----------------------->|                                |
 |                        | find row by sha256(T)          |
 |                        | check unused, unexpired        |
 |                        | set new hash, mark used        |
 |                        | delete ALL sessions + tokens   |
 |                        | send "password changed" notice |
 |  "Password updated. Please log in."                     |
 |<-----------------------|                                |
```

Each property matters:

| Property | Why |
|---|---|
| Random token from `secrets` (at least 128 bits) | Cannot be guessed or derived from the user ID or time |
| Store only its hash | A database leak does not give attackers working reset links |
| Short expiry (15 to 60 minutes) | Limits the window if the email is read later by someone else |
| Single use | A link found in browser history or a forwarded email cannot be replayed |
| Bound to one user | A token cannot be used to reset a different account |
| Invalidated when the password changes by any route | An old link stops working once the user logs in and changes their password normally |
| Ends all sessions after reset | If an attacker was logged in, the reset kicks them out |
| Uniform response to the request | Does not reveal which emails have accounts |
| Rate limited per email and per IP | Prevents inbox flooding and token-guessing |

#### Further details

- **Do not log the user in automatically after reset.** It is tempting, but asking them to log in with the new password confirms they know it and keeps the flow simple. Many large services do auto-login; if you do, create a fresh session and still revoke all old ones.
- **Do not change anything at request time.** Requesting a reset must not disable the current password. Otherwise anyone could lock any user out by requesting resets.
- **Keep the token out of logs and Referer headers.** A token in a URL query string can leak through server access logs, browser history, analytics scripts and the `Referer` header sent to third-party resources on the reset page. Mitigations: serve the reset page with `Referrer-Policy: no-referrer`, load no third-party scripts on it, and configure access logs to drop query strings on that route. Some apps put the token in the URL fragment (`#token=...`), which browsers never send to servers, and have JavaScript post it.
- **Build the link from configuration, not from the request's Host header.** If you construct the URL from `request.headers["host"]`, an attacker can send a reset request with `Host: evil.example` and the victim receives a genuine email with a link to the attacker's site, carrying a valid token. This is **host header injection**. Use a fixed `BASE_URL` setting.
- **Require MFA after reset** if the account has it enabled. A reset proves inbox control, not possession of the second factor.

### Implementation

The schema adds one table:

```sql
CREATE TABLE IF NOT EXISTS password_resets (
    token_hash  TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL,
    used_at     INTEGER
);
CREATE INDEX IF NOT EXISTS password_resets_user ON password_resets(user_id);
```

Email sending, with a console fallback for development. It uses only the standard library (`smtplib`, `email.message`).

```python
# mailer.py - SMTP with STARTTLS, or print to console when SMTP is not configured
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage

log = logging.getLogger("mailer")
SMTP_HOST = os.environ.get("SMTP_HOST")          # e.g. your provider's SMTP endpoint
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")  # from env/secrets, never in code
MAIL_FROM = os.environ["MAIL_FROM"]              # sender address on your own domain

def send_email(to: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = MAIL_FROM, to, subject
    msg.set_content(body)
    if not SMTP_HOST:
        # Development only: print instead of sending. Never enable in production,
        # because console output usually ends up in logs, and this contains a token.
        print(f"--- EMAIL to {to} ---\nSubject: {subject}\n\n{body}\n---")
        return
    context = ssl.create_default_context()        # verifies the server certificate
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
            smtp.starttls(context=context)        # encrypt before sending credentials
            if SMTP_USER:
                smtp.login(SMTP_USER, SMTP_PASSWORD or "")
            smtp.send_message(msg)
    except (smtplib.SMTPException, OSError):
        log.exception("email send failed (subject=%s)", subject)  # no body: it has a token
```

The two endpoints. Sending happens in a FastAPI background task, so the response time is the same whether or not the account exists.

```python
# reset.py - password reset request and confirm
import os
import sqlite3
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel, Field
import security as sec
from db import audit, get_db, now
from mailer import send_email
from ratelimit import SlidingWindowLimiter

router = APIRouter()
BASE_URL = os.environ.get("BASE_URL", "https://rankwise.example")  # never from Host header
RESET_TTL = 30 * 60
per_ip = SlidingWindowLimiter(10, 3600)
per_email = SlidingWindowLimiter(3, 3600)
UNIFORM = {"message": "If an account exists for that address, we have sent a reset link."}

class ResetRequestIn(BaseModel):
    email: str = Field(max_length=254)

@router.post("/auth/reset/request")
def reset_request(body: ResetRequestIn, request: Request, tasks: BackgroundTasks,
                  db: sqlite3.Connection = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    email_n = sec.normalize_email(body.email)
    if not per_ip.hit(ip):
        raise HTTPException(429, "Too many requests. Try again later.")
    if not per_email.hit(email_n):
        return UNIFORM                     # silently drop: same answer, no flood
    row = db.execute("SELECT id, email FROM users WHERE email_normalized = ?"
                     " AND status = 'active'", (email_n,)).fetchone()
    if row is None:
        audit(db, "reset_requested", None, ip, "unknown_user")
        return UNIFORM                     # identical response for unknown emails
    token, t = sec.new_token(), now()
    db.execute("INSERT INTO password_resets (token_hash, user_id, created_at, expires_at)"
               " VALUES (?, ?, ?, ?)", (sec.token_hash(token), row["id"], t, t + RESET_TTL))
    db.commit()
    link = f"{BASE_URL}/reset#token={token}"   # fragment: never sent to servers or Referer
    tasks.add_task(send_email, row["email"], "Reset your Rankwise password",
                   f"Someone asked to reset your password.\n\nOpen this link within 30 "
                   f"minutes:\n{link}\n\nIf this was not you, ignore this email.")
    audit(db, "reset_requested", row["id"], ip)
    return UNIFORM
```

```python
class ResetConfirmIn(BaseModel):
    token: str = Field(min_length=20, max_length=100)
    new_password: str = Field(max_length=1024)

@router.post("/auth/reset/confirm")
def reset_confirm(body: ResetConfirmIn, request: Request, tasks: BackgroundTasks,
                  db: sqlite3.Connection = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    if not per_ip.hit("confirm:" + ip):
        raise HTTPException(429, "Too many requests. Try again later.")
    if problem := sec.password_problem(body.new_password):
        raise HTTPException(422, problem)
    th, t = sec.token_hash(body.token), now()
    # Claim the token atomically: unused, unexpired, and only one request can win.
    cur = db.execute("UPDATE password_resets SET used_at = ? WHERE token_hash = ?"
                     " AND used_at IS NULL AND expires_at > ?", (t, th, t))
    if cur.rowcount != 1:
        db.commit()
        raise HTTPException(400, "This link is invalid or has expired. Request a new one.")
    row = db.execute("SELECT u.id, u.email FROM password_resets r JOIN users u"
                     " ON u.id = r.user_id WHERE r.token_hash = ?", (th,)).fetchone()
    db.execute("UPDATE users SET password_hash = ?, password_changed_at = ?, updated_at = ?"
               " WHERE id = ?", (sec.hash_password(body.new_password), t, t, row["id"]))
    db.execute("DELETE FROM sessions WHERE user_id = ?", (row["id"],))         # kick everyone
    db.execute("DELETE FROM password_resets WHERE user_id = ? AND token_hash != ?",
               (row["id"], th))                                             # other links die
    db.commit()
    tasks.add_task(send_email, row["email"], "Your Rankwise password was changed",
                   "Your password was just changed. If this was not you, reset it now "
                   "and contact us.")
    audit(db, "reset_completed", row["id"], ip)
    return {"message": "Password updated. Please log in."}
```

Also delete outstanding reset tokens in the normal change-password endpoint, so "invalidate on password change" holds for every route. If you use refresh tokens (chapter 4), revoke them here as well.

The reset page itself (served at `/reset`) reads the token from `location.hash`, shows a new-password form, and posts both to the confirm endpoint. Serve it with `Referrer-Policy: no-referrer` and no third-party scripts.

### Email verification

**Email verification** confirms that a user controls the address they registered with. It uses the same token mechanics as reset: a random token, stored hashed, with expiry, sent as a link. On confirmation, set `email_verified_at`.

Why it matters:

- Until verified, the address may belong to someone else (a typo, or deliberate). Do not send password resets to unverified addresses unless the account has no other way in, and never use an unverified email to link accounts (chapter 6).
- It prevents people from signing others up for spam.
- If the user changes their email, the new address is unverified until confirmed. Keep the old address active until then, and notify the old address about the change. An attacker with a stolen session who changes the email and then resets the password has taken over the account; notifying the old address and requiring re-authentication for email changes are the defences.

Expiry can be longer than for resets (24 hours is common) because a verification link grants less power.

### Magic links and one-time codes

A **magic link** logs the user in directly from an email, with no password. A **one-time code** (OTP) is a short number (often 6 digits) sent by email that the user types in.

| Method | Pros | Cons |
|---|---|---|
| Magic link | No password to forget, leak or reuse; simple for users | Every login depends on email; links opened on a different device from where login started; email scanners may "click" links and consume them |
| Email one-time code | Works across devices (read on phone, type on laptop); scanners cannot consume it | Short codes must be rate-limited strictly; phishable (attacker relays the code) |

Implementation notes:

- Magic links follow the reset-token pattern: random, hashed, short expiry (10 to 15 minutes), single use.
- To defeat link scanners that pre-fetch URLs, the link should open a page with a "Log me in" button that POSTs, rather than logging in on GET.
- A 6-digit code has only a million possibilities. Allow perhaps 5 attempts per code and then invalidate it, expire it in about 10 minutes, and compare in constant time. Generate it with `secrets.randbelow(10**6)` and format with leading zeros.
- Both turn your email provider into your authentication system. That is fine for many consumer apps; just be aware of it.

### Why security questions are bad

"What was your first pet's name?" has been abandoned by serious security guidance, and NIST SP 800-63B says not to use knowledge-based questions.

- **Guessable**: favourite colour has a handful of common answers.
- **Researchable**: mother's maiden name, school, and home town are often on social media or public records.
- **Unchangeable**: you cannot change your first pet after a leak.
- **Forgettable**: honest users forget whether they typed "Rex" or "rex the dog".
- **Shared**: family members know the answers, which matters in exactly the family-app setting.

If users must have a memorable fallback, recovery codes are strictly better.

### Recovery codes

**Recovery codes** are a set of random one-time codes (typically 8 to 10) generated when a user sets up an account or MFA. The user saves them somewhere safe (printed, or in a password manager). Each code can be used once to get back in.

```python
# recovery_codes.py - generate, store hashed, verify and consume
import secrets
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

ph = PasswordHasher()
ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"   # no 0/o, 1/l/i confusion

def generate_codes(n: int = 10) -> list[str]:
    # 10 chars from 31 symbols = about 49 bits each; shown to the user ONCE.
    return ["-".join("".join(secrets.choice(ALPHABET) for _ in range(5)) for _ in range(2))
            for _ in range(n)]

def store_codes(db, user_id: int, codes: list[str]) -> None:
    db.execute("DELETE FROM recovery_codes WHERE user_id = ?", (user_id,))  # replace old set
    db.executemany("INSERT INTO recovery_codes (user_id, code_hash) VALUES (?, ?)",
                   [(user_id, ph.hash(c)) for c in codes])   # hashed like passwords
    db.commit()

def use_code(db, user_id: int, submitted: str) -> bool:
    code = submitted.strip().lower().replace(" ", "")
    rows = db.execute("SELECT id, code_hash FROM recovery_codes WHERE user_id = ?"
                      " AND used_at IS NULL", (user_id,)).fetchall()
    for row in rows:
        try:
            ph.verify(row["code_hash"], code)
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            continue
        cur = db.execute("UPDATE recovery_codes SET used_at = strftime('%s','now')"
                         " WHERE id = ? AND used_at IS NULL", (row["id"],))
        db.commit()
        return cur.rowcount == 1    # single use, even under concurrent requests
    return False
```

The table is `recovery_codes(id INTEGER PRIMARY KEY, user_id INTEGER, code_hash TEXT, used_at INTEGER)`. Verifying up to 10 Argon2 hashes per attempt is slow by design; rate-limit the endpoint tightly (for example 5 attempts per hour per account). Because the codes have about 49 bits of entropy, a lighter hash would also be acceptable, but reusing the password hasher keeps one code path.

Show the codes once, let the user download or print them, and offer "generate new codes" (which invalidates the old set). Warn when only a few remain.

### Admin reset

An **admin reset** is when a trusted person resets a user's password or issues a one-time login. In a family app this is the parent; in a company it is the help desk.

Rules for doing it safely:

1. The admin never learns or sets the user's final password. Instead, generate a one-time reset link or temporary code that forces the user to choose a new password on first use, and expires quickly.
2. Log every admin reset with who did it, for whom, and when.
3. End the user's existing sessions.
4. Notify the user through any channel you have.
5. Admin accounts themselves should have stronger authentication (MFA, or passkeys), because an admin account is now a master key.

### Recovery when there is no email

On a home LAN app with no email sending (Rankwise phase 1), the email-based flow is unavailable. Options, from simplest:

| Option | How it works | Fits when |
|---|---|---|
| Admin reset | A parent account generates a one-time reset code shown on screen and gives it to the learner in person | Small, trusted group where people meet physically |
| Recovery codes | Each learner gets codes at account creation, printed and kept | Users are responsible enough to keep a paper |
| Server command line | `python manage.py reset-password taha` run by whoever has access to the Mac | The admin is the person who runs the server |
| Physical presence check | Reset only allowed from a specific device or the server machine itself | Shared household device as the root of trust |

Physical access to the Mac is already the ultimate control in a home setup: anyone who can open the progress files can change them. So an admin reset by the person who runs the server is not a weakness; it reflects the real trust model. Chapter 11 uses an admin reset plus a command-line fallback.

### Email deliverability basics

If reset emails land in spam, users cannot recover. If anyone can spoof your domain, attackers can send convincing fake reset emails. Three DNS-based standards address both:

- **SPF** (Sender Policy Framework): a DNS TXT record listing which servers may send mail for your domain.
- **DKIM** (DomainKeys Identified Mail): your mail server signs each message; receivers check the signature against a public key in your DNS.
- **DMARC** (Domain-based Message Authentication, Reporting and Conformance): a DNS policy telling receivers what to do when SPF or DKIM fail (nothing, quarantine or reject), and where to send reports. Large mailbox providers now expect bulk and transactional senders to have DMARC in place.

Send through a **transactional email provider** (services specialised in application email such as resets and receipts) rather than your own mail server or a personal mailbox. They handle reputation, bounces and authentication setup, typically for a free tier at small volumes. Prices and free tiers change, so check current offerings. Keep transactional mail on a separate subdomain or provider from marketing mail so marketing complaints do not hurt reset delivery.

Using a personal Gmail account's SMTP with an app password works for a tiny private app, but is against the spirit of most consumer terms for application use, has low sending limits, and ties your app to one person's account.

### Email as the master key

If password reset goes to email, then **whoever controls the user's inbox controls the account**. Your security is capped by the user's email security, which you do not control.

Mitigations:

- Encourage or require MFA or passkeys for valuable accounts; after an email-based reset, still require the second factor.
- Notify on security events (password changed, email changed, new device) to the email *and* in-app.
- When the email address changes, send a notice to the old address with a link to undo the change for a period (for example 7 days).
- Watch for reset requests followed immediately by email change: a classic takeover sequence.

### Support-desk social engineering

Many high-profile account takeovers did not break any technology. The attacker called or chatted with support, sounded convincing, and asked for the email or phone number to be changed. **Social engineering** is manipulating people rather than systems.

Defences are procedural:

- Write down what support may and may not do. "Support never changes the email address or disables MFA based on a conversation alone."
- Require proof that an attacker cannot easily get: a recovery code, a confirmation link sent to the existing verified email, or a waiting period with notifications to all known channels.
- Never let urgency, anger or claimed authority override the procedure. Attackers rely on exactly that.
- Log support actions on accounts, and review them.

For a family app, "support" is a parent. The same thinking applies, just less formally: a learner asking for a reset should be the actual learner.

### Pitfalls

- Different responses for known and unknown emails on the reset request.
- Storing reset tokens in plaintext.
- Reset links that never expire or can be used twice.
- Building reset links from the request's Host header.
- Not ending other sessions after reset.
- Disabling the old password at request time (lets anyone lock anyone out).
- Third-party analytics on the reset page leaking tokens via Referer or page URLs.
- Security questions as a fallback.

### Rules of thumb

- A reset token is a password with a timer: random, hashed, short-lived, single-use.
- Every recovery path must be at least as hard to abuse as the login it replaces.
- After any recovery: revoke sessions, notify the user, log the event.
- Without email, use admin resets and recovery codes, and match them to the real-world trust model.

### Key takeaways

- Recovery is an alternative authentication path and is often the weakest one.
- The correct reset flow: uniform response, random token stored hashed, 15 to 60 minute expiry, atomic single use, all sessions revoked, notification sent.
- Never use security questions; use recovery codes or admin resets instead.
- Email-based recovery makes the inbox the master key; MFA and change notifications reduce that risk.
- Social engineering targets people, so recovery needs written procedures, not just code.


## 6. Other ways to log in

Passwords are the default, but not the best option. This chapter covers the main alternatives and additions: signing in with another provider (OAuth 2.0 and OpenID Connect), passkeys (WebAuthn), time-based one-time passwords (TOTP) as a second factor, and simple PINs for family profiles. For each you will see how it works, how to implement it in Python, and when it is the right choice.

### OAuth 2.0 versus OpenID Connect

These two names are often used interchangeably, and they should not be.

**OAuth 2.0** (RFC 6749) is an **authorisation delegation** protocol. It lets a user allow one application to access their data at another service, without giving it their password. Example: "allow this photo printing site to read your Google Photos." The result is an **access token** for an API. OAuth on its own does not tell the application *who* the user is.

**OpenID Connect (OIDC)** is an **identity layer** built on top of OAuth 2.0. It adds an **ID token**: a signed JWT that states who the user is (`sub`), who issued the statement (`iss`), which app it is for (`aud`), and optionally their email and name. "Sign in with Google" is OIDC.

Using plain OAuth for login (for example, calling a profile API with an access token and trusting whatever comes back) has caused real vulnerabilities, because an access token issued to a *different* app can be replayed against yours. OIDC's ID token, with its `aud` claim, prevents that.

#### Roles

| Role | Meaning | In "Sign in with Google" for Rankwise |
|---|---|---|
| Resource owner | The user | Batul |
| Client (relying party in OIDC) | The app that wants access or identity | Rankwise server |
| Authorization server (OpenID provider) | Authenticates the user and issues tokens | Google's accounts service |
| Resource server | The API holding the data | Google's userinfo API (rarely needed with OIDC) |

A **confidential client** can keep a secret (a server-side app like Rankwise's FastAPI backend). A **public client** cannot (a pure browser app or mobile app, where any secret would be extractable).

#### The authorization code flow with PKCE, step by step

The **authorization code flow** is the recommended flow for every kind of client today. **PKCE** (Proof Key for Code Exchange, RFC 7636, pronounced "pixie") adds a one-time secret that binds the start and end of the flow together. It was originally for public clients, but current guidance (RFC 9700, the OAuth 2.0 Security Best Current Practice published in 2025, and the OAuth 2.1 draft) recommends it for all clients.

```text
Browser                    Rankwise server                  Google
  | click "Sign in with Google"                                |
  |------------------------->|                                 |
  |                          | create state, nonce,            |
  |                          | code_verifier (random)          |
  |                          | code_challenge = SHA256(verifier)|
  |                          | save state, nonce, verifier in  |
  |                          |   the user's pre-login session  |
  |  302 to Google /authorize?client_id&redirect_uri&scope=openid email
  |      &response_type=code&state&nonce&code_challenge&method=S256
  |<-------------------------|                                 |
  |---------------------------------------------------------->|
  |                 user logs in at Google, consents           |
  |  302 to https://rankwise.example/auth/google/callback?code=C&state=S
  |<----------------------------------------------------------|
  |------------------------->|                                 |
  |                          | check state == saved state      |
  |                          | POST /token: code C, client_id, |
  |                          |   client_secret, redirect_uri,  |
  |                          |   code_verifier  --------------->|
  |                          |                 check SHA256(verifier) == challenge
  |                          |<----- id_token (+ access_token) |
  |                          | validate id_token: signature    |
  |                          |   (Google JWKS), iss, aud, exp, |
  |                          |   nonce == saved nonce          |
  |                          | find or create local user,      |
  |                          | create Rankwise session         |
  |  Set-Cookie: __Host-session=...                            |
  |<-------------------------|                                 |
```

Why each piece exists:

- **The code is not the token.** The browser only ever sees a short-lived, single-use code. The token exchange happens server to server, authenticated with the client secret, so tokens never pass through the browser's address bar or history.
- **`state`** is a random value tied to the user's browser session. It defeats CSRF on the callback: without it, an attacker could make your browser complete a login with *their* code, logging you into *their* account (a "login CSRF"), so anything you then save goes to them.
- **PKCE** defeats **authorization code interception**: if an attacker steals the code (from logs, a malicious app registered for the same redirect, or a Referer leak), they cannot redeem it without the `code_verifier`, which never left your server.
- **`nonce`** goes into the ID token. Checking it proves the ID token was minted for *this* login attempt and is not a replayed old token.
- **Exact redirect URI matching** at the provider ensures the code is only ever delivered to your callback.

#### The implicit flow is deprecated

The older **implicit flow** returned tokens directly in the browser's URL fragment, with no code exchange. It was designed for browser apps before CORS was widespread. Tokens leaked through history and Referer headers, and there was no way to bind them to the client. RFC 9700 says not to use it; OAuth 2.1 removes it. If a tutorial uses `response_type=token`, it is out of date.

#### Validating the ID token

If you write this yourself, every check is mandatory:

1. Verify the signature using the provider's public keys from its JWKS endpoint (found via the discovery document at `/.well-known/openid-configuration`), with the algorithm pinned to what the provider uses (RS256 for Google).
2. `iss` equals the provider's issuer exactly.
3. `aud` contains your client ID (and if there are multiple audiences, `azp` equals your client ID).
4. `exp` is in the future, `iat` is reasonable.
5. `nonce` equals the one you stored for this login.
6. Use `sub` (combined with `iss`) as the stable user identifier. Never use the email as the key: emails can change and be reassigned.

A library such as Authlib does all of this for you, which is the main reason to use one.

#### Account linking pitfalls

**Account linking** is connecting a social login to an existing local account. Done naively, it is a takeover path.

The classic bug: "If a Google login arrives with an email matching an existing account, log into that account." Problems:

- Some providers let users set an unverified email. An attacker creates a provider account claiming Taha's address, signs in with it, and gets Taha's Rankwise account. Always check the `email_verified` claim is true, and be cautious even then with providers that are not authoritative for that email domain.
- The reverse attack: an attacker signs up on your site with a password using the victim's email (unverified), then later the victim signs in with Google and gets linked to an account the attacker also has the password for. Fix: only allow password sign-up accounts to be linked after their email is verified, or drop the password when linking an unverified account.

Safe linking rules:

- Store identities in a separate table keyed by `(provider, sub)`, pointing at your `users.id`.
- Auto-link by email only when the provider asserts `email_verified` and your local account's email is also verified. Otherwise, require the user to log in to the existing account first and link from its settings.
- Notify the user when a new login method is linked.

#### Sign in with Google in FastAPI using Authlib

Authlib's Starlette integration handles discovery, state, nonce, PKCE, the token exchange and ID token validation. It stores the temporary state in Starlette's signed session cookie, which requires `SessionMiddleware` (and the `itsdangerous` package).

```python
# google_login.py
# pip install authlib httpx itsdangerous fastapi "uvicorn[standard]"
import os
from authlib.integrations.starlette_client import OAuth, OAuthError
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse
from starlette.middleware.sessions import SessionMiddleware

app = FastAPI()
# Signed cookie holding state/nonce/PKCE verifier between redirect and callback.
app.add_middleware(SessionMiddleware, secret_key=os.environ["OAUTH_STATE_SECRET"],
                   https_only=True, same_site="lax", max_age=600)

oauth = OAuth()
oauth.register(
    name="google",
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_id=os.environ["GOOGLE_CLIENT_ID"],
    client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
    client_kwargs={"scope": "openid email profile",
                   "code_challenge_method": "S256"},   # enable PKCE
)
BASE_URL = os.environ.get("BASE_URL", "https://rankwise.example")

@app.get("/auth/google/start")
async def google_start(request: Request):
    # Fixed redirect URI that exactly matches the one registered with Google.
    return await oauth.google.authorize_redirect(request, f"{BASE_URL}/auth/google/callback")

@app.get("/auth/google/callback")
async def google_callback(request: Request):
    try:
        # Checks state, exchanges the code with the PKCE verifier, and validates the
        # ID token (signature via JWKS, iss, aud, exp, nonce).
        token = await oauth.google.authorize_access_token(request)
    except OAuthError:
        raise HTTPException(400, "Sign-in failed. Please try again.")
    info = token.get("userinfo") or {}
    sub, email = info.get("sub"), info.get("email")
    if not sub:
        raise HTTPException(400, "Sign-in failed.")
    user_id = find_or_link_user(
        provider="google", sub=sub, email=email,
        email_verified=bool(info.get("email_verified")),
    )
    request.session.clear()                      # drop the temporary OAuth state
    response = RedirectResponse("/", status_code=303)
    create_app_session(user_id, request, response)  # your session code from chapter 4
    return response
```

A sketch of the linking logic, following the safe rules above:

```python
def find_or_link_user(provider: str, sub: str, email: str | None, email_verified: bool) -> int:
    db = connect()
    try:
        row = db.execute("SELECT user_id FROM identities WHERE provider = ? AND sub = ?",
                         (provider, sub)).fetchone()
        if row:
            return row["user_id"]                       # known identity: just log in
        existing = None
        if email and email_verified:
            existing = db.execute(
                "SELECT id FROM users WHERE email_normalized = ? AND email_verified_at"
                " IS NOT NULL", (normalize_email(email),)).fetchone()
        if existing:
            user_id = existing["id"]                    # both sides verified: safe to link
        elif email and not email_verified:
            raise HTTPException(400, "Please verify your email with the provider first.")
        else:
            user_id = create_user_without_password(db, email, email_verified)
        db.execute("INSERT INTO identities (provider, sub, user_id, created_at)"
                   " VALUES (?, ?, ?, strftime('%s','now'))", (provider, sub, user_id))
        db.commit()
        return user_id
    finally:
        db.close()
```

`create_user_without_password`, `create_app_session`, `connect` and `normalize_email` are the helpers from chapters 3 and 4. If an unverified local account with the same email exists, `create_user_without_password` will hit the unique constraint: handle that by asking the user to log in to the existing account and link from settings.

Google's console requires you to register the exact redirect URI and, for production, a verified domain. Google sign-in does not work for an app reached only by a private IP address, because redirect URIs must be `localhost` or a real domain; this matters for Rankwise phase 1.

### Passkeys and WebAuthn

A **passkey** is a public-key credential that replaces a password. It is created and stored by an **authenticator**: the phone's or computer's secure hardware, a password manager, or a USB security key. The underlying standard is **WebAuthn** (Web Authentication, a W3C specification) together with the FIDO2 protocols.

#### How public-key login works

1. At registration, the authenticator creates a new key pair specifically for your site. The **private key** never leaves the authenticator. Your server stores only the **public key** and a credential ID.
2. At login, your server sends a random **challenge**. The authenticator asks the user to unlock it (fingerprint, face, device PIN), then signs the challenge with the private key.
3. Your server verifies the signature with the stored public key.

Why this is a big improvement:

- **Nothing reusable on your server.** A database leak exposes public keys, which are useless to an attacker.
- **Phishing-resistant.** The browser binds each credential to your domain (the **relying party ID**, RP ID). A look-alike site cannot get a signature for your domain, no matter how convincing it is. This is the property passwords, SMS and TOTP all lack.
- **No shared secret to guess.** Online guessing attacks do not apply.
- **Built-in second factor.** Possession of the device plus the biometric or device PIN that unlocks it.

#### Registration ceremony

WebAuthn calls its two flows **ceremonies**.

1. The logged-in (or signing-up) user clicks "Create a passkey".
2. The server generates registration options: RP ID and name, a user handle (a random per-user ID, not the email), a fresh challenge, supported algorithms, and preferences such as "require user verification" and "create a discoverable credential". It stores the challenge in the session.
3. The browser calls `navigator.credentials.create()` with the options. The authenticator creates a key pair and returns the public key, credential ID, and a signed attestation structure.
4. The server verifies the response: challenge matches, origin and RP ID match, user verification happened, then stores credential ID, public key, sign count and transports.

#### Authentication ceremony

1. The user clicks "Sign in with a passkey" (or the browser offers it in autofill, called **conditional UI**).
2. The server generates authentication options: a fresh challenge, the RP ID, and optionally a list of allowed credential IDs (empty for discoverable credentials, so the user picks an account).
3. The browser calls `navigator.credentials.get()`. The authenticator signs the challenge.
4. The server finds the credential by ID, verifies the signature, challenge, origin, RP ID and user verification flag, updates the sign count, and creates a session.

#### Implementation with py_webauthn

The `webauthn` package (py_webauthn, maintained by Duo Labs) handles option generation and verification. The browser side needs a small amount of JavaScript to call `navigator.credentials` and convert between base64url and binary; the `@simplewebauthn/browser` library is a common helper.

```python
# passkeys.py - server side of WebAuthn ceremonies
# pip install webauthn
from webauthn import (generate_authentication_options, generate_registration_options,
                      options_to_json, verify_authentication_response,
                      verify_registration_response)
from webauthn.helpers.structs import (AuthenticatorSelectionCriteria,
                                      PublicKeyCredentialDescriptor,
                                      ResidentKeyRequirement, UserVerificationRequirement)

RP_ID = "rankwise.example"            # a registrable domain, never an IP address
RP_NAME = "Rankwise"
ORIGIN = "https://rankwise.example"   # must be HTTPS (localhost is the only exception)

def start_registration(session: dict, user_handle: bytes, username: str,
                       existing_cred_ids: list[bytes]) -> str:
    options = generate_registration_options(
        rp_id=RP_ID, rp_name=RP_NAME,
        user_id=user_handle,           # random bytes stored on the user, not the email
        user_name=username,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.REQUIRED,        # discoverable passkey
            user_verification=UserVerificationRequirement.REQUIRED),
        exclude_credentials=[PublicKeyCredentialDescriptor(id=c) for c in existing_cred_ids],
    )
    session["webauthn_challenge"] = options.challenge   # one-time, server-side
    return options_to_json(options)                     # send to the browser

def finish_registration(session: dict, credential_json: str) -> dict:
    challenge = session.pop("webauthn_challenge", None)   # pop: single use
    if challenge is None:
        raise ValueError("no registration in progress")
    v = verify_registration_response(
        credential=credential_json, expected_challenge=challenge,
        expected_rp_id=RP_ID, expected_origin=ORIGIN, require_user_verification=True)
    # Store these against the user; raises on any verification failure above.
    return {"credential_id": v.credential_id, "public_key": v.credential_public_key,
            "sign_count": v.sign_count}

def start_login(session: dict) -> str:
    options = generate_authentication_options(
        rp_id=RP_ID, user_verification=UserVerificationRequirement.REQUIRED)
    session["webauthn_challenge"] = options.challenge
    return options_to_json(options)

def finish_login(session: dict, credential_json: str, stored: dict) -> int:
    """`stored` is the credential row found by the credential ID in the response."""
    challenge = session.pop("webauthn_challenge", None)
    if challenge is None:
        raise ValueError("no login in progress")
    v = verify_authentication_response(
        credential=credential_json, expected_challenge=challenge,
        expected_rp_id=RP_ID, expected_origin=ORIGIN,
        credential_public_key=stored["public_key"],
        credential_current_sign_count=stored["sign_count"],
        require_user_verification=True)
    return v.new_sign_count   # save it; the library rejects a count that went backwards
```

To find the stored credential at login, parse the `id` (or `rawId`) field from the browser's JSON response, base64url-decode it, and look it up in your `passkeys` table (`credential_id BLOB PRIMARY KEY, user_id, public_key BLOB, sign_count INTEGER, created_at, last_used_at, nickname`). The `session` here is a server-side pre-login session or Starlette's signed session; the challenge must not be accepted from the client.

#### Sync passkeys

Modern passkeys are usually **synced**: Apple's iCloud Keychain, Google Password Manager and third-party password managers copy them across the user's devices, end-to-end encrypted. This solved the biggest early problem of WebAuthn (lose the device, lose the account). The trade-off: the passkey's security now also depends on the user's cloud account. **Device-bound** passkeys on hardware security keys never leave the device, which is stronger but needs a backup key.

Sign counts are usually zero for synced passkeys, because several devices share one credential. Do not treat a zero counter as an error.

#### Fallback and recovery

Plan for users who lose all their passkey-holding devices, or switch ecosystems (iPhone to Android):

- Let users register multiple passkeys, and encourage it.
- Keep a recovery path: email-based recovery, recovery codes, or an admin reset (chapter 5).
- After recovery, prompt the user to create a new passkey.
- Do not delete a user's password the moment they add a passkey unless you are confident in recovery; many sites keep both for a while.

#### Constraints worth knowing

- WebAuthn requires a **secure context**: HTTPS, or `http://localhost`.
- The RP ID must be a domain name. **IP addresses are not allowed.** An app at `https://192.168.1.4` cannot use passkeys; you need a hostname (a real domain pointing at the private IP, or a local name with a trusted certificate).
- Android Chrome supports passkeys well via Google Password Manager and third-party providers.

### TOTP two-factor authentication

**TOTP** (time-based one-time password, RFC 6238) is the 6-digit code from authenticator apps.

#### How TOTP works

1. At enrolment the server generates a random secret (typically 160 bits) and shares it with the user's app, usually via a QR code containing an `otpauth://` URI.
2. Both sides compute `HMAC-SHA1(secret, floor(current_unix_time / 30))`, then truncate the result to 6 digits.
3. At login, the server computes the expected code and compares. Because clocks drift, it usually also accepts the previous and next 30-second window.

The code proves possession of the secret without sending it. But the secret is shared: the server must store it in a form it can use (not hashed), so a database leak exposes TOTP secrets. Encrypt them at rest with a key held outside the database.

#### Implementation with pyotp

```python
# totp.py - enrolment, QR code and verification
# pip install pyotp "qrcode[pil]"
import io
import time
import pyotp
import qrcode

def start_enrolment(username: str) -> tuple[str, str, bytes]:
    secret = pyotp.random_base32()     # store encrypted, mark as "pending" until confirmed
    uri = pyotp.TOTP(secret).provisioning_uri(name=username, issuer_name="Rankwise")
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return secret, uri, buf.getvalue()  # show the PNG and the secret text once

def confirm_enrolment(secret: str, code: str) -> bool:
    # The user proves their app works before 2FA is switched on.
    return pyotp.TOTP(secret).verify(code.strip(), valid_window=1)

def verify_login_code(secret: str, code: str, last_used_step: int | None) -> int | None:
    """Return the accepted time step, or None. Rejects reuse within the window."""
    totp = pyotp.TOTP(secret)
    code = code.strip()
    now_step = int(time.time()) // totp.interval
    for step in (now_step - 1, now_step, now_step + 1):   # tolerate ~30 s clock drift
        if last_used_step is not None and step <= last_used_step:
            continue                          # replay protection: each code once
        if pyotp.utils.strings_equal(totp.at(step * totp.interval), code):
            return step                       # persist as last_used_step
    return None
```

Rules:

- Confirm enrolment with a valid code before enabling 2FA, or users lock themselves out with a mistyped scan.
- Rate-limit code attempts strictly (6 digits is a million possibilities, minus the window). For example 5 attempts per 15 minutes per account.
- Record the last accepted time step and reject codes at or before it, so a shoulder-surfed code cannot be reused within its window.
- Issue **backup codes** (the recovery codes from chapter 5) at enrolment.
- Ask for TOTP only after the password is verified, and do not reveal which of the two failed in a combined form.

#### Why SMS is weaker

SMS codes are better than nothing, but:

- **SIM swapping**: attackers convince a mobile carrier to move the victim's number to a new SIM.
- **Interception** through weaknesses in the phone network signalling (SS7) and malware on the phone.
- **Phishing** works just as well as for TOTP.
- **Cost and deliverability** are your problem, per message, per country.

NIST classifies SMS (and voice) as a "restricted" authenticator: allowed, but with extra obligations and warnings. TOTP is better; passkeys are better still, because they are the only common option that resists phishing.

### PIN per profile for family apps

Many family apps (streaming services, kids' learning apps) use a **profile picker** with an optional short PIN per profile, under one household account. This is a different security model: the PIN does not protect against the internet, it protects against siblings.

It is acceptable when all of these hold:

- The device or network is already gated (one household login, or the app is only reachable on the home LAN).
- The data behind each profile is low-sensitivity.
- The threat is a curious family member, not an attacker with a password list.
- PIN attempts are rate-limited on the server (a 4-digit PIN has only 10,000 values).

It is not acceptable once the app is reachable from the internet with only a PIN between an attacker and an account, or when profiles hold sensitive data. PINs should still be hashed with Argon2 (they are short, so the hash slows offline guessing only a little; rate limiting does the real work), and the server, not the client, must check them.

### Comparison of login methods

| Method | Phishing-resistant | Database leak impact | User friction | Recovery burden | Choose when |
|---|---|---|---|---|---|
| Password (Argon2id) | No | Offline cracking of weak passwords | Medium | Email or admin reset | Baseline; universally understood |
| Password + TOTP | No (codes can be relayed) | TOTP secrets exposed unless encrypted | High | Backup codes needed | Higher-value accounts, admins |
| Password + SMS | No | Phone numbers exposed | Medium | Depends on carrier | Only when users cannot use anything better |
| Magic link / email code | No | Nothing reusable stored | Medium (switch to email) | Email itself | Infrequent logins, low-value apps |
| Sign in with Google (OIDC) | Mostly (Google's own login protects it) | Nothing reusable stored | Low | Google's recovery | Public consumer apps; users already have accounts |
| Passkeys | Yes | Public keys only: nothing usable | Low once set up | Multiple passkeys plus a fallback | Modern default for public apps, needs a domain and HTTPS |
| Profile PIN | No | Short PINs crack quickly offline | Very low | Admin resets | Family apps on a trusted network only |

### Pitfalls

- Using plain OAuth access tokens for login instead of validating an OIDC ID token.
- Missing `state` or `nonce` checks; loose redirect URI matching.
- Auto-linking accounts on unverified email.
- Storing TOTP secrets in plaintext, or enabling TOTP without a confirmation code.
- Passkeys without any recovery path.
- Trying to use passkeys or Google sign-in on a bare IP address.
- Treating a profile PIN as real authentication on an internet-facing server.

### Decision guide

- Public consumer app: offer Google sign-in and passkeys, keep email-based recovery, and add password login only if your audience needs it.
- Admin accounts: passkeys or TOTP, always.
- Home LAN family app: passwords or PINs with server-side rate limiting; passkeys once you have a hostname and HTTPS.
- Never build OIDC validation by hand when a maintained library exists.

### Key takeaways

- OAuth delegates access; OpenID Connect proves identity with a signed ID token. Use OIDC for login.
- Use the authorization code flow with PKCE, `state` and `nonce`; the implicit flow is deprecated.
- Link social identities by `(provider, sub)`, and only auto-link verified emails on both sides.
- Passkeys are phishing-resistant and leave nothing useful in your database; plan recovery and remember they need a domain over HTTPS.
- TOTP is a solid second factor, SMS a weak one; profile PINs are fine only behind another gate.


## 7. Authorisation

Authentication tells you who is making a request. **Authorisation** decides whether they may do what they are asking. It is less glamorous than login and much more often broken: "broken access control" has been at or near the top of the OWASP Top 10 list of web application risks for years. The bugs are rarely subtle. They are usually a missing check on one endpoint.

### Authentication is not authorisation

A common, dangerous assumption is "if the user is logged in, the request is fine." Consider an API with this route:

```text
GET /api/state/{uid}     returns the learning progress of user {uid}
PUT /api/state/{uid}     replaces it
```

If the server only checks that *a* valid session exists, then Taha, logged in as Taha, can request `/api/state/batul` and read or overwrite Batul's progress. Taha is authenticated. Taha is not authorised for that resource. Both checks are needed on every request.

### IDOR: insecure direct object references

An **insecure direct object reference (IDOR)** is when an API uses an identifier from the request (a path parameter, query string or body field) to fetch an object, without checking that the requester may access that object. The identifier is "direct" because it points straight at the object, and "insecure" because nothing stands between the reference and the data.

#### The wrong way

```python
# WRONG: any logged-in user can read or overwrite any user's progress.
@app.get("/api/state/{uid}")
def get_state(uid: str, user=Depends(require_user)):
    return load_progress(uid)            # trusts the path parameter

@app.put("/api/state/{uid}")
def put_state(uid: str, body: dict, user=Depends(require_user)):
    save_progress(uid, body)             # same bug, now with writes
    return {"ok": True}
```

Using random, unguessable IDs (UUIDs) instead of names or integers makes the attack harder, but it is not a fix. IDs leak through URLs, logs, shared links and other API responses. **Obscurity is not authorisation.**

#### The fix, version 1: derive the target from the session

The simplest correct design for "my own data" endpoints is to not take a user ID from the client at all:

```python
# RIGHT: the target user comes from the session, never from the request.
@app.get("/api/state/me")
def get_my_state(user=Depends(require_user)):
    return load_progress(user["public_id"])

@app.put("/api/state/me")
def put_my_state(body: dict, user=Depends(require_user)):
    save_progress(user["public_id"], body)
    return {"ok": True}
```

There is nothing to tamper with. This pattern should be your default for personal data.

#### The fix, version 2: keep the parameter, check ownership

Sometimes you need the parameter, for example so that an admin or a parent can view someone else's progress. Then check every time, through one policy function:

```python
from fastapi import HTTPException

def can_view_progress(actor, target_uid: str) -> bool:
    if actor is None:
        return False
    if actor["public_id"] == target_uid:
        return True                      # owner
    if actor["role"] == "admin":
        return True                      # household admin may view
    return False                         # default deny

def can_edit_progress(actor, target_uid: str) -> bool:
    return actor is not None and actor["public_id"] == target_uid  # only the owner writes

@app.get("/api/state/{uid}")
def get_state(uid: str, user=Depends(require_user)):
    if not can_view_progress(user, uid):
        raise HTTPException(404, "Not found.")   # 404 avoids confirming the user exists
    return load_progress(uid)

@app.put("/api/state/{uid}")
def put_state(uid: str, body: dict, user=Depends(require_user)):
    if not can_edit_progress(user, uid):
        raise HTTPException(404, "Not found.")
    save_progress(uid, body)
    return {"ok": True}
```

Two details:

- **403 or 404?** `403 Forbidden` tells the requester the object exists. `404 Not Found` hides that. For personal data, 404 is usually better. For admin features where the user knows the object exists, 403 is clearer. Be consistent.
- **Validate the identifier format too.** If `uid` becomes part of a file path (`progress/<uid>.json`), an attacker could send `../users` and read other files. That is **path traversal**. Validate IDs against a strict pattern (for example `^[a-z0-9_-]{1,32}$`) and resolve the final path, checking it stays inside the data directory.

#### IDOR is not only about paths

The same bug appears in:

- Body fields: `{"lesson_id": 5, "owner_id": 7}` where the server trusts `owner_id`.
- **Mass assignment**: the client sends `{"display_name": "T", "role": "admin"}` and the server copies every field onto the user. Use explicit Pydantic models with only the fields a user may change.
- Nested resources: `/api/classes/3/students/9` where the server checks the user can see class 3 but not that student 9 is in class 3.
- List endpoints with filters: `/api/progress?user=batul`.
- Files and exports: `/downloads/report-42.pdf` served from a static folder with no check at all.

### Access control models

As apps grow, ad-hoc `if` statements become hard to reason about. Three models give structure.

#### RBAC: role-based access control

Users get **roles** (learner, admin, teacher); roles get **permissions** (`progress:read:any`, `users:manage`). Checks ask whether the user's role includes the permission.

```python
ROLE_PERMISSIONS = {
    "learner": {"progress:read:own", "progress:write:own"},
    "teacher": {"progress:read:own", "progress:write:own", "progress:read:class"},
    "admin":   {"progress:read:any", "users:manage", "users:reset_password"},
}

def has_permission(user, permission: str) -> bool:
    return permission in ROLE_PERMISSIONS.get(user["role"], set())   # unknown role: nothing
```

RBAC is easy to understand and audit. It breaks down when rules depend on relationships or context ("teachers can see students *in their own classes*"), which leads to role explosion (teacher_class_3, teacher_class_4...).

#### ABAC: attribute-based access control

Decisions are rules over **attributes** of the user, the resource, the action and the environment: "allow if `user.department == doc.department` and `action == read` and time is within working hours." ABAC handles context well but rules can become hard to review, and it is easy to write a policy whose consequences nobody fully understands.

#### ReBAC: relationship-based access control

Permissions follow **relationships** in a graph: user U is a *member* of family F; family F *owns* profile P; members of the owning family may *view* a profile. Google's Zanzibar paper popularised this model, and open-source systems such as OpenFGA and SpiceDB implement it. ReBAC fits sharing, organisations, folders and families naturally, at the cost of running and modelling another system.

| Model | Rules look like | Strengths | Weaknesses | Fits |
|---|---|---|---|---|
| RBAC | role has permission | Simple, auditable | Coarse; role explosion with context | Small apps, admin versus user |
| ABAC | rule over attributes | Flexible, contextual | Policies hard to reason about | Enterprise rules, compliance conditions |
| ReBAC | path in a relationship graph | Natural for sharing and hierarchies | Extra infrastructure and modelling | Documents, teams, families, multi-tenant SaaS |

Most real apps combine them: RBAC for global roles (admin), plus ownership or relationship checks for individual records. That is exactly what `can_view_progress` above does.

### Central policy functions versus scattered checks

**Scattered checks** put authorisation logic inline in each endpoint. They are easy to start with and easy to get wrong: one endpoint forgets, another implements a slightly different rule, and nobody can answer "who can see progress?" without reading every route.

A **central policy module** holds every rule in one place, as small pure functions named after the decision (`can_view_progress`, `can_reset_password`). Endpoints call them. Benefits:

- One place to read, review and test the rules.
- Each function can be unit-tested with a matrix of users and resources.
- Rule changes happen once.
- Default deny is enforced structurally: unknown cases return False.

```python
# policy.py - every authorisation decision lives here
def is_admin(actor) -> bool:
    return actor is not None and actor["role"] == "admin" and actor["status"] == "active"

def can_view_progress(actor, target_uid: str) -> bool:
    return actor is not None and (actor["public_id"] == target_uid or is_admin(actor))

def can_edit_progress(actor, target_uid: str) -> bool:
    return actor is not None and actor["public_id"] == target_uid

def can_reset_password(actor, target) -> bool:
    # Admins may reset others, but not other admins (limits a compromised admin).
    return is_admin(actor) and target["role"] != "admin" and actor["id"] != target["id"]
```

A policy test matrix is short and catches regressions:

```python
# test_policy.py  (pip install pytest)
import pytest
from policy import can_view_progress, can_edit_progress

TAHA = {"id": 1, "public_id": "taha", "role": "learner", "status": "active"}
BATUL = {"id": 2, "public_id": "batul", "role": "learner", "status": "active"}
ADMIN = {"id": 3, "public_id": "parent", "role": "admin", "status": "active"}

@pytest.mark.parametrize("actor,target,view,edit", [
    (TAHA, "taha", True, True),
    (TAHA, "batul", False, False),     # the IDOR case
    (ADMIN, "batul", True, False),     # admin can look, not overwrite
    (None, "taha", False, False),      # anonymous: deny
])
def test_progress_policy(actor, target, view, edit):
    assert can_view_progress(actor, target) is view
    assert can_edit_progress(actor, target) is edit
```

### FastAPI dependency patterns for authorisation

FastAPI's dependency injection lets you make authorisation part of the route signature, which makes missing checks visible in review.

#### Pattern 1: role or permission dependencies

```python
from fastapi import Depends, HTTPException
from sessions import require_user
from policy import is_admin

def require_permission(permission: str):
    def checker(user=Depends(require_user)):
        if not has_permission(user, permission):
            raise HTTPException(403, "Forbidden.")
        return user
    return checker

@app.get("/api/admin/users")
def list_users(admin=Depends(require_permission("users:manage"))):
    ...
```

#### Pattern 2: load-and-authorise dependencies

The dependency both fetches the resource and checks access, so the route body only ever receives objects the user may see. It is hard to forget, because without the dependency you have no object.

```python
import re
from pathlib import Path

DATA_DIR = Path("progress").resolve()
UID_RE = re.compile(r"^[a-z0-9_-]{1,32}$")

def progress_path(uid: str) -> Path:
    if not UID_RE.fullmatch(uid):
        raise HTTPException(404, "Not found.")
    path = (DATA_DIR / f"{uid}.json").resolve()
    if path.parent != DATA_DIR:                     # belt and braces against traversal
        raise HTTPException(404, "Not found.")
    return path

def viewable_progress(uid: str, user=Depends(require_user)) -> Path:
    if not can_view_progress(user, uid):
        raise HTTPException(404, "Not found.")
    return progress_path(uid)

def editable_progress(uid: str, user=Depends(require_user)) -> Path:
    if not can_edit_progress(user, uid):
        raise HTTPException(404, "Not found.")
    return progress_path(uid)

@app.get("/api/state/{uid}")
def get_state(path: Path = Depends(viewable_progress)):
    return json.loads(path.read_text()) if path.exists() else {}
```

#### Pattern 3: router-level defaults

Attach `dependencies=[Depends(require_user)]` to an `APIRouter` for all authenticated routes, and keep a separate, small router for public ones (login, sign-up, reset, static files). New routes are then protected by default.

#### Pattern 4: query scoping

For list endpoints, put the restriction in the query itself (`WHERE owner_id = ?` with the session's user ID) rather than fetching everything and filtering in Python. A forgotten filter in Python returns everything; a query that is always built with the owner condition cannot.

### Admin accounts and impersonation

**Admin accounts** are the most valuable targets in your system. Protect them more than ordinary accounts:

- Require a stronger authenticator (passkey or TOTP).
- Use shorter session timeouts and re-authentication for destructive actions.
- Keep the number of admins small; consider separating a person's everyday learner account from their admin account.
- Never let a user grant themselves a role; role changes require an existing admin and are audited.

**Impersonation** ("log in as user") lets an admin see the app as a user sees it, for support. Done carelessly, it is an untraceable superpower. Done safely:

1. Impersonation is an explicit action with a reason, requiring admin re-authentication.
2. It creates a **new, separate session** that records both identities: `actor_id` (the admin) and `subject_id` (the user). Never overwrite the admin's own session.
3. Every audit log entry during impersonation records both IDs.
4. The UI shows a persistent banner ("You are viewing as Batul. End impersonation.").
5. High-risk actions are blocked while impersonating: changing the password, email or MFA, viewing recovery codes, deleting the account.
6. The session is short-lived (for example 30 minutes) and cannot be extended.
7. Optionally, the user is notified or can see impersonation events in their activity log.

Read-only impersonation is often enough for support and removes most of the risk.

### Multi-tenant considerations

A **multi-tenant** app serves several separate customers (tenants: families, schools, companies) from one deployment and one database. Cross-tenant data leakage is the worst-case bug, because it exposes one customer's data to another.

- Put a `tenant_id` on every tenant-owned table, and include it in every query. Composite indexes start with `tenant_id`.
- Derive the tenant from the session, never from a request parameter alone. If a user can belong to several tenants, check membership on every request.
- Make IDs unique globally, not per tenant, to avoid accidental cross-tenant matches.
- Consider enforcing tenant isolation in the database with row-level security (below), so a missed `WHERE` clause cannot leak data.
- Caches, search indexes, file storage paths and background jobs all need the tenant in their keys. These are where leaks hide.
- Test explicitly: create two tenants in tests and assert that every endpoint refuses cross-tenant access.

### Database row-level security

**Row-level security (RLS)** is a database feature (in PostgreSQL and therefore Supabase) that filters which rows a query can see or change, based on a policy evaluated for the current database user or session. The application can forget a `WHERE` clause and the database still refuses to return other users' rows. It is defence in depth for authorisation.

In Supabase, the browser can query the database directly through an auto-generated API using the user's JWT. RLS is then not optional: **without it, the table is readable by anyone with your public key**. Supabase provides an `auth.uid()` function that returns the user ID from the verified JWT.

```sql
-- Progress rows belong to users. Each user sees and changes only their own.
create table public.progress (
    user_id    uuid primary key references auth.users (id) on delete cascade,
    state      jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

alter table public.progress enable row level security;   -- default deny once enabled

create policy "read own progress" on public.progress
    for select to authenticated
    using ((select auth.uid()) = user_id);

create policy "insert own progress" on public.progress
    for insert to authenticated
    with check ((select auth.uid()) = user_id);

create policy "update own progress" on public.progress
    for update to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);   -- cannot move a row to another user
```

Notes:

- `using` filters which existing rows are visible or targetable; `with check` validates new or changed rows. Updates need both, or a user could reassign their row to someone else.
- Wrapping `auth.uid()` in `(select ...)` lets Postgres evaluate it once per query instead of per row, which Supabase recommends for performance.
- Once RLS is enabled with no policies, nobody (except table owners and roles that bypass RLS) can access the table. That is fail-closed by design.
- The service role key bypasses RLS. Keep it on the server only, never in the browser.

With your own FastAPI server and Postgres, you can use RLS too: set a session variable per request (`SET LOCAL app.user_id = '...'` inside a transaction) and write policies against `current_setting('app.user_id')`. Your app must connect as a database role that does not own the tables and does not have `BYPASSRLS`, or the policies are skipped.

### Pitfalls

- Checking that a user is logged in but not that they own the object.
- Trusting IDs, owner fields or roles sent by the client; mass assignment of `role`.
- Using random IDs as the only protection.
- Building file paths from user input without validation.
- Inconsistent rules across endpoints because checks are scattered.
- Impersonation that silently replaces the admin's session and logs actions as the user.
- Enabling Supabase's direct database API without RLS, or shipping the service role key to the browser.

### Rules of thumb

- Default deny: an action is forbidden unless a policy function explicitly allows it.
- For "my data" endpoints, take the user from the session and accept no user ID at all.
- Put every rule in a policy module, call it through dependencies, and test it with a matrix.
- Scope queries by owner or tenant in the query itself; add RLS when the database is reachable from more than one code path.
- Treat admin power as a liability: fewer admins, stronger auth, full audit trail.

### Key takeaways

- Authentication without authorisation leaks everything; check both on every request.
- IDOR is the most common serious API bug: the fix is an ownership check on the server, not hidden or random IDs.
- RBAC suits coarse roles, ABAC suits contextual rules, ReBAC suits sharing and hierarchies; most apps mix RBAC with ownership checks.
- Central policy functions plus FastAPI dependencies make authorisation visible, testable and hard to forget.
- Row-level security moves the last line of defence into the database and is mandatory when clients query it directly.


## 8. Build vs buy

You now know enough to build authentication yourself. That does not mean you always should. This chapter compares doing it yourself in FastAPI with the main hosted and self-hosted identity products, and gives you a framework for deciding based on your conditions rather than on fashion.

One warning first: pricing, free tiers and features in this market change often. This chapter describes the *shape* of each offer. Check current pricing pages before deciding, and assume numbers you remember from a year ago are out of date.

### What "auth" actually includes

When comparing options, list everything you need, not just the login form:

- Sign-up, login, logout, password hashing and policy.
- Sessions or tokens, refresh, revocation, device lists.
- Email verification, password reset, email deliverability.
- Social login (Google, Apple), passkeys, MFA (TOTP, SMS).
- Rate limiting, bot protection, breached-password detection.
- Admin tools: find a user, disable, reset, impersonate.
- Audit logs, security alerts.
- Enterprise features: SSO with SAML or OIDC, SCIM provisioning, organisations.
- Compliance: data residency, certifications (SOC 2, ISO 27001), data processing agreements.

A provider covers most of the first half. **No provider covers your authorisation logic**, your API's ownership checks, or your app's session handling if you mint your own sessions. Chapters 4 and 7 remain your job either way.

### Option 1: DIY with FastAPI and libraries

You write the flows from chapters 2 to 7 using well-reviewed building blocks: argon2-cffi for hashing, `secrets` for tokens, PyJWT if you need JWTs, Authlib for OAuth and OIDC, pyotp, py_webauthn, slowapi.

**fastapi-users** is a library that packages registration, login, reset, verification and OAuth for FastAPI with pluggable database backends. It saves a lot of boilerplate, but its maintainer has put it into maintenance mode (security fixes, no new features). Read its current status before adopting it for a long-lived project; it is still a useful codebase to learn from.

| Aspect | Details |
|---|---|
| What you get | Full control, no external dependency, no per-user fees, works offline and on a LAN |
| What you still own | Everything: security of each flow, email sending, rate limiting, upgrades, incident response |
| Pricing shape | Your time plus hosting; email provider costs once you send email |
| Lock-in | None; your data and hashes are in your database |
| Privacy | Data stays wherever you host it |

Good fit: small apps, LAN or offline apps, learning, apps with unusual auth needs, and teams that already understand the material in this guide.

### Option 2: Supabase Auth

Supabase is a hosted Postgres platform with an integrated auth service (open source, so it can also be self-hosted). Users live in an `auth.users` table inside your own Postgres database. It issues JWTs that your API, and Postgres row-level security, can verify.

| Aspect | Details |
|---|---|
| What you get | Email and password, magic links, OTP, many social providers, phone login, MFA (TOTP), anonymous sign-ins, SAML SSO on paid plans, client libraries, JWTs usable with RLS |
| What you still own | RLS policies or API authorisation, verifying Supabase JWTs in FastAPI, email provider configuration for production volume, UI |
| Pricing shape | Free tier limited by monthly active users (MAU) and project limits; paid plans include a larger MAU allowance and charge per extra MAU; some features (SSO, advanced MFA) cost extra |
| Lock-in and migration | Low to moderate: the users table, including bcrypt password hashes, is in your Postgres database, so you can export it; the auth service itself is open source |
| Privacy and residency | Choose a region per project; standard data processing terms available |

Good fit: a public app that wants Postgres anyway, a small team, and an exit path. Its JWT approach means you must handle token refresh in the client and verify tokens server-side.

### Option 3: Firebase Authentication

Google's auth service, part of Firebase. It has polished client SDKs (web, Android, iOS) and integrates with Firestore security rules. The upgraded version with extra features is branded Identity Platform within Google Cloud.

| Aspect | Details |
|---|---|
| What you get | Email and password, email links, phone (SMS), many social providers, anonymous auth, MFA and SAML/OIDC with the Identity Platform upgrade, well-tested client SDKs |
| What you still own | Authorisation (security rules or your API), verifying Firebase ID tokens on your server with the Admin SDK, UI customisation |
| Pricing shape | Generous free usage for basic sign-in methods; per-MAU charges above thresholds on Identity Platform; SMS billed per message |
| Lock-in and migration | Moderate: the Firebase CLI can export users including password hashes, which use a modified scrypt with project-specific parameters; you need those parameters (available in the console) to verify them elsewhere |
| Privacy and residency | Google infrastructure; regional options are more limited than for some competitors; check current terms |

Good fit: mobile-first apps, apps already on Firebase, teams that want ready-made SDKs.

### Option 4: Auth0 (Okta)

Auth0, owned by Okta, is a full-featured identity platform with a strong enterprise story.

| Aspect | Details |
|---|---|
| What you get | Universal Login (hosted login pages), every common social provider, passkeys, MFA, breached-password detection, bot detection, enterprise SSO (SAML, OIDC, Active Directory), organisations for B2B, extensibility via Actions, extensive logs |
| What you still own | API authorisation, token validation, mapping Auth0 users to your data |
| Pricing shape | Free tier with an MAU limit; paid tiers priced by MAU and feature level; enterprise features and B2B organisations sit in higher tiers; costs can rise steeply as users grow |
| Lock-in and migration | Moderate to high: password hash export is not self-service and typically requires a support request on eligible plans; Auth0 does support importing hashes and lazy migration in |
| Privacy and residency | Regional tenants (for example US, EU, Australia); enterprise compliance certifications |

Good fit: B2B products needing enterprise SSO, teams that want breadth and are prepared to pay as they grow.

### Option 5: Clerk

Clerk focuses on developer experience, with prebuilt UI components and user management, strongest in the React and Next.js world but with a JavaScript SDK usable from plain JS.

| Aspect | Details |
|---|---|
| What you get | Prebuilt sign-in, sign-up and profile components, social login, passkeys, MFA, session management, organisations, a user dashboard |
| What you still own | Backend verification of Clerk session tokens, authorisation, the parts of your UI outside its components |
| Pricing shape | Free tier by monthly active users; per-MAU pricing above it; some features (advanced organisations, SSO) in paid add-ons |
| Lock-in and migration | Moderate: user export is available; check current documentation for whether password hashes are included in self-service export or need a request |
| Privacy and residency | US-centric infrastructure historically; check current residency options |

Good fit: React or Next.js frontends that want auth done in an afternoon. Less natural for a plain-JS PWA with a Python backend, though workable.

### Option 6: AWS Cognito

Amazon's user directory and OIDC provider, integrated with the rest of AWS.

| Aspect | Details |
|---|---|
| What you get | User pools, hosted UI, social and SAML federation, MFA, Lambda triggers for customisation, integration with API Gateway and AWS IAM |
| What you still own | A lot of configuration, UI polish, authorisation in your app, understanding Cognito's many quirks |
| Pricing shape | Per-MAU pricing with a free allowance that has varied by feature tier; advanced security features cost more |
| Lock-in and migration | High: **you cannot export password hashes**. Leaving means forcing password resets or running a lazy migration on login. Migrating *in* is supported via a migration Lambda trigger |
| Privacy and residency | Any AWS region, strong compliance programme |

Good fit: teams already deep in AWS who value integration over developer experience.

### Option 7: Keycloak (self-hosted)

Keycloak is a mature open-source identity and access management server (a CNCF project, originally from Red Hat), written in Java.

| Aspect | Details |
|---|---|
| What you get | OIDC and SAML provider, social login, MFA, passkeys/WebAuthn, user federation with LDAP and Active Directory, admin console, themes, fine-grained authorisation services |
| What you still own | Running it: deployment, upgrades, database, backups, high availability, security patches, theming its pages |
| Pricing shape | Free software; you pay for servers and operations time; commercial support available through Red Hat's build |
| Lock-in and migration | Low: you own the database, hashes (PBKDF2 or Argon2 depending on version and configuration) are exportable, standard protocols throughout |
| Privacy and residency | Wherever you run it |

Good fit: organisations needing a self-hosted, standards-based identity provider for several applications, or SSO with corporate directories, with people to operate it. Overkill for one small app. Lighter self-hosted alternatives include Authentik, Zitadel, Ory and Logto; evaluate them the same way.

### Summary comparison

| Option | Effort to start | Ongoing ops | Cost growth with users | Hash export | Works offline / LAN | Enterprise SSO |
|---|---|---|---|---|---|---|
| DIY FastAPI | High | You | Flat | Yes (yours) | Yes | Build it (hard) |
| Supabase Auth | Low | Low | Moderate | Yes (in your DB) | Self-hosted only | Paid plans |
| Firebase Auth | Low | Low | Low to moderate | Yes (modified scrypt) | No | With upgrade |
| Auth0 | Low | Low | Steep | On request | No | Yes, strong |
| Clerk | Very low (React) | Low | Moderate | Check docs | No | Paid |
| Cognito | Medium | Low to medium | Moderate | No | No | Yes |
| Keycloak | Medium to high | High | Flat (servers) | Yes | Yes | Yes, strong |

### Lock-in in practice

The hardest part of leaving a provider is passwords. If you can export hashes in a known format, users never notice the move: you verify old hashes with the old algorithm and rehash on login (chapter 2). If you cannot, your choices are:

- **Forced reset**: email everyone a reset link. Some users never return.
- **Lazy migration**: keep the old provider running; when a user logs in to your new system, check the password against the old provider's API and, if correct, hash it locally. Users who do not log in during the migration window still need resets.

Social logins migrate more easily (users sign in with Google again, and you match on the provider's `sub`), but note that `sub` values are per client for some providers, so moving to a new OAuth client registration can change them. Passkeys are bound to your domain (the RP ID), not the provider, if you control the domain. Keep your own user IDs in your own database from day one, mapped to the provider's IDs, so that the rest of your data never references a provider-specific identifier.

### A decision framework

#### Questions to ask

1. **How many users, now and in two years?** Ten, thousands or millions changes both cost and risk.
2. **Where does it run?** A LAN or offline environment rules out hosted providers.
3. **What is the budget?** Per-MAU pricing that looks free at 500 users can be a large bill at 50,000.
4. **What compliance applies?** Health, children's data, government or enterprise customers can require residency, certifications or specific MFA.
5. **What does the team know?** A provider does not make a team that does not understand sessions and authorisation safe.
6. **Do you need SSO or B2B features?** SAML SSO with customers' identity providers is hard to build well; buying it is usually right.
7. **How much lock-in can you accept?** Can you export hashes? Do you own the domain for passkeys?
8. **What happens when the provider is down?** With a hosted provider, an outage means nobody can log in.

#### Decision table

| Condition | Recommendation | Reason |
|---|---|---|
| LAN-only or offline, few users | DIY | No internet dependency, nothing to buy, simple flows suffice |
| Learning or hobby project | DIY, carefully | Best way to understand; low stakes |
| Public consumer app, small team, uses Postgres | Supabase Auth | Fast to ship, data in your DB, exit path exists |
| Mobile-first, already on Google Cloud or Firebase | Firebase Auth | Best SDKs for mobile, cheap at scale for basic methods |
| B2B SaaS with enterprise customers | Auth0 or a B2B-focused provider; Keycloak if self-hosting is required | SAML, SCIM and organisations are expensive to build |
| React or Next.js frontend, speed above all | Clerk | Fastest integration in that ecosystem |
| Deep AWS shop | Cognito, accepting the export limitation | Integration with IAM and API Gateway |
| Many internal apps, need self-hosted SSO | Keycloak | Standard protocols, owned data |
| Strict data residency and no third parties | DIY or self-hosted (Keycloak, Supabase self-hosted) | Data never leaves your infrastructure |

### Scenario walk-throughs

#### Family app on a Mac over Wi-Fi

Rankwise today: two learners, one server on a home network, no internet requirement, no email.

Hosted providers need internet access, a domain, and redirect URIs that are not private IPs; they add dependencies for no benefit. Build it yourself: Argon2id passwords or PINs, server-side sessions in SQLite, simple in-memory rate limiting, an admin reset by the parent. The entire auth layer is a few hundred lines that you fully understand. Chapter 11 has the detailed design.

#### Public freemium app with 10,000 users

Rankwise hosted publicly, mostly free users, a small paid tier, one developer.

Here the attack surface changes: bots, credential stuffing, email deliverability, password reset at volume, Google sign-in expectations. A hosted provider removes most of that work. Supabase Auth fits a FastAPI plus Postgres stack and keeps password hashes in your database, so the exit cost is low. At 10,000 MAU, check the current free and paid tier limits: a provider's free tier may or may not cover you, and the paid tier is usually modest at this size.

DIY remains viable if you enjoy it and are disciplined: you would need a transactional email provider, Redis or Postgres-backed rate limiting, breached-password checks, and monitoring. Budget a few weeks, plus ongoing attention.

#### B2B tool for schools

Teachers log in with their school's Google Workspace or Microsoft accounts; schools want SSO and admin control; children's data is involved.

Buy. You need OIDC and probably SAML federation per school, organisation management, audit logs, and a provider with clear data processing terms for education. Children's data adds legal obligations (for example GDPR's specific rules on children's consent, and in the US, COPPA). A provider with organisation support and compliance certifications saves months.

#### Startup that expects rapid growth on AWS

A team already running everything on AWS, expecting millions of users.

Cognito integrates neatly and is priced for scale, but the inability to export hashes is a long-term commitment. A team that values portability might pick a provider with hash export, or run its own auth service on Postgres with passkeys and social login as primary methods (which reduces the importance of password hashes altogether). Make the lock-in decision explicitly.

#### Hospital internal tools

Strict data residency, existing Active Directory, several internal web apps.

Self-host Keycloak (or the commercially supported build) federated with Active Directory, giving SSO across apps with data on-premises. You need staff to run it, but the alternative, building SSO across many apps yourself, is far worse.

### Pitfalls

- Choosing a provider and then assuming authorisation is handled.
- Not checking hash export before committing, then discovering a forced-reset migration is the only way out.
- Storing provider user IDs as primary keys throughout your data model.
- Ignoring provider outages: no fallback, no status monitoring.
- Building enterprise SSO yourself to save a subscription fee.
- Assuming "free tier" will stay free at your scale.

### Rules of thumb

- Build when the environment is unusual (LAN, offline), the scale small, or learning is the point.
- Buy when you need breadth (social, MFA, SSO, bot defence) faster than you can build it safely.
- Whatever you choose, own your user IDs, your authorisation and your domain.
- Prefer providers that let you export password hashes.

### Key takeaways

- Providers handle login flows, not your authorisation; that stays your responsibility.
- The real costs to compare are engineering time, per-MAU fees at your future scale, operational burden and exit cost.
- Hash exportability is the single most important lock-in question.
- For a LAN family app, DIY is clearly right; for a public app with a small team, a provider like Supabase Auth often is.
- Write down your conditions (users, hosting, budget, compliance, team, SSO) and let them drive the choice.


## 9. What can go wrong

This chapter is a catalogue of concrete failures. For each one you get four answers: what happens, how you would notice, how to prevent it, and how to respond if it happens anyway. Read it once end to end, then use it as a checklist when reviewing a design or code. The chapter closes with an incident response checklist for an authentication breach.

A recurring theme: **detection matters as much as prevention**. Many of these failures are survivable if you notice within hours and catastrophic if you notice after months.

### Data and secrets

#### 1. The database leaks

- **What happens.** An attacker obtains a copy of your users table (through SQL injection, a stolen backup, a misconfigured cloud bucket, or a compromised laptop). They start cracking password hashes offline and can read any unhashed secrets: emails, TOTP secrets, unhashed tokens.
- **How you'd notice.** Often you do not, until the data appears for sale, a researcher contacts you, or users report takeovers. Unusual large queries in database logs, unexpected outbound traffic, or access to backups from unknown places are early signals.
- **How to prevent.** Argon2id with strong parameters (chapter 2), optionally a pepper stored outside the database. Store session, reset and refresh tokens hashed. Encrypt TOTP secrets with a key kept elsewhere. Parameterised queries everywhere. Least-privilege database users. Encrypted backups with restricted access.
- **How to respond.** Follow the incident checklist at the end of this chapter: contain, revoke all sessions and tokens, force password resets prioritising accounts with weak or old hashes, rotate any secrets stored in the database, notify users and regulators within legal deadlines.

#### 2. Logs contain passwords or tokens

- **What happens.** A debug setting, request-logging middleware or error tracker records request bodies or headers. Passwords, `Authorization` headers, cookies or reset links land in log files, log aggregation services and error reports, which have far wider access than the database.
- **How you'd notice.** Search your logs periodically for patterns such as `password`, `Bearer `, `token=`, `__Host-session`. Add an automated test that logs in and asserts the password string does not appear in captured log output.
- **How to prevent.** Log explicit fields only. Configure error trackers to scrub sensitive keys (most have a denylist setting). Keep tokens out of URLs where possible; strip query strings from access logs on sensitive routes.
- **How to respond.** Treat logged secrets as compromised: revoke the sessions and tokens, force resets for users whose passwords were logged, purge the log entries everywhere they were shipped (including backups and third-party services), then fix the logging.

#### 3. Backups contain secrets

- **What happens.** Database dumps, disk snapshots or Time Machine backups contain password hashes, TOTP secrets and session tables. The `.env` file with your JWT key and SMTP password is in a backup or in Git history. Backups often have weaker protection than production.
- **How you'd notice.** Audit where backups go and who can read them. Secret-scanning tools (in GitHub, or tools such as gitleaks) find committed secrets.
- **How to prevent.** Encrypt backups; restrict access; keep secrets out of the code repository and out of the same backup as the data they protect (the pepper especially). Set retention limits so old backups expire. Sessions and reset tokens do not need backing up at all.
- **How to respond.** As for a database leak if the backup was exposed. For a committed secret, rotate it immediately; deleting the commit is not enough, because clones and caches exist.

#### 4. The JWT signing secret leaks

- **What happens.** Anyone with an HS256 secret (or an RS256 private key) can mint valid tokens for any user, including admins, with any expiry. Your API cannot tell forged tokens from real ones.
- **How you'd notice.** Tokens with `jti` values you never issued (if you log issued `jti`s), logins for users with no login events, admin actions nobody performed, the key appearing in a repository or log.
- **How to prevent.** Generate keys with `secrets.token_bytes(32)` or proper key generation, store them in a secrets manager or environment, never in code. Use key IDs (`kid`) so you can rotate. Prefer asymmetric keys when several services verify, so only the issuer holds the private key.
- **How to respond.** Generate a new key, deploy it with a new `kid`, and remove the old key from the verification set immediately (accepting that every user must refresh or log in again). Revoke all refresh tokens. Review audit logs for actions taken with forged tokens.

### Sessions and tokens

#### 5. A session cookie is stolen

- **What happens.** Malware on the user's device, a malicious browser extension, a shared computer, or interception over plain HTTP gives an attacker the session token. They use the account without the password, until the session ends.
- **How you'd notice.** The same session used from two very different IP addresses or user agents in a short time; a user reporting changes they did not make; a "new device" alert.
- **How to prevent.** HTTPS everywhere, `Secure`, `HttpOnly`, `SameSite`, `__Host-` cookies. Idle and absolute timeouts. Re-authentication for sensitive actions. A device list where users can revoke sessions. Session binding to device characteristics is weak (IPs change on mobile) but anomaly detection on drastic changes helps. Emerging standards such as Device Bound Session Credentials aim to tie cookies to device keys; watch their browser support.
- **How to respond.** Revoke the session (or all the user's sessions), have the user change their password if anything suggests wider compromise, review the account's recent activity and undo changes.

#### 6. XSS steals tokens or acts as the user

- **What happens.** Injected JavaScript runs in your page. If tokens are in localStorage, it sends them to the attacker, who uses them from anywhere until expiry. With HttpOnly cookies, it cannot read the token but can still make requests as the user while the page is open.
- **How you'd notice.** Content Security Policy violation reports (if you configured a `report-to` endpoint), strange content in user-supplied fields, users reporting odd behaviour.
- **How to prevent.** Escape output (`textContent`, not `innerHTML`, in plain JS), validate input, set a strict CSP without `unsafe-inline`, keep tokens out of localStorage, keep third-party scripts to a minimum and pin them with Subresource Integrity where possible.
- **How to respond.** Remove the injected content, fix the injection point, revoke all sessions and tokens that could have been exposed (all users who viewed the content), and review actions taken during the exposure window.

#### 7. `alg: none` or algorithm confusion in JWT

- **What happens.** The verifier trusts the token's `alg` header. An attacker sends an unsigned token (`alg: none`) or re-signs an RS256 token as HS256 using the public key as the secret. The forged token is accepted.
- **How you'd notice.** Tokens with unexpected `alg` values in logs; a security test that tries these attacks.
- **How to prevent.** Always pass a fixed `algorithms=[...]` list to `jwt.decode`. Use a maintained library at a current version. Add a test that confirms a token with `alg: none` and one re-signed with the wrong algorithm are both rejected.
- **How to respond.** Patch, rotate keys, revoke refresh tokens, and audit for forged-token activity as for a leaked key.

#### 8. Clock skew breaks TOTP or JWT validation

- **What happens.** The server's clock drifts, or a container starts with the wrong time. TOTP codes are rejected for everyone (codes come from the wrong 30-second window), JWTs appear expired or not yet valid, and users cannot log in. Conversely, a clock far behind accepts expired tokens.
- **How you'd notice.** A sudden spike in TOTP failures or `ExpiredSignatureError`/`ImmatureSignatureError` across all users at once.
- **How to prevent.** Run NTP time sync on every server (macOS and cloud VMs do this by default; check containers and VMs restored from snapshots). Allow a small leeway (30 to 60 seconds for JWT, one window either side for TOTP). Monitor clock offset.
- **How to respond.** Fix time sync, and temporarily widen leeway only if needed while it propagates. Do not disable expiry checks.

### Recovery and email

#### 9. A reset token is reused or leaks via Referer

- **What happens.** A reset link in a URL query string leaks through the `Referer` header to a third-party script or image on the reset page, through analytics, browser history, or proxy logs. If the token is not single-use or not short-lived, someone else can use it.
- **How you'd notice.** Resets completed from IPs or devices unrelated to the request; password reset events the user did not perform.
- **How to prevent.** Single use (atomic `UPDATE ... WHERE used_at IS NULL`), 15 to 60 minute expiry, stored hashed, `Referrer-Policy: no-referrer` on the reset page, no third-party resources there, token in the URL fragment or removed from the URL by JavaScript immediately after load.
- **How to respond.** Invalidate all outstanding reset tokens, revoke affected users' sessions, force a new reset through a verified channel, fix the leak.

#### 10. The user's email account is taken over

- **What happens.** The attacker controls the inbox, requests a password reset, and takes the account. They may then change the account's email so the real user cannot recover it.
- **How you'd notice.** A reset followed quickly by an email change, login from a new location, or MFA removal; the user contacting support.
- **How to prevent.** MFA or passkeys still required after an email-based reset. Notify the old address when the email changes, with an undo link valid for several days. Require re-authentication (and the second factor) for email changes. Consider a short delay before a newly changed email can be used for recovery.
- **How to respond.** Restore the original email through the undo link or a verified support process, revoke sessions, reset credentials, and advise the user to secure their email account.

#### 11. Account enumeration

- **What happens.** Different messages, status codes or response times on login, sign-up or reset reveal which emails have accounts. Attackers build target lists for stuffing and phishing, or learn that a person uses a sensitive service.
- **How you'd notice.** Large volumes of sign-up or reset requests for many different emails from a small set of IPs.
- **How to prevent.** Uniform messages and status codes; dummy hash verification for unknown users; email-based flows for sign-up and reset; rate limits on all three endpoints (chapter 3).
- **How to respond.** Fix the leaking endpoint, rate-limit harder, and assume the attacker now holds a list of your users' emails: watch for credential stuffing next.

### Attacks on login

#### 12. A credential stuffing wave

- **What happens.** Bots try millions of leaked email and password pairs, a few per account, from thousands of IPs. A small percentage succeed where users reused passwords.
- **How you'd notice.** Failed logins jump far above baseline; a high proportion are for unknown emails; many distinct IPs, often from hosting providers or residential proxy networks; successful logins from unusual places.
- **How to prevent.** Breached-password checks, MFA or passkeys, global rate limits, CAPTCHA or bot detection as escalation, alerting on failure-rate anomalies, new-device notifications.
- **How to respond.** Raise defences (challenge all logins, tighten global limits), identify accounts that logged in successfully from attack sources, revoke their sessions and force resets, notify those users.

#### 13. Lockout used as denial of service

- **What happens.** Your system permanently locks accounts after N failures. An attacker types wrong passwords for every email they know, locking out all your users, or one specific person at a critical moment.
- **How you'd notice.** Many users suddenly locked; support load; lockouts concentrated in time.
- **How to prevent.** Temporary, self-expiring limits; progressive delays; per account-and-source counting; recognised-device bypass; CAPTCHA escalation instead of hard locks (chapter 3).
- **How to respond.** Unlock all affected accounts in bulk, switch to temporary limits, block the attacking sources.

#### 14. Login DoS via slow hashing

- **What happens.** Each login costs, say, 64 MiB of RAM and 100 ms of CPU. An attacker sends hundreds of login requests per second (even with invalid emails, since you deliberately run the dummy hash). The server runs out of memory or CPU and stops serving everyone.
- **How you'd notice.** CPU pinned, memory pressure, latency rising on all endpoints, a large share of requests going to the login route.
- **How to prevent.** Rate-limit *before* hashing (IP and global limits are cheap checks). Cap concurrent hash operations with a semaphore so excess logins wait or are rejected quickly (chapter 10). Choose Argon2 parameters that fit your concurrency. Cap password length (for example 1,024 characters) so huge inputs cannot add cost. Put a CDN or reverse proxy with rate limiting in front of public apps.
- **How to respond.** Block the source, tighten the global login limit, temporarily require a CAPTCHA, and scale or shed load.

### OAuth and account linking

#### 15. Misconfigured OAuth redirect URI

- **What happens.** The provider accepts redirect URIs by prefix or wildcard (for example anything under your domain), or your app has an open redirect. An attacker crafts an authorization URL that sends the code to a page they control and steals it.
- **How you'd notice.** Callback requests with unexpected redirect paths; security testing; a bug bounty report.
- **How to prevent.** Register exact redirect URIs only. Use PKCE so a stolen code is useless without the verifier. Remove open redirects (any endpoint that redirects to a URL from a query parameter without an allowlist).
- **How to respond.** Fix the registration, rotate the client secret, revoke sessions created through the vulnerable flow during the exposure window.

#### 16. Account linking takeover via unverified email

- **What happens.** Your app links a social login to an existing account because the emails match, but the provider never verified that email. The attacker signs in with a provider account claiming the victim's address and lands in the victim's account. Or the attacker pre-registers a password account with the victim's email before the victim first uses social login.
- **How you'd notice.** New identities linked to old accounts with no prior login from that provider; users reporting unknown linked logins.
- **How to prevent.** Link by `(provider, sub)`. Auto-link only when the provider asserts `email_verified` and the local account's email is verified. Otherwise require logging in to the existing account first. Notify users when a login method is linked (chapter 6).
- **How to respond.** Unlink the rogue identity, revoke sessions, reset credentials, audit other auto-linked accounts.

### Authorisation

#### 17. IDOR

- **What happens.** An endpoint uses an ID from the request without checking ownership. Any logged-in user can read or change others' data by changing the ID, for example `/api/state/batul` while logged in as Taha.
- **How you'd notice.** Access logs showing one session reading many different users' resources; sequential ID scanning patterns; a security review or test.
- **How to prevent.** Take the user from the session for personal data; central policy functions and load-and-authorise dependencies; policy test matrices; tests that create two users and try cross-access on every endpoint (chapter 7).
- **How to respond.** Fix the check, determine from logs which records were accessed by whom, notify affected users if personal data was exposed, and consider whether regulators must be told.

#### 18. Insider or admin abuse

- **What happens.** Someone with legitimate admin, database or server access reads or changes users' data, impersonates users, or exports data, out of curiosity or malice.
- **How you'd notice.** Audit logs of admin actions and impersonation, reviewed periodically; alerts on bulk exports; users noticing activity.
- **How to prevent.** Least privilege, few admins, strong admin authentication, impersonation with both identities logged and a visible banner, no direct production database access for routine work, separation between who can change code and who can access data where team size allows.
- **How to respond.** Remove access immediately, preserve logs as evidence, assess what was accessed, notify users and authorities as required, and review how the access was granted.

### Transport and dependencies

#### 19. Missing HTTPS or mixed content

- **What happens.** Over plain HTTP, anyone on the same Wi-Fi network (or any network in the path) can read passwords and session cookies, and can modify pages to inject scripts. Mixed content (an HTTPS page loading scripts over HTTP) reopens the same hole.
- **How you'd notice.** Browser "Not secure" warnings; mixed-content console errors; Secure cookies not being set.
- **How to prevent.** HTTPS everywhere, including on a home LAN (mkcert, or a real domain with a certificate). Redirect HTTP to HTTPS. Send `Strict-Transport-Security` (HSTS) once you are confident HTTPS works. Load every resource over HTTPS.
- **How to respond.** Enable HTTPS, then treat every password and session that crossed HTTP on an untrusted network as potentially exposed: rotate sessions and suggest password changes.

#### 20. A dependency vulnerability

- **What happens.** A library you use (a JWT library, an OAuth client, the web framework, a cryptography backend) has a security bug, or a malicious version is published (a supply-chain attack).
- **How you'd notice.** Security advisories, `pip-audit` output, GitHub Dependabot alerts, distribution security mailing lists.
- **How to prevent.** Few dependencies, pinned versions (a lock file with hashes for production), automated vulnerability scanning in CI, prompt updates for security releases, choosing well-maintained libraries.
- **How to respond.** Assess whether the vulnerable code path is reachable in your app, upgrade or patch, rotate secrets if the bug could have exposed them, check logs for exploitation.

### Lost authenticators and operational mistakes

#### 21. A user loses their phone with their passkey or TOTP app

- **What happens.** The only device with the user's passkey or TOTP secret is lost, broken or stolen. The user cannot log in. If the phone was unlocked and stolen, the thief may have access to synced passkeys and the authenticator app.
- **How you'd notice.** The user contacts you; recovery-code or reset usage spikes for that account.
- **How to prevent.** Encourage multiple passkeys and synced passkeys, issue recovery codes at enrolment, keep a documented recovery path (email reset plus a delay, or admin reset with identity confirmation). Encourage device screen locks.
- **How to respond.** Help the user recover through the documented path, revoke all sessions and the lost device's credentials, re-enrol a new passkey or TOTP secret, issue new recovery codes.

#### 22. Password reset does not end existing sessions

- **What happens.** A user notices suspicious activity and resets their password, but the attacker's session stays valid. The user believes they are safe; the attacker keeps access.
- **How you'd notice.** Activity on the account after the reset from the same unusual device.
- **How to prevent.** On password change or reset, delete all sessions and revoke all refresh tokens; offer "log out everywhere" (chapters 4 and 5).
- **How to respond.** Revoke all sessions now, and fix the reset flow.

#### 23. Host header injection in reset links

- **What happens.** Reset links are built from the incoming request's Host header. An attacker requests a reset for the victim with `Host: evil.example`. The victim receives a genuine email from you containing a link to the attacker's site, carrying a valid token. One click gives the attacker the token.
- **How you'd notice.** Reset requests with unusual Host headers in access logs.
- **How to prevent.** Build links from a configured `BASE_URL`. Configure your server or proxy to reject unknown Host values (in Starlette, `TrustedHostMiddleware`).
- **How to respond.** Invalidate outstanding reset tokens, fix link generation, check whether any resets were completed from unexpected sources.

#### 24. Mass assignment of roles

- **What happens.** A profile update endpoint copies every JSON field onto the user record. A user sends `{"role": "admin"}` and becomes an admin.
- **How you'd notice.** Role changes without a corresponding admin audit event; new admins nobody created.
- **How to prevent.** Explicit request models with only the fields users may change; roles changed only by a dedicated, admin-only, audited endpoint; database constraints on role values.
- **How to respond.** Revert roles, review everything done by the escalated accounts, fix the endpoint.

### Incident response checklist for an auth breach

When something goes wrong, people under stress forget steps. Write your version of this checklist before you need it, and keep it somewhere you can find without logging in to the affected system.

#### First hour: contain

1. **Confirm and scope.** What is known to be exposed: password hashes, tokens, secrets, personal data? Since when? Write down times and facts as you go; you will need them for notifications.
2. **Stop the bleeding.** Close the vulnerability or take the affected feature offline. If needed, put the whole app in maintenance mode. Availability matters less than containment.
3. **Preserve evidence.** Copy relevant logs and snapshots before rotating or cleaning anything. Do not wipe the attacker's traces.

#### Next hours: rotate and revoke

4. **Rotate secrets.** JWT signing keys, session or cookie signing secrets, the pepper (if exposed; see chapter 10 on pepper rotation), OAuth client secrets, SMTP and email provider credentials, database passwords, API keys of third-party services, and cloud credentials.
5. **Invalidate sessions.** Delete all sessions (`DELETE FROM sessions`) and revoke all refresh tokens. Everyone logs in again. With JWTs, rotating the signing key does this.
6. **Force password resets** where hashes or passwords may be exposed. Mark accounts as "must reset" so the next login requires a new password via the reset flow, rather than emailing new passwords. Prioritise admins and accounts with older, weaker hashes.
7. **Reset second factors** if TOTP secrets were exposed, and regenerate recovery codes.
8. **Invalidate outstanding reset and verification tokens.**

#### Within days: notify and recover

9. **Notify users** clearly and honestly: what happened, what data, what you have done, what they should do (change reused passwords elsewhere, watch for phishing that mentions your service).
10. **Notify regulators** if personal data is involved and the law requires it. Under GDPR, a notifiable breach must be reported to the supervisory authority within 72 hours of becoming aware of it, and affected individuals must be told without undue delay when the risk to them is high (chapter 10). This is not legal advice; check the rules that apply to you.
11. **Monitor** for follow-on attacks: credential stuffing using cracked passwords, phishing campaigns impersonating you.

#### Afterwards: learn

12. **Write a post-incident review** without blame: timeline, root cause, why detection took as long as it did, what changes prevent recurrence.
13. **Fix the class of bug, not just the instance.** If one endpoint lacked an ownership check, add tests that check every endpoint.
14. **Rehearse.** Practise the secret rotation and session invalidation steps on a test system so that next time they take minutes.

### Key takeaways

- Most auth failures fall into a few families: leaked data and secrets, stolen sessions, weak recovery, unthrottled login, and missing authorisation checks.
- Prevention is layered, but detection is what limits damage: log security events and watch failure rates.
- Store every secret you can hashed or encrypted, and keep the rest out of logs, backups and repositories.
- Plan for lost devices and compromised email as normal events, with documented recovery.
- Prepare an incident checklist in advance: contain, preserve evidence, rotate, revoke, reset, notify, learn.


## 10. Scaling and operations

An auth system that is correct on day one can still fail later: it slows down under load, falls over when you add a second server, breaks when a key must rotate, or leaks without anyone noticing. This chapter covers the operational side: what auth costs, how to size it, how to run it across servers, how to manage secrets, what to monitor, what privacy law expects, and how to test it.

### The cost model of auth

Auth has two very different cost profiles.

| Operation | How often | Cost per operation | Dominant resource |
|---|---|---|---|
| Password hash or verify (sign-up, login, change, reset) | Rare: once per login | High by design: tens to hundreds of ms, tens of MiB | CPU and memory |
| Session lookup | Every authenticated request | Low: one indexed lookup (well under 1 ms locally) | Database or cache reads |
| JWT verification | Every request | Very low: one HMAC or signature check, microseconds | CPU, negligible |
| Refresh token rotation | Every access-token lifetime per active client | Low: a few writes | Database writes |
| Email sending | Sign-up, reset, notifications | External API call, money per message at volume | Third-party quota |

The practical consequence: **slow hashing is cheap overall because it happens rarely**, and session lookups matter at scale only because they happen constantly. Optimising the wrong one is a common mistake. Lowering Argon2 parameters to "speed up the app" weakens security while saving almost nothing, because login is a tiny fraction of traffic.

### Capacity estimates with worked numbers

The numbers below are illustrative; benchmark your own machine (chapter 2).

**Assume** Argon2id takes 60 ms of one CPU core and 64 MiB of memory per hash, on a server with 4 cores and 4 GiB of RAM.

**Hashing throughput.** One core does about 1000 / 60, roughly 16 hashes per second. Argon2 with parallelism 4 uses several threads per hash, but total throughput is still bounded by cores: on the order of 50 to 65 hashes per second on 4 cores, if the server does nothing else.

**Memory ceiling.** 64 MiB each means 16 concurrent hashes use 1 GiB. Without a concurrency cap, 60 simultaneous logins would need nearly 4 GiB and the server would start swapping or be killed.

**Demand for 10,000 users.** Suppose 30 percent are active daily, each logs in once a day (long sessions mean most days need no login at all, so this is pessimistic), and logins cluster so the busiest hour carries 15 percent of the day's logins.

```text
daily logins        = 10,000 x 0.30          = 3,000
peak-hour logins    = 3,000 x 0.15           = 450 per hour
peak per second     = 450 / 3,600            = about 0.125 per second
headroom            = 50 per second capacity / 0.125 = about 400x
```

Legitimate logins are nowhere near capacity. The real risk is an attack: a credential stuffing bot sending 200 attempts per second would saturate the server. That is why the global login rate limit and concurrency cap matter more than raw capacity.

**Session lookups.** If each active user makes 2 requests per minute during a 20-minute daily session, 3,000 daily users generate 120,000 lookups per day, a few per second at peak. SQLite handles that easily; Postgres or Redis handle orders of magnitude more.

**Rule of thumb.** Size Argon2 parameters for security, then cap concurrency so that `max_concurrent_hashes x memory_per_hash` stays well below available RAM, and set the global login rate limit to below hashing capacity.

### Concurrency limits for hashing

A semaphore caps simultaneous hash operations. Requests beyond the cap wait briefly or fail fast with `503 Service Unavailable`, instead of exhausting memory.

```python
# hashing_pool.py - bound concurrent Argon2 work
import threading
from fastapi import HTTPException
import security as sec

MAX_CONCURRENT_HASHES = 8            # 8 x 64 MiB = 512 MiB worst case
_slots = threading.BoundedSemaphore(MAX_CONCURRENT_HASHES)

def guarded_verify(stored_hash: str | None, password: str) -> bool:
    # Wait at most 2 s for a slot; under attack, fail fast rather than pile up.
    if not _slots.acquire(timeout=2.0):
        raise HTTPException(503, "Server busy. Please try again shortly.",
                            headers={"Retry-After": "5"})
    try:
        return sec.verify_password(stored_hash, password)
    finally:
        _slots.release()
```

This works for synchronous FastAPI endpoints, which run in a thread pool. argon2-cffi releases Python's global interpreter lock while hashing, so threads hash in parallel. In an `async def` endpoint, run the hash with `await asyncio.to_thread(...)` (or `run_in_threadpool`) and use an `asyncio.Semaphore` instead, so you never block the event loop. With several worker processes, each has its own semaphore: the effective cap is workers times `MAX_CONCURRENT_HASHES`.

### Multi-server sessions

When you run more than one server process or machine, a session created by one must be recognised by the others.

| Approach | How it works | Pros | Cons |
|---|---|---|---|
| Sticky sessions | The load balancer sends each client to the same server, sessions stay in that server's memory | No shared store | Server restart or failure logs users out; uneven load; harder deploys |
| Shared store (Postgres, Redis) | All servers read sessions from one store | Any server serves any request; instant revocation | The store must be highly available; one lookup per request |
| Stateless tokens (JWT) | Servers verify signatures, no lookup | No shared state for verification | Revocation problem; key distribution; refresh still needs state |

The default for most teams is a shared store. Postgres is fine up to substantial traffic when the session table is indexed by token hash; Redis adds speed and native expiry (set a key per session with a TTL equal to the idle timeout and refresh it on use). Stateless JWTs make sense when many independent services verify identity, typically combined with a stateful refresh mechanism.

Rate-limit counters need the same treatment: move them from process memory to Redis or the database once you run more than one process.

### Key and secret management

#### What secrets an auth system holds

- JWT signing keys, or the key used to sign Starlette session cookies.
- The pepper, if used, and the key encrypting TOTP secrets.
- OAuth client secrets.
- SMTP or email provider API keys.
- Database credentials.

#### Where to keep them

- **Not** in source code or the Git repository.
- Locally and on a single server: environment variables loaded from a file readable only by the service user (`chmod 600`), excluded from Git and from general backups.
- In the cloud: the platform's secrets manager (AWS Secrets Manager, Google Secret Manager, HashiCorp Vault, or your host's equivalent), with access granted to the service's identity only.

#### Rotating JWT keys with key IDs

Rotation means replacing a key without logging everyone out. With key IDs (`kid`), the pattern is:

1. Generate the new key; add it to the **verification** set alongside the old one.
2. Deploy, so every server can verify both.
3. Switch **signing** to the new key.
4. Wait until every token signed with the old key has expired (the access-token lifetime, for example 10 minutes).
5. Remove the old key from the verification set.

With asymmetric keys, publish verification keys as a **JWKS** (a JSON document listing public keys with their `kid`s) at a URL such as `/.well-known/jwks.json`. Verifiers fetch and cache it. PyJWT includes `jwt.PyJWKClient`, which fetches a JWKS and picks the key matching a token's `kid`; this is how you verify tokens from Google, Supabase or any OIDC provider:

```python
# pip install "pyjwt[crypto]"
import jwt

jwks = jwt.PyJWKClient("https://www.googleapis.com/oauth2/v3/certs")  # cached by the client

def verify_google_id_token(id_token: str, client_id: str) -> dict:
    key = jwks.get_signing_key_from_jwt(id_token)          # chosen by kid
    return jwt.decode(id_token, key.key, algorithms=["RS256"], audience=client_id,
                      issuer=["https://accounts.google.com", "accounts.google.com"])
```

In an emergency (key leaked), skip step 4: remove the old key immediately and accept that everyone re-authenticates.

#### Rotating a pepper

With the "HMAC before hashing" pepper, hashes cannot be re-peppered without the password. Keep old peppers in a keyed map (chapter 2), add a new one as current, and rehash on login. After a long period, force resets for accounts still on the old pepper and then delete it. With the "encrypt the hash" pepper, you can decrypt and re-encrypt every hash offline in one batch job, which is why that pattern rotates more easily.

#### Rotating everything else

Write down, for each secret: where it lives, who can access it, how to rotate it, and what breaks during rotation. Practise once on a test server. The worst time to discover how rotation works is during an incident.

### Monitoring and alerting

Your audit events (chapter 3) feed monitoring. Useful signals:

| Signal | What it suggests | Alert when |
|---|---|---|
| Failed login rate | Brute force or credential stuffing | Several times the normal baseline for 5 to 10 minutes |
| Share of failures for unknown accounts | Credential stuffing with external lists | Unusually high proportion |
| Distinct IPs attempting logins | Distributed attack | Sudden jump |
| Rate-limit triggers | Attack or a misbehaving client | Sustained spike |
| Password reset requests | Enumeration, inbox flooding, takeover attempts | Spike, or many for one account |
| Successful login from new country or device | Account takeover | Per-user notification rather than an operator alert |
| Admin actions, role changes, impersonation | Insider abuse or escalation | Every occurrence, in a reviewed log |
| Refresh token reuse detections | Token theft | Every occurrence |
| 401 and 403 rates on API endpoints | IDOR probing or broken clients | Spike from one session or IP |
| Login latency and hashing semaphore saturation | Login DoS or under-provisioning | Sustained saturation |

For a small app, a daily summary query over the `auth_events` table is a perfectly good start. For a public app, ship events to a log platform and set threshold alerts. Alert on rates and ratios, not individual failures, or alerts will be ignored.

### Backups

- Back up the users table and any credentials you cannot regenerate (password hashes, passkey public keys, encrypted TOTP secrets).
- Sessions, reset tokens and rate-limit counters need no backup. Excluding them reduces what a leaked backup exposes.
- Encrypt backups, store them separately from the server, restrict access, and set retention.
- Store the pepper and encryption keys separately from data backups, and back them up carefully: losing them makes every password unverifiable.
- Test restores. A backup you have never restored is a hope, not a backup.
- Remember that erasure requests (below) must eventually apply to backups, typically by letting them age out within a documented retention period.

### Privacy law basics

This section summarises common obligations under the EU and UK General Data Protection Regulation (GDPR). **It is not legal advice**; laws differ by country, and specific situations (children's data, health data, users outside Europe) add rules. Check with a qualified source for anything public.

- **Personal data** includes emails, names, IP addresses, device identifiers and login histories. Auth systems are full of it.
- **Lawful basis.** You need one for each processing purpose; for accounts, "necessary for a contract" with the user usually covers login data, while marketing needs consent.
- **Data minimisation.** Collect only what you need. Do you need a real name, or a display name? Do you need IP addresses forever, or for 90 days?
- **Storage limitation.** Define retention periods for logs and inactive accounts, and enforce them with scheduled deletion.
- **Right to erasure.** Users can ask for their data to be deleted. Design for it: one internal user ID referenced everywhere, `ON DELETE CASCADE` where appropriate, and a documented process for logs and backups.
- **Right of access and portability.** Users can request a copy of their data. Keep it queryable.
- **Security of processing.** Appropriate technical measures, which in practice means the content of this guide: hashing, encryption, access control, logging.
- **Breach notification.** A personal data breach likely to pose a risk to people must be reported to the supervisory authority **within 72 hours** of becoming aware of it. If the risk to individuals is high, they must be told without undue delay. Keep an internal record of all breaches, even those not reported.
- **Processors.** Hosted auth providers and email services are data processors; you need a data processing agreement with them (usually part of their standard terms) and should know where they store data.
- **Children.** Services offered directly to children face additional rules on consent and design (for example the UK's Age Appropriate Design Code and, in the US, COPPA).

A family app that never leaves the home network is generally treated very differently from a public service; household activity falls outside much of GDPR. Hosting publicly changes that.

### Testing auth

#### Unit tests

Test each building block and each rule:

- Hashing round-trips, verification failures, `needs_rehash` after parameter changes.
- Normalisation: an address with surrounding spaces and mixed case maps to the same key as its trimmed, lower-case form.
- Policy functions with a full matrix of actors and resources (chapter 7).
- Token creation and verification: expiry, wrong audience, wrong issuer, tampered signature, `alg: none`.

#### Integration tests

Use FastAPI's `TestClient` against a temporary database (set `AUTH_DB` to a temporary file, like Rankwise's rule of testing on a scratch data directory):

```python
# test_auth_flow.py  (pip install pytest httpx)
import os, tempfile
os.environ["AUTH_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")
os.environ["COOKIE_SECURE"] = "0"

from fastapi.testclient import TestClient
from main import app

def addr(name: str) -> str:
    return name + "@" + "example.test"   # reserved test domain, never a real inbox

def test_signup_login_logout_and_isolation():
    with TestClient(app) as c:
        assert c.post("/auth/signup", json={"email": addr("a"),
                      "password": "a long test password", "display_name": "A"}).status_code == 201
        r = c.post("/auth/login", json={"email": " " + addr("A") + " ",
                   "password": "a long test password"})
        assert r.status_code == 200 and c.get("/me").status_code == 200
        bad = c.post("/auth/login", json={"email": addr("a"), "password": "nope"})
        unknown = c.post("/auth/login", json={"email": addr("z"), "password": "nope"})
        assert bad.status_code == unknown.status_code == 401
        assert bad.json() == unknown.json()            # no enumeration via messages
        c.post("/auth/logout")
        assert c.get("/me").status_code == 401         # server-side session is gone
```

Add a cross-user test for every endpoint that takes an ID: create two users, log in as one, request the other's resources, and assert 404 or 403.

#### Property-based tests for token expiry

**Property-based testing** generates many random inputs and checks that a rule always holds. The `hypothesis` library does this in Python. It is good at finding boundary errors such as off-by-one expiry checks.

```python
# test_token_props.py  (pip install hypothesis pytest)
from hypothesis import given, strategies as st

def is_valid(now: int, issued_at: int, ttl: int) -> bool:
    return now < issued_at + ttl          # the rule under test (expires AT issued+ttl)

@given(issued=st.integers(0, 2**31), ttl=st.integers(1, 10**7),
       delta=st.integers(-10**7, 10**7))
def test_token_valid_exactly_before_expiry(issued, ttl, delta):
    now = issued + delta
    assert is_valid(now, issued, ttl) == (delta < ttl)

@given(issued=st.integers(0, 2**31), ttl=st.integers(1, 10**7))
def test_never_valid_at_or_after_expiry(issued, ttl):
    assert not is_valid(issued + ttl, issued, ttl)
```

Apply the same idea to the real code by injecting a clock: functions take a `now` argument (or a clock object) instead of calling `time.time()` directly, which makes expiry, idle timeouts and rate limits testable.

#### Security test checklist

Before shipping, check by hand or with automated tests:

- Wrong password and unknown user return identical status, body and similar timing.
- Rate limits trigger and expire on login, sign-up, reset, TOTP and recovery codes.
- Session cookie has `HttpOnly`, `Secure`, `SameSite`, and the `__Host-` prefix in production.
- Session ID changes at login; logout invalidates the session server-side.
- Password change and reset end all other sessions.
- Cross-site POST without the CSRF header or with a foreign Origin is rejected.
- Every ID-taking endpoint refuses another user's ID.
- Reset tokens are single-use, expire, and are stored hashed.
- JWTs with `alg: none`, wrong `aud`, wrong `iss` or expired `exp` are rejected.
- No password, token or cookie value appears in logs after a full test run.
- HTTP redirects to HTTPS; no mixed content.
- `pip-audit` reports no known vulnerabilities in dependencies.

#### OWASP ASVS as a checklist

The **OWASP Application Security Verification Standard (ASVS)** is a catalogue of security requirements, grouped into chapters (authentication, session management, access control and more) with three levels: Level 1 for all apps, Level 2 for most apps handling sensitive data, Level 3 for high-assurance systems. Version 5.0 was released in 2025. Use its authentication, session and authorisation chapters as a review checklist: go through each requirement and note "met", "not met" or "not applicable". It turns "is our auth good?" into a concrete list.

### Rules of thumb

- Keep hash parameters strong; protect capacity with rate limits and a concurrency cap, not weaker hashing.
- Move sessions and rate-limit counters to a shared store before adding a second process.
- Every secret has a documented location, owner and rotation procedure.
- Monitor rates and ratios of auth events; review admin actions.
- Inject clocks, test boundaries, and run a cross-user access test on every endpoint.

### Key takeaways

- Hashing is expensive but rare; session lookups are cheap but constant. Size and protect each accordingly.
- Login DoS is the realistic capacity threat: global limits plus a hashing semaphore contain it.
- Key IDs and JWKS make JWT key rotation routine; rehearse rotation before you need it.
- GDPR expects minimisation, erasure and 72-hour breach notification; design user data so you can comply (not legal advice).
- Use OWASP ASVS and a short security test checklist to turn "secure enough" into verifiable items.


## 11. Worked design: Rankwise

This chapter applies the whole guide to one real app. It is written as a design document you could hand to someone else: current state, threat model, phase 1 design for the home network, phase 2 options for public hosting, the data model, the endpoint list, an implementation plan, and the risks to watch.

### Current state

| Aspect | Today |
|---|---|
| Server | FastAPI on a Mac, reached at `http://192.168.1.4:8766` over home Wi-Fi |
| Client | Plain-JavaScript PWA, used in Chrome on Android phones |
| Users | Two learner profiles, Taha and Batul, listed in `progress/users.json` |
| Data | Progress stored as JSON files per learner (and per course) under `progress/`, with daily backups |
| Transport | Plain HTTP, no TLS |
| Email | None |
| Authentication | None: the app shows a profile picker and the client says which learner it is |

The API today includes `GET /api/users`, `GET /api/states` (every learner's progress, used for the "Party" comparison view), `GET` and `PUT /api/state/{uid}` (with a stale-write check that returns 409), `GET /api/backups/{uid}` and `GET /api/backups/{uid}/{day}`, and `GET /api/health`. FastAPI's interactive docs are served at `/docs`.

In the language of chapter 7, every `{uid}` route is an IDOR by design: anyone on the Wi-Fi who can reach the server can read or overwrite any learner's progress, list and download backups, and read everyone's state at once. That has been acceptable because the only people on the network are the household. The design below makes the app safe even when that assumption weakens (a guest on the Wi-Fi, a sibling being playful, or a later move to public hosting).

### Threat model

**Assets.** Learners' progress (low sensitivity, but losing or corrupting it is upsetting), the integrity of the comparison view (no cheating by editing a sibling's score), and any passwords learners type (high sensitivity if reused elsewhere).

**Attackers in phase 1.**

| Attacker | Capability | Realistic goal |
|---|---|---|
| Family member | Uses the app on their own phone, may borrow another's | Peek at or edit a sibling's progress |
| Guest on the Wi-Fi | Can reach `192.168.1.4`, can read unencrypted traffic on the network | Curiosity; capturing a typed password |
| Compromised device on the LAN | Malware scanning the local network | Opportunistic access to anything open |
| Someone with access to the Mac | Reads `progress/` files directly | Anything; out of scope for app-level controls |

**Not in scope for phase 1.** Internet attackers (the server is not exposed), credential stuffing at scale, email takeover. These appear in phase 2.

**Key judgement.** Physical access to the Mac is the root of trust. The person who runs the server is the household admin. Recovery by that admin is not a weakness; it matches reality.

### Phase 1: home LAN design

#### Architecture

```text
Android phone (Chrome PWA)
   |  HTTPS  https://rankwise.home.arpa:8766   (mkcert certificate, trusted on each phone)
   v
FastAPI on the Mac
   |-- /auth/*          login, logout, PIN or password change, admin reset
   |-- /api/*           requires a session; ownership checks through policy.py
   |-- static PWA files
   |
   |-- auth.db (SQLite): accounts, sessions, auth_events, reset_codes
   |-- progress/*.json  (unchanged format; files keyed by account public_id)
```

Progress stays in JSON files. Only identity, sessions and audit events move to SQLite. That keeps the change small and the existing sync and backup logic intact.

#### Decisions and their reasons

| Decision | Choice | Why | Alternative and when it would be better |
|---|---|---|---|
| Credential | Password per learner, minimum 8 characters, breached-password check against a local list | Rate limiting makes online guessing slow; learners are young and type on phones | A 4 to 6 digit PIN per profile (chapter 6) is acceptable while the server is LAN-only and rate limited; switch to passwords or passkeys before public hosting |
| Hashing | Argon2id with argon2-cffi defaults, benchmarked on the Mac | Standard, fast enough on Apple silicon, trivially strong | None needed |
| Sessions | Server-side sessions in SQLite, `__Host-session` cookie, 30 days idle, 180 days absolute | Phones are personal; re-login is friction; revocation is instant | Shorter timeouts if phones are shared |
| CSRF | `SameSite=Lax`, no state-changing GETs, custom header plus Fetch Metadata check | Cheap and complete for a same-origin JSON API | Token-based CSRF if HTML forms post directly |
| Rate limiting | In-memory sliding windows: 5 failures per 15 min per account, 20 attempts per min per IP, global cap | One process, two users | SQLite-backed counters if run with multiple workers |
| Recovery | Admin reset (one-time code shown to the admin) plus a command-line reset on the Mac | No email; the admin is physically present | Recovery codes printed for each learner if the admin is not always available |
| Admin | One admin account (the parent), separate from learner profiles | Least privilege; learners cannot reset each other | Admin role on a learner account is simpler but mixes powers |
| Transport | Local HTTPS with mkcert | Passwords and cookies must not cross Wi-Fi in plaintext; `Secure` cookies require HTTPS | A real domain with a public certificate, or Tailscale, described below |

#### Local HTTPS with mkcert

**mkcert** creates a private certificate authority (CA) on your Mac and issues certificates trusted by any device that trusts that CA.

1. Install mkcert (`brew install mkcert`) and run `mkcert -install` to create and trust the local CA on the Mac.
2. Choose a hostname. The `.home.arpa` suffix is reserved for home networks (RFC 8375). Issue a certificate for both the name and the IP: `mkcert rankwise.home.arpa 192.168.1.4`.
3. Make the name resolve on the phones. Either add a DNS entry on the home router pointing `rankwise.home.arpa` to `192.168.1.4`, or use the IP address directly (the certificate includes it).
4. Copy the CA certificate (`mkcert -CAROOT` shows its folder; the file is `rootCA.pem`) to each Android phone and install it in Settings under encryption and credentials, as a CA certificate. Chrome on Android generally trusts user-installed CAs for websites; verify on each device, as Android versions differ.
5. Run uvicorn with the certificate: `uvicorn main:app --host 0.0.0.0 --port 8766 --ssl-certfile rankwise.home.arpa+1.pem --ssl-keyfile rankwise.home.arpa+1-key.pem`.
6. Give the Mac a fixed IP (a DHCP reservation on the router) so the address and certificate stay valid.

Keep the mkcert CA private key (`rootCA-key.pem`) safe: anyone who has it can create certificates trusted by your phones for any website. Do not copy it to the phones; only the public `rootCA.pem` goes there.

Alternatives worth knowing:

- **A real domain with a DNS-validated certificate.** If you own a domain, point a subdomain at `192.168.1.4` and obtain a Let's Encrypt certificate with a DNS-01 challenge. Phones trust it with no CA installation. Note that this publishes your private IP in public DNS (harmless, but visible), and some routers block DNS answers that point to private addresses ("DNS rebinding protection").
- **Tailscale.** A private mesh VPN; `tailscale cert` issues certificates for your machine's tailnet name. It also lets learners use the app away from home without exposing the server to the internet.

HTTPS has an extra benefit for a PWA: service workers, offline caching and installability all require a secure context. Passkeys, too, require HTTPS and a hostname rather than an IP (chapter 6), so using `rankwise.home.arpa` keeps that door open.

#### Data model

```sql
CREATE TABLE IF NOT EXISTS accounts (
    id                  INTEGER PRIMARY KEY,
    public_id           TEXT NOT NULL UNIQUE,      -- existing learner id, e.g. 'taha'
    username_normalized TEXT NOT NULL UNIQUE,      -- NFKC + casefold, [a-z0-9_-] only
    display_name        TEXT NOT NULL,
    password_hash       TEXT,                      -- NULL until first password is set
    role                TEXT NOT NULL DEFAULT 'learner'
                        CHECK (role IN ('learner', 'admin')),
    status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'disabled')),
    must_set_password   INTEGER NOT NULL DEFAULT 1,
    password_changed_at INTEGER,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    token_hash   TEXT PRIMARY KEY,
    account_id   INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at   INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL,
    expires_at   INTEGER NOT NULL,
    user_agent   TEXT
);

CREATE TABLE IF NOT EXISTS reset_codes (           -- admin-issued one-time codes
    code_hash   TEXT PRIMARY KEY,
    account_id  INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    issued_by   INTEGER NOT NULL REFERENCES accounts(id),
    expires_at  INTEGER NOT NULL,
    used_at     INTEGER
);

CREATE TABLE IF NOT EXISTS auth_events (
    id INTEGER PRIMARY KEY, at INTEGER NOT NULL, event TEXT NOT NULL,
    account_id INTEGER, actor_id INTEGER, ip TEXT, detail TEXT
);
```

Keeping `public_id` equal to the existing learner IDs means progress file names and the PWA's stored references do not change. Usernames are not emails, because there is no email; restrict them to a safe character set so `taha` cannot be imitated with look-alike characters.

#### Endpoint list

| Method and path | Auth | Purpose and rule |
|---|---|---|
| `GET /api/users` | Public | Profile picker: returns only `public_id`, display name and whether a password is set. Nothing else. |
| `POST /auth/login` | Public, rate limited | Username and password; uniform error; dummy hash; new session; audit event |
| `POST /auth/logout` | Session | Delete session, clear cookie |
| `POST /auth/first-password` | One-time code | Set the initial password for a migrated account (see migration) |
| `POST /auth/change-password` | Session + current password | Change, end other sessions, rotate current |
| `POST /auth/redeem-reset` | Public, rate limited | Redeem an admin-issued reset code and set a new password |
| `GET /api/me` | Session | Current account summary |
| `GET /api/state/me`, `PUT /api/state/me` | Session | Own progress; keeps the existing 409 stale-write logic |
| `GET /api/state/{uid}` | Session + `can_view_progress` | Kept for compatibility during migration; owner or admin only |
| `PUT /api/state/{uid}` | Session + `can_edit_progress` | Owner only; then deprecate in favour of `/me` |
| `GET /api/party` | Session | Replaces `GET /api/states`: returns only the summary each learner needs for comparison (name, points, streak), never full progress |
| `GET /api/backups/me`, `GET /api/backups/me/{day}` | Session | Own backups only; admin variants under `/api/admin/` |
| `POST /api/admin/accounts/{uid}/reset-code` | Admin + recent re-authentication | Issue a one-time reset code (shown once, valid 15 minutes) |
| `POST /api/admin/accounts/{uid}/logout-all` | Admin | Revoke all sessions for an account |
| `GET /api/health` | Public | Return only `ok`; move details like the data directory path behind admin |
| `/docs`, `/openapi.json` | Admin, or disabled | API documentation reveals every route; hide it or protect it |

Two changes deserve emphasis. `GET /api/states` currently returns everyone's full progress; replacing it with a purpose-built `/api/party` summary applies data minimisation and removes the largest read-IDOR in one move. And every `{uid}` route gets a policy check through the load-and-authorise dependency pattern from chapter 7, with the uid validated against a strict pattern before it is ever used in a file path.

#### Core code changes

The ownership dependency is the heart of the change:

```python
# rankwise_auth.py - the pieces that wrap the existing endpoints
import re
from fastapi import Depends, HTTPException
from sessions import require_user          # chapter 4, reading accounts instead of users

UID_RE = re.compile(r"^[a-z0-9_-]{1,32}$")

def can_view_progress(actor, uid: str) -> bool:
    return actor["public_id"] == uid or actor["role"] == "admin"

def can_edit_progress(actor, uid: str) -> bool:
    return actor["public_id"] == uid                 # admins view, never overwrite

def viewable_uid(uid: str, user=Depends(require_user)) -> str:
    if not UID_RE.fullmatch(uid) or not can_view_progress(user, uid):
        raise HTTPException(404, "Not found.")       # same answer as "no such user"
    return uid

def editable_uid(uid: str, user=Depends(require_user)) -> str:
    if not UID_RE.fullmatch(uid) or not can_edit_progress(user, uid):
        raise HTTPException(404, "Not found.")
    return uid
```

Existing handlers change only their signature: `def get_state(uid: str = Depends(viewable_uid), c: str = CourseQ)` instead of taking `uid` from the path directly. The rest of their logic, including `user_ok`, the stale-write check and backups, stays as it is.

On the client, `fetch` calls add `credentials: "same-origin"` (the default for same-origin requests) and the CSRF header `X-Requested-With: rankwise`. A 401 response sends the user to the login screen. Nothing is stored in localStorage except non-secret preferences.

#### Migrating the existing users

The two learners exist today without passwords. Migration must not lose progress or lock anyone out.

1. **Back up** the `progress/` folder and `users.json`.
2. **Create accounts** from `users.json` with a one-off script: each learner gets an `accounts` row with `public_id` equal to their existing ID, `password_hash` NULL and `must_set_password = 1`. Create the admin account with a password typed at the terminal (never in a command-line argument, which lands in shell history; use `getpass`).
3. **Issue first-time codes.** The script prints a one-time code per learner (stored hashed in `reset_codes`, valid for a day). The admin gives each learner their code in person.
4. **Learners set passwords** on their own phones via `/auth/first-password` with their code. This also creates their first session.
5. **Transition period.** Keep the old unauthenticated endpoints available only until both learners have set passwords (a feature flag), then remove them. During the transition, the old endpoints should at least refuse writes for accounts that already have a password, so an unauthenticated client cannot overwrite migrated data.
6. **Keep `users.json`** as the source of display data if the rest of the app depends on it, or generate it from the accounts table; the accounts table is the source of truth for authentication.

#### Recovery in phase 1

- **Admin reset.** The admin logs in, re-enters their password, and issues a reset code for a learner. The code is shown once, expires in 15 minutes, is stored hashed, and is single use. The learner enters it with a new password. All the learner's sessions end. Every step is an audit event naming the admin.
- **Admin forgot their password.** A command on the Mac: `python manage.py reset-password parent` prompts for a new password with `getpass`. Whoever can run commands on the Mac already controls all the data, so this adds no new risk.
- **No security questions**, ever.

#### Step-by-step implementation plan

1. Set up mkcert and run the existing app over HTTPS. Confirm the PWA works on both phones, including installation and offline behaviour.
2. Add `auth.db` with the schema above and a `manage.py` with `create-admin`, `import-learners`, `issue-code` and `reset-password` commands.
3. Add `security.py` (Argon2id, normalisation, token helpers), `sessions.py` and `ratelimit.py` from chapters 3 and 4, adapted to `accounts`.
4. Add `/auth/login`, `/auth/logout`, `/auth/first-password`, `/auth/change-password`, `/auth/redeem-reset` and `/api/me`. Write tests first using a scratch data directory on the test port, never real progress.
5. Add the CSRF middleware, the policy functions and the `viewable_uid`/`editable_uid` dependencies; attach them to every `{uid}` route.
6. Add `/api/party` and switch the comparison view to it; remove `/api/states`.
7. Restrict `/api/health` output and protect or disable `/docs`.
8. Update the PWA: login screen, 401 handling, CSRF header, logout, change password, admin screen for reset codes.
9. Run the migration on a copy of the real data, then on the real data with a fresh backup.
10. Enable the feature flag that removes unauthenticated access. Run the cross-user test: as Taha, try every endpoint with Batul's ID and confirm 404.
11. Review the request log: the existing middleware prints paths and query strings, so make sure no secret is ever sent in a query string.

### Phase 2: public hosting

Public hosting changes the threat model completely: bots, credential stuffing, enumeration, email takeover and DoS all become relevant, and privacy law applies to strangers' data (chapter 10).

#### What changes regardless of option

- **Real domain and HTTPS** with a public certificate, HSTS, and HTTP redirected to HTTPS.
- **Database**: move progress from JSON files to Postgres (a `progress` table with `user_id`, `course`, `state jsonb`, `updated_at`), so ownership can be enforced in queries and, optionally, by row-level security.
- **Email**: a transactional provider with SPF, DKIM and DMARC for verification and password reset.
- **Rate limits and counters** in Redis or Postgres; bot defences on sign-up and login.
- **Usernames become emails** (or email plus display name); enumeration-safe sign-up and reset flows.
- **Privacy**: data minimisation, retention periods, an erasure path, a privacy notice, and care with children's data if learners are minors.

#### Option A: DIY FastAPI and Postgres

Extend the phase 1 code: accounts with email, the reset flow from chapter 5, Google sign-in via Authlib (chapter 6), breached-password checks via HIBP, sessions in Postgres or Redis.

- **Pros.** Continuity with phase 1; no per-user fees; full control; hashes stay yours.
- **Cons.** You own deliverability, bot defence, monitoring and every security fix. Budget real time each month.
- **Choose it if** you enjoy this work, user numbers are modest, and you are willing to run monitoring and respond to incidents.

#### Option B: Supabase Auth

Use Supabase for identity (email and password, magic links, Google, MFA) and Postgres. The PWA uses the Supabase JavaScript client to sign in; FastAPI verifies Supabase-issued JWTs on each request, or the PWA reads and writes the `progress` table directly with row-level security policies like those in chapter 7.

- **Pros.** Reset emails, social login, MFA and rate limiting are provided; users live in your Postgres database with exportable bcrypt hashes; RLS gives database-level ownership enforcement.
- **Cons.** JWTs in the client (stored by the Supabase client library in browser storage by default, so XSS hygiene and a strict CSP matter more); per-MAU pricing past the free tier; a dependency on Supabase availability.
- **Choose it if** you want to ship public auth quickly with a small team and keep an exit path.

Migration from phase 1 in either option: phase 1 hashes are Argon2id, and both a DIY system and an import into another provider can be planned around them. With Supabase, which uses bcrypt, check its current documentation for importing users with existing hashes; otherwise use a lazy migration (verify against your old Argon2id hash on first login, then set the password through the provider) or a one-time reset email.

#### Sequencing login methods

1. **Launch**: email and password with verification, password reset, Google sign-in, rate limiting, breached-password checks.
2. **Soon after**: passkeys as an option for every account (the RP ID is your domain, so passkeys survive any change of backend), TOTP for the admin.
3. **Later**: passkeys as the suggested default at sign-up; consider dropping password sign-up for new users if adoption is high, keeping email-based recovery.

### Risks to watch

| Risk | Phase | Mitigation |
|---|---|---|
| Unauthenticated endpoints left enabled after migration | 1 | Feature flag with a removal date; cross-user test in CI |
| mkcert CA key leaking | 1 | Keep `rootCA-key.pem` only on the Mac; never sync it to the phones |
| Certificate expiry breaks the app | 1 | mkcert certificates last a long time but not forever; note the date and reissue |
| Learner forgets password while the admin is away | 1 | Printed recovery codes as an optional second path |
| Comparison view leaking more than intended | 1 | `/api/party` returns a fixed, minimal set of fields |
| Shared phone keeps a learner logged in | 1 | Visible logout; admin "log out all sessions" button |
| Request logs capturing secrets | 1, 2 | No secrets in URLs; never log bodies; periodic log search |
| Moving from LAN to internet without revisiting PIN-strength credentials | 2 | Require passwords of at least 15 characters or passkeys before exposure |
| Email becoming the master key | 2 | Notifications on change, MFA for admin, undo link for email changes |
| Supabase JWT stolen by XSS | 2B | Strict CSP, no `innerHTML` with user data, short token lifetime |
| Children's data obligations | 2 | Minimal data, no tracking, clear privacy notice; take advice before launch |

### Key takeaways

- Rankwise's real phase 1 risk is that every `{uid}` route trusts the client; sessions plus a policy dependency fix it with small changes to existing handlers.
- Local HTTPS with mkcert is a prerequisite: it protects typed passwords on Wi-Fi and enables `Secure` cookies, service workers and later passkeys.
- Admin-issued one-time codes and a command-line reset match the household trust model and replace email for recovery.
- Replace the all-states endpoint with a minimal comparison summary, and hide operational details in health and docs.
- For public hosting, choose between DIY and Supabase on time, budget and exit cost; either way move progress into Postgres and keep ownership checks in the query or in RLS.


## 12. Self-check, glossary and further reading

### Self-check questions

Try to answer each question before reading the answer. If you get one wrong, reread the relevant chapter section.

#### Chapter 1: The mental model

| Question | Answer |
|---|---|
| What is the difference between authentication and authorisation? | Authentication proves who someone is; authorisation decides what that identity may do. A logged-in user can still be forbidden from a resource. |
| Why keep an internal user ID separate from the email address? | Identifiers like emails change and can be reassigned; a stable internal ID keeps references, erasure and account changes simple. |
| What is the difference between an online and an offline attack on passwords? | Online attacks guess against your live server, so rate limiting works; offline attacks run on leaked hashes, where only slow hashing protects users. |
| Give an example of "fail closed". | If the session store is unreachable or a policy check throws, deny the request rather than treating the user as authorised. |

#### Chapter 2: Storing passwords

| Question | Answer |
|---|---|
| Why is SHA-256 a bad password hash? | It is designed to be fast, so attackers can test billions of guesses per second against leaked hashes. |
| What does a salt protect against, and is it secret? | It makes identical passwords hash differently and defeats precomputed tables; it is not secret and is stored with the hash. |
| What is bcrypt's 72-byte limit and why does it matter? | bcrypt only uses the first 72 bytes of input, so longer passwords are truncated or rejected; multi-byte characters reach the limit sooner. |
| Why can you change Argon2 parameters without breaking old hashes? | The encoded hash string records the algorithm, version, parameters and salt, so verification reads them from the stored value. |
| When is the only moment you can rehash a password with new parameters? | At successful login, when you briefly hold the plaintext password. |
| How should a pepper be applied? | HMAC the password with the pepper before hashing, or encrypt the finished hash with a key held outside the database; store a pepper ID for rotation. |
| What does current NIST guidance say about composition rules and rotation? | Do not require character-class rules and do not force periodic changes; require length, allow long passwords and paste, and block breached passwords. |
| How does the HIBP range API avoid learning the password? | You send only the first 5 hex characters of the SHA-1 hash and compare the returned suffixes locally (k-anonymity). |

#### Chapter 3: The login flow

| Question | Answer |
|---|---|
| Why verify against a dummy hash when the user does not exist? | So unknown and known accounts take the same time, preventing enumeration through timing. |
| Why rely on a UNIQUE constraint rather than "check then insert" at sign-up? | Two concurrent requests can both pass the check; the constraint is atomic. |
| Why are permanent lockouts dangerous? | Anyone who knows a user's identifier can lock them out indefinitely, turning security into a denial-of-service tool. |
| Why do per-account limits barely slow credential stuffing? | Stuffing tries only one or two passwords per account across many IPs, so per-account counters rarely trip. |
| Name three things that must never be logged. | Passwords (including failed ones), session or reset tokens, and Authorization or Cookie headers. |
| When can you trust X-Forwarded-For? | Only when your own reverse proxy sets it and your server is configured to accept it from that proxy alone. |

#### Chapter 4: Sessions and tokens

| Question | Answer |
|---|---|
| What is session fixation and how do you prevent it? | An attacker plants a known session ID before login; issuing a fresh session ID at login (and on privilege changes) defeats it. |
| What does HttpOnly protect against and what does it not? | It stops JavaScript from reading the cookie, so XSS cannot steal it; XSS can still make requests while the page is open. |
| What does the `__Host-` cookie prefix guarantee? | The cookie is Secure, has Path=/ and no Domain, so it is host-only and cannot be set by subdomains or insecure pages. |
| When is SameSite=Lax enough to stop CSRF? | When no GET request changes state and there are no compromised same-site neighbours; add an Origin or header check for defence in depth. |
| Why does CSRF not apply to bearer tokens in an Authorization header? | Browsers do not attach them automatically; only your JavaScript adds them, which another site cannot do. |
| How do you prevent JWT algorithm confusion? | The verifier pins the accepted algorithm (`algorithms=[...]` in PyJWT) and never trusts the token's `alg` header. |
| What should happen when a used refresh token is presented again? | Treat it as theft and revoke the whole token family, forcing a fresh login. |
| Why are JWTs hard to revoke? | Verification checks only the signature and claims, so a token stays valid until expiry unless you add a server-side lookup. |

#### Chapter 5: Recovery

| Question | Answer |
|---|---|
| List four properties of a correct reset token. | Random from a CSPRNG, stored only as a hash, short expiry, single use (also bound to one user and invalidated on password change). |
| Why should reset links be built from configuration rather than the Host header? | An attacker can set the Host header so the genuine email contains a link to their own site with a valid token. |
| Why are security questions rejected by modern guidance? | Answers are guessable, researchable, unchangeable and often known to family members. |
| What should happen to sessions after a password reset? | All existing sessions and refresh tokens are revoked. |
| How can a home LAN app recover accounts without email? | Admin-issued one-time codes, printed recovery codes, or a command-line reset on the server. |

#### Chapter 6: Other ways to log in

| Question | Answer |
|---|---|
| What does OpenID Connect add to OAuth 2.0? | An ID token, a signed JWT stating who the user is, for which client, issued by whom. |
| What do `state`, `nonce` and PKCE each defend against? | `state` defeats CSRF on the callback; `nonce` binds the ID token to this login; PKCE stops a stolen authorization code being redeemed. |
| Why are passkeys phishing-resistant? | The browser binds credentials to the site's domain, so a look-alike site cannot obtain a valid signature. |
| Why can a passkey not be used at `https://192.168.1.4`? | The WebAuthn relying party ID must be a domain name, not an IP address. |
| Why should TOTP enrolment require a confirmation code? | It proves the authenticator app was set up correctly before 2FA is enforced, preventing self-lockout. |
| Why is SMS a weak second factor? | SIM swapping, network interception and relay phishing; NIST treats it as restricted. |

#### Chapters 7 to 11

| Question | Answer |
|---|---|
| What is an IDOR, and is a random ID a fix? | Using a client-supplied ID without an ownership check; random IDs only add obscurity, the fix is a server-side authorisation check. |
| Why might you return 404 instead of 403 for another user's resource? | It avoids confirming that the resource or user exists. |
| What is mass assignment? | Copying all client-supplied fields onto a record, letting a user set fields like `role`; prevent it with explicit input models. |
| In a Postgres RLS update policy, why are both `using` and `with check` needed? | `using` limits which rows can be targeted; `with check` stops a row being changed to belong to someone else. |
| What is the most important lock-in question when choosing an auth provider? | Whether you can export password hashes in a usable format. |
| What is the realistic capacity threat for a login endpoint? | Attack traffic exhausting CPU and memory through hashing; fix with rate limits before hashing and a concurrency cap. |
| How do key IDs make JWT key rotation smooth? | Verifiers hold several keys selected by `kid`, so you can add a new signing key, wait for old tokens to expire, then remove the old one. |
| What is the GDPR deadline for reporting a notifiable breach to the regulator? | 72 hours from becoming aware of it (this is not legal advice). |
| What single change removes Rankwise's largest read-IDOR? | Replacing the all-learners states endpoint with a minimal comparison summary and adding ownership checks to every `{uid}` route. |

### Glossary

| Term | Meaning |
|---|---|
| ABAC | Attribute-based access control: decisions computed from attributes of user, resource, action and environment. |
| Absolute timeout | Maximum lifetime of a session since login, regardless of activity. |
| Access token | A short-lived credential presented to an API, often a JWT in an Authorization header. |
| Account enumeration | Learning whether an account exists from differences in responses or timing. |
| Account linking | Connecting an external identity (for example Google) to a local account. |
| Argon2id | Memory-hard password hashing function, winner of the Password Hashing Competition, standardised in RFC 9106. |
| Audience (`aud`) | JWT claim naming the intended recipient of a token. |
| Authenticator | Something used to prove identity: a password, a device holding a passkey, a TOTP app. |
| Authorization code flow | OAuth flow where the browser receives a short-lived code that the server exchanges for tokens. |
| bcrypt | Older adaptive password hash with a 72-byte input limit; still acceptable. |
| CAPTCHA | A challenge meant to distinguish humans from bots, best used as escalation. |
| Ceremony | WebAuthn's term for the registration and authentication flows. |
| Confidential client | An OAuth client that can keep a secret, such as a server-side app. |
| Credential stuffing | Trying username and password pairs leaked from other sites. |
| CSP | Content Security Policy: a header restricting which scripts and resources a page may load. |
| CSPRNG | Cryptographically secure pseudo-random number generator; in Python, the `secrets` module. |
| CSRF | Cross-site request forgery: another site causing the browser to send authenticated requests to yours. |
| Defence in depth | Layering independent controls so one failure is not catastrophic. |
| DKIM | Email standard where the sender signs messages, verified with a key in DNS. |
| DMARC | DNS policy telling receivers how to handle mail failing SPF or DKIM checks. |
| Double-submit cookie | CSRF defence comparing a token in a cookie with one in a header, ideally HMAC-signed and bound to the session. |
| Fail closed | Denying access when something unexpected happens. |
| Fetch Metadata | Browser request headers such as `Sec-Fetch-Site` that describe a request's context. |
| HMAC | Keyed hash construction used for message authentication, peppers and HS256 JWTs. |
| HSTS | Strict-Transport-Security header telling browsers to use only HTTPS for a site. |
| HttpOnly | Cookie attribute that hides the cookie from JavaScript. |
| ID token | OpenID Connect JWT asserting the user's identity to a client. |
| Idle timeout | Session ends after a period without activity. |
| IDOR | Insecure direct object reference: accessing objects by client-supplied ID without an authorisation check. |
| Impersonation | An admin acting as a user, which must be explicit, limited and fully logged. |
| JWKS | JSON Web Key Set: a published list of public keys, selected by key ID. |
| JWT | JSON Web Token: base64url header, payload and signature carrying claims. |
| `kid` | Key ID in a JWT header, used to select the verification key. |
| k-anonymity | Querying with a partial value shared by many records so the service cannot identify yours. |
| Least privilege | Granting only the access needed for a task. |
| Magic link | A one-time login link sent by email. |
| MFA | Multi-factor authentication: two or more different kinds of authenticator. |
| Multi-tenant | One deployment serving several isolated customers. |
| Nonce | A one-time random value; in OIDC, binds the ID token to a specific login request. |
| OAuth 2.0 | Framework for delegated authorisation, issuing access tokens to clients. |
| OpenID Connect (OIDC) | Identity layer on OAuth 2.0 that adds ID tokens. |
| Opaque token | A random token with no embedded meaning, validated by lookup. |
| Passkey | A WebAuthn public-key credential used instead of a password, often synced across devices. |
| PBKDF2 | Iterated HMAC password hash, not memory-hard, used where FIPS compliance is required. |
| Pepper | A secret mixed into password hashing and stored outside the database. |
| PHC string format | The `$algorithm$version$params$salt$hash` encoding of password hashes. |
| PKCE | Proof Key for Code Exchange: binds an authorization code to the client that requested it. |
| Public client | An OAuth client that cannot keep a secret, such as a browser or mobile app. |
| RBAC | Role-based access control: permissions assigned to roles, roles to users. |
| ReBAC | Relationship-based access control: permissions derived from relationships in a graph. |
| Recovery codes | One-time backup codes for regaining access when other factors are lost. |
| Refresh token | A long-lived credential used only to obtain new access tokens. |
| Relying party (RP) | In WebAuthn and OIDC, the application relying on the authentication. |
| Row-level security (RLS) | Database policies that restrict which rows a query can see or change. |
| Salt | Unique random value per password hash, stored with it. |
| SameSite | Cookie attribute controlling whether cookies are sent on cross-site requests. |
| Session fixation | Attack where the victim is made to use a session ID the attacker knows. |
| SPF | DNS record listing servers allowed to send mail for a domain. |
| Token family | All refresh tokens descended from one login, revoked together on reuse. |
| TOTP | Time-based one-time password (RFC 6238), the 6-digit authenticator app code. |
| Trust boundary | A point where data passes from an untrusted to a trusted component. |
| WebAuthn | W3C standard API for public-key authentication in browsers. |
| XSS | Cross-site scripting: attacker-controlled script running in your page. |

### Further reading

#### OWASP

- **OWASP Authentication Cheat Sheet**, https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html. A concise checklist for login, error messages, throttling and MFA; read it alongside chapter 3.
- **OWASP Password Storage Cheat Sheet**, https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html. The current recommended algorithms and minimum parameters for Argon2id, scrypt, bcrypt and PBKDF2.
- **OWASP Session Management Cheat Sheet**, https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html. Session ID properties, cookie attributes, timeouts and fixation.
- **OWASP Forgot Password Cheat Sheet**, https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html. Reset token rules, uniform responses and common reset mistakes.
- **OWASP Cross-Site Request Forgery Prevention Cheat Sheet**, https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html. Synchronizer tokens, signed double-submit cookies, Fetch Metadata and SameSite.
- **OWASP Application Security Verification Standard (ASVS)**, https://owasp.org/www-project-application-security-verification-standard/. A requirement-by-requirement checklist to review an auth design against.

#### Standards and guidelines

- **NIST SP 800-63B, Digital Identity Guidelines: Authentication and Authenticator Management**, https://pages.nist.gov/800-63-4/sp800-63b.html. The source of modern password policy and authenticator strength levels.
- **RFC 6749, The OAuth 2.0 Authorization Framework**, https://www.rfc-editor.org/rfc/rfc6749. The base OAuth specification: roles, grants and endpoints.
- **RFC 7636, Proof Key for Code Exchange (PKCE)**, https://www.rfc-editor.org/rfc/rfc7636. Short and readable; explains exactly what PKCE prevents.
- **RFC 9700, Best Current Practice for OAuth 2.0 Security**, https://www.rfc-editor.org/rfc/rfc9700. Today's OAuth security rules, including deprecating the implicit flow and refresh token rotation.
- **RFC 7519, JSON Web Token (JWT)**, https://www.rfc-editor.org/rfc/rfc7519. Token structure and registered claims.
- **RFC 8725, JSON Web Token Best Current Practices**, https://www.rfc-editor.org/rfc/rfc8725. The pitfalls (algorithm confusion, `none`, audience checks) and how to avoid them.
- **RFC 6238, TOTP: Time-Based One-Time Password Algorithm**, https://www.rfc-editor.org/rfc/rfc6238. How authenticator app codes are computed and validated.
- **RFC 9106, Argon2 Memory-Hard Function**, https://www.rfc-editor.org/rfc/rfc9106. The Argon2 specification and its recommended parameter profiles.
- **OpenID Connect Core 1.0**, https://openid.net/specs/openid-connect-core-1_0.html. ID token contents and the validation steps a client must perform.

#### Passkeys

- **W3C Web Authentication (WebAuthn) Level 3**, https://www.w3.org/TR/webauthn-3/. The specification; dense, but authoritative on ceremonies and verification.
- **passkeys.dev**, https://passkeys.dev. Practical developer guidance on passkey UX, sync, recovery and device support.

#### Tools and libraries

- **Have I Been Pwned Pwned Passwords API**, https://haveibeenpwned.com/API/v3#PwnedPasswords. The range API and padding header used in chapter 2.
- **argon2-cffi documentation**, https://argon2-cffi.readthedocs.io. PasswordHasher parameters, profiles and rehashing.
- **PyJWT documentation**, https://pyjwt.readthedocs.io. Decoding options, required claims and JWKS client usage.
- **Authlib documentation**, https://docs.authlib.org. OAuth and OIDC clients for Starlette and FastAPI.
- **py_webauthn**, https://github.com/duo-labs/py_webauthn. Server-side WebAuthn verification in Python, with examples.
- **mkcert**, https://github.com/FiloSottile/mkcert. Locally trusted development certificates, used in chapter 11.

### Key takeaways

- If you can answer the self-check questions without looking, you understand the core of authentication design.
- The glossary terms are the shared vocabulary of security reviews; use them precisely.
- The OWASP cheat sheets and NIST SP 800-63B are the first places to check when guidance may have changed.
- RFC 9700 and RFC 8725 are the most practical standards for anyone using OAuth or JWTs.



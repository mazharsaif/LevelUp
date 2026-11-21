# JWT Authentication for the AI Services: A Learning Guide

Nov 16, 2026 · @Mazhar Mumbaiwala

## How to read this guide

Your job, in one sentence: every AI host must stop trusting a shared `X-Password` and instead check a short-lived, signed token (a JWT) that Laravel issues, then decide from that token whether the caller may use the endpoint. Everything in this guide exists to make that one sentence feel obvious.

The change comes from tickets EX-3258 and EX-3259 and fixes pentest finding EX-3055. Laravel's side is done. The AI side is what remains, and the AI team implementation guide (the PDF) is the contract. This document teaches you enough to implement that contract without guessing.

### The big picture in five lines

1. A user logs in to an Examini app. Laravel checks their password (or SSO) as it always has.
2. Laravel hands the app a second, special-purpose token called `ai_token`. It is a JWT that says "user 141, a student at university 12, may do face, ID, OCR and image checks", and it expires in 15 minutes.
3. Laravel signs that token with a **private key** only Laravel holds. Think of it as a wax seal only Laravel can make.
4. The app sends the token to your AI service in an `Authorization: Bearer <token>` header.
5. Your service checks the seal with Laravel's **public key** (which anyone may have), checks the expiry and a few other fields, checks the permission, and then runs the model.

The Laravel backend does the same thing for its own calls (grading, question generation and so on), using a 5-minute **service token**.

### The one analogy to keep in your head

A JWT is like a **festival wristband**. The ticket office (Laravel) checks your ID once and puts a wristband on you. The wristband is printed with what you may do ("backstage: no, bar: yes") and a date. It has a hologram that only the ticket office can produce. The security guard at each stage (your AI service) never phones the ticket office. They just look at the hologram, read the wristband and let you in or not.

That is the whole idea behind stateless token authentication. The rest is detail about how the hologram works (cryptography), what is printed on the band (claims), how guards learn what a real hologram looks like (JWKS), and what happens when the band expires (refresh).

### How the sections build

| Section | What you get from it | Depth |
| --- | --- | --- |
| Foundations | Vocabulary: authentication, authorization, sessions, tokens; why `X-Password` is weak | Short |
| Cryptography primer | Encoding vs encryption vs hashing vs signing; public and private keys | Deep |
| Anatomy of a JWT | Decode a real token by hand; every claim we use | Deep |
| RS256 vs HS256 | Why we use asymmetric keys; the two classic attacks | Deep |
| JWKS | How you get Laravel's public keys, cache them and survive key rotation | Deep |
| Our system end to end | Who sends which token where, every flow | Medium |
| Verification step by step | The eight checks, with complete Python middleware | Deepest |
| Roles and scopes | 401 vs 403 and the endpoint-to-scope table | Medium |
| Rollout | Running old and new side by side, deploy order, CORS, IP allowlisting | Medium |
| Pitfalls and troubleshooting | Logging, revocation, a 401 checklist | Medium |
| Testing | The 16 sign-off cases as pytest | Medium |
| Glossary and quiz | Look-ups and a self-check | Reference |

If you only have 20 minutes, read "Our system end to end" and "Verification step by step" and come back for the rest. If you have the full hour or two, read in order: each section assumes the previous ones.

A note on sources: every fact about Examini's setup (claim names, lifetimes, scopes, status codes, the test list) comes from the three Laravel-team PDFs: the AI team guide and the React and mobile app guides. Host names appear as placeholders like `https://<laravel-host>` because the guides use placeholders too. General concepts come from standard practice and the RFCs listed at the end.

## Foundations: who are you, and what may you do?

Security on an API boils down to two separate questions, asked in order: **who is calling?** and **are they allowed to do this?** Today the AI services answer neither well. The shared `X-Password` only proves "someone who knows the password", and that someone could be anyone.

### Authentication vs authorization

- **Authentication** (often shortened to *authn*) answers "who are you?". Showing a passport at the airport is authentication.
- **Authorization** (*authz*) answers "what may you do?". The boarding pass that lets you onto one specific flight, not every flight, is authorization.

They fail differently, and HTTP has a separate status code for each:

| Failure | HTTP code | Plain meaning | Our example |
| --- | --- | --- | --- |
| Authentication failed | **401 Unauthorized** (badly named; it really means "unauthenticated") | "I don't know who you are, or your proof is bad" | Expired token, forged signature, no header |
| Authorization failed | **403 Forbidden** | "I know exactly who you are, and you may not do this" | A valid student token calling a grading endpoint |

This split is not academic for us. The apps react differently to each code: on 401 they fetch a new token and retry once, on 403 they give up and report a bug. Getting the code wrong breaks the apps. Section "Roles, scopes, 401 vs 403" goes deeper.

### A **credential** is anything that proves identity

A password, a fingerprint, an API key and a token are all credentials. The interesting differences are: who has it, how long it lasts, what it says about you, and how the server checks it.

### Sessions vs tokens: two ways to remember who logged in

HTTP is **stateless**: each request arrives alone, with no memory of the previous one. So after you log in, the server needs a way to recognise your next request. There are two broad approaches.

**Server-side sessions (the cloakroom ticket).** You hand in your coat; you get a numbered ticket. The ticket itself means nothing. The cloakroom keeps a list: ticket 47 = the blue coat. Every time you show the ticket, staff look it up.

- The server stores a session record (in memory, Redis or a database) and gives the client a random **session id**, usually in a cookie.
- Every request costs a lookup in that store.
- Logging someone out is easy: delete the record.
- Every server that wants to check the session needs access to the same store.

**Self-contained tokens (the wristband).** The token itself carries the facts ("user 141, student, expires 10:15") plus a tamper-proof seal. The server checks the seal and reads the facts. No lookup.

- Nothing to store on the server. Any service that knows how to check the seal can verify the token, even a service in another language on another host. This is exactly why tokens suit us: Laravel issues, Python verifies, and they never need to talk per request.
- The trade-off: you can't easily "un-issue" a token. It stays valid until it expires. That's why our tokens live only 15 minutes (5 for the backend). More on this in the revocation part of section "Security pitfalls".

Laravel's normal login token (from Passport, the Laravel OAuth library) stays as it is and is sent only to Laravel APIs. The new `ai_token` is a separate self-contained token, sent only to the AI API. Two tokens, two audiences.

### Bearer tokens

A **bearer token** is a token where "whoever bears (holds) it may use it", like cash or a concert ticket. There is no extra proof that the holder is the rightful owner. It travels in a standard header:

```http
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6IjIwMjYtMTEifQ.eyJ...
```

Because anyone who steals it can use it, a bearer token must only travel over HTTPS, must never be logged, and should be short-lived. Those three rules come back again and again.

### What we have today, and why it's weak

Today every caller sends the same header:

```http
X-Password: <shared password>
```

The AI guide sums up the problems in a table; here they are with the reasoning behind each:

| Property | `X-Password` today | Why it matters |
| --- | --- | --- |
| Who knows it | Every caller: every app build, the Laravel backend, every developer | A secret shared by many is not a secret. The React guide states it plainly: anything in the React build, including `REACT_APP_*` and `VITE_*` values, ends up in the public JS bundle, "that's how the old password leaked". Mobile apps can be unpacked the same way. |
| Lifetime | Never expires | One leak works forever, until someone changes it everywhere at once. |
| Identity | None: "no idea who is calling" | You can't log per user, rate-limit per university or tell a student from the grading cron. |
| Permissions | All or nothing | Whoever has the password can call grading, chatbot, exam risk, everything. |
| Rotation | Changing it breaks every app until each is rebuilt and shipped | So in practice it never changes. |

This is what the pentest flagged (EX-3055). The guide adds a sobering line for the end of the migration: the old password "is in git history and old app builds, so treat it as public".

### And the IP allowlist?

The current scheme was described as "secret password / IP based": besides the password, some AI hosts only accept traffic from known IP addresses. An **IP allowlist** is a list of source addresses a server (or its firewall) accepts.

It helps for server-to-server calls, such as Laravel backend to grading, because those come from a few fixed addresses. It can't protect the endpoints that apps call directly from students' phones and browsers, because those come from any address on the internet. The JWT guides don't mention IP allowlisting at all, so what to do with it is an **open decision** for the AI team. The "Rollout" section gives a recommendation.

## Cryptography primer: the four things people confuse

A JWT is not encrypted. It is **encoded** (so it fits in a header) and **signed** (so nobody can change it). Anyone can read it; only Laravel can make one that passes your check. If you remember that sentence, you have understood the most common JWT misconception.

To get there, separate four operations that people mix up: encoding, encryption, hashing and signing.

### 1. Encoding: changing the alphabet, not hiding anything

**Encoding** turns data into a different representation so it can travel through some channel. It uses no key, and anyone can reverse it. Morse code is encoding.

**Base64** turns arbitrary bytes into 64 safe characters (A–Z, a–z, 0–9, `+`, `/`), padded with `=`. **Base64url** is the same idea with two swaps so the result is safe in URLs and headers: `-` instead of `+`, `_` instead of `/`, and the `=` padding dropped. JWTs use base64url.

```python
import base64

header_b64 = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6IjIwMjYtMTEifQ"
padded = header_b64 + "=" * (-len(header_b64) % 4)   # put back the stripped padding
print(base64.urlsafe_b64decode(padded))
# b'{"typ":"JWT","alg":"RS256","kid":"2026-11"}'
```

That string is the first part of the real `ai_token` shown in the Laravel team's app guides. Decoding it needs no secret. That's why the guide warns: never log the token, and never treat its contents as private.

### 2. Encryption: hiding the content

**Encryption** scrambles data with a key so that only someone with the right key can read it. It is reversible, but only with the key. A locked diary is encryption.

Our JWTs are **not** encrypted. (There is a separate standard, JWE, for encrypted tokens; we don't use it.) Confidentiality for our tokens comes from HTTPS, which encrypts the whole request in transit.

### 3. Hashing: a fingerprint of the data

A **cryptographic hash function** takes any input and produces a fixed-size output (the **digest**). SHA-256, for example, always produces 32 bytes. Three properties matter:

- **Deterministic:** the same input always gives the same digest.
- **One-way:** from the digest you can't work back to the input.
- **Avalanche:** change one bit of input and roughly half the output bits flip. You can't make a small edit and get a similar digest.

Analogy: a fingerprint. It identifies a person, it's tiny compared with the person, and you can't rebuild the person from it.

```python
import hashlib
hashlib.sha256(b'{"role":"student"}').hexdigest()[:16]   # '...' some value
hashlib.sha256(b'{"role":"admin"}').hexdigest()[:16]     # completely different value
```

A hash alone proves nothing about who made the data: anyone can compute SHA-256. To prove origin you need a key. That's where signing comes in.

### 4. Signing: proof of who wrote it and that nobody changed it

A **digital signature** is a short value computed from the message and a secret key. Anyone with the matching verification key can check two things at once:

- **Integrity:** the message hasn't changed by a single bit since it was signed.
- **Authenticity:** it was signed by the holder of the secret key.

The message stays readable. The signature is attached next to it, like a wax seal on a letter: the letter is not hidden, but you can tell if someone opened and re-sealed it, and the seal's crest tells you who sent it.

### The comparison in one table

| Operation | Needs a key? | Reversible? | Hides the content? | What it gives you | In our system |
| --- | --- | --- | --- | --- | --- |
| Encoding (base64url) | No | Yes, by anyone | No | Safe transport of bytes as text | The three parts of every JWT |
| Encryption | Yes | Yes, with the key | Yes | Confidentiality | HTTPS (TLS) on every call |
| Hashing (SHA-256) | No | No | Sort of, but anyone can hash a guess | A fixed-size fingerprint | Inside RS256: the token is hashed, then the hash is signed |
| Signing (RSA) | Yes, a private key to sign, a public key to verify | Not applicable | No | Integrity and authenticity | The third part of every JWT |

### Symmetric vs asymmetric keys

There are two families of key, and the difference is the heart of why our design is safe.

**Symmetric** means one shared secret does both jobs. Like a house key: the same key locks and unlocks, and everyone who can get in can also lock up. For signatures, the symmetric version is called an **HMAC** (hash-based message authentication code). HS256 = HMAC with SHA-256. Whoever can *verify* an HS256 token can also *create* one, because it's the same key.

**Asymmetric** (also called **public-key** cryptography) means a matched **key pair**:

- the **private key**, kept secret by one party (Laravel), used to **sign**;
- the **public key**, given to anyone (your AI services), used to **verify**.

The maths links them so that a signature made with the private key checks out with the public key, but knowing the public key does not let you compute the private key or produce valid signatures.

Analogy: a **letterbox**. Anyone can see the slot and confirm it's the real letterbox (verify); only the owner has the key that opens it. Or, closer to signing: a **royal seal**. Everyone in the kingdom has seen the king's crest and can recognise a real seal (public key). Only the king holds the signet ring that makes it (private key).

|  | Symmetric (HS256) | Asymmetric (RS256) |
| --- | --- | --- |
| Keys | One shared secret | Private key + public key |
| Who can sign | Everyone who holds the secret | Only the private-key holder (Laravel) |
| Who can verify | Everyone who holds the secret | Anyone with the public key |
| If an AI host leaks its key | Attacker can mint tokens for any user | Nothing: the public key is public anyway |
| Key distribution | Secret must be copied securely to every verifier | Publish the public key at a URL (JWKS) |
| Speed | Very fast | Signing is slower; verifying is still well under a millisecond |

For us, the asymmetric row is decisive. There are four AI hosts (main, V2, chatbot and legacy exam risk), several environments, and multiple teams. With HS256, every one of those places would hold a secret that can forge any user's token, which is the same problem as `X-Password` with extra steps. With RS256, the AI hosts hold nothing secret at all.

### How an RSA signature works, intuitively

You don't need the number theory to use RSA safely; the library does it. But a mental model helps.

**RSA** is a public-key algorithm built on the fact that multiplying two huge prime numbers is easy, while factoring the product back into those primes is practically impossible. The public key contains the product (the **modulus**, written `n`) and a small number (the **exponent**, `e`, almost always 65537). The private key additionally contains values derived from the secret primes.

Signing with **RS256** (RSASSA-PKCS1-v1\_5 with SHA-256) goes like this:

1. Take the exact bytes to protect: `base64url(header) + "." + base64url(payload)`. This is called the **signing input**.
2. Hash it with SHA-256. Now you have 32 bytes.
3. Wrap the hash in a fixed padding format and run it through the RSA private-key operation. The output, the same size as the key (for a 2048-bit key, 256 bytes), is the signature.
4. base64url-encode the signature and append it as the third part.

Verifying, which is what your service does:

1. Recompute SHA-256 of the signing input you received.
2. Run the signature through the RSA public-key operation. This recovers the padded hash Laravel signed.
3. If the two hashes match, the token is authentic and unmodified. If a single character of the header or payload changed, the hashes differ and verification fails.

&#91;embedded content: RS256 · sign with the private key, verify with the public key\]

The accent box is the only step that needs a secret, and it runs only inside Laravel. Everything on the right uses public information, yet nobody without the private key can produce a signature that passes.

This explains test case 7 from the sign-off list: "payload edited (for example `role` changed to `admin`)" must return 401. The attacker can decode the payload, change `student` to `admin` and re-encode it, which is trivial. But they can't produce a new signature without Laravel's private key, so the hashes no longer match.

### Why not just check a hash?

If the token carried only `SHA-256(payload)`, an attacker would edit the payload and recompute the hash; anyone can. The signature works only because computing it needs something the attacker doesn't have. Remember: **a hash proves nothing changed by accident; a signature proves nothing changed on purpose, and who sealed it.**

## Anatomy of a JWT: decode one by hand

A JWT (JSON Web Token, pronounced "jot", defined in RFC 7519) is three base64url strings joined by dots: `header.payload.signature`. The header says how it was signed, the payload says who and what, and the signature proves both are genuine.

### The three parts

```text
eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6IjIwMjYtMTEifQ   ← header
.
eyJpc3MiOiJodHRwczovL2xhcmF2ZWwuZXhhbXBsZS50ZXN0IiwiYXVkIjoi...  ← payload (shortened)
.
kQ3vX9...(342 characters for a 2048-bit RSA key)...              ← signature
```

A handy tell: every JWT starts with `eyJ`. That's what `{"` looks like in base64. If you see `eyJ` in a log line, someone logged a token.

The header above is copied from the real `ai_token` examples in the app guides. The payload is an **illustrative** one built for this guide: the claim names and shapes match the AI guide exactly, but the issuer `https://laravel.example.test`, the user and the times are made up.

### Part 1: the header (JOSE header)

Decoded:

```json
{"typ": "JWT", "alg": "RS256", "kid": "2026-11"}
```

| Field | Meaning | Our value | What you do with it |
| --- | --- | --- | --- |
| `alg` | Algorithm used for the signature | Always `RS256` | Refuse anything else. Never let this field pick the algorithm (next section). |
| `typ` | Media type of the token | `JWT` | Informational; not a security check. |
| `kid` | Key id: which of the issuer's keys signed it | e.g. `2026-11` | Look up the matching public key in the issuer's JWKS. |

The header is not trusted when you first read it. An attacker writes whatever they like in it. You read it only to decide which key to try, then the signature check tells you whether to believe any of it.

### Part 2: the payload (claims)

A **claim** is one statement the issuer makes about the subject, as a JSON key and value. "`role` is `student`" is a claim. Decoded, our illustrative user token reads:

```json
{
  "iss": "https://laravel.example.test",
  "aud": "ai-api",
  "sub": "141",
  "role": "student",
  "scope": "face:verify id:verify ocr:submit image:check",
  "inst": 12,
  "iat": 1795341600,
  "nbf": 1795341600,
  "exp": 1795342500,
  "jti": "3b8f0c52-7a1e-4d2b-9c4f-6e1a2d3b4c5d",
  "ver": 1
}
```

`1795341600` is a **Unix timestamp**: seconds since 1 January 1970, 00:00 UTC. It is 2026-11-22 10:00:00 UTC. `exp` is exactly 900 seconds later, 10:15:00, which matches the 15-minute user-token lifetime.

Claims come in two kinds. **Registered claims** are the short names RFC 7519 defines so every library understands them. **Private claims** are names an issuer and its consumers agree on between themselves. Here is every claim we use:

| Claim | Kind | Type | Meaning (from the AI guide) | Your check |
| --- | --- | --- | --- | --- |
| `iss` | Registered (issuer) | string | Which Laravel environment issued it: `https://<laravel-host>`, no trailing slash | Must be in your trusted-issuer list and match exactly |
| `aud` | Registered (audience) | string | Always `ai-api` | Must equal `ai-api` |
| `sub` | Registered (subject) | string | User id, or `laravel` for the service token | Must be present |
| `iat` | Registered (issued at) | integer, Unix seconds | When it was issued | Must be present; useful in logs |
| `nbf` | Registered (not before) | integer, Unix seconds | Valid from | Must not be in the future (30 s leeway) |
| `exp` | Registered (expiration) | integer, Unix seconds | Expires at | Must be in the future (30 s leeway) |
| `jti` | Registered (JWT id) | string (UUID) | Unique token id, for logs | Log it; no check needed |
| `role` | Private | string | `student`, `registrant`, `faculty`, `admin` or `service` | Must be present |
| `scope` | Private | string | Space-separated permissions, e.g. `face:verify id:verify` | Must be present; endpoint's scope must be in it, else 403 |
| `inst` | Private | integer | University id. Not in the service token. | Pass to the endpoint for logging and per-university limits |
| `ver` | Private | integer | Reserved for a future revoke check. Not in the service token. | **Ignore it for now** |
| `exam_id` | Private | integer | Optional. Not sent yet. | Ignore |

A few details worth noticing:

- **`sub` is a string, even for a numeric user id.** RFC 7519 says `sub` is a string. Don't compare it to an integer.
- **`aud` can legally be a string or an array** in the RFC. Ours is a string, and PyJWT handles both when you pass `audience="ai-api"`.
- **`scope` is a single space-separated string**, the convention from OAuth 2.0 (RFC 6749 and RFC 8693). It is not a JSON array. Split on spaces.
- **The "draft, please confirm" label.** The scopes-per-role table in the AI guide is marked as a draft. Treat scope strings as configuration you might need to change, not constants scattered through code.

### The service token looks like this

Same shape, fewer claims, shorter life. An illustrative decode:

```json
{
  "iss": "https://laravel.example.test",
  "aud": "ai-api",
  "sub": "laravel",
  "role": "service",
  "scope": "<every scope>",
  "iat": 1795341600,
  "nbf": 1795341600,
  "exp": 1795341900,
  "jti": "9a1d2e3f-..."
}
```

No `inst` and no `ver`, `sub` is the literal string `laravel`, and `exp - iat` is 300 seconds (5 minutes). The guide says the service role "has every scope"; the exact string is whatever Laravel puts there, so your code should just check membership like any other token.

### Part 3: the signature

The third part is the base64url-encoded RSA signature over the **exact bytes** `header_b64 + "." + payload_b64`. Not over the decoded JSON. That matters: if anything re-encodes the JSON (different key order, different spacing), the signature no longer matches. You never rebuild a token; you verify the string you received.

### Decode it yourself in four lines

```python
import base64, json

def b64url_decode(part: str) -> bytes:
    return base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))

header_b64, payload_b64, signature_b64 = token.split(".")
print(json.loads(b64url_decode(header_b64)))
print(json.loads(b64url_decode(payload_b64)))
```

Or with the library (we'll use these two calls in the middleware, and only for choosing the key):

```python
import jwt  # PyJWT

jwt.get_unverified_header(token)                                  # {'typ': 'JWT', 'alg': 'RS256', 'kid': '2026-11'}
jwt.decode(token, options={"verify_signature": False})["iss"]     # 'https://laravel.example.test'
```

The word **unverified** is a warning label, not a technicality. What these calls return could have been typed by an attacker. You may use it to choose which key to verify with, because a wrong choice just leads to a failed verification. You must not use it to decide anything else.

### Why the apps must not decode the token

The app guides tell React and mobile to "treat `ai_token` as an opaque string. Don't decode it; use `ai_token_expires_in` for timing." An **opaque** token is one the holder treats as a meaningless blob. This lets Laravel and the AI team change the claims later without breaking any app. The AI service is the token's **audience**, so it's the only party that reads the claims, and only after verifying.

## RS256 vs HS256, and the two attacks that live in the `alg` field

The rule is short: **your code decides the algorithm, the token never does, and the only allowed value is `RS256`.** Both classic JWT attacks work by letting the attacker-controlled `alg` header steer the verifier. Pass `algorithms=["RS256"]` explicitly and both are dead.

### The algorithm names decoded

JWT algorithm names (from RFC 7518, JSON Web Algorithms) follow a pattern: family letters plus the SHA-2 size.

| `alg` | Family | Keys | Notes |
| --- | --- | --- | --- |
| `HS256` | HMAC with SHA-256 | One shared secret | Symmetric. Anyone who verifies can forge. |
| `RS256` | RSA PKCS#1 v1.5 signature with SHA-256 | RSA private / public pair | **Ours.** The most widely supported asymmetric option. |
| `PS256` | RSA-PSS with SHA-256 | RSA pair | A more modern RSA padding. Not used here. |
| `ES256` | ECDSA on the P-256 curve with SHA-256 | Elliptic-curve pair | Smaller keys and signatures. Not used here. |
| `EdDSA` | Ed25519 | Edwards-curve pair | Modern and fast. Not used here. |
| `none` | No signature at all | None | "Unsecured JWT". Must never be accepted. |

Laravel picked RS256. The guide says "RS256 only". You don't need to support the others, and you mustn't.

### Why RS256 for us

The primer explained the core reason: with RS256 the verifiers (four AI hosts, several environments) hold only public keys, so no AI host can leak a forging key. Three further benefits follow from that:

- **Key distribution is a URL.** Laravel publishes its public keys at `https://<laravel-host>/.well-known/jwks.json`. No secret ever needs to be copied into AI configuration.
- **Rotation needs no coordination.** Laravel can add a new key, start signing with it and later remove the old one. Verifiers pick up the change from the JWKS. (Next section.)
- **Clear responsibility.** Only Laravel can mint. If a forged token ever turns up, the investigation starts and ends at Laravel's private key.

### Attack 1: `alg: none`

RFC 7519 defines an "unsecured JWT" with `"alg": "none"` and an empty signature. It was meant for situations where integrity is guaranteed some other way. Early libraries implemented it faithfully: if the header said `none`, they skipped verification and returned the claims.

The attack is therefore trivial:

```python
import base64, json
b64 = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b"=").decode()

forged = b64({"alg": "none", "typ": "JWT"}) + "." + b64({
    "iss": "https://laravel.example.test", "aud": "ai-api",
    "sub": "1", "role": "admin", "scope": "proctor:risk grading:run",
    "exp": 9999999999, "nbf": 0, "iat": 0,
}) + "."   # note the empty signature after the last dot
```

A vulnerable verifier reads `alg: none`, skips the check and accepts an admin token that nobody issued. This is test case 9 ("header `alg` set to `none` or `HS256`": 401).

**Defence:** pass an explicit allowlist. In PyJWT 2.x, `jwt.decode(token, key, algorithms=["RS256"], ...)` rejects `none` because it's not in the list. (PyJWT 2 actually requires the `algorithms` argument whenever it verifies; older 1.x versions did not, which is one reason to make sure you're on 2.x.)

### Attack 2: algorithm confusion (RS256 → HS256)

This one is subtler, and it's the attack the AI guide warns about by name: "If a library accepts HS256 here, an attacker can sign a token with our public key as the secret."

Here is the trap. Picture a naive verifier that looks like this:

```python
# DON'T DO THIS
header = jwt.get_unverified_header(token)
claims = jwt.decode(token, PUBLIC_KEY_PEM, algorithms=[header["alg"]])   # the token picks the algorithm
```

In normal use the header says `RS256`, the library treats `PUBLIC_KEY_PEM` as an RSA public key, and all is well. Now the attacker:

1. Downloads our public key. It's public: it sits in the JWKS for anyone to fetch.
2. Writes a payload with `role: admin` and a header with `"alg": "HS256"`.
3. Computes `HMAC-SHA256(key = the public key's bytes, message = header.payload)` and attaches it as the signature.

The verifier reads `HS256` from the header and calls HMAC verification with the "key" it was given, which is the public key's bytes. HMAC is symmetric: it recomputes the same HMAC with the same bytes, gets the same answer, and accepts. The attacker has forged a token using only public information.

The root cause is that one variable (`PUBLIC_KEY_PEM`) meant "verify-only RSA key" to the developer and "shared HMAC secret" to the library, and the attacker got to choose which interpretation applied.

**Defences, in order of importance:**

1. **Hard-code the allowed algorithm list:** `algorithms=["RS256"]`. An `HS256` header is then rejected before any key is used. This alone closes the hole.
2. **Pass a typed key object, not raw bytes.** `PyJWKClient` and `jwt.PyJWK` give you an RSA public-key object, which can't be used as an HMAC secret.
3. **Rely on library safety nets, but don't depend on them.** PyJWT 2.x refuses to use a PEM-encoded public key as an HMAC secret and raises `InvalidKeyError`. That's a good backstop. It isn't a reason to skip step 1.

### The general lesson: never trust what you're verifying to tell you how to verify it

Both attacks are the same mistake: the verifier let an untrusted input choose its security parameters. The same thinking applies elsewhere in the token:

| Header or claim | Attacker-controlled before verification? | Safe use before verifying | Unsafe use |
| --- | --- | --- | --- |
| `alg` | Yes | Comparing against `RS256` and rejecting if different | Passing it to the library as the algorithm |
| `kid` | Yes | Looking up a key in a JWKS you fetched from a trusted URL | Using it as a file path, URL or SQL fragment |
| `iss` | Yes | Looking up an issuer in your own trusted list | Fetching a JWKS from whatever URL `iss` contains |
| `jku`, `x5u` (URL headers) | Yes | Ignoring them | Fetching keys from a URL the token supplies |

`jku` and `x5u` are standard headers that point to a key URL. Our tokens don't use them, and your code should never read them. The JWKS URL comes from your configuration, paired with each trusted issuer, full stop.

RFC 8725 ("JWT Best Current Practices") is the canonical list of these lessons. It's short and worth reading once you've finished this guide.

## JWKS: how you get Laravel's public keys and keep them fresh

Your service learns Laravel's public keys by downloading a small JSON file, the **JWKS**, from each trusted Laravel environment, caching it for an hour, and picking the key whose `kid` matches the token. Done right, verification needs no network call at all on the request path, and survives Laravel being down.

### What a JWK and a JWKS are

A **JWK** (JSON Web Key, RFC 7517) is a public key written as JSON instead of the PEM text block you may have seen (`-----BEGIN PUBLIC KEY-----`). A **JWKS** (JWK Set) is simply `{"keys": [ ... ]}`, a list of JWKs.

Laravel serves its JWKS at the conventional "well-known" path:

```http
GET https://<laravel-host>/.well-known/jwks.json
```

The response looks like this (illustrative values; the modulus is truncated):

```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "alg": "RS256",
      "kid": "2026-11",
      "n": "u1SU1LfVLPHCozMxH2Mo4lgOEePzNm0tRgeLezV6ffAt0gunVTLw7onLRnrq0_IzW7yWR7QkrmBL7jTKEn5u-qKhbwKfBstIs-bMY2Zkp18gnTxKLxoS2tFczGkPLPgizskuemMghRniWaoLcyehkd3qqGElvW_VDL5AaWTg0nLVkjRo9z-40RQzuVaE8AkAFmxZzow3x-VJYKdjykkJ0iT9wCS0DRTXu269V264Vf_3jvredZiKRkgwlL9xNAwxXFg0x_XFw005UWVRIkdgcKWTjpBP2dPwVZ4WWC-9aGVd-Gyn1o0CLelf4rEjGoXbAAEgAqeGUxrcIlbjXfbcmw",
      "e": "AQAB"
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `kty` | Key type: `RSA` |
| `use` | Intended use: `sig` (signature verification) |
| `alg` | Algorithm this key is for: `RS256` |
| `kid` | Key id. The token header's `kid` must match one of these. |
| `n` | The RSA modulus, base64url-encoded (about 342 characters for a 2048-bit key) |
| `e` | The RSA public exponent, base64url. `AQAB` is the bytes `01 00 01` = 65537. |

There's nothing secret in this file. Publishing it is the point.

### The `kid`: a label on the key ring

An issuer may have more than one key at a time (during rotation, it always does). The **`kid`** in the token header says which one signed this token, like a label on a key ring. You look up that exact `kid` in the JWKS.

The guide is firm: "Always select by `kid`, never just 'the first key'." If you take `keys[0]` and Laravel has just put the new key first, every token signed with the old key fails. Or the reverse. Either way, an outage on rotation day.

### Caching: why and how long

If you fetched the JWKS on every request, you'd add a network round trip to every AI call and make Laravel a single point of failure for the whole AI platform. Instead:

| Rule from the guide | Value | Why |
| --- | --- | --- |
| Fetch at startup, or lazily on first use | — | Either is fine; lazy keeps startup independent of Laravel |
| Cache lifetime | **1 hour** (Laravel sends `Cache-Control: max-age=3600`) | Keys change rarely; an hour keeps load on Laravel negligible |
| Per-request network calls | **None** | Verification is local CPU work, "well under a millisecond" |
| Fetch timeout | **5 seconds** (short) | A hung Laravel must not hang your request threads |
| On refetch failure | **Keep the cached keys**; don't wipe the cache | A Laravel blip must not take down AI. This is test case 15: Laravel unreachable after keys are cached, still 200 for valid tokens. |
| Unknown `kid` | Refetch **once**, rate-limited to about **one per issuer per minute** | A new key may have been rotated in, but random `kid`s from attackers must not flood Laravel. Test case 10: 401 and only one refetch. |

The last row deserves a closer look, because it balances two risks:

- **Too strict** (never refetch until the hour is up): when Laravel rotates to a brand-new key, every token signed with it gets 401 for up to an hour.
- **Too loose** (refetch on every unknown `kid`): an attacker sends a thousand tokens per second, each with `kid: "random-123"`, and your AI fleet hammers Laravel's JWKS endpoint a thousand times per second. You've built a denial-of-service amplifier.

The rate limit ("at most one refetch per issuer per minute") gives you both: a genuine new key is picked up on its first use (or within a minute, if a refetch just happened), and junk `kid`s cost Laravel at most one request a minute per issuer per AI process.

### Key rotation: changing the lock without locking anyone out

**Key rotation** means replacing the signing key pair periodically, or immediately if the private key might have leaked. The `kid` format in our tokens, such as `2026-11`, suggests a year-month naming scheme, though the guide doesn't specify a schedule. The safe choreography, which is what the guide's "During key rotation the JWKS lists two keys for a while" refers to, goes like this:

| Phase | JWKS contains | Laravel signs with | What verifiers see |
| --- | --- | --- | --- |
| 1. Normal | old key | old key | All tokens carry the old `kid` |
| 2. Publish new key | old + new | still old | Caches pick up the new key at their next hourly refresh; nothing visible yet |
| 3. Switch signing | old + new | **new** | New tokens carry the new `kid`; old ones still verify until they expire |
| 4. Retire old key | new only | new | After every old token has expired (at most 15 min), the old key is removed |

If Laravel switches signing (phase 3) before your cache has the new key, the unknown-`kid` refetch rescues you. That's exactly why the refetch exists. Your code doesn't need to know a rotation is happening. It just needs to select by `kid` and refetch on a miss.

### Multiple issuers: one AI deployment, several Laravel environments

The guide calls this out in bold: "One AI deployment can serve several Laravel environments. For example, the dev AI may be called by both dev3 and staging." Each Laravel environment has **its own key pair and its own JWKS URL**. A dev3 token is signed by dev3's private key and can only be verified with dev3's public key.

So your configuration is a **trusted-issuer list**, each issuer paired with its JWKS URL:

```python
# Example shape only: real hosts come from your environment config
TRUSTED_ISSUERS = {
    "https://<dev3-laravel-host>":    "https://<dev3-laravel-host>/.well-known/jwks.json",
    "https://<staging-laravel-host>": "https://<staging-laravel-host>/.well-known/jwks.json",
}
```

The flow per request:

1. Read `iss` from the **unverified** payload.
2. If it's not a key in `TRUSTED_ISSUERS`, return 401. Never fetch a JWKS from a URL derived from the token.
3. Otherwise use that issuer's cached JWKS and verify, passing `issuer=iss` to the library so it re-checks `iss` after verification.

Why is reading `iss` before verifying safe here? Because the only thing it does is choose among keys **you** configured. If an attacker lies about `iss` and names staging on a dev3 token, verification runs against staging's keys and fails. The guide's wording is precise: "Use the token's `iss` only to choose which JWKS to check against."

Two exact-match details trip people up:

- `iss` has **no trailing slash**: `https://<laravel-host>`, not `https://<laravel-host>/`. Exact string comparison means one stray slash is a 401 (test case 11 territory).
- Keep the list in **configuration**, not code. The guide: "Keep all of these values in configuration (environment variables or a config file), not in code."

### Network access

Each AI server must be able to reach its Laravel hosts' JWKS over HTTPS. The guide notes that staging may become employee-only, so the Laravel team asks for the AI servers' **outgoing IPs** to keep `/.well-known/jwks.json` open for them. That's an action item for the AI team: collect the egress IPs of each AI host and send them over.

## Our system end to end

There is one issuer (Laravel, per environment), two kinds of caller (the apps with user tokens, the Laravel backend with service tokens) and four AI hosts that all verify the same way. Your code never issues or refreshes tokens; it only verifies them and answers 200, 401 or 403. Knowing the flows around you tells you what those answers trigger.

### The actors

| Actor | Role in this system | Holds |
| --- | --- | --- |
| **Laravel** (one per environment: dev3, staging, production and so on) | The **issuer**: logs users in, mints and signs every JWT, publishes its JWKS | The private signing key |
| **React web app, desktop app, mobile apps** | **Clients** that call AI directly for face verification, ID check, OCR and image check | The user's login token (for Laravel) and `ai_token` (for AI) |
| **Laravel backend** | A client that calls AI for grading, question generation, rubric, tagging, Bloom, chatbot, exam risk and OMR | Mints its own 5-minute service token |
| **AI hosts**: main AI host, new V2 host, chatbot host, legacy exam-risk host | The **resource servers** (the APIs being protected); the token's audience, `ai-api` | Only the public keys, via JWKS |

The guide is explicit that the change isn't optional anywhere: "Every AI host that receives these calls needs this change."

&#91;embedded content: Our system · one issuer, two callers, four AI hosts\]

Only the issuer box holds a secret. Every arrow into the AI hosts carries a Bearer token, and the only call the AI hosts make is the dashed hourly JWKS fetch.

### Two tokens per user, never mixed up

After login, each app holds two different bearer tokens. This is the single biggest source of confusion, so it's worth a table:

|  | Login token | AI token |
| --- | --- | --- |
| JSON field | `token` | `ai_token` |
| Made by | Laravel Passport (as today) | Laravel's new RS256 issuer |
| Sent to | Laravel APIs only | AI API only |
| Header | `Authorization: Bearer <token>` | `Authorization: Bearer <ai_token>` |
| Lifetime | Longer-lived (as today) | 15 minutes (900 s) |
| Used to refresh the AI token? | **Yes**: it's what `POST /api/ai/token` needs | No |

Both use the same header name, which is why it's easy to send the wrong one. If your service starts seeing tokens that fail with "wrong audience" or "unknown issuer", a client sending its Passport token to AI is a prime suspect. (Passport tokens are JWTs too: the example in the app guides starts with `eyJ` and has `"alg":"RS256"` but no `kid`, and its `aud` is a Passport client id, not `ai-api`. Your audience check rejects them, as it should.)

### Flow 1: login

- **Mobile:** `POST /api/loginExam`, same request as today.
- **React web:** `POST /api/login`, same request as today (password or Okta).

The response gains two fields:

```json
{
  "result": {
    "id": 141,
    "university_id": 12,
    "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoi...",
    "ai_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6IjIwMjYtMTEifQ.eyJpc3MiO...",
    "ai_token_expires_in": 900
  },
  "message": "Login Successfully.",
  "status": 200
}
```

(Fields trimmed; the full example is in the app guides.) Notice `id: 141` and `university_id: 12`: in the AI token these become `sub: "141"` and `inst: 12`.

If Laravel couldn't create the AI token, **login still succeeds** with `"ai_token": null, "ai_token_expires_in": 0`, and the app calls the refresh endpoint before its first AI call. From your side, nothing special: you just never see a null token, because the app won't send one.

### Flow 2: SSO login

`POST /api/saml/exchange` returns the same response shape with `ai_token` and `ai_token_expires_in`. Mobile sends `device` 1 (iPhone) or 4 (Android); the web app sends any other device value. To your service, an SSO user's token is indistinguishable from a password user's, which is exactly the point.

### Flow 3: signup, before the first login

Face verification and the ID card check happen **during signup, before the student can log in**. There's no login token yet, so the invite screen's existing call now also returns an AI token:

```http
POST /api/getInvitedStudentData
Content-Type: application/json

{ "invite_id": "<invite id from the link>" }
```

The response includes `ai_token` and `ai_token_expires_in: 900`. This token carries role **`registrant`**, which the AI guide defines as "a student on the signup screen, before their first login. Can do face, ID, OCR and image checks only." So a registrant has exactly the four app scopes: `face:verify id:verify ocr:submit image:check`.

Three rules from the app guides:

- The signup token works only for face verification, ID card check, OCR and image check.
- To refresh it during signup, the app calls `getInvitedStudentData` again with the same `invite_id`. The normal refresh endpoint can't be used because there's no login token.
- After the student logs in, the app throws the signup token away and uses the login `ai_token`.

This is why test case 14 exists: "Registrant token on a face endpoint: 200." Forget the registrant role in your scope mapping and signup breaks.

### Flow 4: calling AI and refreshing

The app sends the same AI URLs and request bodies as before; only the header changes:

```http
POST https://<ai-host>/<face-verify-path>
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImtpZCI6IjIwMjYtMTEifQ.eyJ...
Content-Type: application/json
```

The app keeps its own clock for the token: on receipt it sets `expiresAt = now + ai_token_expires_in`. Its rules (identical in the React and mobile guides):

| Situation | App action |
| --- | --- |
| Login, SSO login or signup response arrives | Save `ai_token`; set `expiresAt = now + ai_token_expires_in` seconds |
| Before each AI call | If `ai_token` is null, or `expiresAt` is **less than 60 s away**, refresh first |
| AI API returns **401** | Refresh, then retry the AI call **once** |
| AI API returns **403** | Don't refresh; report it |
| `/api/ai/token` returns 401 | Log the user out |
| App back from background / tab back from sleep | If `expiresAt` has passed, refresh before the next AI call |
| Page reload (web) | If the stored `ai_token` is missing or expired, refresh |
| Logout | Delete `ai_token` along with `token` |

The refresh call sends the **login** token to Laravel, with no body:

```http
POST /api/ai/token
Authorization: Bearer <token from login>
Accept: application/json
```

| Refresh outcome | HTTP | Body | App action |
| --- | --- | --- | --- |
| New AI token | 200 | `ai_token`, `ai_token_expires_in: 900`, message "AI token issued." | Replace stored token, reset expiry |
| Login expired (logged out, password changed, token revoked) | 401 | message "Login Expired.", body `status: 201` (a Laravel quirk) | Log out |
| Account deactivated | 401 | message "Your account is inactive. Please contact the administrator." | Log out, show message |
| Laravel couldn't issue | 500 | message "Unable to issue AI token." | Show "AI service unavailable, try again"; don't log out |

The app guides include a timeline that shows the 60-second early refresh and the 401-then-retry path together:

```text
10:00:00  login                           → ai_token A (expires 10:15:00)
10:05:00  face check, Bearer A            → 200
10:14:00  refresh: POST /api/ai/token     → ai_token B (expires 10:29:00)
10:20:00  ID check, Bearer B              → 200
10:30:00  ID check, Bearer B              → 401 (expired)
          refresh: POST /api/ai/token     → ai_token C
          retry ID check, Bearer C        → 200
10:40:00  logout                          → delete token and ai_token
```

&#91;embedded content: Login, AI call, 401, refresh, retry · three parties\]

The same flow as a picture: your service appears only on the right, and the one red arrow, a 401, is what sends the app back to Laravel for a new token.

Two consequences for you:

- **Your 401 is a signal the apps act on.** It means "get a new token and try again". If you return 401 for a permission problem, the app refreshes, retries, gets 401 again and gives up, and the bug report says "token expired" when the real problem is scopes. Return 403 for permissions.
- **Several valid tokens per user can exist at once.** The React guide notes each browser tab may refresh on its own: "Getting a new token doesn't cancel older ones... Old tokens simply expire." Don't build anything that assumes one live token per user.

### Flow 5: the Laravel backend's service token

For grading, question generation, rubric, tagging, Bloom, chatbot, exam risk and OMR, there is no user at the keyboard; Laravel calls AI on its own behalf, sometimes from cron jobs (the grading endpoints list "Laravel grading crons" as the caller). Laravel mints a **service token** with `sub: "laravel"`, `role: "service"`, every scope, no `inst`, and a **5-minute** life, and sends it as `Authorization: Bearer <token>`.

You verify it exactly like a user token: same JWKS, same issuer, same audience, same algorithm. Only the claims differ. That uniformity is a feature: one auth layer for every endpoint.

The critical operational fact, which the guide marks **Important**: "once Laravel is deployed to an environment, its backend sends **only** the Bearer token." There's no fallback on the Laravel side. If the AI side of that environment can't accept tokens yet, grading, question generation, rubric, tagging, chatbot and OMR all get rejected. The "Rollout" section turns this into a deploy rule.

### Why this design is better, in one table

| Question | Before (`X-Password`) | After (JWT) |
| --- | --- | --- |
| Who is calling? | Unknown | `sub`, `role`, `inst` in every request |
| What may they do? | Everything | Only their `scope` |
| If a credential leaks? | Works forever, for everything | Works for at most 15 minutes, for one user's scopes |
| What do AI hosts store? | A shared secret | Nothing secret: public keys only |
| Rotation | Breaks every client | Invisible to clients (JWKS + `kid`) |

## Verification step by step, with working Python

Every protected request goes through the same eight checks in one shared auth layer, and any failure in steps 1 to 6 is a 401 while a missing scope in step 7 is a 403. Steps 2 to 6 collapse into a single `jwt.decode(...)` call once you've picked the right key. The code below implements all of it, and its test suite (in the Testing section) passes all 16 sign-off cases against PyJWT 2.15.

### The eight steps, explained

The AI guide's section 4 lists the steps. Here is each one with the reason it exists.

| # | Step | Fails with | Why it exists |
| --- | --- | --- | --- |
| 1 | Read `Authorization`; it must be `Bearer <token>` | 401 | No credential, no entry |
| 2 | Read the token header **without trusting it**; `alg` must be exactly `RS256` | 401 | Blocks `alg: none` and the HS256 confusion attack |
| 3 | Read `iss` from the payload **without trusting it**; it must be in the trusted-issuer list; take that issuer's cached JWKS | 401 | Picks dev3's keys for a dev3 token; never fetches from a URL the token supplies |
| 4 | Find the key whose `kid` matches; if none, refetch once (rate-limited); still none, fail | 401 | Survives key rotation without letting junk `kid`s flood Laravel |
| 5 | Verify the RS256 signature with that public key | 401 | Proves Laravel made it and nobody edited it |
| 6 | Check claims with 30 s leeway: `exp` in the future, `nbf` not in the future, `iss` exact, `aud` = `ai-api`, `sub`/`role`/`scope` present | 401 | A genuine token can still be expired, early, or meant for another service |
| 7 | Split `scope` on spaces; the endpoint's one scope must be in it | **403** | Authentication passed; this is authorization |
| 8 | Pass `sub`, `role`, `inst`, `jti` to the endpoint | — | Logging and per-user or per-university limits |

Two guide sentences shape the whole design:

- "Put this in **one shared auth layer** (middleware or a dependency) that every protected endpoint uses. Don't repeat it per endpoint." Copy-pasted auth drifts: one endpoint forgets the audience check and becomes the weak spot.
- "Use the library... Don't hand-roll the cryptography." You write the plumbing (header parsing, issuer table, cache, scope check). PyJWT and the `cryptography` package do the RSA maths.

### What leeway means

**Leeway** (or clock skew tolerance) is a grace period applied to time checks. Your server's clock and Laravel's clock are never exactly equal. Without leeway, a token Laravel issued at 10:00:00 could look "not yet valid" to an AI host whose clock reads 09:59:58. With `leeway=30`, PyJWT treats `exp` as `exp + 30` and `nbf` as `nbf - 30`. Thirty seconds covers ordinary drift; it does not cover a server whose clock is minutes off, which is why the guide also says to run NTP.

### How PyJWT maps to the steps

```python
claims = jwt.decode(
    token,
    key,                         # step 5: the PyJWK chosen by iss + kid in steps 3-4
    algorithms=["RS256"],        # step 2: we choose the algorithm; anything else -> error
    audience="ai-api",           # step 6: aud must contain "ai-api"
    issuer=iss,                  # step 6: iss must equal the trusted issuer exactly
    leeway=30,                   # step 6: clock drift allowance for exp / nbf / iat
    options={"require": ["exp", "nbf", "iat", "iss", "aud", "sub"]},   # step 6: presence
)
```

Each argument closes a door:

- **`algorithms=["RS256"]`**: a list *you* supply. PyJWT compares the token's `alg` against it before doing anything else. Note the plural: the argument is `algorithms`, a list. Writing `algorithm=` (singular) is an encode-side argument and a classic typo.
- **`audience="ai-api"`**: without it, PyJWT 2.x raises `InvalidAudienceError` for any token that *has* an `aud` claim, which is a sensible default; with it, the token's `aud` must match. This rejects Passport login tokens sent by mistake, and any future Laravel token meant for something else.
- **`issuer=iss`**: we already used the unverified `iss` to choose keys; passing it here makes PyJWT re-check it after the signature is proven. Belt and braces.
- **`options={"require": [...]}`**: by default PyJWT validates `exp` and `nbf` only *if present*. A token with no `exp` would never expire. `require` makes absence an error.
- **`role` and `scope`** are our private claims, so PyJWT doesn't know about them. The code checks they exist and are strings after decoding.

PyJWT raises a specific exception for each failure. The decode errors inherit from `jwt.InvalidTokenError`, which inherits from `jwt.PyJWTError`, so you can catch narrowly for good log messages and broadly as a safety net.

| Exception | Meaning |
| --- | --- |
| `DecodeError` | Not three base64url parts, or bad JSON |
| `InvalidAlgorithmError` | `alg` not in your list |
| `InvalidSignatureError` | Signature doesn't match |
| `ExpiredSignatureError` | `exp` passed (after leeway) |
| `ImmatureSignatureError` | `nbf` (or `iat`) in the future |
| `InvalidAudienceError` | `aud` wrong or missing |
| `InvalidIssuerError` | `iss` wrong |
| `MissingRequiredClaimError` | A claim in `require` is absent; `.claim` names it |

### Why a hand-rolled JWKS cache instead of `PyJWKClient`

PyJWT ships `jwt.PyJWKClient(url, cache_jwk_set=True, lifespan=3600, timeout=5)`, which fetches a JWKS, caches it and picks the key by `kid` with `get_signing_key_from_jwt(token)`. It's fine for a single issuer with relaxed requirements. Our guide asks for three things it doesn't do out of the box:

1. **Keep serving stale keys if Laravel is down.** When `PyJWKClient`'s cache lifespan ends and the refetch fails, it raises an error rather than falling back to the old keys. The guide requires the fallback (test case 15).
2. **Rate-limit unknown-`kid` refetches** to one per issuer per minute (test case 10). `PyJWKClient` refetches on every miss.
3. **Multiple issuers**, chosen by `iss`. You'd need one client per issuer anyway.

The cache class below is about 50 lines. It still uses PyJWT's `PyJWKSet.from_dict` to parse keys, so we don't hand-roll any key handling or cryptography.

### The request path at a glance

```text
request
  │
  ├─ Authorization header?── no ──► ALLOW_LEGACY_PASSWORD and X-Password correct? ── yes ──► allow (method=legacy)
  │        │                                                              └── no ───► 401
  │       yes
  │        ▼
  ├─ "Bearer <token>"? ── no ──► 401
  ├─ header alg == RS256 and kid present? ── no ──► 401
  ├─ unverified iss in TRUSTED_ISSUERS? ── no ──► 401
  ├─ key for kid in cache (or after one rate-limited refetch)? ── no ──► 401
  ├─ jwt.decode(...) ok? (signature, exp, nbf, iss, aud, required claims) ── no ──► 401
  ├─ role and scope present? ── no ──► 401
  ├─ endpoint scope in token scopes? ── no ──► 403
  └─► allow (method=token), pass sub / role / inst / jti to the endpoint
```

### The auth module: `ai_auth.py` (framework-agnostic)

This module knows nothing about FastAPI, Flask or Django. It takes a headers mapping and a required scope, and returns an `Identity` or raises `AuthError(401 or 403)`. Each AI host's framework wraps it in a few lines. Install with `pip install "pyjwt[crypto]"`: the `[crypto]` extra pulls in the `cryptography` package, which RS256 needs.

```python
"""Shared auth layer for the AI services: verifies Examini RS256 JWTs."""
from __future__ import annotations

import hmac
import json
import logging
import os
import threading
import time
import urllib.request
from dataclasses import dataclass
from typing import Callable, Optional

import jwt  # PyJWT 2.x, installed as "pyjwt[crypto]"
from jwt import PyJWKSet

log = logging.getLogger("ai_auth")

# ---------------------------------------------------------------- configuration
# All values come from the environment, never from code (AI guide, section 2).
# AI_TRUSTED_ISSUERS is JSON: {"https://<laravel-host>": "https://<laravel-host>/.well-known/jwks.json", ...}
TRUSTED_ISSUERS: dict[str, str] = json.loads(os.environ.get("AI_TRUSTED_ISSUERS", "{}"))
AUDIENCE = "ai-api"
ALGORITHMS = ["RS256"]                 # the ONLY algorithm we accept
LEEWAY_SECONDS = 30                    # clock drift allowance
JWKS_TTL_SECONDS = 3600                # Laravel sends Cache-Control: max-age=3600
JWKS_FETCH_TIMEOUT_SECONDS = 5
MIN_SECONDS_BETWEEN_REFETCH = 60       # at most one forced refetch per issuer per minute
REQUIRED_CLAIMS = ["exp", "nbf", "iat", "iss", "aud", "sub"]


class AuthError(Exception):
    """Raised for any auth failure. `status` is 401 or 403; `reason` is for logs only."""

    def __init__(self, status: int, reason: str):
        super().__init__(reason)
        self.status = status
        self.reason = reason


@dataclass(frozen=True)
class Identity:
    """What the endpoint gets after a successful check (AI guide, step 8)."""
    method: str               # "token" or "legacy"
    sub: Optional[str] = None
    role: Optional[str] = None
    inst: Optional[int] = None
    jti: Optional[str] = None
    scopes: frozenset = frozenset()


# ---------------------------------------------------------------- JWKS cache
def _http_get_json(url: str, timeout: float) -> dict:
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)


class IssuerKeys:
    """Cached public keys for ONE trusted issuer.

    - Serves keys from memory: no network call on the request path.
    - Refreshes after JWKS_TTL_SECONDS.
    - On an unknown kid, refetches at most once per MIN_SECONDS_BETWEEN_REFETCH.
    - If a fetch fails, keeps whatever keys it already had.
    """

    def __init__(self, jwks_url: str, fetch: Callable[[str, float], dict] = _http_get_json,
                 clock: Callable[[], float] = time.monotonic):
        self.jwks_url = jwks_url
        self._fetch = fetch
        self._clock = clock
        self._keys: dict[str, object] = {}           # kid -> PyJWK
        self._fetched_at: Optional[float] = None     # last SUCCESSFUL fetch
        self._last_attempt: Optional[float] = None   # any fetch, success or not
        self._last_forced: Optional[float] = None    # last unknown-kid refetch
        self._lock = threading.Lock()

    def _refresh(self) -> None:
        """Fetch the JWKS. Caller holds the lock. Never raises; never wipes the cache."""
        self._last_attempt = self._clock()
        try:
            data = self._fetch(self.jwks_url, JWKS_FETCH_TIMEOUT_SECONDS)
            jwk_set = PyJWKSet.from_dict(data)
            keys = {k.key_id: k for k in jwk_set.keys
                    if k.key_id and k.public_key_use in ("sig", None)}
            if not keys:
                raise ValueError("JWKS has no usable signing keys")
            self._keys = keys
            self._fetched_at = self._clock()
        except Exception as exc:  # network error, timeout, bad JSON...
            log.warning("JWKS fetch failed for %s: %s (keeping %d cached keys)",
                        self.jwks_url, exc, len(self._keys))

    def _waited(self, since: Optional[float]) -> bool:
        return since is None or self._clock() - since >= MIN_SECONDS_BETWEEN_REFETCH

    def get(self, kid: str):
        with self._lock:
            stale = (self._fetched_at is None
                     or self._clock() - self._fetched_at >= JWKS_TTL_SECONDS)
            if stale and self._waited(self._last_attempt):
                self._refresh()                       # first use, or hourly refresh
            key = self._keys.get(kid)
            if key is None and self._waited(self._last_forced):
                self._last_forced = self._clock()
                self._refresh()                       # maybe a key was just rotated in
                key = self._keys.get(kid)
            return key


_issuer_keys = {iss: IssuerKeys(url) for iss, url in TRUSTED_ISSUERS.items()}


def configure(issuers: dict[str, IssuerKeys]) -> None:
    """Replace the issuer table (used by tests and app startup)."""
    global _issuer_keys
    _issuer_keys = dict(issuers)


# ---------------------------------------------------------------- verification
def verify_token(token: str) -> Identity:
    """Steps 2-6 of the AI guide. Returns the identity or raises AuthError(401)."""
    # Step 2: read the header WITHOUT trusting it; refuse any alg but RS256.
    try:
        header = jwt.get_unverified_header(token)
    except jwt.DecodeError:
        raise AuthError(401, "malformed token")
    if header.get("alg") not in ALGORITHMS:
        raise AuthError(401, f"alg not allowed: {header.get('alg')!r}")
    kid = header.get("kid")
    if not isinstance(kid, str) or not kid:
        raise AuthError(401, "missing kid")

    # Step 3: read iss WITHOUT trusting it, only to choose the key set.
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
    except jwt.DecodeError:
        raise AuthError(401, "malformed payload")
    iss = unverified.get("iss")
    issuer_keys = _issuer_keys.get(iss) if isinstance(iss, str) else None
    if issuer_keys is None:
        raise AuthError(401, f"untrusted issuer: {iss!r}")

    # Step 4: find the key by kid (one rate-limited refetch on a miss).
    key = issuer_keys.get(kid)
    if key is None:
        raise AuthError(401, f"unknown kid {kid!r} for {iss}")

    # Steps 5 and 6: signature + claims, in one library call.
    try:
        claims = jwt.decode(
            token,
            key,                          # a PyJWK: typed RSA public key, never raw bytes
            algorithms=ALGORITHMS,        # WE choose the algorithm, not the token
            audience=AUDIENCE,
            issuer=iss,                   # exact match against the trusted issuer
            leeway=LEEWAY_SECONDS,
            options={"require": REQUIRED_CLAIMS},
        )
    except jwt.ExpiredSignatureError:
        raise AuthError(401, "expired")
    except jwt.ImmatureSignatureError:
        raise AuthError(401, "not yet valid (nbf/iat in the future)")
    except jwt.InvalidAudienceError:
        raise AuthError(401, "wrong audience")
    except jwt.InvalidIssuerError:
        raise AuthError(401, "wrong issuer")
    except jwt.InvalidSignatureError:
        raise AuthError(401, "bad signature")
    except jwt.MissingRequiredClaimError as exc:
        raise AuthError(401, f"missing claim: {exc.claim}")
    except jwt.PyJWTError as exc:
        raise AuthError(401, f"invalid token: {type(exc).__name__}")

    # Step 6 (cont.): our private claims must be present and well-typed.
    role, scope = claims.get("role"), claims.get("scope")
    if not isinstance(role, str) or not role or not isinstance(scope, str):
        raise AuthError(401, "missing role or scope")

    inst = claims.get("inst")
    return Identity(
        method="token",
        sub=str(claims["sub"]),
        role=role,
        inst=inst if isinstance(inst, int) else None,
        jti=claims.get("jti"),
        scopes=frozenset(scope.split()),
    )


def authenticate(headers, required_scope: str) -> Identity:
    """The whole check for one request: steps 1-7 plus the legacy fallback.

    `headers` is any case-insensitive mapping (FastAPI/Starlette, Flask, Django all have one).
    """
    auth = headers.get("authorization")

    if auth is not None:
        # Step 1: "Bearer <token>". If a request has both headers, the token decides.
        scheme, _, token = auth.partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            raise AuthError(401, "malformed Authorization header")
        identity = verify_token(token.strip())
        # Step 7: scope check -> 403, not 401.
        if required_scope not in identity.scopes:
            raise AuthError(403, f"scope {required_scope!r} missing for role {identity.role!r}")
        return identity

    # Transition only: the old shared password, behind a per-environment switch.
    if _legacy_allowed() and _legacy_password_ok(headers.get("x-password")):
        return Identity(method="legacy")

    raise AuthError(401, "no credentials")


def _legacy_allowed() -> bool:
    return os.environ.get("ALLOW_LEGACY_PASSWORD", "false").lower() == "true"


def _legacy_password_ok(supplied: Optional[str]) -> bool:
    expected = os.environ.get("LEGACY_X_PASSWORD", "")
    # compare_digest: constant-time comparison, so timing doesn't leak the password
    return bool(supplied) and bool(expected) and hmac.compare_digest(supplied.encode(), expected.encode())
```

### Why each part is there

**Configuration at the top.** `AI_TRUSTED_ISSUERS` is a JSON map from issuer to JWKS URL, read from the environment. The dev AI deployment might list dev3 and staging; production lists only production. Every number from the guide (30 s leeway, 3600 s cache, 5 s timeout, 60 s refetch gap) is a named constant, so a reviewer can tick them off against the guide in seconds.

**`AuthError` carries two things:** the status (401 or 403) and a reason. The reason is for your logs only. The guide: "Keep \[the error body\] generic (for example 'Invalid token'), and log the exact reason on the server." Telling an attacker "bad signature" vs "unknown kid" helps them probe.

**`Identity` is step 8.** The endpoint receives `sub`, `role`, `inst`, `jti` and the scope set, plus `method` so the logs can say whether the request used a token or the legacy password.

**`IssuerKeys` is the JWKS cache,** one instance per trusted issuer:

- `_keys` maps `kid` to a `PyJWK` (a typed public-key object). Lookups are a dictionary read: no network.
- `_refresh()` **never raises and never clears** the keys on failure. If Laravel times out, it logs a warning and the old keys stay. This is the "Don't wipe the cache on failure" rule and test case 15.
- `stale` triggers the hourly refresh. The refresh attempt itself is throttled by `_last_attempt`, so if Laravel is down with a stale cache, you try at most once a minute instead of adding a 5-second timeout to every request.
- The unknown-`kid` branch is throttled separately by `_last_forced`: at most one forced refetch per issuer per minute, as the guide asks. Test case 10 sends 20 tokens with random `kid`s and asserts exactly one refetch.
- `fetch` and `clock` are injectable. Production uses `urllib` and `time.monotonic` (a clock that never jumps backwards when NTP adjusts the wall clock); tests pass fakes, so they run offline and can "advance time" by two hours instantly.
- `threading.Lock` stops two request threads from refreshing at once. The trade-off is that requests for that issuer wait during a refresh (bounded by the 5 s timeout, roughly once an hour). For an AI service that's acceptable; a refresh in a background thread would remove even that.

**`verify_token` is steps 2 to 6,** in the order the guide lists them:

- The `alg` check before anything else is technically redundant with `algorithms=ALGORITHMS` later. It's there so the failure reason in the log is explicit ("alg not allowed: 'none'"), and so a broken library upgrade can't silently weaken us.
- `kid` must be a non-empty string. Without it there's no way to choose a key, and "try every key" is a pattern the guide rules out.
- `iss` is checked with `isinstance(iss, str)` because an attacker can put a list or a number there; a dictionary lookup with an unhashable list would otherwise raise a 500 instead of a clean 401.
- `jwt.decode(...)` does signature, `exp`, `nbf`, `iat`, `iss`, `aud` and required-claim checks in one call.
- `sub` is converted with `str(...)` so downstream code always gets a string.
- `inst` is kept only if it's an integer; service tokens have none, so it's `None` for them.
- `scope.split()` with no argument splits on any run of whitespace, so double spaces don't create an empty scope.

**`authenticate` is steps 1 and 7 plus the fallback.**

- If an `Authorization` header is present, the token decides. A bad token fails even if a correct `X-Password` is also present. That's the guide's "If a request has both, judge it by the Bearer token", and it stops an attacker from bypassing token checks by adding the leaked password.
- `partition(" ")` splits `Bearer abc` into scheme and token. The scheme comparison is case-insensitive because RFC 6750 treats the scheme name that way; the token is kept exactly as sent.
- The scope check comes **after** successful verification, and is the only place that returns 403.
- The legacy path runs only when there's no `Authorization` header, `ALLOW_LEGACY_PASSWORD=true`, and the password matches. `hmac.compare_digest` compares in constant time, so response timing can't reveal how many leading characters were right.

### Wiring it into FastAPI

In FastAPI the natural shape is a **dependency**: a function FastAPI runs before the endpoint, whose return value the endpoint receives as a parameter.

```python
import logging

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from ai_auth import AuthError, Identity, authenticate

log = logging.getLogger("ai_auth.access")
app = FastAPI()

# CORS runs BEFORE routing, so a browser preflight (OPTIONS) is answered here
# and never reaches the auth dependency below.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://<web-app-origin>", "https://<desktop-app-origin>"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Password"],
)


def require_scope(scope: str):
    """FastAPI dependency factory: `Depends(require_scope("face:verify"))`."""
    def dependency(request: Request) -> Identity:
        endpoint = request.url.path
        try:
            identity = authenticate(request.headers, scope)
        except AuthError as err:
            log.info("auth result=%s endpoint=%s reason=%s", err.status, endpoint, err.reason)
            headers = {"WWW-Authenticate": "Bearer"} if err.status == 401 else None
            detail = "Invalid token" if err.status == 401 else "Forbidden"
            raise HTTPException(status_code=err.status, detail=detail, headers=headers)
        log.info("auth result=allowed method=%s endpoint=%s jti=%s sub=%s role=%s inst=%s",
                 identity.method, endpoint, identity.jti, identity.sub, identity.role, identity.inst)
        return identity
    return dependency


@app.get("/health")                      # health checks stay open
def health():
    return {"ok": True}


@app.post("/face/verify")                # placeholder path: use the real one
def face_verify(identity: Identity = Depends(require_scope("face:verify"))):
    return {"ok": True, "user": identity.sub}


@app.post("/api/legacy_grading/grade/qa")
def grade_qa(identity: Identity = Depends(require_scope("grading:run"))):
    return {"ok": True}
```

Points to notice:

- **The scope is declared at the endpoint**, in one visible place: `require_scope("grading:run")`. That's the guide's "Each endpoint declares the one scope it needs." A reviewer can grep for endpoints that lack a `require_scope`.
- **`dependency` is a plain `def`, not `async def`.** FastAPI runs plain-`def` dependencies in a thread pool, so the occasional blocking JWKS fetch doesn't freeze the event loop. If you prefer `async`, switch the fetcher to an async HTTP client and an `asyncio.Lock`.
- **`WWW-Authenticate: Bearer`** on 401 responses is what RFC 6750 (the Bearer token spec) asks for. The apps ignore it, but it's correct HTTP.
- **One access-log line per request** with `jti`, `sub`, `role`, `inst`, endpoint, result and reason: exactly the fields section 8 of the guide asks for. Never the token itself.
- **The face endpoint path is a placeholder.** The guide lists app-called endpoints only by function ("Face verification endpoints", "OCR endpoints"), and asks the AI team to send the exact paths back.

### Other frameworks

Because `authenticate(headers, scope)` is framework-agnostic, the adapter is small anywhere:

| Framework | Where it goes | Headers object |
| --- | --- | --- |
| FastAPI / Starlette | A dependency per endpoint (above), or a router-level `dependencies=[...]` | `request.headers` (case-insensitive) |
| Flask | A decorator `@require_scope("face:verify")` that calls `authenticate(request.headers, scope)` and `abort(err.status)` | `request.headers` (case-insensitive) |
| Django | A view decorator, or DRF authentication + permission classes | `request.headers` (case-insensitive, Django 2.2+) |

Whatever the framework, keep the same three rules: preflight `OPTIONS` must bypass auth, the scope is declared per endpoint, and the error body stays generic.

## Roles, scopes, and choosing 401 vs 403

Authorize on **scope**, not on role: each endpoint declares the one scope it needs, and the request passes if that scope is in the token's `scope` string. Laravel decides which scopes each role gets; your service never needs a role-to-permission table of its own.

### Roles and scopes: who you are vs what you may do

A **role** is a label for a kind of user: `student`, `registrant`, `faculty`, `admin`, `service`. A **scope** is one specific permission, written `resource:action`, like `face:verify` or `grading:run`. Roles are coarse and human; scopes are precise and machine-checkable.

Analogy: role is your job title ("nurse"), scopes are the door badges you've been issued ("ward 3", "pharmacy"). The door reader checks the badge, not the job title. If the hospital later decides nurses may enter the lab, it issues a new badge, and no door reader needs reprogramming.

That's why the React guide says "Laravel sets what each role may do; React doesn't need to check." Same for you: check the scope, log the role.

### Scopes per role (draft, please confirm)

From the AI guide, marked as a draft for the AI team to confirm:

| Role | Who | Scopes |
| --- | --- | --- |
| `student` | A logged-in student | `face:verify` `id:verify` `ocr:submit` `image:check` |
| `registrant` | A student on the signup screen, before first login | `face:verify` `id:verify` `ocr:submit` `image:check` |
| `faculty` | Teaching staff | `question:generate` `question:tag` `question:classify` `rubric:write` `grading:run` `chat:send` |
| `admin` | Administrators | Faculty scopes + `proctor:risk` |
| `service` | The Laravel backend | All scopes |

The full set of scope strings, then, is eleven: `face:verify`, `id:verify`, `ocr:submit`, `image:check`, `question:generate`, `question:tag`, `question:classify`, `rubric:write`, `grading:run`, `chat:send`, `proctor:risk`.

### Endpoint to scope (please confirm and complete)

From the AI guide's section 5. Each endpoint gets exactly one scope.

| Endpoint | Caller | Scope |
| --- | --- | --- |
| `api/legacy_grading/grade/qa`, `grade/qa_batch` | Laravel grading crons | `grading:run` |
| `api/legacy_grading/rubric/create`, `rubric/modify`, `rubric/ai_auto_points_suggest`, `rubric/validate_criteria` | Laravel | `rubric:write` |
| `api/question_generation/generate`, `api/enhanced_question_generation/analyze-file`, `generate-from-analyzed` | Laravel | `question:generate` |
| `api/legacy_grading/test_setup/all_type_question_rephrase` | Laravel | `question:generate` |
| `api/question-tagging/categorize-batch` | Laravel | `question:tag` |
| `api/blooms/classify_question` | Laravel | `question:classify` |
| `enhanced-chat/chat` | Laravel | `chat:send` |
| `calculate_exam_risks` | Laravel | `proctor:risk` |
| `api/omr/pdf-exam/score` | Laravel | `grading:run` |
| Face verification endpoints | Apps (exam and signup) | `face:verify` |
| ID card verification endpoints | Apps (exam and signup) | `id:verify` |
| OCR endpoints | Apps | `ocr:submit` |
| Image check (blur / quality) endpoints | Apps | `image:check` |

Two action items for the AI team come straight out of this table:

- **Send the exact paths** for the app-called endpoints (face, ID, OCR, image check) and any endpoint missing from the list. Only you know them.
- **Health checks stay open.** The guide allows it. Keep them free of sensitive data, since anyone can call them.

A useful exercise while implementing: list every route each AI host exposes (FastAPI's `app.routes` makes this easy) and check each one either has a `require_scope(...)` or is deliberately public. A route with neither is a hole.

A note on today's scopes in practice: the Laravel-called endpoints all receive the service token, which has every scope, so the scope check there mostly guards against a user token reaching a backend-only endpoint (test case 13: a student token on a grading endpoint must get 403). The app-called endpoints are where scope separation does real work today, keeping students and registrants to the four checks they need.

### 401 vs 403: the decision rule

Ask one question: **"Do I know, with cryptographic certainty, who this is?"**

- **No** (missing header, garbage, bad signature, expired, wrong issuer or audience, unknown key, missing claims) → **401**. "Come back with a valid token."
- **Yes, but their scopes don't include this endpoint's** → **403**. "I know who you are. The answer is no."

The apps act on the difference, which makes it a contract, not a style choice:

| Code | The guide's "When" | What the app does | What goes wrong if you pick the other one |
| --- | --- | --- | --- |
| 401 | Missing, malformed, bad signature, expired, wrong issuer or audience, unknown key | Gets a new token and retries once | A permission bug returned as 401 triggers a pointless refresh, then a second 401, then a confusing "session problem" for the user |
| 403 | Valid token, but the scope is missing | Doesn't retry; reports a bug | An expired token returned as 403 means the app never refreshes; the user is stuck until they log out and in |

Compare with the refresh endpoint: when **Laravel's** `POST /api/ai/token` returns 401, the app logs the user out. When **your** API returns 401, the app refreshes. Same code, different servers, different meaning. Both are correct because each 401 says "the credential you sent me is no good", and the fix depends on which credential.

### What about `inst` and per-university rules?

The guide says to pass `inst` to the endpoint and use it "for logging and per-university or per-user limits if useful". It doesn't ask you to enforce any per-university access rules, and the token carries no university-level permissions. If an AI endpoint receives a university id in its request body, comparing it to the token's `inst` would be a sensible extra check, but that would be a new rule to agree with Laravel first, not something the current contract requires. Service tokens have no `inst`, so any such check must skip them.

## Rollout: from `X-Password` to tokens without an outage

The AI side must accept **both** tokens and the old password, per environment, **before** Laravel deploys there; then you watch the logs, switch the password off per environment, and finally change it. Get the order wrong and grading, question generation, rubric, tagging, chatbot and OMR all start failing at once.

### Why a transition period at all

The callers don't all update at the same moment:

- **Laravel backend**: switches instantly when deployed, and then sends **only** Bearer tokens.
- **React web**: "no forced update is needed. A deploy moves every user to the new version." Still, a browser tab opened before the deploy keeps running old code until reloaded.
- **Mobile apps**: old versions on students' phones "keep sending `X-Password` until the AI team turns it off. A forced update will be needed before that date."
- **Desktop app**: also an AI caller (face, ID, OCR, image). The guides don't describe its rollout; ask the desktop team how fast its users update.

So for a while, your service sees both kinds of request.

### The four steps from the guide

1. **Accept both.** A request is allowed with a valid Bearer token, **or** the old `X-Password` while the fallback is on. If a request has both, judge it by the Bearer token. Put the fallback behind a per-environment switch: `ALLOW_LEGACY_PASSWORD=true`.
2. **Log which method each request used** (token or legacy password) and the endpoint. This tells you when old app versions have stopped calling.
3. **Turn the fallback off per environment** once the logs show no more password traffic, or on an agreed date after the forced mobile update.
4. **Change the old password** after the fallback is off everywhere. "It's in git history and old app builds, so treat it as public."

The middleware in the previous section implements step 1 (`authenticate` and `_legacy_allowed`) and step 2 (the `method=` field in the access log).

### Deploy ordering: AI first, then Laravel

The guide's most important operational line: "once Laravel is deployed to an environment, its backend sends **only** the Bearer token. Step 1 must be live on the AI side for that environment **before** Laravel deploys there."

| Order | Environment state | Result |
| --- | --- | --- |
| AI (accept both) → Laravel | AI accepts tokens and the password; Laravel starts sending tokens | Smooth: backend calls succeed with tokens; old apps succeed with the password |
| Laravel → AI | Laravel sends only tokens; AI still only knows the password | Every backend call fails: grading, question generation, rubric, tagging, chatbot, OMR |

Per environment, then:

1. Deploy the AI auth layer to **every** AI host in that environment (main, V2, chatbot, legacy exam risk) with `ALLOW_LEGACY_PASSWORD=true` and that environment's trusted issuers configured.
2. Smoke test: a token from that Laravel environment gets 200; the password still gets 200; garbage gets 401. Check the JWKS fetch succeeded in the logs.
3. Tell the Laravel team the environment is ready; they deploy.
4. Watch the method split in the logs.

Remember the multi-issuer case: if the dev AI deployment serves both dev3 and staging, both issuers must be in its list before either Laravel environment deploys.

### Watching the logs to know when to switch off

With one log line per request carrying `method=token` or `method=legacy` and the endpoint, the decision becomes a query: "legacy requests per day, per endpoint, for the last N days". When it's zero (or only stragglers after the forced mobile update date), flip `ALLOW_LEGACY_PASSWORD=false` for that environment. Because it's a config switch, turning it back on is instant if something unexpected breaks.

### Legacy `password=password` query parameters

Some old endpoints, such as `calculate_exam_risks`, take the password as a URL query parameter. The guide says to retire these in favour of the token. Query-string secrets are worse than headers: URLs end up in proxy logs, browser history and monitoring tools. Treat them as part of the same legacy fallback and remove them when the fallback goes.

### CORS and the preflight request

**CORS** (Cross-Origin Resource Sharing) is the browser's rule for when a web page from one origin (say the React app's domain) may call an API on another origin (an AI host). An **origin** is scheme + host + port.

For "simple" requests the browser just sends them. But a request with an `Authorization` header is not simple, so the browser first sends a **preflight**: an `OPTIONS` request asking "may I send a POST with an `Authorization` header from this origin?" Only if the server answers yes does the real request go out.

```http
OPTIONS /<face-verify-path> HTTP/1.1
Origin: https://<web-app-origin>
Access-Control-Request-Method: POST
Access-Control-Request-Headers: authorization, content-type
```

The answer must include `Access-Control-Allow-Origin` with that origin and `Access-Control-Allow-Headers` containing `Authorization`.

Two things to get right, both from the guide:

- **Add `Authorization` to the allowed request headers** for the web and desktop app origins. `X-Password` was presumably already allowed; keep it until the fallback ends.
- **Don't let the auth layer block preflights.** A preflight carries no token, by design. If your auth runs on `OPTIONS`, every preflight gets 401, the browser blocks the real request, and the React developers see a CORS error with no obvious cause. In FastAPI, `CORSMiddleware` answers preflights before routing, so a route-level dependency never sees them. If you write a global middleware instead, explicitly skip `OPTIONS`.

Test case 16 checks this: "Browser preflight `OPTIONS` with `Authorization` requested: allowed by CORS." Mobile apps don't do CORS (it's a browser rule), which is why the React guide mentions it and the mobile guide doesn't.

### HTTPS only

Bearer tokens must never travel over plain HTTP. Anyone on the network path (shared Wi-Fi, a compromised router) could copy the token and use it for up to 15 minutes. HTTPS is also what makes the JWKS fetch trustworthy: if an attacker could tamper with the JWKS response, they could insert their own public key. Fetch JWKS only from `https://` URLs and keep normal certificate verification on.

### Clocks: NTP

Every time check (`exp`, `nbf`, `iat`) compares Laravel's clock, frozen into the token, with your server's clock now. **NTP** (Network Time Protocol) keeps server clocks synced to within milliseconds. The 30-second leeway covers small drift only. A container host whose clock is 2 minutes fast would reject every fresh token as "not yet valid" and accept expired ones for 2 extra minutes. Check that NTP (or the cloud provider's time sync) is on for every AI host.

### IP allowlisting: an open decision

The guides don't mention IP allowlisting, so what to do with it is the AI team's call. Here's how to think about it.

**What it protects.** An IP allowlist on an AI host blocks requests from addresses outside the list. For backend-only endpoints (grading, question generation, rubric, tagging, Bloom, chatbot, exam risk, OMR), callers are Laravel servers with a few known addresses, so an allowlist is a meaningful second lock. For app-called endpoints (face, ID, OCR, image check), callers are students' phones and browsers anywhere, so an allowlist can't apply.

**What changes with tokens.** Before, the allowlist was half of a weak scheme. After, the token is a strong credential on its own: short-lived, per caller, scoped, unforgeable without Laravel's key. The allowlist becomes **defence in depth**: an extra layer that limits damage if another layer fails.

**Recommendation:**

| Phase | IP allowlist on backend-only endpoints | Reason |
| --- | --- | --- |
| While `ALLOW_LEGACY_PASSWORD=true` | **Keep it** | The leaked password still works during this period; the allowlist is what stops an outsider using it on backend endpoints |
| After the fallback is off and the password changed | **Decide then** | Keeping it costs maintenance (every new Laravel server IP must be added) and causes outages when IPs change; removing it relies fully on tokens |

If you keep it afterwards, keep it in the network layer (firewall, security group, load balancer), not in Python, and document the IP list next to the trusted-issuer list so both are updated together.

One related item is in the opposite direction: Laravel asks for the AI servers' **outgoing** IPs so that staging's `/.well-known/jwks.json` stays reachable if staging becomes employee-only. That's Laravel allowlisting you.

## Security pitfalls, logging, revocation and 401 troubleshooting

Most real-world JWT breaches come from a handful of mistakes in the verifier, not from broken cryptography: trusting the unverified payload, letting the token pick the algorithm, skipping a claim check, or leaking tokens into logs. Avoid the list below and you've avoided almost all of them.

### The pitfalls, ranked by how often they bite

| # | Pitfall | What goes wrong | How our code avoids it |
| --- | --- | --- | --- |
| 1 | Decoding without verifying, then using the claims | Anyone can type `role: admin` into a token | Unverified decode is used only to read `iss` for key selection |
| 2 | Letting `alg` choose the algorithm | `none` and HS256-confusion forgeries | `algorithms=["RS256"]`, hard-coded |
| 3 | Not checking `aud` | A token minted for another service is accepted here | `audience="ai-api"` |
| 4 | Not checking `iss`, or fetching keys from a token-supplied URL | Attacker points you at their own keys | Fixed trusted-issuer list from config; `issuer=iss` |
| 5 | Not requiring `exp` | A token without `exp` never expires | `options={"require": [...]}` |
| 6 | Taking the first JWKS key | Outage on rotation day | Lookup by `kid` |
| 7 | Refetching JWKS on every miss | Laravel flooded by junk `kid`s | One forced refetch per issuer per minute |
| 8 | Wiping the key cache on fetch failure | A Laravel blip takes down all AI | `_refresh()` keeps old keys |
| 9 | Auth copy-pasted into each endpoint | One endpoint forgets a check | One shared `authenticate()` |
| 10 | Logging tokens | Logs become a credential store | Log `jti`, never the token or header |
| 11 | Detailed error bodies | Attacker learns which check failed | Generic body; reason only in server logs |
| 12 | Comparing the legacy password with `==` | Timing side channel | `hmac.compare_digest` |

### Logging: what to write and what never to write

The guide's section 8 is specific. **Log:** `jti`, `sub`, `role`, `inst`, the endpoint, the result (allowed, 401 or 403) and the failure reason. **Never log:** the full token or the `Authorization` header. "A token is a working credential for up to 15 minutes."

Why `jti` is so useful: it's a unique id per token, safe to log and impossible to replay. If a user reports "my face check failed at 10:31", the app team can give you the `jti`... except they can't, because the app doesn't decode the token. In practice you'll correlate by `sub` and time, and `jti` ties together multiple requests made with the same token.

Watch for accidental token logging in places you don't control:

- **Framework or proxy access logs** that record request headers. Check nginx, load balancer and APM (application performance monitoring) settings for header capture.
- **Exception trackers** such as Sentry that attach request headers to error reports. Configure them to scrub `Authorization` and `X-Password`.
- **Debug prints** of `request.headers` during development, which then ship.
- **Error messages** that embed the token, e.g. `f"bad token {token}"`. Our `AuthError` reasons never include it.

A quick grep in log storage for `eyJ` will tell you if a token ever slipped through.

### Revocation: what happens when someone logs out or is deactivated

**Revocation** means making a credential invalid before its natural expiry. Self-contained tokens make this hard by design: the whole point is that verifiers don't call home. Our agreement, from the guide: "No revoke check for now. A token stays valid until `exp`. Laravel stops issuing new tokens after logout or deactivation."

Concretely: a student logs out at 10:05 holding an AI token that expires at 10:15. That token, if someone had copied it, would still work on the AI API until 10:15. After that, there's no way to get another one, because `POST /api/ai/token` returns 401 for a logged-out or deactivated user.

The options, and why the team picked the first:

| Approach | How it works | Cost | Worst-case exposure |
| --- | --- | --- | --- |
| **Short lifetime, no revoke check** (ours) | Just wait for `exp` | Nothing | 15 min (user), 5 min (service) |
| Denylist of revoked `jti`s | Laravel publishes revoked ids; AI checks each request | A shared store or feed; a lookup per request | Seconds |
| Version counter (`ver`) | Laravel bumps a per-user version on logout; AI compares token `ver` with current | Same: AI needs the current version per user | Seconds |
| Introspection | AI asks Laravel "is this token still good?" on every request | A network call per request; Laravel becomes a single point of failure | Zero |

The `ver` claim is already in user tokens, reserved for the third approach "in case we add an instant revoke later; that would be a separate agreement." Until then: **ignore `ver`.** Don't build a half-version of revocation on your own; it would reject valid tokens without the matching Laravel side.

The React guide gives one more consequence: "Getting a new token doesn't cancel older ones." Several valid tokens per user can coexist, and that's expected.

### Other things worth knowing

- **Never put tokens in URLs.** The React guide says so for apps ("Never put it in a URL or query string"); the same goes for any links or redirects your service builds.
- **Treat the signup token like any other.** A registrant token is a real credential with real scopes, just a narrower set.
- **Don't cache verification results by token string.** Verification is already under a millisecond; a result cache keyed by token adds a place where tokens are stored and can outlive their `exp`.
- **Pin your dependency major version** (`pyjwt>=2,<3`) and read the changelog on upgrades. Defaults around audience and algorithms have changed between major versions before.
- **The old password is public.** Plan step 4 of the rollout (change it) as a real task with an owner, not an afterthought.

### 401 troubleshooting checklist

When a caller says "I'm getting 401", your server log's `reason` field tells you which branch failed. Here's what each means and what to check.

| Logged reason | Likely cause | What to check |
| --- | --- | --- |
| `no credentials` | No `Authorization` header and fallback off or no `X-Password` | Is the client sending the header? Is a proxy stripping `Authorization`? (Some proxies and CDNs drop it by default.) |
| `malformed Authorization header` | Not `Bearer <token>`: missing space, quotes around the token, `Bearer: ...` | The guides say "the word `Bearer`, then one space, then the `ai_token`" |
| `malformed token` / `malformed payload` | Not a JWT: truncated, URL-encoded, or a non-JWT string | Was the token cut off in storage? Is it the Passport token (also a JWT, but see below)? |
| `alg not allowed` | Header `alg` isn't `RS256` | Attack attempt, or a test token minted wrongly |
| `missing kid` | Header has no `kid` | Probably the Passport login token sent to AI by mistake: its header has no `kid` |
| `untrusted issuer` | `iss` not in this deployment's list | Token from another environment (staging token on production AI)? Trailing slash? Is the issuer configured on **this** host? |
| `unknown kid` | No key with that `kid` in the issuer's JWKS, even after a refetch | Rotation in progress and refetch rate-limited (retry after a minute)? JWKS unreachable from this host (check the fetch warning logs and egress IPs)? |
| `bad signature` | Signature doesn't verify with the matching key | Token edited, or signed by a different key under the same `kid` (a Laravel misconfiguration) |
| `expired` | `exp + 30 s` is in the past | Normal: the app should refresh. If constant and immediate, check this host's clock (NTP) |
| `not yet valid` | `nbf - 30 s` is in the future | This host's clock is behind, or Laravel's is ahead. Check NTP on both |
| `wrong audience` | `aud` isn't `ai-api` | Passport login token sent instead of `ai_token` |
| `wrong issuer` | Unverified and verified `iss` disagree | Shouldn't happen with our code; investigate |
| `missing claim: ...` / `missing role or scope` | Required claim absent | Laravel-side change? Compare with the claim table |

And for 403: the log line names the missing scope and the role. If the role is right and the scope missing, check the scopes-per-role draft with Laravel. If the role is wrong (a student on a grading endpoint), the caller is using the wrong token or calling an endpoint it shouldn't.

### A handy debug snippet

For a token someone pastes into a ticket (tokens in tickets are a leak too, but once they've expired they're harmless):

```python
import jwt, datetime

def explain(token: str) -> None:
    """Print a token's header and claims WITHOUT verifying. Debugging only."""
    h = jwt.get_unverified_header(token)
    c = jwt.decode(token, options={"verify_signature": False})
    print("header:", h)
    for k in ("iat", "nbf", "exp"):
        if k in c:
            print(k, datetime.datetime.fromtimestamp(c[k], datetime.timezone.utc).isoformat())
    print({k: v for k, v in c.items() if k not in ("iat", "nbf", "exp")})
```

Never use this in a request path; it's a reading aid for humans.

## Testing: the 16 sign-off cases, as pytest

You can test every sign-off case offline by becoming a fake Laravel: generate a throwaway RSA key pair in the test, serve its public half from a fake JWKS, and mint whatever tokens you need with the private half. The suite below does exactly that and passes all 16 cases (plus two extras) against the middleware above, with PyJWT 2.15 and FastAPI.

### Minting test tokens with a throwaway key

The idea: in tests, *you* are the issuer. Nothing touches Laravel or its real private key, which should never leave Laravel anyway.

```python
from cryptography.hazmat.primitives.asymmetric import rsa
import jwt, json, time, uuid
from jwt.algorithms import RSAAlgorithm

key = rsa.generate_private_key(public_exponent=65537, key_size=2048)   # throwaway pair

jwk = json.loads(RSAAlgorithm.to_jwk(key.public_key()))               # public half as a JWK
jwk.update({"kid": "2026-11", "use": "sig", "alg": "RS256"})
fake_jwks = {"keys": [jwk]}                                            # what your fake Laravel serves

now = int(time.time())
token = jwt.encode(
    {"iss": "https://laravel.test", "aud": "ai-api", "sub": "141", "role": "student",
     "scope": "face:verify id:verify ocr:submit image:check", "inst": 12,
     "iat": now, "nbf": now, "exp": now + 900, "jti": str(uuid.uuid4())},
    key, algorithm="RS256", headers={"kid": "2026-11"},
)
```

The issuer `https://laravel.test` is fake on purpose. `.test` is a reserved top-level domain that never resolves on the internet, so a misconfigured test can't accidentally call anything real.

The same technique is handy outside pytest: to exercise a deployed dev AI host by hand, you'd need a token from the real dev Laravel (since the AI host only trusts real issuers). For local development, run the AI service with `AI_TRUSTED_ISSUERS` pointing at a local fake JWKS and mint tokens with a throwaway key.

### What each sign-off case proves

| # | Case (from the guide) | Expected | What it proves | How the test builds it |
| --- | --- | --- | --- | --- |
| 1 | Valid student token on a face endpoint | 200 | The happy path works end to end | Default `mint()` |
| 2 | Valid service token on a grading endpoint | 200 | Service tokens (no `inst`, no `ver`, 5 min) are accepted | `sub="laravel"`, `role="service"`, all scopes |
| 3 | No `Authorization` header (fallback off) | 401 | No credential, no entry | No headers |
| 4 | `X-Password` only, fallback on | 200, logged as legacy | The transition path works and is visible in logs | `ALLOW_LEGACY_PASSWORD=true`; assert `method=legacy` in the log |
| 5 | `X-Password` only, fallback off | 401 | The switch actually switches | Same password, fallback off |
| 6 | Expired token | 401 | `exp` is enforced, including leeway | `exp` 60 s in the past (beyond the 30 s leeway) |
| 7 | Payload edited (e.g. `role` changed to `admin`) | 401 | The signature covers the payload | Decode, edit, re-encode payload, keep old signature |
| 8 | Token signed with a different key | 401 | Only the issuer's key is accepted | Mint with a fresh key under the same `kid` |
| 9 | Header `alg` set to `none` or `HS256` | 401 | Both algorithm attacks are closed | `alg=none` token; HS256 token HMAC'd with the public key PEM |
| 10 | Unknown `kid` | 401, and only one JWKS refetch | Rotation support can't be abused for flooding | 20 requests with a random `kid`; assert fetch count went from 1 to 2 |
| 11 | Wrong `iss` (another environment, or not on the list) | 401 | Issuer allowlist and exact matching | Another issuer; also the right issuer with a trailing slash |
| 12 | Wrong `aud` | 401 | Tokens for other services are refused | `aud="1"` (like a Passport token) |
| 13 | Student token on a grading endpoint | 403 | Scope check, and the 401/403 split | Default student token on the grading route |
| 14 | Registrant token on a face endpoint | 200 | Signup flow works | `role="registrant"` |
| 15 | Laravel unreachable after keys are cached | Still 200 for valid tokens | Cache isn't wiped on failure | Warm cache; make fake JWKS fail; advance fake clock 2 hours |
| 16 | Browser preflight `OPTIONS` with `Authorization` requested | Allowed by CORS | Preflight bypasses auth; `Authorization` is allowed | `OPTIONS` with `Origin` and `Access-Control-Request-Headers` |

Two extra tests cover behaviour the guide describes but doesn't list as a case: a newly rotated-in `kid` is picked up via the refetch, and a request with both a bad token and a correct password is judged by the token (401).

### Three testing techniques worth stealing

- **Dependency injection for I/O.** `IssuerKeys` takes `fetch` and `clock` arguments. The fake fetch counts calls (case 10) and can simulate an outage (case 15). The fake clock jumps two hours without sleeping.
- **One `mint()` helper with overrides.** Every negative case is "the valid token, with one thing wrong". Passing `None` drops a claim, which is how the service token loses `inst` and `ver`.
- **Test through HTTP.** FastAPI's `TestClient` exercises routing, CORS middleware, the dependency and the status codes together, which is what the apps actually experience.

### The full test file: `test_auth.py`

Run with `pip install "pyjwt[crypto]" fastapi httpx pytest`, then `pytest -q`. It expects `ai_auth.py` and `app.py` from the previous section next to it.

```python
import hashlib
import hmac
import json
import time
import uuid

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from jwt.algorithms import RSAAlgorithm

import ai_auth
from app import app

ISS = "https://laravel.test"            # fake issuer, tests only
OTHER_ISS = "https://other-laravel.test"
JWKS_URL = ISS + "/.well-known/jwks.json"
STUDENT_SCOPES = "face:verify id:verify ocr:submit image:check"
ALL_SCOPES = ("face:verify id:verify ocr:submit image:check question:generate question:tag "
              "question:classify rubric:write grading:run chat:send proctor:risk")


def new_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def jwk_of(private_key, kid):
    jwk = json.loads(RSAAlgorithm.to_jwk(private_key.public_key()))
    jwk.update({"kid": kid, "use": "sig", "alg": "RS256"})
    return jwk


class FakeJWKS:
    """Stands in for Laravel's /.well-known/jwks.json. Counts fetches; can go down."""
    def __init__(self, jwks):
        self.jwks, self.calls, self.down = jwks, 0, False

    def __call__(self, url, timeout):
        self.calls += 1
        if self.down:
            raise TimeoutError("laravel unreachable")
        return self.jwks


class FakeClock:
    def __init__(self):
        self.now = 1000.0

    def __call__(self):
        return self.now


@pytest.fixture
def laravel():
    key = new_key()
    fake = FakeJWKS({"keys": [jwk_of(key, "2026-11")]})
    clock = FakeClock()
    ai_auth.configure({ISS: ai_auth.IssuerKeys(JWKS_URL, fetch=fake, clock=clock)})
    return {"key": key, "jwks": fake, "clock": clock}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("ALLOW_LEGACY_PASSWORD", "false")
    monkeypatch.setenv("LEGACY_X_PASSWORD", "old-shared-secret")
    return TestClient(app)


def mint(private_key, *, kid="2026-11", alg="RS256", lifetime=900, **overrides):
    now = int(time.time())
    claims = {"iss": ISS, "aud": "ai-api", "sub": "141", "role": "student",
              "scope": STUDENT_SCOPES, "inst": 12, "iat": now, "nbf": now,
              "exp": now + lifetime, "jti": str(uuid.uuid4()), "ver": 1}
    claims.update(overrides)
    claims = {k: v for k, v in claims.items() if v is not None}   # None = leave the claim out
    return jwt.encode(claims, private_key, algorithm=alg, headers={"kid": kid})


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


FACE, GRADE = "/face/verify", "/api/legacy_grading/grade/qa"


# 1
def test_valid_student_token_on_face_endpoint(laravel, client):
    assert client.post(FACE, headers=bearer(mint(laravel["key"]))).status_code == 200

# 2
def test_valid_service_token_on_grading_endpoint(laravel, client):
    token = mint(laravel["key"], sub="laravel", role="service", scope=ALL_SCOPES,
                 lifetime=300, inst=None, ver=None)
    assert client.post(GRADE, headers=bearer(token)).status_code == 200

# 3
def test_no_authorization_header_fallback_off(laravel, client):
    assert client.post(FACE).status_code == 401

# 4
def test_x_password_only_fallback_on(laravel, client, monkeypatch, caplog):
    monkeypatch.setenv("ALLOW_LEGACY_PASSWORD", "true")
    caplog.set_level("INFO", logger="ai_auth.access")
    r = client.post(FACE, headers={"X-Password": "old-shared-secret"})
    assert r.status_code == 200
    assert "method=legacy" in caplog.text

# 5
def test_x_password_only_fallback_off(laravel, client):
    assert client.post(FACE, headers={"X-Password": "old-shared-secret"}).status_code == 401

# 6
def test_expired_token(laravel, client):
    now = int(time.time())
    token = mint(laravel["key"], iat=now - 1000, nbf=now - 1000, exp=now - 60)  # beyond 30 s leeway
    assert client.post(FACE, headers=bearer(token)).status_code == 401

# 7
def test_payload_edited(laravel, client):
    header, payload, sig = mint(laravel["key"]).split(".")
    claims = json.loads(jwt.utils.base64url_decode(payload))
    claims["role"] = "admin"
    forged = jwt.utils.base64url_encode(json.dumps(claims).encode()).decode()
    assert client.post(FACE, headers=bearer(f"{header}.{forged}.{sig}")).status_code == 401

# 8
def test_token_signed_with_a_different_key(laravel, client):
    assert client.post(FACE, headers=bearer(mint(new_key()))).status_code == 401

# 9
@pytest.mark.parametrize("alg", ["none", "HS256"])
def test_alg_none_or_hs256(laravel, client, alg):
    if alg == "none":
        token = mint(None, alg="none")
    else:  # algorithm confusion: HMAC "signed" with the public key bytes
        pub = laravel["key"].public_key().public_bytes(
            serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
        h = jwt.utils.base64url_encode(json.dumps({"alg": "HS256", "typ": "JWT", "kid": "2026-11"}).encode())
        p = mint(laravel["key"]).split(".")[1].encode()
        sig = jwt.utils.base64url_encode(hmac.new(pub, h + b"." + p, hashlib.sha256).digest())
        token = (h + b"." + p + b"." + sig).decode()
    assert client.post(FACE, headers=bearer(token)).status_code == 401

# 10
def test_unknown_kid_refetches_only_once(laravel, client):
    client.post(FACE, headers=bearer(mint(laravel["key"])))       # warm the cache
    assert laravel["jwks"].calls == 1
    for _ in range(20):
        r = client.post(FACE, headers=bearer(mint(laravel["key"], kid="random-kid")))
        assert r.status_code == 401
    assert laravel["jwks"].calls == 2                              # exactly one refetch

# 11
@pytest.mark.parametrize("iss", [OTHER_ISS, ISS + "/"])
def test_wrong_issuer(laravel, client, iss):
    assert client.post(FACE, headers=bearer(mint(laravel["key"], iss=iss))).status_code == 401

# 12
def test_wrong_audience(laravel, client):
    assert client.post(FACE, headers=bearer(mint(laravel["key"], aud="1"))).status_code == 401

# 13
def test_student_token_on_grading_endpoint(laravel, client):
    assert client.post(GRADE, headers=bearer(mint(laravel["key"]))).status_code == 403

# 14
def test_registrant_token_on_face_endpoint(laravel, client):
    token = mint(laravel["key"], role="registrant")
    assert client.post(FACE, headers=bearer(token)).status_code == 200

# 15
def test_laravel_unreachable_after_keys_cached(laravel, client):
    assert client.post(FACE, headers=bearer(mint(laravel["key"]))).status_code == 200
    laravel["jwks"].down = True
    laravel["clock"].now += 2 * 3600                                # cache is now stale
    assert client.post(FACE, headers=bearer(mint(laravel["key"]))).status_code == 200

# 16
def test_cors_preflight_with_authorization(laravel, client):
    r = client.options(FACE, headers={
        "Origin": "https://<web-app-origin>",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type",
    })
    assert r.status_code == 200
    assert "authorization" in r.headers["access-control-allow-headers"].lower()

# Extra: key rotation picked up via unknown-kid refetch
def test_rotation_new_kid_is_picked_up(laravel, client):
    client.post(FACE, headers=bearer(mint(laravel["key"])))
    new = new_key()
    laravel["jwks"].jwks = {"keys": [jwk_of(laravel["key"], "2026-11"), jwk_of(new, "2026-12")]}
    assert client.post(FACE, headers=bearer(mint(new, kid="2026-12"))).status_code == 200

# Extra: a bad token loses even with a correct password alongside it
def test_both_headers_judged_by_token(laravel, client, monkeypatch):
    monkeypatch.setenv("ALLOW_LEGACY_PASSWORD", "true")
    h = {"X-Password": "old-shared-secret", **bearer(mint(new_key()))}
    assert client.post(FACE, headers=h).status_code == 401
```

When you adapt this to a real AI host, replace `/face/verify` with the real face path, add one 403 test per Laravel-only endpoint group (a student token must not reach rubric, question generation, tagging, Bloom, chatbot, exam risk or OMR), and add a test that walks `app.routes` and fails if any non-health route lacks a scope.

## Glossary, self-check quiz and further reading

Use the glossary as a lookup while implementing, the quiz to check you could explain the design to a reviewer, and the reading list when you want the primary sources.

### Glossary

| Term | Plain meaning | Where it shows up for us |
| --- | --- | --- |
| Algorithm confusion | Tricking a verifier into using an RSA public key as an HMAC secret | Why `algorithms=["RS256"]` is hard-coded |
| `alg` | Token header field naming the signature algorithm | Must be `RS256` |
| Asymmetric cryptography | Key pairs: private key signs, public key verifies | Laravel signs, AI verifies |
| Audience (`aud`) | Who the token is meant for | `ai-api` |
| Authentication (authn) | Proving who you are | Steps 1 to 6; failures are 401 |
| Authorization (authz) | Deciding what you may do | Step 7; failures are 403 |
| Base64url | URL-safe text encoding of bytes; not encryption | The three JWT parts |
| Bearer token | A token whose holder may use it, no further proof | `Authorization: Bearer <token>` |
| Claim | One statement in the payload | `sub`, `role`, `scope` and the rest |
| CORS | Browser rules for cross-origin calls | `Authorization` allowed; preflight not blocked |
| Defence in depth | Several independent layers of protection | Keeping the IP allowlist during the transition |
| Digital signature | Value proving integrity and origin of a message | The third JWT part |
| HMAC / HS256 | Symmetric signature with a shared secret | Rejected |
| `iat` / `nbf` / `exp` | Issued at / not before / expires, Unix seconds | Checked with 30 s leeway |
| Issuer (`iss`) | Who created the token | `https://<laravel-host>`, from the trusted list |
| JWK / JWKS | A public key as JSON / a set of them | `https://<laravel-host>/.well-known/jwks.json` |
| JWT | Signed JSON token: header.payload.signature | `ai_token` and the service token |
| `jti` | Unique token id | Logged on every request |
| `kid` | Key id in the token header | Selects the JWKS key, e.g. `2026-11` |
| Key rotation | Replacing the signing key over time | JWKS lists two keys for a while |
| Leeway | Grace period for clock differences | 30 s |
| NTP | Protocol that keeps server clocks in sync | Required on every AI host |
| Opaque token | A token the holder doesn't look inside | How apps treat `ai_token` |
| Preflight | Browser's `OPTIONS` request before a non-simple call | Must bypass auth |
| Private key | The secret half of a key pair | Only Laravel has it |
| Public key | The shareable half of a key pair | Fetched from JWKS |
| Refresh | Getting a new short-lived token without re-login | `POST /api/ai/token` with the login token |
| Registrant | Student on the signup screen before first login | Face, ID, OCR, image scopes only |
| Resource server | The API that a token grants access to | The AI hosts |
| Revocation | Invalidating a token before expiry | Not done; rely on 15 / 5 min lifetimes |
| Role | A kind of user | `student`, `registrant`, `faculty`, `admin`, `service` |
| RS256 | RSA signature (PKCS#1 v1.5) with SHA-256 | Our only algorithm |
| Scope | One permission, `resource:action` | Each endpoint needs one |
| Service token | Token Laravel mints for its own backend calls | 5 min, `sub: laravel`, every scope |
| SHA-256 | Hash function producing 32-byte digests | Inside RS256 |
| Stateless | Server keeps no per-session record | Why AI never calls Laravel per request |
| Subject (`sub`) | Who the token is about | User id, or `laravel` |

### Self-check quiz

Try each one before reading the answer.

1. **A JWT's payload contains `"role":"student"`. Can a student read their own token's claims? Can they change them?** Answer: they can read them, because base64url is encoding, not encryption. They can't change them usefully: any edit breaks the RS256 signature, and only Laravel has the private key (test case 7).
2. **Why does the AI guide insist on RS256 rather than HS256?** Answer: with HS256 every verifier holds the signing secret, so a leak from any of four AI hosts lets an attacker mint tokens. With RS256, AI hosts hold only public keys; nothing they have can forge a token.
3. **Your code calls `jwt.decode(token, key, algorithms=[header["alg"]])`. What's wrong?** Answer: the token picks its own algorithm. An attacker sends `alg: HS256` and HMACs the payload with the public key as the secret (algorithm confusion), or sends `alg: none`. Always pass `algorithms=["RS256"]`.
4. **You read `iss` before verifying the signature. Isn't that trusting untrusted data?** Answer: only to choose which configured JWKS to verify against. A lie just leads to verification against the wrong keys and a 401. Nothing else may use the unverified payload, and `issuer=iss` re-checks it after verification.
5. **A token arrives with a `kid` your cache doesn't have. What happens, and why the rate limit?** Answer: refetch that issuer's JWKS once, because a key may have just been rotated in; if still missing, 401. The limit (about one refetch per issuer per minute) stops random `kid`s from turning your AI fleet into a flood against Laravel (test case 10).
6. **Laravel is down for 20 minutes. What should your service do?** Answer: keep verifying with cached keys; don't wipe the cache on a failed fetch (test case 15). Tokens keep working; only new logins and refreshes fail, on Laravel's side.
7. **A valid student token calls `api/legacy_grading/grade/qa`. Which status, and what does the app do?** Answer: 403, because the token is genuine but lacks `grading:run`. The app doesn't retry and reports a bug (test case 13).
8. **An expired token arrives. Which status, and what does the app do?** Answer: 401. The app calls `POST /api/ai/token` with its login token and retries once.
9. **What's the difference between `token` and `ai_token` in the login response?** Answer: `token` is the Passport login token, sent only to Laravel and used to refresh the AI token. `ai_token` is the 15-minute RS256 JWT, sent only to the AI API. A Passport token sent to AI fails the `kid` or audience check.
10. **Why must the AI side deploy before Laravel in each environment?** Answer: once deployed, Laravel's backend sends only Bearer tokens. If the AI side doesn't accept them yet, grading, question generation, rubric, tagging, chatbot and OMR all fail.
11. **A student logs out at 10:05 with an AI token expiring at 10:15. Is the token still usable?** Answer: yes, until 10:15 (plus 30 s leeway). There's no revoke check by agreement; Laravel just won't issue a new one. `ver` is reserved for a future revoke mechanism and must be ignored for now.
12. **Which `OPTIONS` requests should your auth layer reject?** Answer: none. Preflights carry no token by design; CORS middleware answers them before auth runs (test case 16).
13. **What do you log for each request, and what must you never log?** Answer: log `jti`, `sub`, `role`, `inst`, endpoint, result (allowed, 401 or 403) and the failure reason, plus the auth method during the transition. Never log the token or the `Authorization` header.
14. **When can `ALLOW_LEGACY_PASSWORD` be set to false, and what comes after?** Answer: per environment, once logs show no more password traffic, or on an agreed date after the forced mobile update. After it's off everywhere, change the old password, which should be treated as public.
15. **Should you keep the IP allowlist?** Answer: it's an open decision. A sensible default: keep it on backend-only endpoints while the password fallback is on, since the leaked password still works then; revisit once the fallback is off.

### Further reading

The specifications, shortest path first:

- [RFC 8725: JSON Web Token Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725): the attacks and defences in this guide, from the source. Read this one first.
- [RFC 7519: JSON Web Token (JWT)](https://www.rfc-editor.org/rfc/rfc7519): claims (`iss`, `sub`, `aud`, `exp`, `nbf`, `iat`, `jti`) and the token format.
- [RFC 7515: JSON Web Signature (JWS)](https://www.rfc-editor.org/rfc/rfc7515): how the signature and the `header.payload.signature` serialization work, including `kid`.
- [RFC 7517: JSON Web Key (JWK)](https://www.rfc-editor.org/rfc/rfc7517): the JWK and JWKS formats.
- [RFC 7518: JSON Web Algorithms (JWA)](https://www.rfc-editor.org/rfc/rfc7518): what `RS256`, `HS256` and `none` mean exactly.
- [RFC 6750: Bearer Token Usage](https://www.rfc-editor.org/rfc/rfc6750): the `Authorization: Bearer` header and `WWW-Authenticate`.

Library documentation:

- [PyJWT documentation](https://pyjwt.readthedocs.io/): `jwt.decode` options, exceptions, `PyJWK` and `PyJWKClient`.

Our sources (internal): the Laravel team's three guides, "AI API: verifying Examini JWTs (implementation guide)", "AI token: API examples for the mobile app" and "AI token: API examples for the React web app", tickets EX-3258 and EX-3259, and pentest finding EX-3055. When this document and those guides disagree, the guides win; tell the author so this one can be fixed.

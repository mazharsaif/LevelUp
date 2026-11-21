# Networking & HTTPS: a practical guide

Nov 19, 2026 · @Mazhar Mumbaiwala

## How to read this guide

This guide explains what happens between typing an address and seeing a page, and how to put your own app on your own domain with HTTPS. It is written for a developer who can ship code but treats networking as magic. By the end, every step of `https://dev.level-up.com.de` loading on your phone should make sense.

### The map

| Part | Chapters | What you get |
| --- | --- | --- |
| Moving data | 1 to 2 | Packets, IP addresses, TCP, UDP and ports |
| Names | 3 to 4 | How DNS turns a name into an address, and how you own a domain |
| Talking | 5 to 6 | HTTP: requests, responses, versions and caching |
| Trust | 7 to 10 | The cryptography, TLS, certificates and Let's Encrypt |
| Running it | 11 to 14 | Reverse proxies, Cloudflare, a full setup and the debugging tools |
| Review | 15 | One request traced end to end, plus a quiz |

### The running example

One real setup runs through every chapter, so each idea has something concrete to attach to:

- **Domain:** `level-up.com.de`, registered at Cloudflare, which also hosts its DNS.
- **Server:** a DigitalOcean droplet (Ubuntu 26.04) at `168.144.78.71`.
- **App:** LevelUp, a Python FastAPI app listening on port 8000, on the droplet only.
- **Front door:** Caddy, a reverse proxy on ports 80 and 443 that holds the Let's Encrypt certificates.
- **Names:** `dev.level-up.com.de` points straight at the droplet; `level-up.com.de` goes through Cloudflare's proxy and redirects to `dev`.

### How to use it

- Read chapters 1 to 6 in order: each builds on the one before.
- Chapters 7 to 10 form one story about trust; read them together.
- Chapters 11 to 14 are practical. Keep chapter 14 open while you set things up.
- Every chapter ends with a self-check. If you can answer it without looking back, move on.
- Facts that change over time (certificate lifetimes, rate limits, Cloudflare settings) were checked against official pages in November 2026 and are cited at the end.

### Sources

Checked on 19 November 2026; live values come from the droplet itself (`dig`, `openssl s_client`, the Caddy log).

- [Let's Encrypt: challenge types](https://letsencrypt.org/docs/challenge-types/)
- [Let's Encrypt: rate limits](https://letsencrypt.org/docs/rate-limits/)
- [Let's Encrypt: certificate lifetime plans](https://letsencrypt.org/docs/cert-lifetimes/) and [From 90 to 45](https://letsencrypt.org/2025/12/02/from-90-to-45)
- [CA/Browser Forum ballot SC-081](https://cabforum.org/2025/04/11/ballot-sc081v3-introduce-schedule-of-reducing-validity-and-data-reuse-periods/)
- [Cloudflare: SSL/TLS encryption modes](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/)
- [RFC 8446: TLS 1.3](https://www.rfc-editor.org/rfc/rfc8446)
- [Public Suffix List](https://publicsuffix.org/list/public_suffix_list.dat)

## 1. The layers of the internet

The internet moves small chunks of data called packets, and every packet is wrapped in layers of headers, each added by a layer with one job. Knowing the layers tells you where a problem lives: a wrong address, a closed port and an expired certificate are failures at three different layers.

### Packets and layers

Nothing travels as one big file. Your phone cuts a request into packets of up to about 1,500 bytes (the common Ethernet limit) and each packet finds its own way. The receiver puts them back together.

Each layer adds its own header in front of the data, like putting a letter in an envelope, then in a bigger envelope:

| Layer (TCP/IP model) | Job | Example | Its address |
| --- | --- | --- | --- |
| Application | What the data means | HTTP, DNS, TLS-protected HTTP | A URL or a name |
| Transport | Which program, and reliable delivery | TCP, UDP | A port, such as 443 |
| Internet | Which machine, across networks | IP (IPv4, IPv6) | An IP address |
| Link | The next hop on this wire or radio | Ethernet, Wi-Fi | A MAC address |

You will also meet the **OSI model**, which has 7 layers instead of 4. People still use its numbers as slang: "a layer 4 load balancer" works with TCP ports, "layer 7" means it reads HTTP. TLS sits between transport and application, so it is often called layer 6 or simply "on top of TCP".

### IP addresses

An IP address names a machine's network interface.

- **IPv4** addresses are 32 bits, written as four numbers: `168.144.78.71`. There are only about 4.3 billion, and they ran out years ago.
- **IPv6** addresses are 128 bits, written in hex: `2a03:b0c0:2:f0::1`. There are enough for every device to have many.

Some ranges are **private**: they are reused inside homes and offices and never routed on the public internet. The common ones are `10.0.0.0/8`, `172.16.0.0/12` and `192.168.0.0/16`. Your laptop at home probably has a `192.168.x.x` address. `127.0.0.1` (and `::1` in IPv6) is **loopback**: the machine itself. When the LevelUp app listens on `127.0.0.1:8000`, only programs on the droplet can reach it.

The `/8`, `/16` notation is **CIDR**: the number of leading bits that are fixed. `10.0.0.0/8` fixes the first 8 bits, so it covers every address starting with `10.`.

### NAT: many devices, one public address

Your home router has one public IPv4 address from your internet provider. Every device behind it uses a private address. When your phone sends a packet out, the router rewrites the source address to its own public one and remembers the mapping, so it can send replies back to the right device. This is **NAT** (network address translation).

NAT has a consequence you will meet constantly: devices behind it can start connections out, but nobody outside can start a connection in. That is why you can't host a public website from your laptop without extra work, and why a server like a droplet, which has its own public address, is the normal place to run one.

### Routing

A packet rarely goes straight from sender to receiver. It hops through routers, each of which reads only the destination IP address and passes the packet to the next router that is closer. No router knows the whole path. Between big networks (internet providers, cloud companies) routes are announced with a protocol called **BGP**, which is how the world learns which network owns a range such as `168.144.0.0/16` and how to reach it.

You can watch the hops with `traceroute` (chapter 14). Each line is one router; the times show how long the round trip took.

### Self-check

1. Which layer does a port number belong to, and which layer does an IP address belong to?
2. Why can't someone on the internet connect to `192.168.1.20`?
3. The app listens on `127.0.0.1:8000`. Can a phone reach it directly? Why or why not?
4. What does `/24` mean in `203.0.113.0/24`, and how many addresses does it cover?

### Answers

1. Ports are transport (TCP or UDP). IP addresses are the internet layer.
2. It is a private address: routers on the public internet never forward packets to that range.
3. No. `127.0.0.1` is loopback, so only programs on the same machine can connect. Something on the droplet, such as Caddy, has to pass requests to it.
4. The first 24 bits are fixed, leaving 8 bits free: 256 addresses, `203.0.113.0` to `203.0.113.255`.

## 2. TCP, UDP and ports

IP gets a packet to the right machine; TCP or UDP gets it to the right program on that machine and decides how careful delivery should be. Almost all web traffic before HTTP/3 rides on TCP, and the port number is what lets one server run many services at once.

### Ports and sockets

A **port** is a 16-bit number (0 to 65535) that names one service on a machine. The droplet runs SSH on port 22, Caddy on 80 and 443, and LevelUp on 8000, all on the same IP address.

A connection is identified by four values: source IP, source port, destination IP, destination port. When your phone opens `https://dev.level-up.com.de`, it might use `phone-ip:51734 → 168.144.78.71:443`. The phone's side gets a random **ephemeral** port so that many tabs can talk to the same server at once. A **socket** is the program's handle on one end of such a connection.

| Range | Name | Use |
| --- | --- | --- |
| 0 to 1023 | Well-known (system) | Standard services: 22 SSH, 53 DNS, 80 HTTP, 443 HTTPS. Only root can listen here on Linux by default |
| 1024 to 49151 | Registered | Apps by convention: 5432 Postgres, 6379 Redis, 8080 "alternative HTTP" |
| 49152 to 65535 | Dynamic (IANA) | Ephemeral client ports. Linux actually uses 32768 to 60999 by default |

That last row is why new apps on the droplet use ports like 8100 to 8119: well clear of the system range and of the ports Linux hands out to outgoing connections.

### TCP: reliable, ordered, connection-based

TCP turns unreliable packets into a reliable stream of bytes. Before any data moves, the two sides agree to talk with the **three-way handshake**:

1. Client sends **SYN** ("I'd like to connect; my numbering starts at x").
2. Server replies **SYN-ACK** ("OK; mine starts at y, and I got yours").
3. Client sends **ACK** ("got yours"). The connection is open.

That costs one full round trip before the first byte of the request. From India to a server in Bangalore that might be 20 ms; to a server in Frankfurt, 150 ms or more. This is why connection reuse and newer protocols matter (chapter 6).

Once open, TCP numbers every byte. The receiver acknowledges what arrived; anything not acknowledged in time is sent again. Bytes are handed to the program in order, even if packets arrived out of order. TCP also slows down when the network is congested (**congestion control**) and when the receiver can't keep up (**flow control**). Closing uses FIN packets from each side.

The catch is **head-of-line blocking**: if one packet is lost, everything after it waits for the resend, even data that already arrived.

### UDP: fast, fire and forget

UDP just sends packets (called datagrams) with a port number and a checksum. No handshake, no resend, no ordering. Lost packets are simply lost.

That sounds worse but is exactly right when speed matters more than perfection, or when the program handles reliability itself:

| Use | Why UDP |
| --- | --- |
| DNS lookups | One small question, one small answer; a retry is cheaper than a handshake |
| Video calls, games | A late packet is useless; better to skip it |
| QUIC (HTTP/3) | Builds its own reliability and encryption on top of UDP, without TCP's head-of-line blocking |

### Firewalls and listening

A service is reachable only if two things are true: a program is **listening** on that port, and the **firewall** lets packets in. On the droplet:

- `ss -tlnp` lists listening TCP ports and the program behind each.
- `sudo ufw status` lists what the firewall allows.

The address a program listens on matters as much as the port. `0.0.0.0:8000` means "every interface", so the internet can reach it if the firewall allows. `127.0.0.1:8000` means "loopback only", which no firewall rule can open to the outside. Binding apps to `127.0.0.1` and exposing only the reverse proxy is the safest setup (chapter 11).

Two error messages tell you which half failed:

- **Connection refused:** the packet arrived, but nothing is listening on that port. The machine answered with a reset.
- **Connection timed out:** no answer at all. Usually a firewall dropped the packet, or the address is wrong.

### Self-check

1. What are the three packets of the TCP handshake, in order?
2. Why does DNS normally use UDP?
3. `curl http://168.144.78.71:9000` says "connection refused". Is it more likely the firewall or a missing program?
4. Why is port 40000 a poor choice for a long-running app on Linux?

### Answers

1. SYN, SYN-ACK, ACK.
2. A lookup is one small question and answer, so a handshake would double the time; if a packet is lost, the client simply asks again.
3. A missing program: "refused" means the machine answered. A firewall that drops packets causes a timeout instead.
4. It sits inside Linux's ephemeral range (32768 to 60999), so the system may already be using it for an outgoing connection and the app can fail to start.

## 3. How DNS works

DNS (the Domain Name System) is the internet's phone book: it turns a name like `dev.level-up.com.de` into an IP address like `168.144.78.71`. No single server knows every name. Instead, the answer is found by asking a chain of servers, each responsible for one part of the name, and the result is cached along the way.

### Names are read right to left

A domain name is a path through a tree, read from the right:

| Part | Level | Who runs it |
| --- | --- | --- |
| `.` (invisible) | Root | 13 named root server addresses, run by 12 organisations, copied worldwide |
| `de` | Top-level domain (TLD) | DENIC, the German registry |
| `com.de` | Second level under `.de` | CentralNic, which sells names under `com.de` like a TLD (checked with `dig +trace`) |
| `level-up.com.de` | Your domain | You, through your DNS host (Cloudflare) |
| `dev.level-up.com.de` | A subdomain | You: just another record in your zone |

Each level **delegates** the level below it: the root knows which servers are in charge of `de`, the `de` servers know who is in charge of `com.de`, and so on down to the servers in charge of your **zone**, the set of records for your domain.

### One lookup, step by step

When your phone needs `dev.level-up.com.de`:

1. The phone's **stub resolver** (part of the operating system) checks its own cache. Nothing there, so it asks the **recursive resolver** it was configured with: usually your internet provider's, or a public one such as Cloudflare's `1.1.1.1` or Google's `8.8.8.8`.
2. The recursive resolver checks its cache. If it has nothing useful, it asks a **root server**: "where is `dev.level-up.com.de`?" The root doesn't know, but answers with a **referral**: "ask the `de` servers, here they are."
3. The resolver asks a `de` server, which refers it on towards the servers for `com.de`, and then to the servers for `level-up.com.de`.
4. The resolver asks one of those, the **authoritative** servers for the zone. For this domain they are `hal.ns.cloudflare.com` and `piper.ns.cloudflare.com`. They answer: `dev.level-up.com.de A 168.144.78.71`.
5. The resolver caches the answer and hands it to the phone, which caches it too and opens a connection to that address.

The resolver does the walking (that is what "recursive" means); the phone asks one question and gets one answer. In practice the root and TLD referrals are almost always cached already, so a typical lookup costs a single query to the authoritative servers, or nothing at all.

### Caching and TTL

Every record carries a **TTL** (time to live) in seconds: how long anyone may cache it. Cloudflare's "Auto" TTL is 300 seconds (5 minutes) for records that aren't proxied.

Caching is why DNS is fast and why changes are not instant:

- A **new** name usually works within seconds, because nobody has cached it yet. That is what you saw when `dev.level-up.com.de` resolved straight after you created it.
- A **changed** record can keep returning the old value until the cached copy's TTL runs out, at every resolver that cached it.
- A **negative** answer ("no such name") is cached too, for a time set in the zone. Look a name up before creating it, and you may keep seeing "not found" for a while.

People call this delay "propagation", but nothing is being pushed around. Old copies are simply expiring in caches. The practical trick: lower the TTL a day before a planned move, make the change, then raise it again.

### Asking DNS yourself

`dig` is the standard tool. Three forms cover most needs:

```
dig +short dev.level-up.com.de          # what my resolver says
dig +short dev.level-up.com.de @1.1.1.1 # what Cloudflare's resolver says
dig +short dev.level-up.com.de @hal.ns.cloudflare.com  # the source of truth
```

If the authoritative server has the right answer but a resolver doesn't, you are waiting for a cache. If the authoritative server is wrong, fix the record.

### Security in brief

Classic DNS is plain text over UDP port 53, so anyone on the path can read which names you look up, and a forged answer could send you to the wrong server. Three later additions help:

- **DNSSEC** signs records so resolvers can check they weren't forged. It protects integrity, not privacy.
- **DNS over HTTPS (DoH)** and **DNS over TLS (DoT)** encrypt the lookup between your device and the resolver, hiding it from the local network.
- **HTTPS itself** is the final safety net: even if DNS lies, a fake server can't show a valid certificate for your name (chapter 9).

### Self-check

1. Which server gives the final, authoritative answer for `dev.level-up.com.de`?
2. You change an A record that had a TTL of 3600. What is the longest a resolver could keep serving the old address?
3. Why did `dev.level-up.com.de` work almost instantly after you created it?
4. What does a root server answer when asked about your domain?

### Answers

1. The zone's authoritative name servers, here Cloudflare's `hal` and `piper`.
2. Up to 3600 seconds (one hour) after it last fetched the record.
3. No resolver had cached anything for that name yet, so the first lookup went to the authoritative servers, which already had the new record.
4. A referral: the name servers for `de`. It never knows your records.

## 4. Domains and DNS records

Owning a domain means renting the right to decide its DNS records, for a year at a time. Three different roles are involved, and the records you write in your zone are short typed lines: an A record for an address, a CNAME for an alias, and a few others for mail and security.

### Registry, registrar, DNS host

| Role | What it does | For level-up.com.de |
| --- | --- | --- |
| Registry | Runs a TLD (or a name space such as `com.de`): keeps the list of who owns which name and which name servers to delegate to | CentralNic for `com.de` |
| Registrar | The shop you buy from. Passes your registration and your chosen name servers to the registry | Cloudflare Registrar |
| DNS host | Runs the authoritative name servers that answer for your zone | Cloudflare DNS |

The registrar and DNS host are often the same company, but they don't have to be. You could buy a name at one registrar and point its **NS** (name server) setting at another company's DNS. Changing that NS setting is how you move DNS hosting, and it is the one change that can take up to a day or two, because the parent zone's referral has a long TTL.

A few practical rules:

- **Renewal:** a domain is registered for whole years. Turn on auto-renew. An expired domain stops resolving, and after a grace period anyone can buy it, including people who collect expired names with traffic.
- **WHOIS / RDAP:** the public registration lookup. Most registrars hide personal details by default.
- **Transfer lock:** keeps the name from being moved to another registrar without your approval. Leave it on.

### The records you will actually use

| Type | Maps | Example | Notes |
| --- | --- | --- | --- |
| A | Name to IPv4 address | `dev` to `168.144.78.71` | The workhorse |
| AAAA | Name to IPv6 address | `dev` to `2a03:...` | Add one if your server has IPv6 |
| CNAME | Name to another name | `www` to `level-up.com.de` | An alias: the resolver looks up the target instead. Not allowed at the apex |
| MX | Domain to mail server, with priority | `10 mail.example.net` | Only if you receive email at the domain |
| TXT | Name to free text | `v=spf1 -all` | Ownership checks, email policy (SPF, DMARC), ACME DNS challenges |
| NS | Zone to its name servers | `hal.ns.cloudflare.com` | Set by your DNS host; rarely touched |
| CAA | Which CAs may issue certificates | `0 issue "letsencrypt.org"` | Optional hardening (chapter 9) |

The name `@` means the domain itself (the **apex**, or root: `level-up.com.de`). Anything else you type, such as `dev`, gets the domain added: `dev.level-up.com.de`.

### Apex, subdomains and wildcards

**The apex can't be a CNAME.** The DNS rules say a name with a CNAME may have no other records, but the apex always needs NS and SOA records. So `level-up.com.de` itself must use A/AAAA records. Some DNS hosts, Cloudflare included, offer "CNAME flattening": you type a CNAME at the apex and they answer with the target's A records for you.

**Subdomains are free and instant.** `dev`, `api`, `app2` are just more records in your zone. You don't buy them, and each can point anywhere. This is why one domain can front many apps: one subdomain per app.

**A wildcard** record `*.level-up.com.de` answers for every name that has no record of its own. It saves adding a record per app, but it also means typos resolve, and it needs a DNS-validated certificate if you want one certificate for all names (chapter 10).

### How this domain is set up

| Name | Type | Value | Cloudflare proxy |
| --- | --- | --- | --- |
| `dev` | A | `168.144.78.71` | DNS only (grey cloud): resolves to the droplet itself |
| `@` | A | `168.144.78.71` | Proxied (orange cloud): resolves to Cloudflare addresses, which forward to the droplet |

The proxied record is why `dig level-up.com.de` returns addresses like `104.21.42.184` rather than the droplet's: visitors connect to Cloudflare, and Cloudflare connects to the droplet (chapter 12).

### Self-check

1. You want `www.level-up.com.de` to behave like `level-up.com.de`. Which record type fits?
2. Why can't `level-up.com.de` itself be a CNAME?
3. Which role do you contact to change the domain's name servers: registry, registrar or DNS host?
4. What happens when the registration expires?

### Answers

1. A CNAME from `www` to `level-up.com.de` (or an A record with the same address).
2. The apex must carry NS and SOA records, and a name with a CNAME may have no other records.
3. The registrar, which passes the change to the registry.
4. After a grace period the name stops resolving, so every site and email on it breaks, and later anyone can register it.

## 5. HTTP basics

HTTP is the language browsers and servers speak: the client sends a request (a method, a path, headers, sometimes a body) and the server sends back a response (a status code, headers, usually a body). Every page, image, API call and LevelUp progress save is one of these exchanges.

### A request and a response

HTTP/1.1 is plain text, so you can read it. When the LevelUp app loads your list of learners, the request looks like this:

```
GET /api/users HTTP/1.1
Host: dev.level-up.com.de
User-Agent: Mozilla/5.0 (Linux; Android 15) ...
Accept: application/json
```

And the response:

```
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 146
Cache-Control: no-store

[{"id":"taha","name":"Taha"}, ...]
```

The first line of a request is **method, path, version**. Then come header lines, a blank line, and an optional body. The `Host` header names the site, which is how one server at one IP address can host many domains: Caddy reads `Host` and picks the right app.

HTTP/2 and HTTP/3 send exactly the same information in a compact binary form, so everything in this chapter still applies.

### Methods

| Method | Means | Safe to repeat? |
| --- | --- | --- |
| GET | Fetch something; no body | Yes, and it should change nothing |
| POST | Create something or trigger an action | No: two POSTs may create two things |
| PUT | Replace the thing at this path with this body | Yes (idempotent): the same PUT twice gives the same result |
| PATCH | Change part of something | Not guaranteed |
| DELETE | Remove it | Yes (idempotent) |
| HEAD | Like GET, headers only | Yes |
| OPTIONS | Ask what is allowed; used by browsers for CORS checks | Yes |

LevelUp saves progress with `PUT /api/state/<learner>`: sending the same state twice leaves the same file, which is exactly what "idempotent" means.

### Status codes

The first digit tells you who to blame:

| Range | Meaning | Ones you'll meet |
| --- | --- | --- |
| 1xx | Informational | 101 Switching Protocols (WebSockets) |
| 2xx | Success | 200 OK, 201 Created, 204 No Content |
| 3xx | Go somewhere else | 301 / 308 moved permanently, 302 / 307 temporarily, 304 Not Modified |
| 4xx | The client made a mistake | 400 Bad Request, 401 not logged in, 403 not allowed, 404 Not Found, 409 Conflict, 429 Too Many Requests |
| 5xx | The server failed | 500 Internal Server Error, 502 Bad Gateway, 503 Unavailable, 504 Gateway Timeout |

Two pairs are worth memorising. **308 vs 301:** both mean "moved for good", but 308 promises the method stays the same, so a POST stays a POST. Caddy uses 308 for its HTTP-to-HTTPS redirect. **502 vs 504:** both come from a proxy. 502 means the app behind it returned garbage or refused the connection (often: the app is down). 504 means it didn't answer in time. LevelUp itself returns 409 when a phone tries to save older progress over newer.

### Headers that matter

- `Host`: which site. Required.
- `Content-Type`: what the body is, such as `application/json` or `text/html; charset=utf-8`.
- `Cookie` / `Set-Cookie`: small values the browser stores and sends back on every request to that site. This is how logins survive between requests.
- `Authorization`: credentials such as `Bearer <token>`.
- `Location`: where a redirect points.
- `Cache-Control`: how long anyone may cache the response (chapter 6).

### Stateless, with cookies on top

HTTP is **stateless**: each request stands alone, and the server doesn't remember the previous one. Anything that must persist, such as "this is Batul, logged in", travels with every request, usually as a cookie or token. That is why stolen cookies are dangerous, and why they should be marked `Secure` (sent only over HTTPS) and `HttpOnly` (hidden from JavaScript).

### What happens when you type a URL

Take `https://dev.level-up.com.de/#/today`:

1. The browser splits the URL: scheme `https`, host `dev.level-up.com.de`, default port 443, path `/`. The part after `#` never leaves the browser; LevelUp's own code reads it to pick a screen.
2. DNS turns the host into `168.144.78.71` (chapter 3).
3. TCP connects to port 443 (chapter 2).
4. TLS sets up encryption and checks the certificate (chapters 8 and 9).
5. The browser sends `GET /` with `Host: dev.level-up.com.de`.
6. Caddy forwards it to the app on `127.0.0.1:8000` and relays the HTML back.
7. The browser reads the HTML and requests every script, stylesheet and image it names, usually over the same connection.

### Self-check

1. Which header lets one IP address host many websites?
2. A form submits with POST and the server answers 301. What might go wrong that 308 would avoid?
3. Caddy is fine but LevelUp has crashed. Which status code will a visitor most likely see?
4. Does the server ever see `#/today`?

### Answers

1. `Host`.
2. Older browsers may follow a 301 with a GET, dropping the form data. 308 requires the same method and body.
3. 502 Bad Gateway: the proxy couldn't get a valid answer from the app.
4. No. The fragment after `#` stays in the browser.

## 6. HTTP/2, HTTP/3 and caching

The meaning of HTTP hasn't changed since the 1990s, but the way it travels has: HTTP/2 runs many requests at once over one TCP connection, and HTTP/3 moves to QUIC over UDP to escape TCP's head-of-line blocking. Caching is the other half of speed: the fastest request is the one you never send.

### Why the versions changed

A page is rarely one file. LevelUp's first load pulls HTML, several JavaScript modules, a stylesheet, icons and a manifest. Each version handles that differently:

| Version | How requests travel | Main problem it solved | Problem left |
| --- | --- | --- | --- |
| HTTP/1.0 | A new TCP connection per request | (the original) | A handshake for every file |
| HTTP/1.1 (1997) | Keep-alive: reuse the connection, one request at a time | Repeated handshakes | One slow response blocks the rest; browsers open about 6 connections per site to compensate |
| HTTP/2 (2015) | Many streams interleaved on one connection; binary; compressed headers | Waiting in line at the HTTP level | A lost TCP packet still stalls every stream |
| HTTP/3 (2022) | QUIC over UDP; each stream recovers losses on its own | TCP head-of-line blocking; slow setup | Some networks block or slow UDP; falls back to HTTP/2 |

You saw HTTP/2 in action when testing the domain: `curl` reported version 2 for `https://dev.level-up.com.de`. Caddy turns on HTTP/2 and HTTP/3 by default; browsers find out about HTTP/3 through an `Alt-Svc` header and try it on the next connection.

### QUIC in one section

QUIC (RFC 9000) rebuilds what TCP does, reliability, ordering and congestion control, inside UDP packets, and builds TLS 1.3 straight into its handshake. That gives three gains:

- **Faster setup:** transport and encryption are agreed in one round trip, and a returning visitor can often send data immediately (0-RTT).
- **No cross-stream stalls:** a lost packet only delays the stream it belonged to.
- **Connection migration:** a connection is identified by an ID, not by the IP and port, so walking from Wi-Fi to mobile data doesn't break it.

HTTP/3 is HTTP's mapping onto QUIC (RFC 9114). For a small app the difference is modest; on flaky mobile networks it is noticeable.

### Caching: freshness and validation

Caches sit in the browser, in a service worker, in a CDN and in proxies. A response's headers tell all of them what they may do:

| Header | Example | Meaning |
| --- | --- | --- |
| Cache-Control | `max-age=86400` | Fresh for one day; reuse without asking |
| Cache-Control | `no-cache` | May store, but must check with the server before each reuse |
| Cache-Control | `no-store` | Never store (use for private or always-changing data) |
| Cache-Control | `public` / `private` | Shared caches (CDNs) may / may not store it |
| ETag | `"a1b2c3"` | A fingerprint of this version of the response |
| Last-Modified | a date | When it last changed |

When a cached copy goes stale, the browser **revalidates**: it sends the ETag back in `If-None-Match`. If nothing changed, the server answers **304 Not Modified** with no body, and the copy is fresh again. That saves bandwidth but still costs a round trip.

A common pattern for web apps:

- **HTML and API data:** `no-cache` or `no-store`, so people always get the current version.
- **Versioned files** (`app.3f9c1.js`): `max-age=31536000, immutable`. When the content changes, the name changes, so old copies are simply never asked for again.

### Service workers and CDNs

A **service worker** is JavaScript that sits between a web app and the network, with its own cache. LevelUp's (`sw.js`) keeps the app shell in a versioned cache (`a1-shell-v17`); bumping the version is how a deploy replaces old files on phones. Browsers allow service workers only on HTTPS (or `localhost`), which is one reason LevelUp needed a real domain and certificate before it could work offline.

A **CDN** (content delivery network) keeps copies of your responses in data centres near your users, so a visitor in Mumbai is served from Mumbai rather than from your droplet. Cloudflare's proxy is a CDN; chapter 12 covers what it caches and how it connects to your server.

### Compression

Text compresses well. The client says what it can decode (`Accept-Encoding: gzip, br, zstd`) and the server answers with `Content-Encoding`. The droplet's Caddyfile turns this on with `encode zstd gzip`. JSON and JavaScript often shrink by 70 to 90 percent; images and audio are already compressed and gain nothing.

### Self-check

1. What problem does HTTP/2 still have that HTTP/3 fixes?
2. A response has `Cache-Control: no-cache`. Can a browser store it?
3. What does a 304 response contain, and why is it useful?
4. Why does a web app's service worker need HTTPS?

### Answers

1. TCP head-of-line blocking: one lost packet stalls every stream on the connection. QUIC recovers each stream separately.
2. Yes, but it must revalidate with the server before every reuse. `no-store` is the one that forbids storing.
3. Headers only, no body. It tells the browser its cached copy is still current, saving the download.
4. Browsers only allow service workers in secure contexts, so a script that can intercept every request can't be injected by someone on the network.

## 7. Crypto building blocks

HTTPS rests on four tools: symmetric encryption to hide the data, hashes to fingerprint it, key exchange to agree on a secret over an open line, and signatures to prove who you are talking to. You don't need the maths, but you do need to know which tool does which job, because every TLS setting and every certificate error is about one of them.

### Symmetric encryption: one shared key

With **symmetric** encryption, the same key locks and unlocks. It is fast enough to encrypt video streams on a phone, so it carries all the actual data in HTTPS.

- **AES-GCM** is the common choice; phones and servers have hardware for it.
- **ChaCha20-Poly1305** is the alternative that is fast on devices without AES hardware.

Both are **authenticated encryption** (AEAD): besides hiding the data, they detect if a single bit was changed in transit.

The problem symmetric encryption can't solve by itself: how do two strangers agree on the key, when anyone can read everything they send?

### Asymmetric keys: a public and a private half

**Asymmetric** (public-key) cryptography uses a key pair. The **private key** stays secret; the **public key** can be given to the world. They are mathematically linked, but you can't work out the private key from the public one.

You have already used this: your SSH key `id_ed25519_personal` is a private key, and the `.pub` file in the droplet's `authorized_keys` is its public half. The droplet can check you hold the private key without ever seeing it.

| Algorithm family | Used for | Notes |
| --- | --- | --- |
| RSA | Signatures (older: encryption too) | Big keys (2048 to 4096 bits); still common in certificates |
| ECDSA (P-256) | Signatures | Small keys, fast; what Caddy uses by default for its certificates |
| Ed25519 | Signatures | Modern and simple; SSH keys, some TLS |
| X25519 (ECDH) | Key exchange | The usual TLS 1.3 key exchange |

Asymmetric operations are slow compared with AES, so TLS uses them only briefly at the start, to agree on symmetric keys and to prove identity.

### Hashes: fingerprints

A **hash function** turns any input into a fixed-size fingerprint. SHA-256 gives 256 bits, usually shown as 64 hex characters. Three properties matter:

- The same input always gives the same hash.
- A tiny change in the input gives a completely different hash.
- You can't find another input with the same hash, or work backwards to the input.

Hashes are everywhere: certificate fingerprints, file integrity checks, Git commit IDs, and the audio file names in LevelUp (`<sha1-12>.mp3`). Passwords need a deliberately slow hash such as bcrypt or Argon2 instead, so guessing is expensive.

### Signatures: proving who wrote it

A **digital signature** is made with a private key over a hash of a message. Anyone with the matching public key can check it. A valid signature proves two things: the holder of that private key signed it, and the message hasn't changed since.

Certificates are signatures stacked up: a certificate authority signs a statement "this public key belongs to `dev.level-up.com.de`", and your browser checks that signature with the CA's public key (chapter 9). In the TLS handshake, the server also signs the handshake itself, proving it holds the private key that matches its certificate right now.

### Key exchange and forward secrecy

**Diffie-Hellman** key exchange lets two sides that have never met agree on a shared secret while an eavesdropper watches every message. Each side makes a temporary key pair, they swap public halves, and each combines its own private half with the other's public half. Both arrive at the same secret; the eavesdropper, holding only the public halves, can't.

TLS 1.3 always uses the **ephemeral** form (ECDHE): fresh key pairs for every connection, thrown away afterwards. That gives **forward secrecy**: if someone records your traffic today and steals the server's private key next year, they still can't decrypt the recording, because the keys that protected it no longer exist anywhere. Older TLS setups that encrypted the session key with the server's RSA key didn't have this property, which is one reason TLS 1.3 removed them.

### How the pieces fit

| Job | Tool | In HTTPS |
| --- | --- | --- |
| Agree on a secret over an open line | ECDHE (X25519) | The start of every handshake |
| Prove the server's identity | Signature with the certificate's private key | CertificateVerify in the handshake |
| Prove the certificate is genuine | CA signature, checked up a chain | Certificate validation |
| Hide and protect the data | AES-GCM or ChaCha20-Poly1305 | Everything after the handshake |
| Fingerprint and check integrity | SHA-256 | Inside all of the above |

### Self-check

1. Why doesn't HTTPS encrypt the whole page with RSA?
2. Which key must never leave the server: the certificate's public key or its private key?
3. What does forward secrecy protect against?
4. Your friend sends you a file and its SHA-256. What does matching the hash prove, and what doesn't it prove?

### Answers

1. Asymmetric encryption is far slower; it's used only to set up symmetric keys, which then do the bulk work.
2. The private key. The public key is inside the certificate, which every visitor receives.
3. Recorded traffic being decrypted later with a stolen long-term key.
4. That the file arrived unchanged. It doesn't prove who sent it: an attacker who can swap the file can swap the hash too. A signature proves the sender.

## 8. The TLS handshake

TLS (Transport Layer Security) is the protocol that turns a plain TCP connection into an encrypted, authenticated one; HTTPS is simply HTTP sent through TLS. In TLS 1.3 the handshake takes one round trip: the client and server agree on keys, the server proves its identity, and encrypted data starts flowing.

### SSL, TLS and the versions

"SSL" is the old name that stuck. Every SSL version is broken and switched off; what everyone actually uses is TLS.

| Version | Year | Status |
| --- | --- | --- |
| SSL 2.0, SSL 3.0 | 1995, 1996 | Broken, disabled everywhere |
| TLS 1.0, TLS 1.1 | 1999, 2006 | Deprecated (RFC 8996); browsers refuse them |
| TLS 1.2 | 2008 | Still widely supported; safe when configured well |
| TLS 1.3 | 2018 (RFC 8446) | Current: faster, simpler, removed the weak options |

So "SSL certificate" really means "TLS certificate", and "SSL/TLS" in Cloudflare's menu means TLS. The droplet answers with TLS 1.3, which you can see with `openssl s_client` (chapter 14).

RFC 8446 states three goals: **authentication** (the server is always authenticated; the client optionally), **confidentiality** (only the two ends can read the data) and **integrity** (any change in transit is detected).

### The TLS 1.3 handshake, step by step

After TCP connects to port 443:

1. **ClientHello** (client to server, readable by anyone): the TLS versions and cipher suites the client supports, a random number, the name of the site it wants (**SNI**), the protocols it can speak (**ALPN**, such as `h2` and `http/1.1`), and a **key share**: the public half of a fresh X25519 key pair. The client guesses which key exchange the server will pick and sends a share up front, which is what saves a round trip.
2. **ServerHello** (readable): the chosen version and cipher suite, a random number, and the server's own key share. Both sides can now compute the same secret (chapter 7). **Everything after this is encrypted.**
3. **EncryptedExtensions:** the rest of the server's choices, such as the agreed ALPN protocol.
4. **Certificate:** the server's certificate chain.
5. **CertificateVerify:** a signature over the whole handshake so far, made with the certificate's private key. This proves the server holds that key right now, not just a copy of the certificate.
6. **Finished** (server): a MAC over the handshake, confirming nothing was tampered with.
7. The client checks the certificate chain and the signature, then sends its own **Finished**. It can send the HTTP request in the same flight.

One round trip for TCP, one for TLS, then the request: about two round trips before the first byte of the page. HTTP/3 merges the first two (chapter 6).

For the droplet, the result is: TLS 1.3, key exchange X25519, cipher `CHACHA20-POLY1305` (the Mac's OpenSSL preferred it; browsers on AES-capable phones usually pick AES-GCM).

### SNI and ALPN

**SNI** (Server Name Indication) solves a chicken-and-egg problem. One IP address can host many sites, each with its own certificate, but the HTTP `Host` header is only sent after encryption starts. So the client names the site in the ClientHello, and the server picks the matching certificate. When Caddy holds certificates for both `dev.level-up.com.de` and `level-up.com.de`, SNI is how it knows which to present.

The cost: SNI travels in clear text, so anyone on the network can see which site you visit, even though they can't see the pages. **Encrypted Client Hello (ECH)** hides it, and Cloudflare supports it, but it isn't universal yet.

**ALPN** (Application-Layer Protocol Negotiation) lets client and server agree on HTTP/2 or HTTP/1.1 inside the handshake, so no extra round trip is needed.

### Resumption and 0-RTT

After a full handshake the server can hand the client a **session ticket**. On the next visit the client presents it (a pre-shared key) and skips the certificate exchange. With **0-RTT**, it can even send its request in the very first flight.

RFC 8446 warns that 0-RTT data has weaker guarantees: it isn't forward secret, and an attacker could **replay** it. Servers should accept it only for requests that are safe to repeat, such as a GET, never a payment or a progress save.

### What TLS hides and what it doesn't

| Visible to the network (your Wi-Fi, ISP) | Hidden by TLS |
| --- | --- |
| Your IP and the server's IP | The full URL path and query (`/api/state/batul`) |
| The site name, through SNI (unless ECH) and the DNS lookup | Headers, including cookies and tokens |
| Roughly how much data moves, and when | The bodies: pages, JSON, form data |

### Self-check

1. In TLS 1.3, which messages travel unencrypted?
2. Why must SNI be sent before encryption starts?
3. What does CertificateVerify prove that the Certificate message alone doesn't?
4. Why shouldn't a server accept a progress-saving PUT as 0-RTT data?

### Answers

1. The ClientHello and the ServerHello. Everything from EncryptedExtensions on is encrypted.
2. The server needs the site name to choose which certificate to present, and the certificate is part of the handshake.
3. That the server holds the matching private key at that moment. A certificate is public, so anyone can copy it.
4. 0-RTT data can be replayed by an attacker, so it must only carry requests that are harmless to repeat.

## 9. Certificates and trust

A certificate is a signed statement: "this public key belongs to this domain, until this date", signed by a certificate authority (CA) your device already trusts. The browser accepts a site only if it can follow a chain of such signatures from the site's certificate up to a root CA it holds, and the name, the dates and the key all check out.

### What's inside a certificate

Certificates use the **X.509** format. The fields that matter, with the droplet's real values:

| Field | Meaning | dev.level-up.com.de |
| --- | --- | --- |
| Subject Alternative Name (SAN) | The names it is valid for. Browsers check only this field | `dev.level-up.com.de` |
| Issuer | Who signed it | Let's Encrypt, `YE2` |
| Validity | Not before / not after | 18 Nov 2026 to 16 Feb 2027 (90 days) |
| Public key | The key the server proves it holds | ECDSA on curve P-256 |
| Signature | The issuer's signature over all of the above | ECDSA with SHA-384 |
| Key usage | What the key may be used for | Server authentication |

The private key never appears in the certificate. On the droplet it sits in Caddy's data folder (`/var/lib/caddy`), readable only by Caddy.

### The chain of trust

Your phone ships with a **root store**: a list of roughly 100 to 150 root CA certificates (the count varies by vendor; approximate) that Apple, Google, Mozilla or Microsoft decided to trust, after audits. Roots are kept offline and rarely used, so CAs sign certificates with **intermediate** CAs instead. The droplet sends this chain:

| Level | Certificate | Signed by |
| --- | --- | --- |
| Leaf | `dev.level-up.com.de` | Let's Encrypt YE2 (intermediate) |
| Intermediate | Let's Encrypt YE2 | ISRG Root YE |
| Root (cross-signed) | ISRG Root YE | ISRG Root X2, for devices that don't yet trust Root YE |

The browser checks each signature upwards until it reaches a root in its store. Then it checks the leaf: the name in the address bar is in the SAN, today is within the validity dates, and the certificate isn't revoked.

A **self-signed** certificate signs itself, so the chain stops at something no device trusts: you get a full-page warning. That's fine for a test machine, never for users. A frequent real-world mistake is a server that sends only its leaf, without the intermediate. Desktop browsers often fill the gap themselves; phones and `curl` fail. Caddy always sends the full chain.

### How a CA decides you own the name

| Type | What the CA checks | Use |
| --- | --- | --- |
| DV (domain validated) | That you control the domain, by an automated challenge | Almost all sites; everything from Let's Encrypt |
| OV (organisation validated) | Plus that the organisation exists | Some companies' policy |
| EV (extended validation) | Plus more paperwork | Browsers no longer show it differently, so it adds little |

The encryption is identical in all three; only the paperwork differs. Chapter 10 covers how DV checks work.

### Watching the CAs: transparency and CAA

A CA that issues a certificate for your domain to someone else is the nightmare scenario. Two safeguards exist:

- **Certificate Transparency (CT):** every publicly trusted certificate must be logged in public, append-only logs, and browsers reject certificates that aren't. Anyone can search them; try `crt.sh` with `level-up.com.de` to see every certificate ever issued for your name, including the two Caddy got.
- **CAA records:** a DNS record such as `0 issue "letsencrypt.org"` tells every other CA it must refuse to issue for your domain.

### Expiry, renewal and revocation

Certificates expire on purpose: if a private key leaks, a short lifetime limits the damage. Lifetimes are shrinking fast:

- The industry rules (CA/Browser Forum ballot SC-081) cut the maximum from 398 days, in steps from March 2026, to **47 days from 15 March 2029**.
- Let's Encrypt issues **90-day** certificates by default today. Its classic profile moves to **64 days on 10 February 2027** and **45 days on 16 February 2028**. A 6-day option already exists.

The lesson isn't the numbers; it's that renewal must be automatic. Caddy renews on its own, about a month before expiry, and Let's Encrypt's renewal info (ARI) can tell clients the best time.

**Revocation** cancels a certificate before it expires, for example after a key leak. Checking revocation has always been unreliable in browsers, which is another reason the industry prefers short lifetimes: an unrenewed certificate dies soon anyway.

### Self-check

1. The address bar says `level-up.com.de` but the certificate's SAN lists only `dev.level-up.com.de`. What happens?
2. Why do CAs sign with intermediates rather than roots?
3. Where can you see every certificate ever issued for your domain?
4. Why are certificate lifetimes getting shorter?

### Answers

1. The browser shows a name-mismatch error: the SAN must contain the exact name (or a matching wildcard).
2. So the root's private key can stay offline. If an intermediate is compromised, it can be replaced without changing every device's root store.
3. In the Certificate Transparency logs, for example through crt.sh.
4. A leaked or wrongly issued certificate is dangerous only until it expires, and revocation checks are unreliable; automation makes short lifetimes painless.

## 10. Let's Encrypt and ACME

Let's Encrypt is a free, automated certificate authority, and ACME (RFC 8555) is the protocol a program uses to ask it for a certificate: prove you control the domain with a challenge, receive the certificate, and repeat before it expires. Caddy has an ACME client built in, which is why the droplet's certificates appeared within seconds of reloading it.

### The ACME flow

1. **Account:** the client creates an account key pair and registers it with the CA once.
2. **Order:** it asks for a certificate for a list of names, such as `dev.level-up.com.de`.
3. **Challenge:** for each name the CA hands back a token and a choice of challenge types.
4. **Proof:** the client publishes the proof (a file, a DNS record or a special TLS answer) and tells the CA it's ready.
5. **Validation:** the CA checks the proof from several places on the internet at once, so an attacker who controls one network path can't fake it.
6. **Issue:** the client sends a **CSR** (certificate signing request) containing its new public key; the CA signs and returns the certificate.

The droplet's Caddy log showed exactly this on 18 November 2026: "served key authentication" to Let's Encrypt validators connecting from many different IP addresses, then "authorization finalized", "validations succeeded" and "certificate obtained successfully" for both names, about five seconds in total.

### The three challenge types

| Challenge | How the proof is shown | Port | Wildcards | Best when |
| --- | --- | --- | --- | --- |
| HTTP-01 | A file at `http://<domain>/.well-known/acme-challenge/<token>` | 80 only | No | One server with port 80 open: the usual case, and what Caddy used |
| DNS-01 | A TXT record at `_acme-challenge.<domain>` | none (DNS) | Yes | Wildcards, servers not reachable from the internet, many servers |
| TLS-ALPN-01 | A special certificate answered on a custom ALPN protocol (RFC 8737) | 443 | No | Port 80 blocked; mostly large hosting providers |

The trade-offs from Let's Encrypt's own documentation:

- **HTTP-01** is the easiest to automate, but fails if port 80 is blocked, and every server behind a load balancer must be able to answer.
- **DNS-01** is the only way to get a wildcard (`*.level-up.com.de`). The catch is security: the server needs an API token that can edit your DNS, so if the server is compromised, so is your DNS. Use a token limited to one zone and to DNS edits only.

That's why port 80 must stay open even though the site is HTTPS-only: Let's Encrypt validates over it, and Caddy redirects everything else to HTTPS.

### Renewal

A certificate nobody renews is an outage scheduled in advance. ACME clients renew automatically:

- Caddy renews when about a third of the lifetime is left (roughly 30 days before expiry for a 90-day certificate) and retries with backoff if it fails.
- **ARI** (ACME Renewal Information) lets the CA suggest a renewal window, for example to replace certificates early after an incident. The log line "got renewal info" is Caddy asking for it. Let's Encrypt exempts ARI renewals from all rate limits.
- Let's Encrypt says a fixed "renew every 60 days" schedule won't be enough once certificates last 45 days, so hard-coded cron jobs need revisiting.

### Rate limits and staging

Let's Encrypt limits how fast you can ask, to protect its service. The main limits (checked November 2026):

| Limit | Value |
| --- | --- |
| Certificates per registered domain | 50 per 7 days |
| Duplicate certificates (exact same set of names) | 5 per 7 days |
| Failed validations | 5 per name, per account, per hour |
| New orders | 300 per account per 3 hours |

The one people hit is **failed validations**: a typo in DNS or a closed port, retried in a loop, locks you out for an hour. When experimenting, use the **staging** environment, which has much higher limits and issues untrusted test certificates. In Caddy that's one line: `acme_ca https://acme-staging-v02.api.letsencrypt.org/directory`.

The "registered domain" is `level-up.com.de`, so every subdomain you add shares that budget of 50 a week. (It counts as its own registered domain only because \`com.de\` is on the Public Suffix List; otherwise every \`com.de\` customer would share one budget.) That's plenty for one person's apps.

### Self-check

1. Which challenge type is required for `*.level-up.com.de`, and why?
2. Why must port 80 stay open on a site that only serves HTTPS?
3. Your DNS record has a typo and your client retries every minute. Which limit will you hit?
4. What does Let's Encrypt check from several places at once, and why?

### Answers

1. DNS-01: it's the only challenge Let's Encrypt accepts for wildcard names.
2. The HTTP-01 challenge is fetched on port 80. Caddy answers it there and redirects all other port-80 traffic to HTTPS.
3. Failed validations: 5 per name per account per hour.
4. The challenge proof. Checking from many network locations stops an attacker who controls one route from passing the check.

## 11. Reverse proxies and HTTPS in practice

A reverse proxy is a server that sits in front of your apps: it accepts every connection on ports 80 and 443, handles TLS, and forwards each request to the right app on a private port. This keeps certificates, redirects and security headers in one place, so the apps themselves stay plain HTTP and never face the internet directly.

### TLS termination

**Terminating** TLS means decrypting it. Caddy terminates TLS for the droplet: phones talk HTTPS to Caddy, and Caddy talks plain HTTP to LevelUp over loopback.

| Hop | Protocol | Why it's fine |
| --- | --- | --- |
| Phone to Caddy (internet) | HTTPS, TLS 1.3 | The untrusted part is encrypted |
| Caddy to app (`127.0.0.1:8000`) | Plain HTTP | Never leaves the machine |

Because the app no longer sees the original connection, the proxy passes the facts along in headers: `X-Forwarded-For` (the visitor's IP), `X-Forwarded-Proto` (`https`) and `Host`. Caddy's `reverse_proxy` sets these automatically. An app that builds absolute links or logs visitor IPs should read them, and only trust them from its own proxy.

### Caddy and nginx

|  | Caddy | nginx |
| --- | --- | --- |
| Certificates | Automatic (built-in ACME), renewed on its own | A separate tool (certbot) plus a renewal timer |
| Config for one site | About 3 lines | About 15 to 25 lines |
| Defaults | HTTPS, HTTP/2 and HTTP/3, HTTP-to-HTTPS redirect, modern TLS | You set them |
| Strengths | Simplicity for a few sites | Raw performance, fine control, the biggest ecosystem |

The droplet's whole site definition:

```
dev.level-up.com.de {
	import common
	reverse_proxy 127.0.0.1:8000
}
```

Naming the site is what turns HTTPS on: Caddy sees a public domain name, gets a certificate for it and sets up the redirect. Adding an app means one more block like this and one DNS record.

### Redirects and HSTS

Every visitor should end up on HTTPS, even one who types `http://` or follows an old link. Two layers do that:

1. **The redirect:** any request on port 80 gets a `308` to the same URL with `https://`. Caddy does this by itself.
2. **HSTS** (HTTP Strict Transport Security): the header `Strict-Transport-Security: max-age=31536000` tells the browser "for the next year, never use plain HTTP for this site." From then on the browser upgrades `http://` links itself, before sending anything, and refuses to let users click through certificate warnings.

HSTS closes the gap the redirect leaves: the very first plain-HTTP request could be intercepted and the redirect stripped. Take care before adding `includeSubDomains` or submitting to the browser **preload** list. Both are hard to undo, and they break any subdomain that isn't on HTTPS yet.

### Security headers

The droplet's shared `(common)` block adds these to every app:

| Header | Value | Effect |
| --- | --- | --- |
| Strict-Transport-Security | `max-age=31536000` | HTTPS only, for a year |
| X-Content-Type-Options | `nosniff` | The browser trusts the declared `Content-Type` instead of guessing; stops some script-injection tricks |
| Referrer-Policy | `strict-origin-when-cross-origin` | Other sites see only your domain, not full URLs, when users follow links out |
| (removed) Server |  | Doesn't advertise the server software |

The next step up is a **Content-Security-Policy**, which lists exactly where scripts, styles and images may come from. It's the strongest defence against injected scripts, but needs testing per app, so add it deliberately.

### Mixed content and the last mile

Once a page is HTTPS, everything it loads must be HTTPS too. A script loaded over `http://` (**mixed content**) is blocked by browsers, because it would let a network attacker rewrite the secure page. Use relative URLs (`js/app.js`) or `https://` everywhere.

The last mile is closing the side door. While ports 8000 to 8100 are open in the firewall and the app listens on `0.0.0.0`, anyone can reach `http://168.144.78.71:8000` directly: unencrypted, without HSTS, without the headers. The clean setup:

- Apps listen on `127.0.0.1` only.
- The firewall allows 22, 80 and 443, nothing else.
- Every app is reached through its HTTPS name.

### Self-check

1. Caddy talks plain HTTP to LevelUp. Why is that acceptable?
2. What does HSTS protect against that a redirect alone doesn't?
3. An HTTPS page loads `http://example.com/chart.js`. What happens?
4. What two changes stop people from bypassing Caddy on port 8000?

### Answers

1. The hop is over loopback inside the droplet, so it never crosses a network anyone else can see.
2. The first plain-HTTP request being intercepted before the redirect happens. After one visit, the browser goes straight to HTTPS.
3. The browser blocks it as mixed content, so whatever depended on the script breaks.
4. Bind the app to `127.0.0.1`, and close ports 8000 to 8100 in the firewall.

## 12. CDNs and Cloudflare

When a Cloudflare DNS record is **proxied** (the orange cloud), visitors don't connect to your server at all: they connect to Cloudflare, which terminates TLS, can cache and filter, and opens its own connection to your server, the **origin**. Two TLS connections now exist, and the SSL/TLS mode decides how well the second one is protected.

### Proxied or DNS only

|  | DNS only (grey cloud) | Proxied (orange cloud) |
| --- | --- | --- |
| `dig` returns | Your server's IP (`168.144.78.71`) | Cloudflare's IPs (`104.21.42.184`, `172.67.207.126`) |
| Who visitors connect to | Your server | The nearest Cloudflare data centre |
| TLS certificate visitors see | Yours (Caddy's Let's Encrypt) | Cloudflare's edge certificate |
| Your server's IP | Public | Hidden from DNS (but see origin protection below) |
| Caching, DDoS protection, firewall rules | No | Yes |
| Non-web ports (SSH, databases) | Work | Not proxied; only HTTP(S) on certain ports |

In this setup, `dev` is DNS only, so it talks to Caddy directly, and `level-up.com.de` is proxied. Both work; the difference is who sits in the middle.

### The two halves of a proxied request

1. **Visitor to Cloudflare:** HTTPS with Cloudflare's certificate for `level-up.com.de`. Cloudflare decrypts the request, so it can read it: that's what lets it cache and filter. You are trusting Cloudflare with your traffic.
2. **Cloudflare to origin:** a new connection to the droplet. Whether it's encrypted, and whether Cloudflare checks the droplet's certificate, is the **SSL/TLS encryption mode**.

### SSL/TLS modes

From Cloudflare's documentation:

| Mode | Visitor to Cloudflare | Cloudflare to origin | Origin certificate checked |
| --- | --- | --- | --- |
| Off | HTTP only | HTTP | No |
| Flexible | HTTPS possible | Always HTTP | No |
| Full | Matches the visitor | Matches the visitor (HTTPS if the visitor used HTTPS) | No: any certificate, even self-signed or expired |
| Full (strict) | Matches the visitor | Matches the visitor | Yes: must be from a public CA or Cloudflare's Origin CA |
| Strict (SSL-only origin pull) | HTTP or HTTPS | Always HTTPS | Yes |

**Use Full (strict)** whenever the origin has a real certificate, which Caddy provides for free. It's what this domain now uses.

**Flexible is the trap.** The visitor sees a padlock, but the Cloudflare-to-origin leg is plain HTTP across the internet. It also causes the classic **redirect loop** (a well-known failure, not from the page above): Cloudflare asks the origin over HTTP, the origin (Caddy) redirects to HTTPS, the browser asks Cloudflare again over HTTPS, Cloudflare asks the origin over HTTP again, and so on until the browser gives up with "too many redirects". Full or Full (strict) fixes it, because Cloudflare then asks the origin over HTTPS.

Cloudflare's default, **Automatic**, scans your origin and picks the most secure mode it supports, and never downgrades on its own.

### Certificates and Let's Encrypt behind the proxy

Caddy still needs its own certificate for Full (strict). For a proxied name, Let's Encrypt's HTTP-01 check arrives through Cloudflare on port 80, and Cloudflare passes it on. That's why `level-up.com.de` got a certificate even while proxied: the validators' requests reached Caddy from Cloudflare addresses. Alternatives if that ever fails: briefly switch to DNS only while the certificate is issued, use DNS-01 with a Cloudflare API token, or install a **Cloudflare Origin CA** certificate (trusted only by Cloudflare, valid for many years, and only usable behind the proxy).

### Protecting the origin

Hiding the IP in DNS is weak protection: old DNS records, certificate logs and scans can reveal it, and then attackers bypass Cloudflare entirely. To make the proxy the only way in:

- **Firewall:** allow ports 80 and 443 only from Cloudflare's published IP ranges. This only works if every name on the server is proxied; `dev` currently isn't.
- **Authenticated origin pulls:** Cloudflare presents a client certificate, and the origin refuses connections without it.
- **Cloudflare Tunnel:** a small program on the server dials out to Cloudflare, so no inbound port needs to be open at all.

### Self-check

1. With Flexible mode, which part of the journey is unencrypted?
2. Why does Flexible plus an origin that redirects to HTTPS cause a loop?
3. What does Full (strict) check that Full doesn't?
4. Why isn't a hidden origin IP enough protection?

### Answers

1. Cloudflare to the origin: it's always plain HTTP.
2. Cloudflare always asks over HTTP, the origin always answers "go to HTTPS", and the browser's next HTTPS request goes back to Cloudflare, which asks over HTTP again.
3. That the origin's certificate is valid: trusted, unexpired and issued for that name.
4. The IP can leak through history, certificate logs or scans, and then attackers connect directly. The origin has to refuse non-Cloudflare traffic itself.

## 13. Your domain, end to end

This lab puts an app on its own HTTPS name in about 30 minutes, following exactly what was done for `dev.level-up.com.de` on 18 and 19 November 2026. You need a server with a public IP, a domain, and an app listening on a local port. Running costs for this setup: the droplet (about 6 USD a month for the smallest size) and the domain's yearly fee; certificates are free.

### Step 1: The server side

Start with the app working locally on the server:

```
curl -s localhost:8000/api/health    # the app answers on the server itself
sudo ss -tlnp | grep 8000            # which address it listens on
```

Then open the firewall for the proxy, keeping SSH open so you don't lock yourself out:

```
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

### Step 2: DNS

At your DNS host, add an A record for the name, pointing at the server. Start with **DNS only** so the certificate step talks to your server directly.

| Type | Name | Value | Proxy |
| --- | --- | --- | --- |
| A | `dev` | `168.144.78.71` | DNS only |

Check it from outside, against the authoritative servers and a public resolver:

```
dig +short dev.level-up.com.de @1.1.1.1
dig +short NS level-up.com.de
```

Don't continue until the first command prints your server's IP. A certificate request before DNS is ready fails and counts against the failed-validation limit (chapter 10).

### Step 3: Caddy and the certificate

Install Caddy from its official repository (Ubuntu's own package was years behind: 2.6.2 against 2.11.9), then write `/etc/caddy/Caddyfile`:

```
dev.level-up.com.de {
	reverse_proxy 127.0.0.1:8000
}
```

Validate, then reload, then watch:

```
caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
journalctl -u caddy -f
```

In the log you should see, within seconds: `served key authentication` (Let's Encrypt fetching the HTTP-01 proof, from several addresses), `validations succeeded` and `certificate obtained successfully`.

### Step 4: Verify from outside

From your own computer, not the server:

| Check | Command | Expect |
| --- | --- | --- |
| HTTPS works | `curl -sI https://dev.level-up.com.de` | `HTTP/2 200` |
| HTTP redirects | `curl -sI http://dev.level-up.com.de` | `308` and `Location: https://...` |
| Certificate | `openssl s_client -connect dev.level-up.com.de:443 -servername dev.level-up.com.de` | Issuer Let's Encrypt, TLS 1.3, `Verify return code: 0 (ok)` |
| Headers | `curl -sI https://dev.level-up.com.de` | `strict-transport-security`, `x-content-type-options` |

Then open the address on a phone. With HTTPS working, browser features that need a secure context start working: service workers, "Add to Home Screen" installs, and microphone access.

### Step 5: Harden and make it repeatable

- **Close the side door:** bind the app to `127.0.0.1` and remove the app ports from the firewall (`sudo ufw delete allow 8000:8100/tcp`). Test HTTPS again afterwards.
- **Cloudflare proxy (optional):** switch the record to proxied and set SSL/TLS to **Full (strict)** (chapter 12).
- **Keep the config in git:** the Caddyfile lives in the repo as `deploy/Caddyfile`, and the deploy command installs it when it changes, after `caddy validate`.
- **Rebuild from scratch:** `deploy/cloud-init.yaml` installs Caddy and opens 80 and 443 on a fresh droplet, so a new server is one paste away.
- **Auto-renew the domain** at the registrar.

### Adding the next app

1. Run the app on a free local port, such as 8101.
2. Add a DNS record: `A app2 168.144.78.71`.
3. Add a Caddyfile block: `app2.level-up.com.de { import common` then `reverse_proxy 127.0.0.1:8101 }`.
4. Deploy and reload; Caddy fetches the new certificate itself.

### Self-check

1. Why check DNS from outside before reloading Caddy?
2. Which log line confirms Let's Encrypt reached your server?
3. After step 5, what happens to `http://168.144.78.71:8000`?
4. What are the two things you add for each new app?

### Answers

1. Let's Encrypt resolves the name from the internet. If DNS isn't ready, validation fails and uses up the failed-validation limit.
2. `served key authentication`, followed by `validations succeeded`.
3. It stops answering: the firewall drops the packets (a timeout), and the app only listens on loopback anyway.
4. A DNS record and a Caddyfile block.

## 14. The debugging toolkit

When a site doesn't load, debug it one layer at a time, from the bottom: does the name resolve, does the machine answer, is the port open, does TLS succeed, does HTTP return the right thing. Five command-line tools cover almost every case, and the error message usually names the layer that failed.

### Work up the layers

| Question | Tool | Good answer |
| --- | --- | --- |
| Does the name resolve, to the right IP? | `dig +short name` | The expected IP |
| Is the machine reachable at all? | `ping`, `traceroute` | Replies (many servers block ping, so silence alone proves little) |
| Is the port open and listening? | `nc -vz name 443`, on the server `ss -tlnp` | "succeeded", or the program listed on the port |
| Does TLS work and is the certificate right? | `openssl s_client` | `Verify return code: 0 (ok)` |
| Does HTTP return what you expect? | `curl -v` | The right status and headers |

Stop at the first layer that fails; everything above it will fail too.

### dig: DNS

```
dig +short dev.level-up.com.de            # A record, via your resolver
dig +short dev.level-up.com.de @1.1.1.1   # via a public resolver
dig dev.level-up.com.de +noall +answer    # with the TTL left in cache
dig +trace dev.level-up.com.de            # the whole delegation chain
dig CAA level-up.com.de                   # which CAs may issue
```

Different answers from different resolvers mean a cache hasn't expired yet. `NXDOMAIN` means the name doesn't exist; `SERVFAIL` usually means a broken delegation or DNSSEC problem.

### curl: HTTP and more

`curl -v` prints the whole conversation: the IP it connected to, the TLS version, the certificate's subject and issuer, every request and response header.

```
curl -v https://dev.level-up.com.de/api/health
curl -sI http://dev.level-up.com.de            # headers only: see the 308
curl -sL -o /dev/null -w '%{http_code} %{url_effective}\n' https://level-up.com.de
```

The most useful trick is `--resolve`, which skips DNS and connects a name to an address you choose. It tests a server before DNS points at it, or tests the origin behind Cloudflare directly:

```
curl -v --resolve dev.level-up.com.de:443:168.144.78.71 https://dev.level-up.com.de/
```

### openssl s\_client: TLS and certificates

```
openssl s_client -connect dev.level-up.com.de:443 -servername dev.level-up.com.de </dev/null
```

Read three things in the output: the certificate chain (`s:` subject and `i:` issuer for each level), the `Protocol` and `Cipher`, and the final `Verify return code`. Always pass `-servername`, or the server can't use SNI and may hand back the wrong certificate. To see just the dates and names:

```
openssl s_client -connect dev.level-up.com.de:443 -servername dev.level-up.com.de </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
```

### On the server

| Command | Shows |
| --- | --- |
| `ss -tlnp` | Listening TCP ports, their address (`127.0.0.1` or `0.0.0.0`) and program |
| `sudo ufw status verbose` | Firewall rules |
| `systemctl status caddy` | Whether Caddy runs; the last log lines |
| `journalctl -u caddy -f` | Live Caddy log: certificates, proxy errors |
| `journalctl -u levelup -f` | Live app log |
| `curl -s localhost:8000/api/health` | The app, bypassing Caddy and DNS |

### Errors and what they mean

| Error | Layer | Usual cause |
| --- | --- | --- |
| Could not resolve host / NXDOMAIN | DNS | No record, typo, or a cached "not found" |
| Connection timed out | Network or firewall | Firewall dropping packets; wrong IP; server down |
| Connection refused | Transport | Nothing listening on that port |
| Certificate name mismatch | TLS | The certificate doesn't list this name (missing SNI, wrong site block) |
| Certificate has expired | TLS | Renewal failed; check the ACME client's log |
| Unable to get local issuer certificate | TLS | Missing intermediate in the chain, or a self-signed certificate |
| Too many redirects | HTTP | Cloudflare Flexible mode plus an origin that forces HTTPS |
| 502 Bad Gateway | Proxy | The app behind the proxy is down or on another port |
| 504 Gateway Timeout | Proxy | The app is too slow to answer |

### Self-check

1. `curl` says "Could not resolve host". Which tool do you reach for next?
2. How do you test the droplet directly while `level-up.com.de` is proxied by Cloudflare?
3. `openssl s_client` without `-servername` shows the wrong certificate. Why?
4. The site shows 502, but `curl localhost:8000` on the server works. Where do you look?

### Answers

1. `dig`, to see whether the name exists and what each resolver returns.
2. `curl --resolve level-up.com.de:443:168.144.78.71 https://level-up.com.de/`, which connects to the droplet's IP while sending the right name.
3. Without SNI, the server doesn't know which site you want and presents a default certificate.
4. The proxy's configuration and log (`journalctl -u caddy`): it's probably forwarding to the wrong address or port.

## 15. Capstone review

This chapter traces one request, opening `https://dev.level-up.com.de` on a phone, through every layer in the guide, then tests you with a practice quiz. If you can tell this story without notes, you understand how the web works.

### One request, end to end

1. **The URL** (ch. 5): scheme `https`, so port 443; host `dev.level-up.com.de`; path `/`. The `#/today` part stays in the browser.
2. **DNS** (ch. 3, 4): the phone asks its resolver. If nothing is cached, the resolver walks root, `de`, `com.de` (CentralNic) and finally Cloudflare's `hal.ns.cloudflare.com`, which answers `168.144.78.71`, cacheable for 300 seconds.
3. **Routing** (ch. 1): the phone's packet leaves through the home router, which rewrites its private address with NAT, and hops router to router towards DigitalOcean's network.
4. **TCP** (ch. 2): SYN, SYN-ACK, ACK to port 443. The droplet's firewall allows 443; Caddy is listening.
5. **TLS** (ch. 7, 8): ClientHello with SNI `dev.level-up.com.de`, ALPN `h2`, an X25519 key share. ServerHello with Caddy's share; from here everything is encrypted. Caddy sends the chain and a CertificateVerify signature made with its ECDSA P-256 key.
6. **Trust** (ch. 9, 10): the phone checks the chain up to ISRG's root, confirms the name is in the SAN and that today falls between 18 November 2026 and 16 February 2027, all of which Let's Encrypt granted after an HTTP-01 check on port 80.
7. **HTTP/2** (ch. 5, 6): `GET /` with `Host: dev.level-up.com.de`, on stream 1. Further requests for scripts share the same connection.
8. **The reverse proxy** (ch. 11): Caddy matches the host, forwards the request over plain HTTP to `127.0.0.1:8000`, gets LevelUp's HTML, compresses it, adds HSTS and the other headers, and sends it back encrypted.
9. **The browser** (ch. 6): reads the HTML, loads the rest, and registers the service worker, which is allowed because the page is HTTPS. Next time, much of the app loads from the phone itself.

If the phone had opened `https://level-up.com.de` instead, step 2 would return Cloudflare's addresses, step 5 would happen with Cloudflare's certificate, and Cloudflare would open a second TLS connection to Caddy, verified because the mode is Full (strict) (ch. 12). Caddy would then answer with a redirect to `dev`.

### Practice quiz

1. A request reaches the droplet, but the phone shows "connection refused". Which layer failed, and what's the likely cause?
2. You changed an A record an hour ago. Your laptop sees the new IP, your phone the old one. Explain.
3. Why can a network observer see that you visited `dev.level-up.com.de` but not that you saved progress for Batul?
4. Name the four cryptographic tools in a TLS 1.3 connection and the job of each.
5. Your certificate expired. Name two places to look for the cause.
6. You want `*.level-up.com.de` on one certificate. What must change?
7. Cloudflare says "too many redirects". What's the setting, and what's the fix?
8. Port 8000 is still open in the firewall. What does that allow, and why does it matter?

### Answers

1. Transport: the packet arrived, but nothing was listening on that port. Wrong port, or the program isn't running.
2. Caching: the phone's resolver cached the old answer and keeps it until its TTL runs out.
3. The name travels in DNS and in the TLS SNI, both visible (unless DoH and ECH are used); the path `/api/state/batul` and the body are inside the encrypted HTTP.
4. ECDHE (X25519) agrees the session secret; a signature (ECDSA) proves the server holds its key; CA signatures prove the certificate is genuine; AEAD encryption (AES-GCM or ChaCha20-Poly1305) protects the data. Hashes (SHA-256) run inside all of them.
5. The ACME client's log (`journalctl -u caddy`), and whatever its challenge needs: port 80 open and DNS pointing at the server for HTTP-01.
6. Use the DNS-01 challenge, which means giving Caddy a scoped Cloudflare API token and a DNS plugin; HTTP-01 can't issue wildcards.
7. The Flexible SSL mode with an origin that redirects to HTTPS. Switch to Full (strict).
8. Plain HTTP straight to the app, skipping Caddy: no encryption, no HSTS, no security headers. Close it and bind the app to `127.0.0.1`.

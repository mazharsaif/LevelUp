// State per user (saved on the Mac via server.py, cached in the browser), spaced repetition, A1 progress / pace maths.
import { setLang } from "./lang.js";
import { mergeStates } from "./merge.js";
export const C = { content: null, course: null, word: {}, item: {}, grammar: {}, phrases: {} };

// ---------- courses (German A1 now; more languages / subjects later) ----------
export let COURSES = [];
export const DEFAULT_COURSE = "de-a1";
export let COURSE = DEFAULT_COURSE;
export async function loadCourses() {
  try { COURSES = (await (await fetch("data/courses.json", { cache: "no-store" })).json()).courses; }
  catch { COURSES = [{ id: DEFAULT_COURSE, title: "German A1", icon: "🇩🇪", status: "ready", content: "data/content.json" }]; }
  return COURSES;
}
export const courseInfo = id => COURSES.find(c => c.id === id) || COURSES[0];
const cq = () => (COURSE === DEFAULT_COURSE ? "" : `?c=${encodeURIComponent(COURSE)}`);

export async function loadContent(courseId = COURSE) {
  const info = courseInfo(courseId);
  if (C.content && C.course && C.course.id === info.id) return C.content;
  const r = await fetch(info.content || "data/content.json");
  const c = await r.json();
  C.content = c; C.course = info; COURSE = info.id;
  setLang(c.lang || info.lang || "de"); // target-language profile (field `de` holds the target language in every file)
  C.word = {}; C.item = {}; C.grammar = {}; C.phrases = {};
  _w = null; _plan = null; _planKey = "";
  (c.words || []).forEach(w => (C.word[w.id] = w));
  (c.grammar || []).forEach(g => (C.grammar[g.id] = g));
  C.gparts = {};
  if (c.grammar && c.path && !c._expanded) { c.path = spreadPath(expandGrammar(c.path)); c._expanded = true; }
  (c.path || []).forEach(p => { if (p.gid) (C.gparts[p.gid] = C.gparts[p.gid] || []).push(p.id); });
  numberTopics(c.path || []);
  (c.path || []).forEach(p => (C.item[p.id] = p));
  (c.phrases || []).forEach(p => (C.phrases[p.id] = p));
  return c;
}

// ---------- grammar parts: long chapters are cut into short reads (at headings; big tables by rows) ----------
const PART_MAX = 700, PART_MIN = 250, SPLIT_FROM = 900, TABLE_ROWS = 8; // sizes in characters of visible text
const tlen = n => (n.textContent || "").replace(/\s+/g, " ").trim().length;
function tableChunks(t) {
  const rows = [...t.querySelectorAll(":scope > tbody > tr, :scope > tr")];
  if (rows.length <= TABLE_ROWS + 2) return [t];
  const k = Math.ceil(rows.length / TABLE_ROWS), per = Math.ceil(rows.length / k), out = [];
  for (let i = 0; i < rows.length; i += per) {
    const c = t.cloneNode(false);
    t.querySelectorAll(":scope > colgroup, :scope > thead").forEach(x => c.appendChild(x.cloneNode(true)));
    const tb = t.ownerDocument.createElement("tbody");
    rows.slice(i, i + per).forEach(r => tb.appendChild(r.cloneNode(true)));
    c.appendChild(tb); out.push(c);
  }
  return out;
}
export function splitGrammar(g) {
  if (g.parts) return g.parts;
  const doc = new DOMParser().parseFromString(`<div>${g.body}${g.after || ""}</div>`, "text/html"), root = doc.body.firstElementChild;
  const whole = [{ t: g.title, html: root.innerHTML, q: g.q.map((_, i) => i) }];
  if (tlen(root) < SPLIT_FROM) return (g.parts = whole);
  // units: [{sec title, html, len}] – a heading sticks to the block after it
  const units = []; let sec = g.title, head = "";
  for (const n of [...root.childNodes]) {
    if (n.nodeType !== 1) { if ((n.textContent || "").trim()) units.push({ s: sec, html: n.textContent, len: tlen(n) }); continue; }
    if (/^H[2-5]$/.test(n.tagName)) { sec = n.textContent.trim(); head = n.outerHTML; continue; }
    const pieces = n.tagName === "TABLE" ? tableChunks(n) : [n];
    pieces.forEach((p, i) => { units.push({ s: sec, html: (i === 0 ? head : "") + p.outerHTML, len: tlen(p) + (i === 0 && head ? sec.length : 0) }); });
    head = "";
  }
  const parts = [];
  for (const u of units) {
    const cur = parts.at(-1);
    if (cur && (cur.len + u.len <= PART_MAX || cur.len < PART_MIN)) { cur.html += u.html; cur.len += u.len; cur.secs.add(u.s); }
    else parts.push({ html: u.html, len: u.len, secs: new Set([u.s]), s: u.s });
  }
  if (parts.length < 2) return (g.parts = whole);
  // titles: section name, numbered when one section runs over several parts
  const per = {}; parts.forEach(p => (per[p.s] = (per[p.s] || 0) + 1));
  const seen = {}; parts.forEach(p => { p.t = per[p.s] > 1 ? `${p.s} (${(seen[p.s] = (seen[p.s] || 0) + 1)}/${per[p.s]})` : p.s; });
  // questions go to the part whose text mentions their answer/options most (ties → later part)
  const texts = parts.map(p => { const d = doc.createElement("div"); d.innerHTML = p.html; return new Set(d.textContent.toLowerCase().split(/[^\p{L}]+/u)); });
  const qs = parts.map(() => []);
  g.q.forEach((q, i) => {
    const words = [q.a, ...(q.opts || [])].join(" ").toLowerCase().split(/[^\p{L}]+/u).filter(w => w.length >= 2);
    let best = Math.min(parts.length - 1, Math.floor((i * parts.length) / g.q.length)), bs = 0;
    texts.forEach((t, k) => { const s = words.reduce((a, w) => a + (t.has(w) ? 1 : 0), 0); if (s > 0 && s >= bs) { bs = s; best = k; } });
    qs[best].push(i);
  });
  return (g.parts = parts.map((p, k) => ({ t: p.t, html: p.html, q: qs[k] })));
}
// one path item per grammar part (single-part chapters keep their id, so old progress stays valid)
function expandGrammar(path) {
  const out = [];
  for (const it of path) {
    if (it.kind !== "grammar" || !C.grammar[it.id]) { out.push(it); continue; }
    const g = C.grammar[it.id], P = splitGrammar(g);
    if (P.length < 2) { out.push(it); continue; }
    P.forEach((p, k) => out.push({ ...it, id: `${it.id}.${k + 1}`, gid: it.id, part: k, of: P.length, title: `Ch ${g.num}.${k + 1}: ${p.t}` }));
  }
  return out;
}
export const grammarOf = it => C.grammar[it.gid || it.id];
export const gPart = it => { const g = grammarOf(it); return it.gid ? g.parts[it.part] : null; };
// Spread the path so the same topic doesn't come back-to-back: an item waits until none of the last
// GAP items share its topic (grammar parts of one chapter wait GAP_G). Looks ahead at most LOOK items,
// so the original teaching order is kept roughly.
const GAP = 2, GAP_G = 3, LOOK = 8;
const topicsOf = it => it.kind === "vocab" ? it.title.split(" · ").map(t => "v:" + t) : it.kind === "grammar" ? ["g:" + (it.gid || it.id)] : ["p:" + it.id];
function spreadPath(path) {
  const left = [...path], out = [];
  const clash = it => {
    const T = topicsOf(it), gap = it.kind === "grammar" ? ((C.grammar[it.gid || it.id] || {}).gap || GAP_G) : GAP; // a chapter can ask for more room (Ch 1 pronunciation)
    return out.slice(-gap).some(o => topicsOf(o).some(t => T.includes(t)));
  };
  while (left.length) {
    let k = left.slice(0, LOOK).findIndex(it => !clash(it));
    if (k < 0) k = 0;
    out.push(left.splice(k, 1)[0]);
  }
  let n = 0; out.forEach(it => { if (it.kind === "vocab") it.n = ++n; });
  return out;
}

// "A: Zahlen" over 4 lessons → "A: Zahlen I", "A: Zahlen II" … (only for topics that span several lessons)
const ROMAN = n => [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]].reduce((a, [v, r]) => { while (n >= v) { a += r; n -= v; } return a; }, "");
function numberTopics(path) {
  const vocab = path.filter(i => i.kind === "vocab");
  const total = {}, seen = {};
  vocab.forEach(i => i.title.split(" · ").forEach(t => (total[t] = (total[t] || 0) + 1)));
  vocab.forEach(i => {
    i.title = i.title.split(" · ").map(t => total[t] > 1 ? `${t} ${ROMAN((seen[t] = (seen[t] || 0) + 1))}` : t).join(" · ");
  });
}

// ---------- dates (local, YYYY-MM-DD) ----------
export const iso = d => {
  const z = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};
export const today = () => iso(new Date());
export const parse = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
export const fmtDate = (s, opts = { day: "numeric", month: "short" }) => parse(s).toLocaleDateString("en-GB", opts);

// ---------- local cache helpers ----------
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* storage blocked */ } },
};
const cacheKey = u => COURSE === DEFAULT_COURSE ? `a1.state.${u}` : `a1.state.${u}@${COURSE}`;
export const lastCourse = u => ls.get(`a1.course.${u}`);
// Has this learner started course cid? (course picker: "Continue" for every started course, not only the open one)
const startedState = st => !!st && !!(st.setup || Object.keys(st.done || {}).length || Object.keys(st.tree || {}).length || Object.keys(st.tracks || {}).length || (st.log || []).length);
export function startedLocal(u, cid) {
  try { return startedState(JSON.parse(ls.get(cid === DEFAULT_COURSE ? `a1.state.${u}` : `a1.state.${u}@${cid}`) || "null")); } catch { return false; }
}
export async function startedRemote(u, cid) {
  if (!u || isGuest()) return false;
  try {
    const r = await fetch(`api/state/${u}` + (cid === DEFAULT_COURSE ? "" : `?c=${encodeURIComponent(cid)}`), { cache: "no-store" });
    return r.ok && startedState((await r.json()).state);
  } catch { return false; }
}
export function setCourse(id) { COURSE = id; if (USER) ls.set(`a1.course.${USER}`, id); }
const LEGACY = "a1.state.v1";

// ---------- users ----------
export let USERS = [];
export let USER = null; // current user id
export let SYNC = { online: true, pending: false, last: null };
export const userInfo = id => USERS.find(u => u.id === id) || (id === GUEST ? { id, name: "Guest", color: "#868e96" } : { id, name: id, color: "#888" });

// ---------- guest mode ----------
// A guest tries the app without an account: progress lives only in this browser (localStorage, user id "guest"),
// nothing is sent to the server. Signing up copies the guest's progress into the new account.
export const GUEST = "guest";
export const isGuest = () => USER === GUEST;
export const hasGuestData = () => { try { return Object.keys(localStorage).some(k => k === `a1.state.${GUEST}` || k.startsWith(`a1.state.${GUEST}@`)); } catch { return false; } };
export function startGuest() { ls.set("a1.guest", "1"); ls.set("a1.user", GUEST); USER = GUEST; }
export function leaveGuest() { ls.del("a1.guest"); signOut(); } // progress stays on the phone: "Try as guest" resumes it
// after sign-up: move every guest course (and hero/course choice) to the new account; switchUser then uploads it
export function claimGuest(uid) {
  try {
    for (const k of Object.keys(localStorage)) {
      const m = k.match(/^a1\.(state|hero|course)\.guest(@.*)?$/);
      if (!m) continue;
      let v = localStorage.getItem(k);
      if (m[1] === "state") { const st = JSON.parse(v); st.updated = Date.now(); v = JSON.stringify(st); }
      localStorage.setItem(`a1.${m[1]}.${uid}${m[2] || ""}`, v);
      localStorage.removeItem(k);
    }
  } catch { /* storage blocked */ }
  ls.del("a1.guest");
}

export async function loadUsers() {
  try {
    const r = await fetch("api/users", { cache: "no-store" });
    if (r.status === 401) { USERS = []; USER = ls.get("a1.guest") && ls.get("a1.user") === GUEST ? GUEST : null; return USERS; } // nobody logged in (maybe a guest)
    if (!r.ok) throw new Error(r.status);
    USERS = await r.json();
    ls.set("a1.users", JSON.stringify(USERS));
  } catch {
    USERS = JSON.parse(ls.get("a1.users") || "null") || [{ id: "taha", name: "Taha", color: "#1c7cd6" }, { id: "batul", name: "Batul", color: "#ce4fa0" }];
    SYNC.online = false;
  }
  const u = ls.get("a1.user");
  USER = USERS.some(x => x.id === u) || (u === GUEST && ls.get("a1.guest")) ? u : null;
  return USERS;
}

// ---------- accounts ----------
// AUTH: "on" = the server has logins (FastAPI with auth.py); "off" = an older server without them
// (server.py, or the FastAPI server before a restart): the app then shows the old player picker.
export let AUTH = ls.get("a1.auth") || "on";
export async function checkAuth() {
  try {
    const r = await fetch("api/auth/me", { cache: "no-store" });
    if (r.ok) { const u = await r.json(); AUTH = "on"; ls.set("a1.user", u.id); }
    else if (r.status === 401) { AUTH = "on"; if (ls.get("a1.guest")) ls.set("a1.user", GUEST); else ls.del("a1.user"); }
    else AUTH = "off"; // 404: no accounts on this server
    ls.set("a1.auth", AUTH);
    return AUTH;
  } catch { return AUTH; } // offline: keep the last known user (cached in localStorage) so the app still works
}
const errText = async r => {
  try { const j = await r.json(); if (typeof j.error === "string") return j.error; if (Array.isArray(j.detail)) return j.detail.map(d => d.msg).join("; "); } catch { /* not JSON */ }
  return `Server error (${r.status})`;
};
async function authPost(path, body) {
  try {
    const r = await fetch("api/auth/" + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r.ok ? { ok: true, user: await r.json() } : { ok: false, error: await errText(r) };
  } catch { return { ok: false, error: "No connection to the server" }; }
}
export const login = (username, password) => authPost("login", { username, password });
export const signup = (username, name, password) => authPost("signup", { username, name, password });
export const changePassword = (old, nw) => authPost("password", { old, new: nw });
export async function logout() {
  const u = USER;
  if (S && USER && SYNC.pending) { clearTimeout(timer); await push(); } // save before the session ends
  signOut();
  try { await fetch("api/auth/logout", { method: "POST" }); } catch { /* offline: the cookie stays until it expires */ }
  // forget this learner's cached progress on this device
  try { Object.keys(localStorage).filter(k => k === `a1.state.${u}` || k.startsWith(`a1.state.${u}@`)).forEach(k => localStorage.removeItem(k)); } catch { /* storage blocked */ }
}
const authLost = () => window.dispatchEvent(new Event("a1:auth"));
export async function fetchAllStates() {
  if (isGuest()) return { [GUEST]: S };
  try { const r = await fetch("api/states" + cq(), { cache: "no-store" }); return await r.json(); }
  catch { const o = {}; USERS.forEach(u => (o[u.id] = u.id === USER ? S : JSON.parse(ls.get(cacheKey(u.id)) || "null"))); return o; }
}

// ---------- state ----------
export let S = null;
export const blank = () => ({
  v: 2,
  created: today(),
  updated: 0,
  setup: false,
  settings: { startDate: "2026-11-09", targetDate: "2027-01-31", dailyGoal: 20, goalMode: "auto", hindi: true, autoplay: true, sound: true, theme: "system", quest: true, speak: true, xp2: true },
  words: {},   // id -> {box, due, r, w}
  done: {},    // path item id -> {date, score}
  log: [],     // {d, id, xp}
  xp: {},      // date -> xp
  reviews: {}, // date -> count reviewed
  pen: {},     // date -> XP lost (missed reviews, very low review scores)
  penLog: [],  // {d, xp, why}
  penChecked: null, // last day checked for missed reviews
  lastLv: 1,
  gems: 0,        // 💎 balance
  gifts: [],      // {id, m (streak milestone), tier, earned, opened, amount}
  questDays: {},  // date -> true when the daily-quest diamonds were paid
  gemLog: [],     // {d, n, why}
  bits: {},       // path item id -> [date per finished bit]
  tree: {},       // skill-tree courses: node id -> date learned
  parts: {},      // skill-tree courses: node id -> {part index -> date finished}
  say: {},        // phrase (target language) -> times produced correctly in "Say it in …"
  hit: {},        // date -> daily XP goal reached that day (counts for the streak in Quest Mode)
  time: {},       // date -> [seconds active in the app, seconds of that in lessons]
});
function normalize(st) {
  const b = blank();
  st = st || b;
  const oldXP = !(st.settings || {}).xp2; // saved before XP scheme 2
  st.settings = { ...b.settings, ...(st.settings || {}) };
  for (const k of Object.keys(b)) if (st[k] === undefined) st[k] = b[k];
  // XP scheme 2 has ~2.5× smaller numbers: scale an old manual daily goal once
  if (oldXP && st.settings.goalMode === "manual") st.settings.dailyGoal = Math.max(10, Math.round(st.settings.dailyGoal * 0.4));
  // grammar chapters finished before they were split into parts: every part counts as done
  for (const [gid, ids] of Object.entries(C.gparts || {})) if (st.done[gid]) ids.forEach(id => { if (!st.done[id]) st.done[id] = { ...st.done[gid] }; });
  if (!st.settings.pb3) migratePhraseBits(st);
  // streak rule from 11-20: a day counts when the daily goal is reached (Quest Mode); days before still count with any XP
  if (!st.settings.streakFrom) st.settings.streakFrom = today();
  if (st.setup && C.content && C.content.path) markGoal(st);
  return st;
}

// Load a user's state. syncBase = the server's `updated` at the last sync: if only one copy changed since then, that copy
// wins; if both changed (e.g. the phone was offline while the website saved), they are merged (merge.js).
const pendingLocal = st => !!st && (st.updated || 0) > (st.syncBase || 0);
const serverMoved = (st, server) => !!server && (server.updated || 0) > ((st && st.syncBase) || 0);
function pick(local, server) {
  if (!server) return { st: local, push: !!local };
  if (!local) return { st: server, push: false };
  if (pendingLocal(local) && serverMoved(local, server)) {               // both changed: merge, then upload the result
    const m = mergeStates(local, server); m.updated = Date.now(); m.syncBase = server.updated || 0;
    return { st: m, push: true, merged: true };
  }
  if (pendingLocal(local) && (local.updated || 0) >= (server.updated || 0)) return { st: local, push: true };
  return { st: { ...server, syncBase: server.updated || 0 }, push: false };
}
export async function switchUser(id) {
  if (S && USER && SYNC.pending) { clearTimeout(timer); await push(); } // flush the previous learner first
  USER = id; ls.set("a1.user", id);
  let local = JSON.parse(ls.get(cacheKey(id)) || "null");
  let server = null;
  if (id === GUEST) { S = normalize(local); ls.set(cacheKey(id), JSON.stringify(S)); checkMissed(); return S; } // guest: this phone only
  try {
    const r = await fetch(`api/state/${id}` + cq(), { cache: "no-store" });
    server = (await r.json()).state; SYNC.online = true;
  } catch { SYNC.online = false; }
  // one-time migration of progress made before profiles existed
  const legacy = JSON.parse(ls.get(LEGACY) || "null");
  if (!server && !local && legacy && legacy.setup && id === USERS[0].id) { local = legacy; local.updated = Date.now(); ls.del(LEGACY); }
  const p = pick(local, server);
  S = normalize(p.st);
  ls.set(cacheKey(id), JSON.stringify(S));
  checkMissed();
  if (p.merged) window.dispatchEvent(new Event("a1:merged"));
  if (p.push) push(); // local changes (or a merge) to upload
  return S;
}
// Switch the active course for the current learner: save the old course first, then load the new one's content + progress.
export async function switchCourse(id) {
  if (S && USER && SYNC.pending) { clearTimeout(timer); await push(); }
  setCourse(id);
  await loadContent(id);
  S = null;
  if (USER) await switchUser(USER);
}
export function signOut() { if (S && USER && SYNC.pending) { clearTimeout(timer); push(); } USER = null; S = null; ls.del("a1.user"); }

let timer = null;
export function save() {
  if (!S || !USER) return;
  S.updated = Date.now();
  ls.set(cacheKey(USER), JSON.stringify(S));
  window.dispatchEvent(new Event("a1:saved"));   // native widgets refresh (app.js pushWidget)
  if (isGuest()) return;
  SYNC.pending = true;
  clearTimeout(timer);
  timer = setTimeout(push, 600);
}
export async function push(retried = false) {
  if (!S || !USER || isGuest()) return;
  const u = USER, body = JSON.stringify(S);
  try {
    const r = await fetch(`api/state/${u}` + cq(), { method: "PUT", headers: { "Content-Type": "application/json" }, body });
    if (r.status === 401 || r.status === 403) { SYNC.pending = true; authLost(); return; } // kept locally; saved after the next login
    const j = await r.json();
    if (r.status === 409 && j.state && u === USER) { // the server has a newer copy (other device): merge both, upload the result
      const p = pick(S, j.state);
      S = normalize(p.st); ls.set(cacheKey(u), JSON.stringify(S));
      window.dispatchEvent(new Event("a1:state-replaced"));
      if (p.merged) window.dispatchEvent(new Event("a1:merged"));
      if (p.push && !retried) return push(true);
    } else if (r.ok && u === USER && S) { S.syncBase = JSON.parse(body).updated || 0; ls.set(cacheKey(u), JSON.stringify(S)); }
    SYNC.online = true; SYNC.pending = false; SYNC.last = Date.now();
  } catch { SYNC.online = false; SYNC.pending = true; }
  window.dispatchEvent(new Event("a1:sync"));
}
// pull newer data saved from another device (called when the app comes back to the foreground)
export async function refreshFromServer() {
  if (!USER) return false;
  if (isGuest()) return checkMissed();
  if (SYNC.pending) { await push(); return false; }
  try {
    const r = await fetch(`api/state/${USER}` + cq(), { cache: "no-store" });
    const s = (await r.json()).state; SYNC.online = true;
    if (s && (s.updated || 0) > (S.updated || 0)) { const p = pick(S, s); S = normalize(p.st); ls.set(cacheKey(USER), JSON.stringify(S)); checkMissed(); if (p.push) push(); return true; }
    if (checkMissed()) return true;
  } catch { SYNC.online = false; }
  return false;
}
export function resetAll() { const st = S.settings, base = S.syncBase; S = blank(); S.settings = { ...st }; S.resetAt = Date.now(); S.syncBase = base; save(); }
export function exportState() { return JSON.stringify(S, null, 1); }
export function importState(txt) {
  const o = JSON.parse(txt);
  if (!o || !o.settings || !o.words) throw new Error("Not a backup file");
  const base = S ? S.syncBase : 0; S = normalize(o); S.resetAt = Date.now(); S.syncBase = base; save();   // a restored backup wins over older copies
}

// ---------- XP / streak ----------
export function addXP(n) { const t = today(); S.xp[t] = (S.xp[t] || 0) + n; markGoal(); save(); }
// remember the day's goal as reached (the goal is frozen per day, so this never flips back)
export function markGoal(st = S) { if (!C.content || !C.content.path) return;   // skill-tree courses have no daily goal (no lesson path)
  const t = today(); if (!st.hit) st.hit = {}; if (!st.hit[t] && (st.xp[t] || 0) >= goalFor(st)) st.hit[t] = goalFor(st); }
export const xpToday = (st = S) => st.xp[today()] || 0;
// A streak day: Quest Mode = the daily XP goal was reached; Quest Mode off (no goal) or before 11-20 = any XP that day.
export function dayCounts(d, st = S) {
  if ((st.hit || {})[d]) return true;
  return (st.xp[d] || 0) > 0 && (!questMode(st) || d < (st.settings.streakFrom || "9999"));
}
export function streak(st = S) {
  let d = today(), n = 0;
  if (!dayCounts(d, st)) d = addDays(d, -1); // today not done yet – the streak still counts until midnight
  while (dayCounts(d, st)) { n++; d = addDays(d, -1); }
  return n;
}
// ---------- time spent: active seconds per day (screen visible and touched in the last 90 s), and how much of it in lessons ----------
let lastInput = Date.now(), tick = null, unsaved = 0;
export function startTimeTracking() {
  if (tick) return;
  for (const ev of ["pointerdown", "keydown", "touchstart", "scroll"]) addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true, capture: true });
  tick = setInterval(() => {
    if (!S || !USER || document.visibilityState !== "visible" || Date.now() - lastInput > 90000) return;
    const t = today(), d = (S.time || (S.time = {}))[t] || (S.time[t] = [0, 0]);
    d[0] += 15; if (document.body.classList.contains("in-lesson")) d[1] += 15;
    if ((unsaved += 15) >= 60) { unsaved = 0; save(); }
  }, 15000);
}
export const totalXP = (st = S) => Math.max(0, Object.values(st.xp).reduce((a, b) => a + b, 0) - Object.values(st.pen || {}).reduce((a, b) => a + b, 0));
export function addPenalty(n, why, d = today()) {
  if (n <= 0) return;
  S.pen[d] = (S.pen[d] || 0) + n;
  S.penLog.push({ d, xp: n, why });
  if (S.penLog.length > 200) S.penLog = S.penLog.slice(-200);
  save();
}
// A day counts as missed when words were due that day and no review was done.
export const MISSED_DAY_XP = 3;
// XP scheme 2 (11-19): learning pays, reviews pay a little, forgetting costs. See XP_HELP in app.js.
export const XPR = { newItem: 1, part: 2, perfect: 1, lesson: 5, grammarPart: 3, repeat: 1, failed: 1, recall: 0.2, forgot: -0.5, reviewBonus: 1 };
export const questMode = (st = S) => !st || !st.settings || st.settings.quest !== false;
export function checkMissed() {
  if (!S || !S.setup) return 0;
  const y = addDays(today(), -1);
  if (!questMode()) { if (S.penChecked !== y) { S.penChecked = y; save(); } return 0; } // no missed-review penalties without quests
  let d = S.penChecked ? addDays(S.penChecked, 1) : y;
  let lost = 0;
  for (; d <= y; d = addDays(d, 1)) {
    if (S.reviews[d]) continue;
    const overdue = Object.values(S.words).filter(w => w.due <= d && (!w.last || w.last < d)).length;
    if (overdue > 0) {
      const n = Math.min(10, MISSED_DAY_XP + Math.floor(overdue / 10));
      addPenalty(n, `Missed reviews (${overdue} words were due)`, d); lost += n;
    }
  }
  if (S.penChecked !== y) { S.penChecked = y; save(); }
  return lost;
}

// ---------- level (from total XP) and hunter rank (from A1 %) ----------
// Level 1 → 100 follows A1 completion (level 100 = all A1 content covered and kept in memory).
// After that, every POST_A1_XP earned since reaching A1 adds one more level (101, 102, …).
export const A1_LEVEL = 100;
export const POST_A1_XP = 200;
export function level(pct, st = S) {
  const p = Math.min(100, Math.max(0, pct));
  if (p >= 99.999) {
    if (st && st.a1XP == null) st.a1XP = totalXP(st); // remember the XP at the moment A1 was reached
    const extra = st ? Math.max(0, totalXP(st) - (st.a1XP || 0)) : 0;
    return { lv: A1_LEVEL + Math.floor(extra / POST_A1_XP), a1: true, frac: (extra % POST_A1_XP) / POST_A1_XP,
             xpInto: extra % POST_A1_XP, xpNeed: POST_A1_XP, toNext: 0 };
  }
  const x = 1 + (p * (A1_LEVEL - 1)) / 100;
  const lv = Math.min(A1_LEVEL - 1, Math.floor(x + 1e-9));
  const frac = x - lv;
  return { lv, a1: false, frac, toNext: ((1 - frac) * 100) / (A1_LEVEL - 1) };
}
export const RANKS = [["E", 0], ["D", 10], ["C", 25], ["B", 45], ["A", 70], ["S", 95]];
export function rank(pct) {
  let r = RANKS[0], nx = RANKS[1];
  RANKS.forEach((x, i) => { if (pct >= x[1]) { r = x; nx = RANKS[i + 1]; } });
  return { r: r[0], next: nx ? nx[0] : null, nextAt: nx ? nx[1] : null };
}

// ---------- diamonds & gift boxes ----------
export const QUEST_GEMS = 5;
export const MILESTONES = [7, 14, 21, 30, 45, 60, 75, 90, 120, 150, 180, 365];
export const TIERS = {
  common: { name: "Common", min: 15, max: 30, color: "#5aa9ff" },
  rare: { name: "Rare", min: 40, max: 80, color: "#b48cff" },
  epic: { name: "Epic", min: 100, max: 180, color: "#ff6bd5" },
  legendary: { name: "Legendary", min: 250, max: 400, color: "#ffcc4d" },
};
export const tierFor = m => m < 14 ? "common" : m < 30 ? "rare" : m < 90 ? "epic" : "legendary";
function addGems(n, why) {
  S.gems = (S.gems || 0) + n;
  S.gemLog.push({ d: today(), n, why });
  if (S.gemLog.length > 100) S.gemLog = S.gemLog.slice(-100);
}
// Pays daily-quest diamonds and hands out streak gift boxes. Returns what was newly earned.
export function checkRewards(questDone) {
  const out = { gems: 0, gifts: [] };
  if (!S || !S.setup) return out;
  const t = today();
  if (questDone && !S.questDays[t]) { S.questDays[t] = true; addGems(QUEST_GEMS, "Daily quest cleared"); out.gems = QUEST_GEMS; }
  const n = streak();
  if (n > 0) {
    let end = S.xp[t] ? t : addDays(t, -1);
    const runStart = addDays(end, -(n - 1)); // a new streak run can earn the boxes again
    for (const m of MILESTONES) {
      const id = `${runStart}:${m}`;
      if (n >= m && !S.gifts.some(g => g.id === id)) {
        const g = { id, m, tier: tierFor(m), earned: t, opened: false, amount: 0 };
        S.gifts.push(g); out.gifts.push(g);
      }
    }
  }
  if (out.gems || out.gifts.length) save();
  return out;
}
export function openGift(id) {
  const g = S.gifts.find(x => x.id === id);
  if (!g || g.opened) return 0;
  const T = TIERS[g.tier];
  g.amount = T.min + Math.floor(Math.random() * (T.max - T.min + 1));
  g.opened = true; g.openedOn = today();
  addGems(g.amount, `${T.name} gift box (${g.m}-day streak)`);
  save();
  return g.amount;
}
export const nextMilestone = () => MILESTONES.find(m => m > streak()) || null;

// ---------- spaced repetition (Leitner boxes) ----------
// SM-2 style spaced repetition (as used by SuperMemo / Anki): grades 1 Again · 2 Hard · 3 Good · 4 Easy
export const GRADES = ["", "Again", "Hard", "Good", "Easy"];
function srs(s) { // migrate old Leitner data
  if (s.ivl === undefined) { s.ivl = [0, 1, 3, 7, 14, 30, 60, 120][s.box || 0] || 0; s.ef = 2.5; s.reps = s.box || 0; s.lapses = s.w || 0; }
  return s;
}
export function learnWord(id) {
  if (S.words[id]) return;
  S.words[id] = { ivl: 0, ef: 2.5, reps: 0, lapses: 0, due: addDays(today(), 1), since: today(), r: 0, w: 0 };
}
export function nextIvl(s, g) {
  s = srs({ ...s });
  if (g === 1) return 1;
  if (g === 2) return s.reps === 0 ? 2 : Math.max(s.ivl + 1, Math.round(s.ivl * 1.2));
  if (g === 3) return s.reps === 0 ? 3 : Math.max(s.ivl + 1, Math.round(s.ivl * s.ef));
  return s.reps === 0 ? 6 : Math.max(s.ivl + 2, Math.round(s.ivl * s.ef * 1.3));
}
export function gradeWord(id, g) {
  const s = srs(S.words[id] || (S.words[id] = { ivl: 0, ef: 2.5, reps: 0, lapses: 0, due: today(), since: today(), r: 0, w: 0 }));
  const ivl = Math.min(365, nextIvl(s, g));
  if (g === 1) { s.lapses++; s.reps = 0; s.ef = Math.max(1.3, s.ef - 0.2); s.lapsed = true; s.w++; }
  else {
    s.reps++; s.r++;
    if (g === 2) s.ef = Math.max(1.3, s.ef - 0.15);
    if (g === 4) s.ef = Math.min(3.0, s.ef + 0.15);
    if (g >= 3) s.lapsed = false;
  }
  s.ivl = ivl; s.due = addDays(today(), ivl); s.last = today();
  save();
  return ivl;
}
export const dueWords = (st = S) => Object.entries(st.words).filter(([, s]) => s.due <= today())
  .sort((a, b) => a[1].due.localeCompare(b[1].due)).map(([id]) => id);
export const overdueDays = s => Math.max(0, daysBetween(s.due, today()) - 1); // 1 day of grace
export function wordStatus(id, st = S) {
  const s = st.words[id];
  if (!s) return "new";
  const ivl = s.ivl !== undefined ? s.ivl : [0, 1, 3, 7, 14, 30, 60, 120][s.box || 0];
  if (ivl >= 30) return "mastered";
  if (ivl >= 7) return "known";
  return "learning";
}
// How much a learned word still counts toward A1: overdue words fade (−1/14 per day, floor 25 %), failed words count half.
export function health(s) {
  if (!s) return 0;
  const fade = Math.max(0.25, 1 - overdueDays(s) / 14);
  return (s.lapsed ? 0.5 : 1) * fade;
}

// ---------- A1 progress ----------
// A1 coverage: vocabulary 55 % (by words), grammar 30 % (20 chapters), phrases 15 % (14 sections).
export const WEIGHTS = { vocab: 55, grammar: 30, phrases: 15 };
let _w = null;
export function itemWeights() {
  if (_w) return _w;
  const p = C.content.path, nWords = C.content.words.length;
  const nG = new Set(p.filter(i => i.kind === "grammar").map(i => i.gid || i.id)).size, nP = p.filter(i => i.kind === "phrases").length;
  _w = {};
  for (const i of p) {
    _w[i.id] = i.kind === "vocab" ? WEIGHTS.vocab * i.words.length / nWords
      : i.kind === "grammar" ? WEIGHTS.grammar / nG / (i.of || 1) : WEIGHTS.phrases / nP;
  }
  return _w;
}
// total = memory-adjusted A1 % (drives level, rank, aura); coverage = lessons completed, ignoring memory.
export function progress(st = S) {
  const w = itemWeights(), out = { total: 0, vocab: 0, grammar: 0, phrases: 0, coverage: 0 };
  const perWord = WEIGHTS.vocab / C.content.words.length;
  for (const it of C.content.path) {
    const n = bitsDone(it, st); if (!n) continue;
    const frac = st.done[it.id] ? 1 : n / bitCount(it);
    out.coverage += w[it.id] * frac;
    if (it.kind === "vocab") {
      const v = it.words.reduce((a, wid) => a + (st.words[wid] ? perWord * health(st.words[wid]) : 0), 0);
      out.vocab += v; out.total += v;
    } else { out[it.kind] += w[it.id] * frac; out.total += w[it.id] * frac; }
  }
  return out;
}
export function memory(st = S) {
  const ws = Object.values(st.words);
  const overdue = ws.filter(s => overdueDays(s) > 0).length, lapsed = ws.filter(s => s.lapsed).length;
  const h = ws.length ? ws.reduce((a, s) => a + health(s), 0) / ws.length : 1;
  return { overdue, lapsed, health: h, due: dueWords(st).length };
}
export function retention(st = S) {
  const ids = Object.keys(st.words);
  const c = { learning: 0, known: 0, mastered: 0 };
  ids.forEach(id => c[wordStatus(id, st)]++);
  return { ...c, learned: ids.length, total: C.content.words.length };
}

// cumulative progress by day, from the completion log
export function history(st = S) {
  const w = itemWeights(), byDay = {};
  for (const [id, d] of Object.entries(st.done)) byDay[d.date] = (byDay[d.date] || 0) + (w[id] || 0);
  let acc = 0;
  return Object.keys(byDay).sort().map(d => [d, (acc += byDay[d])]);
}

export function pace(st = S) {
  const t = today(), { startDate: start, targetDate: target } = st.settings;
  const span = Math.max(1, daysBetween(start, target));
  // feedback 11-23: count today as due, so clearing today's daily quest puts you on the plan (the quest is sized as remaining / days left)
  const el = Math.min(Math.max(daysBetween(start, t) + 1, 0), span);
  const expected = Math.min(100, 100 * el / span);
  const p = progress(st).coverage;
  const left = Math.max(0, daysBetween(t, target));
  const needPerDay = left > 0 ? (100 - p) / left : 100 - p;
  // actual pace: average over the last 14 days (or since start if shorter)
  const win = Math.max(1, Math.min(14, daysBetween(start, t) + 1));
  const from = addDays(t, -win + 1), w = itemWeights();
  // by finished PARTS (the quest counts parts, and parts rotate between lessons, so whole lessons finish late); old data without part dates falls back to the lesson date
  let recent = 0;
  for (const it of C.content.path) {
    const bits = (st.bits || {})[it.id] || [], n = bitCount(it), d = st.done[it.id];
    if (it.kind === "grammar" || !bits.some(Boolean)) { if (d && d.date >= from && d.date <= t) recent += w[it.id] || 0; continue; }
    recent += (w[it.id] || 0) * bits.filter(x => x && x >= from && x <= t).length / Math.max(1, n);
  }
  const actualPerDay = recent / win;
  const projDays = actualPerDay > 0 ? Math.ceil((100 - p) / actualPerDay) : null;
  const projected = projDays != null ? addDays(t, projDays) : null;
  const avgItem = 100 / C.content.path.length; // translate % into lessons
  const gap = p - expected; // + ahead, – behind
  return { expected, actual: progress(st).total, coverage: p, needPerDay, actualPerDay, projected, left, gap, gapLessons: gap / avgItem,
           needLessonsPerWeek: needPerDay * 7 / avgItem, actualLessonsPerWeek: actualPerDay * 7 / avgItem, span, el };
}

// one-line stats for the comparison views
export function summary(st) {
  if (!st || !st.setup) return null;
  st = normalize(st);
  const pc = pace(st);
  return { gems: st.gems || 0, lv: level(pc.actual, st).lv, rank: rank(pc.actual).r, xpToday: xpToday(st), xp: totalXP(st), streak: streak(st), lessons: Object.keys(st.done).filter(id => C.item[id]).length,
           of: C.content.path.length, pct: pc.actual, expected: pc.expected, gapLessons: pc.gapLessons, words: Object.keys(st.words).length,
           goal: goalFor(st), target: st.settings.targetDate };
}

// ---------- bits: each lesson is split into short parts (4 words / 5 phrases) ----------
function chunk(arr, size, minLast) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  if (out.length > 1 && out.at(-1).length < minLast) out.at(-2).push(...out.pop());
  return out;
}
export const PHRASE_BIT = 3; // phrases per part (was 5 until 11-20: parts felt too long)
export function bitsOf(it) {
  if (it.kind === "vocab") return chunk(it.words, 4, 3);
  if (it.kind === "phrases") return chunk(C.phrases[it.id].items.map((_, i) => i), PHRASE_BIT, 2);
  return [[0]]; // grammar: one part
}
// Phrase parts were 5 phrases each (until 11-20); now 3. Keep finished phrases finished: a new part is done when every
// phrase in it was in a finished old part. Old content also had "Danke, gut. Und Ihnen? / Und dir?" as one phrase (now two).
const OLD_SPLIT = ["Danke, gut. Und Ihnen?"]; // first of a phrase that was split into it + the next one on 11-20
function migratePhraseBits(st) {
  if (!C.phrases || !C.content || !C.content.path) return; // not a language course (or content not loaded yet)
  for (const it of C.content.path) {
    if (it.kind !== "phrases" || st.done[it.id]) continue;
    const old = (st.bits || {})[it.id];
    if (!old || !old.some(Boolean)) continue;
    const items = C.phrases[it.id].items, oldIdx = []; // new index for each old index
    for (let i = 0; i < items.length; i++) { oldIdx.push([i]); if (OLD_SPLIT.includes(items[i].de) && i + 1 < items.length) oldIdx.at(-1).push(++i); }
    const doneAt = {}; // new phrase index -> date its old part was finished
    chunk(oldIdx.map((_, k) => k), 5, 3).forEach((ks, b) => { if (old[b]) ks.forEach(k => oldIdx[k].forEach(i => { doneAt[i] = old[b]; })); });
    st.bits[it.id] = chunk(items.map((_, i) => i), PHRASE_BIT, 2).map(ids => (ids.every(i => doneAt[i]) ? doneAt[ids[0]] : null));
  }
  st.settings.pb3 = true;
}
export const bitCount = it => bitsOf(it).length;
// phrases learned in phrase lessons, by topic (feedback 11-22: the Words page counted words only, so greetings and
// polite phrases learned in phrase lessons never showed). A phrase is learned when its part (or the topic) is finished.
export function phraseTopics(st = S) {
  if (!C.phrases || !C.content || !C.content.path) return [];
  return C.content.path.filter(it => it.kind === "phrases" && C.phrases[it.id]).map(it => {
    const sec = C.phrases[it.id], all = !!st.done[it.id], b = (st.bits || {})[it.id] || [], learned = new Set();
    bitsOf(it).forEach((ids, k) => { if (all || b[k]) ids.forEach(i => learned.add(i)); });
    return { id: it.id, title: sec.title || it.title, items: sec.items.map((p, i) => ({ ...p, learned: learned.has(i) })) };
  });
}
export function bitsDone(it, st = S) {
  if (st.done[it.id]) return bitCount(it);
  return ((st.bits || {})[it.id] || []).filter(Boolean).length;
}
export function nextBit(it) {
  const b = (S.bits[it.id] || []);
  for (let i = 0; i < bitCount(it); i++) if (!b[i]) return i;
  return 0; // all done – practise from the first bit again
}
// returns true when this finished the whole lesson
export function completeBit(it, i, score, xp) {
  const b = S.bits[it.id] || (S.bits[it.id] = []);
  b[i] = b[i] || today();
  S.log.push({ d: today(), id: it.id, bit: i, xp });
  const all = bitsDone(it) >= bitCount(it) || b.filter(Boolean).length >= bitCount(it);
  if (all && !S.done[it.id]) { S.done[it.id] = { date: today(), score, last: today() }; save(); return true; }
  if (S.done[it.id]) S.done[it.id].last = today();
  save();
  return false;
}

// ---------- weekly plan from the learner's own pace ----------
// Weeks start on Monday. Week 1 is the week containing the start date; the last week contains the target date.
// Each lesson goes into the week in which the expected (straight-line) pace reaches it.
export const mondayOf = d => { const x = parse(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return iso(x); };
let _plan = null, _planKey = "";
export function weekPlan(st = S) {
  const { startDate: start, targetDate: target } = st.settings, key = start + "|" + target;
  if (_plan && _planKey === key) return _plan;
  const m0 = mondayOf(start), span = Math.max(1, daysBetween(start, target));
  const nWeeks = Math.max(1, Math.floor(daysBetween(m0, target) / 7) + 1);
  const weeks = Array.from({ length: nWeeks }, (_, k) => ({ n: k + 1, from: addDays(m0, k * 7), to: addDays(m0, k * 7 + 6), items: [] }));
  const w = itemWeights(), of = {};
  let cum = 0;
  for (const it of C.content.path) {
    const mid = cum + w[it.id] / 2; cum += w[it.id];
    const day = addDays(start, Math.floor((span * mid) / 100));
    const k = Math.min(nWeeks - 1, Math.max(0, Math.floor(daysBetween(m0, day) / 7)));
    weeks[k].items.push(it); of[it.id] = k + 1;
  }
  _plan = { weeks, of, nWeeks }; _planKey = key;
  return _plan;
}
export const weekOf = it => weekPlan().of[it.id];
export const thisWeek = () => { const p = weekPlan(), t = today(); const w = p.weeks.find(x => x.from <= t && t <= x.to); return w ? w.n : (t < p.weeks[0].from ? 0 : p.nWeeks + 1); };

// ---------- the learner's own name in lessons (spelling practice) ----------
const DE_LETTER = { A: "aa", B: "bay", C: "tsay", D: "day", E: "ay", F: "ef", G: "gay", H: "haa", I: "ee", J: "yot", K: "kaa", L: "el", M: "em", N: "en", O: "oh",
  P: "pay", Q: "koo", R: "air", S: "es", T: "tay", U: "oo", V: "fow", W: "vay", X: "iks", Y: "üp-si-lon", Z: "tset", "Ä": "a-umlaut", "Ö": "o-umlaut", "Ü": "u-umlaut", "ß": "ess-tset" };
const EN_LETTER = { A: "ay", B: "bee", C: "see", D: "dee", E: "ee", F: "ef", G: "jee", H: "aitch", I: "eye", J: "jay", K: "kay", L: "el", M: "em", N: "en", O: "oh",
  P: "pee", Q: "kyoo", R: "ar", S: "es", T: "tee", U: "yoo", V: "vee", W: "double-u", X: "ex", Y: "why", Z: "zed" };
// First name in capitals, letters only (ANNA if it has no Latin letters). Max 10 letters so the options stay readable.
export function myName() {
  const u = USER && USER !== GUEST ? userInfo(USER) : null;
  const n = [...String((u && u.name) || "").trim().split(/\s+/)[0].toUpperCase()].filter(ch => DE_LETTER[ch]).join("");
  return n.length >= 2 && n.length <= 10 ? n : "ANNA";
}
const spellWith = (name, f) => [...name].map(f).join(" – ");
export const spellDE = name => spellWith(name, ch => DE_LETTER[ch] || ch);
// "How do you spell <your name>?" with distractors built from the classic traps
export function nameSpellQuestion() {
  const n = myName(), right = spellDE(n);
  const vowelTrap = { A: "ay", E: "ee", I: "eye" }, consTrap = { J: "jay", G: "jee", V: "vee", W: "double-u", Z: "zed", C: "see", Y: "why" }, triangle = { A: "ee", E: "aa", I: "ay" };
  const cands = [
    spellWith(n, ch => vowelTrap[ch] || DE_LETTER[ch] || ch),
    spellWith(n, ch => EN_LETTER[ch] || DE_LETTER[ch] || ch),
    spellWith(n, ch => consTrap[ch] || DE_LETTER[ch] || ch),
    spellWith(n, ch => triangle[ch] || DE_LETTER[ch] || ch),
    spellWith(n, (ch, i) => (i === 0 ? EN_LETTER[ch] : null) || DE_LETTER[ch] || ch),
  ];
  const opts = [right];
  for (const c of cands) if (!opts.includes(c) && opts.length < 4) opts.push(c);
  const note = [...new Set(n)].map(ch => `${ch} = “${DE_LETTER[ch] || ch}”`).join(", ");
  return { q: `How do you spell ${n} in German?`, a: right, opts, note: note + "." };
}
// {{NAME}} / {{Name}} / {{NAME_SAY}} in lesson text become the learner's own name
export function personalize(html) {
  if (!html || !html.includes("{{")) return html;
  const n = myName(), nice = n[0] + n.slice(1).toLowerCase();
  return html.replaceAll("{{NAME}}", n).replaceAll("{{Name}}", nice).replaceAll("{{NAME_SAY}}", spellDE(n));
}

// ---------- dynamic daily XP goal: what it takes to reach A1 (level 100, incl. S-rank) by the target date ----------
const PART_XP = XPR.part + XPR.perfect / 2, LESSON_BONUS = XPR.lesson; // + 1 XP per new word/phrase (below)
export function remainingXP(st = S) {
  let xp = 0;
  for (const it of C.content.path) {
    if (st.done[it.id]) continue;
    if (it.kind === "grammar") { xp += XPR.grammarPart + XPR.perfect / 2 + (!it.gid || it.part === it.of - 1 ? XPR.lesson : 0); continue; }
    const B = bitsOf(it), b = (st.bits || {})[it.id] || [];
    B.forEach((ids, k) => { if (!b[k]) xp += PART_XP + ids.length * XPR.newItem; });
    xp += LESSON_BONUS;
  }
  return xp;
}
export function autoGoal(st = S) {
  const days = Math.max(1, daysBetween(today(), st.settings.targetDate) + 1); // today counts
  const learned = Object.keys(st.words || {}).length;
  const reviewAllowance = Math.min(6, 1 + Math.round(learned * 0.006)); // review XP is small (+0.2 per word recalled)
  const raw = remainingXP(st) / days + reviewAllowance;
  return Math.max(10, Math.min(100, Math.round(raw)));
}
// Goal for today: manual setting, or the auto goal frozen once per day (so finishing a lesson doesn't move it).
export function goalFor(st = S) {
  if (st.settings.goalMode === "manual") return st.settings.dailyGoal || 50;
  const t = today();
  if (!st.goalDay || st.goalDay.d !== t || st.goalDay.target !== st.settings.targetDate || st.goalDay.s !== 2) {
    st.goalDay = { d: t, v: autoGoal(st), target: st.settings.targetDate, s: 2 };
    if (st === S) save();
  }
  return st.goalDay.v;
}

// Lesson parts still to do (a grammar part, phrase part or vocab part each count 1)
export function remainingParts(st = S) {
  let n = 0;
  for (const it of C.content.path) {
    if (st.done[it.id]) continue;
    if (it.kind === "grammar") { n++; continue; }
    const b = (st.bits || {})[it.id] || [];
    n += bitsOf(it).filter((_, k) => !b[k]).length;
  }
  return n;
}
// How many lesson parts a day keep you on track for the target date (1–8, frozen once per day)
export function partsGoal(st = S) {
  goalFor(st);
  // manual goal mode never freezes goalDay, so make today's record here (it used to crash on undefined)
  if (!st.goalDay || st.goalDay.d !== today()) st.goalDay = { d: today(), v: goalFor(st), target: st.settings.targetDate, s: 0 }; // s:0 so auto mode recomputes
  if (st.goalDay.p == null) {
    const days = Math.max(1, daysBetween(today(), st.settings.targetDate) + 1);
    st.goalDay.p = Math.max(1, Math.min(8, Math.ceil(remainingParts(st) / days)));
    if (st === S) save();
  }
  return st.goalDay.p;
}
// Lesson parts finished for the first time today
export function partsToday(st = S) {
  const t = today();
  let n = 0;
  for (const it of C.content.path) {
    if (it.kind === "grammar") { if (st.done[it.id] && st.done[it.id].date === t) n++; continue; }
    n += ((st.bits || {})[it.id] || []).filter(d => d === t).length;
  }
  return n;
}

export const nextItem = () => C.content.path.find(i => !S.done[i.id]);
// Lesson of the last part finished today (or null)
export function lastPartToday(st = S) {
  const t = today();
  for (let k = st.log.length - 1; k >= 0 && st.log[k].d === t; k--) if (C.item[st.log[k].id]) return st.log[k].id;
  return null;
}
// What to do next: the first unfinished lesson, but right after a part of it, a part of another of the first 3
// unfinished lessons (another kind if there is one), so a day alternates lessons instead of one long run (feedback 11-20).
export function pickFrom(isDone, last) {
  const open = [];
  for (const i of C.content.path) if (!isDone(i.id) && open.push(i) >= 3) break;
  if (!open.length) return null;
  if (!last || open[0].id !== last) return open[0];
  const k = C.item[last] && C.item[last].kind;
  return open.find(i => i.id !== last && i.kind !== k) || open.find(i => i.id !== last) || open[0];
}
export const nextPick = (st = S) => pickFrom(id => !!st.done[id], lastPartToday(st));
// The next n parts (simulated with nextPick): [{it, k (part index), ids (words / phrase indices)}]
export function planParts(n, st = S) {
  const done = new Set(Object.keys(st.done)), bits = {}, out = [];
  let last = lastPartToday(st);
  for (let j = 0; j < n; j++) {
    const it = pickFrom(id => done.has(id), last); if (!it) break;
    const B = bitsOf(it), b = bits[it.id] || (bits[it.id] = [...((st.bits || {})[it.id] || [])]);
    let k = B.findIndex((_, x) => !b[x]); if (k < 0) k = 0;
    b[k] = 1; out.push({ it, k, ids: B[k] });
    if (it.kind === "grammar" || B.every((_, x) => b[x])) done.add(it.id);
    last = it.id;
  }
  return out;
}
export function completeItem(id, score, xp) {
  const first = !S.done[id];
  S.done[id] = { date: first ? today() : S.done[id].date, score, last: today() };
  S.log.push({ d: today(), id, xp });
  save();
  return first;
}

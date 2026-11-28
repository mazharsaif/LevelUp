// Time per card (feedback 5028). Two jobs:
// 1. Light up the 💬 study-helper chip when a learner stays on a card for a long time:
//    2 × the expected reading time (200 words a minute), never sooner than 45 s.
// 2. Record the seconds spent on each reader card and lesson step. Visits are queued on the phone and sent in batches to
//    POST /api/cardtime (server_fastapi/cardtime.py). Only seconds, the card id and title, and "helper opened" are sent;
//    never what the learner typed. Time stops while the app is in the background. Guests are not recorded.
import { USER, isGuest } from "./store.js";

const WPM = 200, MIN_S = 45, MAX_S = 600, QKEY = "a1.cardtime.q", QMAX = 500;
let cur = null;      // { card, title, kind, course, ms, since, asked, timer, onLong, longAt }

export const longAfter = words => Math.max(MIN_S, Math.round(2 * 60 * (words || 0) / WPM));
export const wordsIn = text => (String(text || "").trim().match(/\S+/g) || []).length;

const active = () => cur.ms + (cur.since ? Date.now() - cur.since : 0);
function arm() {
  clearTimeout(cur.timer);
  if (!cur.onLong || cur.lit || !cur.since) return;
  const wait = cur.longAt * 1000 - active();
  cur.timer = setTimeout(() => { if (cur && !cur.lit) { cur.lit = true; cur.onLong(); } }, Math.max(0, wait));
}

/** Start timing a card. Stops (and records) the previous one first.
 *  meta: { card, title, kind, course }, opts: { words, onLong } — onLong runs once when the card has been open too long. */
export function start(meta, opts = {}) {
  stop();
  cur = { ...meta, ms: 0, since: document.hidden ? 0 : Date.now(), asked: false, lit: false, onLong: opts.onLong || null, longAt: longAfter(opts.words), hash: location.hash };
  arm();
}
/** The study helper was opened on the card being timed. */
export function markAsked() { if (cur) cur.asked = true; }
/** Stop timing and queue the visit. */
export function stop() {
  if (!cur) return;
  clearTimeout(cur.timer);
  const s = Math.min(MAX_S, Math.round(active() / 1000)), c = cur;
  cur = null;
  if (s >= 1 && USER && !isGuest()) queue({ course: c.course || "", card: c.card, title: c.title || "", kind: c.kind || "", s, asked: c.asked });
}

// ---- queue on the phone, sent in batches ----
const readQ = () => { try { return JSON.parse(localStorage.getItem(QKEY) || "[]"); } catch { return []; } };
const writeQ = q => { try { localStorage.setItem(QKEY, JSON.stringify(q.slice(-QMAX))); } catch { /* storage full or blocked */ } };
let sendTimer = null;
function queue(rec) {
  const q = readQ(); q.push({ ...rec, u: USER, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }); writeQ(q);
  if (q.length >= 20) flush(); else { clearTimeout(sendTimer); sendTimer = setTimeout(flush, 30000); }
}
let sending = false;
export async function flush(keepalive = false) {
  clearTimeout(sendTimer);
  if (sending || !USER || isGuest() || !navigator.onLine) return;
  const all = readQ(), mine = all.filter(r => r.u === USER).slice(0, 100);   // a visit is only sent while its own learner is signed in
  if (!mine.length) return;
  sending = true;
  try {
    const r = await fetch("api/cardtime", { method: "POST", headers: { "Content-Type": "application/json" }, keepalive,
      body: JSON.stringify({ recs: mine.map(({ u, id, ...rec }) => rec) }) });
    if (r.ok || r.status === 422) { const sent = new Set(mine.map(m => m.id)); writeQ(readQ().filter(x => !sent.has(x.id))); }   // 422 = bad batch: drop it, don't resend forever
  } catch { /* offline: kept for later */ }
  sending = false;
  if (readQ().some(r => r.u === USER)) sendTimer = setTimeout(flush, 30000);
}

// time only counts while the app is on screen
document.addEventListener("visibilitychange", () => {
  if (cur) {
    if (document.hidden) { if (cur.since) { cur.ms += Date.now() - cur.since; cur.since = 0; } clearTimeout(cur.timer); }
    else { cur.since = Date.now(); arm(); }
  }
  if (document.hidden) flush(true);
});
// leaving the screen by any route (back button, tab bar) ends the visit
window.addEventListener("hashchange", () => { if (cur && location.hash !== cur.hash) stop(); });

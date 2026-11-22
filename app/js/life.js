// Hunter's Path: personal tracks (quests and dungeons) for your own goals. Design: docs/design/personal-tracks.md
// Four kinds: daily (do it on scheduled days), abstain (a clean run: check in "still clean"), target (an amount per week
// or in total), milestone (steps by a date). A track with a length is a gate (dungeon) ranked E–S by that length.
//
// Each day (or week, for weekly targets) is a "slot". Once a slot is over it is settled:
//   good  → run +1; a crack heals after 7 good days (2 good weeks) in a row
//   bad   → a shield covers it if one is free, else the run cracks (⚠); never miss twice: a second bad slot in a row,
//           or a bad slot while cracked, breaks the run (a gate fails; an open-ended track starts a new run).
// Shields (anti-abuse, feedback 11-22): hold at most 2; earned by clearing a D-rank gate or better; bought with 💎 at most
// once every 14 days; a track can use one at most once a week; never two slots in a row; never on hard-mode tracks.
import { S, save, today, addDays, daysBetween, parse } from "./store.js";

export const STATS = { body: ["💪", "Body"], mind: ["🧠", "Mind"], discipline: ["🛡", "Discipline"], health: ["❤️", "Health"] };
export const GATES = [[7, "E"], [14, "D"], [30, "C"], [60, "B"], [90, "A"], [180, "S"]];
export const GATE_REWARD = { E: [50, 5], D: [100, 10], C: [250, 25], B: [500, 50], A: [900, 80], S: [2000, 150] }; // [XP, 💎]
export const SHIELD_MAX = 2, SHIELD_COST = 40, SHIELD_BUY_DAYS = 14, SHIELD_TRACK_DAYS = 7, HEAL_DAYS = 7, HEAL_WEEKS = 2;
export const XP = { day: 5, unit: 2, week: 15, urge: 2, penalty: 3, step: 20, allDone: 5 };
export const TITLES = [[1, "Gate Opener"], [3, "Dungeon Runner"], [5, "Gatebreaker"], [10, "Raid Leader"], [20, "Monarch"]]; // gates cleared

export const gateRank = days => { if (!days) return null; let r = "E"; for (const [d, g] of GATES) if (days >= d) r = g; return r; };
export const H = () => {
  S.tracks = S.tracks || {};
  S.hunter = S.hunter || {};
  const h = S.hunter;
  if (S.settings && S.settings.quest !== false) S.settings.quest = false; // streak = any day with a check-in (no daily XP goal here)
  h.shields ??= 0; h.boughtAt ??= null; h.stats ??= {}; h.cleared ??= 0; h.titles ??= []; h.log ??= []; h.system ??= false; h.allDone ??= {};
  return h;
};
const note = (d, why, n = 0) => { const h = H(); h.log.push({ d, why, n }); if (h.log.length > 300) h.log = h.log.slice(-300); };
export function award(n, stat, why) {
  if (!n) return;
  const t = today();
  S.xp[t] = (S.xp[t] || 0) + n;
  const h = H(); if (stat) h.stats[stat] = (h.stats[stat] || 0) + n;
  if (why) note(t, why, n);
}
export const gems = (n, why) => { S.gems = (S.gems || 0) + n; (S.gemLog = S.gemLog || []).push({ d: today(), n, why }); };

// ---------- Hunter level and rank (from personal XP) ----------
export function hunterLevel(xp) {
  let lv = 1, need = 40, left = Math.max(0, xp);
  while (left >= need && lv < 150) { left -= need; lv++; need = 30 + 10 * lv; }
  return { lv, into: left, need, frac: left / need };
}
export const hunterRank = lv => (lv >= 95 ? "S" : lv >= 70 ? "A" : lv >= 45 ? "B" : lv >= 25 ? "C" : lv >= 10 ? "D" : "E");
export const totalLifeXP = () => Object.values(S.xp || {}).reduce((a, b) => a + b, 0);

// ---------- tracks ----------
let seq = 0;
export function newTrack(o) {
  const t = today(), id = "t" + Date.now().toString(36) + (seq++);
  const tr = {
    id, kind: o.kind, title: o.title.trim(), icon: o.icon || "⭐", stat: o.stat || "discipline", private: !!o.private, alias: (o.alias || "").trim(),
    start: o.start || t, days: o.days || null, schedule: o.schedule || [1, 1, 1, 1, 1, 1, 1], amount: o.amount || null, unit: o.unit || "",
    period: o.period || "week", steps: (o.steps || []).map(s => (typeof s === "string" ? { t: s, d: null } : s)), why: o.why || "", penalty: o.penalty || "",
    hard: !!o.hard, template: o.template || null, auto: o.auto || null, party: o.party || null,
    log: {}, urges: {}, pen: {}, status: "active",
    st: { settled: addDays(o.start || t, -1), run: 0, best: 0, good: 0, bad: 0, cracked: null, prevBad: false, prevShield: false, lastShield: null, shielded: {}, pendingPen: null, events: [] },
  };
  H(); S.tracks[id] = tr; save();
  return tr;
}
export const shown = tr => (tr.private && tr.alias ? tr.alias : tr.title);
export const endDate = tr => (tr.days ? addDays(tr.start, tr.days - 1) : null);
export const dayNo = (tr, d = today()) => daysBetween(tr.start, d) + 1;
const dow = d => (parse(d).getDay() + 6) % 7; // Monday = 0
export const scheduled = (tr, d) => tr.kind !== "daily" || !!tr.schedule[dow(d)];
const weekIdx = (tr, d) => Math.floor(daysBetween(tr.start, d) / 7);
export const weekRange = (tr, k) => [addDays(tr.start, 7 * k), addDays(tr.start, 7 * k + 6)];
export function weekCount(tr, k) {
  const [a, b] = weekRange(tr, k); let n = 0;
  for (let d = a; d <= b; d = addDays(d, 1)) n += +tr.log[d] || 0;
  return n;
}
export const totalCount = tr => Object.values(tr.log).reduce((a, v) => a + (+v || 0), 0);

// days you reached the daily goal in a language course (for the "Reach my LevelUp daily goal" track)
function learnHits() {
  const out = new Set();
  try {
    for (const k of Object.keys(localStorage)) if (/^a1\.state\./.test(k)) {
      const st = JSON.parse(localStorage.getItem(k) || "null");
      if (st && st.hit) Object.keys(st.hit).forEach(d => out.add(d));
    }
  } catch { /* ignore */ }
  return out;
}

/** is a day (or a day's value) good for this track? null = no answer yet */
export function dayValue(tr, d) {
  if (tr.auto === "learn") return learnHits().has(d) ? true : tr.log[d] ?? null;
  const v = tr.log[d];
  if (v === undefined || v === null) return null;
  if (v === "slip") return false;
  if (tr.kind === "daily" && tr.amount) return typeof v === "number" ? v >= tr.amount : !!v;
  return !!v;
}
export function doneToday(tr, d = today()) {
  if (tr.kind === "target") return tr.period === "week" ? weekCount(tr, weekIdx(tr, d)) >= tr.amount : totalCount(tr) >= tr.amount;
  if (tr.kind === "milestone") return tr.steps.every(s => s.d);
  return dayValue(tr, d) === true;
}

// ---------- settle: apply finished slots (shields, cracks, heals, breaks) ----------
export function settleAll() {
  H(); let changed = false;
  for (const tr of Object.values(S.tracks)) if (tr._resettle) { resettle(tr); changed = true; }
  for (const tr of Object.values(S.tracks)) if (tr.status === "active" && settle(tr)) changed = true;
  if (changed) save();
  return changed;
}
function ev(tr, d, type, txt) { tr.st.events.push({ d, type, txt }); if (tr.st.events.length > 60) tr.st.events = tr.st.events.slice(-60); }
function settle(tr) {
  const t = today(), st = tr.st, end = endDate(tr);
  let changed = false;
  if (tr.kind === "milestone") {
    if (tr.steps.length && tr.steps.every(s => s.d)) { clear(tr, t); return true; }
    if (end && t > end) { fail(tr, end, "The date passed before every step was done."); return true; }
    return false;
  }
  if (tr.kind === "target" && tr.period === "total") {
    if (totalCount(tr) >= tr.amount) { clear(tr, t); return true; }
    if (end && t > end) { fail(tr, end, `${totalCount(tr)} of ${tr.amount} ${tr.unit} by the end date.`); return true; }
    return false;
  }
  // slots: days (daily / abstain) or weeks (weekly target) that are over; a slip today is final, so it counts at once
  const slots = [];
  if (tr.kind === "target") {
    for (let k = Math.max(0, weekIdx(tr, addDays(st.settled, 1))); ; k++) {
      const [a, b] = weekRange(tr, k);
      if (end && a > end) break;
      if (b >= t) break;
      if (b > st.settled) slots.push({ d: b, good: weekCount(tr, k) >= tr.amount, label: `week ${k + 1}` });
    }
  } else {
    const last = end && end < t ? end : addDays(t, -1);
    const y = addDays(t, -1);
    for (let d = addDays(st.settled, 1); d <= last; d = addDays(d, 1)) {
      if (!scheduled(tr, d)) continue;
      if (d === y && dayValue(tr, d) === null) break;   // yesterday can still be filled in today; it settles tomorrow
      slots.push({ d, good: dayValue(tr, d) === true });
    }
    if (tr.kind === "abstain" && tr.log[t] === "slip" && st.settled < t && (!end || t <= end)) slots.push({ d: t, good: false, slip: true });
  }
  for (const s of slots) {
    if (tr.status !== "active") break;
    changed = true;
    st.settled = s.d;
    if (s.good) {
      st.run++; st.good++; st.best = Math.max(st.best, st.run); st.prevBad = false; st.prevShield = false;
      if (st.cracked) { st.cracked.heal++; if (st.cracked.heal >= (tr.kind === "target" ? HEAL_WEEKS : HEAL_DAYS)) { st.cracked = null; ev(tr, s.d, "heal", "The crack healed."); } }
      continue;
    }
    st.bad++;
    const h = H();
    const canShield = !tr.hard && h.shields > 0 && !st.prevBad && (!st.lastShield || daysBetween(st.lastShield, s.d) >= SHIELD_TRACK_DAYS);
    if (st.prevBad && !st.prevShield) { brk(tr, s.d, "Two misses in a row."); continue; }
    if (canShield) {
      h.shields--; st.lastShield = s.d; st.shielded[s.d] = true; st.prevBad = true; st.prevShield = true;
      ev(tr, s.d, "shield", "A shield covered this day."); note(s.d, `🛡 used on ${shown(tr)}`);
      continue;
    }
    if (st.cracked) { brk(tr, s.d, "A miss while the run was cracked."); continue; }
    st.cracked = { at: s.d, heal: 0 }; st.prevBad = true; st.prevShield = false;
    if (H().system && tr.penalty) st.pendingPen = addDays(s.d, 1) < t ? t : addDays(s.d, 1);
    ev(tr, s.d, "crack", "The run cracked.");
  }
  if (tr.status === "active" && end && st.settled >= end) clear(tr, end);
  return changed;
}
function brk(tr, d, why) {
  const st = tr.st;
  if (tr.days) { fail(tr, d, why); return; }
  ev(tr, d, "break", why + " A new run starts.");
  st.run = 0; st.cracked = null; st.prevBad = false; st.prevShield = false; st.pendingPen = null;
}
function fail(tr, d, why) {
  tr.status = "failed"; tr.ended = d; tr.st.pendingPen = null;
  ev(tr, d, "fail", why);
}
// after two copies were merged (merge.js): work the run out again from the merged check-ins. Shields this track used
// are given back first and used again where the rules say so; a clear that was already paid isn't paid twice.
function resettle(tr) {
  delete tr._resettle;
  if (tr.status === "archived") return;
  const h = H(), used = Object.keys(tr.st.shielded || {}).length;
  h.shields = Math.min(SHIELD_MAX + used, h.shields + used);
  tr.status = "active"; delete tr.ended;
  tr.st = { settled: addDays(tr.start, -1), run: 0, best: 0, good: 0, bad: 0, cracked: null, prevBad: false, prevShield: false, lastShield: null, shielded: {}, pendingPen: null, events: [] };
  settle(tr);
  h.shields = Math.min(SHIELD_MAX, h.shields);
}
function clear(tr, d) {
  tr.status = "cleared"; tr.ended = d;
  if (tr.reward) { ev(tr, d, "clear", `${tr.reward.g}-rank gate cleared`); return; }   // already paid (e.g. re-checked after a merge)
  const g = gateRank(tr.days || daysBetween(tr.start, d) + 1) || "E", [x, dm] = GATE_REWARD[g];
  award(x, tr.stat, `Gate cleared: ${shown(tr)}`); gems(dm, `${g}-rank gate cleared`);
  const h = H(); h.cleared++;
  if ("DCBAS".includes(g) && h.shields < SHIELD_MAX) { h.shields++; note(d, `🛡 earned: ${g}-rank gate`); }
  for (const [n, name] of TITLES) if (h.cleared >= n && !h.titles.includes(name)) h.titles.push(name);
  ev(tr, d, "clear", `${g}-rank gate cleared · +${x} XP · 💎 ${dm}`);
  tr.reward = { g, x, dm };
}

// ---------- check-ins ----------
export function checkIn(tr, d, v) {
  const before = dayValue(tr, d) === true;
  if (v === null) delete tr.log[d]; else tr.log[d] = v;
  const after = dayValue(tr, d) === true;
  if (!before && after) award(XP.day, tr.stat, `${shown(tr)} ✓`);
  if (before && !after && d === today()) award(-XP.day, tr.stat);
  dailyAll(); save();
}
export function logUnits(tr, n, d = today()) {
  const was = doneToday(tr, d);
  tr.log[d] = Math.max(0, (+tr.log[d] || 0) + n);
  if (n > 0) award(XP.unit * n, tr.stat, `${shown(tr)} +${n} ${tr.unit}`);
  if (!was && doneToday(tr, d) && tr.period === "week") award(XP.week, tr.stat, `${shown(tr)}: week target reached`);
  dailyAll(); save();
}
export function toggleStep(tr, i) {
  const s = tr.steps[i]; s.d = s.d ? null : today();
  if (s.d) award(XP.step, tr.stat, `${shown(tr)}: ${s.t}`);
  save();
}
export function urgeBeaten(tr) { const t = today(); tr.urges[t] = (tr.urges[t] || 0) + 1; award(XP.urge, tr.stat, "Urge defeated"); save(); }
export function penaltyDone(tr) {
  const t = today(); tr.pen[t] = true; tr.st.pendingPen = null;
  if (tr.st.cracked) { tr.st.cracked = null; ev(tr, t, "heal", "Penalty quest done: the crack healed."); }
  award(XP.penalty, tr.stat, "Penalty quest done"); save();
}
/** all of today's quests done → 💎 2 and a small XP bonus, once a day */
function dailyAll() {
  const t = today(), h = H(), list = todayList();
  if (!list.length || h.allDone[t]) return;
  if (list.every(tr => doneToday(tr, t))) { h.allDone[t] = true; gems(2, "All daily quests done"); award(XP.allDone, null, "All daily quests done"); }
}
export const active = () => Object.values(H() && S.tracks).filter(tr => tr.status === "active" && tr.start <= today());
export const todayList = () => active().filter(tr => tr.kind === "target" || tr.kind === "milestone" || scheduled(tr, today()));

// ---------- shields ----------
export function shieldShop() {
  const h = H(), t = today();
  const next = h.boughtAt ? addDays(h.boughtAt, SHIELD_BUY_DAYS) : t;
  const why = h.shields >= SHIELD_MAX ? "full" : next > t ? "wait" : (S.gems || 0) < SHIELD_COST ? "gems" : null;
  return { ok: !why, why, next, cost: SHIELD_COST };
}
export function buyShield() {
  const s = shieldShop(); if (!s.ok) return false;
  const h = H(); S.gems -= SHIELD_COST; h.shields++; h.boughtAt = today();
  (S.gemLog = S.gemLog || []).push({ d: today(), n: -SHIELD_COST, why: "Shield bought" }); note(today(), "🛡 bought"); save();
  return true;
}

/** what a miss or slip would do right now (for the slip sheet) */
export function missOutcome(tr, d = today()) {
  const st = tr.st, h = H();
  if (st.prevBad && !st.prevShield) return "break";
  if (!tr.hard && h.shields > 0 && !st.prevBad && (!st.lastShield || daysBetween(st.lastShield, d) >= SHIELD_TRACK_DAYS)) return "shield";
  return st.cracked ? "break" : "crack";
}
export function reenter(tr) {
  const o = { ...tr, start: today(), steps: tr.steps.map(s => ({ t: s.t, d: null })) };
  tr.status = "archived";
  return newTrack(o);
}
export const cleanDays = (tr, n = 30) => { let c = 0; for (let k = 1; k <= n; k++) { const d = addDays(today(), -k); if (d < tr.start) break; if (dayValue(tr, d) === true) c++; } return c; };

// ---------- party gates (server: /api/party-gates): the full team must survive ----------
export const TEAM_BONUS = { xp: 150, gems: 20 };
export function teamFail(tr, who) {
  if (tr.status !== "active") return;
  tr.status = "failed"; tr.ended = today(); tr.st.pendingPen = null;
  ev(tr, today(), "fail", `${who} run broke, so the whole team falls. You keep the XP you earned.`);
}
export function teamClear(tr) {
  if (tr.teamBonus) return false;
  tr.teamBonus = true;
  award(TEAM_BONUS.xp, tr.stat, `Party gate cleared together: ${shown(tr)}`); gems(TEAM_BONUS.gems, "Party gate cleared together");
  ev(tr, today(), "clear", `The whole party survived · +${TEAM_BONUS.xp} XP · 💎 ${TEAM_BONUS.gems}`);
  return true;
}
/** what this member reports to the party gate */
export function reportOf(tr) {
  const status = tr.status === "active" ? "active" : tr.status === "cleared" ? "cleared" : "failed";
  return { track: tr.id, status, run: tr.st.run, day: Math.max(0, Math.min(dayNo(tr), tr.days || 9999)), today: tr.start <= today() && doneToday(tr),
    cracked: !!tr.st.cracked, date: today(), why: status === "failed" ? String((tr.st.events.at(-1) || {}).txt || "").slice(0, 120) : "" };
}
export const upcoming = () => Object.values(H() && S.tracks).filter(tr => tr.status === "active" && tr.start > today());

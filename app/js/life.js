// Hunter's Path: personal tracks (quests and dungeons) for your own goals. Design: docs/design/personal-tracks.md
// Four kinds: daily (do it on scheduled days), abstain (a clean run: check in "still clean"), target (an amount per week
// or in total), milestone (steps by a date). A track with a length is a gate (dungeon) ranked E–S by that length.
//
// Each day (or week, for weekly targets) is a "slot". Once a slot is over it is settled.
// LIVES (feedback fc61/195a, 11-26; replaces shields, cracks and the 💎 heal): every gate has ❤️ lives by rank:
//   E/D 1, C/B 2, A/S 3, open-ended tracks 2, hard mode 0.
//   good slot → run +1; after 7 good days in a row (2 good weeks for weekly targets) a lost life comes back
//   bad slot  → you lose a life; with none left, the gate fails (an open-ended track starts a new run with full lives)
// "I missed this" (feedback 11-24): a daily or abstain track can be marked missed/slipped today (log "slip"); it settles at once.
// System mode: a miss also gives a penalty quest for the next day (XP when done).
// Gate lengths (feedback bf7a, 11-24): E 7, D 14, C 30, B 45, A 60, S 120. A gate keeps the rank it was created with (`tr.rank`;
// gates made before 11-24 have none and use LEGACY_GATES: B 60, A 90, S 180).
import { S, save, today, addDays, daysBetween, parse } from "./store.js";

export const STATS = { body: ["💪", "Body"], mind: ["🧠", "Mind"], discipline: ["🛡", "Discipline"], health: ["❤️", "Health"] };
export const GATES = [[7, "E"], [14, "D"], [30, "C"], [45, "B"], [60, "A"], [120, "S"]];
export const LEGACY_GATES = [[7, "E"], [14, "D"], [30, "C"], [60, "B"], [90, "A"], [180, "S"]]; // gates created before 11-24 keep these
export const RULES_V = 2; // `tr.v`: rule set a gate was created under (2 = 11-24: hard mode fails on the first miss)
export const GATE_REWARD = { E: [50, 5], D: [100, 10], C: [250, 25], B: [500, 50], A: [900, 80], S: [2000, 150] }; // [XP, 💎]
export const LIVES = { E: 1, D: 1, C: 2, B: 2, A: 3, S: 3 }, LIVES_OPEN = 2, HEAL_DAYS = 7, HEAL_WEEKS = 2;
export const XP = { day: 5, unit: 2, week: 15, urge: 2, penalty: 3, step: 20, allDone: 5 };
export const TITLES = [[1, "Gate Opener"], [3, "Dungeon Runner"], [5, "Gatebreaker"], [10, "Raid Leader"], [20, "Monarch"]]; // gates cleared

export const gateRank = (days, legacy) => { if (!days) return null; let r = "E"; for (const [d, g] of legacy ? LEGACY_GATES : GATES) if (days >= d) r = g; return r; };
/** a rank picked at creation may only be higher than the length's own rank (feedback: "raise rank" when creating a gate) */
export const raisedRank = (days, want) => { const own = gateRank(days), ks = Object.keys(GATE_REWARD);
  return want && ks.indexOf(want) > ks.indexOf(own) ? want : own; };
/** the rank a track was created with (older tracks have no `rank`: they use the old length table) */
export const rankOf = tr => (tr.days ? tr.rank || gateRank(tr.days, true) : null);
export const hardFails = tr => !!tr.hard && (tr.v || 1) >= 2;
/** ❤️ lives a gate starts with (rank; open-ended 2; hard mode 0) */
export const livesMax = tr => (hardFails(tr) ? 0 : tr.days ? LIVES[rankOf(tr)] || 1 : LIVES_OPEN);
/** lives lost and good slots toward the next one back; older tracks (crack state) convert: a crack = one life lost */
const lv = st => { if (st.lost === undefined) { st.lost = st.cracked ? 1 : 0; st.healRun = st.cracked ? st.cracked.heal || 0 : 0; delete st.cracked; } return st; };
export const livesLeft = tr => Math.max(0, livesMax(tr) - lv(tr.st).lost);
/** good slots still needed for a lost life to come back (null when none is lost) */
export const healLeft = tr => (lv(tr.st).lost ? (tr.kind === "target" ? HEAL_WEEKS : HEAL_DAYS) - tr.st.healRun : null);
export const H = () => {
  S.tracks = S.tracks || {};
  S.hunter = S.hunter || {};
  const h = S.hunter;
  if (S.settings && S.settings.quest !== false) S.settings.quest = false; // streak = any day with a check-in (no daily XP goal here)
  h.stats ??= {}; h.cleared ??= 0; h.titles ??= []; h.log ??= []; h.system ??= false; h.allDone ??= {};
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
    hard: !!o.hard, template: o.template || null, auto: o.auto || null, party: o.party || null, v: RULES_V, rank: o.days ? raisedRank(o.days, o.rank) : null,
    log: {}, urges: {}, pen: {}, status: "active",
    st: freshSt(o.start || t),
  };
  H(); S.tracks[id] = tr; save();
  return tr;
}
const freshSt = start => ({ settled: addDays(start, -1), run: 0, best: 0, good: 0, bad: 0, lost: 0, healRun: 0, pendingPen: null, events: [] });
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

// ---------- settle: apply finished slots (lives lost, lives back, fails) ----------
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
    if ((tr.kind === "abstain" || tr.kind === "daily") && tr.log[t] === "slip" && st.settled < t && (!end || t <= end)) slots.push({ d: t, good: false, slip: true });
  }
  lv(st);
  for (const s of slots) {
    if (tr.status !== "active") break;
    changed = true;
    st.settled = s.d;
    if (s.good) {
      st.run++; st.good++; st.best = Math.max(st.best, st.run);
      if (st.lost && ++st.healRun >= (tr.kind === "target" ? HEAL_WEEKS : HEAL_DAYS)) { st.lost--; st.healRun = 0; ev(tr, s.d, "heal", `❤️ A life came back (${livesLeft(tr)} of ${livesMax(tr)}).`); }
      continue;
    }
    st.bad++;
    if (hardFails(tr)) { brk(tr, s.d, "Hard mode: one miss ends the gate."); continue; }
    if (livesLeft(tr) <= 0) { brk(tr, s.d, "A miss with no lives left."); continue; }
    st.lost++; st.healRun = 0;
    if (H().system && tr.penalty) st.pendingPen = addDays(s.d, 1) < t ? t : addDays(s.d, 1);
    ev(tr, s.d, "life", `💔 Lost a life (${livesLeft(tr)} of ${livesMax(tr)} left).`);
  }
  if (tr.status === "active" && end && st.settled >= end) clear(tr, end);
  return changed;
}
function brk(tr, d, why) {
  const st = tr.st;
  if (tr.days) { fail(tr, d, why); return; }
  ev(tr, d, "break", why + " A new run starts.");
  st.run = 0; st.lost = 0; st.healRun = 0; st.pendingPen = null;
}
function fail(tr, d, why) {
  tr.status = "failed"; tr.ended = d; tr.st.pendingPen = null;
  ev(tr, d, "fail", why);
}
// after two copies were merged (merge.js): work the run out again from the merged check-ins; a clear that was already
// paid isn't paid twice.
function resettle(tr) {
  delete tr._resettle;
  if (tr.status === "archived") return;
  tr.status = "active"; delete tr.ended;
  tr.st = freshSt(tr.start);
  settle(tr);
}
function clear(tr, d) {
  tr.status = "cleared"; tr.ended = d;
  if (tr.reward) { ev(tr, d, "clear", `${tr.reward.g}-rank gate cleared`); return; }   // already paid (e.g. re-checked after a merge)
  const g = (tr.days && tr.rank) || gateRank(tr.days || daysBetween(tr.start, d) + 1) || "E", [x, dm] = GATE_REWARD[g];   // a raised rank (feedback 951f) pays its own reward
  award(x, tr.stat, `Gate cleared: ${shown(tr)}`); gems(dm, `${g}-rank gate cleared`);
  const h = H(); h.cleared++;
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

/** what a miss or slip would do right now (for the slip sheet): "life" (lose one) or "break" (gate fails / run restarts) */
export function missOutcome(tr) {
  return hardFails(tr) || livesLeft(tr) <= 0 ? "break" : "life";
}
export function reenter(tr) {
  const o = { ...tr, start: today(), v: undefined, rank: tr.rank, steps: tr.steps.map(s => ({ t: s.t, d: null })) };
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
    cracked: !!lv(tr.st).lost, lives: livesLeft(tr), date: today(), why: status === "failed" ? String((tr.st.events.at(-1) || {}).txt || "").slice(0, 120) : "" };
}
/** You're in a party gate on the server but this device has no track for it (progress reset, new device, lost save):
 *  rebuild it from the gate so it shows on Today again. Days before today count as settled (nothing is judged
 *  retroactively, so a rebuild can never fail the gate for the party); run and crack come from the server. */
export function restoreTrack(g, mine) {
  const sp = g.spec || {}, t = today();
  const tr = newTrack({ kind: g.kind, title: g.title, icon: g.icon, days: g.days, start: g.start, private: false, stat: sp.stat, schedule: sp.schedule,
    amount: sp.amount, unit: sp.unit, period: sp.period, steps: sp.steps || [], penalty: sp.penalty || "" });
  delete S.tracks[tr.id]; tr.id = mine.track; S.tracks[tr.id] = tr;
  tr.pgate = g.id;
  tr.st.settled = g.start < t ? addDays(t, -1) : addDays(g.start, -1);
  tr.st.run = tr.st.best = mine.run || 0;
  if (mine.cracked) tr.st.lost = Math.max(1, livesMax(tr) - (mine.lives ?? livesMax(tr) - 1));
  ev(tr, t, "info", "Restored from your party gate on this device.");
  save();
  return tr;
}
export const upcoming = () => Object.values(H() && S.tracks).filter(tr => tr.status === "active" && tr.start > today());

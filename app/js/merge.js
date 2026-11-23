// Merge two copies of one learner's progress for one course (feedback 11-22: progress made on a phone while offline was
// lost when the website saved first, or overwrote the website's progress). Used when BOTH copies changed since the last
// sync (see store.js: syncBase). Rules per kind of data:
//   things done (lessons, parts, check-ins, gate steps, goal days)  → keep both (union)
//   word memory (spaced repetition)                                 → per word, the copy reviewed last
//   numbers per day (XP, reviews, time)                             → the higher value per day
//   balances with a log (💎)                                        → newer side + the other side's logged changes it lacks
//   Hunter's Path tracks                                            → union of check-ins, then re-checked by the rules (life.js)
//   settings and anything else                                      → the copy saved last
// A reset or a restored backup (resetAt) newer than the other copy wins outright.
const isObj = v => v && typeof v === "object" && !Array.isArray(v);
const keyOf = v => JSON.stringify(v);
const maxMap = (a = {}, b = {}) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = Math.max(+o[k] || 0, +v || 0); return o; };
const unionMap = (a = {}, b = {}) => ({ ...b, ...a });                    // keep a's value when both have it
const unionList = (a = [], b = []) => { const seen = new Set(a.map(keyOf)); return [...a, ...b.filter(x => !seen.has(keyOf(x)))]; };
const laterDate = (a, b) => (!a ? b : !b ? a : a > b ? a : b);
const earlierDate = (a, b) => (!a ? b : !b ? a : a < b ? a : b);

function mergeWords(a = {}, b = {}) {
  const o = { ...a };
  for (const [id, w] of Object.entries(b)) {
    const x = o[id];
    if (!x) { o[id] = w; continue; }
    const la = x.last || x.since || "", lb = w.last || w.since || "";
    o[id] = lb > la || (lb === la && (w.reps || 0) + (w.r || 0) > (x.reps || 0) + (x.r || 0)) ? w : x;
  }
  return o;
}
function mergeBits(a = {}, b = {}) {
  const o = { ...a };
  for (const [id, arr] of Object.entries(b)) {
    const x = o[id] || [];
    o[id] = Array.from({ length: Math.max(x.length, arr.length) }, (_, i) => earlierDate(x[i] || null, arr[i] || null));
  }
  return o;
}
const deepUnion = (a = {}, b = {}) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = isObj(o[k]) && isObj(v) ? { ...v, ...o[k] } : o[k] ?? v; return o; };
function bestOf(a = {}, b = {}) {          // quiz / concept-check scores: best score, XP paid once
  const o = { ...a };
  for (const [k, v] of Object.entries(b)) { const x = o[k]; o[k] = !x ? v : { ...x, ...v, best: Math.max(x.best || 0, v.best || 0), xp: !!(x.xp || v.xp), at: laterDate(x.at, v.at) }; }
  return o;
}
function balance(newer, older, key, logKey) {   // e.g. 💎: newer side's balance + the older side's logged changes it doesn't have
  const seen = new Set((newer[logKey] || []).map(keyOf));
  const extra = (older[logKey] || []).filter(x => !seen.has(keyOf(x)));
  return { value: Math.max(0, (newer[key] || 0) + extra.reduce((s, x) => s + (+x.n || 0), 0)), log: [...(newer[logKey] || []), ...extra] };
}
function mergeTrack(x, y, newerIsY) {
  const n = newerIsY ? y : x, o = newerIsY ? x : y;
  const log = { ...o.log, ...n.log };
  for (const [d, v] of Object.entries(o.log || {})) {                 // an explicit slip beats a tick; bigger counts win
    const w = n.log ? n.log[d] : undefined;
    if (v === "slip" || w === "slip") log[d] = "slip";
    else if (typeof v === "number" && typeof w === "number") log[d] = Math.max(v, w);
    else if (w === undefined || w === null) log[d] = v;
  }
  const steps = (n.steps || []).map((s, i) => ({ ...s, d: earlierDate(s.d, ((o.steps || [])[i] || {}).d) }));
  // giving up (archived) on either device sticks; cleared / failed are worked out again from the merged check-ins
  const status = x.status === "archived" || y.status === "archived" ? "archived" : n.status;
  return { ...n, log, steps, status, urges: maxMap(o.urges, n.urges), pen: unionMap(n.pen, o.pen),
    reward: n.reward || o.reward, mileShields: Math.max(x.mileShields || 0, y.mileShields || 0), teamBonus: !!(n.teamBonus || o.teamBonus), seen: !!(n.seen || o.seen), pgate: n.pgate || o.pgate, _resettle: true };
}
function mergeTracks(a = {}, b = {}, bNewer) {
  const o = { ...a };
  for (const [id, t] of Object.entries(b)) o[id] = o[id] ? mergeTrack(o[id], t, bNewer) : t;
  return o;
}
function mergeHunter(a, b, bNewer) {
  if (!a || !b) return a || b;
  const n = bNewer ? b : a, o = bNewer ? a : b;
  return { ...n, shields: Math.min(2, Math.max(a.shields || 0, b.shields || 0)), healAt: laterDate(a.healAt, b.healAt), stats: maxMap(a.stats, b.stats),
    cleared: Math.max(a.cleared || 0, b.cleared || 0), titles: [...new Set([...(a.titles || []), ...(b.titles || [])])], allDone: unionMap(n.allDone, o.allDone),
    log: unionList(n.log, o.log).sort((p, q) => String(p.d).localeCompare(String(q.d))).slice(-300) };
}

/** merge local and server copies of one course's progress; returns a new object */
export function mergeStates(local, server) {
  if (!local) return server; if (!server) return local;
  // a reset or restored backup newer than everything in the other copy wins outright
  if ((local.resetAt || 0) > (server.updated || 0)) return local;
  if ((server.resetAt || 0) > (local.updated || 0)) return server;
  const bNewer = (server.updated || 0) >= (local.updated || 0), n = bNewer ? server : local, o = bNewer ? local : server;
  const out = { ...o, ...n };                                          // default: the copy saved last
  out.settings = { ...o.settings, ...n.settings };
  out.setup = !!(local.setup || server.setup);
  out.created = earlierDate(local.created, server.created);
  out.words = mergeWords(local.words, server.words);
  out.done = unionMap(n.done, o.done);
  out.bits = mergeBits(local.bits, server.bits);
  out.tree = unionMap(n.tree, o.tree);
  out.parts = deepUnion(n.parts, o.parts);
  out.hit = unionMap(n.hit, o.hit);
  out.questDays = unionMap(n.questDays, o.questDays);
  out.xp = maxMap(local.xp, server.xp);
  out.reviews = maxMap(local.reviews, server.reviews);
  out.pen = maxMap(local.pen, server.pen);
  out.say = maxMap(local.say, server.say);
  out.time = {};
  for (const d of new Set([...Object.keys(local.time || {}), ...Object.keys(server.time || {})])) {
    const p = (local.time || {})[d] || [0, 0], q = (server.time || {})[d] || [0, 0];
    out.time[d] = [Math.max(p[0], q[0]), Math.max(p[1], q[1])];
  }
  out.log = unionList(n.log, o.log).sort((p, q) => String(p.d).localeCompare(String(q.d)));
  out.penLog = unionList(n.penLog, o.penLog).slice(-200);
  out.penChecked = laterDate(local.penChecked, server.penChecked);
  out.gifts = unionList(n.gifts, o.gifts).filter((g, i, arr) => arr.findIndex(x => x.id === g.id) === i)
    .map(g => ({ ...g, opened: (local.gifts || []).concat(server.gifts || []).some(x => x.id === g.id && x.opened) || g.opened }));
  const gm = balance(n, o, "gems", "gemLog"); out.gems = gm.value; out.gemLog = gm.log;
  if (local.quiz || server.quiz) out.quiz = bestOf(local.quiz, server.quiz);
  if (local.cc || server.cc) out.cc = bestOf(local.cc, server.cc);
  if (local.stories || server.stories) out.stories = bestOf(local.stories, server.stories);
  if (local.read || server.read) out.read = { ...o.read, ...n.read };
  if (local.tracks || server.tracks) out.tracks = mergeTracks(local.tracks, server.tracks, bNewer);
  if (local.hunter || server.hunter) out.hunter = mergeHunter(local.hunter, server.hunter, bNewer);
  out.merged = (out.merged || 0) + 1;
  return out;
}

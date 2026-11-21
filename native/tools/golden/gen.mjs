// Golden data for the Kotlin port: runs the REAL web modules (app/js/store.js, lesson.js, lang.js, hero.js) in node
// with jsdom, on fixed fixture states and a fixed "today", and writes what they return to
// native/core/src/test/resources/golden/<course>.json. The Kotlin tests (GoldenStoreTest, GoldenLessonTest) load
// those files, run the same inputs through the Kotlin code and assert the same outputs.
//
//   cd native/tools/golden && npm install && node gen.mjs
//
// It never touches app/: the JS files are copied to .cache/js first (a few private helpers get exported there).
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const APP = path.join(REPO, "app");
const OUT = path.join(REPO, "native/core/src/test/resources/golden");
export const TODAY = "2026-11-21";

// ---------- fixed clock: 21 Nov 2026, 10:00 local ----------
const RealDate = Date;
const NOW = new RealDate(2026, 10, 21, 10, 0, 0).getTime();
class FakeDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(NOW); else super(...a); }
  static now() { return NOW; }
}
globalThis.Date = FakeDate;

// ---------- browser globals the modules touch ----------
const dom = new JSDOM("<!doctype html><html><body><div id=view></div><div id=sheet-root></div></body></html>", { url: "http://localhost/" });
const store = new Map();
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), key: i => [...store.keys()][i], get length() { return store.size; } };
Object.defineProperty(globalThis, "localStorage", { value: globalThis.localStorage });
globalThis.sessionStorage = globalThis.localStorage;
globalThis.Audio = class { pause() {} play() { return Promise.resolve(); } };
globalThis.addEventListener = () => {};
globalThis.fetch = async u => {
  const p = path.join(APP, String(u).split("?")[0]);
  if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => ({}) };
  const txt = fs.readFileSync(p, "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(txt), text: async () => txt };
};

// ---------- copy the web modules, exporting a few private helpers ----------
const CACHE = path.join(HERE, ".cache/js");
fs.mkdirSync(CACHE, { recursive: true });
for (const f of fs.readdirSync(path.join(APP, "js"))) fs.copyFileSync(path.join(APP, "js", f), path.join(CACHE, f));
fs.appendFileSync(path.join(CACHE, "lesson.js"), "\nexport { answerVariants, glossOf, checkSay, lev, sameMeaningDe };\n");
const imp = f => import(pathToFileURL(path.join(CACHE, f)).href);
const SJ = await imp("store.js");
const LJ = await imp("lesson.js");
const HJ = await imp("hero.js");
const LG = await imp("lang.js");

// ---------- helpers ----------
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clone = o => (o === undefined ? null : JSON.parse(JSON.stringify(o)));
const add = SJ.addDays;
const docText = html => { const d = document.createElement("div"); d.innerHTML = html; return d.textContent.replace(/\s+/g, " ").trim(); };

// ---------- fixture states (built from the course's real path) ----------
function fixtures(course) {
  const C = SJ.C, P = C.content.path, out = [];
  const T = TODAY;
  const srsWord = (r, since) => {
    const ivl = [0, 1, 3, 7, 14, 30, 60][Math.floor(r() * 7)];
    const due = add(T, Math.floor(r() * 30) - 20);
    const s = { ivl, ef: Math.round((1.3 + r() * 1.7) * 100) / 100, reps: Math.floor(r() * 6), lapses: Math.floor(r() * 3), due, since, r: Math.floor(r() * 8), w: Math.floor(r() * 4) };
    if (r() < 0.6) s.last = add(due, -Math.max(1, ivl));
    if (r() < 0.15) s.lapsed = true;
    return s;
  };
  // 1. fresh learner who just did the setup
  out.push({ name: "fresh", state: { v: 2, created: add(T, -1), updated: 1, setup: true,
    settings: { startDate: add(T, -1), targetDate: "2027-02-21", dailyGoal: 20, goalMode: "auto", hindi: true, autoplay: true, sound: true, theme: "system", quest: true, speak: true, xp2: true, pb3: true, streakFrom: "2026-11-20" },
    words: {}, done: {}, log: [], xp: {}, reviews: {}, pen: {}, penLog: [], penChecked: add(T, -1), lastLv: 1, gems: 0, gifts: [], questDays: {}, gemLog: [], bits: {}, tree: {}, parts: {}, say: {}, hit: {}, time: {} } });

  // 2./3. learners with history (seeded), quest on / off, auto / manual goal
  const learner = (name, seed, nItems, opts = {}) => {
    const r = rng(seed), st = SJ.blank();
    st.created = add(T, -40); st.updated = 1000 + seed; st.setup = true;
    st.settings.startDate = add(T, -30); st.settings.targetDate = opts.target || "2027-01-31";
    st.settings.pb3 = true; st.settings.streakFrom = "2026-11-20";
    if (opts.manual) { st.settings.goalMode = "manual"; st.settings.dailyGoal = opts.manual; }
    if (opts.questOff) st.settings.quest = false;
    st.extraField = { keep: "me", n: [1, 2, 3] }; // unknown fields must survive a round trip
    st.settings.futureSetting = "x";
    let day = -29;
    for (const it of P.slice(0, nItems)) {
      day = Math.min(0, day + Math.floor(r() * 3));
      const d = add(T, day);
      const B = SJ.bitsOf(it);
      const full = r() < 0.75;
      const nb = full ? B.length : Math.max(1, Math.floor(r() * B.length));
      if (it.kind !== "grammar") {
        st.bits[it.id] = B.map((_, k) => (k < nb ? d : null));
        B.slice(0, nb).forEach((ids, k) => st.log.push({ d, id: it.id, bit: k, xp: 3 + ids.length }));
      } else st.log.push({ d, id: it.id, xp: 3 });
      if (full || it.kind === "grammar") st.done[it.id] = { date: d, score: 60 + Math.floor(r() * 41), last: d };
      if (it.kind === "vocab") B.slice(0, nb).flat().forEach(id => (st.words[id] = srsWord(r, d)));
    }
    for (let k = 0; k < 30; k++) {
      const d = add(T, -k);
      if (r() < 0.75) st.xp[d] = Math.floor(r() * 45);
      if (r() < 0.5) st.reviews[d] = Math.floor(r() * 25);
      if (st.xp[d] >= 20 && d >= "2026-11-20") st.hit[d] = 20;
      if (r() < 0.6) st.time[d] = [Math.floor(r() * 2400), Math.floor(r() * 1800)];
    }
    st.xp[T] = opts.xpToday != null ? opts.xpToday : 7;
    if (opts.pen) { st.pen[add(T, -5)] = 4; st.penLog.push({ d: add(T, -5), xp: 4, why: "Missed reviews (12 words were due)" }); }
    st.penChecked = opts.penChecked || add(T, -4);
    st.say = { "Guten Morgen!": 2, "Bonjour !": 1 };
    st.gems = 15; st.questDays = { [add(T, -2)]: true };
    return st;
  };
  out.push({ name: "early", state: learner("early", 11, 9) });
  out.push({ name: "mid-manual", state: learner("mid-manual", 23, 35, { manual: 30, pen: true, target: "2027-03-15" }) });
  out.push({ name: "quest-off", state: learner("quest-off", 37, 20, { questOff: true, penChecked: add(T, -9) }) });

  // 4. an old-format save: Leitner boxes, no xp2 / pb3 / streakFrom, a grammar chapter finished before parts, 5-phrase bits
  const old = { v: 2, created: "2026-11-01", updated: 5, setup: true,
    settings: { startDate: "2026-11-01", targetDate: "2027-01-31", dailyGoal: 50, goalMode: "manual", hindi: false, autoplay: true, sound: true, theme: "calm" },
    words: {}, done: {}, log: [], xp: { [add(T, -1)]: 30, [T]: 12 }, reviews: {}, pen: {}, penLog: [], penChecked: null, lastLv: 3 };
  const v1 = P.find(i => i.kind === "vocab");
  v1.words.forEach((id, k) => (old.words[id] = { box: k % 5, due: add(T, (k % 7) - 3), r: k, w: k % 2 }));
  const g = P.find(i => i.gid);
  if (g) old.done[g.gid] = { date: add(T, -6), score: 80 };
  const ph = P.find(i => i.kind === "phrases" && C.phrases[i.id].items.length >= 8);
  if (ph) old.bits = { [ph.id]: [add(T, -3), null] };
  out.push({ name: "old-format", state: old });

  // 5. A1 complete: everything done, every word healthy (level ≥ 100, a1XP recorded on first look)
  const all = learner("all", 51, P.length);
  for (const it of P) { all.done[it.id] = all.done[it.id] || { date: add(T, -3), score: 100, last: add(T, -3) }; if (it.kind !== "grammar") all.bits[it.id] = SJ.bitsOf(it).map(() => add(T, -3)); }
  for (const w of C.content.words) all.words[w.id] = { ivl: 40, ef: 2.6, reps: 5, lapses: 0, due: add(T, 30), since: "2026-11-01", r: 5, w: 0, last: add(T, -10) };
  for (let k = 0; k < 60; k++) all.xp[add(T, -k)] = 60;
  out.push({ name: "a1-done", state: all });
  return out;
}

// ---------- everything the Kotlin port must reproduce for one state ----------
function stateOutputs(raw) {
  SJ.importState(JSON.stringify(raw));
  const S = SJ.S, C = SJ.C;
  const o = {};
  o.normalized = clone(S);
  const pr = SJ.progress(S);
  o.progress = pr;
  o.memory = SJ.memory(S);
  o.retention = SJ.retention(S);
  o.history = SJ.history(S);
  o.pace = SJ.pace(S);
  o.level = SJ.level(pr.total, clone(S));
  o.levelCoverage = SJ.level(pr.coverage, clone(S));
  o.rank = SJ.rank(pr.total);
  o.streak = SJ.streak(S);
  o.totalXP = SJ.totalXP(S);
  o.xpToday = SJ.xpToday(S);
  o.dueWords = SJ.dueWords(S);
  o.autoGoal = SJ.autoGoal(S);
  o.remainingXP = SJ.remainingXP(S);
  o.remainingParts = SJ.remainingParts(S);
  o.goalFor = SJ.goalFor(S);
  // web bug: partsGoal() throws in manual goal mode when goalDay was never set (goalFor returns early) -> null here
  try { o.partsGoal = SJ.partsGoal(S); } catch { o.partsGoal = null; }
  o.partsToday = SJ.partsToday(S);
  o.goalDay = clone(S.goalDay);
  const nx = SJ.nextPick(S); o.nextPick = nx ? nx.id : null;
  const ni = C.content.path.find(i => !S.done[i.id]); o.nextItem = ni ? ni.id : null;
  o.lastPartToday = SJ.lastPartToday(S);
  o.planParts = SJ.planParts(6, S).map(p => ({ id: p.it.id, k: p.k, ids: p.ids }));
  const wp = SJ.weekPlan(S); o.weekPlan = { nWeeks: wp.nWeeks, of: wp.of, weeks: wp.weeks.map(w => ({ n: w.n, from: w.from, to: w.to, items: w.items.map(i => i.id) })) };
  o.thisWeek = SJ.thisWeek();
  o.wordStatus = Object.fromEntries(Object.keys(S.words).map(id => [id, SJ.wordStatus(id, S)]));
  o.health = Object.fromEntries(Object.entries(S.words).map(([id, s]) => [id, SJ.health(s)]));
  o.dayCounts = Object.fromEntries(Array.from({ length: 12 }, (_, k) => add(TODAY, -k)).map(d => [d, SJ.dayCounts(d, S)]));
  try { o.summary = SJ.summary(clone(S)); } catch { o.summary = null; }
  o.bitsDone = Object.fromEntries(C.content.path.slice(0, 40).map(i => [i.id, SJ.bitsDone(i, S)]));
  // mutations, in this order, on the live state
  const lost = SJ.checkMissed();
  o.checkMissed = { lost, pen: clone(S.pen), penLog: clone(S.penLog), penChecked: S.penChecked };
  const rw = SJ.checkRewards(true);
  o.checkRewards = { gems: rw.gems, gifts: rw.gifts.map(g => ({ id: g.id, m: g.m, tier: g.tier })), total: S.gems };
  o.after = clone(S);
  return o;
}

function mutationScript() {
  // grade / learn / complete sequences on a fresh state
  SJ.importState(JSON.stringify({ ...SJ.blank(), setup: true, settings: { ...SJ.blank().settings, pb3: true, streakFrom: TODAY } }));
  const S = SJ.S, C = SJ.C, P = C.content.path, out = [];
  const v = P.find(i => i.kind === "vocab"), w0 = v.words[0], w1 = v.words[1];
  SJ.learnWord(w0); out.push({ op: "learn", id: w0, s: clone(S.words[w0]) });
  for (const g of [3, 3, 4, 2, 1, 3, 4, 4, 2, 3]) { const ivl = SJ.gradeWord(w0, g); out.push({ op: "grade", id: w0, g, ivl, s: clone(S.words[w0]) }); }
  for (const g of [1, 2, 4]) { const ivl = SJ.gradeWord(w1, g); out.push({ op: "grade", id: w1, g, ivl, s: clone(S.words[w1]) }); }
  const B = SJ.bitsOf(v);
  for (let i = 0; i < B.length; i++) { const done = SJ.completeBit(v, i, 90, 0); out.push({ op: "bit", id: v.id, i, done, bits: clone(S.bits[v.id]), d: clone(S.done[v.id] || null) }); }
  const g = P.find(i => i.kind === "grammar");
  out.push({ op: "item", id: g.id, first: SJ.completeItem(g.id, 75, 3), d: clone(S.done[g.id]) });
  out.push({ op: "item", id: g.id, first: SJ.completeItem(g.id, 100, 1), d: clone(S.done[g.id]) });
  SJ.addXP(12); out.push({ op: "xp", xp: clone(S.xp), hit: clone(S.hit) });
  SJ.addPenalty(4, "test"); out.push({ op: "pen", pen: clone(S.pen), total: SJ.totalXP(S) });
  return out;
}

// sample SRS cards for nextIvl
const IVL_CARDS = [{ ivl: 0, ef: 2.5, reps: 0 }, { ivl: 1, ef: 2.5, reps: 1 }, { ivl: 3, ef: 2.36, reps: 2 }, { ivl: 8, ef: 1.3, reps: 3 }, { ivl: 20, ef: 3, reps: 4 },
  { box: 3, w: 1 }, { box: 0 }, { box: 7, w: 2 }, { ivl: 120, ef: 2.65, reps: 9 }];

function lessonOutputs(course) {
  const C = SJ.C, W = C.content.words, r = rng(99);
  const o = {};
  o.nextIvl = IVL_CARDS.map(s => [1, 2, 3, 4].map(g => SJ.nextIvl(s, g)));
  // norm / meanings
  const sampleW = W.filter((_, i) => i % 3 === 0);
  o.norm = sampleW.flatMap(w => [w.de, w.en, ...(w.ex || []).map(e => e.de)]).slice(0, 600).map(s => [s, LJ.norm(s)]);
  o.meanings = sampleW.map(w => [w.en, [...LJ.meanings(w.en)]]);
  const pairs = [];
  for (let k = 0; k < 1500; k++) { const a = W[Math.floor(r() * W.length)], b = W[Math.floor(r() * W.length)]; pairs.push([a.en, b.en, LJ.overlaps(a.en, b.en)]); }
  // same-topic pairs hit the interesting cases (synonyms, contained meanings)
  for (let i = 0; i + 1 < W.length; i += 2) pairs.push([W[i].en, W[i + 1].en, LJ.overlaps(W[i].en, W[i + 1].en)]);
  o.overlaps = pairs;
  // typed answers: exact, typo, no article, wrong article, no accents, junk
  const typed = [];
  const typo = s => s.length > 4 ? s.slice(0, 2) + s.slice(3) : s + "x";
  const strip = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const w of W.filter((_, i) => i % 4 === 0)) {
    const ans = [w.type_ans || w.de, ...LJ.sameMeaningDe(w)];
    const m = LG.L.splitArt(w.de);
    const cands = [w.de, typo(w.de), w.de.toUpperCase(), strip(w.de), "", "zzz", m ? m[1] : w.de + " x", m ? (m[0] === "der" ? "die" : m[0] === "le" ? "la" : "der") + " " + m[1] : w.en];
    for (const c of cands) typed.push({ input: c, answers: ans, r: LJ.checkTyped(c, ans) });
  }
  o.checkTyped = typed;
  o.sameMeaningDe = W.filter((_, i) => i % 5 === 0).map(w => [w.id, LJ.sameMeaningDe(w)]);
  // grammar answers
  o.answerVariants = C.content.grammar.flatMap(g => g.q.map(q => [q.a, LJ.answerVariants(q.a)]));
  // phrases
  o.sayItems = C.content.phrases.flatMap(p => p.items.map(it => [it, LJ.sayItems(it)]));
  const says = [];
  for (const p of C.content.phrases.flatMap(p => p.items)) for (const x of LJ.sayItems(p)) for (const c of [x.de, typo(x.de), x.de.toLowerCase().replace(/[.!?]/g, ""), strip(x.de), "nein"]) says.push({ input: c, answers: x.answers, r: LJ.checkSay(c, x.answers) });
  o.checkSay = says;
  // gloss (tap a word): every token of the first examples
  const toks = new Set();
  for (const w of W.slice(0, 400)) for (const e of w.ex || []) e.de.split(/\s+/).forEach(t => toks.add(t));
  o.gloss = [...toks].slice(0, 1500).flatMap(t => [[t, true, LJ.glossOf(t, true)], [t, false, LJ.glossOf(t, false)]]);
  o.speakable = C.content.phrases.flatMap(p => p.items.map(it => [it.de, LJ.speakable(it)]));
  o.phone = ["Hello (on the phone)", "on the phone", "nothing"].map(s => [s, LJ.phone(s)]);
  o.numWord = Array.from({ length: 1001 }, (_, n) => n).filter(n => n < 130 || n % 37 === 0).map(n => [n, LG.L.numWord(n)]);
  o.spellDE = ["ANNA", "TAHA", "BATUL", "JÖRG", "LEA", "YUSUF"].map(n => [n, SJ.spellDE(n)]);
  o.bitsOf = C.content.path.map(i => [i.id, SJ.bitsOf(i)]);
  return o;
}

function courseOutputs() {
  const C = SJ.C;
  const o = {};
  o.path = C.content.path.map(i => ({ id: i.id, kind: i.kind, title: i.title, n: i.n ?? null, gid: i.gid ?? null, part: i.part ?? null, of: i.of ?? null }));
  o.grammarParts = C.content.grammar.map(g => ({ id: g.id, parts: (g.parts || SJ.splitGrammar(g)).map(p => ({ t: p.t, q: p.q, text: docText(p.html) })) }));
  o.itemWeights = SJ.itemWeights();
  o.gparts = C.gparts;
  return o;
}

fs.mkdirSync(OUT, { recursive: true });
await SJ.loadCourses();
for (const course of ["de-a1", "fr-a1"]) {
  SJ.setCourse(course);
  await SJ.loadContent(course);
  const course_ = courseOutputs();
  const fx = fixtures(course);
  const states = fx.map(f => ({ name: f.name, input: clone(f.state), out: stateOutputs(clone(f.state)) }));
  const mutations = mutationScript();
  const lesson = lessonOutputs(course);
  const file = path.join(OUT, `${course}.json`);
  fs.writeFileSync(file, JSON.stringify({ today: TODAY, course, ...course_, states, mutations, lesson }));
  console.log(`${course}: ${states.length} states, ${course_.path.length} path items -> ${path.relative(REPO, file)} (${Math.round(fs.statSync(file).size / 1024)} KB)`);
}
// hero.js (course independent)
const hero = Array.from({ length: 130 }, (_, k) => k + 1).map(lv => [lv, HJ.aura(lv), HJ.auraName(lv), HJ.stageFor(lv)]);
fs.writeFileSync(path.join(OUT, "hero.json"), JSON.stringify({ hero }));
console.log("hero.json written");

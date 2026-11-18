// Exercise engine: vocab lessons, reviews, grammar practice, phrase sections.
import { C, S, save, today, addXP, xpToday, totalXP, level, progress, learnWord, gradeWord, nextIvl, addPenalty, GRADES, completeItem, bitsOf, completeBit, goalFor } from "./store.js";
import { play, blip } from "./audio.js";
import { heroHTML, applyAura, auraName, STAGES, stageFor, form } from "./hero.js";

// ---------- tiny helpers ----------
export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a, n) => shuffle(a).slice(0, n);
const ART = { m: "der", f: "die", n: "das", pl: "die" };

export function deHTML(w) {
  const m = w.g && w.de.match(/^(der|die|das) (.*)$/);
  return m ? `<span class="art ${w.g}">${m[1]}</span> ${esc(m[2])}` : esc(w.de);
}
const nounOnly = w => w.de.replace(/^(der|die|das) /, "");
const canGender = w => w.g && /^(der|die|das) [^\s/()]+$/.test(w.de);

export function norm(s) {
  return String(s).toLowerCase().normalize("NFC")
    .replace(/ß/g, "ss").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
    .replace(/[…‑–—\-.,!?;:„“"'’()]/g, " ").replace(/\s+/g, " ").trim();
}
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// returns {ok, note}
export function checkTyped(input, answers) {
  const x = norm(input);
  if (!x) return { ok: false };
  for (const a of answers) {
    const y = norm(a);
    if (x === y) return { ok: true };
    if (y.length >= 5 && lev(x, y) === 1) return { ok: true, note: "Small typo – correct: " + a };
  }
  for (const a of answers) {
    const m = a.match(/^(der|die|das) (.+)$/);
    if (m && norm(m[2]) === x) return { ok: false, note: `Don't forget the article: ${m[1]} ${m[2]}` };
    if (m && norm(m[2]) === x.replace(/^(der|die|das) /, "")) return { ok: false, note: `Wrong article – it's ${m[1]} ${m[2]}` };
  }
  return { ok: false };
}
function answerVariants(a) {
  const parts = [a, ...a.split(/\s+\/\s+|;\s*|\s+or\s+/)];
  return [...new Set(parts.map(s => s.trim()).filter(Boolean))];
}

// "hello / good day (polite)" → {"hello", "good day"}; used so no wrong option is secretly also right
const _tok = new Map();
const SYN = { bye: "goodbye", hi: "hello", hey: "hello", thanks: "thank you", "many thanks": "thank you", cheers: "thank you", ok: "okay", sorry: "sorry" };
export function meanings(en) {
  if (_tok.has(en)) return _tok.get(en);
  const t = new Set(String(en).toLowerCase().replace(/\([^)]*\)/g, " ").split(/[;,/]|\bor\b/)
    .map(x => x.replace(/[!?.…"“”'’]/g, "").replace(/^\s*(to|a|an|the|i am|im|i)\s+/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean).map(x => SYN[x] || x));
  _tok.set(en, t);
  return t;
}
// same meaning, or one meaning contained word-for-word in the other ("sorry" ⊂ "i'm sorry")
const contains = (a, b) => a.length > b.length && b.length >= 3 && (" " + a + " ").includes(" " + b + " ");
export const overlaps = (a, b) => {
  const A = meanings(a), B = meanings(b);
  for (const x of A) for (const y of B) if (x === y || contains(x, y) || contains(y, x)) return true;
  return false;
};
const baseDe = de => norm(String(de).replace(/\([^)]*\)/g, ""));
// other words that are an equally correct German answer for this English prompt
function sameMeaningDe(w) {
  const first = [...meanings(w.en)][0];
  return C.content.words.filter(x => x.id !== w.id && first && meanings(x.en).has(first)).map(x => x.type_ans || x.de);
}

function distractors(w, field, n = 3) {
  const all = C.content.words;
  const val = x => field === "en" ? x.en : x.de;
  const seen = new Set([norm(val(w))]);
  const bad = x => overlaps(x.en, w.en) || baseDe(x.de) === baseDe(w.de);
  const pools = [all.filter(x => x.topic === w.topic && x.type === w.type), all.filter(x => x.type === w.type), all];
  const out = [];
  for (const pool of pools) for (const x of shuffle(pool)) {
    if (out.length >= n) break;
    const k = norm(val(x));
    if (x.id === w.id || seen.has(k) || bad(x) || out.some(o => overlaps(o.en, x.en))) continue;
    seen.add(k); out.push(x);
  }
  return out;
}

// ---------- word card ----------
export function wordCard(w, { examples = 3 } = {}) {
  const g = w.g ? `<span class="gtag ${w.g}">${w.g === "pl" ? "PLURAL" : ART[w.g].toUpperCase()}</span>` : "";
  const meta = [];
  if (w.pl) meta.push(`<div><b>Plural:</b> ${esc(w.pl)}</div>`);
  if (w.forms) meta.push(`<div><b>Forms:</b> ${esc(w.forms)}</div>`);
  if (w.perf) meta.push(`<div><b>Perfekt:</b> ${esc(w.perf)}</div>`);
  if (w.labels) meta.push(`<div class="chips">${w.labels.map(l => `<span class="chip">${esc(l)}</span>`).join("")}</div>`);
  const ex = (w.ex || []).slice(0, examples).map(e => `
    <div class="ex"><button class="spk sm" data-a="${e.a || ""}" data-t="${esc(e.de)}">🔊</button>
    <div class="t"><div>${esc(e.de)}</div><div class="muted small">${esc(e.en)}</div></div></div>`).join("");
  return `<div class="wcard">
    <div class="row"><div class="grow">${g}<span class="muted tiny">${esc(w.type)}${w.core ? " · ★ core" : ""}</span>
      <div class="de">${deHTML(w)}</div></div>
      <button class="spk" data-a="${w.a || ""}" data-t="${esc(w.de)}">🔊</button></div>
    <div class="hint">🗣 ${esc(w.hint || "")}${S.settings.hindi && w.hintHi ? ` · <span class="hi">${esc(w.hintHi)}</span>` : ""}</div>
    <div class="en">${esc(w.en)}</div>
    ${meta.length ? `<div class="meta">${meta.join("")}</div>` : ""}
    ${ex}
    ${(w.notes || []).map(n => `<div class="note">💡 ${esc(n)}</div>`).join("")}
  </div>`;
}
export function wireSpeakers(root) {
  root.querySelectorAll("[data-a],[data-t]").forEach(b => {
    if (b.tagName !== "BUTTON") return;
    b.onclick = e => { e.stopPropagation(); play(b.dataset.a, b.dataset.t); };
  });
}

// ---------- step builders ----------
const st = {
  intro: w => ({ t: "intro", w }),
  de_en: w => ({ t: "mc", w, dir: "de_en" }),
  en_de: w => ({ t: "mc", w, dir: "en_de" }),
  listen: w => ({ t: "listen", w }),
  type: w => ({ t: "type", w }),
  gender: w => ({ t: "gender", w }),
};
function hardStep(w, i) {
  const opts = ["en_de"];
  if (w.a) opts.push("listen");
  if (w.type_ans) opts.push("type");
  if (canGender(w)) opts.push("gender");
  return st[opts[i % opts.length]](w);
}

// ---- sentences from the word list's examples ----
const TOKEN_OK = /^[A-Za-zÄÖÜäöüß0-9,.!?'’ \-–]+$/;
const tokens = de => de.replace(/[.,!?]/g, " ").split(/\s+/).filter(Boolean);
function sentenceFor(w, maxTok = 8) {
  const ok = (w.ex || []).filter(e => TOKEN_OK.test(e.de) && !/[()…=/]/.test(e.de) && tokens(e.de).length >= 3 && tokens(e.de).length <= maxTok);
  return ok.length ? ok[Math.floor(Math.random() * ok.length)] : null;
}
const coreWord = w => w.de.replace(/^(der|die|das) /, "").replace(/\s*\(.*$/, "").trim();
function clozeFor(w) {
  const core = coreWord(w);
  if (!core || /\s|\//.test(core)) return null;
  const ex = (w.ex || []).filter(e => TOKEN_OK.test(e.de) && tokens(e.de).some(t => t.toLowerCase() === core.toLowerCase()) && tokens(e.de).length <= 10);
  if (!ex.length) return null;
  const e = ex[Math.floor(Math.random() * ex.length)];
  const others = [];
  for (const x of shuffle(C.content.words)) {
    if (others.length >= 3) break;
    const c = coreWord(x);
    if (x.id === w.id || x.type !== w.type || /\s|\//.test(c) || !c || overlaps(x.en, w.en) || others.includes(c) || c.toLowerCase() === core.toLowerCase()) continue;
    if (tokens(e.de).some(t => t.toLowerCase() === c.toLowerCase())) continue;
    others.push(c);
  }
  return others.length >= 2 ? { t: "cloze", w, ex: e, ans: tokens(e.de).find(t => t.toLowerCase() === core.toLowerCase()), opts: [core, ...others] } : null;
}
// does a sentence token belong to this word? exact core, or same stem for inflected forms (dauern → dauert)
function tokenIs(tok, w) {
  const t = tok.toLowerCase(), c = coreWord(w).toLowerCase();
  if (!c || /\s|\//.test(c)) return false;
  if (t === c) return true;
  const stem = c.replace(/(en|er|e|n)$/, "");
  return stem.length >= 3 && t.length >= 3 && (t.startsWith(stem) && t.length - stem.length <= 3);
}
// Build the sentence: only words the learner knows (this part's words + already learned ones) become tiles;
// everything else is pre-filled so they are never asked to place words they haven't met.
function buildFor(w, pool) {
  const known = [...new Map([...pool, ...Object.keys((S && S.words) || {}).map(id => C.word[id]).filter(Boolean)].map(x => [x.id, x])).values()];
  const cands = (w.ex || []).filter(e => TOKEN_OK.test(e.de) && !/[()…=/]/.test(e.de) && tokens(e.de).length >= 3 && tokens(e.de).length <= 10);
  for (const e of shuffle(cands)) {
    const toks = tokens(e.de);
    const ti = toks.findIndex(t => tokenIs(t, w));
    if (ti < 0) continue; // the lesson word must be one of the blanks
    const slots = toks.map((t, i) => ({ tok: t, blank: i === ti || t.toLowerCase() === toks[ti].toLowerCase() || (known.some(k => k.id !== w.id && tokenIs(t, k)) && t.length > 2) }));
    const blanks = slots.filter(x => x.blank).map(x => x.tok);
    if (blanks.length > 4) slots.forEach((x, i) => { if (x.blank && i !== ti && slots.filter(y => y.blank).length > 4) x.blank = false; });
    const low = new Set(toks.map(t => t.toLowerCase()));
    const extra = [];
    for (const k of shuffle(known)) {
      if (extra.length >= 2) break;
      const c = coreWord(k);
      if (!c || /\s|\//.test(c) || k.id === w.id || low.has(c.toLowerCase()) || extra.includes(c) || overlaps(k.en, w.en)) continue;
      extra.push(c);
    }
    const ans = slots.filter(x => x.blank).map(x => x.tok);
    return { t: "build", w, ex: e, slots, ans, tiles: shuffle([...ans, ...extra]) };
  }
  return null;
}
// ---- "Say it in German": the learner gets a situation (English) and produces the whole phrase ----
// Stage 0 (new phrase): word bubbles. Once they've got it right: a mix of bubbles and typing it out,
// with typing more likely the more often they've succeeded (S.say[phrase] = successes).
const isSentence = x => /^[A-ZÄÖÜ0-9]/.test(x) && /[.!?]$/.test(x);
export function sayItems(p) {
  if (/[…()=]/.test(p.de)) return [];
  const de = p.de.split(/\s+\/\s+/), notes = [...p.en.matchAll(/\(([^)]*)\)/g)].map(m => m[1]);
  const en = p.en.replace(/\s*\([^)]*\)/g, "").trim().split(/\s+\/\s+/);
  if (!de.every(isSentence)) return [];
  let out;
  if (de.length > 1 && en.length === de.length) out = de.map((d, i) => ({ de: d, en: en[i], answers: [d] }));
  else if (en.length === 1) out = [{ de: de[0], en: en[0], answers: de }];
  else return [];
  return out.filter(x => TOKEN_OK.test(x.de) && tokens(x.de).length >= 2 && tokens(x.de).length <= 10)
    .map(x => ({ ...x, note: notes.join("; "), ctx: p.grp || "", a: de.length === 1 ? p.a : null }));
}
export function sayStep(p, pool, { forceTiles = false } = {}) {
  const its = sayItems(p); if (!its.length) return null;
  const it = its[Math.floor(Math.random() * its.length)];
  const n = ((S && S.say) || {})[it.de] || 0;
  const mode = forceTiles || n === 0 ? "tiles" : Math.random() < Math.min(0.65, 0.35 + 0.1 * n) ? "type" : "tiles";
  const toks = tokens(it.de), have = new Set(toks.map(norm)), extra = [];
  const want = toks.length <= 3 ? 2 : 3;
  for (const q of shuffle(pool)) {
    for (const t of shuffle(tokens(q.de.replace(/[…()=/]/g, " ")))) {
      if (extra.length >= want) break;
      if (t.length > 1 && !have.has(norm(t)) && !extra.some(e => norm(e) === norm(t))) extra.push(t);
    }
    if (extra.length >= want) break;
  }
  return { t: "say", ...it, mode, key: "s:" + it.de, tiles: shuffle([...toks, ...extra]) };
}
// Long phrase, first time: most words are already in place; the learner fills only 2-3 key words.
export function guidedSayStep(p, pool) {
  const its = sayItems(p).filter(x => tokens(x.de).length > 5); if (!its.length) return null;
  const it = its[Math.floor(Math.random() * its.length)], toks = tokens(it.de);
  const k = Math.min(3, toks.length - 3), seen = new Set(), pickIdx = [];
  for (const i of toks.map((t, i) => i).sort((a, b) => toks[b].length - toks[a].length)) {
    const low = toks[i].toLowerCase();
    if (pickIdx.length >= k) break;
    if (seen.has(low)) continue;
    seen.add(low); pickIdx.push(i);
  }
  const blanks = new Set(pickIdx), slots = toks.map((t, i) => ({ tok: t, blank: blanks.has(i) }));
  const ans = slots.filter(x => x.blank).map(x => x.tok), have = new Set(toks.map(norm)), extra = [];
  for (const q of shuffle(pool)) {
    for (const t of tokens(q.de.replace(/[…()=/]/g, " "))) {
      if (extra.length >= 2) break;
      if (t.length > 2 && !have.has(norm(t)) && !extra.some(e => norm(e) === norm(t))) extra.push(t);
    }
    if (extra.length >= 2) break;
  }
  return { t: "build", ex: { de: it.de, en: it.en, a: it.a }, slots, ans, tiles: shuffle([...ans, ...extra]), sayDe: it.de };
}
function checkSay(input, answers) {
  const x = norm(input);
  if (!x) return { ok: false };
  for (const a of answers) {
    const y = norm(a);
    if (x === y) return { ok: true };
    if (y.length >= 5 && lev(x, y) <= Math.max(1, Math.floor(y.length / 12))) return { ok: true, note: "Small typo – correct: " + a };
  }
  return { ok: false };
}
function matchStep(ws) {
  const mws = [];
  for (const x of shuffle(ws)) if (mws.length < 5 && !mws.some(o => overlaps(o.en, x.en) || baseDe(o.de) === baseDe(x.de))) mws.push(x);
  return mws.length >= 3 ? { t: "match", ws: mws } : null;
}
// One bit: teach a word → test it right away → next word → mix → sentences → final round
export function vocabBitSteps(item, bit) {
  const ids = bitsOf(item)[bit], ws = ids.map(id => C.word[id]);
  const steps = [];
  ws.forEach((w, i) => {
    steps.push(st.intro(w));
    steps.push(i % 2 ? st.en_de(w) : st.de_en(w));          // test the new word right away
    if (i >= 1) {                                          // then mix with what came before
      const prev = ws[Math.floor(Math.random() * i)];
      steps.push(prev.a && Math.random() < 0.5 ? st.listen(prev) : canGender(prev) ? st.gender(prev) : st.en_de(prev));
    }
  });
  const m = matchStep(ws); if (m) steps.push(m);
  // sentence work: one build + one gap-fill where possible
  const sb = shuffle(ws).map(w => buildFor(w, ws)).find(Boolean); if (sb) steps.push(sb);
  const sc = shuffle(ws).map(clozeFor).find(Boolean); if (sc) steps.push(sc);
  shuffle(ws).forEach((w, i) => steps.push(hardStep(w, i + Math.floor(Math.random() * 4))));
  const sb2 = shuffle(ws).filter(w => !sb || w.id !== sb.w.id).map(w => buildFor(w, ws)).find(Boolean); if (sb2) steps.push(sb2);
  return steps;
}
export function vocabSteps(item) { return bitsOf(item).flatMap((_, i) => vocabBitSteps(item, i)); }
// Active recall: retrieve the answer before seeing it, then grade yourself (Again / Hard / Good / Easy).
export function reviewSteps(ids) {
  return shuffle(ids).map((id, i) => {
    const w = C.word[id], st = S.words[id] || {};
    const r = Math.random();
    const dir = w.type_ans && (st.reps || 0) >= 1 && r < 0.35 ? "type" : w.a && r > 0.8 ? "de_en" : "en_de";
    return { t: "recall", w, dir };
  });
}

// ---------- runner ----------
let R = null; // current run
const view = () => document.getElementById("view");

export function runLesson({ title, steps, kind, onFinish }) {
  document.body.classList.add("in-lesson");
  if (location.hash !== "#/lesson") history.pushState(null, "", "#/lesson");
  R = { title, steps: [...steps], i: 0, done: 0, total: steps.length, right: 0, answered: 0, wrongIds: new Set(),
        retried: new Set(), firstTry: {}, grades: [0, 0, 0, 0, 0], combo: 0, best: 0, words: new Set(), kind, onFinish, t0: Date.now() };
  render();
}
export function abortLesson() { R = null; document.body.classList.remove("in-lesson"); }
export const inLesson = () => !!R;
// Snapshot of the current exercise for bug reports (no answers needed, just what was on screen).
export function lessonDebug() {
  if (!R) return null;
  const s = R.steps[R.i] || {};
  const item = s.w ? { id: s.w.id, de: s.w.de, en: s.w.en } : s.p ? { de: s.p.de, en: s.p.en } : s.de ? { de: s.de, en: s.en } : s.q ? { q: s.q.q } : null;
  return { title: R.title, kind: R.kind, step: R.i + 1, of: R.total, type: s.t, mode: s.mode || s.dir || null, retry: !!s.retry, item, right: R.right, answered: R.answered };
}

function header() {
  const pct = Math.min(100, 100 * R.done / R.total);
  return `<div class="lesson-top"><button class="x" id="quit">✕</button><div class="bar"><div style="width:${pct}%"></div></div></div>`;
}

function render() {
  if (!R) return;
  const s = R.steps[R.i];
  if (!s) return finish();
  const v = view();
  v.innerHTML = header() + `<div class="lesson-body" id="lb"></div>`;
  v.querySelector("#quit").onclick = () => confirmQuit();
  const lb = v.querySelector("#lb");
  lb.classList.add("arming"); setTimeout(() => lb.classList.remove("arming"), 450);
  window.scrollTo(0, 0);
  if (s.w) R.words.add(s.w.id);
  ({ intro, mc, listen, type, gender, match, gq, gmc, flip, read, recall, build, cloze, say }[s.t])(s, lb);
}

function confirmQuit() {
  const root = document.getElementById("sheet-root");
  root.innerHTML = `<div class="sheet-bg"><div class="sheet"><h2 style="margin-top:0">Quit this lesson?</h2>
    <p class="muted">Your answers in this lesson won't be saved.</p>
    <button class="btn" id="stay">Keep learning</button><button class="btn ghost" id="leave">Quit</button></div></div>`;
  root.querySelector("#stay").onclick = () => (root.innerHTML = "");
  root.querySelector("#leave").onclick = () => { root.innerHTML = ""; abortLesson(); location.hash = "#/today"; };
}

function foot(html) {
  const f = document.createElement("div");
  f.className = "lesson-foot arming"; f.innerHTML = html;
  setTimeout(() => f.classList.remove("arming"), 450);
  view().appendChild(f);
  return f;
}

function next() { R.i++; R.done++; render(); }

// record an answer, show feedback, requeue on miss
function answered(s, ok, { correctHTML = "", note = "", allowOverride = false } = {}) {
  const key = s.key || (s.w ? s.w.id : s.q ? s.q.q : String(R.i));
  const first = !(key in R.firstTry);
  if (first) R.firstTry[key] = ok;
  if (!s.retry) { R.answered++; if (ok) R.right++; }
  R.combo = ok ? R.combo + 1 : 0; R.best = Math.max(R.best, R.combo);
  const comboMsg = ok && COMBO[R.combo] ? COMBO[R.combo] : "";
  if (!ok && s.w) R.wrongIds.add(s.w.id);
  const sayKey = s.t === "say" ? s.de : s.sayDe;
  if (sayKey && !s.retry) (R.say = R.say || {})[sayKey] = ok;
  if (!ok && (s.w || sayKey) && !s.retry && !R.retried.has(key)) {
    R.retried.add(key);
    R.steps.push(s.t === "say" ? { ...s, retry: true, mode: "tiles" } : s.sayDe ? { ...s, retry: true } : { ...s, retry: true, t: s.t === "type" ? "mc" : s.t, dir: s.dir || "en_de" });
    R.total++;
  }
  blip(ok);
  if (s.w && s.t !== "listen" && (s.t !== "mc" || s.dir === "en_de" || !ok)) play(s.w.a, s.w.de);
  const f = document.createElement("div");
  f.className = "feedback " + (ok ? "ok" : "bad");
  f.innerHTML = `<h3>${ok ? pick(["Super!", "Richtig!", "Sehr gut!", "Genau!", "Prima!"], 1)[0] : "Not quite"}</h3>
    ${correctHTML && !ok ? `<p>Correct answer: <b>${correctHTML}</b></p>` : ""}
    ${note ? `<p>${esc(note)}</p>` : ""}
    ${comboMsg ? `<p class="combo">${comboMsg}</p>` : ""}
    ${allowOverride && !ok ? `<button class="link" id="ov">I was right – count it</button>` : ""}
    <button class="btn ${ok ? "" : "red"}" id="go">Continue</button>`;
  document.querySelectorAll(".lesson-foot").forEach(x => x.remove());
  view().appendChild(f);
  const ov = f.querySelector("#ov");
  if (ov) ov.onclick = () => { R.right++; R.firstTry[key] = true; if (s.t === "say" && R.say && !s.retry) R.say[s.de] = true; next(); };
  f.querySelector("#go").onclick = next;
  f.querySelector("#go").focus();
}

const COMBO = { 3: "🔥 3 in a row – nice!", 5: "🔥 5 in a row – you're on fire!", 8: "⚡ 8 in a row – unstoppable!", 12: "🌟 12 in a row – are you secretly German?", 20: "🚀 20 in a row – legendary focus!" };

// ---------- step renderers ----------
function intro(s, lb) {
  lb.innerHTML = `<div class="q-title">New word</div><div class="card">${wordCard(s.w)}</div>`;
  wireSpeakers(lb);
  if (S.settings.autoplay) play(s.w.a, s.w.de);
  foot(`<button class="btn" id="go">Got it</button>`).querySelector("#go").onclick = next;
}

function options(lb, items, correctIdx, onPick, cls = "") {
  const box = document.createElement("div");
  box.className = "opts " + cls;
  box.innerHTML = items.map((h, i) => `<button class="opt" data-i="${i}">${h}</button>`).join("");
  lb.appendChild(box);
  box.querySelectorAll(".opt").forEach(b => (b.onclick = () => {
    if (box.dataset.locked) return;
    box.dataset.locked = 1;
    const i = +b.dataset.i;
    box.querySelectorAll(".opt").forEach((o, k) => o.classList.add(k === correctIdx ? "right" : k === i ? "wrong" : "dim"));
    onPick(i === correctIdx);
  }));
}

function mc(s, lb) {
  const w = s.w, field = s.dir === "de_en" ? "en" : "de";
  const opts = shuffle([w, ...distractors(w, field)]);
  const ci = opts.indexOf(w);
  if (s.dir === "de_en") {
    lb.innerHTML = `<div class="q-title">What does this mean?</div>
      <div class="prompt"><button class="spk" data-a="${w.a || ""}" data-t="${esc(w.de)}">🔊</button><div class="big">${deHTML(w)}</div></div>`;
    wireSpeakers(lb);
    if (S.settings.autoplay) play(w.a, w.de);
    options(lb, opts.map(o => esc(o.en)), ci, ok => answered(s, ok, { correctHTML: esc(w.en) }));
  } else {
    lb.innerHTML = `<div class="q-title">Choose the German</div><div class="prompt"><div class="big">${esc(w.en)}</div></div>`;
    options(lb, opts.map(o => esc(o.de)), ci, ok => answered(s, ok, { correctHTML: esc(w.de) }));
  }
}

function listen(s, lb) {
  const w = s.w;
  const opts = shuffle([w, ...distractors(w, "de")]);
  lb.innerHTML = `<div class="q-title">What do you hear?</div><button class="spk xl" data-a="${w.a || ""}" data-t="${esc(w.de)}">🔊</button>`;
  wireSpeakers(lb);
  setTimeout(() => play(w.a, w.de), 250);
  options(lb, opts.map(o => esc(o.de)), opts.indexOf(w), ok => answered(s, ok, { correctHTML: `${esc(w.de)} = ${esc(w.en)}`, note: ok ? w.en : "" }));
}

function gender(s, lb) {
  const w = s.w, art = ART[w.g];
  lb.innerHTML = `<div class="q-title">der, die or das?</div>
    <div class="prompt"><div class="big">___ ${esc(nounOnly(w))}</div></div><p class="muted">${esc(w.en)}</p>`;
  const arts = ["der", "die", "das"];
  options(lb, arts.map(a => `<span class="art ${{ der: "m", die: "f", das: "n" }[a]}">${a}</span>`), arts.indexOf(art),
    ok => answered(s, ok, { correctHTML: deHTML(w), note: w.g === "pl" ? "Plural-only noun → die" : "" }), "g3");
}

function type(s, lb) {
  const w = s.w;
  lb.innerHTML = `<div class="q-title">Write this in German</div><div class="prompt"><div class="big">${esc(w.en)}</div></div>
    <input class="type" id="inp" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${w.g ? "with der / die / das" : "Type in German"}">
    <div class="uml">${["ä", "ö", "ü", "ß"].map(c => `<button data-c="${c}">${c}</button>`).join("")}</div>`;
  const inp = lb.querySelector("#inp");
  lb.querySelectorAll(".uml button").forEach(b => (b.onclick = () => { inp.value += b.dataset.c; inp.focus(); upd(); }));
  const f = foot(`<button class="btn" id="chk" disabled>Check</button>`);
  const btn = f.querySelector("#chk");
  const upd = () => (btn.disabled = !inp.value.trim());
  inp.oninput = upd;
  const go = () => {
    if (btn.disabled) return;
    inp.disabled = true;
    const r = checkTyped(inp.value, [w.type_ans || w.de, ...sameMeaningDe(w)]);
    answered(s, r.ok, { correctHTML: deHTML(w), note: r.note });
  };
  btn.onclick = go;
  inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); go(); } };
  setTimeout(() => inp.focus(), 50);
}

function match(s, lb) {
  const ws = s.ws;
  const L = shuffle(ws), Rr = shuffle(ws);
  lb.innerHTML = `<div class="q-title">Tap the matching pairs</div><div class="opts match" id="m"></div>`;
  const m = lb.querySelector("#m");
  for (let i = 0; i < ws.length; i++) {
    m.insertAdjacentHTML("beforeend", `<button class="opt" data-s="L" data-id="${L[i].id}">${esc(L[i].de)}</button><button class="opt" data-s="R" data-id="${Rr[i].id}">${esc(Rr[i].en)}</button>`);
  }
  let sel = null, left = ws.length, misses = 0;
  m.querySelectorAll(".opt").forEach(b => (b.onclick = () => {
    if (b.classList.contains("right")) return;
    if (b.dataset.s === "L") play(C.word[b.dataset.id].a, C.word[b.dataset.id].de);
    if (!sel || sel.dataset.s === b.dataset.s) {
      if (sel) sel.classList.remove("sel");
      sel = b; b.classList.add("sel"); return;
    }
    const a = sel, ok = a.dataset.id === b.dataset.id;
    sel = null; a.classList.remove("sel");
    if (ok) {
      [a, b].forEach(x => x.classList.add("right"));
      setTimeout(() => [a, b].forEach(x => x.classList.add("gone")), 350);
      if (--left === 0) { blip(true); setTimeout(() => answered({ t: "match", key: "match" + Math.random() }, misses === 0), 450); }
    } else {
      misses++; blip(false);
      [a, b].forEach(x => x.classList.add("wrong"));
      setTimeout(() => [a, b].forEach(x => x.classList.remove("wrong")), 500);
    }
  }));
}

// grammar question (typed, lenient, with override)
function gq(s, lb) {
  lb.innerHTML = `<div class="q-title">Practice ${s.n}/${s.of}</div><div class="card"><div style="font-size:19px;font-weight:700">${esc(s.q.q)}</div></div>
    <input class="type" id="inp" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Your answer">
    <div class="uml">${["ä", "ö", "ü", "ß"].map(c => `<button data-c="${c}">${c}</button>`).join("")}</div>`;
  const inp = lb.querySelector("#inp");
  lb.querySelectorAll(".uml button").forEach(b => (b.onclick = () => { inp.value += b.dataset.c; inp.focus(); }));
  const f = foot(`<button class="btn" id="chk">Check</button>`);
  const go = () => {
    inp.disabled = true;
    const r = checkTyped(inp.value, answerVariants(s.q.a));
    answered(s, r.ok, { correctHTML: esc(s.q.a), note: r.note, allowOverride: true });
  };
  f.querySelector("#chk").onclick = go;
  inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); go(); } };
  setTimeout(() => inp.focus(), 50);
}

const fmtIvl = d => d < 1 ? "<1d" : d < 30 ? `${d}d` : d < 365 ? `${Math.round(d / 30)}mo` : "1y";
function recall(s, lb) {
  const w = s.w;
  const promptHTML = s.dir === "de_en"
    ? `<div class="q-title">What does this German word mean? <span class="muted small">(think of it, then check)</span></div>
       <div class="prompt"><button class="spk" data-a="${w.a || ""}" data-t="${esc(w.de)}">🔊</button><div class="big">${deHTML(w)}</div></div>`
    : `<div class="q-title">${s.dir === "type" ? "Type the German" : "Recall the German"} ${w.g ? '<span class="muted small">(with der / die / das)</span>' : ""}</div>
       <div class="prompt"><div class="big">${esc(w.en)}</div></div>`;
  lb.innerHTML = promptHTML + (s.dir === "type" ? `<input class="type" id="inp" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type in German">
    <div class="uml">${["ä", "ö", "ü", "ß"].map(c => `<button data-c="${c}">${c}</button>`).join("")}</div>` :
    `<p class="muted small r-hint" style="text-align:center;margin-top:30px">Say the answer out loud or in your head first – that's what makes it stick.</p>`);
  wireSpeakers(lb);
  if (s.dir === "de_en" && S.settings.autoplay) play(w.a, w.de);
  let suggested = 3, note = "";
  const reveal = () => {
    if (s.dir === "type") {
      const inp = lb.querySelector("#inp"); inp.disabled = true;
      const r = checkTyped(inp.value, [w.type_ans || w.de, ...sameMeaningDe(w)]);
      suggested = r.ok ? (r.note ? 2 : 3) : (r.note && /article/i.test(r.note) ? 2 : 1);
      note = r.ok ? (r.note || "Correct!") : (r.note || "Not quite.");
      blip(r.ok);
    }
    const ans = s.dir === "de_en" ? esc(w.en) : deHTML(w);
    lb.querySelector(".r-hint") && lb.querySelector(".r-hint").remove();
    lb.insertAdjacentHTML("beforeend", `<div class="answer-box"><span class="tiny muted">Answer</span><div>${ans}</div></div>${note ? `<div class="note" style="margin:10px 0">${esc(note)}</div>` : ""}<div class="card" style="margin-top:10px">${wordCard(w, { examples: 1 })}</div>`);
    wireSpeakers(lb);
    play(w.a, w.de);
    const st = S.words[w.id] || { ivl: 0, ef: 2.5, reps: 0 };
    f.innerHTML = `<div class="small muted" style="text-align:center;margin-bottom:8px">How well did you remember it?</div><div class="grades">${[1, 2, 3, 4].map(g =>
      `<button class="gr g${g} ${s.dir === "type" && g === suggested ? "sug" : ""}" data-g="${g}"><b>${GRADES[g]}</b><span>${s.relearn ? "" : fmtIvl(g === 1 ? 0 : nextIvl(st, g))}</span></button>`).join("")}</div>`;
    f.querySelectorAll(".gr").forEach(b => (b.onclick = () => grade(+b.dataset.g)));
  };
  const grade = g => {
    if (!s.relearn) {
      gradeWord(w.id, g);
      R.grades[g]++; R.answered++; if (g >= 3) R.right++;
      if (g === 1) R.wrongIds.add(w.id);
    }
    if (g === 1 && !s.relearn) { R.steps.push({ ...s, dir: "en_de", relearn: true }); R.total++; }
    next();
  };
  const f = foot(`<button class="btn blue" id="show">${s.dir === "type" ? "Check" : "Show answer"}</button>`);
  f.querySelector("#show").onclick = reveal;
  if (s.dir === "type") {
    const inp = lb.querySelector("#inp");
    lb.querySelectorAll(".uml button").forEach(b => (b.onclick = () => { inp.value += b.dataset.c; inp.focus(); }));
    inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); if (!inp.disabled) reveal(); } };
    setTimeout(() => inp.focus(), 50);
  }
}

// grammar multiple choice, optionally with a listening prompt (e.g. "which letter do you hear?")
function gmc(s, lb) {
  const q = s.q, opts = shuffle(q.opts);
  lb.innerHTML = `<div class="q-title">Practice ${s.n}/${s.of}</div><div class="card"><div style="font-size:19px;font-weight:700">${esc(q.q)}</div></div>
    ${q.audio ? `<button class="spk xl" data-a="${q.audio}" data-t="${esc(q.say || "")}">🔊</button>` : ""}`;
  wireSpeakers(lb);
  if (q.audio) setTimeout(() => play(q.audio, q.say), 250);
  options(lb, opts.map(o => esc(o)), opts.indexOf(q.a), ok => answered(s, ok, { correctHTML: esc(q.a), note: q.note || "" }), q.opts.every(o => o.length <= 2) ? "g2" : "");
}

// phrase flip card (self-rated)
function flip(s, lb) {
  const p = s.p;
  lb.innerHTML = `<div class="q-title">${esc(s.sec)}${p.grp ? ` · <span class="muted">${esc(p.grp)}</span>` : ""}</div>
    <div class="card flip" id="fc"><div class="row" style="justify-content:center"><div class="de">${esc(p.de)}</div></div>
    <div class="en" id="en">Tap to see the meaning</div></div>
    <div style="text-align:center"><button class="spk" data-a="${p.a || ""}" data-t="${esc(p.de)}">🔊</button></div>`;
  wireSpeakers(lb);
  if (S.settings.autoplay) play(p.a, p.de);
  const f = foot(`<button class="btn blue" id="show">Show meaning</button>`);
  const reveal = () => {
    lb.querySelector("#en").textContent = p.en;
    lb.querySelector("#en").style.color = "var(--ink)";
    f.innerHTML = `<div class="row"><button class="btn ghost grow" id="no">Still learning</button><button class="btn grow" id="yes" style="margin-top:0">I knew it</button></div>`;
    f.querySelector("#yes").onclick = () => { R.answered++; R.right++; next(); };
    f.querySelector("#no").onclick = () => { R.answered++; next(); };
  };
  lb.querySelector("#fc").onclick = reveal;
  f.querySelector("#show").onclick = reveal;
}
// phrase MC (pre-built options)
function read(s, lb) {
  lb.innerHTML = `<div class="q-title">${esc(s.title)}</div>`;
  const opts = shuffle([s.p, ...s.others]);
  if (s.listen) {
    lb.insertAdjacentHTML("beforeend", `<button class="spk xl" data-a="${s.p.a || ""}" data-t="${esc(s.p.de)}">🔊</button>`);
    wireSpeakers(lb); setTimeout(() => play(s.p.a, s.p.de), 250);
    options(lb, opts.map(o => esc(o.en)), opts.indexOf(s.p), ok => { answered({ ...s, key: s.p.de }, ok, { correctHTML: esc(s.p.en) }); });
  } else {
    lb.insertAdjacentHTML("beforeend", `<div class="prompt"><div class="big" style="font-size:21px">${esc(s.p.en)}</div></div>`);
    options(lb, opts.map(o => esc(o.de)), opts.indexOf(s.p), ok => { answered({ ...s, key: s.p.de }, ok, { correctHTML: esc(s.p.de) }); play(s.p.a, s.p.de); });
  }
}

// ---------- tap a German word in a question to see what it means (Batul's request) ----------
// Meanings come from the word list; common forms the list doesn't hold (ist, den, mir, zum…) come from FORMS.
const FORMS = { ist: "is", bin: "am", bist: "are", sind: "are", seid: "are", war: "was", hat: "has", habe: "have", hast: "have", habt: "have",
  den: "the", dem: "the", des: "of the", einen: "a, an", einem: "a, an", eines: "of a", du: "you", mich: "me", mir: "(to) me",
  dich: "you", dir: "(to) you", uns: "us", euch: "you (plural)", im: "in the", am: "at the, on the", zum: "to the", zur: "to the",
  vom: "from the", beim: "at the", ins: "into the" };
let _gIdx = null;
function glossIndex() {
  if (_gIdx) return _gIdx;
  _gIdx = new Map();
  const add = (k, w) => { k = k.replace(/^(der|die|das)\s+/i, "").replace(/^-+|-+$/g, "").trim().toLowerCase(); if (k && !/\s/.test(k) && !_gIdx.has(k)) _gIdx.set(k, w); };
  for (const w of C.content.words) {
    const parts = String(w.de).replace(/[()]/g, ",").split(/[\/,]/);
    if (parts.some(k => /\s/.test(k.replace(/^\s*(der|die|das)\s+/i, "").trim()))) continue;   // phrases ("Berlin, zwölfter Vierter …") are not single words
    parts.forEach(k => add(k, w));
    if (w.pl) String(w.pl).split(/[\/,]/).forEach(k => add(k, w));
  }
  return _gIdx;
}
const firstMeaning = en => String(en).split(/;/)[0].trim();
function glossOf(tok, first) {
  const t = tok.replace(/[^\p{L}ß]/gu, ""), low = t.toLowerCase(), idx = glossIndex();
  if (!t) return null;
  if (!first && /^Ihr(e|en|em|er|es)?$/.test(t)) return "your (formal)";
  if (!first && t === "Sie") return "you (formal)";
  const hit = k => idx.get(k);
  let w = hit(low);
  if (!w && FORMS[low]) return FORMS[low];
  for (const suf of ["en", "em", "er", "es", "e", "n", "s", "st", "t"]) {
    if (w) break;
    if (low.endsWith(suf) && low.length - suf.length >= 3) { const st = low.slice(0, -suf.length); w = hit(st) || hit(st + "en") || hit(st + "n"); }
  }
  if (!w) w = hit(low + "en") || hit(low + "n");
  return w ? `${w.de} = ${firstMeaning(w.en)}` : null;
}
// a German token as HTML; known words get a dotted underline and show their meaning when tapped
function glossTok(tok, first) {
  const g = glossOf(tok, first);
  return g ? `<span class="gw" data-g="${esc(g)}">${esc(tok)}</span>` : esc(tok);
}
function wireGloss(root) {
  root.addEventListener("click", e => {
    const el = e.target.closest(".gw"); document.querySelectorAll(".gloss").forEach(x => x.remove());
    if (!el) return;
    const r = el.getBoundingClientRect(), b = document.createElement("div");
    b.className = "gloss"; b.textContent = el.dataset.g; document.body.appendChild(b);
    const x = Math.max(8, Math.min(window.innerWidth - b.offsetWidth - 8, r.left + r.width / 2 - b.offsetWidth / 2));
    b.style.left = x + "px"; b.style.top = (window.scrollY + r.top - b.offsetHeight - 8) + "px";
    setTimeout(() => b.remove(), 3500);
  });
}

// Build the sentence: pre-filled words stay in place; tap tiles to fill the blanks in order
function build(s, lb) {
  lb.innerHTML = `<div class="q-title">Complete the sentence</div>
    <div class="prompt"><div class="big" style="font-size:20px">${esc(s.ex.en)}</div></div>
    <div class="answer-line" id="ans">${s.slots.map((x, i) => x.blank ? `<span class="slot" data-k="${i}"></span>` : `<span class="fixed">${glossTok(x.tok, i === 0)}</span>`).join("")}</div>
    <div class="tiles-bank" id="bank">${s.tiles.map((t, i) => `<button class="tile-w" data-i="${i}">${esc(t)}</button>`).join("")}</div>`;
  wireGloss(lb.querySelector("#ans"));
  const slots = [...lb.querySelectorAll(".slot")];
  const f = foot(`<button class="btn" id="chk" disabled>Check</button>`), btn = f.querySelector("#chk");
  const upd = () => (btn.disabled = slots.some(x => !x.dataset.i));
  lb.querySelectorAll("#bank .tile-w").forEach(b => (b.onclick = () => {
    if (b.classList.contains("used")) return;
    const slot = slots.find(x => !x.dataset.i); if (!slot) return;
    b.classList.add("used"); slot.dataset.i = b.dataset.i; slot.textContent = b.textContent; slot.classList.add("filled");
    upd();
  }));
  slots.forEach(slot => (slot.onclick = () => {
    if (!slot.dataset.i || btn.dataset.done) return;
    lb.querySelector(`#bank .tile-w[data-i="${slot.dataset.i}"]`).classList.remove("used");
    delete slot.dataset.i; slot.textContent = ""; slot.classList.remove("filled"); upd();
  }));
  btn.onclick = () => {
    btn.dataset.done = 1;
    const got = slots.map(x => x.textContent);
    const ok = got.length === s.ans.length && got.every((g, i) => norm(g) === norm(s.ans[i]));
    play(s.ex.a, s.ex.de);
    answered({ ...s, key: "b:" + s.ex.de }, ok, { correctHTML: esc(s.ex.de), allowOverride: s.ans.length > 1,
      note: ok || s.ans.length < 2 ? "" : "German word order can vary – if yours is also correct, tap “I was right”." });
  };
}
// Say it in German: build the whole phrase from word bubbles, or type it out
function say(s, lb) {
  const hint = [s.ctx, s.note].filter(Boolean).map(esc).join(" · ");
  lb.innerHTML = `<div class="q-title">Say it in German</div>
    <div class="prompt"><div class="big" style="font-size:21px">${esc(s.en)}</div>${hint ? `<div class="muted small" style="margin-top:6px">${hint}</div>` : ""}</div>
    ${s.mode === "tiles"
      ? `<div class="answer-line" id="ans"></div><div class="tiles-bank" id="bank">${s.tiles.map((t, i) => `<button class="tile-w" data-i="${i}">${esc(t)}</button>`).join("")}</div>`
      : `<div class="muted small" style="margin-bottom:6px">Type the whole sentence</div>
         <input class="type" id="inp" autocomplete="off" autocapitalize="sentences" spellcheck="false" placeholder="Type in German">
         <div class="uml">${["ä", "ö", "ü", "ß"].map(c => `<button data-c="${c}">${c}</button>`).join("")}</div>`}`;
  const f = foot(`<button class="btn" id="chk" disabled>Check</button>`), btn = f.querySelector("#chk");
  const finishSay = (ok, note = "") => {
    play(s.a, s.de);
    answered(s, ok, { correctHTML: esc(s.answers.join("  /  ")), note: note || (ok ? "" : "If yours means the same with a different word order, tap “I was right”."), allowOverride: true });
  };
  if (s.mode === "tiles") {
    const ans = lb.querySelector("#ans"), placed = [];
    const draw = () => {
      ans.innerHTML = placed.map((i, k) => `<button class="tile-w" data-k="${k}">${esc(s.tiles[i])}</button>`).join("");
      ans.querySelectorAll(".tile-w").forEach(b => (b.onclick = () => {
        if (btn.dataset.done) return;
        const i = placed.splice(+b.dataset.k, 1)[0];
        lb.querySelector(`#bank .tile-w[data-i="${i}"]`).classList.remove("used"); draw();
      }));
      btn.disabled = !placed.length;
    };
    lb.querySelectorAll("#bank .tile-w").forEach(b => (b.onclick = () => {
      if (b.classList.contains("used") || btn.dataset.done) return;
      b.classList.add("used"); placed.push(+b.dataset.i); draw();
    }));
    btn.onclick = () => {
      if (btn.dataset.done) return; btn.dataset.done = 1;
      const got = placed.map(i => s.tiles[i]).join(" ");
      finishSay(s.answers.some(a => norm(a) === norm(got)));
    };
  } else {
    const inp = lb.querySelector("#inp");
    const upd = () => (btn.disabled = !inp.value.trim());
    lb.querySelectorAll(".uml button").forEach(b => (b.onclick = () => { inp.value += b.dataset.c; inp.focus(); upd(); }));
    inp.oninput = upd;
    const go = () => { if (btn.disabled || btn.dataset.done) return; btn.dataset.done = 1; inp.disabled = true; const r = checkSay(inp.value, s.answers); finishSay(r.ok, r.note); };
    btn.onclick = go;
    inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); go(); } };
    setTimeout(() => inp.focus(), 50);
  }
}
// Fill the gap: choose the missing word (English translation shown as a hint)
function cloze(s, lb) {
  const toks = s.ex.de.split(/(\s+)/);
  let blanked = false;
  const sent = toks.map((t, k) => { const bare = t.replace(/[.,!?]/g, ""); if (!blanked && bare.toLowerCase() === s.ans.toLowerCase()) { blanked = true; return t.replace(bare, "<span class=\"gap\">____</span>"); } return /\S/.test(t) ? glossTok(t, k === 0) : esc(t); }).join("");
  lb.innerHTML = `<div class="q-title">Fill the gap</div><div class="card"><div style="font-size:20px;font-weight:700" id="csent">${sent}</div>
    <div class="muted" style="margin-top:6px;font-size:20px">${esc(s.ex.en)}</div></div>`;
  wireGloss(lb.querySelector("#csent"));
  const opts = shuffle(s.opts);
  options(lb, opts.map(o => esc(o)), opts.indexOf(s.opts[0]), ok => { play(s.ex.a, s.ex.de); answered({ ...s, key: "c:" + s.ex.de }, ok, { correctHTML: esc(s.ex.de) }); });
}

// ---------- finishing ----------
function finish() {
  const r = R; R = null;
  const acc = r.answered ? Math.round(100 * r.right / r.answered) : 100;
  const before = xpToday(), lvBefore = level(progress().total).lv;
  const xp = r.onFinish ? r.onFinish(r, acc) : 0;
  const lvAfter = level(progress().total).lv;
  applyAura(lvAfter);
  const goal = goalFor(); const goalHit = before < goal && xpToday() >= goal;
  const mins = Math.max(1, Math.round((Date.now() - r.t0) / 60000));
  const perfect = r.answered > 0 && r.right >= r.answered && r.kind !== "review";
  const cheer = cheerFor(acc, perfect);
  const words = [...r.words].map(id => C.word[id]).filter(Boolean);
  if (r.failed) {
    view().innerHTML = `<div class="done-wrap"><div class="sysbanner">Good effort</div><div class="cheer-art">💪</div>
      <h1>Nice try — one more go!</h1>
      <p class="cheer">You got <b>${r.right}</b> right this time${r.best > 1 ? ` and a best streak of ${r.best}` : ""}. One more round and this part is yours — it counts once you reach ${PASS_ACC}%.</p>
      <p class="muted small">${esc(r.title)}</p>
      <div class="tiles"><div class="tile"><b style="color:#ffc800">+${xp}</b><span>XP</span></div>
      <div class="tile"><b style="color:var(--amber)">${acc}%</b><span>Accuracy</span></div>
      <div class="tile"><b style="color:#ff9f43">${r.best}</b><span>Best combo</span></div></div>
      ${r.wrongIds.size ? `<p class="muted small">Words to watch: ${[...r.wrongIds].slice(0, 8).map(id => esc(C.word[id].de)).join(", ")}</p>` : ""}</div>`;
    const ft = foot(`<div class="row"><button class="btn ghost grow" id="home" style="margin-top:0">Later</button><button class="btn grow" id="again" style="margin-top:0">Try again</button></div>`);
    ft.querySelector("#home").onclick = () => { document.body.classList.remove("in-lesson"); location.hash = "#/today"; };
    ft.querySelector("#again").onclick = r.retry;
    return;
  }
  view().innerHTML = `<div class="done-wrap"><div class="sysbanner">${r.kind === "review" ? "Training complete" : "Quest cleared"}</div>
    ${lvAfter < lvBefore ? `<div class="levelup" style="color:#ff8ea3;text-shadow:0 0 14px #ff4d6d">LEVEL DOWN</div><p class="muted">Level ${lvBefore} → ${lvAfter}: forgotten words count less until you recall them again.</p>` : ""}
    ${r.kind === "review" ? `<p class="small muted">Again ${r.grades[1]} · Hard ${r.grades[2]} · Good ${r.grades[3]} · Easy ${r.grades[4]}</p>` : ""}
    ${lvAfter > lvBefore ? `<div class="levelup">LEVEL UP!</div><p class="muted" style="letter-spacing:2px">LEVEL ${lvBefore} → <b style="color:#9fd6ff">${lvAfter}</b></p>
      <div class="hero-done">${heroHTML(lvAfter, "big")}${stageFor(lvAfter) > stageFor(lvBefore)
        ? evolveCard(form(stageFor(lvAfter)))
        : `<div class="hero-cap">Your aura grows stronger · <b>${auraName(lvAfter)}</b></div>`}</div>` : ""}<div class="cheer-art">${cheer.art}</div>
    <h1>${perfect ? "Perfect!" : r.kind === "review" ? "Review done!" : r.lessonDone ? "Lesson complete!" : r.bitOf ? `Part ${r.bitOf[0]} of ${r.bitOf[1]} done!` : "Well done!"}</h1>
    <p class="cheer">${esc(cheer.line)}</p>
    <p class="muted small">${esc(r.title)}</p>
    <div class="tiles"><div class="tile"><b style="color:${xp < 0 ? "var(--red)" : "#ffc800"}">${xp < 0 ? "" : "+"}${xp}</b><span>XP</span></div>
    <div class="tile"><b style="color:var(--green)">${acc}%</b><span>Accuracy</span></div>
    <div class="tile"><b style="color:#ff9f43">${r.best}</b><span>Best combo</span></div></div>
    ${words.length ? `<div class="card" style="text-align:left"><div style="font-weight:800;margin-bottom:6px">🗣 ${words.length} word${words.length > 1 ? "s" : ""} practised · ${mins} min</div>
      <div class="chips">${words.map(w => `<button class="chip spkchip" data-a="${w.a || ""}" data-t="${esc(w.de)}">🔊 ${esc(w.de)}</button>`).join("")}</div></div>` : ""}
    ${goalHit ? `<div class="card" style="background:var(--amber-l)">🎯 <b>Daily goal reached!</b> Your streak is safe for today.</div>` : ""}
    ${r.wrongIds.size ? `<p class="muted small">Words to watch: ${[...r.wrongIds].slice(0, 8).map(id => esc(C.word[id].de)).join(", ")}</p>` : ""}
  </div>`;
  wireSpeakers(view());
  const ft = foot(r.nextBit ? `<div class="row"><button class="btn ghost grow" id="home" style="margin-top:0">Later</button><button class="btn grow" id="nb" style="margin-top:0">Next part ›</button></div>`
    : `<button class="btn" id="go">Continue</button>`);
  const home = () => { document.body.classList.remove("in-lesson"); location.hash = "#/today"; };
  (ft.querySelector("#go") || ft.querySelector("#home")).onclick = home;
  const nb = ft.querySelector("#nb"); if (nb) nb.onclick = r.nextBit;
}
function evolveCard(f) {
  return `<div class="evolve">✦ Your form has evolved ✦<br><b>${f.name}</b> · ${f.r}-Rank</div>
    <div class="formcard"><div class="row" style="justify-content:center;gap:8px"><span class="fde">${esc(f.de)}</span>
      <button class="spk sm" data-t="${esc(f.de)}" aria-label="Hear it in German">🔊</button></div>
      <div class="fmean">🇬🇧 <b>${esc(f.name)}</b> – ${esc(f.en)}</div>
      <div class="fmean">🇩🇪 <b>${esc(f.de)}</b> – ${esc(f.deMean)}</div></div>`;
}
const CHEERS = {
  perfect: [["🧠✨", "Flawless! Your neurons are doing push-ups."], ["🏆", "Perfect run – even the dictionary is impressed."], ["🚀", "Not a single slip. Your brain should be in a museum."],
    ["🌟", "100 %! Somewhere a German grammar book just smiled."], ["🥇", "Perfekt! You're making this look far too easy."], ["🎯", "Bullseye every time. Researchers want to study your memory."]],
  great: [["🎉", "Sehr gut! Those words are sticking."], ["💪", "Strong work – your future self in Germany says danke."], ["🔥", "Great focus. Keep that momentum going!"]],
  ok: [["🌱", "Every mistake is a word you'll remember better. Weiter so!"], ["🧗", "Progress, not perfection. You're climbing!"], ["☕", "Good effort – a quick review tomorrow will lock it in."]],
};
function cheerFor(acc, perfect) {
  const set = perfect ? CHEERS.perfect : acc >= 80 ? CHEERS.great : CHEERS.ok;
  const [art, line] = set[Math.floor(Math.random() * set.length)];
  return { art, line };
}

// ---------- public starters ----------
// A lesson part only counts (A1 %, level, words entering reviews) when at least this share of first answers was right.
export const PASS_ACC = 60;
function failedPart(r, acc, retry) {
  const xp = Math.min(12, r.right);              // effort still earns a little XP, but no completion
  if (xp > 0) addXP(xp);
  r.failed = true; r.retry = retry;
  return xp;
}
export function startVocab(item, bit = 0) {
  const n = bitsOf(item).length;
  runLesson({
    title: `Lesson ${item.n}: ${item.title}`, kind: "vocab", steps: vocabBitSteps(item, bit),
    onFinish: (r, acc) => {
      if (acc < PASS_ACC && !S.done[item.id]) return failedPart(r, acc, () => startVocab(item, bit));
      bitsOf(item)[bit].forEach(id => learnWord(id));
      let xp = 4 + Math.min(12, r.right);
      const done = completeBit(item, bit, acc, xp);
      if (done) xp += 10; // whole lesson finished
      addXP(xp);
      r.bitOf = [bit + 1, n]; r.lessonDone = done;
      const nx = bit + 1 < n && !S.done[item.id] ? bit + 1 : null;
      if (nx != null) r.nextBit = () => startVocab(item, nx);
      return xp;
    },
  });
}
export function startReview(ids) {
  runLesson({
    title: `${ids.length} words reviewed`, kind: "review", steps: reviewSteps(ids),
    onFinish: (r) => {
      const [, again, hard, good, easy] = r.grades, n = again + hard + good + easy || 1;
      const rate = (hard + good + easy) / n;
      // +1 per Good/Easy, 0 for Hard, −1 per Again; +5 bonus at ≥80 % recalled, −5 below 50 %
      let xp = good + easy - again + (rate >= 0.8 ? 5 : rate < 0.5 ? -5 : 0);
      const d = today(); S.reviews[d] = (S.reviews[d] || 0) + ids.length;
      if (xp >= 0) addXP(xp); else addPenalty(-xp, `Low review score (${Math.round(rate * 100)}% recalled)`);
      r.recallRate = Math.round(rate * 100);
      return xp;
    },
  });
}
export function startGrammarPractice(g, item) {
  const qs = g.q.map((q, i) => ({ t: q.opts ? "gmc" : "gq", q, n: i + 1, of: g.q.length }));
  runLesson({
    title: `Ch ${g.num}: ${g.title}`, kind: "grammar", steps: qs,
    onFinish: (r, acc) => { const xp = 10 + 2 * r.right; addXP(xp); if (item) completeItem(item.id, acc, xp); return xp; },
  });
}
// Phrases, one bit (≈5 phrases) at a time: card → quick check → next card … → mixed quiz
export function startPhrases(sec, item, bit = 0) {
  const all = sec.items, idx = item ? bitsOf(item)[bit] : all.map((_, i) => i), items = idx.map(i => all[i]);
  const others = p => { const o = []; for (const x of shuffle(all)) if (o.length < 3 && x !== p && !overlaps(x.en, p.en) && norm(x.de) !== norm(p.de) && !o.some(y => overlaps(y.en, x.en))) o.push(x); return o; };
  const q = (p, listen) => ({ t: "read", p, listen: listen && !!p.a, title: listen ? "What does this mean?" : "How do you say this in German?", others: others(p) });
  const steps = [];
  const repeat = !!(item && (S.done[item.id] || ((S.bits || {})[item.id] || [])[bit])); // this part was finished before
  items.forEach((p, i) => {
    steps.push({ t: "flip", p, sec: sec.title });
    steps.push(q(p, false));
    if (i >= 1) steps.push(q(items[Math.floor(Math.random() * i)], true));
  });
  // spaced practice: up to 2 phrases from earlier parts of this topic that they've already produced correctly
  const say = (S && S.say) || {};
  shuffle(all.filter(p => !items.includes(p) && sayItems(p).some(x => say[x.de])))
    .slice(0, 2).forEach(p => { const x = sayStep(p, all); if (x) steps.push(x); });
  // final round: produce each phrase (bubbles while new, a mix with typing later); phrases that can't be built stay multiple choice
  shuffle(items).forEach((p, i) => {
    const fresh = !repeat && !sayItems(p).some(x => say[x.de]);
    steps.push((fresh && guidedSayStep(p, all)) || sayStep(p, all, { forceTiles: fresh }) || q(p, i % 2 === 1));
  });
  const n = item ? bitsOf(item).length : 1;
  runLesson({
    title: sec.title, kind: "phrases", steps,
    onFinish: (r, acc) => {
      S.say = S.say || {};
      for (const [k, ok] of Object.entries(r.say || {})) S.say[k] = ok ? (S.say[k] || 0) + 1 : Math.max(0, (S.say[k] || 0) - 1);
      if (item && acc < PASS_ACC && !S.done[item.id]) return failedPart(r, acc, () => startPhrases(sec, item, bit));
      let xp = 4 + Math.min(12, r.right);
      const done = item ? completeBit(item, bit, acc, xp) : false;
      if (done) xp += 10;
      addXP(xp);
      r.bitOf = [bit + 1, n]; r.lessonDone = done;
      if (item && bit + 1 < n && !S.done[item.id]) r.nextBit = () => startPhrases(sec, item, bit + 1);
      return xp;
    },
  });
}
export { distractors as _distractors };
export { evolveCard as _evolveCard };

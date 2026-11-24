// Translator (Words tab, feedback 41ab; design: docs/designs/translator-41ab.html option A).
// A collapsible card above the search box: German/French <-> English for one word or sentence, max 200 characters.
// 1) the course's own words and phrases are looked up locally first (free, instant, offline, always correct);
// 2) otherwise POST api/translate (server_fastapi/ask.py `translate`, GroqCloud, translate-only prompt, JSON out).
// It lives on Words only and sends nothing about the learner's lessons or answers, just the typed text and the direction.
import { C, S, USER, COURSE, learnWord, save, phraseTopics } from "./store.js";
import { L } from "./lang.js";
import { esc, deHTML, wireSpeakers } from "./lesson.js";
import { askOn, openAsk } from "./ask.js";

const MAX = 200, JSONH = { "Content-Type": "application/json" };
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };
const SWAP = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4"/></svg>`;
const SEARCH = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>`;

// ---- direction detection (all local): letters, then common words, then the course's own word list ----
const DE_STOP = "der die das den dem des ein eine einen einem einer ich du er sie es wir ihr ist sind bin bist seid war nicht kein keine und oder aber mit von zu zum zur auf für fuer wie wo was wer wann warum bitte danke ja nein hallo gut sehr auch noch nur dass wenn dann hier dort heute mein dein sein unser habe hast hat haben möchte mag kann will muss wird im am um an aus bei nach über unter ins".split(" ");
const FR_STOP = "le la les un une des du de et ou mais avec pour dans sur je tu il elle nous vous ils elles est sont suis es êtes été pas ne qui que quoi où quand comment pourquoi merci oui non bonjour salut très aussi mon ma mes ton ta tes son sa ses notre votre au aux ce cette ces ai as a avons avez ont veux peux voudrais".split(" ");
const EN_STOP = "the a an is are am was were be been i you he she it we they my your his her our their this that these those and or but of to in on at for with from by as not no yes what where when why how who which do does did have has had will would can could should please thank thanks hello hi good very also just only if then here there today me him them us need want like".split(" ");
const STOP = { de: new Set(DE_STOP), fr: new Set(FR_STOP) }, EN = new Set(EN_STOP);
const ACC = { de: /[äöüß]/i, fr: /[éèêëàâçùûîïôœ]/i };

const lower = s => String(s || "").toLowerCase().replace(/[’]/g, "'");
const strip = s => lower(s).replace(/\([^)]*\)/g, " ").replace(/[^\p{L}\p{N}' ]+/gu, " ").replace(/\s+/g, " ").trim();   // case, punctuation and (brackets) off
const exactKey = s => (L.norm ? L.norm(strip(s)) : strip(s));
const foldKey = s => (L.fold ? L.fold(exactKey(s)) : exactKey(s));
const noArt = s => s.replace(L.artStrip || /^$/, "").replace(/^l'/, "");
const noTo = s => s.replace(/^to /, "");

// local lookup tables, built once per loaded course
let idx = null, idxFor = null;
function index() {
  if (idx && idxFor === C.content) return idx;
  const mk = () => ({ ex: new Map(), fo: new Map() });
  const tgt = mk(), en = mk(), tgtWords = new Set(), enWords = new Set();
  const add = (m, key, ref) => { if (!key) return; (m.ex.get(exactKey(key)) || m.ex.set(exactKey(key), []).get(exactKey(key))).push(ref); (m.fo.get(foldKey(key)) || m.fo.set(foldKey(key), []).get(foldKey(key))).push(ref); };
  const refs = [...(C.content.words || []).map(w => ({ k: "word", w })), ...phraseTopics().flatMap(t => t.items.map(p => ({ k: "phrase", p })))];
  for (const r of refs) {
    const de = r.w ? r.w.de : r.p.de, enTxt = r.w ? r.w.en : r.p.en;
    for (const v of de.split(/\s*\/\s*|\s+or\s+/)) { const s = strip(v); add(tgt, s, r); add(tgt, noArt(s), r); }
    add(tgt, de, r);
    for (const v of enTxt.split(/\s*[;,/]\s*/)) { const s = noTo(strip(v)); add(en, s, r); }
    add(en, noTo(strip(enTxt)), r);
    if (r.w) { strip(de).split(" ").forEach(t => tgtWords.add(exactKey(noArt(t)))); noTo(strip(enTxt)).split(" ").forEach(t => enWords.add(t)); }
  }
  idxFor = C.content; idx = { tgt, en, tgtWords, enWords };
  return idx;
}
function lookup(text, dir) {
  const t = strip(text); if (!t) return [];
  const I = index(), m = dir === "to_en" ? I.tgt : I.en, q = dir === "to_en" ? t : noTo(t);
  const hits = m.ex.get(exactKey(q)) || m.ex.get(exactKey(noArt(q))) || (L.fold ? m.fo.get(foldKey(q)) || m.fo.get(foldKey(noArt(q))) : null) || [];
  const seen = new Set();
  return hits.filter(r => { const id = r.w ? r.w.id : "p:" + r.p.de; if (seen.has(id)) return false; seen.add(id); return true; }).slice(0, 3);
}
/** "to_en" (course language -> English), "from_en", or null when it cannot tell */
export function guessDir(text) {
  const code = L.code, raw = String(text || "").trim(); if (!raw) return null;
  const toks = lower(raw).replace(/[^\p{L}' ]+/gu, " ").split(/\s+/).filter(Boolean);
  let tg = 0, en = 0;
  if (ACC[code] && ACC[code].test(raw)) tg += 3;
  const I = index();
  for (const w of toks) {
    if (STOP[code] && STOP[code].has(w)) tg += 2;
    if (EN.has(w)) en += 2;
    if (I.tgtWords.has(exactKey(w))) tg += 1;
    if (I.enWords.has(w)) en += 1;
  }
  return tg === en ? null : tg > en ? "to_en" : "from_en";
}

// ---- state kept while the Words tab redraws ----
const st = { open: lsGet("a1.trOpen") === "1", dir: lsGet("a1.trDir") === "from_en" ? "from_en" : "to_en", manual: false, text: "", res: null, busy: 0, lastReq: null };
const recKey = () => `a1.trRecent.${USER || "guest"}.${COURSE}`;
const recents = () => { try { return JSON.parse(lsGet(recKey()) || "[]").filter(r => r && r.q); } catch { return []; } };
const pushRecent = (q, dir, a) => {
  const list = recents().filter(r => !(r.q === q && r.d === dir));
  list.unshift({ d: dir, q, a: String(a).slice(0, 120) });
  lsSet(recKey(), JSON.stringify(list.slice(0, 8)));
};
let netCb = null;
const GCLS = { der: "m", die: "f", das: "n", le: "m", la: "f" };

/** mount the card in `host` (an empty div above the search box); `openWord(w)` opens a word's card sheet; `toast(msg)` */
export function mountTranslator(host, { openWord, toast, onChange }) {
  const tgt = L.name;
  const dirLabel = () => (st.dir === "to_en" ? [tgt, "English"] : ["English", tgt]);
  const ai = () => askOn();
  const feedback = (id, kind) => fetch("api/ask/feedback", { method: "POST", headers: JSONH, body: JSON.stringify({ id, kind }) }).catch(() => null);

  function shell() {
    if (!st.open) {
      host.innerHTML = `<button class="card tr tr-closed" id="tr-open" type="button" aria-expanded="false" aria-controls="tr-body">
        <span class="tr-ico">${SEARCH}</span><span class="grow"><b>Translate</b><span class="small muted tr-sub">A word or sentence, ${esc(tgt)} ⇄ English</span></span><span class="link">Open</span></button>`;
      host.querySelector("#tr-open").onclick = () => { st.open = true; lsSet("a1.trOpen", "1"); shell(); host.querySelector("#tr-in").focus(); };
      return;
    }
    host.innerHTML = `<div class="card tr" id="tr-body">
      <div class="row tr-head"><b class="grow">Translate</b><button class="link" id="tr-close" type="button" aria-expanded="true" aria-controls="tr-body">Close</button></div>
      <div class="tr-bar tr-off tiny" id="tr-off" role="status" hidden><b>You are offline.</b> Words from your lessons still work. Sentences need internet; try again when you are back online.</div>
      <div class="tr-dir"><span class="tr-lang on" id="tr-l1"></span>
        <button class="tr-swap" id="tr-swap" type="button" aria-label="Swap direction">${SWAP}</button><span class="tr-lang" id="tr-l2"></span></div>
      <div class="tr-det" id="tr-det" aria-live="polite" hidden></div>
      <textarea class="tr-ti" id="tr-in" rows="3" maxlength="${MAX}" placeholder="Type a word or sentence" aria-label="Text to translate" autocomplete="off" autocapitalize="sentences" spellcheck="false" enterkeyhint="go"></textarea>
      <div class="tr-cnt tiny"><span id="tr-hint">Max ${MAX} characters</span><span id="tr-n">0 / ${MAX}</span></div>
      <button class="btn" id="tr-go" type="button">Translate</button>
      <div class="tr-res" id="tr-res" aria-live="polite"></div>
      <div id="tr-hist"></div></div>`;
    const $ = id => host.querySelector("#" + id), ta = $("tr-in");
    ta.value = st.text;
    $("tr-close").onclick = () => { st.open = false; lsSet("a1.trOpen", "0"); shell(); };
    $("tr-swap").onclick = () => { st.dir = st.dir === "to_en" ? "from_en" : "to_en"; st.manual = true; lsSet("a1.trDir", st.dir); st.res = null; st.busy++; refresh(); drawRes(); ta.focus(); };
    ta.oninput = () => {
      if (ta.value.length > MAX) ta.value = ta.value.slice(0, MAX);   // a paste can't go past the limit
      st.text = ta.value; st.res = null; st.busy++;   // an answer on its way for older text is dropped
      if (!st.text.trim()) st.manual = false;
      if (!st.manual) { const g = guessDir(st.text); if (g && g !== st.dir) { st.dir = g; lsSet("a1.trDir", st.dir); } }
      refresh(); drawRes();
    };
    ta.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); } };
    $("tr-go").onclick = () => go();
    const net = () => { const o = host.querySelector("#tr-off"); if (o) { o.hidden = navigator.onLine; refresh(); } };
    if (netCb) { window.removeEventListener("online", netCb); window.removeEventListener("offline", netCb); }   // one pair of listeners, however often Words redraws
    netCb = net; window.addEventListener("online", net); window.addEventListener("offline", net);
    refresh(); drawRes(); drawHist();
    const o = $("tr-off"); o.hidden = navigator.onLine;
  }

  // direction row, detection line, counter and button state
  function refresh() {
    const $ = id => host.querySelector("#" + id); if (!$("tr-in")) return;
    const [a, b] = dirLabel(); $("tr-l1").textContent = a; $("tr-l2").textContent = b;
    $("tr-swap").setAttribute("aria-label", `Swap direction: now ${a} to ${b}`);
    $("tr-in").lang = st.dir === "to_en" ? L.code : "en";
    const det = $("tr-det"), g = guessDir(st.text);
    det.hidden = !(st.text.trim() && !st.manual && g);
    if (!det.hidden) det.textContent = `Detected: ${a} → ${b}`;
    const n = st.text.length, full = n >= MAX;
    $("tr-n").textContent = `${n} / ${MAX}`; $("tr-n").className = full ? "over" : "";
    $("tr-hint").textContent = full ? "Limit reached. Split into shorter sentences." : `Max ${MAX} characters`;
    $("tr-in").classList.toggle("bad", full);
    const off = !navigator.onLine, empty = !st.text.trim();
    $("tr-go").disabled = empty || (off && !lookup(st.text, st.dir).length) || !!st.hold;
  }

  function drawHist() {
    const el = host.querySelector("#tr-hist"); if (!el) return;
    const list = recents();
    if (!list.length) { el.innerHTML = ""; return; }
    el.innerHTML = `<div class="tr-recent"><div class="row"><b class="grow">Recent</b><button class="link" id="tr-clr" type="button">Clear</button></div>
      ${list.map((r, i) => `<button class="tr-hist" data-i="${i}" type="button" aria-label="Translate again: ${esc(r.q)}"><span class="tr-dr">${r.d === "to_en" ? L.code.toUpperCase() : "EN"}</span>
        <span class="grow"><span class="tr-hq">${esc(r.q)}</span><span class="small muted tr-ha">${esc(r.a)}</span></span><span class="muted" aria-hidden="true">⟲</span></button>`).join("")}</div>`;
    el.querySelector("#tr-clr").onclick = () => { lsSet(recKey(), "[]"); drawHist(); };
    el.querySelectorAll(".tr-hist").forEach(b => (b.onclick = () => {
      const r = list[+b.dataset.i]; st.text = r.q; st.dir = r.d; st.manual = true; lsSet("a1.trDir", st.dir);
      host.querySelector("#tr-in").value = st.text; refresh(); go();
    }));
  }

  // ---- results ----
  const bar = (cls, html) => `<div class="tr-bar ${cls}">${html}</div>`;
  const AIWARN = `<div class="tr-warn tiny muted">AI translation, can be wrong.</div>`;
  function localCard(r) {
    if (r.k === "phrase") {
      const p = r.p;
      return `<div class="tr-hit"><div class="row tr-tags"><span class="pill green">In your lessons</span><span class="pill blue">Phrase</span></div>
        <div class="row"><div class="grow"><div class="tr-big sm2">${esc(p.de)}</div><div class="tr-en">${esc(p.en)}</div></div>${p.a ? `<button class="spk" data-a="${p.a}" data-t="${esc(p.de)}" aria-label="Play audio">🔊</button>` : ""}</div>
        <div class="tr-warn tiny muted">Matched in the app's own phrase list: always correct.</div></div>`;
    }
    const w = r.w, gt = w.g && L.gtag[w.g] ? `<span class="pill blue">${esc(w.type)}${w.g === "m" || w.g === "f" || w.g === "n" ? " · " + { m: "masc.", f: "fem.", n: "neut." }[w.g] : ""}</span>` : `<span class="pill blue">${esc(w.type)}</span>`;
    const ex = (w.ex || [])[0];
    return `<div class="tr-hit" data-id="${w.id}"><div class="row tr-tags"><div class="grow"><span class="pill green">In your lessons</span> ${gt}</div>
        <button class="spk" data-a="${w.a || ""}" data-t="${esc(w.de)}" aria-label="Play audio">🔊</button></div>
      <div class="tr-big">${deHTML(w)}</div><div class="tr-en">${esc(w.en)}</div>
      <div class="tr-kv">${w.pl ? `<span class="pill">Plural: ${esc(w.pl)}</span>` : ""}<span class="pill">${esc(String(w.topic || "").replace(/^A\d*\.\s*/, ""))}</span></div>
      ${ex ? `<div class="ex"><button class="spk sm" data-a="${ex.a || ""}" data-t="${esc(ex.de)}" aria-label="Play example">🔊</button><div class="t"><div>${esc(ex.de)}</div><div class="muted small">${esc(ex.en)}</div></div></div>` : ""}
      <div class="row tr-acts">${S.words[w.id] ? `<span class="pill green">✓ In my words</span>` : `<button class="btn sm" data-add="${w.id}" type="button">Add to my words</button>`}
        <button class="btn ghost sm" data-open="${w.id}" type="button">Open card</button></div>
      <div class="tr-warn tiny muted">Matched in the app's own word list: always correct.</div></div>`;
  }
  function aiWord(q, j) {
    const r = j.result, art = r.article, cls = GCLS[art] || "", to_en = q.dir === "to_en";
    const big = !to_en && art ? `<span class="art ${cls}">${esc(art)}</span>${art.endsWith("'") ? "" : " "}${esc(r.translation.replace(/^(der|die|das|le|la|l')\s*/i, ""))}` : esc(r.translation);
    return `<div class="tr-hit"><div class="row tr-tags"><span class="pill amber">Not in your lessons</span><span class="pill blue">AI</span></div>
      <div class="tr-big">${big}</div>${r.casual ? `<div class="tr-en small muted">Also: ${esc(r.casual)}</div>` : ""}
      ${r.plural ? `<div class="tr-kv"><span class="pill">Plural: ${esc(r.plural)}</span></div>` : ""}
      <div class="tr-warn tiny muted">AI translation, can be wrong. <button class="link" data-rep="${j.id}" type="button">Report</button></div></div>`;
  }
  function aiSentence(q, j) {
    const r = j.result, [a, b] = q.dir === "to_en" ? [L.code.toUpperCase(), "EN"] : ["EN", L.code.toUpperCase()];
    return `<div class="tr-hit"><div class="row tr-tags"><span class="pill blue">AI translation</span><span class="grow"></span><span class="tiny muted">${a} → ${b}</span></div>
      <div class="tr-big sm2">${esc(r.translation)}</div>${r.casual ? `<div class="tr-en small muted">Also: ${esc(r.casual)} (more casual)</div>` : ""}
      ${r.words.length ? `<div class="tr-wl"><b class="small">Word by word</b> <span class="small muted">· tap a word</span></div>
        <div class="tr-chips">${r.words.map((w, i) => `<button class="tr-chip" data-w="${i}" type="button" aria-pressed="false"><b>${esc(w.w)}</b><span>${esc(w.g)}</span></button>`).join("")}</div>
        <div class="note tr-expl" id="tr-expl" hidden></div>` : ""}
      <div class="row tr-acts2">${askOn() ? `<button class="link grow" style="text-align:left" data-ask="1" type="button">Ask the helper about this</button>` : `<span class="grow"></span>`}
        <button class="link tr-fb" data-fb="up" type="button" aria-label="Good translation">👍</button><button class="link tr-fb" data-fb="wrong" type="button" aria-label="Report this translation as wrong">🚩</button></div>
      <div class="tr-warn tiny muted">AI translation: answers can be wrong. No audio for typed text.</div></div>`;
  }

  function wireRes(el, q, j) {
    wireSpeakers(el);
    el.querySelectorAll("[data-add]").forEach(b => (b.onclick = () => { learnWord(b.dataset.add); save(); toast("Added to your words"); onChange && onChange(); drawRes(); }));
    el.querySelectorAll("[data-open]").forEach(b => (b.onclick = () => openWord(C.word[b.dataset.open])));
    el.querySelectorAll("[data-rep]").forEach(b => (b.onclick = () => { feedback(b.dataset.rep, "wrong"); b.parentNode.textContent = "Thanks, we'll check this answer."; }));
    el.querySelectorAll("[data-fb]").forEach(b => (b.onclick = () => { feedback(j.id, b.dataset.fb); el.querySelector(".tr-acts2").innerHTML = `<span class="small muted">${b.dataset.fb === "up" ? "Thanks!" : "Thanks, we'll check this answer."}</span>`; }));
    const ex = el.querySelector("#tr-expl");
    el.querySelectorAll("[data-w]").forEach(b => (b.onclick = () => {
      const on = b.getAttribute("aria-pressed") === "true";
      el.querySelectorAll("[data-w]").forEach(x => { x.classList.remove("sel"); x.setAttribute("aria-pressed", "false"); });
      if (on) { ex.hidden = true; return; }
      const w = j.result.words[+b.dataset.w];
      b.classList.add("sel"); b.setAttribute("aria-pressed", "true");
      ex.innerHTML = `<b>${esc(w.w)}</b> = ${esc(w.g)}${w.n ? `. ${esc(w.n)}` : ""} <button class="link" data-ask2="1" type="button">Ask the helper</button>`;
      ex.hidden = false;
      ex.querySelector("[data-ask2]").onclick = () => ask(q, j, `What does "${w.w}" mean here, and why is it used this way?`);
    }));
    const ab = el.querySelector("[data-ask]"); if (ab) ab.onclick = () => ask(q, j);
  }
  function ask(q, j, question) {
    const tg = q.dir === "to_en" ? q.text : j.result.translation, en = q.dir === "to_en" ? j.result.translation : q.text;
    openAsk({ course: COURSE, target_lang: L.name, ui_lang: "en", lesson: "Translator", step_type: "translate", phase: "after",
      item: { text: tg, meaning: en, kind: "phrase" }, card_text: `Sentence: "${tg}" = "${en}"` }, question ? "ask" : "explain", question || `Explain this sentence simply: ${tg}`);
  }

  function drawRes() {
    const el = host.querySelector("#tr-res"); if (!el) return;
    const r = st.res;
    if (!r) { el.innerHTML = ""; return; }
    if (r.type === "load") {
      el.innerHTML = `<div class="tr-hit"><div class="row"><span class="pill blue">AI translation</span></div><div class="tr-dots" aria-hidden="true"><span></span><span></span><span></span></div>
        <div class="tr-shim" style="width:85%"></div><div class="tr-shim" style="width:60%"></div><div class="small muted" role="status">Translating…</div></div>`;
    } else if (r.type === "local") {
      el.innerHTML = r.hits.map(localCard).join(""); wireRes(el, null, null);
    } else if (r.type === "ai") {
      el.innerHTML = r.j.kind === "word" ? aiWord(r.q, r.j) : aiSentence(r.q, r.j); wireRes(el, r.q, r.j);
    } else if (r.type === "err") {
      el.innerHTML = `<div class="tr-hit">${bar("tr-err", `<b>${esc(r.title)}</b><div class="small">${esc(r.msg)}</div>`)}
        <div class="row">${r.retry ? `<button class="btn sm" id="tr-retry" type="button">Try again</button><button class="btn ghost sm" id="tr-edit" type="button">Edit text</button>` : ""}</div></div>`;
      const rt = el.querySelector("#tr-retry"); if (rt) rt.onclick = () => go();
      const ed = el.querySelector("#tr-edit"); if (ed) ed.onclick = () => host.querySelector("#tr-in").focus();
    } else if (r.type === "off") {
      el.innerHTML = `<div class="tr-hit">${bar("tr-off", `<b>You are offline.</b> Sentences and new words need internet. Try again when you are back online.`)}</div>`;
    }
  }

  async function go() {
    const text = st.text.trim(); if (!text) return;
    const dir = st.dir, my = ++st.busy;
    const hits = lookup(text, dir);
    if (hits.length) {                                   // 1) the course's own words and phrases
      st.res = { type: "local", hits }; drawRes();
      pushRecent(text, dir, hits[0].w ? (dir === "to_en" ? hits[0].w.en : hits[0].w.de) : (dir === "to_en" ? hits[0].p.en : hits[0].p.de)); drawHist();
      return;
    }
    if (!navigator.onLine) { st.res = { type: "off" }; drawRes(); return; }
    if (!ai()) { st.res = { type: "err", title: "Translator not available.", msg: "Sign in to translate words that are not in your lessons.", retry: false }; drawRes(); return; }
    st.res = { type: "load" }; drawRes();
    const q = { text, dir };
    let j;
    try {
      const r = await fetch("api/translate", { method: "POST", headers: JSONH, body: JSON.stringify({ lang: L.code, dir, text }) });
      j = await r.json().catch(() => null);
      if (!j || (!j.ok && !j.message)) j = { ok: false, code: "upstream", message: "The helper did not answer." };   // non-JSON or a validation error has no message
    } catch { j = { ok: false, code: "network", message: "No connection. Your text is still here." }; }
    if (my !== st.busy) return;                          // the text or direction changed meanwhile
    if (j.ok) {
      st.res = { type: "ai", q, j }; drawRes();
      pushRecent(text, dir, j.result.translation); drawHist();
    } else if (j.code === "slow_down") {
      st.res = { type: "err", title: "Slow down a little.", msg: j.message, retry: false }; drawRes();
      st.hold = true; refresh(); setTimeout(() => { st.hold = false; refresh(); }, 2200);
    } else if (j.code === "cap") {
      st.res = { type: "err", title: "No AI answers left today.", msg: j.message, retry: false }; drawRes();
    } else {
      st.res = { type: "err", title: "Could not translate.", msg: (j.message || "Something went wrong."), retry: j.code !== "bad_input" && j.code !== "not_configured" }; drawRes();
    }
  }

  shell();
}

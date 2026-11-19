import { C, S, USERS, USER, SYNC, userInfo, loadUsers, switchUser, signOut, COURSES, COURSE, loadCourses, courseInfo, lastCourse, setCourse, switchCourse, fetchAllStates, summary, refreshFromServer,
  save, loadContent, addXP, today, addDays, daysBetween, fmtDate, parse, streak, xpToday, totalXP,
  dueWords, wordStatus, progress, retention, pace, history, nextItem, learnWord, resetAll, exportState,
  importState, WEIGHTS, level, rank, A1_LEVEL, POST_A1_XP, memory, weekPlan, weekOf, thisWeek, goalFor, autoGoal, remainingXP, bitsOf, bitCount, bitsDone, nextBit, checkRewards, openGift, nextMilestone, tierFor, TIERS, QUEST_GEMS, grammarOf, gPart, questMode, completeItem, health, AUTH, checkAuth, login, signup, changePassword, logout, isGuest, hasGuestData, startGuest, leaveGuest, claimGuest , personalize, partsGoal, partsToday } from "./store.js";
import { esc, wordCard, wireSpeakers, grammarXP, startVocab, startReview, startGrammarPractice, startPhrases, abortLesson, inLesson, speakAvailable, confirmQuit } from "./lesson.js";
import { play, stopAudio } from "./audio.js";
import { installBugButton } from "./bugreport.js";
import { heroHTML, applyAura, loadAvatars, aura, auraName, AURA_FULL_LEVEL, STAGES, stageFor, form, setHeroStyle, heroStyle, HERO_STYLES } from "./hero.js";

const view = () => document.getElementById("view");
const sheetRoot = () => document.getElementById("sheet-root");
const ICON = { vocab: "🔤", grammar: "📐", phrases: "💬" };
const KIND = { vocab: "Vocabulary", grammar: "Grammar", phrases: "Phrases" };
// distinct glyphs per lesson type (inline SVG, coloured per theme via .k-vocab / .k-grammar / .k-phrases)
const GLYPH = {
  vocab: `<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="17" text-anchor="middle" font-size="14" font-weight="800" font-family="system-ui,sans-serif" fill="currentColor">Aa</text></svg>`,
  grammar: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><rect x="3" y="12" width="8" height="8" rx="1.6"/><rect x="13" y="12" width="8" height="8" rx="1.6"/><rect x="8" y="3" width="8" height="8" rx="1.6"/></svg>`,
  phrases: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z"/><circle cx="8.5" cy="9.5" r="1.3" fill="var(--kbg,#fff)"/><circle cx="12" cy="9.5" r="1.3" fill="var(--kbg,#fff)"/><circle cx="15.5" cy="9.5" r="1.3" fill="var(--kbg,#fff)"/></svg>`,
};
const kicon = (kind, done, sm) => `<span class="kicon k-${kind} ${sm ? "sm" : ""}">${GLYPH[kind]}${done ? `<span class="kdone">✓</span>` : ""}</span>`;

function toast(msg) {
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
}
function sheet(html, wire) {
  sheetRoot().innerHTML = `<div class="sheet-bg"><div class="sheet">${html}</div></div>`;
  const bg = sheetRoot().querySelector(".sheet-bg");
  bg.onclick = e => { if (e.target === bg) closeSheet(); };
  wire && wire(sheetRoot().querySelector(".sheet"));
  if (!(window.history.state && window.history.state.sheet)) window.history.pushState({ sheet: 1 }, "", location.hash); // Android back closes the sheet
}
const closeSheet = () => {
  sheetRoot().innerHTML = "";
  if (window.history.state && window.history.state.sheet) window.history.replaceState({ dead: 1 }, "", location.hash); // its history entry is skipped on back
};
// ---------- Android back gesture ----------
// Back closes an open sheet, skips entries of sheets already closed, asks before quitting a lesson (in route()),
// and on the first page asks for a second back before the app closes instead of dropping to the home screen.
let exitArmed = 0;
function onPopState(e) {
  const st = e.state || {};
  if (sheetRoot().innerHTML && !st.sheet) { sheetRoot().innerHTML = ""; if (!st.base) return; }
  if (st.dead) { window.history.back(); return; }
  if (st.base) {
    if (Date.now() - exitArmed < 2500) { window.history.back(); return; } // second back: leave the app
    exitArmed = Date.now();
    window.history.pushState({ guard: 1 }, "", location.hash);
    toast("Swipe back again to close LevelUp");
  }
}
function armBack() {
  if (window.history.state && (window.history.state.base || window.history.state.guard)) return;
  window.history.replaceState({ base: 1 }, "", location.hash || "#/today");
  window.history.pushState({ guard: 1 }, "", location.hash || "#/today");
}

// ------------------------------------------------------------------ routing
function route() {
  if (inLesson() && location.hash !== "#/lesson") { window.history.pushState(null, "", "#/lesson"); confirmQuit(); return; } // back gesture mid-lesson
  closeSheet();
  stopAudio();
  const h = location.hash || "#/today";
  if (h === "#/lesson") { if (inLesson()) return; location.replace("#/today"); return; }
  if (inLesson()) abortLesson();
  document.body.classList.remove("in-lesson");
  applyTheme();
  if (!USER || !S) return whoView();
  if (!syncHero()) return heroPickView();
  if (!picked()) return courseView();
  if (courseInfo(COURSE).type === "tree") { const [, nm, arg] = h.split("/"); return nm === "branch" && arg ? treeView(arg) : seHome(); }
  if (!S.setup) return setupView();
  const [, name, arg] = h.split("/");
  document.querySelectorAll("#tabs a").forEach(a => a.classList.toggle("on", a.dataset.tab === name));
  const pt = document.querySelector('#tabs a[data-tab="path"]');
  if (pt) pt.innerHTML = questMode() ? `<span class="ti">🗺️</span><span>Path</span>` : `<span class="ti">🧩</span><span>Skills</span>`;
  ({ today: todayView, path: pathView, lessons: lessonsView, settings: settingsView, words: wordsView, progress: progressView, grammar: () => grammarView(arg) }[name] || todayView)();
  window.scrollTo(0, 0);
}

function startItem(it, bit) {
  closeSheet();
  const b = bit != null ? bit : nextBit(it);
  if (it.kind === "vocab") startVocab(it, b);
  else if (it.kind === "grammar") location.hash = "#/grammar/" + it.id;
  else startPhrases(C.phrases[it.id], it, b);
}
const chapterDone = gid => (C.gparts[gid] || [gid]).every(id => S.done[id]);
const chaptersDone = () => C.content.grammar.filter(g => chapterDone(g.id)).length;
const partLabel = it => { const n = bitCount(it), d = bitsDone(it); return n > 1 ? `Part ${Math.min(d + 1, n)} of ${n}` : ""; };

// ------------------------------------------------------------------ setup
// pace always counts from the day you start; default finish = 3 months later
const in3Months = () => { const d = parse(today()); d.setMonth(d.getMonth() + 3); return fmtISO(d); };
const fmtISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysText = to => { const n = daysBetween(today(), to); return n > 0 ? `${n} day${n === 1 ? "" : "s"}` : "pick a future date"; };
function setupView() {
  document.body.classList.add("in-lesson"); // hides the tab bar until setup is done
  const tgt = in3Months();
  view().innerHTML = `<button class="link" id="sw">‹ Not ${esc(userInfo(USER).name)}?</button><h1>Willkommen, ${esc(userInfo(USER).name)}! 👋</h1>
  <p class="muted">${esc(C.course.icon)} <b>${esc(C.course.title)}</b> · ${esc(C.course.subtitle || "")}</p>
  <div class="card">
    <label class="f">When do you want to finish A1?</label>
    <div class="row" style="align-items:center;gap:10px"><input type="date" id="tg" value="${tgt}" min="${addDays(today(), 1)}" style="flex:1"><b id="tgd" class="small" style="white-space:nowrap">${daysText(tgt)}</b></div>
    <p class="muted small" style="margin:6px 0 0">Your pace counts from today (${fmtDate(today())}).</p>
    <label class="f">Daily goal</label>
    <div class="choices" id="dg" role="radiogroup">${[["auto", "Auto", "Recommended · sets the goal so you reach A1 by your date"], [10, "Casual", "10 XP a day"], [20, "Regular", "20 XP a day"], [30, "Serious", "30 XP a day"], [45, "Intense", "45 XP a day"]]
      .map(([v, l, d], i) => `<label class="choice"><input type="radio" name="dg" value="${v}" ${i ? "" : "checked"}><span><b>${l}</b><small>${d}</small></span></label>`).join("")}</div>
    <p class="muted small" style="margin:6px 0 0">⚡ <b>1 XP ≈ one new word learned.</b> Each finished part adds +2 (+1 if perfect) and a whole lesson +5. Reviews give a little (+1 per 5 words recalled) and forgetting costs XP. 20 XP ≈ one new lesson a day.</p>
  </div>
  <button class="btn" id="go">Start learning</button>`;
  view().querySelector("#sw").onclick = () => { if (isGuest()) { leaveGuest(); return route(); } if (AUTH === "on") return doLogout(); signOut(); route(); };
  view().querySelector("#tg").oninput = e => (view().querySelector("#tgd").textContent = e.target.value ? daysText(e.target.value) : "");
  view().querySelector("#go").onclick = () => {
    S.settings.targetDate = view().querySelector("#tg").value || tgt;
    S.settings.startDate = today();
    const gv = view().querySelector("#dg input:checked")?.value || "auto";
    if (gv === "auto") S.settings.goalMode = "auto"; else { S.settings.goalMode = "manual"; S.settings.dailyGoal = +gv; }
    if (S.settings.targetDate <= today()) return toast("Pick a target date in the future");
    S.setup = true; save(); document.body.classList.remove("in-lesson"); location.hash = "#/today"; route();
  };
}

function markDone(it, date = today()) {
  if (S.done[it.id]) return;
  S.done[it.id] = { date, score: null, marked: true };
  if (it.kind === "vocab") it.words.forEach(id => { learnWord(id, true); S.words[id].due = today(); });
  save();
}

// ------------------------------------------------------------------ today
function topBar() {
  if (!questMode()) return `<div class="row" style="margin-bottom:10px;gap:8px"><button class="userchip" id="uc">${avatar(USER, true)}<span class="nm">${esc(userInfo(USER).name)}</span> ▾</button><button class="coursechip" id="cc" aria-label="Change course">${esc(C.course.icon)} <span class="nm">${esc(C.course.title)}</span> ▾</button>
    <span class="grow"></span><span class="tiny muted" id="syncst">${syncText()}</span><span class="gemchip" style="cursor:default">⚡ <b>${totalXP()}</b></span></div>${playerBar()}`;
  const g = goalFor(), x = xpToday(), p = Math.min(100, Math.round(100 * x / g));
  return `<div class="row" style="margin-bottom:10px;gap:8px"><button class="userchip" id="uc">${avatar(USER, true)}<span class="nm">${esc(userInfo(USER).name)}</span> ▾</button><button class="coursechip" id="cc" aria-label="Change course">${esc(C.course.icon)} <span class="nm">${esc(C.course.title)}</span> ▾</button>
    <span class="grow"></span><span class="tiny muted" id="syncst">${syncText()}</span>${gemChip()}</div>${playerBar()}<div class="top classic-only">
    <div class="ring" id="xpring" style="--p:${p};cursor:pointer"><div>${x}<br><span class="tiny muted">/${g} XP</span></div></div>
    <div class="grow"><div style="font-weight:800;font-size:18px">${x >= g ? "Daily goal done ✅" : "Today's goal"}</div>
      <div class="muted small">${x >= g ? "Anything extra is a bonus." : `${g - x} XP to go`}</div></div>
    <div class="stat" title="Day streak">🔥 ${streak()}</div></div>`;
}

function paceLine(pc) {
  const L = Math.abs(pc.gapLessons);
  if (pc.left <= 0) return pc.actual >= 99.9 ? "A1 content complete 🎓" : "Target date reached";
  if (L < 1) return `<span class="pill green">On track</span>`;
  const n = Math.round(L);
  return pc.gap > 0 ? `<span class="pill green">${n} lesson${n > 1 ? "s" : ""} ahead</span>` : `<span class="pill amber">${n} lesson${n > 1 ? "s" : ""} behind</span>`;
}

function paceCard(pc) {
  return `<div class="card tap" id="pacecard"><div class="sys-h">Progress to A1</div><div class="row"><div class="grow"><div style="font-weight:800">📈 A1 progress · ${pc.actual.toFixed(1)}%</div>
    <div class="muted small">Expected today: ${pc.expected.toFixed(1)}% · target ${fmtDate(S.settings.targetDate)} <a href="#/settings" class="link" style="padding:0" onclick="event.stopPropagation()">edit</a></div></div>${paceLine(pc)}</div>
    <div class="hbar" style="position:relative;margin-top:10px"><div style="width:${pc.actual}%;background:var(--green)"></div>
    <span style="position:absolute;top:-3px;left:calc(${pc.expected}% - 1px);width:3px;height:18px;background:var(--ink);border-radius:2px"></span></div></div>`;
}

function todayView() {
  if (!questMode()) return freeToday();
  const it = nextItem(), due = dueWords();
  view().innerHTML = topBar() + apkBanner() + `
  ${dailyQuest(due)}
  ${it ? `<div class="card next-card"><div class="sys-h"><span class="ex">!</span> New quest</div>
      <div class="small row" style="font-weight:800;opacity:.9;gap:6px">${kicon(it.kind, false, true)} NEXT · ${KIND[it.kind].toUpperCase()} · WEEK ${weekOf(it)}</div>
      <div style="font-size:21px;font-weight:800;margin-top:4px">${esc(it.kind === "vocab" ? `Lesson ${it.n}: ${it.title}` : it.title)}</div>
      <div class="muted small">${[partLabel(it), it.kind === "vocab" ? `${bitsOf(it)[Math.min(bitsDone(it), bitCount(it) - 1)].length} new words` : ""].filter(Boolean).join(" · ")}</div>
      <button class="btn" id="next">${bitsDone(it) ? "Continue" : "Start"}</button></div>`
    : `<div class="card next-card"><div style="font-size:21px;font-weight:800">All lessons done! 🎓</div><div class="muted">Keep your reviews going until the exam.</div></div>`}
  ${due.length ? `<div class="card"><div class="sys-h">Memory training</div>
    <div class="quest" style="border:0"><span class="box"></span><div class="grow"><b>Review ${due.length} word${due.length > 1 ? "s" : ""} to remember</b>
      <div class="muted small">Review them now to keep them fresh</div></div>
      <button class="btn blue sm" id="rev">Review ${Math.min(20, due.length)}</button></div>
    ${memWarn()}</div>` : ""}`;
  const nb = view().querySelector("#next"); if (nb) nb.onclick = () => startItem(it);
  const rv = view().querySelector("#rev"); if (rv) rv.onclick = () => startReview(due.slice(0, 20));
  levelWatch();
  wireTop();
  const rw = checkRewards(questStatus(due).all);
  if (rw.gems || rw.gifts.length) {
    const chip = view().querySelector("#gem"); if (chip) chip.outerHTML = gemChip();
    wireTop();
    if (rw.gifts.length) giftEarnedSheet(rw.gifts);
    else toast(`💎 +${rw.gems} – daily quest cleared!`);
  }
}

const wkRange = w => `${fmtDate(w.from, { weekday: "short", day: "numeric", month: "short" })} – ${fmtDate(w.to, { weekday: "short", day: "numeric", month: "short" })}`;
function weekHead(w, items) {
  const tw = thisWeek(), done = items.filter(i => S.done[i.id]).length;
  const tag = w.n === tw ? `<span class="pill green" style="margin-left:6px">This week</span>` : w.n < tw && done < items.length ? `<span class="pill amber" style="margin-left:6px">Catch up</span>` : "";
  return `<b>Week ${w.n}</b>${tag}<div class="small">${wkRange(w)}</div><div class="muted tiny">${done}/${items.length} done${items.length ? "" : " · no new lessons – review week"}</div>`;
}

// ------------------------------------------------------------------ free mode (Quest Mode off): skill map like the SE track
const KCOL = { vocab: "var(--kv)", grammar: "var(--kg)", phrases: "var(--kp)" };
function skillGroups() {
  const P = C.content.path, words = new Map();
  P.filter(i => i.kind === "vocab").sort((a, b) => a.n - b.n).forEach(i => {
    const t = i.title.split(" · ")[0].replace(/ [IVXL]+$/, "");
    if (!words.has(t)) words.set(t, { key: "v:" + t, kind: "vocab", title: t, items: [] });
    words.get(t).items.push(i);
  });
  const grammar = [...C.content.grammar].sort((a, b) => a.num - b.num).map(g => ({ key: "g:" + g.id, kind: "grammar", title: `${g.num}. ${g.title}`,
    items: (C.gparts[g.id] || [g.id]).map(id => C.item[id]).filter(Boolean) })).filter(s => s.items.length);
  const phrases = C.content.phrases.map(p => ({ key: "p:" + p.id, kind: "phrases", title: p.title, items: [C.item[p.id]].filter(Boolean) })).filter(s => s.items.length);
  return [["vocab", "🔤 Words", [...words.values()]], ["grammar", "📐 Grammar", grammar], ["phrases", "💬 Phrases", phrases]];
}
const skillUnits = sk => sk.items.flatMap(it => bitsOf(it).map((b, k) => ({ it, k, b })));
const unitDone = u => !!(S.done[u.it.id] || ((S.bits || {})[u.it.id] || [])[u.k]);
const skillFrac = sk => { const U = skillUnits(sk); return U.length ? U.filter(unitDone).length / U.length : 0; };
function unitLabel(u) {
  if (u.it.kind === "vocab") return `Lesson ${u.it.n} · ${u.b.map(id => C.word[id].de).join(", ")}`;
  if (u.it.kind === "grammar") { const P = gPart(u.it); return P ? P.t : "Read & practise"; }
  return u.b.map(j => C.phrases[u.it.id].items[j].de).join(" · ");
}
function freeToday() {
  const it = nextItem(), due = dueWords();
  view().innerHTML = topBar() + apkBanner() + `
  ${it ? `<div class="card next-card"><div class="sys-h">Up next</div>
      <div class="small row" style="font-weight:800;opacity:.9;gap:6px">${kicon(it.kind, false, true)} ${KIND[it.kind].toUpperCase()}</div>
      <div style="font-size:21px;font-weight:800;margin-top:4px">${esc(it.kind === "vocab" ? `Lesson ${it.n}: ${it.title}` : it.title)}</div>
      <div class="muted small">${partLabel(it) || "A suggestion – or pick any skill"}</div>
      <button class="btn" id="next">${bitsDone(it) ? "Continue" : "Start"}</button>
      <button class="btn ghost" id="all">🧩 Pick a skill</button><button class="link" id="ord" style="display:block;margin:6px auto 0">↓ See the recommended order</button></div>`
    : `<div class="card next-card"><div style="font-size:21px;font-weight:800">All lessons done! 🎓</div><div class="muted">Keep your reviews going until the exam.</div></div>`}
  ${due.length ? `<div class="card"><div class="sys-h">Memory training</div>
    <div class="quest" style="border:0"><span class="box"></span><div class="grow"><b>Review ${due.length} word${due.length > 1 ? "s" : ""} to remember</b>
      <div class="muted small">No pressure – reviews just keep words fresh</div></div>
      <button class="btn blue sm" id="rev">Review ${Math.min(20, due.length)}</button></div></div>` : ""}
  <p class="small muted" style="text-align:center">Quest Mode is off – no daily goal, quests or penalties. <a href="#/settings" class="link" style="padding:0">Change</a></p>`;
  const nb = view().querySelector("#next"); if (nb) nb.onclick = () => startItem(it);
  const ab = view().querySelector("#all"); if (ab) ab.onclick = () => { try { localStorage.setItem("a1.freeLayout", "skills"); } catch { /* ignore */ } location.hash = "#/path"; };
  const ob = view().querySelector("#ord"); if (ob) ob.onclick = () => { try { localStorage.setItem("a1.freeLayout", "order"); } catch { /* ignore */ } location.hash = "#/path"; };
  const rv = view().querySelector("#rev"); if (rv) rv.onclick = () => startReview(due.slice(0, 20));
  levelWatch();
  wireTop();
}
const freeLayout = () => { try { return localStorage.getItem("a1.freeLayout") || "skills"; } catch { return "skills"; } };
const layoutSwitch = cur => `<div class="segt" role="group" aria-label="Layout" style="margin:4px 0 10px;--c:var(--green)"><button data-fl="skills" class="${cur === "skills" ? "on" : ""}">🧩 Skills</button><button data-fl="order" class="${cur === "order" ? "on" : ""}">↓ Recommended order</button></div>`;
const wireLayout = () => view().querySelectorAll("[data-fl]").forEach(b => (b.onclick = () => { try { localStorage.setItem("a1.freeLayout", b.dataset.fl); } catch { /* ignore */ } pathView(); }));
// the suggested lesson sequence, without weeks, pace or goals
function orderView() {
  const nx = nextItem(), P = C.content.path, done = P.filter(i => S.done[i.id]).length;
  let k = 0;
  view().innerHTML = `<h1>Skills</h1>${layoutSwitch("order")}<p class="muted small">The suggested order of lessons, mixed so topics don't repeat back to back. ${done}/${P.length} done · tap any lesson.</p>
    <div class="nodes">${P.map(i => {
      const off = Math.round(Math.sin(k++ * 0.95) * 64), d = !!S.done[i.id], cur = nx && nx.id === i.id, side = off > 0 ? "l" : "r";
      return `<button class="node ${i.kind} ${d ? "done" : "avail"} ${cur ? "cur" : ""}" data-id="${i.id}" style="transform:translateX(${off}px)">
        ${cur ? `<span class="start-tip">${bitsDone(i) ? `${bitsDone(i)}/${bitCount(i)}` : "NEXT"}</span>` : ""}<span class="nglyph">${d ? "✓" : GLYPH[i.kind]}</span>
        ${!d && !cur && bitsDone(i) ? `<span class="bitbadge">${bitsDone(i)}/${bitCount(i)}</span>` : ""}
        <span class="lbl ${side}">${esc(i.kind === "vocab" ? `${i.n}. ${i.title}` : i.title)}</span></button>`; }).join("")}</div>`;
  wireLayout();
  view().querySelectorAll(".node").forEach(b => (b.onclick = () => itemSheet(C.item[b.dataset.id], orderView)));
  const c = view().querySelector(".node.cur"); if (c) setTimeout(() => c.scrollIntoView({ block: "center" }), 30);
}
function skillMapView() {
  if (freeLayout() === "order") return orderView();
  const groups = skillGroups(), all = groups.flatMap(g => g[2]);
  view().innerHTML = `<h1>Skills</h1>${layoutSwitch("skills")}<p class="muted small">Pick any skill and go at your own pace. Each ring fills as you finish its parts.</p>` +
    groups.map(([kind, label, sks]) => { const d = sks.filter(sk => skillFrac(sk) >= 1).length;
      return `<div class="sk-sec"><div class="sys-h">${label} · ${d}/${sks.length}</div><div class="skgrid">${sks.map(sk => { const U = skillUnits(sk), n = U.filter(unitDone).length;
        return `<button class="sktile ${n >= U.length ? "done" : ""}" data-s="${esc(sk.key)}">${ringSVG(U.length ? n / U.length : 0, KCOL[kind], n >= U.length ? "✓" : GLYPH[kind], 54)}
          <span class="skt">${esc(sk.title)}</span><span class="tiny muted">${n}/${U.length} parts</span></button>`; }).join("")}</div></div>`; }).join("");
  wireLayout();
  view().querySelectorAll(".sktile").forEach(b => (b.onclick = () => skillSheet(all.find(sk => sk.key === b.dataset.s))));
}
function skillSheet(sk) {
  const U = skillUnits(sk), n = U.filter(unitDone).length, nx = U.find(u => !unitDone(u));
  sheet(`<div class="row" style="gap:12px">${ringSVG(U.length ? n / U.length : 0, KCOL[sk.kind], GLYPH[sk.kind], 54)}<div class="grow">
      <div class="small muted" style="font-weight:800">${KIND[sk.kind].toUpperCase()} · ${n}/${U.length} PARTS</div><h2 style="margin:2px 0 0">${esc(sk.title)}</h2></div></div>
    <div class="parts">${U.map((u, i) => `<button class="part ${unitDone(u) ? "ok" : ""}" data-u="${i}"><span class="pn">${unitDone(u) ? "✓" : i + 1}</span><span class="grow pl">${esc(unitLabel(u))}</span><span>›</span></button>`).join("")}</div>
    <button class="btn" id="go">${nx ? (n ? "Continue" : "Start") : "Practise again"}</button>`,
  el => {
    const go = u => { closeSheet(); u.it.kind === "grammar" ? (location.hash = "#/grammar/" + u.it.id) : startItem(u.it, u.k); };
    el.querySelectorAll(".part").forEach(b => (b.onclick = () => go(U[+b.dataset.u])));
    el.querySelector("#go").onclick = () => go(nx || U[0]);
  });
}

// ------------------------------------------------------------------ path
function pathView() {
  if (!questMode()) return skillMapView();
  const nx = nextItem();
  const plan = weekPlan();
  let k = 0;
  view().innerHTML = `<h1>Your path to A1</h1>${paceCard(pace())}<p class="muted small">Everything is open – tap any lesson.</p>` +
    plan.weeks.map(W => [W, W.items]).map(([W, items]) => `<div class="week"><div class="week-h">${weekHead(W, items)}</div>
      <div class="nodes">${items.map(i => {
        const off = Math.round(Math.sin(k++ * 0.95) * 64);
        const done = !!S.done[i.id], cur = nx && nx.id === i.id;
        const side = off > 0 ? "l" : "r";
        return `<button class="node ${i.kind} ${done ? "done" : "avail"} ${cur ? "cur" : ""}" data-id="${i.id}" style="transform:translateX(${off}px)">
          ${cur ? `<span class="start-tip">${bitsDone(i) ? `${bitsDone(i)}/${bitCount(i)}` : "START"}</span>` : ""}<span class="nglyph">${done ? "✓" : GLYPH[i.kind]}</span>
          ${!done && !cur && bitsDone(i) ? `<span class="bitbadge">${bitsDone(i)}/${bitCount(i)}</span>` : ""}
          <span class="lbl ${side}">${esc(i.kind === "vocab" ? `${i.n}. ${i.title}` : i.title)}</span></button>`;
      }).join("")}</div></div>`).join("");
  view().querySelectorAll(".node").forEach(b => (b.onclick = () => itemSheet(C.item[b.dataset.id])));
  view().querySelector("#pacecard").onclick = () => (location.hash = "#/progress");
  const cur = view().querySelector(".node.cur");
  if (cur) setTimeout(() => cur.scrollIntoView({ block: "center" }), 30);
}

function itemSheet(it, refresh = pathView) {
  const d = S.done[it.id];
  let body = "";
  if (it.kind === "vocab") body = `<div class="chips">${it.words.map(id => `<span class="chip">${esc(C.word[id].de)}</span>`).join("")}</div>`;
  if (it.kind === "grammar") { const g = grammarOf(it), P = gPart(it); body = `${P ? `<p class="small"><b>Part ${it.part + 1} of ${it.of}</b> · ${P.q.length ? `${P.q.length} question${P.q.length > 1 ? "s" : ""}` : "short read"}</p>` : ""}<p class="small muted">${esc(g.intro).slice(0, 220)}…</p><p class="small">🎬 ${esc(g.watch)}</p>`; }
  if (it.kind === "phrases") body = `<p class="small muted">${C.phrases[it.id].items.length} phrases</p>`;
  sheet(`<div class="small muted row" style="font-weight:800;gap:6px">${kicon(it.kind, false, true)} ${KIND[it.kind].toUpperCase()}${questMode() ? ` · WEEK ${weekOf(it)}` : ""}</div>
    <h2 style="margin-top:4px">${esc(it.kind === "vocab" ? `Lesson ${it.n}: ${it.title}` : it.title)}</h2>${body}
    ${d ? `<p class="small"><span class="pill green">✓ Done ${fmtDate(d.date)}${d.score != null ? ` · ${d.score}%` : ""}</span></p>` : ""}
    ${bitCount(it) > 1 ? `<div class="parts">${bitsOf(it).map((b, k) => { const ok = d || (S.bits[it.id] || [])[k];
      const lbl = it.kind === "vocab" ? b.map(id => C.word[id].de).join(", ") : b.map(j => C.phrases[it.id].items[j].de).join(" · ");
      return `<button class="part ${ok ? "ok" : ""}" data-b="${k}"><span class="pn">${ok ? "✓" : k + 1}</span><span class="grow pl">${esc(lbl)}</span><span>›</span></button>`; }).join("")}</div>` : ""}
    <button class="btn" id="go">${d ? "Practise again" : it.kind === "grammar" ? "Read & practise" : bitsDone(it) ? `Continue · ${partLabel(it)}` : bitCount(it) > 1 ? `Start · ${partLabel(it)}` : "Start"}</button>
    ${d ? `<button class="btn ghost" id="undo">Mark as not done</button>` : `<button class="btn ghost" id="mk">I already know this – mark done</button>`}`,
  s => {
    s.querySelector("#go").onclick = () => startItem(it);
    s.querySelectorAll(".part").forEach(b => (b.onclick = () => startItem(it, +b.dataset.b)));
    const mk = s.querySelector("#mk"); if (mk) mk.onclick = () => { markDone(it); closeSheet(); toast("Marked as done"); refresh(); };
    const un = s.querySelector("#undo"); if (un) un.onclick = () => { delete S.done[it.id]; delete S.bits[it.id]; save(); closeSheet(); refresh(); };
  });
}

// ------------------------------------------------------------------ grammar reading
function grammarView(id) {
  const it = C.item[id], g = it && grammarOf(it);
  if (!g) return todayView();
  const P = gPart(it), first = !P || it.part === 0, last = !P || it.part === it.of - 1, nq = P ? P.q.length : g.q.length;
  document.querySelectorAll("#tabs a").forEach(a => a.classList.toggle("on", a.dataset.tab === "path"));
  const nextPart = P && !last ? C.item[`${g.id}.${it.part + 2}`] : null;
  view().innerHTML = `<button class="link" id="back">‹ ${questMode() ? "Path" : "Skills"}</button>
  <div class="small muted" style="font-weight:800">📐 GRAMMAR · CHAPTER ${g.num}${P ? ` · PART ${it.part + 1} OF ${it.of}` : ""}</div><h1>${esc(P ? P.t : g.title)}</h1>
  ${P ? `<div class="gparts">${Array.from({ length: it.of }, (_, k) => `<span class="${S.done[`${g.id}.${k + 1}`] ? "ok" : ""} ${k === it.part ? "cur" : ""}"></span>`).join("")}</div>
    ${P.t.startsWith(g.title) ? "" : `<p class="small muted" style="margin-top:4px">${esc(g.title)}</p>`}` : ""}
  ${first ? `<p class="small">🎬 ${esc(g.watch)}</p><p>${esc(g.intro)}</p>` : ""}
  <div class="gram">${personalize(P ? P.html : g.body + (g.after || ""))}</div>
  ${last ? `${g.ex.length ? "<h2>Examples</h2>" : ""}${g.ex.map(e => `<div class="ex"><button class="spk sm" data-a="${e.a || ""}" data-t="${esc(e.de)}">🔊</button>
    <div class="t"><div>${esc(e.de)}</div><div class="muted small">${esc(e.en)}</div></div></div>`).join("")}
  ${g.mist.length ? `<h2>Common mistakes</h2><div class="mist">${g.mist.map(m => `<div><span style="color:var(--red)">✗ ${esc(m.wrong)}</span><br>
    <span style="color:var(--green);font-weight:700">✓ ${esc(m.right)}</span><br><span class="muted">${esc(m.why)}</span></div>`).join("")}</div>` : ""}` : ""}
  <div style="height:16px"></div>
  <button class="btn" id="prac">${nq ? `Practise (${nq} question${nq > 1 ? "s" : ""})` : "Done reading ✓"}</button>
  ${S.done[id] ? `<p class="small muted" style="text-align:center">Done ${fmtDate(S.done[id].date)}${S.done[id].score != null ? ` · ${S.done[id].score}%` : ""}</p>` : ""}
  ${nextPart && !questMode() ? `<button class="btn ghost" id="np">Next part · ${esc(gPart(nextPart).t)} ›</button>` : ""}`;
  wireSpeakers(view());
  view().querySelector("#back").onclick = () => (location.hash = "#/path");
  view().querySelector("#prac").onclick = () => {
    if (nq) return startGrammarPractice(g, it);
    const first = !S.done[id], xp = grammarXP(g, it, null); addXP(xp);
    toast(first ? `Part done · +${xp} XP` : `Read again · +${xp} XP`); location.hash = questMode() || !nextPart ? "#/path" : "#/grammar/" + nextPart.id;
  };
  const np = view().querySelector("#np"); if (np) np.onclick = () => (location.hash = "#/grammar/" + nextPart.id);
}

// ------------------------------------------------------------------ words
// Words: grouped by topic in collapsible sections, or one sorted list (feedback 11-18)
let wf = { q: "", f: "all", sort: lsGet("a1.wordSort") || "topic" };
function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } }
const WORD_SORTS = [["topic", "By topic"], ["recent", "Newest learned"], ["weak", "Needs practice"], ["strong", "Strongest"], ["due", "Due soonest"], ["az", "A–Z"]];
const openTopics = () => new Set(JSON.parse(lsGet("a1.wordsOpen") || "[]"));
const topicName = t => String(t || "Other").replace(/^A\d*\.\s*/, "");
// "die (Kredit-)Karte" → "kredit-karte", "(ein)hundert" → "einhundert": alphabetical by the word itself
const azKey = de => de.replace(/^(der|die|das)\s+/i, "").replace(/[()]/g, "").toLowerCase();
function sortWords(list) {
  const s = id => S.words[id], far = "9999";
  const by = {
    recent: (a, b) => (s(b.id)?.since || "") .localeCompare(s(a.id)?.since || "") || (s(b.id) ? 1 : 0) - (s(a.id) ? 1 : 0),
    weak: (a, b) => (s(a.id) ? health(s(a.id)) : 2) - (s(b.id) ? health(s(b.id)) : 2) || (s(b.id)?.lapses || 0) - (s(a.id)?.lapses || 0),
    strong: (a, b) => (s(b.id)?.ivl ?? -1) - (s(a.id)?.ivl ?? -1),
    due: (a, b) => (s(a.id)?.due || far).localeCompare(s(b.id)?.due || far),
    az: (a, b) => azKey(a.de).localeCompare(azKey(b.de), "de"),
  }[wf.sort];
  return by ? [...list].sort(by) : list;
}
function wordsView() {
  const r = retention();
  view().innerHTML = `<h1>Words</h1><p class="muted small">${r.learned} of ${r.total} learned · ${r.mastered} mastered</p>
    <input class="search" id="q" placeholder="Search German or English…" value="${esc(wf.q)}">
    <div class="seg" id="seg">${[["all", "All"], ["due", "Due"], ["learning", "Learning"], ["known", "Known"], ["mastered", "Mastered"], ["new", "New"], ["core", "★ Core"]]
      .map(([k, l]) => `<button data-f="${k}" class="${wf.f === k ? "on" : ""}">${l}</button>`).join("")}</div>
    <div class="row wtools"><label class="small muted" for="ws">Sort</label><select id="ws" class="wsort">${WORD_SORTS.map(([v, l]) => `<option value="${v}" ${wf.sort === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <span class="grow"></span><button class="link small" id="wx" hidden></button></div>
    <div class="wl" id="wl"></div>`;
  const cls = { new: "", learning: "l", known: "k", mastered: "m" };
  const row = w => `<div class="wrow" data-id="${w.id}">
      <span class="dot ${cls[wordStatus(w.id)]}"></span><div class="t"><div>${esc(w.de)}</div><div>${esc(w.en)}</div></div>
      <button class="spk sm" data-a="${w.a || ""}" data-t="${esc(w.de)}">🔊</button></div>`;
  const draw = () => {
    const q = wf.q.toLowerCase().trim(), due = new Set(dueWords());
    const list = C.content.words.filter(w => {
      if (q && !w.de.toLowerCase().includes(q) && !w.en.toLowerCase().includes(q)) return false;
      if (wf.f === "all") return true;
      if (wf.f === "due") return due.has(w.id);
      if (wf.f === "core") return w.core;
      return wordStatus(w.id) === wf.f;
    });
    const wl = view().querySelector("#wl"), wx = view().querySelector("#wx");
    const grouped = wf.sort === "topic" && !q;
    wx.hidden = !grouped;
    if (!list.length) wl.innerHTML = `<div class="wrow muted">No words here yet.</div>`;
    else if (grouped) {
      const groups = new Map();
      list.forEach(w => { const t = topicName(w.topic); if (!groups.has(t)) groups.set(t, []); groups.get(t).push(w); });
      const open = openTopics();
      wl.innerHTML = [...groups].map(([t, ws]) => { const n = ws.filter(w => S.words[w.id]).length;
        return `<details class="wgrp" data-t="${esc(t)}" ${open.has(t) ? "open" : ""}><summary><span class="grow">${esc(t)}</span>
          <span class="tiny muted">${n}/${ws.length} learned</span></summary>${ws.map(row).join("")}</details>`; }).join("");
      const allOpen = [...groups.keys()].every(t => open.has(t));
      wx.textContent = allOpen ? "Collapse all" : "Expand all";
      wx.onclick = () => { lsSet("a1.wordsOpen", JSON.stringify(allOpen ? [] : [...groups.keys()])); draw(); };
      wl.querySelectorAll("details.wgrp").forEach(d => (d.ontoggle = () => {
        const s = openTopics(); d.open ? s.add(d.dataset.t) : s.delete(d.dataset.t); lsSet("a1.wordsOpen", JSON.stringify([...s]));
        wx.textContent = [...groups.keys()].every(t => s.has(t)) ? "Collapse all" : "Expand all";
      }));
    } else {
      const sorted = sortWords(list);
      wl.innerHTML = sorted.slice(0, 300).map(row).join("") +
        (sorted.length > 300 ? `<div class="wrow muted small">…${sorted.length - 300} more – search to narrow down</div>` : "");
    }
    wireSpeakers(wl);
    wl.querySelectorAll(".wrow[data-id]").forEach(r => (r.onclick = () => wordSheet(C.word[r.dataset.id])));
  };
  view().querySelector("#q").oninput = e => { wf.q = e.target.value; draw(); };
  view().querySelector("#ws").onchange = e => { wf.sort = e.target.value; lsSet("a1.wordSort", wf.sort); draw(); };
  view().querySelectorAll("#seg button").forEach(b => (b.onclick = () => { wf.f = b.dataset.f; wordsView(); }));
  draw();
}
function wordSheet(w) {
  const s = S.words[w.id];
  const st = { new: "Not learned yet", learning: "Learning", known: "Known", mastered: "Mastered" }[wordStatus(w.id)];
  sheet(wordCard(w) + `<p class="small muted" style="margin-top:12px">${st}${s ? ` · next review ${fmtDate(s.due)} · ✓${s.r} ✗${s.w}` : ""} · ${esc(w.topic)}</p>`,
    el => { wireSpeakers(el); play(w.a, w.de); });
}

// ------------------------------------------------------------------ progress
function chartSVG(pc) {
  const W = 340, H = 190, L = 30, Rm = 10, T = 10, B = 26;
  const start = S.settings.startDate, target = S.settings.targetDate;
  let end = target;
  if (pc.projected && pc.projected > target) end = pc.projected > addDays(target, 60) ? addDays(target, 60) : pc.projected;
  const span = Math.max(1, daysBetween(start, end));
  const X = d => L + (W - L - Rm) * Math.min(1, Math.max(0, daysBetween(start, d) / span));
  const Y = p => T + (H - T - B) * (1 - p / 100);
  const t = today();
  // actual
  let acc = 0; const pts = [[start, 0]];
  for (const [d, v] of history()) { if (d < start) { acc = v; pts[0][1] = acc; continue; } pts.push([d, v]); acc = v; }
  if (t > start) pts.push([t, acc]);
  const stepPath = pts.map(([d, v], i) => `${i ? "L" : "M"}${X(d).toFixed(1)},${Y(i ? pts[i - 1][1] : v).toFixed(1)}${i ? ` L${X(d).toFixed(1)},${Y(v).toFixed(1)}` : ""}`).join(" ");
  const grid = [0, 25, 50, 75, 100].map(p => `<line x1="${L}" x2="${W - Rm}" y1="${Y(p)}" y2="${Y(p)}" stroke="var(--line)"/><text x="${L - 4}" y="${Y(p) + 3}" text-anchor="end">${p}%</text>`).join("");
  // month ticks
  let ticks = ""; const d0 = parse(start); const m = new Date(d0.getFullYear(), d0.getMonth() + 1, 1);
  while (m <= parse(end)) {
    const s = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-01`;
    ticks += `<text x="${X(s)}" y="${H - 8}" text-anchor="middle">${m.toLocaleDateString("en-GB", { month: "short" })}</text>`;
    m.setMonth(m.getMonth() + 1);
  }
  const proj = pc.projected && t >= start ? `<line x1="${X(t)}" y1="${Y(pc.actual)}" x2="${X(pc.projected <= end ? pc.projected : end)}" y2="${Y(pc.projected <= end ? 100 : pc.actual + pc.actualPerDay * daysBetween(t, end))}" stroke="var(--green)" stroke-width="2" stroke-dasharray="2 4" opacity=".8"/>` : "";
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Expected versus actual pace">
    ${grid}${ticks}
    <line x1="${X(target)}" x2="${X(target)}" y1="${T}" y2="${H - B}" stroke="var(--amber)" stroke-dasharray="3 3"/>
    <text x="${X(target) - 3}" y="${T + 9}" text-anchor="end" style="fill:var(--amber);font-weight:700">🎯 target</text>
    <line x1="${X(start)}" y1="${Y(0)}" x2="${X(target)}" y2="${Y(100)}" stroke="var(--muted)" stroke-width="2" stroke-dasharray="6 5"/>
    ${proj}
    <path d="${stepPath}" fill="none" stroke="var(--green)" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="${X(t)}" cy="${Y(pc.actual)}" r="5" fill="var(--green)" stroke="var(--card)" stroke-width="2"/>
  </svg>`;
}

function progressView() {
  const pr = progress(), pc = pace(), r = retention();
  const nG = C.content.path.filter(i => i.kind === "grammar"), nP = C.content.path.filter(i => i.kind === "phrases"), nV = C.content.path.filter(i => i.kind === "vocab");
  const cnt = a => a.filter(i => S.done[i.id]).length;
  const wDone = nV.filter(i => S.done[i.id]).reduce((a, i) => a + i.words.length, 0);
  const bar = (label, val, max, sub, color) => `<div class="b"><div class="row"><span class="grow">${label}</span><span class="muted">${sub}</span></div>
    <div class="hbar"><div style="width:${100 * val / max}%;background:${color}"></div></div></div>`;
  const projTxt = pc.actual >= 99.9 ? "Done 🎓" : pc.projected ? fmtDate(pc.projected, { day: "numeric", month: "short", year: "numeric" }) : "—";
  const late = pc.projected && pc.projected > S.settings.targetDate;
  view().innerHTML = `<div class="row"><h1 class="grow">Progress</h1><button class="userchip" id="uc">${avatar(USER, true)}<span class="nm">${esc(userInfo(USER).name)}</span> ▾</button></div>
  ${statusWindow(pr, pc, r)}
  <div class="card" style="display:flex;gap:16px;align-items:center">
    <div class="ring big" style="--p:${pr.total}"><div>${pr.total.toFixed(0)}%<small>of A1</small></div></div>
    <div class="grow bars">
      ${bar("🔤 Vocabulary", pr.vocab, WEIGHTS.vocab, `${wDone}/${C.content.words.length}`, "var(--green)")}
      ${bar("📐 Grammar", pr.grammar, WEIGHTS.grammar, `${chaptersDone()}/${C.content.grammar.length} chapters`, "var(--blue)")}
      ${bar("💬 Phrases", pr.phrases, WEIGHTS.phrases, `${cnt(nP)}/${nP.length}`, "#ce82ff")}
    </div></div>
  <div class="card"><div class="row"><div class="grow" style="font-weight:800">Pace to ${fmtDate(S.settings.targetDate, { day: "numeric", month: "short", year: "numeric" })}</div>${paceLine(pc)}</div>
    ${chartSVG(pc)}
    <div class="legend"><span><i style="background:var(--muted)"></i>Expected pace</span><span><i style="background:var(--green)"></i>Your progress</span><span><i style="background:var(--green);opacity:.5"></i>Projection at current pace</span></div>
    <div class="stat-grid" style="margin-top:12px">
      <div class="tile"><span>Expected today</span><b>${pc.expected.toFixed(1)}%</b></div>
      <div class="tile"><span>You are at</span><b>${pc.actual.toFixed(1)}%</b></div>
      <div class="tile"><span>Needed pace</span><b>${pc.needLessonsPerWeek.toFixed(1)}</b><span class="tiny"> lessons / week</span></div>
      <div class="tile"><span>Your pace (14 d)</span><b>${pc.actualLessonsPerWeek.toFixed(1)}</b><span class="tiny"> lessons / week</span></div>
      <div class="tile"><span>Projected finish</span><b style="color:${late ? "var(--amber)" : "var(--green)"}">${projTxt}</b></div>
      <div class="tile"><span>Days left</span><b>${pc.left}</b></div>
    </div>
    <p class="muted tiny">A1 % = vocabulary ${WEIGHTS.vocab}% (by words) + grammar ${WEIGHTS.grammar}% (20 chapters) + phrases ${WEIGHTS.phrases}% (14 topics). Expected pace is a straight line from your start date to your target.</p>
  </div>
  <div class="card"><div style="font-weight:800;margin-bottom:6px">🧠 Memory</div>
    <div class="stat-grid">
      <div class="tile"><span>Learning</span><b style="color:var(--amber)">${r.learning}</b></div>
      <div class="tile"><span>Known (1 wk+)</span><b style="color:var(--green)">${r.known}</b></div>
      <div class="tile"><span>Mastered (1 mo+)</span><b style="color:#e0a800">${r.mastered}</b></div>
      <div class="tile"><span>Due now</span><b style="color:var(--blue)">${dueWords().length}</b></div>
      <div class="tile"><span>Memory health</span><b style="color:${memory().health < 0.85 ? "var(--red)" : "var(--green)"}">${Math.round(memory().health * 100)}%</b></div>
      <div class="tile"><span>Overdue · Forgotten</span><b>${memory().overdue} · ${memory().lapsed}</b></div>
    </div>
    ${memWarn()}
    <p class="muted small" style="margin-bottom:0">🔥 ${streak()} day streak · ⚡ ${totalXP()} XP total</p></div>
  <div class="card"><div class="row"><div class="grow" style="font-weight:800">⚡ XP</div><button class="link" id="xph">How is XP measured?</button></div>
    <div class="stat-grid"><div class="tile"><span>Today</span><b>${xpToday()}<span class="tiny muted">/${goalFor()}</span></b></div>
    <div class="tile"><span>Total</span><b>${totalXP()}</b></div>
    <div class="tile"><span>Last 7 days</span><b>${[0,1,2,3,4,5,6].reduce((a, k) => a + (S.xp[addDays(today(), -k)] || 0), 0)}</b></div>
    <div class="tile"><span>Days goal met</span><b>${Object.values(S.xp).filter(v => v >= goalFor()).length}</b></div></div>
    ${(S.penLog || []).length ? `<div class="small" style="margin-top:10px"><b style="color:var(--red)">Penalties: −${Object.values(S.pen).reduce((a, b) => a + b, 0)} XP</b>
      ${S.penLog.slice(-4).reverse().map(p => `<div class="muted tiny">${fmtDate(p.d)} · −${p.xp} XP · ${esc(p.why)}</div>`).join("")}</div>` : ""}</div>
`;
  const v = view();
  v.insertAdjacentHTML("beforeend", `<div id="cmp"></div>`); wireTop(); fillCompare();
  v.querySelector("#xph").onclick = () => sheet(XP_HELP + `<button class="btn" id="ok">Got it</button>`, el => (el.querySelector("#ok").onclick = closeSheet));
}

// ------------------------------------------------------------------ settings
function settingsView() {
  const p = weekPlan(), daysLeft = daysBetween(today(), S.settings.targetDate);
  view().innerHTML = `<div class="row"><h1 class="grow">Settings</h1><button class="userchip" id="uc">${avatar(USER, true)}<span class="nm">${esc(userInfo(USER).name)}</span> ▾</button></div>
  <div class="card"><div class="sys-h">Mode</div><div style="font-weight:800">⚔️ Quest Mode</div>
    <label class="toggle">Follow the quest system <input type="checkbox" id="qm" ${questMode() ? "checked" : ""}></label>
    <p class="muted small" style="margin:6px 0 0">${questMode() ? "<b>On:</b> a guided day-by-day Path with a daily goal, daily quests, 💎 diamonds and streak gifts. Missed review days cost XP."
      : "<b>Off:</b> a skill map like the Software Engineering track: pick any skill and finish its parts at your own pace. No daily goal, quests or penalties. XP, level and reviews still count."} Your progress is the same either way, so you can switch any time.</p></div>
  <div class="card"><div class="sys-h">Goal & pace</div><div style="font-weight:800">🎯 Goal & pace</div>
    <label class="f">Target completion date (A1 reached)</label><input type="date" id="tg" value="${S.settings.targetDate}" min="${addDays(today(), 7)}">
    <p class="muted small" style="margin:6px 0 0">${daysLeft > 0 ? `${daysLeft} days left` : "Target date has passed"} · ${p.nWeeks} weeks planned (Mon–Sun). Changing the date re-spreads all lessons across the weeks.</p>
    <label class="f">Pace counted from</label><input type="date" id="sd" value="${S.settings.startDate}">
    <label class="f">Daily goal</label>
    <select id="gm"><option value="auto" ${S.settings.goalMode !== "manual" ? "selected" : ""}>Auto (recommended)</option><option value="manual" ${S.settings.goalMode === "manual" ? "selected" : ""}>Manual – my own goal</option></select>
    ${S.settings.goalMode === "manual" ? `<label class="f">My daily goal (XP)</label><input type="number" id="dg" min="5" step="5" value="${S.settings.dailyGoal}">`
      : `<div class="note" style="margin-top:8px">Today's goal: <b>${goalFor()} XP</b> · about ${remainingXP()} XP of lessons left over ${Math.max(1, daysBetween(today(), S.settings.targetDate) + 1)} days, plus daily reviews. It is set each morning and goes up if you fall behind, down if you get ahead.</div>`}
    <p class="muted small" style="margin:6px 0 0">⚡ <b>1 XP ≈ one new word learned.</b> Each finished part adds +2 (+1 if perfect) and a whole lesson +5. Reviews give a little (+1 per 5 words recalled) and forgetting costs XP. 20 XP ≈ one new lesson a day.</p>
    <button class="link" id="xph">How is XP measured?</button></div>
  <div class="card"><div class="sys-h">Look & sound</div><div style="font-weight:800">🎨 Look & sound</div>
    <label class="f">Theme</label><select id="th">${themeOptions(S.settings.theme || "system")}</select>
    <label class="f">Hero</label><select id="hero">${Object.entries(HERO_STYLES).map(([k, n]) => `<option value="${k}" ${heroStyle() === k ? "selected" : ""}>${k === "f" ? "🗡️" : "⚔️"} ${n}</option>`).join("")}</select>
    <label class="toggle">Show Hindi pronunciation hints <input type="checkbox" id="hi" ${S.settings.hindi ? "checked" : ""}></label>
    <label class="toggle">Play audio automatically <input type="checkbox" id="ap" ${S.settings.autoplay ? "checked" : ""}></label>
    <label class="toggle">Sounds on <input type="checkbox" id="snd" ${S.settings.sound ? "checked" : ""}></label>
    ${speakAvailable() ? `<label class="toggle">🎤 Speaking practice in phrase lessons <input type="checkbox" id="spk" ${S.settings.speak !== false ? "checked" : ""}></label>
    <p class="muted small" style="margin:4px 0 0">Uses the microphone; Chrome sends the audio to Google to recognise it. Optional, never costs XP.</p>` : ""}</div>
  <div class="card"><div class="sys-h">Offline</div><div style="font-weight:800">📶 Offline</div>
    <p class="muted small">Save all pronunciation clips on this phone so lessons work without internet.</p>
    <button class="btn ghost" id="dl">Download all audio</button><p class="small" id="dlst"></p></div>
  ${offerApk() ? `<div class="card"><div class="sys-h">App</div><div style="font-weight:800">📱 Android app</div>
    <p class="muted small">Install LevelUp as an app: full screen, own icon, same account and progress.</p>${apkBtn("btn")}</div>` : ""}
  <div class="card"><div class="sys-h">Invite</div><div style="font-weight:800">🎁 Invite friends</div>
    <p class="muted small">Learning is more fun with a party. Share LevelUp and compare progress.</p><button class="btn" id="inv">Share / invite</button></div>
  <div class="card"><div class="sys-h">Data</div><div style="font-weight:800">💾 Backup</div>
    <p class="muted small">${isGuest() ? "Guest progress is saved only on this phone. Create an account (above) to save it on the server, or export a copy here." : "Progress is saved on the LevelUp server, with a daily backup. You can also export a copy here."}</p>
    <div class="row"><button class="btn ghost sm grow" id="ex">Export</button><button class="btn ghost sm grow" id="im">Import</button></div>
    <input type="file" id="imf" accept="application/json" hidden>
    <button class="link" id="reset" style="color:var(--red);margin-top:8px">Reset ${esc(userInfo(USER).name)}'s progress…</button></div>
  ${isGuest() ? `<div class="card"><div class="sys-h">Account</div>${GUEST_NOTE}<button class="btn" id="gsu">Create free account</button>
    <button class="btn ghost" id="glv" style="margin-top:8px">Leave guest mode</button></div>`
    : AUTH === "on" ? `<div class="card"><div class="sys-h">Account</div><div class="row"><div class="grow"><b>${esc(userInfo(USER).name)}</b><div class="muted small">Logged in as ${esc(USER)}</div></div>
    <button class="btn ghost sm" id="cpw">Change password</button></div><button class="btn" id="lout" style="margin-top:14px">Log out</button></div>`
    : `<div class="card"><div class="sys-h">Profile</div><div class="row"><div class="grow"><b>Learner</b><div class="muted small">${esc(userInfo(USER).name)}</div></div>
    <button class="btn ghost sm" id="swu">Switch learner</button></div></div>`}`;
  const v = view();
  wireTop();
  v.querySelector("#inv").onclick = shareApp;
  if (isGuest()) { v.querySelector("#gsu").onclick = guestSignup; v.querySelector("#glv").onclick = doLeaveGuest; }
  else if (AUTH === "on") { v.querySelector("#cpw").onclick = passwordSheet; v.querySelector("#lout").onclick = doLogout; }
  else v.querySelector("#swu").onclick = userSheet;
  v.querySelector("#xph").onclick = () => sheet(XP_HELP + `<button class="btn" id="ok">Got it</button>`, el => (el.querySelector("#ok").onclick = closeSheet));
  const setS = (k, val) => { S.settings[k] = val; save(); };
  v.querySelector("#tg").onchange = e => {
    const t = e.target.value;
    if (!t || t <= today()) return toast("Pick a target date in the future"), (e.target.value = S.settings.targetDate);
    if (t <= S.settings.startDate) return toast("Target must be after the start date"), (e.target.value = S.settings.targetDate);
    setS("targetDate", t); toast(`Target set to ${fmtDate(t, { day: "numeric", month: "long", year: "numeric" })}`); settingsView();
  };
  v.querySelector("#sd").onchange = e => { if (e.target.value && e.target.value < S.settings.targetDate) { setS("startDate", e.target.value); settingsView(); } else { toast("Start must be before the target"); e.target.value = S.settings.startDate; } };
  const dg = v.querySelector("#dg"); if (dg) dg.onchange = e => setS("dailyGoal", Math.max(5, +e.target.value || 20));
  v.querySelector("#gm").onchange = e => { setS("goalMode", e.target.value); if (e.target.value === "manual" && !S.settings.dailyGoal) setS("dailyGoal", goalFor()); settingsView(); };
  v.querySelector("#qm").onchange = e => { setS("quest", e.target.checked); if (e.target.checked) S.penChecked = addDays(today(), -1), save(); toast(e.target.checked ? "Quest Mode on" : "Quest Mode off – skill map"); route(); };
  v.querySelector("#th").onchange = e => { setS("theme", e.target.value); applyTheme(); settingsView(); };
  v.querySelector("#hero").onchange = e => { setHero(e.target.value); toast(`${HERO_STYLES[e.target.value]} selected`); settingsView(); };
  v.querySelector("#hi").onchange = e => setS("hindi", e.target.checked);
  v.querySelector("#ap").onchange = e => setS("autoplay", e.target.checked);
  v.querySelector("#snd").onchange = e => setS("sound", e.target.checked);
  const spk = v.querySelector("#spk"); if (spk) spk.onchange = e => setS("speak", e.target.checked);
  v.querySelector("#dl").onclick = downloadAudio;
  v.querySelector("#ex").onclick = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([exportState()], { type: "application/json" }));
    a.download = `deutsch-a1-backup-${today()}.json`; a.click();
  };
  v.querySelector("#im").onclick = () => v.querySelector("#imf").click();
  v.querySelector("#imf").onchange = async e => {
    try { importState(await e.target.files[0].text()); toast("Backup restored"); settingsView(); } catch (err) { toast("Could not read that file"); }
  };
  v.querySelector("#reset").onclick = () => sheet(`<h2 style="margin-top:0">Reset ${esc(userInfo(USER).name)}'s progress?</h2><p class="muted">All of ${esc(userInfo(USER).name)}'s lessons, words, XP and streak will be deleted (yesterday's backup stays in LevelUp/progress/backups). Export a backup first if unsure.</p>
    <button class="btn red" id="yes">Delete all progress</button><button class="btn ghost" id="no">Cancel</button>`, el => {
    el.querySelector("#no").onclick = closeSheet;
    el.querySelector("#yes").onclick = () => { resetAll(); closeSheet(); location.hash = "#/today"; route(); };
  });
}

async function downloadAudio() {
  const st = view().querySelector("#dlst");
  if (!("caches" in window)) { st.textContent = "This browser can't store files offline."; return; }
  const ids = new Set();
  C.content.words.forEach(w => { w.a && ids.add(w.a); (w.ex || []).forEach(e => e.a && ids.add(e.a)); });
  C.content.grammar.forEach(g => g.ex.forEach(e => e.a && ids.add(e.a)));
  C.content.phrases.forEach(p => p.items.forEach(i => i.a && ids.add(i.a)));
  const cache = await caches.open("a1-audio-v1");
  const list = [...ids]; let done = 0, fail = 0;
  const work = async () => {
    while (list.length) {
      const id = list.pop(), url = `audio/${id}.mp3`;
      try { if (!(await cache.match(url))) { const r = await fetch(url); if (r.ok) await cache.put(url, r); else fail++; } } catch { fail++; }
      done++; if (done % 25 === 0 || !list.length) st.textContent = `${done} / ${ids.size} clips saved${fail ? ` (${fail} failed)` : ""}`;
    }
  };
  await Promise.all(Array.from({ length: 6 }, work));
  st.textContent = `✅ ${ids.size - fail} clips saved for offline use${fail ? ` · ${fail} failed – try again later` : ""}`;
}

// ------------------------------------------------------------------ course picker (homepage: what to study)
const pickKey = () => `a1.picked.${USER}`;
function picked() { try { return sessionStorage.getItem(pickKey()) === COURSE; } catch { return true; } }
function unpick() { try { sessionStorage.removeItem(pickKey()); } catch { /* ignore */ } }
function markPicked() { try { sessionStorage.setItem(pickKey(), COURSE); } catch { /* ignore */ } }
function courseView() {
  document.body.classList.add("in-lesson"); // full-screen, no tabs
  const groups = {};
  COURSES.forEach(c => (groups[c.group || "Courses"] = groups[c.group || "Courses"] || []).push(c));
  const sm = S && S.setup ? summary(S) : null;
  view().innerHTML = `${gearBtn()}<div class="row" style="margin-bottom:8px"><button class="userchip" id="uc">${avatar(USER, true)}<span class="nm">${esc(userInfo(USER).name)}</span> ▾</button></div>
    <div style="text-align:center;padding:4vh 0 10px"><div class="sysbanner">Select a path</div><h1>What do you want to study?</h1>
    <p class="muted">Pick a course. Each one keeps its own level, rank and progress.</p></div>
    ${Object.entries(groups).map(([g, cs]) => `<h3>${esc(g)}</h3><div class="courses">${cs.map(c => {
      const here = sm && c.id === COURSE;
      return `<button class="course ${c.status !== "ready" ? "soon" : ""} ${c.id === COURSE ? "cur" : ""}" data-c="${c.id}" ${c.status !== "ready" ? "disabled" : ""} style="--c:${c.color || "#5aa9ff"}">
        <span class="cicon">${esc(c.icon)}</span><span class="grow"><b>${esc(c.title)}</b>
        <span class="muted small">${here ? `Lv ${sm.lv} · ${sm.rank}-Rank · ${sm.pct.toFixed(0)}% done` : esc(c.subtitle || "")}</span></span>
        <span class="cgo">${c.status === "ready" ? (here ? "Continue ›" : "Start ›") : "Coming Soon"}</span></button>`; }).join("")}</div>`).join("")}`;
  wireTop();
  view().querySelectorAll(".course[data-c]:not([disabled])").forEach(b => (b.onclick = async () => {
    b.disabled = true;
    if (b.dataset.c !== COURSE || !S) await switchCourse(b.dataset.c); else setCourse(b.dataset.c);
    markPicked(); document.body.classList.remove("in-lesson");
    if (location.hash !== "#/today") location.hash = "#/today"; else route();
  }));
  view().querySelector("#gear").onclick = themeSheet;
}

// ------------------------------------------------------------------ skill-tree courses (Software Engineering)
let treeBranch = null;
const treeNodes = b => (C.content.nodes || []).filter(n => n.branch === b);
const nodeDone = id => !!(S.tree || {})[id];
const nodeOpen = n => n.req.every(nodeDone);
// A long skill is split into 3-4 parts (built by tools/build_se_content.py at section boundaries).
// Progress per part lives in S.parts[nodeId][partIndex] = date; a skill is learned when every part is done.
const nodeParts = n => (n.parts && n.parts.length ? n.parts : null);
const partDone = (n, k) => nodeDone(n.id) || !!((S.parts || {})[n.id] || {})[k];
const partsDoneCount = n => { const P = nodeParts(n); return P ? P.filter((_, k) => partDone(n, k)).length : (nodeDone(n.id) ? 1 : 0); };
const nextPart = n => { const P = nodeParts(n); if (!P) return null; const k = P.findIndex((_, j) => !partDone(n, j)); return k < 0 ? 0 : k; };
// Course home (#/home): "Continue" card + a grid of open branches + coming-soon tags.
// Branch view (#/branch/<id>): the skills orbit the branch (map) or run top-down (path); ‹ › arrows / swipe change branch.
const openBranches = () => [...C.content.branches].filter(b => b.status === "open").sort((a, b) => a.order - b.order);
const nodeFrac = n => { const P = nodeParts(n); return nodeDone(n.id) ? 1 : P ? partsDoneCount(n) / P.length : 0; };
const branchFrac = b => { const ns = treeNodes(b.id); return ns.length ? ns.reduce((a, n) => a + nodeFrac(n), 0) / ns.length : 0; };
const nextNode = b => treeNodes(b.id).sort((x, y) => x.n - y.n).find(n => !nodeDone(n.id) && nodeOpen(n));
let pendingRead = null;                                        // node to open in the reader once its branch view is drawn
const treeLayout = () => { try { return localStorage.getItem("a1.treeLayout") || "map"; } catch { return "map"; } };
function continueTarget() {
  const lr = S.lastRead && C.content.nodes.find(n => n.id === S.lastRead.id);
  if (lr) {
    const br = C.content.branches.find(b => b.id === lr.branch);
    if (br && br.status === "open") { const n = !nodeDone(lr.id) && nodeOpen(lr) ? lr : nextNode(br); if (n) return { br, n, fresh: false }; }
  }
  const brs = openBranches(), started = brs.filter(b => branchFrac(b) > 0 && nextNode(b));
  const br = started[0] || brs.find(b => nextNode(b));
  return br ? { br, n: nextNode(br), fresh: !started.length } : null;
}
function ringSVG(frac, color, icon, s = 46) {
  const r = s / 2 - 4, Cc = 2 * Math.PI * r;
  return `<svg viewBox="0 0 ${s} ${s}" width="${s}" height="${s}" aria-hidden="true"><circle cx="${s / 2}" cy="${s / 2}" r="${r}" class="hring"/>
    <circle cx="${s / 2}" cy="${s / 2}" r="${r}" class="hring on" style="stroke:${color}" stroke-dasharray="${(Cc * frac).toFixed(1)} ${Cc.toFixed(1)}" transform="rotate(-90 ${s / 2} ${s / 2})"/>
    <text x="50%" y="${s / 2 + 6}" text-anchor="middle" font-size="${s * 0.38}">${icon}</text></svg>`;
}
const topRow = () => `<div class="row" style="margin-bottom:10px;gap:8px"><button class="userchip" id="uc">${avatar(USER, true)}<span class="nm">${esc(userInfo(USER).name)}</span> ▾</button>
  <button class="coursechip" id="cc" aria-label="Change course">${esc(C.course.icon)} <span class="nm">${esc(C.course.title)}</span> ▾</button><span class="grow"></span>
  <span class="gemchip" style="cursor:default">⚡ <b>${totalXP()}</b></span></div>`;
function seHome() {
  document.body.classList.add("in-lesson");
  S.tree = S.tree || {};
  const T = C.content, brs = openBranches(), soon = [...T.branches].filter(b => b.status !== "open").sort((a, b) => a.order - b.order);
  const all = brs.flatMap(b => treeNodes(b.id)), done = all.filter(n => nodeDone(n.id)).length, ct = continueTarget();
  let cont = "";
  if (ct) {
    const { br, n } = ct, lbl = readLabel(n, "open").replace(/^📖 /, "");
    cont = `<div class="contcard" style="--c:${br.color}"><div class="tiny" style="opacity:.85">${ct.fresh ? "Start here" : "Continue"} · ${br.icon} ${esc(br.title)}</div>
      <div class="ct-t">Skill ${n.n} · ${esc(n.title)}</div><div class="tiny muted">${esc(lbl)} · about ${n.mins} min</div>
      <button class="btn" id="cont" style="margin:10px 0 0">${ct.fresh || /^Start/.test(lbl) ? "Start" : "Continue"}</button></div>`;
  } else if (brs.length) cont = `<div class="contcard" style="--c:#57e3a0"><div class="ct-t">👑 Every open branch is complete</div><div class="tiny muted">New branches are on the way.</div></div>`;
  view().innerHTML = topRow() + `<div style="margin:2px 2px 10px"><div style="font-size:21px;font-weight:800">${esc(T.title)}</div>
      <div class="muted small">${brs.length} branches open · ${done} of ${all.length} skills learned</div></div>${cont}
    <div class="sec-h">Your branches</div>
    <div class="bgrid">${brs.map(b => { const ns = treeNodes(b.id), d = ns.filter(n => nodeDone(n.id)).length, nx = nextNode(b);
      return `<button class="bcard" data-b="${b.id}" style="--c:${b.color}" aria-label="${esc(b.title)}: ${d} of ${ns.length} skills"><div class="row" style="justify-content:space-between">${ringSVG(branchFrac(b), b.color, b.icon)}<span class="tiny muted">${d}/${ns.length}</span></div>
        <div class="bc-t">${esc(b.title)}</div><div class="tiny muted">${nx ? `Next: ${esc(nx.title)}` : d === ns.length ? "👑 Complete" : ""}</div></button>`; }).join("")}</div>
    ${soon.length ? `<div class="sec-h">Coming soon</div><div class="soontags">${soon.map(b => `<button class="soontag" data-s="${b.id}">${b.icon} ${esc(b.title)}</button>`).join("")}</div>` : ""}`;
  wireTop();
  view().querySelectorAll(".bcard").forEach(b => (b.onclick = () => (location.hash = "#/branch/" + b.dataset.b)));
  view().querySelectorAll(".soontag").forEach(b => (b.onclick = () => { const s = T.branches.find(x => x.id === b.dataset.s);
    sheet(`<div style="font-size:20px;font-weight:800">${s.icon} ${esc(s.title)}</div><p class="muted small" style="margin:4px 0 0">Coming soon. Planned skills:</p>
      <ol class="planned">${(s.planned || []).map(p => `<li>${esc(p)}</li>`).join("")}</ol><button class="btn ghost" id="close">Close</button>`, el => (el.querySelector("#close").onclick = closeSheet)); }));
  const cb = view().querySelector("#cont");
  if (cb) cb.onclick = () => { pendingRead = ct.n.id; location.hash = "#/branch/" + ct.br.id; };
  window.scrollTo(0, 0);
}
function treeView(id) {
  document.body.classList.add("in-lesson");                 // full screen: language tabs don't apply here
  S.tree = S.tree || {};
  const T = C.content, brs = openBranches();
  if (id && brs.some(b => b.id === id)) treeBranch = id;
  if (!treeBranch || !brs.some(b => b.id === treeBranch)) return seHome();
  const i = brs.findIndex(b => b.id === treeBranch), br = brs[i], nodes = treeNodes(br.id), done = nodes.filter(n => nodeDone(n.id)).length;
  const prev = brs[(i + brs.length - 1) % brs.length], next = brs[(i + 1) % brs.length], lay = treeLayout();
  view().innerHTML = topRow() + `<button class="link backlink" id="home">‹ All branches</button>
    ${brs.length > 1 ? `<div class="bpager"><button class="pgb" id="pv" aria-label="Previous branch: ${esc(prev.title)}">‹</button>
      <div class="pdots">${brs.map((b, k) => `<i class="${k === i ? "on" : ""}" style="${k === i ? `background:${b.color}` : ""}"></i>`).join("")}</div>
      <button class="pgb" id="nx" aria-label="Next branch: ${esc(next.title)}">›</button></div>` : ""}
    <div class="card" style="--c:${br.color}"><div class="row"><div class="grow"><div style="font-weight:800">${br.icon} ${esc(br.title)}</div>
        <div class="muted small">${done} of ${nodes.length} skills learned · about ${nodes.reduce((a, n) => a + n.mins, 0)} min of reading</div></div>
        ${br.intro != null ? `<button class="btn ghost sm" id="intro" style="width:auto;margin:0">📖 About</button>` : ""}</div>
        <div class="hbar" style="margin-top:8px"><div style="width:${100 * done / nodes.length}%;background:${br.color}"></div></div>
        <div class="row" style="margin-top:8px;gap:8px"><div class="segt" role="group" aria-label="Layout"><button data-l="map" class="${lay === "map" ? "on" : ""}">◎ Map</button><button data-l="path" class="${lay === "path" ? "on" : ""}">↓ Path</button></div><span class="grow"></span></div>
        ${br.reading ? `<div class="tiny muted dlbar" id="dlbar"></div>` : ""}</div>
      <div class="treebox" id="tbox">${lay === "map" ? treeOrbit(nodes, br) : treeSVG(nodes, br.color)}</div>
      ${brs.length > 1 ? `<div class="tiny muted" style="text-align:center">‹ ${esc(prev.title)} · swipe · ${esc(next.title)} ›</div>` : ""}`;
  wireTop();
  const go = b => location.replace("#/branch/" + b.id);
  view().querySelector("#home").onclick = () => (location.hash = "#/home");
  const pv = view().querySelector("#pv"), nx = view().querySelector("#nx");
  if (pv) { pv.onclick = () => go(prev); nx.onclick = () => go(next); }
  view().querySelectorAll(".segt button").forEach(b => (b.onclick = () => { try { localStorage.setItem("a1.treeLayout", b.dataset.l); } catch { /* private mode */ } treeView(); }));
  view().querySelectorAll(".tnode").forEach(g => {
    g.onclick = () => nodeSheet(g.dataset.id);
    g.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); nodeSheet(g.dataset.id); } };
  });
  const core = view().querySelector(".tcore"); if (core && br.intro != null) core.onclick = () => openReader(br, null);
  const ib = view().querySelector("#intro"); if (ib) ib.onclick = () => openReader(br, null);
  if (br.reading) fillDownloads(br);
  const tb = view().querySelector("#tbox"); let x0 = null, y0 = null;     // swipe the map/path sideways = next branch
  if (brs.length > 1) {
    tb.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    tb.addEventListener("touchend", e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) go(dx < 0 ? next : prev); });
  }
  window.scrollTo(0, 0);
  if (pendingRead) { const n = nodes.find(x => x.id === pendingRead); pendingRead = null; if (n) openReader(br, n); }
}
const wrapT = (t, w = 15) => { const ws = t.split(" "), out = [""]; ws.forEach(x => { if ((out[out.length - 1] + " " + x).trim().length > w) out.push(x); else out[out.length - 1] = (out[out.length - 1] + " " + x).trim(); }); return out.slice(0, w < 15 ? 3 : 2); };
const wrapN = (t, w) => wrapT(t, w).length;
// one skill bubble: circle, part ring, icon/lock, check, and its label (lab = {x, y, anchor} for the first line)
function nodeG(n, x, y, color, lab) {
  const st = nodeDone(n.id) ? "done" : nodeOpen(n) ? "open" : "locked", r = n.boss ? 30 : 26, P = nodeParts(n);
  let ring = "";
  if (P && P.length > 1) {                         // one arc per part, filled when that part is done
    const R = r + 6, gap = 14, seg = 360 / P.length, pt = a => [x + R * Math.cos(a * Math.PI / 180), y + R * Math.sin(a * Math.PI / 180)];
    ring = P.map((_, k) => {
      const a0 = -90 + k * seg + gap / 2, a1 = -90 + (k + 1) * seg - gap / 2, [sx, sy] = pt(a0), [ex, ey] = pt(a1);
      return `<path d="M${sx.toFixed(1)},${sy.toFixed(1)} A${R},${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${ex.toFixed(1)},${ey.toFixed(1)}" class="tseg ${partDone(n, k) ? "on" : ""}"/>`;
    }).join("");
  }
  return `<g class="tnode ${st} ${n.boss ? "boss" : ""}" data-id="${n.id}" style="--c:${color}" tabindex="0" role="button" aria-label="${esc(n.title)} (${st})">
    ${st === "open" ? `<circle cx="${x}" cy="${y}" r="${r + 12}" class="tring"/>` : ""}
    <circle cx="${x}" cy="${y}" r="${r}" class="tc"/>${ring}
    <text x="${x}" y="${y + 7}" text-anchor="middle" font-size="22">${st === "locked" ? "🔒" : n.icon}</text>
    ${st === "done" ? `<circle cx="${x + 19}" cy="${y - 19}" r="8" class="tcheck"/><text x="${x + 19}" y="${y - 15.5}" text-anchor="middle" font-size="10" fill="#0b1222" font-weight="900">✓</text>` : ""}
    ${wrapT(n.title, lab.w).map((l, k) => `<text x="${lab.x}" y="${lab.y + k * 13}" text-anchor="${lab.anchor}" class="tlabel">${esc(l)}</text>`).join("")}</g>`;
}
function treeSVG(nodes, color) {
  const W = 340, top = 44, gapY = 116, X = c => [62, 170, 278][c], Y = l => top + l * gapY;
  const maxL = Math.max(...nodes.map(n => n.level)), H = Y(maxL) + 70;
  const by = Object.fromEntries(nodes.map(n => [n.id, n]));
  let edges = "", body = "";
  for (const n of nodes) for (const r of n.req) {
    const p = by[r]; if (!p) continue;
    const x1 = X(p.col), y1 = Y(p.level) + 36 + (wrapN(p.title) * 13) + 6, x2 = X(n.col), y2 = Y(n.level) - 38, my = (y1 + y2) / 2;
    edges += `<path d="M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}" class="tedge ${nodeDone(r) ? "lit" : ""}" style="--c:${color}"/>`;
  }
  for (const n of nodes) body += nodeG(n, X(n.col), Y(n.level), color, { x: X(n.col), y: Y(n.level) + 51, anchor: "middle" });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:420px;display:block;margin:0 auto">${edges}${body}</svg>`;
}
// Map layout: the skills orbit the branch on a tall oval, in skill order, clockwise from the top.
// Spokes join each skill to the branch core; exact prerequisite links are shown in Path view.
function treeOrbit(nodes, br) {
  const ns = [...nodes].sort((a, b) => a.n - b.n), N = ns.length, color = br.color;
  const W = 380, cx = 190, a = 84, gap = 86, padT = 84, padB = 70;
  const per = b => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
  let b = 150; while (per(b) < N * gap) b += 5;
  const cy = padT + b, H = cy + b + padB;
  const S2 = 720, pts = [], cum = [0];                        // sample the oval so skills sit at equal distances
  for (let k = 0; k <= S2; k++) { const t = -Math.PI / 2 + 2 * Math.PI * k / S2; pts.push([cx + a * Math.cos(t), cy + b * Math.sin(t)]); if (k) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1])); }
  const L = cum[S2], at = s => { let k = cum.findIndex(c => c >= s); if (k < 0) k = S2; return pts[k]; };
  const pos = Object.fromEntries(ns.map((n, k) => [n.id, at(L * k / N)]));
  // the orbit track joins skill k to skill k+1 (an open ring: the last skill ends it)
  const trackAt = (s0, s1) => { const k0 = cum.findIndex(c => c >= s0), k1 = cum.findIndex(c => c >= s1); return pts.slice(k0, k1 + 1).map(([x, y], j) => `${j ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(""); };
  let spokes = "", body = "", track = "";
  for (let k = 0; k < N - 1; k++) track += `<path d="${trackAt(L * k / N + 34, L * (k + 1) / N - 34)}" class="tedge ${nodeDone(ns[k].id) ? "lit" : ""}" style="--c:${color}"/>`;
  for (const n of ns) {
    const [x, y] = pos[n.id], st = nodeDone(n.id) ? "lit" : nodeOpen(n) ? "near" : "";
    spokes += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="tspoke ${st}" style="--c:${color}"/>`;
    const off = x - cx, side = Math.abs(off) >= 30, lines = wrapN(n.title, side ? 12 : 15), r = n.boss ? 30 : 26;   // side labels wrap narrower so they fit the screen
    const lab = Math.abs(off) < 30 ? (y < cy ? { x, y: y - r - 14 - (lines - 1) * 13, anchor: "middle" } : { x, y: y + r + 22, anchor: "middle" })
      : { x: off < 0 ? x - r - 10 : x + r + 10, y: y + 4 - (lines - 1) * 6.5, anchor: off < 0 ? "end" : "start", w: 12 };
    body += nodeG(n, +x.toFixed(1), +y.toFixed(1), color, lab);
  }
  const done = ns.filter(n => nodeDone(n.id)).length, fr = branchFrac(br), R = 32, Cc = 2 * Math.PI * (R + 6);
  const core = `<g class="tcore" ${br.intro != null ? `role="button" tabindex="0" aria-label="About ${esc(br.title)}"` : ""} style="--c:${color}">
    <circle cx="${cx}" cy="${cy}" r="${R + 6}" class="hring"/><circle cx="${cx}" cy="${cy}" r="${R + 6}" class="hring on" style="stroke:${color}" stroke-dasharray="${(Cc * fr).toFixed(1)} ${Cc.toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>
    <circle cx="${cx}" cy="${cy}" r="${R}" class="tcore-c"/><text x="${cx}" y="${cy + 1}" text-anchor="middle" font-size="22">${br.icon}</text>
    <text x="${cx}" y="${cy + 18}" text-anchor="middle" class="tlabel">${done} / ${N}</text></g>`;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:440px;display:block;margin:0 auto">${spokes}${track}${core}${body}</svg>`;
}
function nodeSheet(id) {
  const n = C.content.nodes.find(x => x.id === id), T = C.content, st = nodeDone(id) ? "done" : nodeOpen(n) ? "open" : "locked";
  const need = n.req.filter(r => !nodeDone(r)).map(r => C.content.nodes.find(x => x.id === r).title);
  const dependents = C.content.nodes.filter(x => x.req.includes(id) && nodeDone(x.id));
  sheet(`<div class="row" style="gap:12px;align-items:center"><div class="nodeicon">${n.icon}</div><div class="grow">
      <div class="tiny muted" style="letter-spacing:1px;text-transform:uppercase">Skill ${n.n} · about ${n.mins} min</div>
      <h2 style="margin:2px 0 0">${esc(n.title)}</h2></div></div>
    ${st === "locked" ? `<div class="note" style="margin-top:10px">🔒 Unlocks after: <b>${need.map(esc).join(", ")}</b></div>` : ""}
    <div style="font-weight:800;margin:14px 0 4px">What you'll learn</div><ul class="small" style="margin:0;padding-left:18px">${n.learn.map(l => `<li>${esc(l)}</li>`).join("")}</ul>
    <div style="font-weight:800;margin:12px 0 6px">Key ideas</div><div class="chips">${n.concepts.map(c => `<span class="chipx">${esc(c)}</span>`).join("")}</div>
    ${nodeParts(n) ? `<div style="font-weight:800;margin:14px 0 6px">Parts <span class="tiny muted">${partsDoneCount(n)} of ${nodeParts(n).length} done · do them in any order</span></div>
      <div class="partlist">${nodeParts(n).map((p, k) => `<button class="partrow ${partDone(n, k) ? "ok" : ""}" data-p="${k}" ${st === "locked" ? "disabled" : ""}>
        <span class="pn">${partDone(n, k) ? "✓" : k + 1}</span><span class="grow"><b>${esc(p.t[0])}</b>${p.t.length > 1 ? `<span class="tiny muted"> · ${esc(p.t.slice(1).join(" · "))}</span>` : ""}</span>
        <span class="tiny muted">${p.b - p.a + 1} cards</span></button>`).join("")}</div>` : ""}
    <div style="font-weight:800;margin:12px 0 6px">Exercises <span class="tiny muted">(coming soon)</span></div><div class="chips">${n.exercises.map(c => `<span class="chipx dim">${esc(c)}</span>`).join("")}</div>
    ${st !== "locked" ? `<button class="btn" id="read" style="margin-top:14px">${readLabel(n, st)}</button><div class="tiny muted" id="dlst" style="text-align:center;margin-top:4px"></div>` : ""}
    ${st === "done" ? `<div class="note" style="margin-top:8px">✅ Learned on ${fmtDate(S.tree[id])}</div>${dependents.length ? "" : `<button class="link" id="undo">Undo</button>`}` : ""}
    <button class="btn ghost" id="close">Close</button>`, el => {
    el.querySelector("#close").onclick = closeSheet;
    const brN = C.content.branches.find(b => b.id === n.branch), dl = el.querySelector("#dlst");
    if (dl && brN.reading) loadIndex(brN).then(async idx => {
      const info = idx.chapters[String(n.chapter)]; if (!info) return;
      dl.textContent = (await isDownloaded(brN, n.chapter)) ? `✓ Saved on this phone · ${info.cards} cards` : `${info.cards} cards · ${kb(info.bytes)} · downloads when you start`;
    }).catch(() => {});
    const R0 = el.querySelector("#read");
    if (R0) R0.onclick = () => { closeSheet(); openReader(C.content.branches.find(b => b.id === n.branch), n); };
    if (st !== "locked") el.querySelectorAll(".partrow").forEach(b => (b.onclick = () => { closeSheet(); openReader(brN, n, +b.dataset.p); }));
    const U = el.querySelector("#undo");
    if (U) U.onclick = () => { delete S.tree[id]; if (S.parts) delete S.parts[id]; save(); closeSheet(); treeView(); };
  });
}

// ---- in-app reader: each skill's chapter as bite-sized cards (built by tools/build_se_content.py)
// Reading is NOT bundled with the app: each chapter is a small file fetched from the Mac the first time a skill
// is opened. Over HTTPS the service worker keeps a copy (cache "a1-content-v1") so it works offline;
// learners can download a whole branch or remove downloads to free space.
const CONTENT_CACHE = "a1-content-v1";
const readingCache = {};
const chapterUrl = (br, ch) => `${br.reading}${String(ch).padStart(2, "0")}.json`;
const canDownload = () => "caches" in window && !!navigator.serviceWorker && !!navigator.serviceWorker.controller;
async function loadChapter(br, ch) {
  const u = chapterUrl(br, ch);
  if (!readingCache[u]) { const r = await fetch(u); if (!r.ok) throw new Error(r.status); readingCache[u] = await r.json(); }
  return readingCache[u];
}
async function loadIndex(br) {
  const u = br.reading + "index.json";
  if (!readingCache[u]) readingCache[u] = await (await fetch(u)).json();
  return readingCache[u];
}
async function isDownloaded(br, ch) {
  if (!canDownload()) return false;
  try { return !!(await (await caches.open(CONTENT_CACHE)).match(new URL(chapterUrl(br, ch), location.href).href, { ignoreSearch: true })); } catch { return false; }
}
const kb = b => b < 1024 ? `${b} B` : `${Math.round(b / 1024)} KB`;
async function fillDownloads(br) {
  const el = view().querySelector("#dlbar"); if (!el || !br.reading) return;
  let idx; try { idx = await loadIndex(br); } catch { el.textContent = ""; return; }
  const chs = Object.keys(idx.chapters), total = chs.reduce((a, c) => a + idx.chapters[c].bytes, 0);
  if (!canDownload()) { el.innerHTML = `📖 Reading loads from the server when you open a skill (${kb(total)} in total). Offline downloads need HTTPS.`; return; }
  const have = [];
  for (const c of chs) if (await isDownloaded(br, c)) have.push(c);
  const size = have.reduce((a, c) => a + idx.chapters[c].bytes, 0);
  el.innerHTML = `📥 Saved on this phone: <b>${have.length}/${chs.length}</b> reading files (${kb(size)} of ${kb(total)})
    ${have.length < chs.length ? `<button class="link" id="dlall">Download all</button>` : ""}${have.length ? `<button class="link" id="dlrm">Remove</button>` : ""}`;
  const a = el.querySelector("#dlall"), r = el.querySelector("#dlrm");
  if (a) a.onclick = async () => { a.textContent = "Downloading…"; for (const c of chs) { try { await fetch(chapterUrl(br, c)); } catch { /* offline */ } } fillDownloads(br); toast("Saved for offline reading"); };
  if (r) r.onclick = async () => { const cache = await caches.open(CONTENT_CACHE); for (const c of chs) await cache.delete(new URL(chapterUrl(br, c), location.href).href, { ignoreSearch: true }); Object.keys(readingCache).forEach(k => k.startsWith(br.reading) && delete readingCache[k]); fillDownloads(br); toast("Downloads removed"); };
}
function readLabel(n, st) {
  const pos = (S.read || {})[n.id], P = nodeParts(n);
  if (st === "done") return "📖 Read again";
  if (P) {
    const k = nextPart(n), p = P[k], inside = pos != null && pos > p.a && pos <= p.b;
    return inside ? `📖 Continue part ${k + 1} (card ${pos - p.a + 1} of ${p.b - p.a + 1})` : `📖 Start part ${k + 1} of ${P.length}`;
  }
  return pos ? `📖 Continue reading (card ${pos + 1})` : "📖 Start reading";
}
async function openReader(br, node, partIdx) {
  let ch = null;
  if (br.reading) { try { ch = await loadChapter(br, node ? node.chapter : br.intro); } catch { ch = null; } }
  if (!ch) { toast(navigator.onLine ? "Reading material for this skill isn't available yet." : "No connection, so this skill can't download right now. Try again when you're online."); return; }
  S.read = S.read || {}; S.parts = S.parts || {};
  const key = node ? node.id : br.id + ".intro";
  if (node) S.lastRead = { id: node.id, at: Date.now() };
  // which part: the chapter file's own split wins (it was built with these exact cards)
  const parts = node ? ((ch.parts && ch.parts.length ? ch.parts : nodeParts(node)) || null) : null;
  const k = parts ? (partIdx != null ? partIdx : (nodeDone(node.id) ? 0 : nextPart({ ...node, parts }))) : null;
  const A = parts ? parts[k].a : 0, B = parts ? Math.min(parts[k].b, ch.cards.length - 1) : ch.cards.length - 1;
  let i = S.read[key] || 0;
  if (i < A || i > B) i = A;
  if (node && (nodeDone(node.id) || (parts && partDone(node, k))) && i >= B) i = A;   // re-reading something finished starts over
  document.body.classList.add("in-lesson");
  const T = C.content;
  const draw = () => {
    const c = ch.cards[i], last = i === B, pct = Math.round(100 * (i - A + 1) / (B - A + 1));
    const counting = node && !nodeDone(node.id) && nodeOpen(node);
    const othersDone = parts ? parts.every((_, j) => j === k || partDone(node, j)) : true;
    const finishLabel = !counting ? "Done" : !parts || othersDone ? `Finish · +${T.xpPerSkill} XP` : partDone(node, k) ? "Done" : `Finish part ${k + 1} of ${parts.length}`;
    view().innerHTML = `<div class="lesson-top"><button class="x" id="rx" aria-label="Close">✕</button><div class="bar"><div style="width:${pct}%"></div></div><span class="tiny muted" style="min-width:52px;text-align:right">${i - A + 1} / ${B - A + 1}</span></div>
      <div class="reader" id="rd">
        <div class="r-eyebrow">${node ? `${node.icon} ${esc(node.title)}${parts ? ` · Part ${k + 1} of ${parts.length}` : ""}` : `${br.icon} ${esc(br.title)}`}</div>
        <div class="q-title r-sec">${esc(c.s)}</div>${c.sub ? `<div class="r-sub">${esc(c.sub)}</div>` : ""}
        <div class="rcard">${c.html}</div></div>
      <div class="lesson-foot"><div class="row" style="gap:10px"><button class="btn ghost grow" id="rb" ${i === A ? "disabled" : ""} style="margin:0">‹ Back</button>
        <button class="btn grow" id="rn" style="margin:0">${last ? finishLabel : "Next ›"}</button></div></div>`;
    window.scrollTo(0, 0);
    view().querySelector("#rx").onclick = () => { treeView(); };
    view().querySelector("#rb").onclick = () => { if (i > A) { i--; S.read[key] = i; save(); draw(); } };
    view().querySelector("#rn").onclick = () => {
      if (!last) { i++; S.read[key] = i; save(); draw(); return; }
      if (parts && counting) {
        (S.parts[node.id] = S.parts[node.id] || {})[k] = S.parts[node.id][k] || today();
        const nk = parts.findIndex((_, j) => !partDone(node, j));
        S.read[key] = nk < 0 ? 0 : parts[nk].a;                     // the next undone part starts where it begins
        if (nk >= 0) { save(); toast(`✓ Part ${k + 1} of ${parts.length} done · ${parts.length - partsDoneCount({ ...node, parts })} to go`); treeView(); nodeSheet(node.id); return; }
      } else S.read[key] = 0;
      if (counting) {
        S.tree[node.id] = today(); addXP(T.xpPerSkill);
        const left = treeNodes(node.branch).filter(x => !nodeDone(x.id)).length;
        toast(left ? `${node.icon} ${node.title} learned! +${T.xpPerSkill} XP` : `👑 Branch complete! You mastered ${br.title}`);
      } else save();
      treeView();
    };
    // swipe left/right to move between cards
    const rd = view().querySelector("#rd"); let x0 = null, y0 = null;
    rd.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    rd.addEventListener("touchend", e => {
      if (x0 == null || e.target.closest("pre, .tablewrap")) return;            // let code and tables scroll sideways
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > 1.5 * Math.abs(dy)) view().querySelector(dx < 0 ? "#rn" : "#rb").click();
    });
  };
  draw();
}

// ------------------------------------------------------------------ hero choice (Hunter / Huntress), per learner
const heroKey = () => `a1.hero.${USER}`;
// returns false when this learner hasn't picked a hero yet
function syncHero() {
  let h = S.settings.hero;
  if (!h) { try { h = localStorage.getItem(heroKey()); } catch { /* ignore */ } if (h) { S.settings.hero = h; save(); } } // carry the choice into other courses
  setHeroStyle(h || "m");
  return !!h;
}
function setHero(h) {
  S.settings.hero = h; save();
  try { localStorage.setItem(heroKey(), h); } catch { /* ignore */ }
  setHeroStyle(h);
}
function heroPickView(back = false) {
  document.body.classList.add("in-lesson");
  const lv = S && S.setup ? level(progress().total).lv : 1, cur = S.settings.hero;
  view().innerHTML = `<div style="text-align:center;padding:4vh 0 10px"><div class="sysbanner">Choose your hero</div>
    <h1>Hallo ${esc(userInfo(USER).name)}!</h1><p class="muted">Pick the hero who levels up with you. You can change it any time in Settings.</p></div>
    <div class="heropick">${Object.entries(HERO_STYLES).map(([k, name]) => `<button class="hp ${cur === k ? "cur" : ""}" data-h="${k}">${heroHTML(lv, "big", k)}
      <b>${name}</b><span class="muted small">${k === "f" ? "Heldin" : "Held"}</span></button>`).join("")}</div>
    ${back ? `<button class="btn ghost" id="hb" style="margin-top:14px">Back</button>` : ""}`;
  view().querySelectorAll(".hp").forEach(b => (b.onclick = () => { setHero(b.dataset.h); toast(`${HERO_STYLES[b.dataset.h]} selected`); route(); }));
  const hb = view().querySelector("#hb"); if (hb) hb.onclick = () => route();
}

// ------------------------------------------------------------------ Hunter System theme
function applyTheme() {
  const t = S ? S.settings.theme : (localStorage.getItem("a1.theme") || "system");
  try { localStorage.setItem("a1.theme", t); } catch { /* ignore */ }
  document.body.classList.toggle("theme-sl", t === "system" || t === "system2" || t === "system3");
  document.body.classList.toggle("theme-sl2", t === "system2");
  document.body.classList.toggle("theme-sl3", t === "system3");
  document.body.classList.toggle("theme-calm", t === "calm" || t === "ez"); // Eurozeit builds on Calm
  document.body.classList.toggle("theme-ez", t === "ez");
  applyAura(S && S.setup && courseInfo(COURSE).type !== "tree" ? level(progress().total).lv : 1);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = t === "system" || t === "system2" || t === "system3" ? "#0a0f1a" : t === "calm" ? "#f6f3ee" : t === "ez" ? "#ffffff" : "#58a700";
}
const THEMES = [["system", "⚔️ Hunter System"], ["system3", "🛡️ Hunter Mid"], ["system2", "🗡️ Hunter Simple"], ["calm", "🌿 Calm"], ["ez", "🎓 Eurozeit"], ["classic", "🟢 Classic"]];
const themeOptions = cur => THEMES.map(([v, l]) => `<option value="${v}" ${cur === v ? "selected" : ""}>${l}</option>`).join("");
const deviceTheme = () => { try { return localStorage.getItem("a1.theme") || "system"; } catch { return "system"; } };
// theme for screens without a learner (login / player picker); a learner's own theme applies after login
function themeSheet() {
  const mine = !!(S && USER); // logged in (course picker): change the learner's own theme
  sheet(`<h2 style="margin-top:0">⚙️ Settings</h2><label class="f">Theme</label><select id="dth">${themeOptions(mine ? S.settings.theme : deviceTheme())}</select>
    <p class="muted small" style="margin:6px 0 12px">${mine ? "Your theme. You can also change it later in Settings." : "Used on this screen. After you log in, your own theme from Settings applies."}</p>
    <button class="btn" id="ok">Done</button>`, el => {
    el.querySelector("#dth").onchange = e => {
      if (mine) { S.settings.theme = e.target.value; save(); } else try { localStorage.setItem("a1.theme", e.target.value); } catch { /* ignore */ }
      applyTheme();
    };
    el.querySelector("#ok").onclick = closeSheet;
  });
}
const gearBtn = () => `<button class="gear" id="gear" aria-label="Settings">⚙️</button>`;
const RANK_TITLE = { E: "E-Rank Hunter", D: "D-Rank Hunter", C: "C-Rank Hunter", B: "B-Rank Hunter", A: "A-Rank Hunter", S: "S-Rank Hunter" };
function playerBar() {
  const L = level(progress().total), rk = rank(progress().total);
  return `<div class="player sl-only">${heroHTML(L.lv, "sm")}<div class="rank ${rk.r}">${rk.r}</div>
    <div class="grow"><div class="lv">Level <b>${L.lv}</b> · ${RANK_TITLE[rk.r]}</div>
    <div class="hbar" style="margin-top:4px"><div style="width:${100 * L.frac}%"></div></div>
    <div class="tiny muted" style="margin-top:2px">${L.a1 ? `A1 reached 🎓 · ${L.xpInto}/${L.xpNeed} XP to level ${L.lv + 1}` : `${L.toNext.toFixed(1)}% of A1 to level ${L.lv + 1}`}</div></div>
    <div class="stat" style="font-size:18px">🔥 ${streak()}</div></div>`;
}
function questStatus(due) {
  const t = today(), g = goalFor(), x = xpToday();
  const newToday = partsToday(), pg = partsGoal(); // new lesson parts today vs what the target date needs
  const revDone = S.reviews[t] || 0, revGoal = Math.min(20, due.length + revDone);
  const q = [
    { ok: x >= g, txt: `Earn ${g} XP`, v: `${x}/${g}` },
    { ok: newToday >= pg, txt: `Clear ${pg} lesson part${pg > 1 ? "s" : ""}`, v: `${Math.min(newToday, pg)}/${pg}` },
    { ok: revGoal === 0 || revDone >= revGoal, txt: revGoal ? `Review all ${revGoal} words to remember` : "Review words (none due)", v: revGoal ? `${Math.min(revDone, revGoal)}/${revGoal}` : "✓" },
  ];
  return { q, all: q.every(i => i.ok), x };
}
function dailyQuest(due) {
  const { q, all, x } = questStatus(due), paid = S.questDays && S.questDays[today()];
  return `<div class="card sl-only"><div class="sys-h"><span class="ex">!</span> Daily quest</div>
    <div class="small muted" style="text-align:center;margin:-4px 0 8px;letter-spacing:1px">TRAINING FOR ${esc((C.course && C.course.title) || "YOUR COURSE").toUpperCase()} HAS ARRIVED</div>
    ${q.map(i => `<div class="quest ${i.ok ? "ok" : ""}"><span class="box">${i.ok ? "✓" : ""}</span>${esc(i.txt)}<span class="v">${i.v}</span></div>`).join("")}
    <div class="small" style="text-align:center;margin-top:8px;letter-spacing:1px;color:${all ? "#57e3a0" : "var(--muted)"}">
      ${all ? `QUEST COMPLETE · 💎 +${QUEST_GEMS} ${paid ? "COLLECTED" : ""}` : `REWARD: 💎 ${QUEST_GEMS}`}</div>
    ${!all && x === 0 && streak() > 0 ? `<div class="warn-line">⚠ Earn at least 1 XP before midnight to keep your 🔥 ${streak()} day streak.</div>` : ""}</div>`;
}
function statusWindow(pr, pc, r) {
  const L = level(pr.total), rk = rank(pr.total);
  const scores = Object.values(S.done).map(d => d.score).filter(v => v != null);
  const acc = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const nG = chaptersDone(), nP = C.content.phrases.filter(p => S.done[p.id]).length;
  return `<div class="card sl-only"><div class="sys-h">Status</div>
    ${heroHTML(L.lv, "big")}<div class="hero-cap">Form: <b>${form(stageFor(L.lv)).name}</b> (${esc(form(stageFor(L.lv)).de)}) · Aura: <b>${auraName(L.lv)}</b> · ${Math.round(aura(L.lv) * 100)}%${L.lv < AURA_FULL_LEVEL ? ` · full at level ${AURA_FULL_LEVEL}` : ""}</div><div style="height:12px"></div>
    <div class="row" style="margin-bottom:10px"><div class="rank ${rk.r}" style="width:58px;height:58px;font-size:32px">${rk.r}</div>
      <div class="grow" style="min-width:0"><div style="font-size:22px;font-weight:700;letter-spacing:1px;overflow-wrap:anywhere">${esc(userInfo(USER).name.toUpperCase())}</div>
      <div class="muted small">Title: ${RANK_TITLE[rk.r]}${rk.next ? ` · ${rk.next}-Rank at ${rk.nextAt}% of A1` : " · highest rank"}</div></div>
      <div style="text-align:right"><div class="lv">Level</div><div style="font-size:34px;font-weight:800;line-height:1;text-shadow:0 0 12px var(--accent)">${L.lv}${L.a1 ? `<div class="tiny" style="color:#57e3a0;letter-spacing:1px;margin-top:2px">A1 ✓</div>` : `<span class="muted" style="font-size:14px">/${A1_LEVEL}</span>`}</div></div></div>
    <div class="hbar"><div style="width:${100 * L.frac}%"></div></div><div class="tiny muted" style="margin:3px 0 10px">${L.a1 ? `A1 reached 🎓 · ${L.xpInto}/${L.xpNeed} XP to level ${L.lv + 1}` : `${L.toNext.toFixed(1)}% of A1 to level ${L.lv + 1} · A1 at level ${A1_LEVEL}`}</div>
    <div class="statgrid">
      <div><span>📖 Words</span><b>${r.learned}</b></div><div><span>🏆 Mastered</span><b>${r.mastered}</b></div>
      <div><span>📐 Grammar</span><b>${nG}/${C.content.grammar.length}</b></div><div><span>💬 Phrases</span><b>${nP}/${C.content.phrases.length}</b></div>
      <div><span>🔥 Streak</span><b>${streak()}</b></div><div><span>🎯 Accuracy</span><b>${acc}%</b></div>
      <div><span>⚡ Total XP</span><b>${totalXP()}</b></div><div><span>📈 A1</span><b>${pr.total.toFixed(1)}%</b></div>
    </div></div>`;
}

function memWarn() {
  const m = memory(), pr = progress();
  const loss = level(pr.coverage).lv - level(pr.total).lv;
  if (!m.overdue && !m.lapsed) return "";
  return `<div class="warn-line">⚠ ${m.overdue ? `${m.overdue} overdue` : ""}${m.overdue && m.lapsed ? " · " : ""}${m.lapsed ? `${m.lapsed} forgotten` : ""} – ${loss > 0 ? `costing you ${loss} level${loss > 1 ? "s" : ""}` : "they start fading from your level"}. Review to win it back.</div>`;
}
function levelWatch() {
  // levels were re-scaled (level 100 = A1): adopt the current level once, without a false "level down"
  if (S.lvScale !== 100) { S.lvScale = 100; S.lastLv = level(progress().total).lv; save(); }
  const lv = level(progress().total).lv, prev = S.lastLv || lv;
  if (lv < prev) {
    const m = memory();
    sheet(`<div class="sysbanner" style="border-color:#ff7f97;box-shadow:0 0 16px rgba(255,77,109,.6)">⚠ System</div>
      <h2 style="margin-top:0;color:#ff8ea3">Level down: ${prev} → ${lv}</h2>
      <p>${m.overdue} word${m.overdue === 1 ? " is" : "s are"} overdue${m.lapsed ? ` and ${m.lapsed} forgotten` : ""}. Words you don't review fade from your A1 %, so your level dropped.</p>
      <p class="muted small">Do your reviews to recover the levels.</p><button class="btn" id="ok">Start review</button><button class="btn ghost" id="later">Later</button>`, el => {
      el.querySelector("#ok").onclick = () => { closeSheet(); const d = dueWords(); if (d.length) startReview(d.slice(0, 20)); };
      el.querySelector("#later").onclick = closeSheet;
    });
  }
  if (lv !== S.lastLv) { S.lastLv = lv; save(); }
}

// ------------------------------------------------------------------ diamonds & gift boxes
const unopened = () => (S.gifts || []).filter(g => !g.opened);
function gemChip() {
  const n = unopened().length;
  return `<button class="gemchip" id="gem" aria-label="Total XP and diamonds">⚡ <b>${totalXP()}</b><span class="sep"></span>💎 <b>${S.gems || 0}</b>${n ? `<span class="giftbadge">🎁${n > 1 ? n : ""}</span>` : ""}</button>`;
}
const boxHTML = (tier, cls = "") => `<div class="giftbox ${cls}" style="--c:${TIERS[tier].color}"><div class="lid"></div><div class="body"></div></div>`;
function giftEarnedSheet(gifts) {
  const g = gifts[gifts.length - 1];
  sheet(`<div style="text-align:center"><div class="sysbanner">🎁 Reward</div>
    <h2 style="margin-top:0">${g.m}-day streak!</h2>${boxHTML(g.tier, "shake")}
    <p>You earned ${gifts.length > 1 ? `${gifts.length} gift boxes` : `a <b style="color:${TIERS[g.tier].color}">${TIERS[g.tier].name}</b> gift box`}.</p>
    <button class="btn" id="open">Open now</button><button class="btn ghost" id="later">Later</button></div>`, el => {
    el.querySelector("#open").onclick = () => openGiftSheet(g.id);
    el.querySelector("#later").onclick = closeSheet;
  });
}
function openGiftSheet(id) {
  const g = S.gifts.find(x => x.id === id); if (!g) return;
  const T = TIERS[g.tier];
  sheet(`<div style="text-align:center"><div class="small muted" style="letter-spacing:2px;text-transform:uppercase">${T.name} gift box · ${g.m}-day streak</div>
    <div id="gb" style="cursor:pointer">${boxHTML(g.tier, "shake big")}</div>
    <p class="muted" id="hint">Tap the box to open it</p><div id="res"></div></div>`, el => {
    const gb = el.querySelector("#gb");
    gb.onclick = () => {
      if (gb.dataset.done) return; gb.dataset.done = 1;
      const amt = openGift(g.id);
      gb.querySelector(".giftbox").classList.remove("shake"); gb.querySelector(".giftbox").classList.add("opened");
      el.querySelector("#hint").textContent = "";
      setTimeout(() => {
        el.querySelector("#res").innerHTML = `<div class="gemburst">💎 +<span id="cnt">0</span></div>
          <p class="muted small">New balance: ${S.gems} 💎</p><button class="btn" id="ok">Collect</button>`;
        let c = 0; const step = Math.max(1, Math.ceil(amt / 25));
        const iv = setInterval(() => { c = Math.min(amt, c + step); const e = document.getElementById("cnt"); if (e) e.textContent = c; if (c >= amt) clearInterval(iv); }, 30);
        el.querySelector("#ok").onclick = () => { closeSheet(); route(); };
      }, 550);
    };
  });
}
function treasureSheet() {
  const box = unopened(), nm = nextMilestone(), st = streak();
  const prevM = [0, ...[7, 14, 21, 30, 45, 60, 75, 90, 120, 150, 180, 365].filter(m => m <= st)].pop();
  const recent = (S.gemLog || []).slice(-5).reverse();
  const g = goalFor(), xt = xpToday(), wk = [0, 1, 2, 3, 4, 5, 6].reduce((a, i) => a + (S.xp[addDays(today(), -i)] || 0), 0);
  sheet(`<div class="sys-h">XP &amp; Diamonds</div>
    <div class="stat-grid" style="grid-template-columns:1fr 1fr;margin:6px 0 14px">
      <div class="tile" style="text-align:center"><span>Total XP</span><b style="font-size:30px">⚡ ${totalXP()}</b></div>
      <div class="tile" style="text-align:center"><span>Diamonds</span><b style="font-size:30px">💎 ${S.gems || 0}</b></div></div>
    <div style="font-weight:800;margin-bottom:4px">⚡ XP</div>
    <div class="small muted">Today: <b style="color:var(--ink)">${xt} / ${g} XP</b> daily goal</div>
    <div class="hbar" style="margin:4px 0"><div style="width:${Math.min(100, 100 * xt / g)}%;background:var(--blue, #4fb3ff)"></div></div>
    <div class="small muted">Last 7 days: <b style="color:var(--ink)">${wk} XP</b> · 🔥 ${st}-day streak</div>
    <div class="small muted" style="margin:4px 0 8px">1 XP ≈ one new word learned. Finishing parts and lessons adds a bonus; reviews add a little.</div>
    <button class="btn ghost sm" id="xpmore" style="margin-top:4px">How XP works ›</button>
    <div style="font-weight:800;margin:16px 0 4px">💎 Diamonds</div>
    ${box.length ? `<div style="font-weight:800;margin-bottom:6px">🎁 Unopened gift boxes</div>
      <div class="giftgrid">${box.map(g => `<button class="giftcell" data-id="${g.id}">${boxHTML(g.tier, "shake")}<div class="tiny">${TIERS[g.tier].name}<br>${g.m}-day</div></button>`).join("")}</div>` : ""}
    ${nm ? `<div style="font-weight:800;margin:14px 0 4px">Next gift box: ${nm}-day streak <span class="muted small">(${TIERS[tierFor(nm)].name})</span></div>
      <div class="hbar"><div style="width:${100 * (st - prevM) / (nm - prevM)}%;background:var(--amber)"></div></div>
      <div class="muted small" style="margin-top:4px">🔥 ${st} / ${nm} days</div>` : `<p class="muted">You've collected every streak box. Legendary!</p>`}
    <div class="small muted" style="margin-top:10px">Daily quest cleared: +${QUEST_GEMS} 💎 each day.</div>
    ${recent.length ? `<div style="font-weight:800;margin:14px 0 4px">Recent</div>${recent.map(r => `<div class="small muted">${fmtDate(r.d)} · <b style="color:var(--ink)">+${r.n} 💎</b> · ${esc(r.why)}</div>`).join("")}` : ""}
    <button class="btn" id="ok" style="margin-top:16px">Close</button>`, el => {
    el.querySelectorAll(".giftcell").forEach(b => (b.onclick = () => openGiftSheet(b.dataset.id)));
    el.querySelector("#xpmore").onclick = () => sheet(XP_HELP + `<button class="btn" id="ok">Got it</button>`, e2 => (e2.querySelector("#ok").onclick = closeSheet));
    el.querySelector("#ok").onclick = closeSheet;
  });
}

// ------------------------------------------------------------------ XP explainer
const XP_HELP = `<h2 style="margin-top:0">⚡ How XP works</h2>
  <p><b>Learning something new earns the most.</b> 1 XP per new word or phrase, plus bonuses for finishing parts and lessons. Reviews earn a little; forgetting costs XP.</p>
  <table class="cmp"><tr><td>🔤 New word / 💬 new phrase</td><td><b>+1</b> each (first time, when the part is passed)</td></tr>
  <tr><td>✅ Part finished</td><td><b>+2</b> · <b>+1</b> more if every first answer was right</td></tr>
  <tr><td>🏁 Whole lesson / phrase topic done</td><td><b>+5</b> bonus</td></tr>
  <tr><td>📐 Grammar part</td><td><b>+3</b> (+1 if perfect) · <b>+5</b> when the chapter is done</td></tr>
  <tr><td>🔁 Review</td><td><b>+1 per 5 words</b> recalled · 0 for Hard · <b style="color:var(--red)">−1 per 2 forgotten</b> · +1 at ≥80 % recalled</td></tr>
  <tr><td>⛔ Missed review day</td><td><b style="color:var(--red)">−3 XP</b> (−1 more per 10 overdue words, max −10)</td></tr>
  <tr><td>🎤 Phrase spoken correctly</td><td><b>+1</b></td></tr></table>
  <p class="small">Repeating a part you already finished gives +1. A failed part (under 60 % right) gives +1 for the effort. A quit lesson gives nothing.</p>
  <p class="small"><b>Daily goal</b> = the XP you aim for each day (one new lesson ≈ 20 XP).
  <b>Streak</b> = days in a row with at least 1 XP. XP is added per day to your progress on the server, which also feeds the Party comparison.</p>
  <p class="small"><b>💎 Diamonds</b>: +${QUEST_GEMS} for clearing all three daily quests. Streak milestones (7, 14, 21, 30, 45, 60, 75, 90, 120, 150, 180, 365 days) give a gift box – tap it to open: Common 15–30 💎, Rare 40–80, Epic 100–180, Legendary 250–400.</p>
  <p class="small muted">XP measures effort. Your A1 % measures how much of the course you've covered.</p>
  <p class="small"><b>Level</b> follows your A1 %, not XP: level 1 at the start, <b>level 100 = A1 reached</b>: every lesson done and remembered (about one level per lesson). After that you keep levelling: every ${POST_A1_XP} XP from reviews and practice adds another level (101, 102 …). Your hunter rank (E → S) and the purple aura grow with it.</p>
  <p class="small"><b>Levels can drop.</b> Each learned word only counts fully while you keep it alive: once a review is overdue it counts 1/14 less every day (down to 25 %), and a word you mark "Again" counts half until you recall it. Catch up on reviews to win the levels back.</p>
  <p class="small"><b>Reviews</b> use active recall with SM-2 spacing (like Anki): recall the answer first, then rate yourself. Good pushes the next review further out (≈1 → 3 → 8 → 20 → 50 days); Again brings the word back in the same session and restarts it.</p>`;

// ------------------------------------------------------------------ lessons list
let lf = "all";
function lessonsView() {
  const P = C.content.path, done = P.filter(i => S.done[i.id]);
  const by = k => P.filter(i => i.kind === k), dk = k => by(k).filter(i => S.done[i.id]).length;
  const xpBy = {};
  (S.log || []).forEach(l => (xpBy[l.id] = (xpBy[l.id] || 0) + (l.xp || 0)));
  const list = P.filter(i => lf === "all" || (lf === "done" ? S.done[i.id] : lf === "todo" ? !S.done[i.id] : i.kind === lf));
  const plan = weekPlan(), inList = new Set(list.map(i => i.id));
  view().innerHTML = `<h1>All lessons</h1>
  <div class="card"><div class="row"><div class="grow"><div style="font-size:28px;font-weight:900">${done.length}<span class="muted" style="font-size:18px"> / ${P.length}</span></div>
    <div class="muted small">lessons done</div></div><div class="ring" style="--p:${100 * done.length / P.length}"><div>${Math.round(100 * done.length / P.length)}%</div></div></div>
    <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);margin-top:10px">
      <div class="tile"><span>🔤 Vocab</span><b>${dk("vocab")}<span class="tiny muted">/${by("vocab").length}</span></b></div>
      <div class="tile"><span>📐 Grammar</span><b>${dk("grammar")}<span class="tiny muted">/${by("grammar").length}</span></b></div>
      <div class="tile"><span>💬 Phrases</span><b>${dk("phrases")}<span class="tiny muted">/${by("phrases").length}</span></b></div></div>
    <button class="link" id="xph">⚡ How is XP measured?</button></div>
  <div class="seg" id="lseg">${[["all", "All"], ["todo", "To do"], ["done", "Done"], ["vocab", "🔤 Vocab"], ["grammar", "📐 Grammar"], ["phrases", "💬 Phrases"]]
    .map(([k, l]) => `<button data-f="${k}" class="${lf === k ? "on" : ""}">${l}</button>`).join("")}</div>
  ${plan.weeks.map(W => [W, W.items.filter(i => inList.has(i.id))]).filter(([, items]) => items.length).map(([W, items]) => `<div class="week-h" style="margin:14px 0 6px">${weekHead(W, W.items)}</div>
    <div class="wl ll">${items.map(i => { const d = S.done[i.id]; return `<div class="wrow" data-id="${i.id}">
      ${kicon(i.kind, !!d)}
      <div class="t"><div>${esc(i.kind === "vocab" ? `${i.n}. ${i.title}` : i.title)}</div>
      <div>${KIND[i.kind]}${i.kind === "vocab" ? ` · ${i.words.length} words` : ""}${bitCount(i) > 1 ? ` · ${bitsDone(i)}/${bitCount(i)} parts` : ""}${d ? ` · done ${fmtDate(d.date)}${d.score != null ? ` · ${d.score}%` : d.marked ? " · marked" : ""}${xpBy[i.id] ? ` · ${xpBy[i.id]} XP` : ""}` : ""}</div></div>
      <span class="muted">›</span></div>`; }).join("")}</div>`).join("") || `<p class="muted">Nothing here.</p>`}`;
  view().querySelector("#xph").onclick = () => sheet(XP_HELP + `<button class="btn" id="ok">Got it</button>`, el => (el.querySelector("#ok").onclick = closeSheet));
  view().querySelectorAll("#lseg button").forEach(b => (b.onclick = () => { lf = b.dataset.f; lessonsView(); }));
  view().querySelectorAll(".wrow[data-id]").forEach(r => (r.onclick = () => itemSheet(C.item[r.dataset.id], lessonsView)));
}

// ------------------------------------------------------------------ profiles
function avatar(id, sm) {
  const u = userInfo(id);
  return `<span class="av ${sm ? "sm" : ""}" style="background:${u.color}">${esc(u.name[0].toUpperCase())}</span>`;
}
function syncText() {
  if (SYNC.pending && !SYNC.online) return "⚠️ No connection – progress saved on this phone, it will sync when you're back online";
  if (SYNC.pending) return "Saving…";
  return SYNC.online ? "" : "⚠️ Offline";
}
function wireTop() {
  wireApk();
  const uc = view().querySelector("#uc");
  if (uc) uc.onclick = userSheet;
  const gm = view().querySelector("#gem");
  if (gm) gm.onclick = treasureSheet;
  const cc = view().querySelector("#cc");
  if (cc) cc.onclick = () => { unpick(); courseView(); };
  const xr = view().querySelector("#xpring");
  if (xr) xr.onclick = () => sheet(XP_HELP + `<button class="btn" id="ok">Got it</button>`, el => (el.querySelector("#ok").onclick = closeSheet));
}
let authTab = "login";
function loginView(msg = "") {
  document.body.classList.add("in-lesson");
  const up = authTab === "signup";
  view().innerHTML = `${gearBtn()}<div style="text-align:center;padding-top:5vh"><img src="icons/icon.svg" alt="" width="84" height="84" style="border-radius:20px"><div class="brand">LevelUp</div>
    <h1>${up ? "Create your account" : "Welcome back"}</h1></div>
    <div class="segt authtabs" role="tablist"><button data-t="login" class="${up ? "" : "on"}">Log in</button><button data-t="signup" class="${up ? "on" : ""}">Sign up</button></div>
    <form class="card authform" id="af" autocomplete="on">
      ${up ? `<label class="f" for="an">Your name</label><input id="an" name="name" autocomplete="name" maxlength="40" required>` : ""}
      <label class="f" for="au">Username</label><input id="au" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="32" required>
      <label class="f" for="ap">Password</label><input id="ap" name="password" type="password" autocomplete="${up ? "new-password" : "current-password"}" minlength="${up ? 6 : 1}" required>
      ${up ? `<p class="muted small" style="margin:6px 0 0">Username: 3–32 letters, digits, - or _. Password: at least 6 characters.</p>` : ""}
      <p class="small" id="aerr" style="color:var(--red);min-height:1.2em;margin:8px 0 0">${esc(msg)}</p>
      <button class="btn" id="ago" type="submit">${up ? "Create account" : "Log in"}</button>
      ${up ? "" : `<button class="link small" type="button" id="afp" style="display:block;margin:8px auto 0">Forgot password?</button>`}
      <p class="muted small" style="margin:10px 0 0;text-align:center">${up && isGuest() ? "Your guest progress moves into the new account." : "You stay logged in on this phone for 90 days, even after closing the app."}</p>
    </form>
    ${isGuest() ? `<button class="btn ghost" id="agb">‹ Back to the app (guest)</button>` : `<button class="btn ghost" id="agt">${hasGuestData() ? "Continue as guest" : "Try it first as a guest"}</button>
    <p class="muted small" style="text-align:center;margin:6px 0 0">No account needed. Progress stays on this phone; sign up later to keep it.</p>`}
    <button class="link" id="aint" style="display:block;margin:14px auto 0">What is LevelUp?</button>
    ${apkBtn("btn ghost", "margin-top:14px")}`;
  window.scrollTo(0, 0); // e.g. after logging out from the bottom of Settings
  view().querySelector("#gear").onclick = themeSheet;
  view().querySelectorAll(".authtabs button").forEach(b => (b.onclick = () => { authTab = b.dataset.t; loginView(); }));
  const q = id => view().querySelector(id);
  if (q("#afp")) q("#afp").onclick = () => forgotSheet(q("#au").value.trim());
  if (q("#agt")) q("#agt").onclick = enterGuest;
  if (q("#agb")) q("#agb").onclick = () => { document.body.classList.remove("in-lesson"); route(); };
  q("#aint").onclick = () => introView();
  wireApk();
  const f = view().querySelector("#af"), er = view().querySelector("#aerr"), go = view().querySelector("#ago");
  f.onsubmit = async e => {
    e.preventDefault();
    const u = f.querySelector("#au").value.trim(), pw = f.querySelector("#ap").value, nm = up ? f.querySelector("#an").value.trim() : "";
    if (up && !/^[A-Za-z0-9_-]{3,32}$/.test(u)) { er.textContent = "Username: 3–32 letters, digits, - or _"; return; }
    go.disabled = true; er.textContent = "";
    const wasGuest = isGuest();
    const r = up ? await signup(u, nm, pw) : await login(u, pw);
    go.disabled = false;
    if (!r.ok) { er.textContent = r.error; return; }
    if (wasGuest && up) claimGuest(r.user.id); // keep what they learned as a guest
    else if (wasGuest) leaveGuest();
    await loadUsers(); await switchUser(r.user.id); unpick(); document.body.classList.remove("in-lesson");
    toast(up ? `Willkommen, ${r.user.name}!` : `Hallo ${r.user.name}!`);
    if (location.hash !== "#/today") location.hash = "#/today"; else route();
  };
}
async function whoView() {
  if (!seenIntro()) return introView();
  if (AUTH === "on") return loginView();
  document.body.classList.add("in-lesson");
  view().innerHTML = `${gearBtn()}<div style="text-align:center;padding-top:6vh"><img src="icons/icon.svg" alt="" width="84" height="84" style="border-radius:20px"><div class="brand">LevelUp</div><h1>Who’s learning today?</h1><p class="muted">Select your player.</p></div>
    <div class="who">${USERS.map(u => `<button data-u="${u.id}">${avatar(u.id)}<div class="grow"><div style="font-size:20px;font-weight:800">${esc(u.name)}</div>
      <div class="muted small" data-s="${u.id}">&nbsp;</div></div><span style="font-size:24px;color:var(--muted)">›</span></button>`).join("")}</div>`;
  view().querySelector("#gear").onclick = themeSheet;
  view().querySelectorAll(".who button").forEach(b => (b.onclick = async () => {
    b.disabled = true; await switchUser(b.dataset.u); unpick(); document.body.classList.remove("in-lesson");
    if (location.hash !== "#/today") location.hash = "#/today"; else route();
  }));
  const all = await fetchAllStates();
  for (const u of USERS) {
    const sm = summary(all[u.id]), el = view().querySelector(`[data-s="${u.id}"]`);
    if (el && courseInfo(COURSE).type === "tree") { const n = Object.keys((all[u.id] || {}).tree || {}).length; el.textContent = `${courseInfo(COURSE).title} · ${n} skill${n === 1 ? "" : "s"} learned`; continue; }
    if (el) el.textContent = sm ? `Lv ${sm.lv} · ${sm.rank}-Rank · 🔥 ${sm.streak} · ${sm.pct.toFixed(0)}% of A1` : "New – tap to start";
  }
}
// ------------------------------------------------------------------ intro, guest mode, forgot password
const seenIntro = () => { try { return !!localStorage.getItem("a1.introSeen"); } catch { return true; } };
function introView() {
  try { localStorage.setItem("a1.introSeen", "1"); } catch { /* ignore */ }
  document.body.classList.add("in-lesson");
  const f = (icon, t, d) => `<div class="row" style="align-items:flex-start;gap:12px;margin:12px 0"><span style="font-size:26px;line-height:1">${icon}</span><div class="grow"><b>${t}</b><div class="muted small">${d}</div></div></div>`;
  view().innerHTML = `${gearBtn()}<div style="text-align:center;padding-top:4vh"><img src="icons/icon.svg" alt="" width="72" height="72" style="border-radius:18px"><div class="brand">LevelUp</div>
    <h1>Level up in languages and skills</h1><p class="muted">Short daily lessons that turn into real knowledge, one level at a time.</p></div>
    <div class="card">
      ${f("📚", "Courses", "German A1 today (821 words, 20 grammar chapters, everyday phrases) and a Software Engineering skill tree. More languages and subjects are coming.")}
      ${f("🧠", "Spaced repetition", "Every word comes back for review just before you would forget it. Words you know well return less often, hard ones more often.")}
      ${f("🎯", "Targets that fit you", "Pick a finish date and the app sets your daily goal. Choose Quest Mode (levels, ranks, streaks, diamonds, daily quests) or a plain mode with just the lessons.")}
      ${f("🔊", "Hear and speak", "Native-style audio for every word and phrase, and optional speaking practice.")}
      ${f("📈", "See your progress", "Level, rank and pace show if you're on track. Your progress is saved to your account and works on any device.")}
    </div>
    <button class="btn" id="ia">Create free account</button><button class="btn ghost" id="il" style="margin-top:8px">I have an account</button>
    <button class="link" id="ig" style="display:block;margin:12px auto 0">${hasGuestData() ? "Continue as guest" : "Just try it as a guest"}</button>
    ${apkBtn("btn ghost", "margin-top:14px")}`;
  window.scrollTo(0, 0);
  view().querySelector("#gear").onclick = themeSheet;
  view().querySelector("#ia").onclick = () => { authTab = "signup"; loginView(); };
  view().querySelector("#il").onclick = () => { authTab = "login"; loginView(); };
  view().querySelector("#ig").onclick = enterGuest;
  wireApk();
}
const GUEST_NOTE = `<div style="font-weight:800">👋 You're trying LevelUp as a guest</div>
  <p class="muted small">Your progress is saved only on this phone. Create a free account to keep it, back it up and use it on other devices: everything you've done so far moves into the account.</p>`;
async function enterGuest() {
  startGuest(); await switchUser(USER); unpick(); document.body.classList.remove("in-lesson");
  toast("Guest mode: progress stays on this phone");
  if (location.hash !== "#/today") location.hash = "#/today"; else route();
}
function guestSignup() { closeSheet(); authTab = "signup"; loginView(); }
function doLeaveGuest() {
  sheet(`<h2 style="margin-top:0">Leave guest mode?</h2><p class="muted">Your guest progress stays on this phone. Tap "Continue as guest" on the login screen to pick it up again.</p>
    <button class="btn" id="ly">Leave guest mode</button><button class="btn ghost" id="ln">Cancel</button>`, el => {
    el.querySelector("#ln").onclick = closeSheet;
    el.querySelector("#ly").onclick = () => { closeSheet(); leaveGuest(); unpick(); authTab = "login"; location.hash = "#/today"; route(); };
  });
}
// No e-mail is stored, so a reset is a request to the admin (saved with the feedback reports); the admin sets a new password.
function forgotSheet(user = "") {
  sheet(`<h2 style="margin-top:0">Forgot password?</h2><p class="muted small">Send a reset request. The admin will set a new password for you and tell you what it is.</p>
    <form id="ff"><label class="f" for="fu">Username</label><input id="fu" autocapitalize="none" spellcheck="false" maxlength="32" required value="${esc(user)}">
    <label class="f" for="fc">How can we reach you? (optional)</label><input id="fc" maxlength="120" placeholder="e.g. phone number or WhatsApp">
    <p class="small" id="ferr" style="color:var(--red);min-height:1.2em;margin:8px 0 0"></p><button class="btn" type="submit">Send request</button>
    <button class="btn ghost" type="button" id="fx">Cancel</button></form>`, el => {
    el.querySelector("#fx").onclick = closeSheet;
    el.querySelector("#ff").onsubmit = async e => {
      e.preventDefault();
      const u = el.querySelector("#fu").value.trim(), c = el.querySelector("#fc").value.trim();
      try {
        const r = await fetch("api/bugs", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category: "bug", text: `Password reset request for "${u}"${c ? `. Contact: ${c}` : ""}`, ctx: { page: "forgot password", user: "anon", resetFor: u } }) });
        if (!r.ok) throw new Error(r.status);
        closeSheet(); toast("Request sent. You'll get a new password soon.");
      } catch { el.querySelector("#ferr").textContent = "Couldn't send. Check your connection and try again."; }
    };
  });
}
// Share / invite: the phone's share sheet (WhatsApp, SMS, …) when available, else copy the link.
// ------------------------------------------------------------------ Android app (APK download for browser visitors)
// Inside the APK the start URL carries ?src=apk (and the first page has an android-app:// referrer): no download offer there.
const IN_APK = (() => {
  const hit = /[?&]src=apk\b/.test(location.search) || document.referrer.startsWith("android-app://");
  try { if (hit) sessionStorage.setItem("a1.apk", "1"); return hit || sessionStorage.getItem("a1.apk") === "1"; } catch { return hit; }
})();
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const IS_ANDROID = /Android/i.test(navigator.userAgent);
const standaloneApp = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const offerApk = () => !IN_APK && !IS_IOS && !standaloneApp();
const APK_URL = "download/levelup.apk";
const apkBtn = (cls = "btn ghost", style = "") => offerApk() ? `<button class="${cls}" type="button" data-apk style="${style}">📱 Download the Android app</button>` : "";
const apkHidden = () => { try { return !!localStorage.getItem("a1.apkHide"); } catch { return false; } };
const apkBanner = () => offerApk() && IS_ANDROID && !apkHidden() ? `<div class="card row" id="apkb" style="gap:10px;align-items:center;padding:10px 12px">
  <span style="font-size:24px">📱</span><div class="grow"><b>Get the LevelUp app</b><div class="muted small">Full screen, own icon, opens straight into your lessons.</div></div>
  <button class="btn sm" type="button" data-apk style="width:auto;margin:0">Get it</button><button class="link" id="apkx" aria-label="Hide" style="font-size:18px;padding:4px">✕</button></div>` : "";
function wireApk(root = view()) {
  root.querySelectorAll("[data-apk]").forEach(b => (b.onclick = apkSheet));
  const x = root.querySelector("#apkx");
  if (x) x.onclick = () => { try { localStorage.setItem("a1.apkHide", "1"); } catch { /* ignore */ } root.querySelector("#apkb")?.remove(); toast("You can still get the app in Settings"); };
}
function apkSheet() {
  const appUrl = "https://app.level-up.com.de";
  sheet(`<h2 style="margin-top:0">📱 LevelUp for Android</h2>
    ${IS_ANDROID ? "" : `<p class="note">This is an Android app. Open <b>${appUrl}</b> on your Android phone to install it there (or download it here and copy it over).</p>`}
    <ol class="small" style="padding-left:20px;line-height:1.5">
      <li>Tap <b>Download</b>. Chrome may warn that the file could be harmful: tap <b>Download anyway</b>. (It's only the LevelUp app, not from the Play Store yet.)</li>
      <li>Open the downloaded <b>LevelUp.apk</b>. Android asks to allow <b>Install unknown apps</b> for Chrome: turn it on, go back, tap <b>Install</b>.</li>
      <li>If Play Protect asks to scan the app, let it, then tap <b>Install anyway</b>.</li>
      <li>Open LevelUp from your home screen and log in once. Your progress is the same as on the website.</li>
    </ol>
    <p class="muted small">Needs Android 7 or newer and Chrome. Updates to lessons arrive by themselves, no reinstall needed.</p>
    <a class="btn" href="${APK_URL}" download="LevelUp.apk" id="apkdl" style="display:block;text-align:center;text-decoration:none">Download (about 3 MB)</a>
    <button class="btn ghost" type="button" id="apkc">Close</button>`, el => {
    el.querySelector("#apkc").onclick = closeSheet;
    el.querySelector("#apkdl").onclick = () => setTimeout(() => toast("Downloading… open it from your notifications"), 300);
  });
}
async function shareApp() {
  const url = location.origin + location.pathname.replace(/index\.html$/, "");
  const text = "I'm levelling up with LevelUp: short daily lessons, spaced repetition and quests. Join me!";
  try { if (navigator.share) { await navigator.share({ title: "LevelUp", text, url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(`${text} ${url}`); toast("Invite link copied"); }
  catch { sheet(`<h2 style="margin-top:0">Invite friends</h2><p class="muted small">Copy this link and send it:</p><input id="invu" readonly value="${esc(url)}" style="width:100%">
    <button class="btn" id="ok" style="margin-top:12px">Done</button>`, el => { el.querySelector("#invu").onfocus = e => e.target.select(); el.querySelector("#ok").onclick = closeSheet; }); }
}
async function doLogout() { closeSheet(); await logout(); unpick(); toast("Logged out"); location.hash = "#/today"; route(); }
function passwordSheet() {
  sheet(`<h2 style="margin-top:0">Change password</h2><form id="pf"><label class="f" for="po">Current password</label><input id="po" type="password" autocomplete="current-password" required>
    <label class="f" for="pn">New password</label><input id="pn" type="password" autocomplete="new-password" minlength="6" required>
    <p class="small" id="perr" style="color:var(--red);min-height:1.2em;margin:8px 0 0"></p><button class="btn" type="submit">Change password</button>
    <button class="btn ghost" type="button" id="pc">Cancel</button></form>`, el => {
    el.querySelector("#pc").onclick = closeSheet;
    el.querySelector("#pf").onsubmit = async e => {
      e.preventDefault();
      const r = await changePassword(el.querySelector("#po").value, el.querySelector("#pn").value);
      if (!r.ok) { el.querySelector("#perr").textContent = r.error; return; }
      closeSheet(); toast("Password changed · other devices logged out");
    };
  });
}
function userSheet() {
  if (isGuest()) return sheet(`<h2 style="margin-top:0">Account</h2>${GUEST_NOTE}<button class="btn" id="gsu">Create free account</button>
    <button class="btn ghost" id="gli">I have an account</button><button class="link" id="glv" style="display:block;margin:10px auto 0">Leave guest mode</button>`, el => {
    el.querySelector("#gsu").onclick = guestSignup;
    el.querySelector("#gli").onclick = () => { closeSheet(); authTab = "login"; loginView(); };
    el.querySelector("#glv").onclick = doLeaveGuest;
  });
  if (AUTH === "on") return sheet(`<h2 style="margin-top:0">Account</h2><div class="who" style="margin-top:8px"><button disabled>${avatar(USER)}
      <div class="grow"><div style="font-size:18px;font-weight:800">${esc(userInfo(USER).name)}</div><div class="muted small">Logged in as ${esc(USER)}</div></div></button></div>
    <button class="btn ghost" id="inv">🎁 Share / invite</button><button class="btn ghost" id="pw">Change password</button><button class="btn" id="lo">Log out</button>`, el => {
    el.querySelector("#inv").onclick = shareApp;
    el.querySelector("#pw").onclick = passwordSheet;
    el.querySelector("#lo").onclick = doLogout;
  });
  sheet(`<h2 style="margin-top:0">Switch learner</h2><div class="who" style="margin-top:8px">${USERS.map(u => `<button data-u="${u.id}">${avatar(u.id)}
    <div class="grow"><div style="font-size:18px;font-weight:800">${esc(u.name)}</div><div class="muted small">${u.id === USER ? "Current" : "Tap to switch"}</div></div>
    ${u.id === USER ? "✓" : "›"}</button>`).join("")}</div>`, el => {
    el.querySelectorAll("button[data-u]").forEach(b => (b.onclick = async () => {
      closeSheet();
      if (b.dataset.u === USER) return;
      await switchUser(b.dataset.u); unpick(); toast(`Hallo ${userInfo(USER).name}!`);
      location.hash = "#/today"; route();
    }));
  });
}
async function fillCompare() {
  const box = view().querySelector("#cmp");
  const people = USERS.filter(u => !u.demo || u.id === USER); // demo profiles stay out of the comparison
  if (!box || people.length < 2) return;
  const all = await fetchAllStates();
  all[USER] = S; // always show the freshest local numbers for the current user
  const rows = people.map(u => ({ u, s: summary(all[u.id]) }));
  const best = k => Math.max(...rows.map(r => (r.s ? r.s[k] : -1)));
  const cell = (r, k, fmt) => !r.s ? `<td class="muted">–</td>` : `<td class="${r.s[k] === best(k) && best(k) > 0 ? "lead" : ""}"><b>${fmt(r.s[k], r.s)}</b></td>`;
  const pacefmt = (g) => Math.abs(g) < 1 ? "on track" : g > 0 ? `+${Math.round(g)}` : `${Math.round(g)}`;
  box.innerHTML = `<div class="card"><div class="sys-h">Party</div><div style="font-weight:800;margin-bottom:6px">👥 ${people.map(u => esc(u.name)).join(" & ")}</div>
    <table class="cmp"><tr><th></th>${rows.map(r => `<th>${avatar(r.u.id, true)}<div class="tiny">${esc(r.u.name)}</div></th>`).join("")}</tr>
    <tr class="sl-only-row"><td>Level · Rank</td>${rows.map(r => !r.s ? `<td class="muted">–</td>` : `<td><b>Lv ${r.s.lv}</b> <span class="rank ${r.s.rank}" style="display:inline-grid;width:24px;height:24px;font-size:14px;border-width:1.5px;vertical-align:middle">${r.s.rank}</span></td>`).join("")}</tr>
    <tr><td>XP today</td>${rows.map(r => cell(r, "xpToday", (v, s) => `${v}<span class="tiny muted">/${s.goal}</span>`)).join("")}</tr>
    <tr><td>Diamonds</td>${rows.map(r => cell(r, "gems", v => `💎 ${v}`)).join("")}</tr>
    <tr><td>Total XP</td>${rows.map(r => cell(r, "xp", v => v)).join("")}</tr>
    <tr><td>Streak</td>${rows.map(r => cell(r, "streak", v => `🔥 ${v}`)).join("")}</tr>
    <tr><td>Lessons done</td>${rows.map(r => cell(r, "lessons", (v, s) => `${v}<span class="tiny muted">/${s.of}</span>`)).join("")}</tr>
    <tr><td>Words learned</td>${rows.map(r => cell(r, "words", v => v)).join("")}</tr>
    <tr><td>A1 complete</td>${rows.map(r => cell(r, "pct", v => `${v.toFixed(1)}%`)).join("")}</tr>
    <tr><td>Pace (lessons)</td>${rows.map(r => !r.s ? `<td class="muted">–</td>` : `<td><b style="color:${r.s.gapLessons >= -1 ? "var(--green)" : "var(--amber)"}">${pacefmt(r.s.gapLessons)}</b></td>`).join("")}</tr>
    </table></div>`;
}

// ------------------------------------------------------------------ boot
["gesturestart", "gesturechange"].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false })); // iOS pinch
(async function boot() {
  installBugButton();   // first, so it works even if loading fails
  applyTheme();
  loadAvatars();
  await loadCourses();
  await checkAuth();
  await loadUsers();
  const startCourse = (USER && lastCourse(USER)) || COURSE;
  setCourse(courseInfo(startCourse).status === "ready" ? startCourse : COURSE);
  try { await loadContent(); } catch (e) { view().innerHTML = `<div class="loading">Could not load lessons. Check your internet connection, then reload.</div>`; return; }
  if (USER) await switchUser(USER);
  window.addEventListener("hashchange", route);
  window.addEventListener("popstate", onPopState);
  armBack();
  window.addEventListener("a1:state-replaced", () => { if (!inLesson()) route(); });
  window.addEventListener("a1:auth", async () => { // session expired or revoked: progress stays cached on this device
    if (inLesson()) return;
    if (await checkAuth() === "on" && !localStorage.getItem("a1.user")) { signOut(); toast("Please log in again"); route(); }
  });
  window.addEventListener("a1:sync", () => { const e = document.getElementById("syncst"); if (e) e.textContent = syncText(); });
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && !inLesson() && await refreshFromServer()) route();
  });
  route();
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();

import { C, S, USERS, USER, SYNC, userInfo, loadUsers, switchUser, signOut, COURSES, COURSE, loadCourses, courseInfo, lastCourse, startedLocal, startedRemote, setCourse, switchCourse, fetchAllStates, summary, refreshFromServer,
  save, loadContent, addXP, today, addDays, daysBetween, fmtDate, parse, streak, xpToday, totalXP,
  dueWords, wordStatus, progress, retention, pace, history, nextItem, learnWord, resetAll, exportState,
  importState, WEIGHTS, level, rank, A1_LEVEL, POST_A1_XP, memory, weekPlan, weekOf, thisWeek, goalFor, autoGoal, remainingXP, bitsOf, bitCount, bitsDone, nextBit, phraseTopics, mondayOf, overdueDays, checkRewards, openGift, nextMilestone, tierFor, TIERS, QUEST_GEMS, grammarOf, gPart, questMode, completeItem, health, AUTH, checkAuth, login, signup, changePassword, logout, isGuest, hasGuestData, startGuest, leaveGuest, claimGuest , personalize, partsGoal, partsToday, nextPick, planParts, startTimeTracking, dayCounts } from "./store.js";
import { esc, wordCard, wireSpeakers, grammarXP, startVocab, startReview, startGrammarPractice, startPhrases, abortLesson, inLesson, speakAvailable, confirmQuit, setNextHook } from "./lesson.js";
import { play, stopAudio } from "./audio.js";
import { installBugButton } from "./bugreport.js";
import { rankEmblem, applyAura, aura, auraName, AURA_FULL_LEVEL } from "./hero.js";
import { RANKS } from "./store.js";
import { L } from "./lang.js";
import { startTour, tourRunning, endTour } from "./tour.js";
import * as LF from "./life.js";

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
  // a home-screen widget tap opens a route straight away: use the last course instead of asking first
  if (!picked() && lastCourse(USER) === COURSE && (h.startsWith("#/go/") || (/[?&]src=native\b/.test(location.search) && /^#\/(today|ranks|progress|words|home)$/.test(h)))) markPicked();
  if (!picked()) return courseView();
  if (h === "#/party") { document.querySelectorAll("#tabs a").forEach(a => a.classList.toggle("on", a.dataset.tab === "party")); return partyView(); }
  if (h.startsWith("#/go/")) {        // widget tap: show the course home, then run the action
    const [, , act, arg] = h.split("/");
    location.replace(["tree", "life"].includes(courseInfo(COURSE).type) ? "#/home" : "#/today");
    setTimeout(() => goAction(act, decodeURIComponent(arg || "")), 120); return;
  }
  pushWidget();
  if (courseInfo(COURSE).type === "life") return lifeRoute(h);
  if (courseInfo(COURSE).type === "tree") { const [, nm, arg] = h.split("/"); return nm === "guide" ? (document.body.classList.add("in-lesson"), guideView()) : nm === "branch" && arg ? treeView(arg) : seHome(); }
  if (h === "#/guide") { document.querySelectorAll("#tabs a").forEach(a => a.classList.remove("on")); return guideView(); }
  if (!S.setup) return setupView();
  const [, name, arg] = h.split("/");
  document.querySelectorAll("#tabs a").forEach(a => a.classList.toggle("on", a.dataset.tab === name));
  const pt = document.querySelector('#tabs a[data-tab="path"]');
  if (pt) pt.innerHTML = questMode() ? `<span class="ti">🗺️</span><span>Path</span>` : `<span class="ti">🧩</span><span>Skills</span>`;
  ({ today: todayView, path: pathView, lessons: lessonsView, settings: settingsView, words: wordsView, progress: progressView, ranks: ranksView, grammar: () => grammarView(arg),
     stories: storiesView, story: () => storyView(arg) }[name] || todayView)();
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
const itemName = it => (it.kind === "vocab" ? `Lesson ${it.n}: ${it.title}` : it.title);
// one segment per part of a lesson: done / next / to do (feedback 11-20: "part x of y" alone wasn't clear)
function partBar(it) {
  const n = bitCount(it); if (n < 2) return "";
  const b = (S.bits || {})[it.id] || [], all = !!S.done[it.id], cur = nextBit(it);
  return `<div class="partbar" role="img" aria-label="${bitsDone(it)} of ${n} parts done">${Array.from({ length: n }, (_, k) => `<i class="${all || b[k] ? "on" : k === cur ? "cur" : ""}"></i>`).join("")}</div>`;
}
// time until midnight, e.g. "5 h 12 min"
function leftToday() {
  const m = Math.max(0, Math.ceil((new Date().setHours(24, 0, 0, 0) - Date.now()) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}
// average minutes in lessons per part finished, from the tracked days (null until there's enough data)
function minPerPart() {
  const parts = {}; for (const l of S.log) if (C.item[l.id]) parts[l.d] = (parts[l.d] || 0) + 1;
  let sec = 0, n = 0;
  for (const [d, t] of Object.entries(S.time || {})) if (parts[d] && t[1]) { sec += t[1]; n += parts[d]; }
  return n >= 3 ? Math.max(1, Math.round(sec / 60 / n)) : null;
}

// ------------------------------------------------------------------ setup
// pace always counts from the day you start; default finish = 3 months later
const in3Months = () => { const d = parse(today()); d.setMonth(d.getMonth() + 3); return fmtISO(d); };
const fmtISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysText = to => { const n = daysBetween(today(), to); return n > 0 ? `${n} day${n === 1 ? "" : "s"}` : "pick a future date"; };
function setupView() {
  document.body.classList.add("in-lesson"); // hides the tab bar until setup is done
  const tgt = in3Months();
  view().innerHTML = `<button class="link" id="sw">‹ Not ${esc(userInfo(USER).name)}?</button><h1>${L.code === "fr" ? "Bienvenue" : "Willkommen"}, ${esc(userInfo(USER).name)}! 👋</h1>
  <p class="muted">${courseIcon(C.course.icon)} <b>${esc(C.course.title)}</b> · ${esc(C.course.subtitle || "")}</p>
  <div class="card">
    <label class="f">When do you want to finish A1?</label>
    <div class="row" style="align-items:center;gap:10px"><input type="date" id="tg" value="${tgt}" min="${addDays(today(), 1)}" style="flex:1"><b id="tgd" class="small" style="white-space:nowrap">${daysText(tgt)}</b></div>
    <p class="muted small" style="margin:6px 0 0">Your pace counts from today (${fmtDate(today())}).</p>
    <label class="f">Daily goal</label>
    <div class="choices" id="dg" role="radiogroup">${[["auto", "Auto", "Recommended · sets the goal so you reach A1 by your date"], [10, "Casual", "10 XP a day"], [20, "Regular", "20 XP a day"], [30, "Serious", "30 XP a day"], [45, "Intense", "45 XP a day"]]
      .map(([v, l, d], i) => `<label class="choice"><input type="radio" name="dg" value="${v}" ${i ? "" : "checked"}><span><b>${l}</b><small>${d}</small><small class="eta" data-g="${v}"></small></span></label>`).join("")}</div>
    <p class="muted small" style="margin:6px 0 0">⚡ <b>1 XP ≈ one new word learned.</b> Each finished part adds +2 (+1 if perfect) and a whole lesson +5. Reviews give a little (+1 per 5 words recalled) and forgetting costs XP. 20 XP ≈ one new lesson a day.</p>
  </div>
  <button class="btn" id="go">Start learning</button>`;
  view().querySelector("#sw").onclick = () => { if (isGuest()) { leaveGuest(); return route(); } if (AUTH === "on") return doLogout(); signOut(); route(); };
  // feedback 11-21: next to each XP choice, when it would finish A1 and whether that overshoots the target date
  const etas = () => {
    const to = view().querySelector("#tg").value || tgt, left = remainingXP(S);
    view().querySelectorAll(".eta").forEach(el => {
      const g = el.dataset.g;
      if (g === "auto") { const st = { ...S, settings: { ...S.settings, targetDate: to } }; el.textContent = `≈ ${autoGoal(st)} XP a day to finish by ${fmtDate(to)}`; el.className = "eta ok"; return; }
      const end = addDays(today(), Math.ceil(left / Math.max(1, +g - 3)) - 1), late = daysBetween(to, end); // ~3 XP a day goes to reviews
      el.textContent = late > 0 ? `⚠ Finishes ≈ ${fmtDate(end, { day: "numeric", month: "short", year: "numeric" })}: ${late} day${late === 1 ? "" : "s"} after your date`
        : `✓ Finishes ≈ ${fmtDate(end, { day: "numeric", month: "short", year: "numeric" })}${late < 0 ? ` (${-late} day${late === -1 ? "" : "s"} early)` : ""}`;
      el.className = "eta " + (late > 0 ? "late" : "ok");
    });
  };
  etas();
  view().querySelector("#tg").oninput = e => { view().querySelector("#tgd").textContent = e.target.value ? daysText(e.target.value) : ""; etas(); };
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

// Flag emojis don't render on Windows (feedback 11-20: "DE / ES / FR" letters instead), so draw them as small SVGs.
const FLAGS = {
  "🇩🇪": `<rect width="6" height="4" fill="#000"/><rect y="1.333" width="6" height="1.334" fill="#DD0000"/><rect y="2.667" width="6" height="1.333" fill="#FFCE00"/>`,
  "🇫🇷": `<rect width="2" height="4" fill="#0055A4"/><rect x="2" width="2" height="4" fill="#fff"/><rect x="4" width="2" height="4" fill="#EF4135"/>`,
  "🇪🇸": `<rect width="6" height="4" fill="#AA151B"/><rect y="1" width="6" height="2" fill="#F1BF00"/>`,
};
const courseIcon = icon => FLAGS[icon]
  ? `<svg class="flag" viewBox="0 0 6 4" role="img" aria-hidden="true" preserveAspectRatio="none">${FLAGS[icon]}</svg>` : esc(icon);
// top row: the learner is just their avatar (name in the menu it opens); the course gets the room, icon + name
const userChip = () => `<button class="userchip avonly" id="uc" aria-label="${esc(userInfo(USER).name)}: switch learner">${avatar(USER, true)}<span class="caret" aria-hidden="true">▾</span></button>`;
const courseChip = () => `<button class="coursechip" id="cc" aria-label="Course: ${esc(C.course.title)}. Change course"><span class="ci">${courseIcon(C.course.icon)}</span><span class="nm">${esc(C.course.short || C.course.title)}</span><span class="caret" aria-hidden="true">▾</span></button>`;
// ------------------------------------------------------------------ today
function topBar() {
  if (!questMode()) return `<div class="row" style="margin-bottom:10px;gap:8px">${userChip()}${courseChip()}
    <span class="grow"></span><span class="tiny muted" id="syncst">${syncText()}</span><span class="gemchip" style="cursor:default">⚡ <b>${totalXP()}</b></span></div>${playerBar()}`;
  const g = goalFor(), x = xpToday(), p = Math.min(100, Math.round(100 * x / g));
  return `<div class="row" style="margin-bottom:10px;gap:8px">${userChip()}${courseChip()}
    <span class="grow"></span><span class="tiny muted" id="syncst">${syncText()}</span>${gemChip()}</div>${playerBar()}<div class="top classic-only">
    <div class="ring" id="xpring" style="--p:${p};cursor:pointer"><div>${x}<br><span class="tiny muted">/${g} XP</span></div></div>
    <div class="grow"><div style="font-weight:800;font-size:calc(18px*var(--fs))">${x >= g ? "Daily goal done ✅" : "Today's goal"}</div>
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

let tleftTimer = 0;
// 📋 Today's plan: what the rest of today's parts will teach (feedback 11-20)
function agendaCard(due) {
  const need = Math.max(0, partsGoal() - partsToday()), plan = planParts(need || 1);
  if (!plan.length) return "";
  const words = new Map(), phr = new Map(), gram = [];
  for (const { it, ids } of plan) {
    if (it.kind === "vocab") ids.forEach(id => { const t = topicName(C.word[id].topic).split(" (")[0].split(",")[0]; words.set(t, (words.get(t) || 0) + 1); });
    else if (it.kind === "phrases") phr.set(it.title, (phr.get(it.title) || 0) + ids.length);
    else gram.push(it.title);
  }
  const sum = m => [...m.values()].reduce((a, b) => a + b, 0), list = m => [...m].map(([t, n]) => `${esc(t)} ${n}`).join(" · ");
  const mpp = minPerPart(), revN = Math.min(20, due.length);
  const li = [
    words.size && `🔤 <b>${sum(words)} new word${sum(words) > 1 ? "s" : ""}</b> <span class="muted">· ${list(words)}</span>`,
    phr.size && `💬 <b>${sum(phr)} new phrase${sum(phr) > 1 ? "s" : ""}</b> <span class="muted">· ${list(phr)}</span>`,
    gram.length && `📐 <b>Grammar</b> <span class="muted">· ${gram.map(esc).join(" · ")}</span>`,
    revN && `🧠 <b>${revN} word${revN > 1 ? "s" : ""} to recall</b> <span class="muted">· memory training</span>`,
    mpp && `⏱ <b>about ${mpp * plan.length + Math.ceil(revN / 4)} min</b> <span class="muted">· from your own average</span>`,
  ].filter(Boolean);
  return `<div class="card"><div class="sys-h">📋 Today's plan</div>
    <div class="muted small" style="margin-bottom:6px">${need ? `${need} part${need > 1 ? "s" : ""} left for today's quest:` : "Today's parts are done ✓ Next up, as a bonus:"}</div>
    <ul class="agenda">${li.map(x => `<li>${x}</li>`).join("")}</ul></div>`;
}
function todayView() {
  if (!questMode()) return freeToday();
  const it = nextPick(), due = dueWords();
  view().innerHTML = topBar() + apkBanner() + guideCard() + `
  ${dailyQuest(due)}
  ${it ? `<div class="card next-card"><div class="sys-h"><span class="ex">!</span> New quest</div>
      <div class="small row" style="font-weight:800;opacity:.9;gap:6px">${kicon(it.kind, false, true)} NEXT · ${KIND[it.kind].toUpperCase()} · WEEK ${weekOf(it)}</div>
      <div style="font-size:calc(21px*var(--fs));font-weight:800;margin-top:4px">${esc(itemName(it))}</div>
      ${partBar(it)}
      <div class="muted small">${[partLabel(it), it.kind === "vocab" ? `${bitsOf(it)[nextBit(it)].length} new words` : it.kind === "phrases" ? `${bitsOf(it)[nextBit(it)].length} new phrases` : ""].filter(Boolean).join(" · ")}</div>
      ${bitCount(it) > 1 ? `<div class="muted tiny">This lesson has ${bitCount(it)} short parts${minPerPart() ? ` (about ${minPerPart()} min each)` : ""}. Each part you finish counts for the daily quest.</div>` : ""}
      <button class="btn" id="next">${bitsDone(it) ? "Continue" : "Start"}</button></div>
    ${agendaCard(due)}`
    : `<div class="card next-card"><div style="font-size:calc(21px*var(--fs));font-weight:800">All lessons done! 🎓</div><div class="muted">Keep your reviews going until the exam.</div></div>`}
  ${due.length ? `<div class="card"><div class="sys-h">Memory training</div>
    <div class="quest" style="border:0"><span class="box"></span><div class="grow"><b>Review ${due.length} word${due.length > 1 ? "s" : ""} to remember</b>
      <div class="muted small">Review them now to keep them fresh</div></div>
      <button class="btn blue sm" id="rev">Review ${Math.min(20, due.length)}</button></div>
    ${memWarn()}</div>` : ""}`;
  appendStories();
  const nb = view().querySelector("#next"); if (nb) nb.onclick = () => startItem(it);
  const rv = view().querySelector("#rev"); if (rv) rv.onclick = () => startReview(due.slice(0, 20));
  clearInterval(tleftTimer); tleftTimer = setInterval(() => { const e = document.getElementById("tleft"); if (e) e.textContent = leftToday(); else clearInterval(tleftTimer); }, 30000);
  levelWatch();
  wireTop();
  maybeTour(); wireGuideCard();
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
  view().innerHTML = topBar() + apkBanner() + guideCard() + `
  ${it ? `<div class="card next-card"><div class="sys-h">Up next</div>
      <div class="small row" style="font-weight:800;opacity:.9;gap:6px">${kicon(it.kind, false, true)} ${KIND[it.kind].toUpperCase()}</div>
      <div style="font-size:calc(21px*var(--fs));font-weight:800;margin-top:4px">${esc(it.kind === "vocab" ? `Lesson ${it.n}: ${it.title}` : it.title)}</div>
      <div class="muted small">${partLabel(it) || "A suggestion – or pick any skill"}</div>
      <button class="btn" id="next">${bitsDone(it) ? "Continue" : "Start"}</button>
      <button class="btn ghost" id="all">🧩 Pick a skill</button><button class="link" id="ord" style="display:block;margin:6px auto 0">↓ See the recommended order</button></div>`
    : `<div class="card next-card"><div style="font-size:calc(21px*var(--fs));font-weight:800">All lessons done! 🎓</div><div class="muted">Keep your reviews going until the exam.</div></div>`}
  ${due.length ? `<div class="card"><div class="sys-h">Memory training</div>
    <div class="quest" style="border:0"><span class="box"></span><div class="grow"><b>Review ${due.length} word${due.length > 1 ? "s" : ""} to remember</b>
      <div class="muted small">No pressure – reviews just keep words fresh</div></div>
      <button class="btn blue sm" id="rev">Review ${Math.min(20, due.length)}</button></div></div>` : ""}
  <p class="small muted" style="text-align:center">Quest Mode is off – no daily goal, quests or penalties. <a href="#/settings" class="link" style="padding:0">Change</a></p>`;
  const nb = view().querySelector("#next"); if (nb) nb.onclick = () => startItem(it);
  const ab = view().querySelector("#all"); if (ab) ab.onclick = () => { try { localStorage.setItem("a1.freeLayout", "skills"); } catch { /* ignore */ } location.hash = "#/path"; };
  const ob = view().querySelector("#ord"); if (ob) ob.onclick = () => { try { localStorage.setItem("a1.freeLayout", "order"); } catch { /* ignore */ } location.hash = "#/path"; };
  const rv = view().querySelector("#rev"); if (rv) rv.onclick = () => startReview(due.slice(0, 20));
  appendStories();
  levelWatch();
  wireTop(); maybeTour(); wireGuideCard();
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
// segmented ring around a path node: one arc per part, filled when done
function nodeRing(it) {
  const n = bitCount(it); if (n < 2) return "";
  const b = (S.bits || {})[it.id] || [], all = !!S.done[it.id], R = 40, c = 43, gap = 12, seg = 360 / n;
  const pt = a => [c + R * Math.cos(a * Math.PI / 180), c + R * Math.sin(a * Math.PI / 180)];
  return `<svg class="pring" viewBox="0 0 86 86" aria-hidden="true">${Array.from({ length: n }, (_, k) => {
    const a0 = -90 + k * seg + gap / 2, a1 = -90 + (k + 1) * seg - gap / 2, [sx, sy] = pt(a0), [ex, ey] = pt(a1);
    return `<path d="M${sx.toFixed(1)},${sy.toFixed(1)} A${R},${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${ex.toFixed(1)},${ey.toFixed(1)}" class="${all || b[k] ? "on" : ""}"/>`;
  }).join("")}</svg>`;
}
function pathView() {
  if (!questMode()) return skillMapView();
  const nx = nextPick();
  const plan = weekPlan();
  let k = 0;
  view().innerHTML = `<h1>Your path to A1</h1>${paceCard(pace())}<p class="muted small">Everything is open – tap any lesson.</p>` +
    plan.weeks.map(W => [W, W.items]).map(([W, items]) => `<div class="week"><div class="week-h">${weekHead(W, items)}</div>
      <div class="nodes">${items.map(i => {
        const off = Math.round(Math.sin(k++ * 0.95) * 64);
        const done = !!S.done[i.id], cur = nx && nx.id === i.id;
        const side = off > 0 ? "l" : "r";
        return `<button class="node ${i.kind} ${done ? "done" : "avail"} ${cur ? "cur" : ""}" data-id="${i.id}" style="transform:translateX(${off}px)">
          ${nodeRing(i)}${cur ? `<span class="start-tip">${bitsDone(i) ? `Part ${Math.min(bitsDone(i) + 1, bitCount(i))}/${bitCount(i)}` : "START"}</span>` : ""}<span class="nglyph">${done ? "✓" : GLYPH[i.kind]}</span>
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
  ${first ? `${g.watch ? `<p class="small">🎬 ${esc(g.watch)}</p>` : ""}<p>${esc(g.intro)}</p>` : ""}
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
const azKey = de => de.replace(/^(der|die|das|le|la|les)\s+|^l['’]/i, "").replace(/[()]/g, "").toLowerCase();
function sortWords(list) {
  const s = id => S.words[id], far = "9999";
  const by = {
    recent: (a, b) => (s(b.id)?.since || "") .localeCompare(s(a.id)?.since || "") || (s(b.id) ? 1 : 0) - (s(a.id) ? 1 : 0),
    weak: (a, b) => (s(a.id) ? health(s(a.id)) : 2) - (s(b.id) ? health(s(b.id)) : 2) || (s(b.id)?.lapses || 0) - (s(a.id)?.lapses || 0),
    strong: (a, b) => (s(b.id)?.ivl ?? -1) - (s(a.id)?.ivl ?? -1),
    due: (a, b) => (s(a.id)?.due || far).localeCompare(s(b.id)?.due || far),
    az: (a, b) => azKey(a.de).localeCompare(azKey(b.de), L.code),
  }[wf.sort];
  return by ? [...list].sort(by) : list;
}
function wordsView() {
  const r = retention(), PT = phraseTopics(), pAll = PT.flatMap(t => t.items), pN = pAll.filter(p => p.learned).length;
  view().innerHTML = `<h1>Words</h1><p class="muted small">${r.learned} of ${r.total} words learned · ${r.mastered} mastered${pAll.length ? ` · 💬 ${pN} of ${pAll.length} phrases learned` : ""}</p>
    <input class="search" id="q" placeholder="Search ${L.name} or English…" value="${esc(wf.q)}">
    <div class="seg" id="seg">${[["all", "All"], ["due", "Due"], ["learning", "Learning"], ["known", "Known"], ["mastered", "Mastered"], ["new", "New"], ["core", "★ Core"]]
      .map(([k, l]) => `<button data-f="${k}" class="${wf.f === k ? "on" : ""}">${l}</button>`).join("")}</div>
    <div class="row wtools"><label class="small muted" for="ws">Sort</label><select id="ws" class="wsort">${WORD_SORTS.map(([v, l]) => `<option value="${v}" ${wf.sort === v ? "selected" : ""}>${l}</option>`).join("")}</select>
      <span class="grow"></span><button class="link small" id="wx" hidden></button></div>
    <div class="wl" id="wl"></div>`;
  const cls = { new: "", learning: "l", known: "k", mastered: "m" };
  const row = w => `<div class="wrow" data-id="${w.id}">
      <span class="dot ${cls[wordStatus(w.id)]}"></span><div class="t"><div>${esc(w.de)}</div><div>${esc(w.en)}</div></div>
      <button class="spk sm" data-a="${w.a || ""}" data-t="${esc(w.de)}">🔊</button></div>`;
  const prow = p => `<div class="wrow"><span class="dot ${p.learned ? "k" : ""}"></span><div class="t"><div>${esc(p.de)}</div><div>${esc(p.en)}</div></div>
      ${p.a ? `<button class="spk sm" data-a="${p.a}" data-t="${esc(p.de)}">🔊</button>` : ""}</div>`;
  // phrases from phrase lessons: own groups on "All" (by topic), and in search results
  const phraseGroups = open => PT.map(t => { const n = t.items.filter(p => p.learned).length, k = "💬 " + t.title;
    return `<details class="wgrp" data-t="${esc(k)}" ${open.has(k) ? "open" : ""}><summary><span class="grow">${esc(t.title)}</span>
      <span class="tiny muted">${n}/${t.items.length} learned</span></summary>${t.items.map(prow).join("")}</details>`; }).join("");
  const draw = () => {
    const q = wf.q.toLowerCase().trim(), due = new Set(dueWords());
    const list = C.content.words.filter(w => {
      if (q && !(L.fold ? L.fold(w.de.toLowerCase()).includes(L.fold(q)) : w.de.toLowerCase().includes(q)) && !w.en.toLowerCase().includes(q)) return false;
      if (wf.f === "all") return true;
      if (wf.f === "due") return due.has(w.id);
      if (wf.f === "core") return w.core;
      return wordStatus(w.id) === wf.f;
    });
    const wl = view().querySelector("#wl"), wx = view().querySelector("#wx");
    const grouped = wf.sort === "topic" && !q;
    wx.hidden = !grouped;
    const pq = q ? pAll.filter(p => p.de.toLowerCase().includes(q) || p.en.toLowerCase().includes(q)) : [];
    if (q && pq.length) {                     // search: matching phrases first, then words
      const sorted = sortWords(list);
      wl.innerHTML = `<div class="wrow muted tiny">💬 Phrases</div>${pq.slice(0, 50).map(prow).join("")}` +
        (sorted.length ? `<div class="wrow muted tiny">Words</div>${sorted.slice(0, 300).map(row).join("")}` : "");
    } else if (!list.length) wl.innerHTML = `<div class="wrow muted">No words here yet.</div>`;
    else if (grouped) {
      const groups = new Map();
      list.forEach(w => { const t = topicName(w.topic); if (!groups.has(t)) groups.set(t, []); groups.get(t).push(w); });
      const open = openTopics();
      if (wf.f === "all") PT.forEach(t => groups.set("💬 " + t.title, null));   // phrase topics (drawn first by phraseGroups) for Expand all
      wl.innerHTML = (wf.f === "all" ? phraseGroups(open) : "") + [...groups].filter(([, ws]) => ws).map(([t, ws]) => { const n = ws.filter(w => S.words[w.id]).length;
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
const legendLine = (c, dash, w) => `<span><svg width="24" height="8" aria-hidden="true"><line x1="1" y1="4" x2="23" y2="4" stroke="${c}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ""} stroke-linecap="round"/></svg> `;
// 📅 activity calendar: goal reached (filled), active (outlined), minutes spent; tap a day for details
let calMonth = null;
function calendarCard() {
  const t = today(), m0 = calMonth || t.slice(0, 7), [y, m] = m0.split("-").map(Number);
  const first = `${m0}-01`, days = new Date(y, m, 0).getDate(), lead = (parse(first).getDay() + 6) % 7;
  const parts = {}; for (const l of S.log) if (C.item[l.id]) parts[l.d] = (parts[l.d] || 0) + 1;
  const tm = d => (S.time || {})[d] || [0, 0], min = sec => Math.round(sec / 60);
  let cells = "";
  for (let k = 0; k < lead; k++) cells += `<span></span>`;
  for (let k = 1; k <= days; k++) {
    const d = `${m0}-${String(k).padStart(2, "0")}`, hit = dayCounts(d), act = (S.xp[d] || 0) > 0 || tm(d)[0] > 0;
    cells += `<button class="cday ${hit ? "hit" : act ? "act" : ""} ${d === t ? "today" : ""} ${d > t ? "future" : ""}" data-d="${d}">${k}${tm(d)[0] >= 60 ? `<small>${min(tm(d)[0])}m</small>` : ""}</button>`;
  }
  const all = Object.entries(S.time || {}).filter(([, v]) => v[0] >= 60), avg = all.length ? min(all.reduce((a, [, v]) => a + v[0], 0) / all.length) : null;
  const goalDays = Object.keys(S.hit || {}), gAvg = goalDays.filter(d => tm(d)[0] >= 60), gMin = gAvg.length ? min(gAvg.reduce((a, d) => a + tm(d)[0], 0) / gAvg.length) : null, mpp = minPerPart();
  return `<div class="card" id="calcard"><div class="row"><div class="grow" style="font-weight:800">📅 Activity</div>
      <button class="link" id="calp" aria-label="Previous month">‹</button><b class="small" style="min-width:90px;text-align:center">${fmtDate(first, { month: "short", year: "numeric" })}</b><button class="link" id="caln" aria-label="Next month" ${m0 >= t.slice(0, 7) ? "disabled" : ""}>›</button></div>
    <div class="cal">${["M", "T", "W", "T", "F", "S", "S"].map(x => `<span class="ch">${x}</span>`).join("")}${cells}</div>
    <div class="legend"><span><i class="ck hit"></i>${questMode() ? "Daily goal reached" : "Learned"} (counts for 🔥)</span><span><i class="ck act"></i>Active</span><span>12m = minutes in the app</span></div>
    <div class="stat-grid" style="margin-top:10px">
      <div class="tile"><span>Avg per active day</span><b>${avg != null ? `${avg} min` : "–"}</b></div>
      <div class="tile"><span>Avg on goal days</span><b>${gMin != null ? `${gMin} min` : "–"}</b></div>
      <div class="tile"><span>Avg per lesson part</span><b>${mpp != null ? `${mpp} min` : "–"}</b></div></div>
    <p class="muted tiny" style="margin-bottom:0">Time counts while the app is open and you're using it (since 20 Nov 2026). Tap a day for details.</p></div>`;
}
function wireCalendar() {
  const c = view().querySelector("#calcard"); if (!c) return;
  const shift = k => { const [y, m] = (calMonth || today().slice(0, 7)).split("-").map(Number), d = new Date(y, m - 1 + k, 1); calMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; c.outerHTML = calendarCard(); wireCalendar(); };
  c.querySelector("#calp").onclick = () => shift(-1);
  c.querySelector("#caln").onclick = () => shift(1);
  c.querySelectorAll(".cday").forEach(b => (b.onclick = () => {
    const d = b.dataset.d, tm = (S.time || {})[d] || [0, 0], n = S.log.filter(l => l.d === d && C.item[l.id]).length, hit = (S.hit || {})[d];
    toast(`${fmtDate(d, { weekday: "short", day: "numeric", month: "short" })} · ${S.xp[d] || 0} XP${hit ? ` · goal ${hit} ✓` : ""} · ${n} part${n === 1 ? "" : "s"}${tm[0] ? ` · ${Math.round(tm[0] / 60)} min (${Math.round(tm[1] / 60)} in lessons)` : ""}`);
  }));
}
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
  const proj = pc.projected && t >= start ? `<line x1="${X(t)}" y1="${Y(pc.actual)}" x2="${X(pc.projected <= end ? pc.projected : end)}" y2="${Y(pc.projected <= end ? 100 : pc.actual + pc.actualPerDay * daysBetween(t, end))}" stroke="#a970ff" stroke-width="2.5" stroke-dasharray="2 4" stroke-linecap="round"/>` : "";
  const ex = Math.min(100, Math.max(0, 100 * daysBetween(start, t) / Math.max(1, daysBetween(start, target)))), youUp = pc.actual >= ex;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Expected versus actual pace">
    ${grid}${ticks}
    <line x1="${X(target)}" x2="${X(target)}" y1="${T}" y2="${H - B}" stroke="var(--amber)" stroke-dasharray="3 3"/>
    <text x="${X(target) - 3}" y="${T + 9}" text-anchor="end" style="fill:var(--amber);font-weight:700">🎯 target</text>
    <line x1="${X(start)}" y1="${Y(0)}" x2="${X(target)}" y2="${Y(100)}" stroke="var(--muted)" stroke-width="2" stroke-dasharray="6 5"/>
    ${proj}
    <path d="${stepPath}" fill="none" stroke="var(--green)" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="${X(t)}" cy="${Y(pc.actual)}" r="5" fill="var(--green)" stroke="var(--card)" stroke-width="2"/>
    <text x="${X(t) + 8}" y="${Y(pc.actual) + (youUp ? -8 : 14)}" style="fill:var(--green);font-weight:800">You ${pc.actual.toFixed(1)}%</text>
    <circle cx="${X(t)}" cy="${Y(ex)}" r="3.5" fill="var(--muted)"/>
    <text x="${X(t) + 8}" y="${Y(ex) + (youUp ? 14 : -8)}" style="fill:var(--muted);font-weight:700">Expected ${ex.toFixed(1)}%</text>
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
  view().innerHTML = `<div class="row"><h1 class="grow">Progress</h1>${userChip()}</div>
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
    <div class="legend">${legendLine("var(--green)", "", 3)}<b>You</b> (your real progress)</span>${legendLine("var(--muted)", "6 5", 2)}Expected (straight line to the 🎯 target)</span>${legendLine("#a970ff", "2 4", 2.5)}Projection if you keep your pace</span></div>
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
  ${calendarCard()}
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
    <div class="tile"><span>Days goal met</span><b>${Object.keys(S.hit || {}).length + Object.entries(S.xp).filter(([d, v]) => d < (S.settings.streakFrom || "") && v >= goalFor()).length}</b></div></div>
    ${(S.penLog || []).length ? `<div class="small" style="margin-top:10px"><b style="color:var(--red)">Penalties: −${Object.values(S.pen).reduce((a, b) => a + b, 0)} XP</b>
      ${S.penLog.slice(-4).reverse().map(p => `<div class="muted tiny">${fmtDate(p.d)} · −${p.xp} XP · ${esc(p.why)}</div>`).join("")}</div>` : ""}</div>
`;
  const v = view();
  v.insertAdjacentHTML("beforeend", `<button class="card partylink" id="gop"><span style="font-size:calc(26px*var(--fs))">👥</span><span class="grow"><b>Party</b><div class="tiny muted">Compare progress with your party, or join one</div></span><span>›</span></button>`);
  v.querySelector("#gop").onclick = () => (location.hash = "#/party");
  wireTop(); wireCalendar();
  v.querySelector("#xph").onclick = () => sheet(XP_HELP + `<button class="btn" id="ok">Got it</button>`, el => (el.querySelector("#ok").onclick = closeSheet));
}

// ------------------------------------------------------------------ settings
function settingsView() {
  const p = weekPlan(), daysLeft = daysBetween(today(), S.settings.targetDate);
  view().innerHTML = `<div class="row"><h1 class="grow">Settings</h1>${userChip()}</div>
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
    <label class="f">Text size</label><button class="btn ghost sm" data-aa style="margin:0">Aa ${(FONT_SIZES.find(([f]) => f === fontScale()) || [0, "Custom"])[1]} ›</button>
    <label class="toggle">Show Hindi pronunciation hints <input type="checkbox" id="hi" ${S.settings.hindi ? "checked" : ""}></label>
    <label class="toggle">Play audio automatically <input type="checkbox" id="ap" ${S.settings.autoplay ? "checked" : ""}></label>
    <label class="toggle">Sounds on <input type="checkbox" id="snd" ${S.settings.sound ? "checked" : ""}></label>
    ${speakAvailable() ? `<label class="toggle">🎤 Speaking practice in phrase lessons <input type="checkbox" id="spk" ${S.settings.speak !== false ? "checked" : ""}></label>
    <p class="muted small" style="margin:4px 0 0">Uses the microphone; Chrome sends the audio to Google to recognise it. Optional, never costs XP.</p>` : ""}</div>
  <div class="card"><div class="sys-h">Offline</div><div style="font-weight:800">📶 Offline</div>
    <p class="muted small">Save all pronunciation clips on this phone so lessons work without internet.</p>
    <button class="btn ghost" id="dl">Download all audio</button><p class="small" id="dlst"></p></div>
  ${offerApk() || offerIos() ? `<div class="card"><div class="sys-h">App</div><div style="font-weight:800">📱 ${offerIos() ? "iPhone app" : "Android app"}</div>
    <p class="muted small">Install LevelUp as an app: full screen, own icon, same account and progress.</p>${apkBtn("btn")}</div>` : ""}
  <div class="card"><div class="sys-h">About</div><div style="font-weight:800">ℹ️ App version</div>${verBox()}
    <button class="btn" data-guide style="margin-top:12px">📘 How LevelUp works (2-min guide)</button>
    <button class="btn ghost" data-tour style="margin-top:8px">🧭 Take the welcome tour</button></div>
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
  v.querySelector("#hi").onchange = e => setS("hindi", e.target.checked);
  v.querySelector("#ap").onchange = e => setS("autoplay", e.target.checked);
  v.querySelector("#snd").onchange = e => setS("sound", e.target.checked);
  const spk = v.querySelector("#spk"); if (spk) spk.onchange = e => setS("speak", e.target.checked);
  v.querySelector("#dl").onclick = downloadAudio;
  v.querySelector("#ex").onclick = () => {
    if (window.LevelUpNative) return window.LevelUpNative.saveFile(`deutsch-a1-backup-${today()}.json`, exportState()); // native app: Android save dialog
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
// Native app: after picking a language course, ask for the microphone up front (for 🎤 Speak it) instead of mid-lesson.
// At most twice per device (Android stops showing the dialog after two refusals anyway).
function askMicForSpeakIt(cid) {
  const N = window.LevelUpNative;
  if (!N || !N.micGranted || courseInfo(cid).type !== "language" || (S && S.settings.speak === false)) return;
  try {
    if (N.micGranted()) return;
    const n = +(localStorage.getItem("a1.micAsks") || 0); if (n >= 2) return;
    localStorage.setItem("a1.micAsks", String(n + 1));
    N.requestMic();
  } catch { /* old APK or storage blocked */ }
}
function picked() { try { return sessionStorage.getItem(pickKey()) === COURSE; } catch { return true; } }
function unpick() { try { sessionStorage.removeItem(pickKey()); } catch { /* ignore */ } }
function markPicked() { try { sessionStorage.setItem(pickKey(), COURSE); } catch { /* ignore */ } }
function courseView() {
  document.body.classList.add("in-lesson"); // full-screen, no tabs
  const groups = {};
  COURSES.forEach(c => (groups[c.group || "Courses"] = groups[c.group || "Courses"] || []).push(c));
  const sm = S && S.setup ? summary(S) : null;
  view().innerHTML = `${gearBtn()}<div class="row" style="margin-bottom:8px">${userChip()}</div>
    <div style="text-align:center;padding:4vh 0 10px"><div class="sysbanner">Select a path</div><h1>What do you want to study?</h1>
    <p class="muted">Pick a course. Each one keeps its own level, rank and progress.</p></div>
    ${Object.entries(groups).map(([g, cs]) => `<h3>${esc(g)}</h3><div class="courses">${cs.map(c => {
      const here = sm && c.id === COURSE, begun = here || (USER && c.status === "ready" && startedLocal(USER, c.id));
      return `<button class="course ${c.status !== "ready" ? "soon" : ""} ${c.id === COURSE ? "cur" : ""}" data-c="${c.id}" ${c.status !== "ready" ? "disabled" : ""} style="--c:${c.color || "#5aa9ff"}">
        <span class="cicon">${courseIcon(c.icon)}</span><span class="grow"><b>${esc(c.title)}</b>
        <span class="muted small">${esc(c.subtitle || "")}</span>${here ? `<span class="small cprog">Lv ${sm.lv} · ${sm.rank}-Rank · ${sm.pct.toFixed(0)}% done</span>` : ""}</span>
        <span class="cgo">${c.status === "ready" ? (begun ? "Continue ›" : "Start ›") : "Coming Soon"}</span></button>`; }).join("")}</div>`).join("")}`;
  wireTop();
  // started on another device (no copy on this phone): ask the server and switch the label
  view().querySelectorAll(".course[data-c]:not([disabled])").forEach(async b => {
    const go = b.querySelector(".cgo");
    if (go && /Start/.test(go.textContent) && await startedRemote(USER, b.dataset.c) && b.isConnected) go.textContent = "Continue ›";
  });
  view().querySelectorAll(".course[data-c]:not([disabled])").forEach(b => (b.onclick = async () => {
    b.disabled = true;
    if (b.dataset.c !== COURSE || !S) await switchCourse(b.dataset.c); else setCourse(b.dataset.c);
    markPicked(); document.body.classList.remove("in-lesson");
    if (location.hash !== "#/today") location.hash = "#/today"; else route();
    askMicForSpeakIt(b.dataset.c);
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
let pendingSheet = null;                                       // node whose sheet opens once its branch view is drawn
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
const topRow = () => `<div class="row" style="margin-bottom:10px;gap:8px">${userChip()}
  ${courseChip()}<span class="grow"></span>
  <span class="gemchip" style="cursor:default">⚡ <b>${totalXP()}</b></span>${aaBtn()}</div>`;
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
  view().innerHTML = topRow() + guideCard() + `<div style="margin:2px 2px 10px"><div style="font-size:calc(21px*var(--fs));font-weight:800">${esc(T.title)}</div>
      <div class="muted small">${brs.length} branches open · ${done} of ${all.length} skills learned</div></div>${cont}
    <div class="sec-h">Your branches</div>
    <div class="bgrid">${brs.map(b => { const ns = treeNodes(b.id), d = ns.filter(n => nodeDone(n.id)).length, nx = nextNode(b);
      return `<button class="bcard" data-b="${b.id}" style="--c:${b.color}" aria-label="${esc(b.title)}: ${d} of ${ns.length} skills"><div class="row" style="justify-content:space-between">${ringSVG(branchFrac(b), b.color, b.icon)}<span class="tiny muted">${d}/${ns.length}</span></div>
        <div class="bc-t">${esc(b.title)}</div><div class="tiny muted">${nx ? `Next: ${esc(nx.title)}` : d === ns.length ? "👑 Complete" : ""}</div></button>`; }).join("")}</div>
    <button class="card partylink" id="gop" style="margin-top:14px"><span style="font-size:calc(26px*var(--fs))">👥</span><span class="grow"><b>Party</b><div class="tiny muted">Compare progress with your party</div></span><span class="pbadge" hidden></span><span>›</span></button>
    ${soon.length ? `<div class="sec-h">Coming soon</div><div class="soontags">${soon.map(b => `<button class="soontag" data-s="${b.id}">${b.icon} ${esc(b.title)}</button>`).join("")}</div>` : ""}`;
  wireTop(); maybeTour(); wireGuideCard();
  view().querySelectorAll(".bcard").forEach(b => (b.onclick = () => (location.hash = "#/branch/" + b.dataset.b)));
  view().querySelector("#gop").onclick = () => (location.hash = "#/party");
  if (PARTY && PARTY.mine && PARTY.mine.requests.length) { const pb = view().querySelector("#gop .pbadge"); pb.textContent = PARTY.mine.requests.length; pb.hidden = false; }
  view().querySelectorAll(".soontag").forEach(b => (b.onclick = () => { const s = T.branches.find(x => x.id === b.dataset.s);
    sheet(`<div style="font-size:calc(20px*var(--fs));font-weight:800">${s.icon} ${esc(s.title)}</div><p class="muted small" style="margin:4px 0 0">Coming soon. Planned skills:</p>
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
  if (pendingSheet) { const n = nodes.find(x => x.id === pendingSheet); pendingSheet = null; if (n) nodeSheet(n.id); }
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
    ${practiceBlock(n, st)}
    ${st !== "locked" ? `<button class="btn" id="read" style="margin-top:14px">${readLabel(n, st)}</button><div class="tiny muted" id="dlst" style="text-align:center;margin-top:4px"></div>` : ""}
    ${st === "done" ? `<div class="note" style="margin-top:8px">✅ Learned on ${fmtDate(S.tree[id])}</div>${dependents.length ? "" : `<button class="link" id="undo">Undo</button>`}` : ""}
    <button class="btn ghost" id="close">Close</button>`, el => {
    el.querySelector("#close").onclick = closeSheet;
    const brN = C.content.branches.find(b => b.id === n.branch), dl = el.querySelector("#dlst");
    if (dl && brN.reading) loadIndex(brN).then(async idx => {
      const info = idx.chapters[String(n.chapter)]; if (!info) return;
      dl.textContent = (await isDownloaded(brN, n.chapter)) ? `✓ Saved on this phone · ${info.cards} cards` : `${info.cards} cards · ${kb(info.bytes)} · downloads when you start`;
    }).catch(() => {});
    const PQ = el.querySelector("#practice");
    if (PQ) PQ.onclick = () => { closeSheet(); openQuiz(brN, n); };
    const CQ = el.querySelector("#ccheck");
    if (CQ) CQ.onclick = () => { closeSheet(); openQuiz(brN, n, null, "cc"); };
    const R0 = el.querySelector("#read");
    if (R0) R0.onclick = () => { closeSheet(); openReader(C.content.branches.find(b => b.id === n.branch), n); };
    if (st !== "locked") el.querySelectorAll(".partrow").forEach(b => (b.onclick = () => { closeSheet(); openReader(brN, n, +b.dataset.p); }));
    const U = el.querySelector("#undo");
    if (U) U.onclick = () => { delete S.tree[id]; if (S.parts) delete S.parts[id]; save(); closeSheet(); treeView(); };
  });
}

// ---- practice: each skill's questions (chapter file "quiz", built from content/<tree>/<branch>/NN.q.json)
// Types: mc (multiple choice), tf / mf (true-false, shown as Myth / Fact), num (type a number).
// S.quiz[node] = {best, of, at, xp}: the first run with 80 %+ right gives QUIZ_XP once; any run can be repeated.
// Concept checks (chapter "concept", from NN.c.json, count on the node as n.cc) work the same, saved in S.cc:
// misconception questions, plus asn (always / sometimes / never) and step (tap the first wrong line of a worked
// solution). A question's "gap" names the earlier skill behind the mistake; misses list those as weak spots.
const QUIZ_XP = 5, QUIZ_PASS = 0.8;
const QMODE = { quiz: { key: "quiz", label: "Practice", none: "No practice questions for this skill yet." },
  cc: { key: "concept", label: "Concept check", none: "No concept check for this skill yet." } };
function practiceBlock(n, st) {
  const kinds = `<div class="chips">${n.exercises.map(c => `<span class="chipx dim">${esc(c)}</span>`).join("")}</div>`;
  if (!n.quiz) return `<div style="font-weight:800;margin:12px 0 6px">Exercises <span class="tiny muted">(coming soon)</span></div>${kinds}`;
  const r = (S.quiz || {})[n.id], best = r ? `best ${r.best}/${r.of}${r.best >= Math.ceil(QUIZ_PASS * r.of) ? " ✓" : ""}` : `+${QUIZ_XP} XP at 80 %`;
  const c = (S.cc || {})[n.id], cbest = c ? `best ${c.best}/${c.of}${c.best >= Math.ceil(QUIZ_PASS * c.of) ? " ✓" : ""}` : `+${QUIZ_XP} XP at 80 %`;
  return `<div style="font-weight:800;margin:14px 0 6px">Practice <span class="tiny muted">${n.quiz} questions · ${best}</span></div>
    <button class="btn ghost" id="practice" ${st === "locked" ? "disabled" : ""} style="margin:0">🧠 ${r ? "Practise again" : "Practise"}</button>
    ${n.cc ? `<div style="font-weight:800;margin:14px 0 2px">Concept check <span class="tiny muted">${n.cc} questions · ${cbest}</span></div>
    <div class="tiny muted" style="margin-bottom:6px">Why it works, not just how: common mistakes, spot the wrong step, always or never true. Misses point to the skill to revisit.</div>
    <button class="btn ghost" id="ccheck" ${st === "locked" ? "disabled" : ""} style="margin:0">🔍 ${c ? "Check again" : "Check my understanding"}</button>` : ""}`;
}
// numbers as people type them: −3, 3/4, 1,250, 0,5, 12%, 44,240 euros
function parseNum(txt) {
  let t = String(txt).trim().replace(/[−–—]/g, "-").replace(/\s+/g, "").replace(/[%€$£]|euros?|units?/gi, "");
  if (/^-?\d+,\d{1,2}$/.test(t)) t = t.replace(",", ".");           // decimal comma
  t = t.replace(/,/g, "");                                            // thousands separators
  const f = t.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (f) return +f[2] ? +f[1] / +f[2] : NaN;
  return /^-?(\d+\.?\d*|\.\d+)$/.test(t) ? +t : NaN;
}
const numOK = (q, v) => Math.abs(v - q.a) <= (q.tol != null ? q.tol : Math.max(1e-9, Math.abs(q.a) * 0.005));
// rounded answers (feedback 11-21): 0.17 for 0.167 is the answer rounded to the decimals typed, so it counts,
// with a yellow note giving the exact value. Must also be within 5 % (so 0.00 never passes for 0.004).
const typedDecimals = raw => { const m = String(raw).trim().match(/^[^/]*[.,](\d+)\D*$/); return m ? m[1].length : 0; };
const roundsTo = (v, a, d) => d >= 1 && Math.abs(v - a) <= 0.5 * 10 ** -d + 1e-9 && Math.abs(v - a) <= Math.abs(a) * 0.05;
function numGrade(q, v, raw) {
  if (numOK(q, v)) return "ok";
  return roundsTo(v, q.a, typedDecimals(raw)) ? "close" : "no";
}
// a wrong number that matches another number in the working (the probability when the count was asked)
function numMixup(q, v, raw) {
  const d = typedDecimals(raw), ts = String(q.why).match(/\d+(?:\.\d+)?(?:\/\d+)?/g) || [];
  if (d) ts.sort((x, y) => y.includes(".") - x.includes("."));   // typed a decimal: name the decimal in the working
  return ts.find(t => { const n = parseNum(t); return !isNaN(n) && Math.abs(n - q.a) > 1e-9 && (Math.abs(v - n) <= Math.max(1e-9, Math.abs(n) * 0.005) || roundsTo(v, n, d)); });
}
async function openQuiz(br, node, only, mode = "quiz") {
  const M = QMODE[mode];
  let ch = null;
  try { ch = await loadChapter(br, node.chapter); } catch { ch = null; }
  const want = mode === "cc" ? node.cc : node.quiz;   // the skill map is newer than the saved chapter: fetch it again
  if (ch && want && (ch[M.key] || []).length !== want) { try { ch = await loadChapter(br, node.chapter, true); } catch {} }
  const QS = ch && ch[M.key];
  if (!QS || !QS.length) { toast(navigator.onLine ? M.none : "No connection, so the questions can't download right now."); return; }
  document.body.classList.add("in-lesson");
  const Q = (only || QS.map((_, i) => i)), res = [];
  const gapNode = q => q.gap && q.gap !== node.id ? C.content.nodes.find(x => x.id === q.gap) : null;
  let i = 0;
  const shuffle = a => { for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
  const draw = () => {
    const q = QS[Q[i]], pct = Math.round(100 * i / Q.length);
    const kind = q.t === "mc" ? (mode === "cc" ? "Concept check" : "Pick one") : q.t === "mf" ? "Myth or fact" : q.t === "tf" ? "True or false"
      : q.t === "asn" ? "Always, sometimes or never?" : q.t === "step" ? "Find the mistake" : "Work it out";
    let body = "";
    if (q.t === "asn") body = `<div class="opts tf asn">${["always", "sometimes", "never"].map(k => `<button class="opt" data-k="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join("")}</div>`;
    else if (q.t === "step") body = `<div class="tiny muted" style="margin:-8px 0 8px">Tap the first line that is wrong.</div>
      <div class="opts steps">${q.lines.map((l, k) => `<button class="opt stepl" data-k="${k}"><span class="sn">${k + 1}</span><span>${esc(l)}</span></button>`).join("")}</div>`;
    else if (q.t === "mc") body = `<div class="opts">${shuffle(q.o.map((o, k) => k)).map(k => `<button class="opt" data-k="${k}">${esc(q.o[k])}</button>`).join("")}</div>`;
    else if (q.t === "tf" || q.t === "mf") { const [yes, no] = q.t === "mf" ? ["Fact", "Myth"] : ["True", "False"];
      body = `<div class="opts tf"><button class="opt" data-k="1">${yes}</button><button class="opt" data-k="0">${no}</button></div>`; }
    else body = `<div class="numin"><input id="na" inputmode="decimal" autocomplete="off" placeholder="Your answer">${q.unit ? `<span class="muted">${esc(q.unit)}</span>` : ""}</div>
      <div class="numkeys" aria-label="Symbols">${[["/", "/"], ["-", "−"], [".", "."]].map(([k, l]) => `<button data-nk="${k}" aria-label="Type ${l}">${l}</button>`).join("")}</div>
      <div class="tiny muted" style="margin-top:6px">A number. Fractions like 3/4 and negatives like −2 are fine.</div>`;
    view().innerHTML = `<div class="lesson-top"><button class="x" id="qx" aria-label="Close">✕</button><div class="bar"><div style="width:${pct}%"></div></div><span class="tiny muted" style="min-width:52px;text-align:right">${i + 1} / ${Q.length}</span>${aaBtn()}</div>
      <div class="reader quiz"><div class="r-eyebrow">${node.icon} ${esc(node.title)} · ${kind}</div>
        <div class="q-title qq">${esc(q.q)}</div>${body}<div id="fb"></div></div>
      <div class="lesson-foot"><div class="row" style="gap:10px"><button class="btn ghost" id="qs" style="margin:0;width:auto;padding-left:18px;padding-right:18px">Skip</button><button class="btn grow" id="qn" ${q.t === "num" ? "" : "disabled"} style="margin:0">${q.t === "num" ? "Check" : "Choose an answer"}</button></div></div>`;
    window.scrollTo(0, 0);
    view().querySelector("#qx").onclick = () => treeView();
    const nb = view().querySelector("#qn"), fb = view().querySelector("#fb");
    const sk = view().querySelector("#qs");
    // how: "close" = right but rounded, "skip" = skipped (counts as missed); note = extra line under the verdict
    const answer = (ok, how, note) => {
      res[i] = ok; sk.remove();
      const g = !ok && gapNode(q), showA = q.t === "num" && (!ok || how === "close");
      const head = how === "skip" ? "↷ Skipped" : how === "close" ? "✓ Right, rounded" : ok ? "✓ Right" : "✗ Not quite";
      fb.innerHTML = `<div class="qfb ${how === "close" ? "close" : ok ? "ok" : "no"}"><b>${head}</b>${showA ? ` · ${how === "close" ? "exact" : "answer"}: <b>${esc(String(q.a))}${q.unit ? " " + esc(q.unit) : ""}</b>` : ""}${!ok && q.t === "step" ? ` · line ${q.a + 1} is the first wrong one` : ""}${note ? `<div class="tiny" style="margin:4px 0">${note}</div>` : ""}<div>${esc(q.why)}</div>${g ? `<div class="tiny" style="margin-top:6px">🧱 Foundation behind this: <b>${g.icon} ${esc(g.title)}</b></div>` : ""}</div>`;
      nb.disabled = false; nb.textContent = i + 1 < Q.length ? "Next ›" : "See result"; nb.onclick = () => { i++; i < Q.length ? draw() : done(); };
    };
    if (q.t === "num") {
      const inp = view().querySelector("#na"); inp.focus();
      const check = () => { const v = parseNum(inp.value); if (isNaN(v)) { inp.classList.add("shake"); setTimeout(() => inp.classList.remove("shake"), 400); return; }
        inp.disabled = true; view().querySelector(".numkeys").remove();
        const gr = numGrade(q, v, inp.value), ok = gr !== "no", mix = !ok && numMixup(q, v, inp.value);
        inp.classList.add(gr === "ok" ? "right" : gr === "close" ? "close" : "wrong");
        answer(ok, gr === "close" ? "close" : "", gr === "close" ? "Counted as right: yours is the exact value rounded. More decimals next time for full precision."
          : mix ? `Your ${esc(inp.value.trim())} matches ${esc(mix)} in the working, but the question asks for something else. Read it once more.` : ""); };
      nb.onclick = check; inp.onkeydown = e => { if (e.key === "Enter" && !inp.disabled) check(); };
      // the phone's number keypad has no "/" (and often no minus): tap these instead (feedback 11-21)
      view().querySelectorAll("[data-nk]").forEach(b => { b.onpointerdown = e => e.preventDefault();
        b.onclick = () => { const a = inp.selectionStart ?? inp.value.length, z = inp.selectionEnd ?? a;
          inp.value = inp.value.slice(0, a) + b.dataset.nk + inp.value.slice(z); inp.focus(); inp.setSelectionRange(a + 1, a + 1); }; });
      sk.onclick = () => { inp.disabled = true; view().querySelector(".numkeys").remove(); answer(false, "skip"); };
    } else view().querySelectorAll(".opt").forEach(b => (b.onclick = () => {
      if (res[i] != null) return;
      const val = o => q.t === "asn" ? o.dataset.k : +o.dataset.k;
      const k = val(b), right = q.t === "mc" || q.t === "step" || q.t === "asn" ? q.a : (q.a ? 1 : 0), ok = k === right;
      view().querySelectorAll(".opt").forEach(o => { o.disabled = true; o.classList.add(val(o) === right ? "right" : o === b ? "wrong" : "dim"); });
      answer(ok);
    }));
    if (q.t !== "num") sk.onclick = () => {                  // skip: show the right option, counts as missed
      const right = q.t === "tf" || q.t === "mf" ? (q.a ? 1 : 0) : q.a, val = o => q.t === "asn" ? o.dataset.k : +o.dataset.k;
      view().querySelectorAll(".opt").forEach(o => { o.disabled = true; o.classList.add(val(o) === right ? "right" : "dim"); });
      answer(false, "skip");
    };
  };
  const done = () => {
    const got = res.filter(Boolean).length, full = !only, wrong = Q.filter((_, k) => !res[k]);
    const SK = mode === "cc" ? "cc" : "quiz";
    S[SK] = S[SK] || {};
    const r = S[SK][node.id] || { best: 0, of: QS.length, xp: false };
    let xp = 0;
    if (full) { r.of = QS.length; r.best = Math.max(r.best, got); r.at = today();
      if (!r.xp && got >= Math.ceil(QUIZ_PASS * Q.length)) { r.xp = true; xp = QUIZ_XP; } }
    S[SK][node.id] = r;
    const gaps = {};                                    // weak spots: earlier skills behind the misses
    wrong.forEach(k => { const g = gapNode(QS[k]); if (g) gaps[g.id] = (gaps[g.id] || 0) + 1; });
    const gapIds = Object.keys(gaps).sort((a, b) => gaps[b] - gaps[a]);
    xp ? addXP(xp) : save();
    // after the practice run, go straight on to the concept check if this skill has one not done yet (feedback 11-21)
    const nextCC = mode === "quiz" && full && node.cc && !(S.cc || {})[node.id];
    view().innerHTML = `<div class="reader quiz" style="text-align:center;padding-top:40px"><div style="font-size:calc(54px*var(--fs))">${got === Q.length ? "🏆" : got >= Math.ceil(QUIZ_PASS * Q.length) ? "🎯" : "💪"}</div>
      <div class="q-title" style="margin-top:6px">${got} of ${Q.length} right</div>
      <div class="muted small">${xp ? `+${xp} XP · ${M.label.toLowerCase()} passed` : got === Q.length ? "Perfect." : wrong.length ? "Have another go at the ones you missed." : ""}</div>
      ${full && r.best ? `<div class="tiny muted" style="margin-top:6px">Your best: ${r.best}/${r.of}</div>` : ""}
      ${gapIds.length ? `<div class="card" style="text-align:left;margin-top:18px"><div style="font-weight:800">🧱 Foundations to revisit</div>
        <div class="tiny muted" style="margin:2px 0 8px">Your misses come from these earlier skills. A quick reread usually fixes the rest.</div>
        ${gapIds.map(id => { const g = C.content.nodes.find(x => x.id === id); return `<button class="partrow" data-gap="${id}"><span class="pn">${g.icon}</span><span class="grow"><b>${esc(g.title)}</b></span><span class="tiny muted">${gaps[id]} miss${gaps[id] > 1 ? "es" : ""} ›</span></button>`; }).join("")}</div>` : ""}</div>
      <div class="lesson-foot"><div class="row" style="gap:10px">${wrong.length ? `<button class="btn ghost grow" id="qr" style="margin:0">Retry ${wrong.length} missed</button>` : ""}${nextCC ? `<button class="btn grow" id="qcc" style="margin:0">Concept check ›</button>` : `<button class="btn grow" id="qb" style="margin:0">Back to the skill</button>`}</div></div>`;
    const qr = view().querySelector("#qr"); if (qr) qr.onclick = () => openQuiz(br, node, wrong, mode);
    view().querySelectorAll("[data-gap]").forEach(b => (b.onclick = () => {
      const g = C.content.nodes.find(x => x.id === b.dataset.gap), h = "#/branch/" + g.branch;
      pendingSheet = g.id; if (location.hash === h) treeView(g.branch); else location.hash = h;
    }));
    const qb = view().querySelector("#qb"); if (qb) qb.onclick = () => { treeView(); nodeSheet(node.id); };
    const qcc = view().querySelector("#qcc"); if (qcc) qcc.onclick = () => openQuiz(br, node, null, "cc");
  };
  draw();
}

// ---- in-app reader: each skill's chapter as bite-sized cards (built by tools/build_se_content.py)
// Reading is NOT bundled with the app: each chapter is a small file fetched from the Mac the first time a skill
// is opened. Over HTTPS the service worker keeps a copy (cache "a1-content-v1") so it works offline;
// learners can download a whole branch or remove downloads to free space.
const CONTENT_CACHE = "a1-content-v1";
const readingCache = {};
const chapterUrl = (br, ch) => `${br.reading}${String(ch).padStart(2, "0")}.json`;
const canDownload = () => "caches" in window && !!navigator.serviceWorker && !!navigator.serviceWorker.controller;
async function loadChapter(br, ch, fresh) {
  const u = chapterUrl(br, ch);
  if (fresh) {                  // the phone's saved copy is out of date: drop it so the next fetch goes to the server
    delete readingCache[u];
    try { if ("caches" in window) await (await caches.open(CONTENT_CACHE)).delete(new URL(u, location.href).href, { ignoreSearch: true }); } catch {}
  }
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
    view().innerHTML = `<div class="lesson-top"><button class="x" id="rx" aria-label="Close">✕</button><div class="bar"><div style="width:${pct}%"></div></div><span class="tiny muted" style="min-width:52px;text-align:right">${i - A + 1} / ${B - A + 1}</span>${aaBtn()}</div>
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
        // feedback 11-21: the skill's practice questions start by themselves (no hunting for them in the skill sheet),
        // then its concept check; only the first time (not passed yet)
        if (node.quiz && !((S.quiz || {})[node.id] || {}).xp) return openQuiz(br, node);
        if (node.cc && !(S.cc || {})[node.id]) return openQuiz(br, node, null, "cc");
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


// ------------------------------------------------------------------ Hunter System theme
function applyTheme() {
  const t = S ? S.settings.theme : (localStorage.getItem("a1.theme") || "system");
  try { localStorage.setItem("a1.theme", t); } catch { /* ignore */ }
  document.body.classList.toggle("theme-sl", t === "system" || t === "system2" || t === "system3");
  document.body.classList.toggle("theme-sl2", t === "system2");
  document.body.classList.toggle("theme-sl3", t === "system3");
  document.body.classList.toggle("theme-calm", t === "calm" || t === "ez"); // Eurozeit builds on Calm
  document.body.classList.toggle("theme-ez", t === "ez");
  applyAura(S && S.setup && !["tree", "life"].includes(courseInfo(COURSE).type) ? level(progress().total).lv : 1);
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = t === "system" || t === "system2" || t === "system3" ? "#0a0f1a" : t === "calm" ? "#f6f3ee" : t === "ez" ? "#ffffff" : "#58a700";
}
const THEMES = [["system", "⚔️ Hunter System"], ["system3", "🛡️ Hunter Mid"], ["system2", "🗡️ Hunter Simple"], ["calm", "🌿 Calm"], ["ez", "🎓 Eurozeit"], ["classic", "🟢 Classic"]];
const themeOptions = cur => THEMES.map(([v, l]) => `<option value="${v}" ${cur === v ? "selected" : ""}>${l}</option>`).join("");
// text size (feedback 11-21): one setting on this device scales every font on every page (CSS var --fs);
// reachable from Settings, the account sheet, the course picker gear and the Aa button on reading / practice screens
const FONT_SIZES = [[0.9, "Small"], [1, "Normal"], [1.15, "Large"], [1.3, "Larger"], [1.5, "Largest"]];
const fontScale = () => { try { return +localStorage.getItem("a1.fontScale") || 1; } catch { return 1; } };
const applyFont = () => document.documentElement.style.setProperty("--fs", fontScale());
const aaBtn = () => `<button class="aa" data-aa aria-label="Text size" title="Text size"><span class="aa-s">A</span><span class="aa-l">A</span></button>`;   // small A + big A = text size (feedback 11-22: plain "Aa" was easy to miss)
function fontSheet() {
  const segs = () => FONT_SIZES.map(([f, l]) => `<button data-f="${f}" class="${fontScale() === f ? "on" : ""}" aria-label="${l}" style="font-size:${Math.round(14 * f)}px">A</button>`).join("");
  sheet(`<h2 style="margin-top:0">Text size</h2><div class="segt fsz" role="group" aria-label="Text size" style="--c:var(--green)">${segs()}</div>
    <div class="tiny muted" id="fsl" style="margin:6px 0 10px">${(FONT_SIZES.find(([f]) => f === fontScale()) || [0, "Custom"])[1]} · on this device, every page</div>
    <div class="card"><div style="font-weight:800">Preview</div><p style="margin:6px 0 0">The average of many independent results gets closer to the expected value as you add more of them.</p></div>
    <button class="btn" id="ok">Done</button>`, el => {
    const wire = () => el.querySelectorAll(".fsz button").forEach(b => (b.onclick = () => {
      try { localStorage.setItem("a1.fontScale", b.dataset.f); } catch { /* private mode */ }
      applyFont(); el.querySelector(".fsz").innerHTML = segs(); el.querySelector("#fsl").textContent = FONT_SIZES.find(([f]) => f === fontScale())[1] + " · on this device, every page"; wire();
    }));
    wire(); el.querySelector("#ok").onclick = closeSheet;
  });
}
applyFont();
document.addEventListener("click", e => { if (e.target.closest("[data-aa]")) { aaHintDone(); fontSheet(); } });
// first time a text-size button shows on this device: a small "Text size" tip under it, once
const aaHintDone = () => { try { localStorage.setItem("a1.aaHint", "1"); } catch { /* ignore */ } document.querySelectorAll(".aa-tip").forEach(t => t.remove()); };
new MutationObserver(() => {
  let seen = false; try { seen = !!localStorage.getItem("a1.aaHint"); } catch { seen = true; }
  if (seen || document.querySelector(".aa-tip")) return;
  const b = document.querySelector("button.aa[data-aa]"); if (!b || !b.offsetParent) return;
  const r = b.getBoundingClientRect(), tip = document.createElement("div");
  tip.className = "aa-tip"; tip.innerHTML = "Text size: tap to make the text bigger or smaller";
  document.body.appendChild(tip);
  tip.style.top = (window.scrollY + r.bottom + 10) + "px";
  tip.style.right = Math.max(8, window.innerWidth - r.right - 6) + "px";
  tip.onclick = aaHintDone;
  setTimeout(aaHintDone, 6000);
}).observe(document.body, { childList: true, subtree: true });
const deviceTheme = () => { try { return localStorage.getItem("a1.theme") || "system"; } catch { return "system"; } };
// theme for screens without a learner (login / player picker); a learner's own theme applies after login
function themeSheet() {
  const mine = !!(S && USER); // logged in (course picker): change the learner's own theme
  sheet(`<h2 style="margin-top:0">⚙️ Settings</h2><label class="f">Theme</label><select id="dth">${themeOptions(mine ? S.settings.theme : deviceTheme())}</select>
    <button class="btn ghost" data-aa style="margin-top:10px">Aa Text size</button>
    <p class="muted small" style="margin:6px 0 12px">${mine ? "Your theme. You can also change it later in Settings." : "Used on this screen. After you log in, your own theme from Settings applies."}</p>
    ${verBox()}
    <button class="btn" id="ok">Done</button>`, el => {
    el.querySelector("#dth").onchange = e => {
      if (mine) { S.settings.theme = e.target.value; save(); } else try { localStorage.setItem("a1.theme", e.target.value); } catch { /* ignore */ }
      applyTheme();
    };
    el.querySelector("#ok").onclick = closeSheet;
  });
}
// ------------------------------------------------------------------ ranks page (tap the rank emblem)
// Same ranks for every language course: what you can do at each rank, its aura, and when you'll get there.
const RANK_INFO = {
  E: { name: "Newcomer", can: "Greet people, say goodbye, spell your name and count to 20." },
  D: { name: "Explorer", can: "Introduce yourself: your name, where you're from, your job and your age." },
  C: { name: "Speaker", can: "Talk about your family and your day, and tell the time." },
  B: { name: "Traveller", can: "Shop, order food and drink, and ask what things cost." },
  A: { name: "Local", can: "Make appointments, ask the way and fill in a simple form." },
  S: { name: "A1 Master", can: "All of A1 learned and remembered: ready for the {lang} A1 exam." },
};
const lvAtPct = p => Math.max(1, Math.floor(1 + (p * (A1_LEVEL - 1)) / 100 + 1e-9));
function ranksView() {
  const pr = progress(), pc = pace(), L = level(pr.total), cur = rank(pr.total).r, ci = RANKS.findIndex(x => x[0] === cur);
  const lang = ((C.course && C.course.title) || "A1").replace(/\s*A1$/, "");
  const when = pct => { // at your recent pace, else on your plan
    if (pc.actualPerDay > 0) return `at your pace about ${fmtDate(addDays(today(), Math.ceil((pct - pr.total) / pc.actualPerDay)))}`;
    return `on your plan ${fmtDate(addDays(S.settings.startDate, Math.round((pct / 100) * pc.span)))}`;
  };
  const rows = RANKS.map(([r, pct], i) => {
    const st = i < ci ? "done" : i === ci ? "me" : "lock", info = RANK_INFO[r];
    const tag = st === "done" ? "✓ Reached" : st === "me" ? "You are here" : `${(pct - pr.total).toFixed(1)}% of A1 to go · ${when(pct)}`;
    return `<div class="rstep ${st}">${rankEmblem(lvAtPct(pct), "md", r)}
      <div class="grow" style="min-width:0"><div class="rs-h"><b class="rk-${r}">${r}-Rank</b> · ${esc(info.name)}</div>
      <div class="rs-m">From ${pct}% of A1 · level ${lvAtPct(pct)} · Aura: ${auraName(lvAtPct(pct))}</div>
      <div class="rs-c">${esc(info.can.replace("{lang}", lang))}</div><div class="rs-t">${tag}</div></div></div>`;
  }).reverse().join("");
  view().innerHTML = `<button class="link" id="rback">‹ Back</button><h1>Ranks</h1>
    <div class="card"><div class="row" style="gap:14px">${rankEmblem(L.lv, "md", cur)}<div class="grow" style="min-width:0">
      <div style="font-size:calc(20px*var(--fs));font-weight:700">${cur}-Rank · ${esc(RANK_INFO[cur].name)}</div>
      <div class="small muted">Level ${L.lv} · ${pr.total.toFixed(1)}% of A1 · Aura: ${auraName(L.lv)}</div></div></div>
      <p class="small muted" style="margin:10px 0 0">Your rank is how much of ${esc(lang)} A1 you know: words you still remember (55%), grammar (30%) and phrases (15%). It climbs from E to S and the purple aura grows with every level. Forgotten words lower your %, so reviews keep your rank.</p></div>
    <div class="rladder">${rows}</div>`;
  view().querySelector("#rback").onclick = () => { if (window.history.length > 1) window.history.back(); else location.hash = "#/progress"; };
}
const gearBtn = () => `<button class="gear" id="gear" aria-label="Settings">⚙️</button>`;
const RANK_TITLE = { E: "E-Rank", D: "D-Rank", C: "C-Rank", B: "B-Rank", A: "A-Rank", S: "S-Rank" };
function playerBar() {
  const L = level(progress().total), rk = rank(progress().total);
  return `<div class="player sl-only"><a href="#/ranks" class="emb-link" aria-label="${RANK_TITLE[rk.r]}: see all ranks">${rankEmblem(L.lv, "sm", rk.r)}</a>
    <div class="grow"><div class="lv">Level <b>${L.lv}</b> · ${RANK_TITLE[rk.r]}</div>
    <div class="hbar" style="margin-top:4px"><div style="width:${100 * L.frac}%"></div></div>
    <div class="tiny muted" style="margin-top:2px">${L.a1 ? `A1 reached 🎓 · ${L.xpInto}/${L.xpNeed} XP to level ${L.lv + 1}` : `${L.toNext.toFixed(1)}% of A1 to level ${L.lv + 1}`}</div></div>
    <div class="stat" style="font-size:calc(18px*var(--fs))">🔥 ${streak()}</div></div>`;
}
function questStatus(due) {
  const t = today(), g = goalFor(), x = xpToday();
  const newToday = partsToday(), pg = partsGoal(); // new lesson parts today vs what the target date needs
  const revDone = S.reviews[t] || 0, revGoal = Math.min(20, due.length + revDone);
  const q = [
    { ok: x >= g, txt: `Earn ${g} XP`, v: `${x}/${g}` },
    { ok: newToday >= pg, txt: `Finish ${pg} short part${pg > 1 ? "s" : ""} of any lesson`, v: `${Math.min(newToday, pg)}/${pg}` },
    { ok: revGoal === 0 || revDone >= revGoal, txt: revGoal ? `Review all ${revGoal} words to remember` : "Review words (none due)", v: revGoal ? `${Math.min(revDone, revGoal)}/${revGoal}` : "✓" },
  ];
  return { q, all: q.every(i => i.ok), x, g };
}
// feedback 11-20: "are the daily quest targets enough to finish by the target date?" — say it on the card
function questPace(g) {
  const to = S.settings.targetDate, left = remainingXP(S);
  if (!to || left <= 0) return "";
  if (S.settings.goalMode !== "manual") return `<div class="small muted" style="text-align:center;margin-top:6px">🎯 Clearing this every day finishes A1 by <b>${fmtDate(to)}</b>, your target</div>`;
  const end = addDays(today(), Math.ceil(left / Math.max(1, g - 3)) - 1), late = daysBetween(to, end);
  return `<div class="small" style="text-align:center;margin-top:6px;color:${late > 0 ? "var(--red)" : "var(--muted)"}">🎯 At ${g} XP a day, A1 ≈ <b>${fmtDate(end, { day: "numeric", month: "short", year: "numeric" })}</b>${late > 0 ? `: ${late} days after your target. Switch to Auto in Settings to make it` : ", on time"}</div>`;
}
function dailyQuest(due) {
  const { q, all, x, g } = questStatus(due), paid = S.questDays && S.questDays[today()], hit = (S.hit || {})[today()], st = streak();
  return `<div class="card sl-only"><div class="sys-h"><span class="ex">!</span> Daily quest</div>
    <div class="small muted" style="text-align:center;margin:-4px 0 8px;letter-spacing:1px">TRAINING FOR ${esc((C.course && C.course.title) || "YOUR COURSE").toUpperCase()} HAS ARRIVED</div>
    ${q.map(i => `<div class="quest ${i.ok ? "ok" : ""}"><span class="box">${i.ok ? "✓" : ""}</span>${esc(i.txt)}<span class="v">${i.v}</span></div>`).join("")}
    ${questPace(g)}
    <div class="small" style="text-align:center;margin-top:8px;letter-spacing:1px;color:${all ? "#57e3a0" : "var(--muted)"}">
      ${all ? `QUEST COMPLETE · 💎 +${QUEST_GEMS} ${paid ? "COLLECTED" : ""}` : `REWARD: 💎 ${QUEST_GEMS}`}</div>
    ${!hit && st > 0 ? `<div class="warn-line">⚠ Reach ${g} XP today to keep your 🔥 ${st}-day streak · <b id="tleft">${leftToday()}</b> left (${Math.max(0, g - x)} XP to go)</div>`
      : !all ? `<div class="small muted" style="text-align:center;margin-top:6px">⏳ <b id="tleft">${leftToday()}</b> left today</div>` : ""}</div>`;
}
function statusWindow(pr, pc, r) {
  const L = level(pr.total), rk = rank(pr.total);
  const scores = Object.values(S.done).map(d => d.score).filter(v => v != null);
  const acc = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const nG = chaptersDone(), nP = C.content.phrases.filter(p => S.done[p.id]).length;
  return `<div class="card sl-only"><div class="sys-h">Status</div>
    <a href="#/ranks" class="emb-link big" aria-label="${RANK_TITLE[rk.r]}: see all ranks">${rankEmblem(L.lv, "big", rk.r)}<span class="emb-i">i</span></a><div class="hero-cap">${RANK_TITLE[rk.r]} · Aura: <b>${auraName(L.lv)}</b> · ${Math.round(aura(L.lv) * 100)}%${L.lv < AURA_FULL_LEVEL ? ` · full at level ${AURA_FULL_LEVEL}` : ""}</div><div style="height:12px"></div>
    <div class="row" style="margin-bottom:10px">
      <div class="grow" style="min-width:0"><div style="font-size:calc(22px*var(--fs));font-weight:700;letter-spacing:1px;overflow-wrap:anywhere">${esc(userInfo(USER).name.toUpperCase())}</div>
      <div class="muted small">${rk.next ? `Next: ${rk.next}-Rank at ${rk.nextAt}% of A1` : "Highest rank"} · <a href="#/ranks" class="link-in">All ranks ›</a></div></div>
      <div style="text-align:right"><div class="lv">Level</div><div style="font-size:calc(34px*var(--fs));font-weight:800;line-height:1;text-shadow:0 0 12px var(--accent)">${L.lv}${L.a1 ? `<div class="tiny" style="color:#57e3a0;letter-spacing:1px;margin-top:2px">A1 ✓</div>` : `<span class="muted" style="font-size:calc(14px*var(--fs))">/${A1_LEVEL}</span>`}</div></div></div>
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
      <div class="tile" style="text-align:center"><span>Total XP</span><b style="font-size:calc(30px*var(--fs))">⚡ ${totalXP()}</b></div>
      <div class="tile" style="text-align:center"><span>Diamonds</span><b style="font-size:calc(30px*var(--fs))">💎 ${S.gems || 0}</b></div></div>
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
  <b>Streak</b> = days in a row you reach your daily XP goal (with Quest Mode off: any XP that day; days before 20 Nov 2026 count with any XP). XP is added per day to your progress on the server, which also feeds the Party comparison.</p>
  <p class="small"><b>💎 Diamonds</b>: +${QUEST_GEMS} for clearing all three daily quests. Streak milestones (7, 14, 21, 30, 45, 60, 75, 90, 120, 150, 180, 365 days) give a gift box – tap it to open: Common 15–30 💎, Rare 40–80, Epic 100–180, Legendary 250–400.</p>
  <p class="small muted">XP measures effort. Your A1 % measures how much of the course you've covered.</p>
  <p class="small"><b>Level</b> follows your A1 %, not XP: level 1 at the start, <b>level 100 = A1 reached</b>: every lesson done and remembered (about one level per lesson). After that you keep levelling: every ${POST_A1_XP} XP from reviews and practice adds another level (101, 102 …). Your rank (E → S) and its purple aura grow with it.</p>
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
  <div class="card"><div class="row"><div class="grow"><div style="font-size:calc(28px*var(--fs));font-weight:900">${done.length}<span class="muted" style="font-size:calc(18px*var(--fs))"> / ${P.length}</span></div>
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
    <div class="who">${USERS.map(u => `<button data-u="${u.id}">${avatar(u.id)}<div class="grow"><div style="font-size:calc(20px*var(--fs));font-weight:800">${esc(u.name)}</div>
      <div class="muted small" data-s="${u.id}">&nbsp;</div></div><span style="font-size:calc(24px*var(--fs));color:var(--muted)">›</span></button>`).join("")}</div>`;
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
  const f = (icon, t, d) => `<div class="row" style="align-items:flex-start;gap:12px;margin:12px 0"><span style="font-size:calc(26px*var(--fs));line-height:1">${icon}</span><div class="grow"><b>${t}</b><div class="muted small">${d}</div></div></div>`;
  view().innerHTML = `${gearBtn()}<div style="text-align:center;padding-top:4vh"><img src="icons/icon.svg" alt="" width="72" height="72" style="border-radius:18px"><div class="brand">LevelUp</div>
    <h1>Level up in languages and skills</h1><p class="muted">Short daily lessons that turn into real knowledge, one level at a time.</p></div>
    <div class="card">
      ${f("📚", "Courses", "German A1 (821 words, 20 grammar chapters, everyday phrases), French A1 for the DELF A1, a Software Engineering skill tree and Mathematics. More languages and subjects are coming.")}
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
// Inside the APK the start URL carries ?src=apk (native app: ?src=native + LevelUpNative in the user agent) (and the first page has an android-app:// referrer): no download offer there.
const IN_APK = (() => {
  const hit = /[?&]src=(apk|native)\b/.test(location.search) || document.referrer.startsWith("android-app://") || /LevelUpNative\//.test(navigator.userAgent);
  try {
    const v = new URLSearchParams(location.search).get("v"); // APK version in the TWA start URL (from 11-21), for bug reports
    if (v && /[?&]src=apk\b/.test(location.search)) localStorage.setItem("a1.apkVersion", v);
  } catch { /* ignore */ }
  try { if (hit) sessionStorage.setItem("a1.apk", "1"); return hit || sessionStorage.getItem("a1.apk") === "1"; } catch { return hit; }
})();
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const IS_ANDROID = /Android/i.test(navigator.userAgent);
const standaloneApp = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const offerApk = () => !IN_APK && !IS_IOS && !standaloneApp();
// The Android app = the native app ("LevelUp"). The TWA web-wrapper APK (download/levelup.apk) is parked from 11-22:
// never linked, and the server redirects that old link to this one.
const NATIVE_APK_URL = "download/levelup-native.apk";
// Native app: when a newer APK is published (download/native.json, written by tools/android/build_native.sh), offer it
// at start. Web-only changes never trigger this: they reach the native app by themselves. Asked once per app start.
const verCode = v => { const m = String(v || "").match(/(\d{4})\.(\d{2})\.(\d{2})\.(\d{2})/); return m ? +(m[1] + m[2] + m[3] + m[4]) : 0; };
async function checkNativeUpdate() {
  const N = window.LevelUpNative;
  if (!N || !N.version) return;
  let mine = 0;
  try { mine = (N.deviceInfo && JSON.parse(N.deviceInfo()).appVersionCode) || verCode(N.version()); } catch { mine = verCode(N.version()); }
  if (!mine) return;
  const r = await fetch("download/native.json", { cache: "no-store" }).then(x => (x.ok ? x.json() : null)).catch(() => null);
  if (!r || !(r.versionCode > mine) || inLesson()) return;
  try { if (sessionStorage.getItem("a1.nativeUpd") === String(r.versionCode)) return; sessionStorage.setItem("a1.nativeUpd", String(r.versionCode)); } catch { /* ignore */ }
  // its own overlay (not sheet()): route() closes sheets, and start-up routes more than once
  const box = document.createElement("div");
  box.id = "upd-root";
  box.innerHTML = `<div class="sheet-bg"><div class="sheet"><h2 style="margin-top:0">🚀 Update available</h2>
    <p>A new version of LevelUp is ready: <b>${esc(String(r.versionName).replace(/-native.*$/, ""))}</b> (you have ${esc(String(N.version()).replace(/-native.*$/, ""))}).</p>
    ${r.notes ? `<p class="small">${esc(r.notes)}</p>` : ""}
    <p class="muted small">Tap Update, open the downloaded file and tap Install. Your progress stays: it's saved on your account.</p>
    <button class="btn" id="upd">Update now</button><button class="btn ghost" id="later" style="margin-top:8px">Later</button></div></div>`;
  document.body.appendChild(box);
  const close = () => box.remove();
  box.querySelector("#upd").onclick = () => { N.openExternal(new URL(r.url || NATIVE_APK_URL, location.href).href); close(); };
  box.querySelector("#later").onclick = close;
  box.querySelector(".sheet-bg").onclick = e => { if (e.target === e.currentTarget) close(); };
}
// installed versions (feedback 11-22: "show the installed app version so I can check I have the latest").
// <div data-ver></div> anywhere is filled in: Android app (native) with the latest published one, web app, offline cache.
const verBox = () => `<div class="verbox tiny muted" data-ver>Checking version…</div>`;
async function fillVersions(root = document) {
  const boxes = [...root.querySelectorAll("[data-ver]:not([data-filled])")]; if (!boxes.length) return;
  boxes.forEach(b => b.setAttribute("data-filled", ""));
  const N = window.LevelUpNative, rows = [];
  let mineCode = 0, mineName = "";
  if (N && N.version) {
    try { mineName = String(N.version()).replace(/-native.*$/, ""); mineCode = (N.deviceInfo && JSON.parse(N.deviceInfo()).appVersionCode) || verCode(mineName); } catch { mineCode = verCode(mineName); }
    const r = await fetch("download/native.json", { cache: "no-store" }).then(x => (x.ok ? x.json() : null)).catch(() => null);
    const latest = r && r.versionCode > mineCode;
    rows.push(`📱 Android app: <b>${esc(mineName)}</b> ${r ? (latest ? `· <span style="color:var(--red)">new version ${esc(String(r.versionName).replace(/-native.*$/, ""))} available</span> <button class="link" data-verupd style="padding:0">Update</button>` : `· <span style="color:var(--green)">latest ✓</span>`) : ""}`);
  }
  const web = window.__luVersion || await fetch("api/health", { cache: "no-store" }).then(x => (x.ok ? x.json() : null)).then(j => j && j.version).catch(() => null);
  if (web) rows.push(`🌐 Web app: <b>${esc(web)}</b>`);
  try { const k = (await caches.keys()).find(x => /^a1-shell-v\d+$/.test(x)); if (k) rows.push(`💾 Offline copy: ${esc(k.replace("a1-shell-", ""))}`); } catch { /* no cache API over http */ }
  boxes.forEach(b => {
    b.innerHTML = rows.map(x => `<div>${x}</div>`).join("");
    const u = b.querySelector("[data-verupd]");
    if (u) u.onclick = async () => { const r = await fetch("download/native.json", { cache: "no-store" }).then(x => x.json()).catch(() => null);
      N.openExternal(new URL((r && r.url) || NATIVE_APK_URL, location.href).href); };
  });
}
new MutationObserver(() => { if (document.querySelector("[data-ver]:not([data-filled])")) fillVersions(); }).observe(document.body, { childList: true, subtree: true });
// iPhone: no APK, but Safari's "Add to Home Screen" installs LevelUp as a full-screen app (iosSheet explains it)
const offerIos = () => IS_IOS && !standaloneApp();
const IOS_GUIDE = "download/levelup-iphone-guide.pdf";
const apkBtn = (cls = "btn ghost", style = "") => offerApk() ? `<button class="${cls}" type="button" data-apk style="${style}">📱 Download the Android app</button>`
  : offerIos() ? `<button class="${cls}" type="button" data-ios style="${style}">📱 Add LevelUp to your home screen</button>` : "";
const apkHidden = () => { try { return !!localStorage.getItem("a1.apkHide"); } catch { return false; } };
const apkBanner = () => offerApk() && IS_ANDROID && !apkHidden() ? `<div class="card row" id="apkb" style="gap:10px;align-items:center;padding:10px 12px">
  <span style="font-size:calc(24px*var(--fs))">📱</span><div class="grow"><b>Get the LevelUp app</b><div class="muted small">Full screen, own icon, opens straight into your lessons.</div></div>
  <button class="btn sm" type="button" data-apk style="width:auto;margin:0">Get it</button><button class="link" id="apkx" aria-label="Hide" style="font-size:calc(18px*var(--fs));padding:4px">✕</button></div>`
  : offerIos() && !apkHidden() ? `<div class="card row" id="apkb" style="gap:10px;align-items:center;padding:10px 12px">
  <span style="font-size:calc(24px*var(--fs))">📱</span><div class="grow"><b>Get the LevelUp app</b><div class="muted small">Add it to your home screen: full screen, own icon.</div></div>
  <button class="btn sm" type="button" data-ios style="width:auto;margin:0">How</button><button class="link" id="apkx" aria-label="Hide" style="font-size:calc(18px*var(--fs));padding:4px">✕</button></div>` : "";
function wireApk(root = view()) {
  root.querySelectorAll("[data-apk]").forEach(b => (b.onclick = apkSheet));
  root.querySelectorAll("[data-ios]").forEach(b => (b.onclick = iosSheet));
  const x = root.querySelector("#apkx");
  if (x) x.onclick = () => { try { localStorage.setItem("a1.apkHide", "1"); } catch { /* ignore */ } root.querySelector("#apkb")?.remove(); toast("You can still get the app in Settings"); };
}
const SHARE_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" style="vertical-align:-3px" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10H6v11h12V10h-2"/><path d="M12 15V3M8 7l4-4 4 4"/></svg>`;
function iosSheet() {
  const notSafari = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(navigator.userAgent);
  sheet(`<h2 style="margin-top:0">📱 LevelUp on iPhone</h2>
    <p class="muted small" style="margin-top:0">iPhones install LevelUp from Safari. It gets its own icon, opens full screen and keeps your progress.</p>
    ${notSafari ? `<div class="note">You're not in Safari. Open <b>levelrise.org</b> in <b>Safari</b> first, then follow the steps.</div>` : ""}
    <ol class="small" style="padding-left:20px;line-height:1.6">
      <li>Tap the <b>Share</b> button ${SHARE_ICON} in Safari's bar. On iOS 26, tap <b>•••</b> first, then <b>Share</b>.</li>
      <li>Scroll down and tap <b>Add to Home Screen</b>. If you don't see it, tap <b>View More</b>.</li>
      <li>Keep <b>Open as Web App</b> on (if shown) and tap <b>Add</b>.</li>
      <li>Open <b>LevelUp</b> from your home screen and log in once.</li>
    </ol>
    <a class="btn ghost" href="${IOS_GUIDE}" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none">🖼️ Guide with pictures (PDF)</a>
    <button class="btn" type="button" id="iosc">Got it</button>`, el => { el.querySelector("#iosc").onclick = closeSheet; });
}
function apkSheet() {
  const appUrl = "https://levelrise.org";
  sheet(`<h2 style="margin-top:0">📱 LevelUp for Android</h2>
    ${IS_ANDROID ? "" : `<p class="note">This is an Android app. Open <b>${appUrl}</b> on your Android phone to install it there (or download it here and copy it over).</p>`}
    <ol class="small" style="padding-left:20px;line-height:1.5">
      <li>Tap <b>Download</b>. Chrome may warn that the file could be harmful: tap <b>Download anyway</b>. (It's only the LevelUp app, not from the Play Store yet.)</li>
      <li>Open the downloaded <b>LevelUp.apk</b>. Android asks to allow <b>Install unknown apps</b> for Chrome: turn it on, go back, tap <b>Install</b>.</li>
      <li>If Play Protect asks to scan the app, let it, then tap <b>Install anyway</b>.</li>
      <li>Open LevelUp from your home screen and log in once. Your progress is the same as on the website.</li>
    </ol>
    <p class="muted small">Needs Android 7 or newer. Lessons update by themselves; when a new app version is out, the app offers it at start.</p>
    <a class="btn" href="${NATIVE_APK_URL}" download="LevelUp.apk" id="apkdl" style="display:block;text-align:center;text-decoration:none">Download (about 3 MB)</a>
    <button class="btn ghost" type="button" id="apkc">Close</button>`, el => {
    el.querySelector("#apkc").onclick = closeSheet;
    el.querySelector("#apkdl").onclick = () => setTimeout(() => toast("Downloading… open it from your notifications"), 300);
  });
}
// sent with every invite (WhatsApp etc. put it above the link; the link preview comes from the og: tags in index.html)
const SHARE_TEXT = "LevelUp was made to learn German faster, because the usual apps felt too slow. It uses active recall: each word comes back for a quick test right before you'd forget it, timed by spaced-repetition research. And it's fast: no slow animations, no ads, no complicated reward system. Just short lessons that stick. Join me!";
async function shareApp() {
  const url = location.origin + location.pathname.replace(/index\.html$/, "");
  // all links sit inside the text (no separate url field, so apps don't add it twice); the first link gives WhatsApp's preview
  // card. The iOS PDF is a link, not an attachment (WhatsApp drops the text when a file rides along).
  const text = `${SHARE_TEXT}\n\n🌐 Web app (any phone or computer, nothing to install): ${url}\n📱 Android app (LevelUp, install the APK): ${new URL(NATIVE_APK_URL, url).href}`
    + `\n🍎 iOS instructions (iPhone): open the link in Safari, tap Share, then "Add to Home Screen". Download the picture guide (PDF): ${new URL(IOS_GUIDE, url).href}`;
  try { if (navigator.share) { await navigator.share({ title: "LevelUp", text }); return; } }
  catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(text); toast("Invite message copied"); }
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
      <div class="grow"><div style="font-size:calc(18px*var(--fs));font-weight:800">${esc(userInfo(USER).name)}</div><div class="muted small">Logged in as ${esc(USER)}</div></div></button></div>
    <button class="btn ghost" id="inv">🎁 Share / invite</button><button class="btn ghost" data-aa>Aa Text size</button><button class="btn ghost" data-guide>📘 How LevelUp works</button><button class="btn ghost" data-tour>🧭 Welcome tour</button><button class="btn ghost" id="pw">Change password</button><button class="btn" id="lo">Log out</button>${verBox()}`, el => {
    el.querySelector("#inv").onclick = shareApp;
    el.querySelector("#pw").onclick = passwordSheet;
    el.querySelector("#lo").onclick = doLogout;
  });
  sheet(`<h2 style="margin-top:0">Switch learner</h2><div class="who" style="margin-top:8px">${USERS.map(u => `<button data-u="${u.id}">${avatar(u.id)}
    <div class="grow"><div style="font-size:calc(18px*var(--fs));font-weight:800">${esc(u.name)}</div><div class="muted small">${u.id === USER ? "Current" : "Tap to switch"}</div></div>
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
  if (!box) return;
  const all = await fetchAllStates();                       // the server returns you and your party members only
  all[USER] = S; // always show the freshest local numbers for the current user
  const people = Object.keys(all).map(id => USERS.find(u => u.id === id) || { id, name: id, color: "#888" });
  if (people.length < 2) return;                          // keep the "when someone joins" hint
  if (courseInfo(COURSE).type === "tree") return treeCompare(box, people, all);
  if (courseInfo(COURSE).type === "life") return lifeCompare(box, people, all);
  const rows = people.map(u => ({ u, s: summary(all[u.id]) }));
  const best = k => Math.max(...rows.map(r => (r.s ? r.s[k] : -1)));
  const cell = (r, k, fmt) => !r.s ? `<td class="muted">–</td>` : `<td class="${r.s[k] === best(k) && best(k) > 0 ? "lead" : ""}"><b>${fmt(r.s[k], r.s)}</b></td>`;
  const pacefmt = (g) => Math.abs(g) < 1 ? "on track" : g > 0 ? `+${Math.round(g)}` : `${Math.round(g)}`;
  box.innerHTML = `<div class="card"><div class="sys-h">Party</div><div style="font-weight:800;margin-bottom:6px">👥 ${people.map(u => esc(u.name)).join(" & ")}</div>
    <table class="cmp"><tr><th></th>${rows.map(r => `<th>${avatar(r.u.id, true)}<div class="tiny">${esc(r.u.name)}</div></th>`).join("")}</tr>
    <tr class="sl-only-row"><td>Level · Rank</td>${rows.map(r => !r.s ? `<td class="muted">–</td>` : `<td><b>Lv ${r.s.lv}</b> <span class="rank ${r.s.rank}" style="display:inline-grid;width:24px;height:24px;font-size:calc(14px*var(--fs));border-width:1.5px;vertical-align:middle">${r.s.rank}</span></td>`).join("")}</tr>
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

// ------------------------------------------------------------------ stories (feedback mazhar-02ba)
// Optional listening practice for German: no XP, no effect on course progress. data/stories.json is built by
// tools/build_stories.py. A story unlocks at minWords learned words. Flow: new words -> listen (no text) ->
// questions (replay the line after a miss) -> transcript. S.stories[id] = {best, of, at, plays}.
let STORIES = null;
async function loadStories() {
  if (STORIES) return STORIES;
  try { STORIES = (await (await fetch("data/stories.json")).json()).stories; } catch { STORIES = []; }
  return STORIES;
}
const wordsKnown = () => Object.keys(S.words || {}).length;
async function appendStories() {
  if (C.course.id !== "de-a1") return;
  const box = document.createElement("div"); view().appendChild(box);
  const st = await loadStories(); if (!st.length || !box.isConnected) return;
  const open = st.filter(x => wordsKnown() >= x.minWords), next = st.find(x => wordsKnown() < x.minWords);
  const fresh = open.filter(x => !(S.stories || {})[x.id]);
  box.innerHTML = `<button class="card partylink" id="stc"><span style="font-size:calc(28px*var(--fs))">🎧</span><span class="grow"><b>Stories</b>
    <div class="tiny muted">${open.length ? `${open.length} of ${st.length} open${fresh.length ? ` · ${fresh.length} new` : ""} · optional listening practice` : `First story unlocks at ${st[0].minWords} words (you know ${wordsKnown()})`}</div></span>
    ${fresh.length ? `<span class="pbadge">${fresh.length}</span>` : ""}<span>›</span></button>`;
  box.querySelector("#stc").onclick = () => (location.hash = "#/stories");
}
async function storiesView() {
  const st = await loadStories(), n = wordsKnown(), done = S.stories || {};
  view().innerHTML = `<div class="row"><h1 class="grow">🎧 Stories</h1>${userChip()}</div>
    <p class="muted small" style="margin-top:0">Short scenes to train your ear. Listen first without the text, answer a few questions, then read along. Optional: no XP, and your course progress doesn't change.</p>
    ${st.map(x => { const open = n >= x.minWords, r = done[x.id];
      return `<button class="card storyrow ${open ? "" : "locked"}" data-s="${x.id}" ${open ? "" : "disabled"}><span class="sc">${open ? x.scene : "🔒"}</span>
        <span class="grow"><b>${esc(x.title)}</b><div class="tiny muted">${esc(x.titleEn)} · ${x.lines.length} lines</div>
        <div class="tiny ${open ? "muted" : ""}">${open ? (r ? `✓ Best ${r.best}/${r.of}` : "New") : `Unlocks at ${x.minWords} words · ${x.minWords - n} to go`}</div></span>${open ? "<span>›</span>" : ""}</button>`; }).join("")}`;
  view().querySelectorAll("[data-s]").forEach(b => (b.onclick = () => (location.hash = "#/story/" + b.dataset.s)));
  wireTop();
}
async function storyView(id) {
  const st = await loadStories(), x = st.find(y => y.id === id);
  if (!x || wordsKnown() < x.minWords) { location.hash = "#/stories"; return; }
  document.body.classList.add("in-lesson");
  const el = new Audio(); let slow = false, playing = false, plays = 0, stopFlag = 0;
  const stopPlay = () => { stopFlag++; el.pause(); playing = false; };
  const clip = (a, onEnd) => { el.onended = onEnd; el.onerror = onEnd; el.src = `audio/${a}.mp3`; el.play().catch(onEnd); };
  const playLines = (idxs, onLine, onDone) => {           // play lines in order with natural pauses
    stopPlay(); stopAudio(); const my = ++stopFlag; playing = true; let k = 0;
    const step = () => { if (my !== stopFlag) return; if (k >= idxs.length) { playing = false; return onDone && onDone(); }
      const i = idxs[k], ln = x.lines[i]; onLine && onLine(i, k);
      clip(slow ? ln.s : ln.a, () => { if (my !== stopFlag) return; const nxt = x.lines[idxs[k + 1]]; k++;
        setTimeout(step, !nxt ? 0 : nxt.sp === ln.sp ? 450 : 750); }); };
    step();
  };
  const top = (pct, label) => `<div class="lesson-top"><button class="x" id="sx" aria-label="Close">✕</button><div class="bar"><div style="width:${pct}%"></div></div><span class="tiny muted" style="min-width:52px;text-align:right">${label}</span>${aaBtn()}</div>`;
  const leave = () => { stopPlay(); location.hash = "#/stories"; };
  const wireX = () => (view().querySelector("#sx").onclick = leave);
  // 1. scene + new words
  const intro = () => {
    view().innerHTML = top(5, "1 / 4") + `<div class="reader story"><div style="font-size:calc(56px*var(--fs));text-align:center">${x.scene}</div>
      <div class="q-title" style="text-align:center">${esc(x.title)}</div><div class="muted" style="text-align:center">${esc(x.titleEn)}</div>
      ${x.pre.length ? `<div class="sys-h" style="margin-top:18px">New words first</div>${x.pre.map((w, i) => `<button class="card stword" data-w="${i}"><span>🔊</span><span class="grow"><b>${esc(w.de)}</b><div class="small muted">${esc(w.en)}</div></span></button>`).join("")}`
        : `<p class="muted small" style="text-align:center;margin-top:18px">You know every word in this story.</p>`}
      <p class="muted small" style="margin-top:14px">Next you'll hear the story without the text. Listen for who, what, when and how much.</p></div>
      <div class="lesson-foot"><button class="btn" id="go" style="margin:0">🎧 Listen</button></div>`;
    view().querySelectorAll("[data-w]").forEach(b => (b.onclick = () => play(x.pre[+b.dataset.w].a, x.pre[+b.dataset.w].de)));
    view().querySelector("#go").onclick = listen; wireX();
  };
  // 2. listen without text
  const listen = () => {
    view().innerHTML = top(30, "2 / 4") + `<div class="reader story" style="text-align:center"><div style="font-size:calc(56px*var(--fs))">${x.scene}</div>
      <div class="q-title">Listen</div><div class="muted small">No text yet. Play it as often as you like.</div>
      <button class="playbig" id="pl" aria-label="Play the story">▶</button><div class="tiny muted" id="pos">${x.lines.length} lines</div>
      <label class="slowtog"><input type="checkbox" id="slow" ${slow ? "checked" : ""}> 🐢 Slow</label></div>
      <div class="lesson-foot"><button class="btn" id="go" style="margin:0" ${plays ? "" : "disabled"}>Questions ›</button></div>`;
    const pl = view().querySelector("#pl"), pos = view().querySelector("#pos"), go = view().querySelector("#go");
    view().querySelector("#slow").onchange = e => { slow = e.target.checked; };
    pl.onclick = () => { if (playing) { stopPlay(); pl.textContent = "▶"; return; }
      pl.textContent = "■"; playLines(x.lines.map((_, i) => i), (i, k) => (pos.textContent = `line ${k + 1} of ${x.lines.length}`),
        () => { plays++; pl.textContent = "↻"; pos.textContent = `played ${plays}×`; go.disabled = false; }); };
    go.onclick = () => { stopPlay(); ask(0, []); }; wireX();
  };
  // 3. questions
  const ask = (k, res) => {
    if (k >= x.q.length) return transcript(res);
    const q = x.q[k], right = q.t === "mc" ? q.a : (q.a ? 1 : 0);
    const opts = q.t === "mc" ? q.o.map((o, i) => [i, o]) : [[1, "True"], [0, "False"]];
    view().innerHTML = top(45 + 35 * k / x.q.length, "3 / 4") + `<div class="reader quiz"><div class="r-eyebrow">${x.scene} ${esc(x.title)} · question ${k + 1} of ${x.q.length}</div>
      <div class="q-title qq">${esc(q.q)}</div><div class="opts ${q.t === "tf" ? "tf" : ""}">${opts.map(([i, o]) => `<button class="opt" data-k="${i}">${esc(o)}</button>`).join("")}</div><div id="fb"></div></div>
      <div class="lesson-foot"><button class="btn" id="qn" disabled style="margin:0">Choose an answer</button></div>`;
    const nb = view().querySelector("#qn");
    view().querySelectorAll(".opt").forEach(b => (b.onclick = () => {
      if (res[k] != null) return;
      const ok = +b.dataset.k === right; res[k] = ok;
      view().querySelectorAll(".opt").forEach(o => { o.disabled = true; o.classList.add(+o.dataset.k === right ? "right" : o === b ? "wrong" : "dim"); });
      const ln = x.lines[q.line];
      view().querySelector("#fb").innerHTML = `<div class="qfb ${ok ? "ok" : "no"}"><b>${ok ? "✓ Right" : "✗ Not quite"}</b>
        ${ok ? "" : `<div><button class="btn ghost sm" id="hear">🔊 Hear that part</button></div>`}</div>`;
      const h = view().querySelector("#hear"); if (h) h.onclick = () => playLines([q.line]);
      if (!ok) playLines([q.line]);
      nb.disabled = false; nb.textContent = k + 1 < x.q.length ? "Next ›" : "Read along ›";
      nb.onclick = () => { stopPlay(); ask(k + 1, res); };
    }));
    wireX();
  };
  // 4. transcript + result (no XP)
  const transcript = res => {
    const got = res.filter(Boolean).length;
    S.stories = S.stories || {}; const r = S.stories[x.id] || { best: 0, of: x.q.length, plays: 0 };
    r.best = Math.max(r.best, got); r.of = x.q.length; r.at = today(); r.plays += plays; S.stories[x.id] = r; save();
    view().innerHTML = top(100, "4 / 4") + `<div class="reader story"><div class="q-title">${got} of ${x.q.length} right ${got === x.q.length ? "🏆" : ""}</div>
      <div class="row" style="justify-content:space-between;align-items:center"><div class="muted small">Now read along. Tap a line to hear it again.</div><label class="slowtog" style="margin:0"><input type="checkbox" id="slow" ${slow ? "checked" : ""}> 🐢</label></div>
      <div class="tlines">${x.lines.map((l, i) => `<button class="tline" data-l="${i}"><span class="tiny muted">${esc(l.sp)}</span><div><b>${esc(l.de)}</b></div><div class="small muted">${esc(l.en)}</div></button>`).join("")}</div></div>
      <div class="lesson-foot"><div class="row" style="gap:10px"><button class="btn ghost grow" id="pa" style="margin:0">▶ Play all</button><button class="btn grow" id="dn" style="margin:0">Done</button></div></div>`;
    const mark = i => view().querySelectorAll(".tline").forEach(t => t.classList.toggle("on", +t.dataset.l === i));
    view().querySelectorAll(".tline").forEach(t => (t.onclick = () => playLines([+t.dataset.l], mark, () => mark(-1))));
    view().querySelector("#slow").onchange = e => { slow = e.target.checked; };
    view().querySelector("#pa").onclick = () => playLines(x.lines.map((_, i) => i), mark, () => mark(-1));
    view().querySelector("#dn").onclick = leave; wireX();
  };
  intro();
}

// ------------------------------------------------------------------ party (feedback mazhar-2c70)
// Parties live on the server (api/parties): up to 10 learners; join by request, any member accepts.
// The Party tab shows your party (members, requests, comparison) or every party with "Request to join".
let PARTY = null;
async function partyApi(path = "", body, method = "POST") {
  const r = await fetch("api/parties" + path, body === undefined && method === "GET" ? { cache: "no-store" } : { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `error ${r.status}`);
  return j;
}
const partyOK = () => AUTH === "on" && !isGuest();
async function refreshParty() {
  if (!partyOK()) return null;
  try { PARTY = await partyApi("", undefined, "GET"); } catch { return PARTY; }
  const reqs = PARTY.mine ? PARTY.mine.requests : [];
  document.querySelectorAll('#tabs a[data-tab="party"] .pbadge').forEach(b => { b.textContent = reqs.length || ""; b.hidden = !reqs.length; });
  const key = `a1.partySeen.${USER}`, seen = (() => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } })();
  const fresh = reqs.filter(r => !seen.includes(r.id + r.at));
  if (fresh.length && location.hash !== "#/party") toast(`👥 ${fresh.map(r => r.name).join(", ")} ${fresh.length > 1 ? "want" : "wants"} to join ${PARTY.mine.name}. Open Party to accept.`);
  try { localStorage.setItem(key, JSON.stringify(reqs.map(r => r.id + r.at))); } catch { /* ignore */ }
  return PARTY;
}
async function partyView() {
  const tree = courseInfo(COURSE).type === "tree";
  if (tree) document.body.classList.add("in-lesson");
  const head = `${tree ? `<button class="link" id="pback">‹ ${esc(C.course.title)}</button>` : ""}<div class="row"><h1 class="grow">Party</h1>${userChip()}</div>`;
  if (!partyOK()) { view().innerHTML = head + `<div class="card"><p>Parties need an account, so your party can see your progress.</p>${isGuest() ? `<p class="muted small">You are using LevelUp as a guest. Sign up to join a party; your progress comes with you.</p>` : ""}</div>`; wirePartyTop(); return; }
  view().innerHTML = head + `<div class="loading">Loading parties…</div>`; wirePartyTop();
  let P;
  try { P = await refreshParty(); if (!P) throw new Error(); } catch { view().innerHTML = head + `<div class="card">Couldn't load parties. Check your connection and try again.</div>`; wirePartyTop(); return; }
  const act = async (fn, okMsg) => { try { await fn(); if (okMsg) toast(okMsg); } catch (e) { toast(e.message); } partyView(); };
  if (P.mine) {
    const m = P.mine;
    view().innerHTML = head + `<div class="card"><div class="sys-h">Your party</div><div style="font-size:calc(20px*var(--fs));font-weight:800">👥 ${esc(m.name)}</div>
        <div class="tiny muted">${m.members.length} of ${P.max} members · any member can accept new people</div>
        <div class="pmembers">${m.members.map(x => `<span class="pmem">${avatar(x.id, true)}<span>${esc(x.name)}${x.id === USER ? " (you)" : ""}</span></span>`).join("")}</div></div>
      ${m.requests.length ? `<div class="card"><div class="sys-h">Join requests <span class="pbadge inl">${m.requests.length}</span></div>${m.requests.map(r => `<div class="preq"><span class="grow"><b>${esc(r.name)}</b><div class="tiny muted">asked ${fmtDate(r.at.slice(0, 10))}</div></span>
          <button class="btn sm" data-acc="${r.id}" ${m.members.length >= P.max ? "disabled" : ""}>Accept</button><button class="btn ghost sm" data-dec="${r.id}">Decline</button></div>`).join("")}</div>` : ""}
      <div id="cmp"></div>
      <button class="link" id="leave" style="margin-top:6px">Leave ${esc(m.name)}</button>`;
    view().querySelectorAll("[data-acc]").forEach(b => (b.onclick = () => act(() => partyApi(`/${m.id}/accept`, { uid: b.dataset.acc }), "Accepted. Welcome to the party!")));
    view().querySelectorAll("[data-dec]").forEach(b => (b.onclick = () => act(() => partyApi(`/${m.id}/decline`, { uid: b.dataset.dec }))));
    view().querySelector("#leave").onclick = () => sheet(`<h2 style="margin-top:0">Leave ${esc(m.name)}?</h2><p class="muted">You'll stop seeing each other's progress. You can ask to join again later.</p>
      <button class="btn" id="ly">Leave the party</button><button class="btn ghost" id="ln">Stay</button>`, el => {
        el.querySelector("#ln").onclick = closeSheet;
        el.querySelector("#ly").onclick = () => { closeSheet(); act(() => partyApi(`/${m.id}/leave`), `You left ${m.name}.`); };
      });
    wirePartyTop(); fillCompare();
    if (m.members.length < 2) view().querySelector("#cmp").innerHTML = `<div class="card muted small">When someone joins, you'll compare XP, streaks and progress here. Tell friends to open Party and request to join <b>${esc(m.name)}</b>.</div>`;
    return;
  }
  view().innerHTML = head + `<p class="muted small" style="margin-top:0">A party is up to ${P.max} learners who see each other's progress. Ask to join one; any member can let you in. Or start your own.</p>
    <div class="sec-h">Parties</div>
    ${P.parties.length ? P.parties.map(p => `<div class="card prow"><span class="grow"><b>👥 ${esc(p.name)}</b><div class="tiny muted">${p.count} of ${P.max} members${p.full ? " · full" : ""}</div></span>
      ${p.requested ? `<button class="btn ghost sm" data-can="${p.id}">Requested · cancel</button>` : `<button class="btn sm" data-req="${p.id}" ${p.full ? "disabled" : ""}>Request to join</button>`}</div>`).join("") : `<div class="card muted small">No parties yet. Start the first one.</div>`}
    <div class="sec-h">Start a party</div>
    <div class="card"><input id="pname" maxlength="40" placeholder="Party name, e.g. Family" style="width:100%;font:inherit;padding:10px 12px;border-radius:10px;border:2px solid var(--line);background:var(--card);color:var(--ink)">
      <button class="btn" id="pnew" style="margin-top:10px">Start party</button></div>`;
  view().querySelectorAll("[data-req]").forEach(b => (b.onclick = () => act(() => partyApi(`/${b.dataset.req}/request`), "Request sent. A member will let you in.")));
  view().querySelectorAll("[data-can]").forEach(b => (b.onclick = () => act(() => partyApi(`/${b.dataset.can}/cancel`))));
  view().querySelector("#pnew").onclick = () => { const n = view().querySelector("#pname").value.trim(); if (n.length < 2) return toast("Give your party a name (2+ letters)."); act(() => partyApi("", { name: n }), `${n} started. Invite people to request to join.`); };
  wirePartyTop();
}
function wirePartyTop() {
  const b = view().querySelector("#pback"); if (b) b.onclick = () => (location.hash = "#/today");
  wireTop();
}
function treeCompare(box, people, all) {
  const row = id => { const st = all[id] || {}, t = today(); return { xp: Object.values(st.xp || {}).reduce((a, b) => a + b, 0), today: (st.xp || {})[t] || 0,
    skills: Object.keys(st.tree || {}).length, practice: Object.values(st.quiz || {}).filter(q => q.xp).length }; };
  const rows = people.map(u => ({ u, s: row(u.id) })), best = k => Math.max(...rows.map(r => r.s[k]));
  const cell = (r, k) => `<td class="${r.s[k] === best(k) && best(k) > 0 ? "lead" : ""}"><b>${r.s[k]}</b></td>`;
  box.innerHTML = `<div class="card"><div class="sys-h">${esc(C.course.title)}</div><table class="cmp"><tr><th></th>${rows.map(r => `<th>${avatar(r.u.id, true)}<div class="tiny">${esc(r.u.name)}</div></th>`).join("")}</tr>
    <tr><td>XP today</td>${rows.map(r => cell(r, "today")).join("")}</tr><tr><td>Total XP</td>${rows.map(r => cell(r, "xp")).join("")}</tr>
    <tr><td>Skills learned</td>${rows.map(r => cell(r, "skills")).join("")}</tr><tr><td>Practice passed</td>${rows.map(r => cell(r, "practice")).join("")}</tr></table></div>`;
}

// ------------------------------------------------------------------ boot
["gesturestart", "gesturechange"].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false })); // iOS pinch
(async function boot() {
  installBugButton();   // first, so it works even if loading fails
  applyTheme();
  startTimeTracking();
  setNextHook(() => { // finish screen "Next part": alternate lessons in Quest Mode
    if (!questMode()) return null;
    const it = nextPick(); if (!it) return null;
    return { label: `${itemName(it)}${bitCount(it) > 1 ? ` · part ${Math.min(bitsDone(it) + 1, bitCount(it))} of ${bitCount(it)}` : ""}`, go: () => startItem(it) };
  });
  await loadCourses();
  await checkAuth();
  await loadUsers();
  const startCourse = (USER && lastCourse(USER)) || COURSE;
  setCourse(courseInfo(startCourse).status === "ready" ? startCourse : COURSE);
  try { await loadContent(); } catch (e) { view().innerHTML = `<div class="loading">Could not load lessons. Check your internet connection, then reload.</div>`; return; }
  if (USER) await switchUser(USER);
  refreshParty(); setInterval(() => USER && refreshParty(), 5 * 60 * 1000);
  window.addEventListener("hashchange", route);
  window.addEventListener("popstate", onPopState);
  armBack();
  window.addEventListener("a1:state-replaced", () => { if (!inLesson()) route(); });
  window.addEventListener("a1:auth", async () => { // session expired or revoked: progress stays cached on this device
    if (inLesson()) return;
    if (await checkAuth() === "on" && !localStorage.getItem("a1.user")) { signOut(); toast("Please log in again"); route(); }
  });
  window.addEventListener("a1:sync", () => { const e = document.getElementById("syncst"); if (e) e.textContent = syncText(); });
  // Android resumes the app without reloading, so after a deploy it kept running old code. Remember the server version
  // at start; when the app comes back to the front and the server has a newer one, reload (never mid-lesson or with a sheet open).
  const serverVersion = () => fetch("api/health", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(j => j && j.version || null).catch(() => null);
  let bootVersion = null;
  serverVersion().then(v => { bootVersion = v; window.__luVersion = v; }); // __luVersion: in bug reports
  async function reloadIfUpdated() {
    const v = await serverVersion();
    if (!v) return false;
    if (!bootVersion) { bootVersion = v; return false; }
    if (v === bootVersion || inLesson() || sheetRoot().innerHTML) return false;
    try { if (sessionStorage.getItem("a1.reloadedFor") === v) return false; sessionStorage.setItem("a1.reloadedFor", v); } catch { /* ignore */ }
    location.reload();
    return true;
  }
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState !== "visible" || inLesson()) return;
    if (await reloadIfUpdated()) return;
    if (await refreshFromServer()) route();
  });
  route();
  checkNativeUpdate();
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();

// ------------------------------------------------------------------ home-screen widgets (native app only)
// The native app's widgets read one snapshot of today's state, sent here after every save, sync and route change.
// Widgets compute only time-based states themselves (time left, streak at risk after 20:00, stale, new day).
// Field list: docs/design/widgets/README.md (WidgetSnapshot). Taps come back as #/go/<action> (see goAction).
const W_THEME = t => (t === "calm" || t === "ez" ? "calm" : t === "classic" ? "you" : "sl");
function wCard(w, lessonOf) {
  if (!w) return null;
  const m = String(w.de).match(/^(der|die|das|le|la|les|l')\s*(.*)$/i), s = S && S.words[w.id], ex = (w.ex || [])[0];
  return { id: w.id, de: w.de, art: m ? m[1] : null, word: m ? m[2] : w.de, g: w.g || null, en: firstEn(w.en), hint: w.hint || null,
    pl: w.pl || null, ex: ex ? ex.de : null, exEn: ex ? ex.en : null, a: w.a || null, learned: !!s, lesson: lessonOf[w.id] || null,
    due: s ? s.due : null };
}
const firstEn = en => String(en).split(/;/)[0].trim();
function bestStreakOf() {
  const days = [...new Set([...Object.keys(S.xp || {}), ...Object.keys(S.hit || {})])].sort();
  if (!days.length) return streak();
  let best = 0, run = 0, d = days[0];
  for (; d <= today(); d = addDays(d, 1)) { if (dayCounts(d)) { run++; best = Math.max(best, run); } else if (d !== today()) run = 0; }
  return Math.max(best, streak());
}
function widgetSnapshot() {
  if (!USER || !S) return { v: 1, signedIn: false, generatedAt: Date.now() };
  const ci = courseInfo(COURSE), tree = ci.type === "tree", t = today();
  const base = { v: 1, signedIn: true, guest: isGuest(), userName: userInfo(USER).name, courseId: COURSE, courseTitle: ci.short || ci.title,
    courseType: tree ? "tree" : "language", lang: tree ? null : L.code, theme: W_THEME(S.settings.theme), generatedAt: Date.now(), day: t,
    syncedAt: SYNC.last || null, offline: !SYNC.online, totalXP: totalXP(), diamonds: S.gems || 0, xpToday: xpToday(),
    streak: streak(), bestStreak: bestStreakOf(), todayHit: dayCounts(t), nextGiftAt: nextMilestone() };
  const from = addDays(mondayOf(t), -28);
  base.days = Array.from({ length: 35 }, (_, k) => { const d = addDays(from, k);
    return d > t ? "F" : dayCounts(d) ? "H" : (S.xp[d] || 0) > 0 ? "P" : "M"; }).join("");
  if (ci.type === "life") return { ...base, courseType: "life", questMode: false, life: lifeSnapshot() };
  if (tree) {
    const ct = continueTarget(), all = openBranches().flatMap(b => treeNodes(b.id));
    return { ...base, questMode: false, treeDone: all.filter(n => nodeDone(n.id)).length, treeTotal: all.length,
      next: ct ? { kind: "skill", itemId: ct.n.id, branch: ct.br.id, icon: ct.br.icon, title: ct.n.title, subtitle: `${ct.br.title} · skill ${ct.n.n}`,
        part: Math.min(partsDoneCount(ct.n) + 1, (nodeParts(ct.n) || [1]).length), parts: (nodeParts(ct.n) || [1]).length, minutes: ct.n.mins || 5, newWords: [] } : null,
      dueCount: 0, review: [], wotd: null };
  }
  if (!S.setup) return { ...base, signedIn: true, setup: false };
  const lessonOf = {}; C.content.path.forEach(it => it.kind === "vocab" && it.words.forEach(id => (lessonOf[id] = it.n)));
  const due = dueWords(), qs = questStatus(due), pc = progress(), Lv = level(pc.total), rk = rank(pc.total), info = RANK_INFO[rk.r] || {};
  const p = pace(), rkFrom = (RANKS.find(x => x[0] === rk.r) || [0, 0])[1];
  const eta = rk.nextAt != null && p.actualPerDay > 0 ? Math.ceil((rk.nextAt - pc.total) / p.actualPerDay) : null;
  const lastLv = S.lastLv || Lv.lv, lastRank = rank(Math.max(0, ((lastLv - 1) * 100) / (A1_LEVEL - 1))).r;
  const it = nextPick() || nextItem();
  let next = null;
  if (it) {
    const b = nextBit(it), ids = bitsOf(it)[b] || [];
    next = { kind: it.kind, itemId: it.id, lessonNo: it.n || null, title: it.kind === "vocab" ? `Lesson ${it.n}` : it.title,
      subtitle: it.kind === "vocab" ? it.title : KIND[it.kind], part: Math.min(bitsDone(it) + 1, bitCount(it)), parts: bitCount(it), minutes: minPerPart() || 5,
      newWords: it.kind === "vocab" ? ids.slice(0, 6).map(id => wCard(C.word[id], lessonOf)) : it.kind === "phrases" ? ids.slice(0, 4).map(i => { const ph = C.phrases[it.id].items[i]; return { de: ph.de, en: ph.en, word: ph.de }; }) : [] };
  }
  // word of the day: the same for the whole day; learned words that are due soon first, else the next lesson's words
  const learned = Object.entries(S.words).sort((a, b) => a[1].due.localeCompare(b[1].due)).slice(0, 30).map(([id]) => id);
  const ahead = it && it.kind === "vocab" ? it.words : C.content.words.filter(w => w.core).slice(0, 60).map(w => w.id);
  const pool = [...new Set([...learned, ...ahead])].filter(id => C.word[id]);
  let h = 0; for (const ch of t + USER) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pick = k => wCard(C.word[pool[(h + k * 7) % pool.length]], lessonOf);
  const tomorrow = addDays(t, 1);
  return { ...base, questMode: questMode(), setup: true,
    xpGoal: qs.g, partsToday: partsToday(), partsGoal: partsGoal(), dueCount: due.length,
    fadingCount: Object.values(S.words).filter(s => overdueDays(s) > 0).length,
    revDone: S.reviews[t] || 0, revGoal: Math.min(20, due.length + (S.reviews[t] || 0)), questCleared: qs.all,
    missedPenalty: (S.pen || {})[addDays(t, -1)] || null,
    level: Lv.lv, a1Pct: Math.round(pc.total * 10) / 10, rank: rk.r, rankName: info.name || "", rankCan: info.can || "",
    rankFromPct: rkFrom, nextRank: rk.next, nextRankPct: rk.nextAt, aura: aura(Lv.lv), auraName: auraName(Lv.lv),
    nextRankEta: eta != null ? (eta <= 1 ? "~1 day" : `~${eta} days`) : null, rankUp: lastRank !== rk.r && Lv.lv > lastLv,
    next, review: due.slice(0, 4).map(id => wCard(C.word[id], lessonOf)).filter(Boolean),
    dueTomorrow: Object.values(S.words).filter(s => s.due === tomorrow).length,
    wotd: pool.length ? pick(0) : null, wotdAlt: pool.length > 1 ? [1, 2, 3, 4, 5].map(pick) : [] };
}
let wTimer = 0;
function pushWidget() {
  const N = window.LevelUpNative; if (!N || !N.setWidgetData) return;
  clearTimeout(wTimer);
  wTimer = setTimeout(() => { try { N.setWidgetData(JSON.stringify(widgetSnapshot())); } catch (e) { console.warn("widget snapshot", e); } }, 700);
}
// widget taps: #/go/next (start the next part), #/go/review, #/go/word/<id>
async function goAction(act, arg) {
  if (act === "life") {                     // Hunter's Path widget / reminder: open that course from anywhere
    if (!isLife()) { await switchCourse("hunter"); markPicked(); }
    if (location.hash !== "#/home") location.hash = "#/home"; else route();
    return;
  }
  if (isLife()) { if (arg && S.tracks[arg]) location.hash = "#/track/" + arg; return; }
  const tree = courseInfo(COURSE).type === "tree";
  if (act === "next") {
    if (tree) { const ct = continueTarget(); if (ct) openReader(ct.br, ct.n); return; }
    const it = nextPick() || nextItem(); if (it) startItem(it); else toast("All lessons done 🎓");
  } else if (act === "review" && !tree) {
    const d = dueWords(); if (d.length) startReview(d.slice(0, 20)); else toast("No words due right now ✓");
  } else if (act === "word" && !tree && C.word[arg]) { location.hash = "#/words"; setTimeout(() => wordSheet(C.word[arg]), 150); }
}
["a1:saved", "a1:sync", "a1:state-replaced", "hashchange", "visibilitychange"].forEach(ev => window.addEventListener(ev, pushWidget));

// ------------------------------------------------------------------ welcome tour (js/tour.js)
// Runs once per device for each kind of course (language / skill tree), on the course home, the first time it is shown.
// "Take the tour" (Settings → About, account menu) runs it again.
const tourKind = () => (isLife() ? "life" : courseInfo(COURSE).type === "tree" ? "tree" : "lang");
const tourSeen = k => { try { return !!localStorage.getItem("a1.tour." + k); } catch { return true; } };
const tourMark = k => { try { localStorage.setItem("a1.tour." + k, today()); } catch { /* ignore */ } };
const cardOf = sel => () => { const e = [...document.querySelectorAll(sel)].find(x => x.offsetParent); return e ? e.closest(".card") || e : null; };
function langSteps() {
  const quest = questMode();
  return [
    { title: "Welcome to LevelUp 👋", text: `A quick look at how it works. It takes about 30 seconds. Tap <b>Show me</b>, or anywhere on the screen to go on.` },
    { sel: "#uc", title: "Your profile", text: "Your account: invite friends, text size, password, log out, and the app version." },
    { sel: "#cc", title: "Your course", text: "Tap to switch courses: German, French, Maths, Software Engineering. Each one keeps its own progress." },
    { sel: "#gem", title: "XP and diamonds", text: "⚡ XP for every part you finish and every word you recall. 💎 Diamonds for clearing the daily quest. Long streaks earn gift boxes 🎁." },
    { sel: ".player .emb-link, #xpring", title: "Level and rank", text: "Your level grows with how much of A1 you know, and your rank climbs from E to S. Tap it to see every rank." },
    quest && { find: cardOf(".quest"), title: "Daily quest", text: "Three goals a day: earn the XP goal, finish a few short parts, review the words that are due. Reaching the XP goal keeps your 🔥 streak." },
    { sel: ".next-card", title: "Your next lesson", text: "Lessons come in short parts of a few minutes. Tap <b>Start</b>; every part counts for today's quest." },
    { find: cardOf("#rev"), title: "Memory training", text: "Learned words come back right before you'd forget them. Review them so they stay fresh; skipped days cost a little XP." },
    { sel: '#tabs a[data-tab="path"]', title: quest ? "Path" : "Skills", text: quest ? "The whole course, week by week, up to your target date." : "Every lesson as a skill map: pick any one, at your own pace." },
    { sel: '#tabs a[data-tab="words"]', title: "Words", text: "Every word and phrase you've learned, with audio, search and how well you know it." },
    { sel: '#tabs a[data-tab="progress"]', title: "Progress", text: "How much of A1 you know, your pace to the target date and an activity calendar." },
    { sel: '#tabs a[data-tab="party"]', title: "Party", text: "Learn with friends: join a party and compare progress." },
    { sel: '#tabs a[data-tab="settings"]', title: "Settings", text: "Daily goal, target date, Quest Mode, theme, text size, offline audio. You can take this tour again there." },
    { sel: "#bugbtn", title: "Tell us anything", text: "Found a problem or have an idea? Tap 🐞 on any screen. It sends what you see along with your note." },
    { title: "You're ready 🎉", text: `Start your first part. Little and often beats long sessions.<br><button class="link" data-guide style="padding:0;margin-top:6px">📘 Read the 2-minute guide: how to learn well with LevelUp</button>` },
  ].filter(Boolean);
}
function treeSteps() {
  return [
    { title: `Welcome to ${esc(C.content.title || "LevelUp")} 👋`, text: "A quick look at how skill-tree courses work. Tap <b>Show me</b>, or anywhere on the screen to go on." },
    { sel: "#uc", title: "Your profile", text: "Your account: invite friends, text size, password, log out, and the app version." },
    { sel: "#cc", title: "Your course", text: "Tap to switch courses. Each one keeps its own progress." },
    { sel: ".contcard", title: "Continue", text: "Picks up exactly where you stopped. Each skill is a few short parts to read, then practice questions." },
    { sel: ".bcard", title: "Branches", text: "Each branch is a skill tree. The ring shows how much you've done; skills unlock as you finish the ones before them." },
    { sel: "button.aa[data-aa]", title: "Text size", text: "Make the reading text bigger or smaller, on every page." },
    { sel: "#bugbtn", title: "Tell us anything", text: "Found a problem or have an idea? Tap 🐞 on any screen." },
    { title: "You're ready 🎉", text: `Open a branch and start with its first skill.<br><button class="link" data-guide style="padding:0;margin-top:6px">📘 Read the 2-minute guide</button>` },
  ];
}
let tourPending = false;
function maybeTour() {
  if (!USER || !S || tourRunning() || inLesson()) return;
  const k = tourKind();
  if (!tourPending && tourSeen(k)) return;
  if (k === "lang" && !S.setup) return;
  setTimeout(() => {
    // wait for pop-ups (rewards, updates, sheets) to be gone; try again on the next render
    if (tourRunning() || inLesson() || document.querySelector("#sheet-root .sheet-bg, #upd-root, .bug-bg")) return;
    const home = k === "life" ? /^#\/(home)?$/.test(location.hash || "#/home") : k === "tree" ? !location.hash.startsWith("#/branch") : /^#\/(today)?$/.test(location.hash || "#/today");
    if (!home) return;
    tourPending = false; tourMark(k);
    startTour(k === "life" ? lifeSteps() : k === "tree" ? treeSteps() : langSteps());
  }, 650);
}
// "Take the tour": go to the course home and run it
function takeTour() {
  closeSheet(); tourPending = true;
  const h = ["tree", "life"].includes(courseInfo(COURSE).type) ? "#/home" : "#/today";
  if (location.hash === h) route(); else location.hash = h;
}
document.addEventListener("click", e => { if (e.target.closest("[data-tour]")) takeTour(); });

// ------------------------------------------------------------------ "How LevelUp works" guide (#/guide)
// The one page everyone should read (feedback 11-22): what the app is for and how to use it well, in about 2 minutes.
// Linked from a "Start here" card on the course home (until opened or dismissed), the tour's last step, Settings → About
// and the account menu.
const guideSeen = () => { try { return !!localStorage.getItem("a1.guideSeen"); } catch { return true; } };
const guideMark = () => { try { localStorage.setItem("a1.guideSeen", today()); } catch { /* ignore */ } };
const guideCard = () => guideSeen() ? "" : `<div class="card guidecard" id="guidec"><span class="gc-i">📘</span><div class="grow"><b>New here? Start with the 2-minute guide</b>
  <div class="muted small">What LevelUp is for and how to get the most out of it.</div></div>
  <button class="btn sm" data-guide style="width:auto;margin:0">Read</button><button class="link" id="guidex" aria-label="Hide" style="padding:4px">✕</button></div>`;
function wireGuideCard() {
  const x = view().querySelector("#guidex");
  if (x) x.onclick = () => { guideMark(); view().querySelector("#guidec")?.remove(); toast("The guide is always in Settings → About"); };
}
function guideView() {
  guideMark();
  if (isLife()) return lifeGuide();
  const tree = courseInfo(COURSE).type === "tree", lang = !tree, quest = lang && S && S.setup && questMode();
  const what = tree ? (C.content.title || "this course") : (C.course && C.course.title) || "your course";
  const sec = (icon, title, body) => `<section class="gsec"><h2><span>${icon}</span>${title}</h2>${body}</section>`;
  const idea = (n, icon, t, d) => `<div class="gidea"><div class="gn">${n}</div><div class="grow"><b>${icon} ${t}</b><div class="muted small">${d}</div></div></div>`;
  const step = (t, mins, d) => `<li><div class="row" style="gap:8px;align-items:baseline"><b class="grow">${t}</b><span class="gmins">${mins}</span></div><div class="muted small">${d}</div></li>`;
  const tip = (ok, t) => `<li class="${ok ? "do" : "dont"}"><span>${ok ? "✓" : "✗"}</span><div>${t}</div></li>`;
  view().innerHTML = `<div class="guide">
  <button class="link" id="gback" style="padding:0;margin-bottom:6px">‹ Back</button>
  <div class="ghero"><div class="gh-i">📘</div><h1>How LevelUp works</h1><p class="muted">A 2-minute read. It will save you weeks.</p></div>
  ${sec("🎯", "What it's for", lang
    ? `<p>LevelUp gets you to a real level in <b>${esc(what)}</b> by a date you choose: enough to pass the A1 exam and to manage simple everyday conversations. It teaches every word, phrase and grammar point the exam expects, then makes sure you <b>keep</b> them.</p>`
    : `<p><b>${esc(what)}</b> is a skill tree: short readings with worked examples, practice questions and concept checks, from the foundations up. It's built to fill gaps properly, not to skim.</p>`)}
  ${sec("💡", "The 3 ideas that make it work", lang ? `
    ${idea(1, "⏱", "Short parts", "Each lesson is split into parts of about 5 minutes. Small enough to do on a bus, often enough to add up.")}
    ${idea(2, "🧠", "Recall, don't reread", "Every word comes back as a quick test right before you'd forget it (spaced repetition). Pulling it from memory is what makes it stick; rereading doesn't.")}
    ${idea(3, "📅", "A little every day", "Your finish date sets a daily goal. Ten minutes every day beats an hour on Sunday, and the 🔥 streak keeps you honest.")}` : `
    ${idea(1, "⏱", "Short parts", "Each skill is split into 3–4 parts of a few minutes. Read one, stop, come back.")}
    ${idea(2, "✍️", "Practice right after reading", "Practice questions open by themselves when you finish a skill. Answering beats rereading every time.")}
    ${idea(3, "🧱", "Foundations first", "Skills unlock in order. A concept check shows which earlier skill a mistake comes from, so you fix the cause.")}`)}
  ${sec("🗓", "Your daily routine", lang ? `<ol class="groutine">
    ${step("Review the words that are due", "2–5 min", "Always first. Overdue words start to fade from your progress, and a missed review day costs a little XP.")}
    ${step(quest ? "Finish today's parts" : "Finish a part or two", "5 min each", quest ? "The daily quest says how many parts keep you on track for your date. Lessons alternate so you don't get stuck on one topic." : "Pick any lesson from the skill map and finish one part at a time.")}
    ${step("Say it out loud", "as you go", "Answer before you reveal, out loud or in your head. 🎤 Speak it checks your pronunciation in phrase lessons.")}
    ${quest ? step("Hit the goal, keep the streak", "done", "Reaching the XP goal banks the day: 🔥 +1, diamonds 💎 for the quest, gift boxes for long streaks.") : ""}
  </ol>` : `<ol class="groutine">
    ${step("Continue where you stopped", "5–10 min", "The Continue card on the home screen opens the next part.")}
    ${step("Do the practice questions", "3–5 min", "They open when you finish a skill. Aim for 80 % to pass; retry the ones you missed.")}
    ${step("Take the concept check", "3 min", "Common mistakes and \"spot the wrong step\". Misses link to the skill to revisit.")}
  </ol>`)}
  ${sec("🏆", "Tips that make the difference", `<ul class="gtips">
    ${tip(true, "Answer <b>before</b> you look. Even a wrong guess helps you remember the right answer.")}
    ${lang ? tip(true, "Play the audio and repeat it. Hearing and saying words makes them stick twice as well.") : tip(true, "Work the examples on paper before reading the solution.")}
    ${lang ? tip(true, "Be honest when you grade yourself. \"I knew it\" when you didn't only hides words you need.") : tip(true, "If a concept check points to an earlier skill, reread it. It's usually a 5-minute fix.")}
    ${tip(true, "Missed a day? Just carry on. The plan adjusts; nothing is lost.")}
    ${lang ? tip(false, "Don't skip reviews to rush new lessons. New words you don't review are gone in a week.") : tip(false, "Don't mark skills as done without the practice. Reading alone fades fast.")}
    ${tip(false, "Don't cram. Two short sessions a day beat one long one.")}
  </ul>`)}
  ${lang ? sec("📈", "How progress is measured", `<p><b>% of A1</b> counts what you actually know: learned words that you keep reviewing, grammar chapters and phrase topics. Words you stop reviewing slowly fade, so the number can go down. Your <b>level</b> (1–100) and <b>rank</b> (E → S) follow it. Progress shows whether your pace reaches your finish date.</p>`) : ""}
  ${sec("🧭", "Where to find things", `<ul class="gwhere">
    ${lang ? `<li><b>🏠 Today</b><span>your quest, next lesson and reviews</span></li><li><b>🗺️ ${quest ? "Path" : "Skills"}</b><span>the whole course</span></li><li><b>📖 Words</b><span>everything you've learned, with audio</span></li><li><b>📈 Progress</b><span>% of A1, pace, activity calendar</span></li><li><b>👥 Party</b><span>learn with friends</span></li><li><b>⚙️ Settings</b><span>goal, finish date, Quest Mode, theme</span></li>`
      : `<li><b>Home</b><span>Continue card and all branches</span></li><li><b>A branch</b><span>its skills as a map or a path</span></li><li><b>A skill</b><span>parts, practice and concept check</span></li>`}
    <li><b>Aa</b><span>text size, on reading screens</span></li><li><b>🐞</b><span>report a problem or an idea, on any screen</span></li></ul>`)}
  <div class="gend"><button class="btn" id="gstart">${lang ? (S && S.setup ? "▶ Start learning" : "▶ Set up my plan") : "▶ Continue learning"}</button>
    <button class="btn ghost" data-tour>🧭 Take the 30-second tour</button></div>
  </div>`;
  window.scrollTo(0, 0);
  view().querySelector("#gback").onclick = () => (window.history.length > 1 ? window.history.back() : (location.hash = tree ? "#/home" : "#/today"));
  view().querySelector("#gstart").onclick = () => {
    if (tree) { const ct = continueTarget(); if (ct) openReader(ct.br, ct.n); else location.hash = "#/home"; return; }
    location.hash = "#/today";
  };
}
document.addEventListener("click", e => { if (e.target.closest("[data-guide]")) { endTourIfAny(); location.hash = "#/guide"; } });
const endTourIfAny = () => { if (tourRunning()) endTour(true); };

// ------------------------------------------------------------------ Hunter's Path (personal tracks; engine in js/life.js)
// Routes: #/home (today's quests), #/gates (gate board + record), #/new[/template] (builder), #/track/<id>, #/hunter.
// Design: docs/design/personal-tracks.md. Shield rules (anti-abuse) live in life.js.
const isLife = () => courseInfo(COURSE).type === "life";
const lifeTemplates = () => C.content.templates || [];
const DAYNAMES = ["M", "T", "W", "T", "F", "S", "S"];
function lifeRoute(h) {
  document.body.classList.add("in-lesson");
  LF.H(); LF.settleAll(); applyWidgetTicks();
  const [, nm, arg] = h.split("/");
  if (nm === "guide") return guideView();
  if (nm === "gates") return lifeGates();
  if (nm === "new") return lifeBuilder(decodeURIComponent(arg || ""));
  if (nm === "track" && arg && S.tracks[arg]) return lifeTrack(arg);
  if (nm === "hunter") return lifeHunter();
  return lifeHome();
}
const lifeNav = cur => `<div class="lnav">${[["home", "⚔️ Today"], ["gates", "🌀 Gates"], ["hunter", "🧬 Hunter"], ["party", "👥 Party"]].map(([k, l]) =>
  `<a href="#/${k}" class="${cur === k ? "on" : ""}">${l}</a>`).join("")}</div>`;
const hunter = () => { const lv = LF.hunterLevel(LF.totalLifeXP()); return { ...lv, rk: LF.hunterRank(lv.lv) }; };
const gateBadge = days => { const g = LF.gateRank(days); return g ? `<span class="gbadge g-${g}">${g}</span>` : `<span class="gbadge g-open">∞</span>`; };
function crackText(tr) {
  const c = tr.st.cracked; if (!c) return "";
  const need = (tr.kind === "target" ? LF.HEAL_WEEKS : LF.HEAL_DAYS) - c.heal;
  return `⚠ Cracked · heals after ${need} more good ${tr.kind === "target" ? (need === 1 ? "week" : "weeks") : need === 1 ? "day" : "days"}`;
}
function trackLine(tr) {
  const t = today(), n = LF.dayNo(tr, t);
  const parts = [tr.days ? `Day ${Math.min(n, tr.days)} / ${tr.days}` : `Day ${n}`];
  if (tr.kind === "daily" || tr.kind === "abstain") parts.push(`run ${tr.st.run}`);
  if (tr.kind === "target" && tr.period === "week") parts.push(`week ${Math.floor(LF.dayNo(tr, t) / 7.0001) + 1}`);
  return parts.join(" · ");
}
function questAction(tr) {
  const t = today(), v = tr.log[t], done = LF.doneToday(tr, t);
  if (tr.auto === "learn") return `<span class="qauto ${done ? "ok" : ""}">${done ? "✓ Goal reached" : "Ticks itself"}</span>`;
  if (tr.kind === "abstain") {
    if (v === true) return `<button class="qbtn ok" data-un="${tr.id}" aria-label="Undo">✓ Clean</button>`;
    if (v === "slip") return `<span class="qauto bad">Slipped</span>`;
    return `<button class="qbtn" data-clean="${tr.id}">Still clean ✓</button><button class="qlink" data-slip="${tr.id}">I slipped</button>`;
  }
  if (tr.kind === "daily" && tr.amount) return `<button class="qbtn ${done ? "ok" : ""}" data-amt="${tr.id}">${+v || 0} / ${tr.amount} ${esc(tr.unit)}</button>`;
  if (tr.kind === "daily") return `<button class="qcheck ${done ? "ok" : ""}" data-ck="${tr.id}" aria-label="${done ? "Done" : "Mark done"}">${done ? "✓" : ""}</button>`;
  if (tr.kind === "target") {
    const n = tr.period === "week" ? LF.weekCount(tr, Math.floor(LF.dayNo(tr, t) / 7.0001)) : LF.totalCount(tr);
    return `<span class="qprog ${done ? "ok" : ""}">${n} / ${tr.amount}</span><button class="qbtn sm2" data-add="${tr.id}">+1 ${esc(tr.unit)}</button>`;
  }
  const k = tr.steps.filter(s => s.d).length;
  return `<span class="qprog">${k} / ${tr.steps.length} steps</span>`;
}
function questRow(tr) {
  const done = LF.doneToday(tr);
  return `<div class="qrow ${done ? "done" : ""} ${tr.st.cracked ? "cracked" : ""}" data-open="${tr.id}">
    <span class="qic">${tr.icon}</span><div class="grow qmid"><b>${esc(LF.shown(tr))}</b> ${gateBadge(tr.days)}
      <div class="tiny muted">${trackLine(tr)}${tr.st.cracked ? ` · <span class="crk">${crackText(tr)}</span>` : ""}</div></div>
    <div class="qact">${questAction(tr)}</div></div>`;
}
function wireQuests(root, rerender) {
  const T = id => S.tracks[id], t = today();
  root.querySelectorAll("[data-open]").forEach(r => (r.onclick = e => { if (!e.target.closest("button")) location.hash = "#/track/" + r.dataset.open; }));
  root.querySelectorAll("[data-ck]").forEach(b => (b.onclick = () => { const tr = T(b.dataset.ck); LF.checkIn(tr, t, LF.doneToday(tr) ? null : true); questToast(tr); rerender(); }));
  root.querySelectorAll("[data-clean]").forEach(b => (b.onclick = () => { const tr = T(b.dataset.clean); LF.checkIn(tr, t, true); questToast(tr); rerender(); }));
  root.querySelectorAll("[data-un]").forEach(b => (b.onclick = () => { LF.checkIn(T(b.dataset.un), t, null); rerender(); }));
  root.querySelectorAll("[data-slip]").forEach(b => (b.onclick = () => slipSheet(T(b.dataset.slip), rerender)));
  root.querySelectorAll("[data-add]").forEach(b => (b.onclick = () => { const tr = T(b.dataset.add); LF.logUnits(tr, 1); toast(`+1 ${tr.unit} · +${LF.XP.unit} XP`); rerender(); }));
  root.querySelectorAll("[data-amt]").forEach(b => (b.onclick = () => amountSheet(T(b.dataset.amt), rerender)));
  root.querySelectorAll("[data-sos]").forEach(b => (b.onclick = e => { e.stopPropagation(); sosView(T(b.dataset.sos), rerender); }));
  root.querySelectorAll("[data-pen]").forEach(b => (b.onclick = () => { LF.penaltyDone(T(b.dataset.pen)); toast("Penalty quest done · the crack healed"); rerender(); }));
  root.querySelectorAll("[data-yes],[data-no]").forEach(b => (b.onclick = () => {
    const tr = T(b.dataset.yes || b.dataset.no), y = addDays(t, -1);
    LF.checkIn(tr, y, b.dataset.yes ? true : tr.kind === "abstain" ? "slip" : false); LF.settleAll(); rerender();
  }));
}
function questToast(tr) { if (LF.doneToday(tr)) toast(`${tr.icon} ${LF.shown(tr)} ✓ · +${LF.XP.day} XP`); }
function amountSheet(tr, done) {
  const t = today();
  sheet(`<h2 style="margin-top:0">${tr.icon} ${esc(LF.shown(tr))}</h2><label class="f">How many ${esc(tr.unit)} today?</label>
    <input id="amt" type="number" inputmode="numeric" min="0" value="${+tr.log[t] || ""}" placeholder="0">
    <p class="muted small">Goal: ${tr.amount} ${esc(tr.unit)}.</p><button class="btn" id="ok">Save</button><button class="btn ghost" id="cx">Cancel</button>`, el => {
    const i = el.querySelector("#amt"); i.focus();
    el.querySelector("#ok").onclick = () => { const n = Math.max(0, parseInt(i.value, 10) || 0); LF.checkIn(tr, t, n || null); closeSheet(); questToast(tr); done(); };
    el.querySelector("#cx").onclick = closeSheet;
  });
}
function slipSheet(tr, done) {
  const out = LF.missOutcome(tr), best = Math.max(tr.st.best, tr.st.run), clean = LF.cleanDays(tr);
  const msg = { shield: "A 🛡 shield will cover today, so your run continues.", crack: "Your run will crack ⚠ but keep going. It heals after a week of good days.",
    break: tr.days ? "This ends the gate. You keep the XP you earned, and you can re-enter it right away." : "This run ends, and a new one starts tomorrow." }[out];
  sheet(`<h2 style="margin-top:0">That happens.</h2>
    <p>${best ? `Your best run is <b>${best} day${best === 1 ? "" : "s"}</b>${clean ? `, and you were on track <b>${clean} of the last 30 days</b>` : ""}. One slip doesn't undo that.` : "You've only just started. One slip doesn't decide anything."}</p>
    <div class="note">${msg}</div>
    ${tr.why ? `<p class="small"><b>Why you started:</b> ${esc(tr.why)}</p>` : ""}
    <button class="btn" id="slipok">Log the slip</button>
    ${tr.kind === "abstain" ? `<button class="btn ghost" id="sos">🆘 I'm still fighting an urge</button>` : ""}
    <button class="btn ghost" id="cx">Cancel</button>`, el => {
    el.querySelector("#slipok").onclick = () => { LF.checkIn(tr, today(), "slip"); LF.settleAll(); closeSheet(); toast(out === "shield" ? "🛡 Shield used. The run continues." : "Logged. Tomorrow is a new day."); done(); };
    const s = el.querySelector("#sos"); if (s) s.onclick = () => { closeSheet(); sosView(tr, done); };
    el.querySelector("#cx").onclick = closeSheet;
  });
}
// 🆘 urge help: 90 s of guided breathing, your own reason, a quick physical task
const SOS_TASKS = ["Do 20 push-ups right now", "Drink a big glass of cold water", "Go outside and walk for 5 minutes", "Take a cold shower", "Put the phone in another room for 10 minutes", "Text a friend about anything else"];
function sosView(tr, done) {
  const root = document.createElement("div"); root.className = "sos";
  const task = SOS_TASKS[Math.floor(Math.random() * SOS_TASKS.length)];
  root.innerHTML = `<div class="sos-in"><div class="tiny" style="letter-spacing:2px;opacity:.8">URGE SOS</div>
    <div class="sos-ring"><div class="sos-b"></div><div class="sos-t" id="sost">Breathe in</div></div>
    <div class="sos-time" id="sosc">1:30</div>
    <p class="sos-why">${tr.why ? `“${esc(tr.why)}”` : "Urges peak and pass in a few minutes. Ride it out."}</p>
    <div class="sos-task">💪 ${task}</div>
    <button class="btn" id="won">The urge passed 💪</button><button class="btn ghost" id="slip">I slipped</button><button class="link" id="close" style="display:block;margin:10px auto 0;color:#cfe">Close</button>
    <p class="sos-help">If this feels bigger than a habit, talking to a doctor or counsellor helps. LevelUp is not a medical tool.</p></div>`;
  document.body.appendChild(root);
  let left = 90; const tick = setInterval(() => {
    left--; const e = root.querySelector("#sosc"); if (!e) return clearInterval(tick);
    e.textContent = left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "Well done";
    root.querySelector("#sost").textContent = (90 - left) % 10 < 4 ? "Breathe in" : "Breathe out";
    if (left <= 0) clearInterval(tick);
  }, 1000);
  const close = () => { clearInterval(tick); root.remove(); };
  root.querySelector("#won").onclick = () => { LF.urgeBeaten(tr); close(); toast(`Urge defeated · +${LF.XP.urge} XP`); done(); };
  root.querySelector("#slip").onclick = () => { close(); slipSheet(tr, done); };
  root.querySelector("#close").onclick = close;
}
function shieldSheet(done = () => route()) {
  const h = LF.H(), shop = LF.shieldShop();
  const why = { full: `You already hold the most shields (${LF.SHIELD_MAX}).`, wait: `You can buy the next one on ${fmtDate(shop.next, { day: "numeric", month: "long" })}.`, gems: `You need 💎 ${shop.cost} (you have ${S.gems || 0}).` }[shop.why];
  sheet(`<h2 style="margin-top:0">🛡 Shields: ${h.shields} / ${LF.SHIELD_MAX}</h2>
    <p class="small">A shield covers one missed or slipped day, so your run doesn't crack. It's used automatically.</p>
    <ul class="small rules"><li><b>Earn</b> one for every D-rank gate (14 days) or higher you clear.</li>
      <li><b>Buy</b> one for 💎 ${shop.cost}, at most once every ${LF.SHIELD_BUY_DAYS} days.</li>
      <li>One shield per gate per week, never two days in a row, and not on hard-mode gates.</li>
      <li>No shield? The run <b>cracks ⚠</b> instead. A crack heals by itself after ${LF.HEAL_DAYS} good days in a row (${LF.HEAL_WEEKS} good weeks for weekly goals). Miss twice in a row, or again while cracked, and the run breaks.</li></ul>
    <button class="btn" id="buy" ${shop.ok ? "" : "disabled"}>Buy a shield · 💎 ${shop.cost}</button>
    ${why ? `<p class="muted small" style="text-align:center">${why}</p>` : ""}<button class="btn ghost" id="cx">Close</button>`, el => {
    el.querySelector("#buy").onclick = () => { if (LF.buyShield()) { closeSheet(); toast("🛡 Shield bought"); done(); } };
    el.querySelector("#cx").onclick = closeSheet;
  });
}
function lifeHome() {
  const h = LF.H(), t = today(), list = LF.todayList(), hu = hunter(), y = addDays(t, -1);
  const doneN = list.filter(tr => LF.doneToday(tr)).length;
  const pens = LF.active().filter(tr => tr.st.pendingPen && tr.st.pendingPen <= t && !tr.pen[t]);
  const back = LF.active().filter(tr => (tr.kind === "daily" || tr.kind === "abstain") && !tr.auto && y >= tr.start && LF.scheduled(tr, y) && tr.st.settled < y && LF.dayValue(tr, y) === null);
  const ended = Object.values(S.tracks).filter(tr => (tr.status === "cleared" || tr.status === "failed") && !tr.seen);
  const rest = LF.active().filter(tr => !list.includes(tr));
  view().innerHTML = topRow() + guideCard() + lifeNav("home") + `
  <div class="card hcard"><a href="#/hunter" class="emb-link">${rankEmblem(Math.min(100, hu.lv), "sm", hu.rk)}</a>
    <div class="grow"><div class="lv">Level <b>${hu.lv}</b> · ${hu.rk}-Rank Hunter</div><div class="hbar" style="margin-top:4px"><div style="width:${100 * hu.frac}%"></div></div>
      <div class="tiny muted" style="margin-top:3px">${hu.into} / ${hu.need} XP to level ${hu.lv + 1}</div></div>
    <div class="hchips"><button class="hchip" id="shl" aria-label="Shields">🛡 ${h.shields} / ${LF.SHIELD_MAX}</button><span class="hchip">🔥 ${streak()} day${streak() === 1 ? "" : "s"}</span><span class="hchip">💎 ${S.gems || 0}</span></div></div>
  ${ended.map(tr => `<div class="card endcard ${tr.status}"><div class="grow"><b>${tr.status === "cleared" ? `🏆 Gate cleared: ${esc(LF.shown(tr))}` : `Gate failed: ${esc(LF.shown(tr))}`}</b>
    <div class="small muted">${tr.status === "cleared" && tr.reward ? `${tr.reward.g}-rank · +${tr.reward.x} XP · 💎 ${tr.reward.dm}${"DCBAS".includes(tr.reward.g) ? " · 🛡 if you had room" : ""}` : `${esc((tr.st.events.at(-1) || {}).txt || "")} You keep the XP you earned.`}</div></div>
    ${tr.status === "failed" ? `<button class="btn sm" data-re="${tr.id}" style="width:auto;margin:0">Re-enter</button>` : ""}<button class="link" data-seen="${tr.id}" aria-label="Dismiss">✕</button></div>`).join("")}
  <div class="card sysq"><div class="sys-h"><span class="ex">!</span> Daily quests</div>
    ${list.length ? `<div class="tiny muted" style="text-align:center;margin:-4px 0 8px;letter-spacing:1px">${doneN === list.length ? "ALL QUESTS COMPLETE ✓" : `${doneN} OF ${list.length} DONE · ${leftToday()}`}</div>` : ""}
    ${pens.map(tr => `<div class="qrow pen"><span class="qic">⚡</span><div class="grow qmid"><b>Penalty quest</b><div class="tiny">${esc(tr.penalty)} · for ${esc(LF.shown(tr))}</div></div><div class="qact"><button class="qbtn" data-pen="${tr.id}">Done</button></div></div>`).join("")}
    ${back.map(tr => `<div class="qrow back"><span class="qic">${tr.icon}</span><div class="grow qmid"><b>Yesterday: ${esc(LF.shown(tr))}?</b><div class="tiny muted">You didn't check in. Answer before midnight.</div></div>
      <div class="qact"><button class="qbtn" data-yes="${tr.id}">${tr.kind === "abstain" ? "Clean ✓" : "Done ✓"}</button><button class="qlink" data-no="${tr.id}">${tr.kind === "abstain" ? "Slipped" : "Missed"}</button></div></div>`).join("")}
    ${list.map(questRow).join("") || `<div class="lempty"><div style="font-size:calc(40px*var(--fs))">🌀</div><b>No gates open yet</b><p class="muted small">Pick a challenge from the gate board, or make your own: a habit to build, something to quit, a target or a big goal.</p>
      <a class="btn" href="#/gates" style="display:block;text-decoration:none;text-align:center">Open the gate board</a></div>`}
    ${list.some(tr => tr.kind === "abstain") ? `<button class="btn ghost sosbtn" data-sos="${list.find(tr => tr.kind === "abstain").id}">🆘 Urge SOS</button>` : ""}</div>
  ${rest.length ? `<div class="card"><div class="sys-h">Rest day</div>${rest.map(questRow).join("")}</div>` : ""}
  ${list.length ? `<a class="btn ghost" href="#/gates" style="display:block;text-decoration:none;text-align:center">＋ Enter another gate</a>` : ""}`;
  wireTop(); wireGuideCard(); maybeTour();
  view().querySelector("#shl").onclick = () => shieldSheet(lifeHome);
  view().querySelectorAll("[data-seen]").forEach(b => (b.onclick = () => { S.tracks[b.dataset.seen].seen = true; save(); lifeHome(); }));
  view().querySelectorAll("[data-re]").forEach(b => (b.onclick = () => { const n = LF.reenter(S.tracks[b.dataset.re]); S.tracks[b.dataset.re].seen = true; save(); toast("Gate re-entered. Day 1."); location.hash = "#/track/" + n.id; }));
  wireQuests(view(), lifeHome);
  pushWidget();
}
function lifeGates() {
  const all = Object.values(S.tracks || {}), rec = all.filter(tr => tr.status !== "active").sort((a, b) => (b.ended || "").localeCompare(a.ended || ""));
  const open = new Set(LF.active().map(tr => tr.template).filter(Boolean));
  view().innerHTML = topRow() + lifeNav("gates") + `
  <a class="card gnew" href="#/new"><span class="qic">✨</span><div class="grow"><b>Create your own gate</b><div class="small muted">A habit to build, something to quit, a target, or a big goal with steps.</div></div><span class="caret">›</span></a>
  <div class="sys-h" style="margin:14px 2px 6px">Gate board</div>
  ${lifeTemplates().map(tp => `<div class="card gtpl"><div class="row" style="gap:10px;align-items:flex-start"><span class="qic">${tp.icon}</span>
    <div class="grow"><b>${esc(tp.title)}</b> ${gateBadge(tp.days)}<div class="small muted">${esc(tp.blurb || "")}</div>
      <div class="tiny muted" style="margin-top:3px">${LF.STATS[tp.stat][0]} ${LF.STATS[tp.stat][1]} · ${tp.days ? `${tp.days} days` : "no end"}${tp.private ? " · private" : ""}</div></div>
    ${open.has(tp.id) ? `<span class="tiny muted">Open ✓</span>` : `<a class="btn sm" href="#/new/${tp.id}" style="width:auto;margin:0;text-decoration:none">Enter</a>`}</div></div>`).join("")}
  ${rec.length ? `<div class="sys-h" style="margin:14px 2px 6px">Your record</div><div class="card">${rec.slice(0, 30).map(tr => `<div class="recrow" data-open="${tr.id}"><span>${tr.icon}</span><span class="grow">${esc(LF.shown(tr))} ${gateBadge(tr.days)}</span>
    <span class="tiny ${tr.status === "cleared" ? "okc" : "muted"}">${tr.status === "cleared" ? "Cleared" : tr.status === "failed" ? "Failed" : "Ended"} ${tr.ended ? fmtDate(tr.ended) : ""}</span></div>`).join("")}</div>` : ""}`;
  wireTop();
  view().querySelectorAll("[data-open]").forEach(r => (r.onclick = () => (location.hash = "#/track/" + r.dataset.open)));
}
const ICONS = ["⭐", "🛡", "📚", "🧘", "🏋️", "🏃", "👟", "💧", "🍬", "📵", "⏰", "📓", "🚿", "🌙", "🎓", "🎸", "🎨", "💰", "🥗", "🚭", "🍺", "🙏", "✍️", "🧹"];
function lifeBuilder(arg) {
  const tp = lifeTemplates().find(x => x.id === arg) || null;
  const f = tp ? { ...tp, template: tp.id, steps: (tp.steps || []).join("\n") } : { kind: "daily", title: "", icon: "⭐", stat: "discipline", days: 30, schedule: [1, 1, 1, 1, 1, 1, 1], period: "week", steps: "" };
  f.schedule = f.schedule || [1, 1, 1, 1, 1, 1, 1];
  const KINDS = [["daily", "✅", "Daily", "Do it on set days"], ["abstain", "🛡", "Quit", "A clean run: stay off something"], ["target", "🎯", "Target", "An amount per week or in total"], ["milestone", "🏔", "Big goal", "Steps by a date"]];
  const draw = () => {
    const lens = f.kind === "target" && f.period === "week" ? [[14, "2 weeks"], [28, "4 weeks"], [56, "8 weeks"], [84, "12 weeks"]]
      : [[7, "7 days"], [14, "14 days"], [21, "21 days"], [30, "30 days"], [60, "60 days"], [90, "90 days"], [180, "180 days"]].concat(f.kind === "daily" || f.kind === "abstain" ? [[0, "No end"]] : []);
    view().innerHTML = `<button class="link" id="bx" style="padding:0">‹ Back</button><h1 style="margin:6px 0 10px">${tp ? `${tp.icon} ${esc(tp.title)}` : "New gate"}</h1>
    <div class="card"><label class="f">What kind?</label><div class="kinds">${KINDS.map(([k, i, l, d]) => `<button class="kind ${f.kind === k ? "on" : ""}" data-k="${k}"><span>${i}</span><b>${l}</b><small>${d}</small></button>`).join("")}</div>
      <label class="f">Name</label><input id="ti" value="${esc(f.title || "")}" maxlength="60" placeholder="${{ daily: "Read 20 minutes", abstain: "No sugar", target: "Gym 3 times a week", milestone: "Run a 10K" }[f.kind]}">
      <label class="f">Icon</label><div class="icons">${ICONS.map(i => `<button class="ico ${f.icon === i ? "on" : ""}" data-i="${i}">${i}</button>`).join("")}</div>
      <label class="f">Stat it trains</label><div class="chips">${Object.entries(LF.STATS).map(([k, [i, l]]) => `<button class="chipx ${f.stat === k ? "on" : ""}" data-s="${k}">${i} ${l}</button>`).join("")}</div></div>
    <div class="card">
      ${f.kind === "daily" ? `<label class="f">Which days?</label><div class="dows">${DAYNAMES.map((d, i) => `<button class="dow ${f.schedule[i] ? "on" : ""}" data-d="${i}">${d}</button>`).join("")}</div>
        <label class="f">Amount per day <span class="muted">(optional)</span></label><div class="row" style="gap:8px"><input id="am" type="number" min="1" value="${f.amount || ""}" placeholder="e.g. 50" style="flex:1"><input id="un" value="${esc(f.unit || "")}" placeholder="unit, e.g. push-ups" style="flex:1.4"></div>` : ""}
      ${f.kind === "target" ? `<label class="f">Target</label><div class="row" style="gap:8px"><input id="am" type="number" min="1" value="${f.amount || ""}" placeholder="e.g. 3" style="flex:1"><input id="un" value="${esc(f.unit || "")}" placeholder="unit, e.g. workout" style="flex:1.4"></div>
        <div class="chips" style="margin-top:8px">${[["week", "Every week"], ["total", "In total"]].map(([k, l]) => `<button class="chipx ${f.period === k ? "on" : ""}" data-p="${k}">${l}</button>`).join("")}</div>` : ""}
      ${f.kind === "milestone" ? `<label class="f">Steps <span class="muted">(one per line)</span></label><textarea id="st" rows="4" placeholder="Run 3 km&#10;Run 5 km&#10;Run 10 km">${esc(f.steps || "")}</textarea>` : ""}
      <label class="f">${f.kind === "milestone" ? "Finish within" : "How long? (the gate)"}</label><div class="chips">${lens.map(([d, l]) => `<button class="chipx ${(f.days || 0) === d ? "on" : ""}" data-l="${d}">${l} ${d ? gateBadge(d) : ""}</button>`).join("")}</div>
      <p class="tiny muted" style="margin:6px 0 0">Longer gates rank higher (E 7 days → S 180 days) and pay more XP and 💎. D-rank and up also give a 🛡 shield.</p></div>
    <div class="card"><label class="f">Why are you doing this? <span class="muted">(shown when it gets hard)</span></label><textarea id="wy" rows="2" placeholder="${f.kind === "abstain" ? "For the moment an urge hits…" : "What will be better when you've done it?"}">${esc(tp && tp.why && tp.why.startsWith("Why do you") ? "" : f.why || "")}</textarea>
      <label class="f">Penalty quest <span class="muted">(only in System mode)</span></label><input id="pq" value="${esc(f.penalty || "")}" placeholder="e.g. 20 push-ups">
      <label class="toggle">Private (never shown to your party) <input type="checkbox" id="pv" ${f.private ? "checked" : ""}></label>
      <label class="f">Name on widgets and in Party <span class="muted">(optional)</span></label><input id="al" value="${esc(f.alias || "")}" placeholder="e.g. Clean run">
      <label class="toggle">Hard mode (no shields) <input type="checkbox" id="hd" ${f.hard ? "checked" : ""}></label></div>
    <button class="btn" id="go">🌀 Enter the gate</button>`;
    const v = view(), keep = () => {
      f.title = v.querySelector("#ti").value; f.why = v.querySelector("#wy").value; f.penalty = v.querySelector("#pq").value; f.private = v.querySelector("#pv").checked; f.alias = v.querySelector("#al").value; f.hard = v.querySelector("#hd").checked;
      const am = v.querySelector("#am"), un = v.querySelector("#un"), st = v.querySelector("#st");
      if (am) f.amount = parseInt(am.value, 10) || null; if (un) f.unit = un.value.trim(); if (st) f.steps = st.value;
    };
    v.querySelector("#bx").onclick = () => window.history.back();
    v.querySelectorAll("[data-k]").forEach(b => (b.onclick = () => { keep(); f.kind = b.dataset.k; if (f.kind === "target" && f.period === "week" && f.days % 7) f.days = 28; if (f.kind === "milestone" && !f.days) f.days = 60; draw(); }));
    v.querySelectorAll("[data-i]").forEach(b => (b.onclick = () => { keep(); f.icon = b.dataset.i; draw(); }));
    v.querySelectorAll("[data-s]").forEach(b => (b.onclick = () => { keep(); f.stat = b.dataset.s; draw(); }));
    v.querySelectorAll("[data-d]").forEach(b => (b.onclick = () => { keep(); f.schedule[+b.dataset.d] = f.schedule[+b.dataset.d] ? 0 : 1; draw(); }));
    v.querySelectorAll("[data-p]").forEach(b => (b.onclick = () => { keep(); f.period = b.dataset.p; if (f.period === "week" && f.days % 7) f.days = 28; draw(); }));
    v.querySelectorAll("[data-l]").forEach(b => (b.onclick = () => { keep(); f.days = +b.dataset.l || null; draw(); }));
    v.querySelector("#go").onclick = () => {
      keep();
      const err = !f.title.trim() ? "Give it a name" : f.kind === "daily" && !f.schedule.some(Boolean) ? "Pick at least one day" : f.kind === "target" && !f.amount ? "Set a target amount" : f.kind === "target" && !f.unit ? "Say what you count (e.g. books)" : f.kind === "milestone" && !String(f.steps).trim() ? "Add at least one step" : null;
      if (err) return toast(err);
      if (f.kind === "daily" && f.amount && !f.unit) f.unit = "times";
      const tr = LF.newTrack({ ...f, steps: f.kind === "milestone" ? String(f.steps).split("\n").map(s => s.trim()).filter(Boolean) : [] });
      toast(`🌀 Gate entered: ${LF.shown(tr)}. Day 1.`); location.hash = "#/track/" + tr.id;
    };
  };
  draw(); window.scrollTo(0, 0);
}
function lifeTrack(id) {
  const tr = S.tracks[id], t = today(), st = tr.st, end = LF.endDate(tr), n = LF.dayNo(tr, t);
  const frac = tr.kind === "milestone" ? tr.steps.filter(s => s.d).length / Math.max(1, tr.steps.length) : tr.kind === "target" && tr.period === "total" ? Math.min(1, LF.totalCount(tr) / tr.amount)
    : tr.days ? Math.min(1, (tr.status === "active" ? n - 1 : tr.days) / tr.days) : 0;
  const shieldsUsed = Object.keys(st.shielded || {}).length;
  // calendar: every day from the start to the end (or today), Monday-aligned
  let cal = "";
  if (tr.kind !== "milestone") {
    const last = end && end < addDays(t, 14) ? end : addDays(t, 6), first = tr.start;
    const pad = (parse(first).getDay() + 6) % 7;
    cal = `<div class="lcal">${DAYNAMES.map(d => `<b>${d}</b>`).join("")}${"<i></i>".repeat(pad)}`;
    for (let d = first; d <= last; d = addDays(d, 1)) {
      const v = LF.dayValue(tr, d), sh = st.shielded && st.shielded[d], sched = LF.scheduled(tr, d);
      const c = d > t ? "fut" : !sched ? "off" : sh ? "sh" : tr.kind === "target" ? (+tr.log[d] ? "ok" : "none") : v === true ? "ok" : tr.log[d] === "slip" || v === false ? "bad" : d < t && d <= st.settled ? "bad" : "none";
      cal += `<i class="${c} ${d === t ? "now" : ""}" title="${d}">${sh ? "🛡" : tr.kind === "target" && +tr.log[d] ? +tr.log[d] : ""}</i>`;
    }
    cal += `</div>`;
  }
  const stat = (v, l) => `<div class="tstat"><b>${v}</b><span>${l}</span></div>`;
  view().innerHTML = `<button class="link" id="bx" style="padding:0">‹ Today</button>
  <div class="thead"><span class="tic">${tr.icon}</span><div class="grow"><h1 style="margin:0">${esc(tr.title)}</h1>
    <div class="small muted">${gateBadge(tr.days)} ${tr.days ? `${LF.gateRank(tr.days)}-rank gate · ${tr.days} days` : "No end"} · ${LF.STATS[tr.stat][0]} ${LF.STATS[tr.stat][1]}${tr.private ? " · 🔒 private" : ""}${tr.hard ? " · hard mode" : ""}${tr.alias ? ` · shown as “${esc(tr.alias)}”` : ""}</div></div></div>
  ${tr.status !== "active" ? `<div class="note">${tr.status === "cleared" ? `🏆 Cleared on ${fmtDate(tr.ended)}` : tr.status === "failed" ? `Gate failed on ${fmtDate(tr.ended)}. ${esc((st.events.at(-1) || {}).txt || "")}` : "Archived"}</div>` : ""}
  <div class="card"><div class="row" style="gap:14px;align-items:center">${ringSVG(frac, "var(--blue)", tr.icon, 64)}
    <div class="grow"><div style="font-weight:800;font-size:calc(18px*var(--fs))">${tr.status === "active" ? trackLine(tr) : tr.status === "cleared" ? "Cleared ✓" : "Ended"}</div>
      ${end ? `<div class="tiny muted">${tr.status === "active" ? `Ends ${fmtDate(end, { day: "numeric", month: "long" })}` : ""}</div>` : ""}
      ${st.cracked ? `<div class="small crk">${crackText(tr)}</div>` : ""}</div></div>
    ${tr.status === "active" ? `<div class="qrow solo">${questAction(tr)}</div>` : ""}
    <div class="tstats">${tr.kind === "daily" || tr.kind === "abstain" ? stat(st.run, "current run") + stat(Math.max(st.best, st.run), "best run") + stat(st.good, tr.kind === "abstain" ? "clean days" : "days done") : tr.kind === "target" ? stat(LF.totalCount(tr), `${tr.unit} logged`) + stat(st.good, "weeks hit") + stat(st.bad, "weeks missed") : stat(tr.steps.filter(s => s.d).length + " / " + tr.steps.length, "steps")}${stat(shieldsUsed, "🛡 used")}</div></div>
  ${tr.kind === "milestone" ? `<div class="card">${tr.steps.map((s, i) => `<label class="toggle"><span>${s.d ? "✅" : "⬜"} ${esc(s.t)}${s.d ? ` <span class="tiny muted">${fmtDate(s.d)}</span>` : ""}</span><input type="checkbox" data-step="${i}" ${s.d ? "checked" : ""} ${tr.status !== "active" ? "disabled" : ""}></label>`).join("")}</div>` : ""}
  ${cal ? `<div class="card"><div class="sys-h">Calendar</div>${cal}<div class="tiny muted lleg"><span><i class="ok"></i>done</span><span><i class="bad"></i>missed / slipped</span><span><i class="sh">🛡</i>shield</span></div></div>` : ""}
  ${tr.kind === "target" && tr.status === "active" ? `<div class="row" style="gap:8px"><button class="btn ghost grow" id="m1" style="margin:0">−1 today</button><button class="btn grow" data-add="${tr.id}" style="margin:0">+1 ${esc(tr.unit)}</button></div>` : ""}
  ${tr.kind === "abstain" && tr.status === "active" ? `<button class="btn ghost sosbtn" data-sos="${tr.id}">🆘 Urge SOS</button>` : ""}
  ${tr.why ? `<div class="card"><div class="sys-h">Why I'm doing this</div><p style="margin:0">${esc(tr.why)}</p></div>` : ""}
  ${st.events.length ? `<div class="card"><div class="sys-h">History</div>${st.events.slice(-8).reverse().map(e => `<div class="small" style="margin:4px 0"><span class="muted">${fmtDate(e.d)}</span> · ${esc(e.txt)}</div>`).join("")}</div>` : ""}
  <div class="row" style="gap:8px;margin-top:6px"><button class="btn ghost grow" id="ed" style="margin:0">Edit</button>
    ${tr.status === "active" ? `<button class="btn ghost grow" id="gu" style="margin:0">Give up</button>` : `<button class="btn grow" id="re" style="margin:0">Re-enter the gate</button>`}</div>`;
  window.scrollTo(0, 0);
  const v = view(), rr = () => lifeTrack(id);
  v.querySelector("#bx").onclick = () => (location.hash = "#/home");
  wireQuests(v, rr);
  v.querySelectorAll("[data-step]").forEach(c => (c.onchange = () => { LF.toggleStep(tr, +c.dataset.step); LF.settleAll(); rr(); }));
  const m1 = v.querySelector("#m1"); if (m1) m1.onclick = () => { if (+tr.log[t] > 0) { LF.logUnits(tr, -1); rr(); } };
  v.querySelector("#ed").onclick = () => editTrackSheet(tr, rr);
  const gu = v.querySelector("#gu"); if (gu) gu.onclick = () => sheet(`<h2 style="margin-top:0">Give up this gate?</h2><p class="small">It moves to your record as ended. You keep the XP you earned.</p>
    <button class="btn" id="y" style="background:var(--red)">Give up</button><button class="btn ghost" id="n">Keep going</button>`, el => {
    el.querySelector("#y").onclick = () => { tr.status = "archived"; tr.ended = t; tr.seen = true; save(); closeSheet(); location.hash = "#/home"; };
    el.querySelector("#n").onclick = closeSheet; });
  const re = v.querySelector("#re"); if (re) re.onclick = () => { const nt = LF.reenter(tr); tr.seen = true; save(); toast("Gate re-entered. Day 1."); location.hash = "#/track/" + nt.id; };
}
function editTrackSheet(tr, done) {
  sheet(`<h2 style="margin-top:0">Edit</h2><label class="f">Name</label><input id="ti" value="${esc(tr.title)}" maxlength="60">
    <label class="f">Name on widgets and in Party</label><input id="al" value="${esc(tr.alias || "")}" placeholder="optional">
    <label class="toggle">Private <input type="checkbox" id="pv" ${tr.private ? "checked" : ""}></label>
    <label class="f">Why</label><textarea id="wy" rows="2">${esc(tr.why || "")}</textarea>
    <label class="f">Penalty quest</label><input id="pq" value="${esc(tr.penalty || "")}">
    <label class="f">Icon</label><div class="icons">${ICONS.map(i => `<button class="ico ${tr.icon === i ? "on" : ""}" data-i="${i}">${i}</button>`).join("")}</div>
    <button class="btn" id="ok">Save</button><button class="btn ghost" id="cx">Cancel</button>`, el => {
    let icon = tr.icon;
    el.querySelectorAll("[data-i]").forEach(b => (b.onclick = () => { icon = b.dataset.i; el.querySelectorAll("[data-i]").forEach(x => x.classList.toggle("on", x === b)); }));
    el.querySelector("#ok").onclick = () => {
      const ti = el.querySelector("#ti").value.trim(); if (!ti) return toast("Give it a name");
      Object.assign(tr, { title: ti, alias: el.querySelector("#al").value.trim(), private: el.querySelector("#pv").checked, why: el.querySelector("#wy").value, penalty: el.querySelector("#pq").value, icon });
      save(); closeSheet(); done();
    };
    el.querySelector("#cx").onclick = closeSheet;
  });
}
function radarSVG(vals, max) {
  const keys = Object.keys(LF.STATS), cx = 110, cy = 105, R = 78, pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / keys.length; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const ring = f => keys.map((_, i) => pt(i, R * f).join(",")).join(" ");
  const poly = keys.map((k, i) => pt(i, R * Math.max(0.06, Math.min(1, (vals[k] || 0) / max))).join(",")).join(" ");
  return `<svg viewBox="0 0 220 210" class="radar" role="img" aria-label="Stats">${[0.25, 0.5, 0.75, 1].map(f => `<polygon points="${ring(f)}" class="rg"/>`).join("")}
    ${keys.map((_, i) => `<line x1="${cx}" y1="${cy}" x2="${pt(i, R)[0]}" y2="${pt(i, R)[1]}" class="rg"/>`).join("")}<polygon points="${poly}" class="rv"/>
    ${keys.map((k, i) => { const [x, y] = pt(i, R + 18); return `<text x="${x}" y="${y + 4}" text-anchor="middle" class="rl">${LF.STATS[k][0]} ${vals[k] || 0}</text>`; }).join("")}</svg>`;
}
function otherXP() {
  let n = 0;
  try { for (const k of Object.keys(localStorage)) if (k.startsWith(`a1.state.${USER}`) && !k.endsWith(`@${COURSE}`)) n += Object.values((JSON.parse(localStorage.getItem(k) || "{}").xp) || {}).reduce((a, b) => a + b, 0); } catch { /* ignore */ }
  return n;
}
function lifeHunter() {
  const h = LF.H(), hu = hunter(), vals = h.stats, max = Math.max(50, ...Object.values(vals));
  const N = window.LevelUpNative, rem = N && N.setLifeReminder;
  let remAt = ""; try { remAt = localStorage.getItem("a1.lifeRem") || ""; } catch { /* ignore */ }
  view().innerHTML = topRow() + lifeNav("hunter") + `
  <div class="card" style="text-align:center"><div style="display:inline-block">${rankEmblem(Math.min(100, hu.lv), "big", hu.rk)}</div>
    <div style="font-weight:900;font-size:calc(22px*var(--fs));margin-top:6px">${hu.rk}-Rank Hunter · Level ${hu.lv}</div>
    <div class="hbar" style="margin:8px 0 4px"><div style="width:${100 * hu.frac}%"></div></div><div class="tiny muted">${hu.into} / ${hu.need} XP to level ${hu.lv + 1} · Hunter XP ${LF.totalLifeXP()}</div>
    ${h.titles.length ? `<div class="chips" style="justify-content:center;margin-top:10px">${h.titles.map(t => `<span class="chipx on">🏅 ${esc(t)}</span>`).join("")}</div>` : ""}</div>
  <div class="card"><div class="sys-h">Stats</div>${radarSVG(vals, max)}<p class="tiny muted" style="text-align:center;margin:0">Each gate trains one stat. A balanced shape beats one huge spike.</p></div>
  <div class="card"><div class="tstats">${[[h.cleared, "gates cleared"], [Object.values(S.tracks).filter(t => t.status === "failed").length, "gates failed"], [streak(), "day streak"], [LF.totalLifeXP() + otherXP(), "all XP (incl. learning)"]].map(([v, l]) => `<div class="tstat"><b>${v}</b><span>${l}</span></div>`).join("")}</div></div>
  <div class="card"><div class="row"><div class="grow"><b>🛡 Shields: ${h.shields} / ${LF.SHIELD_MAX}</b><div class="small muted">Cover a missed day. Earn by clearing D-rank gates; buy at most once every 2 weeks.</div></div><button class="btn ghost sm" id="shl" style="width:auto;margin:0">Details</button></div></div>
  <div class="card"><label class="toggle"><span><b>⚡ System mode</b><div class="small muted">A missed day gives you a penalty quest for the next day. Doing it heals the crack at once.</div></span><input type="checkbox" id="sys" ${h.system ? "checked" : ""}></label>
    ${rem ? `<label class="f">Daily reminder (this phone)</label><select id="rem"><option value="">Off</option>${["07:00", "08:00", "12:00", "18:00", "20:00", "21:00", "22:00"].map(x => `<option ${remAt === x ? "selected" : ""}>${x}</option>`).join("")}</select>
      <p class="tiny muted" style="margin:4px 0 0">Only if some of today's quests are still open.</p>` : ""}</div>
  <div class="card"><div class="sys-h">Log</div>${h.log.slice(-10).reverse().map(e => `<div class="small" style="margin:3px 0"><span class="muted">${fmtDate(e.d)}</span> · ${esc(e.why)}${e.n ? ` <b>${e.n > 0 ? "+" : ""}${e.n} XP</b>` : ""}</div>`).join("") || `<p class="muted small" style="margin:0">Nothing yet.</p>`}</div>`;
  wireTop();
  view().querySelector("#shl").onclick = () => shieldSheet(lifeHunter);
  view().querySelector("#sys").onchange = e => { h.system = e.target.checked; save(); toast(h.system ? "⚡ System mode on: penalties are real now" : "System mode off"); };
  const r = view().querySelector("#rem");
  if (r) r.onchange = () => { try { localStorage.setItem("a1.lifeRem", r.value); } catch { /* ignore */ } N.setLifeReminder(r.value); toast(r.value ? `Reminder at ${r.value}` : "Reminder off"); };
}
// widget ticks made on the home screen (native app): applied when Hunter's Path opens
function applyWidgetTicks() {
  const N = window.LevelUpNative; if (!N || !N.takeLifeTicks) return;
  let ticks = []; try { ticks = JSON.parse(N.takeLifeTicks() || "[]"); } catch { return; }
  for (const k of ticks) { const tr = S.tracks[k.id]; if (tr && tr.status === "active" && LF.dayValue(tr, k.d) !== true) LF.checkIn(tr, k.d, true); }
  if (ticks.length) toast(`${ticks.length} check-in${ticks.length > 1 ? "s" : ""} from the widget saved`);
}
function lifeCompare(box, people, all) {
  const row = id => { const st = all[id] || {}, xp = Object.values(st.xp || {}).reduce((a, b) => a + b, 0), lv = LF.hunterLevel(xp).lv;
    const tr = Object.values(st.tracks || {}); return { lv, rank: LF.hunterRank(lv), cleared: (st.hunter || {}).cleared || 0, open: tr.filter(t => t.status === "active").length, xp,
      pub: tr.filter(t => t.status === "active" && !t.private) }; };
  const rows = people.map(u => ({ u, s: row(u.id) })), best = k => Math.max(...rows.map(r => r.s[k]));
  const cell = (r, k, f = v => v) => `<td class="${r.s[k] === best(k) && best(k) > 0 ? "lead" : ""}"><b>${f(r.s[k], r.s)}</b></td>`;
  const mine = new Set(LF.active().map(t => t.party || "").filter(Boolean));
  box.innerHTML = `<div class="card"><div class="sys-h">Hunter's Path</div><table class="cmp"><tr><th></th>${rows.map(r => `<th>${avatar(r.u.id, true)}<div class="tiny">${esc(r.u.name)}</div></th>`).join("")}</tr>
    <tr><td>Level</td>${rows.map(r => cell(r, "lv", (v, s) => `${v} · ${s.rank}`)).join("")}</tr><tr><td>Gates cleared</td>${rows.map(r => cell(r, "cleared")).join("")}</tr>
    <tr><td>Open gates</td>${rows.map(r => cell(r, "open")).join("")}</tr><tr><td>Hunter XP</td>${rows.map(r => cell(r, "xp")).join("")}</tr></table></div>
    ${rows.filter(r => r.u.id !== USER && r.s.pub.length).map(r => `<div class="card"><div class="sys-h">${esc(r.u.name)}'s gates</div>${r.s.pub.map(t => `<div class="recrow"><span>${t.icon}</span>
      <span class="grow">${esc(t.alias || t.title)} ${gateBadge(t.days)}<div class="tiny muted">${t.days ? `Day ${Math.min(t.days, daysBetween(t.start, today()) + 1)} / ${t.days}` : "No end"} · run ${(t.st || {}).run || 0}</div></span>
      ${mine.has(`${r.u.id}:${t.id}`) ? `<span class="tiny okc">Joined ✓</span>` : `<button class="btn sm" data-join="${r.u.id}:${t.id}" style="width:auto;margin:0">Join</button>`}</div>`).join("")}</div>`).join("")}`;
  box.querySelectorAll("[data-join]").forEach(b => (b.onclick = () => {
    const [uid, tid] = b.dataset.join.split(":"), src = ((all[uid] || {}).tracks || {})[tid]; if (!src) return;
    const tr = LF.newTrack({ ...src, private: false, party: b.dataset.join, steps: (src.steps || []).map(s => s.t || s) });
    toast(`Joined ${esc(src.alias || src.title)} · Day 1`); b.outerHTML = `<span class="tiny okc">Joined ✓</span>`;
  }));
}
// what the "Hunter's Path" widget shows (native app); private tracks show their alias or a neutral name
function lifeSnapshot() {
  LF.H(); const t = today(), hu = hunter();
  const items = LF.todayList().map(tr => ({ id: tr.id, icon: tr.icon, title: tr.private ? (tr.alias || "Private quest") : LF.shown(tr), kind: tr.kind,
    done: LF.doneToday(tr, t), tickable: (tr.kind === "daily" && !tr.amount && !tr.auto) || tr.kind === "abstain", slip: tr.log[t] === "slip",
    line: trackLine(tr), cracked: !!tr.st.cracked, day: Math.min(LF.dayNo(tr, t), tr.days || 9999), days: tr.days || 0 }));
  return { items, level: hu.lv, rank: hu.rk, frac: hu.frac, shields: LF.H().shields, streak: streak(), gems: S.gems || 0, open: items.filter(i => !i.done).length };
}

function lifeSteps() {
  return [
    { title: "Welcome to Hunter's Path ⚔️", text: "Your own goals as quests and dungeons: habits to build, things to quit, targets and big goals. Tap <b>Show me</b>." },
    { sel: ".hcard", title: "Your Hunter level", text: "Every check-in earns XP. Level up and climb from E-Rank to S-Rank. 🛡 shields, 🔥 streak and 💎 diamonds sit here." },
    { sel: ".lnav", title: "Today · Gates · Hunter · Party", text: "<b>Today</b> has your check-ins. <b>Gates</b> is the board of challenges. <b>Hunter</b> shows your stats. <b>Party</b> lets friends join your gates." },
    { sel: ".sysq", title: "Daily quests", text: "One tap per quest each day. Finish them all for 💎 2. Missed yesterday? You can still answer it until midnight." },
    { sel: "#shl", title: "Shields 🛡", text: "A shield covers one missed day. Earn them by clearing gates; you can buy one only every 2 weeks. No shield? The run cracks ⚠ and heals after a week of good days." },
    { sel: ".lnav a[href='#/gates']", title: "Open a gate", text: "Pick a ready-made challenge (30 days without porn, a book a week, gym 3× a week…) or build your own." },
    { title: "You're ready 🎉", text: `Open the gate board and enter your first gate.<br><button class="link" data-guide style="padding:0;margin-top:6px">📘 Read how Hunter's Path works</button>` },
  ];
}
function lifeGuide() {
  const sec = (icon, title, body) => `<section class="gsec"><h2><span>${icon}</span>${title}</h2>${body}</section>`;
  const idea = (n, icon, t, d) => `<div class="gidea"><div class="gn">${n}</div><div class="grow"><b>${icon} ${t}</b><div class="muted small">${d}</div></div></div>`;
  const tip = (ok, t) => `<li class="${ok ? "do" : "dont"}"><span>${ok ? "✓" : "✗"}</span><div>${t}</div></li>`;
  view().innerHTML = `<div class="guide"><button class="link" id="gback" style="padding:0;margin-bottom:6px">‹ Back</button>
  <div class="ghero"><div class="gh-i">⚔️</div><h1>How Hunter's Path works</h1><p class="muted">Your own goals, played like Solo Leveling. A 2-minute read.</p></div>
  ${sec("🎯", "What it's for", `<p>Set goals for your life, not just your lessons: build a habit, quit something, hit a target, reach a big goal. Each one is a <b>gate</b> (a dungeon) you enter, check in on every day, and clear.</p>`)}
  ${sec("🧩", "Four kinds of gate", `
    ${idea(1, "✅", "Daily", "Do it on set days: read 20 minutes, 50 push-ups, meditate.")}
    ${idea(2, "🛡", "Quit", "A clean run: no porn, no sugar, no phone after 22:00. Check in “still clean” each day.")}
    ${idea(3, "🎯", "Target", "An amount per week or in total: 1 book a week, gym 3 times a week.")}
    ${idea(4, "🏔", "Big goal", "Steps by a date: run a 10K.")}`)}
  ${sec("🌀", "Gates and ranks", `<p>Longer gates rank higher: <b>E</b> 7 days, <b>D</b> 14, <b>C</b> 30, <b>B</b> 60, <b>A</b> 90, <b>S</b> 180. Clearing one pays XP and 💎, and D-rank or higher also gives a 🛡 shield. Fail a gate and you keep the XP you earned; re-enter it right away.</p>`)}
  ${sec("🛡", "Shields and cracks", `<ul class="gtips">
    ${tip(true, "A <b>shield</b> covers one missed or slipped day automatically, so the run goes on.")}
    ${tip(true, "Hold at most <b>2</b>. Earn them by clearing gates; buy one with 💎 <b>at most once every 2 weeks</b>.")}
    ${tip(true, "No shield? The run <b>cracks ⚠</b>. A crack heals by itself after <b>7 good days</b> in a row (2 good weeks for weekly targets).")}
    ${tip(false, "Miss <b>twice in a row</b>, or again while cracked, and the run breaks. Shields never cover two days in a row, or the same gate twice in a week.")}</ul>`)}
  ${sec("🆘", "Hard goals", `<p>Quit gates can be <b>private</b> and shown under a neutral name. When an urge hits, the <b>Urge SOS</b> button gives you 90 seconds of breathing, your own reason, and a quick task. A slip is met with support, not shame: your best run and calendar stay. If it feels bigger than a habit, talk to a doctor or counsellor; LevelUp isn't a medical tool.</p>`)}
  ${sec("🏆", "Tips", `<ul class="gtips">
    ${tip(true, "Start with one or two gates. Add more once they feel easy.")}
    ${tip(true, "Check in at the same time every day, for example before bed.")}
    ${tip(true, "Write your <b>why</b>. It's shown when it gets hard.")}
    ${tip(true, "Turn on <b>System mode</b> on the Hunter page if you want penalty quests after a miss.")}
    ${tip(false, "Don't tick quests you didn't do. The only person it fools is you.")}</ul>`)}
  <div class="gend"><a class="btn" href="#/gates" style="display:block;text-align:center;text-decoration:none">🌀 Open the gate board</a><button class="btn ghost" data-tour>🧭 Take the 30-second tour</button></div></div>`;
  window.scrollTo(0, 0);
  view().querySelector("#gback").onclick = () => (window.history.length > 1 ? window.history.back() : (location.hash = "#/home"));
}

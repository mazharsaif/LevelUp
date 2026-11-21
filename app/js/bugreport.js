// "Report a bug" button on every screen (alpha testing).
// Tapping it snapshots the screen (route, visible text, layout HTML, lesson step, recent JS errors)
// BEFORE the report box opens, then sends the snapshot + the tester's note to the Mac (POST /api/bugs).
// If the Mac can't be reached, the report waits on the phone and is sent later.
import { S, USER, COURSE, courseInfo } from "./store.js";
import { lessonDebug } from "./lesson.js";

const QUEUE = "a1.bugQueue", DRAFT = "a1.bugDraft"; // draft: text + kind kept until sent (feedback 11-20: going back lost it)
const getDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT) || "null") || { text: "", kind: "bug" }; } catch { return { text: "", kind: "bug" }; } };
const setDraft = d => { try { d && d.text.trim() ? localStorage.setItem(DRAFT, JSON.stringify(d)) : localStorage.removeItem(DRAFT); } catch { /* storage blocked */ } };
const errors = [];                       // last few JS errors, newest last
const pushErr = (msg) => { errors.push({ at: new Date().toISOString(), msg: String(msg).slice(0, 500) }); if (errors.length > 10) errors.shift(); };
window.addEventListener("error", e => pushErr(`${e.message} @ ${(e.filename || "").split("/").pop()}:${e.lineno}`));
window.addEventListener("unhandledrejection", e => pushErr(`Unhandled: ${e.reason && (e.reason.stack || e.reason.message) || e.reason}`));
const origErr = console.error.bind(console);
console.error = (...a) => { pushErr(a.map(x => (x && x.stack) || String(x)).join(" ")); origErr(...a); };

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clip = (s, n) => (s || "").replace(/\n{3,}/g, "\n\n").trim().slice(0, n);

function pageName() {
  const h = (location.hash || "#/today").replace(/^#\//, "");
  const head = document.querySelector("#view .q-title, #view h1, #view h2, #view .sys-h");
  const lesson = lessonDebug();
  if (lesson) return `Lesson: ${lesson.title} · step ${lesson.step}/${lesson.of} (${lesson.type})`;
  const route = h.split("/")[0] || "today";
  return head ? `${route} · ${head.textContent.trim().slice(0, 60)}` : route;
}

function capture() {
  const view = document.getElementById("view"), sheet = document.getElementById("sheet-root");
  let course = COURSE;
  try { course = courseInfo(COURSE).title + ` (${COURSE})`; } catch { /* ignore */ }
  return {
    capturedAt: new Date().toISOString(),
    page: pageName(),
    url: location.href,
    user: USER || null,
    course,
    lesson: lessonDebug(),
    settings: S ? { theme: S.settings.theme, goalMode: S.settings.goalMode, quest: S.settings.quest !== false, speak: S.settings.speak !== false,
      autoplay: S.settings.autoplay, sound: S.settings.sound, startDate: S.settings.startDate, targetDate: S.settings.targetDate } : null,
    viewport: `${innerWidth}x${innerHeight} @${devicePixelRatio}x`,
    scrollY: Math.round(scrollY),
    online: navigator.onLine,
    userAgent: navigator.userAgent,
    screenText: clip(view && view.innerText, 8000),
    sheetText: clip(sheet && sheet.innerText, 3000),
    screenHtml: ((view ? view.outerHTML : "") + (sheet && sheet.innerHTML ? "\n<!-- sheet -->\n" + sheet.innerHTML : "")).slice(0, 200000),
    bodyClass: document.body.className,
    errors: [...errors],
  };
}

// The FastAPI server (port 8766) stores reports. If the app is opened from another server on the same Mac
// (e.g. the old one on 8765, which has no /api/bugs), send the report to the FastAPI server instead.
// Which app and which device the report comes from (feedback 11-21: app type, versions, device were missing).
function appKind() {
  if (window.LevelUpNative || /LevelUpNative\//.test(navigator.userAgent)) return "native-android";       // native Kotlin app (WebView)
  let apk = /[?&]src=apk\b/.test(location.search) || document.referrer.startsWith("android-app://");
  try { apk = apk || sessionStorage.getItem("a1.apk") === "1"; } catch { /* ignore */ }
  if (apk) return "android-apk";                                                                          // TWA (web wrapper APK)
  if (navigator.standalone === true) return "ios-home-screen";
  if (matchMedia("(display-mode: standalone)").matches) return "installed-pwa";
  return "browser";
}
const within = (p, ms = 1500) => Promise.race([Promise.resolve(p).catch(() => null), new Promise(r => setTimeout(() => r(null), ms))]);
async function envInfo() {
  const N = window.LevelUpNative, c = navigator.connection || {};
  const [hints, storage, mic, shell] = await Promise.all([
    within(navigator.userAgentData && navigator.userAgentData.getHighEntropyValues(["model", "platform", "platformVersion", "fullVersionList"])),
    within(navigator.storage && navigator.storage.estimate && navigator.storage.estimate()),
    within(navigator.permissions && navigator.permissions.query({ name: "microphone" }).then(p => p.state)),
    within("caches" in window && caches.keys().then(ks => ks.filter(k => /shell/.test(k)).join(","))),
  ]);
  let native = null;
  try { native = N && N.deviceInfo ? JSON.parse(N.deviceInfo()) : N ? { appVersion: N.version && N.version() } : null; } catch { /* old APK */ }
  const mb = n => (n == null ? null : Math.round(n / 1048576));
  return {
    app: appKind(),
    webVersion: window.__luVersion || null,                 // release the page was loaded with (/api/health at start)
    swCache: shell || null,                                 // app-shell cache on this device, e.g. a1-shell-v50
    swControlled: !!(navigator.serviceWorker && navigator.serviceWorker.controller),
    native,                                                 // native app: manufacturer, model, Android, APK version, mic, speech
    device: hints ? { model: hints.model || null, platform: hints.platform, platformVersion: hints.platformVersion,
      browser: (hints.fullVersionList || []).map(b => `${b.brand} ${b.version}`).filter(b => !/Not.A.Brand/i.test(b)).join(", ") } : null,
    screen: `${screen.width}x${screen.height}`, touch: navigator.maxTouchPoints || 0,
    cpuCores: navigator.hardwareConcurrency || null, memoryGB: navigator.deviceMemory || null,
    language: navigator.language, languages: (navigator.languages || []).slice(0, 4),
    timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return null; } })(),
    colorScheme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    connection: c.effectiveType ? { type: c.type || null, effective: c.effectiveType, downlinkMbps: c.downlink, saveData: !!c.saveData } : null,
    storageMB: storage ? { used: mb(storage.usage), quota: mb(storage.quota) } : null,
    mic: native && native.micGranted != null ? (native.micGranted ? "granted" : "not granted") : mic,
    speechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
  };
}
function bugPort() { try { return localStorage.getItem("a1.bugPort") || "8766"; } catch { return "8766"; } }
async function send(report) {
  const urls = ["api/bugs"];
  if (location.port && location.port !== bugPort()) urls.push(`http://${location.hostname}:${bugPort()}/api/bugs`);
  let last = new Error("unreachable");
  for (const u of urls) {
    try {
      const r = await fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(report) });
      if (r.ok) return (await r.json()).id;
      last = new Error("HTTP " + r.status);
    } catch (e) { last = e; }
  }
  throw last;
}
const readQ = () => { try { return JSON.parse(localStorage.getItem(QUEUE) || "[]"); } catch { return []; } };
const writeQ = q => { try { q.length ? localStorage.setItem(QUEUE, JSON.stringify(q)) : localStorage.removeItem(QUEUE); } catch { /* storage full or blocked */ } };
export async function flushBugQueue() {
  const q = readQ(); if (!q.length) return;
  const left = [];
  for (const rep of q) { try { await send(rep); } catch { left.push(rep); } }
  writeQ(left);
}

function openBox() {
  if (document.getElementById("bug-root")) return;
  const snap = capture(), draft = getDraft();             // screen as it was when tapped
  const root = document.createElement("div");
  root.id = "bug-root";
  root.innerHTML = `<div class="bug-bg"><div class="bug-box" role="dialog" aria-label="Send feedback">
    <div class="bug-h">💬 Send feedback</div>
    <div class="bug-page">On: <b>${esc(snap.page)}</b></div>
    <div class="bug-kinds">${[["bug", "Something broke"], ["content", "Wrong answer / text"], ["idea", "Idea"]].map(([k, l], i) =>
      `<label><input type="radio" name="bk" value="${k}" ${k === draft.kind || (i === 0 && !["content", "idea"].includes(draft.kind)) ? "checked" : ""}> ${l}</label>`).join("")}</div>
    <textarea id="bug-text" maxlength="4000" placeholder="What happened, or what would make this better?">${esc(draft.text)}</textarea>
    <label class="bug-inc"><input type="checkbox" id="bug-inc" checked> Include what's on the screen (text and layout)</label>
    <div class="bug-msg" id="bug-msg"></div>
    <div class="bug-btns"><button class="bug-cancel" id="bug-cancel">Cancel</button><button class="bug-send" id="bug-send" disabled>Send report</button></div>
  </div></div>`;
  document.body.appendChild(root);
  const $ = s => root.querySelector(s), close = () => root.remove();
  const ta = $("#bug-text"), btn = $("#bug-send");
  const kind = () => root.querySelector("input[name=bk]:checked").value, keep = () => setDraft({ text: ta.value, kind: kind() });
  ta.oninput = () => { btn.disabled = !ta.value.trim(); keep(); };
  root.querySelectorAll("input[name=bk]").forEach(r => (r.onchange = keep));
  btn.disabled = !ta.value.trim();
  $("#bug-cancel").onclick = close;
  $(".bug-bg").onclick = e => { if (e.target === e.currentTarget) close(); };
  setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 60);
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = "Sending…";
    const ctx = $("#bug-inc").checked ? { ...snap } : { page: snap.page, url: snap.url, user: snap.user, course: snap.course, capturedAt: snap.capturedAt, userAgent: snap.userAgent, viewport: snap.viewport, errors: snap.errors };
    try { ctx.env = await envInfo(); } catch { /* never block a report */ }
    const report = { text: ta.value.trim(), category: kind(), ctx };
    setDraft(null); // sent or queued: either way it's safe
    try {
      const id = await send(report);
      $("#bug-msg").textContent = `Thanks! Saved as report ${id}.`;
      flushBugQueue();
    } catch {
      writeQ([...readQ(), report]);
      $("#bug-msg").textContent = "The Mac isn't reachable, so the report is saved on this phone and will be sent automatically later.";
    }
    $(".bug-btns").innerHTML = `<button class="bug-send" id="bug-ok">Done</button>`;
    $("#bug-ok").onclick = close;
  };
}

export function installBugButton() {
  if (document.getElementById("bugbtn")) return;
  const b = document.createElement("button");
  b.id = "bugbtn"; b.type = "button"; b.title = "Report a problem"; b.setAttribute("aria-label", "Report a problem");
  b.textContent = "🐞";
  b.onclick = openBox;
  document.body.appendChild(b);
  flushBugQueue();
  window.addEventListener("online", flushBugQueue);
}

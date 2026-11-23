// Study helper: "Ask about this card" (design: docs/design/chatbot/). A short, capped, free Q&A about the card on screen.
// Entry points: a 💡 Hint chip before you answer, context chips after the feedback screen (B), "More about this" / "Explain simply"
// on teaching and reader cards (C). All share one bottom sheet. The server (server_fastapi/ask.py) enforces the rules; this file is the UI.
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let host = { sheet: null, closeSheet: null, toast: null };
export const setAskHost = h => { host = h; };

let quota = null, quotaAt = 0;          // { enabled, cap, left_today } from /api/ask/quota; null = unknown / not signed in
const JSONH = { "Content-Type": "application/json" };
export async function loadQuota(force) {
  if (!force && Date.now() - quotaAt < 60000) return quota;
  quotaAt = Date.now();
  try {
    const r = await fetch("api/ask/quota", { cache: "no-store" });
    quota = r.ok ? await r.json() : null;
  } catch { /* offline: keep what we had */ }
  return quota;
}
export const askOn = () => !!(quota && quota.enabled);
export const askCap = () => (quota && quota.cap) || 10;

const CHIP_Q = {
  hint: "Give me a hint, but do not tell me the answer.",
  why: "Why is this the answer?",
  example: "Give me one example sentence.",
  register: "Is this formal or informal, and when do I use it?",
  explain: "Explain this simply.",
};
const plain = h => String(h || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// ---- rows that sit on the screen ----
function row(cls, chips, ctxFn) {
  const r = document.createElement("div");
  r.className = "askrow " + cls;
  r.innerHTML = chips.map(([id, label]) => `<button class="askchip" data-c="${id}" type="button">${label}</button>`).join("");
  r.querySelectorAll(".askchip").forEach(b => (b.onclick = () => openAsk(ctxFn(), b.dataset.c, b.dataset.q)));
  return r;
}
/** before the learner answers: only a hint */
export function mountBefore(lb, ctxFn) {
  if (askOn()) lb.appendChild(row("before", [["hint", "💡 Hint"]], ctxFn));
}
/** teaching cards with no answer to wait for */
export function mountExplain(lb, ctxFn, label = "💬 More about this") {
  if (askOn()) lb.appendChild(row("", [["explain", label]], ctxFn));
}
/** under the feedback bar: context chips (made by the app, no model call) + "Ask my own" */
export function mountAfter(f, ctxFn) {
  if (!askOn()) return;
  const c = ctxFn(), chips = [];
  if (c.correct) chips.push(["why", "Why is this the answer?"]);
  const other = (c._options || []).find(o => o && c.correct && plain(o).toLowerCase() !== c.correct.toLowerCase());
  const shown = c.correct || (c.item && c.item.text);
  if (other && shown) chips.push(["compare", `${shown} vs ${plain(other)}?`]);
  chips.push(["example", "Example sentence"]);
  if (c.item && c.item.kind === "phrase") chips.push(["register", "Formal or informal?"]);
  chips.push(["custom", "✏️ Ask my own"]);
  const r = row("after", chips, ctxFn);
  r.querySelectorAll(".askchip").forEach(b => { if (b.dataset.c === "compare") b.dataset.q = `What is the difference between "${shown}" and "${plain(other)}"?`; });
  f.insertBefore(r, f.querySelector("#go"));
}

// ---- the sheet ----
export function openAsk(ctx, firstChip, firstQuestion) {
  if (!host.sheet) return;
  const before = ctx.phase === "before";
  const item = ctx.item || {};
  const chips = before ? [["hint", "💡 Give me a hint"]] : [["why", "Why this answer?"], ["example", "Example"], ["explain", "Explain simply"]].filter(([id]) => id !== "why" || ctx.correct);
  host.sheet(`<div class="asksheet">
    <div class="ask-head"><div class="grow"><div class="ask-item">${esc(before ? "Need a hint?" : item.text || ctx.lesson || "Ask about this card")}</div>
      ${!before && item.meaning ? `<div class="tiny muted">${esc(item.meaning)}</div>` : before ? `<div class="tiny muted">I won't give the answer away. Answer first, then ask more.</div>` : ""}</div>
      <button class="link ask-x" aria-label="Close" type="button">✕</button></div>
    <div class="ask-offline tiny" hidden>Offline. Your question is kept; send it when you're back online.</div>
    <div class="ask-chips">${chips.map(([id, l]) => `<button class="askchip" data-c="${id}" type="button">${l}</button>`).join("")}</div>
    <div class="ask-log" aria-live="polite"></div>
    <form class="ask-input"><input maxlength="140" autocomplete="off" enterkeyhint="send" placeholder="${before ? "Answer first, then ask" : "Ask about this card…"}" ${before ? "disabled" : ""}>
      <button class="ask-send" aria-label="Send" ${before ? "disabled" : ""}>➤</button></form>
    <div class="ask-foot tiny muted"></div></div>`, el => {
    const log = el.querySelector(".ask-log"), inp = el.querySelector("input"), foot = el.querySelector(".ask-foot"), off = el.querySelector(".ask-offline");
    let busy = false, prev = null;
    const left = () => (quota ? quota.left_today : "?");
    const drawFoot = () => { foot.textContent = quota && quota.left_today <= 0 ? "No questions left today. They come back tomorrow." : `${left()} of ${quota ? quota.cap : 10} questions left today · free · answers can be wrong`; };
    const lock = on => { busy = on; el.querySelectorAll(".askchip, .ask-send").forEach(b => (b.disabled = on || (before && b.classList.contains("ask-send")))); if (!before) inp.disabled = on; };
    const bubble = (cls, html) => { const d = document.createElement("div"); d.className = cls; d.innerHTML = html; log.appendChild(d); d.scrollIntoView({ block: "nearest" }); return d; };
    const online = () => { off.hidden = navigator.onLine; };
    window.addEventListener("online", online); window.addEventListener("offline", online); online();

    async function send(question, chipId) {
      if (busy || !question.trim()) return;
      if (!navigator.onLine) { online(); return; }
      if (quota && quota.left_today <= 0) { drawFoot(); return; }
      bubble("ask-q", esc(question));
      const dots = bubble("ask-a ask-dots", `<span></span><span></span><span></span>`);
      lock(true);
      const body = { ...ctx, question, chip_id: chipId, ...(prev ? { prev_q: prev.q, prev_a: prev.a } : {}) };
      delete body._options;
      let j = null;
      try {
        const r = await fetch("api/ask", { method: "POST", headers: JSONH, body: JSON.stringify(body) });
        j = await r.json().catch(() => null);
        if (!j) j = { ok: false, code: "upstream", message: "The helper couldn't answer. Try again." };
      } catch { j = { ok: false, code: "network", message: "No connection. Try again." }; }
      dots.remove();
      if (j.ok) {
        if (quota) quota.left_today = j.left_today;
        prev = { q: question, a: j.answer };
        const a = bubble("ask-a", `<div>${esc(j.answer)}</div><div class="ask-act"><button class="link" data-k="up" aria-label="Helpful" type="button">👍</button>
          <button class="link" data-k="wrong" type="button">🚩 Report wrong</button></div>`);
        a.querySelectorAll("[data-k]").forEach(b => (b.onclick = () => {
          fetch("api/ask/feedback", { method: "POST", headers: JSONH, body: JSON.stringify({ id: j.id, kind: b.dataset.k }) }).catch(() => null);
          a.querySelector(".ask-act").textContent = b.dataset.k === "up" ? "Thanks!" : "Thanks, we'll check this answer.";
        }));
      } else {
        if (j.code === "cap" && quota) quota.left_today = 0;
        const retry = ["upstream", "network", "slow_down"].includes(j.code);
        const e = bubble("ask-a ask-err", `<div>${esc(j.message || "Something went wrong.")}</div>${retry ? `<div class="ask-act"><button class="link" data-r="1" type="button">Try again</button></div>` : ""}`);
        const rb = e.querySelector("[data-r]"); if (rb) rb.onclick = () => { e.previousSibling && e.previousSibling.remove(); e.remove(); send(question, chipId); };
      }
      drawFoot(); lock(false);
      if (quota && quota.left_today <= 0) { inp.disabled = true; el.querySelectorAll(".askchip").forEach(b => (b.disabled = true)); }
    }
    el.querySelectorAll(".askchip").forEach(b => (b.onclick = () => {
      if (b.dataset.c === "custom") { inp.focus(); return; }
      send(CHIP_Q[b.dataset.c] || b.textContent, b.dataset.c);
    }));
    el.querySelector(".ask-x").onclick = () => host.closeSheet();
    el.querySelector("form").onsubmit = e => { e.preventDefault(); const q = inp.value.trim(); inp.value = ""; send(q, "custom"); };
    drawFoot();
    if (firstChip && firstChip !== "custom") send(firstQuestion || CHIP_Q[firstChip] || "Explain this simply.", firstChip);
    else if (firstChip === "custom" && !before) setTimeout(() => inp.focus(), 150);
    // keep the input above the on-screen keyboard
    if (window.visualViewport) { const fit = () => { el.style.maxHeight = Math.round(window.visualViewport.height * 0.9) + "px"; }; window.visualViewport.addEventListener("resize", fit); fit(); }
  });
}

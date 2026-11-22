// Welcome tour: a spotlight that glides between real parts of the screen, with a short explanation bubble.
// Fast on purpose (feedback 11-22: "animated, but faster"): ~200 ms moves, no waiting between steps.
// steps: [{ sel | find(), title, text, place? }]; a step whose element is missing or hidden is skipped,
// a step without sel/find shows the bubble in the middle (welcome / finish).
let live = null;

const visible = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
const target = s => (s.find ? s.find() : s.sel ? [...document.querySelectorAll(s.sel)].find(visible) : null) || null;

export const tourRunning = () => !!live;

export function startTour(steps, { onDone, finishLabel = "Let's go" } = {}) {
  endTour(false);
  const list = steps.filter(s => !(s.sel || s.find) || target(s));
  if (!list.length) return;
  const root = document.createElement("div");
  root.className = "tour"; root.setAttribute("role", "dialog"); root.setAttribute("aria-live", "polite");
  root.innerHTML = `<div class="tour-hole"></div><div class="tour-bubble"><div class="tour-top"><span class="tour-n"></span><button class="tour-skip" type="button">Skip tour</button></div>
    <div class="tour-t"></div><div class="tour-x"></div><div class="tour-foot"><div class="tour-dots"></div>
    <button class="tour-back" type="button">Back</button><button class="tour-next" type="button">Next</button></div></div>`;
  document.body.appendChild(root);
  document.body.classList.add("touring");
  const hole = root.querySelector(".tour-hole"), bub = root.querySelector(".tour-bubble");
  let i = 0;
  const finish = done => endTour(done);
  live = { root, onDone, key: e => {
    if (e.key === "Escape") finish(true);
    else if (e.key === "ArrowRight" || e.key === "Enter") go(i + 1);
    else if (e.key === "ArrowLeft") go(i - 1);
  }, resize: () => place(false) };
  function place(animate = true) {
    const s = list[i], el = target(s);
    root.classList.toggle("tour-center", !el);
    if (!animate) { hole.style.transition = bub.style.transition = "none"; } else { hole.style.transition = bub.style.transition = ""; }
    if (!el) { hole.style.cssText += ";left:50%;top:45%;width:0;height:0"; positionBubble(null); return; }
    const r = el.getBoundingClientRect(), pad = 6;
    const rad = Math.min(22, Math.max(10, Math.min(r.width, r.height) / 2 + pad));
    Object.assign(hole.style, { left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + 2 * pad + "px", height: r.height + 2 * pad + "px", borderRadius: rad + "px" });
    positionBubble(r, s.place);
  }
  function positionBubble(r, pref) {
    const W = innerWidth, H = innerHeight, bw = Math.min(330, W - 24);
    bub.style.width = bw + "px";
    const bh = bub.offsetHeight || 170;
    let top, left;
    if (!r) { top = (H - bh) / 2; left = (W - bw) / 2; bub.dataset.arrow = ""; }
    else {
      const below = H - r.bottom, above = r.top;
      const down = pref === "above" ? false : pref === "below" ? true : below >= bh + 24 || below >= above;
      top = down ? r.bottom + 14 : r.top - bh - 14;
      top = Math.max(10, Math.min(H - bh - 10, top));
      left = Math.max(12, Math.min(W - bw - 12, r.left + r.width / 2 - bw / 2));
      bub.dataset.arrow = down ? "up" : "down";
      bub.style.setProperty("--ax", Math.max(18, Math.min(bw - 18, r.left + r.width / 2 - left)) + "px");
    }
    bub.style.left = left + "px"; bub.style.top = top + "px";
  }
  function go(n) {
    if (n < 0) return;
    if (n >= list.length) return finish(true);
    i = n;
    const s = list[i], el = target(s);
    if (el) {           // bring it on screen first (instantly; the spotlight move is the animation)
      const r = el.getBoundingClientRect();
      if (r.top < 70 || r.bottom > innerHeight - 90) el.scrollIntoView({ block: "center", behavior: "instant" });
    }
    root.querySelector(".tour-n").textContent = `${i + 1} / ${list.length}`;
    root.querySelector(".tour-t").textContent = s.title;
    root.querySelector(".tour-x").innerHTML = s.text;
    root.querySelector(".tour-dots").innerHTML = list.map((_, k) => `<i class="${k === i ? "on" : k < i ? "past" : ""}"></i>`).join("");
    root.querySelector(".tour-back").hidden = i === 0;
    root.querySelector(".tour-next").textContent = i === list.length - 1 ? finishLabel : i === 0 ? "Show me" : "Next";
    bub.classList.remove("tour-in"); void bub.offsetWidth; bub.classList.add("tour-in");
    place(true);
  }
  root.querySelector(".tour-next").onclick = () => go(i + 1);
  root.querySelector(".tour-back").onclick = () => go(i - 1);
  root.querySelector(".tour-skip").onclick = () => finish(true);
  root.addEventListener("click", e => { if (!bub.contains(e.target)) go(i + 1); });   // tap anywhere else: next
  addEventListener("keydown", live.key); addEventListener("resize", live.resize);
  requestAnimationFrame(() => { root.classList.add("tour-on"); go(0); });
}

export function endTour(done = true) {
  if (!live) return;
  const { root, onDone, key, resize } = live; live = null;
  removeEventListener("keydown", key); removeEventListener("resize", resize);
  document.body.classList.remove("touring");
  root.classList.remove("tour-on"); setTimeout(() => root.remove(), 160);
  if (done && onDone) onDone();
}

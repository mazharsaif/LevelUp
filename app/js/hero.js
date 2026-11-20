// Aura + rank emblem. The aura (0 → 1) grows with level and tints the whole Hunter theme purple.
// There is no character: the learner's rank letter (E → D → C → B → A → S) is the emblem, and its purple aura
// creeps in as the level rises (11-20, replaced the Hunter/Huntress figure).
export const AURA_FULL_LEVEL = 100; // aura is fully violet when A1 is reached
export const aura = lv => Math.max(0, Math.min(1, (lv - 1) / (AURA_FULL_LEVEL - 1)));

export function applyAura(lv) {
  const a = aura(lv);
  document.body.style.setProperty("--aura", a.toFixed(3));
  particles(a);
}

// Purple particles creep in from ~level 16 and thicken towards level 100.
// Drawn on a click-through layer above the content so they are actually visible.
let fxCount = -1;
function particles(a) {
  let fx = document.getElementById("aura-fx");
  if (!fx) { fx = document.createElement("div"); fx.id = "aura-fx"; fx.setAttribute("aria-hidden", "true"); document.body.appendChild(fx); }
  const n = a < 0.15 ? 0 : 2 + Math.round(((a - 0.15) / 0.85) * 36);
  fx.style.setProperty("--a", a.toFixed(3));
  if (n === fxCount) return;
  fxCount = n;
  let h = "";
  for (let i = 0; i < n; i++) {
    const r = (k) => { const x = Math.sin((i + 1) * 12.9898 * (k + 1)) * 43758.5453; return x - Math.floor(x); }; // stable pseudo-random
    const size = 3 + r(1) * 6 * (0.6 + a * 0.6);
    const dur = 9 + r(2) * 10;
    const op = (0.35 + r(3) * 0.5) * (0.5 + a * 0.5);
    h += `<span class="pt" style="left:${(r(0) * 100).toFixed(1)}%;width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;--o:${op.toFixed(2)};--dx:${((r(4) - 0.5) * 80).toFixed(0)}px;animation-duration:${dur.toFixed(1)}s;animation-delay:-${(r(5) * dur).toFixed(1)}s"></span>`;
  }
  fx.innerHTML = h;
}

export const AURA_NAMES = ["Faint", "Awakening", "Rising", "Strong", "Overflowing", "Sovereign"];
export const auraName = lv => AURA_NAMES[Math.min(AURA_NAMES.length - 1, Math.floor(aura(lv) * (AURA_NAMES.length - 1) + 0.0001))];

// Ranks by level: E 1, D 10, C 25, B 45, A 70, S 95+ (matches rank() in store.js, which works on A1 %)
export const STAGES = [{ r: "E", min: 1 }, { r: "D", min: 10 }, { r: "C", min: 25 }, { r: "B", min: 45 }, { r: "A", min: 70 }, { r: "S", min: 95 }];
export const stageFor = lv => { let s = 0; STAGES.forEach((x, i) => { if (lv >= x.min) s = i; }); return s; };

// The rank letter in its frame, with a purple aura behind it that grows with the level (--a 0 → 1).
// size: "big" (Status card, level-up screen) or "sm" (top bar). r defaults to the rank for that level.
export function rankEmblem(lv, size = "big", r = STAGES[stageFor(lv)].r) {
  return `<div class="emblem ${size}" style="--a:${aura(lv).toFixed(3)}"><div class="halo"></div><div class="rank ${r}">${r}</div></div>`;
}

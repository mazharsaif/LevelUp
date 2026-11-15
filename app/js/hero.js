// Aura + hero portrait. The aura (0 → 1) grows with level and tints the whole Hunter theme purple.
// The hero is an original hooded "scholar-hunter" drawn in SVG; learners can swap in their own
// images per level via app/avatars/manifest.json.
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

let custom = null; // {level: file}
export async function loadAvatars() {
  try {
    const r = await fetch("avatars/manifest.json", { cache: "no-store" });
    const j = await r.json();
    custom = j.levels && Object.keys(j.levels).length ? j.levels : null;
  } catch { custom = null; }
}
function customFor(lv) {
  if (!custom) return null;
  const keys = Object.keys(custom).map(Number).filter(k => k <= lv).sort((a, b) => b - a);
  return keys.length ? custom[keys[0]] : null;
}

const mix = (a, b, t) => {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return "#" + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("");
};

export const AURA_NAMES = ["Faint", "Awakening", "Rising", "Strong", "Overflowing", "Sovereign"];
export const auraName = lv => AURA_NAMES[Math.min(AURA_NAMES.length - 1, Math.floor(aura(lv) * (AURA_NAMES.length - 1) + 0.0001))];

// Six original evolution stages, one per hunter rank (by level: E 1, D 10, C 25, B 45, A 70, S 95+).
export const STAGES = [
  { r: "E", name: "Novice", min: 1, de: "der Neuling", en: "a beginner", deMean: "jemand, der gerade anfängt" },
  { r: "D", name: "Initiate", min: 10, de: "der Eingeweihte", en: "someone who has just begun their training", deMean: "jemand, der gerade in die Ausbildung aufgenommen wurde" },
  { r: "C", name: "Adept", min: 25, de: "der Könner", en: "someone skilled", deMean: "jemand mit großem Können" },
  { r: "B", name: "Seeker", min: 45, de: "der Suchende", en: "someone searching for deeper knowledge", deMean: "jemand, der tieferes Wissen sucht" },
  { r: "A", name: "Vanguard", min: 70, de: "die Vorhut", en: "the front line, ahead of everyone", deMean: "die vorderste Reihe, allen voraus" },
  { r: "S", name: "Sovereign", min: 95, de: "der Herrscher", en: "the supreme ruler at the very top", deMean: "der oberste Herrscher an der Spitze" },
];
// The heroine ("f") uses the feminine German forms where German has them.
const STAGES_F = [
  {},
  { de: "die Eingeweihte", deMean: "eine, die gerade in die Ausbildung aufgenommen wurde" },
  { de: "die Könnerin", deMean: "eine mit großem Können" },
  { de: "die Suchende", deMean: "eine, die tieferes Wissen sucht" },
  {},
  { de: "die Herrscherin", deMean: "die oberste Herrscherin an der Spitze" },
];
export const HERO_STYLES = { m: "Hunter", f: "Huntress" };
let STYLE = "m";
export const setHeroStyle = s => (STYLE = s === "f" ? "f" : "m");
export const heroStyle = () => STYLE;
export const form = i => (STYLE === "f" ? { ...STAGES[i], ...STAGES_F[i] } : STAGES[i]);
export const stageFor = lv => { let s = 0; STAGES.forEach((x, i) => { if (lv >= x.min) s = i; }); return s; };

// Original faceted "quill sentinel": an angular low-poly scholar-warrior on a rune circle, holding a giant quill.
function heroSVG(lv, uid, style = STYLE) {
  const a = aura(lv), st = stageFor(lv), F = style === "f";
  const HAIR = mix("#4a3a9a", "#7a46c8", a), HAIR_L = mix("#6a5ac8", "#a274ec", a);
  const c1 = mix("#2f8cff", "#9b5cff", a), c2 = mix("#9fd6ff", "#e2ccff", a), gold = "#ffcc4d";
  const trim = st >= 5 ? gold : c2;
  const LIGHT = "#22304f", DARK = "#111a2e", DEEP = "#0b1222";
  const id = k => `${k}-${uid}`;
  let g = "";

  // ---- light pillars rising from the circle (count & height grow with aura)
  const pillars = 2 + Math.round(a * 7);
  for (let i = 0; i < pillars; i++) {
    const x = 40 + (i * 80) / Math.max(1, pillars - 1), h = 50 + a * 80 + ((i * 29) % 30);
    g += `<rect x="${x - 1.5}" y="${186 - h}" width="3" height="${h}" rx="1.5" fill="url(#${id("pil")})" opacity="${0.25 + a * 0.5}">
      <animate attributeName="opacity" values="${0.15 + a * 0.35};${0.45 + a * 0.5};${0.15 + a * 0.35}" dur="${2 + (i % 4) * 0.6}s" repeatCount="indefinite"/></rect>`;
  }
  // ---- rune circle under the feet
  const rx = 40 + st * 3;
  g += `<ellipse cx="80" cy="186" rx="${rx}" ry="9" fill="url(#${id("disc")})" stroke="${c1}" stroke-width="1.4" stroke-opacity=".9"/>`;
  if (st >= 2) g += `<ellipse cx="80" cy="186" rx="${rx - 9}" ry="6" fill="none" stroke="${trim}" stroke-width="1" stroke-dasharray="3 4" stroke-opacity=".9">
      <animate attributeName="stroke-dashoffset" values="0;-28" dur="3s" repeatCount="indefinite"/></ellipse>`;
  if (st >= 4) g += `<ellipse cx="80" cy="186" rx="${rx + 8}" ry="12" fill="none" stroke="${trim}" stroke-width=".8" stroke-dasharray="1 6" stroke-opacity=".8">
      <animate attributeName="stroke-dashoffset" values="0;28" dur="5s" repeatCount="indefinite"/></ellipse>`;

  // ---- crystal shard wings (Vanguard+), behind the body
  if (st >= 4) {
    const big = st >= 5, n2 = big ? 6 : 4;
    let half = "";
    for (let k = 0; k < n2; k++) {
      const ang = -50 + k * (big ? 16 : 20), len = (big ? 66 : 54) - k * 4;
      half += `<path d="M0,0 L${-len},-9 L${-len * 0.78},5 Z" transform="rotate(${ang})" fill="url(#${id("wing")})" opacity="${0.5 + 0.07 * k}" ${big ? `stroke="${gold}" stroke-width=".8" stroke-opacity=".8"` : `stroke="${c2}" stroke-width=".5" stroke-opacity=".6"`}/>`;
    }
    const flap = `<animateTransform attributeName="transform" type="rotate" values="0;-5;0" dur="3.6s" repeatCount="indefinite"/>`;
    g += `<g transform="translate(70 94)"><g>${half}${flap}</g></g><g transform="translate(90 94) scale(-1 1)"><g>${half}${flap}</g></g>`;
  }
  // ---- halo behind the head
  g += `<circle cx="80" cy="64" r="${18 + a * 10}" fill="url(#${id("halo")})" opacity="${0.3 + a * 0.55}"/>`;

  // ---- cape (Seeker+): hangs BEHIND the body, its own colour, ends above the boots with a glowing hem
  if (st >= 3) {
    const capeA = "M64,88 C50,110 38,140 30,166 Q80,178 130,166 C122,140 110,110 96,88 Z";
    const capeB = "M64,88 C49,112 35,141 26,164 Q80,180 134,164 C125,141 111,112 96,88 Z";
    const hemA = "M30,166 Q80,178 130,166", hemB = "M26,164 Q80,180 134,164";
    g += `<path d="${capeA}" fill="url(#${id("cape")})" opacity=".95"><animate attributeName="d" values="${capeA};${capeB};${capeA}" dur="4.5s" repeatCount="indefinite"/></path>
      <path d="${hemA}" fill="none" stroke="${trim}" stroke-width="2" stroke-linecap="round"><animate attributeName="d" values="${hemA};${hemB};${hemA}" dur="4.5s" repeatCount="indefinite"/></path>`;
  }
  // ---- long hair falling behind the shoulders (heroine), sways gently
  if (F) {
    const hA = "M70,56 L64,70 L58,96 L56,116 L64,110 L68,118 L74,106 L80,110 L86,106 L92,118 L96,110 L104,116 L102,96 L96,70 L90,56 Z";
    const hB = "M70,56 L63,70 L56,96 L53,115 L62,110 L66,119 L74,106 L80,111 L86,106 L94,119 L98,110 L107,115 L104,96 L97,70 L90,56 Z";
    g += `<path d="${hA}" fill="${HAIR}" stroke="${c1}" stroke-width=".6" stroke-opacity=".5"><animate attributeName="d" values="${hA};${hB};${hA}" dur="4s" repeatCount="indefinite"/></path>`;
  }
  // ---- legs (faceted) in front of the cape, boots with a light cuff
  g += `<polygon points="71,${F ? 156 : 150} 78,${F ? 156 : 150} 78,180 68,180" fill="${LIGHT}"/><polygon points="82,${F ? 156 : 150} 89,${F ? 156 : 150} 92,180 82,180" fill="${DARK}"/>
        <polygon points="66,176 79,176 79,186 62,186" fill="${DEEP}" stroke="${c2}" stroke-width=".8" stroke-opacity=".8"/>
        <polygon points="81,176 94,176 98,186 81,186" fill="${DEEP}" stroke="${c2}" stroke-width=".8" stroke-opacity=".8"/>
        <rect x="66" y="175" width="13" height="2.4" fill="${c2}" opacity=".85"/><rect x="81" y="175" width="13" height="2.4" fill="${c2}" opacity=".85"/>`;
  // ---- coat body: light left facet, dark right facet
  if (F) { // fitted top, cinched waist, flared battle-dress
    g += `<polygon points="64,86 96,86 94,120 112,158 48,158 66,120" fill="${DARK}" stroke="${c1}" stroke-width="1.2" stroke-opacity="${0.4 + a * 0.5}"/>
        <polygon points="64,86 80,86 80,158 48,158 66,120" fill="${LIGHT}"/>
        <polygon points="80,86 96,86 91,102 80,97" fill="${DEEP}" opacity=".55"/>
        <polygon points="80,124 94,124 108,156 92,156" fill="${DEEP}" opacity=".35"/>`;
    if (st >= 1) g += `<path d="M80,97 L80,120 M49,157 L111,157" stroke="${trim}" stroke-width="1.5" stroke-opacity=".95"/>`;
  } else {
    g += `<polygon points="62,86 98,86 106,152 54,152" fill="${DARK}" stroke="${c1}" stroke-width="1.2" stroke-opacity="${0.4 + a * 0.5}"/>
        <polygon points="62,86 80,86 80,152 54,152" fill="${LIGHT}"/>
        <polygon points="80,86 98,86 92,104 80,98" fill="${DEEP}" opacity=".55"/>`;
    if (st >= 1) g += `<path d="M80,98 L80,152 M54,151 L106,151" stroke="${trim}" stroke-width="1.5" stroke-opacity=".95"/>`;
  }
  // ---- rune belt (Adept+)
  if (st >= 2) {
    if (F) {
      g += `<polygon points="65,117 95,117 95,124 65,124" fill="${DEEP}" stroke="${trim}" stroke-width="1"/>`;
      for (let k = 0; k < 4; k++) g += `<rect x="${68 + k * 7}" y="119" width="3.5" height="3" fill="${c2}"/>`;
    } else {
      g += `<polygon points="58,120 102,120 103,127 57,127" fill="${DEEP}" stroke="${trim}" stroke-width="1"/>`;
      for (let k = 0; k < 5; k++) g += `<rect x="${62 + k * 8}" y="122" width="4" height="3" fill="${c2}"/>`;
    }
  }
  // ---- chest crystal (Vanguard+)
  if (st >= 4) g += `<polygon points="80,96 87,105 80,114 73,105" fill="${c2}" stroke="#fff" stroke-width=".6" stroke-opacity=".7">
      <animate attributeName="opacity" values=".7;1;.7" dur="2.2s" repeatCount="indefinite"/></polygon>`;
  // ---- left arm (down) and right arm (raised to the quill)
  g += `<polygon points="62,88 55,90 49,124 56,126 61,104" fill="${LIGHT}"/><circle cx="52" cy="127" r="3.2" fill="${LIGHT}"/>
        <polygon points="98,88 105,90 116,108 110,113 101,100" fill="${DARK}"/><circle cx="114" cy="111" r="3.2" fill="${DARK}"/>`;
  // ---- shoulder guards (Adept+; spiked from Vanguard)
  if (st >= 2) {
    const spike = st >= 4;
    g += `<polygon points="60,84 72,81 73,92 56,97${spike ? " 54,86" : ""}" fill="url(#${id("plate")})" stroke="${trim}" stroke-width="1"/>
          <polygon points="100,84 88,81 87,92 104,97${spike ? " 106,86" : ""}" fill="url(#${id("plate")})" stroke="${trim}" stroke-width="1"/>`;
    if (spike) g += `<polygon points="56,86 50,74 60,83" fill="${trim}" opacity=".85"/><polygon points="104,86 110,74 100,83" fill="${trim}" opacity=".85"/>`;
  }
  // ---- head: faceted face with simple features; hair per style
  const SKIN_L = "#efc7a4", SKIN_D = "#cf9e7a", INK = "#1b2340";
  const HM = mix("#283456", "#3f3176", a), HM_L = mix("#3a4878", "#5a46a0", a); // hunter hair
  const hairTop = F ? HAIR_L : HM_L, hairSide = F ? HAIR : HM;
  g += `<rect x="76.5" y="73" width="7" height="9" fill="${SKIN_D}"/>
        <polygon points="80,53 88.5,57 90,66 86.5,73.5 80,77 73.5,73.5 70,66 71.5,57" fill="${SKIN_D}"/>
        <polygon points="80,53 71.5,57 70,66 73.5,73.5 80,77" fill="${SKIN_L}"/>`;
  // eyes glow from the Seeker form; otherwise calm dark eyes with a highlight
  const eyeFill = st >= 3 ? c2 : INK;
  const glow = st >= 3 ? `<animate attributeName="opacity" values=".7;1;.7" dur="2.6s" repeatCount="indefinite"/>` : "";
  g += `<g>${glow}<ellipse cx="76.2" cy="65.6" rx="${F ? 1.7 : 1.6}" ry="${F ? 1.3 : 1.1}" fill="${eyeFill}"/><ellipse cx="83.8" cy="65.6" rx="${F ? 1.7 : 1.6}" ry="${F ? 1.3 : 1.1}" fill="${eyeFill}"/></g>
        <circle cx="76.7" cy="65.1" r=".45" fill="#fff" opacity=".9"/><circle cx="84.3" cy="65.1" r=".45" fill="#fff" opacity=".9"/>
        <path d="${F ? "M73.9,62.4 Q76.2,61.4 78.3,62.3 M81.7,62.3 Q83.8,61.4 86.1,62.4" : "M73.6,61.6 L78.4,62.7 M81.6,62.7 L86.4,61.6"}" stroke="${hairSide}" stroke-width="${F ? .8 : 1.1}" stroke-linecap="round" fill="none"/>
        <path d="M78.4,71.2 Q80,${F ? 72.3 : 71.8} 81.6,71.2" stroke="#9a5f4e" stroke-width=".8" stroke-linecap="round" fill="none"/>`;
  if (F) g += `<circle cx="74.2" cy="69" r="1.3" fill="#e88f8f" opacity=".35"/><circle cx="85.8" cy="69" r="1.3" fill="#e88f8f" opacity=".35"/>
        <path d="M74.6,64.6 L73.9,64 M85.4,64.6 L86.1,64" stroke="${INK}" stroke-width=".5"/>`;
  if (F) { // side-parted fringe sweeping to one side, strands framing the face
    g += `<polygon points="69.6,64 69.8,56 74,51.2 80,49.6 86.5,51 90.6,55.8 90.6,63 88.6,58.4 84.5,56.8 79,59.6 74.5,59.2 71.4,63.5" fill="${hairTop}" stroke="${c1}" stroke-width=".5" stroke-opacity=".6"/>
          <polygon points="70,57.5 67.6,63 66.8,79 70.4,85 72,73 71.4,63" fill="${hairTop}"/>
          <polygon points="90.2,57.5 92.6,63 93.4,79 89.8,85 88.2,73 88.8,63" fill="${hairSide}"/>`;
    if (st >= 1) g += `<polygon points="89,53 90.6,56.4 94,57 91.4,59.2 92.2,62.6 89,60.8 85.8,62.6 86.6,59.2 84,57 87.4,56.4" fill="${trim}"><animate attributeName="opacity" values=".7;1;.7" dur="2.4s" repeatCount="indefinite"/></polygon>`;
  } else { // swept, spiky short hair
    g += `<polygon points="70,62.5 69.4,55.5 73,50.5 79,47.8 86,48.6 91,53.5 90.8,61.5 88.8,57.6 86.6,59.2 84.6,56.2 81.4,58.6 79.2,55.8 76,58.4 73.6,56.4 71.6,59.6" fill="${hairTop}" stroke="${c1}" stroke-width=".5" stroke-opacity=".6"/>
          <polygon points="79,47.8 86,48.6 91,53.5 90.8,61.5 88.8,57.6 86.6,59.2 84.6,56.2 81.4,58.6" fill="${hairSide}" opacity=".85"/>
          <polygon points="70,57 68.8,62 70.4,66 71.2,60" fill="${hairSide}"/><polygon points="90.6,57 91.6,62 89.8,66 89.2,60" fill="${hairSide}"/>`;
  }
  // ---- scarf: short for the Novice, long & glowing from Initiate, waving
  const scarfShort = "M88,82 Q99,86 103,96 L97,98 Q93,90 86,87 Z";
  const scarfA = "M88,82 Q112,84 128,100 Q134,108 144,108 L138,115 Q127,114 120,106 Q108,93 86,87 Z";
  const scarfB = "M88,82 Q112,80 128,94 Q136,100 145,98 L141,106 Q129,108 121,100 Q108,91 86,87 Z";
  g += `<polygon points="70,79 90,79 92,88 68,88" fill="${st >= 1 ? c1 : "#2a3550"}"/>`;
  g += st === 0 ? `<path d="${scarfShort}" fill="#2a3550"/>`
    : `<path d="${scarfA}" fill="${c1}" stroke="${trim}" stroke-width=".8"><animate attributeName="d" values="${scarfA};${scarfB};${scarfA}" dur="3s" repeatCount="indefinite"/></path>`;
  // ---- the quill-staff (gold & radiant for the Sovereign)
  const q = st >= 5 ? gold : c2;
  g += `<line x1="104" y1="180" x2="124" y2="38" stroke="${q}" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M124,30 C134,42 134,62 126,78 L120,74 C121,60 118,46 124,30 Z" fill="url(#${id("feather")})" stroke="${q}" stroke-width=".8"/>
        <path d="M123,40 L129,46 M122,50 L130,55 M121,60 L129,64 M121,69 L126,72" stroke="${q}" stroke-opacity=".6" stroke-width=".7"/>
        <circle cx="104" cy="180" r="${2 + st * 0.6}" fill="${q}" opacity="${0.5 + a * 0.5}"/>`;
  if (st >= 1) g += `<circle cx="126" cy="52" r="${10 + st * 2}" fill="url(#${id("tip")})" opacity="${0.35 + a * 0.5}"><animate attributeName="r" values="${9 + st * 2};${13 + st * 2};${9 + st * 2}" dur="2.4s" repeatCount="indefinite"/></circle>`;
  if (st >= 5) for (let k = 0; k < 8; k++) { const t = (k / 8) * Math.PI * 2; g += `<line x1="${126 + 10 * Math.cos(t)}" y1="${52 + 10 * Math.sin(t)}" x2="${126 + 20 * Math.cos(t)}" y2="${52 + 20 * Math.sin(t)}" stroke="${gold}" stroke-width="1" opacity=".7"/>`; }
  // ---- letters orbiting the quill (Adept+)
  if (st >= 2) {
    const L = st >= 4 ? "ÄÖÜßEN" : "ÄßÜ";
    let orb = "";
    for (let k = 0; k < L.length; k++) { const t = (k / L.length) * Math.PI * 2; orb += `<text x="${(126 + 22 * Math.cos(t)).toFixed(1)}" y="${(55 + 22 * Math.sin(t)).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" font-family="Rajdhani,system-ui" fill="${c2}">${L[k]}</text>`; }
    g += `<g>${orb}<animateTransform attributeName="transform" type="rotate" from="0 126 52" to="360 126 52" dur="10s" repeatCount="indefinite"/></g>`;
  }
  // ---- floating open book (Seeker+)
  if (st >= 3) g += `<g><circle cx="34" cy="100" r="12" fill="url(#${id("tip")})" opacity=".5"/>
        <path d="M24,96 L34,99 L44,96 L44,106 L34,109 L24,106 Z" fill="${DEEP}" stroke="${trim}" stroke-width="1"/><path d="M34,99 L34,109" stroke="${trim}" stroke-width=".8"/>
        <animateTransform attributeName="transform" type="translate" values="0 0;0 -6;0 0" dur="3.2s" repeatCount="indefinite"/></g>`;
  // ---- crown of floating shards + rotating halo of letters (Sovereign)
  if (st >= 5) {
    let crown = "";
    [[64, 46, 5], [71, 40, 7], [80, 36, 9], [89, 40, 7], [96, 46, 5]].forEach(([x, y, h], k) => {
      crown += `<polygon points="${x},${y - h} ${x + 2.5},${y} ${x},${y + 2} ${x - 2.5},${y}" fill="${gold}"><animateTransform attributeName="transform" type="translate" values="0 0;0 -2;0 0" dur="${2 + k * 0.3}s" repeatCount="indefinite"/></polygon>`;
    });
    const L = "AÄBDEÖSÜ";
    let ring = `<circle cx="80" cy="64" r="28" fill="none" stroke="${gold}" stroke-opacity=".45" stroke-dasharray="2 5"/>`;
    for (let k = 0; k < L.length; k++) { const t = (k / L.length) * Math.PI * 2; ring += `<text x="${(80 + 28 * Math.cos(t)).toFixed(1)}" y="${(67 + 28 * Math.sin(t)).toFixed(1)}" text-anchor="middle" font-size="7" font-weight="700" font-family="Rajdhani,system-ui" fill="${gold}">${L[k]}</text>`; }
    g += crown + `<g>${ring}<animateTransform attributeName="transform" type="rotate" from="0 80 64" to="360 80 64" dur="40s" repeatCount="indefinite"/></g>`;
  }

  return `<svg viewBox="0 0 160 200" width="100%" height="100%" aria-label="${F ? "Huntress" : "Hunter"} portrait – ${STAGES[st].name} form">
    <defs>
      <linearGradient id="${id("pil")}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></linearGradient>
      <radialGradient id="${id("disc")}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${c1}" stop-opacity=".55"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id("halo")}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${st >= 5 ? gold : c2}" stop-opacity=".75"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient>
      <radialGradient id="${id("tip")}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${st >= 5 ? "#fff3c4" : c2}"/><stop offset="1" stop-color="${c1}" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id("wing")}" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="${c1}" stop-opacity=".1"/></linearGradient>
      <linearGradient id="${id("plate")}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${DEEP}"/></linearGradient>
      <linearGradient id="${id("cape")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix("#1b3f8f", "#4b2a9e", a)}"/><stop offset="1" stop-color="${mix("#2f6fd6", "#7a4ee0", a)}" stop-opacity=".85"/></linearGradient>
      <linearGradient id="${id("feather")}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${st >= 5 ? "#fff3c4" : c2}"/><stop offset="1" stop-color="${c1}" stop-opacity=".4"/></linearGradient>
    </defs>${g}</svg>`;
}

let n = 0;
export function heroHTML(lv, size = "big", style = STYLE) {
  const img = style === STYLE ? customFor(lv) : null;
  const a = aura(lv).toFixed(3);
  return `<div class="hero ${size}" style="--a:${a}"><div class="halo"></div>${img ? `<img src="avatars/${encodeURI(img)}" alt="Portrait">` : heroSVG(lv, `h${n++}`, style)}</div>`;
}

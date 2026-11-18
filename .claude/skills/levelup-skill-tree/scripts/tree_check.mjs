// Headless check of one LevelUp skill-tree branch on the SCRATCH server (never real progress).
//   node tree_check.mjs <branchId> <outDir> [port=8899]
// Needs puppeteer-core: set PUPPETEER_CORE=/abs/path/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js
// or run from a folder where `npm i puppeteer-core` was done. Uses the system Chrome.
// Checks: branch renders, ring segments match parts, first node open & rest locked, node sheet lists parts,
// part-by-part reading (part 1, then the last part, then the rest; done only after all), finishing skill 1 unlocks its
// dependants, About opens (if any), every chapter file loads with cards, no JS errors. Saves screenshots.
const pp = await import(process.env.PUPPETEER_CORE || "puppeteer-core");
const puppeteer = pp.default || pp;
const [branch, OUT, port = "8899"] = process.argv.slice(2);
if (!branch || !OUT) { console.error("usage: node tree_check.mjs <branchId> <outDir> [port]"); process.exit(2); }
const fs = await import("fs"); fs.mkdirSync(OUT, { recursive: true });
const U = `http://127.0.0.1:${port}/`, wait = ms => new Promise(r => setTimeout(r, ms));
const T = await (await fetch(U + "data/se-path.json")).json();
const br = T.branches.find(b => b.id === branch); if (!br) { console.error("no branch", branch); process.exit(1); }
const nodes = T.nodes.filter(n => n.branch === branch), first = nodes.find(n => !n.req.length);
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
const pg = await b.newPage(); const errs = [], fails = [];
pg.on("pageerror", e => errs.push(e.message)); pg.on("console", m => m.type() === "error" && errs.push("console: " + m.text()));
await pg.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile" });
await pg.goto(U, { waitUntil: "networkidle0" });
const user = (await (await fetch(U + "api/users")).json())[0].id;
await pg.evaluate(u => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem("a1.user", u); sessionStorage.setItem("a1.picked." + u, "se-path"); localStorage.setItem("a1.course." + u, "se-path"); localStorage.setItem("a1.hero." + u, "m"); }, user);
await pg.reload({ waitUntil: "networkidle0" }); await wait(800);
const click = async sel => { await pg.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error("missing " + s); e.dispatchEvent(new MouseEvent("click", { bubbles: true })); }, sel); await wait(300); };
const states = () => pg.evaluate(() => Object.fromEntries([...document.querySelectorAll(".tnode")].map(g => [g.dataset.id, g.className.baseVal.split(" ")[1]])));
// course home: Continue card + one card per open branch
const openIds = T.branches.filter(x => x.status === "open").map(x => x.id);
await pg.screenshot({ path: `${OUT}/0_home.png`, fullPage: true });
const cards = await pg.$$eval(".bcard", e => e.map(x => x.dataset.b));
if (cards.length !== openIds.length) fails.push(`home shows ${cards.length} branch cards, expected ${openIds.length}`);
if (!(await pg.$(".contcard"))) fails.push("home has no Continue card");
await click(`.bcard[data-b="${branch}"]`); await wait(400);
await pg.screenshot({ path: `${OUT}/1_tree.png`, fullPage: true });
let st = await states();
if (Object.keys(st).length !== nodes.length) fails.push(`tree shows ${Object.keys(st).length} nodes, expected ${nodes.length}`);
if (st[first.id] !== "open") fails.push(`${first.id} should be open, is ${st[first.id]}`);
if (Object.entries(st).some(([id, s]) => id !== first.id && s !== "locked")) fails.push("only the first node should be unlocked on a fresh profile");
// ring segments: one arc per part on every node with more than one part
const segs = await pg.evaluate(() => Object.fromEntries([...document.querySelectorAll(".tnode")].map(g => [g.dataset.id, [g.querySelectorAll(".tseg").length, g.querySelectorAll(".tseg.on").length]])));
for (const n of nodes) { const P = (n.parts || []).length; if (P > 1 && segs[n.id][0] !== P) fails.push(`${n.id}: ring shows ${segs[n.id][0]} segments, expected ${P}`); }
const P = (first.parts || []).length;
async function readThrough() {          // read the open part to its end; returns the finish label
  for (let k = 0; k < 120; k++) {
    const t = await pg.$eval("#rn", e => e.textContent).catch(() => null);
    if (!t) return null;
    if (k === 3) await pg.screenshot({ path: `${OUT}/4_reader_mid.png` });
    await click("#rn");
    if (!t.startsWith("Next")) return t;
  }
}
await click(`.tnode[data-id="${first.id}"]`); await pg.screenshot({ path: `${OUT}/2_node_sheet.png` });
if (P > 1) {
  const rows = await pg.$$eval(".partrow", e => e.length);
  if (rows !== P) fails.push(`node sheet lists ${rows} parts, expected ${P}`);
  // part 1 via the main button
  await click("#read"); await wait(500); await pg.screenshot({ path: `${OUT}/3_reader.png` });
  const eyebrow = await pg.$eval(".r-eyebrow", e => e.textContent);
  if (!/Part 1 of/.test(eyebrow)) fails.push(`reader eyebrow should say "Part 1 of ${P}": ${eyebrow}`);
  const f1 = await readThrough(); await wait(400);
  if (!/^Finish part 1/.test(f1 || "")) fails.push(`part 1 finish label was "${f1}"`);
  st = await states();
  if (st[first.id] === "done") fails.push("skill marked done after only part 1");
  const on1 = await pg.$eval(`.tnode[data-id="${first.id}"]`, g => g.querySelectorAll(".tseg.on").length);
  if (on1 !== 1) fails.push(`after part 1 the ring has ${on1} filled segments, expected 1`);
  await pg.screenshot({ path: `${OUT}/3b_part1_done.png` });
  // the sheet re-opens after a part: do the LAST part next (any order), then the rest with the main button
  if (!(await pg.$(".partrow"))) await click(`.tnode[data-id="${first.id}"]`);
  await click(`.partrow[data-p="${P - 1}"]`); await wait(400); await readThrough(); await wait(400);
  for (let k = 0; k < P; k++) {
    if ((await states())[first.id] === "done") break;
    if (!(await pg.$("#read"))) await click(`.tnode[data-id="${first.id}"]`);
    await click("#read"); await wait(400); await readThrough(); await wait(400);
  }
} else {
  await click("#read"); await wait(500); await pg.screenshot({ path: `${OUT}/3_reader.png` });
  await readThrough();
}
await pg.evaluate(() => document.getElementById("sheet-root")?.querySelector("#close")?.click());
await wait(400); st = await states();
if (st[first.id] !== "done") fails.push(`${first.id} not marked done after finishing`);
for (const n of nodes.filter(n => n.req.length && n.req.every(r => r === first.id))) if (st[n.id] !== "open") fails.push(`${n.id} should unlock after ${first.id}`);
await pg.screenshot({ path: `${OUT}/5_after_finish.png`, fullPage: true });
// layout toggle (map <-> path) keeps every node; pager moves to another branch and back
await click('.seg button[data-l="path"]'); await wait(300);
if (Object.keys(await states()).length !== nodes.length) fails.push("path layout lost nodes");
await pg.screenshot({ path: `${OUT}/5b_path.png`, fullPage: true });
await click('.seg button[data-l="map"]'); await wait(300);
if (openIds.length > 1) { await click("#nx"); await wait(400); const h = await pg.evaluate(() => location.hash); if (h === `#/branch/${branch}`) fails.push("next-branch arrow did not move"); await click("#pv"); await wait(400); }
if ((await pg.evaluate(() => location.hash)) !== `#/branch/${branch}`) fails.push("prev arrow did not come back to the branch");
if (br.intro != null) { await click("#intro"); await wait(500); await pg.screenshot({ path: `${OUT}/6_about.png` }); if (!(await pg.$("#rn"))) fails.push("About did not open the reader"); }
const chs = [...new Set([...(br.intro != null ? [br.intro] : []), ...nodes.map(n => n.chapter)])];
const bad = await pg.evaluate(async (r, chs) => { const o = []; for (const c of chs) { try { const j = await (await fetch(`${r}${String(c).padStart(2, "0")}.json`)).json(); if (!j.title || !j.cards.length) o.push(c); } catch { o.push(c); } } return o; }, br.reading, chs);
if (bad.length) fails.push("chapters failing to load: " + bad.join(", "));
if (errs.length) fails.push("JS errors: " + errs.slice(0, 5).join(" | "));
console.log(JSON.stringify({ branch, nodes: nodes.length, chapters: chs.length, ok: !fails.length, fails }, null, 1));
await b.close();
process.exit(fails.length ? 1 : 0);

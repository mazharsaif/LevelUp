// Checks that a progress file written by the native app still loads in the web store.js:
//   node webread.mjs <progress.json> [course]
// Prints the web app's view of it (normalize + summary). Exit code 1 if the web code throws.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
const HERE = path.dirname(fileURLToPath(import.meta.url)), APP = path.resolve(HERE, "../../../app");
const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/" });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, DOMParser: dom.window.DOMParser });
const mem = new Map();
Object.defineProperty(globalThis, "localStorage", { value: { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) } });
globalThis.Audio = class { pause() {} play() { return Promise.resolve(); } };
globalThis.addEventListener = () => {};
globalThis.fetch = async u => { const p = path.join(APP, String(u).split("?")[0]); return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(p, "utf8")) }; };
const S = await import(pathToFileURL(path.join(HERE, ".cache/js/store.js")).href);
const [file, course = "de-a1"] = process.argv.slice(2);
await S.loadCourses(); S.setCourse(course); await S.loadContent(course);
try {
  const raw = fs.readFileSync(file, "utf8");
  S.importState(raw);
  console.log(JSON.stringify({ ok: true, summary: S.summary(JSON.parse(raw)), xp: S.totalXP(S.S), keys: Object.keys(S.S).length }));
} catch (e) { console.error("web store.js failed:", e); process.exit(1); }

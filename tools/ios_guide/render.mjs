const pp = await import(process.env.PUPPETEER_CORE); const puppeteer = pp.default || pp;
const [src, out, shots] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new" });
const pg = await b.newPage(); await pg.setViewport({ width: 360, height: 640, deviceScaleFactor: 2 });
await pg.goto("file://" + src, { waitUntil: "networkidle0" });
await pg.pdf({ path: out, printBackground: true, preferCSSPageSize: true, scale: 1, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
const n = await pg.$$eval(".page", p => p.length);
for (let i = 0; i < n; i++) { const el = (await pg.$$(".page"))[i]; await el.screenshot({ path: `${shots}/p${i + 1}.png` }); }
await b.close(); console.log("pages", n);

// Per-language settings for the language courses. Every content file keeps the target-language text in the
// field `de` (German was first); `L` is the profile of the course that is loaded (set by loadContent in store.js).

// ---------- German (unchanged behaviour of the original code) ----------
const DE_NUM = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"];
const DE_FORMS = { ist: "is", bin: "am", bist: "are", sind: "are", seid: "are", war: "was", hat: "has", habe: "have", hast: "have", habt: "have",
  den: "the", dem: "the", des: "of the", einen: "a, an", einem: "a, an", eines: "of a", du: "you", mich: "me", mir: "(to) me",
  dich: "you", dir: "(to) you", uns: "us", euch: "you (plural)", im: "in the", am: "at the, on the", zum: "to the", zur: "to the",
  vom: "from the", beim: "at the", ins: "into the" };
const DE = {
  code: "de", name: "German", bcp: "de-DE",
  // article + noun ("der Tisch") → ["der", "Tisch", " "]
  splitArt: de => { const m = String(de).match(/^(der|die|das) (.*)$/); return m ? [m[1], m[2], " "] : null; },
  artStrip: /^(der|die|das) /,          // on normalised text
  artHint: "with der / die / das",
  gtag: { m: "DER", f: "DIE", n: "DAS", pl: "PLURAL" },
  keys: ["ä", "ö", "ü", "ß"],
  norm: s => s.replace(/ß/g, "ss").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue"),
  fold: null,                          // German folds umlauts in norm (ä = ae), no separate accent check
  letters: /^[A-Za-zÄÖÜäöüß0-9,.!?'’ \-–]+$/,
  numWord: n => DE_NUM[n] || null,
  speechPre: t => t.replace(/[’']s\b/g, " es"),
  praise: ["Super!", "Richtig!", "Sehr gut!", "Genau!", "Prima!"],
  understood: "Verstanden!",
  perfLabel: "Perfekt",
  forms: DE_FORMS,
  formal: (t, first) => (!first && /^Ihr(e|en|em|er|es)?$/.test(t) ? "your (formal)" : !first && t === "Sie" ? "you (formal)" : null),
  suffixes: ["en", "em", "er", "es", "e", "n", "s", "st", "t"],
  stemTry: st => [st, st + "en", st + "n"],
  bare: low => [low + "en", low + "n"],
  genderQ: w => ({ title: "der, die or das?", opts: ["der", "die", "das"], cls: ["m", "f", "n"], ans: { m: "der", f: "die", n: "das", pl: "die" }[w.g],
    note: w.g === "pl" ? "Plural-only noun → die" : "" }),
  cheers: null,
};

// ---------- French ----------
const FR_U = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"];
const FR_T = { 2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante" };
function frNum(n) {
  if (n < 17) return FR_U[n];
  if (n < 20) return "dix-" + FR_U[n - 10];
  if (n < 70) { const t = FR_T[Math.floor(n / 10)], r = n % 10; return r === 0 ? t : r === 1 ? t + " et un" : t + "-" + FR_U[r]; }
  if (n < 80) return n === 71 ? "soixante et onze" : "soixante-" + frNum(n - 60);
  if (n === 80) return "quatre-vingts";
  if (n < 100) return "quatre-vingt-" + frNum(n - 80);
  if (n < 1000) { const h = Math.floor(n / 100), r = n % 100; const c = h === 1 ? "cent" : FR_U[h] + (r ? " cent" : " cents"); return r ? c + " " + frNum(r) : c; }
  if (n < 1000000) { const k = Math.floor(n / 1000), r = n % 1000; const m = k === 1 ? "mille" : frNum(k) + " mille"; return r ? m + " " + frNum(r) : m; }
  return null;
}
// common forms that the word list doesn't hold (est, suis, du, au …)
const FR_FORMS = { suis: "am", es: "are", est: "is", sommes: "are", "êtes": "are", sont: "are", ai: "have", as: "have", a: "has", avons: "have",
  avez: "have", ont: "have", vais: "go", vas: "go", va: "goes", allons: "go", allez: "go", vont: "go", fais: "do, make", fait: "does, makes",
  faisons: "do, make", faites: "do, make", font: "do, make", veux: "want", veut: "wants", voulez: "want", voudrais: "would like",
  peux: "can", peut: "can", pouvez: "can", prends: "take", prend: "takes", viens: "come", vient: "comes",
  le: "the", la: "the", les: "the", l: "the", un: "a, an, one", une: "a, an, one", des: "some; of the", du: "some; of the", au: "to the, at the",
  aux: "to the, at the", de: "of, from", d: "of, from", "à": "to, at, in", je: "I", j: "I", tu: "you (friends)", il: "he, it", elle: "she, it",
  on: "we, one", nous: "we, us", vous: "you (polite / plural)", ils: "they", elles: "they", me: "me, myself", m: "me, myself", te: "you, yourself",
  t: "you, yourself", se: "himself, herself", s: "himself, herself; if", ne: "not", n: "not", pas: "not", y: "there", en: "in; of it",
  ce: "this, that", cet: "this, that", cette: "this, that", ces: "these, those", c: "it, that", qu: "that, what", que: "that, what",
  mon: "my", ma: "my", mes: "my", ton: "your", ta: "your", tes: "your", son: "his, her", sa: "his, her", ses: "his, her",
  notre: "our", nos: "our", votre: "your", vos: "your", leur: "their", leurs: "their", moi: "me", toi: "you", lui: "him", eux: "them" };
const FR_FOLD = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFC");
const FR = {
  code: "fr", name: "French", bcp: "fr-FR",
  // "le livre" → ["le", "livre", " "]; "l'école" → ["l'", "école", ""]
  splitArt: de => {
    const s = String(de), m = s.match(/^(le|la|les) (.*)$/);
    if (m) return [m[1], m[2], " "];
    const e = s.match(/^(l['’])(.*)$/);
    return e ? [e[1], e[2], ""] : null;
  },
  artStrip: /^(le|la|les|l|un|une|des) /,
  artHint: "with le / la / l'",
  gtag: { m: "MASC.", f: "FEM.", n: "", pl: "PLURAL" },
  keys: ["é", "è", "ê", "à", "ç", "ô", "î", "û", "œ"],
  norm: s => s,                        // accents are kept; a missing accent is accepted with a note (fold)
  fold: FR_FOLD,
  letters: /^[A-Za-zÀ-ÖØ-öø-ÿŒœ0-9,.!?'’ \-– ]+$/,
  numWord: frNum,
  speechPre: t => t,
  praise: ["Super !", "Bravo !", "Très bien !", "Exactement !", "Parfait !"],
  understood: "Compris !",
  perfLabel: "Passé composé",
  forms: FR_FORMS,
  formal: () => null,
  suffixes: ["ons", "ez", "ent", "es", "e", "s", "x"],
  stemTry: st => [st, st + "er", st + "ir", st + "re", st + "e"],
  bare: low => [low + "er", low + "e"],
  // le/la nouns: "le or la?"; l' nouns hide the gender, so ask "un or une?"
  genderQ: w => {
    const p = FR.splitArt(w.de) || [];
    if (p[0] && p[0].startsWith("l")  && p[0] !== "le" && p[0] !== "la") return { title: "un or une?", opts: ["un", "une"], cls: ["m", "f"], ans: w.g === "f" ? "une" : "un", note: `l' hides the gender: ${w.g === "f" ? "une" : "un"} ${p[1]}`, shown: p[1] };
    return { title: "le or la?", opts: ["le", "la"], cls: ["m", "f"], ans: w.g === "f" ? "la" : "le", note: "" };
  },
  canGender: w => (w.g === "m" || w.g === "f") && /^(le |la |l['’])[^\s/()]+$/.test(w.de),
  cheers: {
    perfect: [["🧠✨", "Flawless! Your neurons are doing push-ups."], ["🏆", "Perfect run – even the dictionary is impressed."], ["🥐", "Parfait ! Somewhere in Paris a baker just smiled."],
      ["🎯", "Bullseye every time. Researchers want to study your memory."]],
    great: [["🎉", "Très bien ! Those words are sticking."], ["💪", "Strong work – your future self in France says merci."], ["🔥", "Great focus. Keep that momentum going!"]],
    ok: [["🌱", "Every mistake is a word you'll remember better. Courage !"], ["🧗", "Progress, not perfection. You're climbing!"], ["☕", "Good effort – a quick review tomorrow will lock it in."]],
  },
};

export const LANGS = { de: DE, fr: FR };
export const L = { ...DE };
export function setLang(code) {
  for (const k of Object.keys(L)) delete L[k];
  Object.assign(L, LANGS[code] || DE);
  return L;
}

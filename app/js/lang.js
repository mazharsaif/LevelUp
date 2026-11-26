// Per-language settings for the language courses. Every content file keeps the target-language text in the
// field `de` (German was first); `L` is the profile of the course that is loaded (set by loadContent in store.js).

// ---------- German (unchanged behaviour of the original code) ----------
const DE_NUM = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf"];
const DE_FORMS = { ist: "is", bin: "am", bist: "are", sind: "are", seid: "are", war: "was", hat: "has", habe: "have", hast: "have", habt: "have",
  den: "the", dem: "the", des: "of the", einen: "a, an", einem: "a, an", eines: "of a", du: "you", mich: "me", mir: "(to) me",
  dich: "you", dir: "(to) you", uns: "us", euch: "you (plural)", im: "in the", am: "at the, on the", zum: "to the", zur: "to the",
  vom: "from the", beim: "at the", ins: "into the",
  // articles (feedback 11-22: "Der" showed no meaning) and stem-changing verbs whose stem isn't the infinitive's
  der: "the", die: "the", das: "the; that", ein: "a, an; one", eine: "a, an; one", einer: "a, an; one", kein: "no, not a", keine: "no, not any",
  isst: "eats (essen)", liest: "reads (lesen)", gibt: "gives (geben)", nimmt: "takes (nehmen)", sieht: "sees (sehen)",
  spricht: "speaks (sprechen)", hilft: "helps (helfen)", trifft: "meets (treffen)", weiß: "know(s) (wissen)", wird: "becomes (werden)" };
// Fair sentences (feedback fa5e, 11-27): an exercise sentence may only use words the learner has met. These cover what isn't a
// word card of its own: irregular forms (→ the word they belong to), articles, names, and what each grammar chapter teaches.
const DE_FAIR = {"forms":{"ist":"sein","bin":"sein","bist":"sein","sind":"sein","seid":"sein","war":"sein","waren":"sein","warst":"sein","wart":"sein","hat":"haben","habe":"haben","hast":"haben","habt":"haben","hatte":"haben","hatten":"haben","hattest":"haben","kann":"können","kannst":"können","könnt":"können","konnte":"können","könnten":"können","könnte":"können","muss":"müssen","musst":"müssen","müsst":"müssen","musste":"müssen","will":"wollen","willst":"wollen","wollt":"wollen","wollte":"wollen","darf":"dürfen","darfst":"dürfen","dürft":"dürfen","soll":"sollen","sollst":"sollen","mag":"mögen","magst":"mögen","möchte":"möchten","möchtest":"möchten","möchtet":"möchten","wird":"werden","wirst":"werden","wurde":"werden","weiß":"wissen","weißt":"wissen","wisst":"wissen","isst":"essen","liest":"lesen","gibt":"geben","gibt's":"geben","nimmt":"nehmen","nimmst":"nehmen","sieht":"sehen","siehst":"sehen","spricht":"sprechen","sprichst":"sprechen","hilft":"helfen","hilfst":"helfen","trifft":"treffen","fährt":"fahren","fährst":"fahren","schläft":"schlafen","schläfst":"schlafen","läuft":"laufen","trägt":"tragen","wäscht":"waschen","gefällt":"gefallen","hält":"halten","lässt":"lassen","vergisst":"vergessen","empfiehlt":"empfehlen","gilt":"gelten","stirbt":"sterben","wirft":"werfen","bäckt":"backen","mir":"ich","mich":"ich","dir":"du","dich":"du","ihn":"er","ihm":"er","uns":"wir","euch":"ihr","Ihnen":"Sie","ihnen":"sie","im":"in","ins":"in","am":"an","ans":"an","zum":"zu","zur":"zu","vom":"von","beim":"bei"},"always":["der","die","das","den","dem","des","ein","eine","einen","einem","einer","eines","–","-"],"names":["Berlin","Indore","Frankfurt","München","Ravi","Müller","Hamburg","Köln","Hans","Meier","Stuttgart","Thomas","García","Sharma","Schmidt","Eva","Mumbai","Rhein","Mainz","Inge","Anna","Peter","Maria","Lisa","Max","Tom","Paul","Lena","Jonas","Sara","Priya","Ali","Ben","Leipzig","Dresden","Bonn","Wien","Zürich","Delhi","Bern","Kerstin","Klaus","Petra","Julia","Mia","Emma","Noah","Lukas","Tim","Jan","Sophie","Laura","Michael","Andrea","Stefan","Sabine","Markus","Monika","Frank","Martin","Kim","Yusuf","Aisha","Raj","Neha","Arjun","Kumar","Patel","Weber","Fischer","Wagner","Becker","Schneider","Hoffmann","Klein","Wolf","Neumann","Berger"],"grammar":{"g2":"ich du er sie es wir ihr Sie","g3":"sein haben","g7":"wer wie was wo woher wohin wann warum welche welcher welches","g8":"kein keine keinen","g9":"nicht kein keine keinen","g10":"mich dich sich uns euch","g11":"mein meine meinen dein deine sein seine ihr ihre unser unsere euer eure Ihr Ihre","g12":"können müssen wollen dürfen sollen möchten mögen","g16":"in an auf unter über vor hinter neben zwischen um nach seit von bis aus bei zu mit für ohne gegen durch","g21":"und oder aber denn mit","g22":"mich dich ihn sie es uns euch","g23":"mir dir ihm ihr uns euch Ihnen mit von zu bei aus nach seit","g25":"werden","g14":"bitte mal","g20":"gern lieber dies diese dieser dieses welch"}};
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
  formal: (t, first) => (!first && /^Ihr(e|en|em|er|es)?$/.test(t) ? "your (formal)" : !first && t === "Sie" ? "you (formal)" : !first && t === "Ihnen" ? "to you (formal)" : null),
  suffixes: ["en", "em", "er", "es", "e", "n", "s", "st", "t"],
  // fährt → fähr → fahren, läuft → laufen, schläft → schlafen: also try the stem without its umlaut
  stemTry: st => { const u = st.replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u"); return u === st ? [st, st + "en", st + "n"] : [st, st + "en", st + "n", u, u + "en", u + "n"]; },
  bare: low => [low + "en", low + "n"],
  genderQ: w => ({ title: "der, die or das?", opts: ["der", "die", "das"], cls: ["m", "f", "n"], ans: { m: "der", f: "die", n: "das", pl: "die" }[w.g],
    note: w.g === "pl" ? "Plural-only noun → die" : "" }),
  fair: DE_FAIR,
  cheers: {
    perfect: [["🧠✨", "Flawless! Your neurons are doing push-ups."], ["🏆", "Perfect run – even the dictionary is impressed."], ["🚀", "Not a single slip. Your brain should be in a museum."],
      ["🌟", "100 %! Somewhere a German grammar book just smiled."], ["🥇", "Perfekt! You're making this look far too easy."], ["🎯", "Bullseye every time. Researchers want to study your memory."]],
    great: [["🎉", "Sehr gut! Those words are sticking."], ["💪", "Strong work – your future self in Germany says danke."], ["🔥", "Great focus. Keep that momentum going!"]],
    ok: [["🌱", "Every mistake is a word you'll remember better. Weiter so!"], ["🧗", "Progress, not perfection. You're climbing!"], ["☕", "Good effort – a quick review tomorrow will lock it in."]],
  },
  welcome: "Willkommen",
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
  welcome: "Bienvenue",
  canGender: w => (w.g === "m" || w.g === "f") && /^(le |la |l['’])[^\s/()]+$/.test(w.de),
  cheers: {
    perfect: [["🧠✨", "Flawless! Your neurons are doing push-ups."], ["🏆", "Perfect run – even the dictionary is impressed."], ["🥐", "Parfait ! Somewhere in Paris a baker just smiled."],
      ["🎯", "Bullseye every time. Researchers want to study your memory."]],
    great: [["🎉", "Très bien ! Those words are sticking."], ["💪", "Strong work – your future self in France says merci."], ["🔥", "Great focus. Keep that momentum going!"]],
    ok: [["🌱", "Every mistake is a word you'll remember better. Courage !"], ["🧗", "Progress, not perfection. You're climbing!"], ["☕", "Good effort – a quick review tomorrow will lock it in."]],
  },
};

// ---------- English: courses that teach no language (SE, Maths, Life). German words only on the German course.
const EN = { ...DE, code: "en", name: "English", bcp: "en-US", keys: [],
  praise: ["Correct!", "Nice!", "Well done!", "Exactly!", "Great!"], understood: "Got it!", perfLabel: "Perfect", welcome: "Welcome",
  cheers: {
    perfect: [["🧠✨", "Flawless! Your neurons are doing push-ups."], ["🏆", "Perfect run – not a single slip."], ["🚀", "Not a single slip. Your brain should be in a museum."],
      ["🎯", "Bullseye every time. Researchers want to study your memory."]],
    great: [["🎉", "Very good! That's sticking."], ["💪", "Strong work – your future self says thanks."], ["🔥", "Great focus. Keep that momentum going!"]],
    ok: [["🌱", "Every mistake is something you'll remember better."], ["🧗", "Progress, not perfection. You're climbing!"], ["☕", "Good effort – a quick review tomorrow will lock it in."]],
  } };

export const LANGS = { de: DE, fr: FR, en: EN };
export const L = { ...EN };
export function setLang(code) {
  for (const k of Object.keys(L)) delete L[k];
  Object.assign(L, LANGS[code] || EN);
  return L;
}

package de.com.levelup.core

import kotlin.math.floor
import kotlin.math.min
import kotlin.random.Random

/** Port of the exercise engine in app/js/lesson.js: step builders, the run (answers, retries, combo), XP on finish. */
data class Slot(val tok: String, val blank: Boolean)
data class Sib(val de: String, val note: String)

sealed class Step {
    abstract val retry: Boolean
    abstract val key: String?
    open val w: Word? get() = null
    data class Intro(override val w: Word, override val retry: Boolean = false, override val key: String? = null) : Step()
    /** dir = "de_en" (what does this mean?) or "en_de" (choose the target language) */
    data class Mc(override val w: Word, val dir: String, override val retry: Boolean = false, override val key: String? = null) : Step()
    data class Listen(override val w: Word, override val retry: Boolean = false, override val key: String? = null) : Step()
    data class Type(override val w: Word, override val retry: Boolean = false, override val key: String? = null) : Step()
    data class Gender(override val w: Word, override val retry: Boolean = false, override val key: String? = null) : Step()
    data class Match(val ws: List<Word>, override val retry: Boolean = false, override val key: String? = null) : Step()
    /** Complete the sentence (vocab) or a guided "Say it" with 2–3 blanks (sayDe set, w null) */
    data class Build(override val w: Word?, val ex: Ex, val slots: List<Slot>, val ans: List<String>, val tiles: List<String>, val sayDe: String? = null,
                     override val retry: Boolean = false, override val key: String? = null) : Step()
    data class Cloze(override val w: Word, val ex: Ex, val ans: String, val opts: List<String>, override val retry: Boolean = false, override val key: String? = null) : Step()
    /** review: dir = "de_en" | "en_de" | "type" */
    data class Recall(override val w: Word, val dir: String, val relearn: Boolean = false, override val retry: Boolean = false, override val key: String? = null) : Step()
    data class Gq(val q: GQ, val n: Int, val of: Int, override val retry: Boolean = false, override val key: String? = null) : Step()
    data class Gmc(val q: GQ, val n: Int, val of: Int, override val retry: Boolean = false, override val key: String? = null) : Step()
    data class Flip(val p: Phrase, val sec: String, override val retry: Boolean = false, override val key: String? = null) : Step()
    data class Read(val p: Phrase, val listen: Boolean, val title: String, val others: List<Phrase>, override val retry: Boolean = false, override val key: String? = null) : Step()
    /** mode = "tiles" or "type" */
    data class Say(val item: SayItem, val mode: String, val tiles: List<String>, val sibs: List<Sib>, override val retry: Boolean = false,
                   override val key: String? = "s:" + item.de) : Step()
    data class Speak(val p: Phrase, override val retry: Boolean = false, override val key: String? = "speak:" + p.de) : Step()

    fun asRetry(): Step = when (this) {
        is Say -> copy(retry = true, mode = "tiles")
        is Build -> copy(retry = true)
        is Type -> Mc(w, "en_de", retry = true, key = key)
        is Mc -> copy(retry = true)
        is Listen -> copy(retry = true)
        is Gender -> copy(retry = true)
        is Cloze -> copy(retry = true)
        else -> this
    }
    fun withKey(k: String): Step = when (this) {
        is Build -> copy(key = k); is Cloze -> copy(key = k); is Read -> copy(key = k); is Match -> copy(key = k); else -> this
    }
}

class Builder(val store: Store, val cd: CourseData, val rnd: Random = Random) {
    val t = Text(cd)
    val L get() = cd.lang
    private val S get() = store.S!!

    fun <T> shuffle(a: List<T>): List<T> { val x = a.toMutableList(); for (i in x.size - 1 downTo 1) { val j = floor(rnd.nextDouble() * (i + 1)).toInt(); val tmp = x[i]; x[i] = x[j]; x[j] = tmp }; return x }
    private fun <T> pickOne(a: List<T>) = a[floor(rnd.nextDouble() * a.size).toInt()]

    fun distractors(w: Word, field: String, n: Int = 3): List<Word> {
        val all = cd.words
        val v = { x: Word -> if (field == "en") x.en else x.de }
        val seen = mutableSetOf(t.norm(v(w)))
        val bad = { x: Word -> t.overlaps(x.en, w.en) || t.baseDe(x.de) == t.baseDe(w.de) }
        val pools = listOf(all.filter { it.topic == w.topic && it.type == w.type }, all.filter { it.type == w.type }, all)
        val out = ArrayList<Word>()
        for (pool in pools) for (x in shuffle(pool)) {
            if (out.size >= n) break
            val k = t.norm(v(x))
            if (x.id == w.id || k in seen || bad(x) || out.any { t.overlaps(it.en, x.en) }) continue
            seen.add(k); out.add(x)
        }
        return out
    }

    private fun hardStep(w: Word, i: Int): Step {
        val opts = mutableListOf("en_de")
        if (w.a != null) opts.add("listen")
        if (w.typeAns != null) opts.add("type")
        if (t.canGender(w)) opts.add("gender")
        return when (opts[i % opts.size]) { "listen" -> Step.Listen(w); "type" -> Step.Type(w); "gender" -> Step.Gender(w); else -> Step.Mc(w, "en_de") }
    }
    private val BAD_SENT = Regex("[()…=/]")
    private fun clozeFor(w: Word): Step.Cloze? {
        val core = t.coreWord(w)
        if (core.isEmpty() || t.hasSpaceOrSlash(core)) return null
        val lc = JsText.lower(core)
        val ex = w.ex.filter { e -> t.tokenOk(e.de) && t.tokens(e.de).any { JsText.lower(it) == lc } && t.tokens(e.de).size <= 10 }
        if (ex.isEmpty()) return null
        val e = pickOne(ex); val toks = t.tokens(e.de)
        val others = ArrayList<String>()
        for (x in shuffle(cd.words)) {
            if (others.size >= 3) break
            val c = t.coreWord(x)
            if (x.id == w.id || x.type != w.type || t.hasSpaceOrSlash(c) || c.isEmpty() || t.overlaps(x.en, w.en) || c in others || JsText.lower(c) == lc) continue
            if (toks.any { JsText.lower(it) == JsText.lower(c) }) continue
            others.add(c)
        }
        return if (others.size >= 2) Step.Cloze(w, e, toks.first { JsText.lower(it) == lc }, listOf(core) + others) else null
    }
    private fun buildFor(w: Word, pool: List<Word>): Step.Build? {
        val known = LinkedHashMap<String, Word>().also { m -> (pool + S.obj("words").keys.mapNotNull { cd.word[it] }).forEach { m[it.id] = it } }.values.toList()
        val cands = w.ex.filter { e -> t.tokenOk(e.de) && !BAD_SENT.containsMatchIn(e.de) && t.tokens(e.de).size in 3..10 }
        for (e in shuffle(cands)) {
            val toks = t.tokens(e.de)
            val ti = toks.indexOfFirst { t.tokenIs(it, w) }
            if (ti < 0) continue
            val blank = toks.mapIndexed { i, tk -> i == ti || JsText.lower(tk) == JsText.lower(toks[ti]) || (known.any { k -> k.id != w.id && t.tokenIs(tk, k) } && tk.length > 2) }.toMutableList()
            if (blank.count { it } > 4) for (i in blank.indices) if (blank[i] && i != ti && blank.count { it } > 4) blank[i] = false
            val low = toks.map { JsText.lower(it) }.toSet()
            val extra = ArrayList<String>()
            for (k in shuffle(known)) {
                if (extra.size >= 2) break
                val c = t.coreWord(k)
                if (c.isEmpty() || t.hasSpaceOrSlash(c) || k.id == w.id || JsText.lower(c) in low || c in extra || t.overlaps(k.en, w.en)) continue
                extra.add(c)
            }
            val slots = toks.mapIndexed { i, tk -> Slot(tk, blank[i]) }
            val ans = slots.filter { it.blank }.map { it.tok }
            return Step.Build(w, e, slots, ans, shuffle(ans + extra))
        }
        return null
    }
    private val SAY_STRIP = Regex("[…()=/]")
    private val EN_PAREN = Regex("[${JsText.WS}]*\\([^)]*\\)")
    fun sayStep(p: Phrase, pool: List<Phrase>, forceTiles: Boolean = false): Step.Say? {
        val its = t.sayItems(p); if (its.isEmpty()) return null
        val it = pickOne(its)
        val n = S.ro("say")[it.de].asNum() ?: 0.0
        val mode = if (forceTiles || n == 0.0) "tiles" else if (rnd.nextDouble() < min(0.65, 0.35 + 0.1 * n)) "type" else "tiles"
        val toks = t.tokens(it.de); val have = toks.map { t.norm(it) }.toSet(); val extra = ArrayList<String>()
        val want = if (toks.size <= 3) 2 else 3
        outer@ for (q in shuffle(pool)) {
            for (tk in shuffle(t.tokens(SAY_STRIP.replace(q.de, " ")))) {
                if (extra.size >= want) break
                if (tk.length > 1 && t.norm(tk) !in have && extra.none { e -> t.norm(e) == t.norm(tk) }) extra.add(tk)
            }
            if (extra.size >= want) break@outer
        }
        val bare = { e: String -> JsText.lower(JsText.trim(EN_PAREN.replace(e, ""))) }
        val sibs = pool.filter { q -> q !== p && bare(q.en) == bare(p.en) }.flatMap { t.sayItems(it) }.filter { x -> t.norm(x.de) != t.norm(it.de) }.map { Sib(it.de, it.note) }
        return Step.Say(it, mode, shuffle(toks + extra), sibs)
    }
    fun guidedSayStep(p: Phrase, pool: List<Phrase>): Step.Build? {
        val its = t.sayItems(p).filter { t.tokens(it.de).size > 5 }; if (its.isEmpty()) return null
        val it = pickOne(its); val toks = t.tokens(it.de)
        val k = min(3, toks.size - 3); val seen = HashSet<String>(); val pickIdx = ArrayList<Int>()
        for (i in toks.indices.sortedByDescending { toks[it].length }) {
            val low = JsText.lower(toks[i])
            if (pickIdx.size >= k) break
            if (low in seen) continue
            seen.add(low); pickIdx.add(i)
        }
        val slots = toks.mapIndexed { i, tk -> Slot(tk, i in pickIdx) }
        val ans = slots.filter { it.blank }.map { it.tok }; val have = toks.map { t.norm(it) }.toSet(); val extra = ArrayList<String>()
        outer@ for (q in shuffle(pool)) {
            for (tk in t.tokens(SAY_STRIP.replace(q.de, " "))) {
                if (extra.size >= 2) break
                if (tk.length > 2 && t.norm(tk) !in have && extra.none { e -> t.norm(e) == t.norm(tk) }) extra.add(tk)
            }
            if (extra.size >= 2) break@outer
        }
        return Step.Build(null, Ex(it.de, it.en, it.a), slots, ans, shuffle(ans + extra), sayDe = it.de)
    }
    private fun matchStep(ws: List<Word>): Step.Match? {
        val m = ArrayList<Word>()
        for (x in shuffle(ws)) if (m.size < 5 && m.none { o -> t.overlaps(o.en, x.en) || t.baseDe(o.de) == t.baseDe(x.de) }) m.add(x)
        return if (m.size >= 3) Step.Match(m) else null
    }

    /** One part: teach a word → test it → next word → mix → sentences → final round */
    fun vocabBitSteps(item: PathItem, bit: Int): List<Step> {
        val ws = store.wordBits(item)[bit].mapNotNull { cd.word[it] }
        val steps = ArrayList<Step>()
        ws.forEachIndexed { i, w ->
            steps.add(Step.Intro(w))
            steps.add(if (i % 2 == 1) Step.Mc(w, "en_de") else Step.Mc(w, "de_en"))
            if (i >= 1) {
                val prev = ws[floor(rnd.nextDouble() * i).toInt()]
                steps.add(if (prev.a != null && rnd.nextDouble() < 0.5) Step.Listen(prev) else if (t.canGender(prev)) Step.Gender(prev) else Step.Mc(prev, "en_de"))
            }
        }
        matchStep(ws)?.let { steps.add(it) }
        val sb = shuffle(ws).map { buildFor(it, ws) }.firstOrNull { it != null }; if (sb != null) steps.add(sb)
        val sc = shuffle(ws).map { clozeFor(it) }.firstOrNull { it != null }; if (sc != null) steps.add(sc)
        shuffle(ws).forEachIndexed { i, w -> steps.add(hardStep(w, i + floor(rnd.nextDouble() * 4).toInt())) }
        val sb2 = shuffle(ws).filter { sb == null || it.id != sb.w?.id }.map { buildFor(it, ws) }.firstOrNull { it != null }; if (sb2 != null) steps.add(sb2)
        return steps
    }
    fun reviewSteps(ids: List<String>): List<Step> = shuffle(ids).mapNotNull { id ->
        val w = cd.word[id] ?: return@mapNotNull null
        val st = S.obj("words")[id].asObj() ?: jobj()
        val r = rnd.nextDouble()
        val dir = if (w.typeAns != null && st.num("reps") >= 1 && r < 0.35) "type" else if (w.a != null && r > 0.8) "de_en" else "en_de"
        Step.Recall(w, dir)
    }
    fun grammarSteps(g: Grammar, item: PathItem?, displayName: String?): List<Step> {
        val P = if (item?.gid != null) GrammarSplit.split(g).getOrNull(item.part ?: 0) else null
        val idx = P?.q ?: g.q.indices.toList()
        return idx.mapIndexed { i, qi ->
            val q0 = g.q[qi]
            val q = if (q0.myName) store.nameSpellQuestion(displayName).let { n -> q0.copy(q = n.q, a = n.a, opts = n.opts, note = n.note) } else q0
            if (q.opts != null) Step.Gmc(q, i + 1, idx.size) else Step.Gq(q, i + 1, idx.size)
        }
    }
    /** phrases, one part (3 phrases): card → quick check → … → spaced phrases → produce each phrase */
    fun phraseSteps(sec: PhraseSec, item: PathItem?, bit: Int, speakOn: Boolean): List<Step> {
        val all = sec.items
        val idx = if (item != null) store.phraseBits(item)[bit] else all.indices.toList()
        val items = idx.map { all[it] }
        fun others(p: Phrase): List<Phrase> { val o = ArrayList<Phrase>(); for (x in shuffle(all)) if (o.size < 3 && x !== p && !t.overlaps(x.en, p.en) && t.norm(x.de) != t.norm(p.de) && o.none { y -> t.overlaps(y.en, x.en) }) o.add(x); return o }
        fun q(p: Phrase, listen: Boolean) = Step.Read(p, listen && p.a != null, if (listen) "What does this mean?" else "How do you say this in ${L.name}?", others(p))
        val repeat = item != null && store.bitDone(item, bit)
        val toSpeak = if (speakOn) shuffle(items.filter { t.speakable(it) }).take(2).toSet() else emptySet()
        val steps = ArrayList<Step>()
        items.forEachIndexed { i, p ->
            steps.add(Step.Flip(p, sec.title))
            if (p in toSpeak) steps.add(Step.Speak(p))
            steps.add(q(p, false))
            if (i >= 1) steps.add(q(items[floor(rnd.nextDouble() * i).toInt()], true))
        }
        val say = S.ro("say")
        shuffle(all.filter { p -> items.none { it === p } && t.sayItems(p).any { truthy(say[it.de]) } }).take(2).forEach { p -> sayStep(p, all)?.let { steps.add(it) } }
        shuffle(items).forEachIndexed { i, p ->
            val fresh = !repeat && t.sayItems(p).none { truthy(say[it.de]) }
            steps.add((if (fresh) guidedSayStep(p, all) else null) ?: sayStep(p, all, forceTiles = fresh) ?: q(p, i % 2 == 1))
        }
        return steps
    }
}

/** What the finish screen shows. */
data class Finish(
    val title: String, val kind: String, val acc: Int, val xp: Double, val lvBefore: Int, val lvAfter: Int, val rankUp: String?, val goalHit: Boolean,
    val perfect: Boolean, val failed: Boolean, val bitOf: Pair<Int, Int>?, val lessonDone: Boolean, val best: Int, val right: Int,
    val grades: List<Int>, val words: List<Word>, val wrong: List<Word>, val cheer: Pair<String, String>, val mins: Int,
    val hasNextBit: Boolean, val recallRate: Int?,
)

/** One lesson run (the `R` object of lesson.js). */
class LessonRun(val title: String, steps: List<Step>, val kind: String, private val onFinish: (LessonRun, Int) -> Double, val t0: Long = System.currentTimeMillis()) {
    val steps = steps.toMutableList()
    var i = 0; var done = 0; var total = steps.size; var right = 0; var answered = 0
    val wrongIds = LinkedHashSet<String>(); val retried = HashSet<String>(); val firstTry = HashMap<String, Boolean>()
    val grades = IntArray(5); var combo = 0; var best = 0; val words = LinkedHashSet<String>()
    val say = LinkedHashMap<String, Boolean>()
    // set by onFinish
    var failed = false; var bitOf: Pair<Int, Int>? = null; var lessonDone = false; var nextBit: (() -> Unit)? = null; var retry: (() -> Unit)? = null; var recallRate: Int? = null
    /** feedback of the last answer */
    var lastCombo: String? = null

    val step: Step? get() = steps.getOrNull(i)
    val pct: Double get() = min(100.0, 100.0 * done / maxOf(1, total))
    fun enter() { step?.w?.let { words.add(it.id) } }
    fun next() { i++; done++; enter() }

    private fun keyOf(s: Step): String = s.key ?: s.w?.id ?: when (s) { is Step.Gq -> s.q.q; is Step.Gmc -> s.q.q; else -> i.toString() }

    /** record an answer; requeues a missed word/phrase once. Returns the combo cheer (or null). */
    fun answered(s: Step, ok: Boolean, langName: String): String? {
        val key = keyOf(s)
        if (key !in firstTry) firstTry[key] = ok
        if (!s.retry) { answered++; if (ok) right++ }
        combo = if (ok) combo + 1 else 0; best = maxOf(best, combo)
        if (!ok) s.w?.let { wrongIds.add(it.id) }
        val sayKey = when (s) { is Step.Say -> s.item.de; is Step.Build -> s.sayDe; else -> null }
        if (sayKey != null && !s.retry) say[sayKey] = ok
        if (!ok && (s.w != null || sayKey != null) && !s.retry && key !in retried) {
            retried.add(key); steps.add(s.asRetry()); total++
        }
        lastCombo = if (ok) COMBO[combo]?.replace("{lang}", langName) else null
        return lastCombo
    }
    /** "I was right – count it" */
    fun override(s: Step) {
        right++; firstTry[keyOf(s)] = true
        if (s is Step.Say && !s.retry && say.isNotEmpty()) say[s.item.de] = true
    }
    /** review self-grade */
    fun recallGraded(s: Step.Recall, g: Int, store: Store) {
        if (!s.relearn) {
            store.gradeWord(s.w.id, g)
            grades[g]++; answered++; if (g >= 3) right++
            if (g == 1) wrongIds.add(s.w.id)
        }
        if (g == 1 && !s.relearn) { steps.add(s.copy(dir = "en_de", relearn = true)); total++ }
    }
    fun accuracy(): Int = if (answered > 0) jsRound(100.0 * right / answered).toInt() else 100

    fun finish(store: Store, cd: CourseData?, rnd: Random = Random, now: Long = System.currentTimeMillis()): Finish {
        val acc = accuracy()
        val before = store.xpToday()
        val lvBefore = store.level(store.progress().total).lv
        val xp = onFinish(this, acc)
        val lvAfter = store.level(store.progress().total).lv
        val goal = store.goalFor()
        val goalHit = before < goal && store.xpToday() >= goal
        val perfect = answered > 0 && right >= answered && kind != "review"
        val ch = cd?.lang?.cheers ?: CHEERS
        val set = if (perfect) ch["perfect"]!! else if (acc >= 80) ch["great"]!! else ch["ok"]!!
        val cheer = set[floor(rnd.nextDouble() * set.size).toInt()]
        val rankUp = if (Hero.stageFor(lvAfter) > Hero.stageFor(lvBefore)) Hero.rankForLevel(lvAfter) else null
        return Finish(title, kind, acc, xp, lvBefore, lvAfter, rankUp, goalHit, perfect, failed, bitOf, lessonDone, best, right, grades.toList(),
            words.mapNotNull { cd?.word?.get(it) }, wrongIds.mapNotNull { cd?.word?.get(it) }, cheer, maxOf(1, jsRound((now - t0) / 60000.0).toInt()),
            nextBit != null, recallRate)
    }

    companion object {
        const val PASS_ACC = 60
        val COMBO = mapOf(3 to "🔥 3 in a row – nice!", 5 to "🔥 5 in a row – you're on fire!", 8 to "⚡ 8 in a row – unstoppable!", 12 to "🌟 12 in a row – are you secretly {lang}?", 20 to "🚀 20 in a row – legendary focus!")
        val CHEERS = mapOf(
            "perfect" to listOf("🧠✨" to "Flawless! Your neurons are doing push-ups.", "🏆" to "Perfect run – even the dictionary is impressed.", "🚀" to "Not a single slip. Your brain should be in a museum.",
                "🌟" to "100 %! Somewhere a German grammar book just smiled.", "🥇" to "Perfekt! You're making this look far too easy.", "🎯" to "Bullseye every time. Researchers want to study your memory."),
            "great" to listOf("🎉" to "Sehr gut! Those words are sticking.", "💪" to "Strong work – your future self in Germany says danke.", "🔥" to "Great focus. Keep that momentum going!"),
            "ok" to listOf("🌱" to "Every mistake is a word you'll remember better. Weiter so!", "🧗" to "Progress, not perfection. You're climbing!", "☕" to "Good effort – a quick review tomorrow will lock it in."),
        )
    }
}

/** The public starters of lesson.js (startVocab / startReview / startGrammarPractice / startPhrases) with their XP rules. */
class Lessons(val store: Store, val cd: CourseData, val rnd: Random = Random) {
    val b = Builder(store, cd, rnd)
    private val S get() = store.S!!

    private fun partXP(fresh: Int, acc: Int, repeat: Boolean, lessonDone: Boolean): Double =
        if (repeat) Store.XPR_REPEAT else fresh * Store.XPR_NEW_ITEM + Store.XPR_PART + (if (acc >= 100) Store.XPR_PERFECT else 0.0) + (if (lessonDone) Store.XPR_LESSON else 0.0)
    private fun failedPart(r: LessonRun, retry: () -> Unit): Double { store.addXP(Store.XPR_FAILED); r.failed = true; r.retry = retry; return Store.XPR_FAILED }
    private fun setLastLogXP(xp: Double) { S.arr("log").lastOrNull()?.asObj()?.set("xp", xp) }

    /** start(run) is called with every new run (first try, "Try again", "Next part") */
    fun vocab(item: PathItem, bit: Int, start: (LessonRun) -> Unit) {
        val n = store.bitCount(item)
        start(LessonRun("Lesson ${item.n}: ${item.title}", b.vocabBitSteps(item, bit), "vocab", { r, acc ->
            if (acc < LessonRun.PASS_ACC && !truthy(S.obj("done")[item.id])) return@LessonRun failedPart(r) { vocab(item, bit, start) }
            val ids = store.wordBits(item)[bit]; val repeat = store.bitDone(item, bit)
            val fresh = ids.count { !truthy(S.obj("words")[it]) }
            ids.forEach { store.learnWord(it) }
            val done = store.completeBit(item, bit, acc.toDouble(), 0.0)
            val xp = partXP(fresh, acc, repeat, done)
            setLastLogXP(xp); store.addXP(xp)
            r.bitOf = (bit + 1) to n; r.lessonDone = done
            if (bit + 1 < n && !truthy(S.obj("done")[item.id])) r.nextBit = { vocab(item, bit + 1, start) }
            xp
        }))
    }
    fun review(ids: List<String>, start: (LessonRun) -> Unit) {
        start(LessonRun("${ids.size} words reviewed", b.reviewSteps(ids), "review", { r, _ ->
            val again = r.grades[1]; val hard = r.grades[2]; val good = r.grades[3]; val easy = r.grades[4]
            val n = (again + hard + good + easy).let { if (it == 0) 1 else it }
            val rate = (hard + good + easy).toDouble() / n
            val xp = jsRound(Store.XPR_RECALL * (good + easy) + Store.XPR_FORGOT * again + (if (rate >= 0.8) Store.XPR_REVIEW_BONUS else 0.0))
            val d = store.today(); val rv = S.obj("reviews"); rv[d] = rv.num(d) + ids.size
            if (xp >= 0) store.addXP(xp) else store.addPenalty(-xp, "Low review score (${jsRound(rate * 100).toInt()}% recalled)")
            r.recallRate = jsRound(rate * 100).toInt()
            xp
        }))
    }
    /** grammar part: +3 (+1 if perfect), +5 when it completes the chapter; a part done before gives +1. */
    fun grammarXP(g: Grammar, item: PathItem?, acc: Int?): Double {
        if (item == null) return Store.XPR_REPEAT
        if (truthy(S.obj("done")[item.id])) { store.completeItem(item.id, acc?.toDouble(), Store.XPR_REPEAT); return Store.XPR_REPEAT }
        store.completeItem(item.id, acc?.toDouble(), 0.0)
        val ids = cd.gparts[g.id] ?: listOf(item.id); val chapter = ids.all { truthy(S.obj("done")[it]) }
        val xp = Store.XPR_GRAMMAR_PART + (if (acc != null && acc >= 100) Store.XPR_PERFECT else 0.0) + (if (chapter) Store.XPR_LESSON else 0.0)
        setLastLogXP(xp); store.save()
        return xp
    }
    fun grammar(g: Grammar, item: PathItem?, displayName: String?, start: (LessonRun) -> Unit) {
        val P = item?.let { cd.gPart(it) }
        start(LessonRun(if (P != null) item.title else "Ch ${g.num}: ${g.title}", b.grammarSteps(g, item, displayName), "grammar", { _, acc ->
            val xp = grammarXP(g, item, acc); store.addXP(xp); xp
        }))
    }
    fun phrases(sec: PhraseSec, item: PathItem?, bit: Int, speakOn: Boolean, start: (LessonRun) -> Unit) {
        val repeat = item != null && store.bitDone(item, bit)
        val nItems = if (item != null) store.phraseBits(item)[bit].size else sec.items.size
        val n = if (item != null) store.bitCount(item) else 1
        start(LessonRun(sec.title, b.phraseSteps(sec, item, bit, speakOn), "phrases", { r, acc ->
            val say = S.obj("say")
            for ((k, ok) in r.say) say[k] = if (ok) say.num(k) + 1 else maxOf(0.0, say.num(k) - 1)
            if (item != null && acc < LessonRun.PASS_ACC && !truthy(S.obj("done")[item.id])) return@LessonRun failedPart(r) { phrases(sec, item, bit, speakOn, start) }
            val done = if (item != null) store.completeBit(item, bit, acc.toDouble(), 0.0) else false
            val xp = if (item != null) partXP(if (repeat) 0 else nItems, acc, repeat, done) else Store.XPR_REPEAT
            if (item != null) setLastLogXP(xp)
            store.addXP(xp)
            r.bitOf = (bit + 1) to n; r.lessonDone = done
            if (item != null && bit + 1 < n && !truthy(S.obj("done")[item.id])) r.nextBit = { phrases(sec, item, bit + 1, speakOn, start) }
            xp
        }))
    }
}

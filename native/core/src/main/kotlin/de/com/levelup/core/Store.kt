package de.com.levelup.core

import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/** JS Math.round (half up) */
fun jsRound(x: Double): Double = floor(x + 0.5)

data class Level(val lv: Int, val a1: Boolean, val frac: Double, val toNext: Double, val xpInto: Double = 0.0, val xpNeed: Double = 0.0)
data class Rank(val r: String, val next: String?, val nextAt: Int?)
data class Progress(var total: Double = 0.0, var vocab: Double = 0.0, var grammar: Double = 0.0, var phrases: Double = 0.0, var coverage: Double = 0.0)
data class Memory(val overdue: Int, val lapsed: Int, val health: Double, val due: Int)
data class Retention(val learning: Int, val known: Int, val mastered: Int, val learned: Int, val total: Int)
data class Pace(val expected: Double, val actual: Double, val coverage: Double, val needPerDay: Double, val actualPerDay: Double, val projected: String?,
                val left: Int, val gap: Double, val gapLessons: Double, val needLessonsPerWeek: Double, val actualLessonsPerWeek: Double, val span: Int, val el: Int)
data class Week(val n: Int, val from: String, val to: String, val items: MutableList<PathItem> = mutableListOf())
data class WeekPlan(val weeks: List<Week>, val of: Map<String, Int>, val nWeeks: Int)
data class PlannedPart(val it: PathItem, val k: Int, val ids: List<Any>)
data class Summary(val gems: Double, val lv: Int, val rank: String, val xpToday: Double, val xp: Double, val streak: Int, val lessons: Int, val of: Int,
                   val pct: Double, val expected: Double, val gapLessons: Double, val words: Int, val goal: Double, val target: String)
data class Gift(val id: String, val m: Int, val tier: String)
data class Rewards(val gems: Int, val gifts: List<Gift>)
data class Tier(val name: String, val min: Int, val max: Int, val color: String)

/**
 * Port of app/js/store.js. The learner state `S` is the raw JSON object of the progress file (JObj), so fields this
 * port doesn't know survive every save. `c` is the loaded language course (null for skill-tree courses, which only
 * use the XP / streak parts). Every "today" comes from [clock].
 */
class Store(var c: CourseData?, var clock: DayClock = DayClock.SYSTEM, var nowMs: () -> Long = System::currentTimeMillis) {
    var S: JObj? = null
    /** called after every change to S (S.updated is already bumped); the app persists + syncs */
    var onSave: (JObj) -> Unit = {}

    fun today() = clock.today()
    private val s: JObj @JvmName("cur") get() = S ?: error("no learner state loaded")
    private val path: List<PathItem> get() = c?.path ?: emptyList()

    // ---------- state ----------
    fun blank(): JObj = jobj(
        "v" to 2.0, "created" to today(), "updated" to 0.0, "setup" to false,
        "settings" to jobj("startDate" to "2026-11-09", "targetDate" to "2027-01-31", "dailyGoal" to 20.0, "goalMode" to "auto", "hindi" to true,
            "autoplay" to true, "sound" to true, "theme" to "system", "quest" to true, "speak" to true, "xp2" to true),
        "words" to jobj(), "done" to jobj(), "log" to jarr(), "xp" to jobj(), "reviews" to jobj(), "pen" to jobj(), "penLog" to jarr(),
        "penChecked" to null, "lastLv" to 1.0, "gems" to 0.0, "gifts" to jarr(), "questDays" to jobj(), "gemLog" to jarr(), "bits" to jobj(),
        "tree" to jobj(), "parts" to jobj(), "say" to jobj(), "hit" to jobj(), "time" to jobj(),
    )

    fun normalize(input: JObj?): JObj {
        val b = blank()
        val st = input ?: b
        val oldXP = !truthy(st.ro("settings")["xp2"])
        val merged = LinkedHashMap<String, Any?>(b["settings"].asObj()!!)
        st["settings"].asObj()?.forEach { (k, v) -> merged[k] = v }
        st["settings"] = merged
        for (k in b.keys) if (!st.containsKey(k)) st[k] = b[k]
        val set = settings(st)
        if (oldXP && set["goalMode"] == "manual") set["dailyGoal"] = max(10.0, jsRound(set.num("dailyGoal") * 0.4))
        val done = st.obj("done")
        c?.gparts?.forEach { (gid, ids) -> val d = done[gid]; if (truthy(d)) ids.forEach { id -> if (!truthy(done[id])) done[id] = LinkedHashMap(d.asObj()!!) } }
        if (!truthy(set["pb3"])) migratePhraseBits(st)
        if (!truthy(set["streakFrom"])) set["streakFrom"] = today()
        if (truthy(st["setup"]) && c != null) markGoal(st)
        return st
    }

    fun settings(st: JObj = s): JObj = st.obj("settings")

    fun save() {
        val st = S ?: return
        st["updated"] = nowMs().toDouble()
        onSave(st)
    }

    fun resetAll() { val set = LinkedHashMap(settings()); S = blank().also { it["settings"] = set }; save() }
    fun exportState(): String = Js.stringify(s)
    fun importState(txt: String) {
        val o = Js.parse(txt).asObj()
        require(o != null && o["settings"] != null && o["words"] != null) { "Not a backup file" }
        S = normalize(o); save()
    }

    // ---------- XP / streak ----------
    fun addXP(n: Double) { val t = today(); val xp = s.obj("xp"); xp[t] = xp.num(t) + n; markGoal(); save() }
    fun markGoal(st: JObj = s) {
        if (c == null) return
        val t = today(); val hit = st.obj("hit")
        if (!truthy(hit[t]) && st.obj("xp").num(t) >= goalFor(st)) hit[t] = goalFor(st)
    }
    fun xpToday(st: JObj = s) = st.obj("xp").num(today())
    fun questMode(st: JObj? = S) = st == null || st["settings"] == null || st.ro("settings")["quest"] != false
    fun dayCounts(d: String, st: JObj = s): Boolean {
        if (truthy(st.ro("hit")[d])) return true
        val from = settings(st).str("streakFrom").takeIf { !it.isNullOrEmpty() } ?: "9999"
        return st.obj("xp").num(d) > 0 && (!questMode(st) || d < from)
    }
    fun streak(st: JObj = s): Int {
        var d = today(); var n = 0
        if (!dayCounts(d, st)) d = Dates.addDays(d, -1)
        while (dayCounts(d, st)) { n++; d = Dates.addDays(d, -1) }
        return n
    }
    fun totalXP(st: JObj = s): Double = max(0.0, st.obj("xp").values.sumOf { it.asNum() ?: 0.0 } - st.ro("pen").values.sumOf { it.asNum() ?: 0.0 })
    fun addPenalty(n: Double, why: String, d: String = today()) {
        if (n <= 0) return
        val pen = s.obj("pen"); pen[d] = pen.num(d) + n
        val log = s.arr("penLog"); log.add(jobj("d" to d, "xp" to n, "why" to why))
        if (log.size > 200) s["penLog"] = ArrayList(log.takeLast(200))
        save()
    }
    fun checkMissed(): Int {
        val st = S ?: return 0
        if (!truthy(st["setup"])) return 0
        val y = Dates.addDays(today(), -1)
        if (!questMode()) { if (st["penChecked"] != y) { st["penChecked"] = y; save() }; return 0 }
        var d = st.str("penChecked")?.let { Dates.addDays(it, 1) } ?: y
        var lost = 0
        while (d <= y) {
            if (!truthy(st.obj("reviews")[d])) {
                val overdue = st.obj("words").values.count { val w = it.asObj() ?: return@count false
                    val due = w.str("due"); due != null && due <= d && (w.str("last").isNullOrEmpty() || w.str("last")!! < d) }
                if (overdue > 0) {
                    val n = min(10, MISSED_DAY_XP + overdue / 10)
                    addPenalty(n.toDouble(), "Missed reviews ($overdue words were due)", d); lost += n
                }
            }
            d = Dates.addDays(d, 1)
        }
        if (st["penChecked"] != y) { st["penChecked"] = y; save() }
        return lost
    }

    // ---------- level & rank ----------
    fun level(pct: Double, st: JObj? = S): Level {
        val p = min(100.0, max(0.0, pct))
        if (p >= 99.999) {
            if (st != null && st["a1XP"] == null) st["a1XP"] = totalXP(st)
            val extra = if (st != null) max(0.0, totalXP(st) - (st["a1XP"].asNum() ?: 0.0)) else 0.0
            return Level(A1_LEVEL + floor(extra / POST_A1_XP).toInt(), true, (extra % POST_A1_XP) / POST_A1_XP, 0.0, extra % POST_A1_XP, POST_A1_XP.toDouble())
        }
        val x = 1 + (p * (A1_LEVEL - 1)) / 100
        val lv = min(A1_LEVEL - 1, floor(x + 1e-9).toInt())
        val frac = x - lv
        return Level(lv, false, frac, ((1 - frac) * 100) / (A1_LEVEL - 1))
    }
    fun rank(pct: Double): Rank {
        var r = RANKS[0]; var nx: Pair<String, Int>? = RANKS[1]
        RANKS.forEachIndexed { i, x -> if (pct >= x.second) { r = x; nx = RANKS.getOrNull(i + 1) } }
        return Rank(r.first, nx?.first, nx?.second)
    }

    // ---------- diamonds & gift boxes ----------
    private fun addGems(n: Int, why: String) {
        s["gems"] = s.num("gems") + n
        val log = s.arr("gemLog"); log.add(jobj("d" to today(), "n" to n.toDouble(), "why" to why))
        if (log.size > 100) s["gemLog"] = ArrayList(log.takeLast(100))
    }
    fun checkRewards(questDone: Boolean): Rewards {
        val st = S ?: return Rewards(0, emptyList())
        if (!truthy(st["setup"])) return Rewards(0, emptyList())
        val t = today(); var gems = 0; val gifts = ArrayList<Gift>()
        val qd = st.obj("questDays")
        if (questDone && !truthy(qd[t])) { qd[t] = true; addGems(QUEST_GEMS, "Daily quest cleared"); gems = QUEST_GEMS }
        val n = streak()
        if (n > 0) {
            val end = if (truthy(st.obj("xp")[t])) t else Dates.addDays(t, -1)
            val runStart = Dates.addDays(end, -(n - 1))
            val list = st.arr("gifts")
            for (m in MILESTONES) {
                val id = "$runStart:$m"
                if (n >= m && list.none { it.asObj()?.get("id") == id }) {
                    list.add(jobj("id" to id, "m" to m.toDouble(), "tier" to tierFor(m), "earned" to t, "opened" to false, "amount" to 0.0))
                    gifts.add(Gift(id, m, tierFor(m)))
                }
            }
        }
        if (gems > 0 || gifts.isNotEmpty()) save()
        return Rewards(gems, gifts)
    }
    fun openGift(id: String, random: kotlin.random.Random = kotlin.random.Random): Int {
        val g = s.arr("gifts").firstOrNull { it.asObj()?.get("id") == id }.asObj() ?: return 0
        if (truthy(g["opened"])) return 0
        val t = TIERS[g.str("tier")] ?: return 0
        val amount = t.min + random.nextInt(t.max - t.min + 1)
        g["amount"] = amount.toDouble(); g["opened"] = true; g["openedOn"] = today()
        addGems(amount, "${t.name} gift box (${g.num("m").toInt()}-day streak)")
        save()
        return amount
    }
    fun nextMilestone(): Int? = MILESTONES.firstOrNull { it > streak() }

    // ---------- spaced repetition (SM-2) ----------
    private fun srs(w: JObj): JObj {
        if (!w.containsKey("ivl")) {
            val box = w.num("box").toInt()
            w["ivl"] = (LEITNER.getOrNull(box) ?: 0).toDouble(); w["ef"] = 2.5; w["reps"] = box.toDouble(); w["lapses"] = w.num("w")
        }
        return w
    }
    fun learnWord(id: String) {
        val words = s.obj("words")
        if (truthy(words[id])) return
        words[id] = jobj("ivl" to 0.0, "ef" to 2.5, "reps" to 0.0, "lapses" to 0.0, "due" to Dates.addDays(today(), 1), "since" to today(), "r" to 0.0, "w" to 0.0)
    }
    fun nextIvl(card: Map<String, Any?>, g: Int): Int {
        val w = srs(LinkedHashMap(card))
        val ivl = w.num("ivl"); val ef = w.num("ef"); val reps = w.num("reps")
        return when (g) {
            1 -> 1
            2 -> if (reps == 0.0) 2 else max(ivl + 1, jsRound(ivl * 1.2)).toInt()
            3 -> if (reps == 0.0) 3 else max(ivl + 1, jsRound(ivl * ef)).toInt()
            else -> if (reps == 0.0) 6 else max(ivl + 2, jsRound(ivl * ef * 1.3)).toInt()
        }
    }
    fun gradeWord(id: String, g: Int): Int {
        val words = s.obj("words")
        val w = srs(words[id].asObj() ?: jobj("ivl" to 0.0, "ef" to 2.5, "reps" to 0.0, "lapses" to 0.0, "due" to today(), "since" to today(), "r" to 0.0, "w" to 0.0).also { words[id] = it })
        val ivl = min(365, nextIvl(w, g))
        if (g == 1) { w["lapses"] = w.num("lapses") + 1; w["reps"] = 0.0; w["ef"] = max(1.3, w.num("ef") - 0.2); w["lapsed"] = true; w["w"] = w.num("w") + 1 }
        else {
            w["reps"] = w.num("reps") + 1; w["r"] = w.num("r") + 1
            if (g == 2) w["ef"] = max(1.3, w.num("ef") - 0.15)
            if (g == 4) w["ef"] = min(3.0, w.num("ef") + 0.15)
            if (g >= 3) w["lapsed"] = false
        }
        w["ivl"] = ivl.toDouble(); w["due"] = Dates.addDays(today(), ivl); w["last"] = today()
        save()
        return ivl
    }
    fun dueWords(st: JObj = s): List<String> {
        val t = today()
        return st.obj("words").entries.mapNotNull { (id, v) -> v.asObj()?.str("due")?.let { id to it } }
            .filter { it.second <= t }.sortedBy { it.second }.map { it.first }
    }
    fun overdueDays(w: Map<String, Any?>): Int = (w["due"] as? String)?.let { max(0, Dates.daysBetween(it, today()) - 1) } ?: 0
    fun wordStatus(id: String, st: JObj = s): String {
        val w = st.obj("words")[id].asObj() ?: return "new"
        val ivl = if (w.containsKey("ivl")) w.num("ivl") else LEITNER.getOrNull(w.num("box").toInt())?.toDouble() ?: Double.NaN
        return if (ivl >= 30) "mastered" else if (ivl >= 7) "known" else "learning"
    }
    /** How much a learned word still counts toward A1: overdue fades −1/14 per day (floor 25 %), forgotten counts half. */
    fun health(w: Map<String, Any?>?): Double {
        if (w == null) return 0.0
        val fade = max(0.25, 1 - overdueDays(w) / 14.0)
        return (if (truthy(w["lapsed"])) 0.5 else 1.0) * fade
    }

    // ---------- A1 progress ----------
    private var wCache: Map<String, Double>? = null
    private var wFor: CourseData? = null
    fun itemWeights(): Map<String, Double> {
        val cd = c ?: return emptyMap()
        if (wCache != null && wFor === cd) return wCache!!
        val p = cd.path; val nWords = cd.words.size
        val nG = p.filter { it.kind == "grammar" }.map { it.gid ?: it.id }.toSet().size
        val nP = p.count { it.kind == "phrases" }
        val m = LinkedHashMap<String, Double>()
        for (i in p) m[i.id] = when (i.kind) {
            "vocab" -> WEIGHTS_VOCAB * i.words.size / nWords
            "grammar" -> WEIGHTS_GRAMMAR / nG / (i.of ?: 1)
            else -> WEIGHTS_PHRASES / nP
        }
        wCache = m; wFor = cd
        return m
    }
    fun progress(st: JObj = s): Progress {
        val cd = c ?: return Progress()
        val w = itemWeights(); val out = Progress()
        val perWord = WEIGHTS_VOCAB / cd.words.size
        val words = st.obj("words"); val done = st.obj("done")
        for (it in cd.path) {
            val n = bitsDone(it, st); if (n == 0) continue
            val frac = if (truthy(done[it.id])) 1.0 else n.toDouble() / bitCount(it)
            out.coverage += w[it.id]!! * frac
            if (it.kind == "vocab") {
                var v = 0.0
                for (wid in it.words) v += if (truthy(words[wid])) perWord * health(words[wid].asObj()) else 0.0
                out.vocab += v; out.total += v
            } else {
                val x = w[it.id]!! * frac
                if (it.kind == "grammar") out.grammar += x else out.phrases += x
                out.total += x
            }
        }
        return out
    }
    fun memory(st: JObj = s): Memory {
        val ws = st.obj("words").values.mapNotNull { it.asObj() }
        val overdue = ws.count { overdueDays(it) > 0 }; val lapsed = ws.count { truthy(it["lapsed"]) }
        val h = if (ws.isNotEmpty()) ws.sumOf { health(it) } / ws.size else 1.0
        return Memory(overdue, lapsed, h, dueWords(st).size)
    }
    fun retention(st: JObj = s): Retention {
        val ids = st.obj("words").keys
        var l = 0; var k = 0; var m = 0
        ids.forEach { when (wordStatus(it, st)) { "learning" -> l++; "known" -> k++; "mastered" -> m++ } }
        return Retention(l, k, m, ids.size, c?.words?.size ?: 0)
    }
    /** cumulative coverage by day, from the completion dates */
    fun history(st: JObj = s): List<Pair<String, Double>> {
        val w = itemWeights(); val byDay = HashMap<String, Double>()
        for ((id, d) in st.obj("done")) { val day = d.asObj()?.str("date") ?: "undefined"; byDay[day] = (byDay[day] ?: 0.0) + (w[id] ?: 0.0) }
        var acc = 0.0
        return byDay.keys.sorted().map { d -> acc += byDay[d]!!; d to acc }
    }
    fun pace(st: JObj = s): Pace {
        val t = today(); val set = settings(st)
        val start = set.str("startDate")!!; val target = set.str("targetDate")!!
        val span = max(1, Dates.daysBetween(start, target))
        val el = min(max(Dates.daysBetween(start, t), 0), span)
        val expected = min(100.0, 100.0 * el / span)
        val pr = progress(st); val p = pr.coverage
        val left = max(0, Dates.daysBetween(t, target))
        val needPerDay = if (left > 0) (100 - p) / left else 100 - p
        val win = max(1, min(14, Dates.daysBetween(start, t) + 1))
        val from = Dates.addDays(t, -win + 1); val w = itemWeights()
        var recent = 0.0
        for ((id, d) in st.obj("done")) { val day = d.asObj()?.str("date") ?: continue; if (day >= from && day <= t) recent += w[id] ?: 0.0 }
        val actualPerDay = recent / win
        val projected = if (actualPerDay > 0) Dates.addDays(t, ceil((100 - p) / actualPerDay).toInt()) else null
        val avgItem = 100.0 / max(1, path.size)
        val gap = p - expected
        return Pace(expected, pr.total, p, needPerDay, actualPerDay, projected, left, gap, gap / avgItem, needPerDay * 7 / avgItem, actualPerDay * 7 / avgItem, span, el)
    }
    /** one-line stats for the comparison views (normalizes the given state, like the web) */
    fun summary(input: JObj?): Summary? {
        if (input == null || !truthy(input["setup"])) return null
        val st = normalize(input)
        val pc = pace(st)
        return Summary(st.num("gems"), level(pc.actual, st).lv, rank(pc.actual).r, xpToday(st), totalXP(st), streak(st),
            st.obj("done").keys.count { c?.item?.containsKey(it) == true }, path.size, pc.actual, pc.expected, pc.gapLessons,
            st.obj("words").size, goalFor(st), settings(st).str("targetDate") ?: "")
    }

    // ---------- bits: lessons are split into short parts (4 words / 3 phrases) ----------
    fun wordBits(it: PathItem): List<List<String>> = chunk(it.words, 4, 3)
    fun phraseBits(it: PathItem): List<List<Int>> = chunk((c?.phrases?.get(it.id)?.items ?: emptyList()).indices.toList(), PHRASE_BIT, 2)
    /** words (vocab), phrase indices (phrases) or [[0]] (grammar) */
    fun bitsOf(it: PathItem): List<List<Any>> = when (it.kind) {
        "vocab" -> wordBits(it)
        "phrases" -> phraseBits(it)
        else -> listOf(listOf(0))
    }
    fun bitCount(it: PathItem) = bitsOf(it).size
    private fun bitsArr(st: JObj, id: String): List<Any?> = st.ro("bits")[id].asArr() ?: emptyList()
    fun bitsDone(it: PathItem, st: JObj = s): Int = if (truthy(st.obj("done")[it.id])) bitCount(it) else bitsArr(st, it.id).count { truthy(it) }
    fun bitDone(it: PathItem, k: Int, st: JObj = s): Boolean = truthy(st.obj("done")[it.id]) || truthy(bitsArr(st, it.id).getOrNull(k))
    fun nextBit(it: PathItem): Int {
        val b = bitsArr(s, it.id)
        for (i in 0 until bitCount(it)) if (!truthy(b.getOrNull(i))) return i
        return 0
    }
    /** returns true when this finished the whole lesson */
    fun completeBit(it: PathItem, i: Int, score: Double?, xp: Double): Boolean {
        val b = s.obj("bits").let { bits -> bits[it.id].asArr() ?: jarr().also { a -> bits[it.id] = a } }
        while (b.size <= i) b.add(null)
        if (!truthy(b[i])) b[i] = today()
        s.arr("log").add(jobj("d" to today(), "id" to it.id, "bit" to i.toDouble(), "xp" to xp))
        val done = s.obj("done")
        val all = bitsDone(it) >= bitCount(it) || b.count { truthy(it) } >= bitCount(it)
        if (all && !truthy(done[it.id])) { done[it.id] = jobj("date" to today(), "score" to score, "last" to today()); save(); return true }
        done[it.id].asObj()?.set("last", today())
        save()
        return false
    }
    fun completeItem(id: String, score: Double?, xp: Double): Boolean {
        val done = s.obj("done"); val first = !truthy(done[id])
        done[id] = jobj("date" to (if (first) today() else done[id].asObj()!!["date"]), "score" to score, "last" to today())
        s.arr("log").add(jobj("d" to today(), "id" to id, "xp" to xp))
        save()
        return first
    }
    /** "I already know this": mark a lesson done without doing it (its words enter reviews today) */
    fun markDone(it: PathItem) {
        val done = s.obj("done"); if (truthy(done[it.id])) return
        done[it.id] = jobj("date" to today(), "score" to null, "marked" to true)
        if (it.kind == "vocab") it.words.forEach { id -> learnWord(id); s.obj("words")[id].asObj()!!["due"] = today() }
        save()
    }
    fun undoDone(it: PathItem) { s.obj("done").remove(it.id); s.obj("bits").remove(it.id); save() }

    private fun migratePhraseBits(st: JObj) {
        val cd = c ?: return
        for (it in cd.path) {
            if (it.kind != "phrases" || truthy(st.obj("done")[it.id])) continue
            val old = st.ro("bits")[it.id].asArr() ?: continue
            if (old.none { truthy(it) }) continue
            val items = cd.phrases[it.id]?.items ?: continue
            val oldIdx = ArrayList<MutableList<Int>>()
            var i = 0
            while (i < items.size) { oldIdx.add(mutableListOf(i)); if (items[i].de in OLD_SPLIT && i + 1 < items.size) oldIdx.last().add(++i); i++ }
            val doneAt = HashMap<Int, Any?>()
            chunk(oldIdx.indices.toList(), 5, 3).forEachIndexed { b, ks -> if (truthy(old.getOrNull(b))) ks.forEach { k -> oldIdx[k].forEach { doneAt[it] = old[b] } } }
            st.obj("bits")[it.id] = chunk(items.indices.toList(), PHRASE_BIT, 2).map { ids -> if (ids.all { truthy(doneAt[it]) }) doneAt[ids[0]] else null }.toMutableList()
        }
        settings(st)["pb3"] = true
    }

    // ---------- weekly plan ----------
    private var planCache: WeekPlan? = null
    private var planKey = ""
    private var planFor: CourseData? = null
    fun weekPlan(st: JObj = s): WeekPlan {
        val set = settings(st); val start = set.str("startDate")!!; val target = set.str("targetDate")!!; val key = "$start|$target"
        if (planCache != null && planKey == key && planFor === c) return planCache!!
        val m0 = Dates.mondayOf(start); val span = max(1, Dates.daysBetween(start, target))
        val nWeeks = max(1, Math.floorDiv(Dates.daysBetween(m0, target), 7) + 1)
        val weeks = (0 until nWeeks).map { k -> Week(k + 1, Dates.addDays(m0, k * 7), Dates.addDays(m0, k * 7 + 6)) }
        val w = itemWeights(); val of = LinkedHashMap<String, Int>()
        var cum = 0.0
        for (it in path) {
            val mid = cum + w[it.id]!! / 2; cum += w[it.id]!!
            val day = Dates.addDays(start, floor((span * mid) / 100).toInt())
            val k = min(nWeeks - 1, max(0, Math.floorDiv(Dates.daysBetween(m0, day), 7)))
            weeks[k].items.add(it); of[it.id] = k + 1
        }
        return WeekPlan(weeks, of, nWeeks).also { planCache = it; planKey = key; planFor = c }
    }
    fun weekOf(it: PathItem) = weekPlan().of[it.id] ?: 0
    fun thisWeek(): Int {
        val p = weekPlan(); val t = today()
        return p.weeks.firstOrNull { it.from <= t && t <= it.to }?.n ?: if (t < p.weeks[0].from) 0 else p.nWeeks + 1
    }

    // ---------- daily goal ----------
    fun remainingXP(st: JObj = s): Double {
        var xp = 0.0
        val done = st.obj("done")
        for (it in path) {
            if (truthy(done[it.id])) continue
            if (it.kind == "grammar") { xp += XPR_GRAMMAR_PART + XPR_PERFECT / 2 + (if (it.gid == null || it.part == (it.of ?: 1) - 1) XPR_LESSON else 0.0); continue }
            val b = bitsArr(st, it.id)
            bitsOf(it).forEachIndexed { k, ids -> if (!truthy(b.getOrNull(k))) xp += PART_XP + ids.size * XPR_NEW_ITEM }
            xp += XPR_LESSON
        }
        return xp
    }
    fun autoGoal(st: JObj = s): Double {
        val days = max(1, Dates.daysBetween(today(), settings(st).str("targetDate")!!) + 1)
        val learned = st.obj("words").size
        val allowance = min(6.0, 1 + jsRound(learned * 0.006))
        val raw = remainingXP(st) / days + allowance
        return max(10.0, min(100.0, jsRound(raw)))
    }
    fun goalFor(st: JObj = s): Double {
        val set = settings(st)
        if (set["goalMode"] == "manual") return set.num("dailyGoal").takeIf { it != 0.0 && !it.isNaN() } ?: 50.0
        val t = today(); val gd = st["goalDay"].asObj()
        if (gd == null || gd["d"] != t || gd["target"] != set["targetDate"] || gd["s"].asNum() != 2.0) {
            st["goalDay"] = jobj("d" to t, "v" to autoGoal(st), "target" to set["targetDate"], "s" to 2.0)
            if (st === S) save()
        }
        return st["goalDay"].asObj()!!.num("v")
    }
    fun remainingParts(st: JObj = s): Int {
        var n = 0; val done = st.obj("done")
        for (it in path) {
            if (truthy(done[it.id])) continue
            if (it.kind == "grammar") { n++; continue }
            val b = bitsArr(st, it.id)
            n += bitsOf(it).indices.count { !truthy(b.getOrNull(it)) }
        }
        return n
    }
    /** parts a day that keep you on track (1–8, frozen once per day). Web bug fixed: manual goal mode had no goalDay. */
    fun partsGoal(st: JObj = s): Int {
        goalFor(st)
        var gd = st["goalDay"].asObj()
        if (gd == null || gd["d"] != today()) { gd = jobj("d" to today(), "v" to autoGoal(st), "target" to settings(st)["targetDate"], "s" to 2.0); st["goalDay"] = gd }
        if (gd["p"] == null) {
            val days = max(1, Dates.daysBetween(today(), settings(st).str("targetDate")!!) + 1)
            gd["p"] = max(1, min(8, ceil(remainingParts(st).toDouble() / days).toInt())).toDouble()
            if (st === S) save()
        }
        return gd.num("p").toInt()
    }
    fun partsToday(st: JObj = s): Int {
        val t = today(); var n = 0; val done = st.obj("done")
        for (it in path) {
            if (it.kind == "grammar") { if (done[it.id].asObj()?.get("date") == t) n++; continue }
            n += bitsArr(st, it.id).count { it == t }
        }
        return n
    }
    fun nextItem(st: JObj = s): PathItem? = path.firstOrNull { !truthy(st.obj("done")[it.id]) }
    fun lastPartToday(st: JObj = s): String? {
        val t = today(); val log = st.arr("log")
        var k = log.size - 1
        while (k >= 0 && log[k].asObj()?.get("d") == t) { val id = log[k].asObj()!!.str("id"); if (id != null && c?.item?.containsKey(id) == true) return id; k-- }
        return null
    }
    fun pickFrom(isDone: (String) -> Boolean, last: String?): PathItem? {
        val open = ArrayList<PathItem>()
        for (i in path) if (!isDone(i.id)) { open.add(i); if (open.size >= 3) break }
        if (open.isEmpty()) return null
        if (last == null || open[0].id != last) return open[0]
        val k = c?.item?.get(last)?.kind
        return open.firstOrNull { it.id != last && it.kind != k } ?: open.firstOrNull { it.id != last } ?: open[0]
    }
    fun nextPick(st: JObj = s): PathItem? = pickFrom({ truthy(st.obj("done")[it]) }, lastPartToday(st))
    fun planParts(n: Int, st: JObj = s): List<PlannedPart> {
        val done = st.obj("done").keys.toMutableSet(); val bits = HashMap<String, MutableList<Any?>>(); val out = ArrayList<PlannedPart>()
        var last = lastPartToday(st)
        repeat(n) {
            val it = pickFrom({ it in done }, last) ?: return out
            val B = bitsOf(it); val b = bits.getOrPut(it.id) { ArrayList(bitsArr(st, it.id)) }
            var k = B.indices.indexOfFirst { x -> !truthy(b.getOrNull(x)) }; if (k < 0) k = 0
            while (b.size <= k) b.add(null)
            b[k] = 1.0; out.add(PlannedPart(it, k, B[k]))
            if (it.kind == "grammar" || B.indices.all { x -> truthy(b.getOrNull(x)) }) done.add(it.id)
            last = it.id
        }
        return out
    }

    // ---------- the learner's own name (spelling practice) ----------
    fun myName(displayName: String?): String {
        val first = JsText.words(JsText.trim(displayName ?: "")).firstOrNull() ?: ""
        val n = JsText.upper(first).map { it.toString() }.filter { DE_LETTER.containsKey(it) }.joinToString("")
        return if (n.length in 2..10) n else "ANNA"
    }
    fun personalize(html: String, displayName: String?): String {
        if (!html.contains("{{")) return html
        val n = myName(displayName); val nice = n[0] + JsText.lower(n.substring(1))
        return html.replace("{{NAME}}", n).replace("{{Name}}", nice).replace("{{NAME_SAY}}", spellDE(n))
    }
    fun nameSpellQuestion(displayName: String?): GQ {
        val n = myName(displayName); val right = spellDE(n)
        val vowelTrap = mapOf("A" to "ay", "E" to "ee", "I" to "eye")
        val consTrap = mapOf("J" to "jay", "G" to "jee", "V" to "vee", "W" to "double-u", "Z" to "zed", "C" to "see", "Y" to "why")
        val triangle = mapOf("A" to "ee", "E" to "aa", "I" to "ay")
        val cands = listOf(
            spellWith(n) { ch, _ -> vowelTrap[ch] ?: DE_LETTER[ch] ?: ch },
            spellWith(n) { ch, _ -> EN_LETTER[ch] ?: DE_LETTER[ch] ?: ch },
            spellWith(n) { ch, _ -> consTrap[ch] ?: DE_LETTER[ch] ?: ch },
            spellWith(n) { ch, _ -> triangle[ch] ?: DE_LETTER[ch] ?: ch },
            spellWith(n) { ch, i -> (if (i == 0) EN_LETTER[ch] else null) ?: DE_LETTER[ch] ?: ch },
        )
        val opts = mutableListOf(right)
        for (x in cands) if (x !in opts && opts.size < 4) opts.add(x)
        val note = n.map { it.toString() }.distinct().joinToString(", ") { "$it = “${DE_LETTER[it] ?: it}”" }
        return GQ(q = "How do you spell $n in German?", a = right, opts = opts, note = "$note.")
    }

    companion object {
        const val A1_LEVEL = 100
        const val POST_A1_XP = 200
        const val MISSED_DAY_XP = 3
        const val QUEST_GEMS = 5
        const val PHRASE_BIT = 3
        const val WEIGHTS_VOCAB = 55.0; const val WEIGHTS_GRAMMAR = 30.0; const val WEIGHTS_PHRASES = 15.0
        // XP scheme 2 (XPR in store.js)
        const val XPR_NEW_ITEM = 1.0; const val XPR_PART = 2.0; const val XPR_PERFECT = 1.0; const val XPR_LESSON = 5.0; const val XPR_GRAMMAR_PART = 3.0
        const val XPR_REPEAT = 1.0; const val XPR_FAILED = 1.0; const val XPR_RECALL = 0.2; const val XPR_FORGOT = -0.5; const val XPR_REVIEW_BONUS = 1.0
        const val PART_XP = XPR_PART + XPR_PERFECT / 2
        val GRADES = listOf("", "Again", "Hard", "Good", "Easy")
        val LEITNER = listOf(0, 1, 3, 7, 14, 30, 60, 120)
        val RANKS = listOf("E" to 0, "D" to 10, "C" to 25, "B" to 45, "A" to 70, "S" to 95)
        val MILESTONES = listOf(7, 14, 21, 30, 45, 60, 75, 90, 120, 150, 180, 365)
        val TIERS = mapOf("common" to Tier("Common", 15, 30, "#5aa9ff"), "rare" to Tier("Rare", 40, 80, "#b48cff"),
            "epic" to Tier("Epic", 100, 180, "#ff6bd5"), "legendary" to Tier("Legendary", 250, 400, "#ffcc4d"))
        fun tierFor(m: Int) = if (m < 14) "common" else if (m < 30) "rare" else if (m < 90) "epic" else "legendary"
        val OLD_SPLIT = setOf("Danke, gut. Und Ihnen?")

        fun <T> chunk(arr: List<T>, size: Int, minLast: Int): List<List<T>> {
            val out = ArrayList<MutableList<T>>()
            var i = 0
            while (i < arr.size) { out.add(arr.subList(i, min(arr.size, i + size)).toMutableList()); i += size }
            if (out.size > 1 && out.last().size < minLast) { val l = out.removeAt(out.size - 1); out.last().addAll(l) }
            return out
        }

        val DE_LETTER = mapOf("A" to "aa", "B" to "bay", "C" to "tsay", "D" to "day", "E" to "ay", "F" to "ef", "G" to "gay", "H" to "haa", "I" to "ee", "J" to "yot",
            "K" to "kaa", "L" to "el", "M" to "em", "N" to "en", "O" to "oh", "P" to "pay", "Q" to "koo", "R" to "air", "S" to "es", "T" to "tay", "U" to "oo",
            "V" to "fow", "W" to "vay", "X" to "iks", "Y" to "üp-si-lon", "Z" to "tset", "Ä" to "a-umlaut", "Ö" to "o-umlaut", "Ü" to "u-umlaut", "ß" to "ess-tset")
        val EN_LETTER = mapOf("A" to "ay", "B" to "bee", "C" to "see", "D" to "dee", "E" to "ee", "F" to "ef", "G" to "jee", "H" to "aitch", "I" to "eye", "J" to "jay",
            "K" to "kay", "L" to "el", "M" to "em", "N" to "en", "O" to "oh", "P" to "pee", "Q" to "kyoo", "R" to "ar", "S" to "es", "T" to "tee", "U" to "yoo",
            "V" to "vee", "W" to "double-u", "X" to "ex", "Y" to "why", "Z" to "zed")
        private fun spellWith(name: String, f: (String, Int) -> String) = name.mapIndexed { i, ch -> f(ch.toString(), i) }.joinToString(" – ")
        fun spellDE(name: String) = spellWith(name) { ch, _ -> DE_LETTER[ch] ?: ch }

    }
}

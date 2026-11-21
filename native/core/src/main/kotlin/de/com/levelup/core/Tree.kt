package de.com.levelup.core

import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlin.math.abs
import kotlin.math.max

/**
 * Skill-tree courses (Software Engineering, Maths), from the tree part of app/js/app.js:
 * S.tree[node] = date learned, S.parts[node][k] = date a part was read, S.read[key] = card position,
 * S.lastRead = {id, at}, S.quiz / S.cc[node] = {best, of, at, xp}.
 */
class Tree(val store: Store, val t: TreeContent) {
    private val S get() = store.S!!
    fun nodes(branch: String) = t.nodes.filter { it.branch == branch }
    fun node(id: String) = t.nodes.firstOrNull { it.id == id }
    fun branch(id: String) = t.branches.firstOrNull { it.id == id }
    fun openBranches() = t.branches.filter { it.status == "open" }.sortedBy { it.order }
    fun soonBranches() = t.branches.filter { it.status != "open" }.sortedBy { it.order }
    fun nodeDone(id: String) = truthy(S.ro("tree")[id])
    fun nodeOpen(n: TreeNode) = n.req.all { nodeDone(it) }
    fun state(n: TreeNode) = if (nodeDone(n.id)) "done" else if (nodeOpen(n)) "open" else "locked"
    fun parts(n: TreeNode) = n.parts.ifEmpty { null }
    fun partDone(n: TreeNode, k: Int) = nodeDone(n.id) || truthy(S.ro("parts")[n.id].asObj()?.get(k.toString()))
    fun partsDoneCount(n: TreeNode) = parts(n)?.indices?.count { partDone(n, it) } ?: if (nodeDone(n.id)) 1 else 0
    fun nextPart(n: TreeNode): Int? { val P = parts(n) ?: return null; val k = P.indices.indexOfFirst { !partDone(n, it) }; return if (k < 0) 0 else k }
    fun nodeFrac(n: TreeNode): Double { val P = parts(n); return if (nodeDone(n.id)) 1.0 else if (P != null) partsDoneCount(n).toDouble() / P.size else 0.0 }
    fun branchFrac(b: Branch): Double { val ns = nodes(b.id); return if (ns.isEmpty()) 0.0 else ns.sumOf { nodeFrac(it) } / ns.size }
    fun nextNode(b: Branch) = nodes(b.id).sortedBy { it.n }.firstOrNull { !nodeDone(it.id) && nodeOpen(it) }
    fun learnedCount() = openBranches().flatMap { nodes(it.id) }.count { nodeDone(it.id) }

    data class Target(val br: Branch, val n: TreeNode, val fresh: Boolean)
    fun continueTarget(): Target? {
        val lrId = S.ro("lastRead")["id"].asStr()
        val lr = lrId?.let { node(it) }
        if (lr != null) {
            val br = branch(lr.branch)
            if (br != null && br.status == "open") { val n = if (!nodeDone(lr.id) && nodeOpen(lr)) lr else nextNode(br); if (n != null) return Target(br, n, false) }
        }
        val brs = openBranches(); val started = brs.filter { branchFrac(it) > 0 && nextNode(it) != null }
        val br = started.firstOrNull() ?: brs.firstOrNull { nextNode(it) != null } ?: return null
        return Target(br, nextNode(br)!!, started.isEmpty())
    }
    fun readLabel(n: TreeNode, st: String): String {
        val pos = S.ro("read")[n.id].asNum()?.toInt(); val P = parts(n)
        if (st == "done") return "📖 Read again"
        if (P != null) {
            val k = nextPart(n)!!; val p = P[k]; val inside = pos != null && pos > p.a && pos <= p.b
            return if (inside) "📖 Continue part ${k + 1} (card ${pos!! - p.a + 1} of ${p.b - p.a + 1})" else "📖 Start part ${k + 1} of ${P.size}"
        }
        return if (pos != null && pos > 0) "📖 Continue reading (card ${pos + 1})" else "📖 Start reading"
    }

    /** A reading session over one part (or the whole chapter / the branch intro). */
    inner class Reader(val br: Branch, val n: TreeNode?, val ch: Chapter, partIdx: Int?) {
        val key = n?.id ?: (br.id + ".intro")
        val parts: List<NodePart>? = n?.let { if (ch.parts.isNotEmpty()) ch.parts else parts(it) }
        val k: Int? = parts?.let { P -> partIdx ?: if (nodeDone(n!!.id)) 0 else (P.indices.indexOfFirst { !partDone(n, it) }.let { if (it < 0) 0 else it }) }
        val a = parts?.get(k!!)?.a ?: 0
        val b = parts?.get(k!!)?.b?.coerceAtMost(ch.cards.size - 1) ?: (ch.cards.size - 1)
        var i: Int
        init {
            if (n != null) S["lastRead"] = jobj("id" to n.id, "at" to store.nowMs().toDouble())
            var p = S.ro("read")[key].asNum()?.toInt() ?: 0
            if (p < a || p > b) p = a
            if (n != null && (nodeDone(n.id) || (parts != null && partDone(n, k!!))) && p >= b) p = a
            i = p
        }
        val card get() = ch.cards[i]
        val last get() = i == b
        val counting get() = n != null && !nodeDone(n.id) && nodeOpen(n)
        val pct get() = 100.0 * (i - a + 1) / (b - a + 1)
        fun finishLabel(): String {
            val othersDone = parts?.indices?.all { it == k || partDone(n!!, it) } ?: true
            return if (!counting) "Done" else if (parts == null || othersDone) "Finish · +${t.xpPerSkill} XP" else if (partDone(n!!, k!!)) "Done" else "Finish part ${k + 1} of ${parts.size}"
        }
        fun back() { if (i > a) { i--; S.obj("read")[key] = i.toDouble(); store.save() } }
        fun next() { if (i < b) { i++; S.obj("read")[key] = i.toDouble(); store.save() } }
        /** last card: record the part / skill. Returns a message for a toast. */
        fun finish(): String? {
            val node = n
            if (parts != null && counting && node != null) {
                val pm = S.obj("parts").obj(node.id); if (!truthy(pm[k.toString()])) pm[k.toString()] = store.today()
                val nk = parts.indices.indexOfFirst { !partDone(node, it) }
                S.obj("read")[key] = (if (nk < 0) 0 else parts[nk].a).toDouble()
                if (nk >= 0) { store.save(); return "✓ Part ${k!! + 1} of ${parts.size} done · ${parts.size - partsDoneCount(node)} to go" }
            } else S.obj("read")[key] = 0.0
            if (counting && node != null) {
                S.obj("tree")[node.id] = store.today(); store.addXP(t.xpPerSkill.toDouble())
                val left = nodes(node.branch).count { !nodeDone(it.id) }
                return if (left > 0) "${node.icon} ${node.title} learned! +${t.xpPerSkill} XP" else "👑 Branch complete! You mastered ${br.title}"
            }
            store.save(); return null
        }
    }

    fun undo(id: String) { S.obj("tree").remove(id); S.obj("parts").remove(id); store.save() }

    // ---------- practice questions ----------
    data class QuizResult(val got: Int, val of: Int, val xp: Int, val best: Int, val gaps: List<Pair<TreeNode, Int>>)
    fun quizRight(q: QuizQ, answer: Any): Boolean {
        val a = q.a as? JsonPrimitive
        return when (q.t) {
            "mc", "step" -> a?.intOrNull == answer
            "asn" -> a?.content == answer
            "tf", "mf" -> (a?.booleanOrNull ?: (a?.intOrNull == 1)) == answer
            "num" -> answer is Double && a?.doubleOrNull?.let { numOK(q, answer, it) } == true
            else -> false
        }
    }
    fun numOK(q: QuizQ, v: Double, a: Double) = abs(v - a) <= (q.tol ?: max(1e-9, abs(a) * 0.005))
    fun gapNode(q: QuizQ, n: TreeNode) = q.gap?.takeIf { it != n.id }?.let { node(it) }
    /** S.quiz / S.cc[node] = {best, of, at, xp}; the first full run with 80 %+ right gives +5 XP once */
    fun quizDone(n: TreeNode, mode: String, qs: List<QuizQ>, asked: List<Int>, res: List<Boolean>, full: Boolean): QuizResult {
        val got = res.count { it }; val sk = if (mode == "cc") "cc" else "quiz"
        val r = S.obj(sk)[n.id].asObj() ?: jobj("best" to 0.0, "of" to qs.size.toDouble(), "xp" to false)
        var xp = 0
        if (full) {
            r["of"] = qs.size.toDouble(); r["best"] = max(r.num("best"), got.toDouble()); r["at"] = store.today()
            if (!truthy(r["xp"]) && got >= Math.ceil(QUIZ_PASS * asked.size)) { r["xp"] = true; xp = QUIZ_XP }
        }
        S.obj(sk)[n.id] = r
        val gaps = LinkedHashMap<String, Int>()
        asked.forEachIndexed { k, qi -> if (!res[k]) gapNode(qs[qi], n)?.let { gaps[it.id] = (gaps[it.id] ?: 0) + 1 } }
        if (xp > 0) store.addXP(xp.toDouble()) else store.save()
        return QuizResult(got, asked.size, xp, r.num("best").toInt(), gaps.entries.sortedByDescending { it.value }.map { node(it.key)!! to it.value })
    }
    fun quizBest(n: TreeNode, mode: String) = S.ro(if (mode == "cc") "cc" else "quiz")[n.id].asObj()

    companion object {
        const val QUIZ_XP = 5
        const val QUIZ_PASS = 0.8
        /** numbers as people type them: −3, 3/4, 1,250, 0,5, 12%, 44,240 euros */
        fun parseNum(txt: String): Double {
            var t = txt.trim().replace(Regex("[−–—]"), "-").replace(Regex("\\s+"), "").replace(Regex("[%€$£]|euros?|units?", RegexOption.IGNORE_CASE), "")
            if (Regex("^-?\\d+,\\d{1,2}$").matches(t)) t = t.replace(",", ".")
            t = t.replace(",", "")
            Regex("^(-?\\d+(?:\\.\\d+)?)/(\\d+(?:\\.\\d+)?)$").find(t)?.let { m -> val d = m.groupValues[2].toDouble(); return if (d != 0.0) m.groupValues[1].toDouble() / d else Double.NaN }
            return if (Regex("^-?(\\d+\\.?\\d*|\\.\\d+)$").matches(t)) t.toDouble() else Double.NaN
        }
    }
}

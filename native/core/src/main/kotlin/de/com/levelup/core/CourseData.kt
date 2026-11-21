package de.com.levelup.core

import org.jsoup.Jsoup
import org.jsoup.nodes.Comment
import org.jsoup.nodes.Element
import org.jsoup.nodes.Node
import org.jsoup.nodes.TextNode

/**
 * A loaded language course with the indexes store.js keeps in `C` (word / item / grammar / phrases / gparts),
 * after the same load-time transforms: long grammar chapters cut into parts (splitGrammar), the path spread so
 * topics don't repeat back to back (spreadPath), and topics over several lessons numbered I, II, … (numberTopics).
 */
class CourseData(val course: Course, val content: LangContent) {
    val lang: LangProfile = Langs.of(content.lang ?: course.lang)
    val words: List<Word> get() = content.words
    val word: Map<String, Word> = content.words.associateBy { it.id }
    val grammar: Map<String, Grammar> = content.grammar.associateBy { it.id }
    val phrases: Map<String, PhraseSec> = content.phrases.associateBy { it.id }
    val path: List<PathItem>
    val item: Map<String, PathItem>
    val gparts: Map<String, List<String>>

    init {
        path = spreadPath(expandGrammar(content.path))
        val gp = LinkedHashMap<String, MutableList<String>>()
        path.forEach { p -> p.gid?.let { gp.getOrPut(it) { mutableListOf() }.add(p.id) } }
        gparts = gp
        numberTopics(path)
        item = path.associateBy { it.id }
    }

    fun grammarOf(it: PathItem): Grammar? = grammar[it.gid ?: it.id]
    fun gPart(it: PathItem): GPart? = if (it.gid != null) grammarOf(it)?.let { g -> GrammarSplit.split(g).getOrNull(it.part ?: 0) } else null

    private fun expandGrammar(p: List<PathItem>): List<PathItem> {
        val out = ArrayList<PathItem>()
        for (it in p) {
            val g = grammar[it.id]
            if (it.kind != "grammar" || g == null) { out.add(it.copy()); continue }
            val parts = GrammarSplit.split(g)
            if (parts.size < 2) { out.add(it.copy()); continue }
            parts.forEachIndexed { k, part -> out.add(it.copy(id = "${it.id}.${k + 1}", gid = it.id, part = k, of = parts.size, title = "Ch ${g.num}.${k + 1}: ${part.t}")) }
        }
        return out
    }

    private fun topicsOf(it: PathItem): List<String> = when (it.kind) {
        "vocab" -> it.title.split(" · ").map { "v:$it" }
        "grammar" -> listOf("g:" + (it.gid ?: it.id))
        else -> listOf("p:" + it.id)
    }

    private fun spreadPath(path: List<PathItem>): List<PathItem> {
        val left = path.toMutableList(); val out = ArrayList<PathItem>()
        fun clash(it: PathItem): Boolean {
            val t = topicsOf(it)
            val gap = if (it.kind == "grammar") (grammar[it.gid ?: it.id]?.gap ?: GAP_G) else GAP
            return out.takeLast(gap).any { o -> topicsOf(o).any { it in t } }
        }
        while (left.isNotEmpty()) {
            var k = left.take(LOOK).indexOfFirst { !clash(it) }
            if (k < 0) k = 0
            out.add(left.removeAt(k))
        }
        var n = 0
        out.forEach { if (it.kind == "vocab") it.n = ++n }
        return out
    }

    private fun numberTopics(path: List<PathItem>) {
        val vocab = path.filter { it.kind == "vocab" }
        val total = HashMap<String, Int>(); val seen = HashMap<String, Int>()
        vocab.forEach { i -> i.title.split(" · ").forEach { total[it] = (total[it] ?: 0) + 1 } }
        vocab.forEach { i ->
            i.title = i.title.split(" · ").joinToString(" · ") { t -> if ((total[t] ?: 0) > 1) "$t ${roman((seen.merge(t, 1, Int::plus))!!)}" else t }
        }
    }

    companion object {
        const val GAP = 2; const val GAP_G = 3; const val LOOK = 8
        fun roman(n0: Int): String {
            var n = n0; val sb = StringBuilder()
            for ((v, r) in listOf(10 to "X", 9 to "IX", 5 to "V", 4 to "IV", 1 to "I")) while (n >= v) { sb.append(r); n -= v }
            return sb.toString()
        }
    }
}

/** Port of splitGrammar(): long chapters cut into short reads at headings (big tables by rows); questions follow their text. */
object GrammarSplit {
    private const val PART_MAX = 700; private const val PART_MIN = 250; private const val SPLIT_FROM = 900; private const val TABLE_ROWS = 8
    private val NON_LETTER = Regex("[^\\p{L}]+")
    private val HEAD = Regex("^H[2-5]$", RegexOption.IGNORE_CASE)

    /** DOM textContent (jsoup's wholeText adds "\n" for <br>, textContent doesn't). */
    fun textContent(n: Node): String = when (n) {
        is TextNode -> n.wholeText
        is Comment -> n.data
        is Element -> if (n.normalName() == "br") "" else n.childNodes().joinToString("") { textContent(it) }
        else -> n.childNodes().joinToString("") { textContent(it) }
    }
    private fun tlen(n: Node) = JsText.trim(JsText.WS_RUN.replace(textContent(n), " ")).length

    private fun tableChunks(t: Element): List<Element> {
        val rows = t.select("> tbody > tr, > tr")
        if (rows.size <= TABLE_ROWS + 2) return listOf(t)
        val k = Math.ceil(rows.size / TABLE_ROWS.toDouble()).toInt(); val per = Math.ceil(rows.size / k.toDouble()).toInt()
        val out = ArrayList<Element>()
        var i = 0
        while (i < rows.size) {
            val c = t.shallowClone()
            t.select("> colgroup, > thead").forEach { c.appendChild(it.clone()) }
            val tb = Element("tbody")
            rows.subList(i, minOf(rows.size, i + per)).forEach { tb.appendChild(it.clone()) }
            c.appendChild(tb); holder().appendChild(c); out.add(c)
            i += per
        }
        return out
    }

    /** detached elements serialise with the owner document's settings: keep them in one without pretty printing */
    private fun holder() = org.jsoup.nodes.Document("").also { it.outputSettings().prettyPrint(false) }
    /** parse an HTML fragment (text of a part) */
    fun fragment(html: String): Element = Jsoup.parseBodyFragment(html).also { it.outputSettings().prettyPrint(false) }.body()

    private class Unit(val s: String, val html: String, val len: Int)
    private class Acc(var html: String, var len: Int, val secs: MutableSet<String>, val s: String) { var t = "" }

    private val cache = java.util.IdentityHashMap<Grammar, List<GPart>>()

    @Synchronized
    fun split(g: Grammar): List<GPart> {
        g.parts?.let { return it }
        cache[g]?.let { return it }
        return compute(g).also { cache[g] = it }
    }

    private fun compute(g: Grammar): List<GPart> {
        val doc = Jsoup.parse("<div>${g.body}${g.after ?: ""}</div>")
        doc.outputSettings().prettyPrint(false)
        val root = doc.body().child(0)
        val whole = listOf(GPart(g.title, root.html(), g.q.indices.toList()))
        if (tlen(root) < SPLIT_FROM) return whole
        val units = ArrayList<Unit>(); var sec = g.title; var head = ""
        for (n in root.childNodes().toList()) {
            if (n !is Element) {
                val tx = textContent(n)
                if (JsText.trim(tx).isNotEmpty()) units.add(Unit(sec, tx, tlen(n)))
                continue
            }
            if (HEAD.matches(n.tagName())) { sec = JsText.trim(textContent(n)); head = n.outerHtml(); continue }
            val pieces = if (n.normalName() == "table") tableChunks(n) else listOf(n)
            pieces.forEachIndexed { i, p -> units.add(Unit(sec, (if (i == 0) head else "") + p.outerHtml(), tlen(p) + (if (i == 0 && head.isNotEmpty()) sec.length else 0))) }
            head = ""
        }
        val parts = ArrayList<Acc>()
        for (u in units) {
            val cur = parts.lastOrNull()
            if (cur != null && (cur.len + u.len <= PART_MAX || cur.len < PART_MIN)) { cur.html += u.html; cur.len += u.len; cur.secs.add(u.s) }
            else parts.add(Acc(u.html, u.len, mutableSetOf(u.s), u.s))
        }
        if (parts.size < 2) return whole
        val per = HashMap<String, Int>(); parts.forEach { per[it.s] = (per[it.s] ?: 0) + 1 }
        val seen = HashMap<String, Int>()
        parts.forEach { p -> p.t = if ((per[p.s] ?: 0) > 1) "${p.s} (${seen.merge(p.s, 1, Int::plus)}/${per[p.s]})" else p.s }
        val texts = parts.map { p -> JsText.lower(textContent(fragment(p.html))).split(NON_LETTER).toSet() }
        val qs = parts.map { ArrayList<Int>() }
        g.q.forEachIndexed { i, q ->
            val words = JsText.lower((listOf(q.a) + (q.opts ?: emptyList())).joinToString(" ")).split(NON_LETTER).filter { it.length >= 2 }
            var best = minOf(parts.size - 1, (i * parts.size) / g.q.size); var bs = 0
            texts.forEachIndexed { k, t -> val s = words.count { it in t }; if (s > 0 && s >= bs) { bs = s; best = k } }
            qs[best].add(i)
        }
        return parts.mapIndexed { k, p -> GPart(p.t, p.html, qs[k]) }
    }
}

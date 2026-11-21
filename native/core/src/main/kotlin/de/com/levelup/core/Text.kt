package de.com.levelup.core

/**
 * The text helpers of app/js/lesson.js: answer normalising, typed-answer checking (typos, articles, accents),
 * meanings / overlap filtering (so no wrong option is secretly right), "Say it" items, tap-a-word glosses and
 * the speech check. All pure, all golden-tested against the JS.
 */
data class Check(val ok: Boolean, val note: String? = null)
data class SayItem(val de: String, val en: String, val answers: List<String>, val note: String = "", val ctx: String = "", val a: String? = null)
data class Heard(val alt: String, val hit: List<Boolean>, val miss: Int, val want: List<String>, val ok: Boolean)

class Text(val c: CourseData) {
    val L: LangProfile get() = c.lang
    private val WS = JsText.WS

    // ---------- normalising & typed answers ----------
    private val PUNCT = Regex("[…‑–—\\-.,!?;:„“\"'’()]")
    fun norm(s: String): String = JsText.trim(JsText.WS_RUN.replace(PUNCT.replace(L.norm(JsText.nfc(JsText.lower(s))), " "), " "))

    fun checkTyped(input: String, answers: List<String>): Check {
        val x = norm(input)
        if (x.isEmpty()) return Check(false)
        val fold = L.fold
        for (a in answers) {
            val y = norm(a)
            if (x == y) return Check(true)
            if (fold != null && fold(x) == fold(y)) return Check(true, "Watch the accents: $a")
            val m = if (fold != null) L.splitArt(a) else null
            if (m != null && L.artStrip.containsMatchIn(x) && fold!!(L.artStrip.replaceFirst(x, "")) == fold(norm(m[1]))) return Check(false, "Wrong article – it's $a")
            if (y.length >= 5 && lev(x, y) == 1) return Check(true, "Small typo – correct: $a")
        }
        for (a in answers) {
            val m = L.splitArt(a)
            val f = fold ?: { t: String -> t }
            val bare = f(L.artStrip.replaceFirst(x, ""))
            if (m != null && f(norm(m[1])) == f(x)) return Check(false, "Don't forget the article: $a")
            if (m != null && f(norm(m[1])) == bare) return Check(false, "Wrong article – it's $a")
        }
        return Check(false)
    }

    fun checkSay(input: String, answers: List<String>): Check {
        val x = norm(input)
        if (x.isEmpty()) return Check(false)
        for (a in answers) {
            val y = norm(a)
            if (x == y) return Check(true)
            if (L.fold != null && L.fold!!(x) == L.fold!!(y)) return Check(true, "Watch the accents: $a")
            if (y.length >= 5 && lev(x, y) <= maxOf(1, y.length / 12)) return Check(true, "Small typo – correct: $a")
        }
        return Check(false)
    }

    private val VARIANT_SPLIT = Regex("[$WS]+/[$WS]+|;[$WS]*|[$WS]+or[$WS]+")
    fun answerVariants(a: String): List<String> = (listOf(a) + a.split(VARIANT_SPLIT)).map { JsText.trim(it) }.filter { it.isNotEmpty() }.distinct()

    // ---------- meanings: "hello / good day (polite)" → {hello, good day} ----------
    private val tok = HashMap<String, Set<String>>()
    private val PAREN = Regex("\\([^)]*\\)")
    private val MEAN_SPLIT = Regex("[;,/]|" + JsText.wordRe("or"))
    private val MEAN_PUNCT = Regex("[!?.…\"“”'’]")
    private val MEAN_LEAD = Regex("^[$WS]*(to|a|an|the|i am|im|i)[$WS]+")
    fun meanings(en: String): Set<String> = tok.getOrPut(en) {
        JsText.lower(en).replace(PAREN, " ").split(MEAN_SPLIT)
            .map { x -> JsText.trim(JsText.WS_RUN.replace(MEAN_LEAD.replaceFirst(MEAN_PUNCT.replace(x, ""), ""), " ")) }
            .filter { it.isNotEmpty() }.map { SYN[it] ?: it }.toCollection(LinkedHashSet())
    }
    private fun contains(a: String, b: String) = a.length > b.length && b.length >= 3 && " $a ".contains(" $b ")
    fun overlaps(a: String, b: String): Boolean {
        val A = meanings(a); val B = meanings(b)
        for (x in A) for (y in B) if (x == y || contains(x, y) || contains(y, x)) return true
        return false
    }
    fun baseDe(de: String) = norm(de.replace(PAREN, ""))
    /** other words that are an equally correct answer for this English prompt */
    fun sameMeaningDe(w: Word): List<String> {
        val first = meanings(w.en).firstOrNull()
        return w.alt + c.words.filter { x -> x.id != w.id && first != null && first in meanings(x.en) }.map { it.typeAns ?: it.de }
    }

    // ---------- tokens / sentences ----------
    private val TOK_PUNCT = Regex("[.,!?]")
    fun tokens(de: String): List<String> = JsText.words(TOK_PUNCT.replace(de, " "))
    fun tokenOk(s: String) = L.letters.matches(s)
    fun nounOnly(w: Word) = L.splitArt(w.de)?.get(1) ?: w.de
    private val FROM_PAREN = Regex("[$WS]*\\(.*$", RegexOption.DOT_MATCHES_ALL)
    fun coreWord(w: Word) = JsText.trim(FROM_PAREN.replaceFirst(nounOnly(w), ""))
    private val SPACE_OR_SLASH = Regex("[$WS]|/")
    fun hasSpaceOrSlash(s: String) = SPACE_OR_SLASH.containsMatchIn(s)
    private val STEM = Regex("(en|er|e|n)$")
    fun tokenIs(tok: String, w: Word): Boolean {
        val t = JsText.lower(tok); val cw = JsText.lower(coreWord(w))
        if (cw.isEmpty() || hasSpaceOrSlash(cw)) return false
        if (t == cw) return true
        val stem = STEM.replaceFirst(cw, "")
        return stem.length >= 3 && t.length >= 3 && t.startsWith(stem) && t.length - stem.length <= 3
    }
    fun canGender(w: Word) = L.canGender(w)

    // ---------- "Say it in …" ----------
    private val SAY_SKIP = Regex("[…()=]")
    private val ALT_SPLIT = Regex("[$WS]+/[$WS]+")
    private val NOTES = Regex("\\(([^)]*)\\)")
    private val EN_PAREN = Regex("[$WS]*\\([^)]*\\)")
    private val SENT_START = Regex("^[\\p{Lu}0-9]")
    private val SENT_END = Regex("[.!?]$")
    private fun isSentence(x: String) = SENT_START.containsMatchIn(x) && SENT_END.containsMatchIn(x)
    fun sayItems(p: Phrase): List<SayItem> {
        if (SAY_SKIP.containsMatchIn(p.de)) return emptyList()
        val de = p.de.split(ALT_SPLIT)
        val notes = NOTES.findAll(p.en).map { it.groupValues[1] }.toList()
        val en = JsText.trim(EN_PAREN.replace(p.en, "")).split(ALT_SPLIT)
        if (!de.all { isSentence(it) }) return emptyList()
        val out = when {
            de.size > 1 && en.size == de.size -> de.mapIndexed { i, d -> Triple(d, en[i], listOf(d)) }
            en.size == 1 -> listOf(Triple(de[0], en[0], de))
            else -> return emptyList()
        }
        return out.filter { tokenOk(it.first) && tokens(it.first).size in 2..10 }
            .map { SayItem(it.first, it.second, it.third, notes.joinToString("; "), p.grp ?: "", if (de.size == 1) p.a else null) }
    }
    private val SPEAK_SKIP = Regex("[…()]")
    fun speakable(p: Phrase?) = p != null && !SPEAK_SKIP.containsMatchIn(p.de) && p.de.length <= 70

    // ---------- tap a word to see its meaning ----------
    private var gIdx: Map<String, Word>? = null
    private fun artRe() = if (L.code == "fr") Regex("^(le|la|les)[$WS]+|^l['’]", RegexOption.IGNORE_CASE) else Regex("^(der|die|das)[$WS]+", RegexOption.IGNORE_CASE)
    private val DASHES = Regex("^-+|-+$")
    private val WS1 = Regex("[$WS]")
    private fun glossIndex(): Map<String, Word> {
        gIdx?.let { return it }
        val idx = LinkedHashMap<String, Word>(); val art = artRe()
        val strip = { k: String -> art.replaceFirst(JsText.trim(k), "") }
        val add = { k0: String, w: Word ->
            val k = JsText.lower(JsText.trim(DASHES.replace(strip(k0), "")))
            if (k.isNotEmpty() && !WS1.containsMatchIn(k) && !idx.containsKey(k)) idx[k] = w
        }
        for (w in c.words) {
            val parts = w.de.replace(Regex("[()]"), ",").split(Regex("[/,]"))
            if (parts.any { WS1.containsMatchIn(JsText.trim(strip(it))) }) continue
            parts.forEach { add(it, w) }
            listOfNotNull(w.pl, w.fem).filter { it.isNotEmpty() }.forEach { x -> x.split(Regex("[/,]")).forEach { add(it, w) } }
        }
        gIdx = idx
        return idx
    }
    private val FR_ELI = Regex("^(?:l|d|j|m|t|s|n|c|qu)['’](.+)$", setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL))
    private val AUJ = Regex("^aujourd", RegexOption.IGNORE_CASE)
    private val NOT_LETTER = Regex("[^\\p{L}ß'’]")
    private val TRAIL_APOS = Regex("['’]$")
    fun glossOf(tok: String, first: Boolean): String? {
        var src = tok
        if (L.code == "fr") { val m = FR_ELI.find(tok); if (m != null && !AUJ.containsMatchIn(tok)) src = m.groupValues[1]; src = src.split("-")[0] }
        val t = TRAIL_APOS.replaceFirst(NOT_LETTER.replace(src, ""), ""); val low = JsText.lower(t); val idx = glossIndex()
        if (t.isEmpty()) return null
        L.formal(t, first)?.let { return it }
        val hit = { k: String -> idx[k] ?: idx[k.replace("’", "'")] }
        var w = hit(low)
        if (w == null) L.forms[low]?.let { return it }
        for (suf in L.suffixes) {
            if (w != null) break
            if (low.endsWith(suf) && low.length - suf.length >= 3) { val st = low.dropLast(suf.length); w = L.stemTry(st).firstNotNullOfOrNull { hit(it) } }
        }
        if (w == null) w = L.bare(low).firstNotNullOfOrNull { hit(it) }
        return w?.let { "${it.de} = ${JsText.trim(it.en.split(";")[0])}" }
    }

    // ---------- 🎤 Speak it ----------
    private val NOT_WORD = Regex("[^\\p{L}\\p{N}$WS]")
    private val DIGITS = Regex("^\\d+$")
    fun speechWords(t: String): List<String> = JsText.words(NOT_WORD.replace(norm(L.speechPre(t)), " "))
        .flatMap { w -> val n = if (DIGITS.matches(w)) w.toIntOrNull()?.let { L.numWord(it) } else null; if (n != null) norm(n).split(" ") else listOf(w) }
        .map { L.fold?.invoke(it) ?: it }
    fun heardCheck(alts: List<String>, target: String): Heard {
        val want = speechWords(target)
        var best: Heard? = null
        for (a in alts) {
            val got = speechWords(a).toSet(); val hit = want.map { it in got }; val miss = hit.count { !it }
            if (best == null || miss < best.miss) best = Heard(a, hit, miss, want, false)
        }
        val b = best ?: Heard("", want.map { false }, want.size, want, false)
        return b.copy(ok = b.miss <= (if (want.size >= 6) 1 else 0))
    }

    companion object {
        val SYN = mapOf("bye" to "goodbye", "hi" to "hello", "hey" to "hello", "thanks" to "thank you", "many thanks" to "thank you", "cheers" to "thank you",
            "ok" to "okay", "sorry" to "sorry", "youre welcome" to "no problem", "no worries" to "no problem", "my pleasure" to "no problem")
        fun lev(a: String, b: String): Int {
            val d = Array(a.length + 1) { IntArray(b.length + 1) }
            for (i in 0..a.length) d[i][0] = i
            for (j in 0..b.length) d[0][j] = j
            for (i in 1..a.length) for (j in 1..b.length)
                d[i][j] = minOf(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + if (a[i - 1] == b[j - 1]) 0 else 1)
            return d[a.length][b.length]
        }
        private val PHONE = Regex("(\\(?)on the phone", RegexOption.IGNORE_CASE)
        /** 📞 in front of "on the phone" */
        fun phone(s: String) = PHONE.replaceFirst(s, "$1📞 on the phone")
    }
}

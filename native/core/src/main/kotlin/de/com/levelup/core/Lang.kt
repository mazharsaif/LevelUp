package de.com.levelup.core

/** Port of app/js/lang.js: per-language settings for the language courses (target language lives in the field `de`). */
data class GenderQ(val title: String, val opts: List<String>, val cls: List<String>, val ans: String, val note: String, val shown: String? = null)

abstract class LangProfile {
    abstract val code: String
    abstract val name: String
    abstract val bcp: String
    abstract val artStrip: Regex
    abstract val artHint: String
    abstract val gtag: Map<String, String>
    abstract val keys: List<String>
    abstract val letters: Regex
    abstract val praise: List<String>
    abstract val understood: String
    abstract val perfLabel: String
    abstract val forms: Map<String, String>
    abstract val suffixes: List<String>
    /** [article, noun, separator] or null */
    abstract fun splitArt(de: String): List<String>?
    abstract fun norm(s: String): String
    /** accent folding (French) or null (German folds umlauts in norm) */
    abstract val fold: ((String) -> String)?
    abstract fun numWord(n: Int): String?
    abstract fun speechPre(t: String): String
    abstract fun formal(t: String, first: Boolean): String?
    abstract fun stemTry(st: String): List<String>
    abstract fun bare(low: String): List<String>
    abstract fun genderQ(w: Word): GenderQ
    open fun canGender(w: Word): Boolean = w.g != null && Regex("^(der|die|das) [^${JsText.WS}/()]+$").containsMatchIn(w.de)
    open val cheers: Map<String, List<Pair<String, String>>>? = null
}

object German : LangProfile() {
    private val NUM = listOf("null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf")
    override val code = "de"
    override val name = "German"
    override val bcp = "de-DE"
    private val ART = Regex("^(der|die|das) (.*)$", RegexOption.DOT_MATCHES_ALL)
    override fun splitArt(de: String): List<String>? = ART.find(de)?.let { listOf(it.groupValues[1], it.groupValues[2], " ") }
    override val artStrip = Regex("^(der|die|das) ")
    override val artHint = "with der / die / das"
    override val gtag = mapOf("m" to "DER", "f" to "DIE", "n" to "DAS", "pl" to "PLURAL")
    override val keys = listOf("ä", "ö", "ü", "ß")
    override fun norm(s: String) = s.replace("ß", "ss").replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
    override val fold: ((String) -> String)? = null
    override val letters = Regex("^[A-Za-zÄÖÜäöüß0-9,.!?'’ \\-–]+$")
    override fun numWord(n: Int) = NUM.getOrNull(n)
    private val SPEECH = Regex("[’']s(?![A-Za-z0-9_])")
    override fun speechPre(t: String) = SPEECH.replace(t, " es")
    override val praise = listOf("Super!", "Richtig!", "Sehr gut!", "Genau!", "Prima!")
    override val understood = "Verstanden!"
    override val perfLabel = "Perfekt"
    override val forms = mapOf("ist" to "is", "bin" to "am", "bist" to "are", "sind" to "are", "seid" to "are", "war" to "was", "hat" to "has", "habe" to "have",
        "hast" to "have", "habt" to "have", "den" to "the", "dem" to "the", "des" to "of the", "einen" to "a, an", "einem" to "a, an", "eines" to "of a",
        "du" to "you", "mich" to "me", "mir" to "(to) me", "dich" to "you", "dir" to "(to) you", "uns" to "us", "euch" to "you (plural)", "im" to "in the",
        "am" to "at the, on the", "zum" to "to the", "zur" to "to the", "vom" to "from the", "beim" to "at the", "ins" to "into the")
    private val IHR = Regex("^Ihr(e|en|em|er|es)?$")
    override fun formal(t: String, first: Boolean) = if (!first && IHR.matches(t)) "your (formal)" else if (!first && t == "Sie") "you (formal)" else null
    override val suffixes = listOf("en", "em", "er", "es", "e", "n", "s", "st", "t")
    override fun stemTry(st: String) = listOf(st, st + "en", st + "n")
    override fun bare(low: String) = listOf(low + "en", low + "n")
    override fun genderQ(w: Word): GenderQ {
        val ans = mapOf("m" to "der", "f" to "die", "n" to "das", "pl" to "die")[w.g] ?: ""
        return GenderQ("der, die or das?", listOf("der", "die", "das"), listOf("m", "f", "n"), ans, if (w.g == "pl") "Plural-only noun → die" else "")
    }
}

object French : LangProfile() {
    private val U = listOf("zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize")
    private val T = mapOf(2 to "vingt", 3 to "trente", 4 to "quarante", 5 to "cinquante", 6 to "soixante")
    private fun frNum(n: Int): String? {
        if (n < 17) return U[n]
        if (n < 20) return "dix-" + U[n - 10]
        if (n < 70) { val t = T[n / 10]!!; val r = n % 10; return if (r == 0) t else if (r == 1) "$t et un" else t + "-" + U[r] }
        if (n < 80) return if (n == 71) "soixante et onze" else "soixante-" + frNum(n - 60)
        if (n == 80) return "quatre-vingts"
        if (n < 100) return "quatre-vingt-" + frNum(n - 80)
        if (n < 1000) { val h = n / 100; val r = n % 100; val c = if (h == 1) "cent" else U[h] + (if (r != 0) " cent" else " cents"); return if (r != 0) c + " " + frNum(r) else c }
        if (n < 1000000) { val k = n / 1000; val r = n % 1000; val m = if (k == 1) "mille" else frNum(k) + " mille"; return if (r != 0) m + " " + frNum(r) else m }
        return null
    }
    override val code = "fr"
    override val name = "French"
    override val bcp = "fr-FR"
    private val ART = Regex("^(le|la|les) (.*)$", RegexOption.DOT_MATCHES_ALL)
    private val ELI = Regex("^(l['’])(.*)$", RegexOption.DOT_MATCHES_ALL)
    override fun splitArt(de: String): List<String>? {
        ART.find(de)?.let { return listOf(it.groupValues[1], it.groupValues[2], " ") }
        return ELI.find(de)?.let { listOf(it.groupValues[1], it.groupValues[2], "") }
    }
    override val artStrip = Regex("^(le|la|les|l|un|une|des) ")
    override val artHint = "with le / la / l'"
    override val gtag = mapOf("m" to "MASC.", "f" to "FEM.", "n" to "", "pl" to "PLURAL")
    override val keys = listOf("é", "è", "ê", "à", "ç", "ô", "î", "û", "œ")
    override fun norm(s: String) = s
    private val MARKS = Regex("[\\u0300-\\u036f]")
    override val fold: ((String) -> String)? = { s -> JsText.nfc(MARKS.replace(JsText.nfd(s), "").replace("œ", "oe").replace("æ", "ae")) }
    override val letters = Regex("^[A-Za-zÀ-ÖØ-öø-ÿŒœ0-9,.!?'’ \\-–\u00A0]+$")
    override fun numWord(n: Int) = if (n < 0) null else frNum(n)
    override fun speechPre(t: String) = t
    override val praise = listOf("Super !", "Bravo !", "Très bien !", "Exactement !", "Parfait !")
    override val understood = "Compris !"
    override val perfLabel = "Passé composé"
    override val forms = mapOf("suis" to "am", "es" to "are", "est" to "is", "sommes" to "are", "êtes" to "are", "sont" to "are", "ai" to "have", "as" to "have",
        "a" to "has", "avons" to "have", "avez" to "have", "ont" to "have", "vais" to "go", "vas" to "go", "va" to "goes", "allons" to "go", "allez" to "go",
        "vont" to "go", "fais" to "do, make", "fait" to "does, makes", "faisons" to "do, make", "faites" to "do, make", "font" to "do, make", "veux" to "want",
        "veut" to "wants", "voulez" to "want", "voudrais" to "would like", "peux" to "can", "peut" to "can", "pouvez" to "can", "prends" to "take",
        "prend" to "takes", "viens" to "come", "vient" to "comes", "le" to "the", "la" to "the", "les" to "the", "l" to "the", "un" to "a, an, one",
        "une" to "a, an, one", "des" to "some; of the", "du" to "some; of the", "au" to "to the, at the", "aux" to "to the, at the", "de" to "of, from",
        "d" to "of, from", "à" to "to, at, in", "je" to "I", "j" to "I", "tu" to "you (friends)", "il" to "he, it", "elle" to "she, it", "on" to "we, one",
        "nous" to "we, us", "vous" to "you (polite / plural)", "ils" to "they", "elles" to "they", "me" to "me, myself", "m" to "me, myself",
        "te" to "you, yourself", "t" to "you, yourself", "se" to "himself, herself", "s" to "himself, herself; if", "ne" to "not", "n" to "not",
        "pas" to "not", "y" to "there", "en" to "in; of it", "ce" to "this, that", "cet" to "this, that", "cette" to "this, that", "ces" to "these, those",
        "c" to "it, that", "qu" to "that, what", "que" to "that, what", "mon" to "my", "ma" to "my", "mes" to "my", "ton" to "your", "ta" to "your",
        "tes" to "your", "son" to "his, her", "sa" to "his, her", "ses" to "his, her", "notre" to "our", "nos" to "our", "votre" to "your", "vos" to "your",
        "leur" to "their", "leurs" to "their", "moi" to "me", "toi" to "you", "lui" to "him", "eux" to "them")
    override fun formal(t: String, first: Boolean): String? = null
    override val suffixes = listOf("ons", "ez", "ent", "es", "e", "s", "x")
    override fun stemTry(st: String) = listOf(st, st + "er", st + "ir", st + "re", st + "e")
    override fun bare(low: String) = listOf(low + "er", low + "e")
    override fun genderQ(w: Word): GenderQ {
        val p = splitArt(w.de) ?: emptyList()
        val a0 = p.getOrNull(0)
        if (a0 != null && a0.startsWith("l") && a0 != "le" && a0 != "la") {
            val ans = if (w.g == "f") "une" else "un"
            return GenderQ("un or une?", listOf("un", "une"), listOf("m", "f"), ans, "l' hides the gender: $ans ${p[1]}", p[1])
        }
        return GenderQ("le or la?", listOf("le", "la"), listOf("m", "f"), if (w.g == "f") "la" else "le", "")
    }
    private val CANG = Regex("^(le |la |l['’])[^${JsText.WS}/()]+$")
    override fun canGender(w: Word) = (w.g == "m" || w.g == "f") && CANG.containsMatchIn(w.de)
    override val cheers = mapOf(
        "perfect" to listOf("🧠✨" to "Flawless! Your neurons are doing push-ups.", "🏆" to "Perfect run – even the dictionary is impressed.",
            "🥐" to "Parfait ! Somewhere in Paris a baker just smiled.", "🎯" to "Bullseye every time. Researchers want to study your memory."),
        "great" to listOf("🎉" to "Très bien ! Those words are sticking.", "💪" to "Strong work – your future self in France says merci.", "🔥" to "Great focus. Keep that momentum going!"),
        "ok" to listOf("🌱" to "Every mistake is a word you'll remember better. Courage !", "🧗" to "Progress, not perfection. You're climbing!", "☕" to "Good effort – a quick review tomorrow will lock it in."),
    )
}

object Langs {
    fun of(code: String?): LangProfile = if (code == "fr") French else German
}

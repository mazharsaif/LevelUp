package de.com.levelup.core

import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/** Local calendar dates as "YYYY-MM-DD" strings, exactly like store.js (iso/parse/addDays/daysBetween/mondayOf). */
object Dates {
    fun parse(s: String): LocalDate = LocalDate.parse(s.substring(0, 10))
    fun iso(d: LocalDate): String = d.toString()
    fun addDays(s: String, n: Int): String = iso(parse(s).plusDays(n.toLong()))
    fun daysBetween(a: String, b: String): Int = ChronoUnit.DAYS.between(parse(a), parse(b)).toInt()
    fun mondayOf(s: String): String = iso(parse(s).with(DayOfWeek.MONDAY).let { if (it.isAfter(parse(s))) it.minusWeeks(1) else it })
    /** "21 Nov" / custom pattern, en-GB style. */
    fun fmt(s: String, pattern: String = "d MMM"): String =
        parse(s).format(java.time.format.DateTimeFormatter.ofPattern(pattern, java.util.Locale.UK))
}

/** Where "today" comes from. Tests pin it; the app uses the phone's local date. */
fun interface DayClock {
    fun today(): String
    companion object {
        val SYSTEM = DayClock { LocalDate.now().toString() }
        fun fixed(day: String) = DayClock { day }
    }
}

/** JavaScript string helpers (JS \s and trim() know more whitespace than Java's \s). */
object JsText {
    const val WS = "\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF"
    val WS_RUN = Regex("[$WS]+")
    val NON_WS = Regex("[^$WS]")
    private val TRIM = Regex("^[$WS]+|[$WS]+$")
    fun trim(s: String): String = TRIM.replace(s, "")
    /** s.split(/\s+/).filter(Boolean) */
    fun words(s: String): List<String> = WS_RUN.split(s).filter { it.isNotEmpty() }
    fun isWs(c: Char): Boolean = c in "\t\n\u000B\u000C\r       　﻿" || c in ' '..' '
    /** JS toLowerCase (locale independent) */
    fun lower(s: String) = s.lowercase(java.util.Locale.ROOT)
    fun upper(s: String) = s.uppercase(java.util.Locale.ROOT)
    fun nfc(s: String): String = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFC)
    fun nfd(s: String): String = java.text.Normalizer.normalize(s, java.text.Normalizer.Form.NFD)
    /** JS's ASCII-only \b around a word */
    fun wordRe(w: String) = "(?<![A-Za-z0-9_])$w(?![A-Za-z0-9_])"
}

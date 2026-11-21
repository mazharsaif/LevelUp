package de.com.levelup.core

import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/** Port of app/js/hero.js: the purple aura (0 → 1 by level) and the rank emblem stages. */
object Hero {
    const val AURA_FULL_LEVEL = 100
    fun aura(lv: Int): Double = max(0.0, min(1.0, (lv - 1).toDouble() / (AURA_FULL_LEVEL - 1)))
    val AURA_NAMES = listOf("Faint", "Awakening", "Rising", "Strong", "Overflowing", "Sovereign")
    fun auraName(lv: Int): String = AURA_NAMES[min(AURA_NAMES.size - 1, floor(aura(lv) * (AURA_NAMES.size - 1) + 0.0001).toInt())]
    /** ranks by level: E 1, D 10, C 25, B 45, A 70, S 95+ */
    val STAGES = listOf("E" to 1, "D" to 10, "C" to 25, "B" to 45, "A" to 70, "S" to 95)
    fun stageFor(lv: Int): Int { var s = 0; STAGES.forEachIndexed { i, x -> if (lv >= x.second) s = i }; return s }
    fun rankForLevel(lv: Int) = STAGES[stageFor(lv)].first
    /** number of floating particles behind the content (0 below aura 0.15) */
    fun particles(a: Double): Int = if (a < 0.15) 0 else 2 + Math.round(((a - 0.15) / 0.85) * 36).toInt()
    fun lvAtPct(p: Int): Int = max(1, floor(1 + (p * (Store.A1_LEVEL - 1)) / 100.0 + 1e-9).toInt())

    /** the Ranks page text (same for every language course; {lang} = course language) */
    val RANK_INFO = mapOf(
        "E" to ("Newcomer" to "Greet people, say goodbye, spell your name and count to 20."),
        "D" to ("Explorer" to "Introduce yourself: your name, where you're from, your job and your age."),
        "C" to ("Speaker" to "Talk about your family and your day, and tell the time."),
        "B" to ("Traveller" to "Shop, order food and drink, and ask what things cost."),
        "A" to ("Local" to "Make appointments, ask the way and fill in a simple form."),
        "S" to ("A1 Master" to "All of A1 learned and remembered: ready for the {lang} A1 exam."),
    )
    val RANK_COLOR = mapOf("E" to 0xFF8A9BB5, "D" to 0xFF57E3A0, "C" to 0xFF5AA9FF, "B" to 0xFFB48CFF, "A" to 0xFFFF6B8A, "S" to 0xFFFFCC4D)
}

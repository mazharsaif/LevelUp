package de.com.levelup.app.widget

import android.content.Context
import de.com.levelup.app.WidgetStore
import org.json.JSONArray
import org.json.JSONObject
import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime

/**
 * The progress summary the web app sends (`LevelUpNative.setWidgetData`, built by widgetSnapshot() in app.js).
 * Widgets never call the network: they read this and work out only time-based things themselves
 * (time left today, streak at risk in the evening, a new day since the snapshot, how old it is).
 */
data class Word(
    val id: String?, val de: String, val art: String?, val word: String, val g: String?, val en: String,
    val hint: String?, val pl: String?, val ex: String?, val exEn: String?, val audio: String?, val learned: Boolean, val lesson: Int?,
)

data class NextPart(
    val kind: String, val itemId: String, val lessonNo: Int?, val title: String, val subtitle: String?, val icon: String?,
    val part: Int, val parts: Int, val minutes: Int, val newWords: List<Word>,
)

enum class Mode { SIGNED_OUT, NORMAL, CLEARED, AT_RISK }

class Snap(private val j: JSONObject, val now: LocalDateTime = LocalDateTime.now()) {
    val signedIn = j.optBoolean("signedIn", false)
    val setup = j.optBoolean("setup", true)
    val tree = j.optString("courseType") == "tree"
    val courseTitle = j.optString("courseTitle", "LevelUp")
    val lang = j.optString("lang", "de")
    val theme = j.optString("theme", "sl")
    val questMode = j.optBoolean("questMode", false) && !tree
    private val day: LocalDate = runCatching { LocalDate.parse(j.optString("day")) }.getOrDefault(now.toLocalDate())
    /** the snapshot is from an earlier day: today's counters start again at zero */
    val newDay = day.isBefore(now.toLocalDate())
    val generatedAt = j.optLong("generatedAt", 0L)
    val ageMin: Long = if (generatedAt > 0) (System.currentTimeMillis() - generatedAt) / 60000 else Long.MAX_VALUE
    /** "⊘ 3 h ago" badge after 2 hours; content dims after 12 hours (the widget can't fetch on its own) */
    val stale = signedIn && ageMin > 120
    val veryStale = signedIn && ageMin > 720
    val ageText = when { ageMin < 60 -> "${ageMin} m ago"; ageMin < 48 * 60 -> "${ageMin / 60} h ago"; else -> "${ageMin / 1440} d ago" }

    val xpGoal = j.optInt("xpGoal", 0)
    val xpToday = if (newDay) 0 else j.optInt("xpToday", 0)
    val partsGoal = j.optInt("partsGoal", 0)
    val partsToday = if (newDay) 0 else j.optInt("partsToday", 0)
    val dueCount = j.optInt("dueCount", 0)
    val fadingCount = j.optInt("fadingCount", 0)
    val revGoal = j.optInt("revGoal", 0)
    val revDone = if (newDay) 0 else j.optInt("revDone", 0)
    val questCleared = !newDay && j.optBoolean("questCleared", false)
    val diamonds = j.optInt("diamonds", 0)
    val missedPenalty: Int? = j.optInt("missedPenalty", 0).takeIf { it > 0 && !newDay }
    val totalXP = j.optInt("totalXP", 0)
    val todayHit = !newDay && j.optBoolean("todayHit", false)
    private val snapStreak = j.optInt("streak", 0)
    /** a day passed without the goal: the snapshot's streak only survives if the snapshot's own day was a goal day */
    val streak: Int = when {
        !newDay -> snapStreak
        day == now.toLocalDate().minusDays(1) && j.optBoolean("todayHit", false) -> snapStreak
        else -> 0
    }
    val streakLost = newDay && streak == 0 && snapStreak > 0
    val bestStreak = j.optInt("bestStreak", 0)
    val nextGiftAt: Int? = j.optInt("nextGiftAt", 0).takeIf { it > 0 }
    /** 35 days, Monday-aligned, ending this week: H goal day, P some XP, M missed, F future (shifted for a new day) */
    val days: String = shiftDays(j.optString("days", ""), day, now.toLocalDate())

    val level = j.optInt("level", 1)
    val a1Pct = j.optDouble("a1Pct", 0.0)
    val rank = j.optString("rank", "E")
    val rankName = j.optString("rankName", "")
    val rankCan = j.optString("rankCan", "")
    val rankFromPct = j.optInt("rankFromPct", 0)
    val nextRank: String? = j.optString("nextRank").takeIf { it.isNotBlank() && it != "null" }
    val nextRankPct = j.optInt("nextRankPct", 100)
    val aura = j.optDouble("aura", 0.0).toFloat()
    val auraName = j.optString("auraName", "")
    val nextRankEta: String? = j.optString("nextRankEta").takeIf { it.isNotBlank() && it != "null" }
    val rankUp = j.optBoolean("rankUp", false)
    val treeDone = j.optInt("treeDone", 0)
    val treeTotal = j.optInt("treeTotal", 0)
    val dueTomorrow = j.optInt("dueTomorrow", 0)

    val next: NextPart? = j.optJSONObject("next")?.let { n ->
        NextPart(n.optString("kind"), n.optString("itemId"), n.optInt("lessonNo", 0).takeIf { it > 0 }, n.optString("title"),
            n.optString("subtitle").takeIf { it.isNotBlank() && it != "null" }, n.optString("icon").takeIf { it.isNotBlank() && it != "null" },
            n.optInt("part", 1), n.optInt("parts", 1), n.optInt("minutes", 5), words(n.optJSONArray("newWords")))
    }
    val review: List<Word> = words(j.optJSONArray("review"))
    val wotd: Word? = j.optJSONObject("wotd")?.let(::word)
    val wotdAlt: List<Word> = words(j.optJSONArray("wotdAlt"))

    val goalPct: Float = if (xpGoal > 0) (xpToday.toFloat() / xpGoal).coerceIn(0f, 1f) else 0f
    val xpToGo = (xpGoal - xpToday).coerceAtLeast(0)
    val minutesLeft: Long = Duration.between(now, now.toLocalDate().plusDays(1).atStartOfDay()).toMinutes()
    val leftText: String = minutesLeft.let { m -> if (m >= 120) "${m / 60} h left" else if (m >= 60) "${m / 60} h ${m % 60} m left" else "$m m left" }
    val mode: Mode = when {
        !signedIn -> Mode.SIGNED_OUT
        questMode && (questCleared || (xpGoal > 0 && xpToday >= xpGoal)) -> Mode.CLEARED
        questMode && streak > 0 && !todayHit && now.toLocalTime() >= LocalTime.of(20, 0) -> Mode.AT_RISK
        else -> Mode.NORMAL
    }
    /** the next word of the day after tapping Next › (cycles through the snapshot's alternatives) */
    fun wordOfDay(offset: Int): Word? = (listOfNotNull(wotd) + wotdAlt).let { if (it.isEmpty()) null else it[Math.floorMod(offset, it.size)] }

    companion object {
        fun load(c: Context): Snap = Snap(runCatching { JSONObject(WidgetStore.load(c) ?: "{}") }.getOrDefault(JSONObject()))
        private fun words(a: JSONArray?): List<Word> = (0 until (a?.length() ?: 0)).mapNotNull { a!!.optJSONObject(it)?.let(::word) }
        private fun s(o: JSONObject, k: String) = o.optString(k).takeIf { it.isNotBlank() && it != "null" }
        private fun word(o: JSONObject) = Word(s(o, "id"), o.optString("de"), s(o, "art"), s(o, "word") ?: o.optString("de"), s(o, "g"),
            o.optString("en"), s(o, "hint"), s(o, "pl"), s(o, "ex"), s(o, "exEn"), s(o, "a"), o.optBoolean("learned", false),
            o.optInt("lesson", 0).takeIf { it > 0 })
        private fun shiftDays(d: String, from: LocalDate, to: LocalDate): String {
            if (d.length != 35) return "F".repeat(35)
            fun monday(x: LocalDate) = x.minusDays((x.dayOfWeek.value - 1).toLong())
            val weeks = Duration.between(monday(from).atStartOfDay(), monday(to).atStartOfDay()).toDays() / 7
            val cells = (if (weeks <= 0) d else (d.drop((7 * weeks).toInt().coerceAtMost(35)) + "F".repeat((7 * weeks).toInt().coerceAtMost(35)))).toCharArray()
            // days between the snapshot and today: missed (nothing is known about them); today and later: future
            val start = monday(to).minusDays(28)
            for (k in 0 until 35) {
                val dd = start.plusDays(k.toLong())
                if (dd.isAfter(from) && dd.isBefore(to)) cells[k] = 'M'
                if (!dd.isBefore(to)) cells[k] = 'F'
                if (dd == to && from == to) cells[k] = d[k]
            }
            return String(cells)
        }
    }
}

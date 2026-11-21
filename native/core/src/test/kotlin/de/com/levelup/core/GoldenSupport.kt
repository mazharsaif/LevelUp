package de.com.levelup.core

import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import java.io.File
import java.time.LocalDateTime
import java.time.ZoneId

/** Loads the golden files written by native/tools/golden/gen.mjs and the real course content from app/data. */
object Golden {
    val appDir: File = File(System.getProperty("levelup.app") ?: "../../app")
    fun golden(name: String): JObj = Js.parseObj(Golden::class.java.getResource("/golden/$name")!!.readText())
    private val courses by lazy { ContentParser.courses(File(appDir, "data/courses.json").readText()) }
    fun course(id: String): CourseData {
        val info = courses.first { it.id == id }
        return CourseData(info, ContentParser.lang(File(appDir, info.content!!).readText()))
    }
    /** the JS fake clock: 21 Nov 2026 10:00 local */
    val NOW: Long = LocalDateTime.of(2026, 11, 21, 10, 0).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
    fun store(cd: CourseData, today: String) = Store(cd, DayClock.fixed(today)) { NOW }
}

/** Deep JSON equality: numbers within 1e-9, missing key == null (JSON.stringify drops undefined). */
fun assertJson(expected: Any?, actual: Any?, path: String = "$", ignore: Set<String> = emptySet()) {
    fun num(v: Any?) = (v as? Number)?.toDouble()
    when {
        expected is Map<*, *> -> {
            val a = actual as? Map<*, *> ?: fail("$path: expected object, got $actual").let { return }
            val keys = (expected.keys + a.keys).map { it.toString() }.toSet() - ignore
            for (k in keys) {
                val e = expected[k]; val x = a[k]
                if (e == null && x == null) continue
                assertJson(e, x, "$path.$k", ignore)
            }
        }
        expected is List<*> -> {
            val a = actual as? List<*> ?: fail("$path: expected array of ${expected.size}, got $actual").let { return }
            assertEquals("$path: array length", expected.size, a.size)
            expected.forEachIndexed { i, e -> assertJson(e, a[i], "$path[$i]", ignore) }
        }
        expected is Number -> {
            val a = num(actual) ?: fail("$path: expected $expected, got $actual").let { return }
            val e = expected.toDouble()
            if (Math.abs(e - a) > 1e-9 * maxOf(1.0, Math.abs(e))) fail("$path: expected $e, got $a")
        }
        else -> assertEquals(path, expected, actual)
    }
}

/** Kotlin results → the JSON shape gen.mjs writes */
object Shape {
    fun progress(p: Progress) = jobj("total" to p.total, "vocab" to p.vocab, "grammar" to p.grammar, "phrases" to p.phrases, "coverage" to p.coverage)
    fun level(l: Level) = jobj("lv" to l.lv, "a1" to l.a1, "frac" to l.frac, "toNext" to l.toNext).also { if (l.a1) { it["xpInto"] = l.xpInto; it["xpNeed"] = l.xpNeed } }
    fun pace(p: Pace) = jobj("expected" to p.expected, "actual" to p.actual, "coverage" to p.coverage, "needPerDay" to p.needPerDay, "actualPerDay" to p.actualPerDay,
        "projected" to p.projected, "left" to p.left, "gap" to p.gap, "gapLessons" to p.gapLessons, "needLessonsPerWeek" to p.needLessonsPerWeek,
        "actualLessonsPerWeek" to p.actualLessonsPerWeek, "span" to p.span, "el" to p.el)
    fun summary(s: Summary?) = s?.let { jobj("gems" to it.gems, "lv" to it.lv, "rank" to it.rank, "xpToday" to it.xpToday, "xp" to it.xp, "streak" to it.streak,
        "lessons" to it.lessons, "of" to it.of, "pct" to it.pct, "expected" to it.expected, "gapLessons" to it.gapLessons, "words" to it.words, "goal" to it.goal, "target" to it.target) }
}

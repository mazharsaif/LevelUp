package de.com.levelup.core

import org.junit.Assert.assertEquals
import org.junit.Test

/** Golden tests for the lesson.js / lang.js text logic (answers, typos, articles, accents, meanings, Say it, glosses). */
class GoldenLessonTest {
    @Test fun german() = check("de-a1")
    @Test fun french() = check("fr-a1")

    private fun check(id: String) {
        val g = Golden.golden("$id.json"); val cd = Golden.course(id); val t = Text(cd); val L = g["lesson"].asObj()!!
        val st = Golden.store(cd, g.str("today")!!)
        fun rows(k: String) = L[k].asArr()!!.map { it.asArr()!! }
        // SRS intervals
        val cards = listOf(jobj("ivl" to 0.0, "ef" to 2.5, "reps" to 0.0), jobj("ivl" to 1.0, "ef" to 2.5, "reps" to 1.0), jobj("ivl" to 3.0, "ef" to 2.36, "reps" to 2.0),
            jobj("ivl" to 8.0, "ef" to 1.3, "reps" to 3.0), jobj("ivl" to 20.0, "ef" to 3.0, "reps" to 4.0), jobj("box" to 3.0, "w" to 1.0), jobj("box" to 0.0),
            jobj("box" to 7.0, "w" to 2.0), jobj("ivl" to 120.0, "ef" to 2.65, "reps" to 9.0))
        assertJson(L["nextIvl"], cards.map { c -> (1..4).map { st.nextIvl(c, it) } }, "$id.nextIvl")
        for (r in rows("norm")) assertEquals("norm(${r[0]})", r[1], t.norm(r[0] as String))
        for (r in rows("meanings")) assertJson(r[1], t.meanings(r[0] as String).toList(), "meanings(${r[0]})")
        for (r in rows("overlaps")) assertEquals("overlaps(${r[0]}, ${r[1]})", r[2], t.overlaps(r[0] as String, r[1] as String))
        for (o in L["checkTyped"].asArr()!!.map { it.asObj()!! }) {
            @Suppress("UNCHECKED_CAST") val ans = o["answers"] as List<String>
            val c = t.checkTyped(o.str("input")!!, ans)
            assertJson(o["r"], jobj("ok" to c.ok, "note" to c.note), "checkTyped(${o["input"]}, $ans)")
        }
        for (r in rows("sameMeaningDe")) assertJson(r[1], t.sameMeaningDe(cd.word[r[0] as String]!!), "sameMeaningDe(${r[0]})")
        for (r in rows("answerVariants")) assertJson(r[1], t.answerVariants(r[0] as String), "answerVariants(${r[0]})")
        for (r in rows("sayItems")) {
            val p = r[0].asObj()!!
            val ph = Phrase(p.str("de")!!, p.str("en") ?: "", p.str("grp"), p.str("a"))
            assertJson(r[1], t.sayItems(ph).map { jobj("de" to it.de, "en" to it.en, "answers" to it.answers, "note" to it.note, "ctx" to it.ctx, "a" to it.a) }, "sayItems(${ph.de})")
        }
        for (o in L["checkSay"].asArr()!!.map { it.asObj()!! }) {
            @Suppress("UNCHECKED_CAST") val ans = o["answers"] as List<String>
            val c = t.checkSay(o.str("input")!!, ans)
            assertJson(o["r"], jobj("ok" to c.ok, "note" to c.note), "checkSay(${o["input"]}, $ans)")
        }
        for (r in rows("gloss")) assertEquals("glossOf(${r[0]}, ${r[1]})", r[2], t.glossOf(r[0] as String, r[1] as Boolean))
        for (r in rows("speakable")) assertEquals("speakable(${r[0]})", r[1], t.speakable(Phrase(r[0] as String)))
        for (r in rows("phone")) assertEquals(r[1], Text.phone(r[0] as String))
        for (r in rows("numWord")) assertEquals("numWord(${r[0]})", r[1], cd.lang.numWord((r[0] as Number).toInt()))
        for (r in rows("spellDE")) assertEquals(r[1], Store.spellDE(r[0] as String))
        for (r in rows("bitsOf")) assertJson(r[1], st.bitsOf(cd.item[r[0] as String]!!), "bitsOf(${r[0]})")
    }
}

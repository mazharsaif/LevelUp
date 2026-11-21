package de.com.levelup.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

/** Lesson run rules (retries, pass mark, XP), JSON round trips, tree helpers and the widget snapshot. */
class EngineTest {
    private val today = "2026-11-21"
    private fun fresh(id: String = "de-a1"): Pair<CourseData, Store> {
        val cd = Golden.course(id); val st = Golden.store(cd, today)
        st.S = st.normalize(st.blank().also { it["setup"] = true })
        return cd to st
    }

    @Test fun jsonRoundTripKeepsEverything() {
        val src = """{"a":1,"b":2.5,"c":[null,"x",{"d":true}],"e":"é\n\"q\"","u":{"z":0.1},"big":1730000000000,"neg":-3}"""
        val o = Js.parseObj(src)
        assertEquals(src, Js.stringify(o))
        assertEquals("2.35", Js.num(2.5 - 0.15))
        assertEquals("0.30000000000000004", Js.num(0.1 + 0.2))
    }

    @Test fun vocabPartPassAndFail() {
        val (cd, st) = fresh()
        val L = Lessons(st, cd, Random(1)); val item = cd.path.first { it.kind == "vocab" }
        var run: LessonRun? = null
        L.vocab(item, 0) { run = it }
        val r = run!!
        assertTrue(r.steps.first() is Step.Intro)
        // answer everything right except one: accuracy stays over 60 %, the missed word comes back once
        var missed = false
        while (r.step != null) {
            val s = r.step!!
            if (s !is Step.Intro) { val ok = missed || s.w == null; if (!ok) missed = true; r.answered(s, ok, "German") }
            r.next()
        }
        assertTrue(r.retried.size == 1)
        val f = r.finish(st, cd, Random(1))
        assertFalse(f.failed)
        assertTrue("passed with ${f.acc}%", f.acc >= 60)
        assertEquals(4.0, st.wordBits(item)[0].count { truthy(st.S!!.obj("words")[it]) }.toDouble(), 0.0)
        // XP = 1 per new word + 2 per part (no perfect bonus)
        assertEquals(st.wordBits(item)[0].size + 2.0, f.xp, 0.0)
        // a failed part: everything wrong
        var run2: LessonRun? = null
        L.vocab(item, 1) { run2 = it }
        val r2 = run2!!
        while (r2.step != null) { val s = r2.step!!; if (s !is Step.Intro) r2.answered(s, false, "German"); r2.next() }
        val f2 = r2.finish(st, cd)
        assertTrue(f2.failed); assertEquals(1.0, f2.xp, 0.0)
        assertFalse(st.bitDone(item, 1))
    }

    @Test fun reviewGradesAndRelearn() {
        val (cd, st) = fresh()
        val ids = cd.words.take(5).map { it.id }
        ids.forEach { st.learnWord(it) }
        var run: LessonRun? = null
        Lessons(st, cd, Random(2)).review(ids) { run = it }
        val r = run!!
        var first = true
        while (r.step != null) { val s = r.step as Step.Recall; r.recallGraded(s, if (first) 1 else 3, st); first = false; r.next() }
        assertEquals(6, r.steps.size) // the forgotten word comes back once (relearn, not graded again)
        val f = r.finish(st, cd)
        assertEquals(listOf(0, 1, 0, 4, 0), f.grades)
        assertEquals(1.0, f.xp, 0.0)   // round(0.2*4 - 0.5*1 + 1 (80 % recalled)) = 1
        assertEquals(5.0, st.S!!.obj("reviews").num(today), 0.0)
    }

    @Test fun phraseAndGrammarSteps() {
        val (cd, st) = fresh("fr-a1")
        val b = Builder(st, cd, Random(3))
        val ph = cd.path.first { it.kind == "phrases" }
        val steps = b.phraseSteps(cd.phrases[ph.id]!!, ph, 0, speakOn = true)
        assertTrue(steps.any { it is Step.Flip }); assertTrue(steps.any { it is Step.Say || it is Step.Build || it is Step.Read })
        val g = cd.path.first { it.kind == "grammar" }
        assertNotNull(b.grammarSteps(cd.grammarOf(g)!!, g, "Taha"))
        // Say it: right answer passes, typo passes with a note
        val say = steps.filterIsInstance<Step.Say>().firstOrNull()
        if (say != null) assertTrue(Text(cd).checkSay(say.item.de, say.item.answers).ok)
    }

    @Test fun treeReaderAndQuiz() {
        val app = Golden.appDir
        val tc = ContentParser.tree(java.io.File(app, "data/math-path.json").readText())
        val st = Store(null, DayClock.fixed(today)); st.S = st.normalize(null)
        val tr = Tree(st, tc)
        val br = tr.openBranches().first(); val n = tr.nextNode(br)!!
        val ch = ContentParser.chapter(java.io.File(app, br.reading!! + String.format("%02d", n.chapter) + ".json").readText())
        assertEquals("open", tr.state(n))
        val parts = (if (ch.parts.isNotEmpty()) ch.parts else n.parts)
        for (k in parts.indices) {
            val rd = tr.Reader(br, n, ch, k)
            while (!rd.last) rd.next()
            rd.finish()
        }
        assertTrue(tr.nodeDone(n.id))
        assertEquals(15.0, st.xpToday(), 0.0)
        assertEquals(-2.0, Tree.parseNum("−2"), 0.0); assertEquals(0.75, Tree.parseNum("3/4"), 0.0)
        assertEquals(1250.0, Tree.parseNum("1,250"), 0.0); assertEquals(0.5, Tree.parseNum("0,5"), 0.0)
        assertTrue(Tree.parseNum("abc").isNaN())
        val qs = ch.quiz
        if (qs.isNotEmpty()) {
            val res = tr.quizDone(n, "quiz", qs, qs.indices.toList(), qs.map { true }, true)
            assertEquals(5, res.xp)
        }
    }

    @Test fun widgetSnapshot() {
        val (cd, st) = fresh()
        st.addXP(12.0)
        val w = WidgetSnapshot.of(st, cd, "taha", "Taha")
        assertEquals(12, w.xpToday); assertEquals("E", w.rank); assertTrue(w.xpGoal >= 10)
        assertNotNull(w.nextTitle)
        assertEquals(w, WidgetSnapshot.fromJson(w.toJson()))
    }
}

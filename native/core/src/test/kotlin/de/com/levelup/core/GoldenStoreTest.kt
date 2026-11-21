package de.com.levelup.core

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Golden tests: the same fixture states run through the real store.js (node, see native/tools/golden/gen.mjs) and
 * through the Kotlin Store must give the same results, for German A1 and French A1.
 */
class GoldenStoreTest {
    @Test fun germanCourse() = checkCourse("de-a1")
    @Test fun frenchCourse() = checkCourse("fr-a1")
    @Test fun germanStates() = checkStates("de-a1")
    @Test fun frenchStates() = checkStates("fr-a1")
    @Test fun germanMutations() = checkMutations("de-a1")
    @Test fun frenchMutations() = checkMutations("fr-a1")

    @Test fun hero() {
        for (row in Golden.golden("hero.json")["hero"].asArr()!!) {
            val r = row.asArr()!!; val lv = r[0].asNum()!!.toInt()
            assertJson(r[1], Hero.aura(lv), "aura($lv)")
            assertEquals("auraName($lv)", r[2], Hero.auraName(lv))
            assertEquals("stageFor($lv)", r[3].asNum()!!.toInt(), Hero.stageFor(lv))
        }
    }

    private fun checkCourse(id: String) {
        val g = Golden.golden("$id.json"); val cd = Golden.course(id)
        val path = cd.path.map { jobj("id" to it.id, "kind" to it.kind, "title" to it.title, "n" to it.n, "gid" to it.gid, "part" to it.part, "of" to it.of) }
        assertJson(g["path"], path, "$id.path")
        for (gp in g["grammarParts"].asArr()!!) {
            val o = gp.asObj()!!; val gr = cd.grammar[o.str("id")]!!
            val parts = GrammarSplit.split(gr).map { p ->
                jobj("t" to p.t, "q" to p.q, "text" to JsText.trim(JsText.WS_RUN.replace(GrammarSplit.textContent(GrammarSplit.fragment(p.html)), " ")))
            }
            assertJson(o["parts"], parts, "$id.grammar.${gr.id}")
        }
        assertJson(g["itemWeights"], Golden.store(cd, g.str("today")!!).itemWeights(), "$id.itemWeights")
        assertJson(g["gparts"], cd.gparts, "$id.gparts")
    }

    private fun checkStates(id: String) {
        val g = Golden.golden("$id.json"); val cd = Golden.course(id); val today = g.str("today")!!
        for (f in g["states"].asArr()!!) {
            val fx = f.asObj()!!; val name = "$id/${fx.str("name")}"; val o = fx["out"].asObj()!!
            val st = Golden.store(cd, today)
            st.importState(Js.stringify(fx["input"]))
            val S = st.S!!
            assertJson(o["normalized"], deepCopy(S), "$name.normalized", ignore = setOf("updated"))
            val pr = st.progress(S)
            assertJson(o["progress"], Shape.progress(pr), "$name.progress")
            val m = st.memory(S); assertJson(o["memory"], jobj("overdue" to m.overdue, "lapsed" to m.lapsed, "health" to m.health, "due" to m.due), "$name.memory")
            val r = st.retention(S)
            assertJson(o["retention"], jobj("learning" to r.learning, "known" to r.known, "mastered" to r.mastered, "learned" to r.learned, "total" to r.total), "$name.retention")
            assertJson(o["history"], st.history(S).map { listOf(it.first, it.second) }, "$name.history")
            assertJson(o["pace"], Shape.pace(st.pace(S)), "$name.pace")
            assertJson(o["level"], Shape.level(st.level(pr.total, deepCopy(S).asObj())), "$name.level")
            assertJson(o["levelCoverage"], Shape.level(st.level(pr.coverage, deepCopy(S).asObj())), "$name.levelCoverage")
            val rk = st.rank(pr.total); assertJson(o["rank"], jobj("r" to rk.r, "next" to rk.next, "nextAt" to rk.nextAt), "$name.rank")
            assertJson(o["streak"], st.streak(S), "$name.streak")
            assertJson(o["totalXP"], st.totalXP(S), "$name.totalXP")
            assertJson(o["xpToday"], st.xpToday(S), "$name.xpToday")
            assertJson(o["dueWords"], st.dueWords(S), "$name.dueWords")
            assertJson(o["autoGoal"], st.autoGoal(S), "$name.autoGoal")
            assertJson(o["remainingXP"], st.remainingXP(S), "$name.remainingXP")
            assertJson(o["remainingParts"], st.remainingParts(S), "$name.remainingParts")
            assertJson(o["goalFor"], st.goalFor(S), "$name.goalFor")
            if (o["partsGoal"] != null) {   // null = the web threw (manual goal mode, see Store.partsGoal)
                assertJson(o["partsGoal"], st.partsGoal(S), "$name.partsGoal")
                assertJson(o["goalDay"], S["goalDay"], "$name.goalDay")
            } else st.partsGoal(S)
            assertJson(o["partsToday"], st.partsToday(S), "$name.partsToday")
            assertJson(o["nextPick"], st.nextPick(S)?.id, "$name.nextPick")
            assertJson(o["nextItem"], st.nextItem(S)?.id, "$name.nextItem")
            assertJson(o["lastPartToday"], st.lastPartToday(S), "$name.lastPartToday")
            assertJson(o["planParts"], st.planParts(6, S).map { jobj("id" to it.it.id, "k" to it.k, "ids" to it.ids) }, "$name.planParts")
            val wp = st.weekPlan(S)
            assertJson(o["weekPlan"], jobj("nWeeks" to wp.nWeeks, "of" to wp.of, "weeks" to wp.weeks.map { jobj("n" to it.n, "from" to it.from, "to" to it.to, "items" to it.items.map { i -> i.id }) }), "$name.weekPlan")
            assertJson(o["thisWeek"], st.thisWeek(), "$name.thisWeek")
            assertJson(o["wordStatus"], S.obj("words").keys.associateWith { st.wordStatus(it, S) }, "$name.wordStatus")
            assertJson(o["health"], S.obj("words").mapValues { st.health(it.value.asObj()) }, "$name.health")
            assertJson(o["dayCounts"], (0 until 12).map { Dates.addDays(today, -it) }.associateWith { st.dayCounts(it, S) }, "$name.dayCounts")
            if (o["summary"] != null) assertJson(o["summary"], Shape.summary(st.summary(deepCopy(S).asObj())), "$name.summary")
            assertJson(o["bitsDone"], cd.path.take(40).associate { it.id to st.bitsDone(it, S) }, "$name.bitsDone")
            val lost = st.checkMissed()
            assertJson(o["checkMissed"], jobj("lost" to lost, "pen" to S["pen"], "penLog" to S["penLog"], "penChecked" to S["penChecked"]), "$name.checkMissed")
            val rw = st.checkRewards(true)
            assertJson(o["checkRewards"], jobj("gems" to rw.gems, "gifts" to rw.gifts.map { jobj("id" to it.id, "m" to it.m, "tier" to it.tier) }, "total" to S["gems"]), "$name.checkRewards")
            assertJson(o["after"], deepCopy(S), "$name.after", ignore = if (o["partsGoal"] == null) setOf("updated", "goalDay") else setOf("updated"))
        }
    }

    private fun checkMutations(id: String) {
        val g = Golden.golden("$id.json"); val cd = Golden.course(id); val today = g.str("today")!!
        val st = Golden.store(cd, today)
        st.importState(Js.stringify(st.blank().also { it["setup"] = true; st.settings(it)["pb3"] = true; st.settings(it)["streakFrom"] = today }))
        val S = st.S!!
        val v = cd.path.first { it.kind == "vocab" }; val w0 = v.words[0]; val w1 = v.words[1]
        val ops = g["mutations"].asArr()!!.map { it.asObj()!! }
        var k = 0
        fun next() = ops[k++]
        st.learnWord(w0); assertJson(next()["s"], S.obj("words")[w0], "learn")
        for (gr in listOf(3, 3, 4, 2, 1, 3, 4, 4, 2, 3)) { val ivl = st.gradeWord(w0, gr); val o = next(); assertJson(o["ivl"], ivl, "grade $gr ivl"); assertJson(o["s"], S.obj("words")[w0], "grade $gr") }
        for (gr in listOf(1, 2, 4)) { val ivl = st.gradeWord(w1, gr); val o = next(); assertJson(o["ivl"], ivl, "grade1 $gr ivl"); assertJson(o["s"], S.obj("words")[w1], "grade1 $gr") }
        for (i in 0 until st.bitCount(v)) { val done = st.completeBit(v, i, 90.0, 0.0); val o = next(); assertJson(o["done"], done, "bit $i"); assertJson(o["bits"], S.obj("bits")[v.id], "bits $i"); assertJson(o["d"], S.obj("done")[v.id], "done $i") }
        val gi = cd.path.first { it.kind == "grammar" }
        next().let { o -> assertJson(o["first"], st.completeItem(gi.id, 75.0, 3.0), "item1"); assertJson(o["d"], S.obj("done")[gi.id], "item1 d") }
        next().let { o -> assertJson(o["first"], st.completeItem(gi.id, 100.0, 1.0), "item2"); assertJson(o["d"], S.obj("done")[gi.id], "item2 d") }
        st.addXP(12.0); next().let { o -> assertJson(o["xp"], S["xp"], "xp"); assertJson(o["hit"], S["hit"], "hit") }
        st.addPenalty(4.0, "test"); next().let { o -> assertJson(o["pen"], S["pen"], "pen"); assertJson(o["total"], st.totalXP(), "total") }
    }
}

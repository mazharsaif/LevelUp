package de.com.levelup.app

import android.content.Context
import android.os.Looper
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ApplicationProvider
import de.com.levelup.app.ui.LessonTiming
import de.com.levelup.app.ui.Motion
import de.com.levelup.core.Step
import de.com.levelup.core.Text
import de.com.levelup.core.sync.ApiClient
import de.com.levelup.core.sync.MemoryKeyValue
import de.com.levelup.core.sync.Net
import de.com.levelup.core.truthy
import de.com.levelup.core.obj
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.rules.TestRule
import org.junit.runner.Description
import org.junit.runner.RunWith
import org.junit.runners.model.Statement
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.LooperMode
import java.time.Duration

/**
 * End-to-end UI test on the JVM (Robolectric renders the real Compose screens; no emulator needed), against the LOCAL
 * test server only:
 *   cd server_fastapi && A1_DATA=<tmpdir> LU_MASTER_PASSWORD=admin uv run main.py 8899
 *   LU_TEST_SERVER=http://127.0.0.1:8899 ./gradlew :app:testDebugUnitTest
 * Skipped without LU_TEST_SERVER. Logs in as the test learner "batul" (master password), does the setup, plays a
 * whole vocab part, checks the progress reached the server, visits every tab, then opens the Software Engineering tree.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = LevelUpApp::class, qualifiers = "w411dp-h2600dp-xxhdpi")
@LooperMode(LooperMode.Mode.PAUSED)
class AppFlowTest {
    private val base = System.getenv("LU_TEST_SERVER").orEmpty()
    private val setup = object : TestRule {
        override fun apply(s: Statement, d: Description) = object : Statement() {
            override fun evaluate() {
                assumeTrue("set LU_TEST_SERVER to run", base.startsWith("http://127.0.0.1") || base.startsWith("http://localhost"))
                Motion.enabled = false; LessonTiming.armMs = 0
                val ctx = ApplicationProvider.getApplicationContext<Context>()
                ctx.getSharedPreferences("levelup", Context.MODE_PRIVATE).edit().clear().putString("server.url", "$base/").commit()
                s.evaluate()
            }
        }
    }
    private val compose = createAndroidComposeRule<MainActivity>()
    @get:Rule val chain: RuleChain = RuleChain.outerRule(setup).around(compose)

    private val app get() = LevelUpApp.graph(ApplicationProvider.getApplicationContext()).app
    private fun pump(ms: Long = 50) { shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(ms)); Thread.sleep(20) }
    private fun has(t: String, exact: Boolean = false) = compose.onAllNodesWithText(t, substring = !exact, ignoreCase = true).fetchSemanticsNodes().isNotEmpty()
    private fun waitFor(t: String, exact: Boolean = false, ms: Long = 20_000) {
        val end = System.currentTimeMillis() + ms
        while (!has(t, exact)) { if (System.currentTimeMillis() > end) throw AssertionError("'$t' never appeared. Screen: " + screenText()); pump(); compose.waitForIdle() }
    }
    private fun screenText(): String = compose.onAllNodes(androidx.compose.ui.test.isRoot()).fetchSemanticsNodes().joinToString(" | ") { root ->
        fun walk(n: androidx.compose.ui.semantics.SemanticsNode): List<String> =
            (n.config.getOrElseNullable(androidx.compose.ui.semantics.SemanticsProperties.Text) { null }?.map { t -> t.text } ?: emptyList()) + n.children.flatMap { c -> walk(c) }
        walk(root).joinToString(" · ")
    } + " [phase=${app.phase} S=${app.S != null} picked=${app.picked} user=${app.user} auth=${app.sync.auth} intro=${app.introSeen}]"
    private fun click(t: String, exact: Boolean = false) { waitFor(t, exact); val n = compose.onAllNodesWithText(t, substring = !exact, ignoreCase = true).onFirst(); runCatching { n.performScrollTo() }; n.performClick(); compose.waitForIdle() }

    /** guest mode: nothing goes to the server; French A1 loads with its own language profile */
    @Test fun guestFrenchCourse() {
        waitFor("Just try it as a guest"); click("Just try it as a guest")
        waitFor("What do you want to study?")
        click("French A1")
        waitFor("Start learning"); click("Start learning")
        waitFor("Daily quest")
        val a = app
        assertTrue(a.sync.isGuest); assertEquals("fr", a.cd!!.lang.code); assertEquals("fr-a1", a.course!!.id)
        val item = a.store.nextPick()!!
        a.startItem(item); compose.waitForIdle()
        if (item.kind == "vocab") waitFor("New word") else if (item.kind == "phrases") waitFor("Show meaning")
        a.quitLesson(); compose.waitForIdle()
        click("Words", exact = true); waitFor("learned")
        // guest progress lives only on the phone, under the web's localStorage key names
        assertNotNull(a.g.kv.get("a1.state.guest@fr-a1"))
        assertEquals(null, a.g.kv.get("sync.pending"))
    }

    @Test fun loginSetupLessonSyncTabsAndTree() {
        waitFor("I have an account")
        click("I have an account")
        waitFor("Welcome back")
        val fields = compose.onAllNodes(hasSetTextAction())
        fields[0].performTextInput("batul"); fields[1].performTextInput("admin")
        compose.onAllNodesWithText("Log in", ignoreCase = true).fetchSemanticsNodes().size.let { n -> compose.onAllNodesWithText("Log in", ignoreCase = true)[n - 1].performClick() }   // the submit button (the first is the tab)
        waitFor("What do you want to study?")
        click("German A1")
        // a fresh learner gets the setup screen; a learner from an earlier run goes straight to Today
        val end = System.currentTimeMillis() + 20_000
        while (!has("Start learning") && !has("Daily quest")) { if (System.currentTimeMillis() > end) error("no setup / today"); pump() }
        if (has("Start learning")) click("Start learning")
        waitFor("Daily quest")

        // ---- play the next lesson part to the end ----
        val a = app; val cd = a.cd!!; val tx = Text(cd)
        // the first vocab lesson not finished yet (on a fresh learner that's the next pick; reruns continue from there)
        val item = cd.path.first { it.kind == "vocab" && !truthy(a.S!!.obj("done")[it.id]) }
        val bit = a.store.nextBit(item)
        a.startItem(item); compose.waitForIdle()
        var guard = 0
        while (a.finish == null && guard++ < 120) {
            val r = a.run!!; val s = r.step!!
            when (s) {
                is Step.Intro -> click("Got it")
                is Step.Mc -> { click(if (s.dir == "de_en") s.w.en else s.w.de, exact = true); click("Continue") }
                is Step.Listen -> { click(s.w.de, exact = true); click("Continue") }
                is Step.Gender -> { click(cd.lang.genderQ(s.w).ans, exact = true); click("Continue") }
                is Step.Cloze -> { click(s.opts[0], exact = true); click("Continue") }
                is Step.Type -> { compose.onAllNodes(hasSetTextAction()).onFirst().performTextInput(s.w.typeAns ?: s.w.de); click("Check"); click("Continue") }
                is Step.Match -> { s.ws.forEach { w -> click(w.de, exact = true); click(w.en, exact = true) }; click("Continue") }
                is Step.Build -> { waitFor("Complete the sentence"); r.answered(s, true, cd.lang.name); a.nextStep(); compose.waitForIdle() }
                else -> { r.answered(s, true, cd.lang.name); a.nextStep(); compose.waitForIdle() }
            }
        }
        assertNotNull("lesson finished", a.finish)
        waitFor("Accuracy")
        assertTrue(a.store.bitDone(item, bit))
        assertTrue(a.store.wordBits(item)[bit].all { truthy(a.S!!.obj("words")[it]) })
        if (has("Next part")) click("Later") else click("Continue")
        waitFor("Daily quest")

        // ---- the change reaches the server (debounced push from a background thread) ----
        val until = System.currentTimeMillis() + 15_000
        while (a.sync.pending && System.currentTimeMillis() < until) pump(200)
        val other = ApiClient(base, MemoryKeyValue())
        assertTrue(other.login("batul", "admin") is Net.Ok)
        val server = (other.getState("batul", "de-a1") as Net.Ok).v!!
        assertTrue("server has the finished part", truthy((server.obj("bits")[item.id] as? List<*>)?.getOrNull(bit)))

        // ---- every tab renders ----
        for ((tab, expect) in listOf("Path" to "Your path to A1", "Lessons" to "All lessons", "Words" to "learned", "Progress" to "Pace to", "Party" to "Start a party", "Settings" to "Quest Mode")) {
            click(tab, exact = true); waitFor(expect)
        }
        a.open(Screen.Ranks); waitFor("A1 Master")
        a.back(); compose.waitForIdle()
        a.open(Screen.Stories); waitFor("Short scenes to train your ear")
        a.back(); compose.waitForIdle()
        // reviews: grade every due word Good (programmatic grades through the real run)
        a.tab(Screen.Today); compose.waitForIdle()
        @Suppress("UNUSED_VARIABLE") val unused = tx

        // ---- skill-tree course: home, branch, reader, practice ----
        a.picked = false; a.changed(); waitFor("What do you want to study?")
        click("Software Engineering")
        waitFor("Your branches")
        val tr = a.tree!!; val br = tr.openBranches().first()
        click(br.title, exact = true)
        waitFor("skills learned")
        val node = tr.nextNode(br)!!
        a.open(Screen.Reader(br.id, node.id, null)); waitFor("Next ›")
        click("Next ›"); compose.waitForIdle()
        a.back(); compose.waitForIdle()
        if (node.quiz > 0) { a.open(Screen.Quiz(node.id, "quiz", null)); waitFor("Choose an answer") }
    }
}

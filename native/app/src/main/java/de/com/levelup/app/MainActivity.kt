package de.com.levelup.app

import android.app.Application
import android.content.Context
import android.os.Bundle
import android.speech.SpeechRecognizer
import android.view.MotionEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.ProcessLifecycleOwner
import de.com.levelup.app.ui.AuraBackground
import de.com.levelup.app.ui.BugSheet
import de.com.levelup.app.ui.Btn
import de.com.levelup.app.ui.CoursePicker
import de.com.levelup.app.ui.GrammarScreen
import de.com.levelup.app.ui.IntroScreen
import de.com.levelup.app.ui.LessonScreen
import de.com.levelup.app.ui.LessonsScreen
import de.com.levelup.app.ui.LevelUpTheme
import de.com.levelup.app.ui.LoginScreen
import de.com.levelup.app.ui.Muted
import de.com.levelup.app.ui.PartyScreen
import de.com.levelup.app.ui.PathScreen
import de.com.levelup.app.ui.PlayerPicker
import de.com.levelup.app.ui.ProgressScreen
import de.com.levelup.app.ui.QuizScreen
import de.com.levelup.app.ui.RanksScreen
import de.com.levelup.app.ui.ReaderScreen
import de.com.levelup.app.ui.SettingsScreen
import de.com.levelup.app.ui.SetupScreen
import de.com.levelup.app.ui.TodayScreen
import de.com.levelup.app.ui.BranchScreen
import de.com.levelup.app.ui.TreeHomeScreen
import de.com.levelup.app.ui.WordsScreen
import de.com.levelup.app.ui.confirmQuit
import de.com.levelup.app.ui.pal
import de.com.levelup.core.truthy
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle

class LevelUpApp : Application() {
    val graph by lazy { AppGraph(this) }
    companion object { fun graph(ctx: Context): AppGraph = (ctx.applicationContext as LevelUpApp).graph }
}

class MainActivity : ComponentActivity() {
    private val app get() = LevelUpApp.graph(this).app
    private var visible = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        app.speakSupported = runCatching { SpeechRecognizer.isRecognitionAvailable(this) }.getOrDefault(false)
        if (app.phase == "loading" && app.courses.isEmpty()) app.boot()
        ProcessLifecycleOwner.get().lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onStart(owner: LifecycleOwner) { visible = true; app.onForeground() }
            override fun onStop(owner: LifecycleOwner) { visible = false; app.audio.stop() }
        })
        setContent { Root(app) }
        // active time: 15 s ticks while the app is on screen and touched in the last 90 s (store.js startTimeTracking)
        lifecycleScope.launch { repeatOnLifecycle(Lifecycle.State.RESUMED) { while (true) { delay(15_000); app.timeTick(visible) } } }
    }
    override fun dispatchTouchEvent(ev: MotionEvent?): Boolean { app.lastInput = System.currentTimeMillis(); return super.dispatchTouchEvent(ev) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Root(app: AppState) {
    @Suppress("UNUSED_VARIABLE") val t = app.tick
    LevelUpTheme(app.themeId(), app.auraNow()) {
        Box(Modifier.fillMaxSize()) {
            AuraBackground(app.auraNow())
            Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().imePadding()) {
                Box(Modifier.weight(1f)) { Route(app) }
                if (showTabs(app)) Tabs(app)
            }
            // 🐞 feedback tab on every screen
            if (app.phase == "ready") Box(Modifier.align(Alignment.CenterEnd).padding(end = 0.dp)) {
                Text("🐞", Modifier.clip(RoundedCornerShape(topStart = 10.dp, bottomStart = 10.dp)).background(pal.card).border(1.dp, pal.line, RoundedCornerShape(topStart = 10.dp, bottomStart = 10.dp))
                    .clickable { app.showSheet { BugSheet(app) } }.padding(horizontal = 6.dp, vertical = 8.dp), fontSize = 16.sp)
            }
            app.toastMsg?.let { m ->
                Box(Modifier.align(Alignment.BottomCenter).padding(bottom = 96.dp, start = 20.dp, end = 20.dp).clip(RoundedCornerShape(12.dp)).background(Color(0xE6101828)).padding(horizontal = 16.dp, vertical = 12.dp)) {
                    Text(m, color = Color.White, fontSize = 15.sp, textAlign = TextAlign.Center)
                }
            }
        }
        app.sheet?.let { sh ->
            val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
            ModalBottomSheet(onDismissRequest = { app.closeSheet() }, sheetState = state, containerColor = if (pal.hunter > 0) Color(0xFF0A1428) else pal.card) {
                Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(start = 18.dp, end = 18.dp, bottom = 28.dp)) { sh.content() }
            }
        }
        BackHandler(enabled = true) {
            when {
                app.sheet != null -> app.closeSheet()
                app.top == Screen.Lesson && app.run != null && app.finish == null -> confirmQuit(app)
                app.top == Screen.Lesson -> app.quitLesson()
                !app.back() -> backToHomeOrExit(app)
            }
        }
    }
}

private var exitArmed = 0L
private fun backToHomeOrExit(app: AppState) {
    // first screen: a second back within 2.5 s closes the app (like the web's "Swipe back again to close LevelUp")
    if (System.currentTimeMillis() - exitArmed < 2500) { android.os.Process.killProcess(android.os.Process.myPid()); return }
    exitArmed = System.currentTimeMillis(); app.toast("Swipe back again to close LevelUp")
}

private fun showTabs(app: AppState): Boolean {
    if (app.phase != "ready" || app.user == null || app.S == null || !app.picked || app.isTree) return false
    if (!truthy(app.S!!["setup"])) return false
    return when (app.top) { Screen.Lesson, is Screen.Grammar, Screen.Ranks, is Screen.Story -> false; else -> true }
}

@Composable
private fun Tabs(app: AppState) {
    val p = pal
    val tabs = listOf(Triple(Screen.Today, "🏠", "Today"), Triple(Screen.Path, if (app.questMode) "🗺️" else "🧩", if (app.questMode) "Path" else "Skills"), Triple(Screen.Lessons, "📋", "Lessons"),
        Triple(Screen.Words, "📖", "Words"), Triple(Screen.Progress, "📈", "Progress"), Triple(Screen.Party, "👥", "Party"), Triple(Screen.Settings, "⚙️", "Settings"))
    val root = app.stack.firstOrNull()
    val reqs = (app.party?.get("mine") as? Map<*, *>)?.get("requests") as? List<*>
    Row(Modifier.fillMaxWidth().background(if (p.hunter > 0) Color(0xFF050913) else p.card).border(1.dp, p.line).padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
        tabs.forEach { (s, icon, label) ->
            val on = root == s
            Column(Modifier.weight(1f).clip(RoundedCornerShape(8.dp)).clickable { app.tab(s) }.padding(vertical = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(icon + if (s == Screen.Party && !reqs.isNullOrEmpty()) "•" else "", fontSize = 18.sp)
                Text(if (p.upper) label.uppercase() else label, fontSize = 9.sp, color = if (on) (if (p.hunter > 0) Color(0xFF8FD0FF) else p.primary) else p.muted, fontWeight = if (on) FontWeight.ExtraBold else FontWeight.Normal, maxLines = 1)
            }
        }
    }
}

@Composable
private fun Route(app: AppState) {
    @Suppress("UNUSED_VARIABLE") val t = app.tick     // learner state is plain JSON: redraw on every change
    when (app.phase) {
        "loading" -> { Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Muted("Loading LevelUp…") }; return }
        "error" -> { Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) { Muted("Could not load lessons. Check your internet connection, then try again.", align = TextAlign.Center); Btn("Try again") { app.boot() } }; return }
    }
    if (app.user == null || app.S == null) {
        when { !app.introSeen -> IntroScreen(app); app.sync.auth == "on" -> LoginScreen(app); else -> PlayerPicker(app) }
        return
    }
    if (!app.picked) { CoursePicker(app); return }
    LaunchedEffect(app.course?.id, app.user) { app.updateSnapshot() }
    if (app.isTree) {
        when (val s = app.top) {
            is Screen.Branch -> BranchScreen(app, s.id)
            is Screen.Reader -> ReaderScreen(app, s)
            is Screen.Quiz -> QuizScreen(app, s)
            Screen.Party -> PartyScreen(app)
            else -> TreeHomeScreen(app)
        }
        return
    }
    if (!truthy(app.S!!["setup"])) { SetupScreen(app); return }
    when (val s = app.top) {
        Screen.Path -> PathScreen(app)
        Screen.Lessons -> LessonsScreen(app)
        Screen.Words -> WordsScreen(app)
        Screen.Progress -> ProgressScreen(app)
        Screen.Party -> PartyScreen(app)
        Screen.Settings -> SettingsScreen(app)
        Screen.Ranks -> RanksScreen(app)
        is Screen.Grammar -> GrammarScreen(app, s.id)
        Screen.Lesson -> LessonScreen(app)
        Screen.Stories -> de.com.levelup.app.ui.StoriesScreen(app)
        is Screen.Story -> de.com.levelup.app.ui.StoryScreen(app, s.id)
        else -> TodayScreen(app)
    }
}

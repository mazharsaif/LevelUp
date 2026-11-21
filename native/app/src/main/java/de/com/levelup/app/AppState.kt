package de.com.levelup.app

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import de.com.levelup.app.audio.AudioPlayer
import de.com.levelup.app.data.ContentRepo
import de.com.levelup.app.data.MainThreadRunner
import de.com.levelup.app.data.PrefsKeyValue
import de.com.levelup.app.sync.SyncWorker
import de.com.levelup.app.sync.WidgetSnapshotRepository
import de.com.levelup.core.ContentParser
import de.com.levelup.core.Course
import de.com.levelup.core.CourseData
import de.com.levelup.core.Finish
import de.com.levelup.core.JObj
import de.com.levelup.core.Js
import de.com.levelup.core.LessonRun
import de.com.levelup.core.Lessons
import de.com.levelup.core.PathItem
import de.com.levelup.core.Store
import de.com.levelup.core.Tree
import de.com.levelup.core.WidgetSnapshot
import de.com.levelup.core.arr
import de.com.levelup.core.obj
import de.com.levelup.core.sync.ApiClient
import de.com.levelup.core.sync.Net
import de.com.levelup.core.sync.PutResult
import de.com.levelup.core.sync.SyncEngine
import de.com.levelup.core.truthy
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Long-lived objects (no UI): also what the WorkManager job uses when the app isn't open. */
class AppGraph(val ctx: Context) {
    val kv = PrefsKeyValue(ctx)
    val api = ApiClient(kv.get("server.url") ?: BuildConfig.SERVER_URL, kv)
    val store = Store(null)
    val sync = SyncEngine(api, kv, store).also { it.main = MainThreadRunner }
    val content = ContentRepo(ctx, api)
    val widgets = WidgetSnapshotRepository(ctx)
    /** UI-side work; a failure is logged, never a crash */
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main + kotlinx.coroutines.CoroutineExceptionHandler { _, e -> android.util.Log.e("LevelUp", "background task failed", e) })
    val audio = AudioPlayer(ctx, api, scope)
    val app: AppState by lazy { AppState(this) }
}

sealed interface Screen {
    data object Today : Screen
    data object Path : Screen
    data object Lessons : Screen
    data object Words : Screen
    data object Progress : Screen
    data object Party : Screen
    data object Settings : Screen
    data object Ranks : Screen
    data class Grammar(val id: String) : Screen
    data object Lesson : Screen
    data object TreeHome : Screen
    data class Branch(val id: String) : Screen
    data class Reader(val branch: String, val node: String?, val part: Int?) : Screen
    data class Quiz(val node: String, val mode: String, val only: List<Int>?) : Screen
    data object Stories : Screen
    data class Story(val id: String) : Screen
}

class Sheet(val content: @Composable () -> Unit)

/**
 * The app's state + actions (what app.js does around store.js): boot, login, course picker, routing, lessons,
 * sync status, toasts and sheets. Compose screens read [tick] so they redraw after the learner state changes.
 */
class AppState(val g: AppGraph) {
    val store get() = g.store
    val sync: SyncEngine get() = g.sync
    val audio get() = g.audio
    val S: JObj? get() = store.S

    var tick by mutableIntStateOf(0); private set
    fun changed() { tick++ }

    var phase by mutableStateOf("loading")      // loading | ready | error
    var courses by mutableStateOf<List<Course>>(emptyList())
    var course by mutableStateOf<Course?>(null)
    var cd by mutableStateOf<CourseData?>(null)
    var tree by mutableStateOf<Tree?>(null)
    var lessons: Lessons? = null
    val stack = mutableStateListOf<Screen>()
    var sheet by mutableStateOf<Sheet?>(null)
    var toastMsg by mutableStateOf<String?>(null)
    var run by mutableStateOf<LessonRun?>(null)
    var finish by mutableStateOf<Finish?>(null)
    var picked by mutableStateOf(false)
    var authTab by mutableStateOf("login")
    var party by mutableStateOf<JObj?>(null)
    var introSeen by mutableStateOf(g.kv.get("a1.introSeen") != null)
    /** for the Reader / Quiz screens: chapter files loaded on demand */
    val chapters = HashMap<String, de.com.levelup.core.Chapter>()

    val user get() = sync.user
    val userName get() = sync.userInfo(user).name
    val isTree get() = course?.isTree == true
    val questMode get() = store.questMode()
    val top: Screen? get() = stack.lastOrNull()

    init {
        sync.schedulePush = { schedulePush() }
        sync.onStateReplaced = { if (run == null) { toast("Newer progress from another device loaded"); changed() } }
        sync.onSync = { changed() }
        sync.onAuthLost = { g.scope.launch { val a = withContext(Dispatchers.IO) { sync.checkAuth() }; if (a == "on" && sync.user == null) { sync.signOut(); toast("Please log in again") }; changed() } }
        audio.enabled = { S?.obj("settings")?.get("sound") != false }
    }

    // ---------- boot ----------
    fun boot() = g.scope.launch {
        phase = "loading"
        courses = withContext(Dispatchers.IO) { g.content.cached("data/courses.json")?.let { runCatching { ContentParser.courses(it) }.getOrNull() } } ?: emptyList()
        g.scope.launch(Dispatchers.IO) { g.content.load("data/courses.json")?.let { t -> runCatching { ContentParser.courses(t) }.getOrNull()?.let { withContext(Dispatchers.Main) { courses = it } } } }
        withContext(Dispatchers.IO) { sync.checkAuth(); sync.loadUsers() }
        val start = user?.let { sync.lastCourse(it) } ?: ApiClient.DEFAULT_COURSE
        val c = courses.firstOrNull { it.id == start && it.ready } ?: courses.firstOrNull { it.id == ApiClient.DEFAULT_COURSE }
        if (c == null || !loadCourse(c)) { phase = "error"; return@launch }
        user?.let { u -> withContext(Dispatchers.IO) { sync.switchUser(u) } }
        phase = "ready"
        resetStack()
        SyncWorker.schedulePeriodic(g.ctx)
        refreshParty()
        changed()
    }

    private suspend fun loadCourse(c: Course): Boolean {
        val path = c.content ?: return false
        val text = withContext(Dispatchers.IO) { g.content.cached(path) ?: g.content.load(path) } ?: return false
        g.scope.launch(Dispatchers.IO) { g.content.load(path) }           // refresh the saved copy for next time
        return runCatching {
            val parsed: Any = withContext(Dispatchers.Default) { if (c.isTree) ContentParser.tree(text) else CourseData(c, ContentParser.lang(text)) }
            if (parsed is CourseData) { store.c = parsed; cd = parsed; tree = null; lessons = Lessons(store, parsed) }
            else { store.c = null; cd = null; tree = Tree(store, parsed as de.com.levelup.core.TreeContent); lessons = null }
            course = c
            sync.selectCourse(c.id)
            cd?.let { audio.langTag = it.lang.bcp }
            true
        }.getOrElse { false }
    }

    fun switchCourse(c: Course, then: () -> Unit = {}) = g.scope.launch {
        if (S != null && user != null && sync.pending) withContext(Dispatchers.IO) { sync.push() }
        store.S = null
        if (!loadCourse(c)) { toast("Could not load ${c.title}. Check your connection."); return@launch }
        user?.let { u -> withContext(Dispatchers.IO) { sync.switchUser(u) } }
        picked = true; resetStack(); then(); changed(); updateSnapshot()
    }

    // ---------- accounts ----------
    fun authSubmit(signup: Boolean, username: String, name: String, password: String, onError: (String) -> Unit) = g.scope.launch {
        val wasGuest = sync.isGuest
        val r = withContext(Dispatchers.IO) { if (signup) sync.signup(username, name, password) else sync.login(username, password) }
        when (r) {
            is Net.Ok -> {
                if (wasGuest && signup) sync.claimGuest(r.v.id) else if (wasGuest) sync.leaveGuest()
                withContext(Dispatchers.IO) { sync.loadUsers(); sync.switchUser(r.v.id) }
                picked = false; resetStack(); toast(if (signup) "Willkommen, ${r.v.name}!" else "Hallo ${r.v.name}!"); changed()
            }
            is Net.Err -> onError(r.error)
            Net.Offline -> onError("No connection to the server")
        }
    }
    fun enterGuest() = g.scope.launch {
        sync.startGuest(); withContext(Dispatchers.IO) { sync.switchUser(SyncEngine.GUEST) }
        picked = false; resetStack(); toast("Guest mode: progress stays on this phone"); changed()
    }
    fun pickPlayer(id: String) = g.scope.launch { withContext(Dispatchers.IO) { sync.switchUser(id) }; picked = false; resetStack(); changed() }
    fun logout() = g.scope.launch { withContext(Dispatchers.IO) { sync.logout() }; picked = false; g.widgets.save(null); toast("Logged out"); changed() }
    fun leaveGuest() { sync.leaveGuest(); picked = false; authTab = "login"; changed() }
    fun changePassword(old: String, new: String, done: (String?) -> Unit) = g.scope.launch {
        when (val r = withContext(Dispatchers.IO) { g.api.changePassword(old, new) }) { is Net.Ok -> done(null); is Net.Err -> done(r.error); Net.Offline -> done("No connection to the server") }
    }
    fun seeIntro() { g.kv.set("a1.introSeen", "1"); introSeen = true }

    // ---------- navigation ----------
    fun resetStack() { stack.clear(); stack.add(if (isTree) Screen.TreeHome else Screen.Today) }
    fun tab(s: Screen) { audio.stop(); stack.clear(); stack.add(s); sheet = null }
    fun open(s: Screen) { audio.stop(); sheet = null; stack.add(s) }
    fun back(): Boolean {
        audio.stop()
        if (sheet != null) { sheet = null; return true }
        if (stack.size > 1) { val t = stack.removeAt(stack.size - 1); if (t == Screen.Lesson) { run = null; finish = null }; return true }
        return false
    }
    fun showSheet(content: @Composable () -> Unit) { sheet = Sheet(content) }
    fun closeSheet() { sheet = null }
    fun toast(m: String) { toastMsg = m; g.scope.launch { delay(2400); if (toastMsg == m) toastMsg = null } }

    // ---------- lessons ----------
    fun startItem(it: PathItem, bit: Int? = null) {
        val L = lessons ?: return; val cdd = cd ?: return
        sheet = null
        val b = bit ?: store.nextBit(it)
        when (it.kind) {
            "vocab" -> L.vocab(it, b) { r -> beginRun(r) }
            "grammar" -> open(Screen.Grammar(it.id))
            else -> L.phrases(cdd.phrases[it.id] ?: return, it, b, speakOn()) { r -> beginRun(r) }
        }
    }
    fun startReview(ids: List<String>) { lessons?.review(ids) { beginRun(it) } }
    fun startGrammar(it: PathItem) { val g0 = cd?.grammarOf(it) ?: return; lessons?.grammar(g0, it, userName) { beginRun(it) } }
    var speakSupported = false
    fun speakOn() = speakSupported && S?.obj("settings")?.get("speak") != false
    private fun beginRun(r: LessonRun) {
        audio.stop(); run = r; finish = null; r.enter()
        if (top != Screen.Lesson) stack.add(Screen.Lesson)
        changed()
    }
    /** move to the next step, or finish the run */
    fun nextStep() {
        val r = run ?: return
        audio.stop()
        r.next()
        if (r.step == null) finish = r.finish(store, cd)
        changed()
    }
    fun quitLesson() { audio.stop(); run = null; finish = null; while (stack.size > 1 && top == Screen.Lesson) stack.removeAt(stack.size - 1); changed() }
    /** finish screen "Next part": in Quest Mode the next pick (alternating lessons), else the next part of this lesson */
    fun nextPartAction(): Pair<String, () -> Unit>? {
        val f = finish ?: return null; val r = run ?: return null
        if (f.kind == "review" || f.failed || (f.bitOf == null && !f.lessonDone)) return null
        if (questMode) {
            val it = store.nextPick() ?: return null
            val n = store.bitCount(it)
            val label = (if (it.kind == "vocab") "Lesson ${it.n}: ${it.title}" else it.title) + (if (n > 1) " · part ${minOf(store.bitsDone(it) + 1, n)} of $n" else "")
            return label to { quitLesson(); startItem(it) }
        }
        val nb = r.nextBit ?: return null
        return "" to { nb() }
    }

    // ---------- sync / widgets ----------
    private var pushJob: Job? = null
    private var snapJob: Job? = null
    private fun schedulePush() {
        pushJob?.cancel()
        pushJob = g.scope.launch {
            delay(600)
            val r = withContext(Dispatchers.IO) { sync.push() }
            if (r is PutResult.Offline || r is PutResult.Failed) SyncWorker.schedule(g.ctx)
            changed()
        }
        updateSnapshot()
    }
    fun updateSnapshot() {
        snapJob?.cancel()
        snapJob = g.scope.launch {
            delay(800)
            val u = user ?: return@launch
            if (S == null) return@launch
            val snap = runCatching {
                val c = course ?: return@launch
                if (c.isTree) tree?.let { WidgetSnapshot.ofTree(store, it, c, u, userName) } else cd?.let { WidgetSnapshot.of(store, it, u, userName) }
            }.getOrNull()
            g.widgets.save(snap)
        }
    }
    fun onForeground() = g.scope.launch {
        if (phase != "ready" || run != null) return@launch
        if (withContext(Dispatchers.IO) { sync.refreshFromServer() }) changed()
        refreshParty()
    }

    // ---------- time tracking: S.time[date] = [active s, lesson s] (15 s ticks, idle after 90 s) ----------
    var lastInput = System.currentTimeMillis()
    private var unsaved = 0
    fun timeTick(visible: Boolean) {
        val st = S ?: return
        if (!visible || user == null || System.currentTimeMillis() - lastInput > 90_000) return
        val t = store.today()
        val d = st.obj("time")[t] as? MutableList<Any?> ?: mutableListOf<Any?>(0.0, 0.0).also { st.obj("time")[t] = it }
        d[0] = ((d[0] as? Number)?.toDouble() ?: 0.0) + 15
        if (run != null) d[1] = ((d[1] as? Number)?.toDouble() ?: 0.0) + 15
        unsaved += 15
        if (unsaved >= 60) { unsaved = 0; store.save() }
    }

    // ---------- party ----------
    fun refreshParty() = g.scope.launch {
        if (sync.auth != "on" || sync.isGuest || user == null) return@launch
        when (val r = withContext(Dispatchers.IO) { g.api.parties() }) { is Net.Ok -> { party = r.v; changed() }; else -> {} }
    }
    fun partyAction(path: String, body: Map<String, Any?> = emptyMap(), okMsg: String? = null) = g.scope.launch {
        when (val r = withContext(Dispatchers.IO) { g.api.partyPost(path, body) }) {
            is Net.Ok -> { if (okMsg != null) toast(okMsg) }
            is Net.Err -> toast(r.error)
            Net.Offline -> toast("No connection")
        }
        refreshParty()
    }

    // ---------- bug report (🐞): screen snapshot + note → POST /api/bugs; queued while offline ----------
    fun sendBug(kind: String, text: String, page: String, done: (Boolean) -> Unit) = g.scope.launch {
        val r = run
        val ctx = linkedMapOf<String, Any?>(
            "capturedAt" to java.time.Instant.now().toString(), "page" to page, "url" to "native:" + (top?.toString() ?: ""), "user" to user,
            "course" to course?.let { "${it.title} (${it.id})" }, "client" to "native-android ${BuildConfig.VERSION_NAME}",
            "device" to "${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL} (Android ${android.os.Build.VERSION.RELEASE})",
            "lesson" to r?.let { mapOf("title" to it.title, "kind" to it.kind, "step" to it.i + 1, "of" to it.total, "type" to it.step?.javaClass?.simpleName, "right" to it.right, "answered" to it.answered) },
            "settings" to S?.obj("settings")?.let { mapOf("theme" to it["theme"], "goalMode" to it["goalMode"]) },
        )
        val res = withContext(Dispatchers.IO) { g.api.bug(kind, text, ctx) }
        if (res !is Net.Ok) {
            val q = g.kv.get("a1.bugQueue")?.let { runCatching { Js.parse(it) as MutableList<Any?> }.getOrNull() } ?: mutableListOf()
            q.add(mapOf("category" to kind, "text" to text, "ctx" to ctx)); g.kv.set("a1.bugQueue", Js.stringify(q))
        } else flushBugs()
        done(res is Net.Ok)
    }
    private fun flushBugs() = g.scope.launch(Dispatchers.IO) {
        val q = g.kv.get("a1.bugQueue")?.let { runCatching { Js.parse(it) as List<*> }.getOrNull() } ?: return@launch
        val left = q.filter { rep -> val m = rep as? Map<*, *> ?: return@filter false
            @Suppress("UNCHECKED_CAST") g.api.bug(m["category"] as String, m["text"] as String, m["ctx"] as Map<String, Any?>) !is Net.Ok }
        g.kv.set("a1.bugQueue", if (left.isEmpty()) null else Js.stringify(left))
    }

    // ---------- small helpers used by several screens ----------
    fun setting(k: String) = S?.obj("settings")?.get(k)
    fun setSetting(k: String, v: Any?) { S?.obj("settings")?.set(k, v); store.save(); changed() }
    fun themeId(): String = (setting("theme") as? String) ?: g.kv.get("a1.theme") ?: "system"
    fun gems() = (S?.get("gems") as? Number)?.toInt() ?: 0
    fun unopenedGifts() = S?.arr("gifts")?.mapNotNull { it as? JObj }?.filter { !truthy(it["opened"]) } ?: emptyList()
    fun levelNow() = cd?.let { store.level(store.progress().total).lv } ?: 1
    fun auraNow() = if (isTree || S == null || !truthy(S!!["setup"])) 0.0 else de.com.levelup.core.Hero.aura(levelNow())
    val storeDefault: Store get() = store
    @Suppress("unused") val constants = Store.Companion
}

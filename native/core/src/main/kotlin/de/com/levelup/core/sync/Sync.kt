package de.com.levelup.core.sync

import de.com.levelup.core.JObj
import de.com.levelup.core.Js
import de.com.levelup.core.Store
import de.com.levelup.core.asObj
import de.com.levelup.core.num

/**
 * Port of the account + sync half of store.js (checkAuth, loadUsers, switchUser, save/push, refreshFromServer,
 * guest mode, logout). Same rules as the web so both clients can share one progress file:
 *  - newest of server copy and local cache wins (by `updated`);
 *  - a local copy that is newer is uploaded;
 *  - a 409 from the server means another device saved a newer copy: take it (S is replaced);
 *  - 401/403 keeps the change pending locally and reports a lost login;
 *  - offline keeps it pending; [pushPending] (WorkManager on the phone) uploads it later.
 * The state object is the raw JSON, so fields the native app doesn't know are written back untouched.
 * Local cache keys match the web's localStorage names (a1.state.<uid>[@course], a1.user, a1.guest …).
 */
class SyncEngine(val api: ApiClient, val kv: KeyValue, val store: Store) {
    var user: String? = kv.get("a1.user"); private set
    var course: String = ApiClient.DEFAULT_COURSE; private set
    var auth: String = kv.get("a1.auth") ?: "on"; private set
    var users: List<User> = emptyList(); private set
    var online = true; private set
    var pending = false; private set
    var last: Long? = null; private set

    var onStateReplaced: () -> Unit = {}
    var onAuthLost: () -> Unit = {}
    var onSync: () -> Unit = {}
    /** the app debounces this (600 ms like the web) and falls back to WorkManager when offline */
    var schedulePush: () -> Unit = {}
    /** where S may be read / changed (the UI thread on the phone); network calls stay on the caller's thread */
    var main: MainRunner = MainRunner.Direct

    val isGuest get() = user == GUEST
    fun cacheKey(u: String, c: String = course) = if (c == ApiClient.DEFAULT_COURSE) "a1.state.$u" else "a1.state.$u@$c"
    fun userInfo(id: String?): User = users.firstOrNull { it.id == id } ?: if (id == GUEST) User(GUEST, "Guest", "#868e96") else User(id ?: "?", id ?: "?", "#888")
    fun lastCourse(u: String) = kv.get("a1.course.$u")
    fun selectCourse(id: String) { course = id; user?.let { kv.set("a1.course.$it", id) } }

    init { store.onSave = { st -> saved(st) } }

    // ---------- accounts ----------
    /** "on" = server has logins, "off" = old server without them (player picker). Offline keeps the last answer. */
    fun checkAuth(): String {
        when (val r = api.me()) {
            is Net.Ok -> { auth = "on"; kv.set("a1.user", r.v.id); user = r.v.id }
            is Net.Err -> if (r.code == 401) { auth = "on"; if (kv.get("a1.guest") != null) { kv.set("a1.user", GUEST); user = GUEST } else { kv.set("a1.user", null); user = null } } else auth = "off"
            Net.Offline -> return auth
        }
        kv.set("a1.auth", auth)
        return auth
    }
    fun loadUsers(): List<User> {
        when (val r = api.users()) {
            is Net.Ok -> { users = r.v; kv.set("a1.users", Js.stringify(r.v.map { mapOf("id" to it.id, "name" to it.name, "color" to it.color) })) }
            is Net.Err -> if (r.code == 401) { users = emptyList(); user = if (kv.get("a1.guest") != null && kv.get("a1.user") == GUEST) GUEST else null; return users } else cachedUsers()
            Net.Offline -> { cachedUsers(); online = false }
        }
        val u = kv.get("a1.user")
        user = if (users.any { it.id == u } || (u == GUEST && kv.get("a1.guest") != null)) u else null
        return users
    }
    private fun cachedUsers() {
        users = (kv.get("a1.users")?.let { runCatching { Js.parse(it) as List<*> }.getOrNull() } ?: emptyList<Any>())
            .mapNotNull { it.asObj()?.let { o -> User(o["id"] as String, o["name"] as? String ?: "", o["color"] as? String ?: "#888") } }
    }
    fun login(u: String, p: String) = api.login(u, p)
    fun signup(u: String, name: String, p: String) = api.signup(u, name, p)

    fun startGuest() { kv.set("a1.guest", "1"); kv.set("a1.user", GUEST); user = GUEST }
    fun hasGuestData() = kv.keys().any { it == "a1.state.$GUEST" || it.startsWith("a1.state.$GUEST@") }
    fun leaveGuest() { kv.set("a1.guest", null); signOut() }
    /** after sign-up: the guest's courses move into the new account (then switchUser uploads them) */
    fun claimGuest(uid: String) {
        val re = Regex("^a1\\.(state|hero|course)\\.guest(@.*)?$")
        for (k in kv.keys()) {
            val m = re.matchEntire(k) ?: continue
            var v = kv.get(k) ?: continue
            if (m.groupValues[1] == "state") runCatching { val st = Js.parseObj(v); st["updated"] = store.nowMs().toDouble(); v = Js.stringify(st) }
            kv.set("a1.${m.groupValues[1]}.$uid${m.groupValues[2]}", v); kv.set(k, null)
        }
        kv.set("a1.guest", null)
    }
    fun logout() {
        val u = user
        if (store.S != null && u != null && pending) push()
        signOut()
        api.logout()
        kv.keys().filter { it == "a1.state.$u" || it.startsWith("a1.state.$u@") }.forEach { kv.set(it, null) }
    }
    fun signOut() { if (store.S != null && user != null && pending) push(); user = null; main.run { store.S = null }; kv.set("a1.user", null) }

    // ---------- state ----------
    /** Load a learner's state: newest of server copy and local cache wins; a newer local copy is uploaded. */
    fun switchUser(id: String): JObj {
        if (store.S != null && user != null && pending) push()
        user = id; kv.set("a1.user", id)
        val local = kv.get(cacheKey(id))?.let { runCatching { Js.parseObj(it) }.getOrNull() }
        if (id == GUEST) return main.run { store.S = store.normalize(local); cache(); store.checkMissed(); store.S!! }
        var server: JObj? = null
        when (val r = api.getState(id, course)) { is Net.Ok -> { server = r.v; online = true }; is Net.Err -> online = true; Net.Offline -> online = false }
        val su = server?.num("updated") ?: 0.0; val lu = local?.num("updated") ?: 0.0
        val st = main.run {
            store.S = store.normalize(if (server != null && (local == null || su >= lu)) server else local)
            cache()
            store.checkMissed()
            store.S!!
        }
        if (local != null && (server == null || lu > su)) push()
        return st
    }
    private fun cache() { val u = user ?: return; store.S?.let { kv.set(cacheKey(u), Js.stringify(it)) } }

    /** Store.save() lands here: cache locally, mark pending, let the app schedule the upload. */
    private fun saved(st: JObj) {
        val u = user ?: return
        kv.set(cacheKey(u), Js.stringify(st))
        if (isGuest) return
        pending = true
        kv.set("sync.pending", "$u|$course")
        schedulePush()
    }
    @Synchronized fun push(): PutResult? {
        val u = user ?: return null
        if (isGuest) return null
        val body = main.run { store.S?.let { Js.stringify(it) } } ?: return null   // snapshot taken where the UI changes S
        val r = api.putStateRaw(u, course, body)
        when (r) {
            PutResult.AuthLost -> { pending = true; onAuthLost(); return r }
            is PutResult.Conflict -> if (u == user) main.run { store.S = store.normalize(r.state); cache(); onStateReplaced() }
            PutResult.Offline, is PutResult.Failed -> { online = r !is PutResult.Offline; pending = true; onSync(); return r }
            PutResult.Saved -> {}
        }
        online = true; pending = false; last = store.nowMs(); kv.set("sync.pending", null)
        onSync()
        return r
    }
    /** Background upload of a change cached while offline (no learner loaded needed): used by the WorkManager job. */
    fun pushPending(): PutResult? {
        val p = kv.get("sync.pending") ?: return null
        val (u, c) = p.split("|", limit = 2).let { it[0] to it.getOrElse(1) { ApiClient.DEFAULT_COURSE } }
        if (store.S != null && u == user && c == course) return push()
        val st = kv.get(cacheKey(u, c))?.let { runCatching { Js.parseObj(it) }.getOrNull() } ?: return null
        val r = api.putState(u, c, st)
        if (r is PutResult.Conflict) kv.set(cacheKey(u, c), Js.stringify(r.state))
        if (r is PutResult.Saved || r is PutResult.Conflict) kv.set("sync.pending", null)
        return r
    }
    /** pull newer data saved from another device (app back in the foreground). True = S changed. */
    fun refreshFromServer(): Boolean {
        val u = user ?: return false
        if (isGuest) return main.run { store.checkMissed() > 0 }
        if (pending) { push(); return false }
        when (val r = api.getState(u, course)) {
            is Net.Ok -> {
                online = true
                val s = r.v
                return main.run {
                    if (s != null && s.num("updated") > (store.S?.num("updated") ?: 0.0)) { store.S = store.normalize(s); cache(); store.checkMissed(); true }
                    else store.checkMissed() > 0
                }
            }
            is Net.Err -> online = true
            Net.Offline -> online = false
        }
        return false
    }
    /** progress of you and your party (comparison); guests / offline fall back to what's on the phone */
    fun fetchAllStates(): Map<String, JObj?> {
        val u = user
        if (isGuest || u == null) return mapOf(GUEST to store.S)
        return when (val r = api.states(course)) {
            is Net.Ok -> r.v
            else -> users.associate { x -> x.id to (if (x.id == u) store.S else kv.get(cacheKey(x.id))?.let { runCatching { Js.parseObj(it) }.getOrNull() }) }
        }
    }

    companion object { const val GUEST = "guest" }
}

/** Runs a block on the thread that owns the learner state and returns its result. */
interface MainRunner {
    fun <T> run(f: () -> T): T
    object Direct : MainRunner { override fun <T> run(f: () -> T): T = f() }
}

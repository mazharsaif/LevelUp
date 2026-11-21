package de.com.levelup.core.sync

import de.com.levelup.core.JObj
import de.com.levelup.core.Js
import de.com.levelup.core.asArr
import de.com.levelup.core.asObj
import de.com.levelup.core.str
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Small key/value store (SharedPreferences on the phone, a map in tests): the web app's localStorage. */
interface KeyValue {
    fun get(k: String): String?
    fun set(k: String, v: String?)
    fun keys(): Set<String>
}

class MemoryKeyValue : KeyValue {
    private val m = java.util.concurrent.ConcurrentHashMap<String, String>()
    override fun get(k: String) = m[k]
    override fun set(k: String, v: String?) { if (v == null) m.remove(k) else m[k] = v }
    override fun keys(): Set<String> = m.keys.toSet()
}

data class User(val id: String, val name: String, val color: String = "#888")

sealed class Net<out T> {
    data class Ok<T>(val v: T) : Net<T>()
    data class Err(val code: Int, val error: String, val body: JObj? = null) : Net<Nothing>()
    data object Offline : Net<Nothing>()
    val ok get() = this is Ok
}

/** The PUT result: saved, a newer copy on the server (409, the server's copy is returned), or the login is gone. */
sealed class PutResult {
    data object Saved : PutResult()
    data class Conflict(val state: JObj) : PutResult()
    data object AuthLost : PutResult()
    data class Failed(val code: Int) : PutResult()
    data object Offline : PutResult()
}

/** Keeps the HttpOnly session cookie `lu_session` (90 days) across app restarts, like the browser does. */
class PersistentCookieJar(private val kv: KeyValue) : CookieJar {
    private val key = "net.cookies"
    @Synchronized override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val all = load().filter { old -> cookies.none { it.name == old.name && it.domain == old.domain } } + cookies
        val now = System.currentTimeMillis()
        val keep = all.filter { it.expiresAt > now && it.value.isNotEmpty() }
        kv.set(key, keep.joinToString("\n") { "${it.domain}\t${url.scheme}\t${it.toString()}" })
    }
    @Synchronized override fun loadForRequest(url: HttpUrl): List<Cookie> = load().filter { it.matches(url) && it.expiresAt > System.currentTimeMillis() }
    private fun load(): List<Cookie> = (kv.get(key) ?: "").lines().filter { it.isNotBlank() }.mapNotNull { line ->
        val parts = line.split("\t", limit = 3); if (parts.size < 3) return@mapNotNull null
        Cookie.parse("${parts[1]}://${parts[0]}/".toHttpUrl(), parts[2])
    }
    fun clear() = kv.set(key, null)
    fun hasSession() = load().any { it.name == "lu_session" }
}

/**
 * Client for the LevelUp server (server_fastapi/main.py): accounts, progress (GET/PUT with the 409 stale-write
 * rule), learners, party states, parties, bug reports, and the static content / audio files it serves.
 * Blocking calls: run them off the main thread.
 */
class ApiClient(baseUrl: String, kv: KeyValue, client: OkHttpClient? = null) {
    @Volatile var base: String = baseUrl.trimEnd('/') + "/"
    val cookies = PersistentCookieJar(kv)
    val http: OkHttpClient = (client?.newBuilder() ?: OkHttpClient.Builder())
        .cookieJar(cookies).connectTimeout(8, TimeUnit.SECONDS).readTimeout(20, TimeUnit.SECONDS).build()
    private val JSON = "application/json".toMediaType()

    fun cq(course: String) = if (course == DEFAULT_COURSE) "" else "?c=" + java.net.URLEncoder.encode(course, "UTF-8")

    private fun call(method: String, path: String, body: Any? = Undef): Net<Any?> = try {
        val b = Request.Builder().url(base + path).header("Cache-Control", "no-store")
        val rb = if (body === Undef) null else (if (body is String) body else Js.stringify(body)).toRequestBody(JSON)
        b.method(method, rb ?: if (method == "GET") null else "{}".toRequestBody(JSON))
        http.newCall(b.build()).execute().use { r ->
            val txt = r.body?.string() ?: ""
            val j = runCatching { Js.parse(txt) }.getOrNull()
            if (r.isSuccessful) Net.Ok(j) else Net.Err(r.code, errText(j, r.code), j.asObj())
        }
    } catch (e: IOException) { Net.Offline }
    private object Undef

    private fun errText(j: Any?, code: Int): String {
        val o = j.asObj() ?: return "Server error ($code)"
        o.str("error")?.let { return it }
        o["detail"].asArr()?.let { d -> return d.mapNotNull { it.asObj()?.str("msg") }.joinToString("; ") }
        return "Server error ($code)"
    }
    private fun user(o: Any?): User? = o.asObj()?.let { User(it.str("id") ?: return null, it.str("name") ?: it.str("id")!!, it.str("color") ?: "#888") }

    /** 200 = logged in, 401 = server has accounts but nobody is logged in, 404 = old server without accounts */
    fun me(): Net<User> = when (val r = call("GET", "api/auth/me")) { is Net.Ok -> user(r.v)?.let { Net.Ok(it) } ?: Net.Err(500, "bad reply"); is Net.Err -> r; Net.Offline -> Net.Offline }
    fun login(username: String, password: String) = authPost("login", mapOf("username" to username, "password" to password))
    fun signup(username: String, name: String, password: String) = authPost("signup", mapOf("username" to username, "name" to name, "password" to password))
    fun changePassword(old: String, new: String): Net<Unit> = when (val r = call("POST", "api/auth/password", mapOf("old" to old, "new" to new))) { is Net.Ok -> Net.Ok(Unit); is Net.Err -> r; Net.Offline -> Net.Offline }
    fun logout(): Net<Unit> = call("POST", "api/auth/logout").let { cookies.clear(); if (it is Net.Offline) Net.Offline else Net.Ok(Unit) }
    private fun authPost(path: String, body: Map<String, String>): Net<User> = when (val r = call("POST", "api/auth/$path", body)) {
        is Net.Ok -> user(r.v)?.let { Net.Ok(it) } ?: Net.Err(500, "bad reply"); is Net.Err -> r; Net.Offline -> Net.Offline
    }
    fun users(): Net<List<User>> = when (val r = call("GET", "api/users")) { is Net.Ok -> Net.Ok(r.v.asArr()?.mapNotNull { user(it) } ?: emptyList()); is Net.Err -> r; Net.Offline -> Net.Offline }

    /** your progress for a course (Ok(null) = not started yet) */
    fun getState(uid: String, course: String): Net<JObj?> = when (val r = call("GET", "api/state/${enc(uid)}" + cq(course))) {
        is Net.Ok -> Net.Ok(r.v.asObj()?.get("state").asObj()); is Net.Err -> r; Net.Offline -> Net.Offline
    }
    fun putState(uid: String, course: String, state: JObj): PutResult = putStateRaw(uid, course, Js.stringify(state))
    fun putStateRaw(uid: String, course: String, body: String): PutResult = when (val r = call("PUT", "api/state/${enc(uid)}" + cq(course), body)) {
        is Net.Ok -> PutResult.Saved
        is Net.Err -> when (r.code) {
            401, 403 -> PutResult.AuthLost
            409 -> r.body?.get("state").asObj()?.let { PutResult.Conflict(it) } ?: PutResult.Failed(409)
            else -> PutResult.Failed(r.code)
        }
        Net.Offline -> PutResult.Offline
    }
    /** you + your party members (the comparison) */
    fun states(course: String): Net<Map<String, JObj?>> = when (val r = call("GET", "api/states" + cq(course))) {
        is Net.Ok -> Net.Ok(r.v.asObj()?.mapValues { it.value.asObj() } ?: emptyMap()); is Net.Err -> r; Net.Offline -> Net.Offline
    }
    fun parties(): Net<JObj> = when (val r = call("GET", "api/parties")) { is Net.Ok -> Net.Ok(r.v.asObj() ?: linkedMapOf()); is Net.Err -> r; Net.Offline -> Net.Offline }
    fun partyPost(path: String, body: Map<String, Any?> = emptyMap()): Net<JObj> = when (val r = call("POST", "api/parties$path", body)) { is Net.Ok -> Net.Ok(r.v.asObj() ?: linkedMapOf()); is Net.Err -> r; Net.Offline -> Net.Offline }
    fun bug(category: String, text: String, ctx: Map<String, Any?>): Net<String> = when (val r = call("POST", "api/bugs", mapOf("category" to category, "text" to text, "ctx" to ctx))) {
        is Net.Ok -> Net.Ok(r.v.asObj()?.str("id") ?: ""); is Net.Err -> r; Net.Offline -> Net.Offline
    }
    fun health(): Net<JObj> = when (val r = call("GET", "api/health")) { is Net.Ok -> Net.Ok(r.v.asObj() ?: linkedMapOf()); is Net.Err -> r; Net.Offline -> Net.Offline }

    /** a static file of the web app (data/…json, audio/<id>.mp3) */
    fun fetchBytes(path: String): Net<ByteArray> = try {
        http.newCall(Request.Builder().url(base + path).build()).execute().use { r -> if (r.isSuccessful) Net.Ok(r.body!!.bytes()) else Net.Err(r.code, "HTTP ${r.code}") }
    } catch (e: IOException) { Net.Offline }
    fun fetchText(path: String): Net<String> = when (val r = fetchBytes(path)) { is Net.Ok -> Net.Ok(String(r.v, Charsets.UTF_8)); is Net.Err -> r; Net.Offline -> Net.Offline }

    private fun enc(s: String) = java.net.URLEncoder.encode(s, "UTF-8")

    companion object { const val DEFAULT_COURSE = "de-a1" }
}

package de.com.levelup.app.data

import android.content.Context
import android.os.Handler
import android.os.Looper
import de.com.levelup.core.sync.ApiClient
import de.com.levelup.core.sync.KeyValue
import de.com.levelup.core.sync.MainRunner
import de.com.levelup.core.sync.Net
import java.io.File
import java.util.concurrent.CountDownLatch

/** SharedPreferences as the web app's localStorage (same key names: a1.user, a1.state.<uid>[@course], …). */
class PrefsKeyValue(ctx: Context) : KeyValue {
    private val p = ctx.getSharedPreferences("levelup", Context.MODE_PRIVATE)
    override fun get(k: String): String? = p.getString(k, null)
    override fun set(k: String, v: String?) { p.edit().apply { if (v == null) remove(k) else putString(k, v) }.apply() }
    override fun keys(): Set<String> = p.all.keys.toSet()
}

/** Learner state lives on the UI thread; sync code running elsewhere hops over for each read/write of it. */
object MainThreadRunner : MainRunner {
    private val h = Handler(Looper.getMainLooper())
    override fun <T> run(f: () -> T): T {
        if (Looper.myLooper() == Looper.getMainLooper()) return f()
        var out: Result<T>? = null
        val done = CountDownLatch(1)
        h.post { out = runCatching(f); done.countDown() }
        done.await()
        return out!!.getOrThrow()
    }
}

/**
 * Course files and reading chapters from the server's static files (same paths as the web: data/…), with an
 * offline copy on the phone (filesDir/web/…) and the copy bundled in the APK as the last fallback.
 */
class ContentRepo(private val ctx: Context, private val api: ApiClient) {
    private val root = File(ctx.filesDir, "web")
    private fun file(path: String) = File(root, path)
    private fun asset(path: String): String? = runCatching { ctx.assets.open(path).bufferedReader().use { it.readText() } }.getOrNull()

    fun cached(path: String): String? = file(path).takeIf { it.exists() }?.readText() ?: asset(path)
    fun isSaved(path: String) = file(path).exists()

    /** network first (and keep a copy); offline: the saved copy, then the bundled one */
    fun load(path: String): String? = when (val r = api.fetchText(path)) {
        is Net.Ok -> r.v.also { save(path, it) }
        else -> cached(path)
    }
    /** saved copy first (offline chapters); downloads when missing or when [fresh] */
    fun chapter(path: String, fresh: Boolean = false): String? {
        if (!fresh) file(path).takeIf { it.exists() }?.let { return it.readText() }
        return when (val r = api.fetchText(path)) { is Net.Ok -> r.v.also { save(path, it) }; else -> file(path).takeIf { it.exists() }?.readText() }
    }
    fun save(path: String, text: String) { runCatching { file(path).apply { parentFile?.mkdirs() }.writeText(text) } }
    fun remove(prefix: String) { File(root, prefix).deleteRecursively() }
    fun savedBytes(prefix: String): Long = File(root, prefix).walkTopDown().filter { it.isFile }.sumOf { it.length() }
}

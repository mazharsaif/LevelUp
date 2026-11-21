package de.com.levelup.app

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature

/**
 * The native app shows the SAME web app (levelrise.org: identical screens, icons, pop-ups) inside a WebView,
 * and adds what only native code can do through the `LevelUpNative` bridge. The web's service worker keeps it
 * working offline after the first start. Widgets, reminders and alarms plug in here later (see native/README.md);
 * their data comes from [WidgetStore], which the page fills via `LevelUpNative.setWidgetData(json)`.
 */
class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private val home: Uri by lazy { Uri.parse(BuildConfig.SERVER_URL) }
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingSave: String? = null

    private val pickFile = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        fileCallback?.onReceiveValue(uri?.let { arrayOf(it) } ?: emptyArray()); fileCallback = null
    }
    private val saveFile = registerForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        val text = pendingSave; pendingSave = null
        if (uri != null && text != null) runCatching {
            contentResolver.openOutputStream(uri)?.use { it.write(text.toByteArray()) }
            toast("Backup saved")
        }.onFailure { toast("Couldn't save the file") }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        web = WebView(this)
        setContentView(web)
        web.setBackgroundColor(0xFF04060C.toInt())
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false   // word audio plays as soon as a card shows, like in Chrome
            userAgentString = "$userAgentString LevelUpNative/${BuildConfig.VERSION_NAME}"
        }
        CookieManager.getInstance().apply { setAcceptCookie(true); setAcceptThirdPartyCookies(web, true) }
        web.addJavascriptInterface(Bridge(this), "LevelUpNative")
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            // WebView has no Web Share API: route the invite through Android's share sheet
            WebViewCompat.addDocumentStartJavaScript(web, """
                if (!navigator.share) navigator.share = d => { LevelUpNative.share([d && d.text, d && d.url].filter(Boolean).join("\n")); return Promise.resolve(); };
            """.trimIndent(), setOf(home.scheme + "://" + home.authority))
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                val u = req.url
                if (u.host == home.host && !u.path.orEmpty().startsWith("/download/")) return false
                openExternal(u.toString()); return true   // other sites and APK/PDF downloads open in the browser
            }
            override fun onReceivedError(view: WebView, req: WebResourceRequest, err: WebResourceError) {
                if (req.isForMainFrame) view.loadDataWithBaseURL(null, offlinePage(), "text/html", "utf-8", null)
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView, cb: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                fileCallback?.onReceiveValue(null); fileCallback = cb
                return runCatching { pickFile.launch("*/*"); true }.getOrElse { fileCallback = null; false }
            }
        }
        web.setDownloadListener { url, _, _, _, _ -> if (url.startsWith("http")) openExternal(url) }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            // the page manages its own history (closing sheets, "quit this lesson?", "swipe back again to close")
            override fun handleOnBackPressed() { if (web.canGoBack()) web.goBack() else finish() }
        })
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) load()
    }

    private fun load() = web.loadUrl(home.buildUpon().appendQueryParameter("src", "native").build().toString())

    override fun onSaveInstanceState(out: Bundle) { super.onSaveInstanceState(out); web.saveState(out) }
    override fun onPause() { super.onPause(); CookieManager.getInstance().flush() }

    fun openExternal(url: String) {
        try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        catch (_: ActivityNotFoundException) { toast("No app can open this link") }
    }
    fun share(text: String) {
        val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
        runCatching { startActivity(Intent.createChooser(send, "Invite friends")) }.onFailure { toast("No app to share with") }
    }
    fun save(name: String, text: String) { pendingSave = text; saveFile.launch(name) }
    fun retry() = load()
    fun toast(s: String) = Toast.makeText(this, s, Toast.LENGTH_SHORT).show()

    private fun offlinePage() = """
        <html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;background:#04060c;color:#dbeaff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;text-align:center;padding:24px;box-sizing:border-box">
        <h2 style="margin:0 0 8px">You're offline</h2><p style="color:#7f97b8;margin:0 0 20px">LevelUp needs the internet the first time it opens. After that it works offline.</p>
        <button onclick="LevelUpNative.retry()" style="background:#2f8cff;color:#fff;border:0;border-radius:12px;padding:12px 28px;font-size:16px;font-weight:700">Try again</button>
        </body></html>""".trimIndent()

    /** Methods the page can call as `window.LevelUpNative.<name>(…)`. Runs on a binder thread, so hop to the UI thread. */
    class Bridge(private val a: MainActivity) {
        @JavascriptInterface fun version(): String = BuildConfig.VERSION_NAME
        @JavascriptInterface fun share(text: String) = a.runOnUiThread { a.share(text) }
        @JavascriptInterface fun openExternal(url: String) = a.runOnUiThread { a.openExternal(url) }
        @JavascriptInterface fun saveFile(name: String, text: String) = a.runOnUiThread { a.save(name, text) }
        @JavascriptInterface fun retry() = a.runOnUiThread { a.retry() }
        /** Progress summary for future widgets / reminders (JSON, see core WidgetSnapshot). */
        @JavascriptInterface fun setWidgetData(json: String) = WidgetStore.save(a, json)
    }
}

/** Where widgets, reminders and alarms will read the latest progress summary from (SharedPreferences, works with the app closed). */
object WidgetStore {
    private fun prefs(c: Context) = c.getSharedPreferences("levelup.widget", Context.MODE_PRIVATE)
    fun save(c: Context, json: String) = prefs(c).edit().putString("snapshot", json).putLong("at", System.currentTimeMillis()).apply()
    fun load(c: Context): String? = prefs(c).getString("snapshot", null)
}

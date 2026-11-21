package de.com.levelup.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
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
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONArray
import org.json.JSONObject

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
    private var recognizer: SpeechRecognizer? = null
    private var recId: String? = null
    private var pendingListen: Triple<String, String, Int>? = null

    private val askMic = registerForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        val p = pendingListen; pendingListen = null
        if (p == null) return@registerForActivityResult
        if (ok) listen(p.first, p.second, p.third) else { speechEvent(p.first, "error", "\"app-denied\""); speechEvent(p.first, "end", "null") }
    }

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
                // WebView has no Web Speech recognition: give the page the same API, backed by Android's SpeechRecognizer
                if (!window.SpeechRecognition && !window.webkitSpeechRecognition && LevelUpNative.speechAvailable()) {
                  const live = {};
                  window.webkitSpeechRecognition = class {
                    constructor() { this.lang = "de-DE"; this.maxAlternatives = 5; this.interimResults = false; this._id = String(Math.random()).slice(2); }
                    start() { live[this._id] = this; LevelUpNative.speechStart(this._id, this.lang, this.maxAlternatives || 5); }
                    stop() { LevelUpNative.speechStop(this._id); }
                    abort() { LevelUpNative.speechAbort(this._id); }
                  };
                  window.__luSpeech = (id, type, data) => {
                    const r = live[id]; if (!r) return;
                    if (type === "result") r.onresult && r.onresult({ results: [data.map(t => ({ transcript: t, confidence: 0 }))] });
                    else if (type === "error") r.onerror && r.onerror({ error: data });
                    else if (type === "end") { delete live[id]; r.onend && r.onend(); }
                  };
                }
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

    // ---- 🎤 speech recognition for "Speak it" (events go back to the page as onresult / onerror / onend) ----
    fun speechStart(id: String, lang: String, max: Int) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) listen(id, lang, max)
        else { pendingListen = Triple(id, lang, max); askMic.launch(Manifest.permission.RECORD_AUDIO) }
    }
    private fun listen(id: String, lang: String, max: Int) {
        recId?.let { old -> recognizer?.cancel(); speechEvent(old, "end", "null") }
        val r = recognizer ?: SpeechRecognizer.createSpeechRecognizer(this).also { recognizer = it }
        recId = id
        r.setRecognitionListener(object : RecognitionListener {
            override fun onResults(b: Bundle?) {
                val list = b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
                if (list.isEmpty()) speechEvent(id, "error", "\"no-speech\"") else speechEvent(id, "result", JSONArray(list).toString())
                finishListen(id)
            }
            override fun onError(code: Int) {
                val e = when (code) {
                    SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "no-speech"
                    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "app-denied"
                    SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT, SpeechRecognizer.ERROR_SERVER -> "network"
                    SpeechRecognizer.ERROR_AUDIO -> "audio-capture"
                    SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED, SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE -> "language-not-supported"
                    else -> "aborted"
                }
                speechEvent(id, "error", JSONObject.quote(e)); finishListen(id)
            }
            override fun onReadyForSpeech(p: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(v: Float) {}
            override fun onBufferReceived(b: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onPartialResults(b: Bundle?) {}
            override fun onEvent(t: Int, b: Bundle?) {}
        })
        r.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang)
            .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, max.coerceIn(1, 10))
            .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false))
    }
    private fun finishListen(id: String) { if (recId == id) recId = null; speechEvent(id, "end", "null") }
    fun speechStop(id: String) { if (recId == id) recognizer?.stopListening() }
    fun speechAbort(id: String) { if (recId == id) { recognizer?.cancel(); finishListen(id) } }
    private fun speechEvent(id: String, type: String, json: String) =
        web.evaluateJavascript("window.__luSpeech && __luSpeech(${JSONObject.quote(id)}, \"$type\", $json)", null)

    override fun onDestroy() { recognizer?.destroy(); recognizer = null; super.onDestroy() }

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
        @JavascriptInterface fun speechAvailable(): Boolean = SpeechRecognizer.isRecognitionAvailable(a)
        @JavascriptInterface fun speechStart(id: String, lang: String, max: Int) = a.runOnUiThread { a.speechStart(id, lang, max) }
        @JavascriptInterface fun speechStop(id: String) = a.runOnUiThread { a.speechStop(id) }
        @JavascriptInterface fun speechAbort(id: String) = a.runOnUiThread { a.speechAbort(id) }
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

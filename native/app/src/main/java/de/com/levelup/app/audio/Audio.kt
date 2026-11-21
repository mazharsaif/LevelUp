package de.com.levelup.app.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.ToneGenerator
import android.speech.tts.TextToSpeech
import de.com.levelup.core.sync.ApiClient
import de.com.levelup.core.sync.Net
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.Locale
import java.util.concurrent.atomic.AtomicInteger

/**
 * Port of app/js/audio.js: the neural-voice clips (server path audio/<id>.mp3, the id is in the content files),
 * downloaded on first use and kept on the phone; the phone's speech engine (TTS) in the course language when a
 * clip is missing or offline. Every play() gets a token, so a clip that arrives late never plays over a newer one.
 */
class AudioPlayer(private val ctx: Context, private val api: ApiClient, private val scope: CoroutineScope) {
    private val dir = File(ctx.filesDir, "audio").apply { mkdirs() }
    private var player: MediaPlayer? = null
    private val token = AtomicInteger(0)
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    var enabled: () -> Boolean = { true }
    var langTag: String = "de-DE"
        set(v) { field = v; if (ttsReady) tts?.language = Locale.forLanguageTag(v) }

    private fun ensureTts() {
        if (tts != null) return
        tts = TextToSpeech(ctx) { st -> ttsReady = st == TextToSpeech.SUCCESS; if (ttsReady) { tts?.language = Locale.forLanguageTag(langTag); tts?.setSpeechRate(0.9f) } }
    }
    private fun speak(text: String?) {
        if (text.isNullOrBlank()) return
        ensureTts()
        if (ttsReady) tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "lu") else scope.launch { delay(600); if (ttsReady) tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "lu") }
    }
    fun clip(aid: String) = File(dir, "$aid.mp3")

    fun play(aid: String?, fallback: String?) {
        if (!enabled()) return
        val my = token.incrementAndGet()
        tts?.stop(); player?.runCatching { stop(); release() }; player = null
        if (aid.isNullOrEmpty()) { speak(fallback); return }
        scope.launch {
            val f = clip(aid)
            val ok = f.exists() || withContext(Dispatchers.IO) { download(aid) }
            if (my != token.get()) return@launch
            if (!ok) { speak(fallback); return@launch }
            runCatching {
                player = MediaPlayer().apply {
                    setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                    setDataSource(f.absolutePath)
                    setOnErrorListener { _, _, _ -> if (my == token.get()) speak(fallback); true }
                    setOnCompletionListener { it.release(); if (player === it) player = null }
                    prepare(); start()
                }
            }.onFailure { f.delete(); if (my == token.get()) speak(fallback) }
        }
    }
    /** play clips one after another with natural pauses (stories); stops when anything else plays */
    fun playSeq(aids: List<String>, pauses: List<Long>, onLine: (Int) -> Unit, onDone: () -> Unit) {
        if (!enabled()) { onDone(); return }
        stop(); val my = token.get()
        scope.launch {
            for ((k, aid) in aids.withIndex()) {
                if (my != token.get()) return@launch
                onLine(k)
                val f = clip(aid)
                if (!f.exists() && !withContext(Dispatchers.IO) { download(aid) }) continue
                val done = kotlinx.coroutines.CompletableDeferred<Unit>()
                runCatching { player = MediaPlayer().apply { setDataSource(f.absolutePath); setOnCompletionListener { it.release(); done.complete(Unit) }; setOnErrorListener { _, _, _ -> done.complete(Unit); true }; prepare(); start() } }
                    .onFailure { done.complete(Unit) }
                done.await()
                if (my != token.get()) return@launch
                delay(pauses.getOrElse(k) { 0L })
            }
            if (my == token.get()) onDone()
        }
    }
    /** play after a short delay unless the learner has moved on */
    fun playSoon(aid: String?, fallback: String?, ms: Long = 250) { val my = token.get(); scope.launch { delay(ms); if (my == token.get()) play(aid, fallback) } }
    fun stop() { token.incrementAndGet(); tts?.stop(); player?.runCatching { stop(); release() }; player = null }

    private fun download(aid: String): Boolean = when (val r = api.fetchBytes("audio/$aid.mp3")) {
        is Net.Ok -> runCatching { val tmp = File(dir, "$aid.part"); tmp.writeBytes(r.v); tmp.renameTo(clip(aid)) }.getOrDefault(false)
        else -> false
    }
    /** Settings › Offline: save every clip of the course (6 at a time). Returns (saved, failed). */
    suspend fun downloadAll(ids: Set<String>, progress: (Int, Int, Int) -> Unit): Pair<Int, Int> = withContext(Dispatchers.IO) {
        val list = ids.filter { !clip(it).exists() }.toMutableList(); val done = AtomicInteger(ids.size - list.size); val fail = AtomicInteger(0)
        (0 until 6).map {
            async {
                while (true) {
                    val id = synchronized(list) { list.removeLastOrNull() } ?: break
                    if (!download(id)) fail.incrementAndGet()
                    val d = done.incrementAndGet(); if (d % 25 == 0) withContext(Dispatchers.Main) { progress(d, ids.size, fail.get()) }
                }
            }
        }.awaitAll()
        (ids.size - fail.get()) to fail.get()
    }
    fun savedCount(ids: Set<String>) = ids.count { clip(it).exists() }

    private val tones by lazy { runCatching { ToneGenerator(AudioManager.STREAM_MUSIC, 35) }.getOrNull() }
    /** little right / wrong sounds */
    fun blip(ok: Boolean) { if (enabled()) tones?.startTone(if (ok) ToneGenerator.TONE_PROP_ACK else ToneGenerator.TONE_PROP_NACK, 160) }

}

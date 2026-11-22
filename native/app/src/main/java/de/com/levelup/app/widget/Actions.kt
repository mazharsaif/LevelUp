package de.com.levelup.app.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import androidx.glance.GlanceId
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.updateAll
import de.com.levelup.app.BuildConfig
import de.com.levelup.app.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

/** Tap targets: open the app on a web route (`#/today`, `#/go/next`, `#/go/review`, `#/go/word/<id>`, `#/ranks`, `#/progress`). */
object Go {
    fun intent(c: Context, route: String): Intent = Intent(c, MainActivity::class.java)
        .setAction(Intent.ACTION_VIEW).setData(Uri.parse("levelup://open/$route"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    fun open(c: Context, route: String) = actionStartActivity(intent(c, route))
    val today = "today"; val next = "go/next"; val review = "go/review"; val ranks = "ranks"; val progress = "progress"; val home = "home"
    fun word(id: String?) = if (id == null) "words" else "go/word/$id"
}

val AudioKey = ActionParameters.Key<String>("audio")
fun playAudio(id: String?) = actionRunCallback<PlayAudio>(actionParametersOf(AudioKey to (id ?: "")))

/** plays a word's clip without opening the app (streams it from the server; the WebView's offline cache isn't reachable here) */
class PlayAudio : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val id = parameters[AudioKey].orEmpty(); if (id.isBlank()) return
        runCatching {
            player?.release()
            player = MediaPlayer().apply {
                setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                setDataSource("${BuildConfig.SERVER_URL}/audio/$id.mp3")
                setOnPreparedListener { it.start() }
                setOnCompletionListener { it.release(); if (player === it) player = null }
                prepareAsync()
            }
        }
    }
    companion object { @Volatile private var player: MediaPlayer? = null }
}

/** Word of the day "Next ›": another word for today (kept until midnight) */
class NextWord : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val p = context.getSharedPreferences("levelup.widget", Context.MODE_PRIVATE)
        val today = LocalDate.now().toString()
        val n = if (p.getString("wotdDay", "") == today) p.getInt("wotdOffset", 0) + 1 else 1
        p.edit().putString("wotdDay", today).putInt("wotdOffset", n).apply()
        WordWidget().updateAll(context)
    }
    companion object {
        fun offset(c: Context): Int = c.getSharedPreferences("levelup.widget", Context.MODE_PRIVATE).let {
            if (it.getString("wotdDay", "") == LocalDate.now().toString()) it.getInt("wotdOffset", 0) else 0 }
    }
}

object Widgets {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    /** redraw every LevelUp widget (after a new snapshot, at midnight, at the 20:00 streak-at-risk switch) */
    fun refresh(c: Context) {
        val app = c.applicationContext
        scope.launch {
            listOf(QuestWidget(), RankWidget(), ContinueWidget(), ReviewWidget(), StreakWidget(), WordWidget(), GlanceStripWidget(), RingWidget(), ActionsWidget())
                .forEach { runCatching { it.updateAll(app) } }
        }
        schedule(app)
    }

    /** two inexact alarms: just after midnight (new day: counters reset) and 20:00 (streak at risk). No exact-alarm permission needed. */
    fun schedule(c: Context) {
        val am = c.getSystemService(AlarmManager::class.java) ?: return
        val now = LocalDateTime.now()
        val evening = now.toLocalDate().atTime(LocalTime.of(20, 0)).let { if (it.isAfter(now)) it else it.plusDays(1) }
        val midnight = now.toLocalDate().plusDays(1).atTime(0, 1)
        val at = minOf(evening, midnight).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        val pi = PendingIntent.getBroadcast(c, 7, Intent(c, TickReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        am.setWindow(AlarmManager.RTC, at, 10 * 60 * 1000L, pi)
    }
}

class TickReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) = Widgets.refresh(context)
}

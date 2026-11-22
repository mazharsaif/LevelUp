package de.com.levelup.app.widget

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.LinearProgressIndicator
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.text.TextAlign
import androidx.glance.unit.ColorProvider
import de.com.levelup.app.MainActivity
import de.com.levelup.app.R
import de.com.levelup.app.WidgetStore
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

/**
 * Hunter's Path (personal quests) on the home screen: today's quests with a tick button for daily and "still clean"
 * quests. A tick is saved here at once (the widget shows ✓) and queued; the web app applies the queue the next time
 * Hunter's Path opens (LevelUpNative.takeLifeTicks). Data: the life snapshot (lifeSnapshot() in app.js).
 */
object LifeStore {
    private fun p(c: Context) = c.getSharedPreferences("levelup.widget", Context.MODE_PRIVATE)
    fun snap(c: Context): JSONObject? = runCatching { JSONObject(WidgetStore.loadLife(c) ?: return null) }.getOrNull()
    fun tick(c: Context, id: String) {
        val day = LocalDate.now().toString()
        val q = runCatching { JSONArray(p(c).getString("lifeTicks", "[]")) }.getOrDefault(JSONArray())
        q.put(JSONObject().put("id", id).put("d", day))
        p(c).edit().putString("lifeTicks", q.toString()).apply()
        // show it as done right away
        snap(c)?.let { s ->
            val life = s.optJSONObject("life") ?: return@let
            val items = life.optJSONArray("items") ?: return@let
            for (k in 0 until items.length()) items.optJSONObject(k)?.let { if (it.optString("id") == id) it.put("done", true) }
            life.put("open", (0 until items.length()).count { items.optJSONObject(it)?.optBoolean("done") == false })
            WidgetStore.saveLife(c, s.toString())
        }
    }
    fun takeTicks(c: Context): String { val s = p(c).getString("lifeTicks", "[]") ?: "[]"; p(c).edit().remove("lifeTicks").apply(); return s }
}

val TickId = ActionParameters.Key<String>("tick")
class TickLife : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val id = parameters[TickId] ?: return
        LifeStore.tick(context, id)
        Widgets.bump(context, LifeWidget())
    }
}

class LifeWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Responsive(ALL_SIZES)
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        provideContent {
            androidx.glance.currentState(VER)   // see LuWidget: fresh data on every redraw
            val s = LifeStore.snap(context); val look = Look.of(context, s?.optString("theme") ?: "sl")
            Body(context, s, look)
        }
    }
    @Composable private fun Body(ctx: Context, s: JSONObject?, look: Look) {
        val life = s?.optJSONObject("life"); val b = bucket(); val open = Go.open(ctx, "go/life")
        if (s == null || life == null) return Frame(look, open) {
            Box(GlanceModifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                T(if (b == B.TINY) "⚔️" else "Open Hunter's Path in LevelUp to see your quests here", look, 12.sp, bold = true, align = TextAlign.Center, lines = 3)
            }
        }
        val items = life.optJSONArray("items") ?: JSONArray()
        val stale = s.optString("day") != LocalDate.now().toString()   // a new day: nothing is done yet
        val list = (0 until items.length()).mapNotNull { items.optJSONObject(it) }
        val openN = if (stale) list.size else list.count { !it.optBoolean("done") }
        val lv = life.optInt("level", 1); val rk = life.optString("rank", "E")
        Frame(look, open, if (openN > 0 && LocalTime.now() >= LocalTime.of(20, 0) && list.isNotEmpty()) "red" else "", pad = if (b == B.TINY) 6 else 12) {
            when (b) {
                B.TINY -> Column(GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically, horizontalAlignment = Alignment.CenterHorizontally) {
                    T(if (openN == 0 && list.isNotEmpty()) "✓" else "⚔️", look, 18.sp, if (openN == 0) look.goodC else look.textC, align = TextAlign.Center)
                    T(if (list.isEmpty()) "—" else "$openN left", look, 11.sp, bold = true, align = TextAlign.Center)
                }
                B.SMALL, B.WIDE -> Row(GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                    Column(GlanceModifier.defaultWeight()) {
                        T(look.label("Hunter's Path · Lv $lv"), look, 10.sp, look.mutedC, bold = true, display = true)
                        T(when { list.isEmpty() -> "No gates open"; openN == 0 -> "All quests done ✓"; else -> "$openN quest${if (openN > 1) "s" else ""} left today" }, look, 15.sp,
                            if (openN == 0 && list.isNotEmpty()) look.goodC else look.textC, bold = true, display = true)
                        if (b == B.WIDE && list.isNotEmpty()) T(list.take(4).joinToString("  ") { (if (!stale && it.optBoolean("done")) "✓" else "") + it.optString("icon") }, look, 13.sp, look.mutedC)
                    }
                    T("🔥${life.optInt("streak")}", look, 16.sp, bold = true, display = true)
                }
                else -> {
                    Header(look, "Hunter's Path · $rk · Lv $lv", "🛡${life.optInt("shields")} 🔥${life.optInt("streak")}")
                    Gap(4)
                    LinearProgressIndicator(life.optDouble("frac", 0.0).toFloat(), GlanceModifier.fillMaxWidth().height(4.dp), look.accentC, ColorProvider(Color(look.track)))
                    Gap(6)
                    if (list.isEmpty()) Box(GlanceModifier.defaultWeight().fillMaxWidth(), contentAlignment = Alignment.Center) { T("No gates open. Tap to pick one.", look, 12.sp, look.mutedC, align = TextAlign.Center) }
                    else Column(GlanceModifier.defaultWeight().fillMaxWidth()) {
                        val max = when (b) { B.SQUARE -> 3; B.BIG -> 4; else -> 8 }
                        list.take(max).forEach { Item(ctx, look, it, stale, b == B.SQUARE) }
                        if (list.size > max) T("+${list.size - max} more", look, 10.sp, look.mutedC)
                    }
                    T(if (openN == 0 && list.isNotEmpty()) "All of today's quests are done ✓" else "$openN left · tap ✓ to check in", look, 10.sp, if (openN == 0) look.goodC else look.mutedC)
                }
            }
        }
    }
    @Composable private fun Item(ctx: Context, look: Look, it: JSONObject, stale: Boolean, compact: Boolean) {
        val done = !stale && it.optBoolean("done"); val tickable = it.optBoolean("tickable") && !it.optBoolean("slip")
        Row(GlanceModifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
            T(it.optString("icon"), look, 16.sp); HGap(6)
            Column(GlanceModifier.defaultWeight()) {
                T(it.optString("title"), look, 12.sp, if (done) look.mutedC else look.textC, bold = true)
                if (!compact) T((if (it.optBoolean("cracked")) "⚠ " else "") + it.optString("line"), look, 10.sp, look.mutedC)
            }
            when {
                done -> T("✓", look, 16.sp, look.goodC, bold = true)
                tickable -> Box(GlanceModifier.size(30.dp).background(look.accentC).cornerRadius(9.dp)
                    .clickable(actionRunCallback<TickLife>(actionParametersOf(TickId to it.optString("id")))), contentAlignment = Alignment.Center) {
                    T("✓", look, 14.sp, look.onAccentC, bold = true, align = TextAlign.Center)
                }
                else -> T("›", look, 16.sp, look.mutedC)
            }
        }
    }
}
class LifeReceiver : GlanceAppWidgetReceiver() { override val glanceAppWidget: GlanceAppWidget = LifeWidget() }

/** Daily reminder (set on the Hunter page): at the chosen time, a notification if some of today's quests are open. */
object Reminders {
    private fun p(c: Context) = c.getSharedPreferences("levelup.widget", Context.MODE_PRIVATE)
    fun set(c: Context, hhmm: String) { p(c).edit().putString("lifeRem", hhmm).apply(); schedule(c) }
    fun schedule(c: Context) {
        val am = c.getSystemService(AlarmManager::class.java) ?: return
        val pi = PendingIntent.getBroadcast(c, 9, Intent(c, ReminderReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val at = p(c).getString("lifeRem", "") ?: ""
        if (at.isBlank()) { am.cancel(pi); return }
        val (h, m) = at.split(":").map { it.toInt() }
        val now = LocalDateTime.now()
        val next = now.toLocalDate().atTime(h, m).let { if (it.isAfter(now)) it else it.plusDays(1) }
        am.setWindow(AlarmManager.RTC_WAKEUP, next.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli(), 10 * 60 * 1000L, pi)
    }
    fun fire(c: Context) {
        schedule(c)   // tomorrow
        val life = LifeStore.snap(c) ?: return
        val today = LocalDate.now().toString()
        val items = life.optJSONObject("life")?.optJSONArray("items") ?: return
        val open = (0 until items.length()).mapNotNull { items.optJSONObject(it) }.filter { life.optString("day") != today || !it.optBoolean("done") }
        if (open.isEmpty()) return
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val nm = c.getSystemService(NotificationManager::class.java) ?: return
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel("quests", "Daily quests", NotificationManager.IMPORTANCE_DEFAULT))
        val tap = PendingIntent.getActivity(c, 10, Go.intent(c, "go/life"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = NotificationCompat.Builder(c, "quests").setSmallIcon(R.drawable.ic_notify)
            .setContentTitle("⚔️ ${open.size} quest${if (open.size > 1) "s" else ""} left today")
            .setContentText(open.take(3).joinToString(" · ") { "${it.optString("icon")} ${it.optString("title")}" })
            .setContentIntent(tap).setAutoCancel(true).build()
        nm.notify(77, n)
    }
}
class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) { Reminders.schedule(context); Widgets.schedule(context); return }
        Reminders.fire(context)
    }
}

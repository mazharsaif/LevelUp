package de.com.levelup.app.widget

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.webkit.CookieManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import de.com.levelup.app.BuildConfig
import de.com.levelup.app.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/**
 * Party-gate nudges while the app is closed: every ~15 minutes (Android's minimum), ask the server for nudges sent to
 * you (GET /api/nudges, with the app's login cookie) and show a notification for each new one. Tapping it opens
 * Hunter's Path. The page marks nudges as seen when you open it.
 */
class NudgeWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        runCatching { check(applicationContext) }
        Result.success()
    }

    companion object {
        fun schedule(c: Context) {
            val req = PeriodicWorkRequestBuilder<NudgeWorker>(15, TimeUnit.MINUTES)
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
            WorkManager.getInstance(c).enqueueUniquePeriodicWork("nudges", ExistingPeriodicWorkPolicy.KEEP, req)
        }

        private fun check(c: Context) {
            if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
            val cookie = runCatching { CookieManager.getInstance().getCookie(BuildConfig.SERVER_URL) }.getOrNull() ?: return
            val con = (URL("${BuildConfig.SERVER_URL}/api/nudges").openConnection() as HttpURLConnection).apply {
                connectTimeout = 10000; readTimeout = 10000; setRequestProperty("Cookie", cookie); setRequestProperty("Accept", "application/json")
            }
            if (con.responseCode != 200) return
            val list = JSONObject(con.inputStream.bufferedReader().readText()).optJSONArray("nudges") ?: return
            val p = c.getSharedPreferences("levelup.widget", Context.MODE_PRIVATE)
            val told = (p.getString("nudgesTold", "") ?: "").split(",").filter { it.isNotBlank() }.toMutableList()
            val nm = c.getSystemService(NotificationManager::class.java) ?: return
            if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel("nudges", "Party nudges", NotificationManager.IMPORTANCE_HIGH))
            for (k in 0 until list.length()) {
                val n = list.optJSONObject(k) ?: continue
                val id = n.optString("id"); if (id.isBlank() || id in told) continue
                val tap = PendingIntent.getActivity(c, 20 + k, Go.intent(c, "go/life"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
                nm.notify(id.hashCode(), NotificationCompat.Builder(c, "nudges").setSmallIcon(R.drawable.ic_notify)
                    .setContentTitle("🔔 ${n.optString("fromName", "Your party")} nudged you")
                    .setContentText("Check in on ${n.optString("icon")} ${n.optString("title")} today. The whole team must survive!")
                    .setContentIntent(tap).setAutoCancel(true).build())
                told += id
            }
            p.edit().putString("nudgesTold", told.takeLast(100).joinToString(",")).apply()
        }
    }
}

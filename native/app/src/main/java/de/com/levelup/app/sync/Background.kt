package de.com.levelup.app.sync

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import de.com.levelup.app.LevelUpApp
import de.com.levelup.core.WidgetSnapshot
import de.com.levelup.core.sync.PutResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.util.concurrent.TimeUnit

/**
 * Uploads progress that was saved while offline (the web app retries on the next save; here WorkManager retries
 * as soon as there is a network, even with the app closed). Later reminders / widgets can hang off the same
 * periodic job (see native/README.md).
 */
class SyncWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        val app = LevelUpApp.graph(applicationContext)
        return when (app.sync.pushPending()) {
            null, PutResult.Saved, is PutResult.Conflict -> Result.success()
            PutResult.AuthLost -> Result.success()   // needs a new login: the app shows the login screen next time
            PutResult.Offline, is PutResult.Failed -> Result.retry()
        }
    }

    companion object {
        private const val ONE = "levelup-sync-pending"
        private const val PERIODIC = "levelup-sync-periodic"
        private val net = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
        fun schedule(ctx: Context) = runCatching {
            WorkManager.getInstance(ctx).enqueueUniqueWork(ONE, ExistingWorkPolicy.REPLACE,
                OneTimeWorkRequestBuilder<SyncWorker>().setConstraints(net).setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS).build())
        }
        fun schedulePeriodic(ctx: Context) = runCatching {
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<SyncWorker>(6, TimeUnit.HOURS).setConstraints(net).build())
        }
    }
}

/**
 * The one place widgets, reminders and alarms read from. Written by the app after every save / course switch;
 * readable without loading any course (SharedPreferences "levelup.widget", key "snapshot", JSON of [WidgetSnapshot]).
 */
class WidgetSnapshotRepository(ctx: Context) {
    private val prefs = ctx.getSharedPreferences("levelup.widget", Context.MODE_PRIVATE)
    private val flow = MutableStateFlow(load())
    val snapshot: StateFlow<WidgetSnapshot?> get() = flow
    fun load(): WidgetSnapshot? = prefs.getString("snapshot", null)?.let { WidgetSnapshot.fromJson(it) }
    fun save(s: WidgetSnapshot?) {
        prefs.edit().apply { if (s == null) remove("snapshot") else putString("snapshot", s.toJson()) }.apply()
        flow.value = s
        listeners.forEach { it(s) }
    }
    /** widgets / reminder schedulers register here (e.g. to call AppWidgetManager.updateAppWidget) */
    val listeners = mutableListOf<(WidgetSnapshot?) -> Unit>()
}

package de.com.levelup.app

import android.app.Activity
import android.appwidget.AppWidgetHost
import android.appwidget.AppWidgetManager
import android.os.Bundle
import android.util.Base64
import android.util.SizeF
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import de.com.levelup.app.widget.Widgets

/**
 * DEBUG ONLY (not in release builds): hosts every LevelUp widget at the launcher sizes so they can be screenshotted
 * on an emulator without a launcher. Needs `adb shell appwidget grantbind --package de.com.levelup.app.dev`.
 *   adb shell am start -n de.com.levelup.app.dev/de.com.levelup.app.WidgetGallery --es snap <base64 json> --es only quest
 */
class WidgetGallery : Activity() {
    private lateinit var host: AppWidgetHost
    override fun onCreate(b: Bundle?) {
        super.onCreate(b)
        intent.getStringExtra("snap")?.let { val j = String(Base64.decode(it, Base64.DEFAULT)); if (j.contains("\"courseType\":\"life\"")) WidgetStore.saveLife(this, j) else WidgetStore.save(this, j) }
        val only = intent.getStringExtra("only")
        val sizes = (intent.getStringExtra("sizes") ?: "57x57,130x57,250x57,130x160,250x160,250x330").split(",").map { it.split("x").let { (w, h) -> w.toInt() to h.toInt() } }
        val mgr = AppWidgetManager.getInstance(this)
        host = AppWidgetHost(this, 4242).also { it.deleteHost(); it.startListening() }
        val d = resources.displayMetrics.density
        val col = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(24, 24, 24, 24); setBackgroundColor(0xFF5A6A8A.toInt()) }
        val providers = mgr.getInstalledProvidersForPackage(packageName, null).filter { only == null || it.provider.className.lowercase().contains(only) }
        for (p in providers) {
            col.addView(TextView(this).apply { text = p.provider.shortClassName; setTextColor(-1) })
            val row = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
            for ((w, h) in sizes) {
                val id = host.allocateAppWidgetId()
                if (!mgr.bindAppWidgetIdIfAllowed(id, p.provider)) { col.addView(TextView(this).apply { text = "bind not allowed"; setTextColor(-1) }); continue }
                mgr.updateAppWidgetOptions(id, Bundle().apply {
                    putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, w); putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, w)
                    putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, h); putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, h)
                    putParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES, arrayListOf(SizeF(w.toFloat(), h.toFloat())))
                })
                val v = host.createView(this, id, p)
                row.addView(v, LinearLayout.LayoutParams(((w + 16) * d).toInt(), ((h + 16) * d).toInt()).apply { setMargins(0, 8, 0, 16) })
            }
            col.addView(row)
        }
        setContentView(ScrollView(this).apply { addView(col, ViewGroup.LayoutParams(-1, -2)) })
        Widgets.refresh(this)
    }
    // a new snapshot while the gallery is open: like the app's bridge, store it and refresh (tests live sessions)
    override fun onNewIntent(i: android.content.Intent) {
        super.onNewIntent(i)
        i.getStringExtra("snap")?.let { val j = String(Base64.decode(it, Base64.DEFAULT)); if (j.contains("\"courseType\":\"life\"")) WidgetStore.saveLife(this, j) else WidgetStore.save(this, j); Widgets.refresh(this) }
    }
    override fun onDestroy() { host.stopListening(); super.onDestroy() }
}

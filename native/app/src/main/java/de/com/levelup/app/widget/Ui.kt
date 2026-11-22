package de.com.levelup.app.widget

import android.os.Build
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ColumnScope
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontFamily
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import de.com.levelup.app.R

// launcher size buckets (docs/design/widgets/README.md: 1×1 … 4×4)
val S11 = DpSize(57.dp, 57.dp); val S21 = DpSize(130.dp, 57.dp); val S41 = DpSize(250.dp, 57.dp)
val S22 = DpSize(130.dp, 160.dp); val S42 = DpSize(250.dp, 160.dp); val S44 = DpSize(250.dp, 330.dp)
val ALL_SIZES = setOf(S11, S21, S41, S22, S42, S44)

enum class B { TINY, SMALL, WIDE, SQUARE, BIG, XL }
@Composable fun bucket(): B {
    val s = LocalSize.current
    return when {
        s.height >= 330.dp && s.width >= 250.dp -> B.XL
        s.height >= 160.dp && s.width >= 250.dp -> B.BIG
        s.height >= 160.dp -> B.SQUARE
        s.width >= 250.dp -> B.WIDE
        s.width >= 130.dp -> B.SMALL
        else -> B.TINY
    }
}

/** widget surface: the look's background (Hunter outline turns red when the streak is at risk, gold on a rank-up) */
@Composable fun Frame(look: Look, onClick: Action?, tone: String = "", pad: Int = 12, clear: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    var m = GlanceModifier.fillMaxSize().appWidgetBackground()
    m = when {
        clear -> m.background(ImageProvider(R.drawable.wbg_clear))
        look.id == "you" && Build.VERSION.SDK_INT >= 31 -> m.background(ColorProvider(androidx.compose.ui.graphics.Color(look.bg))).cornerRadius(22.dp)
        look.id == "sl" && tone == "red" -> m.background(ImageProvider(R.drawable.wbg_hunter_red))
        look.id == "sl" && tone == "gold" -> m.background(ImageProvider(R.drawable.wbg_hunter_gold))
        look.id == "sl" && tone == "green" -> m.background(ImageProvider(R.drawable.wbg_hunter_green))
        else -> m.background(ImageProvider(look.bgRes))
    }
    if (onClick != null) m = m.clickable(onClick)
    // one-row widgets are short (57–100 dp): less padding so two lines of text fit
    val p = if (LocalSize.current.height < 100.dp) minOf(pad, 6) else pad
    Column(modifier = m.padding(horizontal = pad.dp, vertical = p.dp), content = content)
}

@Composable fun T(text: String, look: Look, size: TextUnit = 13.sp, color: ColorProvider = look.textC, bold: Boolean = false,
                  display: Boolean = false, align: TextAlign = TextAlign.Start, lines: Int = 1, modifier: GlanceModifier = GlanceModifier) =
    Text(text, modifier = modifier, maxLines = lines, style = TextStyle(color = color, fontSize = size,
        fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal, fontFamily = if (display) look.display else look.body, textAlign = align))

/** small caps header: "DAILY QUEST · GERMAN A1" with an optional right-hand chip */
@Composable fun Header(look: Look, label: String, right: String? = null, rightColor: ColorProvider? = null) {
    Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        T(look.label(label), look, 11.sp, look.mutedC, bold = true, display = true, modifier = GlanceModifier.defaultWeight())
        if (right != null) T(right, look, 12.sp, rightColor ?: look.textC, bold = true, display = true)
    }
}

@Composable fun Pill(text: String, look: Look, color: ColorProvider = look.textC, bg: ColorProvider = look.surfaceC, size: TextUnit = 12.sp, onClick: Action? = null) {
    var m = GlanceModifier.background(bg).cornerRadius(10.dp).padding(horizontal = 8.dp, vertical = 4.dp)
    if (onClick != null) m = m.clickable(onClick)
    Box(modifier = m) { T(text, look, size, color, bold = true) }
}

/** filled action button ("▶ Continue", red "Save streak") */
@Composable fun Btn(text: String, look: Look, onClick: Action, bg: Int = look.accent, fg: Int = look.onAccent, full: Boolean = false, size: TextUnit = 13.sp) {
    var m = GlanceModifier.background(ColorProvider(androidx.compose.ui.graphics.Color(bg))).cornerRadius(12.dp).padding(horizontal = 14.dp, vertical = 8.dp).clickable(onClick)
    if (full) m = m.fillMaxWidth()
    Box(modifier = m, contentAlignment = Alignment.Center) {
        T(look.label(text), look, size, ColorProvider(androidx.compose.ui.graphics.Color(fg)), bold = true, display = true, align = TextAlign.Center)
    }
}

/** part segments: done / current / to do */
@Composable fun Segments(look: Look, done: Int, total: Int, cur: Int = done, color: Int = look.accent) {
    Row(modifier = GlanceModifier.fillMaxWidth().height(6.dp)) {
        for (k in 0 until total.coerceIn(1, 8)) {
            val c = when { k < done -> color; k == cur -> blend(color, look.track, 0.55f); else -> look.track }
            Box(modifier = GlanceModifier.defaultWeight().height(6.dp).background(ColorProvider(androidx.compose.ui.graphics.Color(c))).cornerRadius(3.dp)) {}
            if (k < total - 1) Spacer(GlanceModifier.width(4.dp))
        }
    }
}

@Composable fun Gap(h: Int) = Spacer(GlanceModifier.height(h.dp))
@Composable fun HGap(w: Int) = Spacer(GlanceModifier.width(w.dp))

fun blend(a: Int, b: Int, t: Float): Int {
    fun ch(x: Int, s: Int) = (x shr s) and 0xFF
    fun mix(s: Int) = (ch(a, s) * (1 - t) + ch(b, s) * t).toInt() and 0xFF
    return (0xFF shl 24) or (mix(16) shl 16) or (mix(8) shl 8) or mix(0)
}

/** shown by every data widget when nobody is logged in on this phone */
@Composable fun SignedOut(look: Look, ctx: android.content.Context) {
    Frame(look, Go.open(ctx, Go.today)) {
        val b = bucket()
        Column(modifier = GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically, horizontalAlignment = Alignment.CenterHorizontally) {
            T("🔒", look, if (b == B.TINY) 18.sp else 24.sp, align = TextAlign.Center)
            if (b != B.TINY) { T("Sign in to LevelUp", look, 13.sp, bold = true, align = TextAlign.Center)
                if (b != B.SMALL && b != B.WIDE) { Gap(8); Btn("Open LevelUp", look, Go.open(ctx, Go.today)) } }
        }
    }
}

/** stale badge: "⊘ 3 h ago" (tapping the widget opens the app, which sends fresh data) */
@Composable fun StaleBadge(s: Snap, look: Look) { if (s.stale) T("⊘ ${s.ageText}", look, 10.sp, look.mutedC) }

package de.com.levelup.app.ui

import android.annotation.SuppressLint
import android.webkit.WebView
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import de.com.levelup.core.Hero
import kotlin.math.sin

/** The themes of app/styles.css: Hunter System (default), Hunter Mid, Hunter Simple, Calm, Eurozeit, Classic. */
data class Palette(
    val id: String, val dark: Boolean, val hunter: Int, // 0 = not a Hunter theme, 1 = Hunter, 2 = Mid, 3 = Simple
    val bg: Color, val card: Color, val ink: Color, val muted: Color, val line: Color,
    val primary: Color, val blue: Color, val red: Color, val amber: Color, val ok: Color, val violet: Color,
    val kv: Color, val kg: Color, val kp: Color, val m: Color, val f: Color, val n: Color, val pl: Color,
    val aura: Float = 0f,
) {
    /** Hunter themes turn purple as the aura grows */
    val accent: Color get() = if (hunter > 0) lerp(Color(0xFF2F8CFF), Color(0xFFA066FF), aura) else primary
    val corner: Dp get() = when (hunter) { 1 -> 3.dp; 2 -> 8.dp; 3 -> 12.dp; else -> 16.dp }
    val glow: Boolean get() = hunter == 1 || hunter == 2
    val upper: Boolean get() = hunter == 1 || hunter == 2
}

val THEMES = listOf("system" to "⚔️ Hunter System", "system3" to "🛡️ Hunter Mid", "system2" to "🗡️ Hunter Simple", "calm" to "🌿 Calm", "ez" to "🎓 Eurozeit", "classic" to "🟢 Classic")

private val hunterBase = Palette("system", true, 1, Color(0xFF04060C), Color(0xC70A1428), Color(0xFFDBEAFF), Color(0xFF7F97B8), Color(0x4750A0FF),
    Color(0xFF2F8CFF), Color(0xFF2F8CFF), Color(0xFFFF4D6D), Color(0xFFFFCC4D), Color(0xFF57E3A0), Color(0xFF8A5CFF),
    Color(0xFF5AA9FF), Color(0xFFB39BFF), Color(0xFF57E3A0), Color(0xFF5AA9FF), Color(0xFFFF6B8A), Color(0xFF57E3A0), Color(0xFFB48CFF))

fun palette(id: String, systemDark: Boolean, aura: Double): Palette = when (id) {
    "system2" -> hunterBase.copy(id = id, hunter = 3, bg = Color(0xFF0A0F1A), card = Color(0xFF111A2B), line = Color(0x2E78A0DC), muted = Color(0xFF8597B0), ink = Color(0xFFDFE8F5))
    "system3" -> hunterBase.copy(id = id, hunter = 2, bg = Color(0xFF060A14), card = Color(0xD90C1626))
    "calm" -> if (systemDark) Palette(id, true, 0, Color(0xFF1B2026), Color(0xFF232A31), Color(0xFFE8E3DA), Color(0xFF9AA3AD), Color(0xFF353E48),
        Color(0xFF5FA8A3), Color(0xFF7D9BD8), Color(0xFFE07A63), Color(0xFFE0AE58), Color(0xFF6FBF80), Color(0xFFA98BD0),
        Color(0xFF5FA8A3), Color(0xFF7D9BD8), Color(0xFFE09A7C), Color(0xFF7D9BD8), Color(0xFFE07A93), Color(0xFF6FBF80), Color(0xFFA98BD0))
        else Palette(id, false, 0, Color(0xFFF6F3EE), Color(0xFFFFFDF9), Color(0xFF22303C), Color(0xFF6B7682), Color(0xFFE4DDD2),
        Color(0xFF2F6F73), Color(0xFF3D5A98), Color(0xFFC0533D), Color(0xFFC98F2E), Color(0xFF3F7D4E), Color(0xFF7A5A9C),
        Color(0xFF2F6F73), Color(0xFF3D5A98), Color(0xFFC8704F), Color(0xFF3D5A98), Color(0xFFB5485D), Color(0xFF3F7D4E), Color(0xFF7A5A9C))
    "ez" -> Palette(id, false, 0, Color(0xFFF1F2F8), Color.White, Color(0xFF1C1C1B), Color(0xFF5F6370), Color(0xFFE2E5EF),
        Color(0xFF00339B), Color(0xFF098CE9), Color(0xFFDF0000), Color(0xFFFFB606), Color(0xFF3AB500), Color(0xFF5641CF),
        Color(0xFF00339B), Color(0xFF098CE9), Color(0xFF3AB500), Color(0xFF00339B), Color(0xFFEA3453), Color(0xFF2C8A00), Color(0xFF5641CF))
    "classic" -> if (systemDark) Palette(id, true, 0, Color(0xFF121417), Color(0xFF1C1F24), Color(0xFFE8EAED), Color(0xFF9AA0A6), Color(0xFF2C3138),
        Color(0xFF58A700), Color(0xFF1C7CD6), Color(0xFFE5484D), Color(0xFFF59E0B), Color(0xFF58A700), Color(0xFF8A5CFF),
        Color(0xFF58A700), Color(0xFF1C7CD6), Color(0xFFCE82FF), Color(0xFF6EA8FF), Color(0xFFFF7B72), Color(0xFF5FD068), Color(0xFFC792EA))
        else Palette(id, false, 0, Color(0xFFF7F7F5), Color.White, Color(0xFF1F2328), Color(0xFF6B7280), Color(0xFFE5E7EB),
        Color(0xFF58A700), Color(0xFF1C7CD6), Color(0xFFE5484D), Color(0xFFF59E0B), Color(0xFF58A700), Color(0xFF8A5CFF),
        Color(0xFF58A700), Color(0xFF1C7CD6), Color(0xFFCE82FF), Color(0xFF1F5FBF), Color(0xFFC0392B), Color(0xFF2E7D32), Color(0xFF7B3FA0))
    else -> hunterBase
}.copy(aura = aura.toFloat())

val LocalPal = staticCompositionLocalOf { hunterBase }

/** Background / emblem animations (off in UI tests, where endless animations would keep the screen from going idle). */
object Motion { @JvmField var enabled = true }
val pal: Palette @Composable get() = LocalPal.current

@Composable
fun LevelUpTheme(themeId: String, aura: Double, content: @Composable () -> Unit) {
    val p = palette(themeId, isSystemInDarkTheme(), aura)
    val scheme: ColorScheme = if (p.dark) darkColorScheme(primary = p.accent, background = p.bg, surface = p.card, onSurface = p.ink, onBackground = p.ink, error = p.red, secondary = p.violet)
    else lightColorScheme(primary = p.primary, background = p.bg, surface = p.card, onSurface = p.ink, onBackground = p.ink, error = p.red, secondary = p.violet)
    CompositionLocalProvider(LocalPal provides p) { MaterialTheme(colorScheme = scheme, content = content) }
}

// ---------- text ----------
@Composable fun H1(t: String, modifier: Modifier = Modifier) = Text(if (pal.upper) t.uppercase() else t, modifier, color = if (pal.hunter > 0) Color(0xFFEAF4FF) else pal.ink,
    fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = if (pal.upper) 1.5.sp else 0.sp, lineHeight = 30.sp)
@Composable fun H2(t: String, modifier: Modifier = Modifier) = Text(if (pal.upper) t.uppercase() else t, modifier, color = pal.ink, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold,
    letterSpacing = if (pal.upper) 1.sp else 0.sp)
@Composable fun B(t: String, modifier: Modifier = Modifier, size: Int = 17, color: Color = pal.ink, align: TextAlign? = null) = Text(t, modifier, color = color, fontSize = size.sp, fontWeight = FontWeight.Bold, textAlign = align)
@Composable fun P(t: String, modifier: Modifier = Modifier, size: Int = 16, color: Color = pal.ink, align: TextAlign? = null) = Text(t, modifier, color = color, fontSize = size.sp, lineHeight = (size * 1.35).sp, textAlign = align)
@Composable fun Muted(t: String, modifier: Modifier = Modifier, size: Int = 14, align: TextAlign? = null) = Text(t, modifier, color = pal.muted, fontSize = size.sp, lineHeight = (size * 1.35).sp, textAlign = align)

// ---------- card ("Hunter System" window: glowing frame + corner brackets) ----------
@Composable
fun Panel(modifier: Modifier = Modifier, header: String? = null, highlight: Boolean = false, onClick: (() -> Unit)? = null, pad: Dp = 14.dp, content: @Composable ColumnScope.() -> Unit) {
    val p = pal
    val shape = RoundedCornerShape(p.corner)
    val border = if (p.hunter > 0) BorderStroke(if (highlight) 1.5.dp else 1.dp, if (highlight) p.accent.copy(alpha = .9f) else p.accent.copy(alpha = .45f)) else BorderStroke(1.dp, p.line)
    Column(modifier.fillMaxWidth().padding(vertical = 6.dp)
        .then(if (p.glow) Modifier.drawBehind { drawRoundRect(p.accent.copy(alpha = if (highlight) .22f else .10f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(14f, 14f), size = Size(size.width, size.height)) } else Modifier)
        .clip(shape).background(p.card).border(border, shape)
        .then(if (p.hunter == 1) Modifier.drawBehind { corners(p.accent) } else Modifier)
        .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier).padding(pad)) {
        if (header != null) SysHeader(header)
        content()
    }
}
private fun androidx.compose.ui.graphics.drawscope.DrawScope.corners(c: Color) {
    val l = 14.dp.toPx(); val w = 2.dp.toPx(); val col = lerp(c, Color.White, .45f)
    drawLine(col, Offset(0f, w / 2), Offset(l, w / 2), w); drawLine(col, Offset(w / 2, 0f), Offset(w / 2, l), w)
    drawLine(col, Offset(size.width - l, size.height - w / 2), Offset(size.width, size.height - w / 2), w); drawLine(col, Offset(size.width - w / 2, size.height - l), Offset(size.width - w / 2, size.height), w)
}
@Composable
fun SysHeader(t: String) {
    val p = pal
    if (p.hunter > 0) Box(Modifier.fillMaxWidth().padding(bottom = 10.dp).border(1.dp, p.accent.copy(alpha = .6f), RoundedCornerShape(2.dp)).background(p.accent.copy(alpha = .12f)).padding(vertical = 5.dp), contentAlignment = Alignment.Center) {
        Text(t.uppercase(), color = Color(0xFFCFE6FF), fontSize = 13.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
    } else Text(t.uppercase(), Modifier.padding(bottom = 8.dp), color = p.muted, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
}

// ---------- buttons ----------
enum class BtnKind { Primary, Ghost, Red, Blue, Green }
@Composable
fun Btn(text: String, modifier: Modifier = Modifier, kind: BtnKind = BtnKind.Primary, enabled: Boolean = true, small: Boolean = false, onClick: () -> Unit) {
    val p = pal
    val base = when (kind) { BtnKind.Red -> p.red; BtnKind.Blue -> if (p.hunter > 0) p.violet else p.blue; BtnKind.Green -> p.ok; else -> p.accent }
    val shape = RoundedCornerShape(if (p.hunter == 1) 3.dp else 14.dp)
    val bg: Brush = when {
        !enabled -> Brush.linearGradient(listOf(p.line.copy(alpha = .25f), p.line.copy(alpha = .25f)))
        kind == BtnKind.Ghost -> Brush.linearGradient(listOf(Color.Transparent, Color.Transparent))
        p.hunter > 0 -> Brush.verticalGradient(listOf(base.copy(alpha = .45f), base.copy(alpha = .22f)))
        else -> Brush.linearGradient(listOf(base, base))
    }
    val fg = when { !enabled -> p.muted; kind == BtnKind.Ghost -> if (p.hunter > 0) p.ink else base; p.hunter > 0 -> Color(0xFFEAF4FF); else -> Color.White }
    Box(modifier.fillMaxWidth().padding(vertical = 4.dp).clip(shape).background(bg)
        .border(BorderStroke(1.dp, if (!enabled) p.line else if (kind == BtnKind.Ghost) (if (p.hunter > 0) p.line else base) else if (p.hunter > 0) lerp(base, Color.White, .35f) else base), shape)
        .clickable(enabled = enabled, onClick = onClick).padding(vertical = if (small) 9.dp else 14.dp, horizontal = 12.dp), contentAlignment = Alignment.Center) {
        Text(if (p.upper && kind != BtnKind.Ghost) text.uppercase() else text, color = fg, fontSize = if (small) 14.sp else 16.sp, fontWeight = FontWeight.ExtraBold,
            letterSpacing = if (p.upper) 1.sp else 0.sp, textAlign = TextAlign.Center)
    }
}
@Composable
fun LinkBtn(text: String, modifier: Modifier = Modifier, color: Color? = null, onClick: () -> Unit) =
    Text(text, modifier.clip(RoundedCornerShape(6.dp)).clickable(onClick = onClick).padding(vertical = 8.dp, horizontal = 4.dp), color = color ?: if (pal.hunter > 0) Color(0xFF7CC4FF) else pal.blue,
        fontSize = 15.sp, fontWeight = FontWeight.Bold)

// ---------- bars, rings, pills, chips ----------
@Composable
fun HBar(frac: Double, modifier: Modifier = Modifier, color: Color? = null, height: Dp = 12.dp, marker: Double? = null) {
    val p = pal; val c = color ?: p.accent
    Box(modifier.fillMaxWidth().height(height).clip(RoundedCornerShape(if (p.hunter > 0) 2.dp else 6.dp)).background(p.line.copy(alpha = .35f))) {
        Box(Modifier.fillMaxWidth(frac.coerceIn(0.0, 1.0).toFloat()).height(height).background(if (p.hunter > 0) Brush.horizontalGradient(listOf(lerp(c, Color.Black, .35f), lerp(c, Color.White, .2f))) else Brush.linearGradient(listOf(c, c))))
        if (marker != null) Canvas(Modifier.matchParentSize()) { val x = size.width * marker.coerceIn(0.0, 1.0).toFloat(); drawLine(p.ink, Offset(x, 0f), Offset(x, size.height), 3.dp.toPx()) }
    }
}
@Composable
fun Ring(frac: Double, size: Dp = 64.dp, color: Color? = null, stroke: Dp = 6.dp, content: @Composable BoxScope.() -> Unit = {}) {
    val p = pal; val c = color ?: p.accent
    Box(Modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(Modifier.matchParentSize()) {
            val sw = stroke.toPx(); val inset = sw / 2
            drawArc(p.line.copy(alpha = .4f), 0f, 360f, false, Offset(inset, inset), Size(this.size.width - sw, this.size.height - sw), style = Stroke(sw))
            drawArc(c, -90f, (360 * frac.coerceIn(0.0, 1.0)).toFloat(), false, Offset(inset, inset), Size(this.size.width - sw, this.size.height - sw), style = Stroke(sw, cap = StrokeCap.Round))
        }
        content()
    }
}
/** segmented ring: one arc per part, lit when done (path nodes, skill bubbles) */
@Composable
fun PartRing(done: List<Boolean>, size: Dp, color: Color, content: @Composable BoxScope.() -> Unit = {}) {
    val p = pal
    Box(Modifier.size(size), contentAlignment = Alignment.Center) {
        if (done.size > 1) Canvas(Modifier.matchParentSize()) {
            val sw = 4.dp.toPx(); val seg = 360f / done.size; val gap = 12f
            done.forEachIndexed { k, d -> drawArc(if (d) color else p.line.copy(alpha = .5f), -90f + k * seg + gap / 2, seg - gap, false, Offset(sw / 2, sw / 2), Size(this.size.width - sw, this.size.height - sw), style = Stroke(sw, cap = StrokeCap.Round)) }
        }
        content()
    }
}
@Composable
fun Pill(t: String, good: Boolean = true) {
    val p = pal; val c = if (good) (if (p.hunter > 0) Color(0xFF8FD0FF) else p.ok) else (if (p.hunter > 0) Color(0xFFFF8EA3) else p.amber)
    Text(if (p.upper) t.uppercase() else t, Modifier.clip(RoundedCornerShape(if (p.hunter > 0) 3.dp else 20.dp)).background(c.copy(alpha = .16f)).padding(horizontal = 8.dp, vertical = 3.dp),
        color = c, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = if (p.upper) 1.sp else 0.sp)
}
@Composable
fun Chip(t: String, modifier: Modifier = Modifier, onClick: (() -> Unit)? = null) {
    val p = pal
    Text(t, modifier.padding(3.dp).clip(RoundedCornerShape(20.dp)).background(p.line.copy(alpha = .3f)).then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
        .padding(horizontal = 10.dp, vertical = 5.dp), color = p.ink, fontSize = 14.sp)
}
@Composable
fun Toggle(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        P(label, Modifier.weight(1f), size = 15)
        Switch(checked, onChange, colors = SwitchDefaults.colors(checkedTrackColor = pal.accent))
    }
}
@Composable fun Gap(h: Int = 10) = Spacer(Modifier.height(h.dp))
@Composable fun Row2(modifier: Modifier = Modifier, content: @Composable RowScope.() -> Unit) = Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp), content = content)

@Composable
fun StatTile(label: String, value: String, modifier: Modifier = Modifier, color: Color? = null) {
    val p = pal
    Column(modifier.padding(3.dp).clip(RoundedCornerShape(p.corner)).background(p.line.copy(alpha = .18f)).border(1.dp, p.line.copy(alpha = .5f), RoundedCornerShape(p.corner)).padding(10.dp)) {
        Text(label, color = p.muted, fontSize = 12.sp)
        Text(value, color = color ?: p.ink, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
    }
}
@Composable
fun TileGrid(items: List<Triple<String, String, Color?>>, cols: Int = 2) {
    Column { items.chunked(cols).forEach { row -> Row(Modifier.fillMaxWidth()) { row.forEach { StatTile(it.first, it.second, Modifier.weight(1f), it.third) }; repeat(cols - row.size) { Spacer(Modifier.weight(1f)) } } } }
}

// ---------- the rank emblem: the rank letter with a purple halo that grows with the level (hero.js) ----------
@Composable
fun RankEmblem(level: Int, size: Dp = 96.dp, rank: String = Hero.rankForLevel(level), onClick: (() -> Unit)? = null) {
    val a = Hero.aura(level).toFloat()
    val col = Color(Hero.RANK_COLOR[rank] ?: 0xFF8A9BB5)
    val pulse = if (Motion.enabled) { val tr = rememberInfiniteTransition(label = "aura"); tr.animateFloat(1f, 1.18f, infiniteRepeatable(tween(1500), RepeatMode.Reverse), label = "pulse").value } else 1f
    Box(Modifier.size(size * 1.3f).then(if (onClick != null) Modifier.clip(CircleShape).clickable(onClick = onClick) else Modifier), contentAlignment = Alignment.Center) {
        // halo
        Canvas(Modifier.size(size * 1.3f).scale(.55f + a * .6f).alpha(a * .95f * pulse.coerceAtMost(1f))) {
            drawCircle(Brush.radialGradient(listOf(Color(0xF2A066FF), Color(0x737846E6), Color.Transparent)), radius = this.size.minDimension / 2)
        }
        // the letter in its frame, glowing in its own colour (+ purple as the aura grows)
        Box(Modifier.size(size * .8f).drawBehind {
            drawRoundRect(col.copy(alpha = .35f), size = this.size, cornerRadius = androidx.compose.ui.geometry.CornerRadius(8f), style = Stroke(10f))
            drawRoundRect(Color(0xFFA066FF).copy(alpha = a * .5f * pulse / 1.18f), topLeft = Offset(-6f, -6f), size = Size(this.size.width + 12f, this.size.height + 12f), cornerRadius = androidx.compose.ui.geometry.CornerRadius(10f), style = Stroke(8f))
        }.border(if (size > 60.dp) 3.dp else 2.dp, col, RoundedCornerShape(4.dp)).background(col.copy(alpha = .08f), RoundedCornerShape(4.dp)), contentAlignment = Alignment.Center) {
            Text(rank, color = col, fontSize = (size.value * .5f).sp, fontWeight = FontWeight.Black, style = TextStyle(shadow = androidx.compose.ui.graphics.Shadow(col, blurRadius = 18f)))
        }
    }
}

/** Hunter background: blue grid glow, purple aura from below and floating particles (count grows with the aura). */
@Composable
fun AuraBackground(aura: Double, modifier: Modifier = Modifier) {
    val p = pal
    if (p.hunter == 0) { Box(modifier.fillMaxSize().background(p.bg)); return }
    val n = if (p.hunter == 3) 0 else Hero.particles(aura)
    var t = .3f; var breathe = 1f
    if (Motion.enabled) {
        val tr = rememberInfiniteTransition(label = "fx")
        t = tr.animateFloat(0f, 1f, infiniteRepeatable(tween(20000, easing = LinearEasing)), label = "t").value
        breathe = tr.animateFloat(.85f, 1.15f, infiniteRepeatable(tween(2500), RepeatMode.Reverse), label = "b").value
    }
    Canvas(modifier.fillMaxSize().background(p.bg)) {
        drawRect(Brush.radialGradient(listOf(Color(0x382F6EFF), Color.Transparent), center = Offset(size.width / 2, -size.height * .1f), radius = size.width * 1.2f))
        if (p.hunter != 3) {
            val step = 28.dp.toPx(); var y = 0f
            while (y < size.height) { drawLine(Color(0x0D50A0FF), Offset(0f, y), Offset(size.width, y), 1f); y += step }
            var x = 0f
            while (x < size.width) { drawLine(Color(0x0D50A0FF), Offset(x, 0f), Offset(x, size.height), 1f); x += step }
        }
        val a = aura.toFloat()
        if (a > 0) drawRect(Brush.radialGradient(listOf(Color(0xFF8A46FF).copy(alpha = .42f * a * breathe.coerceAtMost(1f)), Color.Transparent), center = Offset(size.width / 2, size.height * 1.15f), radius = size.width * 1.3f))
        for (i in 0 until n) {
            fun r(k: Int): Float { val v = sin((i + 1) * 12.9898 * (k + 1)) * 43758.5453; return (v - kotlin.math.floor(v)).toFloat() }
            val dur = 9 + r(2) * 10
            val ph = ((t * 20f / dur) + r(5)) % 1f
            val px = r(0) * size.width + (r(4) - .5f) * 80f * ph
            val py = size.height + 12f - ph * (size.height + 40f)
            val s = (3 + r(1) * 6 * (.6f + a * .6f)).dp.toPx() / 2
            val op = (.35f + r(3) * .5f) * (.5f + a * .5f) * (if (ph < .15f) ph / .15f else if (ph > .8f) (1 - ph) / .2f else 1f)
            drawCircle(Color(0xFFB98CFF).copy(alpha = op.coerceIn(0f, 1f)), s, Offset(px, py))
        }
    }
}

/** Rich text from the content files (grammar chapters, reader cards): tables, code, images, <details>. */
@SuppressLint("SetJavaScriptEnabled")
@Composable
fun HtmlBlock(html: String, baseUrl: String, modifier: Modifier = Modifier) {
    val p = pal
    val css = remember(p) {
        fun c(x: Color) = String.format("#%06X", 0xFFFFFF and x.toArgb())
        """<style>body{margin:0;padding:0;background:transparent;color:${c(p.ink)};font:16px/1.5 system-ui,sans-serif;word-wrap:break-word}
        table{border-collapse:collapse;width:100%;margin:8px 0;font-size:14px}td,th{border:1px solid ${c(p.line)};padding:5px 6px;text-align:left;vertical-align:top}
        th{background:${c(p.line)}55}.tablewrap{overflow-x:auto}pre{background:${c(p.line)}44;padding:10px;border-radius:8px;overflow-x:auto;font-size:13px}
        code{font-family:monospace}a{color:${c(p.blue)}}img{max-width:100%;height:auto;${if (p.dark) "filter:invert(.88) hue-rotate(180deg);" else ""}}
        .tip,blockquote{border-left:3px solid ${c(p.accent)};margin:8px 0;padding:6px 10px;background:${c(p.accent)}18}
        details{border:1px solid ${c(p.line)};border-radius:8px;padding:6px 10px;margin:8px 0}summary{font-weight:700}
        .art.m,.m{color:${c(p.m)}}.art.f,.f{color:${c(p.f)}}.art.n,.n{color:${c(p.n)}}.art.pl{color:${c(p.pl)}}h2,h3,h4{margin:14px 0 6px}
        button.spk{display:none}</style>"""
    }
    AndroidView(factory = { ctx ->
        WebView(ctx).apply {
            setBackgroundColor(0)
            settings.javaScriptEnabled = false
            isVerticalScrollBarEnabled = false
        }
    }, update = { it.loadDataWithBaseURL(baseUrl, "<html><head><meta name=viewport content='width=device-width'>$css</head><body>$html</body></html>", "text/html", "utf-8", null) },
        modifier = modifier.fillMaxWidth())
}

@Composable
fun Avatar(name: String, color: String, size: Dp = 36.dp) {
    val c = runCatching { Color(android.graphics.Color.parseColor(color)) }.getOrDefault(Color.Gray)
    Box(Modifier.size(size).clip(CircleShape).background(c), contentAlignment = Alignment.Center) {
        Text(name.take(1).uppercase(), color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = (size.value * .45f).sp)
    }
}

@Composable
fun ScreenColumn(content: @Composable ColumnScope.() -> Unit) {
    androidx.compose.foundation.lazy.LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 14.dp, end = 14.dp, top = 12.dp, bottom = 90.dp)) {
        item { Column(content = content) }
    }
}
@Composable fun Sp(w: Int) = Spacer(Modifier.width(w.dp))

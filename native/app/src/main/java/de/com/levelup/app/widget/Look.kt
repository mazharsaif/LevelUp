package de.com.levelup.app.widget

import android.content.Context
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color as AColor
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.os.Build
import androidx.compose.ui.graphics.Color
import androidx.glance.text.FontFamily
import androidx.glance.unit.ColorProvider
import de.com.levelup.app.R

/**
 * The three looks from docs/design/widgets: Hunter (dark navy, glow outline; app themes "Hunter …"),
 * Calm (warm paper / slate, follows light-dark; "Calm", "Eurozeit") and Material You (wallpaper colours; "Classic").
 * Colours are plain ints so rings and emblems can be drawn into bitmaps with the same values.
 */
data class Look(
    val id: String, val dark: Boolean,
    val bg: Int, val bgRes: Int, val surface: Int, val text: Int, val muted: Int, val accent: Int, val accent2: Int, val onAccent: Int,
    val good: Int, val bad: Int, val gold: Int, val track: Int, val caps: Boolean, val display: FontFamily, val body: FontFamily,
) {
    fun c(v: Int) = ColorProvider(Color(v))
    val textC get() = c(text); val mutedC get() = c(muted); val accentC get() = c(accent); val onAccentC get() = c(onAccent)
    val surfaceC get() = c(surface); val goodC get() = c(good); val badC get() = c(bad); val goldC get() = c(gold)
    fun label(s: String) = if (caps) s.uppercase() else s

    companion object {
        // fixed colours in every look: articles (der blue, die red, das green, plural purple) and rank letters
        fun article(g: String?, art: String?, dark: Boolean): Int = when (g ?: when (art?.lowercase()) { "der", "le" -> "m"; "die", "la" -> "f"; "das" -> "n"; "les" -> "p"; else -> null }) {
            "m" -> if (dark) 0xFF6EA8FF.toInt() else 0xFF1F5FBF.toInt()
            "f" -> if (dark) 0xFFFF7B72.toInt() else 0xFFC0392B.toInt()
            "n" -> if (dark) 0xFF5FD068.toInt() else 0xFF2E7D32.toInt()
            "p" -> if (dark) 0xFFC792EA.toInt() else 0xFF7B3FA0.toInt()
            else -> 0
        }
        fun rankColor(r: String): Int = when (r) {
            "D" -> 0xFF3DDC84.toInt(); "C" -> 0xFF4D96FF.toInt(); "B" -> 0xFF9A6DFF.toInt()
            "A" -> 0xFFFF6FB5.toInt(); "S" -> 0xFFFFC53D.toInt(); else -> 0xFF9AA4B2.toInt()
        }

        fun of(ctx: Context, theme: String): Look {
            val night = (ctx.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
            return when (theme) {
                "calm" -> if (night) Look("calm", true, 0xFF22262B.toInt(), R.drawable.wbg_calm_dark, 0xFF2E333A.toInt(), 0xFFECE6DC.toInt(), 0xFFA39B8F.toInt(),
                    0xFF5BB5A8.toInt(), 0xFF7FC8BC.toInt(), 0xFF10201D.toInt(), 0xFF6CC48A.toInt(), 0xFFFF8A80.toInt(), 0xFFE8B84A.toInt(), 0xFF3A4048.toInt(),
                    false, FontFamily.Serif, FontFamily.SansSerif)
                else Look("calm", false, 0xFFFBF8F3.toInt(), R.drawable.wbg_calm_light, 0xFFEFE9DF.toInt(), 0xFF2B2722.toInt(), 0xFF7A7166.toInt(),
                    0xFF2F6F68.toInt(), 0xFF4F8F87.toInt(), 0xFFFFFFFF.toInt(), 0xFF2E7D32.toInt(), 0xFFC0392B.toInt(), 0xFFB7791F.toInt(), 0xFFE6DFD3.toInt(),
                    false, FontFamily.Serif, FontFamily.SansSerif)
                "you" -> {
                    // Material You: the wallpaper's palette on Android 12+, a violet seed below
                    fun sys(id: Int, fb: Int) = if (Build.VERSION.SDK_INT >= 31) ctx.getColor(id) else fb
                    if (night) Look("you", true, sys(android.R.color.system_neutral1_900, 0xFF1C1B1F.toInt()), R.drawable.wbg_you_dark,
                        sys(android.R.color.system_neutral2_800, 0xFF2B2930.toInt()), sys(android.R.color.system_neutral1_50, 0xFFE6E1E5.toInt()),
                        sys(android.R.color.system_neutral2_200, 0xFFCAC4D0.toInt()), sys(android.R.color.system_accent1_200, 0xFFD0BCFF.toInt()),
                        sys(android.R.color.system_accent3_200, 0xFFEFB8C8.toInt()), sys(android.R.color.system_accent1_800, 0xFF381E72.toInt()),
                        0xFF6DD58C.toInt(), 0xFFFFB4AB.toInt(), 0xFFFFC53D.toInt(), sys(android.R.color.system_neutral2_700, 0xFF49454F.toInt()),
                        false, FontFamily.SansSerif, FontFamily.SansSerif)
                    else Look("you", false, sys(android.R.color.system_neutral1_10, 0xFFFFFBFE.toInt()), R.drawable.wbg_you_light,
                        sys(android.R.color.system_accent2_50, 0xFFF3EDF7.toInt()), sys(android.R.color.system_neutral1_900, 0xFF1C1B1F.toInt()),
                        sys(android.R.color.system_neutral2_600, 0xFF625B71.toInt()), sys(android.R.color.system_accent1_600, 0xFF6750A4.toInt()),
                        sys(android.R.color.system_accent3_600, 0xFF7D5260.toInt()), sys(android.R.color.system_accent1_0, 0xFFFFFFFF.toInt()),
                        0xFF2E7D32.toInt(), 0xFFB3261E.toInt(), 0xFFB7791F.toInt(), sys(android.R.color.system_accent2_100, 0xFFE8DEF8.toInt()),
                        false, FontFamily.SansSerif, FontFamily.SansSerif)
                }
                else -> Look("sl", true, 0xFF0B1230.toInt(), R.drawable.wbg_hunter, 0xFF121B3F.toInt(), 0xFFEAF4FF.toInt(), 0xFF8EA6C8.toInt(),
                    0xFF4D96FF.toInt(), 0xFF9A6DFF.toInt(), 0xFFFFFFFF.toInt(), 0xFF57E3A0.toInt(), 0xFFFF4D6D.toInt(), 0xFFFFC53D.toInt(), 0xFF1E2A55.toInt(),
                    true, FontFamily.SansSerif, FontFamily.SansSerif)
            }
        }

        /** progress ring with a glow (Glance has no determinate circular indicator) */
        fun ring(ctx: Context, sizeDp: Int, frac: Float, color: Int, track: Int, glow: Boolean, check: Boolean = false): Bitmap {
            val d = ctx.resources.displayMetrics.density.coerceAtMost(2.5f)
            val px = (sizeDp * d).toInt().coerceAtLeast(8)
            val b = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888)
            val cv = Canvas(b)
            val sw = px * 0.085f
            val r = RectF(sw * 1.4f, sw * 1.4f, px - sw * 1.4f, px - sw * 1.4f)
            val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = sw; strokeCap = Paint.Cap.ROUND }
            p.color = track; cv.drawArc(r, 0f, 360f, false, p)
            if (frac > 0f) {
                if (glow) { val g = Paint(p).apply { this.color = color; alpha = 110; maskFilter = BlurMaskFilter(sw, BlurMaskFilter.Blur.NORMAL) }
                    cv.drawArc(r, -90f, 360f * frac.coerceIn(0.02f, 1f), false, g) }
                p.color = color; cv.drawArc(r, -90f, 360f * frac.coerceIn(0.02f, 1f), false, p)
            }
            if (check) {
                val c = Paint(p).apply { this.color = color; strokeWidth = sw * 0.9f }
                val path = Path().apply { moveTo(px * 0.36f, px * 0.42f); lineTo(px * 0.47f, px * 0.52f); lineTo(px * 0.65f, px * 0.33f) }
                cv.drawPath(path, c)
            }
            return b
        }

        /** rank emblem: the letter in its rounded frame, with a violet aura that grows with the level (no blur at runtime in Glance: drawn once here) */
        fun emblem(ctx: Context, sizeDp: Int, rank: String, aura: Float, look: Look): Bitmap {
            val d = ctx.resources.displayMetrics.density.coerceAtMost(2.5f)
            val px = (sizeDp * d).toInt().coerceAtLeast(16)
            val b = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888)
            val cv = Canvas(b)
            val col = rankColor(rank)
            val cx = px / 2f
            if (aura > 0.02f && look.id != "calm") {
                val a = (60 + 150 * aura).toInt().coerceIn(0, 255)
                val halo = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    shader = RadialGradient(cx, cx, cx, intArrayOf(AColor.argb(a, 154, 109, 255), AColor.argb(0, 154, 109, 255)), floatArrayOf(0.35f, 1f), Shader.TileMode.CLAMP)
                }
                cv.drawCircle(cx, cx, cx, halo)
            }
            val box = px * 0.56f
            val rr = RectF(cx - box / 2, cx - box / 2, cx + box / 2, cx + box / 2)
            val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = if (look.dark) 0xFF0E1530.toInt() else look.surface }
            cv.drawRoundRect(rr, box * 0.16f, box * 0.16f, fill)
            val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = box * 0.07f; color = col }
            if (look.dark) cv.drawRoundRect(rr, box * 0.16f, box * 0.16f, Paint(stroke).apply { alpha = 120; maskFilter = BlurMaskFilter(box * 0.12f, BlurMaskFilter.Blur.NORMAL) })
            cv.drawRoundRect(rr, box * 0.16f, box * 0.16f, stroke)
            val tp = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = col; textSize = box * 0.62f; textAlign = Paint.Align.CENTER
                typeface = if (look.id == "calm") Typeface.create(Typeface.SERIF, Typeface.BOLD) else Typeface.DEFAULT_BOLD
            }
            cv.drawText(rank, cx, cx - (tp.descent() + tp.ascent()) / 2, tp)
            return b
        }
    }
}

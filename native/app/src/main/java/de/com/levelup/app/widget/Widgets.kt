package de.com.levelup.app.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.LinearProgressIndicator
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.TextAlign
import androidx.glance.unit.ColorProvider
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Common base: reads the snapshot, picks the look, renders for the launcher's size bucket. */
abstract class LuWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Responsive(ALL_SIZES)
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        // read the snapshot on every recomposition: a running Glance session doesn't call provideGlance again,
        // so Widgets.bump() changes VER in the widget's state to make it redraw with fresh data
        provideContent {
            androidx.glance.currentState(VER)
            val s = Snap.load(context); val look = Look.of(context, s.theme)
            if (!s.signedIn && needsSignIn) SignedOut(look, context) else Body(context, s, look)
        }
    }
    open val needsSignIn = true
    @Composable abstract fun Body(ctx: Context, s: Snap, look: Look)
}

private fun cp(v: Int) = ColorProvider(Color(v))
private fun ringColor(s: Snap, look: Look) = when (s.mode) { Mode.CLEARED -> look.good; Mode.AT_RISK -> look.bad; else -> look.accent }
private fun tone(s: Snap) = if (s.mode == Mode.AT_RISK) "red" else ""
private fun startLabel(s: Snap) = when { s.mode == Mode.AT_RISK -> "▶ Save streak"; s.mode == Mode.CLEARED -> "▶ One more part"; else -> "▶ Continue" }

@Composable private fun Ring(ctx: Context, s: Snap, look: Look, dp: Int, big: Int, small: String?) {
    val cleared = s.mode == Mode.CLEARED
    Box(modifier = GlanceModifier.size(dp.dp), contentAlignment = Alignment.Center) {
        Image(ImageProvider(Look.ring(ctx, dp, if (cleared) 1f else s.goalPct, ringColor(s, look), look.track, look.id == "sl", check = cleared && dp >= 90)),
            "${s.xpToday} of ${s.xpGoal} XP", GlanceModifier.size(dp.dp))
        if (!(cleared && dp >= 90)) Column(horizontalAlignment = Alignment.CenterHorizontally) {
            T("${s.xpToday}", look, big.sp, bold = true, display = true, align = TextAlign.Center)
            if (small != null) T(small, look, (big * 0.42f).coerceAtLeast(9f).sp, look.mutedC, align = TextAlign.Center)
        } else Column(modifier = GlanceModifier.padding(top = (dp * 0.38f).dp), horizontalAlignment = Alignment.CenterHorizontally) {
            T("${s.xpToday} XP", look, 11.sp, look.mutedC, align = TextAlign.Center)
        }
    }
}

@Composable private fun OffNote(ctx: Context, s: Snap, look: Look, what: String) {
    Frame(look, Go.open(ctx, if (s.tree) Go.home else "settings")) {
        Column(modifier = GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically, horizontalAlignment = Alignment.CenterHorizontally) {
            T(what, look, 12.sp, bold = true, align = TextAlign.Center, lines = 2)
            if (bucket() != B.TINY && bucket() != B.SMALL) T(if (s.tree) "Open a language course to use it" else "Turn on Quest Mode in Settings", look, 11.sp, look.mutedC, align = TextAlign.Center, lines = 2)
        }
    }
}

// ---------------------------------------------------------------- 1. Today's quest
class QuestWidget : LuWidget() {
    @Composable override fun Body(ctx: Context, s: Snap, look: Look) {
        if (!s.questMode || !s.setup) return OffNote(ctx, s, look, if (s.tree) "Daily quest: language courses" else "Quest Mode is off")
        val b = bucket(); val risk = s.mode == Mode.AT_RISK; val cleared = s.mode == Mode.CLEARED
        Frame(look, Go.open(ctx, Go.today), tone(s), pad = if (b == B.TINY) 6 else 12) {
            when (b) {
                B.TINY -> Box(GlanceModifier.fillMaxSize(), contentAlignment = Alignment.Center) { Ring(ctx, s, look, 50, 14, null) }
                B.SMALL -> Row(GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                    Ring(ctx, s, look, 44, 13, "/${s.xpGoal}"); HGap(8)
                    Column {
                        T("🔥${s.streak}", look, 17.sp, bold = true, display = true)
                        if (risk) T(s.leftText, look, 11.sp, look.badC, bold = true) else if (cleared) T("Cleared ✓", look, 11.sp, look.goodC, bold = true)
                        else T("${s.dueCount} due · ${s.partsToday}/${s.partsGoal}", look, 11.sp, look.mutedC)
                    }
                }
                B.WIDE -> Row(GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                    Ring(ctx, s, look, 48, 14, "/${s.xpGoal}"); HGap(10)
                    Column(GlanceModifier.defaultWeight()) {
                        T(look.label("Daily quest · ${s.leftText.removeSuffix(" left")}"), look, 10.sp, look.mutedC, bold = true, display = true)
                        T(when { cleared -> "Quest cleared ✓"; risk -> "Streak at risk"; else -> "${s.xpToGo} XP to go" }, look, 16.sp,
                            if (cleared) look.goodC else if (risk) look.badC else look.textC, bold = true, display = true)
                        Gap(4); Segments(look, s.partsToday.coerceAtMost(s.partsGoal), s.partsGoal, color = ringColor(s, look))
                    }
                    HGap(10)
                    Column(horizontalAlignment = Alignment.CenterHorizontally) { T("🔥${s.streak}", look, 18.sp, bold = true, display = true); T("streak", look, 10.sp, look.mutedC) }
                    HGap(8)
                    Column(horizontalAlignment = Alignment.CenterHorizontally) { T("${s.dueCount}", look, 18.sp, bold = true, display = true); T("due", look, 10.sp, look.mutedC) }
                }
                B.SQUARE -> {
                    Header(look, "Today", "🔥 ${s.streak}")
                    Box(GlanceModifier.fillMaxWidth().defaultWeight(), contentAlignment = Alignment.Center) { Ring(ctx, s, look, 96, 26, "/ ${s.xpGoal} XP") }
                    if (cleared) Row(GlanceModifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) { Pill("Cleared · +5 💎", look, look.goodC) }
                    else if (risk) Row(GlanceModifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) { Pill("🌙 ${s.leftText}", look, look.badC, onClick = Go.open(ctx, Go.next)) }
                    else Row(GlanceModifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                        Pill("▦ ${s.partsToday}/${s.partsGoal}", look); HGap(6); Pill("${s.dueCount} due", look, onClick = Go.open(ctx, Go.review))
                    }
                }
                else -> { // BIG and XL
                    Header(look, "Daily quest · ${s.courseTitle}", if (s.stale) "⊘ ${s.ageText}" else "🔥 ${s.streak} days")
                    Gap(6)
                    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Ring(ctx, s, look, if (b == B.XL) 84 else 74, 22, "/ ${s.xpGoal} XP"); HGap(12)
                        Column(GlanceModifier.defaultWeight()) {
                            QuestRow(look, s.xpToday >= s.xpGoal, "Earn ${s.xpGoal} XP", "${s.xpToday.coerceAtMost(s.xpGoal)}/${s.xpGoal}")
                            QuestRow(look, s.partsToday >= s.partsGoal, "Finish ${s.partsGoal} part${if (s.partsGoal > 1) "s" else ""}", "${s.partsToday.coerceAtMost(s.partsGoal)}/${s.partsGoal}")
                            QuestRow(look, s.revGoal == 0 || s.revDone >= s.revGoal, if (s.revGoal > 0) "Review ${s.revGoal} words" else "No words due",
                                if (s.revGoal > 0) "${s.revDone.coerceAtMost(s.revGoal)}/${s.revGoal}" else "✓")
                        }
                    }
                    if (b == B.XL) XlExtra(ctx, s, look)
                    Box(GlanceModifier.defaultWeight()) {}
                    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Box(GlanceModifier.defaultWeight()) {
                            when {
                                risk -> Pill("🌙 Streak at risk · ${s.leftText}", look, look.badC)
                                cleared -> T("Quest cleared · +5 💎 · streak +1", look, 11.sp, look.goodC, bold = true)
                                else -> T("${s.leftText} · goal resets at midnight", look, 11.sp, look.mutedC)
                            }
                        }
                        HGap(8)
                        Btn(startLabel(s), look, Go.open(ctx, Go.next), bg = if (risk) look.bad else look.accent, fg = if (risk) 0xFFFFFFFF.toInt() else look.onAccent)
                    }
                }
            }
        }
    }

    @Composable private fun QuestRow(look: Look, ok: Boolean, label: String, v: String) {
        Row(GlanceModifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
            T(if (ok) "☑" else "☐", look, 14.sp, if (ok) look.goodC else look.mutedC); HGap(6)
            T(label, look, 12.sp, if (ok) look.mutedC else look.textC, modifier = GlanceModifier.defaultWeight())
            T(v, look, 12.sp, if (ok) look.goodC else look.textC, bold = true)
        }
    }

    /** 4×4 "Today": next part with Start, Review / All ranks, a rank line and this week */
    @Composable private fun XlExtra(ctx: Context, s: Snap, look: Look) = Column(GlanceModifier.fillMaxWidth()) {   // one child: Glance allows 10 per column
        Gap(10)
        val n = s.next
        if (n != null) Row(GlanceModifier.fillMaxWidth().background(look.surfaceC).cornerRadius(14.dp).padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
            KindTile(look, n)
            HGap(10)
            Column(GlanceModifier.defaultWeight()) {
                T("${n.title} · part ${n.part} of ${n.parts}", look, 13.sp, bold = true, display = true)
                T(listOfNotNull(n.subtitle, "~${n.minutes} min").joinToString(" · "), look, 11.sp, look.mutedC)
            }
            Btn("Start", look, Go.open(ctx, Go.next))
        }
        Gap(8)
        Row(GlanceModifier.fillMaxWidth()) {
            Pill("⟳ Review ${s.dueCount}", look, onClick = Go.open(ctx, Go.review)); HGap(6)
            Pill("${s.rank}-Rank · Lv ${s.level} · ${"%.1f".format(Locale.ROOT, s.a1Pct)} % A1", look, onClick = Go.open(ctx, Go.ranks))
        }
        Gap(8)
        WeekStrip(look, s, 22)
    }
}

@Composable fun KindTile(look: Look, n: NextPart, size: Int = 38) {
    val glyph = when (n.kind) { "vocab" -> "Aa"; "grammar" -> "§"; "phrases" -> "💬"; else -> n.icon ?: "∑" }
    Box(GlanceModifier.size(size.dp).background(look.surfaceC).cornerRadius(10.dp), contentAlignment = Alignment.Center) {
        T(glyph, look, (size * 0.42f).sp, look.accentC, bold = true, align = TextAlign.Center)
    }
}

/** this week, Monday first: ✓ goal day, • today not done yet, ! at risk, dim = some XP, empty = future */
@Composable fun WeekStrip(look: Look, s: Snap, cell: Int, labels: Boolean = true) {
    val todayIdx = 28 + LocalDate.now().dayOfWeek.value - 1
    Row(GlanceModifier.fillMaxWidth()) {
        for (k in 28 until 35) {
            Column(GlanceModifier.defaultWeight(), horizontalAlignment = Alignment.CenterHorizontally) {
                DayCell(look, s, s.days.getOrElse(k) { 'F' }, k == todayIdx, cell)
                if (labels) T("MTWTFSS"[k - 28].toString(), look, 9.sp, if (k == todayIdx) look.textC else look.mutedC, bold = k == todayIdx, align = TextAlign.Center)
            }
        }
    }
}

@Composable fun DayCell(look: Look, s: Snap, c: Char, today: Boolean, cell: Int) {
    val hit = c == 'H' || (today && s.todayHit)
    val (bg, glyph, fg) = when {
        hit -> Triple(look.accent, "✓", look.onAccent)
        today && s.mode == Mode.AT_RISK -> Triple(look.bad, "!", 0xFFFFFFFF.toInt())
        today -> Triple(look.surface, "•", look.text)
        c == 'P' -> Triple(blend(look.accent, look.track, 0.65f), "", look.text)
        c == 'M' -> Triple(look.track, "", look.text)
        else -> Triple(blend(look.track, look.bg, 0.5f), "", look.text)
    }
    Box(GlanceModifier.size(cell.dp).background(cp(bg)).cornerRadius((cell / 2).dp), contentAlignment = Alignment.Center) {
        if (glyph.isNotEmpty()) T(glyph, look, (cell * 0.5f).sp, cp(fg), bold = true, align = TextAlign.Center)
    }
}

// ---------------------------------------------------------------- 2. Rank
class RankWidget : LuWidget() {
    @Composable override fun Body(ctx: Context, s: Snap, look: Look) {
        val b = bucket()
        if (s.tree) return Frame(look, Go.open(ctx, Go.home)) {
            Header(look, s.courseTitle, "⚡ ${s.totalXP}")
            Box(GlanceModifier.defaultWeight().fillMaxWidth(), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    T("${s.treeDone}/${s.treeTotal}", look, if (b == B.TINY || b == B.SMALL || b == B.WIDE) 18.sp else 30.sp, bold = true, display = true)
                    T("skills learned", look, 11.sp, look.mutedC)
                }
            }
            if (b != B.TINY) LinearProgressIndicator(if (s.treeTotal > 0) s.treeDone.toFloat() / s.treeTotal else 0f, GlanceModifier.fillMaxWidth().height(6.dp), look.accentC, cp(look.track))
        }
        if (!s.setup) return OffNote(ctx, s, look, "Open LevelUp to finish setup")
        val up = s.rankUp
        val frac = if (s.nextRank == null) 1f else ((s.a1Pct - s.rankFromPct) / (s.nextRankPct - s.rankFromPct).coerceAtLeast(1)).toFloat().coerceIn(0f, 1f)
        val barColor = if (s.rank == "S") look.gold else look.accent2
        val pct = "%.1f".format(Locale.ROOT, s.a1Pct)
        Frame(look, Go.open(ctx, Go.ranks), if (up) "gold" else "", pad = if (b == B.TINY) 4 else 12) {
            when (b) {
                B.TINY -> Box(GlanceModifier.fillMaxSize(), contentAlignment = Alignment.Center) { Emblem(ctx, s, look, 52) }
                B.SMALL, B.WIDE -> Row(GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                    Emblem(ctx, s, look, 54); HGap(8)
                    Column(GlanceModifier.defaultWeight()) {
                        if (up) T("✦ Rank up ✦", look, 11.sp, look.goldC, bold = true, display = true)
                        T("${s.rank}-Rank${if (b == B.WIDE) " · ${s.rankName}" else ""}", look, 15.sp, bold = true, display = true)
                        T("Lv ${s.level} · $pct % A1", look, 11.sp, look.mutedC)
                        if (b == B.WIDE) { Gap(4); LinearProgressIndicator(frac, GlanceModifier.fillMaxWidth().height(5.dp), cp(barColor), cp(look.track)) }
                    }
                }
                B.SQUARE -> {
                    Header(look, if (up) "✦ Rank up ✦" else "Rank", "Lv ${s.level}", if (up) look.goldC else null)
                    Box(GlanceModifier.defaultWeight().fillMaxWidth(), contentAlignment = Alignment.Center) { Emblem(ctx, s, look, 78) }
                    T("${s.rank}-Rank · ${s.rankName}", look, 14.sp, bold = true, display = true, align = TextAlign.Center, modifier = GlanceModifier.fillMaxWidth())
                    T("$pct % of A1${s.nextRank?.let { " · next $it" } ?: ""}", look, 11.sp, look.mutedC, align = TextAlign.Center, modifier = GlanceModifier.fillMaxWidth())
                    Gap(5); LinearProgressIndicator(frac, GlanceModifier.fillMaxWidth().height(6.dp), cp(barColor), cp(look.track))
                }
                B.XL -> Column(GlanceModifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
                    Header(look, if (up) "✦ Rank up ✦" else "Rank · ${s.courseTitle}", "Lv ${s.level}", if (up) look.goldC else null)
                    Box(GlanceModifier.defaultWeight().fillMaxWidth(), contentAlignment = Alignment.Center) { Emblem(ctx, s, look, 130) }
                    T("${s.rank}-Rank · ${s.rankName}", look, 18.sp, bold = true, display = true, align = TextAlign.Center)
                    T("Level ${s.level} · $pct % of A1 · Aura: ${s.auraName}", look, 12.sp, look.mutedC, align = TextAlign.Center)
                    Gap(6); LinearProgressIndicator(frac, GlanceModifier.fillMaxWidth().height(7.dp), cp(barColor), cp(look.track))
                    Row(GlanceModifier.fillMaxWidth()) {
                        T("${s.rank} ${s.rankFromPct} %", look, 10.sp, look.mutedC, modifier = GlanceModifier.defaultWeight())
                        T(s.nextRank?.let { "$it ${s.nextRankPct} %" } ?: "Max", look, 10.sp, look.mutedC)
                    }
                    Gap(4)
                    T(if (up && s.rankCan.isNotBlank()) s.rankCan else s.nextRank?.let { n -> "Next: $n-Rank${s.nextRankEta?.let { " in $it" } ?: ""}" } ?: "S-Rank reached",
                        look, 12.sp, look.textC, align = TextAlign.Center, lines = 2)
                }
                else -> Row(GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                    Emblem(ctx, s, look, 92); HGap(10)
                    Column(GlanceModifier.defaultWeight()) {
                        if (up) T("✦ Rank up ✦", look, 12.sp, look.goldC, bold = true, display = true)
                        T("${s.rank}-Rank", look, 18.sp, bold = true, display = true)
                        T(s.rankName, look, 13.sp, look.textC, bold = true)
                        T("Level ${s.level} · $pct % A1", look, 11.sp, look.mutedC)
                        Gap(8)
                        LinearProgressIndicator(frac, GlanceModifier.fillMaxWidth().height(7.dp), cp(barColor), cp(look.track))
                        Row(GlanceModifier.fillMaxWidth()) {
                            T("${s.rank} ${s.rankFromPct} %", look, 10.sp, look.mutedC, modifier = GlanceModifier.defaultWeight())
                            T(s.nextRank?.let { "$it ${s.nextRankPct} %" } ?: "Max", look, 10.sp, look.mutedC)
                        }
                        Gap(6)
                        if (up && s.rankCan.isNotBlank()) T(s.rankCan, look, 11.sp, look.textC, lines = 3)
                        else T(s.nextRank?.let { n -> "Next: $n-Rank${s.nextRankEta?.let { " in $it" } ?: ""}" } ?: "S-Rank reached", look, 11.sp, look.textC)
                        T("Aura: ${s.auraName}", look, 11.sp, look.mutedC)
                        StaleBadge(s, look)
                    }
                }
            }
        }
    }
    @Composable private fun Emblem(ctx: Context, s: Snap, look: Look, dp: Int) =
        Image(ImageProvider(Look.emblem(ctx, dp, s.rank, s.aura, look)), "${s.rank}-Rank", GlanceModifier.size(dp.dp))
}

// ---------------------------------------------------------------- 3. Continue
class ContinueWidget : LuWidget() {
    @Composable override fun Body(ctx: Context, s: Snap, look: Look) {
        val b = bucket(); val n = s.next; val risk = s.mode == Mode.AT_RISK
        val body = Go.open(ctx, if (s.tree) Go.home else Go.today)
        if (n == null) return Frame(look, body) {
            Box(GlanceModifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                T(if (s.setup) "All done 🎓 Keep reviewing" else "Open LevelUp to start", look, 13.sp, bold = true, align = TextAlign.Center, lines = 2)
            }
        }
        val start = Go.open(ctx, Go.next)
        val btnBg = if (risk) look.bad else look.accent; val btnFg = if (risk) 0xFFFFFFFF.toInt() else look.onAccent
        val partTxt = "part ${n.part} of ${n.parts}"
        Frame(look, body, tone(s), pad = if (b == B.TINY) 6 else 12) {
            when (b) {
                B.TINY -> Column(GlanceModifier.fillMaxSize().clickable(start), verticalAlignment = Alignment.CenterVertically, horizontalAlignment = Alignment.CenterHorizontally) {
                    KindTile(look, n, 30); Gap(2); T("▶ ${n.part}/${n.parts}", look, 11.sp, bold = true, align = TextAlign.Center)
                }
                B.SMALL -> Row(GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                    Column(GlanceModifier.defaultWeight()) {
                        T(n.title, look, 14.sp, bold = true, display = true); T(partTxt, look, 11.sp, look.mutedC); Gap(4)
                        Segments(look, n.part - 1, n.parts)
                    }
                    HGap(8)
                    Box(GlanceModifier.size(40.dp).background(cp(btnBg)).cornerRadius(20.dp).clickable(start), contentAlignment = Alignment.Center) {
                        T("▶", look, 16.sp, cp(btnFg), bold = true, align = TextAlign.Center)
                    }
                }
                B.WIDE -> Row(GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                    KindTile(look, n, 44); HGap(10)
                    Column(GlanceModifier.defaultWeight()) {
                        T(look.label("Continue · ${s.courseTitle}"), look, 10.sp, look.mutedC, bold = true, display = true)
                        T(n.title, look, 15.sp, bold = true, display = true)
                        T(listOfNotNull(partTxt.replaceFirstChar { it.uppercase() }, n.subtitle, "~${n.minutes} min").joinToString(" · "), look, 11.sp, look.mutedC)
                    }
                    HGap(8)
                    Btn(if (risk) "Save streak" else "▶ Start", look, start, btnBg, btnFg)
                }
                else -> {
                    Header(look, if (b == B.SQUARE) "Continue" else "Continue · ${s.courseTitle}", "~${n.minutes} min")
                    Gap(6)
                    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        KindTile(look, n, 40); HGap(10)
                        Column(GlanceModifier.defaultWeight()) {
                            T(if (n.subtitle != null && b != B.SQUARE && n.kind == "vocab") "${n.title} · ${n.subtitle}" else n.title, look, 16.sp, bold = true, display = true)
                            T(if (b == B.SQUARE) partTxt.replaceFirstChar { it.uppercase() } else listOfNotNull(partTxt.replaceFirstChar { it.uppercase() }, n.subtitle.takeIf { n.kind != "vocab" }).joinToString(" · "), look, 11.sp, look.mutedC)
                        }
                    }
                    Gap(6); Segments(look, n.part - 1, n.parts)
                    if (b != B.SQUARE && n.newWords.isNotEmpty()) { Gap(6); NewWords(look, n.newWords) }
                    Box(GlanceModifier.defaultWeight()) {}
                    if (b == B.SQUARE) {
                        Btn(if (risk) "▶ Save streak" else "▶ Start part ${n.part}", look, start, btnBg, btnFg, full = true)
                        if (!s.tree && s.dueCount > 0) T("Review ${s.dueCount} ›", look, 11.sp, look.accentC, bold = true, align = TextAlign.Center,
                            modifier = GlanceModifier.fillMaxWidth().padding(top = 4.dp).clickable(Go.open(ctx, Go.review)))
                    } else Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Box(GlanceModifier.defaultWeight()) { Btn(if (risk) "▶ Save streak" else "▶ Start part ${n.part}", look, start, btnBg, btnFg, full = true) }
                        if (!s.tree && s.dueCount > 0) { HGap(8); Btn("⟳ Review ${s.dueCount}", look, Go.open(ctx, Go.review), look.surface, look.text) }
                    }
                }
            }
        }
    }
    @Composable private fun NewWords(look: Look, ws: List<Word>) {
        Row(GlanceModifier.fillMaxWidth()) {
            T("New: ", look, 11.sp, look.mutedC)
            ws.take(3).forEachIndexed { i, w ->
                val col = Look.article(w.g, w.art, look.dark)
                if (w.art != null) T("${w.art} ", look, 11.sp, if (col != 0) cp(col) else look.textC, bold = true)
                T(w.word + if (i < minOf(2, ws.size - 1)) " · " else "", look, 11.sp, look.textC)
            }
        }
    }
}

// ---------------------------------------------------------------- 4. Review due
class ReviewWidget : LuWidget() {
    @Composable override fun Body(ctx: Context, s: Snap, look: Look) {
        if (s.tree || !s.setup) return OffNote(ctx, s, look, "Reviews: language courses")
        val b = bucket(); val go = Go.open(ctx, Go.review); val n = s.dueCount
        val penalty = s.missedPenalty
        Frame(look, go, if (penalty != null && n > 0) "red" else "", pad = if (b == B.TINY) 6 else 12) {
            if (n == 0) return@Frame CaughtUp(ctx, s, look, b)
            when (b) {
                B.TINY -> Column(GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically, horizontalAlignment = Alignment.CenterHorizontally) {
                    T("$n", look, 22.sp, bold = true, display = true, align = TextAlign.Center); T("due", look, 10.sp, look.mutedC, align = TextAlign.Center)
                }
                B.SMALL -> Row(GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                    Column(GlanceModifier.defaultWeight()) { T("$n", look, 26.sp, bold = true, display = true); T("words due", look, 11.sp, look.mutedC) }
                    Box(GlanceModifier.size(42.dp).background(look.accentC).cornerRadius(21.dp), contentAlignment = Alignment.Center) { T("⟳", look, 18.sp, look.onAccentC, bold = true) }
                }
                B.WIDE -> Row(GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) { T("$n", look, 26.sp, bold = true, display = true); T("due", look, 10.sp, look.mutedC) }
                    HGap(12)
                    Column(GlanceModifier.defaultWeight()) {
                        T(look.label(penalty?.let { "Missed yesterday · −$it XP" } ?: "Review · ${s.courseTitle}"), look, 10.sp, if (penalty != null) look.badC else look.mutedC, bold = true, display = true)
                        s.review.firstOrNull()?.let { WordLine(look, it, 15.sp, " = ?") }
                    }
                    Btn("Review", look, go)
                }
                B.SQUARE -> {
                    Header(look, "Review")
                    Column(GlanceModifier.defaultWeight().fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalAlignment = Alignment.CenterHorizontally) {
                        T("$n", look, 40.sp, bold = true, display = true, align = TextAlign.Center)
                        T("words due", look, 12.sp, look.mutedC, align = TextAlign.Center)
                        if (penalty != null) T("Missed yesterday · −$penalty XP", look, 11.sp, look.badC, bold = true, align = TextAlign.Center)
                        else if (s.fadingCount > 0) T("${s.fadingCount} fading", look, 11.sp, look.badC, bold = true, align = TextAlign.Center)
                    }
                    Btn("⟳ Review now", look, go, full = true)
                }
                else -> {
                    Header(look, if (penalty != null) "Missed yesterday · −$penalty XP" else "Review · $n due", s.courseTitle, if (penalty != null) look.badC else look.mutedC)
                    Gap(6)
                    val w = s.review.firstOrNull()
                    if (w != null) Row(GlanceModifier.fillMaxWidth().background(look.surfaceC).cornerRadius(14.dp).padding(horizontal = 12.dp, vertical = 6.dp).clickable(go), verticalAlignment = Alignment.CenterVertically) {
                        Column(GlanceModifier.defaultWeight()) {
                            WordLine(look, w, 18.sp)
                            T("Tap to recall the meaning", look, 10.sp, look.mutedC)
                        }
                        if (w.audio != null) Speaker(look, w.audio)
                    }
                    Gap(4)
                    Row(GlanceModifier.fillMaxWidth()) { s.review.drop(1).take(3).forEach { Pill(it.de, look, size = 10.sp); HGap(5) } }
                    Box(GlanceModifier.defaultWeight()) {}
                    Btn("⟳ Review all ${minOf(20, n)}", look, go, full = true)
                }
            }
        }
    }
    @Composable private fun CaughtUp(ctx: Context, s: Snap, look: Look, b: B) {
        Column(GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically, horizontalAlignment = Alignment.CenterHorizontally) {
            T("✓", look, if (b == B.TINY) 20.sp else 28.sp, look.goodC, bold = true, align = TextAlign.Center)
            if (b != B.TINY) T("All caught up", look, 13.sp, bold = true, align = TextAlign.Center)
            if (b != B.TINY && b != B.SMALL) T(if (s.dueTomorrow > 0) "${s.dueTomorrow} due tomorrow" else "Nothing due tomorrow", look, 11.sp, look.mutedC, align = TextAlign.Center)
            if (b == B.BIG || b == B.XL) { Gap(8); Btn("▶ Learn new words", look, Go.open(ctx, Go.next)) }
        }
    }
}

@Composable fun WordLine(look: Look, w: Word, size: androidx.compose.ui.unit.TextUnit, suffix: String = "") {
    Row(verticalAlignment = Alignment.Bottom) {
        val col = Look.article(w.g, w.art, look.dark)
        if (w.art != null) { T(w.art, look, size, if (col != 0) cp(col) else look.textC, bold = true, display = true); HGap(5) }
        T(w.word + suffix, look, size, bold = true, display = true)
    }
}

@Composable fun Speaker(look: Look, audio: String) {
    Box(GlanceModifier.size(40.dp).background(look.accentC).cornerRadius(20.dp).clickable(playAudio(audio)), contentAlignment = Alignment.Center) {
        T("🔊", look, 15.sp, look.onAccentC, align = TextAlign.Center)
    }
}

// ---------------------------------------------------------------- 5. Streak calendar
class StreakWidget : LuWidget() {
    @Composable override fun Body(ctx: Context, s: Snap, look: Look) {
        val b = bucket(); val risk = s.mode == Mode.AT_RISK; val lost = s.streak == 0
        val flame = if (lost) "🔥" else "🔥"
        val numColor = if (lost) look.mutedC else look.textC
        Frame(look, Go.open(ctx, if (risk) Go.next else Go.progress), tone(s), pad = if (b == B.TINY) 6 else 12) {
            when (b) {
                B.TINY -> Column(GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically, horizontalAlignment = Alignment.CenterHorizontally) {
                    T(flame, look, 18.sp, align = TextAlign.Center); T("${s.streak}", look, 18.sp, numColor, bold = true, display = true, align = TextAlign.Center)
                }
                B.SMALL -> Row(GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                    Column { T("$flame ${s.streak}", look, 20.sp, numColor, bold = true, display = true); T(if (lost) "start today" else "day streak", look, 10.sp, look.mutedC) }
                    HGap(8)
                    Row(GlanceModifier.defaultWeight(), verticalAlignment = Alignment.Bottom) {
                        val todayIdx = 28 + LocalDate.now().dayOfWeek.value - 1
                        for (k in 28 until 35) {
                            val c = s.days.getOrElse(k) { 'F' }; val hit = c == 'H' || (k == todayIdx && s.todayHit)
                            val col = when { hit -> look.accent; k == todayIdx && risk -> look.bad; c == 'P' -> blend(look.accent, look.track, 0.6f); else -> look.track }
                            Box(GlanceModifier.defaultWeight().height(if (hit) 24.dp else 10.dp).padding(horizontal = 1.dp)) {
                                Box(GlanceModifier.fillMaxSize().background(cp(col)).cornerRadius(3.dp)) {}
                            }
                        }
                    }
                }
                B.WIDE -> Row(GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                    Column { T("$flame ${s.streak}", look, 22.sp, numColor, bold = true, display = true); T(if (lost) "start a new one" else "day streak", look, 10.sp, look.mutedC) }
                    HGap(10); Box(GlanceModifier.defaultWeight()) { WeekStrip(look, s, 22) }
                }
                B.SQUARE -> {
                    Header(look, "Streak", "Best ${s.bestStreak}")
                    Column(GlanceModifier.defaultWeight().fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalAlignment = Alignment.CenterHorizontally) {
                        T("$flame ${s.streak}", look, 34.sp, numColor, bold = true, display = true, align = TextAlign.Center)
                        T(if (lost) "Start a new streak today" else if (risk) "At risk · ${s.leftText}" else "day streak", look, 11.sp, if (risk) look.badC else look.mutedC, align = TextAlign.Center)
                    }
                    WeekStrip(look, s, 16)
                    s.nextGiftAt?.let { Gap(4); T("🎁 at $it days · ${it - s.streak} to go", look, 10.sp, look.mutedC, align = TextAlign.Center, modifier = GlanceModifier.fillMaxWidth()) }
                }
                else -> {
                    Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        T("$flame ${s.streak}", look, 26.sp, numColor, bold = true, display = true); HGap(8)
                        Column(GlanceModifier.defaultWeight()) {
                            T(if (lost) "Start a new streak today" else if (risk) "Streak at risk · ${s.leftText}" else "day streak", look, 12.sp, if (risk) look.badC else look.textC, bold = true)
                            T("Best ${s.bestStreak}${s.nextGiftAt?.let { " · 🎁 at $it days" } ?: ""}", look, 11.sp, look.mutedC)
                        }
                        StaleBadge(s, look)
                    }
                    Gap(6)
                    Row(GlanceModifier.fillMaxWidth()) { "MTWTFSS".forEach { T(it.toString(), look, 9.sp, look.mutedC, align = TextAlign.Center, modifier = GlanceModifier.defaultWeight()) } }
                    val todayIdx = 28 + LocalDate.now().dayOfWeek.value - 1
                    val cell = if (b == B.XL) 30 else 12
                    for (w in 0 until 5) {
                        Row(GlanceModifier.fillMaxWidth().padding(top = if (b == B.XL) 3.dp else 2.dp)) {
                            for (d in 0 until 7) { val k = w * 7 + d
                                Box(GlanceModifier.defaultWeight(), contentAlignment = Alignment.Center) { DayCell(look, s, s.days.getOrElse(k) { 'F' }, k == todayIdx, cell) }
                            }
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- 6. Word of the day
class WordWidget : LuWidget() {
    override val needsSignIn = false
    @Composable override fun Body(ctx: Context, s: Snap, look: Look) {
        val b = bucket(); val w = s.wordOfDay(NextWord.offset(ctx))
        if (w == null) return Frame(look, Go.open(ctx, Go.today)) {
            Box(GlanceModifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                T(if (s.tree) "Word of the day: language courses" else "Open LevelUp to get a word of the day", look, 12.sp, bold = true, align = TextAlign.Center, lines = 3)
            }
        }
        val col = Look.article(w.g, w.art, look.dark).takeIf { it != 0 } ?: look.accent
        val open = Go.open(ctx, Go.word(w.id))
        Frame(look, open, pad = 0) {
            Row(GlanceModifier.fillMaxSize()) {
                // article strip inset from the rounded edge (Glance can't clip children to the frame's corners)
                Box(GlanceModifier.fillMaxHeight().padding(start = 8.dp, top = 14.dp, bottom = 14.dp)) {
                    Box(GlanceModifier.width(4.dp).fillMaxHeight().background(cp(col)).cornerRadius(2.dp)) {}
                }
                Column(GlanceModifier.defaultWeight().fillMaxHeight().padding(horizontal = 12.dp, vertical = if (b == B.TINY) 6.dp else 10.dp)) {
                    when (b) {
                        B.TINY -> { if (w.art != null) T(w.art, look, 11.sp, cp(col), bold = true); T(w.word, look, 14.sp, bold = true, display = true); T(w.en, look, 10.sp, look.mutedC) }
                        B.SMALL, B.WIDE -> Row(GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically) {
                            Column(GlanceModifier.defaultWeight()) {
                                if (b == B.WIDE) T(look.label("Word of the day · ${s.courseTitle}"), look, 10.sp, look.mutedC, bold = true, display = true)
                                WordLine(look, w, if (b == B.WIDE) 19.sp else 16.sp)
                                T(listOfNotNull(w.en, w.hint.takeIf { b == B.WIDE }).joinToString(" · "), look, 11.sp, look.mutedC)
                            }
                            if (w.audio != null) Speaker(look, w.audio)
                        }
                        B.SQUARE -> {
                            Header(look, "Daily word")
                            Column(GlanceModifier.defaultWeight(), verticalAlignment = Alignment.CenterVertically) {
                                if (w.art != null) T(w.art, look, 15.sp, cp(col), bold = true, display = true)
                                T(w.word, look, 24.sp, bold = true, display = true)
                                T(w.en, look, 13.sp, look.mutedC, lines = 2)
                            }
                            Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                T(w.hint ?: "", look, 11.sp, look.mutedC, modifier = GlanceModifier.defaultWeight())
                                if (w.audio != null) Speaker(look, w.audio)
                            }
                        }
                        else -> {
                            Header(look, "Word of the day · ${s.courseTitle}", if (w.learned) "Learned ✓" else w.lesson?.let { "New · Lesson $it" }, if (w.learned) look.goodC else look.mutedC)
                            Gap(4)
                            Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Column(GlanceModifier.defaultWeight()) {
                                    WordLine(look, w, 24.sp)
                                    T(listOfNotNull(w.en, w.pl?.let { "pl. $it" }, w.hint).joinToString(" · "), look, 12.sp, look.mutedC, lines = 2)
                                }
                                if (w.audio != null) Speaker(look, w.audio)
                            }
                            if (w.ex != null) { Gap(6); T(w.ex, look, 12.sp, look.textC, lines = 2); if (w.exEn != null) T(w.exEn, look, 11.sp, look.mutedC, lines = 2) }
                            Box(GlanceModifier.defaultWeight()) {}
                            Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                                Btn(if (w.learned) "Review it" else "Learn it", look, if (w.learned) Go.open(ctx, Go.review) else Go.open(ctx, Go.next))
                                Box(GlanceModifier.defaultWeight()) {}
                                Pill("Next ›", look, look.accentC, onClick = actionRunCallback<NextWord>())
                            }
                        }
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------- 7. Extras: glance strip, 1×1 ring, quick actions
class GlanceStripWidget : LuWidget() {
    @Composable override fun Body(ctx: Context, s: Snap, look: Look) {
        val night = (ctx.resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES
        val ink = if (night || look.id == "sl") 0xFFFFFFFF.toInt() else 0xFF1C1B1F.toInt()
        val date = LocalDate.now().format(DateTimeFormatter.ofPattern("EEE d MMM", Locale.ENGLISH))
        val line = when {
            !s.questMode -> "🔥 ${s.streak} · ⚡ ${s.xpToday} XP today${if (!s.tree) " · ${s.dueCount} words due" else ""}"
            s.mode == Mode.AT_RISK -> "🌙 Streak at risk · ${s.leftText}"
            s.mode == Mode.CLEARED -> "🔥 ${s.streak} · Quest cleared ✓${if (s.dueCount > 0) " · ${s.dueCount} words due" else ""}"
            else -> "🔥 ${s.streak} · ${s.xpToGo} XP to go · ${s.dueCount} words due"
        }
        Frame(look, Go.open(ctx, if (s.mode == Mode.AT_RISK) Go.next else Go.today), clear = true, pad = 8) {
            T(date, look, 19.sp, cp(ink), display = false)
            Row(verticalAlignment = Alignment.CenterVertically) {
                T(line, look, 13.sp, cp(if (s.mode == Mode.AT_RISK) 0xFFFF6B81.toInt() else ink))
                if (s.stale) { HGap(6); T("⊘ ${s.ageText}", look, 11.sp, cp(ink)) }
            }
        }
    }
}

class RingWidget : LuWidget() {
    @Composable override fun Body(ctx: Context, s: Snap, look: Look) {
        val glyph = when { !s.questMode -> "🔥"; s.mode == Mode.CLEARED -> "✓"; s.mode == Mode.AT_RISK -> "⚠"; else -> "🔥" }
        Frame(look, Go.open(ctx, Go.today), tone(s), pad = 4) {
            Column(GlanceModifier.fillMaxSize(), verticalAlignment = Alignment.CenterVertically, horizontalAlignment = Alignment.CenterHorizontally) {
                val r = 36
                Box(GlanceModifier.size(r.dp), contentAlignment = Alignment.Center) {
                    Image(ImageProvider(Look.ring(ctx, r, if (s.mode == Mode.CLEARED) 1f else s.goalPct, ringColor(s, look), look.track, look.id == "sl")), "Today's XP", GlanceModifier.size(r.dp))
                    T(glyph, look, 13.sp, if (s.mode == Mode.CLEARED) look.goodC else if (s.mode == Mode.AT_RISK) look.badC else look.textC, bold = true, align = TextAlign.Center)
                }
                T("${s.streak}", look, 11.sp, bold = true, display = true, align = TextAlign.Center)
            }
        }
    }
}

class ActionsWidget : LuWidget() {
    @Composable override fun Body(ctx: Context, s: Snap, look: Look) {
        val n = s.next
        Frame(look, null, pad = 6) {
            Row(GlanceModifier.fillMaxSize()) {
                Tile(look, "▶", n?.let { "Part ${it.part}/${it.parts}" } ?: "Start", Go.open(ctx, Go.next), look.accent, look.onAccent)
                HGap(6)
                if (s.tree) Tile(look, "⌂", "Skills", Go.open(ctx, Go.home), look.surface, look.text)
                else Tile(look, "⟳", if (s.dueCount > 0) "${s.dueCount} due" else "Review", Go.open(ctx, Go.review), look.surface, look.text)
            }
        }
    }
    @Composable private fun androidx.glance.layout.RowScope.Tile(look: Look, icon: String, label: String, a: Action, bg: Int, fg: Int) {
        Column(GlanceModifier.defaultWeight().fillMaxHeight().background(cp(bg)).cornerRadius(14.dp).clickable(a),
            verticalAlignment = Alignment.CenterVertically, horizontalAlignment = Alignment.CenterHorizontally) {
            T(icon, look, 18.sp, cp(fg), bold = true, align = TextAlign.Center)
            T(label, look, 11.sp, cp(fg), bold = true, align = TextAlign.Center)
        }
    }
}

// ---------------------------------------------------------------- receivers (one per widget in the launcher's picker)
class QuestReceiver : GlanceAppWidgetReceiver() { override val glanceAppWidget: GlanceAppWidget = QuestWidget() }
class RankReceiver : GlanceAppWidgetReceiver() { override val glanceAppWidget: GlanceAppWidget = RankWidget() }
class ContinueReceiver : GlanceAppWidgetReceiver() { override val glanceAppWidget: GlanceAppWidget = ContinueWidget() }
class ReviewReceiver : GlanceAppWidgetReceiver() { override val glanceAppWidget: GlanceAppWidget = ReviewWidget() }
class StreakReceiver : GlanceAppWidgetReceiver() { override val glanceAppWidget: GlanceAppWidget = StreakWidget() }
class WordReceiver : GlanceAppWidgetReceiver() { override val glanceAppWidget: GlanceAppWidget = WordWidget() }
class GlanceStripReceiver : GlanceAppWidgetReceiver() { override val glanceAppWidget: GlanceAppWidget = GlanceStripWidget() }
class RingReceiver : GlanceAppWidgetReceiver() { override val glanceAppWidget: GlanceAppWidget = RingWidget() }
class ActionsReceiver : GlanceAppWidgetReceiver() { override val glanceAppWidget: GlanceAppWidget = ActionsWidget() }

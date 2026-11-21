package de.com.levelup.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.com.levelup.app.AppState
import de.com.levelup.app.Screen
import de.com.levelup.core.Dates
import de.com.levelup.core.Hero
import de.com.levelup.core.JObj
import de.com.levelup.core.Js
import de.com.levelup.core.Pace
import de.com.levelup.core.PathItem
import de.com.levelup.core.Store
import de.com.levelup.core.Text as CoreText
import de.com.levelup.core.Word
import de.com.levelup.core.arr
import de.com.levelup.core.asNum
import de.com.levelup.core.asObj
import de.com.levelup.core.num
import de.com.levelup.core.obj
import de.com.levelup.core.ro
import de.com.levelup.core.str
import de.com.levelup.core.truthy
import kotlinx.coroutines.launch
import java.time.LocalDateTime
import java.time.temporal.ChronoUnit
import kotlin.math.abs
import kotlin.math.roundToInt

val KIND = mapOf("vocab" to "Vocabulary", "grammar" to "Grammar", "phrases" to "Phrases")
val ICON = mapOf("vocab" to "🔤", "grammar" to "📐", "phrases" to "💬")
fun itemName(it: PathItem) = if (it.kind == "vocab") "Lesson ${it.n}: ${it.title}" else it.title
fun fmt1(d: Double) = String.format(java.util.Locale.UK, "%.1f", d)
fun xpStr(d: Double) = Js.num(d)
fun topicName(t: String?) = (t ?: "Other").replace(Regex("^A\\d*\\.\\s*"), "")
fun kindColor(k: String, p: Palette) = when (k) { "vocab" -> p.kv; "grammar" -> p.kg; else -> p.kp }
fun leftToday(): String { val now = LocalDateTime.now(); val m = ChronoUnit.MINUTES.between(now, now.toLocalDate().plusDays(1).atStartOfDay()).toInt() + 1; return if (m >= 60) "${m / 60} h ${m % 60} min" else "$m min" }

private fun partLabel(app: AppState, it: PathItem): String { val n = app.store.bitCount(it); val d = app.store.bitsDone(it); return if (n > 1) "Part ${minOf(d + 1, n)} of $n" else "" }
/** average minutes in lessons per part finished (null until there's enough data) */
fun minPerPart(app: AppState): Int? {
    val S = app.S ?: return null; val cd = app.cd ?: return null
    val parts = HashMap<String, Int>(); S.arr("log").forEach { l -> val o = l.asObj() ?: return@forEach; if (cd.item.containsKey(o.str("id"))) parts.merge(o.str("d") ?: "", 1, Int::plus) }
    var sec = 0.0; var n = 0
    S.obj("time").forEach { (d, t) -> val a = t as? List<*> ?: return@forEach; val ls = a.getOrNull(1).asNum() ?: 0.0; if ((parts[d] ?: 0) > 0 && ls > 0) { sec += ls; n += parts[d]!! } }
    return if (n >= 3) maxOf(1, (sec / 60 / n).roundToInt()) else null
}

@Composable
fun TopBar(app: AppState) {
    val st = app.store
    Row2(Modifier.padding(bottom = 6.dp)) {
        UserChip(app); CourseChip(app); Box(Modifier.weight(1f))
        val sync = when { app.sync.pending && !app.sync.online -> "⚠️ Offline"; app.sync.pending -> "Saving…"; !app.sync.online -> "⚠️ Offline"; else -> "" }
        if (sync.isNotEmpty()) Muted(sync, size = 11)
        Row(Modifier.clip(RoundedCornerShape(20.dp)).border(1.dp, pal.line, RoundedCornerShape(20.dp)).clickable(enabled = app.questMode) { app.showSheet { TreasureSheet(app) } }.padding(horizontal = 10.dp, vertical = 5.dp)) {
            B("⚡ ${xpStr(st.totalXP())}", size = 14)
            if (app.questMode) { B("  💎 ${app.gems()}", size = 14); if (app.unopenedGifts().isNotEmpty()) Text(" 🎁", fontSize = 14.sp) }
        }
    }
    if (pal.hunter > 0) PlayerBar(app)
    else if (app.questMode) {
        val g = st.goalFor(); val x = st.xpToday()
        Panel { Row2 {
            Ring(minOf(1.0, x / g), 60.dp) { Text("${xpStr(x)}\n/${xpStr(g)}", fontSize = 12.sp, textAlign = TextAlign.Center, color = pal.ink) }
            Column(Modifier.weight(1f)) { B(if (x >= g) "Daily goal done ✅" else "Today's goal", size = 18); Muted(if (x >= g) "Anything extra is a bonus." else "${xpStr(g - x)} XP to go") }
            B("🔥 ${st.streak()}", size = 18)
        } }
    }
}
@Composable
fun PlayerBar(app: AppState) {
    val st = app.store; val pr = st.progress(); val L = st.level(pr.total); val rk = st.rank(pr.total)
    Row2(Modifier.padding(vertical = 4.dp)) {
        RankEmblem(L.lv, 40.dp, rk.r) { app.open(Screen.Ranks) }
        Column(Modifier.weight(1f)) {
            Text("LEVEL ${L.lv} · ${rk.r}-RANK", color = pal.muted, fontSize = 13.sp, letterSpacing = 2.sp, fontWeight = FontWeight.Bold)
            HBar(L.frac, Modifier.padding(top = 4.dp), height = 8.dp)
            Muted(if (L.a1) "A1 reached 🎓 · ${xpStr(L.xpInto)}/${xpStr(L.xpNeed)} XP to level ${L.lv + 1}" else "${fmt1(L.toNext)}% of A1 to level ${L.lv + 1}", size = 12)
        }
        B("🔥 ${st.streak()}", size = 18)
    }
}

data class Quest(val ok: Boolean, val txt: String, val v: String)
fun questStatus(app: AppState, due: List<String>): Pair<List<Quest>, Boolean> {
    val st = app.store; val S = app.S!!; val t = st.today(); val g = st.goalFor(); val x = st.xpToday()
    val newToday = st.partsToday(); val pg = st.partsGoal()
    val revDone = S.obj("reviews").num(t).toInt(); val revGoal = minOf(20, due.size + revDone)
    val q = listOf(Quest(x >= g, "Earn ${xpStr(g)} XP", "${xpStr(x)}/${xpStr(g)}"),
        Quest(newToday >= pg, "Finish $pg short part${if (pg > 1) "s" else ""} of any lesson", "${minOf(newToday, pg)}/$pg"),
        Quest(revGoal == 0 || revDone >= revGoal, if (revGoal > 0) "Review all $revGoal words to remember" else "Review words (none due)", if (revGoal > 0) "${minOf(revDone, revGoal)}/$revGoal" else "✓"))
    return q to q.all { it.ok }
}

@Composable
fun TodayScreen(app: AppState) {
    @Suppress("UNUSED_VARIABLE") val tk = app.tick
    val st = app.store; val S = app.S!!
    val due = st.dueWords()
    val quest = app.questMode
    LaunchedEffect(app.tick) {
        // levels were re-scaled (level 100 = A1): adopt the current level once, without a false "level down"
        val lv = st.level(st.progress().total).lv
        if (S["lvScale"].asNum() != 100.0) { S["lvScale"] = 100.0; S["lastLv"] = lv.toDouble(); st.save() }
        val prev = S.num("lastLv", lv.toDouble()).toInt()
        if (lv < prev) app.showSheet { LevelDownSheet(app, prev, lv) }
        if (lv != prev) { S["lastLv"] = lv.toDouble(); st.save() }
        if (quest) {
            val rw = st.checkRewards(questStatus(app, due).second)
            if (rw.gifts.isNotEmpty()) app.showSheet { GiftEarnedSheet(app, rw.gifts.map { it.id }) } else if (rw.gems > 0) app.toast("💎 +${rw.gems} – daily quest cleared!")
            if (rw.gems > 0 || rw.gifts.isNotEmpty()) app.changed()
        }
    }
    ScreenColumn {
        TopBar(app)
        if (quest) {
            val (q, all) = questStatus(app, due); val g = st.goalFor(); val x = st.xpToday(); val streak = st.streak()
            Panel(header = "! Daily quest") {
                Muted("TRAINING FOR ${(app.course?.title ?: "YOUR COURSE").uppercase()} HAS ARRIVED", size = 12, align = TextAlign.Center, modifier = Modifier.fillMaxWidth())
                q.forEach { QuestRow(it) }
                Text(if (all) "QUEST COMPLETE · 💎 +${Store.QUEST_GEMS} ${if (truthy(S.obj("questDays")[st.today()])) "COLLECTED" else ""}" else "REWARD: 💎 ${Store.QUEST_GEMS}",
                    Modifier.fillMaxWidth().padding(top = 8.dp), textAlign = TextAlign.Center, color = if (all) Color(0xFF57E3A0) else pal.muted, fontSize = 13.sp, letterSpacing = 1.sp)
                if (!truthy(S.obj("hit")[st.today()]) && streak > 0) Text("⚠ Reach ${xpStr(g)} XP today to keep your 🔥 $streak-day streak · ${leftToday()} left (${xpStr(maxOf(0.0, g - x))} XP to go)", color = pal.amber, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
                else if (!all) Muted("⏳ ${leftToday()} left today", size = 13, align = TextAlign.Center, modifier = Modifier.fillMaxWidth())
            }
        }
        val it = if (quest) st.nextPick() else st.nextItem()
        if (it != null) {
            Panel(header = if (quest) "! New quest" else "Up next", highlight = true) {
                Text("${ICON[it.kind]} ${if (quest) "NEXT · " else ""}${KIND[it.kind]!!.uppercase()}${if (quest) " · WEEK ${st.weekOf(it)}" else ""}", color = pal.ink, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
                B(itemName(it), size = 21)
                PartBar(app, it)
                val bit = st.nextBit(it)
                Muted(listOf(partLabel(app, it), when (it.kind) { "vocab" -> "${st.wordBits(it)[bit].size} new words"; "phrases" -> "${st.phraseBits(it)[bit].size} new phrases"; else -> "" }).filter { s -> s.isNotEmpty() }.joinToString(" · "))
                if (quest && st.bitCount(it) > 1) Muted("This lesson has ${st.bitCount(it)} short parts${minPerPart(app)?.let { m -> " (about $m min each)" } ?: ""}. Each part you finish counts for the daily quest.", size = 12)
                Btn(if (st.bitsDone(it) > 0) "Continue" else "Start") { app.startItem(it) }
                if (!quest) { Btn("🧩 Pick a skill", kind = BtnKind.Ghost) { app.g.kv.set("a1.freeLayout", "skills"); app.tab(Screen.Path) }
                    LinkBtn("↓ See the recommended order", Modifier.align(Alignment.CenterHorizontally)) { app.g.kv.set("a1.freeLayout", "order"); app.tab(Screen.Path) } }
            }
            if (quest) AgendaCard(app, due)
        } else Panel(highlight = true) { B("All lessons done! 🎓", size = 21); Muted("Keep your reviews going until the exam.") }
        if (due.isNotEmpty()) Panel(header = "Memory training") {
            Row2 {
                Column(Modifier.weight(1f)) { B("Review ${due.size} word${if (due.size > 1) "s" else ""} to remember"); Muted(if (quest) "Review them now to keep them fresh" else "No pressure – reviews just keep words fresh") }
                Box(Modifier.size(width = 120.dp, height = 50.dp)) { Btn("Review ${minOf(20, due.size)}", kind = BtnKind.Blue, small = true) { app.startReview(due.take(20)) } }
            }
            if (quest) MemWarn(app)
        }
        StoriesCard(app)
        if (!quest) Muted("Quest Mode is off – no daily goal, quests or penalties. Change it in Settings.", size = 13, align = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    }
}
@Composable fun QuestRow(q: Quest) = Row2(Modifier.padding(vertical = 4.dp)) {
    Box(Modifier.size(22.dp).border(1.5.dp, if (q.ok) pal.ok else pal.muted, RoundedCornerShape(4.dp)), contentAlignment = Alignment.Center) { if (q.ok) Text("✓", color = pal.ok, fontSize = 14.sp) }
    P(q.txt, Modifier.weight(1f), size = 15, color = if (q.ok) pal.muted else pal.ink); B(q.v, size = 14)
}
@Composable
fun PartBar(app: AppState, it: PathItem) {
    val st = app.store; val n = st.bitCount(it); if (n < 2) return
    val cur = st.nextBit(it)
    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        (0 until n).forEach { k -> Box(Modifier.weight(1f).height(7.dp).clip(RoundedCornerShape(3.dp)).background(if (st.bitDone(it, k)) pal.accent else if (k == cur) pal.accent.copy(alpha = .4f) else pal.line.copy(alpha = .5f))) }
    }
}
@Composable
fun AgendaCard(app: AppState, due: List<String>) {
    val st = app.store; val cd = app.cd ?: return
    val need = maxOf(0, st.partsGoal() - st.partsToday()); val plan = st.planParts(if (need > 0) need else 1)
    if (plan.isEmpty()) return
    val words = LinkedHashMap<String, Int>(); val phr = LinkedHashMap<String, Int>(); val gram = ArrayList<String>()
    for (pp in plan) when (pp.it.kind) {
        "vocab" -> pp.ids.forEach { id -> val t = topicName(cd.word[id as String]?.topic).split(" (")[0].split(",")[0]; words.merge(t, 1, Int::plus) }
        "phrases" -> phr.merge(pp.it.title, pp.ids.size, Int::plus)
        else -> gram.add(pp.it.title)
    }
    val mpp = minPerPart(app); val revN = minOf(20, due.size)
    Panel(header = "📋 Today's plan") {
        Muted(if (need > 0) "$need part${if (need > 1) "s" else ""} left for today's quest:" else "Today's parts are done ✓ Next up, as a bonus:", size = 13)
        if (words.isNotEmpty()) AgendaLine("🔤", "${words.values.sum()} new word${if (words.values.sum() > 1) "s" else ""}", words.entries.joinToString(" · ") { "${it.key} ${it.value}" })
        if (phr.isNotEmpty()) AgendaLine("💬", "${phr.values.sum()} new phrase${if (phr.values.sum() > 1) "s" else ""}", phr.entries.joinToString(" · ") { "${it.key} ${it.value}" })
        if (gram.isNotEmpty()) AgendaLine("📐", "Grammar", gram.joinToString(" · "))
        if (revN > 0) AgendaLine("🧠", "$revN word${if (revN > 1) "s" else ""} to recall", "memory training")
        if (mpp != null) AgendaLine("⏱", "about ${mpp * plan.size + (revN + 3) / 4} min", "from your own average")
    }
}
@Composable private fun AgendaLine(i: String, b: String, m: String) = Row(Modifier.padding(vertical = 3.dp)) { Text(i); Sp(6); Column { B(b, size = 15); Muted(m, size = 13) } }
@Composable
fun MemWarn(app: AppState) {
    val st = app.store; val m = st.memory(); val pr = st.progress()
    val loss = st.level(pr.coverage).lv - st.level(pr.total).lv
    if (m.overdue == 0 && m.lapsed == 0) return
    Text("⚠ ${listOfNotNull(if (m.overdue > 0) "${m.overdue} overdue" else null, if (m.lapsed > 0) "${m.lapsed} forgotten" else null).joinToString(" · ")} – ${if (loss > 0) "costing you $loss level${if (loss > 1) "s" else ""}" else "they start fading from your level"}. Review to win it back.",
        color = pal.amber, fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
}
@Composable
fun LevelDownSheet(app: AppState, prev: Int, lv: Int) {
    val m = app.store.memory()
    SysHeader("⚠ System"); Text("Level down: $prev → $lv", color = Color(0xFFFF8EA3), fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
    P("${m.overdue} word${if (m.overdue == 1) " is" else "s are"} overdue${if (m.lapsed > 0) " and ${m.lapsed} forgotten" else ""}. Words you don't review fade from your A1 %, so your level dropped.")
    Muted("Do your reviews to recover the levels.")
    Btn("Start review") { app.closeSheet(); val d = app.store.dueWords(); if (d.isNotEmpty()) app.startReview(d.take(20)) }
    Btn("Later", kind = BtnKind.Ghost) { app.closeSheet() }
}

// ---------- path ----------
@Composable
fun PathScreen(app: AppState) {
    @Suppress("UNUSED_VARIABLE") val tk = app.tick
    if (!app.questMode) { SkillMapScreen(app); return }
    val st = app.store; val nx = st.nextPick(); val plan = st.weekPlan(); val tw = st.thisWeek()
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp, 12.dp, 14.dp, 90.dp)) {
        item { H1("Your path to A1"); PaceCard(app, st.pace()); Muted("Everything is open – tap any lesson.", size = 13) }
        var k = 0
        plan.weeks.forEach { w ->
            item(key = "w${w.n}") { WeekHead(app, w.n, w.from, w.to, w.items, tw) }
            w.items.forEach { i -> val off = (kotlin.math.sin(k++ * 0.95) * 64).toInt(); item(key = i.id) { PathNode(app, i, off, nx?.id == i.id) } }
        }
    }
}
@Composable
fun WeekHead(app: AppState, n: Int, from: String, to: String, items: List<PathItem>, tw: Int) {
    val done = items.count { truthy(app.S!!.obj("done")[it.id]) }
    Panel(pad = 10.dp) {
        Row2 { B("Week $n", size = 16); if (n == tw) Pill("This week") else if (n < tw && done < items.size) Pill("Catch up", good = false) }
        Muted("${Dates.fmt(from, "EEE d MMM")} – ${Dates.fmt(to, "EEE d MMM")}", size = 13)
        Muted("$done/${items.size} done${if (items.isEmpty()) " · no new lessons – review week" else ""}", size = 12)
    }
}
@Composable
fun PathNode(app: AppState, i: PathItem, off: Int, cur: Boolean) {
    val st = app.store; val done = truthy(app.S!!.obj("done")[i.id]); val n = st.bitCount(i)
    val col = kindColor(i.kind, pal)
    Box(Modifier.fillMaxWidth().padding(vertical = 6.dp), contentAlignment = Alignment.Center) {
        Row(Modifier.offset(x = off.dp).clickable { app.showSheet { ItemSheet(app, i) } }, verticalAlignment = Alignment.CenterVertically) {
            if (off <= 0) Sp(0)
            PartRing((0 until n).map { st.bitDone(i, it) }, 76.dp, col) {
                Box(Modifier.size(56.dp).clip(RoundedCornerShape(if (pal.hunter > 0) 8.dp else 28.dp)).background(if (done) col else col.copy(alpha = .18f)).border(if (cur) 3.dp else 1.5.dp, if (cur) pal.accent else col, RoundedCornerShape(if (pal.hunter > 0) 8.dp else 28.dp)), contentAlignment = Alignment.Center) {
                    Text(if (done) "✓" else ICON[i.kind]!!, fontSize = 22.sp, color = if (done) Color.White else pal.ink)
                }
            }
            Column(Modifier.padding(start = 8.dp).size(width = 140.dp, height = 60.dp), verticalArrangement = Arrangement.Center) {
                if (cur) Text(if (st.bitsDone(i) > 0) "PART ${minOf(st.bitsDone(i) + 1, n)}/$n" else "START", color = pal.accent, fontWeight = FontWeight.Black, fontSize = 12.sp)
                Text(if (i.kind == "vocab") "${i.n}. ${i.title}" else i.title, color = pal.ink, fontSize = 13.sp, maxLines = 3, lineHeight = 15.sp)
            }
        }
    }
}
@Composable
fun PaceCard(app: AppState, pc: Pace) {
    Panel(header = "Progress to A1", onClick = { app.tab(Screen.Progress) }) {
        Row2 { Column(Modifier.weight(1f)) { B("📈 A1 progress · ${fmt1(pc.actual)}%", size = 16); Muted("Expected today: ${fmt1(pc.expected)}% · target ${Dates.fmt(app.store.settings().str("targetDate")!!)}", size = 13) }; PaceLine(pc) }
        HBar(pc.actual / 100, Modifier.padding(top = 10.dp), marker = pc.expected / 100)
    }
}
@Composable
fun PaceLine(pc: Pace) {
    val L = abs(pc.gapLessons)
    when {
        pc.left <= 0 -> Muted(if (pc.actual >= 99.9) "A1 content complete 🎓" else "Target date reached")
        L < 1 -> Pill("On track")
        else -> { val n = L.roundToInt(); Pill("$n lesson${if (n > 1) "s" else ""} ${if (pc.gap > 0) "ahead" else "behind"}", good = pc.gap > 0) }
    }
}

@Composable
fun ItemSheet(app: AppState, it: PathItem) {
    val st = app.store; val cd = app.cd!!; val S = app.S!!; val d = S.obj("done")[it.id].asObj()
    Text("${ICON[it.kind]} ${KIND[it.kind]!!.uppercase()}${if (app.questMode) " · WEEK ${st.weekOf(it)}" else ""}", color = pal.muted, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
    H2(itemName(it))
    when (it.kind) {
        "vocab" -> FlowChips(it.words.mapNotNull { cd.word[it]?.de })
        "grammar" -> { val g = cd.grammarOf(it)!!; val P = cd.gPart(it)
            if (P != null) B("Part ${(it.part ?: 0) + 1} of ${it.of} · ${if (P.q.isNotEmpty()) "${P.q.size} question${if (P.q.size > 1) "s" else ""}" else "short read"}", size = 14)
            Muted(g.intro.take(220) + "…"); g.watch?.let { w -> P("🎬 $w", size = 14) } }
        else -> Muted("${cd.phrases[it.id]?.items?.size ?: 0} phrases")
    }
    if (d != null) Pill("✓ Done ${d.str("date")?.let { Dates.fmt(it) } ?: ""}${d["score"].asNum()?.let { " · ${it.toInt()}%" } ?: ""}")
    if (st.bitCount(it) > 1) Column(Modifier.padding(vertical = 8.dp)) {
        st.bitsOf(it).forEachIndexed { k, b ->
            val ok = st.bitDone(it, k)
            val lbl = if (it.kind == "vocab") b.joinToString(", ") { id -> cd.word[id as String]?.de ?: "" } else b.joinToString(" · ") { j -> cd.phrases[it.id]!!.items[j as Int].de }
            PartRow(k, ok, lbl) { app.startItem(it, k) }
        }
    }
    Btn(if (d != null) "Practise again" else if (it.kind == "grammar") "Read & practise" else if (st.bitsDone(it) > 0) "Continue · ${partLabel(app, it)}" else if (st.bitCount(it) > 1) "Start · ${partLabel(app, it)}" else "Start") { app.startItem(it) }
    if (d != null) Btn("Mark as not done", kind = BtnKind.Ghost) { st.undoDone(it); app.closeSheet(); app.changed() }
    else Btn("I already know this – mark done", kind = BtnKind.Ghost) { st.markDone(it); app.closeSheet(); app.toast("Marked as done"); app.changed() }
}
@Composable
fun PartRow(k: Int, ok: Boolean, label: String, onClick: () -> Unit) {
    Row2(Modifier.padding(vertical = 3.dp).clip(RoundedCornerShape(10.dp)).border(1.dp, if (ok) pal.ok.copy(alpha = .6f) else pal.line, RoundedCornerShape(10.dp)).clickable(onClick = onClick).padding(10.dp)) {
        Box(Modifier.size(26.dp).clip(CircleShape).background(if (ok) pal.ok else pal.line.copy(alpha = .5f)), contentAlignment = Alignment.Center) { Text(if (ok) "✓" else "${k + 1}", color = if (ok) Color.White else pal.ink, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
        P(label, Modifier.weight(1f), size = 14); Text("›", color = pal.muted)
    }
}
@OptIn(ExperimentalLayoutApi::class)
@Composable fun FlowChips(items: List<String>, onClick: ((Int) -> Unit)? = null) = FlowRow { items.forEachIndexed { i, t -> Chip(t, onClick = onClick?.let { { it(i) } }) } }

// ---------- free mode: skill map ----------
@Composable
fun SkillMapScreen(app: AppState) {
    val st = app.store; val cd = app.cd!!
    var layout by remember { mutableStateOf(app.g.kv.get("a1.freeLayout") ?: "skills") }
    data class Skill(val key: String, val kind: String, val title: String, val items: List<PathItem>)
    val groups = remember(cd) {
        val words = LinkedHashMap<String, Skill>()
        cd.path.filter { it.kind == "vocab" }.sortedBy { it.n }.forEach { i -> val t = i.title.split(" · ")[0].replace(Regex(" [IVXL]+$"), ""); val s = words.getOrPut(t) { Skill("v:$t", "vocab", t, mutableListOf()) }; (s.items as MutableList).add(i) }
        val gram = cd.content.grammar.sortedBy { it.num }.map { g -> Skill("g:" + g.id, "grammar", "${g.num}. ${g.title}", (cd.gparts[g.id] ?: listOf(g.id)).mapNotNull { cd.item[it] }) }.filter { it.items.isNotEmpty() }
        val ph = cd.content.phrases.map { p -> Skill("p:" + p.id, "phrases", p.title, listOfNotNull(cd.item[p.id])) }.filter { it.items.isNotEmpty() }
        listOf("🔤 Words" to words.values.toList(), "📐 Grammar" to gram, "💬 Phrases" to ph)
    }
    fun units(s: Skill) = s.items.flatMap { i -> (0 until st.bitCount(i)).map { k -> i to k } }
    ScreenColumn {
        H1("Skills")
        Row2 { listOf("skills" to "🧩 Skills", "order" to "↓ Recommended order").forEach { (k, l) -> Box(Modifier.weight(1f)) { Btn(l, kind = if (layout == k) BtnKind.Primary else BtnKind.Ghost, small = true) { layout = k; app.g.kv.set("a1.freeLayout", k) } } } }
        if (layout == "order") {
            val nx = st.nextItem(); val P = cd.path
            Muted("The suggested order of lessons, mixed so topics don't repeat back to back. ${P.count { truthy(app.S!!.obj("done")[it.id]) }}/${P.size} done · tap any lesson.", size = 13)
            P.forEachIndexed { k, i -> PathNode(app, i, (kotlin.math.sin(k * 0.95) * 64).toInt(), nx?.id == i.id) }
        } else {
            Muted("Pick any skill and go at your own pace. Each ring fills as you finish its parts.", size = 13)
            groups.forEach { (label, sks) ->
                SysHeader("$label · ${sks.count { s -> units(s).all { (i, k) -> st.bitDone(i, k) } }}/${sks.size}")
                sks.chunked(3).forEach { row -> Row(Modifier.fillMaxWidth()) { row.forEach { s ->
                    val U = units(s); val n = U.count { (i, k) -> st.bitDone(i, k) }
                    Column(Modifier.weight(1f).padding(4.dp).clip(RoundedCornerShape(12.dp)).clickable {
                        app.showSheet {
                            H2(s.title); Muted("${KIND[s.kind]!!.uppercase()} · $n/${U.size} PARTS", size = 13)
                            U.forEachIndexed { j, (i, k) -> PartRow(j, st.bitDone(i, k), if (i.kind == "vocab") "Lesson ${i.n} · " + st.wordBits(i)[k].joinToString(", ") { cd.word[it]?.de ?: "" } else if (i.kind == "grammar") (cd.gPart(i)?.t ?: "Read & practise") else st.phraseBits(i)[k].joinToString(" · ") { cd.phrases[i.id]!!.items[it].de }) { app.startItem(i, k) } }
                            val nxU = U.firstOrNull { (i, k) -> !st.bitDone(i, k) } ?: U.first()
                            Btn(if (n < U.size) (if (n > 0) "Continue" else "Start") else "Practise again") { app.startItem(nxU.first, nxU.second) }
                        }
                    }.padding(6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Ring(if (U.isEmpty()) 0.0 else n.toDouble() / U.size, 54.dp, kindColor(s.kind, pal)) { Text(if (n >= U.size) "✓" else ICON[s.kind]!!, fontSize = 20.sp) }
                        Text(s.title, color = pal.ink, fontSize = 12.sp, textAlign = TextAlign.Center, maxLines = 2, lineHeight = 14.sp); Muted("$n/${U.size} parts", size = 11)
                    }
                }; repeat(3 - row.size) { Box(Modifier.weight(1f)) } } }
            }
        }
    }
}

// ---------- grammar reading ----------
@Composable
fun GrammarScreen(app: AppState, id: String) {
    @Suppress("UNUSED_VARIABLE") val tk = app.tick
    val st = app.store; val cd = app.cd!!; val it = cd.item[id] ?: return; val g = cd.grammarOf(it) ?: return
    val P = cd.gPart(it); val first = P == null || it.part == 0; val last = P == null || it.part == (it.of ?: 1) - 1
    val nq = P?.q?.size ?: g.q.size
    val html = remember(id) { st.personalize(P?.html ?: (g.body + (g.after ?: "")), app.userName) }
    val nextPart = if (P != null && !last) cd.item["${g.id}.${(it.part ?: 0) + 2}"] else null
    ScreenColumn {
        LinkBtn("‹ ${if (app.questMode) "Path" else "Skills"}") { app.back() }
        Text("📐 GRAMMAR · CHAPTER ${g.num}${if (P != null) " · PART ${(it.part ?: 0) + 1} OF ${it.of}" else ""}", color = pal.muted, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
        H1(P?.t ?: g.title)
        if (P != null) Row(Modifier.padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) { (0 until (it.of ?: 1)).forEach { k -> Box(Modifier.size(width = 30.dp, height = 6.dp).clip(RoundedCornerShape(3.dp)).background(if (truthy(app.S!!.obj("done")["${g.id}.${k + 1}"])) pal.ok else if (k == it.part) pal.accent else pal.line)) } }
        if (first) { g.watch?.let { w -> P("🎬 $w", size = 14) }; P(g.intro) }
        HtmlBlock(html, app.g.api.base)
        if (last) {
            if (g.ex.isNotEmpty()) { Gap(); H2("Examples") }
            g.ex.forEach { e -> ExRow(app, e.de, e.en, e.a) }
            if (g.mist.isNotEmpty()) { Gap(); H2("Common mistakes"); g.mist.forEach { m -> Panel { Text("✗ ${m.wrong}", color = pal.red); Text("✓ ${m.right}", color = pal.ok, fontWeight = FontWeight.Bold); Muted(m.why) } } }
        }
        Gap(16)
        Btn(if (nq > 0) "Practise ($nq question${if (nq > 1) "s" else ""})" else "Done reading ✓") {
            if (nq > 0) { app.startGrammar(it); return@Btn }
            val firstTime = !truthy(app.S!!.obj("done")[id]); val xp = app.lessons!!.grammarXP(g, it, null); st.addXP(xp)
            app.toast(if (firstTime) "Part done · +${xpStr(xp)} XP" else "Read again · +${xpStr(xp)} XP")
            if (app.questMode || nextPart == null) app.back() else { app.back(); app.open(Screen.Grammar(nextPart.id)) }
            app.changed()
        }
        app.S!!.obj("done")[id].asObj()?.let { d -> Muted("Done ${Dates.fmt(d.str("date") ?: st.today())}${d["score"].asNum()?.let { s -> " · ${s.toInt()}%" } ?: ""}", align = TextAlign.Center, modifier = Modifier.fillMaxWidth()) }
        if (nextPart != null && !app.questMode) Btn("Next part · ${cd.gPart(nextPart)?.t} ›", kind = BtnKind.Ghost) { app.back(); app.open(Screen.Grammar(nextPart.id)) }
    }
}
@Composable
fun ExRow(app: AppState, de: String, en: String, a: String?) {
    Row2(Modifier.padding(vertical = 4.dp)) { SpeakBtn(app, a, de, small = true); Column(Modifier.weight(1f)) { P(de, size = 15); Muted(en, size = 13) } }
}
@Composable
fun SpeakBtn(app: AppState, a: String?, text: String, small: Boolean = false, big: Boolean = false) {
    val s = if (big) 84.dp else if (small) 34.dp else 44.dp
    Box(Modifier.size(s).clip(if (big) CircleShape else RoundedCornerShape(8.dp)).background(pal.accent.copy(alpha = .18f)).border(1.dp, pal.accent, if (big) CircleShape else RoundedCornerShape(8.dp))
        .clickable { app.audio.play(a, text) }, contentAlignment = Alignment.Center) { Text("🔊", fontSize = if (big) 34.sp else if (small) 14.sp else 18.sp) }
}

// ---------- lessons list ----------
@Composable
fun LessonsScreen(app: AppState) {
    @Suppress("UNUSED_VARIABLE") val tk = app.tick
    val st = app.store; val cd = app.cd!!; val S = app.S!!; val P = cd.path
    var lf by remember { mutableStateOf("all") }
    val isDone = { i: PathItem -> truthy(S.obj("done")[i.id]) }
    val xpBy = HashMap<String, Double>(); S.arr("log").forEach { l -> l.asObj()?.let { o -> xpBy.merge(o.str("id") ?: "", o.num("xp"), Double::plus) } }
    val list = P.filter { lf == "all" || (if (lf == "done") isDone(it) else if (lf == "todo") !isDone(it) else it.kind == lf) }.map { it.id }.toSet()
    val plan = st.weekPlan(); val tw = st.thisWeek()
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp, 12.dp, 14.dp, 90.dp)) {
        item {
            H1("All lessons")
            val done = P.count(isDone)
            Panel {
                Row2 { Column(Modifier.weight(1f)) { Text("$done / ${P.size}", fontSize = 28.sp, fontWeight = FontWeight.Black, color = pal.ink); Muted("lessons done") }
                    Ring(done.toDouble() / P.size, 64.dp) { Text("${(100.0 * done / P.size).roundToInt()}%", color = pal.ink, fontSize = 14.sp) } }
                TileGrid(listOf("vocab", "grammar", "phrases").map { k -> Triple("${ICON[k]} ${KIND[k]}", "${P.count { it.kind == k && isDone(it) }}/${P.count { it.kind == k }}", null) }, 3)
                LinkBtn("⚡ How is XP measured?") { app.showSheet { XpHelp(app) } }
            }
            Row(Modifier.horizontalScroll(rememberScrollState())) { listOf("all" to "All", "todo" to "To do", "done" to "Done", "vocab" to "🔤 Vocab", "grammar" to "📐 Grammar", "phrases" to "💬 Phrases").forEach { (k, l) -> Box(Modifier.padding(2.dp)) { Btn(l, kind = if (lf == k) BtnKind.Primary else BtnKind.Ghost, small = true, modifier = Modifier.size(width = 110.dp, height = 48.dp)) { lf = k } } } }
        }
        plan.weeks.forEach { w ->
            val items = w.items.filter { it.id in list }
            if (items.isEmpty()) return@forEach
            item(key = "w${w.n}") { WeekHead(app, w.n, w.from, w.to, w.items, tw) }
            items(items, key = { it.id }) { i ->
                val d = S.obj("done")[i.id].asObj()
                Row2(Modifier.padding(vertical = 3.dp).clip(RoundedCornerShape(10.dp)).background(pal.card).clickable { app.showSheet { ItemSheet(app, i) } }.padding(10.dp)) {
                    Box(Modifier.size(34.dp).clip(RoundedCornerShape(8.dp)).background(kindColor(i.kind, pal).copy(alpha = if (d != null) 1f else .2f)), contentAlignment = Alignment.Center) { Text(if (d != null) "✓" else ICON[i.kind]!!, color = if (d != null) Color.White else pal.ink) }
                    Column(Modifier.weight(1f)) {
                        P(if (i.kind == "vocab") "${i.n}. ${i.title}" else i.title, size = 15)
                        Muted(KIND[i.kind] + (if (i.kind == "vocab") " · ${i.words.size} words" else "") + (if (st.bitCount(i) > 1) " · ${st.bitsDone(i)}/${st.bitCount(i)} parts" else "") +
                            (if (d != null) " · done ${Dates.fmt(d.str("date") ?: st.today())}${d["score"].asNum()?.let { " · ${it.toInt()}%" } ?: if (truthy(d["marked"])) " · marked" else ""}${xpBy[i.id]?.takeIf { it != 0.0 }?.let { " · ${xpStr(it)} XP" } ?: ""}" else ""), size = 12)
                    }
                    Text("›", color = pal.muted)
                }
            }
        }
    }
}

// ---------- words ----------
@Composable
fun WordsScreen(app: AppState) {
    @Suppress("UNUSED_VARIABLE") val tk = app.tick
    val st = app.store; val cd = app.cd!!; val S = app.S!!; val L = cd.lang
    var q by remember { mutableStateOf("") }; var f by remember { mutableStateOf("all") }
    var sort by remember { mutableStateOf(app.g.kv.get("a1.wordSort") ?: "topic") }
    var open by remember { mutableStateOf(app.g.kv.get("a1.wordsOpen")?.let { runCatching { (Js.parse(it) as List<*>).map { x -> x.toString() }.toSet() }.getOrNull() } ?: emptySet()) }
    fun saveOpen(s: Set<String>) { open = s; app.g.kv.set("a1.wordsOpen", Js.stringify(s.toList())) }
    val r = st.retention(); val due = st.dueWords().toSet()
    val ql = q.lowercase().trim()
    val list = cd.words.filter { w ->
        if (ql.isNotEmpty() && !((L.fold?.let { fo -> fo(w.de.lowercase()).contains(fo(ql)) } ?: w.de.lowercase().contains(ql)) || w.en.lowercase().contains(ql))) return@filter false
        when (f) { "all" -> true; "due" -> w.id in due; "core" -> w.core; else -> st.wordStatus(w.id) == f }
    }
    val words = S.obj("words")
    fun s(id: String) = words[id].asObj()
    val azKey = { de: String -> de.replace(Regex("^(der|die|das|le|la|les)\\s+|^l['’]", RegexOption.IGNORE_CASE), "").replace(Regex("[()]"), "").lowercase() }
    val sorted = when (sort) {
        "recent" -> list.sortedWith(compareByDescending<Word> { s(it.id)?.str("since") ?: "" }.thenByDescending { if (s(it.id) != null) 1 else 0 })
        "weak" -> list.sortedWith(compareBy<Word> { s(it.id)?.let { x -> st.health(x) } ?: 2.0 }.thenByDescending { s(it.id)?.num("lapses") ?: 0.0 })
        "strong" -> list.sortedByDescending { s(it.id)?.num("ivl", -1.0) ?: -1.0 }
        "due" -> list.sortedBy { s(it.id)?.str("due") ?: "9999" }
        "az" -> list.sortedWith(compareBy(java.text.Collator.getInstance(java.util.Locale.forLanguageTag(L.code))) { azKey(it.de) })
        else -> list
    }
    val grouped = sort == "topic" && ql.isEmpty()
    val groups = if (grouped) list.groupBy { topicName(it.topic) } else emptyMap()
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(14.dp, 12.dp, 14.dp, 90.dp)) {
        item {
            H1("Words"); Muted("${r.learned} of ${r.total} learned · ${r.mastered} mastered")
            Field("Search ${L.name} or English…", q, { q = it })
            Row(Modifier.horizontalScroll(rememberScrollState())) { listOf("all" to "All", "due" to "Due", "learning" to "Learning", "known" to "Known", "mastered" to "Mastered", "new" to "New", "core" to "★ Core").forEach { (k, l) ->
                Box(Modifier.padding(2.dp)) { Btn(l, kind = if (f == k) BtnKind.Primary else BtnKind.Ghost, small = true, modifier = Modifier.size(width = 100.dp, height = 48.dp)) { f = k } } } }
            Row2 { Muted("Sort"); Row(Modifier.weight(1f).horizontalScroll(rememberScrollState())) { listOf("topic" to "By topic", "recent" to "Newest learned", "weak" to "Needs practice", "strong" to "Strongest", "due" to "Due soonest", "az" to "A–Z").forEach { (k, l) ->
                Chip(if (sort == k) "● $l" else l) { sort = k; app.g.kv.set("a1.wordSort", k) } } } }
            if (grouped) { val allOpen = groups.keys.all { it in open }; LinkBtn(if (allOpen) "Collapse all" else "Expand all") { saveOpen(if (allOpen) emptySet() else groups.keys) } }
            if (list.isEmpty()) Muted("No words here yet.")
        }
        if (grouped) groups.forEach { (t, ws) ->
            item(key = "t:$t") {
                Row2(Modifier.padding(vertical = 4.dp).clip(RoundedCornerShape(10.dp)).background(pal.card).clickable { saveOpen(if (t in open) open - t else open + t) }.padding(12.dp)) {
                    Text(if (t in open) "▾" else "▸", color = pal.muted); B(t, Modifier.weight(1f), size = 15); Muted("${ws.count { words.containsKey(it.id) }}/${ws.size} learned", size = 12)
                }
            }
            if (t in open) items(ws, key = { it.id }) { w -> WordRow(app, w) }
        } else items(sorted.take(300), key = { it.id }) { w -> WordRow(app, w) }
        if (!grouped && sorted.size > 300) item { Muted("…${sorted.size - 300} more – search to narrow down", size = 13) }
    }
}
@Composable
fun WordRow(app: AppState, w: Word) {
    val stt = app.store.wordStatus(w.id)
    val dot = when (stt) { "learning" -> pal.amber; "known" -> pal.ok; "mastered" -> Color(0xFFE0A800); else -> pal.line }
    Row2(Modifier.padding(vertical = 2.dp).clickable { app.audio.play(w.a, w.de); app.showSheet { WordSheet(app, w) } }.padding(horizontal = 6.dp, vertical = 6.dp)) {
        Box(Modifier.size(10.dp).clip(CircleShape).background(dot))
        Column(Modifier.weight(1f)) { P(w.de, size = 15); Muted(w.en, size = 13) }
        SpeakBtn(app, w.a, w.de, small = true)
    }
}
@Composable
fun WordCard(app: AppState, w: Word, examples: Int = 3) {
    val L = app.cd!!.lang
    Row2 {
        Column(Modifier.weight(1f)) {
            Row2 { if (w.g != null && L.gtag[w.g]?.isNotEmpty() == true) Text(L.gtag[w.g]!!, color = genderColor(w.g), fontSize = 12.sp, fontWeight = FontWeight.Black); Muted(w.type + if (w.core) " · ★ core" else "", size = 12) }
            DeText(app, w, 28)
        }
        SpeakBtn(app, w.a, w.de)
    }
    w.hint?.let { h -> P("🗣 $h" + if (app.setting("hindi") != false && w.hintHi != null) " · ${w.hintHi}" else "", size = 14, color = pal.muted) }
    P(w.en, size = 18)
    listOfNotNull(w.fem?.let { "Feminine: $it" }, w.pl?.let { "Plural: $it" }, w.forms?.let { "Forms: $it" }, w.perf?.let { "${L.perfLabel}: $it" }).forEach { Muted(it, size = 14) }
    if (w.labels.isNotEmpty()) FlowChips(w.labels)
    w.ex.take(examples).forEach { e -> ExRow(app, e.de, e.en, e.a) }
    w.notes.forEach { n -> P("💡 $n", size = 14) }
}
@Composable fun genderColor(g: String?): Color = when (g) { "m" -> pal.m; "f" -> pal.f; "n" -> pal.n; "pl" -> pal.pl; else -> pal.ink }
/** the target-language word with its article coloured by gender */
@Composable
fun DeText(app: AppState, w: Word, size: Int) {
    val m = if (w.g != null) app.cd!!.lang.splitArt(w.de) else null
    if (m == null) Text(w.de, color = pal.ink, fontSize = size.sp, fontWeight = FontWeight.Bold)
    else Row { Text(m[0], color = genderColor(w.g), fontSize = size.sp, fontWeight = FontWeight.Black); Text(m[2] + m[1], color = pal.ink, fontSize = size.sp, fontWeight = FontWeight.Bold) }
}
@Composable
fun WordSheet(app: AppState, w: Word) {
    val s = app.S!!.obj("words")[w.id].asObj()
    WordCard(app, w)
    Muted("${mapOf("new" to "Not learned yet", "learning" to "Learning", "known" to "Known", "mastered" to "Mastered")[app.store.wordStatus(w.id)]}${if (s != null) " · next review ${Dates.fmt(s.str("due") ?: app.store.today())} · ✓${s.num("r").toInt()} ✗${s.num("w").toInt()}" else ""} · ${w.topic}", size = 13)
}

// ---------- progress ----------
@Composable
fun ProgressScreen(app: AppState) {
    @Suppress("UNUSED_VARIABLE") val tk = app.tick
    val st = app.store; val cd = app.cd!!; val S = app.S!!
    val pr = st.progress(); val pc = st.pace(); val r = st.retention(); val mem = st.memory()
    val P = cd.path; val done = { i: PathItem -> truthy(S.obj("done")[i.id]) }
    ScreenColumn {
        Row2 { H1("Progress", Modifier.weight(1f)); UserChip(app) }
        StatusWindow(app)
        Panel {
            Row2 {
                Ring(pr.total / 100, 92.dp, stroke = 9.dp) { Column(horizontalAlignment = Alignment.CenterHorizontally) { B("${pr.total.roundToInt()}%", size = 20); Muted("of A1", size = 11) } }
                Column(Modifier.weight(1f)) {
                    val wDone = P.filter { it.kind == "vocab" && done(it) }.sumOf { it.words.size }
                    ProgBar("🔤 Vocabulary", pr.vocab / Store.WEIGHTS_VOCAB, "$wDone/${cd.words.size}", pal.ok)
                    ProgBar("📐 Grammar", pr.grammar / Store.WEIGHTS_GRAMMAR, "${cd.content.grammar.count { g -> (cd.gparts[g.id] ?: listOf(g.id)).all { truthy(S.obj("done")[it]) } }}/${cd.content.grammar.size} chapters", pal.blue)
                    ProgBar("💬 Phrases", pr.phrases / Store.WEIGHTS_PHRASES, "${P.count { it.kind == "phrases" && done(it) }}/${P.count { it.kind == "phrases" }}", Color(0xFFCE82FF))
                }
            }
        }
        Panel {
            Row2 { B("Pace to ${Dates.fmt(st.settings().str("targetDate")!!, "d MMM yyyy")}", Modifier.weight(1f), size = 16); PaceLine(pc) }
            PaceChart(app, pc)
            Muted("━ You (your real progress)   ┅ Expected (straight line to the 🎯 target)   ⋯ Projection if you keep your pace", size = 12)
            val late = pc.projected != null && pc.projected!! > st.settings().str("targetDate")!!
            TileGrid(listOf(Triple("Expected today", "${fmt1(pc.expected)}%", null), Triple("You are at", "${fmt1(pc.actual)}%", null),
                Triple("Needed pace", "${fmt1(pc.needLessonsPerWeek)} lessons / week", null), Triple("Your pace (14 d)", "${fmt1(pc.actualLessonsPerWeek)} lessons / week", null),
                Triple("Projected finish", if (pc.actual >= 99.9) "Done 🎓" else pc.projected?.let { Dates.fmt(it, "d MMM yyyy") } ?: "—", if (late) pal.amber else pal.ok), Triple("Days left", "${pc.left}", null)))
            Muted("A1 % = vocabulary 55% (by words) + grammar 30% + phrases 15%. Expected pace is a straight line from your start date to your target.", size = 12)
        }
        CalendarCard(app)
        Panel {
            B("🧠 Memory")
            TileGrid(listOf(Triple("Learning", "${r.learning}", pal.amber), Triple("Known (1 wk+)", "${r.known}", pal.ok), Triple("Mastered (1 mo+)", "${r.mastered}", Color(0xFFE0A800)),
                Triple("Due now", "${mem.due}", pal.blue), Triple("Memory health", "${(mem.health * 100).roundToInt()}%", if (mem.health < .85) pal.red else pal.ok), Triple("Overdue · Forgotten", "${mem.overdue} · ${mem.lapsed}", null)))
            MemWarn(app)
            Muted("🔥 ${st.streak()} day streak · ⚡ ${xpStr(st.totalXP())} XP total", size = 13)
        }
        Panel {
            Row2 { B("⚡ XP", Modifier.weight(1f)); LinkBtn("How is XP measured?") { app.showSheet { XpHelp(app) } } }
            val wk = (0..6).sumOf { k -> S.obj("xp").num(Dates.addDays(st.today(), -k)) }
            val goalDays = S.ro("hit").size + S.obj("xp").count { (d, v) -> d < (st.settings().str("streakFrom") ?: "") && (v.asNum() ?: 0.0) >= st.goalFor() }
            TileGrid(listOf(Triple("Today", "${xpStr(st.xpToday())}/${xpStr(st.goalFor())}", null), Triple("Total", xpStr(st.totalXP()), null), Triple("Last 7 days", xpStr(wk), null), Triple("Days goal met", "$goalDays", null)))
            val penLog = S.arr("penLog")
            if (penLog.isNotEmpty()) {
                Text("Penalties: −${xpStr(S.obj("pen").values.sumOf { it.asNum() ?: 0.0 })} XP", color = pal.red, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                penLog.takeLast(4).reversed().forEach { p -> val o = p.asObj()!!; Muted("${Dates.fmt(o.str("d")!!)} · −${xpStr(o.num("xp"))} XP · ${o.str("why")}", size = 12) }
            }
        }
        Panel(onClick = { app.tab(Screen.Party) }) { Row2 { Text("👥", fontSize = 26.sp); Column(Modifier.weight(1f)) { B("Party"); Muted("Compare progress with your party, or join one", size = 12) }; Text("›") } }
    }
}
@Composable
private fun ProgBar(label: String, frac: Double, sub: String, c: Color) {
    Column(Modifier.padding(vertical = 3.dp)) { Row2 { P(label, Modifier.weight(1f), size = 14); Muted(sub, size = 12) }; HBar(frac, color = c, height = 8.dp) }
}
@Composable
fun StatusWindow(app: AppState) {
    val st = app.store; val cd = app.cd!!; val S = app.S!!; val pr = st.progress(); val L = st.level(pr.total); val rk = st.rank(pr.total); val r = st.retention()
    val scores = S.obj("done").values.mapNotNull { it.asObj()?.get("score").asNum() }
    val acc = if (scores.isNotEmpty()) (scores.sum() / scores.size).roundToInt() else 0
    Panel(header = "Status") {
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { RankEmblem(L.lv, 96.dp, rk.r) { app.open(Screen.Ranks) } }
        Muted("${rk.r}-Rank · Aura: ${Hero.auraName(L.lv)} · ${(Hero.aura(L.lv) * 100).roundToInt()}%${if (L.lv < Hero.AURA_FULL_LEVEL) " · full at level ${Hero.AURA_FULL_LEVEL}" else ""}", align = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        Gap()
        Row2 {
            Column(Modifier.weight(1f)) { Text(app.userName.uppercase(), color = pal.ink, fontSize = 22.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                Row2 { Muted(if (rk.next != null) "Next: ${rk.next}-Rank at ${rk.nextAt}% of A1" else "Highest rank", size = 13); LinkBtn("All ranks ›") { app.open(Screen.Ranks) } } }
            Column(horizontalAlignment = Alignment.End) { Muted("LEVEL", size = 12); Text("${L.lv}", color = pal.ink, fontSize = 34.sp, fontWeight = FontWeight.ExtraBold); Muted(if (L.a1) "A1 ✓" else "/${Store.A1_LEVEL}", size = 12) }
        }
        HBar(L.frac, height = 8.dp)
        Muted(if (L.a1) "A1 reached 🎓 · ${xpStr(L.xpInto)}/${xpStr(L.xpNeed)} XP to level ${L.lv + 1}" else "${fmt1(L.toNext)}% of A1 to level ${L.lv + 1} · A1 at level ${Store.A1_LEVEL}", size = 12)
        TileGrid(listOf(Triple("📖 Words", "${r.learned}", null), Triple("🏆 Mastered", "${r.mastered}", null),
            Triple("📐 Grammar", "${cd.content.grammar.count { g -> (cd.gparts[g.id] ?: listOf(g.id)).all { truthy(S.obj("done")[it]) } }}/${cd.content.grammar.size}", null),
            Triple("💬 Phrases", "${cd.content.phrases.count { truthy(S.obj("done")[it.id]) }}/${cd.content.phrases.size}", null),
            Triple("🔥 Streak", "${st.streak()}", null), Triple("🎯 Accuracy", "$acc%", null), Triple("⚡ Total XP", xpStr(st.totalXP()), null), Triple("📈 A1", "${fmt1(pr.total)}%", null)))
    }
}
@Composable
fun PaceChart(app: AppState, pc: Pace) {
    val st = app.store; val start = st.settings().str("startDate")!!; val target = st.settings().str("targetDate")!!; val t = st.today()
    var end = target
    pc.projected?.let { if (it > target) end = if (it > Dates.addDays(target, 60)) Dates.addDays(target, 60) else it }
    val span = maxOf(1, Dates.daysBetween(start, end)).toFloat()
    val hist = st.history()
    val p = pal
    Canvas(Modifier.fillMaxWidth().aspectRatio(340f / 190f).padding(vertical = 6.dp)) {
        val L = 30f * density / 2; val W = size.width; val H = size.height; val T = 10f; val Bm = 26f
        fun X(d: String) = L + (W - L - 10f) * (Dates.daysBetween(start, d) / span).coerceIn(0f, 1f)
        fun Y(v: Double) = T + (H - T - Bm) * (1 - v / 100).toFloat()
        listOf(0, 25, 50, 75, 100).forEach { v -> drawLine(p.line, Offset(L, Y(v.toDouble())), Offset(W - 10f, Y(v.toDouble())), 1f) }
        drawLine(p.amber, Offset(X(target), T), Offset(X(target), H - Bm), 2f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f, 6f)))
        drawLine(p.muted, Offset(X(start), Y(0.0)), Offset(X(target), Y(100.0)), 3f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(12f, 10f)))
        if (pc.projected != null && t >= start) {
            val pe = if (pc.projected!! <= end) pc.projected!! else end
            val py = if (pc.projected!! <= end) 100.0 else pc.actual + pc.actualPerDay * Dates.daysBetween(t, end)
            drawLine(Color(0xFFA970FF), Offset(X(t), Y(pc.actual)), Offset(X(pe), Y(py)), 4f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(3f, 8f)))
        }
        val path = androidx.compose.ui.graphics.Path(); var acc = 0.0; var px = X(start); var py0 = Y(0.0)
        hist.filter { it.first < start }.lastOrNull()?.let { acc = it.second; py0 = Y(acc) }
        path.moveTo(px, py0)
        for ((d, v) in hist) { if (d < start) continue; val x = X(d); path.lineTo(x, Y(acc)); path.lineTo(x, Y(v)); acc = v; px = x }
        if (t > start) path.lineTo(X(t), Y(acc))
        drawPath(path, p.ok, style = Stroke(5f))
        drawCircle(p.ok, 9f, Offset(X(t), Y(pc.actual)))
        val ex = (100.0 * Dates.daysBetween(start, t) / maxOf(1, Dates.daysBetween(start, target))).coerceIn(0.0, 100.0)
        drawCircle(p.muted, 6f, Offset(X(t), Y(ex)))
    }
}
@Composable
fun CalendarCard(app: AppState) {
    val st = app.store; val S = app.S!!; val t = st.today(); val cd = app.cd
    var month by remember { mutableStateOf(t.substring(0, 7)) }
    val first = "$month-01"; val fd = Dates.parse(first); val days = fd.lengthOfMonth(); val lead = (fd.dayOfWeek.value + 6) % 7
    fun tm(d: String) = (S.obj("time")[d] as? List<*>)?.map { it.asNum() ?: 0.0 } ?: listOf(0.0, 0.0)
    Panel {
        Row2 { B("📅 Activity", Modifier.weight(1f)); LinkBtn("‹") { month = Dates.iso(fd.minusMonths(1)).substring(0, 7) }; B(Dates.fmt(first, "MMM yyyy"), size = 14); LinkBtn("›") { if (month < t.substring(0, 7)) month = Dates.iso(fd.plusMonths(1)).substring(0, 7) } }
        Row(Modifier.fillMaxWidth()) { listOf("M", "T", "W", "T", "F", "S", "S").forEach { Muted(it, Modifier.weight(1f), size = 12, align = TextAlign.Center) } }
        val cells = List(lead) { null } + (1..days).map { "$month-${it.toString().padStart(2, '0')}" }
        cells.chunked(7).forEach { row -> Row(Modifier.fillMaxWidth()) { row.forEach { d ->
            Box(Modifier.weight(1f).aspectRatio(1f).padding(2.dp), contentAlignment = Alignment.Center) {
                if (d != null) {
                    val hit = st.dayCounts(d); val act = S.obj("xp").num(d) > 0 || tm(d)[0] > 0
                    Column(Modifier.fillMaxSize().clip(RoundedCornerShape(6.dp)).background(if (hit) pal.accent.copy(alpha = .8f) else Color.Transparent).border(if (d == t) 2.dp else 1.dp, if (act || d == t) pal.accent else pal.line.copy(alpha = .3f), RoundedCornerShape(6.dp))
                        .clickable {
                            val n = S.arr("log").count { l -> l.asObj()?.let { o -> o.str("d") == d && cd?.item?.containsKey(o.str("id")) == true } == true }; val h = S.ro("hit")[d]
                            app.toast("${Dates.fmt(d, "EEE d MMM")} · ${xpStr(S.obj("xp").num(d))} XP${if (h != null) " · goal ${xpStr(h.asNum() ?: 0.0)} ✓" else ""} · $n part${if (n == 1) "" else "s"}${if (tm(d)[0] > 0) " · ${(tm(d)[0] / 60).roundToInt()} min (${(tm(d)[1] / 60).roundToInt()} in lessons)" else ""}")
                        }, horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                        Text(d.takeLast(2).trimStart('0'), color = if (d > t) pal.muted else if (hit) Color.White else pal.ink, fontSize = 12.sp)
                        if (tm(d)[0] >= 60) Text("${(tm(d)[0] / 60).roundToInt()}m", color = if (hit) Color.White else pal.muted, fontSize = 8.sp)
                    }
                }
            }
        }; repeat(7 - row.size) { Box(Modifier.weight(1f)) } } }
        val all = S.obj("time").values.mapNotNull { (it as? List<*>)?.getOrNull(0).asNum() }.filter { it >= 60 }
        val goalDays = S.ro("hit").keys.map { tm(it)[0] }.filter { it >= 60 }
        TileGrid(listOf(Triple("Avg per active day", if (all.isNotEmpty()) "${(all.sum() / all.size / 60).roundToInt()} min" else "–", null),
            Triple("Avg on goal days", if (goalDays.isNotEmpty()) "${(goalDays.sum() / goalDays.size / 60).roundToInt()} min" else "–", null),
            Triple("Avg per lesson part", minPerPart(app)?.let { "$it min" } ?: "–", null)), 3)
        Muted("Filled = ${if (app.questMode) "daily goal reached" else "learned"} (counts for 🔥). Time counts while the app is open and you're using it. Tap a day for details.", size = 12)
    }
}

// ---------- ranks page ----------
@Composable
fun RanksScreen(app: AppState) {
    @Suppress("UNUSED_VARIABLE") val tk = app.tick
    val st = app.store; val pr = st.progress(); val pc = st.pace(); val L = st.level(pr.total); val cur = st.rank(pr.total).r
    val ci = Store.RANKS.indexOfFirst { it.first == cur }
    val lang = (app.course?.title ?: "A1").replace(Regex("\\s*A1$"), "")
    fun whenTxt(pct: Int): String = if (pc.actualPerDay > 0) "at your pace about ${Dates.fmt(Dates.addDays(st.today(), kotlin.math.ceil((pct - pr.total) / pc.actualPerDay).toInt()))}"
        else "on your plan ${Dates.fmt(Dates.addDays(st.settings().str("startDate")!!, (pct / 100.0 * pc.span).roundToInt()))}"
    ScreenColumn {
        LinkBtn("‹ Back") { app.back() }
        H1("Ranks")
        Panel {
            Row2 { RankEmblem(L.lv, 54.dp, cur); Column(Modifier.weight(1f)) { B("$cur-Rank · ${Hero.RANK_INFO[cur]!!.first}", size = 20); Muted("Level ${L.lv} · ${fmt1(pr.total)}% of A1 · Aura: ${Hero.auraName(L.lv)}", size = 13) } }
            Muted("Your rank is how much of $lang A1 you know: words you still remember (55%), grammar (30%) and phrases (15%). It climbs from E to S and the purple aura grows with every level. Forgotten words lower your %, so reviews keep your rank.", size = 13)
        }
        Store.RANKS.withIndex().reversed().forEach { (i, rp) ->
            val (r, pct) = rp; val stt = if (i < ci) "done" else if (i == ci) "me" else "lock"; val info = Hero.RANK_INFO[r]!!; val lv = Hero.lvAtPct(pct)
            Panel(highlight = stt == "me") {
                Row2 {
                    Box(Modifier.size(70.dp)) { RankEmblem(lv, 50.dp, r) }
                    Column(Modifier.weight(1f)) {
                        Row { Text("$r-Rank", color = Color(Hero.RANK_COLOR[r]!!), fontWeight = FontWeight.Black, fontSize = 16.sp); P(" · ${info.first}", size = 16) }
                        Muted("From $pct% of A1 · level $lv · Aura: ${Hero.auraName(lv)}", size = 12)
                        P(info.second.replace("{lang}", lang), size = 14)
                        Text(if (stt == "done") "✓ Reached" else if (stt == "me") "You are here" else "${fmt1(pct - pr.total)}% of A1 to go · ${whenTxt(pct)}", color = if (stt == "lock") pal.muted else pal.ok, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

// ---------- settings ----------
@Composable
fun SettingsScreen(app: AppState) {
    @Suppress("UNUSED_VARIABLE") val tk = app.tick
    val st = app.store; val set = st.settings(); val scope = rememberCoroutineScope()
    var dl by remember { mutableStateOf("") }
    ScreenColumn {
        Row2 { H1("Settings", Modifier.weight(1f)); UserChip(app) }
        Panel(header = "Mode") {
            B("⚔️ Quest Mode")
            Toggle("Follow the quest system", app.questMode) { on -> app.setSetting("quest", on); if (on) { app.S!!["penChecked"] = Dates.addDays(st.today(), -1); st.save() }; app.toast(if (on) "Quest Mode on" else "Quest Mode off – skill map") }
            Muted(if (app.questMode) "On: a guided day-by-day Path with a daily goal, daily quests, 💎 diamonds and streak gifts. Missed review days cost XP." else "Off: a skill map like the Software Engineering track: pick any skill and finish its parts at your own pace. No daily goal, quests or penalties. XP, level and reviews still count.", size = 13)
        }
        Panel(header = "Goal & pace") {
            var tgt by remember { mutableStateOf(set.str("targetDate") ?: "") }; var sd by remember { mutableStateOf(set.str("startDate") ?: "") }
            val daysLeft = Dates.daysBetween(st.today(), set.str("targetDate")!!)
            Field("Target completion date (YYYY-MM-DD)", tgt, { tgt = it.take(10) })
            Btn("Save target", kind = BtnKind.Ghost, small = true, enabled = tgt != set.str("targetDate")) {
                val ok = runCatching { Dates.parse(tgt) }.isSuccess
                if (!ok || tgt <= st.today()) app.toast("Pick a target date in the future") else if (tgt <= set.str("startDate")!!) app.toast("Target must be after the start date")
                else { app.setSetting("targetDate", tgt); app.toast("Target set to ${Dates.fmt(tgt, "d MMMM yyyy")}") }
            }
            Muted("${if (daysLeft > 0) "$daysLeft days left" else "Target date has passed"} · ${st.weekPlan().nWeeks} weeks planned (Mon–Sun). Changing the date re-spreads all lessons across the weeks.", size = 13)
            Field("Pace counted from (YYYY-MM-DD)", sd, { sd = it.take(10) })
            Btn("Save start date", kind = BtnKind.Ghost, small = true, enabled = sd != set.str("startDate")) { if (runCatching { Dates.parse(sd) }.isSuccess && sd < set.str("targetDate")!!) app.setSetting("startDate", sd) else app.toast("Start must be before the target") }
            Row2 { listOf("auto" to "Auto (recommended)", "manual" to "Manual – my own goal").forEach { (k, l) -> Box(Modifier.weight(1f)) { Btn(l, kind = if ((set["goalMode"] ?: "auto") == k || (k == "auto" && set["goalMode"] != "manual")) BtnKind.Primary else BtnKind.Ghost, small = true) {
                app.setSetting("goalMode", k); if (k == "manual" && set["dailyGoal"] == null) app.setSetting("dailyGoal", st.goalFor()) } } } }
            if (set["goalMode"] == "manual") {
                var g by remember { mutableStateOf(xpStr(set.num("dailyGoal", 20.0))) }
                Field("My daily goal (XP)", g, { g = it.filter { c -> c.isDigit() }.take(4); g.toDoubleOrNull()?.let { v -> app.setSetting("dailyGoal", maxOf(5.0, v)) } }, keyboard = androidx.compose.ui.text.input.KeyboardType.Number)
            } else P("Today's goal: ${xpStr(st.goalFor())} XP · about ${xpStr(st.remainingXP())} XP of lessons left over ${maxOf(1, Dates.daysBetween(st.today(), set.str("targetDate")!!) + 1)} days, plus daily reviews. It is set each morning and goes up if you fall behind, down if you get ahead.", size = 14)
            LinkBtn("How is XP measured?") { app.showSheet { XpHelp(app) } }
        }
        Panel(header = "Look & sound") {
            B("🎨 Theme", size = 15)
            THEMES.chunked(2).forEach { row -> Row2 { row.forEach { (id, l) -> Box(Modifier.weight(1f)) { Btn(l, kind = if (app.themeId() == id) BtnKind.Primary else BtnKind.Ghost, small = true) { app.setSetting("theme", id) } } } } }
            Toggle("Show Hindi pronunciation hints", set["hindi"] != false) { app.setSetting("hindi", it) }
            Toggle("Play audio automatically", set["autoplay"] != false) { app.setSetting("autoplay", it) }
            Toggle("Sounds on", set["sound"] != false) { app.setSetting("sound", it) }
            if (app.speakSupported) { Toggle("🎤 Speaking practice in phrase lessons", set["speak"] != false) { app.setSetting("speak", it) }
                Muted("Uses the phone's speech recognition (Google may process the audio). Optional, never costs XP.", size = 12) }
        }
        Panel(header = "Offline") {
            val ids = remember(app.cd) { audioIds(app) }
            B("📶 Offline"); Muted("Save all pronunciation clips on this phone so lessons work without internet. ${app.audio.savedCount(ids)} of ${ids.size} saved.", size = 13)
            Btn("Download all audio", kind = BtnKind.Ghost) { scope.launch { dl = "Starting…"; val (ok, fail) = app.audio.downloadAll(ids) { d, n, f -> dl = "$d / $n clips saved${if (f > 0) " ($f failed)" else ""}" }; dl = "✅ $ok clips saved for offline use${if (fail > 0) " · $fail failed – try again later" else ""}" } }
            if (dl.isNotEmpty()) Muted(dl)
        }
        Panel(header = "Invite") {
            B("🎁 Invite friends"); Muted("Learning is more fun with a party. Share LevelUp and compare progress.", size = 13)
            Btn("Share / invite") { shareApp(app) }
        }
        Panel(header = "Data") {
            B("💾 Backup")
            Muted(if (app.sync.isGuest) "Guest progress is saved only on this phone. Create an account to save it on the server." else "Progress is saved on the LevelUp server, with a daily backup. The web app and this app share the same progress.", size = 13)
            Btn("Copy backup to clipboard", kind = BtnKind.Ghost, small = true) {
                val cm = app.g.ctx.getSystemService(android.content.ClipboardManager::class.java); cm.setPrimaryClip(android.content.ClipData.newPlainText("LevelUp backup", st.exportState())); app.toast("Backup copied")
            }
            LinkBtn("Reset ${app.userName}'s progress…", color = pal.red) {
                app.showSheet {
                    H2("Reset ${app.userName}'s progress?"); Muted("All of ${app.userName}'s lessons, words, XP and streak will be deleted (yesterday's backup stays on the server). Copy a backup first if unsure.")
                    Btn("Delete all progress", kind = BtnKind.Red) { st.resetAll(); app.closeSheet(); app.resetStack(); app.changed() }
                    Btn("Cancel", kind = BtnKind.Ghost) { app.closeSheet() }
                }
            }
        }
        Panel(header = "Account") {
            if (app.sync.isGuest) { GuestNote(); Btn("Create free account") { app.authTab = "signup"; app.sync.signOut(); app.changed() }; Btn("Leave guest mode", kind = BtnKind.Ghost) { app.leaveGuest() } }
            else if (app.sync.auth == "on") {
                Row2 { Column(Modifier.weight(1f)) { B(app.userName); Muted("Logged in as ${app.user}", size = 13) }; Box(Modifier.size(width = 170.dp, height = 50.dp)) { Btn("Change password", kind = BtnKind.Ghost, small = true) { app.showSheet { PasswordSheet(app) } } } }
                Btn("Log out") { app.logout() }
            } else Btn("Switch learner", kind = BtnKind.Ghost) { app.showSheet { UserSheet(app) } }
        }
        Muted("LevelUp native ${de.com.levelup.app.BuildConfig.VERSION_NAME} · server ${app.g.api.base}", size = 11, align = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    }
}
/** the web's invite text (SHARE_TEXT in app.js) through the phone's share sheet */
fun shareApp(app: AppState) {
    val url = "https://levelrise.org/"
    val text = "LevelUp was made to learn German faster, because the usual apps felt too slow. It uses active recall: each word comes back for a quick test right before you'd forget it, timed by spaced-repetition research. And it's fast: no slow animations, no ads, no complicated reward system. Just short lessons that stick. Join me!" +
        "\n\n🌐 Web app (any phone or computer, nothing to install): $url\n📱 Android app (install the APK): ${url}download/levelup.apk" +
        "\n🍎 iOS instructions (iPhone): open the link in Safari, tap Share, then \"Add to Home Screen\". Download the picture guide (PDF): ${url}download/levelup-iphone-guide.pdf"
    val send = android.content.Intent(android.content.Intent.ACTION_SEND).setType("text/plain").putExtra(android.content.Intent.EXTRA_TEXT, text)
    runCatching { app.g.ctx.startActivity(android.content.Intent.createChooser(send, "Invite friends").addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)) }.onFailure { app.toast("No app to share with") }
}
fun audioIds(app: AppState): Set<String> {
    val cd = app.cd ?: return emptySet(); val ids = LinkedHashSet<String>()
    cd.words.forEach { w -> w.a?.let(ids::add); w.ex.forEach { e -> e.a?.let(ids::add) } }
    cd.content.grammar.forEach { g -> g.ex.forEach { e -> e.a?.let(ids::add) } }
    cd.content.phrases.forEach { p -> p.items.forEach { i -> i.a?.let(ids::add) } }
    return ids
}

// ---------- XP explainer, diamonds & gift boxes ----------
@Composable
fun XpHelp(app: AppState) {
    H2("⚡ How XP works")
    P("Learning something new earns the most. 1 XP per new word or phrase, plus bonuses for finishing parts and lessons. Reviews earn a little; forgetting costs XP.", size = 14)
    listOf("🔤 New word / 💬 new phrase" to "+1 each (first time, when the part is passed)", "✅ Part finished" to "+2 · +1 more if every first answer was right", "🏁 Whole lesson / phrase topic done" to "+5 bonus",
        "📐 Grammar part" to "+3 (+1 if perfect) · +5 when the chapter is done", "🔁 Review" to "+1 per 5 words recalled · 0 for Hard · −1 per 2 forgotten · +1 at ≥80 % recalled",
        "⛔ Missed review day" to "−3 XP (−1 more per 10 overdue words, max −10)", "🎤 Phrase spoken correctly" to "+1").forEach { (a, b) -> Row(Modifier.padding(vertical = 3.dp)) { P(a, Modifier.weight(1f), size = 14); B(b, Modifier.weight(1f), size = 13) } }
    P("Repeating a part you already finished gives +1. A failed part (under 60 % right) gives +1 for the effort. A quit lesson gives nothing.", size = 13)
    P("Daily goal = the XP you aim for each day. Streak = days in a row you reach your daily XP goal (with Quest Mode off: any XP that day).", size = 13)
    P("💎 Diamonds: +${Store.QUEST_GEMS} for clearing all three daily quests. Streak milestones (7, 14, 21, 30, 45, 60, 75, 90, 120, 150, 180, 365 days) give a gift box: Common 15–30 💎, Rare 40–80, Epic 100–180, Legendary 250–400.", size = 13)
    P("Level follows your A1 %, not XP: level 100 = A1 reached. After that every ${Store.POST_A1_XP} XP adds another level. Levels can drop: overdue words count 1/14 less every day (down to 25 %), a word marked \"Again\" counts half until you recall it.", size = 13)
    P("Reviews use active recall with SM-2 spacing (like Anki).", size = 13)
    Btn("Got it") { app.closeSheet() }
}
@Composable
fun GiftBox(tier: String, size: Int = 70) {
    val c = Color(android.graphics.Color.parseColor(Store.TIERS[tier]?.color ?: "#5aa9ff"))
    Box(Modifier.size(size.dp).clip(RoundedCornerShape(8.dp)).background(c.copy(alpha = .3f)).border(2.dp, c, RoundedCornerShape(8.dp)), contentAlignment = Alignment.Center) { Text("🎁", fontSize = (size * .5).sp) }
}
@Composable
fun GiftEarnedSheet(app: AppState, ids: List<String>) {
    val g = app.unopenedGifts().firstOrNull { it.str("id") == ids.last() } ?: return
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        SysHeader("🎁 Reward"); H2("${g.num("m").toInt()}-day streak!"); GiftBox(g.str("tier")!!, 90)
        P(if (ids.size > 1) "You earned ${ids.size} gift boxes." else "You earned a ${Store.TIERS[g.str("tier")]?.name} gift box.")
        Btn("Open now") { app.showSheet { OpenGiftSheet(app, g.str("id")!!) } }; Btn("Later", kind = BtnKind.Ghost) { app.closeSheet() }
    }
}
@Composable
fun OpenGiftSheet(app: AppState, id: String) {
    val g = app.S!!.arr("gifts").firstOrNull { it.asObj()?.str("id") == id }.asObj() ?: return
    var amt by remember { mutableStateOf<Int?>(null) }
    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
        Muted("${Store.TIERS[g.str("tier")]?.name?.uppercase()} GIFT BOX · ${g.num("m").toInt()}-DAY STREAK")
        Box(Modifier.clickable(enabled = amt == null) { amt = app.store.openGift(id); app.changed() }) { GiftBox(g.str("tier")!!, 120) }
        if (amt == null) Muted("Tap the box to open it") else { Text("💎 +$amt", fontSize = 40.sp, fontWeight = FontWeight.Black, color = pal.accent); Muted("New balance: ${app.gems()} 💎"); Btn("Collect") { app.closeSheet() } }
    }
}
@Composable
fun TreasureSheet(app: AppState) {
    val st = app.store; val S = app.S!!; val box = app.unopenedGifts(); val nm = st.nextMilestone(); val streak = st.streak()
    val prevM = (listOf(0) + Store.MILESTONES.filter { it <= streak }).last()
    SysHeader("XP & Diamonds")
    TileGrid(listOf(Triple("Total XP", "⚡ ${xpStr(st.totalXP())}", null), Triple("Diamonds", "💎 ${app.gems()}", null)))
    val g = st.goalFor(); val x = st.xpToday(); val wk = (0..6).sumOf { S.obj("xp").num(Dates.addDays(st.today(), -it)) }
    B("⚡ XP"); Muted("Today: ${xpStr(x)} / ${xpStr(g)} XP daily goal"); HBar(minOf(1.0, x / g), height = 8.dp); Muted("Last 7 days: ${xpStr(wk)} XP · 🔥 $streak-day streak")
    LinkBtn("How XP works ›") { app.showSheet { XpHelp(app) } }
    B("💎 Diamonds")
    if (box.isNotEmpty()) { B("🎁 Unopened gift boxes", size = 15); Row { box.forEach { b -> Column(Modifier.padding(4.dp).clickable { app.showSheet { OpenGiftSheet(app, b.str("id")!!) } }, horizontalAlignment = Alignment.CenterHorizontally) { GiftBox(b.str("tier")!!, 56); Muted("${b.num("m").toInt()}-day", size = 11) } } } }
    if (nm != null) { B("Next gift box: $nm-day streak (${Store.TIERS[Store.tierFor(nm)]?.name})", size = 15); HBar((streak - prevM).toDouble() / (nm - prevM), color = pal.amber, height = 8.dp); Muted("🔥 $streak / $nm days") } else Muted("You've collected every streak box. Legendary!")
    Muted("Daily quest cleared: +${Store.QUEST_GEMS} 💎 each day.", size = 13)
    S.arr("gemLog").takeLast(5).reversed().forEach { r -> val o = r.asObj()!!; Muted("${Dates.fmt(o.str("d")!!)} · +${o.num("n").toInt()} 💎 · ${o.str("why")}", size = 13) }
    Btn("Close") { app.closeSheet() }
}


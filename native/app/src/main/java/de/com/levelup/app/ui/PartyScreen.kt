package de.com.levelup.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.com.levelup.app.AppState
import de.com.levelup.app.Screen
import de.com.levelup.core.JObj
import de.com.levelup.core.Summary
import de.com.levelup.core.asArr
import de.com.levelup.core.asNum
import de.com.levelup.core.asObj
import de.com.levelup.core.deepCopy
import de.com.levelup.core.num
import de.com.levelup.core.obj
import de.com.levelup.core.ro
import de.com.levelup.core.str
import de.com.levelup.core.truthy
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.abs
import kotlin.math.roundToInt

/** Party tab: your party (members, join requests, comparison) or every party with "Request to join" (api/parties). */
@Composable
fun PartyScreen(app: AppState) {
    @Suppress("UNUSED_VARIABLE") val tk = app.tick
    LaunchedEffect(Unit) { app.refreshParty() }
    ScreenColumn {
        if (app.isTree) LinkBtn("‹ ${app.course?.title}") { app.back() }
        Row2 { H1("Party", Modifier.weight(1f)); UserChip(app) }
        if (app.sync.auth != "on" || app.sync.isGuest) { Panel { P("Parties need an account, so your party can see your progress."); if (app.sync.isGuest) Muted("You are using LevelUp as a guest. Sign up to join a party; your progress comes with you.") }; return@ScreenColumn }
        val P = app.party ?: run { Muted("Loading parties…"); return@ScreenColumn }
        val max = P.num("max", 10.0).toInt()
        val mine = P["mine"].asObj()
        if (mine != null) {
            val members = mine["members"].asArr()?.mapNotNull { it.asObj() } ?: emptyList()
            val reqs = mine["requests"].asArr()?.mapNotNull { it.asObj() } ?: emptyList()
            Panel(header = "Your party") {
                B("👥 ${mine.str("name")}", size = 20); Muted("${members.size} of $max members · any member can accept new people", size = 12)
                members.forEach { m -> Row2(Modifier.padding(vertical = 3.dp)) { Avatar(m.str("name") ?: "?", m.str("color") ?: app.sync.userInfo(m.str("id")).color, 28.dp); P((m.str("name") ?: "") + if (m.str("id") == app.user) " (you)" else "", size = 15) } }
            }
            if (reqs.isNotEmpty()) Panel(header = "Join requests") {
                reqs.forEach { r -> Row2 { Column(Modifier.weight(1f)) { B(r.str("name") ?: "", size = 15); Muted("asked ${r.str("at")?.take(10) ?: ""}", size = 12) }
                    Box(Modifier.width(96.dp)) { Btn("Accept", small = true, enabled = members.size < max) { app.partyAction("/${mine.str("id")}/accept", mapOf("uid" to r.str("id")), "Accepted. Welcome to the party!") } }
                    Box(Modifier.width(96.dp)) { Btn("Decline", kind = BtnKind.Ghost, small = true) { app.partyAction("/${mine.str("id")}/decline", mapOf("uid" to r.str("id"))) } } } }
            }
            if (members.size < 2) Panel { Muted("When someone joins, you'll compare XP, streaks and progress here. Tell friends to open Party and request to join ${mine.str("name")}.", size = 13) }
            else Compare(app)
            LinkBtn("Leave ${mine.str("name")}") { app.showSheet { H2("Leave ${mine.str("name")}?"); Muted("You'll stop seeing each other's progress. You can ask to join again later.")
                Btn("Leave the party") { app.closeSheet(); app.partyAction("/${mine.str("id")}/leave", okMsg = "You left ${mine.str("name")}.") }; Btn("Stay", kind = BtnKind.Ghost) { app.closeSheet() } } }
            return@ScreenColumn
        }
        Muted("A party is up to $max learners who see each other's progress. Ask to join one; any member can let you in. Or start your own.", size = 13)
        SysHeader("Parties")
        val list = P["parties"].asArr()?.mapNotNull { it.asObj() } ?: emptyList()
        if (list.isEmpty()) Panel { Muted("No parties yet. Start the first one.") }
        list.forEach { p -> Panel { Row2 { Column(Modifier.weight(1f)) { B("👥 ${p.str("name")}", size = 15); Muted("${p.num("count").toInt()} of $max members${if (truthy(p["full"])) " · full" else ""}", size = 12) }
            Box(Modifier.width(150.dp)) { if (truthy(p["requested"])) Btn("Requested · cancel", kind = BtnKind.Ghost, small = true) { app.partyAction("/${p.str("id")}/cancel") }
                else Btn("Request to join", small = true, enabled = !truthy(p["full"])) { app.partyAction("/${p.str("id")}/request", okMsg = "Request sent. A member will let you in.") } } } } }
        SysHeader("Start a party")
        var name by remember { mutableStateOf("") }
        Panel { Field("Party name, e.g. Family", name, { name = it.take(40) }); Btn("Start party") { if (name.trim().length < 2) app.toast("Give your party a name (2+ letters).") else app.partyAction("", mapOf("name" to name.trim()), "${name.trim()} started. Invite people to request to join.") } }
    }
}

/** the comparison table (fillCompare / treeCompare in app.js): the server returns you + your party members only */
@Composable
private fun Compare(app: AppState) {
    var all by remember { mutableStateOf<Map<String, JObj?>?>(null) }
    LaunchedEffect(app.tick) { val r = withContext(Dispatchers.IO) { app.sync.fetchAllStates() }; all = r.toMutableMap().also { m -> app.user?.let { u -> m[u] = app.S } } }
    val states = all ?: return
    val ids = states.keys.toList(); if (ids.size < 2) return
    val names = ids.map { id -> app.sync.userInfo(id) }
    Panel(header = if (app.isTree) app.course?.title else "Party") {
        Row(Modifier.horizontalScroll(rememberScrollState())) {
            Column {
                val rows: List<Pair<String, List<String>>>
                if (app.isTree) {
                    val t = app.store.today()
                    val data = ids.map { id -> val st = states[id] ?: linkedMapOf(); listOf(st.ro("xp")[t].asNum() ?: 0.0, st.ro("xp").values.sumOf { it.asNum() ?: 0.0 }, st.ro("tree").size.toDouble(), st.ro("quiz").values.count { truthy(it.asObj()?.get("xp")) }.toDouble()) }
                    rows = listOf("XP today", "Total XP", "Skills learned", "Practice passed").mapIndexed { k, l -> l to data.map { xpStr(it[k]) } }
                } else {
                    val sm: List<Summary?> = ids.map { id -> states[id]?.let { app.store.summary(deepCopy(it) as JObj) } }
                    fun f(sel: (Summary) -> String) = sm.map { it?.let(sel) ?: "–" }
                    rows = listOf("Level · Rank" to f { "Lv ${it.lv} ${it.rank}" }, "XP today" to f { "${xpStr(it.xpToday)}/${xpStr(it.goal)}" }, "Diamonds" to f { "💎 ${xpStr(it.gems)}" },
                        "Total XP" to f { xpStr(it.xp) }, "Streak" to f { "🔥 ${it.streak}" }, "Lessons done" to f { "${it.lessons}/${it.of}" }, "Words learned" to f { "${it.words}" },
                        "A1 complete" to f { "${fmt1(it.pct)}%" }, "Pace (lessons)" to f { if (abs(it.gapLessons) < 1) "on track" else if (it.gapLessons > 0) "+${it.gapLessons.roundToInt()}" else "${it.gapLessons.roundToInt()}" })
                }
                Row { Box(Modifier.width(120.dp)); names.forEach { u -> Column(Modifier.width(86.dp), horizontalAlignment = Alignment.CenterHorizontally) { Avatar(u.name, u.color, 28.dp); Text(u.name, color = pal.ink, fontSize = 11.sp) } } }
                rows.forEach { (label, vals) -> Row(Modifier.padding(vertical = 4.dp)) { Muted(label, Modifier.width(120.dp), size = 13); vals.forEach { v -> Text(v, Modifier.width(86.dp), color = pal.ink, fontWeight = FontWeight.Bold, fontSize = 14.sp, textAlign = TextAlign.Center) } } }
            }
        }
    }
}

/** 🐞 feedback: note + screen snapshot → /api/bugs (queued on the phone while offline); keeps a draft */
@Composable
fun BugSheet(app: AppState) {
    var kind by remember { mutableStateOf(app.g.kv.get("a1.bugDraftKind") ?: "bug") }
    var text by remember { mutableStateOf(app.g.kv.get("a1.bugDraft") ?: "") }
    var busy by remember { mutableStateOf(false) }
    val page = when (val t = app.top) { de.com.levelup.app.Screen.Lesson -> app.run?.let { "Lesson: ${it.title} · step ${it.i + 1}/${it.total} (${it.step?.javaClass?.simpleName})" } ?: "lesson"; null -> "start"; else -> t.toString() }
    H2("Send feedback"); Muted("What happened, or what would make LevelUp better? A snapshot of this screen is sent with it.", size = 13)
    Row2 { listOf("bug" to "🐞 Bug", "content" to "📝 Content", "idea" to "💡 Idea").forEach { (k, l) -> Box(Modifier.weight(1f)) { Btn(l, kind = if (kind == k) BtnKind.Primary else BtnKind.Ghost, small = true) { kind = k; app.g.kv.set("a1.bugDraftKind", k) } } } }
    Field("Your note", text, { text = it.take(4000); app.g.kv.set("a1.bugDraft", text.ifBlank { null }) }, singleLine = false)
    Muted("Screen: $page", size = 12)
    Btn(if (busy) "Sending…" else "Send", enabled = text.isNotBlank() && !busy) {
        busy = true
        app.sendBug(kind, text.trim(), page) { ok -> busy = false; app.g.kv.set("a1.bugDraft", null); app.closeSheet(); app.toast(if (ok) "Thanks! Feedback sent." else "Saved on this phone; it will be sent when you're online.") }
    }
    Btn("Cancel", kind = BtnKind.Ghost) { app.closeSheet() }
}


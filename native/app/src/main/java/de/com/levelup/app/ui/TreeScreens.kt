package de.com.levelup.app.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.com.levelup.app.AppState
import de.com.levelup.app.Screen
import de.com.levelup.core.Branch
import de.com.levelup.core.Chapter
import de.com.levelup.core.ContentParser
import de.com.levelup.core.Dates
import de.com.levelup.core.QuizQ
import de.com.levelup.core.Tree
import de.com.levelup.core.TreeNode
import de.com.levelup.core.ro
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin
import kotlin.math.sqrt

fun brColor(b: Branch) = runCatching { Color(android.graphics.Color.parseColor(b.color)) }.getOrDefault(Color(0xFF5AA9FF))
fun chapterPath(b: Branch, ch: Int) = "${b.reading}${ch.toString().padStart(2, '0')}.json"

/** a chapter from the server, kept on the phone for offline reading (refetched when [fresh]) */
suspend fun AppState.loadChapter(b: Branch, ch: Int, fresh: Boolean = false): Chapter? {
    if (b.reading == null) return null
    val path = chapterPath(b, ch)
    if (!fresh) chapters[path]?.let { return it }
    val txt = withContext(Dispatchers.IO) { g.content.chapter(path, fresh) } ?: return null
    return runCatching { ContentParser.chapter(txt) }.getOrNull()?.also { chapters[path] = it }
}

@Composable
fun TreeTopRow(app: AppState) = Row2(Modifier.padding(bottom = 8.dp)) { UserChip(app); CourseChip(app); Box(Modifier.weight(1f)); B("⚡ ${xpStr(app.store.totalXP())}", size = 14) }

@Composable
fun TreeHomeScreen(app: AppState) {
    @Suppress("UNUSED_VARIABLE") val tk = app.tick
    val tr = app.tree ?: return; val T = tr.t
    val brs = tr.openBranches(); val all = brs.flatMap { tr.nodes(it.id) }; val done = all.count { tr.nodeDone(it.id) }; val ct = tr.continueTarget()
    ScreenColumn {
        TreeTopRow(app)
        B(T.title, size = 21); Muted("${brs.size} branches open · $done of ${all.size} skills learned")
        if (ct != null) Panel(highlight = true) {
            Muted("${if (ct.fresh) "Start here" else "Continue"} · ${ct.br.icon} ${ct.br.title}", size = 13)
            B("Skill ${ct.n.n} · ${ct.n.title}", size = 18)
            val lbl = tr.readLabel(ct.n, "open").removePrefix("📖 ")
            Muted("$lbl · about ${ct.n.mins} min", size = 12)
            Btn(if (ct.fresh || lbl.startsWith("Start")) "Start" else "Continue") { app.open(Screen.Branch(ct.br.id)); app.open(Screen.Reader(ct.br.id, ct.n.id, null)) }
        } else if (brs.isNotEmpty()) Panel { B("👑 Every open branch is complete"); Muted("New branches are on the way.") }
        SysHeader("Your branches")
        brs.chunked(2).forEach { row -> Row(Modifier.fillMaxWidth()) { row.forEach { b ->
            val ns = tr.nodes(b.id); val d = ns.count { tr.nodeDone(it.id) }; val nx = tr.nextNode(b)
            Box(Modifier.weight(1f).padding(4.dp)) { Panel(onClick = { app.open(Screen.Branch(b.id)) }) {
                Row2 { Ring(tr.branchFrac(b), 46.dp, brColor(b)) { Text(b.icon, fontSize = 18.sp) }; Box(Modifier.weight(1f)); Muted("$d/${ns.size}", size = 12) }
                B(b.title, size = 15); Muted(if (nx != null) "Next: ${nx.title}" else if (d == ns.size) "👑 Complete" else "", size = 12)
            } }
        }; if (row.size < 2) Box(Modifier.weight(1f)) } }
        Panel(onClick = { app.open(Screen.Party) }) { Row2 { Text("👥", fontSize = 26.sp); Column(Modifier.weight(1f)) { B("Party"); Muted("Compare progress with your party", size = 12) }; Text("›") } }
        val soon = tr.soonBranches()
        if (soon.isNotEmpty()) { SysHeader("Coming soon"); FlowChips(soon.map { "${it.icon} ${it.title}" }) { i -> val s = soon[i]; app.showSheet { H2("${s.icon} ${s.title}"); Muted("Coming soon. Planned skills:"); s.planned.forEachIndexed { k, p -> P("${k + 1}. $p", size = 14) }; Btn("Close", kind = BtnKind.Ghost) { app.closeSheet() } } } }
    }
}

@Composable
fun BranchScreen(app: AppState, id: String) {
    @Suppress("UNUSED_VARIABLE") val tk = app.tick
    val tr = app.tree ?: return; val brs = tr.openBranches(); val i = brs.indexOfFirst { it.id == id }.coerceAtLeast(0); val br = brs.getOrNull(i) ?: return
    val nodes = tr.nodes(br.id); val done = nodes.count { tr.nodeDone(it.id) }
    var lay by remember { mutableStateOf(app.g.kv.get("a1.treeLayout") ?: "map") }
    val go = { b: Branch -> app.stack[app.stack.size - 1] = Screen.Branch(b.id) }
    val prev = brs[(i + brs.size - 1) % brs.size]; val next = brs[(i + 1) % brs.size]
    var drag = 0f
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 14.dp, vertical = 12.dp)
        .pointerInput(br.id) { detectHorizontalDragGestures(onDragEnd = { if (drag < -120) go(next) else if (drag > 120) go(prev); drag = 0f }) { _, dx -> drag += dx } }) {
        TreeTopRow(app)
        LinkBtn("‹ All branches") { app.back() }
        if (brs.size > 1) Row2 { LinkBtn("‹") { go(prev) }; Row(Modifier.weight(1f), horizontalArrangement = Arrangement.Center) { brs.forEachIndexed { k, b -> Box(Modifier.padding(3.dp).size(8.dp).clip(CircleShape).background(if (k == i) brColor(b) else pal.line)) } }; LinkBtn("›") { go(next) } }
        Panel {
            Row2 { Column(Modifier.weight(1f)) { B("${br.icon} ${br.title}"); Muted("$done of ${nodes.size} skills learned · about ${nodes.sumOf { it.mins }} min of reading", size = 13) }
                if (br.intro != null) Box(Modifier.width(110.dp)) { Btn("📖 About", kind = BtnKind.Ghost, small = true) { app.open(Screen.Reader(br.id, null, null)) } } }
            HBar(done.toDouble() / maxOf(1, nodes.size), color = brColor(br), height = 8.dp)
            Row2 { listOf("map" to "◎ Map", "path" to "↓ Path").forEach { (k, l) -> Box(Modifier.weight(1f)) { Btn(l, kind = if (lay == k) BtnKind.Primary else BtnKind.Ghost, small = true) { lay = k; app.g.kv.set("a1.treeLayout", k) } } } }
            if (br.reading != null) DownloadBar(app, br)
        }
        if (lay == "map") TreeOrbit(app, tr, nodes, br) else TreePath(app, tr, nodes, br)
        if (brs.size > 1) Muted("‹ ${prev.title} · swipe · ${next.title} ›", Modifier.fillMaxWidth(), size = 12, align = TextAlign.Center)
        Box(Modifier.height(60.dp))
    }
}

@Composable
private fun DownloadBar(app: AppState, br: Branch) {
    val scope = rememberCoroutineScope()
    var idx by remember(br.id) { mutableStateOf<de.com.levelup.core.ChapterIndex?>(null) }
    var busy by remember { mutableStateOf(false) }; var ver by remember { mutableStateOf(0) }
    LaunchedEffect(br.id) { idx = withContext(Dispatchers.IO) { (app.g.content.chapter(br.reading + "index.json"))?.let { runCatching { ContentParser.index(it) }.getOrNull() } } }
    val ix = idx ?: return
    @Suppress("UNUSED_VARIABLE") val v = ver
    val chs = ix.chapters.keys.toList(); val total = ix.chapters.values.sumOf { it.bytes }
    val have = chs.filter { app.g.content.isSaved(chapterPath(br, it.toInt())) }
    val kb = { b: Int -> if (b < 1024) "$b B" else "${b / 1024} KB" }
    Row2 { Muted("📥 Saved on this phone: ${have.size}/${chs.size} reading files (${kb(have.sumOf { ix.chapters[it]!!.bytes })} of ${kb(total)})", Modifier.weight(1f), size = 12)
        if (have.size < chs.size) LinkBtn(if (busy) "…" else "Download all") { busy = true; scope.launch { chs.forEach { app.loadChapter(br, it.toInt(), fresh = !app.g.content.isSaved(chapterPath(br, it.toInt()))) }; busy = false; ver++; app.toast("Saved for offline reading") } }
        if (have.isNotEmpty()) LinkBtn("Remove") { chs.forEach { c -> app.chapters.remove(chapterPath(br, c.toInt())); java.io.File(app.g.ctx.filesDir, "web/" + chapterPath(br, c.toInt())).delete() }; ver++; app.toast("Downloads removed") } }
}

private fun wrapT(t: String, w: Int = 15): List<String> { val out = mutableListOf(""); t.split(" ").forEach { x -> if ((out.last() + " " + x).trim().length > w) out.add(x) else out[out.size - 1] = (out.last() + " " + x).trim() }; return out.take(if (w < 15) 3 else 2) }

/** one skill bubble (circle, part ring, icon / lock, check) at canvas position x,y (in the 340-wide layout space) */
@Composable
private fun NodeBubble(app: AppState, tr: Tree, n: TreeNode, color: Color, x: Float, y: Float, scale: Float, label: Triple<Float, Float, String>) {
    val st = tr.state(n); val r = if (n.boss) 30f else 26f; val P = tr.parts(n)
    Box(Modifier.offset(((x - r - 6) * scale).dp, ((y - r - 6) * scale).dp)) {
        PartRing(P?.indices?.map { tr.partDone(n, it) } ?: emptyList(), ((r + 6) * 2 * scale).dp, color) {
            Box(Modifier.size((r * 2 * scale).dp).clip(CircleShape).background(if (st == "done") color else if (st == "open") color.copy(alpha = .25f) else pal.card)
                .border(if (st == "open") 3.dp else 1.5.dp, if (st == "locked") pal.line else color, CircleShape).clickable { app.showSheet { NodeSheet(app, tr, n) } }, contentAlignment = Alignment.Center) {
                Text(if (st == "locked") "🔒" else n.icon, fontSize = (20 * scale).sp)
            }
            if (st == "done") Box(Modifier.align(Alignment.TopEnd).size(16.dp).clip(CircleShape).background(Color(0xFF57E3A0)), contentAlignment = Alignment.Center) { Text("✓", color = Color(0xFF0B1222), fontSize = 10.sp, fontWeight = FontWeight.Black) }
        }
    }
    val (lx, ly, anchor) = label
    val lines = wrapT(n.title, if (anchor == "middle") 15 else 12)
    val wpx = 110f
    Column(Modifier.offset(((if (anchor == "middle") lx - wpx / 2 else if (anchor == "end") lx - wpx else lx) * scale).dp, ((ly - 10) * scale).dp).width((wpx * scale).dp),
        horizontalAlignment = if (anchor == "middle") Alignment.CenterHorizontally else if (anchor == "end") Alignment.End else Alignment.Start) {
        lines.forEach { Text(it, color = if (st == "locked") pal.muted else pal.ink, fontSize = (11 * scale).sp, lineHeight = (13 * scale).sp, textAlign = if (anchor == "middle") TextAlign.Center else if (anchor == "end") TextAlign.End else TextAlign.Start) }
    }
}

@Composable
private fun TreePath(app: AppState, tr: Tree, nodes: List<TreeNode>, br: Branch) {
    val W = 340f; val top = 44f; val gapY = 116f; val X = { c: Int -> listOf(62f, 170f, 278f)[c.coerceIn(0, 2)] }; val Y = { l: Int -> top + l * gapY }
    val H = Y(nodes.maxOfOrNull { it.level } ?: 0) + 70f; val color = brColor(br); val by = nodes.associateBy { it.id }; val p = pal
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val scale = maxWidth.value / W
        Box(Modifier.fillMaxWidth().height((H * scale).dp)) {
            Canvas(Modifier.matchParentSize()) {
                val k = size.width / W
                for (n in nodes) for (rq in n.req) { val pr = by[rq] ?: continue
                    val x1 = X(pr.col) * k; val y1 = (Y(pr.level) + 36 + wrapT(pr.title).size * 13 + 6) * k; val x2 = X(n.col) * k; val y2 = (Y(n.level) - 38) * k; val my = (y1 + y2) / 2
                    drawPath(Path().apply { moveTo(x1, y1); cubicTo(x1, my, x2, my, x2, y2) }, if (tr.nodeDone(rq)) color else p.line, style = Stroke(3f * k)) }
            }
            nodes.forEach { n -> NodeBubble(app, tr, n, color, X(n.col), Y(n.level), scale, Triple(X(n.col), Y(n.level) + 51, "middle")) }
        }
    }
}

@Composable
private fun TreeOrbit(app: AppState, tr: Tree, nodes: List<TreeNode>, br: Branch) {
    val ns = nodes.sortedBy { it.n }; val N = ns.size; val color = brColor(br); val p = pal
    val W = 380f; val cx = 190f; val a = 84f; val gap = 86f; val padT = 84f; val padB = 70f
    val per = { b: Float -> (Math.PI * (3 * (a + b) - sqrt(((3 * a + b) * (a + 3 * b)).toDouble()))).toFloat() }
    var b = 150f; while (per(b) < N * gap) b += 5
    val cy = padT + b; val H = cy + b + padB
    val S2 = 720; val pts = ArrayList<Pair<Float, Float>>(); val cum = ArrayList<Float>()
    for (k in 0..S2) { val t = -Math.PI / 2 + 2 * Math.PI * k / S2; pts.add((cx + a * cos(t)).toFloat() to (cy + b * sin(t)).toFloat()); cum.add(if (k == 0) 0f else cum[k - 1] + hypot(pts[k].first - pts[k - 1].first, pts[k].second - pts[k - 1].second)) }
    val L = cum[S2]; val at = { s: Float -> var k = cum.indexOfFirst { it >= s }; if (k < 0) k = S2; pts[k] }
    val pos = ns.mapIndexed { k, n -> n.id to at(L * k / maxOf(1, N)) }.toMap()
    val fr = tr.branchFrac(br); val done = ns.count { tr.nodeDone(it.id) }
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val scale = maxWidth.value / W
        Box(Modifier.fillMaxWidth().height((H * scale).dp)) {
            Canvas(Modifier.matchParentSize()) {
                val k = size.width / W
                for (n in ns) { val (x, y) = pos[n.id]!!; val lit = tr.nodeDone(n.id); val near = !lit && tr.nodeOpen(n)
                    drawLine(if (lit) color.copy(alpha = .7f) else if (near) color.copy(alpha = .35f) else p.line.copy(alpha = .4f), Offset(cx * k, cy * k), Offset(x * k, y * k), 2f * k) }
                for (i in 0 until N - 1) { val s0 = L * i / N + 34; val s1 = L * (i + 1) / N - 34; val k0 = cum.indexOfFirst { it >= s0 }; val k1 = cum.indexOfFirst { it >= s1 }
                    if (k0 >= 0 && k1 > k0) { val path = Path(); pts.subList(k0, k1 + 1).forEachIndexed { j, (x, y) -> if (j == 0) path.moveTo(x * k, y * k) else path.lineTo(x * k, y * k) }
                        drawPath(path, if (tr.nodeDone(ns[i].id)) color else p.line, style = Stroke(3f * k)) } }
                drawCircle(p.line.copy(alpha = .5f), 38 * k, Offset(cx * k, cy * k), style = Stroke(5f * k))
                drawArc(color, -90f, 360f * fr.toFloat(), false, Offset((cx - 38) * k, (cy - 38) * k), androidx.compose.ui.geometry.Size(76 * k, 76 * k), style = Stroke(5f * k))
                drawCircle(p.card, 32 * k, Offset(cx * k, cy * k))
            }
            Column(Modifier.offset(((cx - 32) * scale).dp, ((cy - 22) * scale).dp).width((64 * scale).dp).clickable(enabled = br.intro != null) { app.open(Screen.Reader(br.id, null, null)) }, horizontalAlignment = Alignment.CenterHorizontally) {
                Text(br.icon, fontSize = (20 * scale).sp); Text("$done / $N", color = pal.ink, fontSize = (11 * scale).sp)
            }
            ns.forEach { n ->
                val (x, y) = pos[n.id]!!; val off = x - cx; val r = if (n.boss) 30f else 26f; val lines = wrapT(n.title, if (kotlin.math.abs(off) >= 30) 12 else 15).size
                val lab = if (kotlin.math.abs(off) < 30) (if (y < cy) Triple(x, y - r - 14 - (lines - 1) * 13, "middle") else Triple(x, y + r + 22, "middle"))
                    else Triple(if (off < 0) x - r - 10 else x + r + 10, y + 4 - (lines - 1) * 6.5f, if (off < 0) "end" else "start")
                NodeBubble(app, tr, n, color, x, y, scale, lab)
            }
        }
    }
}

@Composable
fun NodeSheet(app: AppState, tr: Tree, n: TreeNode) {
    val st = tr.state(n); val need = n.req.filter { !tr.nodeDone(it) }.mapNotNull { tr.node(it)?.title }
    val dependents = tr.t.nodes.filter { it.req.contains(n.id) && tr.nodeDone(it.id) }
    val br = tr.branch(n.branch)!!
    Row2 { Text(n.icon, fontSize = 34.sp); Column(Modifier.weight(1f)) { Muted("SKILL ${n.n} · ABOUT ${n.mins} MIN", size = 12); H2(n.title) } }
    if (st == "locked") Panel { P("🔒 Unlocks after: ${need.joinToString(", ")}", size = 14) }
    B("What you'll learn", Modifier.padding(top = 10.dp), size = 15); n.learn.forEach { P("• $it", size = 14) }
    B("Key ideas", Modifier.padding(top = 10.dp), size = 15); FlowChips(n.concepts)
    tr.parts(n)?.let { P ->
        B("Parts · ${tr.partsDoneCount(n)} of ${P.size} done · do them in any order", Modifier.padding(top = 10.dp), size = 15)
        P.forEachIndexed { k, part -> PartRow(k, tr.partDone(n, k), part.t.joinToString(" · ") + " · ${part.b - part.a + 1} cards") { if (st != "locked") { app.closeSheet(); app.open(Screen.Reader(br.id, n.id, k)) } } }
    }
    if (n.quiz > 0) {
        val r = tr.quizBest(n, "quiz")
        B("Practice · ${n.quiz} questions · ${r?.let { "best ${it["best"].let { b -> (b as Number).toInt() }}/${(it["of"] as Number).toInt()}" } ?: "+${Tree.QUIZ_XP} XP at 80 %"}", Modifier.padding(top = 10.dp), size = 15)
        Btn("🧠 ${if (r != null) "Practise again" else "Practise"}", kind = BtnKind.Ghost, enabled = st != "locked") { app.closeSheet(); app.open(Screen.Quiz(n.id, "quiz", null)) }
        if (n.cc > 0) { val c = tr.quizBest(n, "cc")
            B("Concept check · ${n.cc} questions · ${c?.let { "best ${(it["best"] as Number).toInt()}/${(it["of"] as Number).toInt()}" } ?: "+${Tree.QUIZ_XP} XP at 80 %"}", Modifier.padding(top = 10.dp), size = 15)
            Muted("Why it works, not just how: common mistakes, spot the wrong step, always or never true. Misses point to the skill to revisit.", size = 12)
            Btn("🔍 ${if (c != null) "Check again" else "Check my understanding"}", kind = BtnKind.Ghost, enabled = st != "locked") { app.closeSheet(); app.open(Screen.Quiz(n.id, "cc", null)) } }
    } else { B("Exercises (coming soon)", Modifier.padding(top = 10.dp), size = 15); FlowChips(n.exercises) }
    if (st != "locked") Btn(tr.readLabel(n, st)) { app.closeSheet(); app.open(Screen.Reader(br.id, n.id, null)) }
    if (st == "done") { Panel { P("✅ Learned on ${Dates.fmt(app.S!!.ro("tree")[n.id] as String)}", size = 14) }; if (dependents.isEmpty()) LinkBtn("Undo") { tr.undo(n.id); app.closeSheet(); app.changed() } }
    Btn("Close", kind = BtnKind.Ghost) { app.closeSheet() }
}

@Composable
fun ReaderScreen(app: AppState, s: Screen.Reader) {
    val tr = app.tree ?: return; val br = tr.branch(s.branch) ?: return; val n = s.node?.let { tr.node(it) }
    var ch by remember(s) { mutableStateOf<Chapter?>(null) }; var failed by remember(s) { mutableStateOf(false) }
    LaunchedEffect(s) { ch = app.loadChapter(br, n?.chapter ?: br.intro ?: 0); if (ch == null) failed = true }
    if (failed) { Column(Modifier.padding(20.dp)) { Muted("No connection, so this skill can't download right now. Try again when you're online."); Btn("Back") { app.back() } }; return }
    val c = ch ?: run { Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Muted("Loading…") }; return }
    val rd = remember(c) { tr.Reader(br, n, c, s.part) }
    var i by remember(rd) { mutableStateOf(rd.i) }
    @Suppress("UNUSED_VARIABLE") val tk = app.tick
    val card = c.cards[i]
    var drag = 0f
    Column(Modifier.fillMaxSize().pointerInput(rd) { detectHorizontalDragGestures(onDragEnd = { if (drag < -120 && !rd.last) { rd.next(); i = rd.i } else if (drag > 120) { rd.back(); i = rd.i }; drag = 0f }) { _, dx -> drag += dx } }) {
        Row2(Modifier.padding(horizontal = 14.dp, vertical = 8.dp)) {
            Text("✕", Modifier.clickable { app.back() }.padding(8.dp), color = pal.muted, fontSize = 22.sp)
            HBar(rd.pct / 100, Modifier.weight(1f)); Muted("${i - rd.a + 1} / ${rd.b - rd.a + 1}", size = 12)
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
            Muted(if (n != null) "${n.icon} ${n.title}${rd.parts?.let { " · Part ${rd.k!! + 1} of ${it.size}" } ?: ""}" else "${br.icon} ${br.title}", size = 13)
            H2(card.s); card.sub?.let { Muted(it) }
            Gap(6)
            HtmlBlock(card.html, app.g.api.base + (br.reading ?: ""))
            Gap(30)
        }
        Row2(Modifier.padding(14.dp)) {
            Box(Modifier.weight(1f)) { Btn("‹ Back", kind = BtnKind.Ghost, enabled = i > rd.a) { rd.back(); i = rd.i } }
            Box(Modifier.weight(1f)) { Btn(if (rd.last) rd.finishLabel() else "Next ›") {
                if (!rd.last) { rd.next(); i = rd.i; return@Btn }
                val msg = rd.finish(); msg?.let { app.toast(it) }
                app.back()
                if (n != null && rd.parts != null && !tr.nodeDone(n.id) && rd.counting) app.showSheet { NodeSheet(app, tr, n) }
                app.changed()
            } }
        }
    }
}

@Composable
fun QuizScreen(app: AppState, s: Screen.Quiz) {
    val tr = app.tree ?: return; val n = tr.node(s.node) ?: return; val br = tr.branch(n.branch) ?: return
    var qs by remember(s) { mutableStateOf<List<QuizQ>?>(null) }; var failed by remember(s) { mutableStateOf(false) }
    LaunchedEffect(s) {
        var ch = app.loadChapter(br, n.chapter)
        val want = if (s.mode == "cc") n.cc else n.quiz
        if (ch != null && want > 0 && (if (s.mode == "cc") ch.concept else ch.quiz).size != want) ch = app.loadChapter(br, n.chapter, fresh = true) ?: ch   // the skill map is newer than the saved chapter
        val list = ch?.let { if (s.mode == "cc") it.concept else it.quiz }
        if (list.isNullOrEmpty()) failed = true else qs = list
    }
    if (failed) { Column(Modifier.padding(20.dp)) { Muted(if (s.mode == "cc") "No concept check for this skill yet." else "No practice questions for this skill yet."); Btn("Back") { app.back() } }; return }
    val QS = qs ?: return
    val asked = remember(QS) { s.only ?: QS.indices.toList() }
    var i by remember(QS) { mutableStateOf(0) }
    val res = remember(QS) { mutableStateListOf<Boolean?>().apply { repeat(asked.size) { add(null) } } }
    var result by remember(QS) { mutableStateOf<Tree.QuizResult?>(null) }
    result?.let { r ->
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Gap(30); Text(if (r.got == r.of) "🏆" else if (r.got >= Math.ceil(Tree.QUIZ_PASS * r.of)) "🎯" else "💪", fontSize = 54.sp)
            H2("${r.got} of ${r.of} right")
            Muted(if (r.xp > 0) "+${r.xp} XP · ${if (s.mode == "cc") "concept check" else "practice"} passed" else if (r.got == r.of) "Perfect." else "Have another go at the ones you missed.")
            if (s.only == null && r.best > 0) Muted("Your best: ${r.best}/${QS.size}", size = 12)
            if (r.gaps.isNotEmpty()) Panel { B("🧱 Foundations to revisit"); Muted("Your misses come from these earlier skills. A quick reread usually fixes the rest.", size = 12)
                r.gaps.forEach { (g, c) -> PartRow(0, false, "${g.icon} ${g.title} · $c miss${if (c > 1) "es" else ""}") { app.back(); app.stack[app.stack.size - 1] = Screen.Branch(g.branch); app.showSheet { NodeSheet(app, tr, g) } } } }
            val wrong = asked.filterIndexed { k, _ -> res[k] != true }
            Row2 { if (wrong.isNotEmpty()) Box(Modifier.weight(1f)) { Btn("Retry ${wrong.size} missed", kind = BtnKind.Ghost) { app.stack[app.stack.size - 1] = Screen.Quiz(n.id, s.mode, wrong) } }
                Box(Modifier.weight(1f)) { Btn("Back to the skill") { app.back(); app.showSheet { NodeSheet(app, tr, n) } } } }
        }
        return
    }
    val q = QS[asked[i]]
    val kind = when (q.t) { "mc" -> if (s.mode == "cc") "Concept check" else "Pick one"; "mf" -> "Myth or fact"; "tf" -> "True or false"; "asn" -> "Always, sometimes or never?"; "step" -> "Find the mistake"; else -> "Work it out" }
    val answered = res[i] != null
    var num by remember(i, QS) { mutableStateOf("") }
    val order = remember(i, QS) { if (q.t == "mc") q.o.indices.shuffled() else emptyList() }
    var picked by remember(i, QS) { mutableStateOf<Any?>(null) }
    val pick = { v: Any -> if (!answered) { picked = v; res[i] = tr.quizRight(q, v) } }
    Column(Modifier.fillMaxSize()) {
        Row2(Modifier.padding(horizontal = 14.dp, vertical = 8.dp)) { Text("✕", Modifier.clickable { app.back() }.padding(8.dp), color = pal.muted, fontSize = 22.sp); HBar(i.toDouble() / asked.size, Modifier.weight(1f)); Muted("${i + 1} / ${asked.size}", size = 12) }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
            Muted("${n.icon} ${n.title} · $kind", size = 13); B(q.q, Modifier.padding(vertical = 10.dp), size = 19)
            val right: Any? = when (q.t) { "mc", "step" -> q.aText?.toIntOrNull(); "asn" -> q.aText
                "tf", "mf" -> q.aText == "true"; else -> null }
            @Composable fun Opt(label: String, v: Any) {
                val c = if (!answered) pal.line else if (v == right) pal.ok else if (v == picked) pal.red else pal.line.copy(alpha = .3f)
                Box(Modifier.fillMaxWidth().padding(vertical = 4.dp).clip(RoundedCornerShape(12.dp)).background(pal.card).border(if (answered && (v == right || v == picked)) 2.dp else 1.dp, c, RoundedCornerShape(12.dp)).clickable(enabled = !answered) { pick(v) }.padding(14.dp)) { P(label) }
            }
            when (q.t) {
                "asn" -> listOf("always", "sometimes", "never").forEach { Opt(it.replaceFirstChar { c -> c.uppercase() }, it) }
                "step" -> { Muted("Tap the first line that is wrong.", size = 12); q.lines.forEachIndexed { k, l -> Opt("${k + 1}  $l", k) } }
                "mc" -> order.forEach { k -> Opt(q.o[k], k) }
                "tf", "mf" -> { val (y, no) = if (q.t == "mf") "Fact" to "Myth" else "True" to "False"; Opt(y, true); Opt(no, false) }
                else -> { Row2 { Field("Your answer", num, { if (!answered) num = it }, keyboard = androidx.compose.ui.text.input.KeyboardType.Text, modifier = Modifier.weight(1f)); q.unit?.let { Muted(it) } }
                    Muted("A number. Fractions like 3/4 and negatives like −2 are fine.", size = 12) }
            }
            if (answered) {
                val ok = res[i] == true; val gp = if (!ok) tr.gapNode(q, n) else null
                Panel { Text(if (ok) "✓ Right" else "✗ Not quite", color = if (ok) pal.ok else pal.red, fontWeight = FontWeight.ExtraBold, fontSize = 17.sp)
                    if (!ok && q.t == "num") P("Answer: ${q.aText}${q.unit?.let { " $it" } ?: ""}", size = 14)
                    if (!ok && q.t == "step") P("Line ${(right as? Int ?: 0) + 1} is the first wrong one", size = 14)
                    P(q.why, size = 14); gp?.let { Muted("🧱 Foundation behind this: ${it.icon} ${it.title}", size = 12) } }
            }
        }
        Box(Modifier.padding(14.dp)) {
            if (q.t == "num" && !answered) Btn("Check", enabled = num.isNotBlank()) { val v = Tree.parseNum(num); if (v.isNaN()) app.toast("Type a number") else pick(v) }
            else Btn(if (!answered) "Choose an answer" else if (i + 1 < asked.size) "Next ›" else "See result", enabled = answered) {
                if (i + 1 < asked.size) i++ else { result = tr.quizDone(n, s.mode, QS, asked, res.map { it == true }, s.only == null); app.changed() }
            }
        }
    }
}

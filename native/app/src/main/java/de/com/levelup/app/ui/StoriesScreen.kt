package de.com.levelup.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.com.levelup.app.AppState
import de.com.levelup.app.Screen
import de.com.levelup.core.asArr
import de.com.levelup.core.asNum
import de.com.levelup.core.asObj
import de.com.levelup.core.Js
import de.com.levelup.core.JObj
import de.com.levelup.core.jobj
import de.com.levelup.core.num
import de.com.levelup.core.obj
import de.com.levelup.core.str

/**
 * German listening stories (app.js storiesView / storyView, data/stories.json): new words → listen without text
 * (slow toggle) → questions (replay the line after a miss) → transcript. Optional: no XP, no progress change;
 * S.stories[id] = {best, of, at, plays}.
 */
fun AppState.stories(): List<JObj> {
    storiesCache?.let { return it }
    val txt = g.content.cached("data/stories.json") ?: return emptyList()
    return (runCatching { Js.parseObj(txt)["stories"].asArr()?.mapNotNull { it.asObj() } }.getOrNull() ?: emptyList()).also { storiesCache = it }
}
private var storiesCache: List<JObj>? = null
private fun AppState.wordsKnown() = S?.obj("words")?.size ?: 0

@Composable
fun StoriesCard(app: AppState) {
    if (app.course?.id != "de-a1") return
    val st = app.stories(); if (st.isEmpty()) return
    val n = app.wordsKnown(); val open = st.filter { n >= it.num("minWords") }; val fresh = open.filter { app.S!!.obj("stories")[it.str("id")] == null }
    Panel(onClick = { app.open(Screen.Stories) }) { Row2 { Text("🎧", fontSize = 28.sp); Column(Modifier.weight(1f)) { B("Stories")
        Muted(if (open.isNotEmpty()) "${open.size} of ${st.size} open${if (fresh.isNotEmpty()) " · ${fresh.size} new" else ""} · optional listening practice" else "First story unlocks at ${st[0].num("minWords").toInt()} words (you know $n)", size = 12) }; Text("›") } }
}

@Composable
fun StoriesScreen(app: AppState) {
    @Suppress("UNUSED_VARIABLE") val tk = app.tick
    val n = app.wordsKnown()
    ScreenColumn {
        LinkBtn("‹ Back") { app.back() }
        H1("🎧 Stories")
        Muted("Short scenes to train your ear. Listen first without the text, answer a few questions, then read along. Optional: no XP, and your course progress doesn't change.", size = 13)
        app.stories().forEach { x ->
            val open = n >= x.num("minWords"); val r = app.S!!.obj("stories")[x.str("id")].asObj()
            Panel(onClick = if (open) ({ app.open(Screen.Story(x.str("id")!!)) }) else null) { Row2 {
                Text(if (open) x.str("scene") ?: "" else "🔒", fontSize = 28.sp)
                Column(Modifier.weight(1f)) { B(x.str("title") ?: "", size = 16); Muted("${x.str("titleEn")} · ${x["lines"].asArr()?.size ?: 0} lines", size = 12)
                    Muted(if (open) (if (r != null) "✓ Best ${r.num("best").toInt()}/${r.num("of").toInt()}" else "New") else "Unlocks at ${x.num("minWords").toInt()} words · ${x.num("minWords").toInt() - n} to go", size = 12) }
            } }
        }
    }
}

@Composable
fun StoryScreen(app: AppState, id: String) {
    val x = app.stories().firstOrNull { it.str("id") == id } ?: return
    val lines = x["lines"].asArr()!!.mapNotNull { it.asObj() }; val qs = x["q"].asArr()!!.mapNotNull { it.asObj() }; val pre = x["pre"].asArr()?.mapNotNull { it.asObj() } ?: emptyList()
    var stage by remember { mutableStateOf("intro") }; var slow by remember { mutableStateOf(false) }; var plays by remember { mutableIntStateOf(0) }
    var playing by remember { mutableStateOf(false) }; var cur by remember { mutableIntStateOf(-1) }; var k by remember { mutableIntStateOf(0) }
    val res = remember { mutableStateListOf<Boolean?>().apply { repeat(qs.size) { add(null) } } }
    DisposableEffect(Unit) { onDispose { app.audio.stop() } }
    fun play(idx: List<Int>, done: () -> Unit = {}) {
        playing = true
        val aids = idx.map { lines[it].str(if (slow) "s" else "a") ?: lines[it].str("a")!! }
        val pauses = idx.mapIndexed { j, i -> val nx = idx.getOrNull(j + 1)?.let { lines[it] }; if (nx == null) 0L else if (nx.str("sp") == lines[i].str("sp")) 450L else 750L }
        app.audio.playSeq(aids, pauses, { j -> cur = idx[j] }, { playing = false; cur = -1; done() })
    }
    Column(Modifier.fillMaxSize()) {
        Row2(Modifier.padding(horizontal = 14.dp, vertical = 8.dp)) {
            Text("✕", Modifier.clickable { app.audio.stop(); app.back() }.padding(8.dp), color = pal.muted, fontSize = 22.sp)
            HBar(when (stage) { "intro" -> .05; "listen" -> .3; "ask" -> .45 + .35 * k / qs.size; else -> 1.0 }, Modifier.weight(1f))
            Muted(when (stage) { "intro" -> "1 / 4"; "listen" -> "2 / 4"; "ask" -> "3 / 4"; else -> "4 / 4" }, size = 12)
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            when (stage) {
                "intro" -> {
                    Text(x.str("scene") ?: "", fontSize = 56.sp); H2(x.str("title") ?: ""); Muted(x.str("titleEn") ?: "")
                    if (pre.isNotEmpty()) { SysHeader("New words first"); pre.forEach { w -> Panel(onClick = { app.audio.play(w.str("a"), w.str("de")) }) { Row2 { Text("🔊"); Column { B(w.str("de") ?: "", size = 16); Muted(w.str("en") ?: "") } } } } }
                    else Muted("You know every word in this story.")
                    Muted("Next you'll hear the story without the text. Listen for who, what, when and how much.", size = 13)
                }
                "listen" -> {
                    Text(x.str("scene") ?: "", fontSize = 56.sp); H2("Listen"); Muted("No text yet. Play it as often as you like.")
                    Box(Modifier.padding(20.dp).size(96.dp).clip(CircleShape).background(pal.accent.copy(alpha = .25f)).border(2.dp, pal.accent, CircleShape)
                        .clickable { if (playing) { app.audio.stop(); playing = false } else play(lines.indices.toList()) { plays++ } }, contentAlignment = Alignment.Center) { Text(if (playing) "■" else if (plays > 0) "↻" else "▶", fontSize = 40.sp, color = pal.ink) }
                    Muted(if (playing && cur >= 0) "line ${cur + 1} of ${lines.size}" else if (plays > 0) "played ${plays}×" else "${lines.size} lines")
                    Toggle("🐢 Slow", slow) { slow = it }
                }
                "ask" -> {
                    val q = qs[k]; val tf = q.str("t") == "tf"
                    val right = if (tf) (if (q["a"] == true) 1 else 0) else q.num("a").toInt()
                    val opts = if (tf) listOf(1 to "True", 0 to "False") else q["o"].asArr()!!.mapIndexed { i, o -> i to o.toString() }
                    Muted("${x.str("scene")} ${x.str("title")} · question ${k + 1} of ${qs.size}", size = 13); B(q.str("q") ?: "", Modifier.padding(vertical = 10.dp), size = 19)
                    opts.forEach { (i, o) ->
                        val ans = res[k]; val c = if (ans == null) pal.line else if (i == right) pal.ok else pal.line.copy(alpha = .3f)
                        Box(Modifier.fillMaxWidth().padding(vertical = 4.dp).clip(RoundedCornerShape(12.dp)).background(pal.card).border(1.dp, c, RoundedCornerShape(12.dp))
                            .clickable(enabled = ans == null) { val ok = i == right; res[k] = ok; if (!ok) q["line"].asNum()?.let { play(listOf(it.toInt())) } }.padding(14.dp)) { P(o) }
                    }
                    res[k]?.let { ok -> Text(if (ok) "✓ Right" else "✗ Not quite", color = if (ok) pal.ok else pal.red, fontSize = 17.sp)
                        if (!ok) Btn("🔊 Hear that part", kind = BtnKind.Ghost, small = true) { q["line"].asNum()?.let { play(listOf(it.toInt())) } } }
                }
                else -> {
                    val got = res.count { it == true }
                    H2("$got of ${qs.size} right ${if (got == qs.size) "🏆" else ""}"); Muted("Now read along. Tap a line to hear it again.", size = 13); Toggle("🐢 Slow", slow) { slow = it }
                    lines.forEachIndexed { i, l -> Panel(highlight = cur == i, onClick = { play(listOf(i)) }) { Muted(l.str("sp") ?: "", size = 11); B(l.str("de") ?: "", size = 16); Muted(l.str("en") ?: "", size = 13) } }
                }
            }
            Box(Modifier.size(20.dp))
        }
        Box(Modifier.padding(14.dp)) {
            when (stage) {
                "intro" -> Btn("🎧 Listen") { stage = "listen" }
                "listen" -> Btn("Questions ›", enabled = plays > 0) { app.audio.stop(); playing = false; stage = "ask" }
                "ask" -> Btn(if (res[k] == null) "Choose an answer" else if (k + 1 < qs.size) "Next ›" else "Read along ›", enabled = res[k] != null) {
                    app.audio.stop(); playing = false
                    if (k + 1 < qs.size) k++ else {
                        val got = res.count { it == true }; val m = app.S!!.obj("stories"); val r = m[id].asObj() ?: jobj("best" to 0.0, "of" to qs.size.toDouble(), "plays" to 0.0)
                        r["best"] = maxOf(r.num("best"), got.toDouble()); r["of"] = qs.size.toDouble(); r["at"] = app.store.today(); r["plays"] = r.num("plays") + plays
                        m[id] = r; app.store.save(); stage = "done"
                    }
                }
                else -> Row2 { Box(Modifier.weight(1f)) { Btn("▶ Play all", kind = BtnKind.Ghost) { play(lines.indices.toList()) } }; Box(Modifier.weight(1f)) { Btn("Done") { app.audio.stop(); app.back() } } }
            }
        }
    }
}

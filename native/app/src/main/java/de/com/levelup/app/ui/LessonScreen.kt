package de.com.levelup.app.ui

import android.app.Activity
import android.content.Intent
import android.speech.RecognizerIntent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.com.levelup.app.AppState
import de.com.levelup.core.Ex
import de.com.levelup.core.Finish
import de.com.levelup.core.Hero
import de.com.levelup.core.LessonRun
import de.com.levelup.core.Phrase
import de.com.levelup.core.Step
import de.com.levelup.core.Store
import de.com.levelup.core.Text as CoreText
import de.com.levelup.core.Word
import de.com.levelup.core.asObj
import de.com.levelup.core.obj
import kotlinx.coroutines.delay
import kotlin.random.Random

object LessonTiming { @JvmField var armMs = 450L }

fun confirmQuit(app: AppState) = app.showSheet {
    H2("Quit this lesson?"); Muted("Your answers in this lesson won't be saved.")
    Btn("Keep learning") { app.closeSheet() }
    Btn("Quit", kind = BtnKind.Ghost) { app.closeSheet(); app.quitLesson() }
}

/** what the feedback panel shows after an answer */
private data class Fb(val ok: Boolean, val correct: String?, val note: String?, val combo: String?, val override: Boolean, val step: Step)

@Composable
fun LessonScreen(app: AppState) {
    @Suppress("UNUSED_VARIABLE") val tk = app.tick
    val r = app.run ?: return
    app.finish?.let { FinishScreen(app, it); return }
    val s = r.step ?: return
    val cd = app.cd!!
    val text = remember(cd) { CoreText(cd) }
    var fb by remember(r, r.i) { mutableStateOf<Fb?>(null) }
    var armed by remember(r, r.i) { mutableStateOf(false) }
    LaunchedEffect(r, r.i) { if (LessonTiming.armMs > 0) delay(LessonTiming.armMs); armed = true }   // ignore taps for 0.45 s (stops double-tap skips)
    val answer: (Step, Boolean, String?, String?, Boolean) -> Unit = { st, ok, correct, note, ov ->
        val combo = r.answered(st, ok, cd.lang.name)
        app.audio.blip(ok)
        val w = st.w
        if (w != null && st !is Step.Listen && (st !is Step.Mc || st.dir == "en_de" || !ok)) app.audio.play(w.a, w.de)
        fb = Fb(ok, correct, note, combo, ov, st)
    }
    Column(Modifier.fillMaxSize()) {
        Row2(Modifier.padding(horizontal = 14.dp, vertical = 8.dp)) {
            Text("✕", Modifier.clip(RoundedCornerShape(8.dp)).clickable { confirmQuit(app) }.padding(8.dp), color = pal.muted, fontSize = 22.sp)
            HBar(r.pct / 100, Modifier.weight(1f))
        }
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp)) {
            val lock = fb != null || !armed
            when (s) {
                is Step.Intro -> IntroStep(app, s.w)
                is Step.Mc -> McStep(app, text, s, lock) { ok -> answer(s, ok, if (s.dir == "de_en") s.w.en else s.w.de, null, false) }
                is Step.Listen -> ListenStep(app, text, s, lock) { ok -> answer(s, ok, "${s.w.de} = ${s.w.en}", if (ok) s.w.en else null, false) }
                is Step.Gender -> GenderStep(app, s, lock) { ok, note -> answer(s, ok, s.w.de, note, false) }
                is Step.Type -> TypeStep(app, text, s, lock) { ok, note -> answer(s, ok, s.w.de, note, false) }
                is Step.Match -> MatchStep(app, s, lock) { ok -> answer(s.withKey("match" + Random.nextDouble()), ok, null, null, false) }
                is Step.Gq -> GqStep(app, text, s, lock) { ok, note -> answer(s, ok, s.q.a, note, true) }
                is Step.Gmc -> GmcStep(app, s, lock) { ok -> answer(s, ok, s.q.a, s.q.note, false) }
                is Step.Recall -> RecallStep(app, text, r, s)
                is Step.Flip -> FlipStep(app, r, s)
                is Step.Read -> ReadStep(app, s, lock) { ok -> if (!s.listen) app.audio.play(s.p.a, s.p.de); answer(s.withKey(s.p.de), ok, if (s.listen) s.p.en else s.p.de, null, false) }
                is Step.Build -> BuildStep(app, text, s, lock) { ok ->
                    app.audio.play(s.ex.a, s.ex.de)
                    answer(s.withKey("b:" + s.ex.de), ok, s.ex.de, if (ok || s.ans.size < 2) null else "${cd.lang.name} word order can vary – if yours is also correct, tap “I was right”.", s.ans.size > 1)
                }
                is Step.Cloze -> ClozeStep(app, text, s, lock) { ok -> app.audio.play(s.ex.a, s.ex.de); answer(s.withKey("c:" + s.ex.de), ok, s.ex.de, null, false) }
                is Step.Say -> SayStep(app, text, s, lock) { ok, note -> app.audio.play(s.item.a, s.item.de); answer(s, ok, s.item.answers.joinToString("  /  "), note ?: if (ok) null else "If yours means the same with a different word order, tap “I was right”.", true) }
                is Step.Speak -> SpeakStep(app, text, s)
            }
            Gap(20)
        }
        fb?.let { f ->
            val ok = f.ok
            Column(Modifier.fillMaxWidth().background(if (ok) pal.ok.copy(alpha = .16f) else pal.red.copy(alpha = .16f)).border(1.dp, if (ok) pal.ok else pal.red).padding(16.dp)) {
                Text(if (ok) cd.lang.praise.random() else "Not quite", color = if (ok) pal.ok else pal.red, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
                if (!ok && f.correct != null) P("Correct answer: ${f.correct}", size = 16)
                f.note?.let { P(it, size = 14) }
                f.combo?.let { Text(it, color = pal.amber, fontWeight = FontWeight.Bold) }
                if (f.override && !ok) LinkBtn("I was right – count it") { r.override(f.step); app.nextStep() }
                Btn("Continue", kind = if (ok) BtnKind.Green else BtnKind.Red) { app.nextStep() }
            }
        }
    }
}

@Composable private fun QTitle(t: String) = Text(t.uppercase(), Modifier.padding(top = 10.dp, bottom = 8.dp), color = if (pal.hunter > 0) Color(0xFF7CC4FF) else pal.blue, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp)
@Composable
fun EnPrompt(en: String, hint: String = "") {
    Column(Modifier.fillMaxWidth().padding(vertical = 6.dp).clip(RoundedCornerShape(12.dp)).background(pal.line.copy(alpha = .2f)).border(1.dp, pal.line, RoundedCornerShape(12.dp)).padding(12.dp)) {
        Text("ENGLISH", color = pal.muted, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
        P(CoreText.phone(en), size = 20)
        if (hint.isNotEmpty()) Muted(CoreText.phone(hint), size = 13)
    }
}
@Composable private fun Big(t: String) = Text(t, color = pal.ink, fontSize = 30.sp, fontWeight = FontWeight.Bold)

/** multiple choice: after a tap the right one turns green, the tapped wrong one red */
@Composable
private fun Options(key: Any, items: List<String>, correct: Int, lock: Boolean, colors: List<Color?>? = null, onPick: (Boolean) -> Unit) {
    var picked by remember(key) { mutableStateOf<Int?>(null) }
    Column(Modifier.padding(top = 8.dp)) {
        items.forEachIndexed { i, t ->
            val c = when { picked == null -> pal.line; i == correct -> pal.ok; i == picked -> pal.red; else -> pal.line.copy(alpha = .3f) }
            Box(Modifier.fillMaxWidth().padding(vertical = 4.dp).clip(RoundedCornerShape(pal.corner + 4.dp)).background(if (picked != null && i == correct) pal.ok.copy(alpha = .15f) else pal.card)
                .border(if (picked != null && (i == correct || i == picked)) 2.dp else 1.dp, c, RoundedCornerShape(pal.corner + 4.dp))
                .clickable(enabled = picked == null && !lock) { picked = i; onPick(i == correct) }.padding(14.dp)) {
                Text(t, color = colors?.getOrNull(i) ?: pal.ink, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun IntroStep(app: AppState, w: Word) {
    LaunchedEffect(w.id) { if (app.setting("autoplay") != false) app.audio.play(w.a, w.de) }
    QTitle("New word"); Panel { WordCard(app, w) }
    Btn("Got it") { app.nextStep() }
}
@Composable
private fun McStep(app: AppState, text: CoreText, s: Step.Mc, lock: Boolean, onPick: (Boolean) -> Unit) {
    val r = app.run!!
    val opts = remember(r, r.i) { app.lessons!!.b.shuffle(listOf(s.w) + app.lessons!!.b.distractors(s.w, if (s.dir == "de_en") "en" else "de")) }
    if (s.dir == "de_en") {
        LaunchedEffect(r.i) { if (app.setting("autoplay") != false) app.audio.play(s.w.a, s.w.de) }
        QTitle("What does this mean?")
        Row2 { SpeakBtn(app, s.w.a, s.w.de); DeText(app, s.w, 30) }
        Options(r.i, opts.map { it.en }, opts.indexOf(s.w), lock, onPick = onPick)
    } else {
        QTitle("Choose the ${app.cd!!.lang.name}"); EnPrompt(s.w.en)
        Options(r.i, opts.map { it.de }, opts.indexOf(s.w), lock, onPick = onPick)
    }
}
@Composable
private fun ListenStep(app: AppState, text: CoreText, s: Step.Listen, lock: Boolean, onPick: (Boolean) -> Unit) {
    val r = app.run!!
    val opts = remember(r, r.i) { app.lessons!!.b.shuffle(listOf(s.w) + app.lessons!!.b.distractors(s.w, "de")) }
    LaunchedEffect(r.i) { app.audio.playSoon(s.w.a, s.w.de) }
    QTitle("What do you hear?")
    Box(Modifier.fillMaxWidth().padding(10.dp), contentAlignment = Alignment.Center) { SpeakBtn(app, s.w.a, s.w.de, big = true) }
    Options(r.i, opts.map { it.de }, opts.indexOf(s.w), lock, onPick = onPick)
}
@Composable
private fun GenderStep(app: AppState, s: Step.Gender, lock: Boolean, onPick: (Boolean, String) -> Unit) {
    val G = app.cd!!.lang.genderQ(s.w); val noun = G.shown ?: (app.cd!!.lang.splitArt(s.w.de)?.get(1) ?: s.w.de)
    QTitle(G.title); Big("___ $noun"); Muted(s.w.en)
    Options(app.run!!.i, G.opts, G.opts.indexOf(G.ans), lock, G.cls.map { genderColor(it) }) { ok -> onPick(ok, G.note) }
}
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Keys(app: AppState, onKey: (String) -> Unit) = FlowRow { app.cd!!.lang.keys.forEach { k -> Chip(k) { onKey(k) } } }
@Composable
private fun TypeStep(app: AppState, text: CoreText, s: Step.Type, lock: Boolean, onDone: (Boolean, String?) -> Unit) {
    var v by remember(app.run!!.i) { mutableStateOf("") }; var done by remember(app.run!!.i) { mutableStateOf(false) }
    val L = app.cd!!.lang
    QTitle("Write this in ${L.name}"); EnPrompt(s.w.en)
    Field(if (s.w.g != null) L.artHint else "Type in ${L.name}", v, { if (!done) v = it })
    Keys(app) { if (!done) v += it }
    Btn("Check", enabled = v.isNotBlank() && !done && !lock) { done = true; val c = text.checkTyped(v, listOf(s.w.typeAns ?: s.w.de) + text.sameMeaningDe(s.w)); onDone(c.ok, c.note) }
}
@Composable
private fun MatchStep(app: AppState, s: Step.Match, lock: Boolean, onDone: (Boolean) -> Unit) {
    val r = app.run!!; val b = app.lessons!!.b
    val left = remember(r, r.i) { b.shuffle(s.ws) }; val right = remember(r, r.i) { b.shuffle(s.ws) }
    var sel by remember(r.i) { mutableStateOf<Pair<String, String>?>(null) }   // side, id
    val gone = remember(r.i) { mutableStateListOf<String>() }; var misses by remember(r.i) { mutableStateOf(0) }; var wrong by remember(r.i) { mutableStateOf<Set<String>>(emptySet()) }
    QTitle("Tap the matching pairs")
    left.indices.forEach { i ->
        Row(Modifier.fillMaxWidth()) {
            listOf("L" to left[i], "R" to right[i]).forEach { (side, w) ->
                val key = side + w.id; val isGone = w.id in gone; val isSel = sel == side to w.id
                Box(Modifier.weight(1f).padding(4.dp).heightIn(min = 54.dp).clip(RoundedCornerShape(12.dp))
                    .background(if (isGone) pal.ok.copy(alpha = .15f) else if (isSel) pal.accent.copy(alpha = .25f) else pal.card)
                    .border(if (key in wrong) 2.dp else 1.dp, if (key in wrong) pal.red else if (isGone) pal.ok else pal.line, RoundedCornerShape(12.dp))
                    .clickable(enabled = !isGone && !lock) {
                        if (side == "L") app.audio.play(w.a, w.de)
                        val cur = sel
                        if (cur == null || cur.first == side) { sel = side to w.id; return@clickable }
                        sel = null
                        if (cur.second == w.id) { gone.add(w.id); if (gone.size == s.ws.size) { app.audio.blip(true); onDone(misses == 0) } }
                        else { misses++; app.audio.blip(false); wrong = setOf(cur.first + cur.second, key) }
                    }.padding(10.dp), contentAlignment = Alignment.Center) {
                    Text(if (side == "L") w.de else w.en, color = if (isGone) pal.muted else pal.ink, fontSize = 15.sp, textAlign = TextAlign.Center)
                }
            }
        }
    }
}
@Composable
private fun GqStep(app: AppState, text: CoreText, s: Step.Gq, lock: Boolean, onDone: (Boolean, String?) -> Unit) {
    var v by remember(app.run!!.i) { mutableStateOf("") }; var done by remember(app.run!!.i) { mutableStateOf(false) }
    QTitle("Practice ${s.n}/${s.of}"); Panel { B(s.q.q, size = 19) }
    Field("Your answer", v, { if (!done) v = it }); Keys(app) { if (!done) v += it }
    Btn("Check", enabled = !done && !lock) { done = true; val c = text.checkTyped(v, text.answerVariants(s.q.a)); onDone(c.ok, c.note) }
}
@Composable
private fun GmcStep(app: AppState, s: Step.Gmc, lock: Boolean, onPick: (Boolean) -> Unit) {
    val r = app.run!!
    val opts = remember(r, r.i) { app.lessons!!.b.shuffle(s.q.opts ?: emptyList()) }
    LaunchedEffect(r.i) { if (s.q.audio != null) app.audio.playSoon(s.q.audio, s.q.say) }
    QTitle("Practice ${s.n}/${s.of}"); Panel { B(s.q.q, size = 19) }
    if (s.q.audio != null) Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { SpeakBtn(app, s.q.audio, s.q.say ?: "", big = true) }
    Options(r.i, opts, opts.indexOf(s.q.a), lock, onPick = onPick)
}
private fun fmtIvl(d: Int) = if (d < 1) "<1d" else if (d < 30) "${d}d" else if (d < 365) "${Math.round(d / 30.0)}mo" else "1y"
@Composable
private fun RecallStep(app: AppState, text: CoreText, r: LessonRun, s: Step.Recall) {
    val L = app.cd!!.lang; val st = app.store
    var shown by remember(r, r.i) { mutableStateOf(false) }; var v by remember(r, r.i) { mutableStateOf("") }
    var suggested by remember(r, r.i) { mutableStateOf(3) }; var note by remember(r, r.i) { mutableStateOf("") }
    LaunchedEffect(r.i) { if (s.dir == "de_en" && app.setting("autoplay") != false) app.audio.play(s.w.a, s.w.de) }
    if (s.dir == "de_en") { QTitle("What does this ${L.name} word mean? (think of it, then check)"); Row2 { SpeakBtn(app, s.w.a, s.w.de); DeText(app, s.w, 30) } }
    else { QTitle((if (s.dir == "type") "Type the " else "Recall the ") + L.name + if (s.w.g != null) " (${L.artHint})" else ""); EnPrompt(s.w.en) }
    if (s.dir == "type") { Field("Type in ${L.name}", v, { if (!shown) v = it }); Keys(app) { if (!shown) v += it } }
    else if (!shown) Muted("Say the answer out loud or in your head first – that's what makes it stick.", Modifier.fillMaxWidth().padding(top = 30.dp), align = TextAlign.Center)
    if (!shown) Btn(if (s.dir == "type") "Check" else "Show answer", kind = BtnKind.Blue) {
        if (s.dir == "type") {
            val c = text.checkTyped(v, listOf(s.w.typeAns ?: s.w.de) + text.sameMeaningDe(s.w))
            suggested = if (c.ok) (if (c.note != null) 2 else 3) else (if (c.note != null && c.note!!.contains("article", true)) 2 else 1)
            note = if (c.ok) (c.note ?: "Correct!") else (c.note ?: "Not quite."); app.audio.blip(c.ok)
        }
        shown = true; app.audio.play(s.w.a, s.w.de)
    } else {
        Panel { Muted("Answer", size = 12); if (s.dir == "de_en") B(s.w.en, size = 22) else DeText(app, s.w, 26) }
        if (note.isNotEmpty()) P(note, size = 15)
        Panel { WordCard(app, s.w, 1) }
        Muted("How well did you remember it?", Modifier.fillMaxWidth(), align = TextAlign.Center)
        val card = app.S!!.obj("words")[s.w.id].asObj() ?: mapOf("ivl" to 0.0, "ef" to 2.5, "reps" to 0.0)
        Row(Modifier.fillMaxWidth()) {
            (1..4).forEach { g ->
                val c = listOf(pal.red, pal.amber, pal.ok, pal.blue)[g - 1]
                Column(Modifier.weight(1f).padding(3.dp).clip(RoundedCornerShape(10.dp)).background(c.copy(alpha = if (s.dir == "type" && g == suggested) .45f else .18f)).border(1.dp, c, RoundedCornerShape(10.dp))
                    .clickable { r.recallGraded(s, g, st); app.nextStep() }.padding(vertical = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    B(Store.GRADES[g], size = 15); if (!s.relearn) Muted(fmtIvl(if (g == 1) 0 else st.nextIvl(card, g)), size = 12)
                }
            }
        }
    }
}
@Composable
private fun FlipStep(app: AppState, r: LessonRun, s: Step.Flip) {
    var shown by remember(r, r.i) { mutableStateOf(false) }
    LaunchedEffect(r.i) { if (app.setting("autoplay") != false) app.audio.play(s.p.a, s.p.de) }
    QTitle(s.sec + (s.p.grp?.let { " · $it" } ?: ""))
    Panel(onClick = { shown = true }) {
        Box(Modifier.fillMaxWidth().padding(vertical = 18.dp), contentAlignment = Alignment.Center) { Text(s.p.de, color = pal.ink, fontSize = 26.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center) }
        Text(if (shown) CoreText.phone(s.p.en) else "Tap to see the meaning", Modifier.fillMaxWidth(), color = if (shown) pal.ink else pal.muted, fontSize = 18.sp, textAlign = TextAlign.Center)
    }
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { SpeakBtn(app, s.p.a, s.p.de) }
    if (!shown) Btn("Show meaning", kind = BtnKind.Blue) { shown = true }
    else Row2 { Box(Modifier.weight(1f)) { Btn("Still learning", kind = BtnKind.Ghost) { r.answered++; app.nextStep() } }; Box(Modifier.weight(1f)) { Btn("I knew it") { r.answered++; r.right++; app.nextStep() } } }
}
@Composable
private fun ReadStep(app: AppState, s: Step.Read, lock: Boolean, onPick: (Boolean) -> Unit) {
    val r = app.run!!
    val opts = remember(r, r.i) { app.lessons!!.b.shuffle(listOf(s.p) + s.others) }
    QTitle(s.title)
    if (s.listen) {
        LaunchedEffect(r.i) { app.audio.playSoon(s.p.a, s.p.de) }
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { SpeakBtn(app, s.p.a, s.p.de, big = true) }
        Options(r.i, opts.map { CoreText.phone(it.en) }, opts.indexOfFirst { it === s.p }, lock, onPick = onPick)
    } else { EnPrompt(s.p.en); Options(r.i, opts.map { it.de }, opts.indexOfFirst { it === s.p }, lock, onPick = onPick) }
}
/** tap a known word in a sentence to see what it means (glossOf) */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun GlossLine(app: AppState, text: CoreText, toks: List<Pair<String, Boolean>>, slot: @Composable (Int) -> Unit) {
    FlowRow(Modifier.padding(vertical = 8.dp), verticalArrangement = Arrangement.Center) {
        var k = 0
        toks.forEachIndexed { i, (tok, blank) ->
            if (blank) { slot(k++); return@forEachIndexed }
            val g = text.glossOf(tok, i == 0)
            Text(tok, Modifier.padding(horizontal = 3.dp, vertical = 6.dp).then(if (g != null) Modifier.clickable { app.toast(g) } else Modifier), color = pal.ink, fontSize = 20.sp, fontWeight = FontWeight.SemiBold,
                textDecoration = if (g != null) androidx.compose.ui.text.style.TextDecoration.Underline else null)
        }
    }
}
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Tiles(tiles: List<String>, used: Set<Int>, enabled: Boolean, onTap: (Int) -> Unit) = FlowRow(Modifier.padding(vertical = 8.dp)) {
    tiles.forEachIndexed { i, t ->
        Box(Modifier.padding(4.dp).clip(RoundedCornerShape(10.dp)).background(if (i in used) pal.line.copy(alpha = .2f) else pal.card).border(1.dp, if (i in used) pal.line.copy(alpha = .3f) else pal.accent, RoundedCornerShape(10.dp))
            .clickable(enabled = enabled && i !in used) { onTap(i) }.padding(horizontal = 12.dp, vertical = 9.dp)) { Text(t, color = if (i in used) Color.Transparent else pal.ink, fontSize = 17.sp) }
    }
}
@Composable
private fun BuildStep(app: AppState, text: CoreText, s: Step.Build, lock: Boolean, onDone: (Boolean) -> Unit) {
    val r = app.run!!
    val fill = remember(r, r.i) { mutableStateListOf<Int?>().apply { repeat(s.ans.size) { add(null) } } }
    var done by remember(r, r.i) { mutableStateOf(false) }
    QTitle("Complete the sentence"); EnPrompt(s.ex.en)
    GlossLine(app, text, s.slots.map { it.tok to it.blank }) { k ->
        val ti = fill[k]
        Box(Modifier.padding(3.dp).size(width = 86.dp, height = 40.dp).clip(RoundedCornerShape(8.dp)).background(if (ti != null) pal.accent.copy(alpha = .2f) else pal.line.copy(alpha = .2f)).border(1.dp, pal.accent, RoundedCornerShape(8.dp))
            .clickable(enabled = ti != null && !done) { fill[k] = null }, contentAlignment = Alignment.Center) { Text(ti?.let { s.tiles[it] } ?: "", color = pal.ink, fontSize = 16.sp) }
    }
    Tiles(s.tiles, fill.filterNotNull().toSet(), !done) { i -> val k = fill.indexOfFirst { it == null }; if (k >= 0) fill[k] = i }
    Btn("Check", enabled = fill.none { it == null } && !done && !lock) {
        done = true
        val got = fill.map { s.tiles[it!!] }
        onDone(got.size == s.ans.size && got.indices.all { text.norm(got[it]) == text.norm(s.ans[it]) })
    }
}
@Composable
private fun ClozeStep(app: AppState, text: CoreText, s: Step.Cloze, lock: Boolean, onPick: (Boolean) -> Unit) {
    val r = app.run!!
    val opts = remember(r, r.i) { app.lessons!!.b.shuffle(s.opts) }
    QTitle("Fill the gap")
    Panel {
        var blanked = false
        val toks = s.ex.de.split(Regex("\\s+")).map { t -> val bare = t.replace(Regex("[.,!?]"), ""); if (!blanked && bare.equals(s.ans, true)) { blanked = true; t.replace(bare, "____") to false } else t to false }
        GlossLine(app, text, toks) {}
        Muted(s.ex.en, size = 18)
    }
    Options(r.i, opts, opts.indexOf(s.opts[0]), lock, onPick = onPick)
}
@Composable
private fun SayStep(app: AppState, text: CoreText, s: Step.Say, lock: Boolean, onDone: (Boolean, String?) -> Unit) {
    val r = app.run!!; val L = app.cd!!.lang
    val placed = remember(r, r.i) { mutableStateListOf<Int>() }; var v by remember(r, r.i) { mutableStateOf("") }; var done by remember(r, r.i) { mutableStateOf(false) }
    QTitle("Say it in ${L.name}"); EnPrompt(s.item.en, listOf(s.item.ctx, s.item.note).filter { it.isNotEmpty() }.joinToString(" · "))
    fun finish(ok: Boolean, note: String?, got: String) {
        val sib = if (!ok) s.sibs.firstOrNull { text.norm(it.de) == text.norm(got) } else null
        onDone(ok, if (sib != null) "“${sib.de}” is right too, but it's the ${sib.note.ifEmpty { "other" }} form. This one asks for: ${s.item.note.ifEmpty { s.item.ctx.ifEmpty { "the form shown" } }}." else note)
    }
    if (s.mode == "tiles") {
        @OptIn(ExperimentalLayoutApi::class)
        FlowRow(Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(vertical = 6.dp).clip(RoundedCornerShape(10.dp)).border(1.dp, pal.line, RoundedCornerShape(10.dp)).padding(4.dp)) {
            placed.forEachIndexed { k, i -> Box(Modifier.padding(3.dp).clip(RoundedCornerShape(10.dp)).background(pal.accent.copy(alpha = .2f)).clickable(enabled = !done) { placed.removeAt(k) }.padding(horizontal = 12.dp, vertical = 8.dp)) { Text(s.tiles[i], color = pal.ink, fontSize = 17.sp) } }
        }
        Tiles(s.tiles, placed.toSet(), !done) { placed.add(it) }
        Btn("Check", enabled = placed.isNotEmpty() && !done && !lock) { done = true; val got = placed.joinToString(" ") { s.tiles[it] }; finish(s.item.answers.any { text.norm(it) == text.norm(got) }, null, got) }
    } else {
        Muted("Type the whole sentence", size = 13)
        Field("Type in ${L.name}", v, { if (!done) v = it }); Keys(app) { if (!done) v += it }
        Btn("Check", enabled = v.isNotBlank() && !done && !lock) { done = true; val c = text.checkSay(v, s.item.answers); finish(c.ok, c.note, v) }
    }
}
@Composable
private fun SpeakStep(app: AppState, text: CoreText, s: Step.Speak) {
    val r = app.run!!; val L = app.cd!!.lang
    var heard by remember(r, r.i) { mutableStateOf("Listen first if you like, then tap the microphone and say it.") }
    var ok by remember(r, r.i) { mutableStateOf(false) }; var tries by remember(r, r.i) { mutableStateOf(0) }
    val said = remember(r, r.i) { mutableStateListOf<String>() }
    var paid by remember(r, r.i) { mutableStateOf(false) }
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
        if (res.resultCode != Activity.RESULT_OK) { heard = "I didn't hear anything. Tap and speak again."; return@rememberLauncherForActivityResult }
        val alts = res.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS) ?: arrayListOf()
        val h = text.heardCheck(alts, s.p.de); tries++
        said.add(h.alt.ifEmpty { alts.firstOrNull() ?: "" })
        heard = "You said: ${h.alt.ifEmpty { alts.firstOrNull() ?: "…" }}" + (if (h.ok) "" else "\nNot heard: " + h.want.filterIndexed { i, _ -> !h.hit[i] }.joinToString(" ")) +
            (if (said.size > 1) "\nEarlier: " + said.dropLast(1).joinToString(" · ") else "")
        if (h.ok) { ok = true; app.audio.blip(true); if (!paid) { paid = true; app.store.addXP(1.0) } }
        else heard += "\n" + if (tries < 2) "Close! Listen once more and try again." else "Good effort. Try again, or skip: there's no penalty."
    }
    LaunchedEffect(r.i) { if (app.setting("autoplay") != false) app.audio.play(s.p.a, s.p.de) }
    QTitle("🎤 Say it out loud"); EnPrompt(s.p.en)
    Panel { Row2 { SpeakBtn(app, s.p.a, s.p.de); B(s.p.de, Modifier.weight(1f), size = 22) } }
    P(heard, size = 15)
    if (ok) { Text("${L.understood} 🎉", color = pal.ok, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold); Muted("+1 XP for speaking."); Btn("Continue") { app.nextStep() } }
    else {
        Btn(if (tries > 0) "🎤 Try again" else "🎤 Tap and speak") {
            app.audio.stop()
            runCatching { launcher.launch(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, L.bcp).putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5).putExtra(RecognizerIntent.EXTRA_PROMPT, s.p.de)) }
                .onFailure { heard = "Speech recognition isn't available on this phone." }
        }
        Btn("Skip", kind = BtnKind.Ghost) { app.nextStep() }
    }
}

// ---------- finish screen ----------
@Composable
fun FinishScreen(app: AppState, f: Finish) {
    val r = app.run!!
    Column(Modifier.fillMaxSize()) {
        Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            if (f.failed) {
                SysHeader("Good effort"); Text("💪", fontSize = 56.sp); H1("Nice try — one more go!")
                P("You got ${f.right} right this time${if (f.best > 1) " and a best streak of ${f.best}" else ""}. One more round and this part is yours — it counts once you reach ${LessonRun.PASS_ACC}%.", align = TextAlign.Center)
            } else {
                SysHeader(if (f.kind == "review") "Training complete" else "Quest cleared")
                if (f.lvAfter < f.lvBefore) { Text("LEVEL DOWN", color = Color(0xFFFF8EA3), fontSize = 30.sp, fontWeight = FontWeight.Black); Muted("Level ${f.lvBefore} → ${f.lvAfter}: forgotten words count less until you recall them again.", align = TextAlign.Center) }
                if (f.kind == "review") Muted("Again ${f.grades[1]} · Hard ${f.grades[2]} · Good ${f.grades[3]} · Easy ${f.grades[4]}")
                if (f.lvAfter > f.lvBefore) {
                    Text("LEVEL UP!", color = pal.accent, fontSize = 34.sp, fontWeight = FontWeight.Black, letterSpacing = 3.sp)
                    Muted("LEVEL ${f.lvBefore} → ${f.lvAfter}")
                    RankEmblem(f.lvAfter, 96.dp)
                    if (f.rankUp != null) Text("✦ Rank up ✦\n${f.rankUp}-Rank", color = Color(0xFFD2B6FF), fontSize = 22.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center)
                    else Muted("Your aura grows stronger · ${Hero.auraName(f.lvAfter)}")
                }
                Text(f.cheer.first, fontSize = 52.sp)
                H1(if (f.perfect) "Perfect!" else if (f.kind == "review") "Review done!" else if (f.lessonDone) "Lesson complete!" else f.bitOf?.let { "Part ${it.first} of ${it.second} done!" } ?: "Well done!")
                P(f.cheer.second, align = TextAlign.Center)
            }
            Muted(f.title, size = 13)
            Row(Modifier.fillMaxWidth().padding(vertical = 10.dp)) {
                StatTile("XP", (if (f.xp < 0) "" else "+") + xpStr(f.xp), Modifier.weight(1f), if (f.xp < 0) pal.red else Color(0xFFFFC800))
                StatTile("Accuracy", "${f.acc}%", Modifier.weight(1f), if (f.failed) pal.amber else pal.ok)
                StatTile("Best combo", "${f.best}", Modifier.weight(1f), Color(0xFFFF9F43))
            }
            if (!f.failed && f.words.isNotEmpty()) Panel { B("🗣 ${f.words.size} word${if (f.words.size > 1) "s" else ""} practised · ${f.mins} min", size = 15); FlowChips(f.words.map { "🔊 ${it.de}" }) { i -> app.audio.play(f.words[i].a, f.words[i].de) } }
            if (f.goalHit) Panel { B("🎯 Daily goal reached! Your streak is safe for today.", size = 15) }
            if (f.wrong.isNotEmpty()) Muted("Words to watch: ${f.wrong.take(8).joinToString(", ") { it.de }}", size = 13)
        }
        Column(Modifier.padding(16.dp)) {
            if (f.failed) Row2 { Box(Modifier.weight(1f)) { Btn("Later", kind = BtnKind.Ghost) { app.quitLesson() } }; Box(Modifier.weight(1f)) { Btn("Try again") { r.retry?.invoke() } } }
            else {
                val nx = app.nextPartAction()
                if (nx != null) {
                    Row2 { Box(Modifier.weight(1f)) { Btn("Later", kind = BtnKind.Ghost) { app.quitLesson() } }; Box(Modifier.weight(1f)) { Btn("Next part ›") { nx.second() } } }
                    if (nx.first.isNotEmpty()) Muted("Next: ${nx.first}", Modifier.fillMaxWidth(), size = 12, align = TextAlign.Center)
                } else Btn("Continue") { app.quitLesson() }
            }
        }
    }
}


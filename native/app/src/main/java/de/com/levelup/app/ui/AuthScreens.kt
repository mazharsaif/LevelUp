package de.com.levelup.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import de.com.levelup.app.AppState
import de.com.levelup.core.Dates
import de.com.levelup.core.Js
import de.com.levelup.core.JObj
import de.com.levelup.core.sync.Net
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.launch

@Composable
fun Field(label: String, value: String, onChange: (String) -> Unit, password: Boolean = false, modifier: Modifier = Modifier, keyboard: KeyboardType = KeyboardType.Text, singleLine: Boolean = true) {
    val p = pal
    OutlinedTextField(value, onChange, modifier.fillMaxWidth().padding(vertical = 4.dp), label = { Text(label) }, singleLine = singleLine,
        visualTransformation = if (password) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = if (password) KeyboardType.Password else keyboard, autoCorrectEnabled = false),
        colors = OutlinedTextFieldDefaults.colors(focusedTextColor = p.ink, unfocusedTextColor = p.ink, focusedBorderColor = p.accent, unfocusedBorderColor = p.line, focusedLabelColor = p.accent, unfocusedLabelColor = p.muted, cursorColor = p.accent))
}

@Composable
private fun Brand(title: String) {
    Column(Modifier.fillMaxWidth().padding(top = 30.dp, bottom = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.padding(4.dp).clip(RoundedCornerShape(20.dp)).background(Color(0xFF121945)).padding(14.dp)) { Text("⟰", fontSize = 40.sp, color = Color(0xFFFFC94D)) }
        Text("LevelUp", color = pal.accent, fontSize = 30.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp)
        Gap(4); H1(title)
    }
}

@Composable
fun IntroScreen(app: AppState) {
    ScreenColumn {
        Brand("Level up in languages and skills")
        Muted("Short daily lessons that turn into real knowledge, one level at a time.", align = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        Panel {
            listOf("📚" to ("Courses" to "German A1 (821 words, 20 grammar chapters, everyday phrases), French A1 for the DELF A1, a Software Engineering skill tree and Mathematics. More languages and subjects are coming."),
                "🧠" to ("Spaced repetition" to "Every word comes back for review just before you would forget it. Words you know well return less often, hard ones more often."),
                "🎯" to ("Targets that fit you" to "Pick a finish date and the app sets your daily goal. Choose Quest Mode (levels, ranks, streaks, diamonds, daily quests) or a plain mode with just the lessons."),
                "🔊" to ("Hear and speak" to "Native-style audio for every word and phrase, and optional speaking practice."),
                "📈" to ("See your progress" to "Level, rank and pace show if you're on track. Your progress is saved to your account and works on any device.")).forEach { (i, td) ->
                Row(Modifier.padding(vertical = 6.dp)) { Text(i, fontSize = 24.sp); Sp(10); Column { B(td.first, size = 16); Muted(td.second) } }
            }
        }
        Btn("Create free account") { app.authTab = "signup"; app.seeIntro(); app.changed() }
        Btn("I have an account", kind = BtnKind.Ghost) { app.authTab = "login"; app.seeIntro(); app.changed() }
        LinkBtn(if (app.sync.hasGuestData()) "Continue as guest" else "Just try it as a guest", Modifier.align(Alignment.CenterHorizontally)) { app.seeIntro(); app.enterGuest() }
    }
}

@Composable
fun LoginScreen(app: AppState) {
    val up = app.authTab == "signup"
    var name by remember { mutableStateOf("") }; var user by remember { mutableStateOf("") }; var pw by remember { mutableStateOf("") }
    var err by remember { mutableStateOf("") }; var busy by remember { mutableStateOf(false) }
    ScreenColumn {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) { LinkBtn("⚙️") { app.showSheet { ThemeSheet(app) } } }
        Brand(if (up) "Create your account" else "Welcome back")
        Row(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
            listOf("login" to "Log in", "signup" to "Sign up").forEach { (k, l) -> Box(Modifier.weight(1f).padding(2.dp)) { Btn(l, kind = if (app.authTab == k) BtnKind.Primary else BtnKind.Ghost, small = true) { app.authTab = k; err = ""; app.changed() } } }
        }
        Panel {
            if (up) Field("Your name", name, { name = it.take(40) })
            Field("Username", user, { user = it.take(32).trim() })
            Field("Password", pw, { pw = it }, password = true)
            if (up) Muted("Username: 3–32 letters, digits, - or _. Password: at least 6 characters.", size = 13)
            if (err.isNotEmpty()) Text(err, color = pal.red, fontSize = 14.sp, modifier = Modifier.padding(top = 6.dp))
            Btn(if (busy) "…" else if (up) "Create account" else "Log in", enabled = !busy && user.isNotBlank() && pw.isNotEmpty() && (!up || name.isNotBlank())) {
                if (up && !Regex("^[A-Za-z0-9_-]{3,32}$").matches(user)) { err = "Username: 3–32 letters, digits, - or _"; return@Btn }
                busy = true; err = ""
                app.authSubmit(up, user, name.trim(), pw) { e -> busy = false; err = e }
            }
            if (!up) LinkBtn("Forgot password?", Modifier.align(Alignment.CenterHorizontally)) { app.showSheet { ForgotSheet(app, user) } }
            Muted(if (up && app.sync.isGuest) "Your guest progress moves into the new account." else "You stay logged in on this phone for 90 days, even after closing the app.", size = 13, align = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        }
        Btn(if (app.sync.hasGuestData()) "Continue as guest" else "Try it first as a guest", kind = BtnKind.Ghost) { app.enterGuest() }
        Muted("No account needed. Progress stays on this phone; sign up later to keep it.", size = 13, align = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        LinkBtn("What is LevelUp?", Modifier.align(Alignment.CenterHorizontally)) { app.introSeen = false; app.changed() }
        if (de.com.levelup.app.BuildConfig.DEBUG) ServerField(app)
    }
}

/** debug builds: point the app at another server (e.g. the Mac's LAN address from a real phone) */
@Composable
fun ServerField(app: AppState) {
    var url by remember { mutableStateOf(app.g.api.base) }
    Panel(header = "Debug · server") {
        Field("Server URL", url, { url = it.trim() })
        Btn("Use this server", kind = BtnKind.Ghost, small = true) { val u = url.trimEnd('/') + "/"; app.g.kv.set("server.url", u); app.g.api.base = u; app.toast("Server: $u"); app.boot() }
    }
}

@Composable
fun ForgotSheet(app: AppState, user0: String) {
    var u by remember { mutableStateOf(user0) }; var c by remember { mutableStateOf("") }; var err by remember { mutableStateOf("") }
    H2("Forgot password?"); Muted("Send a reset request. The admin will set a new password for you and tell you what it is.")
    Field("Username", u, { u = it.take(32) }); Field("How can we reach you? (optional)", c, { c = it.take(120) })
    if (err.isNotEmpty()) Text(err, color = pal.red)
    Btn("Send request", enabled = u.isNotBlank()) {
        app.g.scope.launchIO({ app.g.api.bug("bug", "Password reset request for \"$u\"" + (if (c.isNotBlank()) ". Contact: $c" else ""), mapOf("page" to "forgot password", "user" to "anon", "resetFor" to u)) }) { r ->
            if (r is Net.Ok) { app.closeSheet(); app.toast("Request sent. You'll get a new password soon.") } else err = "Couldn't send. Check your connection and try again."
        }
    }
    Btn("Cancel", kind = BtnKind.Ghost) { app.closeSheet() }
}

/** run a blocking call off the main thread, then continue on it */
fun <T> kotlinx.coroutines.CoroutineScope.launchIO(work: () -> T, then: (T) -> Unit) = launch { val r = withContext(Dispatchers.IO) { work() }; then(r) }

@Composable
fun ThemeSheet(app: AppState) {
    val mine = app.S != null && app.user != null
    H2("⚙️ Settings"); Muted("Theme")
    THEMES.forEach { (id, label) ->
        Row(Modifier.fillMaxWidth().clickable { if (mine) app.setSetting("theme", id) else { app.g.kv.set("a1.theme", id); app.changed() } }, verticalAlignment = Alignment.CenterVertically) {
            RadioButton(app.themeId() == id, null); P(label)
        }
    }
    Muted(if (mine) "Your theme. You can also change it later in Settings." else "Used on this screen. After you log in, your own theme from Settings applies.", size = 13)
    Btn("Done") { app.closeSheet() }
}

/** old servers without accounts: pick a learner */
@Composable
fun PlayerPicker(app: AppState) {
    ScreenColumn {
        Brand("Who’s learning today?"); Muted("Select your player.", align = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        app.sync.users.forEach { u ->
            Panel(onClick = { app.pickPlayer(u.id) }) { Row2 { Avatar(u.name, u.color, 44.dp); B(u.name, Modifier.weight(1f), size = 20); Text("›", color = pal.muted, fontSize = 24.sp) } }
        }
    }
}

@Composable
fun CoursePicker(app: AppState) {
    var busy by remember { mutableStateOf(false) }
    val sm = remember(app.tick, app.course?.id) { app.S?.let { s -> if (!app.isTree) app.store.summary(de.com.levelup.core.deepCopy(s) as JObj) else null } }
    ScreenColumn {
        Row2 { UserChip(app); Box(Modifier.weight(1f)); LinkBtn("⚙️") { app.showSheet { ThemeSheet(app) } } }
        Column(Modifier.fillMaxWidth().padding(vertical = 18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            SysHeader("Select a path"); H1("What do you want to study?")
            Muted("Pick a course. Each one keeps its own level, rank and progress.", align = TextAlign.Center)
        }
        app.courses.groupBy { it.group ?: "Courses" }.forEach { (grp, cs) ->
            B(grp, Modifier.padding(top = 10.dp), size = 18)
            cs.forEach { c ->
                val here = c.id == app.course?.id
                val col = runCatching { Color(android.graphics.Color.parseColor(c.color ?: "#5aa9ff")) }.getOrDefault(pal.accent)
                Panel(highlight = here, onClick = if (c.ready && !busy) ({
                    busy = true
                    if (c.id != app.course?.id) app.switchCourse(c) { busy = false } else { app.picked = true; app.resetStack(); app.changed() }
                }) else null) {
                    Row2 {
                        Box(Modifier.border(2.dp, col, RoundedCornerShape(12.dp)).padding(8.dp)) { Text(c.icon, fontSize = 26.sp) }
                        Column(Modifier.weight(1f)) {
                            B(c.title, color = if (c.ready) pal.ink else pal.muted)
                            Muted(if (here && sm != null) "Lv ${sm.lv} · ${sm.rank}-Rank · ${sm.pct.toInt()}% done" else c.subtitle ?: "", size = 13)
                        }
                        Text(if (c.ready) (if (here) "Continue ›" else "Start ›") else "Coming Soon", color = if (c.ready) col else pal.muted, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun SetupScreen(app: AppState) {
    @Suppress("UNUSED_VARIABLE") val tk = app.tick
    val st = app.store
    val in3 = remember { Dates.iso(Dates.parse(st.today()).plusMonths(3)) }
    var target by remember { mutableStateOf(in3) }
    var goal by remember { mutableStateOf("auto") }
    val days = runCatching { Dates.daysBetween(st.today(), target) }.getOrDefault(0)
    ScreenColumn {
        LinkBtn("‹ Not ${app.userName}?") { if (app.sync.isGuest) app.leaveGuest() else app.logout() }
        H1("${if (app.cd?.lang?.code == "fr") "Bienvenue" else "Willkommen"}, ${app.userName}! 👋")
        Muted("${app.course?.icon} ${app.course?.title} · ${app.course?.subtitle ?: ""}")
        Panel {
            B("When do you want to finish A1?", size = 15)
            Row2 { Field("Target date (YYYY-MM-DD)", target, { target = it.take(10) }, keyboard = KeyboardType.Number, modifier = Modifier.weight(1f)); B(if (days > 0) "$days day${if (days == 1) "" else "s"}" else "pick a future date", size = 14) }
            Row2 { listOf(1, 3, 6).forEach { m -> Box(Modifier.weight(1f)) { Btn("$m month${if (m > 1) "s" else ""}", kind = BtnKind.Ghost, small = true) { target = Dates.iso(Dates.parse(st.today()).plusMonths(m.toLong())) } } } }
            Muted("Your pace counts from today (${Dates.fmt(st.today())}).", size = 13)
            Gap(); B("Daily goal", size = 15)
            listOf("auto" to ("Auto" to "Recommended · sets the goal so you reach A1 by your date"), "10" to ("Casual" to "10 XP a day"), "20" to ("Regular" to "20 XP a day"),
                "30" to ("Serious" to "30 XP a day"), "45" to ("Intense" to "45 XP a day")).forEach { (v, l) ->
                Row(Modifier.fillMaxWidth().padding(vertical = 2.dp).clip(RoundedCornerShape(10.dp)).border(1.dp, if (goal == v) pal.accent else pal.line, RoundedCornerShape(10.dp)).clickable { goal = v }.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(goal == v, null); Column { B(l.first, size = 15); Muted(l.second, size = 13) }
                }
            }
            Muted("⚡ 1 XP ≈ one new word learned. Each finished part adds +2 (+1 if perfect) and a whole lesson +5. Reviews give a little (+1 per 5 words recalled) and forgetting costs XP. 20 XP ≈ one new lesson a day.", size = 13)
        }
        Btn("Start learning") {
            val ok = runCatching { Dates.parse(target) }.isSuccess && target > st.today()
            if (!ok) { app.toast("Pick a target date in the future"); return@Btn }
            val set = st.settings(); set["targetDate"] = target; set["startDate"] = st.today()
            if (goal == "auto") set["goalMode"] = "auto" else { set["goalMode"] = "manual"; set["dailyGoal"] = goal.toDouble() }
            app.S!!["setup"] = true; st.save(); app.resetStack(); app.changed()
        }
    }
}

@Composable
fun UserChip(app: AppState) {
    val u = app.sync.userInfo(app.user)
    Row(Modifier.clip(RoundedCornerShape(20.dp)).clickable { app.showSheet { UserSheet(app) } }.padding(2.dp), verticalAlignment = Alignment.CenterVertically) {
        Avatar(u.name, u.color, 34.dp); Text(" ▾", color = pal.muted, fontSize = 12.sp)
    }
}
@Composable
fun CourseChip(app: AppState) {
    val c = app.course ?: return
    Row(Modifier.clip(RoundedCornerShape(20.dp)).border(1.dp, pal.line, RoundedCornerShape(20.dp)).clickable { app.picked = false; app.changed() }.padding(horizontal = 10.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(c.icon, fontSize = 18.sp); Sp(4); B(c.short ?: c.title, size = 14); Text(" ▾", color = pal.muted, fontSize = 12.sp)
    }
}

@Composable
fun UserSheet(app: AppState) {
    val u = app.sync.userInfo(app.user)
    H2("Account")
    if (app.sync.isGuest) {
        GuestNote()
        Btn("Create free account") { app.closeSheet(); app.authTab = "signup"; app.sync.signOut(); app.changed() }
        Btn("I have an account", kind = BtnKind.Ghost) { app.closeSheet(); app.authTab = "login"; app.sync.signOut(); app.changed() }
        LinkBtn("Leave guest mode") { app.closeSheet(); app.leaveGuest() }
        return
    }
    Row2(Modifier.padding(vertical = 10.dp)) { Avatar(u.name, u.color, 44.dp); Column { B(u.name, size = 18); Muted("Logged in as ${u.id}") } }
    if (app.sync.auth == "on") {
        Btn("Change password", kind = BtnKind.Ghost) { app.showSheet { PasswordSheet(app) } }
        Btn("Log out") { app.closeSheet(); app.logout() }
    } else app.sync.users.forEach { x -> Btn(x.name + if (x.id == app.user) " ✓" else "", kind = BtnKind.Ghost) { app.closeSheet(); if (x.id != app.user) app.pickPlayer(x.id) } }
}
@Composable
fun GuestNote() {
    B("👋 You're trying LevelUp as a guest", size = 16)
    Muted("Your progress is saved only on this phone. Create a free account to keep it, back it up and use it on other devices: everything you've done so far moves into the account.")
}
@Composable
fun PasswordSheet(app: AppState) {
    var old by remember { mutableStateOf("") }; var nw by remember { mutableStateOf("") }; var err by remember { mutableStateOf("") }
    H2("Change password")
    Field("Current password", old, { old = it }, password = true); Field("New password", nw, { nw = it }, password = true)
    if (err.isNotEmpty()) Text(err, color = pal.red)
    Btn("Change password", enabled = old.isNotEmpty() && nw.length >= 6) { app.changePassword(old, nw) { e -> if (e == null) { app.closeSheet(); app.toast("Password changed · other devices logged out") } else err = e } }
    Btn("Cancel", kind = BtnKind.Ghost) { app.closeSheet() }
}


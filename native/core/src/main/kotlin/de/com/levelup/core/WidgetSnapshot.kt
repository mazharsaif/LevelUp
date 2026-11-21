package de.com.levelup.core

/**
 * Everything a home-screen widget, a reminder or an alarm needs, computed once after each save so they never
 * have to load a course or run the store logic themselves (see native/README.md, "Reminders, alarms, widgets").
 * Plain values only; serialised to one small JSON string.
 */
data class WidgetSnapshot(
    val user: String,
    val userName: String,
    val course: String,
    val courseTitle: String,
    val courseIcon: String,
    val isTree: Boolean,
    val day: String,            // the day the numbers are for (yyyy-MM-dd)
    val streak: Int,
    val xpToday: Int,
    val xpGoal: Int,            // 0 when Quest Mode is off or for skill-tree courses
    val dueWords: Int,
    val level: Int,
    val rank: String,           // E … S
    val aura: Double,           // 0 … 1
    val pctA1: Double,          // memory-adjusted A1 % (language courses), skills-learned % (tree courses)
    val nextTitle: String?,     // next lesson part (language) or next skill (tree)
    val partsToday: Int,
    val partsGoal: Int,
    val questMode: Boolean,
    val goalReached: Boolean,
    val updatedAt: Long,
) {
    fun toJson(): String = Js.stringify(linkedMapOf(
        "user" to user, "userName" to userName, "course" to course, "courseTitle" to courseTitle, "courseIcon" to courseIcon, "isTree" to isTree,
        "day" to day, "streak" to streak, "xpToday" to xpToday, "xpGoal" to xpGoal, "dueWords" to dueWords, "level" to level, "rank" to rank,
        "aura" to aura, "pctA1" to pctA1, "nextTitle" to nextTitle, "partsToday" to partsToday, "partsGoal" to partsGoal, "questMode" to questMode,
        "goalReached" to goalReached, "updatedAt" to updatedAt.toDouble()))

    companion object {
        fun fromJson(s: String): WidgetSnapshot? = runCatching {
            val o = Js.parseObj(s)
            WidgetSnapshot(o.str("user")!!, o.str("userName") ?: "", o.str("course")!!, o.str("courseTitle") ?: "", o.str("courseIcon") ?: "", o.bool("isTree"),
                o.str("day") ?: "", o.num("streak").toInt(), o.num("xpToday").toInt(), o.num("xpGoal").toInt(), o.num("dueWords").toInt(), o.num("level").toInt(),
                o.str("rank") ?: "E", o.num("aura"), o.num("pctA1"), o.str("nextTitle"), o.num("partsToday").toInt(), o.num("partsGoal").toInt(),
                o.bool("questMode"), o.bool("goalReached"), o.num("updatedAt").toLong())
        }.getOrNull()

        /** Language course snapshot. Calling it may freeze today's goal in S (goalDay), exactly like opening Today. */
        fun of(store: Store, cd: CourseData, user: String, userName: String): WidgetSnapshot {
            val S = store.S!!
            val pr = store.progress(S); val lv = store.level(pr.total, S)
            val quest = store.questMode(S)
            val nx = if (quest) store.nextPick(S) else store.nextItem(S)
            val nextTitle = nx?.let { (if (it.kind == "vocab") "Lesson ${it.n}: ${it.title}" else it.title) + (if (store.bitCount(it) > 1) " · part ${minOf(store.bitsDone(it, S) + 1, store.bitCount(it))} of ${store.bitCount(it)}" else "") }
            val goal = if (quest) store.goalFor(S) else 0.0
            val x = store.xpToday(S)
            return WidgetSnapshot(user, userName, cd.course.id, cd.course.title, cd.course.icon, false, store.today(), store.streak(S), x.toInt(), goal.toInt(),
                store.dueWords(S).size, lv.lv, store.rank(pr.total).r, Hero.aura(lv.lv), pr.total, nextTitle, store.partsToday(S),
                if (quest) store.partsGoal(S) else 0, quest, quest && x >= goal, store.nowMs())
        }
        fun ofTree(store: Store, tree: Tree, course: Course, user: String, userName: String): WidgetSnapshot {
            val S = store.S!!
            val all = tree.openBranches().flatMap { tree.nodes(it.id) }
            val learned = all.count { tree.nodeDone(it.id) }
            val ct = tree.continueTarget()
            return WidgetSnapshot(user, userName, course.id, course.title, course.icon, true, store.today(), store.streak(S), store.xpToday(S).toInt(), 0, 0,
                1, "E", 0.0, if (all.isEmpty()) 0.0 else 100.0 * learned / all.size, ct?.let { "Skill ${it.n.n} · ${it.n.title}" }, 0, 0, false, false, store.nowMs())
        }
    }
}

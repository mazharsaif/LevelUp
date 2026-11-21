package de.com.levelup.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement

/** Content files served by the web app (app/data/…): read only, so typed classes are fine here. */
val contentJson = Json { ignoreUnknownKeys = true; isLenient = true; coerceInputValues = true; explicitNulls = false }

@Serializable
data class Course(
    val id: String, val title: String, val short: String? = null, val subtitle: String? = null, val group: String? = null,
    val icon: String = "", val color: String? = null, val status: String = "soon", val type: String? = null,
    val lang: String? = null, val content: String? = null,
) {
    val ready get() = status == "ready"
    val isTree get() = type == "tree"
}

@Serializable
data class CourseList(val courses: List<Course>)

@Serializable
data class Ex(val de: String, val en: String = "", val a: String? = null)

@Serializable
data class Word(
    val id: String, val de: String, val en: String = "", val type: String = "", val topic: String = "", val core: Boolean = false,
    val hint: String? = null, val hintHi: String? = null, val ex: List<Ex> = emptyList(), @SerialName("type_ans") val typeAns: String? = null,
    val a: String? = null, val g: String? = null, val pl: String? = null, val fem: String? = null, val forms: String? = null,
    val perf: String? = null, val labels: List<String> = emptyList(), val notes: List<String> = emptyList(), val alt: List<String> = emptyList(),
)

@Serializable
data class GQ(val q: String, val a: String = "", val opts: List<String>? = null, val note: String? = null, val audio: String? = null,
              val say: String? = null, val myName: Boolean = false)

@Serializable
data class Mistake(val wrong: String = "", val right: String = "", val why: String = "")

@Serializable
data class GPart(val t: String, val html: String, val q: List<Int>)

@Serializable
data class Grammar(
    val id: String, val num: Int = 0, val title: String = "", val watch: String? = null, val intro: String = "",
    val body: String = "", val after: String? = null, val q: List<GQ> = emptyList(), val ex: List<Ex> = emptyList(),
    val mist: List<Mistake> = emptyList(), val gap: Int? = null, var parts: List<GPart>? = null,
)

@Serializable
data class Phrase(val de: String, val en: String = "", val grp: String? = null, val a: String? = null)

@Serializable
data class PhraseSec(val id: String, val title: String = "", val tip: String? = null, val items: List<Phrase> = emptyList())

@Serializable
data class PathItem(
    val id: String, val kind: String, var n: Int? = null, var title: String = "", val words: List<String> = emptyList(),
    val week: Int? = null, val day: Int? = null,
    // set when a grammar chapter is cut into parts
    val gid: String? = null, val part: Int? = null, val of: Int? = null,
)

@Serializable
data class LangContent(
    val version: Int = 1, val lang: String? = null, val planStart: String? = null,
    val words: List<Word> = emptyList(), val grammar: List<Grammar> = emptyList(), val phrases: List<PhraseSec> = emptyList(),
    val path: List<PathItem> = emptyList(),
)

// ---------- skill-tree courses (Software Engineering, Maths) ----------
@Serializable
data class Branch(val id: String, val title: String, val icon: String = "", val color: String = "#5aa9ff", val status: String = "soon",
                  val order: Int = 0, val planned: List<String> = emptyList(), val reading: String? = null, val intro: Int? = null)

@Serializable
data class NodePart(val t: List<String>, val a: Int, val b: Int)

@Serializable
data class TreeNode(
    val id: String, val branch: String, val n: Int = 0, val level: Int = 0, val col: Int = 1, val icon: String = "", val req: List<String> = emptyList(),
    val mins: Int = 0, val chapter: Int = 0, val title: String = "", val short: String? = null, val learn: List<String> = emptyList(),
    val concepts: List<String> = emptyList(), val exercises: List<String> = emptyList(), val parts: List<NodePart> = emptyList(),
    val quiz: Int = 0, val cc: Int = 0, val boss: Boolean = false,
)

@Serializable
data class TreeContent(val title: String = "", val xpPerSkill: Int = 15, val branches: List<Branch> = emptyList(), val nodes: List<TreeNode> = emptyList())

@Serializable
data class Card(val s: String = "", val sub: String? = null, val html: String = "", val words: Int = 0)

/** A practice / concept-check question. `a` is an index (mc/step), a boolean (tf/mf), "always|sometimes|never" (asn) or a number (num). */
@Serializable
data class QuizQ(val t: String, val q: String = "", val o: List<String> = emptyList(), val a: JsonElement? = null, val why: String = "",
                 val lines: List<String> = emptyList(), val unit: String? = null, val tol: Double? = null, val gap: String? = null) {
    /** the answer as text ("1", "true", "sometimes", "-13") */
    val aText: String? get() = (a as? kotlinx.serialization.json.JsonPrimitive)?.content
}

@Serializable
data class Chapter(val title: String = "", val cards: List<Card> = emptyList(), val parts: List<NodePart> = emptyList(),
                   val quiz: List<QuizQ> = emptyList(), val concept: List<QuizQ> = emptyList())

@Serializable
data class ChapterInfo(val title: String = "", val cards: Int = 0, val bytes: Int = 0, val parts: Int = 0, val quiz: Int = 0, val cc: Int = 0)

@Serializable
data class ChapterIndex(val chapters: Map<String, ChapterInfo> = emptyMap())

object ContentParser {
    fun courses(json: String): List<Course> = contentJson.decodeFromString<CourseList>(json).courses
    fun lang(json: String): LangContent = contentJson.decodeFromString(json)
    fun tree(json: String): TreeContent = contentJson.decodeFromString(json)
    fun chapter(json: String): Chapter = contentJson.decodeFromString(json)
    fun index(json: String): ChapterIndex = contentJson.decodeFromString(json)
}

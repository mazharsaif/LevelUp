package de.com.levelup.core

/**
 * A tiny JavaScript-shaped JSON model, so the native app reads and writes the SAME progress file as the web
 * app (app/js/store.js) without losing anything: objects are LinkedHashMaps (unknown keys survive every
 * round trip), arrays are ArrayLists, every number is a Double (like JS) and is written back the way
 * JSON.stringify writes it (2, not 2.0).
 */
typealias JObj = MutableMap<String, Any?>
typealias JArr = MutableList<Any?>

fun jobj(vararg kv: Pair<String, Any?>): JObj = linkedMapOf(*kv)
fun jarr(vararg v: Any?): JArr = arrayListOf(*v)

@Suppress("UNCHECKED_CAST")
fun Any?.asObj(): JObj? = this as? MutableMap<String, Any?>
@Suppress("UNCHECKED_CAST")
fun Any?.asArr(): JArr? = this as? MutableList<Any?>
fun Any?.asNum(): Double? = (this as? Number)?.toDouble()
fun Any?.asStr(): String? = this as? String

/** JS truthiness: null / false / 0 / NaN / "" are falsy. */
fun truthy(v: Any?): Boolean = when (v) {
    null -> false
    is Boolean -> v
    is Number -> v.toDouble().let { it != 0.0 && !it.isNaN() }
    is String -> v.isNotEmpty()
    else -> true
}

/** `o[k] || (o[k] = {})` */
fun JObj.obj(k: String): JObj = get(k).asObj() ?: linkedMapOf<String, Any?>().also { put(k, it) }
/** `o[k] || (o[k] = [])` */
fun JObj.arr(k: String): JArr = get(k).asArr() ?: arrayListOf<Any?>().also { put(k, it) }
/** `(o[k] || {})` without creating it */
fun JObj.ro(k: String): Map<String, Any?> = get(k).asObj() ?: emptyMap()
fun JObj.num(k: String, def: Double = 0.0): Double = get(k).asNum() ?: def
fun JObj.str(k: String): String? = get(k).asStr()
fun JObj.bool(k: String): Boolean = truthy(get(k))

/** Deep copy (structuredClone / JSON round trip). */
fun deepCopy(v: Any?): Any? = when (v) {
    is Map<*, *> -> LinkedHashMap<String, Any?>().also { m -> v.forEach { (k, x) -> m[k as String] = deepCopy(x) } }
    is List<*> -> ArrayList<Any?>(v.size).also { l -> v.forEach { l.add(deepCopy(it)) } }
    is Number -> v.toDouble()
    else -> v
}

object Js {
    fun parse(s: String): Any? = Parser(s).run { val v = value(); ws(); if (i != s.length) err("trailing data"); v }
    fun parseObj(s: String): JObj = parse(s).asObj() ?: throw IllegalArgumentException("not a JSON object")

    fun stringify(v: Any?): String = StringBuilder().also { write(it, v) }.toString()

    private fun write(sb: StringBuilder, v: Any?) {
        when (v) {
            null -> sb.append("null")
            is Boolean -> sb.append(v)
            is Number -> sb.append(num(v.toDouble()))
            is String -> str(sb, v)
            is Map<*, *> -> {
                sb.append('{'); var first = true
                for ((k, x) in v) {
                    if (x === Undefined) continue
                    if (!first) sb.append(','); first = false
                    str(sb, k.toString()); sb.append(':'); write(sb, x)
                }
                sb.append('}')
            }
            is List<*> -> {
                sb.append('['); v.forEachIndexed { i, x -> if (i > 0) sb.append(','); write(sb, if (x === Undefined) null else x) }; sb.append(']')
            }
            else -> str(sb, v.toString())
        }
    }

    /** Number formatting like JS Number.prototype.toString for the values a progress file holds. */
    fun num(d: Double): String {
        if (d.isNaN() || d.isInfinite()) return "null"
        if (d == Math.rint(d) && kotlin.math.abs(d) < 1e21) return d.toLong().toString()
        val a = kotlin.math.abs(d)
        if (a >= 1e-6 && a < 1e21) return java.math.BigDecimal(d.toString()).stripTrailingZeros().toPlainString()
        val s = d.toString() // 1.0E-7
        val (m, e) = s.split("E")
        val mm = m.removeSuffix(".0")
        return "${mm}e${if (e.startsWith("-")) e else "+$e"}"
    }

    private fun str(sb: StringBuilder, s: String) {
        sb.append('"')
        for (c in s) when (c) {
            '"' -> sb.append("\\\"")
            '\\' -> sb.append("\\\\")
            '\n' -> sb.append("\\n")
            '\r' -> sb.append("\\r")
            '\t' -> sb.append("\\t")
            '\b' -> sb.append("\\b")
            '\u000C' -> sb.append("\\f")
            else -> if (c < ' ') sb.append(String.format("\\u%04x", c.code)) else sb.append(c)
        }
        sb.append('"')
    }

    private class Parser(val s: String) {
        var i = 0
        fun err(m: String): Nothing = throw IllegalArgumentException("JSON: $m at $i")
        fun ws() { while (i < s.length && (s[i] == ' ' || s[i] == '\n' || s[i] == '\r' || s[i] == '\t')) i++ }
        fun value(): Any? {
            ws()
            if (i >= s.length) err("unexpected end")
            return when (val c = s[i]) {
                '{' -> { i++; val m = LinkedHashMap<String, Any?>(); ws()
                    if (s[i] == '}') { i++; return m }
                    while (true) { ws(); val k = string(); ws(); if (s[i] != ':') err("expected :"); i++; m[k] = value(); ws()
                        when (s[i]) { ',' -> i++; '}' -> { i++; return m }; else -> err("expected , or }") } }
                    @Suppress("UNREACHABLE_CODE") m }
                '[' -> { i++; val l = ArrayList<Any?>(); ws()
                    if (s[i] == ']') { i++; return l }
                    while (true) { l.add(value()); ws()
                        when (s[i]) { ',' -> i++; ']' -> { i++; return l }; else -> err("expected , or ]") } }
                    @Suppress("UNREACHABLE_CODE") l }
                '"' -> string()
                't' -> { expect("true"); true }
                'f' -> { expect("false"); false }
                'n' -> { expect("null"); null }
                else -> if (c == '-' || c.isDigit()) number() else err("unexpected '$c'")
            }
        }
        fun expect(w: String) { if (!s.startsWith(w, i)) err("expected $w"); i += w.length }
        fun number(): Double {
            val st = i
            if (s[i] == '-') i++
            while (i < s.length && (s[i].isDigit() || s[i] == '.' || s[i] == 'e' || s[i] == 'E' || s[i] == '+' || s[i] == '-')) i++
            return s.substring(st, i).toDouble()
        }
        fun string(): String {
            if (s[i] != '"') err("expected string")
            i++
            val sb = StringBuilder()
            while (true) {
                if (i >= s.length) err("unterminated string")
                val c = s[i++]
                when (c) {
                    '"' -> return sb.toString()
                    '\\' -> when (val e = s[i++]) {
                        '"' -> sb.append('"'); '\\' -> sb.append('\\'); '/' -> sb.append('/')
                        'b' -> sb.append('\b'); 'f' -> sb.append('\u000C'); 'n' -> sb.append('\n')
                        'r' -> sb.append('\r'); 't' -> sb.append('\t')
                        'u' -> { sb.append(s.substring(i, i + 4).toInt(16).toChar()); i += 4 }
                        else -> err("bad escape \\$e")
                    }
                    else -> sb.append(c)
                }
            }
        }
    }
}

/** Marker for "delete this key on write" (JS `undefined`). */
object Undefined

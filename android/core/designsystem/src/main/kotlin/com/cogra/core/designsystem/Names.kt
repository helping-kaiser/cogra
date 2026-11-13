// A LONG NAME OR HANDLE TAKES ONE OF THREE CASES, BY ITS PLACE (design/readme.md
// §13; jakob 2026-11-11, round 40; NamesLong.md). The person row is
// `ActorChip`'s own law; the other two are these, the android twins of
// `nameInLine` and `nameInText` in design/components/people/ActorChip.jsx
// (web's are web/src/lib/ui/names.tsx).
//
// ONE-LINE PLACES ([NameInLine]): a page title, a menu row, a row's title and
// its aside never wrap and clip at their end. Where the handle ENDS the line
// (`Hide @ada`, `on @mira`, a title that is only `@ada`) that end clip already
// cuts the handle and keeps the words, so the line stays one Text. Where words
// FOLLOW it (`@ada commented on your post`) the line splits into [words]
// [the handle][words] in a Row: the words are measured first at their own
// width and the handle is the one weighted part, so it is what the ellipsis
// cuts — the master's flexbox arithmetic (`flex: none` words, a `minWidth: 0`
// handle) in Compose's own (`Row` measures unweighted children first,
// developer.android.com/develop/ui/compose/layouts/basics).
//
// TEXT THAT WRAPS ([NameInText]): the sentence wraps at its spaces and is never
// cut as a whole, but a handle — or a person's name passed in `names` — never
// stands on two lines. Compose has no keep-together span: `LineBreak` and
// `Hyphens` choose a paragraph's strategy, not a span's
// (developer.android.com/develop/ui/compose/text/style-paragraph). So the unit
// is made unbreakable the Unicode way, a WORD JOINER (U+2060) between each of
// its graphemes and before its trailing punctuation (UAX #14, rule LB11: no
// break on either side of WJ), and the platform's own line breaker moves it
// whole to the next line. A unit wider than a full line is end-cut with "…" at
// the width the text is given, measured with the same style
// (`TextMeasurer`, developer.android.com/develop/ui/compose/graphics/draw/overview#measure-text,
// inside `BoxWithConstraints`). Punctuation right after it (`?`, `.`, `,`,
// `'s`) rides with it, whole and never swallowed by the cut. The word joiner is
// a default-ignorable format character: it draws nothing and joins no glyphs,
// and the node speaks the text as written.

package com.cogra.core.designsystem

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.SemanticsPropertyKey
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.text
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import java.text.BreakIterator

/** A handle in running text: `@` and its characters, not inside a word or an email. */
private val HANDLE = Regex("""(?<![\w@])@[A-Za-z0-9_]+""")

/** The punctuation that rides with a unit (`ActorChip.jsx` `UNIT_TAIL`). */
private val UNIT_TAIL = Regex("""^(?:['’]s\b|[?.,!:;)’]+)""")

/** U+2060 WORD JOINER: no line break on either side (UAX #14 LB11). */
const val WORD_JOINER: Char = '\u2060'

/** The ellipsis `TextOverflow.Ellipsis` draws. */
internal const val ELLIPSIS: String = "\u2026"

/**
 * Marks a one-line place that [NameInLine] split, with the handle that yields
 * (web's `data-name-line`): for tests and the conformance harness.
 */
val NameLineHandle = SemanticsPropertyKey<String>("NameLineHandle", mergePolicy = ::outerFirst)

/**
 * Marks wrapping text that [NameInText] holds units in, with each unit as
 * written, its punctuation included (web's `data-name-unit`).
 */
val NameUnits = SemanticsPropertyKey<List<String>>("NameUnits", mergePolicy = ::outerFirst)

/** A mark merges up to the node that merges its children (a tagged, merged row reads it). */
private fun <T> outerFirst(parent: T?, child: T): T = parent ?: child

/** A one-line place split around its first handle: the words, the handle, the words. */
data class NameLine(val before: String, val handle: String, val after: String)

/**
 * The split [NameInLine] draws, or null where the line stays one Text: no
 * handle, or a handle that ends the line (the end clip already cuts it).
 */
fun nameLine(text: String): NameLine? {
    val found = HANDLE.find(text) ?: return null
    val after = text.substring(found.range.last + 1)
    if (after.isBlank()) return null
    return NameLine(text.substring(0, found.range.first), found.value, after)
}

/** One unit in wrapping text: the name at [start] until [nameEnd], its punctuation until [end]. */
data class NameUnit(val start: Int, val nameEnd: Int, val end: Int)

/** Every handle in [text], and every one of [names], as units with their trailing punctuation. */
fun nameUnits(text: String, names: List<String> = emptyList()): List<NameUnit> {
    val given = names.filter { it.isNotBlank() }.map { Regex.escape(it) }
    val pattern = if (given.isEmpty()) HANDLE else Regex((listOf(HANDLE.pattern) + given).joinToString("|"))
    val units = mutableListOf<NameUnit>()
    var from = 0
    while (from <= text.length) {
        val found = pattern.find(text, from) ?: break
        val nameEnd = found.range.last + 1
        val tail = UNIT_TAIL.find(text.substring(nameEnd))?.value.orEmpty()
        units += NameUnit(found.range.first, nameEnd, nameEnd + tail.length)
        from = maxOf(nameEnd + tail.length, found.range.first + 1)
    }
    return units
}

/** Each grapheme's start inside [text] after the first: where a joiner or a cut may stand. */
private fun graphemeBoundaries(text: String): List<Int> {
    val graphemes = BreakIterator.getCharacterInstance().apply { setText(text) }
    return generateSequence(graphemes.next()) { graphemes.next() }
        .takeWhile { it != BreakIterator.DONE && it < text.length }
        .toList()
}

/** [text] with a word joiner at every grapheme boundary: one unbreakable run. */
fun joined(text: String): String {
    val boundaries = graphemeBoundaries(text).toSet()
    return buildString {
        text.forEachIndexed { index, char ->
            if (index in boundaries) append(WORD_JOINER)
            append(char)
        }
    }
}

/**
 * The longest start of [name] that, with "…" and its [tail], is at most
 * [lineWidth] wide by [widthOf]; "…" alone where not one grapheme fits.
 */
fun cutName(name: String, tail: String, lineWidth: Int, widthOf: (String) -> Int): String {
    val cuts = graphemeBoundaries(name)
    var low = 0
    var high = cuts.size
    while (low < high) {
        val middle = (low + high + 1) / 2
        val fits = widthOf(name.substring(0, cuts[middle - 1]) + ELLIPSIS + tail) <= lineWidth
        if (fits) low = middle else high = middle - 1
    }
    return (if (low == 0) "" else name.substring(0, cuts[low - 1])) + ELLIPSIS
}

/**
 * [text] as [NameInText] lays it out: each unit joined with its punctuation
 * into one unbreakable run, and a unit wider than [lineWidth] (when bounded)
 * end-cut with "…" first.
 */
fun shapeNamesInText(text: String, units: List<NameUnit>, lineWidth: Int?, widthOf: (String) -> Int): String =
    buildString {
        var last = 0
        units.forEach { unit ->
            append(text, last, unit.start)
            val name = text.substring(unit.start, unit.nameEnd)
            val tail = text.substring(unit.nameEnd, unit.end)
            val shown = lineWidth
                ?.takeIf { widthOf(name + tail) > it }
                ?.let { cutName(name, tail, it, widthOf) }
                ?: name
            append(joined(shown + tail))
            last = unit.end
        }
        append(text, last, text.length)
    }

/**
 * A one-line place's text (`nameInLine`): never wraps, clips at its end, and
 * where words follow its first `@handle` the handle is the part cut with "…"
 * while the words keep their room. The node speaks [text] whole.
 */
@Composable
fun NameInLine(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = LocalTextStyle.current,
    color: Color = Color.Unspecified,
) {
    val line = remember(text) { nameLine(text) }
    if (line == null) {
        Text(text, modifier, color = color, style = style, maxLines = 1, overflow = TextOverflow.Ellipsis)
        return
    }
    // The space before the handle rides at the handle's start, where a trailing
    // space would be measured away from the words it follows.
    val lead = line.before.trimEnd()
    val gap = line.before.substring(lead.length)
    Row(
        modifier.clearAndSetSemantics {
            this.text = AnnotatedString(text)
            this[NameLineHandle] = line.handle
        },
    ) {
        if (lead.isNotEmpty()) {
            Text(lead, color = color, style = style, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        Text(
            text = gap + line.handle,
            color = color,
            style = style,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f, fill = false),
        )
        Text(line.after, color = color, style = style, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/**
 * Wrapping text (`nameInText`) whose every `@handle` — and every one of
 * [names] — is one unit that never stands on two lines: whole on the next line
 * when it does not fit the rest of this one, end-cut with "…" past a full line,
 * its trailing punctuation kept beside it. Text naming nobody is a plain Text.
 * The node speaks [text] as written: its `Text` semantics is the original
 * string, so `hasText` matches it whole or by substring, and nothing that
 * reads the node ever sees a joiner or a cut. It offers no text-layout action,
 * because the drawn string's offsets are not the spoken string's.
 */
@Composable
fun NameInText(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = LocalTextStyle.current,
    color: Color = Color.Unspecified,
    names: List<String> = emptyList(),
) {
    val units = remember(text, names) { nameUnits(text, names) }
    if (units.isEmpty()) {
        Text(text, modifier, color = color, style = style)
        return
    }
    val measurer = rememberTextMeasurer()
    val written = units.map { text.substring(it.start, it.end) }
    // The caller's node speaks the text as written — never the joiners or a
    // cut — and its own semantics (a tag, a heading, a description) ride
    // ahead of the clearing, so they stay.
    BoxWithConstraints(
        modifier.clearAndSetSemantics {
            this.text = AnnotatedString(text)
            this[NameUnits] = written
        },
    ) {
        val lineWidth = constraints.maxWidth.takeIf { constraints.hasBoundedWidth }
        val shown = remember(text, units, lineWidth, style, measurer) {
            shapeNamesInText(text, units, lineWidth) { piece ->
                measurer.measure(piece, style, softWrap = false, maxLines = 1).size.width
            }
        }
        Text(shown, color = color, style = style)
    }
}

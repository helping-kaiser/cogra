// THE NAME'S TWO-LINE RULE (`design/components/people/ProfileHeader.jsx`
// `nameFitSize`; Profile.md:105; TagPage.md:9-11): a name that would take more
// than two lines at the title role's 22 on 28 takes the largest whole size from
// 22 down that holds two, its leading round(size × 28 / 22). The profile head
// has no smallest size; the tag page's heading passes a floor (jakob
// 2026-11-23: never below 12), and a name that holds two lines at no size down
// to it stands at the floor on the lines it needs there. One rule, one fitter,
// any host — web's twin is `web/src/lib/ui/name-fit.ts`.
//
// THE PLATFORM COUNTS THE LINES. Each candidate size is laid out with the
// host's own style at the width the name is given (`TextMeasurer`,
// developer.android.com/develop/ui/compose/graphics/draw/overview#measure-text,
// inside `BoxWithConstraints`), and the line count of that layout is the
// answer — the same line breaker the drawn `Text` uses, so it wraps at spaces
// and hyphens and breaks inside a run too wide for its line, as the master's
// `overflow-wrap: break-word` does. The board's px are the app's sp, as every
// role in the type scale is.

package com.cogra.core.designsystem

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.SemanticsPropertyKey
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.sp
import kotlin.math.roundToInt

/** A name's size and leading, in whole sp. */
data class NameFit(val size: Int, val lineHeight: Int)

/** The title role's own size and leading, where every name starts. */
private const val ROLE_SIZE = 22
private const val ROLE_LEADING = 28

/** The most lines a fitted name takes above the floor. */
private const val NAME_LINES = 2

/** The leading at [size]: round(size × 28 / 22), half up. */
fun nameLeading(size: Int): Int = (size * ROLE_LEADING / ROLE_SIZE.toDouble()).roundToInt()

/** The role's own fit: the name holds two lines at 22 on 28. */
val RoleNameFit = NameFit(ROLE_SIZE, ROLE_LEADING)

/**
 * The largest whole size from 22 down, in steps of 1, at which the name takes
 * at most two lines, its leading [nameLeading]. [lines] counts the name's lines
 * at a size and leading. [floor] is the smallest size (default 1, the profile
 * head's: two lines are its hard cap); below it nothing is asked.
 */
fun nameFitSize(floor: Int = 1, lines: (size: Int, lineHeight: Int) -> Int): NameFit {
    for (size in ROLE_SIZE downTo floor + 1) {
        val lineHeight = nameLeading(size)
        if (lines(size, lineHeight) <= NAME_LINES) return NameFit(size, lineHeight)
    }
    return NameFit(floor, nameLeading(floor))
}

/** The size a [FittedName] stands at (web's inline font size): for tests and the conformance harness. */
val NameFitSize = SemanticsPropertyKey<NameFit>("NameFitSize")

/** [style] at [fit]'s size and leading. */
fun TextStyle.at(fit: NameFit): TextStyle = copy(fontSize = fit.size.sp, lineHeight = fit.lineHeight.sp)

/**
 * A name shown whole by the two-line rule: [style] (the title role) shrunk to
 * the largest whole size that holds the name on two lines at the width it is
 * given, never below [floor] — at the floor on as many lines as it needs.
 * Never cut. The fit follows the width, so a turned phone refits it.
 */
@Composable
fun FittedName(
    text: String,
    style: TextStyle,
    modifier: Modifier = Modifier,
    color: Color = Color.Unspecified,
    floor: Int = 1,
    /** The drawn text's own semantics (a heading, or hidden where a title already speaks it). */
    textModifier: Modifier = Modifier,
) {
    val measurer = rememberTextMeasurer()
    BoxWithConstraints(modifier) {
        val width = constraints.maxWidth.takeIf { constraints.hasBoundedWidth }
        val fit = remember(text, style, floor, width, measurer) {
            if (width == null) {
                RoleNameFit
            } else {
                nameFitSize(floor) { size, lineHeight ->
                    val at = style.at(NameFit(size, lineHeight))
                    measurer.measure(text, at, constraints = Constraints(maxWidth = width)).lineCount
                }
            }
        }
        Text(
            text = text,
            style = style.at(fit),
            color = color,
            modifier = textModifier.semantics { this[NameFitSize] = fit },
        )
    }
}

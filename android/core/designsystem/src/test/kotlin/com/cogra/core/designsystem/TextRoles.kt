package com.cogra.core.designsystem

import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.text.TextStyle
import com.google.common.truth.Truth.assertWithMessage

/** The style a text node was laid out with — what it draws, merged from every source. */
fun SemanticsNodeInteraction.laidOutStyle(): TextStyle {
    val results = mutableListOf<TextLayoutResult>()
    fetchSemanticsNode().config[SemanticsActions.GetTextLayoutResult].action?.invoke(results)
    return results.single().layoutInput.style
}

/**
 * Round 20's law, round 28's sweep: a site that sets a role sets ALL of it —
 * size, leading, tracking and weight. Never a width: Robolectric without
 * native graphics measures text near zero.
 */
fun SemanticsNodeInteraction.assertWholeRole(role: TextStyle, what: String) {
    val drawn = laidOutStyle()
    assertWithMessage("$what size").that(drawn.fontSize).isEqualTo(role.fontSize)
    assertWithMessage("$what leading").that(drawn.lineHeight).isEqualTo(role.lineHeight)
    assertWithMessage("$what tracking").that(drawn.letterSpacing).isEqualTo(role.letterSpacing)
    assertWithMessage("$what weight").that(drawn.fontWeight).isEqualTo(role.fontWeight)
}

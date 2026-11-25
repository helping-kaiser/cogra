// A VALUE TOO LONG FOR THE ROW IS CUT, THE LABEL KEEPS ITS ROOM
// (`SettingsRow.jsx:191-219`, round 62): the value is one line ending in "…",
// the label holds its whole width, and the chevron stays inside the row.
// Measured on a 360dp phone under NATIVE graphics, the only mode whose text
// metrics carry a width claim.

package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.requiredWidth
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.width
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w360dp-h800dp")
class SettingsRowValueTest {

    @get:Rule
    val compose = createComposeRule()

    private fun bounds(tag: String) = compose.onNodeWithTag(tag, useUnmergedTree = true).getUnclippedBoundsInRoot()

    private fun layout(tag: String): TextLayoutResult {
        val results = mutableListOf<TextLayoutResult>()
        val node = compose.onNodeWithTag(tag, useUnmergedTree = true).fetchSemanticsNode()
        node.config[SemanticsActions.GetTextLayoutResult].action?.invoke(results)
        return results.single()
    }

    private fun show(value: String?, status: String? = null) {
        compose.setContent {
            Cogra2PreviewTheme {
                Box(Modifier.requiredWidth(SCREEN)) {
                    SettingsRow(
                        label = "Email",
                        kind = SettingsRowKind.Opens,
                        status = status,
                        value = value,
                        node = DataNode("row"),
                    )
                }
            }
        }
        compose.waitForIdle()
    }

    @Test
    fun aLongValueEndsInAnEllipsisAndTheLabelKeepsItsWholeWidth() {
        show(LONG_ADDRESS)
        val label = layout("row.label")
        assertThat(label.lineCount).isEqualTo(1)
        assertThat(label.didOverflowWidth).isFalse()
        val value = layout("row.value")
        assertThat(value.lineCount).isEqualTo(1)
        assertThat(value.isLineEllipsized(0)).isTrue()
        // The value starts past the label and its 16dp gap.
        assertThat(bounds("row.value").left).isAtLeast(bounds("row.label").right + 16.dp)
    }

    @Test
    fun aLongValueKeepsTheChevronInsideTheRow() {
        show(LONG_ADDRESS)
        val row = bounds("row")
        val chevron = bounds("row.chevron")
        assertThat(chevron.width).isEqualTo(18.dp)
        assertThat(chevron.right).isAtMost(row.right - 16.dp)
        assertThat(bounds("row.value").right).isAtMost(chevron.left - 16.dp)
    }

    @Test
    fun aShortValueStandsWholeBesideTheChevron() {
        show("Public domain")
        val value = layout("row.value")
        assertThat(value.lineCount).isEqualTo(1)
        assertThat(value.isLineEllipsized(0)).isFalse()
        val gap = bounds("row.chevron").left - bounds("row.value").right
        assertThat(gap.value).isWithin(0.5f).of(16f)
    }

    @Test
    fun aStatusUnderTheLabelStillWrapsBesideAValue() {
        show(LONG_ADDRESS, status = "Used to sign in and to reset your password when you lose it.")
        assertThat(layout("row.label").lineCount).isEqualTo(1)
        assertThat(layout("row.status").lineCount).isAtLeast(1)
        assertThat(bounds("row.status").left).isEqualTo(bounds("row.label").left)
        assertThat(bounds("row.status").top).isAtLeast(bounds("row.label").bottom)
    }

    @Test
    fun aRowWithoutAValueLetsItsLabelWrap() {
        compose.setContent {
            Cogra2PreviewTheme {
                Box(Modifier.requiredWidth(SCREEN)) {
                    SettingsRow(
                        label = "A label long enough that the row's own width has to wrap it onto a second line",
                        kind = SettingsRowKind.Opens,
                        node = DataNode("row"),
                    )
                }
            }
        }
        compose.waitForIdle()
        assertThat(layout("row.label").lineCount).isAtLeast(2)
        assertThat(bounds("row.chevron").right).isAtMost(bounds("row").right - 16.dp)
    }

    private companion object {
        val SCREEN = 360.dp
        const val LONG_ADDRESS = "someone.with.a.rather.long.address.for.one.row@example-mail-provider.org"
    }
}

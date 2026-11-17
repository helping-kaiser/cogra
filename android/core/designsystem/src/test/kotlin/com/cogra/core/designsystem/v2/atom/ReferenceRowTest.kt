package com.cogra.core.designsystem.v2.atom

import androidx.compose.ui.test.assertHasClickAction
import androidx.compose.ui.test.assertHasNoClickAction
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.StancePoint
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/** `ReferenceRow.jsx`'s citation family and its removed name (what cites a node, CitedBy.md:13). */
@RunWith(RobolectricTestRunner::class)
class ReferenceRowTest {

    @get:Rule
    val compose = createComposeRule()

    private val node = DataNode("sheet.citation").keyed("1")
    private val point = StancePoint(directed = 0.4, interest = 0.2)

    @Test
    fun aCitationIsHeardAsItsPairAloneWithNoStanceWord() {
        compose.setContent {
            ReferenceRow(MarkKind.POST, "Salt maps", edge = RowEdge.Citation(point), onOpen = {}, node = node)
        }
        // The twenty faces' glyph stands, but the word is withheld: a citation is not a stance.
        compose.onNodeWithContentDescription("+0.40 / +0.20").assertExists()
    }

    @Test
    fun aRemovedNameReadsItsMarkAndOpensNothing() {
        var opened = 0
        compose.setContent {
            ReferenceRow(
                MarkKind.POST,
                "Salt maps",
                edge = RowEdge.Citation(point),
                onOpen = { opened++ },
                node = node,
                removed = "Removed by its author",
            )
        }
        compose.onNodeWithTag("sheet.citation.name", useUnmergedTree = true).assertTextEquals("Removed by its author")
        compose.onNodeWithTag(node.tag).assertHasNoClickAction()
        assertThat(opened).isEqualTo(0)
    }

    @Test
    fun aLiveRowOpensItsDestination() {
        var opened = 0
        compose.setContent {
            ReferenceRow(
                MarkKind.COMMENT,
                "The wax-stick ones",
                edge = RowEdge.Citation(point),
                onOpen = { opened++ },
                node = node,
            )
        }
        compose.onNodeWithTag(node.tag).assertHasClickAction().performClick()
        assertThat(opened).isEqualTo(1)
    }
}

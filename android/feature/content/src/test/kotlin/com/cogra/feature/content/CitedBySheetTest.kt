// The Cited by sheet's own laws (CitedBy.md:7, :9, :13, :19; CommentCitedByEmpty.md:5-9):
// the rows as the fold hands them, newest first, one per citation, each keyed
// by its place; the empty line alone; a removed citing artifact keeping its
// row under its mark and opening nothing; nothing drawn while the read is out.

package com.cogra.feature.content

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertHasNoClickAction
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import com.cogra.domain.Outcome
import com.cogra.domain.references.CitingArtifact
import com.cogra.domain.references.CitingKind
import com.cogra.domain.references.CitingView
import com.cogra.domain.stance.StancePair
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h891dp")
class CitedBySheetTest {

    @get:Rule
    val compose = createComposeRule()

    private val sheet = CITED_BY_SHEET

    private fun row(key: String, view: CitingView) = CitingArtifact(key, view, StancePair(0.4, 0.2))

    private val rows = listOf(
        row("sol p1", CitingView(CitingKind.POST, "Salt maps", opensPost = "p1")),
        row("ada c1", CitingView(CitingKind.COMMENT, "The wax-stick ones", opensPost = "p9")),
        row("kel p2", CitingView(CitingKind.POST, "Removed by its author", redacted = true, opensPost = "p2")),
    )

    private fun render(rows: List<CitingArtifact<CitingView>>?) {
        compose.setContent {
            CitedBySheetContent(rows = rows, onDismiss = {}, onOpenPost = {}, node = sheet)
        }
        compose.waitForIdle()
    }

    /** CitedBy.md:7, :9 — one row per standing citation, in the order handed, keyed from 1. */
    @Test
    fun theRowsStandAsTheFoldHandsThemKeyedByPlace() {
        render(rows)
        compose.onNodeWithTag("postDetail.citedBySheet.title", useUnmergedTree = true).assertTextEquals("Cited by")
        val tops = (1..3).map {
            compose.onNodeWithTag("postDetail.citedBySheet.citation:$it").fetchSemanticsNode().boundsInRoot.top
        }
        assertThat(tops).isInStrictOrder()
        compose.onNodeWithText("Nothing cites this yet").assertDoesNotExist()
    }

    /** ReferenceRow.jsx (seam 248) — a removed citing artifact keeps its row, its mark the name, opening nothing. */
    @Test
    fun aRemovedCitingArtifactKeepsItsRowAndOpensNothing() {
        render(rows)
        compose.onNodeWithTag("postDetail.citedBySheet.citation:3").assertHasNoClickAction()
        compose.onNodeWithText("Removed by its author").assertExists()
    }

    /** CitedBy.md:19, CommentCitedByEmpty.md:7 — the empty line alone. */
    @Test
    fun nothingCitingReadsTheEmptyLineAlone() {
        render(emptyList())
        compose.onNodeWithTag("postDetail.citedBySheet.empty:empty").assertExists()
        compose.onNodeWithTag("postDetail.citedBySheet.empty.title", useUnmergedTree = true)
            .assertTextEquals("Nothing cites this yet")
        compose.onAllNodesWithTag("postDetail.citedBySheet.citation:1").assertCountEquals(0)
    }

    /** While the read is out the sheet holds its title and nothing else — never a false empty line. */
    @Test
    fun aReadStillOutDrawsNoRowsAndNoEmptyLine() {
        render(null)
        compose.onNodeWithTag("postDetail.citedBySheet").assertExists()
        compose.onNodeWithText("Nothing cites this yet").assertDoesNotExist()
    }

    /** The sheet reads what cites the node it was opened for, once, as it opens. */
    @Test
    fun theSheetReadsItsNodeAsItOpens() {
        val asked = mutableListOf<String>()
        val reads = InboundReads(
            citedBy = { id ->
                asked += id
                Outcome.Success(rows)
            },
        )
        compose.setContent {
            CompositionLocalProvider(LocalInboundReads provides reads) {
                CitedBySheet(nodeId = "n1", onDismiss = {}, onOpenPost = {}, node = sheet)
            }
        }
        compose.waitForIdle()
        assertThat(asked).containsExactly("n1")
        compose.onNodeWithText("Salt maps").assertExists()
    }
}

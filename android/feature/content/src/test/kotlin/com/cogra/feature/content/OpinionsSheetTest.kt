// The opinions sheet's own laws (PostOpinions.md; CommentOpinionsEmpty.md),
// the web's `opinions-sheet.test.tsx` cases ported: titled for what the
// opinions are on; the person and their opinion; the order it is handed; 🤔 on
// one number at zero; which (0, 0) a row speaks; a row opens its holder and
// drops the sheet; a deleted holder's row; the empty line only once answered.

package com.cogra.feature.content

import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.cogra.domain.Outcome
import com.cogra.domain.stance.HeldOpinion
import com.cogra.domain.stance.OpinionHolder
import com.cogra.domain.stance.StancePair
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "w411dp-h891dp")
class OpinionsSheetTest {

    @get:Rule
    val compose = createComposeRule()

    private fun held(
        handle: String?,
        name: String?,
        d: Double,
        i: Double,
        redacted: Boolean = false,
        severed: Boolean = false,
    ) = HeldOpinion(
        holderId = "addr-${handle ?: name}",
        holder = OpinionHolder(
            actorId = "id-${handle ?: name}",
            handle = handle,
            displayName = name,
            avatarUrl = null,
            redacted = redacted,
        ),
        pair = StancePair(d, i),
        severed = severed,
    )

    /** The board's own holders (`POST_OPINION_HOLDERS`), strongest first. */
    private val holders = listOf(
        held("mira", "Mira Voss", 0.9, 0.25),
        held("ada", "Ada Okonkwo", 0.7, 0.4),
        held("juno", "Juno", -0.55, 0.25),
    )

    private val opened = mutableListOf<String>()
    private var dismissed = 0

    private fun render(rows: List<HeldOpinion>?, on: OpinionsOn = OpinionsOn.Post) {
        compose.setContent {
            OpinionsSheetContent(
                rows = rows,
                on = on,
                onDismiss = { dismissed++ },
                onOpenPerson = { opened += it },
                node = OPINIONS_SHEET,
            )
        }
        compose.waitForIdle()
    }

    private fun row(actor: String) = "postDetail.opinionsSheet.opinion:$actor"

    @Test
    fun isTitledForWhatTheOpinionsAreOn() {
        render(holders)
        compose.onNodeWithTag("postDetail.opinionsSheet.title", useUnmergedTree = true)
            .assertTextEquals("Opinions on this post")
    }

    /** CommentOpinionsEmpty.md:5 — `Opinions on this comment`. */
    @Test
    fun aCommentsSheetIsTitledForTheComment() {
        render(holders, OpinionsOn.Comment)
        compose.onNodeWithTag("postDetail.opinionsSheet.title", useUnmergedTree = true)
            .assertTextEquals("Opinions on this comment")
    }

    /** PostOpinions.md:19 — the person, their handle, and their opinion: the face leading. */
    @Test
    fun carriesThePersonAndTheirOpinion() {
        render(holders)
        compose.onNodeWithTag("postDetail.opinionsSheet.opinion.name", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("Mira Voss").assertExists()
        compose.onNodeWithText("@mira").assertExists()
        compose.onNodeWithContentDescription("+0.90 / +0.25", substring = true, useUnmergedTree = true).assertExists()
    }

    /** PostOpinions.md:9, :11 — the order handed (the fold's strongest first), one row per person, keyed by id. */
    @Test
    fun keepsTheOrderItIsHanded() {
        render(holders)
        val tops = listOf("id-mira", "id-ada", "id-juno").map {
            compose.onNodeWithTag(row(it)).fetchSemanticsNode().boundsInRoot.top
        }
        assertThat(tops).isInStrictOrder()
    }

    /** PostOpinions.md:21 — exactly one number at zero wears 🤔. */
    @Test
    fun wearsThinkingOnAnOpinionWithExactlyOneNumberAtZero() {
        render(listOf(held("kel", "Kel", 0.4, 0.0)))
        compose.onNodeWithTag("postDetail.opinionsSheet.opinion.value.face", useUnmergedTree = true)
            .assertTextEquals("🤔")
    }

    /** Seam 245 — which (0, 0) the row speaks is the row's data. */
    @Test
    fun speaksWalkedBackAndSaysNothingApart() {
        render(listOf(held("wren", "Wren", 0.0, 0.0, severed = true), held("nadia", "Nadia", 0.0, 0.0)))
        compose.onNodeWithContentDescription("Walked back", substring = true, useUnmergedTree = true).assertExists()
        compose.onNodeWithContentDescription("Says nothing", substring = true, useUnmergedTree = true).assertExists()
    }

    /** The sheet is the door: a row opens its holder's profile and drops the sheet. */
    @Test
    fun opensThePersonsProfileAndDropsItself() {
        render(holders)
        compose.onNodeWithTag(row("id-mira")).performClick()
        assertThat(opened).containsExactly("mira")
        assertThat(dismissed).isEqualTo(1)
    }

    /**
     * PostOpinions.md:13, :15, :17 — a deleted holder stands where its value puts
     * it, `Deleted account`, no handle line, its opinion read as any row's; its
     * tap opens the deleted account's page by the handle that page answers to.
     */
    @Test
    fun aDeletedHoldersRowKeepsItsPlaceAndOpensItsPage() {
        render(listOf(held("mira", "Mira Voss", 0.9, 0.25), held("gone", null, 0.3, 0.3, redacted = true)))
        compose.onNodeWithTag("postDetail.opinionsSheet.redactedOpinion:id-gone").assertExists()
        compose.onNodeWithText("Deleted account").assertExists()
        compose.onNodeWithText("@gone").assertDoesNotExist()
        compose.onNodeWithTag("postDetail.opinionsSheet.redactedOpinion:id-gone").performClick()
        assertThat(opened).containsExactly("gone")
    }

    /** While the read is out the sheet holds its title alone — never a false empty line. */
    @Test
    fun aReadStillOutDrawsNoEmptyLine() {
        render(null)
        compose.onNodeWithText("No opinions yet").assertDoesNotExist()
    }

    /** PostOpinions.md:25, CommentOpinionsEmpty.md:7 — the empty line alone once the read has answered. */
    @Test
    fun saysTheEmptyLineOnceTheReadHasAnswered() {
        render(emptyList())
        compose.onNodeWithTag("postDetail.opinionsSheet.empty:empty").assertExists()
        compose.onAllNodesWithTag(row("id-mira")).assertCountEquals(0)
    }

    /** The sheet reads who holds an opinion on the node it was opened for, as it opens. */
    @Test
    fun theSheetReadsItsNodeAsItOpens() {
        val asked = mutableListOf<String>()
        val reads = InboundReads(
            opinionsOn = { id ->
                asked += id
                Outcome.Success(holders)
            },
        )
        compose.setContent {
            CompositionLocalProvider(LocalInboundReads provides reads) {
                OpinionsSheet(nodeId = "n1", on = OpinionsOn.Post, onDismiss = {}, onOpenPerson = {})
            }
        }
        compose.waitForIdle()
        assertThat(asked).containsExactly("n1")
        compose.onNodeWithText("Ada Okonkwo").assertExists()
    }
}

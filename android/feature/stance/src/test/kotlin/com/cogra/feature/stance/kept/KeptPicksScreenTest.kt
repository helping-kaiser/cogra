// The kept picks' review and seal as drawn, compiled from the sidecars' lines
// the drawing decides (KeptPicksReview.md, KeptPicksSeal.md), bound to the
// registered paths (round 23). No text widths: Robolectric measures text near
// zero without native graphics, so these assert on nodes.

package com.cogra.feature.stance.kept

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.domain.stance.KeptFamily
import com.cogra.domain.stance.KeptPick
import com.cogra.domain.stance.KeptPreview
import com.cogra.domain.stance.StanceKind
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceTarget
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class KeptPicksScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private fun row(
        id: String,
        preview: KeptPreview,
        pick: StancePair,
        severs: Boolean = false,
        topic: Boolean = false,
    ) =
        KeptRow(
            pick = KeptPick(
                target = if (topic) StanceTarget.Topic(id) else StanceTarget.Node(id),
                pick = pick,
                family = KeptFamily.OPINION,
                kind = preview.kind,
                keptAt = 0,
            ),
            preview = preview,
            severs = severs,
        )

    private val board = listOf(
        row("post-1", KeptPreview(StanceKind.POST, "The long way home — @ada"), StancePair(0.1, 0.1)),
        row("user-mira", KeptPreview(StanceKind.PERSON, "Mira Voss"), StancePair(0.55, 0.2), severs = true),
        row(
            "post-2",
            KeptPreview(StanceKind.POST, "A post", removed = "Removed by its author"),
            StancePair(-0.15, 0.15),
        ),
        row("saltmaps", KeptPreview(StanceKind.TOPIC, "saltmaps"), StancePair(0.6, 0.35), topic = true),
    )

    private fun render(state: KeptPicksUiState, actions: KeptPicksActions = KeptPicksActions()) {
        compose.setContent { KeptPicksScreen(state, actions) }
    }

    private val review = KeptPicksUiState(loaded = true, rows = board)

    @Test
    fun theReviewWearsItsRegisteredPathsOneRowPerPickKeyedByPlace() {
        render(review)
        compose.onNodeWithTag("keptPicks.header").assertExists()
        compose.onNodeWithTag("keptPicks.header.title").assertTextEquals(KEPT_PICKS_TITLE)
        compose.onNodeWithTag("keptPicks.intro").assertTextEquals(KEPT_PICKS_INTRO)
        for (n in 1..4) compose.onNodeWithTag("keptPicks.pick:$n").assertExists()
        compose.onAllNodesWithTag("keptPicks.pick.name").assertCountEquals(4)
        compose.onAllNodesWithTag("keptPicks.pick.remove").assertCountEquals(4)
        compose.onNodeWithTag("keptPicks.announcement").assertExists()
        compose.onNodeWithTag("keptPicks.sign").assertTextEquals(KEPT_SIGN_THEM)
    }

    @Test
    fun review13_eachRowReadsItsKindAndATopicReadsTopic() {
        render(review)
        val kinds = compose.onAllNodesWithTag("keptPicks.pick.kind").fetchSemanticsNodes()
            .map { it.config[SemanticsProperties.Text].joinToString() }
        assertThat(kinds).containsExactly("Post", "Person", "Post", "Topic").inOrder()
    }

    @Test
    fun review19_onlyTheSeveringPickSaysItsConsequence() {
        render(review)
        compose.onAllNodesWithTag("keptPicks.pick.consequence").assertCountEquals(1)
        compose.onNodeWithTag("keptPicks.pick.consequence").assertTextEquals("This takes you back to zero.")
    }

    @Test
    fun review11_aRemovedTargetWearsTheMarkAndItsCrossNamesThePick() {
        render(review)
        compose.onNodeWithText("Removed by its author").assertExists()
        compose.onNodeWithContentDescription("Remove this pick: Post, Removed by its author").assertExists()
        compose.onNodeWithContentDescription("Remove Mira Voss").assertExists()
    }

    @Test
    fun review7_aTopicsPairIsSpokenInTheAffinityPadsAxisWords() {
        render(review)
        compose.onNodeWithContentDescription("How much you like it", substring = true).assertExists()
    }

    @Test
    fun review45_47_theApprovalLineStandsOnlyWhenAnApprovalWasKept() {
        var opened = 0
        var state by mutableStateOf(review)
        compose.setContent { KeptPicksScreen(state, KeptPicksActions(onOpenInvites = { opened += 1 })) }
        compose.onAllNodesWithTag("keptPicks.approval").assertCountEquals(0)

        state = review.copy(approvalKept = true)
        compose.onNodeWithTag("keptPicks.approval.open").performClick()
        assertThat(opened).isEqualTo(1)
    }

    @Test
    fun review21_theCrossDropsTheRowAtOnceWithNoConfirm() {
        val removed = mutableListOf<Int>()
        render(review, KeptPicksActions(onRemove = { removed += it }))
        compose.onNodeWithContentDescription("Remove Mira Voss").performClick()
        assertThat(removed).containsExactly(1)
        compose.onNodeWithText("Discard", substring = true).assertDoesNotExist()
    }

    private val seal = review.copy(stage = KeptStage.SEAL)

    @Test
    fun theSealIsTheStandardSealWithOneActRowPerPick() {
        render(seal)
        compose.onNodeWithTag("keptPicksSeal.header.title").assertTextEquals(KEPT_SEAL_TITLE)
        compose.onNodeWithTag("keptPicksSeal.header.stage").assertTextEquals(KEPT_SEAL_STAGE)
        compose.onNodeWithTag("keptPicksSeal.header.help").assertExists()
        compose.onNodeWithTag("keptPicksSeal.header.leave").assertExists()
        for (n in 1..4) compose.onNodeWithTag("keptPicksSeal.acts.actRow:$n").assertExists()
        compose.onNodeWithTag("keptPicksSeal.acts.total").assertTextEquals("4 things, signed together")
        compose.onNodeWithTag("keptPicksSeal.acts.note").assertTextEquals("They land together, or none does.")
        compose.onNodeWithTag("keptPicksSeal.foot.sign").assertTextEquals(KEPT_SIGN)
        compose.onNodeWithTag("keptPicksSeal.foot.back").assertTextEquals(KEPT_BACK)
    }

    @Test
    fun seal7_aPickOnATopicReadsFeelingWithItsHash() {
        render(seal)
        val labels = compose.onAllNodesWithTag("keptPicksSeal.acts.actRow.label").fetchSemanticsNodes()
            .map { it.config[SemanticsProperties.Text].joinToString() }
        assertThat(labels).containsExactly("Opinion", "Opinion", "Opinion", "Feeling").inOrder()
        compose.onNodeWithText("#saltmaps").assertExists()
        compose.onNodeWithContentDescription("1 feeling").assertExists()
    }

    @Test
    fun seal11_aRemovedTargetReadsBackByItsMark() {
        render(seal)
        compose.onNodeWithText("Removed by its author").assertExists()
    }

    @Test
    fun seal23_pastTwoHundredMillisTheCommitReadsItsParticipleAndNothingDims() {
        compose.mainClock.autoAdvance = false
        render(seal.copy(signing = true))
        compose.mainClock.advanceTimeBy(250)
        compose.onNodeWithTag("keptPicksSeal.foot.sign").assertTextEquals(KEPT_SIGNING).assertIsEnabled()
        compose.onNodeWithTag("keptPicksSeal.foot.back").assertIsEnabled()
    }

    @Test
    fun seal25_pastFiveSecondsTheSublineReadsTheSlowLine() {
        compose.mainClock.autoAdvance = false
        render(seal.copy(signing = true))
        compose.mainClock.advanceTimeBy(5_100)
        compose.onNodeWithTag("keptPicksSeal.acts.note")
            .assertTextEquals("Still signing — the network is slow right now.")
    }

    @Test
    fun seal33_theWriteRulesNoticeEndsYourPicksAreStillKeptWithNotNow() {
        var back = 0
        render(seal.copy(fault = KeptSealFault.WRITE_RULE), KeptPicksActions(onBackToReview = { back += 1 }))
        compose.onNodeWithText(KEPT_WRITE_RULE_FACT).assertExists()
        compose.onNodeWithTag("keptPicksSeal.foot.sign").assertDoesNotExist()
        compose.onNodeWithTag("kept_picks_seal_not_now").performScrollTo().performClick()
        assertThat(back).isEqualTo(1)
    }

    @Test
    fun seal37_theBugNoticeOffersTryAgainReportAndNotNow() {
        render(seal.copy(fault = KeptSealFault.BUG))
        compose.onNodeWithText(KEPT_BUG_TITLE).assertExists()
        compose.onNodeWithText(KEPT_TRY_AGAIN).assertExists()
        compose.onNodeWithText(KEPT_REPORT).assertExists()
        compose.onNodeWithText(KEPT_NOT_NOW).assertExists()
    }

    @Test
    fun seal29_noAnswerPutsTheFaultLineAboveAnOutlinedRetry() {
        render(seal.copy(fault = KeptSealFault.OFFLINE))
        compose.onNodeWithText(KEPT_OFFLINE_LINE).assertExists()
        compose.onNodeWithTag("keptPicksSeal.foot.sign").assertTextEquals(KEPT_RETRY)
    }

    @Test
    fun seal43_theApprovalLineStandsUnderTheActsCard() {
        render(seal.copy(approvalKept = true))
        compose.onNodeWithTag("keptPicksSeal.approval").assertExists()
        compose.onNodeWithTag("keptPicksSeal.approval.open").assertExists()
    }
}

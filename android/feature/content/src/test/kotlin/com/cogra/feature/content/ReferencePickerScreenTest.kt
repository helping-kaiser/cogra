// The citation picker's drawn laws (behavior/ReferencePicker.md), compiled
// line by line against the screen over a given state. What a gesture does to
// the state is `PickerEditorsTest`'s; here a gesture is the handler it calls.
// web's twin is `reference-picker.test.tsx`.

package com.cogra.feature.content

import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertIsOn
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.cogra.domain.ReferenceContentKind
import com.cogra.domain.ReferenceTargetView
import com.cogra.domain.feed.FeedKind
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
class ReferencePickerScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val handlers = RecordingReferencePicker()
    private val now = Instant.parse("2026-10-29T10:00:00Z")

    private val sal = ReferenceCandidateRow("u-sal", ReferenceTargetView.Profile("u-sal", "saltorres", "Sal Torres"))
    private val saltMaps = ReferenceCandidateRow(
        "p-salt",
        ReferenceTargetView.Content(
            kind = ReferenceContentKind.POST,
            id = "p-salt",
            title = "Salt maps of the coast road",
            snippet = null,
            authorHandle = "sol",
            authorDisplayName = "Sol",
            createdAt = now.minusSeconds(3 * 86_400),
            coverUrl = "https://media/p.webp",
        ),
    )

    /** The board's query, `salt`, answered with [rows] under the default filter (or no answer). */
    private fun answered(vararg rows: ReferenceCandidateRow, failed: Boolean = false) =
        CandidateAnswer("salt", emptySet(), rows.toList(), failed)

    private fun render(
        staged: List<ReferenceCandidateRow> = emptyList(),
        answer: CandidateAnswer? = answered(sal),
        kinds: Set<FeedKind> = emptySet(),
        origin: PickerOrigin = PickerOrigin.Post,
        stagedCount: Int? = null,
    ) {
        val references = stagedCount?.let { n -> (1..n).map { ReferenceRow("r$it", null) } }
            ?: staged.map { ReferenceRow(it.targetId, it.target) }
        val section = ReferenceSectionState(
            references = references,
            picker = ReferencePickerState(query = "salt", kinds = kinds, answer = answer),
        )
        compose.setContent { ReferencePicker(section, origin, handlers, now) }
    }

    private fun result(place: Int) = compose.onNodeWithTag("referencePicker.result:$place")

    /** ALWAYS referencePicker.staged.stagedReference stands only in the staged section above the results. */
    @Test
    fun aStagedCitationStandsOnlyInTheStagedSection() {
        render(staged = listOf(saltMaps), answer = answered(saltMaps, sal))
        compose.onNodeWithTag("referencePicker.staged.stagedReference:1").assertExists()
        result(1).assertExists()
        result(2).assertDoesNotExist()
        // The staged post reads its byline and age, the composer's StagedRow `kind` line.
        compose.onNodeWithTag("referencePicker.staged.stagedReference.kind", useUnmergedTree = true)
            .assertTextEquals("@sol · 3d")
    }

    /** WHEN tap a result row -> it is staged AND the move is announced AND NEVER the picker closes. */
    @Test
    fun aTappedResultIsStagedAndSaid() {
        render()
        result(1).performClick()
        assertThat(handlers.calls).containsExactly("stage:u-sal")
        compose.onNodeWithTag("referencePicker.announcement", useUnmergedTree = true)
            .assert(hasContentDescription(PICK_ADDED))
    }

    /** WHEN tap the remove control of a staged row -> it is unstaged AND the move is announced. */
    @Test
    fun aStagedRowsCrossUnstagesIt() {
        render(staged = listOf(saltMaps))
        compose.onNodeWithTag("referencePicker.staged.stagedReference.remove")
            .assert(hasContentDescription("Remove Salt maps of the coast road"))
            .performClick()
        assertThat(handlers.calls).containsExactly("unstage:p-salt")
        compose.onNodeWithTag("referencePicker.announcement", useUnmergedTree = true)
            .assert(hasContentDescription(PICK_REMOVED))
    }

    /** WHEN tap Done / press the header back -> the picker closes AND NEVER a staged citation is unstaged. */
    @Test
    fun doneAndTheHeaderBackAreOneLeave() {
        render(staged = listOf(saltMaps))
        compose.onNodeWithTag("referencePicker.done").performClick()
        compose.onNodeWithTag("referencePicker.header.back").performClick()
        assertThat(handlers.calls).containsExactly("close", "close")
    }

    /** ALWAYS the back arrow reads Back to the post / Back to the comment. */
    @Test
    fun theArrowNamesTheComposer() {
        render(origin = PickerOrigin.Comment)
        compose.onNodeWithContentDescription("Back to the comment").assertExists()
    }

    /** WHEN the picker opens -> referencePicker.searchField takes focus AND the keyboard rises. */
    @Test
    fun theSearchFieldTakesFocus() {
        render()
        compose.onNodeWithTag("referencePicker.searchField.input").assertIsFocused()
    }

    /** A person is their name over their handle; a post its words over `@author · age`. */
    @Test
    fun theRowsReadThePersonAndThePost() {
        render(answer = answered(sal))
        compose.onNodeWithTag("referencePicker.result.name", useUnmergedTree = true).assertTextEquals("Sal Torres")
        compose.onNodeWithTag("referencePicker.result.sub", useUnmergedTree = true).assertTextEquals("@saltorres")
        compose.onNodeWithTag("referencePicker.result.trailing", useUnmergedTree = true).assertExists()
    }

    /** ALWAYS no kind chip is on and the results read every citable kind GIVEN the default. */
    @Test
    fun theTriggerReadsEverythingAtTheDefault() {
        render()
        compose.onNodeWithTag("referencePicker.filterTrigger", useUnmergedTree = true)
            .assertExists()
        compose.onNodeWithContentDescription("Everything, what the search shows").assertExists()
    }

    /**
     * WHEN tap referencePicker.filterTrigger -> the sheet rises holding the kinds and the foot alone:
     * Posts, Comments and Profiles; no order and no seen.
     */
    @Test
    fun theTriggerRaisesAKindsOnlySheet() {
        render()
        compose.onNodeWithContentDescription("Everything, what the search shows").performClick()
        compose.onNodeWithTag("referencePicker.filterSheet.title").assertTextEquals("What the search shows")
        compose.onNodeWithTag("referencePicker.filterSheet.kinds.postsChip").assertExists()
        compose.onNodeWithTag("referencePicker.filterSheet.kinds.commentsChip").assertExists()
        compose.onNodeWithTag("referencePicker.filterSheet.kinds.profilesChip").assertExists()
        compose.onNodeWithTag("referencePicker.filterSheet.kinds.tagsChip").assertDoesNotExist()
        compose.onNodeWithTag("referencePicker.filterSheet.order").assertDoesNotExist()
        compose.onNodeWithTag("referencePicker.filterSheet.foot").assertExists()
    }

    /** WHEN tap a kind chip -> the change is staged AND NEVER the results move before Done; Done commits once. */
    @Test
    fun aChipStagesUntilDone() {
        render()
        compose.onNodeWithContentDescription("Everything, what the search shows").performClick()
        compose.onNodeWithTag("referencePicker.filterSheet.kinds.postsChip").performClick()
        compose.onNodeWithTag("referencePicker.filterSheet.kinds.profilesChip").performClick()
        assertThat(handlers.calls).isEmpty()
        compose.onNodeWithTag("referencePicker.filterSheet.foot.done").performClick()
        assertThat(handlers.calls).containsExactly("kinds:POST,PROFILE")
    }

    /** WHEN tap Reset -> the sheet stages the default AND NEVER the results re-query. */
    @Test
    fun resetStagesTheDefaultAndAsksNothing() {
        render(kinds = setOf(FeedKind.POST))
        compose.onNodeWithContentDescription("Posts, what the search shows").performClick()
        compose.onNodeWithTag("referencePicker.filterSheet.kinds.postsChip").assertIsOn()
        compose.onNodeWithTag("referencePicker.filterSheet.foot.reset").performClick()
        assertThat(handlers.calls).isEmpty()
        compose.onNodeWithTag("referencePicker.filterSheet.foot.done").performClick()
        assertThat(handlers.calls).containsExactly("kinds:")
    }

    /** The trigger reads the committed kinds in the filter pill's state words. */
    @Test
    fun theTriggersWordsFollowTheKinds() {
        assertThat(citableKindsReading(emptySet())).isEqualTo("Everything")
        assertThat(citableKindsReading(setOf(FeedKind.COMMENT))).isEqualTo("Comments")
        assertThat(citableKindsReading(setOf(FeedKind.COMMENT, FeedKind.POST))).isEqualTo("2 kinds")
        val all = setOf(FeedKind.COMMENT, FeedKind.POST, FeedKind.PROFILE)
        assertThat(citableKindsReading(all)).isEqualTo("All kinds")
    }

    /** ALWAYS referencePicker.cap reads Up to 10 citations per post. GIVEN ten; every result dimmed, no tap. */
    @Test
    fun atTheCapTheLineStandsAndTheResultsAreStill() {
        render(stagedCount = 10)
        compose.onNodeWithTag("referencePicker.cap").assertTextEquals("Up to 10 citations per post.")
        result(1).assertIsNotEnabled()
        assertThat(handlers.calls).isEmpty()
    }

    @Test
    fun fromACommentTheCapSaysPerComment() {
        render(stagedCount = 10, origin = PickerOrigin.Comment)
        compose.onNodeWithTag("referencePicker.cap").assertTextEquals("Up to 10 citations per comment.")
    }

    /** WHEN the read gets no answer GIVEN nothing loaded -> the noun line over Retry; the field keeps the query. */
    @Test
    fun aFaultPutsTheLineOverRetryAndTheFieldKeepsTheQuery() {
        render(answer = answered(failed = true))
        compose.onNodeWithTag("referencePicker.fault").assertExists()
        compose.onNodeWithTag("referencePicker.searchField.input").assertTextEquals("salt")
        compose.onNodeWithTag("referencePicker.fault.retry").performClick()
        assertThat(handlers.calls).containsExactly("retry")
        assertThat(REFERENCE_PICKER_FAULT).isEqualTo("Can't reach the server — results can't load right now.")
    }

    /** ALWAYS no line stands where the results are GIVEN the read is in flight or found nothing. */
    @Test
    fun aReadInFlightStandsSilent() {
        render(answer = null)
        compose.onNodeWithTag("referencePicker.fault").assertDoesNotExist()
        result(1).assertDoesNotExist()
    }

    @Test
    fun aReadThatFoundNothingStandsSilent() {
        render(answer = answered())
        compose.onNodeWithTag("referencePicker.fault").assertDoesNotExist()
    }

    /** The one "?" is named by the dialog it opens. */
    @Test
    fun theHelpIsCiting() {
        render()
        compose.onNodeWithTag("referencePicker.header.help").assert(hasContentDescription("Citing")).performClick()
        compose.onNodeWithTag("picker_help_citing").assertExists()
    }
}

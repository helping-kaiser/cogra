package com.cogra.feature.content.reply

import androidx.compose.runtime.Composable
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.feature.content.TagRow
import com.cogra.feature.content.TagSectionState
import com.cogra.feature.content.wizard.AssetUpload
import com.cogra.feature.content.wizard.PickedAsset
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * `CommentEdit` and `CommentEditActs`.
 *
 * The state rules and the screen are pinned together here because the
 * screen is one board rather than a flow: its arithmetic *is* what it
 * draws.
 */
@RunWith(RobolectricTestRunner::class)
class CommentEditTest {

    @get:Rule
    val compose = createComposeRule()

    private var signs = 0
    private var leaves = 0
    private var keeps = 0
    private var discards = 0
    private var actsOpens = 0
    private var pickerOpens = 0
    private var describes = 0
    private val removals = mutableListOf<Int>()
    private val helps = mutableListOf<HelpTopic>()

    @Composable
    private fun Edit(state: CommentEditState) {
        CommentEditScreen(
            state = state,
            onBodyChange = {},
            onOpenPicker = { pickerOpens += 1 },
            onRemovePickAt = { removals += it },
            onDescribePictures = { describes += 1 },
            onAltTextChange = { _, _ -> },
            onKeepWriting = { keeps += 1 },
            onDiscard = { discards += 1 },
            onOpenActs = { actsOpens += 1 },
            onCloseSheet = {},
            onOpenHelp = { helps += it },
            onCloseHelp = {},
            onSign = { signs += 1 },
            onLeave = { leaves += 1 },
            onTagInputChange = {},
            onAddTag = {},
            onRemoveTag = {},
            onTuneTag = {},
            onDoneTuningTag = {},
            onTagRelevanceChange = { _, _ -> },
            onTagConfidenceChange = { _, _ -> },
            onOpenFinder = {},
            onCloseFinder = {},
            onFinderQueryChange = {},
            onPickReference = {},
            onRemoveReference = {},
            onTuneReference = {},
            onDoneTuningReference = {},
            onReferenceRelevanceChange = { _, _ -> },
            onReferenceSupportChange = { _, _ -> },
        )
    }

    // -- The board --

    /**
     * The whole comment on one screen: words, pictures, topics,
     * citations, and the license shown locked.
     */
    @Test
    fun theEditDrawsTheWholeCommentOnOneScreen() {
        compose.setContent { Edit(edited()) }

        compose.onNodeWithTag("comment_edit_caption").assertIsDisplayed()
        compose.onNodeWithTag("comment_edit_body").assertIsDisplayed()
        compose.onNodeWithTag("comment_edit_add").assertExists()
        compose.onNodeWithTag("comment_edit_license").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("comment_edit_acts_footer").assertIsDisplayed()
        compose.onNodeWithTag("comment_edit_sign").assertIsDisplayed()
    }

    /**
     * **The board has no sensitive Mark row**, and unlike `ReplySeal`
     * that is 1:1 rather than a deviation: `graph.json` gives
     * `CommentEdit` twelve edges and none is a mark.
     */
    @Test
    fun theEditDrawsNoSensitiveRow() {
        compose.setContent { Edit(edited()) }

        compose.onNodeWithTag("comment_edit_sensitive").assertDoesNotExist()
        compose.onNodeWithTag("wizard_seal_sensitive").assertDoesNotExist()
    }

    /** The licence never changes, so the row shows it and offers nothing. */
    @Test
    fun theLicenseIsShownLocked() {
        compose.setContent { Edit(edited()) }

        compose.onNodeWithTag("comment_edit_license").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("comment_edit_license_action").assertDoesNotExist()
    }

    /** `CommentEdit` 3 — the screen's one `?`. */
    @Test
    fun theEditCarriesTheEditingHelp() {
        compose.setContent { Edit(edited()) }

        compose.onNodeWithTag("comment_edit_header_help").performClick()

        assertThat(helps).containsExactly(HelpTopic.Editing)
    }

    /** `CommentEdit` 6 — "+ Add" opens the platform picker, no pick stage. */
    @Test
    fun addOpensThePlatformPicker() {
        compose.setContent { Edit(edited()) }

        compose.onNodeWithTag("comment_edit_add").performClick()

        assertThat(pickerOpens).isEqualTo(1)
    }

    /** `CommentEdit` 5 and 7 — the tray's × and the describe counter. */
    @Test
    fun theTrayRemovesAndDescribes() {
        compose.setContent { Edit(edited().copy(picked = listOf(landed(URI_A)))) }

        compose.onNodeWithTag("comment_edit_tray_0_remove").performClick()
        compose.onNodeWithTag("comment_edit_describe_counter").performClick()

        assertThat(removals).containsExactly(0)
        assertThat(describes).isEqualTo(1)
    }

    /** `CommentEdit` 11 — the acts footer opens the sheet. */
    @Test
    fun theActsFooterOpensTheSheet() {
        compose.setContent { Edit(edited()) }

        compose.onNodeWithTag("comment_edit_acts_footer").performClick()

        assertThat(actsOpens).isEqualTo(1)
    }

    @Test
    fun theActsSheetItemisesWhatTheEditSigns() {
        compose.setContent {
            Edit(
                edited().copy(
                    tagSection = TagSectionState(tags = listOf(TagRow("glovebox"))),
                    actsOpen = true,
                ),
            )
        }

        compose.onNodeWithTag("comment_edit_acts_sheet").assertIsDisplayed()
        compose.onNodeWithTag("comment_edit_acts_total").assertExists()
    }

    /** `CommentEdit` 12. */
    @Test
    fun theEditSigns() {
        compose.setContent { Edit(edited()) }

        compose.onNodeWithTag("comment_edit_sign").assertIsEnabled().performClick()

        assertThat(signs).isEqualTo(1)
    }

    /** An edit opened and left alone stages nothing, so it cannot sign. */
    @Test
    fun anUntouchedEditCannotSign() {
        compose.setContent { Edit(untouched()) }

        compose.onNodeWithTag("comment_edit_sign").assertIsNotEnabled()
    }

    /** Leaving discards — comments keep no drafts (jakob 2026-09-01). */
    @Test
    fun theHeaderLeaves() {
        compose.setContent { Edit(edited()) }

        compose.onNodeWithTag("comment_edit_header_leave").performClick()

        assertThat(leaves).isEqualTo(1)
    }

    // -- The arithmetic --

    /**
     * The edit record counts only when its own payload moved: a topic
     * change beside it is its own act either way (F10).
     */
    @Test
    fun anUntouchedEditStagesNothing() {
        val state = untouched()

        assertThat(state.contentChanged).isFalse()
        assertThat(state.signedActionCount).isEqualTo(0)
        assertThat(state.canSign).isFalse()
    }

    @Test
    fun changedWordsAreOneAct() {
        assertThat(edited().signedActionCount).isEqualTo(1)
    }

    /** The board's own example: an edit plus one topic is two actions. */
    @Test
    fun anEditWithATopicIsTwoActions() {
        val state = edited().copy(
            tagSection = TagSectionState(tags = listOf(TagRow("glovebox"))),
        )

        assertThat(state.signedActionCount).isEqualTo(2)
    }

    /** A topic taken off is its own act too — a Tag at relevance 0. */
    @Test
    fun aTopicTakenOffIsItsOwnAct() {
        val loaded = TagRow("glovebox")
        val state = untouched().copy(
            tagSection = TagSectionState(tags = emptyList(), loaded = listOf(loaded)),
        )

        assertThat(state.signedActionCount).isEqualTo(1)
        assertThat(state.canSign).isTrue()
    }

    /** Removing a picture moves the gallery, so the edit record stages. */
    @Test
    fun removingAPictureChangesTheContent() {
        val withPicture = untouched().copy(
            picked = listOf(landed(URI_A)),
            loadedAttachmentIds = listOf(MEDIA_A),
        )

        assertThat(withPicture.contentChanged).isFalse()
        assertThat(withPicture.removePick(URI_A).contentChanged).isTrue()
    }

    /** The cap is four, as it is everywhere a comment carries pictures. */
    @Test
    fun theTrayStopsAtFourPictures() {
        val full = edited().copy(
            picked = (1..CommentEditState.MAX_PICTURES).map { landed("uri://$it") },
        )

        assertThat(full.canAddPicture).isFalse()
        assertThat(full.addPick("uri://spill").picked).hasSize(CommentEditState.MAX_PICTURES)
    }

    /** Signing waits for a picture that is still on its way. */
    @Test
    fun anUploadingPictureHoldsTheSignature() {
        val state = edited().copy(picked = listOf(PickedAsset(URI_A, upload = AssetUpload.Running)))

        assertThat(state.uploadsComplete).isFalse()
        assertThat(state.canSign).isFalse()
    }

    /**
     * The mark the edit leaves standing is carried unseen.
     *
     * `PrepareCommentEditInput` is complete-state, so a mark the edit
     * does not re-state is a mark the edit removes — the screen draws no
     * switch, so the state has to hold what was read.
     */
    @Test
    fun theStandingMarkIsCarriedThoughNothingDrawsIt() {
        val marked = edited().copy(sensitive = true, sensitiveReason = "Coast road at night")

        assertThat(marked.sensitive).isTrue()
        assertThat(marked.sensitiveReason).isEqualTo("Coast road at night")
    }

    // -- Leaving (`DiscardConfirm`) --

    @Test
    fun aChangedEditIsAskedBeforeItIsDiscarded() {
        compose.setContent { Edit(edited().copy(confirmingDiscard = true)) }

        compose.onNodeWithTag("comment_edit_discard_confirm").assertIsDisplayed()
        // The one shared dialog, asking the edit's own question.
        compose.onNodeWithText("Discard this edit?").assertIsDisplayed()
        compose.onNodeWithText("Nothing is kept.").assertIsDisplayed()
    }

    @Test
    fun keepWritingClosesTheDialogAndDiscardEndsTheEdit() {
        compose.setContent { Edit(edited().copy(confirmingDiscard = true)) }

        compose.onNodeWithTag("comment_edit_discard_confirm_keep").performClick()
        assertThat(keeps).isEqualTo(1)

        compose.onNodeWithTag("comment_edit_discard_confirm_discard").performClick()
        assertThat(discards).isEqualTo(1)
    }

    @Test
    fun anEditThatWouldSignNothingHasNothingToLose() {
        // An edit opened and closed untouched leaves at once — a confirm
        // with nothing to lose is noise.
        assertThat(untouched().hasSomethingToLose).isFalse()
        assertThat(edited().hasSomethingToLose).isTrue()
    }

    @Test
    fun theAddLabelMatchesTheReplyComposers() {
        compose.setContent { Edit(untouched()) }
        compose.onNodeWithText("+ Add pictures · 0 of 4").assertIsDisplayed()
    }

    private fun untouched() = CommentEditState(
        commentId = "c1",
        parentTitle = "The long way home",
        body = ORIGINAL,
        loadedBody = ORIGINAL,
        loading = false,
    )

    private fun edited() = untouched().copy(body = "$ORIGINAL Almost.")

    private fun landed(uri: String) =
        PickedAsset(uri, sourceRatio = 0.8f, upload = AssetUpload.Done(MEDIA_A))

    private companion object {
        const val URI_A = "content://pick/a"
        const val MEDIA_A = "media-a"
        const val ORIGINAL = "The glovebox camera earns its keep."
    }
}

package com.cogra.feature.content.reply

import androidx.compose.runtime.Composable
import androidx.compose.ui.test.assertHasNoClickAction
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.domain.testing.fakeUpload
import com.cogra.feature.content.ReferenceRow
import com.cogra.feature.content.ReferenceSectionState
import com.cogra.feature.content.TagRow
import com.cogra.feature.content.TagSectionState
import com.cogra.feature.content.edit.EDIT_WRITE_RULE_FACT
import com.cogra.feature.content.edit.EditCrop
import com.cogra.feature.content.edit.EditGallery
import com.cogra.feature.content.wizard.AssetUpload
import com.cogra.feature.content.wizard.PickedAsset
import com.cogra.feature.content.wizard.RefusedPick
import com.cogra.feature.content.wizard.SealFault
import com.cogra.feature.content.wizard.UploadFailure
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
    private var sensitiveOpens = 0
    private val marks = mutableListOf<Boolean>()
    private var pickerOpens = 0
    private var describes = 0
    private val removals = mutableListOf<Int>()
    private val helps = mutableListOf<HelpTopic>()

    @Composable
    private fun Edit(state: CommentEditState) {
        CommentEditScreen(
            state = state,
            actions = CommentEditActions(
                onOpenPicker = { pickerOpens += 1 },
                onRemovePickAt = { removals += it },
                onDescribePictures = { describes += 1 },
                onKeepWriting = { keeps += 1 },
                onDiscard = { discards += 1 },
                onOpenActs = { actsOpens += 1 },
                onOpenSensitive = { sensitiveOpens += 1 },
                onSensitiveChange = { marks += it },
                onOpenHelp = { helps += it },
                onSign = { signs += 1 },
                onLeave = { leaves += 1 },
            ),
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

        compose.onNodeWithTag("commentEdit.target").assertIsDisplayed()
        compose.onNodeWithTag("commentEdit.words.input").assertIsDisplayed()
        compose.onNodeWithTag("commentEdit.pictures.add").assertExists()
        compose.onNodeWithTag("commentEdit.facts.license").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("commentEdit.acts.line").assertIsDisplayed()
        compose.onNodeWithTag("commentEdit.sign").assertIsDisplayed()
    }

    /**
     * The board's last term row, beside the locked license: the license
     * is fixed by contract at signing, while the mark is the author's
     * ongoing judgment about their own words (backlog 25.2).
     */
    @Test
    fun theEditDrawsTheSensitiveRowBesideTheLockedLicense() {
        compose.setContent { Edit(edited()) }

        compose.onNodeWithTag("commentEdit.facts.sensitive").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("commentEdit.facts.sensitive.action").assertExists()
    }

    /** Mark opens the one sensitive sheet, at this surface's tags. */
    @Test
    fun markOpensTheSensitiveSheet() {
        compose.setContent { Edit(edited()) }

        compose.onNodeWithTag("commentEdit.facts.sensitive.action").performScrollTo().performClick()

        assertThat(sensitiveOpens).isEqualTo(1)
    }

    @Test
    fun theSensitiveSheetsReasonIsDeadUntilTheSwitchIsOn() {
        compose.setContent { Edit(edited().copy(sensitiveOpen = true)) }

        compose.onNodeWithTag("comment_edit_sensitive_sheet").assertExists()
        // The sheet opens ON (the `Mark` was the intent); off, the reason is dead.
        compose.onNodeWithTag("comment_edit_sensitive_switch").performClick()
        compose.onNodeWithTag("comment_edit_sensitive_reason").assertIsNotEnabled()
    }

    @Test
    fun theSensitiveSheetsReasonLivesUnderItsOwnMark() {
        compose.setContent { Edit(edited().copy(sensitiveOpen = true, sensitive = true)) }

        compose.onNodeWithTag("comment_edit_sensitive_reason").assertIsEnabled()
    }

    /** The licence never changes, so the row shows it and offers nothing. */
    @Test
    fun theLicenseIsShownLocked() {
        compose.setContent { Edit(edited()) }

        compose.onNodeWithTag("commentEdit.facts.license").performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("comment_edit_license_action").assertDoesNotExist()
    }

    /** `CommentEdit` 3 — the screen's one `?`. */
    @Test
    fun theEditCarriesTheEditingHelp() {
        compose.setContent { Edit(edited()) }

        compose.onNodeWithTag("commentEdit.header.help").performClick()

        assertThat(helps).containsExactly(HelpTopic.Editing)
    }

    /** `CommentEdit` 6 — "+ Add" opens the platform picker, no pick stage. */
    @Test
    fun addOpensThePlatformPicker() {
        compose.setContent { Edit(edited()) }

        compose.onNodeWithTag("commentEdit.pictures.add").performClick()

        assertThat(pickerOpens).isEqualTo(1)
    }

    /** `CommentEdit` 5 and 7 — the tray's × and the describe counter. */
    @Test
    fun theTrayRemovesAndDescribes() {
        compose.setContent { Edit(edited().copy(gallery = EditGallery.of(listOf(kept())))) }

        compose.onNodeWithTag("commentEdit.pictures.thumb.remove").performClick()
        compose.onNodeWithTag("commentEdit.pictures.describeRow.describe").performClick()

        assertThat(removals).containsExactly(0)
        assertThat(describes).isEqualTo(1)
    }

    /** `CommentEdit` 11 — the acts footer opens the sheet. */
    @Test
    fun theActsFooterOpensTheSheet() {
        compose.setContent { Edit(edited()) }

        compose.onNodeWithTag("commentEdit.acts.line").performClick()

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
        compose.onNodeWithText("2 things, signed together").assertExists()
        compose.onNodeWithTag("comment_edit_acts_sheet_row_Edit").assertExists()
        compose.onNodeWithTag("comment_edit_acts_sheet_row_TagsAdded").assertExists()
        compose.onNodeWithTag("comment_edit_acts_sheet_together").assertExists()
    }

    /** EditComposeUnchanged — the family's guard: at zero the foot is no control. */
    @Test
    fun anEmptyBatchLeavesSignInertAndTheFooterNotAControl() {
        compose.setContent { Edit(untouched()) }

        compose.onNodeWithText("Nothing to sign yet").assertIsDisplayed()
        compose.onNodeWithTag("commentEdit.acts.line").assertHasNoClickAction()
        compose.onNodeWithTag("commentEdit.sign").assertIsDisplayed().assertIsNotEnabled()
    }

    /** A tag the comment carried, taken off, reads back under its block with Undo. */
    @Test
    fun aWithdrawnTagReadsBackWithUndo() {
        val loaded = TagRow("glovebox")
        compose.setContent {
            Edit(untouched().copy(tagSection = TagSectionState(tags = emptyList(), loaded = listOf(loaded))))
        }

        compose.onNodeWithTag("commentEdit.tags.withdrawn").performScrollTo().assertIsDisplayed()
        compose.onNodeWithText("Withdrawn: #glovebox").assertExists()
        compose.onNodeWithText("You're signing 1 thing").assertExists()
    }

    /** `CommentEdit` 12. */
    @Test
    fun theEditSigns() {
        compose.setContent { Edit(edited()) }

        compose.onNodeWithTag("commentEdit.sign").assertIsEnabled().performClick()

        assertThat(signs).isEqualTo(1)
    }

    /** An edit opened and left alone stages nothing, so it cannot sign. */
    @Test
    fun anUntouchedEditCannotSign() {
        compose.setContent { Edit(untouched()) }

        compose.onNodeWithTag("commentEdit.sign").assertIsNotEnabled()
    }

    /** Leaving discards — comments keep no drafts (jakob 2026-09-01). */
    @Test
    fun theHeaderLeaves() {
        compose.setContent { Edit(edited()) }

        compose.onNodeWithTag("commentEdit.header.leave").performClick()

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

    /**
     * THE GUARD IS THE ACTS BATCH, NOT A BYTE COMPARISON
     * (EditComposeUnchanged.md:3): words typed and taken back keep the
     * record staged, and the edit still signs — a priced no-op.
     */
    @Test
    fun aTypedThenRevertedEditStillSigns() {
        val reverted = untouched().copy(recordStaged = true)

        assertThat(reverted.body).isEqualTo(ORIGINAL)
        assertThat(reverted.signedActionCount).isEqualTo(1)
        assertThat(reverted.canSign).isTrue()
    }

    /** A citation's withdrawal counts its served counter-records, not one per gesture. */
    @Test
    fun aCitationWithdrawalCountsItsCounterRecords() {
        val cited = ReferenceRow("u-juno", target = null, withdrawalCost = 2)
        val state = untouched().copy(
            referenceSection = ReferenceSectionState(references = emptyList(), loaded = listOf(cited)),
        )

        assertThat(state.signedActionCount).isEqualTo(2)
    }

    /** The board's own example: an edit plus one topic is two actions. */
    @Test
    fun anEditWithATopicIsTwoActions() {
        val state = edited().copy(
            tagSection = TagSectionState(tags = listOf(TagRow("glovebox"))),
        )

        assertThat(state.signedActionCount).isEqualTo(2)
    }

    /** A topic taken off is its own act too — a Tag at (0,0). */
    @Test
    fun aTopicTakenOffIsItsOwnAct() {
        val loaded = TagRow("glovebox")
        val state = untouched().copy(
            tagSection = TagSectionState(tags = emptyList(), loaded = listOf(loaded)),
        )

        assertThat(state.signedActionCount).isEqualTo(1)
        assertThat(state.canSign).isTrue()
    }

    /**
     * The add control is NEVER shut at the cap: a fifth picture is refused in
     * words under the pictures, which a disabled control would only hide.
     */
    @Test
    fun theAddControlStaysOpenAtFourPictures() {
        val full = edited().copy(gallery = EditGallery.of((1..CommentEditState.MAX_PICTURES).map { kept("m$it") }))

        assertThat(full.canAddPicture).isTrue()
        compose.setContent { Edit(full) }
        compose.onNodeWithTag("commentEdit.pictures.add")
            .assertTextContains("+ Add pictures · 4 of 4")
            .assertIsEnabled()
    }

    /** CommentEdit.md: Sign the edit is enabled GIVEN an upload is running — a press there is held. */
    @Test
    fun anUploadingPictureLeavesSignEnabledAndTheGateStands() {
        val state = edited().copy(
            gallery = EditGallery().adding(listOf(PickedAsset(URI_A, upload = AssetUpload.Running)), cap = 4),
        )
        compose.setContent { Edit(state) }

        compose.onNodeWithTag("commentEdit.gate").assertExists()
        compose.onNodeWithText("Uploading 0 of 1 — signing waits for the picture.").assertExists()
        compose.onNodeWithTag("commentEdit.sign").assertIsEnabled()
    }

    /** CommentEdit.md: a failed picture marks its tile, lines the pictures, and disables Sign. */
    @Test
    fun aFailedPictureDisablesSignWithItsLinesUnderThePictures() {
        val failed = PickedAsset(URI_A, upload = AssetUpload.Failed(UploadFailure.TRANSPORT))
        compose.setContent { Edit(edited().copy(gallery = EditGallery().adding(listOf(failed), cap = 4))) }

        compose.onNodeWithTag("comment_edit_upload_error")
            .assertTextContains("One picture didn't upload.", substring = true)
            .assertTextContains("Remove it", substring = true)
        compose.onNodeWithTag("commentEdit.gate")
            .assertTextContains("One picture didn't upload. Signing waits for it.", substring = true)
        compose.onNodeWithTag("commentEdit.sign").assertIsNotEnabled()
    }

    /** A fifth picture, refused in the copy-voice line under the pictures. */
    @Test
    fun aFifthPictureIsRefusedInWords() {
        val refused = listOf(RefusedPick("content://pick/e", UploadFailure.COMMENT_PICTURE_COUNT))
        compose.setContent { Edit(edited().copy(refused = refused)) }

        compose.onNodeWithTag("comment_edit_refused_0")
            .assertTextContains("That's more than a comment carries — up to four pictures.", substring = true)
    }

    /** CommentEdit.md: the stage opens with focus on its heading, the keyboard down. */
    @Test
    fun theStageOpensWithFocusOnItsHeading() {
        compose.setContent { Edit(untouched()) }

        compose.onNodeWithText("Edit comment").assertIsFocused()
    }

    /** CommentEdit board: the block reads `Tags`, as every edit's does. */
    @Test
    fun theTagsBlockIsLabelledTags() {
        compose.setContent { Edit(untouched()) }

        compose.onNodeWithText("Tags").performScrollTo().assertExists()
        compose.onNodeWithText("Topics").assertDoesNotExist()
    }

    // -- The faults (CommentEdit.md) --

    @Test
    fun theWriteRulesNoticeEndsOnTheEditAndOffersNotNow() {
        var notNow = 0
        compose.setContent {
            CommentEditScreen(
                state = edited().copy(fault = SealFault.WriteRule),
                actions = CommentEditActions(onNotNow = { notNow++ }),
            )
        }

        compose.onNodeWithText("You can't sign right now").assertExists()
        compose.onNodeWithText(EDIT_WRITE_RULE_FACT).assertExists()
        compose.onNodeWithText("Retry").assertDoesNotExist()
        compose.onNodeWithTag("commentEdit.sign").assertDoesNotExist()
        compose.onNodeWithTag("comment_edit_not_now").performClick()
        assertThat(notNow).isEqualTo(1)
    }

    @Test
    fun anUnlandedCitationSaysSoOnItsRowWithRemoveIt() {
        val cited = ReferenceRow("u-ghost", target = null)
        compose.setContent {
            Edit(
                edited().copy(
                    referenceSection = ReferenceSectionState(references = listOf(cited)),
                    fault = SealFault.Row("u-ghost"),
                ),
            )
        }

        compose.onNodeWithTag("comment_edit_unlanded").performScrollTo()
            .assertTextContains("This post didn't land, so it can't be cited.", substring = true)
            .assertTextContains("Remove it", substring = true)
        compose.onNodeWithText("Retry", substring = true).assertDoesNotExist()
    }

    @Test
    fun anyOtherRefusalStandsTheBugNoticeWithItsThreeWays() {
        var discardsAsked = 0
        compose.setContent {
            CommentEditScreen(
                state = edited().copy(fault = SealFault.Bug),
                actions = CommentEditActions(onSign = { signs++ }, onDiscardAsked = { discardsAsked++ }),
            )
        }

        compose.onNodeWithText("This shouldn't have happened").assertExists()
        compose.onNodeWithTag("comment_edit_report").assertExists()
        compose.onNodeWithTag("comment_edit_try_again").performClick()
        compose.onNodeWithTag("comment_edit_discard").performClick()
        assertThat(signs).isEqualTo(1)
        assertThat(discardsAsked).isEqualTo(1)
    }

    // -- CommentEditVideo --

    @Test
    fun aClipStandsWholeWithItsCoverRowAndNoAddControl() {
        val clip = fakeUpload("v1").copy(cover = fakeUpload("p8"), coverTaken = false, durationMs = 18_000)
        compose.setContent { Edit(edited().copy(gallery = EditGallery.of(listOf(clip)))) }

        compose.onNodeWithText("Video").assertExists()
        compose.onNodeWithText("Describe the video").assertExists()
        compose.onNodeWithTag("commentEdit.cover.change").assertTextContains("Change the cover")
        compose.onNodeWithTag("commentEdit.pictures.add").assertDoesNotExist()
        // No "a video is the whole comment" line: the labelled fields say it.
        compose.onNodeWithText("A video is the whole", substring = true).assertDoesNotExist()
        compose.onNodeWithContentDescription("Remove this video").performClick()
        assertThat(removals).containsExactly(0)
    }

    @Test
    fun aClipWithNoCoverShowsAddACoverAndNoPicture() {
        compose.setContent { Edit(edited().copy(gallery = EditGallery.of(listOf(fakeUpload("v1"))))) }

        compose.onNodeWithTag("commentEdit.cover.add").assertTextContains("Add a cover")
        compose.onNodeWithTag("commentEdit.cover.thumb").assertDoesNotExist()
        compose.onNodeWithTag("commentEdit.cover.note").assertDoesNotExist()
    }

    @Test
    fun aNewFaceUploadingGatesOnTheCover() {
        val gallery = EditGallery.of(listOf(fakeUpload("v1")))
            .withNewCover(PickedAsset("face.jpg", upload = AssetUpload.Running))
        compose.setContent { Edit(edited().copy(gallery = gallery)) }

        compose.onNodeWithTag("commentEdit.gate").assertExists()
        compose.onNodeWithText("Uploading 0 of 1 — signing waits for the cover.").assertExists()
        compose.onNodeWithTag("commentEdit.sign").assertIsEnabled()
    }

    /** CoverCrop.md: the comment's crop is locked to the square, no chips; its X is the edit's own. */
    @Test
    fun theCoversCropIsTheCommentsSquareAndItsXIsTheEdits() {
        compose.setContent {
            Edit(
                edited().copy(
                    gallery = EditGallery.of(listOf(fakeUpload("v1"))),
                    cropping = EditCrop.Cover(PickedAsset("face.jpg"), ratio = 1f),
                ),
            )
        }

        compose.onNodeWithText("The cover").assertExists()
        compose.onNodeWithText("The cover takes the video's shape.").assertExists()
        compose.onNodeWithTag("composeCrop.shapes").assertDoesNotExist()
        compose.onNodeWithContentDescription(COMMENT_EDIT_LEAVE_LABEL).performClick()
        assertThat(leaves).isEqualTo(1)
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
        compose.onNodeWithText("Discard the changes?").assertIsDisplayed()
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

    private fun edited() = untouched().copy(body = "$ORIGINAL Almost.", recordStaged = true)

    private fun kept(id: String = "media-a") = fakeUpload(id).copy(aspectRatio = 0.8f)

    private companion object {
        const val URI_A = "content://pick/a"
        const val ORIGINAL = "The glovebox camera earns its keep."
    }
}

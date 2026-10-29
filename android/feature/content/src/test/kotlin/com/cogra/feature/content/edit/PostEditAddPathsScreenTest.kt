// The post edit's add paths and its clip's cover, drawn — EditCompose.md,
// EditComposeVideo.md, EditWords.md and CoverCrop.md compiled line by line
// against the stateless screen. The ViewModel's half (the held press, the
// screening, the uploads) is PostEditViewModelTest's.

package com.cogra.feature.content.edit

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.domain.compose.DraftShape
import com.cogra.domain.testing.fakeUpload
import com.cogra.feature.content.isNode
import com.cogra.feature.content.wizard.AssetUpload
import com.cogra.feature.content.wizard.PickedAsset
import com.cogra.feature.content.wizard.RefusedPick
import com.cogra.feature.content.wizard.UploadFailure
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(qualifiers = "+h1600dp")
class PostEditAddPathsScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private val kept = fakeUpload("m1").copy(aspectRatio = 4f / 5f)

    private val clip = fakeUpload("v1").copy(aspectRatio = 9f / 16f, durationMs = 12_000)

    private val picked = PickedAsset("a.jpg", sourceRatio = 1f)

    private val coverCrop = EditCrop.Cover(PickedAsset("face.jpg"), ratio = 9f / 16f)

    private fun pictures(vararg added: PickedAsset) = EditGallery.of(listOf(kept)).adding(added.toList(), cap = 10)

    private fun render(state: PostEditUiState, actions: PostEditActions = PostEditActions()) {
        compose.setContent { PostEditScreen(state = state, actions = actions) }
    }

    private fun edit(gallery: EditGallery, recordStaged: Boolean = true) =
        PostEditUiState(postId = "p1", title = "Salt maps", gallery = gallery, recordStaged = recordStaged)

    // -- EditCompose --

    @Test
    fun addPicturesCountsTheBodyAndOpensTheDevicesPicker() {
        var opened = 0
        val landed = PickedAsset("a.jpg", upload = AssetUpload.Done("m-a"))
        render(edit(pictures(landed)), PostEditActions(onAddMedia = { opened++ }))

        compose.onNodeWithTag("postEdit.body.add").performScrollTo()
            .assertTextContains("+ Add pictures · 2 of 10")
            .performClick()
        assertThat(opened).isEqualTo(1)
        compose.onNodeWithText(BODY_RULE_LINE).assertExists()
        // Round 22: the picked row badges its first picture the cover.
        compose.onAllNodesWithTag("media_thumb_cover_badge", useUnmergedTree = true).assertCountEquals(1)
    }

    @Test
    fun whileAPictureUploadsTheGateStandsAndSignStaysEnabled() {
        val landed = PickedAsset("a.jpg", upload = AssetUpload.Done("m-a"))
        render(edit(pictures(landed, PickedAsset("b.jpg", upload = AssetUpload.Running))))

        compose.onNode(isNode("postEdit.gate")).assertExists()
        compose.onNodeWithText("Uploading 1 of 2 — signing waits for the pictures.").assertExists()
        compose.onNode(isNode("postEdit.sign")).assertIsEnabled()
    }

    @Test
    fun aGateOnOnePictureNamesThePicture() {
        render(edit(pictures(PickedAsset("a.jpg", upload = AssetUpload.Running))))

        compose.onNode(isNode("postEdit.gate")).assertExists()
        compose.onNodeWithText("Uploading 0 of 1 — signing waits for the picture.").assertExists()
    }

    @Test
    fun aFailedPictureIsMarkedLinedUnderTheRowAndSignIsDisabled() {
        render(edit(pictures(PickedAsset("a.jpg", upload = AssetUpload.Failed(UploadFailure.TRANSPORT)))))

        compose.onNodeWithTag("postEdit.body.uploadError").performScrollTo()
            .assertTextContains("One picture didn't upload.", substring = true)
            .assertTextContains("Retry", substring = true)
            .assertTextContains("Remove it", substring = true)
        compose.onNode(isNode("postEdit.gate"))
            .assertTextContains("One picture didn't upload. Signing waits for it.", substring = true)
        compose.onNode(isNode("postEdit.sign")).assertIsNotEnabled()
    }

    @Test
    fun twoFailuresReadThePluralAndRemoveThem() {
        val failed = AssetUpload.Failed(UploadFailure.TRANSPORT)
        render(edit(pictures(PickedAsset("a.jpg", upload = failed), PickedAsset("b.jpg", upload = failed))))

        compose.onNodeWithTag("postEdit.body.uploadError").performScrollTo()
            .assertTextContains("2 pictures didn't upload.", substring = true)
            .assertTextContains("Remove them", substring = true)
        compose.onNode(isNode("postEdit.gate"))
            .assertTextContains("2 pictures didn't upload. Signing waits for them.", substring = true)
    }

    @Test
    fun aRefusedFileSaysWhyOnTheMediaRow() {
        render(
            edit(pictures()).copy(refused = listOf(RefusedPick("c.jpg", UploadFailure.POST_PICTURE_COUNT))),
        )

        compose.onNodeWithTag("post_edit_refused_0").performScrollTo()
            .assertTextContains("That's more than a post carries — up to ten pictures.", substring = true)
        compose.onNodeWithText("Retry", substring = true).assertDoesNotExist()
    }

    /** EditCompose.md: 200ms into a press held at the gate, the label swaps and the ways out refuse. */
    @Test
    fun aHeldPressReadsSigningTheEditAndLocksTheWaysOut() {
        var leaves = 0
        render(
            edit(pictures(PickedAsset("a.jpg", upload = AssetUpload.Running))).copy(heldPress = true),
            PostEditActions(onLeave = { leaves++ }),
        )
        compose.mainClock.advanceTimeBy(SLOW_ANSWER_MS + 100)

        compose.onNode(isNode("postEdit.sign")).assertTextContains("Signing the edit…").assertIsEnabled()
        compose.onNodeWithTag("postEdit.header.leave").performClick()
        assertThat(leaves).isEqualTo(0)
    }

    @Test
    fun theMediaEditLandsItsOpeningFocusOnTheHeading() {
        render(edit(pictures(), recordStaged = false))

        compose.onNodeWithText("Edit post").assertIsFocused()
    }

    // -- EditWords --

    @Test
    fun theWordsEditOffersPicturesOrAVideoAndTakesFocusInItsBody() {
        var opened = 0
        render(PostEditUiState(postId = "p1", body = "Salt maps"), PostEditActions(onAddMedia = { opened++ }))

        compose.onNodeWithTag("postEdit.body.words.input").assertIsFocused()
        compose.onNodeWithTag("postEdit.body.add").assertTextContains("+ Add pictures or a video").performClick()
        assertThat(opened).isEqualTo(1)
    }

    @Test
    fun aClipRefusedAtTheWordsEditSaysTheEditsOwnLine() {
        render(
            PostEditUiState(
                postId = "p1",
                body = "Salt maps",
                refused = listOf(RefusedPick("video.mp4", UploadFailure.VIDEO_AT_EDIT, isVideo = true)),
            ),
        )

        compose.onNodeWithTag("post_edit_refused_0")
            .assertTextContains("A video can't be added at an edit yet — post it on its own.", substring = true)
    }

    // -- EditComposeVideo --

    @Test
    fun theClipStandsWholeWithItsDescriptionAndNoAddControl() {
        var removed = -1
        render(edit(EditGallery.of(listOf(clip))), PostEditActions(onRemovePicture = { removed = it }))

        compose.onNodeWithText("Video").assertExists()
        compose.onNodeWithText("Describe the video").assertExists()
        compose.onNodeWithTag("postEdit.video.rule").assertTextContains("A video is the whole post.")
        compose.onNodeWithTag("postEdit.body.add").assertDoesNotExist()
        compose.onNodeWithContentDescription("Remove this video").performClick()
        assertThat(removed).isEqualTo(0)
    }

    @Test
    fun aTakenFrameOpensTheDoorNotAChosenFace() {
        var picked = 0
        val taken = clip.copy(cover = fakeUpload("p9"), coverTaken = true)
        render(edit(EditGallery.of(listOf(taken))), PostEditActions(onPickCover = { picked++ }))

        compose.onNodeWithTag("postEdit.cover.note").performScrollTo()
            .assertTextContains("It plays the moment it is on screen, so it starts on its own first frame.")
        compose.onNodeWithTag("postEdit.cover.change").assertDoesNotExist()
        compose.onNodeWithTag("postEdit.cover.add").assertTextContains("Add a cover").performClick()
        assertThat(picked).isEqualTo(1)
    }

    @Test
    fun aChosenFaceShowsWithChangeTheCover() {
        val chosen = clip.copy(cover = fakeUpload("p8"), coverTaken = false)
        render(edit(EditGallery.of(listOf(chosen))))

        compose.onNodeWithTag("postEdit.cover.thumb").assertExists()
        compose.onNodeWithTag("postEdit.cover.change").assertTextContains("Change the cover")
        compose.onNodeWithTag("postEdit.cover.add").assertDoesNotExist()
    }

    @Test
    fun aNewFaceUploadingGatesSignOnTheCover() {
        val gallery = EditGallery.of(listOf(clip)).withNewCover(PickedAsset("face.jpg", upload = AssetUpload.Running))
        render(edit(gallery))

        compose.onNode(isNode("postEdit.gate")).assertExists()
        compose.onNodeWithText("Uploading 0 of 1 — signing waits for the cover.").assertExists()
        compose.onNode(isNode("postEdit.sign")).assertIsEnabled()
    }

    @Test
    fun aFailedFaceReadsOnePictureUnderTheCoverRow() {
        var removed = 0
        val gallery = EditGallery.of(listOf(clip))
            .withNewCover(PickedAsset("face.jpg", upload = AssetUpload.Failed(UploadFailure.TRANSPORT)))
        render(edit(gallery), PostEditActions(onRemoveCover = { removed++ }))

        compose.onNodeWithTag("post_edit_cover_error").performScrollTo()
            .assertTextContains("One picture didn't upload.", substring = true)
        compose.onNode(isNode("postEdit.sign")).assertIsNotEnabled()
    }

    // -- The crops (ComposeCrop.md, CoverCrop.md) --

    @Test
    fun theCropOverAPicturePostIsLockedAndShowsNoChips() {
        render(
            edit(pictures()).copy(
                cropping = EditCrop.Pictures(listOf(picked), DraftShape.Tall, locked = true),
            ),
        )

        compose.onNodeWithText("Crop").assertExists()
        compose.onNodeWithTag("composeCrop.shapes").assertDoesNotExist()
        compose.onNodeWithContentDescription("Back to the edit").assertExists()
        compose.onNodeWithContentDescription(EDIT_LEAVE_LABEL).assertExists()
    }

    @Test
    fun theCropOverAWordsPostOffersTheChips() {
        render(
            PostEditUiState(
                postId = "p1",
                body = "Salt maps",
                cropping = EditCrop.Pictures(listOf(picked), DraftShape.Tall, locked = false),
            ),
        )

        compose.onNodeWithTag("composeCrop.shapes").assertExists()
    }

    @Test
    fun theCoversCropIsLockedToTheClipAndSaysSo() {
        var back = 0
        var next = 0
        render(
            edit(EditGallery.of(listOf(clip))).copy(cropping = coverCrop),
            PostEditActions(onCropBack = { back++ }, onCoverCropNext = { next++ }),
        )

        compose.onNodeWithText("The cover").assertExists()
        compose.onNodeWithText(CROP_HOW_TO_LINE).assertExists()
        compose.onNodeWithText(COVER_CROP_LINE).assertExists()
        compose.onNodeWithTag("composeCrop.shapes").assertDoesNotExist()
        compose.onNodeWithTag("coverCrop.next").performClick()
        compose.onNodeWithContentDescription("Back to the edit").performClick()
        assertThat(next).isEqualTo(1)
        assertThat(back).isEqualTo(1)
    }

    /** CoverCrop.md: the X entered from a post edit's cover row raises the edit's own ask. */
    @Test
    fun theCropsXIsTheEditsOwnX() {
        var leaves = 0
        render(
            edit(EditGallery.of(listOf(clip))).copy(cropping = coverCrop),
            PostEditActions(onLeave = { leaves++ }),
        )

        compose.onNodeWithContentDescription(EDIT_LEAVE_LABEL).performClick()
        assertThat(leaves).isEqualTo(1)
    }
}

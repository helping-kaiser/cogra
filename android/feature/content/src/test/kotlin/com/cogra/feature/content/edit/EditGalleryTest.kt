package com.cogra.feature.content.edit

import com.cogra.domain.AttachmentClaim
import com.cogra.domain.signing.known
import com.cogra.domain.testing.fakeUpload
import com.cogra.feature.content.wizard.AssetUpload
import com.cogra.feature.content.wizard.PickedAsset
import com.cogra.feature.content.wizard.UploadFailure
import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * The edits' one gallery model (EditCompose, EditComposeVideo, EditPicked,
 * CommentEdit, CommentEditVideo; the web's `comment-edit.ts`): kept pictures
 * never upload again, added ones and a clip's new face are what the gate
 * counts, and the gallery handed to the prepare is complete state.
 */
class EditGalleryTest {

    private val still = fakeUpload("p1").copy(altText = "The coast road")
    private val second = fakeUpload("p2")
    private val clip = fakeUpload("v1")
    private val takenFrame = fakeUpload("p9")
    private val chosenFace = fakeUpload("p8")

    private fun added(uri: String, upload: AssetUpload = AssetUpload.Running) = PickedAsset(uri, upload = upload)

    // -- The clip and its face --

    @Test
    fun oneKeptVideoIsTheClip() {
        assertThat(EditGallery.of(listOf(clip)).clip?.key).isEqualTo("v1")
        assertThat(EditGallery.of(listOf(still)).clip).isNull()
        assertThat(EditGallery.of(listOf(still, second)).clip).isNull()
    }

    /** EditComposeVideo.md: `Add a cover` GIVEN no cover was ever chosen, even when a taken still exists. */
    @Test
    fun aTakenFrameIsNoChosenCover() {
        val taken = EditGallery.of(listOf(clip.copy(cover = takenFrame, coverTaken = true)))
        val chosen = EditGallery.of(listOf(clip.copy(cover = chosenFace, coverTaken = false)))
        val none = EditGallery.of(listOf(clip))

        assertThat(taken.coverChosen).isFalse()
        assertThat(none.coverChosen).isFalse()
        assertThat(chosen.coverChosen).isTrue()
        assertThat(none.withNewCover(added("face")).coverChosen).isTrue()
    }

    @Test
    fun aFaceIsOnlyTakenByAClip() {
        val pictures = EditGallery.of(listOf(still))

        assertThat(pictures.withNewCover(added("face")).newCover).isNull()
    }

    /** CommentEditVideo.md: the clip's attachment points at the new picture AND NEVER the clip itself changes. */
    @Test
    fun aLandedFaceIsWhatTheClipsPlacementNames() {
        val gallery = EditGallery.of(listOf(clip.copy(cover = takenFrame, coverTaken = true)))
            .withNewCover(added("face", AssetUpload.Done("m-face")))

        assertThat(gallery.claims).containsExactly(AttachmentClaim("v1", null, "m-face", coverTaken = false))
    }

    @Test
    fun aKeptPlacementReStatesThePosterItNamed() {
        val gallery = EditGallery.of(listOf(clip.copy(cover = takenFrame, coverTaken = true)))

        assertThat(gallery.claims).containsExactly(AttachmentClaim("v1", null, "p9", coverTaken = true))
    }

    @Test
    fun theClipLeavingTakesItsNewFaceWithIt() {
        val gallery = EditGallery.of(listOf(clip)).withNewCover(added("face")).removing("v1")

        assertThat(gallery.isEmpty).isTrue()
        assertThat(gallery.newCover).isNull()
        assertThat(gallery.uploads).isEmpty()
    }

    // -- The gate's counts --

    @Test
    fun onlyWhatTheEditTookIsCounted() {
        val gallery = EditGallery.of(listOf(still))
            .adding(listOf(added("a", AssetUpload.Done("m-a")), added("b")), cap = 10)

        assertThat(gallery.uploads.map { it.uri }).containsExactly("a", "b")
        assertThat(gallery.uploadsDone).isEqualTo(1)
        assertThat(gallery.uploadsPending).isEqualTo(1)
        assertThat(gallery.uploadsFailed).isEqualTo(0)
    }

    @Test
    fun theGalleryWaitsOnEveryUploadBeforeItCanBeClaimed() {
        val running = EditGallery.of(listOf(still)).adding(listOf(added("a")), cap = 10)

        assertThat(running.claims).isNull()
        val landed = running.withUpload("a", AssetUpload.Done("m-a", fakeUpload("m-a").known()))
        assertThat(landed.claims).containsExactly(
            AttachmentClaim("p1", "The coast road", null, false),
            AttachmentClaim("m-a", null),
        ).inOrder()
        assertThat(landed.ownKnown.keys).containsExactly("m-a")
    }

    @Test
    fun aFailedUploadIsCountedAsFailedNotPending() {
        val gallery = EditGallery.of(emptyList())
            .adding(listOf(added("a", AssetUpload.Failed(UploadFailure.TRANSPORT))), cap = 10)

        assertThat(gallery.uploadsFailed).isEqualTo(1)
        assertThat(gallery.uploadsPending).isEqualTo(0)
    }

    // -- The set --

    @Test
    fun addingStopsAtTheCapAndNeverTakesAPictureTwice() {
        val gallery = EditGallery.of(listOf(still, second))
            .adding(listOf(added("a"), added("a"), added("b"), added("c")), cap = 4)

        assertThat(gallery.pictures.map { it.key }).containsExactly("p1", "p2", "a", "b").inOrder()
    }

    @Test
    fun aMoveReordersAndTheFirstIsTheCover() {
        val gallery = EditGallery.of(listOf(still, second)).moving(1, 0)

        assertThat(gallery.pictures.map { it.key }).containsExactly("p2", "p1").inOrder()
        assertThat(EditGallery.of(listOf(still)).moving(0, 3)).isEqualTo(EditGallery.of(listOf(still)))
    }

    @Test
    fun aDescriptionLandsOnEitherKind() {
        val gallery = EditGallery.of(listOf(still)).adding(listOf(added("a")), cap = 10)
            .withAltText("a", "A gull")
            .withAltText("p1", " ")

        assertThat(gallery.pictures.map { it.altText }).containsExactly("", "A gull").inOrder()
        assertThat(gallery.describedCount).isEqualTo(1)
    }
}

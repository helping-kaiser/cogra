// An edit's media — the post edit's (EditCompose, EditComposeVideo,
// EditPicked) and the comment edit's (CommentEdit, CommentEditVideo) alike.
// The web client's twin is `web/src/lib/compose/comment-edit.ts`: one model
// for both edits on both clients, so the two edits never drift apart.
//
// AN EDIT'S PICTURES ARE NOT A COMPOSE'S, which is why this is its own model
// rather than a list of picks. A composer starts from nothing and every
// picture is bytes on their way up; an editor starts from pictures ALREADY on
// the server, with ids and URLs and no local bytes at all. So the two kinds
// are named: a picture is KEPT or it is ADDED.
//
// A CLIP KEEPS ITS BYTES AND MAY TAKE A NEW FACE (api-spec.md, "A video and
// its cover are two contents"). The clip is never swapped at an edit — it
// stays or leaves whole — but the still that fronts it is a picture of the
// author's own, and the placement names it at the edit's signing. So the
// gallery carries an optional [EditGallery.newCover], uploaded like an added
// picture and waited on by the same gate.
//
// THE GALLERY IS COMPLETE STATE, like the body and the mark: what it hands the
// prepare is the gallery the edit LEAVES STANDING, never a delta.

package com.cogra.feature.content.edit

import com.cogra.core.designsystem.v2.compose.PickedPicture
import com.cogra.core.designsystem.v2.media.CropFraming
import com.cogra.domain.AttachmentClaim
import com.cogra.domain.MediaAssetView
import com.cogra.domain.media.CropSpec
import com.cogra.domain.signing.KnownMedia
import com.cogra.feature.content.toItem
import com.cogra.feature.content.wizard.AssetUpload
import com.cogra.feature.content.wizard.PickedAsset
import com.cogra.feature.content.wizard.formatDuration
import com.cogra.feature.content.wizard.pickedPictures
import com.cogra.feature.content.wizard.toFraming

/** One picture or clip an edit holds. */
sealed interface EditPicture {
    /** The picture's own handle: a kept one's media id, an added one's device uri. */
    val key: String

    val altText: String

    /** Already on the server when the edit opened; its bytes never move. */
    data class Kept(val asset: MediaAssetView) : EditPicture {
        override val key: String get() = asset.id
        override val altText: String get() = asset.altText.orEmpty()
    }

    /** Chosen in this edit — through the crop, for a post — and uploading like any picture. */
    data class Added(val asset: PickedAsset) : EditPicture {
        override val key: String get() = asset.uri
        override val altText: String get() = asset.altText
    }
}

/** An edit's media: the gallery it leaves standing, in its order, and its clip's new face. */
data class EditGallery(
    val pictures: List<EditPicture> = emptyList(),
    /**
     * The face this edit set on its kept clip — on its way up or landed — or
     * null while the clip keeps the face it arrived with. Only a clip takes a
     * cover, so this is null on every other body.
     */
    val newCover: PickedAsset? = null,
    /**
     * What each upload the edit took is cut to, by its device uri — a post's
     * picture to the post's one shape, the clip's face to the clip's. What its
     * tile draws and what a retry sends again. A comment's pictures go up
     * whole, so they have none.
     */
    val crops: Map<String, CropSpec> = emptyMap(),
) {
    val size: Int get() = pictures.size

    val isEmpty: Boolean get() = pictures.isEmpty()

    /** The one clip a body holds, or null where the body is pictures or words. */
    val clip: EditPicture.Kept?
        get() = (pictures.singleOrNull() as? EditPicture.Kept)?.takeIf { it.asset.isVideo }

    /**
     * Whether the clip's face is one its author CHOSE — a still picked when it
     * was published, or the face this edit set. A taken frame is a still
     * nobody picked, so the cover field offers its door over it
     * (EditComposeVideo.md: "Add a cover GIVEN no cover was ever chosen, even
     * when a taken still exists"). Chosen-vs-taken is the stored authoring
     * fact, never a guess from the bytes.
     */
    val coverChosen: Boolean
        get() {
            val clip = clip ?: return false
            return newCover != null || (clip.asset.cover != null && !clip.asset.coverTaken)
        }

    /**
     * Every upload this edit took — its added pictures and its clip's new
     * face. What the gate counts: a picture the content already carried never
     * uploads again.
     */
    val uploads: List<PickedAsset>
        get() = pictures.filterIsInstance<EditPicture.Added>().map { it.asset } + listOfNotNull(newCover)

    /** The uploads still on their way — the ones a press of Sign waits for. */
    val uploadsPending: Int get() = uploads.count { it.upload !is AssetUpload.Done && it.upload !is AssetUpload.Failed }

    val uploadsFailed: Int get() = uploads.count { it.upload is AssetUpload.Failed }

    /** `Uploading N of M`: of the uploads the edit took, how many have landed. */
    val uploadsDone: Int get() = uploads.count { it.upload is AssetUpload.Done }

    /** How many carry a description — the counter's numerator. */
    val describedCount: Int get() = pictures.count { it.altText.isNotBlank() }

    /**
     * The gallery the edit leaves standing, or null while an upload it took is
     * unresolved — a placement names an asset id, so nothing is prepared until
     * every id exists.
     *
     * A kept placement re-states the poster it already named: an edit carries
     * the whole gallery, so a placement that came back without its cover would
     * be a new version that silently dropped the clip's face. A face this edit
     * set replaces it, chosen by definition. An added picture names none.
     */
    val claims: List<AttachmentClaim>?
        get() = pictures.map { picture ->
            when (picture) {
                is EditPicture.Kept -> {
                    val alt = picture.altText.trim().ifEmpty { null }
                    val face = newCover.takeIf { clip?.key == picture.key }
                    if (face != null) {
                        val id = (face.upload as? AssetUpload.Done)?.mediaId ?: return null
                        AttachmentClaim(picture.asset.id, alt, coverMediaId = id, coverTaken = false)
                    } else {
                        AttachmentClaim(picture.asset.id, alt, picture.asset.cover?.id, picture.asset.coverTaken)
                    }
                }
                is EditPicture.Added -> {
                    val id = picture.asset.mediaId ?: return null
                    AttachmentClaim(id, picture.asset.altText.trim().ifEmpty { null })
                }
            }
        }

    /**
     * The digests this device computed for the bytes it uploaded — the
     * ledger's own half. The kept placements' are read back by id at sign
     * time (`ledgerFor`), since no gallery read selects them.
     */
    val ownKnown: Map<String, KnownMedia>
        get() = uploads.mapNotNull { asset ->
            (asset.upload as? AssetUpload.Done)?.let { done -> done.known?.let { done.mediaId to it } }
        }.toMap()

    /** One upload's next step, wherever it stands — an added picture or the clip's new face. */
    fun withUpload(uri: String, upload: AssetUpload): EditGallery = copy(
        pictures = pictures.map { picture ->
            if (picture is EditPicture.Added && picture.asset.uri == uri) {
                EditPicture.Added(picture.asset.copy(upload = upload))
            } else {
                picture
            }
        },
        newCover = newCover?.let { if (it.uri == uri) it.copy(upload = upload) else it },
    )

    /** An added picture's own ratio, once the pipeline has read it. */
    fun withSourceRatio(uri: String, ratio: Float): EditGallery = copy(
        pictures = pictures.map { picture ->
            if (picture is EditPicture.Added && picture.asset.uri == uri) {
                EditPicture.Added(picture.asset.copy(sourceRatio = ratio))
            } else {
                picture
            }
        },
    )

    fun withAltText(key: String, text: String): EditGallery = copy(
        pictures = pictures.map { picture ->
            if (picture.key != key) {
                picture
            } else {
                when (picture) {
                    is EditPicture.Kept -> picture.copy(asset = picture.asset.copy(altText = text.ifBlank { null }))
                    is EditPicture.Added -> picture.copy(asset = picture.asset.copy(altText = text))
                }
            }
        },
    )

    /** A picture or the clip leaves; the clip takes its new face with it. */
    fun removing(key: String): EditGallery {
        val left = pictures.filterNot { it.key == key }
        val cover = newCover.takeIf { left.isNotEmpty() && clip?.key != key }
        return copy(
            pictures = left,
            newCover = cover,
            crops = crops.filterKeys { uri -> uri != key && (uri != newCover?.uri || cover != null) },
        )
    }

    /** The picture at [from] moves to [to]; the one now first is the cover. */
    fun moving(from: Int, to: Int): EditGallery {
        if (from == to || from !in pictures.indices || to !in pictures.indices) return this
        return copy(pictures = pictures.toMutableList().apply { add(to, removeAt(from)) })
    }

    /**
     * Adds pictures up to [cap]. Each caller screens the batch first, so
     * nothing past the cap reaches here to be dropped in silence.
     */
    fun adding(assets: List<PickedAsset>, cap: Int, framings: Map<String, CropSpec> = emptyMap()): EditGallery {
        val room = (cap - pictures.size).coerceAtLeast(0)
        val taken = assets.distinctBy { it.uri }.filterNot { asset -> pictures.any { it.key == asset.uri } }.take(room)
        return copy(
            pictures = pictures + taken.map { EditPicture.Added(it) },
            crops = crops + framings.filterKeys { uri -> taken.any { it.uri == uri } },
        )
    }

    /**
     * Sets, or with null takes back, the face this edit gives its clip, cut
     * to [crop]. Taking it back leaves the clip with the face it arrived with.
     */
    fun withNewCover(cover: PickedAsset?, crop: CropSpec? = null): EditGallery {
        if (clip == null) return this
        val without = crops.filterKeys { it != newCover?.uri }
        return copy(
            newCover = cover,
            crops = if (cover != null && crop != null) without + (cover.uri to crop) else without,
        )
    }

    /**
     * The gallery as the components draw it: a kept picture at its served
     * URL, an added one at its device uri wearing its upload's ring, mark and
     * the window it was cut to — a post's pictures are cut, a comment's whole.
     */
    fun pickedPictures(): List<PickedPicture> {
        val framingOf: (PickedAsset) -> CropFraming = { crops[it.uri].toFraming() }
        return pictures.map { picture ->
            when (picture) {
                is EditPicture.Kept -> PickedPicture(
                    item = picture.asset.toItem(),
                    described = picture.altText.isNotBlank(),
                    duration = picture.asset.durationMs?.let { formatDuration(it) },
                )
                is EditPicture.Added -> listOf(picture.asset).pickedPictures(framingOf).single()
            }
        }
    }

    companion object {
        /** The gallery the content arrived with, in its author's order. */
        fun of(attachments: List<MediaAssetView>): EditGallery =
            EditGallery(pictures = attachments.map { EditPicture.Kept(it) })
    }
}

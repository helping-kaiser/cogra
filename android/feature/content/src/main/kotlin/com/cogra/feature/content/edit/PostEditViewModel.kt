package com.cogra.feature.content.edit

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.BackingValue
import com.cogra.core.designsystem.attachmentLanding
import com.cogra.core.designsystem.hundredth
import com.cogra.core.designsystem.walkBackPick
import com.cogra.domain.ErrorCode
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.PostBacking
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.compose.DraftShape
import com.cogra.domain.content.isDescriptionTooLong
import com.cogra.domain.content.isPostBodyTooLong
import com.cogra.domain.content.isSensitiveReasonTooLong
import com.cogra.domain.content.isTitleTooLong
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.MediaProcessor
import com.cogra.domain.media.MediaRepository
import com.cogra.domain.media.VideoProcessor
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.repo.ReferenceRepository
import com.cogra.domain.repo.TopicRepository
import com.cogra.domain.search.SearchRepository
import com.cogra.domain.signing.ContentShape
import com.cogra.domain.signing.Expectation
import com.cogra.domain.signing.NoActorKeyException
import com.cogra.domain.signing.SentContent
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.signing.contentExpectation
import com.cogra.domain.signing.editExpectation
import com.cogra.domain.signing.ledgerFor
import com.cogra.domain.signing.postEdit
import com.cogra.domain.signing.wireReason
import com.cogra.domain.store.IdentityStore
import com.cogra.domain.topics.TagClaim
import com.cogra.feature.content.ReferenceCandidateRow
import com.cogra.feature.content.ReferencePickerEditor
import com.cogra.feature.content.ReferencePickerHandlers
import com.cogra.feature.content.ReferenceSectionState
import com.cogra.feature.content.SectionsEditor
import com.cogra.feature.content.TagPickerEditor
import com.cogra.feature.content.TagPickerHandlers
import com.cogra.feature.content.TagRow
import com.cogra.feature.content.TagSectionState
import com.cogra.feature.content.editableRow
import com.cogra.feature.content.wizard.AssetUpload
import com.cogra.feature.content.wizard.ComposeWizardState
import com.cogra.feature.content.wizard.PickedAsset
import com.cogra.feature.content.wizard.RefusedPick
import com.cogra.feature.content.wizard.UploadFailure
import com.cogra.feature.content.wizard.ratio
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * The post edit — `EditCompose`, `EditComposeVideo`, `EditWords`,
 * `EditPicked`, `EditActs` and `EditComposeUnchanged`: one screen, one batch.
 *
 * AN EDIT IS COMPLETE STATE (`PreparePostEditInput`): the record re-states
 * the title, the description, the body, the gallery and the author's own
 * mark, so each is carried from the read and sent back whether or not it was
 * touched. THE GUARD IS THE ACTS BATCH ([recordStaged]), never a byte
 * comparison. THE BODY IS WORDS OR MEDIA: the last picture or the clip
 * leaving flips it to words, the field empty and the standing description
 * dropped with the pictures (K8.1/D4; design/readme.md:8179-8181); pictures
 * taken into a words body replace its words (EditWords.md).
 */
data class PostEditUiState(
    val postId: String? = null,
    val loading: Boolean = false,
    val notFound: Boolean = false,
    val title: String = "",
    val description: String = "",
    val body: String = "",
    /** The license as signed — shown, locked; an edit has nothing to change it to. */
    val license: LicenseChoice = LicenseChoice.PublicDomain,
    /** The gallery the edit leaves standing, in its order — the first is the cover — and its clip's new face. */
    val gallery: EditGallery = EditGallery(),
    /**
     * THE POST'S ONE SHAPE (D17), which every picture the edit adds is cut
     * to: read off the pictures the post was published with, so the crop the
     * edit opens is locked to it (ComposeCrop.md). Null while the body holds
     * no picture to read it from — a words post or a clip — and then the crop
     * offers its chips and the first framing sets it.
     */
    val shape: DraftShape? = null,
    /** Files the add control turned away, standing on the media row until dismissed (EditCompose.md). */
    val refused: List<RefusedPick> = emptyList(),
    /** A crop raised over the edit — pictures on their way in, or a face for the clip. */
    val cropping: EditCrop? = null,
    val tagSection: TagSectionState = TagSectionState(),
    val referenceSection: ReferenceSectionState = ReferenceSectionState(),
    /** The author's own mark — never the OR a reader sees (round 4). */
    val sensitive: Boolean = false,
    val sensitiveReason: String? = null,
    /**
     * The edit record's own attachment pick — the value it ADDS to the
     * post's backing, never a value the backing is set to (EditPad.md;
     * PICK-IS-THE-EDGE, seam 233). 0.00 until the backing pad's Set moves
     * it, which changes the backing by exactly nothing.
     */
    val pick: Double = 0.0,
    /** What the open backing pad has under the finger — staged, not set, until Set. */
    val stagedPick: Double = 0.0,
    /** The backing pad stands parked over the edit (`EditPad`). */
    val backingPadOpen: Boolean = false,
    /**
     * The post's backing as its author's Publish bundle folds it, or null
     * when [ContentRepository.postBacking] served none or failed — the
     * readouts then draw it unread, and the walk-back stays greyed, rather
     * than guess.
     */
    val backing: PostBacking? = null,
    /**
     * Whether the edit record is in the batch. STICKY: set by the first
     * change to a field the record carries and never cleared by typing it
     * back (EditComposeUnchanged.md:3).
     */
    val recordStaged: Boolean = false,
    /** `Discard the changes?` stands over the edit: leaving was asked with an act in the batch. */
    val confirmingDiscard: Boolean = false,
    val sensitiveOpen: Boolean = false,
    val actsOpen: Boolean = false,
    val pickedOpen: Boolean = false,
    /** The picture whose describe sheet is up, by its place in the gallery. */
    val describingIndex: Int? = null,
    /**
     * Sign the edit was pressed while the edit's uploads ran: the press is
     * HELD, and signs the moment the last lands with no second press; a
     * failed upload drops it (EditCompose.md; ComposeSealUploading.md).
     */
    val heldPress: Boolean = false,
    val submitting: Boolean = false,
    /** The signing has gone 5s unanswered — the slow line stands under the count. */
    val slow: Boolean = false,
    /** The prepared batch was not the one the foot read — the held press dropped. */
    val countChanged: Boolean = false,
    /** The write rule refused: `You can't sign right now` takes the commit's place. */
    val writeRuleRefused: Boolean = false,
    /** The key is not on this device: the key-absent seal stands, nothing staged. */
    val keyAbsent: Boolean = false,
    val refusal: String? = null,
    val signingFailed: Boolean = false,
    val transportFailed: Boolean = false,
    /** One-shot: the edit signed; the caller returns to the post. */
    val saved: Boolean = false,
) {
    /** Whether the body is media: the gallery holds anything. */
    val mediaBody: Boolean get() = !gallery.isEmpty

    /** Whether the body is one clip — `EditComposeVideo`'s anatomy. */
    val clipBody: Boolean get() = gallery.clip != null

    /** The batch, every kind a row counted in the records it signs (`EditActs`). */
    val actRows: List<EditActRow>
        get() = editActRows(
            recordStaged = recordStaged,
            recordName = title.trim().ifEmpty { body.trim().take(RECORD_NAME_CHARS) }.ifEmpty { "The post" },
            tags = tagSection,
            references = referenceSection,
        )

    /** What one signature commits, in records — the guard reads this and nothing else. */
    val signedActionCount: Int get() = actRows.actCount()

    /**
     * Whether leaving loses anything: the same acts-batch signal the sign
     * guard reads. The edit keeps no draft, so a batch holding an act is
     * asked before it goes, and an empty one leaves at once (DiscardConfirm.md).
     */
    val holdsAnAct: Boolean get() = signedActionCount > 0

    val titleTooLong: Boolean get() = isTitleTooLong(title)

    /** A description stands beside media only; the words edit carries none. */
    val descriptionTooLong: Boolean get() = mediaBody && isDescriptionTooLong(description)

    /** The words body's own cap — a media post's body is never this field. */
    val bodyTooLong: Boolean get() = !mediaBody && isPostBodyTooLong(body)

    val sensitiveReasonTooLong: Boolean
        get() = sensitive && isSensitiveReasonTooLong(sensitiveReason.orEmpty())

    /** A field past its cap holds the sign the way an empty batch does. */
    val overCap: Boolean
        get() = titleTooLong || descriptionTooLong || bodyTooLong || sensitiveReasonTooLong

    /**
     * The commit was pressed and has not answered — signing, or held at the
     * upload gate. The 200ms label swap and the 5s slow line count from it,
     * and the ways out refuse a press while it stands (EditCompose.md).
     */
    val pressed: Boolean get() = submitting || heldPress

    /**
     * Whether Sign the edit answers a press. Inert, never hidden, at an
     * empty batch (EditComposeUnchanged.md:5); ENABLED while an upload runs —
     * a press there is held — and disabled only while the gate shows its
     * fault reading (EditCompose.md).
     */
    val canSign: Boolean
        get() = !loading && !pressed && signedActionCount > 0 && !overCap && gallery.uploadsFailed == 0

    val anySheetOpen: Boolean get() = sensitiveOpen || actsOpen || pickedOpen || describingIndex != null

    /** `Current backing` — the bundle's net now, or unread. */
    val backingCurrent: BackingValue get() = backing?.let { BackingValue.Read(it.net) } ?: BackingValue.Unread

    /** The raw sum `Backing after` and the walk-back fold from, or unread. */
    val backingRaw: BackingValue get() = backing?.let { BackingValue.Read(it.rawSum) } ?: BackingValue.Unread

    /**
     * The `Your backing` row: where the backing stands WITH the edit — the
     * fold of the raw sum plus the set pick, which at an unmoved pick is
     * the backing as it stands (EditCompose.md). Unread while unserved.
     */
    val backingWithEdit: BackingValue
        get() = backing?.let { BackingValue.Read(attachmentLanding(it.rawSum, pick).landing) } ?: BackingValue.Unread

    /**
     * `Walk it all back` answers only while the backing nets other than
     * 0.00 — greyed once it already does (net 0 iff raw sum 0), and while
     * nothing served the backing, since the walk-back aims at a result
     * nobody read.
     */
    val canWalkBack: Boolean get() = backing != null && backing.net != 0.0

    companion object {
        /** How much of the words the acts card's Edit row names when there is no title. */
        const val RECORD_NAME_CHARS = 60

        /** A post carries up to ten pictures (copy-voice, `+ Add pictures · 2 of 10`). */
        const val MAX_PICTURES = ComposeWizardState.MAX_POST_ASSETS
    }
}

@HiltViewModel
class PostEditViewModel @Inject constructor(
    private val content: ContentRepository,
    private val topics: TopicRepository,
    private val references: ReferenceRepository,
    private val signer: WriteSigner,
    private val identity: IdentityStore,
    private val media: MediaRepository,
    processor: MediaProcessor,
    video: VideoProcessor,
    /** The one search read the tag picker's index rides (`#prefix` over topics). */
    search: SearchRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(PostEditUiState())
    val state = _state.asStateFlow()

    private var slowTimer: Job? = null

    private val sections = SectionsEditor(
        scope = viewModelScope,
        references = references,
        state = _state,
        tagsOf = { it.tagSection },
        withTags = { state, tags -> state.copy(tagSection = tags) },
        referencesOf = { it.referenceSection },
        withReferences = { state, refs -> state.copy(referenceSection = refs) },
    )

    /** `+ Add a tag`: the tag picker in the edit's place (TagPicker), its picks staged straight into the edit. */
    val tagPicker: TagPickerHandlers = TagPickerEditor(
        scope = viewModelScope,
        search = search,
        state = _state,
        tagsOf = { it.tagSection },
        withTags = { state, tags -> state.copy(tagSection = tags) },
    )

    /** `+ Cite something`: the citation picker in the edit's place (ReferencePicker). */
    val referencePicker: ReferencePickerHandlers = ReferencePickerEditor(
        scope = viewModelScope,
        references = references,
        state = _state,
        referencesOf = { it.referenceSection },
        withReferences = { state, refs -> state.copy(referenceSection = refs) },
    )

    private val uploads = EditMediaEditor(
        scope = viewModelScope,
        state = _state,
        processor = processor,
        media = media,
        video = video,
        galleryOf = { it.gallery },
        withGallery = { state, gallery -> state.copy(gallery = gallery) },
    )

    /** Route entry: reads the post the edit opens on. */
    fun start(postId: String) {
        if (_state.value.postId == postId) return
        _state.update { it.copy(postId = postId, loading = true) }
        viewModelScope.launch {
            when (val outcome = content.post(postId, commentsFirst = 1, commentsAfter = null)) {
                is Outcome.Success -> {
                    val post = outcome.value?.post
                        ?: return@launch _state.update { it.copy(loading = false, notFound = true) }
                    val tags = post.topics.map { claim ->
                        TagRow(
                            name = claim.hashtag.name.value.orEmpty(),
                            relevance = claim.relevance,
                            confidence = claim.confidence,
                        )
                    }
                    // A citation this instance could not type is
                    // unaddressable — no write could name it — so it stays
                    // out of the editable section and its absence is never
                    // read as a withdrawal.
                    val refs = post.references.mapNotNull { it.editableRow() }
                    // The mark is read before the edit opens, never
                    // defaulted: an edit prepared without it unmarks the
                    // post, so a mark this read could not confirm is a mark
                    // no edit may be built on.
                    val mark = when (val marked = content.postSelfMark(postId)) {
                        is Outcome.Success -> marked.value
                        is Outcome.Refused -> return@launch _state.update {
                            it.copy(loading = false, notFound = true)
                        }
                        is Outcome.Failed -> return@launch _state.update {
                            it.copy(loading = false, transportFailed = true)
                        }
                    }
                    // The backing is read beside the post, never in its way:
                    // a read that fails or serves nothing leaves it unread,
                    // and the edit stands without it.
                    val backing = (content.postBacking(postId) as? Outcome.Success)?.value
                    _state.update {
                        it.copy(
                            loading = false,
                            backing = backing,
                            title = post.title.value.orEmpty(),
                            description = post.description.value.orEmpty(),
                            body = post.content.value.orEmpty(),
                            license = post.license,
                            gallery = EditGallery.of(post.attachments),
                            shape = nearestDraftShape(post.attachments.firstOrNull { a -> !a.isVideo }?.aspectRatio),
                            sensitive = mark?.sensitive ?: false,
                            sensitiveReason = mark?.reason,
                            tagSection = TagSectionState(tags = tags, loaded = tags),
                            referenceSection = ReferenceSectionState(references = refs, loaded = refs),
                        )
                    }
                }
                is Outcome.Refused -> _state.update { it.copy(loading = false, notFound = true) }
                is Outcome.Failed -> _state.update { it.copy(loading = false, transportFailed = true) }
            }
        }
    }

    fun onTitleChange(v: String) = _state.update { it.copy(title = v, recordStaged = true) }

    fun onDescriptionChange(v: String) = _state.update { it.copy(description = v, recordStaged = true) }

    fun onBodyChange(v: String) = _state.update { it.copy(body = v, recordStaged = true) }

    fun onSavedConsumed() = _state.update { it.copy(saved = false) }

    /**
     * The back arrow or the X — the edit's, or a crop's raised over it. True
     * when the caller may leave now: the batch is empty, and nothing is kept
     * or discarded. A batch holding an act raises `Discard the changes?`
     * instead, and nothing is discarded unasked (EditCompose.md,
     * DiscardConfirm.md, CoverCrop.md). Refused while the signing holds the
     * reader.
     */
    fun onLeaveRequested(): Boolean {
        val s = _state.value
        if (s.pressed) return false
        if (!s.holdsAnAct) return true
        _state.update { it.copy(confirmingDiscard = true) }
        return false
    }

    /** `Keep writing` — the dialog closes onto the edit as it was. */
    fun onKeepWriting() = _state.update { it.copy(confirmingDiscard = false) }

    fun onOpenSensitive() = _state.update { it.copy(sensitiveOpen = true) }

    fun onOpenActs() = _state.update { it.copy(actsOpen = true) }

    fun onOpenPicked() = _state.update { it.copy(pickedOpen = true) }

    /** Every drawer closes onto the edit, and whatever it applied stands (EditPicked.md). */
    fun onCloseSheet() =
        _state.update { it.copy(sensitiveOpen = false, actsOpen = false, pickedOpen = false, describingIndex = null) }

    /** Unmarking drops the reason with it: the contract refuses a reason without the mark. */
    fun onSensitiveChange(marked: Boolean) = _state.update {
        it.copy(sensitive = marked, sensitiveReason = if (marked) it.sensitiveReason else null, recordStaged = true)
    }

    /** A reason only takes input while marked, so only then does it stage the record. */
    fun onSensitiveReasonChange(reason: String) = _state.update {
        it.copy(sensitiveReason = reason.ifBlank { null }, recordStaged = it.recordStaged || it.sensitive)
    }

    /** `Not now` under the write rule's notice: the notice goes, the edit stands with the changes as they were. */
    fun onWriteRuleNotNow() = _state.update { it.copy(writeRuleRefused = false) }

    // -- The backing (`EditPad`) --

    /** `Adjust` on the Your backing row: the pad opens at the edit's pick, staging nothing. */
    fun onOpenBackingPad() = _state.update { it.copy(backingPadOpen = true, stagedPick = it.pick) }

    /** A drag on the strip: staged, never committed. */
    fun onBackingPickChange(value: Double) = _state.update { it.copy(stagedPick = value) }

    /**
     * `Walk it all back`: the pick parks at the raw sum's opposite, clipped
     * to the strip — nothing staged, no dialog. Does nothing while greyed.
     */
    fun onWalkBack() = _state.update { st ->
        val backing = st.backing
        if (backing == null || !st.canWalkBack) st else st.copy(stagedPick = walkBackPick(backing.rawSum))
    }

    /**
     * Set: the pad closes and the edit's record carries the pick. A moved
     * pick fills the batch on its own — a content-identical version whose
     * only change is the pick. At 0.00 no record is ADDED to the batch and
     * no dialog asks: an inert pick on an edit is a perfectly ordinary one
     * (EditPad.md). The count never moves for the pick itself.
     */
    fun onSetBacking() = _state.update {
        // The pick is a hundredth (EditPad.md), so one that reads 0.00 IS 0
        // and adds no record — a float's 0.004 never slips one in.
        val pick = hundredth(it.stagedPick)
        it.copy(
            pick = pick,
            recordStaged = it.recordStaged || pick != 0.0,
            backingPadOpen = false,
        )
    }

    /** Cancel, the scrim, the system's Back: the pad closes and the pick is what it was. */
    fun onCancelBackingPad() = _state.update { it.copy(backingPadOpen = false, stagedPick = it.pick) }

    // -- The pictures (`EditPicked`) --

    /** Moves the picture at [from] to [to]; the one now first is the cover. */
    fun onMovePicture(from: Int, to: Int) = _state.update {
        val moved = it.gallery.moving(from, to)
        if (moved == it.gallery) it else it.copy(gallery = moved, recordStaged = true)
    }

    /**
     * A picture or the clip leaves the edit's batch, its upload with it. The
     * LAST one leaving flips the body to words: the sheet closes onto the
     * words edit, the field arrives empty, the description goes with the
     * pictures it stood beside, and the post's shape with them — never
     * refused (EditPicked.md, EditWords.md; K8.1/D4).
     */
    fun onRemovePicture(index: Int) {
        val picture = _state.value.gallery.pictures.getOrNull(index) ?: return
        uploads.cancel(picture.key)
        _state.value.gallery.newCover?.takeIf { _state.value.gallery.clip?.key == picture.key }?.let {
            uploads.cancel(it.uri)
        }
        _state.update {
            val left = it.gallery.removing(picture.key)
            val flipped = left.isEmpty
            it.copy(
                gallery = left,
                body = if (flipped) "" else it.body,
                description = if (flipped) "" else it.description,
                shape = if (flipped) null else it.shape,
                pickedOpen = it.pickedOpen && !flipped,
                describingIndex = null,
                recordStaged = true,
            )
        }
    }

    fun onDescribePicture(index: Int) = _state.update { it.copy(describingIndex = index) }

    fun onAltTextChange(index: Int, text: String) = _state.update {
        val key = it.gallery.pictures.getOrNull(index)?.key ?: return@update it
        it.copy(gallery = it.gallery.withAltText(key, text), recordStaged = true)
    }

    // -- The add paths (`+ Add pictures · N of 10`, `+ Add pictures or a video`) --

    /**
     * What the device's own picker handed back — NEVER a pick stage
     * (EditCompose.md). The batch is screened file by file against the body
     * it would join — the cap of ten, the formats nothing here reads, a clip
     * the edit cannot take yet — and what is refused says why on the media
     * row. What is taken passes the crop: locked to the post's one shape, or,
     * on a words post, with the chips, the first framing setting the shape.
     */
    fun onAddPictures(uris: List<String>) {
        if (uris.isEmpty()) return
        viewModelScope.launch {
            val screened = uploads.screen(
                uris = uris,
                cap = PostEditUiState.MAX_PICTURES,
                overCap = UploadFailure.POST_PICTURE_COUNT,
                // Only the words edit's `+ Add pictures or a video` can bring a clip back.
                mayHoldVideo = !_state.value.mediaBody,
            )
            _state.update { st ->
                st.copy(
                    refused = st.refused + screened.refused,
                    cropping = screened.accepted.takeIf { it.isNotEmpty() }?.let { picked ->
                        EditCrop.Pictures(
                            picked = picked,
                            shape = st.shape ?: DraftShape.Tall,
                            locked = st.shape != null,
                        )
                    } ?: st.cropping,
                )
            }
        }
    }

    /** `Remove it` on a refused file: its line leaves the row. */
    fun onDismissRefusal(index: Int) = _state.update {
        it.copy(refused = it.refused.filterIndexed { i, _ -> i != index })
    }

    /** The filmstrip: the crop moves to another of the pictures on their way in. */
    fun onFrameAsset(index: Int) = onPicturesCrop { it.copy(framingIndex = index) }

    /** A words post's crop sets the post's shape with its chips. */
    fun onCropShapeChange(shape: DraftShape) = onPicturesCrop {
        if (it.locked) it else it.copy(shape = shape, crops = emptyMap())
    }

    /** The framings, handed up as they move, so Next commits what the author last saw. */
    fun onCropsChanged(crops: Map<String, CropSpec>) = onPicturesCrop { it.copy(crops = crops) }

    private fun onPicturesCrop(block: (EditCrop.Pictures) -> EditCrop.Pictures) = _state.update { st ->
        val crop = st.cropping as? EditCrop.Pictures ?: return@update st
        st.copy(cropping = block(crop))
    }

    /** The crop's back arrow (and the system's Back): the edit comes back as it was left, the picture unused. */
    fun onCropBack() = _state.update { it.copy(cropping = null) }

    /**
     * The crop's Next: the edit comes back with the pictures on its row, cut
     * to the post's shape, and their cropped exports start uploading at once
     * (ComposeCrop.md). Pictures taken into a words body replace its words
     * (EditWords.md: "the words they replace are gone from the body").
     */
    fun onCropDone() {
        val crop = _state.value.cropping as? EditCrop.Pictures ?: return
        val framings = crop.picked.associate { asset ->
            asset.uri to (crop.crops[asset.uri] ?: CropSpec(targetRatio = crop.shape.ratio()))
        }
        _state.update { st ->
            val wasWords = !st.mediaBody
            st.copy(
                gallery = st.gallery.adding(crop.picked, PostEditUiState.MAX_PICTURES, framings),
                body = if (wasWords) "" else st.body,
                shape = st.shape ?: crop.shape,
                cropping = null,
                recordStaged = true,
            )
        }
        crop.picked.forEach { uploads.upload(it.uri) }
    }

    // -- The clip's cover (`EditComposeVideo`, `CoverCrop`) --

    /**
     * `Add a cover` / `Change the cover`: the device's own picker handed back
     * a picture — NEVER the clip's frames — and it passes the cover's crop,
     * locked to the clip's own shape, before it lands (EditComposeVideo.md).
     */
    fun onPickCover(uri: String) = _state.update { st ->
        val clip = st.gallery.clip ?: return@update st
        st.copy(cropping = EditCrop.Cover(PickedAsset(uri), ratio = clip.asset.aspectRatio))
    }

    fun onCoverCropChanged(crop: CropSpec) = _state.update { st ->
        val cover = st.cropping as? EditCrop.Cover ?: return@update st
        st.copy(cropping = cover.copy(crop = crop))
    }

    /**
     * The cover's crop Next: the cover is set, the cover row that asked for
     * it comes back, and only the cropped export leaves the device
     * (CoverCrop.md). A face set is a change to the record — the clip's
     * placement names it at the signing.
     */
    fun onCoverCropDone() {
        val crop = _state.value.cropping as? EditCrop.Cover ?: return
        _state.value.gallery.newCover?.let { uploads.cancel(it.uri) }
        val spec = crop.crop ?: CropSpec(targetRatio = crop.ratio)
        _state.update {
            it.copy(gallery = it.gallery.withNewCover(crop.asset, spec), cropping = null, recordStaged = true)
        }
        uploads.upload(crop.asset.uri)
    }

    /**
     * `Remove it` under the cover row: the new face leaves the batch and the
     * field reads as it stood before the edit. Taking the face back leaves
     * the record as staged as it was — the guard is the batch, never a byte
     * comparison.
     */
    fun onRemoveCover() {
        _state.value.gallery.newCover?.let { uploads.cancel(it.uri) }
        _state.update { it.copy(gallery = it.gallery.withNewCover(null)) }
    }

    // -- The uploads' faults --

    /** `Retry`, under the row or in the gate: every failed upload tries again — and never signs on its own. */
    fun onRetryUploads() = uploads.retryFailed()

    /** `Remove it` / `Remove them` under the picked row: every failed picture leaves the batch. */
    fun onRemoveFailed() {
        val failed = _state.value.gallery.pictures.filter {
            it is EditPicture.Added && it.asset.upload is AssetUpload.Failed
        }
        failed.forEach { picture ->
            val index = _state.value.gallery.pictures.indexOfFirst { it.key == picture.key }
            if (index >= 0) onRemovePicture(index)
        }
    }

    // -- Tags and citations: their own acts, beside the record --

    fun onTagInputChange(v: String) = sections.onTagInputChange(v)

    fun onAddTag() = sections.onAddTag()

    fun onRemoveTag(name: String) = sections.onRemoveTag(name)

    fun onTuneTag(name: String) = sections.onTuneTag(name)

    fun onDoneTuningTag() = sections.onDoneTuningTag()

    fun onTagRelevanceChange(name: String, value: Double) = sections.onTagRelevanceChange(name, value)

    fun onTagConfidenceChange(name: String, value: Double) = sections.onTagConfidenceChange(name, value)

    /** Undo on a tag's `Withdrawn:` line: it returns as it stood, and the withdrawal unstages. */
    fun onUndoTagWithdrawal(name: String) = sections.updateTags { it.undoWithdrawal(name) }

    fun onOpenFinder() = sections.onOpenFinder()

    fun onCloseFinder() = sections.onCloseFinder()

    fun onFinderQueryChange(query: String) = sections.onFinderQueryChange(query)

    fun onPickReference(row: ReferenceCandidateRow) = sections.onPickReference(row)

    fun onRemoveReference(targetId: String) = sections.onRemoveReference(targetId)

    fun onTuneReference(targetId: String) = sections.onTuneReference(targetId)

    fun onDoneTuningReference() = sections.onDoneTuningReference()

    fun onReferenceRelevanceChange(targetId: String, value: Double) =
        sections.onReferenceRelevanceChange(targetId, value)

    fun onReferenceSupportChange(targetId: String, value: Double) =
        sections.onReferenceSupportChange(targetId, value)

    /** Undo on a citation's `Withdrawn:` line, the same way. */
    fun onUndoReferenceWithdrawal(targetId: String) = sections.updateReferences { it.undoWithdrawal(targetId) }

    // -- Signing --

    /**
     * Sign the edit. Sign is the confirmation: the count is said on the foot
     * and in the acts sheet, and no dialog asks again (EditActs.jsx). A press
     * while the signing is out — or held — is refused.
     *
     * NOTHING SIGNS BEFORE THE LAST BYTE LANDS (EditCompose.md): a press
     * while the edit's uploads run is HELD, and signs the moment the last
     * one lands with no second press; an upload that fails drops it, and
     * nothing signs until Sign the edit is pressed again.
     */
    fun onSign() {
        if (!_state.value.canSign) return
        beginPress()
        viewModelScope.launch {
            // THE KEY-ABSENT SEAL: nothing is staged or signed without the key.
            if (identity.actorSeed() == null) return@launch end { it.copy(keyAbsent = true) }
            val settled = _state.first { it.gallery.uploadsFailed > 0 || it.gallery.claims != null }
            // A failure drops the held press: the gate takes its fault
            // reading, the commit reads itself again, the ways out answer.
            if (settled.gallery.uploadsFailed > 0) return@launch end { it }
            _state.update { it.copy(heldPress = false, submitting = true) }
            val s = _state.value
            val postId = s.postId ?: return@launch end { it }
            val expected = expectation(s, postId) ?: return@launch
            val writes = prepareBatch(s, postId) ?: return@launch
            // THE COUNT THE SIGNING PREPARED IS THE ONE THE FOOT READ, or
            // nothing is signed: the held press drops (EditCompose.md).
            if (writes.size != s.signedActionCount) return@launch end { it.copy(countChanged = true) }
            sign(writes, expected)
        }
    }

    /**
     * The acts card as the intent check reads it (Intent.kt): the L1 ids of
     * the post and of every cited node the edit touches are read first,
     * before anything is staged. Null once the read failed — already
     * reported.
     */
    private suspend fun expectation(s: PostEditUiState, postId: String): Expectation? {
        val refs = s.referenceSection
        val ids = listOf(postId) + (refs.adds + refs.removes).map { it.targetId }
        val graphIds = when (val read = content.graphIds(ids)) {
            is Outcome.Success -> read.value
            is Outcome.Refused -> return null.also { refuse(read.errors) }
            is Outcome.Failed -> return null.also { failTransport() }
        }
        val postGraphId = graphIds.getValue(postId)
        // The record's payload is complete state: every placement it keeps
        // is held to the digests of the asset it names, read back by id,
        // since no gallery read selects them; the bytes this edit uploaded
        // are held to the digests this device computed (PayloadExpectation.kt).
        val record = if (s.recordStaged) {
            val sent = sentContent(s)
            val ledger = when (val read = media.ledgerFor(sent.attachments, s.gallery.ownKnown)) {
                is Outcome.Success -> read.value
                is Outcome.Refused -> return null.also { refuse(read.errors) }
                is Outcome.Failed -> return null.also { failTransport() }
            }
            postEdit(postGraphId, contentExpectation(postId, sent, ContentShape.POST, ledger), s.pick)
        } else {
            null
        }
        return editExpectation(
            nodeGraphId = postGraphId,
            record = record,
            tags = s.tagSection.adds.map { it.toClaim() } +
                s.tagSection.removes.map { TagClaim(it.name, WITHDRAWN, WITHDRAWN) },
            references = refs.adds.map { it.toClaim() },
            withdrawals = refs.removes.map { it.toWithdrawn() },
            graphIds = graphIds,
        )
    }

    /** The press: errors clear, the press holds, and past 5s the slow line stands. */
    private fun beginPress() {
        _state.update {
            it.copy(
                heldPress = true,
                slow = false,
                countChanged = false,
                refusal = null,
                signingFailed = false,
                transportFailed = false,
                tagSection = it.tagSection.withoutErrors(),
                referenceSection = it.referenceSection.withoutErrors(),
            )
        }
        slowTimer?.cancel()
        slowTimer = viewModelScope.launch {
            delay(SLOW_SIGNING_MS)
            _state.update { it.copy(slow = it.pressed) }
        }
    }

    /**
     * Prepares EVERY act before signing any: a refusal on the third tag must
     * not leave the first two signed, and staged writes nobody signs are the
     * server's own GC to collect. Null once a prepare refused or failed —
     * already reported.
     */
    private suspend fun prepareBatch(s: PostEditUiState, postId: String): List<PreparedWriteView>? {
        val writes = mutableListOf<PreparedWriteView>()
        val record = if (s.recordStaged) prepareRecord(s, postId) ?: return null else emptyList()
        writes += record
        for (row in s.tagSection.adds) {
            val staged = staged(topics.prepareTag(postId, row.name, row.relevance, row.confidence)) {
                refuseTag(row.name, it)
            } ?: return null
            writes += staged
        }
        for (row in s.tagSection.removes) {
            val staged = staged(topics.prepareTag(postId, row.name, WITHDRAWN, WITHDRAWN)) {
                refuseTag(row.name, it)
            } ?: return null
            writes += staged
        }
        for (row in s.referenceSection.adds) {
            val staged = staged(references.prepareReference(postId, row.targetId, row.relevance, row.support)) {
                refuseReference(row.targetId, it)
            } ?: return null
            writes += staged
        }
        for (row in s.referenceSection.removes) {
            val staged = staged(references.prepareReferenceWithdrawal(postId, row.targetId)) {
                refuseReference(row.targetId, it)
            } ?: return null
            writes += staged
        }
        return writes
    }

    /**
     * The edit record's request: the post's complete new content state —
     * read by the prepare and by the payload expectation alike.
     */
    private fun sentContent(s: PostEditUiState): SentContent = SentContent(
        title = s.title.ifBlank { null },
        // The words path carries no description (K8.1/D4).
        description = s.description.ifBlank { null }.takeIf { s.mediaBody },
        // Words XOR media: a media post sends no words at all.
        content = s.body.takeIf { !s.mediaBody },
        // The whole gallery the edit leaves standing, in its order, each
        // placement naming the cover it keeps or the face the edit set. The
        // press is held until every upload landed, so every id exists.
        attachments = s.gallery.claims.orEmpty(),
        sensitive = s.sensitive,
        sensitiveReason = wireReason(s.sensitive, s.sensitiveReason),
    )

    /** The edit record: the post's complete new content state. */
    private suspend fun prepareRecord(s: PostEditUiState, postId: String): List<PreparedWriteView>? {
        val sent = sentContent(s)
        val outcome = content.preparePostEdit(
            id = postId,
            title = sent.title,
            description = sent.description,
            content = sent.content,
            attachments = sent.attachments,
            sensitive = sent.sensitive,
            sensitiveReason = sent.sensitiveReason,
            pDirected = s.pick,
        )
        return when (outcome) {
            is Outcome.Success -> outcome.value.writes
            is Outcome.Refused -> null.also { refuse(outcome.errors) }
            is Outcome.Failed -> null.also { failTransport() }
        }
    }

    /** One standalone act's prepare: its writes, or null once its refusal or fault is reported. */
    private fun staged(
        outcome: Outcome<List<PreparedWriteView>>,
        onRefused: (List<UserError>) -> Unit,
    ): List<PreparedWriteView>? = when (outcome) {
        is Outcome.Success -> outcome.value
        is Outcome.Refused -> null.also { onRefused(outcome.errors) }
        is Outcome.Failed -> null.also { failTransport() }
    }

    private suspend fun sign(writes: List<PreparedWriteView>, expected: Expectation) {
        val results = try {
            signer.sign(writes, expected)
        } catch (_: NoActorKeyException) {
            return end { it.copy(keyAbsent = true) }
        }
        if (results.all { it is WriteResult.Done }) {
            end { it.copy(saved = true) }
        } else {
            end { it.copy(signingFailed = true) }
        }
    }

    /** The press answered, or dropped: it is released, and the slow line goes. */
    private fun end(block: (PostEditUiState) -> PostEditUiState) {
        slowTimer?.cancel()
        _state.update { block(it.copy(submitting = false, heldPress = false, slow = false)) }
    }

    /**
     * A refusal from the edit record: the write rule's takes the commit's
     * place; anything else says its piece once (F2).
     */
    private fun refuse(errors: List<UserError>) = end { st ->
        if (errors.any { it.code == ErrorCode.WRITE_RULE_FAILED }) {
            st.copy(writeRuleRefused = true)
        } else {
            st.copy(refusal = errors.firstOrNull()?.message)
        }
    }

    /** A standalone Tag's refusal lands on its chip; a withdrawal's, on its own. */
    private fun refuseTag(name: String, errors: List<UserError>) = end { st ->
        if (errors.any { it.code == ErrorCode.WRITE_RULE_FAILED }) return@end st.copy(writeRuleRefused = true)
        val (section, unplaced) = st.tagSection.withError(name, errors.firstOrNull()?.message)
        st.copy(tagSection = section, refusal = unplaced)
    }

    /** A standalone Reference's refusal lands on its chip; a withdrawal's, on its own. */
    private fun refuseReference(targetId: String, errors: List<UserError>) = end { st ->
        if (errors.any { it.code == ErrorCode.WRITE_RULE_FAILED }) return@end st.copy(writeRuleRefused = true)
        val (section, unplaced) = st.referenceSection.withError(targetId, errors.firstOrNull()?.message)
        st.copy(referenceSection = section, refusal = unplaced)
    }

    private fun failTransport() = end { it.copy(transportFailed = true) }

    companion object {
        /** A tag withdrawal is a Tag act at (0,0): both parameters at this value (hashtag.md §4). */
        const val WITHDRAWN = 0.0

        /** How long a signing may go unanswered before the foot says the network is slow. */
        const val SLOW_SIGNING_MS = 5_000L
    }
}

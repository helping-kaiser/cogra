package com.cogra.feature.content.reply

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.domain.AttachmentClaim
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.UserError
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.MediaProcessor
import com.cogra.domain.media.MediaRepository
import com.cogra.domain.media.ProcessedVideo
import com.cogra.domain.media.UploadProgress
import com.cogra.domain.media.VideoInfo
import com.cogra.domain.media.VideoProcessor
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.repo.ReferenceRepository
import com.cogra.domain.signing.NoActorKeyException
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.feature.content.ReferenceCandidateRow
import com.cogra.feature.content.ReferenceFinderState
import com.cogra.feature.content.ReferenceSectionState
import com.cogra.feature.content.TagSectionState
import com.cogra.feature.content.candidateRows
import com.cogra.feature.content.referenceFieldIndex
import com.cogra.feature.content.tagFieldIndex
import com.cogra.feature.content.wizard.AssetUpload
import com.cogra.feature.content.wizard.CoverChoice
import com.cogra.feature.content.wizard.RefusedPick
import com.cogra.feature.content.wizard.attachmentFieldIndex
import java.io.File
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * The reply wizard.
 *
 * The post wizard's shape without its draft store: comments keep no
 * drafts (jakob 2026-09-01), so there is nothing to persist, nothing to
 * offer back, and leaving is simply leaving.
 *
 * Uploads start **at pick** rather than after a crop stage, because
 * comment pictures never crop (design/readme.md §The media slice) —
 * which is also why a picture is uploaded whole, at its own ratio.
 */
@HiltViewModel
class ReplyWizardViewModel @Inject constructor(
    private val content: ContentRepository,
    private val references: ReferenceRepository,
    private val media: MediaRepository,
    private val processor: MediaProcessor,
    private val video: VideoProcessor,
    private val signer: WriteSigner,
) : ViewModel() {

    private val _state = MutableStateFlow(ReplyWizardState())
    val state: StateFlow<ReplyWizardState> = _state.asStateFlow()

    private val uploads = mutableMapOf<String, Job>()

    /**
     * The re-encoded clip waiting to be sent, once there is one.
     *
     * It is held here rather than in the state because it is a file on
     * disk, not something a screen reads: the state says how far the
     * transcode got, and this is what the upload then sends.
     */
    private var transcoded: ProcessedVideo? = null

    /**
     * The resumable session the clip is going up on, once there is one.
     *
     * Held so a discarded reply can give it back: until an upload is
     * completed or aborted the store keeps every part it was handed.
     */
    private var uploadSession: String? = null
    private var finderJob: Job? = null
    private var started = false

    /** Pins what is being answered. Idempotent: the route calls it on every entry. */
    fun start(target: ReplyTarget) {
        if (started) return
        started = true
        _state.update { it.copy(target = target) }
    }

    // -- The composer (`ReplyCompose` / `ReplyPictures`) --

    fun onBodyChange(value: String) = _state.update { it.copy(body = value) }

    /**
     * A pick from the platform's own picker — comments have no pick
     * stage. Reading the asset's ratio is what lets it be shown and
     * uploaded whole.
     */
    fun onPicked(uri: String) {
        if (_state.value.picked.any { it.uri == uri }) return
        viewModelScope.launch {
            // What kind of file this is decides everything after it, and
            // the platform picker hands over a bare URI — so it is asked
            // before anything is added. A header read, not a decode.
            val clip = video.info(uri)
            if (clip != null) {
                acceptClip(uri, clip)
                return@launch
            }
            if (!refusePicture(uri)) return@launch
            if (!_state.value.canAddPicture) return@launch
            _state.update { it.addPick(uri) }
            val ratio = processor.aspectRatio(uri)
            if (ratio != null) _state.update { it.withSourceRatio(uri, ratio) }
            upload(uri, ratio)
        }
    }

    /**
     * Weighs a picture and reads it, refusing it where it was offered.
     *
     * Answers whether the file may join the composer. A refusal is drawn
     * on the composer that asked for it (`ReplyMediaErrors`) rather than
     * in a dialog or a snackbar — errors sit on the surface they
     * happened on.
     */
    private suspend fun refusePicture(uri: String): Boolean {
        if (processor.aspectRatio(uri) == null) {
            _state.update { it.copy(refused = it.refused + RefusedPick(null, UNREADABLE_FILE)) }
            return false
        }
        val size = processor.sizeBytes(uri)
        if (size != null && size > MAX_PICTURE_BYTES) {
            _state.update { it.copy(refused = it.refused + RefusedPick(uri, PICTURE_TOO_BIG)) }
            return false
        }
        return true
    }

    /**
     * A clip becomes the whole body, and its face is offered at once.
     *
     * The frames are lifted here rather than on entering a stage,
     * because there is no stage: the comment composer is one screen and
     * the cover row is inlined on it.
     */
    private fun acceptClip(uri: String, clip: VideoInfo) {
        _state.update {
            it.addPick(uri, sourceRatio = clip.aspectRatio, durationMs = clip.durationMs)
        }
        viewModelScope.launch {
            val frames = video.coverFrames(uri, COVER_FRAME_COUNT)
            _state.update { if (it.video?.uri == uri) it.copy(coverFrames = frames) else it }
        }
        transcode(uri)
    }

    /**
     * Re-encodes the clip as soon as it is picked, and stops there.
     *
     * **The transcode starts at pick; the upload waits for `Next`.** The
     * cover has to be uploaded before the clip that names it — an asset
     * row is immutable once written — and the cover is still being
     * chosen on this very screen. Sending the clip early would mean
     * re-sending fifty megabytes the moment the author tapped a
     * different frame. The slow half runs while they write, which is
     * what makes the gated seal (`ComposeSealUploading`) brief rather
     * than the whole wait.
     */
    private fun transcode(uri: String) {
        transcoded = null
        uploads.remove(uri)?.cancel()
        uploads[uri] = viewModelScope.launch {
            _state.update { it.withUpload(uri, AssetUpload.Transcoding(0)) }
            val processed = video.transcode(uri, MAX_VIDEO_BYTES) { percent ->
                _state.update { it.withUpload(uri, AssetUpload.Transcoding(percent)) }
            }
            if (processed == null) {
                _state.update { it.removePick(uri).copy(refused = it.refused + RefusedPick(uri, UNREADABLE_FILE)) }
                return@launch
            }
            // The cap is judged on what would be sent. Re-encoding is
            // precisely what usually brings a long recording under it,
            // so weighing the original would refuse comments the caps
            // mean to allow. The backend only refuses at prepare, which
            // is far too late to be told.
            if (processed.byteCount > MAX_VIDEO_BYTES) {
                runCatching { File(processed.path).delete() }
                _state.update {
                    it.removePick(uri).copy(refused = it.refused + RefusedPick(uri, VIDEO_TOO_BIG))
                }
                return@launch
            }
            transcoded = processed
            _state.update { it.withUpload(uri, AssetUpload.Idle) }
        }
    }

    fun onRemovePickAt(index: Int) {
        val uri = _state.value.picked.getOrNull(index)?.uri ?: return
        uploads.remove(uri)?.cancel()
        _state.update { it.removePick(uri) }
    }

    fun onRetryUpload(uri: String) {
        val asset = _state.value.picked.firstOrNull { it.uri == uri } ?: return
        if (asset.upload is AssetUpload.Running) return
        viewModelScope.launch { upload(uri, asset.sourceRatio ?: processor.aspectRatio(uri)) }
    }

    /**
     * One asset, whole.
     *
     * The crop spec names the picture's **own** ratio, which is how "no
     * crop" is said to a processor whose job is to produce a framed
     * export: a target equal to the source frames nothing away.
     */
    private fun upload(uri: String, ratio: Float?) {
        uploads.remove(uri)?.cancel()
        _state.update { it.withUpload(uri, AssetUpload.Running) }
        uploads[uri] = viewModelScope.launch {
            val picture = processor.process(uri, CropSpec(targetRatio = ratio ?: 1f))
            if (picture == null) {
                _state.update { it.withUpload(uri, AssetUpload.Failed(UNREADABLE)) }
                return@launch
            }
            when (val outcome = media.uploadMedia(picture)) {
                is Outcome.Success -> _state.update {
                    it.withUpload(uri, AssetUpload.Done(outcome.value.id))
                }
                is Outcome.Refused -> _state.update {
                    it.withUpload(
                        uri,
                        AssetUpload.Failed(outcome.errors.firstOrNull()?.message ?: REFUSED),
                    )
                }
                is Outcome.Failed -> _state.update { it.withUpload(uri, AssetUpload.Failed(TRANSPORT)) }
            }
        }
    }

    fun onDescribeFirst() = _state.update {
        val next = it.picked.indexOfFirst { asset -> asset.altText.isBlank() }
        it.copy(describingIndex = if (next >= 0) next else 0)
    }

    fun onDescribe(index: Int) = _state.update { it.copy(describingIndex = index) }

    fun onAltTextChange(uri: String, text: String) = _state.update { it.withAltText(uri, text) }

    // -- Stage movement --

    fun onNext() {
        val current = _state.value
        val next = current.advanced() ?: return
        // The clip goes up on the way to the seal, cover first — which
        // is why the seal can be the gated one (`ComposeSealUploading`).
        if (current.isVideoComment) startVideoUpload()
        _state.value = next
    }

    /**
     * The clip's whole journey to the server: its face first, then the
     * bytes that name it.
     *
     * An asset row is immutable once written, so a video states its
     * poster when it is created rather than gaining one afterwards.
     * Sending the cover first also fails fast — a refused cover is
     * learned at once rather than after fifty megabytes.
     */
    private fun startVideoUpload() {
        val clip = _state.value.video ?: return
        val processed = transcoded ?: return
        if (clip.upload is AssetUpload.Done && _state.value.coverMediaId != null) return
        uploads.remove(clip.uri)?.cancel()
        uploads[clip.uri] = viewModelScope.launch {
            _state.update { it.withUpload(clip.uri, AssetUpload.Running) }
            val coverId = _state.value.coverMediaId ?: uploadCover() ?: return@launch
            _state.update { it.copy(coverMediaId = coverId) }

            val sending = { progress: UploadProgress ->
                uploadSession = progress.uploadId
                _state.update { it.withUpload(clip.uri, AssetUpload.Sending(progress.percent)) }
            }
            when (val outcome = media.uploadVideo(processed, coverId, sending)) {
                is Outcome.Success -> {
                    _state.update { it.withUpload(clip.uri, AssetUpload.Done(outcome.value.id)) }
                    runCatching { File(processed.path).delete() }
                    transcoded = null
                }
                is Outcome.Refused -> _state.update {
                    it.withUpload(
                        clip.uri,
                        AssetUpload.Failed(outcome.errors.firstOrNull()?.message ?: REFUSED_VIDEO),
                    )
                }
                is Outcome.Failed -> _state.update {
                    it.withUpload(clip.uri, AssetUpload.Failed(TRANSPORT))
                }
            }
        }
    }

    /**
     * Uploads whatever the author chose as the face, as its own still.
     *
     * A frame arrives already processed — the pipeline shaped it exactly
     * as it shapes a picked picture. A chosen picture is processed here,
     * framed to the clip's own shape: a poster that is not the video's
     * shape would letterbox the thing it stands in for.
     */
    private suspend fun uploadCover(): String? {
        val state = _state.value
        val clip = state.video ?: return null
        val picture = when (val choice = state.coverChoice) {
            is CoverChoice.Frame -> state.coverFrames.getOrNull(choice.index)?.picture
            is CoverChoice.Picture -> processor.process(
                choice.uri,
                CropSpec(targetRatio = clip.sourceRatio ?: 1f),
            )
        }
        if (picture == null) {
            _state.update { it.withUpload(clip.uri, AssetUpload.Failed(UNREADABLE_COVER)) }
            return null
        }
        return when (val outcome = media.uploadMedia(picture)) {
            is Outcome.Success -> outcome.value.id
            is Outcome.Refused -> {
                _state.update {
                    it.withUpload(
                        clip.uri,
                        AssetUpload.Failed(outcome.errors.firstOrNull()?.message ?: REFUSED_COVER),
                    )
                }
                null
            }
            is Outcome.Failed -> {
                _state.update { it.withUpload(clip.uri, AssetUpload.Failed(TRANSPORT)) }
                null
            }
        }
    }

    // -- The clip's face, inline on the composer (`ReplyVideo`) --

    fun onPickCoverFrame(index: Int) =
        _state.update { it.copy(coverChoice = CoverChoice.Frame(index), coverMediaId = null) }

    /**
     * A cover of the author's own. The id is dropped with the choice: a
     * cover already uploaded is bytes this clip is no longer covered by.
     */
    fun onPickCoverPicture(uri: String) =
        _state.update { it.copy(coverChoice = CoverChoice.Picture(uri), coverMediaId = null) }

    /** Clears one refusal (`ReplyMediaErrors`, "Remove it"). */
    fun onDismissRefusal(index: Int) = _state.update { it.dismissedRefusal(index) }

    /** False where there is no stage left to step back to — the caller leaves. */
    fun onBack(): Boolean {
        val next = _state.value.retreated() ?: return false
        _state.value = next
        return true
    }

    fun onSealBack() = _state.update { it.copy(step = ReplyStep.Compose) }

    // -- The seal --

    fun onOpenSheet(sheet: ReplySealSheet) = _state.update { it.copy(sheet = sheet) }

    fun onCloseSheet() = _state.update { it.closedSheets() }

    fun onLicenseChange(license: LicenseChoice) = _state.update { it.copy(license = license) }

    fun onStanceChange(directed: Double, interest: Double) =
        _state.update { it.copy(pDirected = directed, pInterest = interest) }

    fun onOpenHelp(topic: HelpTopic) = _state.update { it.copy(help = topic) }

    fun onCloseHelp() = _state.update { it.copy(help = null) }

    // -- Topics and citations --

    fun onTagInputChange(value: String) = updateTags { it.withInput(value) }

    fun onAddTag() = updateTags { it.added() }

    fun onRemoveTag(name: String) = updateTags { it.removed(name) }

    fun onTuneTag(name: String) = updateTags { it.tuned(name) }

    fun onDoneTuningTag() = updateTags { it.tuned(null) }

    fun onTagRelevanceChange(name: String, value: Double) = updateTags { it.withRelevance(name, value) }

    fun onTagConfidenceChange(name: String, value: Double) = updateTags { it.withConfidence(name, value) }

    private fun updateTags(block: (TagSectionState) -> TagSectionState) =
        _state.update { it.copy(tagSection = block(it.tagSection)) }

    fun onOpenFinder() = updateReferences { it.withFinder(ReferenceFinderState()) }

    fun onCloseFinder() {
        finderJob?.cancel()
        updateReferences { it.withFinder(null) }
    }

    fun onFinderQueryChange(query: String) {
        finderJob?.cancel()
        updateReferences { section ->
            section.withFinder(
                (section.finder ?: ReferenceFinderState()).copy(
                    query = query,
                    searching = query.isNotBlank(),
                    failed = false,
                ),
            )
        }
        finderJob = viewModelScope.launch {
            delay(FINDER_DEBOUNCE_MILLIS)
            when (val outcome = references.candidateRows(query)) {
                is Outcome.Success -> updateReferences { section ->
                    // An answer that arrived after the author typed on is
                    // stale — only the current query's lands.
                    section.finder?.takeIf { it.query == query }?.let {
                        section.withFinder(
                            it.copy(candidates = outcome.value, searching = false, failed = false),
                        )
                    } ?: section
                }
                is Outcome.Refused, is Outcome.Failed -> updateReferences { section ->
                    section.finder?.takeIf { it.query == query }?.let {
                        section.withFinder(it.copy(searching = false, failed = true))
                    } ?: section
                }
            }
        }
    }

    fun onPickReference(row: ReferenceCandidateRow) {
        finderJob?.cancel()
        updateReferences { it.added(row.targetId, row.target).withFinder(null) }
    }

    fun onRemoveReference(targetId: String) = updateReferences { it.removed(targetId) }

    fun onTuneReference(targetId: String) = updateReferences { it.tuned(targetId) }

    fun onDoneTuningReference() = updateReferences { it.tuned(null) }

    fun onReferenceRelevanceChange(targetId: String, value: Double) =
        updateReferences { it.withRelevance(targetId, value) }

    fun onReferenceSupportChange(targetId: String, value: Double) =
        updateReferences { it.withSupport(targetId, value) }

    private fun updateReferences(block: (ReferenceSectionState) -> ReferenceSectionState) =
        _state.update { it.copy(referenceSection = block(it.referenceSection)) }

    // -- Signing --

    /**
     * Stages the batch and signs it. A refusal from the prepare stops
     * before any signature: nothing was signed, so nothing may claim
     * signing failed.
     */
    fun onSign() {
        val current = _state.value
        val target = current.target ?: return
        if (!current.canSign) return
        _state.update {
            it.copy(
                submitting = true,
                refusal = null,
                signingFailed = false,
                keyAbsent = false,
                transportFailed = false,
            )
        }
        viewModelScope.launch {
            val prepared = when (
                val outcome = content.prepareComment(
                    target = target.id,
                    content = current.body,
                    license = current.license,
                    tags = current.tagSection.tags.map { it.toClaim() },
                    references = current.referenceSection.references.map { it.toClaim() },
                    attachments = current.picked.mapNotNull { asset ->
                        asset.mediaId?.let { AttachmentClaim(it, asset.altText.ifBlank { null }) }
                    },
                    pDirected = current.pDirected,
                    pInterest = current.pInterest,
                )
            ) {
                is Outcome.Success -> outcome.value
                is Outcome.Refused -> return@launch refuse(outcome.errors)
                is Outcome.Failed -> return@launch failTransport()
            }

            val results = try {
                signer.sign(prepared.writes)
            } catch (_: NoActorKeyException) {
                // `ComposeKeyAbsent`: the write waits on the reader
                // restoring the key. There is no draft to keep, so the
                // card offers the restore and the way out, nothing else.
                _state.update { it.copy(submitting = false, keyAbsent = true) }
                return@launch
            }

            if (results.all { it is WriteResult.Done }) {
                _state.update {
                    it.copy(submitting = false, outcome = ReplyOutcome.Signed(prepared.node))
                }
            } else {
                _state.update { it.copy(submitting = false, signingFailed = true) }
            }
        }
    }

    /**
     * The author left. The comment is discarded — comments keep no
     * drafts, so there is nothing here but the signal to go.
     */
    /**
     * The way out the author asked for, which is not always the way out
     * they get.
     *
     * The reply composer keeps no draft, so leaving it discards — and a
     * non-empty composer is asked first (`DiscardConfirm`,
     * design/readme.md §13). An empty one leaves at once: a confirm with
     * nothing to lose is noise.
     */
    fun onLeaveRequested() {
        if (_state.value.outcome != null) return
        if (_state.value.hasSomethingToLose) {
            _state.update { it.copy(confirmingDiscard = true) }
        } else {
            onLeave()
        }
    }

    /** "Keep writing" — the dialog closes over the stage it covered. */
    fun onKeepWriting() = _state.update { it.copy(confirmingDiscard = false) }

    fun onLeave() {
        if (_state.value.outcome != null) return
        uploads.values.forEach { it.cancel() }
        uploads.clear()
        // The transcode's cache copy goes with the reply it was for.
        transcoded?.let { runCatching { File(it.path).delete() } }
        transcoded = null
        // And so do the parts already on the server: a discarded reply
        // is not coming back for them, and the store would otherwise
        // hold them for a day.
        uploadSession?.let { session ->
            uploadSession = null
            viewModelScope.launch { media.abortUpload(session) }
        }
        _state.update { it.copy(confirmingDiscard = false, outcome = ReplyOutcome.Left) }
    }

    fun onOutcomeConsumed() = _state.update { it.copy(outcome = null) }

    /**
     * A refusal from the one write whose input carries the whole batch:
     * the server names the offender by path, so `["tags", i, …]` lands on
     * chip i, `["attachments", i, …]` on pick i, and everything else says
     * its piece once.
     */
    private fun refuse(errors: List<UserError>) = _state.update { st ->
        var tags = st.tagSection
        var refs = st.referenceSection
        var picks = st.picked
        val unplaced = mutableListOf<String>()
        for (error in errors) {
            val tagIndex = tagFieldIndex(error.field)
            val referenceIndex = referenceFieldIndex(error.field)
            val attachmentIndex = attachmentFieldIndex(error.field)
            when {
                tagIndex != null -> {
                    val (next, left) = tags.withErrorAt(tagIndex, error.message)
                    tags = next
                    left?.let { unplaced += it }
                }
                referenceIndex != null -> {
                    val (next, left) = refs.withErrorAt(referenceIndex, error.message)
                    refs = next
                    left?.let { unplaced += it }
                }
                attachmentIndex != null && attachmentIndex in picks.indices -> {
                    picks = picks.mapIndexed { i, asset ->
                        if (i == attachmentIndex) {
                            asset.copy(upload = AssetUpload.Failed(error.message))
                        } else {
                            asset
                        }
                    }
                }
                else -> unplaced += error.message
            }
        }
        st.copy(
            submitting = false,
            tagSection = tags,
            referenceSection = refs,
            picked = picks,
            refusal = unplaced.firstOrNull(),
        )
    }

    private fun failTransport() = _state.update { it.copy(submitting = false, transportFailed = true) }

    // Internal rather than private so the suite can assert against the
    // words themselves instead of re-typing them.
    internal companion object {
        const val FINDER_DEBOUNCE_MILLIS = 250L

        const val UNREADABLE = "That file could not be read as a picture."
        const val REFUSED = "The server would not take that picture."
        const val TRANSPORT = "The upload could not reach the server."

        const val REFUSED_VIDEO = "The server would not take that video."
        const val UNREADABLE_COVER = "That picture could not be read as a cover."
        const val REFUSED_COVER = "The server would not take that cover."

        // Blessed verbatim in design/guidelines/copy-voice.md "Refused
        // files". Each line names the cap it broke, because that is the
        // only place a cap is named — nothing announces the limits in
        // advance. **Screens say MB; the caps are MiB**, so the number
        // shown under-promises and can never turn a file the product
        // would have accepted into a refusal.
        const val UNREADABLE_FILE = "That file isn't a picture or a video CoGra can read."
        const val PICTURE_TOO_BIG = "That picture is too big — a picture can be up to 10 MB."
        const val VIDEO_TOO_BIG = "That video is too big — a comment's video can be up to 50 MB."

        /** A comment picture's cap: four per comment, ten mebibytes each. */
        const val MAX_PICTURE_BYTES = 10L * 1024 * 1024

        /**
         * A comment clip's cap — half a post's.
         *
         * Checked here, before a byte leaves: the backend only refuses
         * at prepare, and being told after the upload that the upload
         * was pointless is the worst version of this.
         */
        const val MAX_VIDEO_BYTES = 50L * 1024 * 1024

        /** How many frames the inline cover row offers — the board draws four. */
        const val COVER_FRAME_COUNT = 4
    }
}

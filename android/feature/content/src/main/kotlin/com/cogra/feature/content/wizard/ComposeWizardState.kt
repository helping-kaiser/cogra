package com.cogra.feature.content.wizard

import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.compose.PickedPicture
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.domain.LicenseChoice
import com.cogra.domain.compose.ComposeDraft
import com.cogra.domain.compose.DraftAsset
import com.cogra.domain.compose.DraftBodyKind
import com.cogra.domain.compose.DraftShape
import com.cogra.domain.content.isDescriptionTooLong
import com.cogra.domain.content.isPostBodyTooLong
import com.cogra.domain.content.isSensitiveReasonTooLong
import com.cogra.domain.content.isTitleTooLong
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.DeviceMedia
import com.cogra.domain.media.VideoFrame
import com.cogra.feature.content.ReferenceSectionState
import com.cogra.feature.content.TagSectionState

/**
 * The wizard's stages, in the order the canonical boards draw them:
 * `ComposeWords`/`ComposePick` → `ComposeCrop` **or** `ComposeCover` →
 * `ComposeDetails` → `ComposeSeal` (design/readme.md §13).
 *
 * [Crop] and [Cover] are both on the media path and are exclusive: a
 * picture body is cropped, a video body gets a face. The paths differ in
 * length, which is exactly why the boards carry no step counter — the
 * header names the stage instead.
 */
enum class WizardStep { Body, Crop, Cover, Details, Seal }

/**
 * What covers a video (`ComposeCover`).
 *
 * The board offers frames lifted out of the clip and one dashed tile
 * that opens the device's own picker, and the ruling says the same in
 * words: the cover is "either a frame from the video or a chose image"
 * (jakob 2026-09-02) — but a face is not owed: "going without a cover
 * is always possible" (jakob 2026-09-10, the video-cover round), and
 * the contract, the database and the backend all accept a placement
 * naming none. Either a frame or a picture is uploaded as its own
 * still and named on the video's own upload; [None] names nothing and
 * uploads nothing.
 */
sealed interface CoverChoice {
    /** No face chosen — a settled answer, not a not-yet. */
    data object None : CoverChoice

    /** One of the offered frames, by index into the offered list. */
    data class Frame(val index: Int) : CoverChoice

    /** A picture of the author's own, by picker URI. */
    data class Picture(val uri: String) : CoverChoice
}

/**
 * Which half of the body is being authored.
 *
 * A post's body is words **or** media, never both and never neither
 * (D16). Both halves stay in state while the author toggles, so a
 * mis-tap is not a loss — but only the half [ComposeWizardState.mode]
 * names is submitted, which is what makes the XOR true by construction
 * rather than by a validation the composer could forget.
 */
enum class BodyMode { Words, Media }

/** Where one picked asset stands on its way to the server. */
sealed interface AssetUpload {
    /** Picked, not yet sent — the state a fresh pick and a retry share. */
    data object Idle : AssetUpload

    /**
     * A clip is being re-encoded before it can be sent.
     *
     * It carries a percentage because a transcode is long enough that a
     * spinner alone reads as a hang — a picture's own processing is
     * milliseconds and never needs one.
     */
    data class Transcoding(val percent: Int) : AssetUpload

    /**
     * The bytes are going up, part by part.
     *
     * It carries a percentage where [Running] cannot: a resumable
     * upload knows how many of its parts have landed, and a hundred
     * megabytes is long enough that a ring with no number reads as a
     * hang — which is exactly what a dropped part being retried behind
     * the scenes would otherwise look like.
     */
    data class Sending(val percent: Int) : AssetUpload

    data object Running : AssetUpload

    data class Done(val mediaId: String) : AssetUpload

    /**
     * The upload failed or was refused.
     *
     * [reason] names what happened and the screen resolves it to copy,
     * so the words live in `strings.xml` like every other line the app
     * shows. [serverMessage] is the server's own words where it gave
     * any — deliberately preferred, so a refusal that names the file
     * says so rather than reading as a generic fault.
     *
     * [retryable] is false for an asset the server accepted, held as
     * PROCESSING, and only then refused: the bytes already made the
     * round trip once, so asking again sends the identical bytes into
     * the identical answer. The way out is picking a different file, not
     * a retry link that is certain to fail the same way twice.
     */
    data class Failed(
        val reason: UploadFailure,
        val serverMessage: String? = null,
        val retryable: Boolean = true,
    ) : AssetUpload
}

/**
 * Whether this asset is still on its way.
 *
 * One predicate rather than a chain repeated at every reading: a clip
 * is transcoding, then sending its parts, and both are "not there yet"
 * to every surface that gates on it. Adding a third leg to the journey
 * should not mean finding ten places that forgot about it.
 */
val AssetUpload.inFlight: Boolean
    get() = this is AssetUpload.Running ||
        this is AssetUpload.Transcoding ||
        this is AssetUpload.Sending

/** How far along, where the state can say — a ring needs a number. */
val AssetUpload.percentOrNull: Int?
    get() = when (this) {
        is AssetUpload.Transcoding -> percent
        is AssetUpload.Sending -> percent
        else -> null
    }

/**
 * One picked asset, from the grid to the gallery.
 *
 * [uri] is identity: the picker's content URI is stable for the
 * session, survives the crop step, and is what the pipeline reads. Two
 * picks of the same asset are the same asset — the contract refuses a
 * gallery carrying one twice, so the picker never stages a duplicate.
 */
data class PickedAsset(
    val uri: String,
    /** The asset's own ratio, for the crop preview. Null until read. */
    val sourceRatio: Float? = null,
    val altText: String = "",
    val upload: AssetUpload = AssetUpload.Idle,
    /** The clip's length; null on a picture, which is what tells them apart. */
    val durationMs: Int? = null,
) {
    val mediaId: String? get() = (upload as? AssetUpload.Done)?.mediaId

    val isVideo: Boolean get() = durationMs != null
}

/**
 * A file the pick step would not take (`ComposePickedErrors`).
 *
 * It is not a [PickedAsset]: a refused file never joined the batch, so
 * it cannot appear in the tray or in the Show-all sheet, and the accepted
 * picks carry on to the next stage without it. The refusal is drawn where
 * the file was offered, and its only way out is removing it — retrying
 * cannot make a file smaller or a format readable.
 *
 * [uri] is null for a file nothing here can read: there is no preview to
 * draw, so the tile is deliberately empty.
 */
data class RefusedPick(
    val uri: String?,
    /** Why, as a reason the screen resolves to copy. */
    val reason: UploadFailure,
    /** Draws the clip marker on the refused tile. */
    val isVideo: Boolean = false,
)

/**
 * Which sheet is open over the seal (`ComposeLicense`, `ComposePad`,
 * `ComposeSensitive`, `ComposeCitations`). One at a time: each is a drawer the
 * reader opened over the same screen.
 */
enum class SealSheet { None, License, Stance, Sensitive, Cited }

/**
 * How the wizard ended.
 *
 * [Landed] and [Expired] are not screens of the wizard — the canonical
 * boards draw them on the surfaces the author returns to (the feed
 * carries the "didn't land" card; the signed post carries the snackbar)
 * — so they are signals the route acts on, not stages to render.
 */
sealed interface WizardOutcome {
    /** Signed and relaying. [nodeId] is the post's own id once it lands. */
    data class Landed(val nodeId: String) : WizardOutcome

    /**
     * A staged act was garbage-collected before it landed: nothing was
     * spent, and the draft is kept (`ComposeExpired`).
     */
    data class Expired(val label: String) : WizardOutcome

    /** The author left without publishing; the draft is kept. */
    data object DraftKept : WizardOutcome
}

/**
 * Everything the wizard's screens read.
 *
 * Deliberately one immutable value rather than a state per screen: the
 * seal has to count acts across topics, references and the body, and
 * the body step has to know whether a crop is still ahead — so a single
 * value is what makes those questions answerable without a screen
 * reaching into another screen's state.
 */
data class ComposeWizardState(
    val step: WizardStep = WizardStep.Body,
    /**
     * The composer opens on the pictures. `ComposeDraft` draws its offer
     * over the picker grid and captions the stage behind it "Or start
     * fresh —", which is the board saying which half a fresh composer
     * starts on; `ComposeWords` is the half reached by "Write words
     * instead".
     */
    val mode: BodyMode = BodyMode.Media,

    // -- The body --
    val body: String = "",
    val picked: List<PickedAsset> = emptyList(),
    /** The device's newest pictures, once a media permission allows them. */
    val deviceMedia: List<DeviceMedia> = emptyList(),

    /**
     * Files the step would not take, listed under the tray
     * (`ComposePickedErrors`). What was accepted goes on regardless —
     * `Next` never waits on a refusal being cleared.
     */
    val refused: List<RefusedPick> = emptyList(),
    val shape: DraftShape = DraftShape.Tall,
    /** Which pick the crop step is framing, by index into [picked]. */
    val framingIndex: Int = 0,

    /**
     * The framing each pick was left at, by asset URI.
     *
     * It lives in the state rather than only in the crop stage's own
     * saveable holder because the stage is *left*: walking on to the
     * details stage tears its composition down, and a saveable dies with
     * it. Re-entering — backwards from a later stage, or forwards again
     * from an earlier one — must show the author the crop they made
     * rather than a reset one (jakob 2026-09-01), and the previews on
     * every later stage have to draw that same framing, so this is also
     * what they read.
     */
    val crops: Map<String, CropSpec> = emptyMap(),

    // -- The video's face (`ComposeCover`) --

    /**
     * The frames offered as covers, oldest first, once they have been
     * lifted out of the clip. Empty until then — the board draws the
     * tiles from this, so an empty list is the loading state.
     */
    val coverFrames: List<VideoFrame> = emptyList(),

    /**
     * Which cover the author settled on.
     *
     * Starts at [CoverChoice.None]: extraction may still be running, may
     * come back with nothing to offer, or the author may simply move on
     * before it resolves — every one of those is a settled "no cover"
     * rather than a wait, so `Next` never blocks on this (D5;
     * jakob 2026-09-10). The cover step itself auto-settles on the first
     * offered frame once extraction succeeds, while the author is still
     * on that step and has not chosen otherwise.
     */
    val coverChoice: CoverChoice = CoverChoice.None,

    /** The cover's asset id once it has been uploaded on its own. */
    val coverMediaId: String? = null,

    // -- Details --
    val title: String = "",
    val description: String = "",
    val tagSection: TagSectionState = TagSectionState(),
    val referenceSection: ReferenceSectionState = ReferenceSectionState(),

    // -- The seal --
    val license: LicenseChoice = LicenseChoice.PublicDomain,
    /** The author's own attachment to the post (`ComposePad`). */
    val pDirected: Double = DEFAULT_P_DIRECTED,

    /**
     * What the open pad has under the finger — staged, not set, until Set.
     *
     * The board's own line: "release never commits, Set does". A pad that
     * wrote through on every drag would leave Cancel with nothing to
     * cancel, so the drag moves this and only Set moves [pDirected].
     */
    val stagedPDirected: Double = DEFAULT_P_DIRECTED,

    /**
     * The author's own sensitive mark (`ComposeSensitive`).
     *
     * It veils the pictures and the words until a reader chooses
     * to look; the title stays readable, so choosing is informed.
     */
    val sensitive: Boolean = false,

    /** Shown on the veil when the author gave one; blank counts as none. */
    val sensitiveReason: String = "",

    val sheet: SealSheet = SealSheet.None,

    /**
     * The Show all sheet (`PickedSheet`) — the per-picture manager, opened
     * by the pick step's "Show all" and by the details step's picked row.
     * Order, cover, remove and describe live there and nowhere else.
     */
    val pickedSheetOpen: Boolean = false,

    /**
     * Which picture `DescribeSheet` is describing, by index into [picked].
     *
     * Alt text is authored here and never on the crop step: a geometry
     * step is no place for a keyboard
     * (`design/components/compose/DescribeSheet.prompt.md`).
     */
    val describingIndex: Int? = null,

    /**
     * The screen's one `?`, open (design/readme.md §13: at most one per
     * screen, and every one opens the house plain dialog).
     */
    val help: HelpTopic? = null,

    // -- Flow state --
    /** A held draft offered back before anything is authored. */
    val draftOffer: ComposeDraft? = null,
    val submitting: Boolean = false,
    /** The device holds no actor key — `ComposeKeyAbsent`. */
    val keyAbsent: Boolean = false,
    /** A refusal that named no field of its own, in the server's words. */
    val refusal: String? = null,
    val signingFailed: Boolean = false,
    val transportFailed: Boolean = false,
    val outcome: WizardOutcome? = null,
) {
    /** Every pick that has an id on the server. */
    val uploadedIds: List<String> get() = picked.mapNotNull { it.mediaId }

    /**
     * The opinion pad is parked over the page, not a drawer.
     *
     * It sits at the lower centre of the viewport, the same place every
     * time, because muscle memory is part of the control
     * (design/readme.md §"Fixed elements"). Riding the sheet host would
     * draw a second sheet chrome around it — the doubled surface F2-10
     * reports — and would park it wherever the drawer happened to stop.
     */
    val padOpen: Boolean get() = sheet == SealSheet.Stance

    /** Any drawer open over the current stage — the pad is not one. */
    val anySheetOpen: Boolean
        get() = (sheet != SealSheet.None && !padOpen) || pickedSheetOpen || describingIndex != null

    /** How many picks carry a description — `DescribeCounter`'s count. */
    val describedCount: Int get() = picked.count { it.altText.isNotBlank() }

    /** Uploads still in flight, for `UploadStatusLine`'s "n of m". */
    val uploadsDone: Int get() = uploadedIds.size

    /**
     * Anything still on its way. A transcode counts: it is the clip's
     * own leg of the same journey, and a stage that called it idle would
     * let the seal look reachable while the encoder is still working.
     */
    val uploadsRunning: Boolean
        get() = picked.any {
            it.upload.inFlight
        }

    /** How far the clip's re-encode has got, when one is running. */
    val transcodingPercent: Int?
        get() = picked.firstNotNullOfOrNull { it.upload.percentOrNull }

    val uploadsFailed: Boolean get() = picked.any { it.upload is AssetUpload.Failed }

    /**
     * Every pick has an id: the gallery can be attached as it stands.
     *
     * A video's face is optional, but a face that was chosen still has
     * to land before the body counts as complete: the placement cannot
     * name an id that does not exist yet. [CoverChoice.None] carries no
     * such id to wait for, so it never holds this up.
     */
    val uploadsComplete: Boolean
        get() = picked.isNotEmpty() &&
            uploadedIds.size == picked.size &&
            (!isVideoPost || coverSettled)

    /**
     * Whether the clip's face needs nothing more sent: none is wanted,
     * or the one standing has its id.
     */
    val coverSettled: Boolean
        get() = coverChoice is CoverChoice.None || coverMediaId != null

    /**
     * The body carries something publishable. The XOR is read here
     * rather than validated at submit, so the header's `Next` is the
     * only thing that has to know about it.
     */
    val bodyReady: Boolean
        get() = when (mode) {
            BodyMode.Words -> body.isNotBlank() && !bodyTooLong
            BodyMode.Media -> picked.size in 1..MAX_POST_ASSETS
        }

    /** The words body's own cap — a media post's body is never this field. */
    val bodyTooLong: Boolean
        get() = mode == BodyMode.Words && isPostBodyTooLong(body)

    /**
     * Whether the body is one clip.
     *
     * A video is the whole body — "one video plus a cover" (jakob
     * 2026-09-02) — so this reads the single pick rather than asking
     * whether *any* pick is a video: the toggle rule below is what makes
     * a mixed body unreachable, and this stays a question about the body
     * rather than a search through it.
     */
    val isVideoPost: Boolean get() = picked.singleOrNull()?.isVideo == true

    /**
     * Whether the media path's crop stage stands between body and
     * details. A video is not cropped — it takes the cover stage
     * instead, and the two are exclusive.
     */
    val hasCropStep: Boolean get() = mode == BodyMode.Media && !isVideoPost

    /** Whether the video path's cover stage stands before details. */
    val hasCoverStep: Boolean get() = mode == BodyMode.Media && isVideoPost

    /** The clip this post is, when it is one. */
    val video: PickedAsset? get() = picked.singleOrNull()?.takeIf { it.isVideo }

    /**
     * What this submit stages, counted the way the batch is priced —
     * each record its own signed act. A gallery adds none: attaching
     * media mints nothing, so a ten-photo post is still one Publish
     * (api-spec.md `PrepareContentPayload`).
     */
    val signedActionCount: Int
        get() = 1 + tagSection.tags.size + referenceSection.references.size

    /**
     * The one line the seal and its sheets show above the act list —
     * "Salt maps of the coast road — 2 pictures." on the canonical
     * boards.
     */
    val sealSummary: String
        get() {
            val name = title.ifBlank {
                when (mode) {
                    BodyMode.Words -> body.lineSequence().firstOrNull()?.take(SUMMARY_CHARS).orEmpty()
                    BodyMode.Media -> ""
                }
            }
            val bodyNote = when {
                mode == BodyMode.Words -> "words"
                isVideoPost -> "video"
                else -> pictureCount(picked.size)
            }
            return if (name.isBlank()) bodyNote else "$name — $bodyNote"
        }

    /**
     * Whether the seal may be signed. Every pick must have landed an
     * id first — attaching an asset that is still uploading would send
     * a gallery entry naming nothing.
     */
    val canSign: Boolean
        get() = !submitting &&
            !keyAbsent &&
            !titleTooLong &&
            !descriptionTooLong &&
            !bodyTooLong &&
            !sensitiveReasonTooLong &&
            when (mode) {
                BodyMode.Words -> body.isNotBlank()
                BodyMode.Media -> uploadsComplete
            }

    /**
     * The one details field with a cap the write side refuses past
     * (post.md §1). It blocks the seal as well as the details screen: the
     * seal is the boundary the server sees, and a draft that reached it
     * over-titled would sign a refusal.
     */
    val titleTooLong: Boolean
        get() = isTitleTooLong(title)

    /** The description's own cap — blocks the seal the same way the title does. */
    val descriptionTooLong: Boolean
        get() = isDescriptionTooLong(description)

    /** The sensitive mark's reason, capped the same way every authored field is. */
    val sensitiveReasonTooLong: Boolean
        get() = sensitive && isSensitiveReasonTooLong(sensitiveReason)

    /** The draft this state would be kept as. */
    fun toDraft(): ComposeDraft = ComposeDraft(
        bodyKind = when (mode) {
            BodyMode.Words -> DraftBodyKind.Words
            BodyMode.Media -> DraftBodyKind.Media
        },
        body = body,
        title = title,
        description = description,
        assets = picked.map { DraftAsset(it.uri, it.altText) },
        shape = shape,
    )

    companion object {
        /** api-spec.md `PreparePostInput`: at most ten per post (D9). */
        const val MAX_POST_ASSETS = 10

        /** The low-defaults policy value the author's attachment starts at. */
        const val DEFAULT_P_DIRECTED = 0.1

        private const val SUMMARY_CHARS = 60

        fun pictureCount(n: Int): String = if (n == 1) "1 picture" else "$n pictures"

        /** Restores a held draft into a fresh wizard. */
        fun from(draft: ComposeDraft): ComposeWizardState = ComposeWizardState(
            mode = when (draft.bodyKind) {
                DraftBodyKind.Words -> BodyMode.Words
                DraftBodyKind.Media -> BodyMode.Media
            },
            body = draft.body,
            title = draft.title,
            description = draft.description,
            // Every restored pick starts un-uploaded: an id from a
            // previous session may have been swept as an orphan (D5),
            // so the wizard re-uploads rather than attaching an asset
            // that might no longer exist.
            picked = draft.assets.map { PickedAsset(it.uri, altText = it.altText) },
            shape = draft.shape,
        )
    }
}

/**
 * The picks as the composer's components see them.
 *
 * The mapping is explicit and lives here rather than in the design system,
 * which carries no domain dependency (android/CLAUDE.md).
 */
fun ComposeWizardState.pickedPictures(): List<PickedPicture> =
    picked.pickedPictures { crops[it.uri].toFraming() }

// ---------------------------------------------------------------------
// Transitions. Pure functions on the state, so every branch of the
// wizard is a JVM test rather than a UI one.
// ---------------------------------------------------------------------

/**
 * The `Next` action of whichever stage is showing, or null when the
 * stage is not ready to advance. Returning null rather than throwing is
 * what lets the header disable the pill from the same rule that moves
 * the wizard.
 */
fun ComposeWizardState.advanced(): ComposeWizardState? = when (step) {
    WizardStep.Body -> when {
        !bodyReady -> null
        hasCropStep -> copy(step = WizardStep.Crop, framingIndex = 0)
        // `ComposePick` → `ComposeCover` for "a video — its face".
        hasCoverStep -> copy(step = WizardStep.Cover)
        else -> copy(step = WizardStep.Details)
    }
    WizardStep.Crop -> copy(step = WizardStep.Details)
    WizardStep.Cover -> copy(step = WizardStep.Details)
    WizardStep.Details -> copy(step = WizardStep.Seal)
    // The seal advances by signing, never by `Next`.
    WizardStep.Seal -> null
}

/**
 * One stage back — the header's arrow, the system gesture, and the
 * seal's own `Back` pill alike (jakob 2026-08-31: back "always goes back
 * one step").
 *
 * Null where there is no earlier stage to reach, which is what makes the
 * first stage the one place back leaves from. The draft is kept either
 * way; it is written continuously rather than at the exit.
 */
fun ComposeWizardState.retreated(): ComposeWizardState? = when {
    // A sheet is a drawer over the stage and the pad is parked above it:
    // either closes before the stage moves, and closing the pad stages
    // nothing, exactly as Cancel does not.
    anySheetOpen || padOpen -> closedSheets()
    step == WizardStep.Body -> null
    step == WizardStep.Crop -> copy(step = WizardStep.Body)
    // The cover stage is reached from the pick, so back returns there.
    // The board's own back arrow is drawn against `ComposeCrop`, which
    // a video never passes through — see the PR body's scope note.
    step == WizardStep.Cover -> copy(step = WizardStep.Body)
    step == WizardStep.Details -> when {
        hasCropStep -> copy(step = WizardStep.Crop)
        hasCoverStep -> copy(step = WizardStep.Cover)
        else -> copy(step = WizardStep.Body)
    }
    else -> copy(step = WizardStep.Details)
}

/** Drops every drawer without moving the stage. */
fun ComposeWizardState.closedSheets(): ComposeWizardState =
    copy(sheet = SealSheet.None, pickedSheetOpen = false, describingIndex = null)

/**
 * Switches the body's half. Both halves survive the switch — the
 * author who wrote a paragraph, changed their mind, and changed it back
 * finds the paragraph — but only the named half is ever submitted.
 */
fun ComposeWizardState.withMode(next: BodyMode): ComposeWizardState =
    if (next == mode) this else copy(mode = next)

/**
 * Adds or removes a pick, the way a picker grid's tile toggles.
 *
 * Order is selection order, and the first pick is the cover — the
 * canonical board says so in as many words ("The first one is the
 * cover"), and the contract derives `displayOrder`/`isCover` from the
 * list's own order, so nothing here carries an index that could
 * disagree with itself.
 *
 * A pick past the cap is refused rather than dropped silently: the
 * caller surfaces it.
 */
fun ComposeWizardState.togglePick(
    uri: String,
    sourceRatio: Float? = null,
    durationMs: Int? = null,
): ComposeWizardState {
    if (picked.any { it.uri == uri }) return removePick(uri)
    val picking = PickedAsset(uri, sourceRatio, durationMs = durationMs)
    // "One video or up to ten pictures" (`ComposePick`, tile toggle). A
    // clip replaces whatever was picked rather than being refused beside
    // it: the grid tile the author just tapped is the one they meant,
    // and a body is a video *or* a gallery, never a mixture (D16, and
    // the ruling's "one video plus a cover").
    if (picking.isVideo) return copy(picked = listOf(picking)).clearedCover()
    if (isVideoPost) return copy(picked = listOf(picking)).clearedCover()
    if (picked.size >= ComposeWizardState.MAX_POST_ASSETS) return this
    return copy(picked = picked + picking)
}

/**
 * Forgets a previous clip's face.
 *
 * Frames belong to the clip they were lifted from, and an id belongs to
 * bytes already on the server — carrying either across a change of body
 * would cover one video with another's face.
 */
fun ComposeWizardState.clearedCover(): ComposeWizardState = copy(
    coverFrames = emptyList(),
    coverChoice = CoverChoice.None,
    coverMediaId = null,
)

/**
 * Records the id a face landed as — only while that face still stands.
 *
 * AN ID BELONGS TO THE FACE IT WAS UPLOADED FOR. Choosing a new face
 * drops the id, but the upload of the old one may still be in flight
 * and land after it; written unconditionally, the old id would then
 * pose as the new face's, and the next journey would skip uploading the
 * face the author actually chose.
 */
fun ComposeWizardState.withCoverIdFor(choice: CoverChoice, id: String?): ComposeWizardState =
    if (coverChoice == choice) copy(coverMediaId = id) else this

/**
 * Drops a pick from the tray without touching the rest of the order.
 *
 * **THE LAST × GIVES THE PICK STEP BACK** (the video path's ruling,
 * `design/designs/canonical/screens/ComposeDetailsVideo.jsx:23-32`, and
 * jakob's 2026-09-23 ruling applying it to the manager,
 * `ComposePicked.jsx`/`ComposeDetails.jsx`). A wizard stage never stands
 * on a body that is gone: emptying the tray — the video's own ×, or the
 * last picture in the Show-all manager — returns [WizardStep.Body] with
 * the manager closed, so an empty Details or Seal is never reachable.
 * [BodyMode] is untouched: the stage does not become the words path,
 * only the picked media picker's own toggle does that.
 */
fun ComposeWizardState.removePick(uri: String): ComposeWizardState {
    val remaining = picked.filterNot { it.uri == uri }
    val emptied = remaining.isEmpty() && picked.isNotEmpty()
    return copy(
        picked = remaining,
        // The framing cursor must not point past the end after a removal.
        framingIndex = framingIndex.coerceAtMost((remaining.size - 1).coerceAtLeast(0)),
        // A framing describes a picture that is no longer in the post. Kept,
        // it would be handed to a re-pick of the same asset as if the author
        // had framed it this time.
        crops = crops - uri,
        // A sheet describing the removed picture has nothing left to describe.
        describingIndex = null,
        step = if (emptied) WizardStep.Body else step,
        pickedSheetOpen = if (emptied) false else pickedSheetOpen,
    )
}

/**
 * Moves one pick in the order — `PickedSheet`'s drag, and its move-earlier
 * / move-later accessibility actions.
 *
 * **The first one is the cover, and the badge travels with reorder**: there
 * is no separate cover flag to keep in step, because the order *is* the
 * answer. The contract derives `displayOrder` and `isCover` from this list,
 * so nothing here carries an index that could disagree with itself.
 */
fun ComposeWizardState.movedPick(from: Int, to: Int): ComposeWizardState {
    if (from !in picked.indices || to !in picked.indices || from == to) return this
    val reordered = picked.toMutableList().apply { add(to, removeAt(from)) }
    return copy(picked = reordered)
}

fun ComposeWizardState.withUpload(uri: String, upload: AssetUpload): ComposeWizardState =
    copy(picked = picked.withUpload(uri, upload))

fun ComposeWizardState.withSourceRatio(uri: String, ratio: Float): ComposeWizardState =
    copy(picked = picked.withSourceRatio(uri, ratio))

fun ComposeWizardState.withAltText(uri: String, text: String): ComposeWizardState =
    copy(picked = picked.withAltText(uri, text))

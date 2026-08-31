package com.cogra.feature.content.wizard

import com.cogra.core.designsystem.v2.compose.PickedPicture
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.domain.compose.ComposeDraft
import com.cogra.domain.compose.DraftAsset
import com.cogra.domain.compose.DraftBodyKind
import com.cogra.domain.compose.DraftShape
import com.cogra.domain.media.DeviceImage
import com.cogra.domain.LicenseChoice
import com.cogra.feature.content.ReferenceSectionState
import com.cogra.feature.content.TagSectionState

/**
 * The wizard's stages, in the order the canonical boards draw them:
 * `ComposeWords`/`ComposePick` → `ComposeCrop` → `ComposeDetails` →
 * `ComposeSeal` (design/readme.md §13).
 *
 * [Crop] is on the media path only. The two paths differ in length,
 * which is exactly why the boards carry no step counter — the header
 * names the stage instead.
 */
enum class WizardStep { Body, Crop, Details, Seal }

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

    data object Running : AssetUpload

    data class Done(val mediaId: String) : AssetUpload

    /**
     * The upload failed or was refused. [message] is the server's own
     * words where it gave any, so a refusal that names the file says so
     * rather than reading as a generic fault.
     */
    data class Failed(val message: String) : AssetUpload
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
) {
    val mediaId: String? get() = (upload as? AssetUpload.Done)?.mediaId
}

/**
 * Which sheet is open over the seal (`ComposeLicense`, `ComposePad`).
 * One at a time: each is a drawer the reader opened over the same
 * screen.
 *
 * **`ComposeSensitive` is not here, and that is deliberate.** The
 * contract cannot carry an author's self-mark: `PreparePostInput` has
 * no sensitive field and no mutation sets one — `SENSITIVE` exists only
 * as a read-side `FieldModerationStatus` the server assigns. A sheet
 * that said "Marked" while sending nothing would be a lie told to the
 * one person trusting it, so the board is left unbuilt until the
 * contract can express it. The *reading* half — the whole-body veil —
 * is built and works the moment a verdict exists.
 */
enum class SealSheet { None, License, Stance }

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
    val deviceImages: List<DeviceImage> = emptyList(),
    val shape: DraftShape = DraftShape.Tall,
    /** Which pick the crop step is framing, by index into [picked]. */
    val framingIndex: Int = 0,

    // -- Details --
    val title: String = "",
    val description: String = "",
    val tagSection: TagSectionState = TagSectionState(),
    val referenceSection: ReferenceSectionState = ReferenceSectionState(),

    // -- The seal --
    val license: LicenseChoice = LicenseChoice.PublicDomain,
    /** The author's own attachment to the post (`ComposePad`). */
    val pDirected: Double = DEFAULT_P_DIRECTED,
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

    /** Any drawer open over the current stage. */
    val anySheetOpen: Boolean
        get() = sheet != SealSheet.None || pickedSheetOpen || describingIndex != null

    /** How many picks carry a description — `DescribeCounter`'s count. */
    val describedCount: Int get() = picked.count { it.altText.isNotBlank() }

    /** Uploads still in flight, for `UploadStatusLine`'s "n of m". */
    val uploadsDone: Int get() = uploadedIds.size

    val uploadsRunning: Boolean get() = picked.any { it.upload is AssetUpload.Running }

    val uploadsFailed: Boolean get() = picked.any { it.upload is AssetUpload.Failed }

    /** Every pick has an id: the gallery can be attached as it stands. */
    val uploadsComplete: Boolean get() = picked.isNotEmpty() && uploadedIds.size == picked.size

    /**
     * The body carries something publishable. The XOR is read here
     * rather than validated at submit, so the header's `Next` is the
     * only thing that has to know about it.
     */
    val bodyReady: Boolean
        get() = when (mode) {
            BodyMode.Words -> body.isNotBlank()
            BodyMode.Media -> picked.size in 1..MAX_POST_ASSETS
        }

    /** Whether the media path's crop stage stands between body and details. */
    val hasCropStep: Boolean get() = mode == BodyMode.Media

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
            val bodyNote = when (mode) {
                BodyMode.Words -> "words"
                BodyMode.Media -> pictureCount(picked.size)
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
            when (mode) {
                BodyMode.Words -> body.isNotBlank()
                BodyMode.Media -> uploadsComplete
            }

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
fun ComposeWizardState.pickedPictures(): List<PickedPicture> = picked.map { asset ->
    PickedPicture(
        item = MediaItem(asset.uri, asset.sourceRatio ?: 1f, asset.altText.ifBlank { null }),
        described = asset.altText.isNotBlank(),
        uploading = asset.upload is AssetUpload.Running,
        failed = asset.upload is AssetUpload.Failed,
    )
}

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
        else -> copy(step = WizardStep.Details)
    }
    WizardStep.Crop -> copy(step = WizardStep.Details)
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
    // A sheet is a drawer over the stage: it closes before the stage moves.
    anySheetOpen -> closedSheets()
    step == WizardStep.Body -> null
    step == WizardStep.Crop -> copy(step = WizardStep.Body)
    step == WizardStep.Details ->
        if (hasCropStep) copy(step = WizardStep.Crop) else copy(step = WizardStep.Body)
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
fun ComposeWizardState.togglePick(uri: String, sourceRatio: Float? = null): ComposeWizardState {
    if (picked.any { it.uri == uri }) return removePick(uri)
    if (picked.size >= ComposeWizardState.MAX_POST_ASSETS) return this
    return copy(picked = picked + PickedAsset(uri, sourceRatio))
}

/** Drops a pick from the tray without touching the rest of the order. */
fun ComposeWizardState.removePick(uri: String): ComposeWizardState = copy(
    picked = picked.filterNot { it.uri == uri },
    // The framing cursor must not point past the end after a removal.
    framingIndex = framingIndex.coerceAtMost((picked.size - 2).coerceAtLeast(0)),
    // A sheet describing the removed picture has nothing left to describe.
    describingIndex = null,
)

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

/** Records one asset's upload state without disturbing the others (D5). */
fun ComposeWizardState.withUpload(uri: String, upload: AssetUpload): ComposeWizardState =
    copy(picked = picked.map { if (it.uri == uri) it.copy(upload = upload) else it })

/** Records an asset's own ratio once the pipeline has read it. */
fun ComposeWizardState.withSourceRatio(uri: String, ratio: Float): ComposeWizardState =
    copy(picked = picked.map { if (it.uri == uri) it.copy(sourceRatio = ratio) else it })

/** The alt text one asset carries — authored, never generated (D20). */
fun ComposeWizardState.withAltText(uri: String, text: String): ComposeWizardState =
    copy(picked = picked.map { if (it.uri == uri) it.copy(altText = text) else it })

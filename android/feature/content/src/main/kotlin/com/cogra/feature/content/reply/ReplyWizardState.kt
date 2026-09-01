package com.cogra.feature.content.reply

import com.cogra.core.designsystem.v2.compose.HelpTopic
import com.cogra.core.designsystem.v2.compose.PickedPicture
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.domain.LicenseChoice
import com.cogra.domain.repo.ContentRepository
import com.cogra.feature.content.ReferenceSectionState
import com.cogra.feature.content.TagSectionState
import com.cogra.feature.content.wizard.AssetUpload
import com.cogra.feature.content.wizard.PickedAsset

/**
 * The reply wizard's stages, in the order the canonical boards draw
 * them: `ReplyCompose`/`ReplyPictures` → `ReplySeal`.
 *
 * **Two boards, one stage.** `ReplyCompose` and `ReplyPictures` are the
 * same screen in two states — the second is the first once pictures are
 * in the tray, and every edge they carry in `graph.json` is the same
 * edge (back and X to the thread, `Next` to the seal, the words to
 * themselves). Splitting them into two steps would make "the author
 * removed their last picture" a stage transition, which is not what the
 * boards draw.
 *
 * There is no crop stage: comment pictures never crop
 * (design/readme.md §The media slice), so they upload at pick.
 */
enum class ReplyStep { Compose, Seal }

/**
 * Which drawer is open over the seal (`ComposeLicense`, `ReplyPad`).
 * One at a time: each is a drawer the author opened over the same seal.
 *
 * **There is no `Sensitive`** — jakob 2026-09-01: `ReplySeal`'s "Mark"
 * row (graph.json `via=8`) is not built until a veiled comment has a
 * face, because the row without the veiled result is a switch whose
 * effect nothing draws (design/backlog.md item 25 part 4, which names
 * this lane as the one it blocks). The wire contract keeps its
 * `sensitive` field, defaulted and untouched.
 */
enum class ReplySealSheet { None, License, Stance }

/** Whether the reply answers the post itself or one of its comments. */
enum class ReplyTargetKind { Post, Comment }

/**
 * What the reply answers, as the composer's target card draws it.
 *
 * The card is the same on both entries the thread offers: "Add a
 * comment" pins the post, "Reply" on a comment pins that comment
 * (graph.json `ReplyEntry` 5 and 7). Only [kind] and the labels differ,
 * because `PrepareCommentInput.target` is one id either way.
 */
data class ReplyTarget(
    val id: String,
    val kind: ReplyTargetKind,
    /** The post's title, or the answered comment's opening words. */
    val title: String,
    /** The line under it — the target's own words, clipped to one line. */
    val snippet: String,
    val authorHandle: String,
    val avatarUrl: String? = null,
) {
    /**
     * The seal's act row: "Reply to @ada's post" on the canonical board,
     * and the same sentence about a comment when one is answered.
     */
    val actLabel: String
        get() = when (kind) {
            ReplyTargetKind.Post -> "Reply to @$authorHandle's post"
            ReplyTargetKind.Comment -> "Reply to @$authorHandle's comment"
        }
}

/**
 * How the reply wizard ended.
 *
 * **There is no draft outcome.** Comments keep no drafts (jakob
 * 2026-09-01, "i think we dont need comment drafts"), so leaving
 * discards what was written and the thread is simply where the author
 * lands. The post wizard's `DraftKept` has no counterpart here.
 */
sealed interface ReplyOutcome {
    /** Signed and relaying. [nodeId] is the comment's own id. */
    data class Signed(val nodeId: String) : ReplyOutcome

    /** The author left; the in-progress comment was discarded. */
    data object Left : ReplyOutcome
}

/**
 * Everything the reply wizard's screens read.
 *
 * One immutable value rather than a state per screen, for the reason the
 * post wizard's is: the seal counts acts across topics, references and
 * the body, so a single value is what makes that answerable without one
 * screen reaching into another's state.
 */
data class ReplyWizardState(
    val step: ReplyStep = ReplyStep.Compose,
    /** Null only before the thread has said what is being answered. */
    val target: ReplyTarget? = null,

    // -- The body --
    val body: String = "",
    val picked: List<PickedAsset> = emptyList(),

    // -- The seal --
    val tagSection: TagSectionState = TagSectionState(),
    val referenceSection: ReferenceSectionState = ReferenceSectionState(),
    val license: LicenseChoice = LicenseChoice.PublicDomain,
    /** Enthusiasm — the pad's horizontal axis, For against Against. */
    val pDirected: Double = DEFAULT_P,
    /** Effort — the pad's vertical axis, More against Less. */
    val pInterest: Double = DEFAULT_P,
    val sheet: ReplySealSheet = ReplySealSheet.None,

    /** Which picture `DescribeSheet` is describing, by index into [picked]. */
    val describingIndex: Int? = null,

    /** The screen's one `?` (design/readme.md §13: at most one per screen). */
    val help: HelpTopic? = null,

    // -- Flow state --
    val submitting: Boolean = false,
    /** The device holds no actor key — `ComposeKeyAbsent`. */
    val keyAbsent: Boolean = false,
    /** A refusal that named no field of its own, in the server's words. */
    val refusal: String? = null,
    val signingFailed: Boolean = false,
    val transportFailed: Boolean = false,
    val outcome: ReplyOutcome? = null,
) {
    /** Whether the composer draws its pictures state (`ReplyPictures`). */
    val hasPictures: Boolean get() = picked.isNotEmpty()

    /** Every pick that has an id on the server. */
    val uploadedIds: List<String> get() = picked.mapNotNull { it.mediaId }

    /** Uploads landed, for `UploadStatusLine`'s "n of m". */
    val uploadsDone: Int get() = uploadedIds.size

    val uploadsRunning: Boolean get() = picked.any { it.upload is AssetUpload.Running }

    val uploadsFailed: Boolean get() = picked.any { it.upload is AssetUpload.Failed }

    /** Every pick has an id: the gallery can be attached as it stands. */
    val uploadsComplete: Boolean get() = uploadedIds.size == picked.size

    /** Any drawer open over the current stage. */
    val anySheetOpen: Boolean
        get() = sheet != ReplySealSheet.None || describingIndex != null

    /** How many picks carry a description — `DescribeCounter`'s count. */
    val describedCount: Int get() = picked.count { it.altText.isNotBlank() }

    /** Whether another picture may be picked (`+ Add pictures · n of 4`). */
    val canAddPicture: Boolean get() = picked.size < MAX_PICTURES

    /**
     * A comment is words **plus** optional pictures, deliberately
     * asymmetric to a post's exclusive-or: an answer is words first
     * (D16). So the words alone decide whether the composer may advance
     * — a picture never stands in for them.
     */
    val bodyReady: Boolean get() = body.isNotBlank()

    /**
     * What this submit stages, counted the way the batch is priced —
     * each record its own signed act. A gallery adds none: attaching
     * media mints nothing (api-spec.md `PrepareContentPayload`), which
     * is why the canonical board reads "1 signed action" beside two
     * pictures.
     */
    val signedActionCount: Int
        get() = 1 + tagSection.tags.size + referenceSection.references.size

    /**
     * The seal's caption: `Reply to "The long way home" — 89 characters.`
     */
    val sealSummary: String
        get() {
            val name = target?.title.orEmpty()
            val count = if (body.length == 1) "1 character" else "${body.length} characters"
            return if (name.isBlank()) count else "Reply to \"$name\" — $count"
        }

    /**
     * Whether the seal may be signed. Every pick must have landed an id
     * first — attaching an asset that is still uploading would send a
     * gallery entry naming nothing, which is what `ComposeSealUploading`
     * holds the button for.
     */
    val canSign: Boolean
        get() = !submitting && !keyAbsent && bodyReady && uploadsComplete

    companion object {
        /**
         * api-spec.md `PrepareCommentInput`: at most four per comment
         * (D9). A comment gallery is a supporting picture, not an album
         * — which is why it is four where a post's is ten.
         */
        const val MAX_PICTURES = ContentRepository.MAX_COMMENT_ATTACHMENTS

        /** The low-defaults policy value both parameters start at. */
        const val DEFAULT_P = 0.1
    }
}

/**
 * The picks as the composer's components see them.
 *
 * Mapped here rather than in the design system, which carries no domain
 * dependency (android/CLAUDE.md). Comment pictures never crop, so every
 * item carries its own ratio and no framing.
 */
fun ReplyWizardState.pickedPictures(): List<PickedPicture> = picked.map { asset ->
    PickedPicture(
        item = MediaItem(
            asset.uri,
            asset.sourceRatio ?: 1f,
            asset.altText.ifBlank { null },
        ),
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
 * The `Next` of whichever stage is showing, or null when the stage is
 * not ready to advance. Returning null rather than throwing is what lets
 * the footer disable the pill from the same rule that moves the wizard.
 */
fun ReplyWizardState.advanced(): ReplyWizardState? = when (step) {
    ReplyStep.Compose -> if (bodyReady) copy(step = ReplyStep.Seal) else null
    // The seal advances by signing, never by `Next`.
    ReplyStep.Seal -> null
}

/**
 * One stage back — the header's arrow, the system gesture, and the
 * seal's own `Back` pill alike (graph.json `ReplySeal` 1 and 10 reach
 * the same place).
 *
 * Null where there is no earlier stage to reach, which is what makes the
 * composer the one place back leaves the flow from. Leaving discards:
 * comments keep no drafts.
 */
fun ReplyWizardState.retreated(): ReplyWizardState? = when {
    // A sheet is a drawer over the stage: it closes before the stage moves.
    anySheetOpen -> closedSheets()
    step == ReplyStep.Compose -> null
    else -> copy(step = ReplyStep.Compose)
}

/** Drops every drawer without moving the stage. */
fun ReplyWizardState.closedSheets(): ReplyWizardState =
    copy(sheet = ReplySealSheet.None, describingIndex = null)

/**
 * Adds one pick from the platform picker.
 *
 * A pick past the cap is refused rather than dropped silently, and a
 * second pick of the same asset is ignored: the contract refuses a
 * gallery carrying one twice.
 */
fun ReplyWizardState.addPick(uri: String, sourceRatio: Float? = null): ReplyWizardState {
    if (picked.any { it.uri == uri }) return this
    if (!canAddPicture) return this
    return copy(picked = picked + PickedAsset(uri, sourceRatio))
}

/** Drops a pick from the tray without touching the rest of the order. */
fun ReplyWizardState.removePick(uri: String): ReplyWizardState = copy(
    picked = picked.filterNot { it.uri == uri },
    // A sheet describing the removed picture has nothing left to describe.
    describingIndex = null,
)

/** Records one asset's upload state without disturbing the others (D5). */
fun ReplyWizardState.withUpload(uri: String, upload: AssetUpload): ReplyWizardState =
    copy(picked = picked.map { if (it.uri == uri) it.copy(upload = upload) else it })

/** Records an asset's own ratio once the pipeline has read it. */
fun ReplyWizardState.withSourceRatio(uri: String, ratio: Float): ReplyWizardState =
    copy(picked = picked.map { if (it.uri == uri) it.copy(sourceRatio = ratio) else it })

/** The alt text one asset carries — authored, never generated (D20). */
fun ReplyWizardState.withAltText(uri: String, text: String): ReplyWizardState =
    copy(picked = picked.map { if (it.uri == uri) it.copy(altText = text) else it })

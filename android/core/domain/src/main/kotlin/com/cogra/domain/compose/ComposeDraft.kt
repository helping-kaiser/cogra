// The compose wizard's local draft (design/readme.md §13, canonical
// boards `ComposeDraft` and `ComposeExpired`): what the device keeps
// when a post is not published, so "nothing was spent — your draft is
// saved" is a fact rather than a consolation.

package com.cogra.domain.compose

import com.cogra.domain.Outcome
import com.cogra.domain.StagedWriteView
import com.cogra.domain.WriteState

/**
 * One picked asset as the draft remembers it.
 *
 * The picker's content URI is the identity. It can go stale — the
 * author may delete the photo, or the grant may lapse across a
 * reinstall — so a restored draft has to tolerate an asset that no
 * longer resolves rather than assuming every URI still opens.
 *
 * The framing is deliberately absent: it lives in the crop step's own
 * saveable state for the length of a session, and a restored draft
 * re-centres. Persisting it would mean persisting a viewport geometry
 * whose meaning depends on the screen it was framed on.
 */
data class DraftAsset(
    val uri: String,
    val altText: String = "",
)

/** Which half of the body a draft was authoring — the XOR (D16). */
enum class DraftBodyKind { Words, Media }

/**
 * A post the author started and did not publish.
 *
 * It is one draft per account, not a list: the wizard is a single
 * flow the bottom bar's centre action enters, and a drawer of drafts is
 * a surface nothing has designed. Starting a new post while one is held
 * is exactly what the `ComposeDraft` board asks about.
 */
data class ComposeDraft(
    val bodyKind: DraftBodyKind,
    val body: String = "",
    val title: String = "",
    val description: String = "",
    val assets: List<DraftAsset> = emptyList(),
    /** The post-wide shape, by [com.cogra.domain.compose.DraftShape] name. */
    val shape: DraftShape = DraftShape.Tall,
) {
    /**
     * What the draft card shows as its one line of identity: the title
     * if there is one, otherwise the body's first words, otherwise the
     * honest count.
     */
    val label: String
        get() = title.ifBlank {
            body.lineSequence().firstOrNull()?.take(SUMMARY_CHARS)?.ifBlank { null }
                ?: pictureCount
        }

    val pictureCount: String
        get() = if (assets.size == 1) "1 picture" else "${assets.size} pictures"

    /** Nothing was authored — an empty draft is not worth offering back. */
    val isEmpty: Boolean
        get() = body.isBlank() && title.isBlank() && description.isBlank() && assets.isEmpty()

    private companion object {
        const val SUMMARY_CHARS = 60
    }
}

/**
 * The post-wide shape, named here rather than reusing the design
 * system's `MediaShape` so the domain keeps no Compose dependency. The
 * two are mapped at the screen.
 */
enum class DraftShape { Tall, Square, Wide }

/**
 * The one draft this device holds for the signed-in account.
 *
 * Kept on the device and nowhere else — the `ComposeDraft` board says
 * "kept on this device" in as many words, and an unpublished post is
 * not content the graph has any business carrying.
 */
interface ComposeDraftStore {
    suspend fun draft(): ComposeDraft?

    suspend fun save(draft: ComposeDraft)

    suspend fun clear()
}

/** What became of one staged write, as far as this device can tell right now. */
enum class StagedFate { Landed, Expired, Alive, Unknown }

/**
 * A `stagedWrite(id)` read, as a fate.
 *
 * NULL READS AS EXPIRED: the server deletes a staged write in exactly one
 * place, the reap of rows that already expired (`reap_expired`,
 * postgres-store staged.rs), so a write of this account the server no
 * longer knows was collected unlanded. A read that did not answer says
 * nothing, and nothing is decided on it.
 */
fun fateOf(outcome: Outcome<StagedWriteView?>): StagedFate = when (outcome) {
    is Outcome.Success -> when (outcome.value?.state) {
        null, WriteState.EXPIRED -> StagedFate.Expired
        WriteState.LANDED -> StagedFate.Landed
        else -> StagedFate.Alive
    }
    else -> StagedFate.Unknown
}

/** What a sealed copy's batch asks of it. */
enum class SealVerdict { Restore, Purge, Wait }

/**
 * The batch's verdict from its writes' fates. The post's batch lands
 * together or not at all, so ANY expired write means the post did not
 * land — and a mixed answer restores rather than purges: a restored draft
 * the author does not need is one Discard away, a purged one is gone.
 */
fun sealVerdict(fates: List<StagedFate>): SealVerdict = when {
    fates.any { it == StagedFate.Expired } -> SealVerdict.Restore
    fates.isNotEmpty() && fates.all { it == StagedFate.Landed } -> SealVerdict.Purge
    else -> SealVerdict.Wait
}

/** One staged post's sealed draft. */
data class SealedDraft(
    /** The node the staged post mints. */
    val node: String,
    /** Every write of the staged batch. */
    val writes: List<String>,
    val draft: ComposeDraft,
)

/**
 * The sealed copy (FC-G5, ruled "fix the BUILD, not the board").
 *
 * Once a post's signing is taken its draft stops being a draft (jakob
 * 2026-08-31, "once a post is sent its draft should be gone") — but
 * taken is RELAYING, not LANDED, and `ComposeExpired` promises the draft
 * is kept when the write is collected unlanded later. So the draft is
 * sealed OUT OF THE COMPOSER from staging until the write lands (the copy
 * is purged) or expires (it becomes the kept draft, and `Open the draft`
 * leads with it). It is never offered while its write is alive.
 *
 * It lives where the draft lives and survives what the draft survives,
 * one copy per staged post so a second staging never overwrites a first.
 */
interface SealedDraftStore {
    /**
     * Seals [draft] for a staged batch AND clears the working draft, in
     * one atomic edit: either the copy exists and the draft is gone, or
     * nothing changed.
     */
    suspend fun seal(draft: ComposeDraft, node: String, writes: List<String>)

    /** The copies still waiting on their writes, oldest first. */
    suspend fun sealed(): List<SealedDraft>

    /**
     * Asks after every waiting copy's writes: a landed batch purges its
     * copy, an expired one restores it as the kept draft — only into an
     * empty draft slot, never over a draft started since — and anything
     * still open waits.
     */
    suspend fun settle(fate: suspend (writeId: String) -> StagedFate)
}

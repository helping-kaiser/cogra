// The compose wizard's local draft (design/readme.md §13, canonical
// boards `ComposeDraft` and `ComposeExpired`): what the device keeps
// when a post is not published, so "nothing was spent — your draft is
// saved" is a fact rather than a consolation.

package com.cogra.domain.compose

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

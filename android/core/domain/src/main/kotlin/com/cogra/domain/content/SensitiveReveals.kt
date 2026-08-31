package com.cogra.domain.content

import com.cogra.domain.FieldStatus
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/**
 * The sensitive state of one node's body, as a reader's choice was made
 * against it.
 *
 * D12 makes the veil cover the body as a unit — media, words and
 * description together — so the mark is the three statuses that feed it
 * and nothing else. Comparing marks is how a reveal learns it has gone
 * stale: an edit that re-marks the body, or a moderation mark appearing
 * where there was none, changes at least one of these.
 */
data class SensitiveMark(
    val content: FieldStatus,
    val description: FieldStatus?,
    val attachments: FieldStatus,
) {
    /** Whether this mark veils the body at all. */
    val isSensitive: Boolean
        get() = content == FieldStatus.SENSITIVE ||
            description == FieldStatus.SENSITIVE ||
            attachments == FieldStatus.SENSITIVE
}

/**
 * Which veiled bodies this reader has chosen to look at.
 *
 * Three properties, all of them ruled (jakob 2026-08-31):
 *
 * - **Per node, per session.** A choice is about one piece of content,
 *   and it is not written anywhere — closing the app puts every veil
 *   back, which is what makes the veil mean anything.
 * - **Shared across surfaces.** Revealing in the feed carries into the
 *   detail and back. A reader who has already decided should not be
 *   asked again by the next screen; being asked twice reads as the app
 *   forgetting rather than as care.
 * - **Reset when the node's sensitive state changes.** The reveal is
 *   remembered *against the mark it was made under*, so an edit that
 *   re-marks a body, or a moderation mark arriving on one that had
 *   none, veils it again. A consent given about one thing is not
 *   consent about a different one.
 *
 * In memory and app-wide, on the `LandingSignal` pattern: a plain
 * `@Singleton` Hilt builds, holding a `StateFlow` every surface's
 * ViewModel folds into its own state.
 */
@Singleton
class SensitiveReveals @Inject constructor() {

    private val _revealed = MutableStateFlow<Map<String, SensitiveMark>>(emptyMap())

    /** Each revealed node, against the mark it was revealed under. */
    val revealed: StateFlow<Map<String, SensitiveMark>> = _revealed.asStateFlow()

    /** Records that the reader chose to look at [nodeId] as it stands. */
    fun reveal(nodeId: String, mark: SensitiveMark) {
        _revealed.update { it + (nodeId to mark) }
    }
}

/**
 * Whether [nodeId]'s body should be shown rather than veiled.
 *
 * The comparison — not merely "is it in the map" — is what makes the
 * reset automatic: a node whose mark has moved on since the reveal is
 * simply not found, so nothing has to notice the change and clear it.
 */
fun Map<String, SensitiveMark>.isRevealed(nodeId: String, mark: SensitiveMark): Boolean =
    this[nodeId] == mark

// WHAT A KEPT PICK'S ROW NAMES ITS TARGET BY (KeptPicksReview.md,
// KeptPicksSeal.md; `StagedReference`'s `kind`, `name`, `src` and `removed`).
// A kept pick holds only its target and its kind, so the review reads each
// target's LIVE PREVIEW when it opens rather than a snapshot taken at the
// keep. web's twin is `web/src/lib/stance/kept-preview.ts`.
//
// A TARGET REMOVED WHILE ITS PICK WAITED keeps its row: nothing leaves the
// graph, so the pick still signs, but the row wears the removed-mark face in
// place of a live preview (KeptPicksReview.md:11). A target whose read gets
// no answer keeps its row too, named by its kind alone (:15).

package com.cogra.domain.stance

import com.cogra.domain.Outcome
import com.cogra.domain.RemovalAgent
import com.cogra.domain.saved.DELETED_ACCOUNT
import com.cogra.domain.saved.REMOVED_BY_AUTHOR
import com.cogra.domain.saved.REMOVED_BY_THE_PLATFORM

/** A kept pick's target as its row and its seal row name it. */
data class KeptPreview(
    val kind: StanceKind,
    /** What the pick is on, in the reader's words (`The long way home — @ada`, `Mira Voss`, `saltmaps`). */
    val name: String,
    /** A post's cover or a person's picture, for the mark; null draws the kind's own. */
    val src: String? = null,
    /** The removal mark, standing where the name stood; null for a live target. */
    val removed: String? = null,
)

/** The kept picks' live reads, one small read per root (api-spec.md "Removal"). */
interface KeptPreviewRepository {
    /**
     * [target]'s preview. [kind] names the root to ask where it is known;
     * null probes the roots a node can be (post, comment, person).
     */
    suspend fun preview(target: StanceTarget, kind: StanceKind?): Outcome<KeptPreview>
}

/** A comment with no words of its own, and a target no read reached (KeptPicksReview.md:15-17). */
const val KEPT_A_POST = "A post"
const val KEPT_A_COMMENT = "A comment"
const val KEPT_A_PERSON = "A person"

/**
 * A removal's mark in the system's voice (copy-voice, *The kept picks'
 * review*): AUTHOR and ACCOUNT read `Removed by its author`, a moderation
 * verdict `Removed under the platform's rules`.
 */
fun removalMark(by: RemovalAgent?): String? = when (by) {
    null -> null
    RemovalAgent.MODERATION -> REMOVED_BY_THE_PLATFORM
    else -> REMOVED_BY_AUTHOR
}

/** A deleted account's row reads its mark where the name stood. */
const val KEPT_DELETED_ACCOUNT = DELETED_ACCOUNT

/**
 * The row of a target whose read did not answer: the pick is real, so it
 * keeps its row, named by its kind alone until a read does. A topic is its
 * own name and needs no read. A kind no read ever learned is named as a post
 * (named in the PR as a deviation candidate: no board draws an unknown kind).
 */
fun fallbackPreview(target: StanceTarget, kind: StanceKind?): KeptPreview = when {
    target is StanceTarget.Topic -> KeptPreview(StanceKind.TOPIC, target.name)
    kind == StanceKind.COMMENT -> KeptPreview(StanceKind.COMMENT, KEPT_A_COMMENT)
    kind == StanceKind.PERSON -> KeptPreview(StanceKind.PERSON, KEPT_A_PERSON)
    else -> KeptPreview(StanceKind.POST, KEPT_A_POST)
}

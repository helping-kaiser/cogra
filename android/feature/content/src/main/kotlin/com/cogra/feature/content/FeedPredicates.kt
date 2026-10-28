// THE POST-RANK PREDICATES (ranked-feed packet CD-4: "forms, sensitive,
// removed and hidden, one predicate set"; feed-ranking.md §9.1, "hard
// exclusions are post-rank frontend filters"). What the sheet's Kinds of post
// and Also show chips cut from a derived list, read off a HYDRATED card — the
// ranking names a row's id and kind, and only its card says what form it
// takes, whether it is veiled, or whether its payload has gone. web's twin is
// `web/src/lib/feed/feed-predicates.ts`.
//
// Each applies where it means something:
// - KINDS OF POST to a post and a comment, the two kinds that carry a body
//   (FeedFilter.jsx: "Applies once posts or comments are in"). Words alone are
//   text, a clip anywhere makes it video, pictures make it photos.
// - SENSITIVE to a post and a comment whose body is veiled. Off, the feed
//   admits none (FeedSheet.md:43); on, they stand veiled the Settings way.
// - REMOVED to a post and a comment whose payload went — keyed on the node's
//   own `removal` first ([PostView.removed]). Off, the feed admits none; on,
//   each stands as its mark.
// A person and a topic carry none of these, so no chip here cuts them.
//
// Hidden people are the fourth predicate, and stay the screen's own: a hide's
// Undo must put a row back where it stood, so the list keeps hidden rows and
// the screen draws past them (hidden-actors §4.4).

package com.cogra.feature.content

import com.cogra.domain.MediaAssetView
import com.cogra.domain.feed.FeedCard
import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.feed.FeedForm
import com.cogra.domain.removal.Removal
import com.cogra.domain.removal.marked

/** The form a body takes: a clip anywhere is video, pictures photos, none text. */
internal fun formOf(attachments: List<MediaAssetView>): FeedForm = when {
    attachments.isEmpty() -> FeedForm.TEXT
    attachments.any { it.mimeType.startsWith("video/") } -> FeedForm.VIDEO
    else -> FeedForm.PHOTOS
}

/** Whether this filter admits the hydrated [card] (CD-4). */
internal fun FeedFilter.admits(card: FeedCard): Boolean = when (card) {
    is FeedCard.Post -> card.post.run {
        admitsBody(removed, isSensitive(content, description, attachmentsStatus), attachments)
    }
    is FeedCard.Comment -> card.comment.run {
        admitsBody(removed, isSensitive(content, null, attachmentsStatus), attachments)
    }
    is FeedCard.Person, is FeedCard.Tag -> true
}

private fun FeedFilter.admitsBody(removed: Boolean, sensitive: Boolean, attachments: List<MediaAssetView>): Boolean =
    when {
        // A removed body has no form and no veil left to read: Removed alone decides it.
        removed -> showRemoved
        sensitive && !showSensitive -> false
        else -> formOf(attachments) in forms
    }

/**
 * The card as this device knows it now: a removal taken since it was read —
 * here or on any other surface — stands as its mark (RM-G9).
 */
internal fun FeedCard.marked(marks: Map<String, Removal>): FeedCard = when (this) {
    is FeedCard.Post -> post.marked(marks).let { if (it === post) this else FeedCard.Post(it) }
    is FeedCard.Comment -> comment.marked(marks).let { if (it === comment) this else copy(comment = it) }
    is FeedCard.Person, is FeedCard.Tag -> this
}

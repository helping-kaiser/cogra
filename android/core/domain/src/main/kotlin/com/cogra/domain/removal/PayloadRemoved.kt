// WHETHER A NODE'S PAYLOAD WENT, AND WHETHER THE FEED'S FILTER ADMITS IT —
// the one reading every surface shares: the feed's post-rank cut and the tag
// page that follows the feed's Removed switch (TagPage.md:19-21). web's twin is
// `admitsRemoved` in `web/src/lib/feed/feed-predicates.ts`.

package com.cogra.domain.removal

import com.cogra.domain.CommentView
import com.cogra.domain.FieldStatus
import com.cogra.domain.MediaAssetView
import com.cogra.domain.ModeratedField
import com.cogra.domain.PostView
import com.cogra.domain.feed.FeedFilter

/**
 * Whether the whole body is gone.
 *
 * A words post is removed when its `content` is REDACTED; a media post
 * when its gallery is. UNKNOWN counts as removed on both: a state this
 * build cannot name is never rendered as if it were fine.
 */
fun payloadRemoved(
    content: ModeratedField,
    attachments: List<MediaAssetView>,
    attachmentsStatus: FieldStatus,
): Boolean {
    val galleryGone = attachments.isNotEmpty() &&
        (attachmentsStatus.gone() || attachments.all { it.status.gone() })
    val wordsGone = attachments.isEmpty() && content.status.gone()
    return galleryGone || wordsGone
}

/** Whether the post's whole payload is gone: its own mark, or every field it answers. */
val PostView.payloadRemoved: Boolean
    get() = removal != null || payloadRemoved(content, attachments, attachmentsStatus)

/** Whether the comment's whole payload is gone, as [PostView.payloadRemoved]. */
val CommentView.payloadRemoved: Boolean
    get() = removal != null || payloadRemoved(content, attachments, attachmentsStatus)

/** Whether this filter's `Also show → Removed` admits [post]: off, no removed post stands. */
fun FeedFilter.admitsRemoved(post: PostView): Boolean = showRemoved || !post.payloadRemoved

/** Whether this filter's `Also show → Removed` admits [comment], as a post's. */
fun FeedFilter.admitsRemoved(comment: CommentView): Boolean = showRemoved || !comment.payloadRemoved

private fun FieldStatus.gone(): Boolean = this == FieldStatus.REDACTED || this == FieldStatus.UNKNOWN

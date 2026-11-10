// THE THING THE SCORE BELONGS TO, held above all four levels of its trace
// (`_shared.jsx` ScoreOrigin; FeedEntryKinds.md:5-7): one top block per kind,
// in the words its own card already uses (`QuotedRow`'s rule) —
//
// - a post by its title and its author's handle, over how it starts;
// - a comment by its author's handle over its first words;
// - a person by their name over their handle;
// - a tag by its name beside its `#` tile.
//
// A SENSITIVE THING SHOWS ITS ADDRESS ONLY, never its body (SR-G17's build
// reading: the whole-body veil); A REMOVED ONE ITS MARK'S OWN WORDS in the
// body's place — the removed words never reach a cover. The web's twin is
// `web/src/lib/score/cover.ts`.
//
// The card hands it to the trace at the tap ("held, not re-read",
// score-readout §7), so the trace never reads its own thing again.

package com.cogra.feature.content

import com.cogra.core.designsystem.v2.media.headline
import com.cogra.domain.CommentView
import com.cogra.domain.FieldStatus
import com.cogra.domain.ModeratedField
import com.cogra.domain.PostView
import com.cogra.domain.ProfileView
import com.cogra.domain.score.TraceThingKind
import java.time.Instant

/**
 * One cover: [title] over [snippet], led by the person's disc ([discName],
 * [discSrc]) — a tag wears its `#` tile instead — with [markSrc] the picture
 * the trace's end mark wears, and [createdAt] the thing's own age.
 */
data class TraceCover(
    val kind: TraceThingKind,
    val title: String,
    val snippet: String?,
    val discName: String?,
    val discSrc: String?,
    val markSrc: String?,
    val createdAt: Instant?,
)

private fun ModeratedField.words(): String? =
    value?.trim()?.takeIf { it.isNotEmpty() && status != FieldStatus.REDACTED }

/** A post's cover: `The long way home — @ada` over how it starts. */
internal fun postCover(post: PostView): TraceCover {
    val handle = post.author?.handle?.let { "@$it" } ?: "Deleted account"
    val removed = post.removed
    val sensitive = isSensitive(post.content, post.description, post.attachmentsStatus)
    val title = if (removed) null else post.title.words()
    val lead = post.attachments.firstOrNull()
    val picture = lead?.let { if (it.mimeType.startsWith("video/")) it.cover?.url else it.url }
    return TraceCover(
        kind = TraceThingKind.POST,
        title = if (title == null) handle else "$title — $handle",
        snippet = when {
            removed -> removalReason(post.removal, post.moderation).headline()
            sensitive -> null
            else -> post.content.words() ?: post.description.words()
        },
        discName = post.author?.let { it.displayName ?: it.handle }.orEmpty(),
        discSrc = post.author?.avatar?.url,
        markSrc = picture.takeUnless { removed || sensitive },
        createdAt = post.createdAt,
    )
}

/** A comment's cover: its author's handle over its first words. */
internal fun commentCover(comment: CommentView): TraceCover {
    val removed = comment.removed
    return TraceCover(
        kind = TraceThingKind.COMMENT,
        title = comment.author?.handle?.let { "@$it" } ?: "Deleted account",
        snippet = when {
            removed -> removalReason(comment.removal, comment.moderation).headline()
            isSensitive(comment.content, null, comment.attachmentsStatus) -> null
            else -> comment.content.words()
        },
        discName = comment.author?.let { it.displayName ?: it.handle }.orEmpty(),
        discSrc = comment.author?.avatar?.url,
        markSrc = null,
        createdAt = comment.createdAt,
    )
}

/** A person's cover: their name over their handle. */
internal fun personCover(profile: ProfileView): TraceCover {
    // A deleted account is quoted as the system names it (SR-G12), its handle gone with it.
    if (profile.deleted) {
        return TraceCover(TraceThingKind.PERSON, "Deleted account", null, "", null, null, null)
    }
    val handle = "@${profile.handle}"
    val name = profile.displayName.words()
    return TraceCover(
        kind = TraceThingKind.PERSON,
        title = name ?: handle,
        snippet = handle,
        discName = name ?: profile.handle,
        discSrc = profile.avatar?.url,
        markSrc = profile.avatar?.url,
        createdAt = null,
    )
}

/** A tag's cover: its name beside its `#` tile. */
internal fun topicCover(name: String): TraceCover = TraceCover(
    kind = TraceThingKind.TOPIC,
    title = "#$name",
    snippet = null,
    discName = null,
    discSrc = null,
    markSrc = null,
    createdAt = null,
)

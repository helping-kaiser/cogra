// The kept picks' live previews over the real contract (`kept.graphql`): one
// small read per root, the root the kept kind names — or, for a pick whose kind
// no read had learned when it was kept, the stance reads' own probe order
// (post, comment, person). web's twin is `web/src/lib/stance/kept-preview.ts`.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.ModeratedField
import com.cogra.domain.Outcome
import com.cogra.domain.map
import com.cogra.domain.saved.postTitle
import com.cogra.domain.stance.KEPT_A_COMMENT
import com.cogra.domain.stance.KEPT_DELETED_ACCOUNT
import com.cogra.domain.stance.KeptPreview
import com.cogra.domain.stance.KeptPreviewRepository
import com.cogra.domain.stance.StanceKind
import com.cogra.domain.stance.StanceTarget
import com.cogra.domain.stance.removalMark
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.KeptPickCommentQuery
import com.cogra.network.graphql.KeptPickPostQuery
import com.cogra.network.graphql.KeptPickProfileQuery
import com.cogra.network.graphql.type.FieldModerationStatus
import com.cogra.network.toDomain
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class KeptPreviewRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : KeptPreviewRepository {

    override suspend fun preview(target: StanceTarget, kind: StanceKind?): Outcome<KeptPreview> {
        if (target is StanceTarget.Topic) return Outcome.Success(KeptPreview(StanceKind.TOPIC, target.name))
        val id = (target as StanceTarget.Node).id
        val order = kind?.let { listOf(it) } ?: PROBE
        for (root in order) {
            when (val read = read(root, id)) {
                is Outcome.Success -> read.value?.let { return Outcome.Success(it) }
                is Outcome.Refused -> return Outcome.Refused(read.errors)
                is Outcome.Failed -> return Outcome.Failed(read.cause)
            }
        }
        return Outcome.Failed(IllegalStateException("no root holds the kept pick's target"))
    }

    private suspend fun read(kind: StanceKind, id: String): Outcome<KeptPreview?> = guard.run {
        when (kind) {
            StanceKind.POST -> client.query(KeptPickPostQuery(id)).fetch().map { it.post?.let(::postPreview) }
            StanceKind.COMMENT -> client.query(KeptPickCommentQuery(id)).fetch().map {
                it.comment?.let(::commentPreview)
            }
            StanceKind.PERSON -> client.query(KeptPickProfileQuery(id)).fetch().map { it.user?.let(::profilePreview) }
            StanceKind.TOPIC -> Outcome.Success(null)
        }
    }

    private companion object {
        /** The stance reads' probe order: a post is what a feed is made of. */
        val PROBE = listOf(StanceKind.POST, StanceKind.COMMENT, StanceKind.PERSON)
    }
}

private val REDACTED = FieldModerationStatus.REDACTED

/** ` — @ada`, or nothing where the author is unknown. */
private fun byline(handle: String?): String = handle?.let { " — @$it" }.orEmpty()

/** A post's row: its title (or B11's stand-in) and its author, its cover as the tile. */
internal fun postPreview(post: KeptPickPostQuery.Post): KeptPreview {
    val handle = post.author?.handle
    val title = postTitle(
        title = ModeratedField(post.title.value, post.title.status.toDomain()),
        content = ModeratedField(post.content.value, post.content.status.toDomain()),
        mimeTypes = post.attachments.map { it.mimeType },
        handle = handle,
    )
    val lead = post.attachments.firstOrNull()
    val cover = when {
        lead == null -> null
        lead.mimeType.startsWith("video/") -> lead.coverMedia?.takeIf { it.status != REDACTED }?.url
        lead.status == REDACTED -> null
        else -> lead.url
    }
    return KeptPreview(
        kind = StanceKind.POST,
        name = "$title${byline(handle)}",
        src = cover,
        removed = removalMark(post.removal?.by?.toDomain()),
    )
}

/** A comment's row: its first line and its author — `A comment` with no words of its own (:17). */
internal fun commentPreview(comment: KeptPickCommentQuery.Comment): KeptPreview {
    val words = comment.content.value?.trim().orEmpty()
    val first = words.lineSequence().firstOrNull()?.trim().orEmpty()
    return KeptPreview(
        kind = StanceKind.COMMENT,
        name = "${first.ifEmpty { KEPT_A_COMMENT }}${byline(comment.author?.handle)}",
        removed = removalMark(comment.removal?.by?.toDomain()),
    )
}

/** A person's row: their name, or their handle; a deleted account reads its mark. */
internal fun profilePreview(user: KeptPickProfileQuery.User): KeptPreview {
    val deleted = user.displayName.status == REDACTED
    val name = user.displayName.value?.trim().orEmpty()
    return KeptPreview(
        kind = StanceKind.PERSON,
        name = name.ifEmpty { "@${user.handle}" },
        src = user.avatar?.takeIf { !deleted && it.status != REDACTED }?.url,
        removed = KEPT_DELETED_ACCOUNT.takeIf { deleted },
    )
}

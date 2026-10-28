// The ranked feed over the real contract (api-spec.md `feedRanking`,
// `feed`). The device's derive is the domain's (`FeedDerive`); this only
// carries the answer across, field for field.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.CograLog
import com.cogra.domain.ModeratedField
import com.cogra.domain.Outcome
import com.cogra.domain.PostView
import com.cogra.domain.feed.FeedCard
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.feed.FeedRankArgs
import com.cogra.domain.feed.FeedRanking
import com.cogra.domain.feed.FeedRepository
import com.cogra.domain.feed.MAX_CARDS_WINDOW
import com.cogra.domain.feed.MAX_FEED_WINDOW
import com.cogra.domain.feed.PeopleMark
import com.cogra.domain.feed.RankedEntry
import com.cogra.domain.feed.SettlingRow
import com.cogra.domain.history.TAG_GLIMPSE_LIMIT
import com.cogra.domain.history.TagCardTopic
import com.cogra.domain.history.TaggedGlimpse
import com.cogra.domain.history.taggedComment
import com.cogra.domain.history.taggedPost
import com.cogra.domain.map
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.FeedCardsQuery
import com.cogra.network.graphql.FeedRankingQuery
import com.cogra.network.graphql.FeedWindowQuery
import com.cogra.network.graphql.fragment.TagCardFields
import com.cogra.network.graphql.type.NodeKind
import com.cogra.network.toDomain
import javax.inject.Inject
import javax.inject.Singleton
import com.cogra.network.graphql.type.PeopleMark as WireMark

@Singleton
class FeedRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : FeedRepository {

    // Public-graph reads; they ride the guard so a signed-in reader's
    // stale token refreshes rather than reading as a guest.
    override suspend fun ranking(viewer: String, args: FeedRankArgs): Outcome<FeedRanking?> = guard.run {
        client.query(
            FeedRankingQuery(
                viewer = viewer,
                // Sent explicitly, in a stable order: "null means Posts
                // only" is the server's default, never this client's.
                kinds = Optional.present(FeedKind.entries.filter { it in args.kinds }.map { it.toWire() }),
                topic = Optional.presentIfNotNull(args.topic),
            ),
        )
            .fetch()
            .map { data -> data.feedRanking?.toFeedRanking() }
    }

    override suspend fun window(ids: List<String>): Outcome<List<PostView>> {
        require(ids.size <= MAX_FEED_WINDOW) { "a window carries at most $MAX_FEED_WINDOW ids" }
        if (ids.isEmpty()) return Outcome.Success(emptyList())
        return guard.run {
            client.query(FeedWindowQuery(ids = ids, first = ids.size))
                .fetch()
                .map { data ->
                    data.feed.edges.mapNotNull { edge ->
                        edge.node.onPost?.let { post ->
                            post.postFields.toDomain().copy(commentCount = post.commentCount.totalCount)
                        }
                    }
                }
        }
    }

    override suspend fun cards(ids: List<String>): Outcome<List<FeedCard>> {
        require(ids.size <= MAX_CARDS_WINDOW) { "a cards read carries at most $MAX_CARDS_WINDOW ids" }
        if (ids.isEmpty()) return Outcome.Success(emptyList())
        return guard.run {
            client.query(FeedCardsQuery(ids = ids))
                .fetch()
                .map { data -> data.feed.edges.mapNotNull { it.node.toCard() } }
        }
    }
}

private fun FeedRankingQuery.FeedRanking.toFeedRanking() = FeedRanking(
    asOfEpoch = asOfEpoch,
    // A kind this build cannot name is dropped with its row: the device
    // cannot render it, and dropping deletes without re-ordering.
    entries = entries.mapNotNull { e ->
        e.kind.toFeedKind()?.let { kind ->
            RankedEntry(e.targetId, kind, e.score, e.mark?.toPeopleMark(), e.newestIndex)
        }
    },
    settling = settling.mapNotNull { s ->
        s.kind.toFeedKind()?.let { kind ->
            SettlingRow(s.targetId, kind, s.mark?.toPeopleMark(), s.rankedPosition, s.newestPosition)
        }
    },
)

internal fun FeedKind.toWire(): NodeKind = when (this) {
    FeedKind.POST -> NodeKind.POST
    FeedKind.COMMENT -> NodeKind.COMMENT
    FeedKind.PROFILE -> NodeKind.USER
    FeedKind.TAG -> NodeKind.HASHTAG
}

private fun NodeKind.toFeedKind(): FeedKind? = when (this) {
    NodeKind.POST -> FeedKind.POST
    NodeKind.COMMENT -> FeedKind.COMMENT
    NodeKind.USER -> FeedKind.PROFILE
    NodeKind.HASHTAG -> FeedKind.TAG
    else -> {
        CograLog.w(TAG) { "a feed row of kind $this; dropped" }
        null
    }
}

/** An unknown future mark reads as none: Your people admits it under no sign, never wrongly. */
private fun WireMark.toPeopleMark(): PeopleMark? = when (this) {
    WireMark.FOR -> PeopleMark.FOR
    WireMark.AGAINST -> PeopleMark.AGAINST
    WireMark.SIGNLESS -> PeopleMark.SIGNLESS
    else -> null
}

private const val TAG = "FeedRepository"

/** A comment, a person or a topic as its own feed card reads it; a kind a later slice adds waits. */
private fun FeedCardsQuery.Node.toCard(): FeedCard? {
    onComment?.let { comment ->
        return FeedCard.Comment(
            comment = comment.commentFields.toDomain(),
            target = comment.target?.commentHeadFields?.toTarget(),
            threadPostId = comment.post?.id,
        )
    }
    onUser?.let { user -> return FeedCard.Person(user.profileFields.toDomain()) }
    onHashtag?.let { tag -> return FeedCard.Tag(tag.tagCardFields.toTopic()) }
    return null
}

private const val REDACTED_STATUS = "REDACTED"

/** A topic as the tag card draws it: its name and the newest things carrying it. */
internal fun TagCardFields.toTopic(): TagCardTopic = TagCardTopic(
    id = id,
    name = ModeratedField(name.value, name.status.toDomain()),
    tagged = taggedContent.mapNotNull { glimpseOf(it.node) }.take(TAG_GLIMPSE_LIMIT),
)

/** A tagged thing as the tag card's glimpse names it. */
private fun glimpseOf(node: TagCardFields.Node): TaggedGlimpse? {
    node.onPost?.let { post ->
        val lead = post.attachments.firstOrNull()?.takeIf { it.status.rawValue != REDACTED_STATUS }
        // The mark: a picture's own frame, or a clip's still.
        val cover = when {
            lead == null -> null
            lead.mimeType.startsWith("video/") ->
                lead.coverMedia?.takeIf { it.status.rawValue != REDACTED_STATUS }?.url
            else -> lead.url
        }
        return taggedPost(
            id = post.id,
            title = ModeratedField(post.title.value, post.title.status.toDomain()),
            content = ModeratedField(post.content.value, post.content.status.toDomain()),
            mimeTypes = post.attachments.map { it.mimeType },
            coverUrl = cover,
            authorHandle = post.author?.handle,
            createdAt = post.createdAt,
        )
    }
    node.onComment?.let { comment ->
        return taggedComment(
            id = comment.id,
            content = ModeratedField(comment.content.value, comment.content.status.toDomain()),
            authorHandle = comment.author?.handle,
            createdAt = comment.createdAt,
        )
    }
    return null
}

// The ranked feed over the real contract (api-spec.md `feedRanking`,
// `feed`). The device's derive is the domain's (`FeedDerive`); this only
// carries the answer across, field for field.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.CograLog
import com.cogra.domain.Outcome
import com.cogra.domain.PostView
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.feed.FeedRankArgs
import com.cogra.domain.feed.FeedRanking
import com.cogra.domain.feed.FeedRepository
import com.cogra.domain.feed.MAX_FEED_WINDOW
import com.cogra.domain.feed.PeopleMark
import com.cogra.domain.feed.RankedEntry
import com.cogra.domain.feed.SettlingRow
import com.cogra.domain.map
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.FeedRankingQuery
import com.cogra.network.graphql.FeedWindowQuery
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

private fun FeedKind.toWire(): NodeKind = when (this) {
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

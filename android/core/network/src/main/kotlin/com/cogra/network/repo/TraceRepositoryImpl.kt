// The score's trace over the real contract (api-spec.md `feedTrace`, `nodes`;
// score-readout packet §7): carried field for field — the words and the
// add-up rendering are the domain's (`TraceWords.kt`), never this layer's.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.Outcome
import com.cogra.domain.score.TraceAnswer
import com.cogra.domain.score.TraceFamily
import com.cogra.domain.score.TraceFetch
import com.cogra.domain.score.TraceHop
import com.cogra.domain.score.TraceLeg
import com.cogra.domain.score.TraceLegRole
import com.cogra.domain.score.TraceNamed
import com.cogra.domain.score.TraceNode
import com.cogra.domain.score.TraceNodeKind
import com.cogra.domain.score.TracePath
import com.cogra.domain.score.TracePerson
import com.cogra.domain.score.TraceRecord
import com.cogra.domain.score.TraceRepository
import com.cogra.network.GraphQlFaultException
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.FeedTraceQuery
import com.cogra.network.graphql.TraceNamesQuery
import com.cogra.network.graphql.type.NodeKind
import com.cogra.network.graphql.type.RecordFamily
import com.cogra.network.graphql.type.RecordLegRole
import javax.inject.Inject
import javax.inject.Singleton

/** The most ids one `nodes` lookup carries (the page budget). */
private const val MAX_NAMES = 100

@Singleton
class TraceRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : TraceRepository {

    // Public reads; they ride the guard so a signed-in reader's stale token
    // refreshes rather than reading as a guest. The client keeps no
    // normalized cache, so every open is a real fetch (PR-39).
    override suspend fun trace(viewer: String, target: String): TraceFetch =
        when (val read = guard.run { client.query(FeedTraceQuery(viewer = viewer, target = target)).fetch() }) {
            is Outcome.Success -> TraceFetch.Answered(read.value.feedTrace?.toAnswer())
            is Outcome.Refused -> TraceFetch.Fault
            // AN ANSWER THAT IS AN ERROR — the relay's INTERNAL, the ranker
            // down — is the house's "didn't go through"; no answer at all is
            // the connection line (copy-voice; score-readout §5.6).
            is Outcome.Failed -> if (read.cause is GraphQlFaultException) TraceFetch.Fault else TraceFetch.Offline
        }

    override suspend fun names(ids: List<String>): Map<String, TraceNamed> {
        val named = HashMap<String, TraceNamed>()
        for (page in ids.distinct().chunked(MAX_NAMES)) {
            val read = guard.run { client.query(TraceNamesQuery(ids = page)).fetch() }
            val nodes = (read as? Outcome.Success)?.value?.nodes ?: continue
            for (node in nodes.filterNotNull()) {
                node.onPost?.let { named[it.id] = TraceNamed.Post(it.id, it.title.value, it.author?.handle) }
                node.onComment?.let { named[it.id] = TraceNamed.Comment(it.id, it.author?.handle) }
            }
        }
        return named
    }
}

private fun FeedTraceQuery.FeedTrace.toAnswer() = TraceAnswer(
    score = score,
    paths = paths.map { path ->
        TracePath(
            nodes = path.nodes.map { TraceNode(it.graphId, it.id, it.kind?.toTraceKind()) },
            sign = path.sign,
            contribution = path.contribution,
            hops = path.hops.map { hop ->
                TraceHop(
                    pDirected = hop.pDirected,
                    pInterest = hop.pInterest,
                    records = hop.records.map { record ->
                        TraceRecord(
                            id = record.id,
                            family = record.family.toTraceFamily(),
                            author = record.author?.let { author ->
                                TracePerson(author.id, author.handle, author.displayName.value, author.avatar?.url)
                            },
                            landedAt = record.landedAt,
                            legs = record.legs.map { leg ->
                                val role = leg.role.toTraceRole()
                                TraceLeg(role, leg.sourceId, leg.targetId, leg.pDirected, leg.pInterest)
                            },
                        )
                    },
                )
            },
        )
    },
)

private fun NodeKind.toTraceKind(): TraceNodeKind = when (this) {
    NodeKind.USER -> TraceNodeKind.USER
    NodeKind.POST -> TraceNodeKind.POST
    NodeKind.COMMENT -> TraceNodeKind.COMMENT
    NodeKind.HASHTAG -> TraceNodeKind.HASHTAG
    else -> TraceNodeKind.OTHER
}

private fun RecordFamily.toTraceFamily(): TraceFamily = when (this) {
    RecordFamily.OPINION -> TraceFamily.OPINION
    RecordFamily.PUBLISH -> TraceFamily.PUBLISH
    RecordFamily.REVIEW -> TraceFamily.REVIEW
    RecordFamily.REFERENCE -> TraceFamily.REFERENCE
    RecordFamily.TAG -> TraceFamily.TAG
    RecordFamily.AFFINITY -> TraceFamily.AFFINITY
    else -> TraceFamily.OTHER
}

private fun RecordLegRole.toTraceRole(): TraceLegRole = when (this) {
    RecordLegRole.A -> TraceLegRole.A
    RecordLegRole.T -> TraceLegRole.T
    else -> TraceLegRole.BINARY
}

// WHAT CITES A NODE over the real contract (`references.graphql`
// `CitingRecords`): the whole terminal-anchored reference set, read 100 at a
// time and folded into one row per standing citation (`CitingFold.kt`). The
// web's twin is `fetchCitingArtifacts` in `web/src/lib/api/references-api.ts`,
// with the row's naming from `citingView` in `cited-by-sheet.tsx`.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.ModeratedField
import com.cogra.domain.Outcome
import com.cogra.domain.map
import com.cogra.domain.references.CitedByRepository
import com.cogra.domain.references.CitingArtifact
import com.cogra.domain.references.CitingKind
import com.cogra.domain.references.CitingRecord
import com.cogra.domain.references.CitingView
import com.cogra.domain.references.foldCitingArtifacts
import com.cogra.domain.saved.postTitle
import com.cogra.domain.stance.removalMark
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.CitingRecordsQuery
import com.cogra.network.graphql.type.FieldModerationStatus
import com.cogra.network.toDomain
import javax.inject.Inject
import javax.inject.Singleton

/** How many pages the whole set may take before the read stops (100 records apiece) — the web's bound. */
internal const val MAX_CITING_PAGES = 50

@Singleton
class CitedByRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : CitedByRepository {

    /**
     * Reads the whole set, then folds it: a failed page fails the read, since
     * half a bundle would net to the wrong pair or show a withdrawn citation.
     */
    override suspend fun citedBy(nodeId: String): Outcome<List<CitingArtifact<CitingView>>> = guard.run {
        val records = mutableListOf<CitingRecord<CitingView>>()
        var after: String? = null
        var pages = 0
        do {
            val page = when (val fetched = page(nodeId, after)) {
                is Outcome.Success -> fetched.value
                is Outcome.Refused -> return@run fetched
                is Outcome.Failed -> return@run fetched
            }
            records += page.first
            after = page.second
        } while (after != null && ++pages < MAX_CITING_PAGES)
        Outcome.Success(foldCitingArtifacts(records))
    }

    private suspend fun page(nodeId: String, after: String?): Outcome<Pair<List<CitingRecord<CitingView>>, String?>> =
        client.query(CitingRecordsQuery(nodeId, Optional.presentIfNotNull(after))).fetch().map { data ->
            val connection = data.records
            val records = connection.edges.map { edge ->
                val node = edge.node
                CitingRecord(
                    id = node.id,
                    authorId = node.authorId,
                    // An untyped middle node is still a citation: its own id keys it.
                    targetId = node.targetId ?: node.id,
                    target = citingView(node.target),
                    pDirected = node.pDirected,
                    pInterest = node.pInterest,
                    payloadMarked = node.payloadMarked,
                    landingEpoch = node.landingEpoch,
                    position = node.position,
                )
            }
            records to connection.pageInfo.endCursor.takeIf { connection.pageInfo.hasNextPage }
        }
}

private val REDACTED = FieldModerationStatus.REDACTED

/** What the row names, drawn from the citing artifact (`citingView`). */
internal fun citingView(target: CitingRecordsQuery.Target?): CitingView {
    target?.onPost?.let { post ->
        val removed = removalMark(post.removal?.by?.toDomain())
        val lead = post.attachments.firstOrNull()
        val cover = when {
            lead == null -> null
            lead.mimeType.startsWith("video/") -> lead.coverMedia?.takeIf { it.status != REDACTED }?.url
            lead.status == REDACTED -> null
            else -> lead.url
        }
        return CitingView(
            kind = CitingKind.POST,
            name = removed ?: postTitle(
                title = ModeratedField(post.title.value, post.title.status.toDomain()),
                content = ModeratedField(post.content.value, post.content.status.toDomain()),
                mimeTypes = post.attachments.map { it.mimeType },
                handle = post.author?.handle,
            ),
            cover = cover.takeIf { removed == null },
            redacted = removed != null,
            opensPost = post.id,
        )
    }
    target?.onComment?.let { comment ->
        val removed = removalMark(comment.removal?.by?.toDomain())
        return CitingView(
            kind = CitingKind.COMMENT,
            name = removed ?: comment.content.value.orEmpty(),
            redacted = removed != null,
            opensPost = comment.target?.onPost?.id,
        )
    }
    return CitingView(kind = CitingKind.POST, name = "")
}

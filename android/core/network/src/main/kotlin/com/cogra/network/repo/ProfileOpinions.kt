// THE OPINIONS PAGE'S READ (ProfileStances; `opinions.graphql`): one direction
// of a person's opinions, every record of the set, folded into one row per
// person (`HeldOpinions.kt`). The web's twin is `web/src/lib/api/opinions-api.ts`.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.FieldStatus
import com.cogra.domain.Outcome
import com.cogra.domain.map
import com.cogra.domain.stance.HeldOpinion
import com.cogra.domain.stance.OpinionDirection
import com.cogra.domain.stance.OpinionHolder
import com.cogra.domain.stance.OpinionRecord
import com.cogra.domain.stance.foldHeldOpinions
import com.cogra.network.fetch
import com.cogra.network.graphql.UserOpinionsByQuery
import com.cogra.network.graphql.UserOpinionsOnQuery
import com.cogra.network.graphql.fragment.OpinionPersonFields
import com.cogra.network.graphql.fragment.OpinionRecordFields
import com.cogra.network.toDomain

/** How many pages the whole set may take before the read stops (100 records apiece) — the web's bound. */
internal const val MAX_OPINION_PAGES = 50

private val HIDDEN_PICTURE = setOf(FieldStatus.REDACTED, FieldStatus.UNKNOWN)

/** One page of a set: its records, and the cursor of the next page or null at the end. */
private class OpinionPage(val records: List<OpinionRecord>, val next: String?)

/**
 * Reads the whole set a page at a time, then folds it. The whole set, because
 * the order is strongest first and a bundle's place is not known until its
 * last record is; a failed page fails the read, since half a set would draw
 * rows in the wrong places. A person the server does not know reads empty.
 */
internal suspend fun readOpinions(
    client: ApolloClient,
    actorId: String,
    direction: OpinionDirection,
): Outcome<List<HeldOpinion>> {
    val records = mutableListOf<OpinionRecord>()
    var after: String? = null
    var more = true
    var pages = 0
    while (more && pages++ < MAX_OPINION_PAGES) {
        val fetched = when (direction) {
            OpinionDirection.ON -> onPage(client, actorId, after)
            OpinionDirection.BY -> byPage(client, actorId, after)
        }
        val read = when (fetched) {
            is Outcome.Success -> fetched.value
            is Outcome.Refused -> return fetched
            is Outcome.Failed -> return fetched
        }
        records += read?.records.orEmpty()
        after = read?.next
        more = after != null
    }
    return Outcome.Success(foldHeldOpinions(records))
}

/** `On them`: a row per author — the holder is who wrote the record. */
private suspend fun onPage(client: ApolloClient, actorId: String, after: String?): Outcome<OpinionPage?> =
    client.query(UserOpinionsOnQuery(actorId, Optional.presentIfNotNull(after))).fetch().map { data ->
        data.user?.incomingRecords?.let { connection ->
            OpinionPage(
                records = connection.edges.map { edge ->
                    val node = edge.node
                    node.opinionRecordFields.toRecord(
                        holderId = node.opinionRecordFields.authorId,
                        person = node.author?.opinionPersonFields,
                    )
                },
                next = connection.pageInfo.endCursor.takeIf { connection.pageInfo.hasNextPage },
            )
        }
    }

/**
 * `By them`: a row per person the record is about. A binary family always
 * names its far end; an unnamed one is no person this list could place, so
 * its own id stands in as the address.
 */
private suspend fun byPage(client: ApolloClient, actorId: String, after: String?): Outcome<OpinionPage?> =
    client.query(UserOpinionsByQuery(actorId, Optional.presentIfNotNull(after))).fetch().map { data ->
        data.user?.outgoingRecords?.let { connection ->
            OpinionPage(
                records = connection.edges.map { edge ->
                    val node = edge.node
                    val fields = node.opinionRecordFields
                    fields.toRecord(
                        holderId = fields.targetId ?: fields.id,
                        person = node.target?.onUser?.opinionPersonFields,
                    )
                },
                next = connection.pageInfo.endCursor.takeIf { connection.pageInfo.hasNextPage },
            )
        }
    }

private fun OpinionRecordFields.toRecord(holderId: String, person: OpinionPersonFields?) = OpinionRecord(
    holderId = holderId,
    holder = person.toHolder(),
    pDirected = pDirected,
    pInterest = pInterest,
    severed = severed,
    payloadMarked = payloadMarked,
    landingEpoch = landingEpoch,
    position = position,
)

/**
 * Who the row names. A deleted account reads REDACTED in its name and keeps
 * only the handle its page still answers to, which the row opens and never
 * prints (ER-G10; `StanceRow`'s `redacted`). An address no account fronts
 * still holds its opinion and keeps its row, with nothing to open.
 */
private fun OpinionPersonFields?.toHolder(): OpinionHolder {
    if (this == null) return OpinionHolder(null, null, null, null, redacted = false)
    if (displayName.status.toDomain() == FieldStatus.REDACTED) {
        return OpinionHolder(actorId = id, handle = handle, displayName = null, avatarUrl = null, redacted = true)
    }
    // A picture whose bytes are gone, or whose status this build cannot
    // name, falls to the monogram (the web's twin, `holderOf`).
    val picture = avatar?.takeIf { it.status.toDomain() !in HIDDEN_PICTURE }
    return OpinionHolder(
        actorId = id,
        handle = handle,
        displayName = displayName.value,
        avatarUrl = picture?.url,
        redacted = false,
    )
}

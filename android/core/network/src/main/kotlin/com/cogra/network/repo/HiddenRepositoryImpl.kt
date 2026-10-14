// The hidden-actors list over the real contract (api-spec.md
// `User.hiddenActors`, `hideActor`, `unhideActor`). Authenticated-only and
// never member-gated: an applicant hides like a member.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.Outcome
import com.cogra.domain.hidden.HiddenEntry
import com.cogra.domain.hidden.HiddenPerson
import com.cogra.domain.hidden.HiddenRepository
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.HiddenActorsPageQuery
import com.cogra.network.graphql.HideActorMutation
import com.cogra.network.graphql.UnhideActorMutation
import com.cogra.network.payloadOutcome
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

/** How many pages the whole set may take before the read stops (100 apiece). */
private const val MAX_PAGES = 50

@Singleton
class HiddenRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : HiddenRepository {

    override suspend fun hiddenActors(): Outcome<List<HiddenEntry>> {
        val entries = mutableListOf<HiddenEntry>()
        var after: String? = null
        repeat(MAX_PAGES) {
            val page = guard.run {
                client.query(HiddenActorsPageQuery(after = Optional.presentIfNotNull(after))).fetch()
            }
            val connection = when (page) {
                // No session: a guest hides nobody.
                is Outcome.Success -> page.value.me?.hiddenActors ?: return Outcome.Success(emptyList())
                is Outcome.Refused -> return page
                is Outcome.Failed -> return page
            }
            entries += connection.edges.map { edge -> HiddenEntry(edge.node.toPerson(), edge.hiddenAt) }
            after = connection.pageInfo.endCursor
            if (!connection.pageInfo.hasNextPage || after == null) return Outcome.Success(entries)
        }
        return Outcome.Success(entries)
    }

    override suspend fun hideActor(actor: String, at: Instant?): Outcome<Instant> = guard.run {
        client.mutation(HideActorMutation(actor = actor, hiddenAt = Optional.present(at)))
            .payloadOutcome({ it.hideActor.userErrors.map { e -> e.userErrorFields } }) {
                it.hideActor.hidden?.hiddenAt
            }
    }

    override suspend fun unhideActor(actor: String): Outcome<Unit> = guard.run {
        client.mutation(UnhideActorMutation(actor = actor))
            .payloadOutcome({ it.unhideActor.userErrors.map { e -> e.userErrorFields } }) {
                if (it.unhideActor.ok == true) Unit else null
            }
    }
}

/**
 * A deleted account reads REDACTED in its name and serves no handle a row may
 * print (ER-G10, design digest item 19).
 */
private fun HiddenActorsPageQuery.Node.toPerson(): HiddenPerson {
    val redacted = displayName.status.rawValue == "REDACTED"
    val avatar = onUser?.avatar?.takeIf { it.status.rawValue != "REDACTED" }
    return HiddenPerson(
        id = id,
        handle = if (redacted) null else handle,
        displayName = if (redacted) null else displayName.value?.takeIf { it.isNotBlank() },
        avatarUrl = if (redacted) null else avatar?.url,
        redacted = redacted,
    )
}

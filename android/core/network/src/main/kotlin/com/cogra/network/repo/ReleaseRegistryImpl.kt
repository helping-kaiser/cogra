// The release registry over the real contract (api-spec.md `appVersions`).
// The app reads its own component, ANDROID: "behind" has to mean a release
// the store can actually offer this device (release-registry packet §4.2).
// Anonymous like every read, so no guard wraps it.
//
// The list is one row per release, so the page is the documented maximum
// and the walk follows `endCursor` while `hasNextPage` (api-spec.md
// "Pagination").

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.Outcome
import com.cogra.domain.release.Release
import com.cogra.domain.release.ReleaseRegistry
import com.cogra.network.fetch
import com.cogra.network.graphql.AppVersionsQuery
import com.cogra.network.graphql.type.AppComponent
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ReleaseRegistryImpl @Inject constructor(
    private val client: ApolloClient,
) : ReleaseRegistry {

    override suspend fun releases(until: String?): Outcome<List<Release>> {
        val releases = mutableListOf<Release>()
        var after: String? = null
        while (true) {
            val query = AppVersionsQuery(AppComponent.ANDROID, Optional.presentIfNotNull(after))
            val page = when (val fetched = client.query(query).fetch()) {
                is Outcome.Success -> fetched.value.appVersions
                is Outcome.Refused -> return fetched
                is Outcome.Failed -> return fetched
            }
            page.edges.mapTo(releases) { edge ->
                Release(
                    version = edge.node.version,
                    notes = edge.node.notes,
                    patchNotesUrl = edge.node.patchNotesUrl,
                    releasedAt = edge.node.releasedAt,
                )
            }
            val found = until != null && releases.any { it.version == until }
            val next = page.pageInfo.endCursor.takeIf { page.pageInfo.hasNextPage }
            if (found || next == null) return Outcome.Success(releases)
            after = next
        }
    }
}

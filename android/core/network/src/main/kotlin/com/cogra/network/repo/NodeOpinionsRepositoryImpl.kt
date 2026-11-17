// Everyone holding an opinion on a post or a comment over the real contract
// (`opinions.graphql` `NodeOpinions`), folded to one row per person
// (`readNodeOpinions`). web's twin is `fetchHeldOpinions` in
// `web/src/lib/api/opinions-api.ts`.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.Outcome
import com.cogra.domain.stance.HeldOpinion
import com.cogra.domain.stance.NodeOpinionsRepository
import com.cogra.network.auth.AuthGuard
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NodeOpinionsRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : NodeOpinionsRepository {

    override suspend fun opinionsOn(nodeId: String): Outcome<List<HeldOpinion>> =
        guard.run { readNodeOpinions(client, nodeId) }
}

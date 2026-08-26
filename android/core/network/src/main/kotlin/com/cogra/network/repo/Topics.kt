// The topic surface over the real contract (hashtag.md; roadmap
// "Slice 2.3"): the naming service's read and the Tag gesture. A Type
// is anchored vacuously, so a topic nobody has tagged yet has no id to
// look up and every call here addresses it by name (D4). Following a
// topic is a slice-3 surface: the schema accepts a stance on a topic,
// this client stages none.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.HashtagView
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.TaggedContentView
import com.cogra.domain.map
import com.cogra.domain.repo.TopicRepository
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.HashtagQuery
import com.cogra.network.graphql.PrepareTagMutation
import com.cogra.network.graphql.type.PrepareTagInput
import com.cogra.network.payloadOutcome
import com.cogra.network.toDomain
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TopicRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : TopicRepository {

    override suspend fun hashtag(name: String): Outcome<HashtagView?> = guard.run {
        client.query(
            HashtagQuery(name = name, limit = Optional.present(0), includePending = true),
        ).fetch().map { data -> data.hashtag?.hashtagFields?.toDomain() }
    }

    override suspend fun taggedContent(
        name: String,
        limit: Int?,
        includePending: Boolean,
    ): Outcome<List<TaggedContentView>> = guard.run {
        client.query(
            HashtagQuery(
                name = name,
                limit = Optional.presentIfNotNull(limit),
                includePending = includePending,
            ),
        ).fetch().map { data -> data.hashtag?.taggedContent.orEmpty().mapNotNull { it.toDomain() } }
    }

    override suspend fun prepareTag(
        target: String,
        name: String,
        pDirected: Double?,
        pInterest: Double?,
    ): Outcome<List<PreparedWriteView>> = guard.run {
        client.mutation(
            PrepareTagMutation(
                PrepareTagInput(
                    target = target,
                    name = name,
                    pDirected = Optional.presentIfNotNull(pDirected),
                    pInterest = Optional.presentIfNotNull(pInterest),
                ),
            ),
        ).payloadOutcome({ it.prepareTag.userErrors.map { e -> e.userErrorFields } }) {
            it.prepareTag.writes?.map { w -> w.preparedWriteFields.toDomain() }
        }
    }
}

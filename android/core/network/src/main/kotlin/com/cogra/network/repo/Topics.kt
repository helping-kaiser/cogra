// The topic surface over the real contract (hashtag.md; roadmap
// "Slice 2.3"): the naming service's read, the standalone Tag gesture,
// and the follow control. Follow/unfollow reuse the schema's generic
// `prepareStance` / `prepareSeverance` mutations with `topicName` in
// place of `target` (writes.graphql / stance.graphql already define
// them for post/comment/user targets) — a Type is anchored vacuously,
// so a topic nobody has tagged yet has no id to look up (D4).

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.ErrorCode
import com.cogra.domain.HashtagView
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.TaggedContentView
import com.cogra.domain.UserError
import com.cogra.domain.flatMap
import com.cogra.domain.map
import com.cogra.domain.repo.TopicRepository
import com.cogra.domain.stance.SeveranceQuote
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceStanding
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.HashtagQuery
import com.cogra.network.graphql.PrepareTagMutation
import com.cogra.network.graphql.PrepareTopicFollowMutation
import com.cogra.network.graphql.PrepareTopicUnfollowMutation
import com.cogra.network.graphql.TopicStandingQuery
import com.cogra.network.graphql.fragment.StanceBundleFields
import com.cogra.network.graphql.type.PrepareSeveranceInput
import com.cogra.network.graphql.type.PrepareStanceInput
import com.cogra.network.graphql.type.PrepareTagInput
import com.cogra.network.payloadOutcome
import com.cogra.network.toDomain
import com.cogra.network.unauthenticatedRefusal
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

    override suspend fun followStanding(name: String, includePending: Boolean): Outcome<StanceStanding> =
        bundle(name, includePending).map { fold ->
            StanceStanding(
                target = name,
                net = StancePair(fold.pDirected, fold.pInterest),
                raw = StancePair(fold.rawPDirected, fold.rawPInterest),
                records = fold.recordCount,
                includePending = includePending,
            )
        }

    override suspend fun prepareFollow(name: String, pick: StancePair): Outcome<List<PreparedWriteView>> =
        guard.run {
            client.mutation(
                PrepareTopicFollowMutation(
                    PrepareStanceInput(
                        topicName = Optional.present(name),
                        pDirected = pick.pDirected,
                        pInterest = pick.pInterest,
                    ),
                ),
            ).payloadOutcome({ it.prepareStance.userErrors.map { e -> e.userErrorFields } }) {
                it.prepareStance.writes?.map { w -> w.preparedWriteFields.toDomain() }
            }
        }

    override suspend fun followSeveranceQuote(name: String, includePending: Boolean): Outcome<SeveranceQuote> =
        bundle(name, includePending).map { fold ->
            SeveranceQuote(
                target = name,
                standing = StancePair(fold.pDirected, fold.pInterest),
                raw = StancePair(fold.rawPDirected, fold.rawPInterest),
                records = fold.severanceCost,
                alreadySevered = fold.severed,
            )
        }

    override suspend fun prepareUnfollow(name: String): Outcome<List<PreparedWriteView>> = guard.run {
        client.mutation(
            PrepareTopicUnfollowMutation(
                PrepareSeveranceInput(topicName = Optional.present(name)),
            ),
        ).payloadOutcome({ it.prepareSeverance.userErrors.map { e -> e.userErrorFields } }) {
            it.prepareSeverance.writes?.map { w -> w.preparedWriteFields.toDomain() }
        }
    }

    /** The one read behind the follow control: `viewerStance` on the named topic. */
    private suspend fun bundle(name: String, includePending: Boolean): Outcome<StanceBundleFields> = guard.run {
        client.query(
            TopicStandingQuery(name = name, includePending = includePending),
        ).fetch().flatMap { data ->
            val hashtag = data.hashtag ?: return@flatMap Outcome.Refused(
                listOf(UserError(ErrorCode.NOT_FOUND, "no such topic", listOf("name"))),
            )
            hashtag.viewerStance?.stanceBundleFields?.let { Outcome.Success(it) } ?: unauthenticatedRefusal()
        }
    }
}

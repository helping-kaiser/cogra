// The stance control over the real contract (api-spec.md "The generic
// stance"): the read-side bundle fold and severance's own staging.
//
// Every number here comes off the wire. The client reads zeros off the
// fold's own answer to name inertness per axis, but it never sums, never
// clips, and never derives a delta — a stance record carries exactly the
// two values the author picked (design.md §8.1).

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.di.ApplicationScope
import com.cogra.domain.flatMap
import com.cogra.domain.map
import com.cogra.domain.repo.StanceRepository
import com.cogra.domain.repo.WriteRepository
import com.cogra.domain.stance.SeveranceQuote
import com.cogra.domain.stance.StanceKind
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceProjection
import com.cogra.domain.stance.StanceStanding
import com.cogra.domain.stance.StanceTarget
import com.cogra.domain.store.TokenStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.HashtagStanceQuery
import com.cogra.network.graphql.PrepareSeveranceMutation
import com.cogra.network.graphql.fragment.StanceBundleFields
import com.cogra.network.graphql.type.PrepareSeveranceInput
import com.cogra.network.graphql.type.StancePickInput
import com.cogra.network.payloadOutcome
import com.cogra.network.toDomain
import kotlinx.coroutines.CoroutineScope
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class StanceRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
    private val writes: WriteRepository,
    tokens: TokenStore,
    @ApplicationScope scope: CoroutineScope,
) : StanceRepository {

    // The node reads: a page's standings in one request (NodeStanceReads.kt).
    private val nodes = NodeStanceReads(client, guard, tokens, scope)

    // The node each target's last bundle read named — what a stance or
    // severance signed from that read must point at (Intent.kt). A node
    // fact, not the reader's: the same node under every account.
    private val graphIds = ConcurrentHashMap<StanceTarget, String>()

    // What a read learned, as a kept pick names it — no read of its own.
    override suspend fun kindOf(target: StanceTarget): StanceKind? = when (target) {
        is StanceTarget.Topic -> StanceKind.TOPIC
        is StanceTarget.Node -> when (nodes.kindOf(target.id)) {
            TargetKind.POST -> StanceKind.POST
            TargetKind.COMMENT -> StanceKind.COMMENT
            TargetKind.USER -> StanceKind.PERSON
            null -> null
        }
    }

    override suspend fun targetGraphId(target: StanceTarget): Outcome<String> =
        graphIds[target]?.let { Outcome.Success(it) }
            ?: bundle(target, pick = null, includePending = true).map { it.targetGraphId }

    /**
     * The generic prepare, which the write path already owns — the
     * reciprocation gesture stages its stance through the same call, and
     * one mutation deserves one implementation.
     */
    override suspend fun prepareStance(target: StanceTarget, pick: StancePair): Outcome<List<PreparedWriteView>> =
        when (target) {
            is StanceTarget.Node -> writes.prepareStance(target.id, pick.pDirected, pick.pInterest)
            is StanceTarget.Topic -> writes.prepareTopicStance(target.name, pick.pDirected, pick.pInterest)
        }

    override suspend fun standing(target: StanceTarget, includePending: Boolean): Outcome<StanceStanding> =
        bundle(target, pick = null, includePending = includePending).map { fold ->
            StanceStanding(
                target = target,
                net = StancePair(fold.pDirected, fold.pInterest),
                raw = StancePair(fold.rawPDirected, fold.rawPInterest),
                records = fold.recordCount,
                includePending = includePending,
                severed = fold.severed,
            )
        }

    override suspend fun projection(
        target: StanceTarget,
        pick: StancePair,
        includePending: Boolean,
    ): Outcome<StanceProjection> =
        bundle(target, pick = pick, includePending = includePending).flatMap { fold ->
            // The contract fills `projected` exactly when a pick rode
            // along, so a null here is the server breaking its own rule.
            val landed = fold.projected
                ?: return@flatMap Outcome.Failed(
                    IllegalStateException("bundle answered a pick without a projection"),
                )
            Outcome.Success(
                StanceProjection(
                    pick = pick,
                    net = StancePair(landed.pDirected, landed.pInterest),
                    // Per-axis, because the control names the two axes
                    // separately; the schema's own `inert` collapses
                    // them into one flag.
                    inertDirected = landed.pDirected == 0.0,
                    inertInterest = landed.pInterest == 0.0,
                    severance = landed.severed,
                ),
            )
        }

    override suspend fun severanceQuote(target: StanceTarget, includePending: Boolean): Outcome<SeveranceQuote> =
        bundle(target, pick = null, includePending = includePending).map { fold ->
            SeveranceQuote(
                target = target,
                standing = StancePair(fold.pDirected, fold.pInterest),
                raw = StancePair(fold.rawPDirected, fold.rawPInterest),
                records = fold.severanceCost,
                // Nothing stands to walk back: no record, or already walked
                // back. The bundle's `severed` alone is false on an empty
                // bundle (the API's contract since the empty sign).
                alreadySevered = fold.recordCount == 0 || fold.severed,
                bundleRecords = fold.recordCount,
            )
        }

    /**
     * Severance stages the counter-records the current bundle needs,
     * each its own priced act — the batch the confirm surface quoted,
     * handed to the signer in one go.
     */
    override suspend fun prepareSeverance(target: StanceTarget): Outcome<List<PreparedWriteView>> = guard.run {
        // `PrepareSeveranceInput` is exactly-one-of, and the domain type
        // is what makes the other field's absence structural rather than
        // remembered: a topic is unfollowed by NAME — "unfollowing is
        // severance toward the Type" — and there is no id to send even
        // where one would be accepted.
        val input = when (target) {
            is StanceTarget.Node -> PrepareSeveranceInput(target = Optional.present(target.id))
            is StanceTarget.Topic -> PrepareSeveranceInput(topicName = Optional.present(target.name))
        }
        client.mutation(PrepareSeveranceMutation(input))
            .payloadOutcome({ it.prepareSeverance.userErrors.map { e -> e.userErrorFields } }) {
                it.prepareSeverance.writes?.map { w -> w.preparedWriteFields.toDomain() }
            }
    }

    /**
     * The one read behind all of them, and the split the two addresses
     * make: a name carries its own root; an opaque id read without a pick
     * joins its page's batch, whose answer names the node's class; a pick
     * asks the one root that holds the id.
     */
    private suspend fun bundle(
        target: StanceTarget,
        pick: StancePair?,
        includePending: Boolean,
    ): Outcome<StanceBundleFields> {
        val picked = pick?.let { StancePickInput(it.pDirected, it.pInterest) }
        val read = when (target) {
            is StanceTarget.Topic -> guard.run { topicBundle(target.name, picked.asInput(), includePending) }
            is StanceTarget.Node -> if (picked == null) {
                nodes.standing(target.id, includePending)
            } else {
                nodes.projected(target.id, picked, includePending)
            }
        }
        (read as? Outcome.Success)?.let { graphIds[target] = it.value.targetGraphId }
        return read
    }

    /**
     * The topic read: one document, never a page. A topic is not a `Node`
     * ("Hashtag is not a Node"), and `hashtag(name:)` is told outright
     * which root to ask.
     */
    private suspend fun topicBundle(
        name: String,
        pick: Optional<StancePickInput?>,
        includePending: Boolean,
    ): Outcome<StanceBundleFields> {
        // The topic's own root. `hashtag(name:)` resolves any well-formed
        // name — a Type is anchored vacuously, so a topic nobody has tagged
        // yet still answers — and a null here means the name is one the
        // substrate cannot carry, not an empty bundle.
        val read = client.query(HashtagStanceQuery(name, pick, includePending)).fetch()
            .map { data -> data.hashtag?.let { RootAnswer(it.viewerStance?.stanceBundleFields) } }
        return when (read) {
            is Outcome.Failed -> Outcome.Failed(read.cause)
            is Outcome.Refused -> Outcome.Refused(read.errors)
            is Outcome.Success -> read.value?.let { it.bundle.orRefusal() } ?: notFound()
        }
    }
}

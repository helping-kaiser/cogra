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
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.flatMap
import com.cogra.domain.map
import com.cogra.domain.repo.StanceRepository
import com.cogra.domain.repo.WriteRepository
import com.cogra.domain.stance.SeveranceQuote
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceProjection
import com.cogra.domain.stance.StanceStanding
import com.cogra.network.auth.AuthGuard
import com.cogra.network.fetch
import com.cogra.network.graphql.PrepareSeveranceMutation
import com.cogra.network.graphql.ViewerStanceQuery
import com.cogra.network.graphql.fragment.StanceBundleFields
import com.cogra.network.graphql.type.PrepareSeveranceInput
import com.cogra.network.graphql.type.StancePickInput
import com.cogra.network.payloadOutcome
import com.cogra.network.toDomain
import com.cogra.network.unauthenticatedRefusal
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/** Which stance-able root answered for a target id. */
private enum class TargetKind { POST, COMMENT, USER }

@Singleton
class StanceRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
    private val writes: WriteRepository,
) : StanceRepository {

    // A node never changes class, so the first read's answer holds for
    // the rest of the process. Without it every drag-time projection
    // would ask all three roots to learn what the first read already
    // knew.
    private val kinds = ConcurrentHashMap<String, TargetKind>()

    /**
     * The generic prepare, which the write path already owns — the
     * reciprocation gesture stages its stance through the same call, and
     * one mutation deserves one implementation.
     */
    override suspend fun prepareStance(target: String, pick: StancePair): Outcome<List<PreparedWriteView>> =
        writes.prepareStance(target, pick.pDirected, pick.pInterest)

    override suspend fun standing(target: String, includePending: Boolean): Outcome<StanceStanding> =
        bundle(target, pick = null, includePending = includePending).map { fold ->
            StanceStanding(
                target = target,
                net = StancePair(fold.pDirected, fold.pInterest),
                raw = StancePair(fold.rawPDirected, fold.rawPInterest),
                records = fold.recordCount,
                includePending = includePending,
            )
        }

    override suspend fun projection(
        target: String,
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

    override suspend fun severanceQuote(target: String, includePending: Boolean): Outcome<SeveranceQuote> =
        bundle(target, pick = null, includePending = includePending).map { fold ->
            SeveranceQuote(
                target = target,
                standing = StancePair(fold.pDirected, fold.pInterest),
                raw = StancePair(fold.rawPDirected, fold.rawPInterest),
                records = fold.severanceCost,
                alreadySevered = fold.severed,
            )
        }

    /**
     * Severance stages the counter-records the current bundle needs,
     * each its own priced act — the batch the confirm surface quoted,
     * handed to the signer in one go.
     */
    override suspend fun prepareSeverance(target: String): Outcome<List<PreparedWriteView>> = guard.run {
        client.mutation(PrepareSeveranceMutation(PrepareSeveranceInput(target = Optional.present(target))))
            .payloadOutcome({ it.prepareSeverance.userErrors.map { e -> e.userErrorFields } }) {
                it.prepareSeverance.writes?.map { w -> w.preparedWriteFields.toDomain() }
            }
    }

    /**
     * The one read behind all three: `viewerStance` is a node field, so
     * an unclassified target asks every stance-able root and keeps
     * whichever answered.
     */
    private suspend fun bundle(
        target: String,
        pick: StancePair?,
        includePending: Boolean,
    ): Outcome<StanceBundleFields> = guard.run {
        val known = kinds[target]
        client.query(
            ViewerStanceQuery(
                target = target,
                pick = Optional.presentIfNotNull(
                    pick?.let { StancePickInput(it.pDirected, it.pInterest) },
                ),
                includePending = includePending,
                asPost = known == null || known == TargetKind.POST,
                asComment = known == null || known == TargetKind.COMMENT,
                asUser = known == null || known == TargetKind.USER,
            ),
        ).fetch().flatMap { data ->
            val post = data.post
            val comment = data.comment
            val user = data.user
            val answered = when {
                post != null -> TargetKind.POST to post.viewerStance?.stanceBundleFields
                comment != null -> TargetKind.COMMENT to comment.viewerStance?.stanceBundleFields
                user != null -> TargetKind.USER to user.viewerStance?.stanceBundleFields
                else -> null
            }
            if (answered == null) {
                // Either the id names nothing stance-able, or a
                // remembered class went stale under a vanished node —
                // forget it so the next read probes again.
                kinds.remove(target)
                return@flatMap Outcome.Refused(
                    listOf(UserError(ErrorCode.NOT_FOUND, "no such stance target", listOf("target"))),
                )
            }
            val (kind, fold) = answered
            kinds[target] = kind
            // A node that answered with a null bundle has an
            // unauthenticated reader behind it, or one with no actor on
            // the graph. The first is the common case and the guard
            // refreshes and replays on it; the second costs that one
            // wasted refresh and then reports the same refusal.
            fold?.let { Outcome.Success(it) } ?: unauthenticatedRefusal()
        }
    }
}

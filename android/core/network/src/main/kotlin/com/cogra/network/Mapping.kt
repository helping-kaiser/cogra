// Generated-type → domain mapping, and the response-tier translation
// (api-spec.md "Errors are tiered"): the GraphQL errors array and
// transport faults become Outcome.Failed; payload userErrors become
// Outcome.Refused; everything else is Success.
//
// Two deliberate translations: the backend emits UNAUTHENTICATED and
// RATE_LIMITED only as errors-array entries (transport tier per
// api-spec.md), but both are deliberate refusals the client must act
// on — AuthGuard refresh-and-replays on UNAUTHENTICATED, and a
// rate-limited verb needs the "too many attempts" copy, never the
// connectivity error — so each is synthesized into a refusal here.
// RATE_LIMITED deliberately does NOT share UNAUTHENTICATED's code:
// AuthGuard matches the code, so a rate limit never triggers a
// refresh-and-replay.

package com.cogra.network

import com.apollographql.apollo.ApolloCall
import com.apollographql.apollo.api.Operation
import com.cogra.crypto.Family
import com.cogra.domain.AccountState
import com.cogra.domain.ApplicationInfo
import com.cogra.domain.ApplicationView
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.StagedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.WriteState
import com.cogra.domain.flatMap
import com.cogra.network.graphql.fragment.ApplicationFields
import com.cogra.network.graphql.fragment.PreparedWriteFields
import com.cogra.network.graphql.fragment.StagedWriteFields
import com.cogra.network.graphql.fragment.UserErrorFields
import com.cogra.network.graphql.type.RecordFamily
import com.cogra.network.graphql.type.StagedWriteState
import java.util.Base64

/** The GraphQL errors array — transport tier, never a business outcome. */
class GraphQlFaultException(messages: List<String>) :
    Exception("GraphQL fault: ${messages.joinToString("; ")}")

/** The refusal a null viewer read and an errors-array UNAUTHENTICATED share. */
internal fun unauthenticatedRefusal(): Outcome.Refused = Outcome.Refused(
    listOf(UserError(ErrorCode.UNAUTHENTICATED, "no viewer for this request")),
)

/** The refusal an errors-array RATE_LIMITED maps to. */
internal fun rateLimitedRefusal(): Outcome.Refused = Outcome.Refused(
    listOf(UserError(ErrorCode.RATE_LIMITED, "too many attempts")),
)

/**
 * Executes the call and splits the transport tier off: Failed for
 * exceptions and the errors array — except an errors-array
 * UNAUTHENTICATED or RATE_LIMITED, each of which becomes a Refused —
 * Success(data) otherwise.
 */
internal suspend fun <D : Operation.Data> ApolloCall<D>.fetch(): Outcome<D> {
    val response = execute()
    response.exception?.let { return Outcome.Failed(it) }
    val errors = response.errors
    if (!errors.isNullOrEmpty()) {
        if (errors.any { it.extensions?.get("code") == "UNAUTHENTICATED" }) return unauthenticatedRefusal()
        if (errors.any { it.extensions?.get("code") == "RATE_LIMITED" }) return rateLimitedRefusal()
        return Outcome.Failed(GraphQlFaultException(errors.map { it.message }))
    }
    val data = response.data ?: return Outcome.Failed(IllegalStateException("response carried no data"))
    return Outcome.Success(data)
}

/**
 * The payload tier: refuse when userErrors is non-empty, otherwise
 * unwrap the named result field — which the convention nulls exactly
 * when userErrors is non-empty, so a null here is a server fault.
 */
internal fun <T> payload(errors: List<UserError>, value: () -> T?): Outcome<T> {
    if (errors.isNotEmpty()) return Outcome.Refused(errors)
    val v = value() ?: return Outcome.Failed(IllegalStateException("null result without userErrors"))
    return Outcome.Success(v)
}

/** Chains [fetch] and [payload] for the common single-payload mutation. */
internal suspend fun <D : Operation.Data, T> ApolloCall<D>.payloadOutcome(
    errorsOf: (D) -> List<UserErrorFields>,
    valueOf: (D) -> T?,
): Outcome<T> = fetch().flatMap { data -> payload(errorsOf(data).toDomain()) { valueOf(data) } }

internal fun List<UserErrorFields>.toDomain(): List<UserError> = map {
    UserError(
        code = runCatching { ErrorCode.valueOf(it.code.rawValue) }.getOrDefault(ErrorCode.UNKNOWN),
        message = it.message,
        field = it.field,
    )
}

/** An unknown state is not actionable by this build; the signer refuses it. */
internal fun StagedWriteState.toDomain(): WriteState =
    runCatching { WriteState.valueOf(rawValue) }.getOrDefault(WriteState.UNKNOWN)

/** An unknown state gates acting, like every non-member state. */
internal fun com.cogra.network.graphql.type.AccountState.toDomain(): AccountState =
    runCatching { AccountState.valueOf(rawValue) }.getOrDefault(AccountState.UNKNOWN)

/** An unknown family is never signed; the signer refuses it. */
internal fun RecordFamily.toDomain(): Family =
    runCatching { Family.valueOf(rawValue) }.getOrDefault(Family.UNKNOWN)

internal fun StagedWriteFields.toDomain(): StagedWriteView = StagedWriteView(
    id = id,
    state = state.toDomain(),
    family = family.toDomain(),
    canonicalProposal = Base64.getDecoder().decode(canonicalProposal),
    verifiedAct = verifiedAct?.let { Base64.getDecoder().decode(it) },
    recordId = record?.id,
)

internal fun PreparedWriteFields.toDomain(): PreparedWriteView = PreparedWriteView(
    id = id,
    family = family.toDomain(),
    canonicalProposal = Base64.getDecoder().decode(canonicalProposal),
    gcAfterEpochs = gcAfterEpochs,
)

/** The viewer's own application row. */
internal fun ApplicationFields.toView(): ApplicationView = ApplicationView(
    handle = handle,
    emailVerified = emailVerified,
    keyAttached = keyAttached,
    approvedAt = approvedAt,
    landedAt = landedAt,
    expiresAt = expiresAt,
)

/** The same row, as the inviter's queue shows it. */
internal fun ApplicationFields.toInfo(): ApplicationInfo = ApplicationInfo(
    id = id,
    handle = handle,
    emailVerified = emailVerified,
    keyAttached = keyAttached,
    approvedAt = approvedAt,
    landedAt = landedAt,
)

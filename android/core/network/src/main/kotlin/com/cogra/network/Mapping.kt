// Generated-type → domain mapping, and the response-tier translation
// (api-spec.md "Errors are tiered"): the GraphQL errors array and
// transport faults become Outcome.Failed; payload userErrors become
// Outcome.Refused; everything else is Success.
//
// One deliberate translation: the backend emits UNAUTHENTICATED only as
// an errors-array entry (transport tier per api-spec.md), but AuthGuard
// must be able to refresh-and-replay on it, so it is synthesized into a
// refusal here — the same shape a null viewer read maps to.

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

/**
 * Executes the call and splits the transport tier off: Failed for
 * exceptions and the errors array — except an errors-array
 * UNAUTHENTICATED, which becomes a Refused — Success(data) otherwise.
 */
internal suspend fun <D : Operation.Data> ApolloCall<D>.fetch(): Outcome<D> {
    val response = execute()
    response.exception?.let { return Outcome.Failed(it) }
    val errors = response.errors
    if (!errors.isNullOrEmpty()) {
        if (errors.any { it.extensions?.get("code") == "UNAUTHENTICATED" }) return unauthenticatedRefusal()
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
): Outcome<T> = when (val fetched = fetch()) {
    is Outcome.Success -> payload(errorsOf(fetched.value).toDomain()) { valueOf(fetched.value) }
    is Outcome.Refused -> fetched
    is Outcome.Failed -> fetched
}

internal fun List<UserErrorFields>.toDomain(): List<UserError> = map {
    UserError(
        code = runCatching { ErrorCode.valueOf(it.code.rawValue) }.getOrDefault(ErrorCode.UNKNOWN),
        message = it.message,
        field = it.field,
    )
}

internal fun StagedWriteState.toDomain(): WriteState =
    runCatching { WriteState.valueOf(rawValue) }
        .getOrElse { error("unknown staged-write state $rawValue") }

/** An unknown state gates acting, like every non-member state. */
internal fun com.cogra.network.graphql.type.AccountState.toDomain(): AccountState =
    runCatching { AccountState.valueOf(rawValue) }.getOrDefault(AccountState.UNKNOWN)

/** The census names match by construction; an unknown family is a contract break. */
internal fun RecordFamily.toDomain(): Family =
    runCatching { Family.valueOf(rawValue) }
        .getOrElse { error("unknown record family $rawValue") }

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

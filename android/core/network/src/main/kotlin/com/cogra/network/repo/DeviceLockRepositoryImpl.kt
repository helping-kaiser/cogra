// The device lock's verbs over the generated client (auth.md "Device lock";
// api-spec.md "Auth and accounts"). The operation documents mirror the web's
// by name and selection.
//
// A call made with an explicit access token carries it INSTEAD of the stored
// session's (`EXPLICIT_BEARER_HEADER`): the sign-in's leg runs before its
// fresh pair is stored. A call without one rides the stored session through
// the guard, refreshed and replayed like any other.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloCall
import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Operation
import com.cogra.domain.Outcome
import com.cogra.domain.repo.DeviceLockRepository
import com.cogra.domain.repo.IssuedLock
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.EXPLICIT_BEARER_HEADER
import com.cogra.network.graphql.DiscardDeviceLockMutation
import com.cogra.network.graphql.IssueDeviceLockMutation
import com.cogra.network.graphql.ReleaseDeviceLockMutation
import com.cogra.network.graphql.type.DiscardDeviceLockInput
import com.cogra.network.graphql.type.ReleaseDeviceLockInput
import com.cogra.network.payloadOutcome
import java.util.Base64
import javax.inject.Inject
import javax.inject.Singleton

private const val SECRET_LEN = 32

/** A secret the server answered in a shape this client cannot read is a contract break. */
private fun secretOf(base64: String?): ByteArray? = base64
    ?.let { runCatching { Base64.getDecoder().decode(it) }.getOrNull() }
    ?.takeIf { it.size == SECRET_LEN }

private fun <D : Operation.Data> ApolloCall<D>.bearer(accessToken: String?): ApolloCall<D> =
    if (accessToken == null) this else addHttpHeader(EXPLICIT_BEARER_HEADER, accessToken)

@Singleton
class DeviceLockRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : DeviceLockRepository {

    private suspend fun <T> guarded(accessToken: String?, call: suspend () -> Outcome<T>): Outcome<T> =
        if (accessToken == null) guard.run(call) else call()

    override suspend fun issue(accessToken: String?): Outcome<IssuedLock> = guarded(accessToken) {
        client.mutation(IssueDeviceLockMutation()).bearer(accessToken)
            .payloadOutcome({ it.issueDeviceLock.userErrors.map { e -> e.userErrorFields } }) { data ->
                data.issueDeviceLock.lock?.let { lock -> secretOf(lock.secret)?.let { IssuedLock(lock.id, it) } }
            }
    }

    override suspend fun release(lock: String, password: String, accessToken: String?): Outcome<ByteArray> =
        guarded(accessToken) {
            client.mutation(ReleaseDeviceLockMutation(ReleaseDeviceLockInput(lock, password))).bearer(accessToken)
                .payloadOutcome({ it.releaseDeviceLock.userErrors.map { e -> e.userErrorFields } }) {
                    secretOf(it.releaseDeviceLock.secret)
                }
        }

    override suspend fun discard(lock: String, accessToken: String?): Outcome<Unit> = guarded(accessToken) {
        client.mutation(DiscardDeviceLockMutation(DiscardDeviceLockInput(lock))).bearer(accessToken)
            .payloadOutcome({ it.discardDeviceLock.userErrors.map { e -> e.userErrorFields } }) {
                it.discardDeviceLock.ok?.takeIf { ok -> ok }?.let { Unit }
            }
    }
}

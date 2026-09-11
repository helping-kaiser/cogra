// The session-token machinery (android/CLAUDE.md "Auth / tokens"): the
// access token rides as a Bearer header; an UNAUTHENTICATED refusal
// triggers a single-flight refresh-and-replay. UNAUTHENTICATED arrives
// two ways — a null `me` on a viewer read, and an errors-array entry
// with `extensions.code` on a guarded mutation (api-spec.md "Errors are
// tiered") — and the outcome mapping synthesizes both into the same
// refusal shape, so the retry lives at the repository tier, not in an
// HTTP interceptor.

package com.cogra.network.auth

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.http.HttpRequest
import com.apollographql.apollo.api.http.HttpResponse
import com.apollographql.apollo.network.http.HttpInterceptor
import com.apollographql.apollo.network.http.HttpInterceptorChain
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.has
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.store.SessionRead
import com.cogra.domain.store.TokenStore
import com.cogra.network.graphql.RefreshSessionMutation
import com.cogra.network.graphql.type.RefreshSessionInput
import com.cogra.network.payloadOutcome
import com.cogra.domain.AuthTokens
import java.util.Base64
import javax.inject.Inject
import javax.inject.Provider
import javax.inject.Singleton
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

/**
 * The request could not be resolved as anonymous OR authenticated,
 * because the device's session could not be read. It fails the call —
 * the one answer that is never wrong. Sending it anonymous would serve
 * a signed-in reader somebody else's view and look like a working app.
 */
class SessionUnreadableException : Exception("the session store holds a record it cannot open")

/** The header a call sets to skip the gate — stripped before the wire. */
internal const val SESSION_BYPASS_HEADER = "X-Cogra-Session-Bypass"

/** Refresh this far before `exp` rather than sending a token about to die. */
private const val CLOCK_SKEW_SECONDS = 30L

private const val MILLIS_PER_SECOND = 1_000L

@Serializable
private data class AccessClaims(val exp: Long? = null)

private val claimsJson = Json { ignoreUnknownKeys = true }

/**
 * The readiness gate every possibly-authenticated request passes.
 *
 * The token store answers only once it has finished loading, and it
 * separates a fault from an absence — which is what makes three
 * different answers possible here instead of one null:
 *
 * - no session: the request goes out anonymous at once. Guest browsing,
 *   onboarding, login and register are anonymous by design, and gating
 *   them on anything would deadlock the only flows that can create a
 *   session;
 * - a session whose access token is still good: it rides as `Bearer`;
 * - a session whose access token has expired: the single-flight refresh
 *   runs FIRST, and the fresh token rides. The API resolves a viewer
 *   from the header with `Option<Viewer>`, so an expired token is not a
 *   refusal the reader would see — the read simply answers as a guest
 *   would, which is how a cold start landed a member on the borrowed
 *   view and kept them there.
 */
@Singleton
class SessionGate @Inject constructor(
    private val tokens: TokenStore,
    // Provider breaks the construction cycle: the refresher calls the
    // client, whose interceptor consults this gate.
    private val refresher: Provider<SessionRefresher>,
) {
    /** The token this request must carry; null for a legitimate anonymous one. */
    suspend fun accessToken(): String? = when (val read = tokens.read()) {
        SessionRead.None -> null
        SessionRead.Unreadable -> throw SessionUnreadableException()
        is SessionRead.Present -> usable(read.tokens.accessToken)
    }

    /** The stored token as it stands — the refresh's own call, ungated. */
    suspend fun storedAccessToken(): String? = tokens.current()?.accessToken

    private suspend fun usable(access: String): String? {
        if (!expired(access)) return access
        refresher.get().refresh(access)
        return when (val after = tokens.read()) {
            is SessionRead.Present -> after.tokens.accessToken
            // Reuse detection ended the session: this reader really is
            // signed out now, and anonymous is the truth.
            SessionRead.None -> null
            SessionRead.Unreadable -> throw SessionUnreadableException()
        }
    }
}

/**
 * Whether the access token's own `exp` has passed (auth.md "Access
 * token" — a 15-minute JWT).
 *
 * Read, never verified: the server owns the signature, and this only
 * decides whether asking is worth it. A token whose claims will not
 * parse counts as good — the server answers it, and [AuthGuard] still
 * refresh-and-replays on the refusal.
 */
internal fun expired(
    access: String,
    nowSeconds: Long = System.currentTimeMillis() / MILLIS_PER_SECOND,
): Boolean {
    val exp = expiry(access) ?: return false
    return exp - CLOCK_SKEW_SECONDS <= nowSeconds
}

private fun expiry(access: String): Long? {
    val payload = access.split('.').takeIf { it.size == 3 }?.get(1) ?: return null
    return try {
        val claims = Base64.getUrlDecoder().decode(payload).decodeToString()
        claimsJson.decodeFromString<AccessClaims>(claims).exp
    } catch (_: IllegalArgumentException) {
        null
    } catch (_: SerializationException) {
        null
    }
}

/** Adds `Authorization: Bearer <access>` for every request the gate resolves. */
class BearerInterceptor(private val gate: SessionGate) : HttpInterceptor {
    override suspend fun intercept(request: HttpRequest, chain: HttpInterceptorChain): HttpResponse {
        val bypass = request.headers.any { it.name == SESSION_BYPASS_HEADER }
        val outgoing = if (bypass) {
            request.newBuilder()
                .headers(request.headers.filterNot { it.name == SESSION_BYPASS_HEADER })
                .build()
        } else {
            request
        }
        val access = if (bypass) gate.storedAccessToken() else gate.accessToken()
        return chain.proceed(
            if (access == null) {
                outgoing
            } else {
                outgoing.newBuilder().addHeader("Authorization", "Bearer $access").build()
            },
        )
    }
}

/**
 * The single-flight refresh: one caller rotates the pair, concurrent
 * callers wait on the lock and find fresh tokens. Reuse detection
 * (REFRESH_TOKEN_INVALID) signs the device out — every session was
 * revoked server-side (auth.md "Refresh token").
 */
@Singleton
class SessionRefresher @Inject constructor(
    private val tokens: TokenStore,
    private val endLocalSession: EndLocalSession,
    // Provider breaks the construction cycle: the client's interceptor
    // reads the token store, and this refresher calls the client.
    private val client: Provider<ApolloClient>,
) {
    private val mutex = Mutex()

    /**
     * Refreshes unless someone already did (the stored access token no
     * longer matches [staleAccess]). Returns true when a replay is
     * worth attempting.
     */
    suspend fun refresh(staleAccess: String?): Boolean = mutex.withLock {
        val current = tokens.current() ?: return false
        if (staleAccess != null && current.accessToken != staleAccess) return true
        val outcome = client.get()
            .mutation(RefreshSessionMutation(RefreshSessionInput(current.refreshToken)))
            // The one call that must not consult the gate: the gate's
            // own remedy is this mutation, and the lock is already held
            // here — gating it would wait for itself.
            .addHttpHeader(SESSION_BYPASS_HEADER, "1")
            .payloadOutcome(
                { it.refreshSession.userErrors.map { e -> e.userErrorFields } },
                { it.refreshSession.auth },
            )
        return when (outcome) {
            is Outcome.Success -> {
                val fields = outcome.value.authSessionFields
                // The rotated pair authenticates the same account; the
                // response's viewer re-asserts it, the stored id backs
                // a response that omits it.
                tokens.save(
                    AuthTokens(
                        fields.accessToken,
                        fields.refreshToken,
                        fields.user?.id ?: current.accountId,
                    ),
                )
                true
            }
            is Outcome.Refused -> {
                // Ending the session locally honors the account's
                // "don't remember me" opt-in, exactly like sign-out.
                if (outcome.has(ErrorCode.REFRESH_TOKEN_INVALID)) endLocalSession.end()
                false
            }
            is Outcome.Failed -> false
        }
    }
}

/**
 * Wraps an authenticated call: on an UNAUTHENTICATED refusal, refresh
 * once and replay once. Anything else passes through.
 */
@Singleton
class AuthGuard @Inject constructor(
    private val tokens: TokenStore,
    private val refresher: SessionRefresher,
) {
    suspend fun <T> run(block: suspend () -> Outcome<T>): Outcome<T> {
        val before = tokens.current()?.accessToken
        val first = block()
        if (first !is Outcome.Refused || !first.has(ErrorCode.UNAUTHENTICATED)) return first
        return if (refresher.refresh(before)) block() else first
    }
}

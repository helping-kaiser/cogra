// The readiness gate (F3-5): no possibly-authenticated request leaves
// before the token store has answered, and none of the three answers
// the store can give is ever turned into a quiet anonymous request.

package com.cogra.network.auth

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import com.apollographql.apollo.ApolloClient
import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.store.SessionRead
import com.cogra.domain.store.TokenStore
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.network.repo.SessionRepositoryImpl
import com.cogra.network.store.EncryptedStore
import com.cogra.network.store.StoreCipher
import com.cogra.network.store.TokenStoreImpl
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.security.GeneralSecurityException
import java.util.Base64
import java.util.concurrent.TimeUnit
import javax.inject.Provider

/** A store whose load can be held open, the way a cold start holds it. */
private class HeldTokenStore : TokenStore {
    private val state = MutableStateFlow<SessionRead>(SessionRead.None)
    private val loaded = CompletableDeferred<Unit>()

    override val tokens: Flow<AuthTokens?> =
        state.map { (it as? SessionRead.Present)?.tokens }

    override suspend fun read(): SessionRead {
        loaded.await()
        return state.value
    }

    override suspend fun current(): AuthTokens? = (read() as? SessionRead.Present)?.tokens

    override suspend fun save(tokens: AuthTokens) {
        state.value = SessionRead.Present(tokens)
    }

    override suspend fun clear() {
        state.value = SessionRead.None
    }

    /** The load lands, holding [read]. */
    fun finishLoading(read: SessionRead) {
        state.value = read
        loaded.complete(Unit)
    }
}

/** Sealing works, opening does not — a master key that is gone. */
private class UnopenableCipher : StoreCipher {
    override fun seal(plaintext: ByteArray): ByteArray = plaintext

    override fun open(sealed: ByteArray): ByteArray =
        throw GeneralSecurityException("the master key can no longer open this")
}

class SessionGateTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private lateinit var server: MockWebServer
    private lateinit var client: ApolloClient
    private val identity = FakeIdentityStore()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @After
    fun tearDown() {
        if (::client.isInitialized) client.close()
        server.shutdown()
        scope.cancel()
    }

    /** Wires the production shape: gate → interceptor → client → refresher. */
    private fun wire(tokens: TokenStore): SessionRepositoryImpl {
        val refresher = SessionRefresher(
            tokens,
            EndLocalSession(identity, tokens),
            Provider { client },
        )
        val gate = SessionGate(tokens, Provider { refresher })
        client = ApolloClient.Builder()
            .serverUrl(server.url("/graphql").toString())
            .addHttpInterceptor(BearerInterceptor(gate))
            .build()
        return SessionRepositoryImpl(client, AuthGuard(tokens, refresher))
    }

    private fun enqueue(json: String) {
        server.enqueue(MockResponse().setBody(json).addHeader("Content-Type", "application/json"))
    }

    private fun revoked(count: Int) = enqueue(
        """{"data":{"revokeOtherSessions":{"__typename":"RevokeSessionsPayload",
           "revokedCount":$count,"userErrors":[]}}}""",
    )

    private fun refreshSuccess(access: String, refresh: String) = enqueue(
        """{"data":{"refreshSession":{"__typename":"RefreshPayload",
           "auth":{"__typename":"AuthSession","accessToken":"$access","refreshToken":"$refresh",
           "user":{"__typename":"User","id":"u1"}},
           "userErrors":[]}}}""",
    )

    /** A token shaped like the API's: an EdDSA JWT whose `exp` is readable. */
    private fun jwt(expSeconds: Long): String {
        val encoder = Base64.getUrlEncoder().withoutPadding()
        val header = encoder.encodeToString("""{"alg":"EdDSA","typ":"JWT"}""".encodeToByteArray())
        val claims = encoder.encodeToString(
            """{"sub":"u1","iat":0,"exp":$expSeconds}""".encodeToByteArray(),
        )
        return "$header.$claims.c2lnbmF0dXJl"
    }

    private fun nowSeconds() = System.currentTimeMillis() / 1000

    @Test
    fun aRequestWaitsForTheStoreAndThenCarriesTheToken() = runTest {
        val tokens = HeldTokenStore()
        val sessions = wire(tokens)
        revoked(1)

        val call = async(Dispatchers.IO) { sessions.revokeOtherSessions() }
        // The store has not answered: nothing may leave, least of all a
        // request that would be served as somebody else.
        assertThat(server.takeRequest(250, TimeUnit.MILLISECONDS)).isNull()

        val access = jwt(nowSeconds() + 600)
        tokens.finishLoading(SessionRead.Present(AuthTokens(access, "r1", "u1")))

        assertThat((call.await() as Outcome.Success).value).isEqualTo(1)
        assertThat(server.takeRequest().getHeader("Authorization")).isEqualTo("Bearer $access")
    }

    @Test
    fun aLoadedEmptyStoreGoesOutAnonymousAtOnce() = runTest {
        val tokens = HeldTokenStore()
        val sessions = wire(tokens)
        revoked(0)
        // Loaded, no session — the fresh install, the guest, the reader
        // on their way to the login form. Nothing waits on anything.
        tokens.finishLoading(SessionRead.None)

        sessions.revokeOtherSessions()

        assertThat(server.requestCount).isEqualTo(1)
        assertThat(server.takeRequest().getHeader("Authorization")).isNull()
    }

    @Test
    fun anUnreadableStoreFailsTheRequestInsteadOfSendingItAnonymous() = runTest {
        val file = File(tmp.newFolder(), "test.preferences_pb")
        val store = EncryptedStore(
            PreferenceDataStoreFactory.create(scope = scope) { file },
            UnopenableCipher(),
        )
        val tokens = TokenStoreImpl(store)
        tokens.save(AuthTokens("access", "refresh", "u1"))
        assertThat(tokens.read()).isEqualTo(SessionRead.Unreadable)

        val sessions = wire(tokens)
        val outcome = sessions.revokeOtherSessions()

        assertThat(outcome).isInstanceOf(Outcome.Failed::class.java)
        // Never on the wire: a request nobody can attribute is worse
        // than no request at all.
        assertThat(server.requestCount).isEqualTo(0)
    }

    @Test
    fun anExpiredTokenRefreshesBeforeTheRequestRatherThanAfterIt() = runTest {
        val tokens = FakeTokenStore()
        tokens.save(AuthTokens(jwt(nowSeconds() - 60), "r1", "u1"))
        val sessions = wire(tokens)
        refreshSuccess("fresh-access", "r2")
        revoked(2)

        assertThat((sessions.revokeOtherSessions() as Outcome.Success).value).isEqualTo(2)

        // Two requests, in this order: the rotation, then the call it
        // was for — never a third, and never a guest read.
        assertThat(server.requestCount).isEqualTo(2)
        val rotation = server.takeRequest()
        // The gate's own remedy does not pass the gate.
        assertThat(rotation.getHeader(SESSION_BYPASS_HEADER)).isNull()
        assertThat(server.takeRequest().getHeader("Authorization")).isEqualTo("Bearer fresh-access")
        assertThat(tokens.current()).isEqualTo(AuthTokens("fresh-access", "r2", "u1"))
    }

    @Test
    fun aTokenWithLifeLeftIsSentAsItStands() = runTest {
        val tokens = FakeTokenStore()
        val access = jwt(nowSeconds() + 600)
        tokens.save(AuthTokens(access, "r1", "u1"))
        val sessions = wire(tokens)
        revoked(3)

        assertThat((sessions.revokeOtherSessions() as Outcome.Success).value).isEqualTo(3)

        assertThat(server.requestCount).isEqualTo(1)
        assertThat(server.takeRequest().getHeader("Authorization")).isEqualTo("Bearer $access")
    }

    @Test
    fun concurrentRequestsShareOneProactiveRefresh() = runTest {
        val tokens = FakeTokenStore()
        tokens.save(AuthTokens(jwt(nowSeconds() - 60), "r1", "u1"))
        val sessions = wire(tokens)
        refreshSuccess("fresh-access", "r2")
        revoked(1)
        revoked(1)

        listOf(
            async(Dispatchers.IO) { sessions.revokeOtherSessions() },
            async(Dispatchers.IO) { sessions.revokeOtherSessions() },
        ).awaitAll()

        // One rotation for both — the second caller found the fresh pair.
        assertThat(server.requestCount).isEqualTo(3)
    }

    @Test
    fun anOpaqueTokenIsLeftToTheServer() = runTest {
        // Not a JWT this can read: guessing "expired" would rotate a
        // perfectly good session on every request.
        val tokens = FakeTokenStore()
        tokens.save(AuthTokens("opaque-access", "r1", "u1"))
        val sessions = wire(tokens)
        revoked(0)

        sessions.revokeOtherSessions()

        assertThat(server.requestCount).isEqualTo(1)
        assertThat(server.takeRequest().getHeader("Authorization")).isEqualTo("Bearer opaque-access")
    }

    @Test
    fun aRefreshThatEndsTheSessionLeavesTheRequestAnonymous() = runTest {
        val tokens = FakeTokenStore()
        tokens.save(AuthTokens(jwt(nowSeconds() - 60), "stolen", "u1"))
        val sessions = wire(tokens)
        enqueue(
            """{"data":{"refreshSession":{"__typename":"RefreshPayload","auth":null,
               "userErrors":[{"__typename":"UserError","message":"reuse detected",
               "code":"REFRESH_TOKEN_INVALID","field":null}]}}}""",
        )
        revoked(0)

        sessions.revokeOtherSessions()

        // Reuse detection signed the device out; anonymous is now the
        // truth about this reader, not a guess about the store.
        assertThat(tokens.current()).isNull()
        assertThat(server.requestCount).isEqualTo(2)
        server.takeRequest()
        assertThat(server.takeRequest().getHeader("Authorization")).isNull()
    }
}

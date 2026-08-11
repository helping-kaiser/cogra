// The repositories against a MockWebServer through the real generated
// Apollo client: tier mapping (Success / Refused / Failed), scalar
// adapters, fragment mapping, and the null-`me` translation.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.WriteState
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.OnboardingRepositoryImpl
import com.cogra.network.repo.SessionRepositoryImpl
import com.cogra.network.repo.WriteRepositoryImpl
import com.cogra.domain.AuthTokens
import com.cogra.domain.store.TokenStore
import com.google.common.truth.Truth.assertThat
import java.time.Instant
import java.util.Base64
import javax.inject.Provider
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test

class InMemoryTokenStore : TokenStore {
    override val tokens = MutableStateFlow<AuthTokens?>(null)

    override suspend fun current(): AuthTokens? = tokens.value

    override suspend fun save(tokens: AuthTokens) {
        this.tokens.value = tokens
    }

    override suspend fun clear() {
        tokens.value = null
    }
}

class RepositoriesTest {

    private lateinit var server: MockWebServer
    private lateinit var client: ApolloClient
    private val tokenStore = InMemoryTokenStore()

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        client = ApolloClient.Builder().serverUrl(server.url("/graphql").toString()).build()
    }

    @After
    fun tearDown() {
        client.close()
        server.shutdown()
    }

    private fun enqueue(json: String) {
        server.enqueue(MockResponse().setBody(json).addHeader("Content-Type", "application/json"))
    }

    private fun guard() = AuthGuard(
        tokenStore,
        SessionRefresher(tokenStore, EndLocalSession(FakeIdentityStore(), tokenStore), Provider { client }),
    )

    @Test
    fun inviteCheckMapsBothBranches() = runTest {
        val onboarding = OnboardingRepositoryImpl(client, guard())
        enqueue(
            """{"data":{"inviteLinkCheck":{"__typename":"InviteLinkCheck",
               "usable":true,"inviterHandle":"inviter","expiresAt":"2027-01-01T00:00:00+00:00"}}}""",
        )
        val check = (onboarding.checkInviteLink("id") as Outcome.Success).value
        assertThat(checkNotNull(check).usable).isTrue()
        assertThat(check.inviterHandle).isEqualTo("inviter")
        assertThat(check.expiresAt.toString()).isEqualTo("2027-01-01T00:00:00Z")

        enqueue("""{"data":{"inviteLinkCheck":null}}""")
        assertThat((onboarding.checkInviteLink("id") as Outcome.Success).value).isNull()
    }

    @Test
    fun registerReturnsTheOrdinarySessionPair() = runTest {
        val onboarding = OnboardingRepositoryImpl(client, guard())
        enqueue(
            """{"data":{"register":{"__typename":"RegisterPayload",
               "auth":{"__typename":"AuthSession","accessToken":"a","refreshToken":"r",
               "user":{"__typename":"User","id":"u1"}},
               "expiresAt":"2026-08-07T12:00:00+00:00","userErrors":[]}}}""",
        )
        val tokens = (onboarding.register("l", "h", "e@x.com", "p".repeat(12), "phone") as Outcome.Success).value
        // The pair carries the account it authenticates.
        assertThat(tokens).isEqualTo(AuthTokens("a", "r", "u1"))
    }

    @Test
    fun logInMapsTheGrantWithAndWithoutTheNotice() = runTest {
        val sessions = SessionRepositoryImpl(client, guard())
        enqueue(
            """{"data":{"logIn":{"__typename":"LogInPayload",
               "auth":{"__typename":"AuthSession","accessToken":"a","refreshToken":"r",
               "user":{"__typename":"User","id":"u1"}},
               "reuseDetectedAt":"2026-08-10T09:30:00+00:00","userErrors":[]}}}""",
        )
        val notified = (sessions.logIn("e@x.com", "pw", null) as Outcome.Success).value
        assertThat(notified.tokens).isEqualTo(AuthTokens("a", "r", "u1"))
        assertThat(notified.reuseDetectedAt).isEqualTo(Instant.parse("2026-08-10T09:30:00Z"))
        enqueue(
            """{"data":{"logIn":{"__typename":"LogInPayload",
               "auth":{"__typename":"AuthSession","accessToken":"a","refreshToken":"r",
               "user":{"__typename":"User","id":"u1"}},
               "reuseDetectedAt":null,"userErrors":[]}}}""",
        )
        val clean = (sessions.logIn("e@x.com", "pw", null) as Outcome.Success).value
        assertThat(clean.reuseDetectedAt).isNull()
    }

    @Test
    fun aRefusalCarriesCodeAndFieldPath() = runTest {
        val onboarding = OnboardingRepositoryImpl(client, guard())
        enqueue(
            """{"data":{"register":{"__typename":"RegisterPayload",
               "auth":null,"expiresAt":null,
               "userErrors":[{"__typename":"UserError","message":"taken",
               "code":"HANDLE_TAKEN","field":["input","handle"]}]}}}""",
        )
        val refused = onboarding.register("l", "h", "e@x.com", "p".repeat(12), null)
            as Outcome.Refused
        val error = refused.errors.single()
        assertThat(error.code).isEqualTo(ErrorCode.HANDLE_TAKEN)
        assertThat(error.field).containsExactly("input", "handle").inOrder()
    }

    @Test
    fun anUnknownErrorCodeDegradesToUnknown() = runTest {
        val onboarding = OnboardingRepositoryImpl(client, guard())
        enqueue(
            """{"data":{"register":{"__typename":"RegisterPayload",
               "auth":null,"expiresAt":null,
               "userErrors":[{"__typename":"UserError","message":"new refusal",
               "code":"SOME_FUTURE_CODE","field":null}]}}}""",
        )
        val refused = onboarding.register("l", "h", "e@x.com", "p".repeat(12), null)
            as Outcome.Refused
        assertThat(refused.errors.single().code).isEqualTo(ErrorCode.UNKNOWN)
    }

    @Test
    fun applicationStatusMapsTheViewerAndPicksTheLiveRegistration() = runTest {
        val onboarding = OnboardingRepositoryImpl(client, guard())
        tokenStore.save(AuthTokens("a", "r", "u1"))
        val proposal = Base64.getEncoder().encodeToString(byteArrayOf(1))
        enqueue(
            """{"data":{"me":{"__typename":"User","id":"u1","accountState":"APPLICANT","actorPubkey":"attached-key",
               "application":{"__typename":"Application","id":"app1","handle":"joiner",
                 "emailVerified":true,"keyAttached":false,"approvedAt":null,"landedAt":null,
                 "createdAt":"2026-08-06T12:00:00+00:00","expiresAt":"2026-08-07T12:00:00+00:00"},
               "stagedWrites":{"__typename":"StagedWriteConnection","nodes":[
                 {"__typename":"StagedWrite","id":"old","state":"EXPIRED","family":"REGISTRATION",
                  "canonicalProposal":"$proposal","verifiedAct":null,"record":null},
                 {"__typename":"StagedWrite","id":"reg","state":"AWAITING_PRE_SIGN","family":"REGISTRATION",
                  "canonicalProposal":"$proposal","verifiedAct":null,"record":null}]}}}}""",
        )
        val status = (onboarding.applicationStatus() as Outcome.Success).value
        assertThat(status.accountState).isEqualTo(com.cogra.domain.AccountState.APPLICANT)
        val application = checkNotNull(status.application)
        assertThat(application.emailVerified).isTrue()
        assertThat(application.keyAttached).isFalse()
        assertThat(status.actorPubkey).isEqualTo("attached-key")
        // The expired staging is dead; the live one is served.
        assertThat(checkNotNull(status.stagedRegistration).id).isEqualTo("reg")
        assertThat(status.stagedRegistration?.state).isEqualTo(WriteState.AWAITING_PRE_SIGN)
    }

    @Test
    fun applicationStatusWithoutAViewerRefuses() = runTest {
        val onboarding = OnboardingRepositoryImpl(client, guard())
        enqueue("""{"data":{"me":null}}""")
        val refused = onboarding.applicationStatus() as Outcome.Refused
        assertThat(refused.errors.single().code).isEqualTo(ErrorCode.UNAUTHENTICATED)
    }

    @Test
    fun attachActorKeyMapsSuccessAndRefusal() = runTest {
        val onboarding = OnboardingRepositoryImpl(client, guard())
        tokenStore.save(AuthTokens("a", "r", "u1"))
        enqueue(
            """{"data":{"attachActorKey":{"__typename":"AttachActorKeyPayload",
               "user":{"__typename":"User","id":"u1"},"userErrors":[]}}}""",
        )
        assertThat(onboarding.attachActorKey("pk", "addr")).isInstanceOf(Outcome.Success::class.java)

        enqueue(
            """{"data":{"attachActorKey":{"__typename":"AttachActorKeyPayload",
               "user":null,"userErrors":[{"__typename":"UserError","message":"bound",
               "code":"FORBIDDEN","field":null}]}}}""",
        )
        val refused = onboarding.attachActorKey("pk", "addr") as Outcome.Refused
        assertThat(refused.errors.single().code).isEqualTo(ErrorCode.FORBIDDEN)
    }

    @Test
    fun transportFaultsAreFailed() = runTest {
        val writes = WriteRepositoryImpl(client, guard())
        server.enqueue(MockResponse().setResponseCode(500))
        assertThat(writes.hostPublicKey()).isInstanceOf(Outcome.Failed::class.java)

        // The GraphQL errors array is the transport tier too.
        enqueue("""{"errors":[{"message":"internal error"}],"data":null}""")
        assertThat(writes.stagedWrite("id")).isInstanceOf(Outcome.Failed::class.java)
    }

    @Test
    fun anErrorsArrayUnauthenticatedBecomesARefusal() = runTest {
        val writes = WriteRepositoryImpl(client, guard())
        enqueue(
            """{"data":null,"errors":[{"message":"authentication required",
               "extensions":{"code":"UNAUTHENTICATED"}}]}""",
        )
        val refused = writes.stagedWrite("id") as Outcome.Refused
        assertThat(refused.errors.single().code).isEqualTo(ErrorCode.UNAUTHENTICATED)
        // Signed out → no refresh, no replay.
        assertThat(server.requestCount).isEqualTo(1)
    }

    @Test
    fun anErrorsArrayRateLimitedBecomesARefusalWithoutReplay() = runTest {
        // The rate limiter refuses at the transport tier; the client
        // must render "too many attempts", not a connectivity error —
        // and, unlike UNAUTHENTICATED, never refresh-and-replay.
        val writes = WriteRepositoryImpl(client, guard())
        tokenStore.save(AuthTokens("a", "r", "u1"))
        enqueue(
            """{"data":null,"errors":[{"message":"too many attempts",
               "extensions":{"code":"RATE_LIMITED"}}]}""",
        )
        val refused = writes.stagedWrite("id") as Outcome.Refused
        assertThat(refused.errors.single().code).isEqualTo(ErrorCode.RATE_LIMITED)
        // Even signed in: one request — no refresh, no replay.
        assertThat(server.requestCount).isEqualTo(1)
    }

    @Test
    fun stagedWriteFieldsMapToTheDomainView() = runTest {
        val writes = WriteRepositoryImpl(client, guard())
        tokenStore.save(AuthTokens("a", "r", "u1"))
        val proposal = Base64.getEncoder().encodeToString(byteArrayOf(1, 2, 3))
        enqueue(
            """{"data":{"stagedWrite":{"__typename":"StagedWrite","id":"w1",
               "state":"AWAITING_APPROVAL","family":"OPINION",
               "canonicalProposal":"$proposal","verifiedAct":null,"record":null}}}""",
        )
        val view = checkNotNull((writes.stagedWrite("w1") as Outcome.Success).value)
        assertThat(view.state).isEqualTo(WriteState.AWAITING_APPROVAL)
        assertThat(view.family).isEqualTo(com.cogra.crypto.Family.OPINION)
        assertThat(view.canonicalProposal).isEqualTo(byteArrayOf(1, 2, 3))
        assertThat(view.verifiedAct).isNull()
        assertThat(view.recordId).isNull()
    }

    @Test
    fun theHostKeyIsCachedPerProcess() = runTest {
        val writes = WriteRepositoryImpl(client, guard())
        val key = Base64.getEncoder().encodeToString(ByteArray(32) { 7 })
        enqueue("""{"data":{"hostPublicKey":"$key"}}""")
        assertThat((writes.hostPublicKey() as Outcome.Success).value).isEqualTo(ByteArray(32) { 7 })
        assertThat((writes.hostPublicKey() as Outcome.Success).value).isEqualTo(ByteArray(32) { 7 })
        assertThat(server.requestCount).isEqualTo(1)
    }

    @Test
    fun aSignedOutViewerReadRefusesWithoutReplay() = runTest {
        val sessions = SessionRepositoryImpl(client, guard())
        enqueue("""{"data":{"me":null}}""")
        val refused = sessions.sessions() as Outcome.Refused
        assertThat(refused.errors.single().code).isEqualTo(ErrorCode.UNAUTHENTICATED)
        // No tokens → no refresh, no replay.
        assertThat(server.requestCount).isEqualTo(1)
    }

    @Test
    fun sessionsMapWithInstants() = runTest {
        val sessions = SessionRepositoryImpl(client, guard())
        tokenStore.save(AuthTokens("a", "r", "u1"))
        enqueue(
            """{"data":{"me":{"__typename":"User","sessions":[
               {"__typename":"Session","id":"s1","deviceLabel":"phone",
                "createdAt":"2026-07-24T12:00:00+00:00","lastUsedAt":null,
                "expiresAt":"2026-08-23T12:00:00+00:00","isCurrent":true}]}}}""",
        )
        val list = (sessions.sessions() as Outcome.Success).value
        assertThat(list.single().deviceLabel).isEqualTo("phone")
        assertThat(list.single().lastUsedAt).isNull()
        assertThat(list.single().isCurrent).isTrue()
    }
}

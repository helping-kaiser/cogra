// The account deletion's calls against a MockWebServer through the real
// generated client: the standing read (path + grace), the request's
// lawful null, the confirm's opt-in-only sweep, the idempotent cancel and
// the applicant's immediate delete.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.AccountDeletionPath
import com.cogra.domain.AuthTokens
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.deletion.AccountDeletion
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.testing.FakeLockCustodyStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.AccountDeletionRepositoryImpl
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.time.Instant
import javax.inject.Provider

class AccountDeletionRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var client: ApolloClient
    private val tokenStore = FakeTokenStore()

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

    private fun repo() = AccountDeletionRepositoryImpl(
        client,
        AuthGuard(
            tokenStore,
            SessionRefresher(tokenStore, EndLocalSession(FakeLockCustodyStore(), tokenStore), Provider { client }),
        ),
    )

    private val grace = """{"__typename":"AccountDeletion","scheduledFor":"2026-10-20T12:00:00+00:00",
        "includesContent":false}"""

    @Test
    fun theStandingReadsThePathAndTheGrace() = runTest {
        tokenStore.save(AuthTokens("a", "r", "u1"))
        enqueue("""{"data":{"me":{"__typename":"User","id":"u1","accountDeletion":$grace,"deletionPath":"BY_LINK"}}}""")
        val standing = checkNotNull((repo().standing() as Outcome.Success).value)
        assertThat(standing.path).isEqualTo(AccountDeletionPath.BY_LINK)
        assertThat(standing.deletion)
            .isEqualTo(AccountDeletion(Instant.parse("2026-10-20T12:00:00Z"), includesContent = false))
    }

    @Test
    fun aPathThisBuildCannotNameReadsUnknown() = runTest {
        tokenStore.save(AuthTokens("a", "r", "u1"))
        enqueue("""{"data":{"me":{"__typename":"User","id":"u1","accountDeletion":null,"deletionPath":"LATER"}}}""")
        val standing = checkNotNull((repo().standing() as Outcome.Success).value)
        assertThat(standing.path).isEqualTo(AccountDeletionPath.UNKNOWN)
        assertThat(standing.deletion).isNull()
    }

    @Test
    fun noViewerIsUnauthenticated() = runTest {
        enqueue("""{"data":{"me":null}}""")
        val refused = repo().standing() as Outcome.Refused
        assertThat(refused.errors.single().code).isEqualTo(ErrorCode.UNAUTHENTICATED)
    }

    @Test
    fun aRequestAnswersNullAndCarriesItsChoice() = runTest {
        tokenStore.save(AuthTokens("a", "r", "u1"))
        enqueue(
            """{"data":{"requestAccountDeletion":{"__typename":"AccountDeletionPayload",
               "accountDeletion":null,"userErrors":[]}}}""",
        )
        assertThat(repo().request(includeContent = true)).isEqualTo(Outcome.Success(null))
        assertThat(server.takeRequest().body.readUtf8()).contains("\"input\":{\"includeContent\":true}")
    }

    @Test
    fun aSpentDeletionBudgetIsRateLimited() = runTest {
        tokenStore.save(AuthTokens("a", "r", "u1"))
        enqueue("""{"data":null,"errors":[{"message":"slow down","extensions":{"code":"RATE_LIMITED"}}]}""")
        val refused = repo().request(includeContent = false) as Outcome.Refused
        assertThat(refused.errors.single().code).isEqualTo(ErrorCode.RATE_LIMITED)
    }

    @Test
    fun theConfirmLeavesAnUntickedSweepAbsentAndSendsATickedOne() = runTest {
        enqueue(
            """{"data":{"confirmAccountDeletion":{"__typename":"AccountDeletionPayload",
               "accountDeletion":$grace,"userErrors":[]}}}""",
        )
        val confirmed = (repo().confirm("t", includeContent = false) as Outcome.Success).value
        assertThat(confirmed?.includesContent).isFalse()
        val first = server.takeRequest()
        assertThat(first.body.readUtf8()).contains("\"input\":{\"deletionToken\":\"t\"}")
        // The link is the capability: the confirm goes out bare.
        assertThat(first.getHeader("Authorization")).isNull()

        enqueue(
            """{"data":{"confirmAccountDeletion":{"__typename":"AccountDeletionPayload",
               "accountDeletion":{"__typename":"AccountDeletion","scheduledFor":"2026-10-20T12:00:00+00:00",
               "includesContent":true},"userErrors":[]}}}""",
        )
        val added = (repo().confirm("t", includeContent = true) as Outcome.Success).value
        assertThat(added?.includesContent).isTrue()
        assertThat(server.takeRequest().body.readUtf8())
            .contains("\"input\":{\"deletionToken\":\"t\",\"includeContent\":true}")
    }

    @Test
    fun aDeadLinkIsTokenInvalid() = runTest {
        enqueue(
            """{"data":{"confirmAccountDeletion":{"__typename":"AccountDeletionPayload",
               "accountDeletion":null,"userErrors":[{"__typename":"UserError","message":"dead",
               "code":"DELETION_TOKEN_INVALID","field":["deletionToken"]}]}}}""",
        )
        val refused = repo().confirm("gone", includeContent = false) as Outcome.Refused
        assertThat(refused.errors.single().code).isEqualTo(ErrorCode.DELETION_TOKEN_INVALID)
    }

    @Test
    fun aCancelWithNothingStandingIsNoError() = runTest {
        tokenStore.save(AuthTokens("a", "r", "u1"))
        enqueue(
            """{"data":{"cancelAccountDeletion":{"__typename":"AccountDeletionPayload",
               "accountDeletion":null,"userErrors":[]}}}""",
        )
        assertThat(repo().cancel()).isEqualTo(Outcome.Success(Unit))
    }

    @Test
    fun theApplicantsDeleteAnswersOkOrRefuses() = runTest {
        tokenStore.save(AuthTokens("a", "r", "u1"))
        enqueue(
            """{"data":{"deleteApplicantAccount":{"__typename":"DeleteApplicantAccountPayload",
               "ok":true,"userErrors":[]}}}""",
        )
        assertThat(repo().deleteApplicantAccount()).isEqualTo(Outcome.Success(Unit))

        enqueue(
            """{"data":{"deleteApplicantAccount":{"__typename":"DeleteApplicantAccountPayload",
               "ok":null,"userErrors":[{"__typename":"UserError","message":"funded",
               "code":"FORBIDDEN","field":null}]}}}""",
        )
        val refused = repo().deleteApplicantAccount() as Outcome.Refused
        assertThat(refused.errors.single().code).isEqualTo(ErrorCode.FORBIDDEN)
    }
}

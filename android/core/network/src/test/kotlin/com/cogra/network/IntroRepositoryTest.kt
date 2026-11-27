// The intro's calls against a MockWebServer through the real generated
// client: the seen flag and the fifth card's inviter, and the one write
// that sets the flag.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.AuthTokens
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.testing.FakeLockCustodyStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.IntroRepositoryImpl
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test
import javax.inject.Provider

class IntroRepositoryTest {

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

    private fun repo() = IntroRepositoryImpl(
        client,
        AuthGuard(
            tokenStore,
            SessionRefresher(tokenStore, EndLocalSession(FakeLockCustodyStore(), tokenStore), Provider { client }),
        ),
    )

    private fun actor(id: String, handle: String) =
        """{"__typename":"User","id":"$id","handle":"$handle",
           "displayName":{"__typename":"ModeratedText","value":"Mira Voss"},"avatar":null}"""

    @Test
    fun aLandedAccountReadsItsFlagAndWhoVouchedItIn() = runTest {
        tokenStore.save(AuthTokens("a", "r", "u1"))
        enqueue(
            """{"data":{"me":{"__typename":"User","id":"u1","accountState":"MEMBER",
               "preferences":{"__typename":"UserPreferences","hasSeenOnboarding":false},
               "invitedBy":${actor("u2", "mira")},
               "application":{"__typename":"Application","id":"a1","approver":${actor("u3", "ada")}}}}}""",
        )
        val account = checkNotNull((repo().introAccount() as Outcome.Success).value)
        assertThat(account.hasSeen).isFalse()
        assertThat(account.inviter?.handle).isEqualTo("mira")
        assertThat(account.inviter?.displayName).isEqualTo("Mira Voss")
    }

    @Test
    fun beforeLandingTheInviterIsTheApplicationsLinkIssuer() = runTest {
        tokenStore.save(AuthTokens("a", "r", "u1"))
        enqueue(
            """{"data":{"me":{"__typename":"User","id":"u1","accountState":"APPLICANT",
               "preferences":{"__typename":"UserPreferences","hasSeenOnboarding":true},
               "invitedBy":null,
               "application":{"__typename":"Application","id":"a1","approver":${actor("u3", "ada")}}}}}""",
        )
        val account = checkNotNull((repo().introAccount() as Outcome.Success).value)
        assertThat(account.hasSeen).isTrue()
        assertThat(account.inviter?.handle).isEqualTo("ada")
    }

    @Test
    fun anAccountWithNoPreferencesRowHasNotSeenTheIntro() = runTest {
        tokenStore.save(AuthTokens("a", "r", "u1"))
        enqueue(
            """{"data":{"me":{"__typename":"User","id":"u1","accountState":"MEMBER",
               "preferences":null,"invitedBy":null,"application":null}}}""",
        )
        val account = checkNotNull((repo().introAccount() as Outcome.Success).value)
        assertThat(account.hasSeen).isFalse()
        assertThat(account.inviter).isNull()
    }

    @Test
    fun markingSeenSendsOnlyTheFlag() = runTest {
        tokenStore.save(AuthTokens("a", "r", "u1"))
        enqueue(
            """{"data":{"setPreferences":{"__typename":"SetPreferencesPayload",
               "preferences":{"__typename":"UserPreferences","hasSeenOnboarding":true},"userErrors":[]}}}""",
        )
        assertThat(repo().markIntroSeen()).isEqualTo(Outcome.Success(Unit))
        val body = server.takeRequest().body.readUtf8()
        assertThat(body).contains("MarkIntroSeen")
        assertThat(body).contains("hasSeenOnboarding: true")
    }

    @Test
    fun aRefusedWriteIsRefused() = runTest {
        tokenStore.save(AuthTokens("a", "r", "u1"))
        enqueue(
            """{"data":{"setPreferences":{"__typename":"SetPreferencesPayload","preferences":null,
               "userErrors":[{"__typename":"UserError","message":"no","code":"BAD_INPUT","field":null}]}}}""",
        )
        val outcome = repo().markIntroSeen()
        assertThat(outcome).isInstanceOf(Outcome.Refused::class.java)
        assertThat((outcome as Outcome.Refused).errors.single().code).isEqualTo(ErrorCode.BAD_INPUT)
    }
}

// The settings surface's calls against a MockWebServer through the real
// generated client: the one Settings read, the preferences verb's
// absent-vs-null input, the email change's lifecycle verbs and the
// anonymous link check.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.AccountState
import com.cogra.domain.AuthTokens
import com.cogra.domain.ErrorCode
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.settings.EmailChangeLinkState
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.SettingsRepositoryImpl
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.time.Instant
import javax.inject.Provider

class SettingsRepositoryTest {

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

    private fun repo() = SettingsRepositoryImpl(
        client,
        AuthGuard(
            tokenStore,
            SessionRefresher(tokenStore, EndLocalSession(FakeIdentityStore(), tokenStore), Provider { client }),
        ),
    )

    private val pending = """{"__typename":"PendingEmailChange","newEmail":"sol@ferreira.studio",
        "requiresCode":true,"codeConfirmed":false,"linkConfirmed":true,
        "expiresAt":"2026-10-08T12:00:00+00:00"}"""

    @Test
    fun theSettingsReadMapsEveryRowsSource() = runTest {
        tokenStore.save(AuthTokens("a", "r", "u1"))
        enqueue(
            """{"data":{"me":{"__typename":"User","id":"u1","handle":"sol",
               "email":"sol@solferreira.art","emailVerified":true,"accountState":"MEMBER",
               "actorPubkey":"cGs=","passwordChangedAt":"2026-09-16T10:00:00+00:00",
               "keyBackupCreatedAt":null,"pendingEmailChange":$pending,
               "preferences":{"__typename":"UserPreferences","defaultLicense":
                 {"__typename":"License","attribution":1.0,"provenance":0.0}},
               "sessions":[{"__typename":"Session","id":"s1","deviceLabel":"Pixel 6",
                 "createdAt":"2026-07-24T12:00:00+00:00","lastUsedAt":null,"isCurrent":true}]}}}""",
        )
        val account = checkNotNull((repo().settingsAccount() as Outcome.Success).value)
        assertThat(account.handle).isEqualTo("sol")
        assertThat(account.email).isEqualTo("sol@solferreira.art")
        assertThat(account.accountState).isEqualTo(AccountState.MEMBER)
        assertThat(account.passwordChangedAt).isEqualTo(Instant.parse("2026-09-16T10:00:00Z"))
        assertThat(account.keyBackupCreatedAt).isNull()
        assertThat(account.defaultLicense).isEqualTo(LicenseChoice(1.0, 0.0))
        val change = checkNotNull(account.pendingEmailChange)
        assertThat(change.codeOwed).isTrue()
        assertThat(change.linkOwed).isFalse()
        assertThat(account.sessions.single().isCurrent).isTrue()
        assertThat(account.sessions.single().lastUsedAt).isNull()
    }

    @Test
    fun aSignedOutSettingsReadRefusesWithoutReplay() = runTest {
        enqueue("""{"data":{"me":null}}""")
        val refused = repo().settingsAccount() as Outcome.Refused
        assertThat(refused.errors.single().code).isEqualTo(ErrorCode.UNAUTHENTICATED)
        // No tokens → no refresh, no replay.
        assertThat(server.requestCount).isEqualTo(1)
    }

    @Test
    fun setDefaultLicenseSendsTheLicenseAndLeavesTheRestAbsent() = runTest {
        tokenStore.save(AuthTokens("a", "r", "u1"))
        enqueue(
            """{"data":{"setPreferences":{"__typename":"SetPreferencesPayload",
               "preferences":{"__typename":"UserPreferences","defaultLicense":
                 {"__typename":"License","attribution":0.5,"provenance":1.0}},"userErrors":[]}}}""",
        )
        val saved = (repo().setDefaultLicense(LicenseChoice(0.5, 1.0)) as Outcome.Success).value
        assertThat(saved).isEqualTo(LicenseChoice(0.5, 1.0))
        val body = server.takeRequest().body.readUtf8()
        assertThat(body).contains("\"defaultLicense\":{\"attribution\":0.5,\"provenance\":1.0}")
        // Absent fields are left as they are — never sent as null.
        assertThat(body).doesNotContain("hasSeenOnboarding")
        assertThat(body).doesNotContain("contentFilteringSeverityLevel")
    }

    @Test
    fun publicDomainIsTheExplicitNullThatRestoresTheDefault() = runTest {
        tokenStore.save(AuthTokens("a", "r", "u1"))
        enqueue(
            """{"data":{"setPreferences":{"__typename":"SetPreferencesPayload",
               "preferences":{"__typename":"UserPreferences","defaultLicense":null},"userErrors":[]}}}""",
        )
        val saved = repo().setDefaultLicense(null) as Outcome.Success
        assertThat(saved.value).isNull()
        assertThat(server.takeRequest().body.readUtf8()).contains("\"defaultLicense\":null")
    }

    @Test
    fun theEmailChangeVerbsMapTheirAnswers() = runTest {
        tokenStore.save(AuthTokens("a", "r", "u1"))
        enqueue(
            """{"data":{"requestEmailChange":{"__typename":"RequestEmailChangePayload",
               "pendingEmailChange":$pending,"userErrors":[]}}}""",
        )
        val requested = (repo().requestEmailChange("sol@ferreira.studio", "pw") as Outcome.Success).value
        assertThat(requested.newEmail).isEqualTo("sol@ferreira.studio")

        enqueue(
            """{"data":{"confirmEmailChange":{"__typename":"ConfirmEmailChangePayload",
               "user":{"__typename":"User","id":"u1","email":"sol@ferreira.studio",
               "pendingEmailChange":null},"userErrors":[]}}}""",
        )
        val applied = (repo().confirmEmailChange("123456") as Outcome.Success).value
        assertThat(applied.email).isEqualTo("sol@ferreira.studio")
        assertThat(applied.pending).isNull()

        enqueue(
            """{"data":{"resendEmailChange":{"__typename":"ResendEmailChangePayload",
               "pendingEmailChange":null,"userErrors":[{"__typename":"UserError",
               "message":"nothing pending","code":"NOT_FOUND","field":null}]}}}""",
        )
        val gone = repo().resendEmailChange() as Outcome.Refused
        assertThat(gone.errors.single().code).isEqualTo(ErrorCode.NOT_FOUND)

        enqueue(
            """{"data":{"cancelEmailChange":{"__typename":"CancelEmailChangePayload",
               "user":{"__typename":"User","id":"u1","email":"sol@solferreira.art",
               "pendingEmailChange":null},"userErrors":[]}}}""",
        )
        val canceled = (repo().cancelEmailChange() as Outcome.Success).value
        assertThat(canceled.email).isEqualTo("sol@solferreira.art")
    }

    @Test
    fun theLinkCheckIsAnonymousAndNullForAnUnknownToken() = runTest {
        enqueue(
            """{"data":{"emailChangeLinkCheck":{"__typename":"EmailChangeLinkCheck",
               "newEmail":"sol@ferreira.studio","state":"PENDING"}}}""",
        )
        val check = checkNotNull((repo().emailChangeLinkCheck("t") as Outcome.Success).value)
        assertThat(check.newEmail).isEqualTo("sol@ferreira.studio")
        assertThat(check.state).isEqualTo(EmailChangeLinkState.PENDING)
        // No session, and none asked for: the read goes out bare.
        assertThat(server.takeRequest().getHeader("Authorization")).isNull()

        enqueue("""{"data":{"emailChangeLinkCheck":null}}""")
        assertThat((repo().emailChangeLinkCheck("garbage") as Outcome.Success).value).isNull()
    }
}

// The creating-edge stance on the content write, as the wire carries it.
// Every stance value is a required input field and the server fills
// nothing in, so what the seal shows is exactly what rides — the pinned
// pre-fill as much as a value the author moved. Split out of
// ContentRepositoryTest, which sits at detekt's LargeClass edge.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.DEFAULT_STANCE
import com.cogra.domain.LicenseChoice
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.testing.FakeLockCustodyStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.ContentRepositoryImpl
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test
import javax.inject.Provider

class ContentStanceWireTest {

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

    private fun repo() = ContentRepositoryImpl(
        client,
        AuthGuard(
            tokenStore,
            SessionRefresher(tokenStore, EndLocalSession(FakeLockCustodyStore(), tokenStore), Provider { client }),
        ),
    )

    private suspend fun postWith(pDirected: Double): String {
        enqueue(
            """{"data":{"preparePost":{"__typename":"PrepareContentPayload",
               "node":"node-1","writes":[],"userErrors":[]}}}""",
        )
        repo().preparePost(
            title = "T",
            description = null,
            content = "B",
            license = LicenseChoice(attribution = 1.0, provenance = 0.0),
            pDirected = pDirected,
        )
        return server.takeRequest().body.readUtf8()
    }

    /** The author's picked creating-edge stance rides exactly as the seal showed it. */
    @Test
    fun aPostCarriesTheAuthorsPickedStanceOnTheWire() = runTest {
        assertThat(postWith(-0.8)).contains("\"pDirected\":-0.8")
    }

    /**
     * An untouched seal still states its value: the pre-filled +0.1 rides
     * as the explicit field the wire requires, never as an absent key.
     */
    @Test
    fun anUntouchedSealSendsItsPreFillExplicitly() = runTest {
        assertThat(postWith(DEFAULT_STANCE)).contains("\"pDirected\":0.1")
    }

    /** The reply seal's pad names both parameters, and both ride. */
    @Test
    fun aCommentCarriesItsPickedStancePairOnTheWire() = runTest {
        enqueue(
            """{"data":{"prepareComment":{"__typename":"PrepareContentPayload",
               "node":"c1","writes":[],"userErrors":[]}}}""",
        )
        repo().prepareComment(
            target = "p1",
            content = "Nice",
            license = LicenseChoice.PublicDomain,
            pDirected = 0.6,
            pInterest = -0.3,
        )
        val body = server.takeRequest().body.readUtf8()
        assertThat(body).contains("\"pDirected\":0.6")
        assertThat(body).contains("\"pInterest\":-0.3")
    }
}

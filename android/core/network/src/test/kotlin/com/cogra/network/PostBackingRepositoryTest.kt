// The edit pad's backing read (`PostBacking`) against a MockWebServer
// through the real generated Apollo client — its own file because the
// content repository's suite is already at detekt's size ceiling.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.Outcome
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

class PostBackingRepositoryTest {

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

    /**
     * The author's own Publish bundle, its net and its RAW sum carried
     * apart — past the axis the two differ, and the walk-back and Backing
     * after fold from the raw one (EditPad.md).
     */
    @Test
    fun theBackingReadServesTheNetAndTheRawSumApart() = runTest {
        enqueue(
            """{"data":{"post":{"__typename":"Post","id":"p1",
               "viewerBacking":{"__typename":"BackingBundle","rawPDirected":2.00047,"pDirected":1.0}}}}""",
        )
        val backing = (repo().postBacking("p1") as Outcome.Success).value
        assertThat(backing?.net).isEqualTo(1.0)
        assertThat(backing?.rawSum).isEqualTo(2.00047)
        val sent = server.takeRequest().body.readUtf8()
        assertThat(sent).contains("\"id\":\"p1\"")
        // Pending records count: an edit signed a moment ago is part of the backing.
        assertThat(sent).containsMatch("viewerBacking\\(includePending: ?true\\)")
    }

    /** Null for any viewer but the creator, and for a post that does not resolve. */
    @Test
    fun theBackingReadServesNullWhenNoBackingIsServed() = runTest {
        enqueue("""{"data":{"post":{"__typename":"Post","id":"p1","viewerBacking":null}}}""")
        assertThat((repo().postBacking("p1") as Outcome.Success).value).isNull()

        enqueue("""{"data":{"post":null}}""")
        assertThat((repo().postBacking("gone") as Outcome.Success).value).isNull()
    }
}

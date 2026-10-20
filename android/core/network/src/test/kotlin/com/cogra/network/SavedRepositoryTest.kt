// The Saved list's read against a MockWebServer through the real generated
// Apollo client: the reader's search rides to the server as `bookmarks`'
// own `query` (the one search law runs there), with the cursor it pages
// on, and an unnarrowed read sends no query at all.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.Outcome
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.testing.FakeLockCustodyStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.SavedRepositoryImpl
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test
import javax.inject.Provider

class SavedRepositoryTest {

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

    private fun repo() = SavedRepositoryImpl(
        client,
        AuthGuard(
            tokenStore,
            SessionRefresher(
                tokenStore,
                EndLocalSession(FakeLockCustodyStore(), tokenStore),
                Provider { client },
            ),
        ),
    )

    private fun enqueueEmptyPage() {
        server.enqueue(
            MockResponse()
                .setBody(
                    """{"data":{"me":{"__typename":"User","id":"u1","bookmarks":{"__typename":"BookmarkConnection",
                    "edges":[],"pageInfo":{"__typename":"PageInfo","hasNextPage":false,"endCursor":null}}}}}""",
                )
                .addHeader("Content-Type", "application/json"),
        )
    }

    /**
     * The variables object the last request carried, as JSON text — flat, so
     * it ends at its first brace. (The body's own `query` key is the document.)
     */
    private fun sentVariables(): String =
        server.takeRequest().body.readUtf8()
            .substringAfter("\"variables\":", missingDelimiterValue = "{}")
            .substringBefore("}")

    @Test
    fun aSearchRidesToTheServerWithTheCursorItPagesOn() = runTest {
        enqueueEmptyPage()
        val outcome = repo().savedPage(query = "@ada long", after = "k1")
        assertThat((outcome as Outcome.Success).value?.entries).isEmpty()
        val variables = sentVariables()
        assertThat(variables).contains("\"query\":\"@ada long\"")
        assertThat(variables).contains("\"after\":\"k1\"")
    }

    @Test
    fun anUnnarrowedReadSendsNoQuery() = runTest {
        enqueueEmptyPage()
        repo().savedPage(query = null, after = null)
        val variables = sentVariables()
        assertThat(variables).doesNotContain("\"query\"")
        assertThat(variables).doesNotContain("\"after\"")
    }
}

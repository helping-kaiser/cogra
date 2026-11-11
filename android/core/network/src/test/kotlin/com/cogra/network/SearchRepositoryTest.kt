// The search against a MockWebServer through the real generated Apollo
// client: search never looks at the seen-list (jakob's ruling 2026-11-11,
// seam 296; api-spec.md "The seen-list never narrows a search"), so the
// request names no seen variable — neither the document nor the variables
// carry one.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.search.SearchAsk
import com.cogra.domain.search.SearchOrder
import com.cogra.domain.testing.FakeLockCustodyStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.SearchRepositoryImpl
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test
import javax.inject.Provider

class SearchRepositoryTest {

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

    private fun repo() = SearchRepositoryImpl(
        client,
        AuthGuard(
            tokenStore,
            SessionRefresher(tokenStore, EndLocalSession(FakeLockCustodyStore(), tokenStore), Provider { client }),
        ),
    )

    @Test
    fun theRequestNamesNoSeenVariable() = runTest {
        server.enqueue(
            MockResponse()
                .setBody(
                    """{"data":{"search":{"__typename":"SearchConnection","edges":[],
                       "pageInfo":{"__typename":"PageInfo","hasNextPage":false,"endCursor":null},
                       "hasMorePeople":false}}}""",
                )
                .addHeader("Content-Type", "application/json"),
        )

        repo().searchPage(
            SearchAsk(query = "salt", kinds = setOf(FeedKind.POST), order = SearchOrder.RANKED, viewer = "me"),
            after = null,
        )

        val body = server.takeRequest().body.readUtf8()
        assertThat(body).contains("\"query\":\"salt\"")
        assertThat(body).contains("\"order\":\"RANKED\"")
        assertThat(body).doesNotContain("includeSeen")
    }
}

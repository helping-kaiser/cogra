// History's read against a MockWebServer through the real generated Apollo
// client: the reader's search and kinds ride to the server as
// `viewHistory`'s own arguments (the one search law runs there), with the
// cursor they page on; no chip on sends no kinds at all; and a seen topic
// reads back as the tag card's glimpse with the sections' doors.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.Outcome
import com.cogra.domain.feed.FeedKind
import com.cogra.domain.history.HistoryCard
import com.cogra.domain.history.HistoryPage
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.testing.FakeLockCustodyStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.HistoryRepositoryImpl
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.time.Instant
import javax.inject.Provider

class HistoryRepositoryTest {

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

    private fun repo() = HistoryRepositoryImpl(
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

    private fun enqueue(edges: String, more: String = "\"hasMorePeople\":false,\"hasMoreTags\":false") {
        server.enqueue(
            MockResponse()
                .setBody(
                    """{"data":{"me":{"__typename":"User","id":"u1","viewHistory":{
                    "__typename":"ViewHistoryConnection","edges":[$edges],
                    "pageInfo":{"__typename":"PageInfo","hasNextPage":false,"endCursor":"k2"},$more}}}}""",
                )
                .addHeader("Content-Type", "application/json"),
        )
    }

    /** The variables object the last request carried, as JSON text — flat, so it ends at its first brace. */
    private fun sentVariables(): String =
        server.takeRequest().body.readUtf8()
            .substringAfter("\"variables\":", missingDelimiterValue = "{}")
            .substringBefore("}")

    @Test
    fun aSearchAndItsKindsRideToTheServerWithTheCursorTheyPageOn() = runTest {
        enqueue("")
        repo().historyPage(query = "m", kinds = setOf(FeedKind.TAG), after = "k1")
        val variables = sentVariables()
        assertThat(variables).contains("\"query\":\"m\"")
        assertThat(variables).contains("\"kinds\":[\"HASHTAG\"]")
        assertThat(variables).contains("\"after\":\"k1\"")
    }

    @Test
    fun kindsTravelInTheSheetsOrderOnTheWiresWords() = runTest {
        enqueue("")
        repo().historyPage(query = null, kinds = setOf(FeedKind.PROFILE, FeedKind.POST), after = null)
        assertThat(sentVariables()).contains("\"kinds\":[\"POST\",\"USER\"]")
    }

    @Test
    fun noChipOnSendsNoKindsAndAWholeReadNoQuery() = runTest {
        enqueue("")
        repo().historyPage(query = null, kinds = emptySet(), after = null)
        val variables = sentVariables()
        assertThat(variables).doesNotContain("\"kinds\"")
        assertThat(variables).doesNotContain("\"query\"")
        assertThat(variables).doesNotContain("\"after\"")
    }

    @Test
    fun aSeenTopicReadsBackAsTheTagCardsGlimpseWithTheDoors() = runTest {
        enqueue(
            """{"__typename":"ViewHistoryEdge","cursor":"k1","firstSeenAt":"2026-10-04T08:00:00Z",
            "node":{"__typename":"Hashtag","id":"h1","name":{"__typename":"ModeratedText","value":"saltmaps",
            "status":"NORMAL"},"taggedContent":[
              {"__typename":"TaggedContent","node":{"__typename":"Post","id":"p1",
                "title":{"__typename":"ModeratedText","value":"Low tide at six","status":"NORMAL"},
                "content":{"__typename":"ModeratedText","value":"words","status":"NORMAL"},
                "attachments":[],"author":{"__typename":"User","id":"u-t","handle":"tobias"},
                "createdAt":"2026-10-04T07:00:00Z"}},
              {"__typename":"TaggedContent","node":{"__typename":"Comment","id":"c1",
                "content":{"__typename":"ModeratedText","value":"Kinder at low tide","status":"NORMAL"},
                "author":{"__typename":"User","id":"u-a","handle":"ada"},
                "createdAt":"2026-10-01T07:00:00Z"}}
            ]}}""",
            more = "\"hasMorePeople\":true,\"hasMoreTags\":true",
        )
        val page = (repo().historyPage("s", emptySet(), null) as Outcome.Success<HistoryPage?>).value!!
        assertThat(page.hasMorePeople).isTrue()
        assertThat(page.hasMoreTags).isTrue()
        assertThat(page.endCursor).isEqualTo("k2")
        val entry = page.entries.single()
        assertThat(entry.firstSeenAt).isEqualTo(Instant.parse("2026-10-04T08:00:00Z"))
        val topic = (entry.card as HistoryCard.Tag).topic
        assertThat(topic.name.value).isEqualTo("saltmaps")
        assertThat(topic.tagged.map { it.title }).containsExactly("Low tide at six", "Kinder at low tide").inOrder()
        assertThat(topic.tagged.map { it.authorHandle }).containsExactly("tobias", "ada").inOrder()
        assertThat(topic.tagged.map { it.comment }).containsExactly(false, true).inOrder()
    }
}

// The opinions sheet's read against a MockWebServer through the real generated
// Apollo client (PostOpinions.md:7, :9, :11, :13): the node's Opinion records
// read whole across pages and folded to one row per person, strongest first,
// a deleted holder kept with its mark.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.Outcome
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.stance.StancePair
import com.cogra.domain.testing.FakeLockCustodyStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.NodeOpinionsRepositoryImpl
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test
import javax.inject.Provider

class NodeOpinionsRepositoryTest {

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

    private fun repo() = NodeOpinionsRepositoryImpl(
        client,
        AuthGuard(
            tokenStore,
            SessionRefresher(tokenStore, EndLocalSession(FakeLockCustodyStore(), tokenStore), Provider { client }),
        ),
    )

    private fun quoted(value: String?): String = if (value == null) "null" else "\"$value\""

    private fun opinion(id: String, author: String, d: Double, i: Double, epoch: Int, person: String) =
        """{"node":{"__typename":"Record","id":"$id","authorId":"$author","targetId":"p1",
           "pDirected":$d,"pInterest":$i,"severed":false,"payloadMarked":false,
           "landingEpoch":$epoch,"position":0,"author":$person}}"""

    private fun user(id: String, handle: String, name: String?, status: String = "NORMAL") =
        """{"__typename":"User","id":"$id","handle":"$handle",
           "displayName":{"__typename":"ModeratedText","value":${quoted(name)},"status":"$status"},
           "avatar":null}"""

    private fun page(edges: List<String>, next: String?) =
        """{"data":{"node":{"__typename":"Post","id":"p1","incomingRecords":{"__typename":"RecordConnection",
           "edges":[${edges.joinToString(",")}],
           "pageInfo":{"__typename":"PageInfo","hasNextPage":${next != null},"endCursor":${quoted(next)}}}}}}"""

    @Test
    fun theSetIsReadWholeAndFoldedToOneRowPerPersonStrongestFirst() = runTest {
        enqueue(
            page(
                listOf(
                    opinion("r1", "a-ada", 0.4, 0.2, 1, user("ada", "ada", "Ada Okonkwo")),
                    opinion("r2", "a-kel", -0.3, 0.1, 1, user("kel", "kel", null)),
                ),
                next = "k1",
            ),
        )
        // Ada revises on the second page, and a deleted holder stands between.
        enqueue(
            page(
                listOf(
                    opinion("r3", "a-ada", 0.3, 0.3, 2, user("ada", "ada", "Ada Okonkwo")),
                    opinion("r4", "a-del", 0.1, 0.1, 2, user("del", "gone", null, status = "REDACTED")),
                ),
                next = null,
            ),
        )

        val outcome = repo().opinionsOn("p1")
        assertThat(outcome).isInstanceOf(Outcome.Success::class.java)
        val rows = (outcome as Outcome.Success).value

        assertThat(rows.map { it.holderId }).containsExactly("a-ada", "a-del", "a-kel").inOrder()
        assertThat(rows[0].pair).isEqualTo(StancePair(0.7, 0.5))
        assertThat(rows[1].holder.redacted).isTrue()
        assertThat(rows[1].holder.handle).isEqualTo("gone")
        val first = server.takeRequest().body.readUtf8()
        assertThat(first).containsMatch("family:\\s*OPINION")
        assertThat(server.takeRequest().body.readUtf8()).containsMatch("\"after\"\\s*:\\s*\"k1\"")
    }

    @Test
    fun aNodeNobodyHoldsAnOpinionOnIsAnEmptyList() = runTest {
        enqueue(page(emptyList(), next = null))
        assertThat((repo().opinionsOn("p1") as Outcome.Success).value).isEmpty()
    }
}

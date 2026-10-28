// The profile repository against a MockWebServer through the real generated
// Apollo client: the chronicle's rows read the record's own `act` (#324) and
// what the act is about — the data round 22's chronicle verbs speak.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.crypto.Family
import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.RecordAbout
import com.cogra.domain.RecordAct
import com.cogra.domain.RecordLink
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.testing.FakeLockCustodyStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.ProfileRepositoryImpl
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test
import javax.inject.Provider

class ProfileRepositoryTest {

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

    private fun repo(): ProfileRepositoryImpl {
        val guard = AuthGuard(
            tokenStore,
            SessionRefresher(tokenStore, EndLocalSession(FakeLockCustodyStore(), tokenStore), Provider { client }),
        )
        return ProfileRepositoryImpl(client, guard)
    }

    private fun enqueue(json: String) {
        server.enqueue(MockResponse().setBody(json).addHeader("Content-Type", "application/json"))
    }

    private fun record(
        id: String,
        family: String,
        act: String,
        target: String = "null",
        terminal: String = "null",
        pair: String = "0.4,0.3",
    ): String {
        val (d, i) = pair.split(",")
        return """{"node":{"__typename":"Record","id":"$id","family":"$family","act":"$act",
           "targetId":"t","terminalId":null,"landedAt":"2026-10-20T10:00:00Z",
           "pDirected":$d,"pInterest":$i,"severed":false,"target":$target,"terminal":$terminal}}"""
    }

    @Test
    fun aRowCarriesItsActAndWhatItIsAbout() = runTest {
        tokenStore.save(AuthTokens("a", "r", "u1"))
        val post = """{"__typename":"Post","id":"p1","title":{"value":"Salt maps"},"content":{"value":"x"}}"""
        val person = """{"__typename":"User","handle":"ada"}"""
        val rows = listOf(
            record("r1", "PUBLISH", "GENESIS", target = post),
            record("r2", "OPINION", "WALK_BACK", target = person),
            record("r3", "REFERENCE", "ORDINARY", target = post, terminal = person),
            record("r4", "TAG", "ORDINARY", target = post, pair = "0,0"),
            record("r5", "REGISTRATION", "GENESIS"),
        ).joinToString(",")
        enqueue(
            """{"data":{"records":{"__typename":"RecordConnection","edges":[$rows],
               "pageInfo":{"__typename":"PageInfo","hasNextPage":false,"endCursor":null}}}}""",
        )

        val page = (repo().authorRecords("u1", null, 20, null) as Outcome.Success).value.items

        val (published, walkedBack, mention, untag, joined) = page
        assertThat(published.act).isEqualTo(RecordAct.GENESIS)
        assertThat(published.genesis).isTrue()
        assertThat(published.about).isEqualTo(RecordAbout.POST)
        assertThat(published.link).isEqualTo(RecordLink.ToPost("p1"))
        assertThat(walkedBack.act).isEqualTo(RecordAct.WALK_BACK)
        assertThat(walkedBack.about).isEqualTo(RecordAbout.PERSON)
        assertThat(walkedBack.targetHandle).isEqualTo("ada")
        // A citation is about its terminal leg — the person it mentions — not
        // the citing post, whose title is not the row's words.
        assertThat(mention.family).isEqualTo(Family.REFERENCE)
        assertThat(mention.about).isEqualTo(RecordAbout.PERSON)
        assertThat(mention.targetHandle).isEqualTo("ada")
        assertThat(mention.snippet).isNull()
        assertThat(untag.untag).isTrue()
        assertThat(untag.about).isEqualTo(RecordAbout.POST)
        assertThat(joined.act).isEqualTo(RecordAct.GENESIS)
    }

    // ProfileHeader's figures (Q35, closed toward the drawn figures): three
    // record counts, each a `totalCount` read with `first: 0`.
    @Test
    fun theFiguresAreTheThreeRecordCounts() = runTest {
        enqueue(
            """{"data":{"user":{"__typename":"User","id":"u1",
               "posts":{"__typename":"RecordConnection","totalCount":5},
               "opinionsOn":{"__typename":"RecordConnection","totalCount":9},
               "opinionsBy":{"__typename":"RecordConnection","totalCount":null}}}}""",
        )
        val figures = (repo().figures("u1") as Outcome.Success).value
        assertThat(figures.posts).isEqualTo(5)
        assertThat(figures.opinionsOn).isEqualTo(9)
        // A count the server did not serve stays unknown, never a false zero.
        assertThat(figures.opinionsBy).isNull()
        val sent = server.takeRequest().body.readUtf8()
        assertThat(sent).containsMatch("genesis:\\s*true")
        assertThat(sent).containsMatch("toKind:\\s*USER")
    }
}

// Invites' one read against a MockWebServer through the real generated Apollo
// client: the queue and the links in one round trip, People you let in
// beside it, paged to the end in `vouchedIn`'s own order (Invites.md:11,
// :19); a deleted account reads as every deleted account reads (:25); and
// either half failing is the page's fault (InvitesEmpty.md:5).

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.Outcome
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.invites.LetInPerson
import com.cogra.domain.testing.FakeLockCustodyStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.InvitesRepositoryImpl
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.time.Instant
import java.util.concurrent.CopyOnWriteArrayList
import javax.inject.Provider

class InvitesRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var client: ApolloClient
    private val tokenStore = FakeTokenStore()

    /** The people pages the server answers, in order; the halves answer [halves]. */
    private val peoplePages = ArrayDeque<String>()
    private var halves: MockResponse = json(HALVES)
    private val peopleRequests = CopyOnWriteArrayList<String>()

    @Before
    fun setUp() {
        server = MockWebServer()
        // The two reads leave together, so the server answers by operation, not by arrival.
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val body = request.body.readUtf8()
                if ("VouchedInPage" !in body) return halves
                peopleRequests += body
                return peoplePages.removeFirstOrNull()?.let(::json) ?: MockResponse().setResponseCode(500)
            }
        }
        server.start()
        client = ApolloClient.Builder().serverUrl(server.url("/graphql").toString()).build()
    }

    @After
    fun tearDown() {
        client.close()
        server.shutdown()
    }

    private fun repo() = InvitesRepositoryImpl(
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

    @Test
    fun peopleYouLetInArriveBesideTheHalvesNewestFirstPagedToTheEnd() = runTest {
        peoplePages += page(edges = listOf(nadia, wren), next = "k2")
        peoplePages += page(edges = listOf(juno), next = null)

        val read = (repo().invites() as Outcome.Success).value

        assertThat(read.queue).isEmpty()
        assertThat(read.links).isEmpty()
        assertThat(read.people.map { it.id }).containsExactly("p-nadia", "p-wren", "p-juno").inOrder()
        // The second page asks after the first one's end.
        assertThat(peopleRequests).hasSize(2)
        assertThat(peopleRequests[1]).contains("\"after\":\"k2\"")
    }

    @Test
    fun aPersonReadsTheirNameElseTheirHandleAndTheirPictureWhenTheyHaveOne() = runTest {
        peoplePages += page(edges = listOf(nadia, wren), next = null)

        val people = (repo().invites() as Outcome.Success).value.people

        assertThat(people[0]).isEqualTo(
            LetInPerson(
                id = "p-nadia",
                door = "nadia",
                name = "Nadia Rahimi",
                monogram = "Nadia Rahimi",
                avatarUrl = "https://media.test/nadia.jpg",
                redacted = false,
                vouchedAt = Instant.parse("2026-11-10T09:00:00Z"),
            ),
        )
        // No display name: the handle stands in, `@` on the row, bare for the monogram (Invites.md:11).
        assertThat(people[1].name).isEqualTo("@wren")
        assertThat(people[1].monogram).isEqualTo("wren")
        assertThat(people[1].avatarUrl).isNull()
    }

    @Test
    fun aDeletedAccountPrintsNoNameNoPictureAndKeepsOnlyItsDoor() = runTest {
        // Invites.md:25, :27 — Deleted account, the reserved disc, and still a door.
        peoplePages += page(edges = listOf(deleted), next = null)

        val person = (repo().invites() as Outcome.Success).value.people.single()

        assertThat(person.redacted).isTrue()
        assertThat(person.name).isNull()
        assertThat(person.monogram).isEmpty()
        assertThat(person.avatarUrl).isNull()
        assertThat(person.door).isEqualTo("gone")
        assertThat(person.vouchedAt).isEqualTo(Instant.parse("2026-11-07T09:00:00Z"))
    }

    @Test
    fun aPeopleReadThatFailsIsThePagesFaultNeverAnEmptyList() = runTest {
        // Nothing queued: the people read answers 500. A page drawn without
        // them could stand as InvitesEmpty for a reader who let someone in.
        val outcome = repo().invites()

        assertThat(outcome).isNotInstanceOf(Outcome.Success::class.java)
    }

    @Test
    fun aHalvesReadThatFailsIsThePagesFaultToo() = runTest {
        peoplePages += page(edges = listOf(nadia), next = null)
        halves = MockResponse().setResponseCode(500)

        assertThat(repo().invites()).isNotInstanceOf(Outcome.Success::class.java)
    }

    private companion object {
        const val HALVES = """{"data":{"me":{"__typename":"User","id":"u1",
            "approvalQueue":{"__typename":"ApplicationConnection","edges":[]},
            "inviteLinks":{"__typename":"InviteLinkConnection","edges":[]}}}}"""

        fun json(body: String): MockResponse =
            MockResponse().setBody(body).addHeader("Content-Type", "application/json")

        fun person(
            id: String,
            handle: String,
            name: String?,
            status: String,
            avatar: String?,
            at: String,
        ): String {
            val avatarJson = avatar
                ?.let { """{"__typename":"MediaAttachment","url":"$it","status":"NORMAL"}""" }
                ?: "null"
            val nameJson = name?.let { "\"$it\"" } ?: "null"
            return """{"__typename":"VouchedInEdge","cursor":"c-$id","vouchedAt":"$at","node":{
                "__typename":"User","id":"$id","handle":"$handle",
                "displayName":{"__typename":"ModeratedText","value":$nameJson,"status":"$status"},
                "avatar":$avatarJson}}"""
        }

        val nadia = person(
            "p-nadia",
            "nadia",
            "Nadia Rahimi",
            "NORMAL",
            "https://media.test/nadia.jpg",
            "2026-11-10T09:00:00Z",
        )
        val wren = person("p-wren", "wren", null, "NORMAL", null, "2026-11-08T09:00:00Z")
        val juno = person("p-juno", "juno", "Juno Baptiste", "NORMAL", null, "2026-11-04T09:00:00Z")
        val deleted = person("p-gone", "gone", null, "REDACTED", null, "2026-11-07T09:00:00Z")

        fun page(edges: List<String>, next: String?): String {
            val more = next != null
            val end = next?.let { "\"$it\"" } ?: "null"
            return """{"data":{"me":{"__typename":"User","id":"u1","vouchedIn":{
                "__typename":"VouchedInConnection","edges":[${edges.joinToString(",")}],
                "pageInfo":{"__typename":"PageInfo","hasNextPage":$more,"endCursor":$end}}}}}"""
        }
    }
}

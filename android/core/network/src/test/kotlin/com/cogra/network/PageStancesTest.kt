// A page's stance faces in one request (the app's twin of the web's
// `PageStances` seam): the standings a page's controls ask together leave as
// one `nodes(ids:)` read, chunked at the server's cap, each face answered off
// its own slot; a request refused as a whole falls back to each face's own
// read; a batch never crosses the account boundary or the two views.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.AuthTokens
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.stance.StanceStanding
import com.cogra.domain.stance.StanceTarget
import com.cogra.domain.testing.FakeLockCustodyStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.ThrowingWriteRepository
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.AccountChangedException
import com.cogra.network.repo.PAGE_STANCES_CHUNK
import com.cogra.network.repo.StanceRepositoryImpl
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.util.Collections
import javax.inject.Provider

class PageStancesTest {

    private lateinit var server: MockWebServer
    private lateinit var client: ApolloClient
    private val tokens = FakeTokenStore()

    /** Every request's body, in arrival order. */
    private val bodies: MutableList<String> = Collections.synchronizedList(mutableListOf())

    /**
     * How the server answers one id of a `PageStances` request: a post slot
     * carrying a bundle whose `pDirected` is the id's own number, unless a
     * test says otherwise. Root reads answer a post the same way.
     */
    private var slotOf: (String) -> String = { id -> postSlot(id) }

    /** A whole-request answer that replaces the slots, for the request count it names (1-based). */
    private var wholeAnswer: (Int, String) -> MockResponse? = { _, _ -> null }

    @Before
    fun setUp() {
        server = MockWebServer()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val body = request.body.readUtf8()
                val count = synchronized(bodies) {
                    bodies.add(body)
                    bodies.size
                }
                val ids = idsOf(body)
                wholeAnswer(count, body)?.let { return it }
                val data = when {
                    body.contains("\"operationName\":\"PageStances\"") ->
                        """{"nodes":[${ids.joinToString(",") { slotOf(it) }}]}"""
                    else -> """{"post":{"viewerStance":${bundleJson(idOf(body))}}}"""
                }
                return json("""{"data":$data}""")
            }
        }
        server.start()
        client = ApolloClient.Builder().serverUrl(server.url("/graphql").toString()).build()
        tokens.tokens.value = AuthTokens("a1", "r1", "account-a")
    }

    @After
    fun tearDown() {
        client.close()
        server.shutdown()
    }

    private fun json(body: String) = MockResponse().setBody(body).addHeader("Content-Type", "application/json")

    private fun idsOf(body: String): List<String> =
        Regex("\"ids\":\\[([^]]*)]").find(body)?.groupValues?.get(1)
            ?.let { Regex("\"([^\"]+)\"").findAll(it).map { m -> m.groupValues[1] }.toList() }
            .orEmpty()

    private fun idOf(body: String): String = Regex("\"id\":\"([^\"]+)\"").find(body)?.groupValues?.get(1).orEmpty()

    /** The number a target id carries (`p7` → 7), so each face is told apart by its own bundle. */
    private fun numberOf(id: String) = id.filter(Char::isDigit).toIntOrNull() ?: 0

    private fun bundleJson(id: String) = """
        {"__typename":"StanceBundle","targetGraphId":"graph:$id",
         "pDirected":${numberOf(id) / 1000.0},"pInterest":0.5,"rawPDirected":${numberOf(id) / 1000.0},
         "rawPInterest":0.5,"recordCount":1,"inert":false,"severed":false,"severanceCost":1,"projected":null}
    """.trimIndent()

    private fun postSlot(id: String, typename: String = "Post") =
        """{"__typename":"$typename","id":"$id","viewerStance":${bundleJson(id)}}"""

    private fun TestScope.repo() = StanceRepositoryImpl(
        client,
        AuthGuard(
            tokens,
            SessionRefresher(tokens, EndLocalSession(FakeLockCustodyStore(), tokens), Provider { client }),
        ),
        ThrowingWriteRepository(),
        tokens,
        backgroundScope,
    )

    private fun node(id: String) = StanceTarget.Node(id)

    private fun pageRequests() = bodies.count { it.contains("\"operationName\":\"PageStances\"") }

    private fun Outcome<StanceStanding>.directed() = (this as Outcome.Success).value.net.pDirected

    @Test
    fun aPageOfTwentyCardsReadsItsFacesInOneRequest() = runTest {
        val repo = repo()
        val ids = List(20) { "p$it" }

        val faces = ids.map { async { repo.standing(node(it)) } }.awaitAll()

        // One request where the app sent twenty (one root read per card).
        assertThat(bodies).hasSize(1)
        assertThat(idsOf(bodies.single())).containsExactlyElementsIn(ids)
        // Each card still wears its own face, off its own slot.
        assertThat(faces.map { it.directed() }).isEqualTo(ids.map { numberOf(it) / 1000.0 })
    }

    @Test
    fun aFaceAskedTwiceInOneWindowIsAskedOnceAndAnsweredToBoth() = runTest {
        val repo = repo()

        val faces = listOf("p1", "p1", "p2").map { async { repo.standing(node(it)) } }.awaitAll()

        assertThat(idsOf(bodies.single())).containsExactly("p1", "p2")
        assertThat(faces.map { it.directed() }).containsExactly(0.001, 0.001, 0.002).inOrder()
    }

    @Test
    fun aPageLargerThanTheServersCapIsChunkedAtIt() = runTest {
        val repo = repo()
        val ids = List(PAGE_STANCES_CHUNK + 50) { "p$it" }

        val faces = ids.map { async { repo.standing(node(it)) } }.awaitAll()

        assertThat(pageRequests()).isEqualTo(2)
        assertThat(bodies.map { idsOf(it).size }).containsExactly(PAGE_STANCES_CHUNK, 50)
        assertThat(faces.all { it is Outcome.Success }).isTrue()
    }

    @Test
    fun aPartialAnswerGivesEachFaceWhatItsOwnReadWouldHave() = runTest {
        val repo = repo()
        slotOf = { id ->
            when (id) {
                "p1" -> postSlot(id)
                "c2" -> postSlot(id, typename = "Comment")
                "u3" -> """{"__typename":"User","id":"u3","viewerStance":null}"""
                else -> "null"
            }
        }

        val faces = listOf("p1", "c2", "u3", "x4").map { async { repo.standing(node(it)) } }.awaitAll()
        val (post, comment) = faces
        val user = faces[2]
        val ghost = faces[3]

        assertThat(bodies).hasSize(1)
        assertThat(post.directed()).isEqualTo(0.001)
        assertThat(comment.directed()).isEqualTo(0.002)
        assertThat((user as Outcome.Refused).errors.single().code).isEqualTo(ErrorCode.UNAUTHENTICATED)
        assertThat((ghost as Outcome.Refused).errors.single().code).isEqualTo(ErrorCode.NOT_FOUND)
    }

    @Test
    fun theClassAPageNamedSendsALaterLoneReadToItsOwnRoot() = runTest {
        val repo = repo()
        listOf("p1", "p2").map { async { repo.standing(node(it)) } }.awaitAll()

        // The re-read after an act: alone, and its class known.
        repo.standing(node("p1"))

        assertThat(bodies).hasSize(2)
        assertThat(bodies.last()).contains("\"operationName\":\"PostStance\"")
    }

    @Test
    fun anErrorsArrayOnTheWholePageFallsBackToEachFacesOwnRead() = runTest {
        val repo = repo()
        wholeAnswer = { count, _ ->
            if (count == 1) json("""{"data":null,"errors":[{"message":"Query is too complex."}]}""") else null
        }

        val faces = listOf("p1", "p2").map { async { repo.standing(node(it)) } }.awaitAll()

        // The refused page, then one page of one per face (no class known yet).
        assertThat(bodies.map(::idsOf)).containsExactly(listOf("p1", "p2"), listOf("p1"), listOf("p2"))
        assertThat(faces.map { it.directed() }).containsExactly(0.001, 0.002).inOrder()
    }

    @Test
    fun noAnswerAtAllIsEveryFacesFailureAndNothingIsAskedAgain() = runTest {
        val repo = repo()
        wholeAnswer = { _, _ -> MockResponse().setResponseCode(503) }

        val faces = listOf("p1", "p2").map { async { repo.standing(node(it)) } }.awaitAll()

        assertThat(bodies).hasSize(1)
        assertThat(faces.all { it is Outcome.Failed }).isTrue()
    }

    @Test
    fun aPageWithNoViewerBehindItIsRefreshedAsOneRequestNotPerFace() = runTest {
        val repo = repo()
        slotOf = { id -> """{"__typename":"Post","id":"$id","viewerStance":null}""" }
        // The refresh the guard asks for answers with no session to give.
        wholeAnswer = { _, body ->
            if (body.contains("RefreshSession")) json("""{"data":null,"errors":[{"message":"no"}]}""") else null
        }

        val faces = listOf("p1", "p2").map { async { repo.standing(node(it)) } }.awaitAll()

        assertThat(faces.map { (it as Outcome.Refused).errors.single().code })
            .containsExactly(ErrorCode.UNAUTHENTICATED, ErrorCode.UNAUTHENTICATED)
        // The guard saw the batch's ONE refusal: its refresh (which fails
        // here) was asked for once, and no face was read alone.
        assertThat(pageRequests()).isEqualTo(1)
    }

    @Test
    fun theTwoViewsNeverShareARequest() = runTest {
        val repo = repo()

        listOf(
            async { repo.standing(node("p1"), includePending = true) },
            async { repo.standing(node("p2"), includePending = false) },
        ).awaitAll()

        assertThat(pageRequests()).isEqualTo(2)
        assertThat(bodies.first { it.contains("\"p1\"") }).contains("\"includePending\":true")
        assertThat(bodies.first { it.contains("\"p2\"") }).contains("\"includePending\":false")
    }

    @Test
    fun aBatchAskedUnderOneAccountNeverLeavesUnderAnother() = runTest {
        val repo = repo()
        val asA = async { repo.standing(node("p1")) }
        runCurrent()

        // The switch lands inside the window, before the batch leaves.
        tokens.tokens.value = AuthTokens("b1", "r2", "account-b")
        val asB = async { repo.standing(node("p2")) }

        val faceOfA = asA.await()
        val faceOfB = asB.await()

        assertThat((faceOfA as Outcome.Failed).cause).isInstanceOf(AccountChangedException::class.java)
        // B's own read went alone: nothing of A's rode it.
        assertThat(bodies.map(::idsOf)).containsExactly(listOf("p2"))
        assertThat(faceOfB.directed()).isEqualTo(0.002)
    }
}

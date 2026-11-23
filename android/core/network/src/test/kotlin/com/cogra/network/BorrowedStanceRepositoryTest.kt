// A guest's face (FeedBare.md:7, GuestGate.md:11) against a MockWebServer
// through the production wiring — gate → interceptor → client: the four
// borrowed documents, their mapping, the probe, and what the read must
// never do — carry a token, rotate a session, or feed the node a signing
// points at.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.AuthTokens
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.stance.BorrowedStance
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceTarget
import com.cogra.domain.testing.FakeLockCustodyStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.ThrowingWriteRepository
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.BearerInterceptor
import com.cogra.network.auth.SessionGate
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.StanceRepositoryImpl
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.util.Base64
import javax.inject.Provider

private const val GRAPH_ID = "mint:act:b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0:3:publish"

class BorrowedStanceRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var client: ApolloClient
    private val tokens = FakeTokenStore()

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @After
    fun tearDown() {
        client.close()
        server.shutdown()
    }

    /** The production shape, as SessionGateTest wires it. */
    private fun repo(): StanceRepositoryImpl {
        val refresher = SessionRefresher(tokens, EndLocalSession(FakeLockCustodyStore(), tokens), Provider { client })
        val gate = SessionGate(tokens, Provider { refresher })
        client = ApolloClient.Builder()
            .serverUrl(server.url("/graphql").toString())
            .addHttpInterceptor(BearerInterceptor(gate))
            .build()
        return StanceRepositoryImpl(client, AuthGuard(tokens, refresher), ThrowingWriteRepository())
    }

    private fun enqueue(json: String) {
        server.enqueue(MockResponse().setBody(json).addHeader("Content-Type", "application/json"))
    }

    private fun faceJson(
        pDirected: Double = 0.55,
        pInterest: Double = 0.2,
        records: Int = 2,
        severed: Boolean = false,
    ) =
        """{"__typename":"BorrowedStance","pDirected":$pDirected,"pInterest":$pInterest,
           "recordCount":$records,"inert":${pDirected == 0.0 || pInterest == 0.0},"severed":$severed}"""

    private fun lentJson(root: String, id: String, face: String?) =
        """{"data":{"$root":{"id":"$id","borrowedStance":${face ?: "null"}}}}"""

    private fun missJson(root: String) = """{"data":{"$root":null}}"""

    private fun RecordedRequest.operation(): String {
        val body = body.readUtf8()
        return Regex("\"operationName\":\"(\\w+)\"").find(body)?.groupValues?.get(1)
            ?: Regex("query (\\w+)\\(").find(body)?.groupValues?.get(1)
            ?: body
    }

    private fun jwt(expSeconds: Long): String {
        val encoder = Base64.getUrlEncoder().withoutPadding()
        val header = encoder.encodeToString("""{"alg":"EdDSA","typ":"JWT"}""".encodeToByteArray())
        val claims = encoder.encodeToString("""{"sub":"u1","iat":0,"exp":$expSeconds}""".encodeToByteArray())
        return "$header.$claims.c2lnbmF0dXJl"
    }

    private fun nowSeconds() = System.currentTimeMillis() / 1000

    @Test
    fun aHeldOpinionIsReadOnItsOwnDocumentAndMappedAsIs() = runTest {
        val repo = repo()
        enqueue(lentJson("post", "p1", faceJson(pDirected = 0.55, pInterest = 0.2, records = 2)))

        val face = repo.borrowedStance(StanceTarget.Node("p1"))

        assertThat(face).isEqualTo(
            Outcome.Success(BorrowedStance(StancePair(0.55, 0.2), records = 2, inert = false, severed = false)),
        )
        assertThat(server.takeRequest().operation()).isEqualTo("PostBorrowedStance")
    }

    @Test
    fun aRootThatHoldsTheIdButNoOpinionIsTheHollowFaceNotAProbe() = runTest {
        val repo = repo()
        enqueue(lentJson("post", "p1", null))

        assertThat(repo.borrowedStance(StanceTarget.Node("p1"))).isEqualTo(Outcome.Success(null))
        assertThat(server.requestCount).isEqualTo(1)
    }

    @Test
    fun anUnclassifiedIdIsProbedPostCommentUserAndTheClassIsKept() = runTest {
        val repo = repo()
        enqueue(missJson("post"))
        enqueue(missJson("comment"))
        enqueue(lentJson("user", "u9", faceJson()))
        enqueue(lentJson("user", "u9", faceJson()))

        repo.borrowedStance(StanceTarget.Node("u9"))
        repo.borrowedStance(StanceTarget.Node("u9"))

        val asked = List(server.requestCount) { server.takeRequest().operation() }
        assertThat(asked).containsExactly(
            "PostBorrowedStance",
            "CommentBorrowedStance",
            "ProfileBorrowedStance",
            "ProfileBorrowedStance",
        ).inOrder()
    }

    @Test
    fun anIdNoRootHoldsIsNotFound() = runTest {
        val repo = repo()
        enqueue(missJson("post"))
        enqueue(missJson("comment"))
        enqueue(missJson("user"))

        val read = repo.borrowedStance(StanceTarget.Node("gone"))

        assertThat((read as Outcome.Refused).errors.single().code).isEqualTo(ErrorCode.NOT_FOUND)
    }

    @Test
    fun aTopicIsAskedByNameOnTheHashtagDocument() = runTest {
        val repo = repo()
        enqueue(lentJson("hashtag", "h1", null))

        assertThat(repo.borrowedStance(StanceTarget.Topic("saltmaps"))).isEqualTo(Outcome.Success(null))
        val request = server.takeRequest()
        val body = request.body.readUtf8()
        assertThat(body).contains("HashtagBorrowedStance")
        assertThat(body).contains("\"name\":\"saltmaps\"")
    }

    // A later sign-in must never see a borrowed stance, and a read a guest
    // makes must never be one a session answers: it leaves WITHOUT a token,
    // whatever the store holds.
    @Test
    fun theBorrowedReadCarriesNoTokenEvenWithASessionStored() = runTest {
        tokens.save(AuthTokens(jwt(nowSeconds() + 600), "r1", "u1"))
        val repo = repo()
        enqueue(lentJson("post", "p1", faceJson()))

        repo.borrowedStance(StanceTarget.Node("p1"))

        val request = server.takeRequest()
        assertThat(request.getHeader("Authorization")).isNull()
        assertThat(request.getHeader("X-Cogra-Anonymous")).isNull()
    }

    // …and never rotates one: an expired session stays exactly as stored,
    // with no refresh on the wire before the read.
    @Test
    fun theBorrowedReadNeverRefreshesAnExpiredSession() = runTest {
        val stored = AuthTokens(jwt(nowSeconds() - 60), "r1", "u1")
        tokens.save(stored)
        val repo = repo()
        enqueue(lentJson("post", "p1", faceJson()))

        repo.borrowedStance(StanceTarget.Node("p1"))

        assertThat(server.requestCount).isEqualTo(1)
        assertThat(server.takeRequest().operation()).isEqualTo("PostBorrowedStance")
        assertThat(tokens.current()).isEqualTo(stored)
    }

    // DISPLAY ONLY: the node a stance or severance must point at is never
    // learned from a borrowed read — the next signing asks the member's own
    // bundle read for it.
    @Test
    fun aBorrowedReadNeverFeedsTheNodeASigningPointsAt() = runTest {
        tokens.save(AuthTokens(jwt(nowSeconds() + 600), "r1", "u1"))
        val repo = repo()
        enqueue(lentJson("post", "p1", faceJson()))
        enqueue(
            """{"data":{"post":{"viewerStance":{"__typename":"StanceBundle","targetGraphId":"$GRAPH_ID",
               "pDirected":0.0,"pInterest":0.0,"rawPDirected":0.0,"rawPInterest":0.0,"recordCount":0,
               "inert":true,"severed":false,"severanceCost":0,"projected":null}}}}""",
        )

        repo.borrowedStance(StanceTarget.Node("p1"))
        val graphId = repo.targetGraphId(StanceTarget.Node("p1"))

        assertThat(graphId).isEqualTo(Outcome.Success(GRAPH_ID))
        server.takeRequest()
        val signingRead = server.takeRequest()
        assertThat(signingRead.operation()).isEqualTo("PostStance")
        // The member's own read still rides the session's token.
        assertThat(signingRead.getHeader("Authorization")).startsWith("Bearer ")
    }
}

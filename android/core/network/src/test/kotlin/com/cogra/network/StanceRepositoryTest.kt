// The stance repository against a MockWebServer through the real
// generated Apollo client: the three-root probe and the class it
// remembers, the bundle → domain mapping for all three reads, the tier
// split on a missing target and a missing bundle, and the severance
// batch.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.stance.StancePair
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.ThrowingWriteRepository
import com.cogra.crypto.Family
import com.cogra.domain.PreparedWriteView
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.StanceRepositoryImpl
import com.google.common.truth.Truth.assertThat
import javax.inject.Provider
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test

class StanceRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var client: ApolloClient
    private val tokenStore = FakeTokenStore()

    /** Records what the generic prepare was handed, verbatim. */
    private class RecordingWriteRepository : ThrowingWriteRepository() {
        var lastTarget: String? = null
        var lastPick: Pair<Double, Double>? = null
        var outcome: Outcome<List<PreparedWriteView>> = Outcome.Success(emptyList())

        override suspend fun prepareStance(
            targetId: String,
            pDirected: Double,
            pInterest: Double,
        ): Outcome<List<PreparedWriteView>> {
            lastTarget = targetId
            lastPick = pDirected to pInterest
            return outcome
        }
    }

    private val writes = RecordingWriteRepository()

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

    private fun repo() = StanceRepositoryImpl(
        client,
        AuthGuard(
            tokenStore,
            SessionRefresher(tokenStore, EndLocalSession(FakeIdentityStore(), tokenStore), Provider { client }),
        ),
        writes,
    )

    private fun bundleJson(
        pDirected: Double = 0.4,
        pInterest: Double = 0.2,
        recordCount: Int = 3,
        severed: Boolean = false,
        severanceCost: Int = 3,
        projected: String? = null,
    ) = """
        {"__typename":"StanceBundle",
         "pDirected":$pDirected,"pInterest":$pInterest,
         "recordCount":$recordCount,"severed":$severed,
         "severanceCost":$severanceCost,
         "projected":${projected ?: "null"}}
    """.trimIndent()

    private fun projectedJson(pDirected: Double, pInterest: Double, severed: Boolean) =
        """{"pDirected":$pDirected,"pInterest":$pInterest,"severed":$severed}"""

    /** One response with the bundle hung off exactly one root. */
    private fun answerJson(root: String, bundle: String?) = when (root) {
        "post" -> """{"data":{"post":{"viewerStance":${bundle ?: "null"}},
                              "comment":null,"user":null}}"""
        "comment" -> """{"data":{"post":null,
                                 "comment":{"viewerStance":${bundle ?: "null"}},
                                 "user":null}}"""
        else -> """{"data":{"post":null,"comment":null,
                            "user":{"viewerStance":${bundle ?: "null"}}}}"""
    }

    private val noAnswer = """{"data":{"post":null,"comment":null,"user":null}}"""

    @Test
    fun `standing folds the bundle the backend reports`() = runTest {
        enqueue(answerJson("post", bundleJson(pDirected = 0.4, pInterest = -0.2, recordCount = 5)))

        val outcome = repo().standing("t1")

        assertThat(outcome).isInstanceOf(Outcome.Success::class.java)
        val standing = (outcome as Outcome.Success).value
        assertThat(standing.target).isEqualTo("t1")
        assertThat(standing.net).isEqualTo(StancePair(0.4, -0.2))
        assertThat(standing.records).isEqualTo(5)
        assertThat(standing.includePending).isTrue()
    }

    @Test
    fun `the first read probes every root and later reads ask only the one that answered`() = runTest {
        val repo = repo()
        enqueue(answerJson("user", bundleJson()))
        enqueue(answerJson("user", bundleJson()))

        repo.standing("u1")
        repo.standing("u1")

        val probe = server.takeRequest().body.readUtf8()
        assertThat(probe).contains("\"asPost\":true")
        assertThat(probe).contains("\"asComment\":true")
        assertThat(probe).contains("\"asUser\":true")

        val narrowed = server.takeRequest().body.readUtf8()
        assertThat(narrowed).contains("\"asPost\":false")
        assertThat(narrowed).contains("\"asComment\":false")
        assertThat(narrowed).contains("\"asUser\":true")
    }

    @Test
    fun `a comment target is remembered as a comment`() = runTest {
        val repo = repo()
        enqueue(answerJson("comment", bundleJson()))
        enqueue(answerJson("comment", bundleJson()))

        repo.standing("c1")
        repo.standing("c1")
        server.takeRequest()

        val narrowed = server.takeRequest().body.readUtf8()
        assertThat(narrowed).contains("\"asComment\":true")
        assertThat(narrowed).contains("\"asPost\":false")
        assertThat(narrowed).contains("\"asUser\":false")
    }

    @Test
    fun `the pick rides the read and the landing comes back off the projection`() = runTest {
        enqueue(
            answerJson(
                "post",
                bundleJson(projected = projectedJson(0.5, -0.3, severed = false)),
            ),
        )

        val outcome = repo().projection("t1", StancePair(0.1, -0.5))

        val landing = (outcome as Outcome.Success).value
        assertThat(landing.pick).isEqualTo(StancePair(0.1, -0.5))
        assertThat(landing.net).isEqualTo(StancePair(0.5, -0.3))
        assertThat(landing.inertDirected).isFalse()
        assertThat(landing.inertInterest).isFalse()
        assertThat(landing.severance).isFalse()

        val body = server.takeRequest().body.readUtf8()
        assertThat(body).contains("\"pDirected\":0.1")
        assertThat(body).contains("\"pInterest\":-0.5")
    }

    @Test
    fun `inertness is named per axis`() = runTest {
        enqueue(
            answerJson("post", bundleJson(projected = projectedJson(0.0, 0.6, severed = false))),
        )

        val landing = (repo().projection("t1", StancePair(-0.4, 0.2)) as Outcome.Success).value

        assertThat(landing.inertDirected).isTrue()
        assertThat(landing.inertInterest).isFalse()
        assertThat(landing.severance).isFalse()
    }

    @Test
    fun `a landing on both zeros is severance`() = runTest {
        enqueue(
            answerJson("post", bundleJson(projected = projectedJson(0.0, 0.0, severed = true))),
        )

        val landing = (repo().projection("t1", StancePair(-0.4, -0.2)) as Outcome.Success).value

        assertThat(landing.inertDirected).isTrue()
        assertThat(landing.inertInterest).isTrue()
        assertThat(landing.severance).isTrue()
    }

    @Test
    fun `a bundle that answers a pick without a projection is a server fault`() = runTest {
        enqueue(answerJson("post", bundleJson(projected = null)))

        val outcome = repo().projection("t1", StancePair(0.1, 0.1))

        assertThat(outcome).isInstanceOf(Outcome.Failed::class.java)
    }

    @Test
    fun `the severance quote carries the batch cost, not the record count`() = runTest {
        enqueue(
            answerJson(
                "post",
                bundleJson(pDirected = 0.7, pInterest = 0.3, recordCount = 9, severanceCost = 4),
            ),
        )

        val quote = (repo().severanceQuote("t1") as Outcome.Success).value

        assertThat(quote.target).isEqualTo("t1")
        assertThat(quote.standing).isEqualTo(StancePair(0.7, 0.3))
        assertThat(quote.records).isEqualTo(4)
        assertThat(quote.alreadySevered).isFalse()
    }

    @Test
    fun `an already severed bundle says so`() = runTest {
        enqueue(
            answerJson(
                "post",
                bundleJson(pDirected = 0.0, pInterest = 0.0, severed = true, severanceCost = 0),
            ),
        )

        val quote = (repo().severanceQuote("t1") as Outcome.Success).value

        assertThat(quote.alreadySevered).isTrue()
        assertThat(quote.records).isEqualTo(0)
    }

    @Test
    fun `an id no root answers is refused as not found`() = runTest {
        enqueue(noAnswer)

        val outcome = repo().standing("ghost")

        assertThat(outcome).isInstanceOf(Outcome.Refused::class.java)
        assertThat((outcome as Outcome.Refused).errors.single().code).isEqualTo(ErrorCode.NOT_FOUND)
    }

    @Test
    fun `a target that stops answering is probed again`() = runTest {
        val repo = repo()
        enqueue(answerJson("post", bundleJson()))
        enqueue(noAnswer)
        enqueue(answerJson("post", bundleJson()))

        repo.standing("t1")
        repo.standing("t1")
        repo.standing("t1")
        repeat(2) { server.takeRequest() }

        val reprobe = server.takeRequest().body.readUtf8()
        assertThat(reprobe).contains("\"asComment\":true")
        assertThat(reprobe).contains("\"asUser\":true")
    }

    @Test
    fun `a node with no bundle behind it is an unauthenticated refusal`() = runTest {
        enqueue(answerJson("post", null))

        val outcome = repo().standing("t1")

        assertThat(outcome).isInstanceOf(Outcome.Refused::class.java)
        assertThat((outcome as Outcome.Refused).errors.single().code)
            .isEqualTo(ErrorCode.UNAUTHENTICATED)
    }

    @Test
    fun `the L1 view rides the wire when the reader asks for it`() = runTest {
        enqueue(answerJson("post", bundleJson()))

        val standing = (repo().standing("t1", includePending = false) as Outcome.Success).value

        assertThat(standing.includePending).isFalse()
        assertThat(server.takeRequest().body.readUtf8()).contains("\"includePending\":false")
    }

    @Test
    fun `severance stages the whole counter-record batch for one signing pass`() = runTest {
        enqueue(
            """
            {"data":{"prepareSeverance":{"writes":[
              {"__typename":"PreparedWrite","id":"w1","family":"OPINION",
               "canonicalProposal":"YWE=","gcAfterEpochs":4},
              {"__typename":"PreparedWrite","id":"w2","family":"OPINION",
               "canonicalProposal":"YmI=","gcAfterEpochs":4},
              {"__typename":"PreparedWrite","id":"w3","family":"OPINION",
               "canonicalProposal":"Y2M=","gcAfterEpochs":4}],
             "userErrors":[]}}}
            """.trimIndent(),
        )

        val staged = (repo().prepareSeverance("t1") as Outcome.Success).value

        assertThat(staged.map { it.id }).containsExactly("w1", "w2", "w3").inOrder()
        assertThat(staged.map { it.family }).containsExactly(Family.OPINION, Family.OPINION, Family.OPINION)
        assertThat(server.takeRequest().body.readUtf8()).contains("\"target\":\"t1\"")
    }

    @Test
    fun `a refused severance carries the payload error`() = runTest {
        enqueue(
            """
            {"data":{"prepareSeverance":{"writes":null,
             "userErrors":[{"__typename":"UserError","message":"already severed",
                            "code":"BAD_INPUT","field":["target"]}]}}}
            """.trimIndent(),
        )

        val outcome = repo().prepareSeverance("t1")

        assertThat(outcome).isInstanceOf(Outcome.Refused::class.java)
        assertThat((outcome as Outcome.Refused).errors.single().code).isEqualTo(ErrorCode.BAD_INPUT)
    }

    @Test
    fun `the prepare hands the picked pair through untouched`() = runTest {
        // The raw-edge rule: what is staged is what was picked, never a
        // delta against the standing the reads just reported.
        enqueue(answerJson("post", bundleJson(pDirected = 0.8, pInterest = 0.8)))
        val repo = repo()
        repo.standing("t1")

        repo.prepareStance("t1", StancePair(-0.3, 0.2))

        assertThat(writes.lastTarget).isEqualTo("t1")
        assertThat(writes.lastPick).isEqualTo(-0.3 to 0.2)
    }
}

// The stance repository against a MockWebServer through the real
// generated Apollo client: the page read that names a node's class and the
// root a later lone read asks, the bundle → domain mapping for all three reads, the tier
// split on a missing target and a missing bundle, and the severance
// batch.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.crypto.Family
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceTarget
import com.cogra.domain.testing.FakeLockCustodyStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.domain.testing.ThrowingWriteRepository
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.StanceRepositoryImpl
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.util.concurrent.TimeUnit
import javax.inject.Provider

private const val REQUEST_WAIT_SECONDS = 5L

private const val TARGET_GRAPH_ID = "mint:act:b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0:3:publish"

class StanceRepositoryTest {

    private lateinit var server: MockWebServer
    private lateinit var client: ApolloClient
    private val tokenStore = FakeTokenStore()

    /** The node-shaped target these tests use, spelled once. */
    private fun node(id: String) = StanceTarget.Node(id)

    /** Records what the generic prepare was handed, verbatim. */
    private class RecordingWriteRepository : ThrowingWriteRepository() {
        var lastTarget: String? = null
        var lastTopic: String? = null
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

        override suspend fun prepareTopicStance(
            topicName: String,
            pDirected: Double,
            pInterest: Double,
        ): Outcome<List<PreparedWriteView>> {
            lastTopic = topicName
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

    private fun TestScope.repo() = StanceRepositoryImpl(
        client,
        AuthGuard(
            tokenStore,
            SessionRefresher(tokenStore, EndLocalSession(FakeLockCustodyStore(), tokenStore), Provider { client }),
        ),
        writes,
        tokenStore,
        backgroundScope,
    )

    @Test
    fun theNodeABundleReadNamedIsWhatAGestureTowardItMustName() = runTest {
        enqueue(pageJson(slot("p1")))
        val repo = repo()
        repo.standing(node("p1"))
        // Remembered from the read that rendered the control: no second
        // request is made (the server has nothing more enqueued).
        assertThat(repo.targetGraphId(node("p1"))).isEqualTo(Outcome.Success(TARGET_GRAPH_ID))
        assertThat(server.requestCount).isEqualTo(1)
    }

    private fun bundleJson(
        pDirected: Double = 0.4,
        pInterest: Double = 0.2,
        rawPDirected: Double = pDirected,
        rawPInterest: Double = pInterest,
        recordCount: Int = 3,
        severed: Boolean = false,
        severanceCost: Int = 3,
        projected: String? = null,
    ) = """
        {"__typename":"StanceBundle",
         "targetGraphId":"$TARGET_GRAPH_ID",
         "pDirected":$pDirected,"pInterest":$pInterest,
         "rawPDirected":$rawPDirected,"rawPInterest":$rawPInterest,
         "recordCount":$recordCount,
         "inert":${pDirected == 0.0 || pInterest == 0.0},"severed":$severed,
         "severanceCost":$severanceCost,
         "projected":${projected ?: "null"}}
    """.trimIndent()

    private fun projectedJson(pDirected: Double, pInterest: Double, severed: Boolean): String {
        val inert = pDirected == 0.0 || pInterest == 0.0
        return """{"pDirected":$pDirected,"pInterest":$pInterest,"inert":$inert,"severed":$severed}"""
    }

    /** One root's own document, answering with (or without) a bundle. */
    private fun answerJson(root: String, bundle: String?) =
        """{"data":{"$root":{"viewerStance":${bundle ?: "null"}}}}"""

    /** The same root saying it does not hold that id. */
    private fun missJson(root: String) = """{"data":{"$root":null}}"""

    /** One `PageStances` slot: a node of [typename] with (or without) a bundle. */
    private fun slot(id: String, typename: String = "Post", bundle: String? = bundleJson()) =
        """{"__typename":"$typename","id":"$id","viewerStance":${bundle ?: "null"}}"""

    /** A `PageStances` answer, slot by slot ("null" for an unknown id). */
    private fun pageJson(vararg slots: String) = """{"data":{"nodes":[${slots.joinToString(",")}]}}"""

    /** The first read of `t1`, a post: a page of one carrying [bundle]. */
    private fun firstJson(bundle: String?) = pageJson(slot("t1", bundle = bundle))

    /** A target's first read names its class; [answer] is then its own root's answer. */
    private fun enqueueFirstThen(id: String, answer: String) {
        enqueue(pageJson(slot(id)))
        enqueue(answer)
    }

    /**
     * The next recorded request, or a failure: an untimed `takeRequest()`
     * blocks forever when the code sent fewer requests than a test expects.
     */
    private fun MockWebServer.next(): RecordedRequest =
        checkNotNull(takeRequest(REQUEST_WAIT_SECONDS, TimeUnit.SECONDS)) { "no request arrived" }

    /** Which document a recorded request carried. */
    private fun MockWebServer.nextOperation(): String {
        val body = next().body.readUtf8()
        return listOf("PageStances", "PostStance", "CommentStance", "ProfileStance", "PrepareSeverance")
            .firstOrNull { body.contains("\"operationName\":\"$it\"") || body.contains("query $it(") }
            ?: body
    }

    @Test
    fun `standing folds the bundle the backend reports`() = runTest {
        enqueue(pageJson(slot("t1", bundle = bundleJson(pDirected = 0.4, pInterest = -0.2, recordCount = 5))))

        val outcome = repo().standing(node("t1"))

        assertThat(outcome).isInstanceOf(Outcome.Success::class.java)
        val standing = (outcome as Outcome.Success).value
        assertThat(standing.target).isEqualTo(node("t1"))
        assertThat(standing.net).isEqualTo(StancePair(0.4, -0.2))
        assertThat(standing.records).isEqualTo(5)
        assertThat(standing.includePending).isTrue()
    }

    @Test
    fun `the raw sums ride the standing alongside the clipped fold`() = runTest {
        // Clipped is not hidden (design.md §8.3): a bundle whose history
        // sums past ±1 still carries it, and the two numbers reach the
        // client apart so the pad can fold locally and the severance
        // confirm can quote a price that adds up.
        enqueue(
            pageJson(
                slot(
                    "t1",
                    bundle = bundleJson(
                        pDirected = 1.0,
                        pInterest = -1.0,
                        rawPDirected = 6.0,
                        rawPInterest = -4.5,
                        recordCount = 9,
                    ),
                ),
            ),
        )

        val standing = (repo().standing(node("t1")) as Outcome.Success).value

        assertThat(standing.net).isEqualTo(StancePair(1.0, -1.0))
        assertThat(standing.raw).isEqualTo(StancePair(6.0, -4.5))
    }

    @Test
    fun `the severance quote carries the raw sums the batch has to walk back`() = runTest {
        enqueue(
            pageJson(
                slot(
                    "t1",
                    bundle = bundleJson(
                        pDirected = 1.0,
                        pInterest = 1.0,
                        rawPDirected = 6.0,
                        rawPInterest = 4.5,
                        severanceCost = 6,
                    ),
                ),
            ),
        )

        val quote = (repo().severanceQuote(node("t1")) as Outcome.Success).value

        assertThat(quote.raw).isEqualTo(StancePair(6.0, 4.5))
        assertThat(quote.records).isEqualTo(6)
    }

    @Test
    fun `the first read pages the node and a later lone read asks only the root it named`() = runTest {
        val repo = repo()
        enqueue(pageJson(slot("u1", typename = "User")))
        enqueue(answerJson("user", bundleJson()))

        repo.standing(node("u1"))
        repo.standing(node("u1"))

        // No probe: the page slot's class names the root, once.
        assertThat(server.nextOperation()).isEqualTo("PageStances")
        assertThat(server.nextOperation()).isEqualTo("ProfileStance")
        assertThat(server.requestCount).isEqualTo(2)
    }

    @Test
    fun `a comment target is remembered as a comment`() = runTest {
        val repo = repo()
        enqueue(pageJson(slot("c1", typename = "Comment")))
        enqueue(answerJson("comment", bundleJson()))

        repo.standing(node("c1"))
        repo.standing(node("c1"))

        assertThat(server.nextOperation()).isEqualTo("PageStances")
        assertThat(server.nextOperation()).isEqualTo("CommentStance")
    }

    @Test
    fun `the pick rides the read and the landing comes back off the projection`() = runTest {
        enqueueFirstThen(
            "t1",
            answerJson(
                "post",
                bundleJson(projected = projectedJson(0.5, -0.3, severed = false)),
            ),
        )

        val outcome = repo().projection(node("t1"), StancePair(0.1, -0.5))

        val landing = (outcome as Outcome.Success).value
        assertThat(landing.pick).isEqualTo(StancePair(0.1, -0.5))
        assertThat(landing.net).isEqualTo(StancePair(0.5, -0.3))
        assertThat(landing.inertDirected).isFalse()
        assertThat(landing.inertInterest).isFalse()
        assertThat(landing.severance).isFalse()

        // The page read named the class; the pick rides the root's own read.
        assertThat(server.nextOperation()).isEqualTo("PageStances")
        val body = server.next().body.readUtf8()
        assertThat(body).contains("PostStance")
        assertThat(body).contains("\"pDirected\":0.1")
        assertThat(body).contains("\"pInterest\":-0.5")
    }

    @Test
    fun `inertness is named per axis`() = runTest {
        enqueueFirstThen(
            "t1",
            answerJson("post", bundleJson(projected = projectedJson(0.0, 0.6, severed = false))),
        )

        val landing = (repo().projection(node("t1"), StancePair(-0.4, 0.2)) as Outcome.Success).value

        assertThat(landing.inertDirected).isTrue()
        assertThat(landing.inertInterest).isFalse()
        assertThat(landing.severance).isFalse()
    }

    @Test
    fun `a landing on both zeros is severance`() = runTest {
        enqueueFirstThen(
            "t1",
            answerJson("post", bundleJson(projected = projectedJson(0.0, 0.0, severed = true))),
        )

        val landing = (repo().projection(node("t1"), StancePair(-0.4, -0.2)) as Outcome.Success).value

        assertThat(landing.inertDirected).isTrue()
        assertThat(landing.inertInterest).isTrue()
        assertThat(landing.severance).isTrue()
    }

    @Test
    fun `a bundle that answers a pick without a projection is a server fault`() = runTest {
        enqueueFirstThen("t1", answerJson("post", bundleJson(projected = null)))

        val outcome = repo().projection(node("t1"), StancePair(0.1, 0.1))

        assertThat(outcome).isInstanceOf(Outcome.Failed::class.java)
    }

    @Test
    fun `the severance quote carries the batch cost, not the record count`() = runTest {
        enqueue(
            firstJson(
                bundleJson(pDirected = 0.7, pInterest = 0.3, recordCount = 9, severanceCost = 4),
            ),
        )

        val quote = (repo().severanceQuote(node("t1")) as Outcome.Success).value

        assertThat(quote.target).isEqualTo(node("t1"))
        assertThat(quote.standing).isEqualTo(StancePair(0.7, 0.3))
        assertThat(quote.records).isEqualTo(4)
        assertThat(quote.alreadySevered).isFalse()
    }

    @Test
    fun `an already severed bundle says so`() = runTest {
        enqueue(
            firstJson(
                bundleJson(pDirected = 0.0, pInterest = 0.0, severed = true, severanceCost = 0),
            ),
        )

        val quote = (repo().severanceQuote(node("t1")) as Outcome.Success).value

        assertThat(quote.alreadySevered).isTrue()
        assertThat(quote.records).isEqualTo(0)
    }

    // The API since the empty sign (#283): an EMPTY bundle answers severed
    // false — nothing stands to walk back all the same.
    @Test
    fun `an empty bundle has nothing to walk back though the API says not severed`() = runTest {
        enqueue(
            firstJson(
                bundleJson(pDirected = 0.0, pInterest = 0.0, recordCount = 0, severed = false, severanceCost = 0),
            ),
        )

        val quote = (repo().severanceQuote(node("t1")) as Outcome.Success).value

        assertThat(quote.alreadySevered).isTrue()
        assertThat(quote.bundleRecords).isEqualTo(0)
    }

    @Test
    fun `an empty signs standing walks back at its cost of one`() = runTest {
        enqueue(
            firstJson(
                bundleJson(pDirected = 0.0, pInterest = 0.0, recordCount = 1, severed = false, severanceCost = 1),
            ),
        )

        val quote = (repo().severanceQuote(node("t1")) as Outcome.Success).value

        assertThat(quote.alreadySevered).isFalse()
        assertThat(quote.records).isEqualTo(1)
        assertThat(quote.bundleRecords).isEqualTo(1)
    }

    @Test
    fun `the standing carries which zero it is`() = runTest {
        enqueue(firstJson(bundleJson(pDirected = 0.0, pInterest = 0.0, recordCount = 3, severed = true)))
        assertThat((repo().standing(node("t1")) as Outcome.Success).value.severed).isTrue()
        enqueue(firstJson(bundleJson(pDirected = 0.0, pInterest = 0.0, recordCount = 1, severed = false)))
        assertThat((repo().standing(node("t1")) as Outcome.Success).value.severed).isFalse()
    }

    @Test
    fun `an id no node answers is refused as not found`() = runTest {
        enqueue(pageJson("null"))

        val outcome = repo().standing(node("ghost"))

        assertThat(outcome).isInstanceOf(Outcome.Refused::class.java)
        assertThat((outcome as Outcome.Refused).errors.single().code).isEqualTo(ErrorCode.NOT_FOUND)
        assertThat(server.requestCount).isEqualTo(1)
    }

    @Test
    fun `a target its root stops holding is paged again`() = runTest {
        val repo = repo()
        enqueue(pageJson(slot("t1")))
        // The remembered root has gone quiet: the memo is dropped…
        enqueue(missJson("post"))
        // …so the next read asks the page again rather than staying on a
        // class that no longer holds the id.
        enqueue(pageJson(slot("t1", typename = "Comment")))
        enqueue(answerJson("comment", bundleJson()))

        repo.standing(node("t1"))
        val gone = repo.standing(node("t1"))
        repo.standing(node("t1"))
        repo.standing(node("t1"))

        assertThat((gone as Outcome.Refused).errors.single().code).isEqualTo(ErrorCode.NOT_FOUND)
        assertThat(List(4) { server.nextOperation() })
            .containsExactly("PageStances", "PostStance", "PageStances", "CommentStance").inOrder()
    }

    @Test
    fun `a node with no bundle behind it is an unauthenticated refusal`() = runTest {
        enqueue(pageJson(slot("t1", bundle = null)))

        val outcome = repo().standing(node("t1"))

        assertThat(outcome).isInstanceOf(Outcome.Refused::class.java)
        assertThat((outcome as Outcome.Refused).errors.single().code)
            .isEqualTo(ErrorCode.UNAUTHENTICATED)
    }

    @Test
    fun `the L1 view rides the wire when the reader asks for it`() = runTest {
        enqueue(firstJson(bundleJson()))

        val standing = (repo().standing(node("t1"), includePending = false) as Outcome.Success).value

        assertThat(standing.includePending).isFalse()
        assertThat(server.next().body.readUtf8()).contains("\"includePending\":false")
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

        val staged = (repo().prepareSeverance(node("t1")) as Outcome.Success).value

        assertThat(staged.map { it.id }).containsExactly("w1", "w2", "w3").inOrder()
        assertThat(staged.map { it.family }).containsExactly(Family.OPINION, Family.OPINION, Family.OPINION)
        assertThat(server.next().body.readUtf8()).contains("\"target\":\"t1\"")
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

        val outcome = repo().prepareSeverance(node("t1"))

        assertThat(outcome).isInstanceOf(Outcome.Refused::class.java)
        assertThat((outcome as Outcome.Refused).errors.single().code).isEqualTo(ErrorCode.BAD_INPUT)
    }

    @Test
    fun `the prepare hands the picked pair through untouched`() = runTest {
        // The raw-edge rule: what is staged is what was picked, never a
        // delta against the standing the reads just reported.
        enqueue(firstJson(bundleJson(pDirected = 0.8, pInterest = 0.8)))
        val repo = repo()
        repo.standing(node("t1"))

        repo.prepareStance(node("t1"), StancePair(-0.3, 0.2))

        assertThat(writes.lastTarget).isEqualTo("t1")
        assertThat(writes.lastPick).isEqualTo(-0.3 to 0.2)
    }

    // -- The topic leg: a name is an address, not a spelling of an id --

    @Test
    fun `a topic read asks the hashtag root once and never probes`() = runTest {
        // The probe exists because an OPAQUE id does not say which root
        // holds it. A name does, so the topic read is one document —
        // and a feed drawing one control per card is exactly why that
        // matters (this file's own note on the priced shape).
        val repo = repo()
        enqueue(answerJson("hashtag", bundleJson(pDirected = 0.6, pInterest = 0.35, recordCount = 4)))

        val standing = (repo.standing(StanceTarget.Topic("saltmaps")) as Outcome.Success).value

        assertThat(standing.target).isEqualTo(StanceTarget.Topic("saltmaps"))
        assertThat(standing.net).isEqualTo(StancePair(0.6, 0.35))
        assertThat(standing.records).isEqualTo(4)
        val body = server.next().body.readUtf8()
        assertThat(body).contains("HashtagStance")
        assertThat(body).contains("\"name\":\"saltmaps\"")
        // Nothing else was asked: a probe would have left requests behind.
        assertThat(server.requestCount).isEqualTo(1)
    }

    @Test
    fun `a topic the substrate cannot carry is refused, not read as an empty bundle`() = runTest {
        enqueue(missJson("hashtag"))

        val outcome = repo().standing(StanceTarget.Topic("not a name"))

        assertThat(outcome).isInstanceOf(Outcome.Refused::class.java)
        assertThat((outcome as Outcome.Refused).errors.single().code).isEqualTo(ErrorCode.NOT_FOUND)
    }

    @Test
    fun `a topic stance is staged by name, not by id`() = runTest {
        // `PrepareStanceInput` is exactly-one-of, and a Type anchored
        // vacuously has no id to send — naming it is what registers it.
        repo().prepareStance(StanceTarget.Topic("saltmaps"), StancePair(0.25, 0.3))

        assertThat(writes.lastTopic).isEqualTo("saltmaps")
        assertThat(writes.lastTarget).isNull()
        assertThat(writes.lastPick).isEqualTo(0.25 to 0.3)
    }

    @Test
    fun `unfollowing sends topicName, and no target rides along`() = runTest {
        enqueue("""{"data":{"prepareSeverance":{"writes":[],"userErrors":[]}}}""")

        repo().prepareSeverance(StanceTarget.Topic("saltmaps"))

        val body = server.next().body.readUtf8()
        assertThat(body).contains("\"topicName\":\"saltmaps\"")
        assertThat(body).doesNotContain("\"target\"")
    }
}

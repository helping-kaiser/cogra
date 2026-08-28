// The reference repository against a MockWebServer through the real
// generated Apollo client: the finder's lookup and its polymorphic
// candidate mapping, the standalone citation with its two parameters,
// and the withdrawal whose batch length is the gesture's cost.

package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.Outcome
import com.cogra.domain.ReferenceContentKind
import com.cogra.domain.ReferenceTargetView
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.ReferenceRepositoryImpl
import com.google.common.truth.Truth.assertThat
import javax.inject.Provider
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Before
import org.junit.Test

class ReferenceRepositoryTest {

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

    private fun repo() = ReferenceRepositoryImpl(
        client,
        AuthGuard(
            tokenStore,
            SessionRefresher(
                tokenStore,
                EndLocalSession(FakeIdentityStore(), tokenStore),
                Provider { client },
            ),
        ),
    )

    @Test
    fun theFinderMapsAProfileCandidateToAMention() = runTest {
        enqueue(
            """{"data":{"referenceCandidates":[{"__typename":"ReferenceCandidate",
            "target":{"__typename":"User","id":"u1","handle":"ada",
            "displayName":{"__typename":"ModeratedText","value":"Ada"}},
            "targetId":"u1"}]}}""",
        )
        val outcome = repo().referenceCandidates("@ada")
        val candidate = (outcome as Outcome.Success).value.single()
        assertThat(candidate.targetId).isEqualTo("u1")
        assertThat(candidate.target)
            .isEqualTo(ReferenceTargetView.Profile("u1", "ada", "Ada"))
    }

    @Test
    fun theFinderMapsAPostCandidateWithItsAuthorAndTitle() = runTest {
        enqueue(
            """{"data":{"referenceCandidates":[{"__typename":"ReferenceCandidate",
            "target":{"__typename":"Post","id":"p1",
            "title":{"__typename":"ModeratedText","value":"On latency","status":"VISIBLE"},
            "content":{"__typename":"ModeratedText","value":"Body","status":"VISIBLE"},
            "author":{"__typename":"User","id":"u1","handle":"ada",
            "displayName":{"__typename":"ModeratedText","value":"Ada"}}},
            "targetId":"p1"}]}}""",
        )
        val outcome = repo().referenceCandidates("p1")
        val target = (outcome as Outcome.Success).value.single().target
        assertThat(target).isInstanceOf(ReferenceTargetView.Content::class.java)
        val content = target as ReferenceTargetView.Content
        assertThat(content.kind).isEqualTo(ReferenceContentKind.POST)
        assertThat(content.title).isEqualTo("On latency")
        assertThat(content.authorHandle).isEqualTo("ada")
    }

    /**
     * A comment is read inside the post that carries it and has no
     * permalink, so the candidate carries that post walked up from the
     * comment's own target.
     */
    @Test
    fun aCommentCandidateCarriesThePostThatContainsIt() = runTest {
        enqueue(
            """{"data":{"referenceCandidates":[{"__typename":"ReferenceCandidate",
            "target":{"__typename":"Comment","id":"c1",
            "content":{"__typename":"ModeratedText","value":"A remark","status":"VISIBLE"},
            "author":{"__typename":"User","id":"u1","handle":"ada",
            "displayName":{"__typename":"ModeratedText","value":"Ada"}},
            "target":{"__typename":"Post","id":"p1"}},
            "targetId":"c1"}]}}""",
        )
        val outcome = repo().referenceCandidates("c1")
        val content =
            (outcome as Outcome.Success).value.single().target as ReferenceTargetView.Content
        assertThat(content.kind).isEqualTo(ReferenceContentKind.COMMENT)
        assertThat(content.containingPostId).isEqualTo("p1")
    }

    /** A reply to a reply: the walk goes one level further. */
    @Test
    fun aNestedCommentCandidateWalksTwoLevelsToItsPost() = runTest {
        enqueue(
            """{"data":{"referenceCandidates":[{"__typename":"ReferenceCandidate",
            "target":{"__typename":"Comment","id":"c2",
            "content":{"__typename":"ModeratedText","value":"A reply","status":"VISIBLE"},
            "author":null,
            "target":{"__typename":"Comment","id":"c1",
            "target":{"__typename":"Post","id":"p1"}}},
            "targetId":"c2"}]}}""",
        )
        val outcome = repo().referenceCandidates("c2")
        val content =
            (outcome as Outcome.Success).value.single().target as ReferenceTargetView.Content
        assertThat(content.containingPostId).isEqualTo("p1")
    }

    /**
     * An unresolvable query is an empty list, never a refusal: the
     * finder runs on every keystroke, so most of what it is asked is a
     * prefix of something still being typed.
     */
    @Test
    fun anUnresolvableFinderQueryIsAnEmptyListNotARefusal() = runTest {
        enqueue("""{"data":{"referenceCandidates":[]}}""")
        val outcome = repo().referenceCandidates("ad")
        assertThat((outcome as Outcome.Success).value).isEmpty()
    }

    @Test
    fun prepareReferenceSendsTheArtifactAndTargetOnTheWire() = runTest {
        enqueue(
            """{"data":{"prepareReference":{"__typename":"PreparePayload",
            "writes":[],"userErrors":[]}}}""",
        )
        repo().prepareReference(artifact = "p1", target = "u1")
        val body = server.takeRequest().body.readUtf8()
        assertThat(body).contains("\"artifact\":\"p1\"")
        assertThat(body).contains("\"target\":\"u1\"")
    }

    @Test
    fun prepareReferenceCarriesBothParametersWhenTheSlidersWereUsed() = runTest {
        enqueue(
            """{"data":{"prepareReference":{"__typename":"PreparePayload",
            "writes":[],"userErrors":[]}}}""",
        )
        repo().prepareReference(artifact = "p1", target = "u1", relevance = 0.8, support = -0.3)
        val body = server.takeRequest().body.readUtf8()
        assertThat(body).contains("\"relevance\":0.8")
        assertThat(body).contains("\"support\":-0.3")
    }

    /**
     * The withdrawal's batch length is the gesture's cost — a citation
     * revised upward several times needs more than one counter-record
     * to walk back, which is why the server assembles it.
     */
    @Test
    fun aWithdrawalReturnsEveryCounterRecordTheBundleNeeds() = runTest {
        enqueue(
            """{"data":{"prepareReferenceWithdrawal":{"__typename":"PreparePayload","writes":[
            {"__typename":"PreparedWrite","id":"w1","family":"REFERENCE",
             "canonicalProposal":"AA==","gcAfterEpochs":10},
            {"__typename":"PreparedWrite","id":"w2","family":"REFERENCE",
             "canonicalProposal":"AA==","gcAfterEpochs":10},
            {"__typename":"PreparedWrite","id":"w3","family":"REFERENCE",
             "canonicalProposal":"AA==","gcAfterEpochs":10}],"userErrors":[]}}}""",
        )
        val outcome = repo().prepareReferenceWithdrawal(artifact = "p1", target = "u1")
        assertThat((outcome as Outcome.Success).value).hasSize(3)
    }
}

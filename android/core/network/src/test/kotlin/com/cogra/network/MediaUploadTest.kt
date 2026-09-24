package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.AuthTokens
import com.cogra.domain.MediaAssetState
import com.cogra.domain.Outcome
import com.cogra.domain.media.MediaDestination
import com.cogra.domain.media.ProcessedVideo
import com.cogra.domain.media.UploadProgress
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.BearerInterceptor
import com.cogra.network.auth.SessionGate
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.MediaRepositoryImpl
import com.cogra.network.repo.PartUploader
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.testing.FakeIdentityStore
import com.cogra.domain.testing.FakeTokenStore
import com.google.common.truth.Truth.assertThat
import java.io.File
import kotlin.random.Random
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

/**
 * The resumable upload, against a server that drops parts.
 *
 * This is the failure the path exists for: a ~90 MiB video died twice
 * with "The upload could not reach the server" because one blink
 * anywhere in a single long POST killed everything and the retry
 * started from zero. A part is the unit of failure now.
 */
class MediaUploadTest {

    @get:Rule
    val temp = TemporaryFolder()

    private lateinit var server: MockWebServer
    private lateinit var client: ApolloClient
    private val tokens = FakeTokenStore()

    /** How many times each part number has been asked for. */
    private val partAttempts = mutableMapOf<Int, Int>()

    /** Part numbers to fail, and how many times before letting through. */
    private var failuresFor = mutableMapOf<Int, Int>()
    private var refusalsFor = mutableMapOf<Int, Int>()

    private var completeCalls = 0
    private var beginCalls = 0
    private var mediaAttachmentCalls = 0

    /** Whether the next upload/complete answer comes back PROCESSING instead of READY. */
    private var processingUpload = false

    /** What the next (and every subsequent) `mediaAttachment` poll answers. */
    private var mediaAttachmentResponse = """{"data":{"mediaAttachment":null}}"""

    @Before
    fun setUp() {
        server = MockWebServer()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val path = request.path.orEmpty()
                return when {
                    path.startsWith("/media/uploads/") -> part(request)
                    else -> graphql(request)
                }
            }
        }
        server.start()
        client = ApolloClient.Builder()
            .serverUrl(server.url("/graphql").toString())
            .addHttpInterceptor(BearerInterceptor(sessionGate()))
            .build()
    }

    @After
    fun tearDown() {
        client.close()
        server.shutdown()
    }

    /** The suite's tokens are opaque, so the gate only ever passes them on. */
    private fun sessionGate() = SessionGate(tokens) {
        SessionRefresher(tokens, EndLocalSession(FakeIdentityStore(), tokens)) { client }
    }

    private fun part(request: RecordedRequest): MockResponse {
        val number = request.path.orEmpty().substringAfterLast('/').toInt()
        val seen = partAttempts.merge(number, 1, Int::plus) ?: 1
        val owed = failuresFor[number] ?: 0
        // The blip. A real one is a dead socket, which the sender sees
        // as an `IOException`; a 5xx takes the same branch and is what a
        // mock server can produce deterministically — the socket-policy
        // shim in mockwebserver 5's legacy package does not.
        if (seen <= owed) return MockResponse().setResponseCode(503)
        // A refusal: an answer about the request, not a blip.
        refusalsFor[number]?.let { return MockResponse().setResponseCode(it) }
        return MockResponse()
            .setBody("""{"partNumber":$number,"receivedParts":[$number],"partCount":2}""")
            .addHeader("Content-Type", "application/json")
    }

    /** Every GraphQL request body, in order — multipart bodies included. */
    private val graphqlBodies = mutableListOf<String>()

    private fun graphql(request: RecordedRequest): MockResponse {
        val body = request.body.readUtf8()
        graphqlBodies += body
        val json = when {
            body.contains("beginMediaUpload") -> {
                beginCalls += 1
                """{"data":{"beginMediaUpload":{"__typename":"BeginMediaUploadPayload",
                   "upload":{"__typename":"MediaUploadSession","id":"$SESSION",
                   "partSizeBytes":$PART_SIZE,"partCount":2},"userErrors":[]}}}"""
            }
            body.contains("completeMediaUpload") -> {
                completeCalls += 1
                """{"data":{"completeMediaUpload":{"__typename":"UploadMediaPayload",
                   "media":${mediaJson(state = if (processingUpload) "PROCESSING" else "READY")},
                   "userErrors":[]}}}"""
            }
            body.contains("uploadMedia") ->
                """{"data":{"uploadMedia":{"__typename":"UploadMediaPayload",
                   "media":${mediaJson(state = if (processingUpload) "PROCESSING" else "READY")},
                   "userErrors":[]}}}"""
            body.contains("mediaAttachment") -> {
                mediaAttachmentCalls += 1
                mediaAttachmentResponse
            }
            else -> """{"data":{}}"""
        }
        return MockResponse().setBody(json).addHeader("Content-Type", "application/json")
    }

    private fun mediaJson(state: String = "READY", failureReason: String? = null) = """
        {"__typename":"MediaAttachment","id":"v1","url":"https://media/v1","altText":null,
         "status":"NORMAL","mimeType":"video/mp4",
         "options":{"__typename":"MediaOptions","aspectRatio":"9:16","durationMs":1000},
         "coverMedia":null,"coverTaken":false,"state":"$state","failureReason":${failureReason?.let { "\"$it\"" }}}
    """.trimIndent()

    /** A clip of [bytes] bytes on disk, and the repository that sends it. */
    private fun TestScope.repositoryFor(bytes: Int): Pair<MediaRepositoryImpl, ProcessedVideo> {
        val file = temp.newFile("clip.mp4")
        file.writeBytes(ByteArray(bytes) { it.toByte() })
        val uploader = PartUploader(
            tokens = tokens,
            endpoint = server.url("/graphql").toString(),
            // Pinned so the schedule is the policy's, not chance's.
            random = Random(1),
            // The backoff runs on the suite's virtual clock, so a part
            // that drops twice costs no real seconds.
            io = UnconfinedTestDispatcher(testScheduler),
        )
        val guard = AuthGuard(
            tokens,
            SessionRefresher(tokens, EndLocalSession(FakeIdentityStore(), tokens)) { client },
        )
        val repo = MediaRepositoryImpl(client, guard, uploader).apply {
            // Within reach of a test-sized file: eight mebibytes of
            // bytes per case would be the slowest thing in the build.
            resumableThresholdBytes = PART_SIZE.toLong()
        }
        return repo to ProcessedVideo(file.path, 1080, 1920, 1_000, bytes.toLong())
    }

    @Test
    fun aPartThatDropsTwiceIsSentAgainAndTheUploadStillLands() = runTest {
        tokens.save(AuthTokens("access", "refresh", "acct"))
        // The first part's connection dies twice before it goes through.
        failuresFor[1] = 2
        val (repo, clip) = repositoryFor(PART_SIZE + 10)

        val outcome = repo.uploadVideo(clip, MediaDestination.POST)

        assertThat(outcome).isInstanceOf(Outcome.Success::class.java)
        // Three attempts at part one, one at part two — and the upload
        // was never begun a second time.
        assertThat(partAttempts[1]).isEqualTo(3)
        assertThat(partAttempts[2]).isEqualTo(1)
        assertThat(beginCalls).isEqualTo(1)
        assertThat(completeCalls).isEqualTo(1)
    }

    @Test
    fun theAuthorIsToldNothingWhileTheRetriesAreWorking() = runTest {
        tokens.save(AuthTokens("access", "refresh", "acct"))
        failuresFor[1] = 2
        val (repo, clip) = repositoryFor(PART_SIZE + 10)
        val ticks = mutableListOf<UploadProgress>()

        repo.uploadVideo(clip, MediaDestination.POST) { ticks += it }

        // Progress only ever moves forward — a retried part reports
        // nothing until it lands, so the bar never goes backwards.
        assertThat(ticks.map { it.sentParts }).isInOrder()
        assertThat(ticks.last().sentParts).isEqualTo(2)
        assertThat(ticks.first().uploadId).isEqualTo(SESSION)
    }

    @Test
    fun aPartThatNeverLandsFailsTheUploadRatherThanHangs() = runTest {
        tokens.save(AuthTokens("access", "refresh", "acct"))
        // More failures than the budget allows.
        failuresFor[1] = 99
        val (repo, clip) = repositoryFor(PART_SIZE + 10)

        val outcome = repo.uploadVideo(clip, MediaDestination.POST)

        assertThat(outcome).isInstanceOf(Outcome.Failed::class.java)
        // It gave up rather than looping, and never asked to complete.
        assertThat(completeCalls).isEqualTo(0)
    }

    /**
     * A refused part is an answer, and the two tiers say different
     * things: telling the author to check their connection about a 4xx
     * is advice that cannot help (AND-05).
     */
    @Test
    fun aRefusedPartIsARefusalRatherThanAFault() = runTest {
        tokens.save(AuthTokens("access", "refresh", "acct"))
        refusalsFor[1] = 422
        val (repo, clip) = repositoryFor(PART_SIZE + 10)

        val outcome = repo.uploadVideo(clip, MediaDestination.POST)

        assertThat(outcome).isInstanceOf(Outcome.Refused::class.java)
        // A refusal is not retried, and completion is never asked for.
        assertThat(partAttempts[1]).isEqualTo(1)
        assertThat(completeCalls).isEqualTo(0)
    }

    /**
     * With no token the request would go out unauthenticated, be
     * answered 401, and burn the whole retry budget before reporting a
     * connectivity fault that never happened (AND-12).
     */
    @Test
    fun anUnreadableTokenStopsBeforeSendingAnythingUnauthenticated() = runTest {
        // No token saved at all.
        val (repo, clip) = repositoryFor(PART_SIZE + 10)

        val outcome = repo.uploadVideo(clip, MediaDestination.POST)

        assertThat(outcome).isInstanceOf(Outcome.Failed::class.java)
        assertThat(partAttempts).isEmpty()
        assertThat(completeCalls).isEqualTo(0)
    }

    @Test
    fun everyPartCarriesTheBearerAndItsOwnNumber() = runTest {
        tokens.save(AuthTokens("access", "refresh", "acct"))
        val (repo, clip) = repositoryFor(PART_SIZE + 10)

        repo.uploadVideo(clip, MediaDestination.POST)

        val puts = generateSequence { server.takeRequest(1, MILLISECONDS) }
            .filter { it.path.orEmpty().startsWith("/media/uploads/") }
            .toList()
        assertThat(puts).hasSize(2)
        puts.forEach { assertThat(it.getHeader("Authorization")).isEqualTo("Bearer access") }
        assertThat(puts.map { it.method }).containsExactly("PUT", "PUT")
        assertThat(puts.map { it.path?.substringAfterLast('/') })
            .containsExactly("1", "2").inOrder()
        // Every part but the last is exactly the dictated size; the last
        // is the remainder. A part of any other size is refused.
        assertThat(puts[0].bodySize).isEqualTo(PART_SIZE.toLong())
        assertThat(puts[1].bodySize).isEqualTo(10L)
    }

    @Test
    fun aSmallClipTakesTheSingleShotRouteInstead() = runTest {
        tokens.save(AuthTokens("access", "refresh", "acct"))
        // Under the threshold, where resumability buys a round trip and
        // nothing else.
        val (repo, clip) = repositoryFor(PART_SIZE - 1)

        val outcome = repo.uploadVideo(clip, MediaDestination.POST)

        assertThat(outcome).isInstanceOf(Outcome.Success::class.java)
        assertThat(beginCalls).isEqualTo(0)
        assertThat(partAttempts).isEmpty()
    }

    /**
     * The server sizes, re-encodes and validates a clip for the cap of the
     * parent it is headed for — a comment's is half a post's — so the
     * destination rides whichever route the clip's size takes.
     */
    @Test
    fun aClipInPartsNamesItsDestinationWhenTheSessionOpens() = runTest {
        tokens.save(AuthTokens("access", "refresh", "acct"))
        val (repo, clip) = repositoryFor(PART_SIZE + 10)

        repo.uploadVideo(clip, MediaDestination.COMMENT)

        val begin = graphqlBodies.single { it.contains("beginMediaUpload") }
        assertThat(begin).contains("\"scale\":\"COMMENT\"")
    }

    @Test
    fun aClipInOneRequestNamesItsDestinationBesideItsBytes() = runTest {
        tokens.save(AuthTokens("access", "refresh", "acct"))
        val (repo, clip) = repositoryFor(PART_SIZE - 1)

        repo.uploadVideo(clip, MediaDestination.COMMENT)

        val single = graphqlBodies.single { it.contains("uploadMedia(") }
        assertThat(single).contains("\"scale\":\"COMMENT\"")
    }

    /**
     * The poll primitive `awaitReady` (core:domain) drives: whatever the
     * server answers for `mediaAttachment` maps straight through, with no
     * repository-level interpretation of PROCESSING/READY/FAILED.
     */
    @Test
    fun mediaAttachmentMapsAReadyAsset() = runTest {
        tokens.save(AuthTokens("access", "refresh", "acct"))
        val (repo, _) = repositoryFor(PART_SIZE - 1)
        mediaAttachmentResponse = """{"data":{"mediaAttachment":
            {"__typename":"MediaAttachment","id":"v1","state":"READY","failureReason":null}}}"""

        val outcome = repo.mediaAttachment("v1")

        assertThat(outcome).isInstanceOf(Outcome.Success::class.java)
        val readiness = (outcome as Outcome.Success).value
        assertThat(readiness?.id).isEqualTo("v1")
        assertThat(readiness?.state).isEqualTo(MediaAssetState.READY)
        assertThat(readiness?.failureReason).isNull()
    }

    @Test
    fun mediaAttachmentMapsAFailedAssetWithItsReason() = runTest {
        tokens.save(AuthTokens("access", "refresh", "acct"))
        val (repo, _) = repositoryFor(PART_SIZE - 1)
        mediaAttachmentResponse = """{"data":{"mediaAttachment":
            {"__typename":"MediaAttachment","id":"v1","state":"FAILED",
             "failureReason":"not H.264"}}}"""

        val outcome = repo.mediaAttachment("v1")

        val readiness = (outcome as Outcome.Success).value
        assertThat(readiness?.state).isEqualTo(MediaAssetState.FAILED)
        assertThat(readiness?.failureReason).isEqualTo("not H.264")
    }

    /** Gone entirely — collected long ago, or never the caller's own upload. */
    @Test
    fun mediaAttachmentAnswersNullForAnUnknownId() = runTest {
        tokens.save(AuthTokens("access", "refresh", "acct"))
        val (repo, _) = repositoryFor(PART_SIZE - 1)
        mediaAttachmentResponse = """{"data":{"mediaAttachment":null}}"""

        val outcome = repo.mediaAttachment("gone")

        assertThat((outcome as Outcome.Success).value).isNull()
    }

    /**
     * Not the shipped path — Android's own uploads are always within
     * target — but the wire carries it, so the repository has to pass it
     * through rather than assume every upload answers READY.
     */
    @Test
    fun anUploadMayComeBackProcessing() = runTest {
        tokens.save(AuthTokens("access", "refresh", "acct"))
        val (repo, clip) = repositoryFor(PART_SIZE - 1)
        processingUpload = true

        val outcome = repo.uploadVideo(clip, MediaDestination.POST)

        val media = (outcome as Outcome.Success).value
        assertThat(media.state).isEqualTo(MediaAssetState.PROCESSING)
    }

    private companion object {
        const val SESSION = "11111111-1111-1111-1111-111111111111"

        /** Small enough to keep the test's bytes cheap. */
        const val PART_SIZE = 64

        val MILLISECONDS = java.util.concurrent.TimeUnit.MILLISECONDS
    }
}

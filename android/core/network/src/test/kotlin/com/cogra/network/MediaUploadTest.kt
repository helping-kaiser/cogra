package com.cogra.network

import com.apollographql.apollo.ApolloClient
import com.cogra.domain.AuthTokens
import com.cogra.domain.Outcome
import com.cogra.domain.media.ProcessedVideo
import com.cogra.domain.media.UploadProgress
import com.cogra.network.auth.AuthGuard
import com.cogra.network.auth.BearerInterceptor
import com.cogra.network.auth.SessionRefresher
import com.cogra.network.repo.MediaRepositoryImpl
import com.cogra.network.repo.PartUploader
import com.cogra.domain.testing.FakeTokenStore
import com.google.common.truth.Truth.assertThat
import java.io.File
import kotlin.random.Random
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
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

    private var completeCalls = 0
    private var beginCalls = 0

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
            .addHttpInterceptor(BearerInterceptor(tokens))
            .build()
    }

    @After
    fun tearDown() {
        client.close()
        server.shutdown()
    }

    private fun part(request: RecordedRequest): MockResponse {
        val number = request.path.orEmpty().substringAfterLast('/').toInt()
        val seen = partAttempts.merge(number, 1, Int::plus) ?: 1
        val owed = failuresFor[number] ?: 0
        // The blip: the connection goes away rather than answering.
        if (seen <= owed) return MockResponse().setSocketPolicy(DISCONNECT)
        return MockResponse()
            .setBody("""{"partNumber":$number,"receivedParts":[$number],"partCount":2}""")
            .addHeader("Content-Type", "application/json")
    }

    private fun graphql(request: RecordedRequest): MockResponse {
        val body = request.body.readUtf8()
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
                   "media":${mediaJson()},"userErrors":[]}}}"""
            }
            body.contains("uploadMedia") ->
                """{"data":{"uploadMedia":{"__typename":"UploadMediaPayload",
                   "media":${mediaJson()},"userErrors":[]}}}"""
            else -> """{"data":{}}"""
        }
        return MockResponse().setBody(json).addHeader("Content-Type", "application/json")
    }

    private fun mediaJson() = """
        {"__typename":"MediaAttachment","id":"v1","url":"https://media/v1","altText":null,
         "status":"NORMAL","mimeType":"video/mp4",
         "options":{"__typename":"MediaOptions","aspectRatio":"0.5625","durationMs":1000},
         "coverMedia":null}
    """.trimIndent()

    /** A clip of [bytes] bytes on disk, and the repository that sends it. */
    private fun repositoryFor(bytes: Int): Pair<MediaRepositoryImpl, ProcessedVideo> {
        val file = temp.newFile("clip.mp4")
        file.writeBytes(ByteArray(bytes) { it.toByte() })
        val uploader = PartUploader(
            http = OkHttpClient(),
            tokens = tokens,
            endpoint = server.url("/graphql").toString(),
            // Pinned so the schedule is the policy's, not chance's.
            random = Random(1),
        )
        val guard = AuthGuard(tokens, SessionRefresher(tokens, { }, { client }))
        return MediaRepositoryImpl(client, guard, uploader) to
            ProcessedVideo(file.path, 1080, 1920, 1_000, bytes.toLong())
    }

    @Test
    fun aPartThatDropsTwiceIsSentAgainAndTheUploadStillLands() = runTest {
        tokens.save(AuthTokens("access", "refresh", "acct"))
        // The first part's connection dies twice before it goes through.
        failuresFor[1] = 2
        val (repo, clip) = repositoryFor(PART_SIZE + 10)

        val outcome = repo.uploadVideo(clip, coverMediaId = COVER)

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

        repo.uploadVideo(clip, COVER) { ticks += it }

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

        val outcome = repo.uploadVideo(clip, COVER)

        assertThat(outcome).isInstanceOf(Outcome.Failed::class.java)
        // It gave up rather than looping, and never asked to complete.
        assertThat(completeCalls).isEqualTo(0)
    }

    @Test
    fun everyPartCarriesTheBearerAndItsOwnNumber() = runTest {
        tokens.save(AuthTokens("access", "refresh", "acct"))
        val (repo, clip) = repositoryFor(PART_SIZE + 10)

        repo.uploadVideo(clip, COVER)

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
        val (repo, clip) = repositoryFor(1_024)

        val outcome = repo.uploadVideo(clip, COVER)

        assertThat(outcome).isInstanceOf(Outcome.Success::class.java)
        assertThat(beginCalls).isEqualTo(0)
        assertThat(partAttempts).isEmpty()
    }

    private companion object {
        const val SESSION = "11111111-1111-1111-1111-111111111111"
        const val COVER = "22222222-2222-2222-2222-222222222222"

        /** Small enough to keep the test's bytes cheap. */
        const val PART_SIZE = 64

        val DISCONNECT = okhttp3.mockwebserver.SocketPolicy.DISCONNECT_AT_START
        val MILLISECONDS = java.util.concurrent.TimeUnit.MILLISECONDS
    }
}

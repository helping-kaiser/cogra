// The resumable upload path (api-spec.md "Resuming a large upload"):
// begin, then one PUT per part, then complete — so a dropped connection
// costs one part rather than the file.

package com.cogra.network.repo

import com.cogra.domain.media.UploadProgress
import com.cogra.domain.media.UploadRetry
import com.cogra.domain.store.TokenStore
import java.io.File
import java.io.IOException
import java.io.RandomAccessFile
import java.net.HttpURLConnection
import java.net.URI
import kotlin.random.Random
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

/**
 * Sends one file's parts, retrying each on its own.
 *
 * **The whole point is that a part is the unit of failure.** A ninety
 * megabyte video used to ride one long POST, so a connection that
 * blinked anywhere in it lost everything and the retry started from
 * zero. Here a part number names a position rather than an attempt —
 * "re-sending a part replaces it" — so a blip costs one part and the
 * upload carries on without the author being told anything happened.
 *
 * **On `HttpURLConnection` rather than OkHttp.** Apollo speaks GraphQL
 * over its own engine and exposes no call factory, so this would have
 * meant a second HTTP client on the app's classpath — and OkHttp 5's
 * Android artifact requires `compileSdk 37`, which AGP 8.13.2 cannot
 * compile against (the same wall the catalog already records for Coil).
 * The platform's own client is what Android documents for a plain
 * request, and a raw PUT of a byte array under one header is exactly
 * the case it covers. The retry schedule is ours either way.
 *
 * Failure surfaces only when a part has spent its whole retry budget.
 */
class PartUploader(
    private val tokens: TokenStore,
    private val endpoint: String,
    private val random: Random = Random.Default,
    // Injected so the suites drive the backoff on a virtual clock
    // instead of waiting out the real one.
    private val io: CoroutineDispatcher = Dispatchers.IO,
) {

    /**
     * Sends every part of [file] for [uploadId], reporting after each.
     *
     * Parts go one at a time. The contract allows two or three at once
     * and it would be faster, but the failure this exists to fix is a
     * network that went away — where concurrency multiplies the
     * attempts spent against a dead link rather than the bytes moved.
     * Sequential also makes progress monotonic, which is what the ring
     * in front of the author is showing.
     *
     * Answers null on success, or the message to surface when a part
     * has exhausted its attempts.
     */
    suspend fun sendAll(
        uploadId: String,
        file: File,
        partSizeBytes: Int,
        partCount: Int,
        onProgress: (UploadProgress) -> Unit,
    ): String? = withContext(io) {
        onProgress(UploadProgress(uploadId, sentParts = 0, partCount = partCount))
        RandomAccessFile(file, "r").use { source ->
            for (partNumber in 1..partCount) {
                val offset = (partNumber - 1).toLong() * partSizeBytes
                // Every part but the last is exactly the dictated size;
                // the last is whatever remains. A part of any other size
                // is refused at the route, not discovered at assembly.
                val length = minOf(partSizeBytes.toLong(), file.length() - offset).toInt()
                if (length <= 0) return@withContext MALFORMED
                val bytes = ByteArray(length)
                source.seek(offset)
                source.readFully(bytes)

                val failure = sendOne(uploadId, partNumber, bytes)
                if (failure != null) return@withContext failure
                onProgress(UploadProgress(uploadId, sentParts = partNumber, partCount = partCount))
            }
        }
        null
    }

    /**
     * One part, retried until it lands or the budget runs out.
     *
     * A transport fault is worth trying again; a refusal is an answer
     * and is not. The server speaks the same vocabulary here as it does
     * over GraphQL, so a 4xx that is not an expired token means the
     * request was wrong and repeating it would only be slower.
     */
    private suspend fun sendOne(uploadId: String, partNumber: Int, bytes: ByteArray): String? {
        var attempt = 1
        while (true) {
            val wait = UploadRetry.delayMs(attempt, random.nextDouble())
            if (wait > 0) delay(wait)

            when (attemptPart(uploadId, partNumber, bytes)) {
                PartResult.Sent -> return null
                PartResult.Refused -> return REFUSED
                PartResult.Transient ->
                    if (!UploadRetry.retryable(attempt)) return TRANSPORT
            }
            attempt += 1
        }
    }

    private enum class PartResult { Sent, Refused, Transient }

    private fun attemptPart(uploadId: String, partNumber: Int, bytes: ByteArray): PartResult {
        val access = runCatching { kotlinx.coroutines.runBlocking { tokens.current() } }
            .getOrNull()
            ?.accessToken
        val connection = runCatching {
            URI(partUrl(uploadId, partNumber)).toURL().openConnection() as HttpURLConnection
        }.getOrElse { return PartResult.Transient }

        return try {
            connection.requestMethod = "PUT"
            connection.doOutput = true
            connection.connectTimeout = CONNECT_TIMEOUT_MS
            connection.readTimeout = READ_TIMEOUT_MS
            connection.setFixedLengthStreamingMode(bytes.size)
            access?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            connection.setRequestProperty("Content-Type", OCTET_STREAM)
            connection.outputStream.use { it.write(bytes) }

            when (val code = connection.responseCode) {
                in 200..299 -> PartResult.Sent
                // A stale access token is worth one more try: the
                // Apollo side refreshes it around the calls that
                // bracket this one, so the next attempt carries a
                // fresh header without this loop knowing how.
                UNAUTHORIZED -> PartResult.Transient
                // Anything else below 500 is an answer about the
                // request, and repeating it changes nothing.
                in 400..499 -> PartResult.Refused
                else -> if (code >= SERVER_ERROR) PartResult.Transient else PartResult.Refused
            }
        } catch (_: IOException) {
            // The case this class exists for: the connection went away.
            PartResult.Transient
        } finally {
            connection.disconnect()
        }
    }

    /**
     * `PUT /media/uploads/{id}/parts/{n}` on the API's own origin.
     *
     * Derived from the GraphQL endpoint rather than configured
     * separately: the part route is served by the same Axum app, so a
     * second setting could only ever disagree with the first.
     */
    private fun partUrl(uploadId: String, partNumber: Int): String {
        val origin = URI(endpoint).let { "${it.scheme}://${it.authority}" }
        return "$origin/media/uploads/$uploadId/parts/$partNumber"
    }

    private companion object {
        const val OCTET_STREAM = "application/octet-stream"

        const val UNAUTHORIZED = 401
        const val SERVER_ERROR = 500

        /**
         * A part is up to eight mebibytes, which on a poor connection
         * is minutes of writing — a short timeout would call a working
         * upload dead and spend a retry on it.
         */
        const val CONNECT_TIMEOUT_MS = 30_000
        const val READ_TIMEOUT_MS = 60_000

        const val TRANSPORT = "The upload could not reach the server."
        const val REFUSED = "The server would not take that video."
        const val MALFORMED = "That file could not be read as a video."
    }
}

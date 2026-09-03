// The media surface over the real contract (api-spec.md `uploadMedia`;
// roadmap "Slice 2.5.1"): one asset per call, the binary riding the
// GraphQL multipart request.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.DefaultUpload
import com.apollographql.apollo.api.Optional
import com.cogra.domain.MediaAssetView
import com.cogra.domain.Outcome
import com.cogra.domain.media.MediaRepository
import com.cogra.domain.media.ProcessedPicture
import com.cogra.domain.media.ProcessedVideo
import com.cogra.domain.media.RESUMABLE_THRESHOLD_BYTES
import com.cogra.domain.media.UploadProgress
import com.cogra.network.auth.AuthGuard
import com.cogra.network.graphql.AbortMediaUploadMutation
import com.cogra.network.graphql.BeginMediaUploadMutation
import com.cogra.network.graphql.CompleteMediaUploadMutation
import com.cogra.network.graphql.UploadMediaMutation
import com.cogra.network.graphql.type.MediaUploadKind
import com.cogra.network.payloadOutcome
import com.cogra.network.toDomain
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton
import okio.source

/** What a still sends, always — clients re-encode to WebP (D9, D11). */
private const val UPLOAD_MIME = "image/webp"

/**
 * The extension the server sees. The stored format is decided by the
 * bytes, not by this name, but a multipart part with no filename is
 * awkward for intermediaries to log, and the honest one costs nothing.
 */
private const val UPLOAD_FILENAME = "upload.webp"

/** What a clip sends — the one accepted moving format (rulings 2026-09-02). */
private const val VIDEO_MIME = "video/mp4"

private const val VIDEO_FILENAME = "upload.mp4"

@Singleton
class MediaRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
    private val parts: PartUploader,
) : MediaRepository {

    override suspend fun uploadMedia(
        picture: ProcessedPicture,
    ): Outcome<MediaAssetView> = guard.run {
        // `DefaultUpload` is Apollo's multiplatform upload body; the
        // Gradle side maps the `Upload` scalar onto it via
        // `mapScalarToUpload`, so the multipart `map`/`variables` parts
        // are assembled by the runtime rather than by hand
        // (apollographql.com/docs/kotlin/advanced/upload).
        //
        // The content lambda writes the bytes already in memory: the
        // pipeline downscaled them to at most 1080px before this point,
        // so the largest thing crossing here is a few hundred KiB.
        val upload = DefaultUpload.Builder()
            .fileName(UPLOAD_FILENAME)
            .contentType(UPLOAD_MIME)
            .contentLength(picture.bytes.size.toLong())
            .content { sink -> sink.write(picture.bytes) }
            .build()

        client.mutation(
            UploadMediaMutation(file = upload, coverMediaId = Optional.absent()),
        ).payloadOutcome({ it.uploadMedia.userErrors.map { e -> e.userErrorFields } }) { data ->
            // A null asset beside empty userErrors is a server fault,
            // which is what `payload` turns it into — never a success
            // carrying nothing.
            data.uploadMedia.media?.mediaFields?.toDomain()
        }
    }

    /**
     * A clip goes up in parts.
     *
     * Every video clears the threshold, so this is the resumable path
     * in practice — and it is the whole reason the path exists: a
     * ninety megabyte upload in one request dies outright when the
     * connection blinks, and the retry starts from zero. A small file
     * still takes the single-shot route, where resumability would buy
     * a round trip and nothing else.
     */
    override suspend fun uploadVideo(
        video: ProcessedVideo,
        coverMediaId: String,
        onProgress: (UploadProgress) -> Unit,
    ): Outcome<MediaAssetView> {
        val file = File(video.path)
        if (video.byteCount < RESUMABLE_THRESHOLD_BYTES) {
            return sendWhole(file, video.byteCount, coverMediaId)
        }
        return sendInParts(file, video.byteCount, coverMediaId, onProgress)
    }

    /**
     * The single-shot route, for a file small enough not to need the
     * other one.
     *
     * The bytes stream off disk rather than through a `ByteArray`:
     * Apollo hands this lambda the sink it is writing the multipart
     * body into, so the file never has to exist in memory.
     */
    private suspend fun sendWhole(
        file: File,
        byteCount: Long,
        coverMediaId: String,
    ): Outcome<MediaAssetView> = guard.run {
        val upload = DefaultUpload.Builder()
            .fileName(VIDEO_FILENAME)
            .contentType(VIDEO_MIME)
            .contentLength(byteCount)
            .content { sink -> file.source().use { sink.writeAll(it) } }
            .build()

        client.mutation(
            UploadMediaMutation(file = upload, coverMediaId = Optional.present(coverMediaId)),
        ).payloadOutcome({ it.uploadMedia.userErrors.map { e -> e.userErrorFields } }) { data ->
            data.uploadMedia.media?.mediaFields?.toDomain()
        }
    }

    /**
     * Begin, parts, complete.
     *
     * Each step is guarded on its own rather than the whole flow:
     * `AuthGuard` replays the block it wraps, and a refresh landing
     * mid-upload must not re-send a file that is most of the way up.
     */
    private suspend fun sendInParts(
        file: File,
        byteCount: Long,
        coverMediaId: String,
        onProgress: (UploadProgress) -> Unit,
    ): Outcome<MediaAssetView> {
        val session = guard.run {
            client.mutation(
                BeginMediaUploadMutation(
                    declaredBytes = byteCount.toInt(),
                    kind = MediaUploadKind.VIDEO,
                ),
            ).payloadOutcome({ it.beginMediaUpload.userErrors.map { e -> e.userErrorFields } }) { data ->
                data.beginMediaUpload.upload
            }
        }
        if (session !is Outcome.Success) return session.mapFailure()

        val opened = session.value
        val failure = parts.sendAll(
            uploadId = opened.id.toString(),
            file = file,
            partSizeBytes = opened.partSizeBytes,
            partCount = opened.partCount,
            onProgress = onProgress,
        )
        if (failure != null) return Outcome.Failed(IllegalStateException(failure))

        // Completion is idempotent by contract, so a lost reply is
        // worth asking again for: the session remembers the asset it
        // made and hands back the same one.
        return guard.run {
            client.mutation(
                CompleteMediaUploadMutation(
                    uploadId = opened.id,
                    coverMediaId = Optional.present(coverMediaId),
                ),
            ).payloadOutcome({ it.completeMediaUpload.userErrors.map { e -> e.userErrorFields } }) { data ->
                data.completeMediaUpload.media?.mediaFields?.toDomain()
            }
        }
    }

    override suspend fun abortUpload(uploadId: String) {
        // Fire and forget: a discarded composer is not waiting to hear
        // whether the store let go, and the sweep would do it anyway.
        runCatching {
            client.mutation(AbortMediaUploadMutation(uploadId = uploadId)).execute()
        }
    }
}

/** Carries a non-success across a change of value type. */
private fun <T, R> Outcome<T>.mapFailure(): Outcome<R> = when (this) {
    is Outcome.Success -> error("only a failure crosses here")
    is Outcome.Refused -> Outcome.Refused(errors)
    is Outcome.Failed -> Outcome.Failed(cause)
}

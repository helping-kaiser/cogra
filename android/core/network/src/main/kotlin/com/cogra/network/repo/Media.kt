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
import com.cogra.network.auth.AuthGuard
import com.cogra.network.graphql.UploadMediaMutation
import com.cogra.network.payloadOutcome
import com.cogra.network.toDomain
import javax.inject.Inject
import javax.inject.Singleton

/** What the device sends, always — clients re-encode to WebP (D9, D11). */
private const val UPLOAD_MIME = "image/webp"

/**
 * The extension the server sees. The stored format is decided by the
 * bytes, not by this name, but a multipart part with no filename is
 * awkward for intermediaries to log, and the honest one costs nothing.
 */
private const val UPLOAD_FILENAME = "upload.webp"

@Singleton
class MediaRepositoryImpl @Inject constructor(
    private val client: ApolloClient,
    private val guard: AuthGuard,
) : MediaRepository {

    override suspend fun uploadMedia(
        picture: ProcessedPicture,
        altText: String?,
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
            UploadMediaMutation(
                file = upload,
                altText = Optional.presentIfNotNull(altText),
            ),
        ).payloadOutcome({ it.uploadMedia.userErrors.map { e -> e.userErrorFields } }) { data ->
            // A null asset beside empty userErrors is a server fault,
            // which is what `payload` turns it into — never a success
            // carrying nothing.
            data.uploadMedia.media?.mediaFields?.toDomain()
        }
    }
}

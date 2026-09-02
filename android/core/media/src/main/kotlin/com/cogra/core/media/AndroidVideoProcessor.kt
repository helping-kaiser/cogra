package com.cogra.core.media

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.container.Mp4OrientationData
import androidx.media3.effect.Presentation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.InAppMp4Muxer
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import com.cogra.domain.media.ProcessedPicture
import com.cogra.domain.media.ProcessedVideo
import com.cogra.domain.media.VideoFrame
import com.cogra.domain.media.VideoInfo
import com.cogra.domain.media.VideoProcessor
import java.io.File
import kotlin.coroutines.resume
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext

/**
 * The on-device video pipeline over Media3 Transformer.
 *
 * Media3 is Android's own media stack and the only supported way the
 * platform documents to re-encode a clip
 * (developer.android.com/media/media3/transformer). The output format is
 * fixed to the one the server accepts — MP4 / H.264 + AAC — by naming
 * both MIME types on the builder, which is exactly what
 * `setVideoMimeType`/`setAudioMimeType` are for.
 *
 * **Every clip goes through Transformer, including one already in the
 * accepted format.** That is deliberate rather than wasteful: Transformer
 * transmuxes rather than re-encodes when the input already matches the
 * output and no effect forces a decode, so a conformant clip pays a
 * remux and loses no quality — and it still passes through this class's
 * muxer, which is where the metadata strip happens. A pass-through that
 * skipped the transcoder would skip the strip with it.
 *
 * @param context the application context; Transformer needs it to reach
 *   the platform codecs and the content resolver.
 */
class AndroidVideoProcessor(
    private val context: Context,
) : VideoProcessor {

    override suspend fun transcode(
        uri: String,
        onProgress: (Int) -> Unit,
    ): ProcessedVideo? {
        val probe = probe(uri) ?: return null
        val output = File(context.cacheDir, "upload-${System.nanoTime()}.mp4")

        val exported = runCatching { export(uri, probe, output, onProgress) }
            .getOrElse {
                output.delete()
                return null
            }
        if (!exported || !output.isFile || output.length() == 0L) {
            output.delete()
            return null
        }

        // The exported file is measured rather than predicted: the
        // encoder decides the final dimensions, and a scaling effect
        // rounds to what the codec accepts.
        val result = probe(Uri.fromFile(output).toString())
        return ProcessedVideo(
            path = output.path,
            width = result?.width ?: probe.width,
            height = result?.height ?: probe.height,
            durationMs = result?.durationMs ?: probe.durationMs,
            byteCount = output.length(),
        )
    }

    /**
     * Runs one export to completion.
     *
     * Transformer must be created and driven from a single application
     * thread with a `Looper`, and calls its listener back on that same
     * thread, so the whole exchange sits on the main dispatcher. The
     * work itself is off-thread inside Transformer — what stays here is
     * only the bookkeeping.
     */
    private suspend fun export(
        uri: String,
        probe: Probe,
        output: File,
        onProgress: (Int) -> Unit,
    ): Boolean = withContext(Dispatchers.Main) {
        suspendCancellableCoroutine { cont ->
            val transformer = Transformer.Builder(context)
                .setVideoMimeType(MimeTypes.VIDEO_H264)
                .setAudioMimeType(MimeTypes.AUDIO_AAC)
                // Where the metadata strip happens. Transformer copies
                // the input format's metadata entries into the muxer, so
                // a transcode alone carries the source container's boxes
                // — a recording's GPS fix among them — straight into the
                // output. `MetadataProvider` is the documented hook for
                // editing that set before it is written.
                .setMuxerFactory(
                    InAppMp4Muxer.Factory { entries -> entries.removeAll { it !is Mp4OrientationData } },
                )
                .addListener(
                    object : Transformer.Listener {
                        override fun onCompleted(
                            composition: Composition,
                            result: ExportResult,
                        ) {
                            if (cont.isActive) cont.resume(true)
                        }

                        override fun onError(
                            composition: Composition,
                            result: ExportResult,
                            exception: ExportException,
                        ) {
                            if (cont.isActive) cont.resume(false)
                        }
                    },
                )
                .build()

            cont.invokeOnCancellation { transformer.cancel() }

            transformer.start(editedItem(uri, probe), output.path)

            // Progress is polled rather than pushed: `getProgress` is
            // what Transformer offers, and a clip is long enough that a
            // spinner with no number reads as a hang.
            val holder = ProgressHolder()
            launch {
                while (isActive && cont.isActive) {
                    if (transformer.getProgress(holder) == Transformer.PROGRESS_STATE_AVAILABLE) {
                        onProgress(holder.progress)
                    }
                    delay(PROGRESS_POLL_MS)
                }
            }
        }
    }

    /**
     * The item to export: the clip, scaled down only when it is bigger
     * than the upload resolution.
     *
     * The condition matters. Any video effect forces a decode-encode
     * pass, so attaching the scaler unconditionally would re-encode a
     * clip that is already small enough and lose quality for nothing.
     * Below the ceiling the effect list stays empty and Transformer
     * takes its transmux path.
     */
    private fun editedItem(uri: String, probe: Probe): EditedMediaItem {
        val effects = if (probe.shortSide > MAX_SHORT_SIDE_PX) {
            // The short side is the axis to bound: it makes a portrait
            // clip 1080 wide and a landscape one 1080 tall, which is the
            // shape both of the services the ruling names publish at.
            Effects(
                /* audioProcessors = */ emptyList(),
                /* videoEffects = */ listOf(
                    Presentation.createForShortSide(MAX_SHORT_SIDE_PX),
                ),
            )
        } else {
            Effects.EMPTY
        }
        return EditedMediaItem.Builder(MediaItem.fromUri(uri))
            .setEffects(effects)
            .build()
    }

    override suspend fun coverFrames(uri: String, count: Int): List<VideoFrame> =
        withContext(Dispatchers.IO) {
            read(uri) { reader ->
                val duration = reader
                    .extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                    ?.toIntOrNull()
                    ?: return@read emptyList()
                buildList {
                    repeat(count) { index ->
                        // Frames sit at the midpoints of `count` equal
                        // slices rather than at 0, half and end: the
                        // first frame of a clip is often black, and the
                        // last one is often the moment the recorder
                        // reached for the button.
                        val atMs = (duration.toLong() * (2 * index + 1) / (2L * count)).toInt()
                        val bitmap = runCatching {
                            reader.getFrameAtTime(
                                atMs * 1_000L,
                                MediaMetadataRetriever.OPTION_CLOSEST_SYNC,
                            )
                        }.getOrNull() ?: return@repeat
                        // A frame becomes a still the same way a picked
                        // picture does — downscaled, re-encoded to WebP,
                        // carrying no metadata — because that is exactly
                        // what it is uploaded as.
                        val processed = ImageProcessing.processBitmap(bitmap)
                        add(
                            VideoFrame(
                                atMs = atMs,
                                picture = ProcessedPicture(
                                    processed.bytes,
                                    processed.width,
                                    processed.height,
                                ),
                            ),
                        )
                        bitmap.recycle()
                    }
                }
            }.orEmpty()
        }

    override suspend fun info(uri: String): VideoInfo? = withContext(Dispatchers.IO) {
        probe(uri)?.let { VideoInfo(it.durationMs, it.width.toFloat() / it.height.toFloat()) }
    }

    /** What the header says, before anything is decoded. */
    private data class Probe(val width: Int, val height: Int, val durationMs: Int) {
        val shortSide: Int get() = minOf(width, height)
    }

    private fun probe(uri: String): Probe? = read(uri) { reader ->
        val duration = reader
            .extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
            ?.toIntOrNull()
            ?: return@read null
        val width = reader
            .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
            ?.toIntOrNull()
            ?: return@read null
        val height = reader
            .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
            ?.toIntOrNull()
            ?: return@read null
        // A rotated recording reports its stored dimensions, so the
        // quarter turns swap them back before anything reasons about
        // which side is short.
        val rotation = reader
            .extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)
            ?.toIntOrNull()
            ?: 0
        if (rotation == 90 || rotation == 270) {
            Probe(height, width, duration)
        } else {
            Probe(width, height, duration)
        }
    }

    /**
     * Runs [block] against a retriever bound to [uri], releasing it
     * either way, and answers null when the bytes are not media the
     * device can read — the client half of the decode gate, exactly as
     * the picture pipeline refuses what does not decode.
     *
     * `MediaMetadataRetriever` only became `AutoCloseable` at API 29 and
     * this app runs from 26, so the release is explicit rather than a
     * `use` block.
     */
    private fun <T> read(uri: String, block: (MediaMetadataRetriever) -> T?): T? {
        val reader = MediaMetadataRetriever()
        return try {
            reader.setDataSource(context, Uri.parse(uri))
            block(reader)
        } catch (_: RuntimeException) {
            // What the platform throws for unreadable or unsupported
            // bytes: IllegalArgumentException from `setDataSource`, and
            // IllegalStateException from a reader that failed to bind.
            null
        } finally {
            runCatching { reader.release() }
        }
    }

    private companion object {
        /**
         * The upload resolution: 1080 on the short side.
         *
         * The ruling asks for "industry standard (instagram/tiktok)"
         * rather than a number, and 1080 is what both publish at — a
         * portrait clip at 1080 × 1920, a landscape one at 1920 × 1080.
         */
        const val MAX_SHORT_SIDE_PX = 1080

        const val PROGRESS_POLL_MS = 250L
    }
}

package com.cogra.core.media

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.container.Mp4OrientationData
import androidx.media3.effect.Presentation
import androidx.media3.transformer.AudioEncoderSettings
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.InAppMp4Muxer
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import com.cogra.domain.CograLog
import com.cogra.domain.media.ProcessedPicture
import com.cogra.domain.media.ProcessedVideo
import com.cogra.domain.media.VideoBitrate
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

    /**
     * On `Dispatchers.IO` like every sibling method here.
     *
     * The two `probe` calls bind a `MediaMetadataRetriever` to the
     * clip's bytes and the file checks touch the disk — blocking work
     * on a clip of up to a hundred mebibytes. Both callers launch in
     * `viewModelScope`, which is `Dispatchers.Main.immediate`, so
     * without this hop the reads ran on the UI thread. The inner
     * `export` keeps its own `withContext(Dispatchers.Main)`, which
     * Transformer's Looper contract requires.
     */
    override suspend fun transcode(
        uri: String,
        capBytes: Long,
        onProgress: (Int) -> Unit,
    ): ProcessedVideo? = withContext(Dispatchers.IO) {
        val probe = probe(uri) ?: return@withContext null
        val output = File(context.cacheDir, "upload-${System.nanoTime()}.mp4")

        val exported = runCatching { export(uri, probe, output, capBytes, onProgress) }
            .getOrElse { failure ->
                CograLog.w(TAG, failure) { "transcode threw before it could export" }
                output.delete()
                return@withContext null
            }
        if (!exported || !output.isFile || output.length() == 0L) {
            CograLog.w(TAG) {
                "transcode produced nothing (exported=$exported, " +
                    "isFile=${output.isFile}, length=${output.length()})"
            }
            output.delete()
            return@withContext null
        }

        // The exported file is measured rather than predicted: the
        // encoder decides the final dimensions, and a scaling effect
        // rounds to what the codec accepts.
        val result = probe(Uri.fromFile(output).toString())
        ProcessedVideo(
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
        capBytes: Long,
        onProgress: (Int) -> Unit,
    ): Boolean = withContext(Dispatchers.Main) {
        suspendCancellableCoroutine { cont ->
            val transformer = Transformer.Builder(context)
                .setVideoMimeType(MimeTypes.VIDEO_H264)
                .setAudioMimeType(MimeTypes.AUDIO_AAC)
                // The rate is stated rather than left to the encoder.
                // Unset, Media3 falls back to the Kush Gauge — about
                // 8.7 Mbps at 1080p30 — which is twice industry
                // standard and turns a six-minute clip into four
                // hundred megabytes.
                .setEncoderFactory(
                    DefaultEncoderFactory.Builder(context)
                        .setRequestedVideoEncoderSettings(
                            VideoEncoderSettings.Builder()
                                .setBitrate(VideoBitrate.forClip(probe.durationMs, capBytes))
                                .build(),
                        )
                        .setRequestedAudioEncoderSettings(
                            AudioEncoderSettings.Builder()
                                .setBitrate(VideoBitrate.AUDIO_BPS)
                                .build(),
                        )
                        .build(),
                )
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
                            // The export's own reason — unsupported
                            // format, encoder init, decode failure, out
                            // of disk. It collapses to `false` here, so
                            // this is the only place it can be kept.
                            CograLog.w(TAG, exception) {
                                "export failed with errorCode ${exception.errorCode}"
                            }
                            if (cont.isActive) cont.resume(false)
                        }
                    },
                )
                .build()

            cont.invokeOnCancellation { transformer.cancel() }

            transformer.start(editedItem(uri, probe, capBytes), output.path)

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
     * The item to export, and — through the effects it does or does not
     * carry — whether the encoder runs at all.
     *
     * **An empty effect list means Transformer transmuxes**: the video
     * track is copied through untouched, no encoder is involved, and no
     * bitrate setting can apply to it. That is exactly right for a clip
     * that is already small and lean, and exactly wrong for one that is
     * not — a phone's own 1080p recording has a short side of 1080, so
     * the scaler never attached and a gigabyte of source came out as a
     * gigabyte of upload.
     *
     * So the question is asked in two parts. Too big on screen? Scale
     * it, which decodes and re-encodes on the way. Right size but
     * carrying far more bits than we intend to send? The encoder still
     * has to run, and only an effect makes it run — so the clip is
     * "scaled" to the size it already is. That changes no pixel
     * dimension; what it changes is which path Transformer takes.
     */
    private fun editedItem(uri: String, probe: Probe, capBytes: Long): EditedMediaItem {
        val target = VideoBitrate.forClip(probe.durationMs, capBytes)
        val effects = when {
            // The short side is the axis to bound: it makes a portrait
            // clip 1080 wide and a landscape one 1080 tall, which is the
            // shape both of the services the ruling names publish at.
            probe.shortSide > MAX_SHORT_SIDE_PX ->
                videoEffect(Presentation.createForShortSide(MAX_SHORT_SIDE_PX))

            // Already the right shape, but fatter than what we are
            // sending. An identity presentation is what puts it through
            // the encoder at the rate we chose.
            probe.richerThan(target) ->
                videoEffect(Presentation.createForShortSide(probe.shortSide))

            // Small enough and lean enough: transmux, and lose nothing.
            else -> Effects.EMPTY
        }
        return EditedMediaItem.Builder(MediaItem.fromUri(uri))
            .setEffects(effects)
            .build()
    }

    private fun videoEffect(presentation: Presentation) = Effects(
        /* audioProcessors = */ emptyList(),
        /* videoEffects = */ listOf(presentation),
    )

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
    private data class Probe(
        val width: Int,
        val height: Int,
        val durationMs: Int,
        /** The container's own average rate, where it states one. */
        val bitrate: Int?,
    ) {
        val shortSide: Int get() = minOf(width, height)

        /**
         * Whether this clip carries more bits than we mean to send.
         *
         * Compared against the whole budget — the video rate plus the
         * audio beside it — because the container's figure covers both.
         *
         * **A clip that will not say is treated as too rich.** The cost
         * of re-encoding something that was already lean is a little
         * quality; the cost of waving through something that was not is
         * the fault this exists to fix.
         */
        fun richerThan(targetVideoBps: Int): Boolean =
            bitrate == null || bitrate > targetVideoBps + VideoBitrate.AUDIO_BPS
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
        // The container's average rate over both tracks — what decides
        // whether this clip needs re-encoding at all.
        val bitrate = reader
            .extractMetadata(MediaMetadataRetriever.METADATA_KEY_BITRATE)
            ?.toIntOrNull()
        if (rotation == 90 || rotation == 270) {
            Probe(height, width, duration, bitrate)
        } else {
            Probe(width, height, duration, bitrate)
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

        const val TAG = "VideoProcessor"
    }
}

package com.cogra.feature.content.edit

import com.cogra.domain.MediaAssetView
import com.cogra.domain.Outcome
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.ProcessedPicture
import com.cogra.domain.media.VideoInfo
import com.cogra.domain.testing.FaithfulMediaRepository
import com.cogra.domain.testing.ThrowingMediaProcessor
import com.cogra.domain.testing.ThrowingVideoProcessor
import com.cogra.domain.testing.fakeUpload
import kotlinx.coroutines.CompletableDeferred
import java.io.IOException

/**
 * The edits' upload leg, scripted: each upload WAITS on its own gate until a
 * test lands or fails it, so the held press can be watched across the moment
 * the last byte lands (EditCompose.md). Uploads land in the order they were
 * sent; each lands as `m-<n>`.
 */
class GatedMedia : FaithfulMediaRepository() {
    private val gates = mutableListOf<CompletableDeferred<Outcome<MediaAssetView>>>()

    /** Every crop the uploads were cut to, in the order they were sent. */
    val crops = mutableListOf<CropSpec>()

    val sent: Int get() = gates.size

    /** When true, an upload answers at once instead of waiting on its gate. */
    var immediate = false

    override suspend fun uploadMedia(picture: ProcessedPicture): Outcome<MediaAssetView> {
        val gate = CompletableDeferred<Outcome<MediaAssetView>>()
        gates += gate
        if (immediate) gate.complete(Outcome.Success(fakeUpload("m-${gates.size}")))
        return gate.await()
    }

    /** The [index]th upload sent lands READY. */
    fun land(index: Int) {
        gates[index].complete(Outcome.Success(fakeUpload("m-${index + 1}")))
    }

    /** The [index]th upload sent never reaches the server. */
    fun fail(index: Int) {
        gates[index].complete(Outcome.Failed(IOException("offline")))
    }
}

/** The picture pipeline: every file reads at [ratio] — `bad…` reads as nothing — and encodes. */
class ScriptedPictures(private val media: GatedMedia? = null) : ThrowingMediaProcessor() {
    var ratio: Float = 1f

    override suspend fun aspectRatio(uri: String): Float? = if (uri.startsWith("bad")) null else ratio

    override suspend fun process(uri: String, crop: CropSpec): ProcessedPicture? {
        media?.crops?.add(crop)
        return ProcessedPicture(ByteArray(4), 100, 100)
    }
}

/** The clip reader: a `video…` uri is a clip, anything else is not one. */
class ScriptedClips : ThrowingVideoProcessor() {
    override suspend fun info(uri: String): VideoInfo? =
        if (uri.startsWith("video")) VideoInfo(durationMs = 12_000, aspectRatio = 9f / 16f) else null
}

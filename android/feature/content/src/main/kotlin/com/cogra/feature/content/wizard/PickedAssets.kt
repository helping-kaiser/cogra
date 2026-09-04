// The picked-asset algebra, once. Three state types carry a
// `List<PickedAsset>` and used to re-implement the same transitions
// over it — byte-identical bodies, differing only in the receiver — so
// the operations live here and each state delegates
// (android/CLAUDE.md "Module discipline").

package com.cogra.feature.content.wizard

import com.cogra.core.designsystem.v2.compose.PickedPicture
import com.cogra.core.designsystem.v2.media.CropFraming
import com.cogra.core.designsystem.v2.media.MediaItem
import com.cogra.domain.Outcome
import com.cogra.domain.media.CropSpec
import com.cogra.domain.media.MediaProcessor
import com.cogra.domain.media.MediaRepository

/** Records one asset's upload state without disturbing the others (D5). */
fun List<PickedAsset>.withUpload(uri: String, upload: AssetUpload): List<PickedAsset> =
    map { if (it.uri == uri) it.copy(upload = upload) else it }

/** Records an asset's own ratio once the pipeline has read it. */
fun List<PickedAsset>.withSourceRatio(uri: String, ratio: Float): List<PickedAsset> =
    map { if (it.uri == uri) it.copy(sourceRatio = ratio) else it }

/** The alt text one asset carries — authored, never generated (D20). */
fun List<PickedAsset>.withAltText(uri: String, text: String): List<PickedAsset> =
    map { if (it.uri == uri) it.copy(altText = text) else it }

/**
 * The picks as the components see them.
 *
 * [framingOf] is the one place the surfaces genuinely differ: the post
 * wizard has a crop stage and hands back the author's window, while the
 * comment surfaces show whole frames and hand back nothing.
 */
fun List<PickedAsset>.pickedPictures(
    framingOf: (PickedAsset) -> CropFraming = { CropFraming.Whole },
): List<PickedPicture> = map { asset ->
    PickedPicture(
        item = MediaItem(
            asset.uri,
            asset.sourceRatio ?: 1f,
            asset.altText.ifBlank { null },
            framingOf(asset),
        ),
        described = asset.altText.isNotBlank(),
        uploading = asset.upload.inFlight,
        failed = asset.upload is AssetUpload.Failed,
    )
}

/**
 * One picked picture's journey — process, then upload — as the upload
 * state to record when it ends.
 *
 * The three composers ran identical copies of this: process, refuse
 * what does not decode (the client half of the decode gate, D11), then
 * the same three-branch `when` over the outcome. Only the copy for a
 * refusal differed, so that is the parameter.
 */
internal suspend fun uploadPicture(
    uri: String,
    crop: CropSpec,
    processor: MediaProcessor,
    media: MediaRepository,
    unreadable: UploadFailure = UploadFailure.UNREADABLE_PICTURE,
    refused: UploadFailure = UploadFailure.REFUSED_PICTURE,
): AssetUpload {
    val picture = processor.process(uri, crop)
        ?: return AssetUpload.Failed(unreadable)
    return when (val outcome = media.uploadMedia(picture)) {
        is Outcome.Success -> AssetUpload.Done(outcome.value.id)
        is Outcome.Refused -> AssetUpload.Failed(refused, outcome.errors.firstOrNull()?.message)
        is Outcome.Failed -> AssetUpload.Failed(UploadFailure.TRANSPORT)
    }
}

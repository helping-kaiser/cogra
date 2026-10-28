// Where an upload failure becomes words. The mapping lives at the
// composable boundary rather than in the state, so no resource id rides
// the ViewModel and the copy stays where every other line of it lives.

package com.cogra.feature.content.wizard

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.cogra.feature.content.R

/**
 * The line to show for a failed upload.
 *
 * The server's own words win where it gave any: a refusal that names
 * the file is more use than our own general sentence.
 */
@Composable
fun AssetUpload.Failed.text(): String = serverMessage ?: reason.text()

/**
 * The describe sheet's refusal past its 1,000 characters (copy-voice, the caps
 * refusals): `A picture's description…`, or `A video's…` on its other shape.
 */
@Composable
fun describeTooLong(video: Boolean): String = stringResource(
    if (video) R.string.content_error_alt_text_too_long_video else R.string.content_error_alt_text_too_long_picture,
)

/** The line for a reason on its own — a refused pick has no upload. */
@Composable
fun UploadFailure.text(): String = stringResource(label())

/** The faults: what did not decode, what the server refused, what never arrived. */
private fun UploadFailure.label(): Int = when (this) {
    UploadFailure.UNREADABLE_PICTURE -> R.string.content_upload_unreadable_picture
    UploadFailure.UNREADABLE_VIDEO -> R.string.content_upload_unreadable_video
    UploadFailure.UNREADABLE_FILE -> R.string.content_upload_unreadable_file
    UploadFailure.UNREADABLE_COVER -> R.string.content_upload_unreadable_cover
    UploadFailure.REFUSED_PICTURE -> R.string.content_upload_refused_picture
    UploadFailure.REFUSED_VIDEO -> R.string.content_upload_refused_video
    UploadFailure.REFUSED_COVER -> R.string.content_upload_refused_cover
    UploadFailure.TRANSPORT -> R.string.content_upload_transport
    else -> limitLabel()
}

/** The refusals that name a cap or the body's grammar (copy-voice, *Refused files*). */
private fun UploadFailure.limitLabel(): Int = when (this) {
    UploadFailure.PICTURE_TOO_BIG -> R.string.content_upload_picture_too_big
    UploadFailure.POST_VIDEO_TOO_BIG -> R.string.content_upload_post_video_too_big
    UploadFailure.COMMENT_VIDEO_TOO_BIG -> R.string.content_upload_comment_video_too_big
    UploadFailure.POST_PICTURE_COUNT -> R.string.content_upload_post_picture_count
    UploadFailure.POST_MIXED_BODY -> R.string.content_upload_post_mixed_body
    UploadFailure.COMMENT_PICTURE_COUNT -> R.string.content_upload_comment_picture_count
    UploadFailure.VIDEO_AT_EDIT -> R.string.content_upload_video_at_edit
    else -> error("$this is a fault, worded by label()")
}

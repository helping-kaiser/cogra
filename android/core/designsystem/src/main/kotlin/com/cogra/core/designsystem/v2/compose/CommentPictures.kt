package com.cogra.core.designsystem.v2.compose

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.media.MediaThumb
import com.cogra.core.designsystem.v2.token.Space

/**
 * The tray a comment's pictures ride in, on the reply composer
 * (`ReplyPictures`) and on `CommentEdit` alike.
 *
 * **Comment pictures never crop** (jakob 2026-08-31), which is what
 * makes this its own tray rather than the post wizard's: every tile
 * shows the whole frame at the picture's own ratio inside a fixed
 * height, so the row is ragged by design. The post tray's square tiles
 * would re-crop frames nobody shaped.
 *
 * The remove × rides the tile, because a comment's tray is small enough
 * that the picture and its way out are the same target — where the post
 * wizard sends removal to the per-picture sheet, a comment has at most
 * four and no order to manage.
 */
@Composable
fun CommentPictureTray(
    pictures: List<PickedPicture>,
    onRemove: (Int) -> Unit,
    modifier: Modifier = Modifier,
    thumbHeight: Dp = CommentThumbHeight,
    testTag: String? = null,
) {
    Row(
        modifier = modifier.then(if (testTag != null) Modifier.testTag(testTag) else Modifier),
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
        verticalAlignment = Alignment.Top,
    ) {
        pictures.forEachIndexed { index, picture ->
            RemovableThumb(
                picture = picture,
                onRemove = { onRemove(index) },
                thumbHeight = thumbHeight,
                label = "picture ${index + 1}",
                testTag = testTag?.let { "${it}_$index" },
            )
        }
    }
}

/**
 * One whole frame with its way out on it.
 *
 * A failed tile keeps its × — removing it is the author's other answer
 * to a refusal, beside the retry the error line offers.
 */
@Composable
fun RemovableThumb(
    picture: PickedPicture,
    onRemove: () -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    thumbHeight: Dp = CommentThumbHeight,
    testTag: String? = null,
) {
    Box(modifier = modifier) {
        MediaThumb(
            item = picture.item,
            size = null,
            // The frame's own ratio decides the width; the height is the
            // row's. This is what "whole, never cropped" looks like in a
            // row that still has to line up.
            width = thumbHeight * picture.item.aspectRatio.coerceIn(MIN_RATIO, MAX_RATIO),
            height = thumbHeight,
            fit = ContentScale.Fit,
            uploading = picture.uploading,
            progress = picture.progress,
            badge = picture.badge(cover = false),
            contentDescription = null,
            testTag = testTag,
        )
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .minimumInteractiveComponentSize()
                .clickable(role = Role.Button, onClickLabel = "Remove $label", onClick = onRemove)
                .then(if (testTag != null) Modifier.testTag("${testTag}_remove") else Modifier),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Filled.Close,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier
                    .size(RemoveTarget)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surface)
                    .padding(2.dp),
            )
        }
    }
}

/** The tray's band on `ReplyPictures`, read off the board's tiles. */
val CommentThumbHeight = 88.dp

/** The smaller band `CommentEdit` draws its single tile at. */
val CommentEditThumbHeight = 56.dp

private val RemoveTarget = 20.dp

/**
 * A frame far outside these stays inside them: a panorama would
 * otherwise take the whole row and a very tall frame would vanish.
 */
private const val MIN_RATIO = 0.5f
private const val MAX_RATIO = 2.0f

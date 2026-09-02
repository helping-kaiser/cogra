package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Image
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.ThemePreviews

/**
 * Which cover the author settled on, as the row draws it.
 *
 * The row deals in *models* rather than in domain types so it can live
 * here: a frame is whatever Coil can draw, and the caller decides what
 * that is.
 */
sealed interface CoverPick {
    data class Frame(val index: Int) : CoverPick

    data object OwnPicture : CoverPick
}

/**
 * "Cover" — a strip of frames lifted from the clip, plus one dashed tile
 * that opens the device's own picker.
 *
 * One component at two scales. `ComposeCover` draws it as a stage of its
 * own at 76dp with the dashed tile captioned; `ReplyVideo` inlines it at
 * 56dp with the icon alone, because the comment composer is one screen
 * and the face is picked there rather than in a stage. The canvas keeps
 * the two boards separate — the frame strip is one picture framed three
 * ways, which no canvas component draws — but in Compose it is the same
 * row, and duplicating it would be two things to keep in step.
 *
 * @param frames what to draw in each frame tile, in offer order.
 * @param picked which tile wears the selection ring.
 * @param ownPicture the author's chosen cover, drawn in place of the
 *   dashed tile once there is one.
 * @param tileSize the strip's scale.
 * @param labelOwnPicture whether the dashed tile carries its caption —
 *   there is no room for it at comment scale.
 */
@Composable
fun CoverRow(
    frames: List<Any?>,
    picked: CoverPick,
    onPickFrame: (Int) -> Unit,
    onPickOwnPicture: () -> Unit,
    modifier: Modifier = Modifier,
    ownPicture: Any? = null,
    tileSize: Dp = CoverRowDefaults.TileSize,
    labelOwnPicture: Boolean = true,
    testTagPrefix: String? = null,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(Space.x2)) {
        Text(
            text = "Cover",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Space.x2)) {
            frames.forEachIndexed { index, frame ->
                val chosen = picked == CoverPick.Frame(index)
                MediaThumb(
                    item = MediaItem(frame, 1f),
                    size = tileSize,
                    selected = chosen,
                    dimmed = !chosen,
                    onClick = { onPickFrame(index) },
                    contentDescription = "Frame ${index + 1}",
                    testTag = testTagPrefix?.let { "${it}_frame_$index" },
                )
            }
            OwnPictureTile(
                chosen = picked == CoverPick.OwnPicture,
                model = ownPicture,
                onClick = onPickOwnPicture,
                tileSize = tileSize,
                labelled = labelOwnPicture,
                testTag = testTagPrefix?.let { "${it}_picture" },
            )
        }
        Text(
            text = "A frame, or a picture of your own.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.then(
                testTagPrefix?.let { Modifier.testTag("${it}_note") } ?: Modifier,
            ),
        )
    }
}

/**
 * The dashed tile that hands the choice to the device's own picker.
 *
 * Once a picture has been chosen it draws that picture, so the row shows
 * what was picked rather than making the author remember — but it keeps
 * the same slot and the same tap.
 */
@Composable
private fun OwnPictureTile(
    chosen: Boolean,
    model: Any?,
    onClick: () -> Unit,
    tileSize: Dp,
    labelled: Boolean,
    testTag: String?,
) {
    if (model != null) {
        MediaThumb(
            item = MediaItem(model, 1f),
            size = tileSize,
            selected = chosen,
            dimmed = !chosen,
            onClick = onClick,
            contentDescription = "Your own cover picture",
            testTag = testTag,
        )
        return
    }
    Column(
        modifier = Modifier
            .size(tileSize)
            .clip(RoundedCornerShape(Space.x2))
            .border(
                width = 1.dp,
                color = MaterialTheme.colorScheme.outline,
                shape = RoundedCornerShape(Space.x2),
            )
            .clickable(role = Role.Button, onClick = onClick)
            .semantics { contentDescription = "A cover picture of your own" }
            .then(testTag?.let { Modifier.testTag(it) } ?: Modifier),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            imageVector = Icons.Filled.Image,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(CoverRowDefaults.GlyphSize),
        )
        if (labelled) {
            Text(
                text = "A picture",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

object CoverRowDefaults {
    /** `ComposeCover`'s own stage scale. */
    val TileSize = 76.dp

    /** `ReplyVideo`'s inline scale — the comment composer is one screen. */
    val CommentTileSize = 56.dp

    val GlyphSize = 20.dp
}

@ThemePreviews
@Composable
private fun CoverRowPreview() {
    Cogra2PreviewTheme {
        CoverRow(
            frames = listOf(null, null, null),
            picked = CoverPick.Frame(0),
            onPickFrame = {},
            onPickOwnPicture = {},
        )
    }
}

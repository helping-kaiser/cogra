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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.R
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
    /**
     * No face yet — the row's opening state, and the one it keeps until
     * a tile is tapped. Every tile draws unchosen; none wears the ring.
     */
    data object None : CoverPick

    data class Frame(val index: Int) : CoverPick

    data object OwnPicture : CoverPick
}

/**
 * "Cover" — a strip of frames lifted from the clip, plus one dashed tile
 * that opens the device's own picker.
 *
 * One component, one drawing. `ComposeCover` gives it a stage and
 * `ReplyVideo` inlines it in the composer, but both boards draw the same
 * five 56dp tiles at an 8dp gap with the glyph alone in the dashed one —
 * so there is nothing here that differs by scale.
 *
 * NOTHING HERE CHOOSES. The strip renders the offers it is handed and
 * reports taps; a [picked] of anything but a tap is the caller's own
 * doing, and a cover the author never picked is one nobody signed.
 *
 * @param frames what to draw in each frame tile, in offer order.
 * @param picked which tile wears the selection ring.
 * @param ownPicture the author's chosen cover, drawn in place of the
 *   dashed tile once there is one.
 * @param tileSize the strip's scale.
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
                    contentDescription = stringResource(R.string.designsystem_cover_frame, index + 1),
                    testTag = testTagPrefix?.let { "${it}_frame_$index" },
                )
            }
            OwnPictureTile(
                chosen = picked == CoverPick.OwnPicture,
                model = ownPicture,
                onClick = onPickOwnPicture,
                tileSize = tileSize,
                testTag = testTagPrefix?.let { "${it}_picture" },
            )
        }
        Text(
            // NO FRAMES IS A STATE THE ROW HOLDS (video-cover round,
            // 2026-09-10): extraction is a thing a device can fail at, and
            // an empty `frames` here means it already has — not that
            // capture is still running, which the caller holds off drawing
            // this row for at all. The terminal answer says why the choice
            // is smaller than it was rather than leaving four empty tiles
            // to offer pictures that do not exist.
            text = if (frames.isEmpty()) {
                "This clip gave no frames — choose a picture of your own, or leave it without one."
            } else {
                "A frame, or a picture of your own."
            },
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
    testTag: String?,
) {
    if (model != null) {
        MediaThumb(
            item = MediaItem(model, 1f),
            size = tileSize,
            selected = chosen,
            dimmed = !chosen,
            onClick = onClick,
            contentDescription = stringResource(R.string.designsystem_cover_own),
            testTag = testTag,
        )
        return
    }
    // Hoisted: `semantics {}` is not a composable scope, so the label is
    // read before the modifier chain rather than inside it.
    val label = stringResource(R.string.designsystem_cover_own_action)
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
            .semantics { contentDescription = label }
            .then(testTag?.let { Modifier.testTag(it) } ?: Modifier),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // THE GLYPH ALONE, on both boards: `cg-cover-own` holds a 20px
        // picture icon and nothing else. The caption it used to wear is
        // what pushed the tile past the drawn 56dp in the first place.
        Icon(
            imageVector = Icons.Filled.Image,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(CoverRowDefaults.GlyphSize),
        )
    }
}

object CoverRowDefaults {
    /**
     * ONE SCALE, BOTH SURFACES. `ComposeCover` and `ReplyVideo` draw the
     * identical 56dp tile at an 8dp gap — five of them are 312dp, inside
     * the 342dp the stage gives the strip. At 76dp the row measured
     * 412dp and the `Row` clipped the picture tile to a sliver.
     */
    val TileSize = 56.dp

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

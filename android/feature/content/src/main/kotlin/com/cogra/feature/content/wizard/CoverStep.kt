package com.cogra.feature.content.wizard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.v2.media.CoverPick
import com.cogra.core.designsystem.v2.media.CoverRow
import com.cogra.core.designsystem.v2.token.MediaOverlay
import com.cogra.core.designsystem.v2.token.Space

/**
 * `ComposeCover` — the video's face.
 *
 * The board offers a preview of the clip, a row of frames lifted out of
 * it, and one dashed tile that opens the device's own picker. Whichever
 * the author settles on is uploaded as its own still and named on the
 * clip's upload, because an asset row is immutable once written.
 *
 * There is no crop here and no board that draws one: a video is not
 * cropped, and the cover is framed to the clip's own shape by the
 * pipeline rather than by the author.
 */
@Composable
internal fun CoverStepBody(
    state: ComposeWizardState,
    onPickFrame: (Int) -> Unit,
    onPickPicture: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val clip = state.video ?: return
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Space.x4),
    ) {
        CoverPreview(
            model = state.coverModel(),
            durationMs = clip.durationMs ?: 0,
        )

        CoverRow(
            // The frame's own bytes: it has been processed already, so
            // the tile draws exactly what would be uploaded rather than
            // a preview of it.
            frames = state.coverFrames.map { it.picture.bytes },
            picked = state.coverChoice.toPick(),
            onPickFrame = onPickFrame,
            onPickOwnPicture = onPickPicture,
            ownPicture = (state.coverChoice as? CoverChoice.Picture)?.uri,
            testTagPrefix = "wizard_cover",
        )
    }
}

/**
 * The clip as it will be met: the chosen face, a play glyph, and the
 * running time.
 *
 * It is a still rather than a player. The board draws a play affordance
 * over a poster, and the stage's question is which frame stands in for
 * the clip — not how the clip plays, which the feed answers.
 */
@Composable
private fun CoverPreview(model: Any?, durationMs: Int) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(COVER_PREVIEW_HEIGHT)
            .clip(RoundedCornerShape(Space.x3))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .testTag("wizard_cover_preview"),
    ) {
        AsyncImage(
            model = model,
            // The preview is decorative here: the stage's own heading
            // names it, and the words that describe the post are
            // authored on the details stage.
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxWidth().height(COVER_PREVIEW_HEIGHT),
        )
        Box(
            modifier = Modifier
                .align(Alignment.Center)
                .size(PLAY_DIAMETER)
                .clip(RoundedCornerShape(PLAY_DIAMETER / 2))
                .background(MediaOverlay.Badge),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Filled.PlayArrow,
                contentDescription = null,
                tint = MediaOverlay.BadgeInk,
                modifier = Modifier.size(PLAY_GLYPH),
            )
        }
        DurationBadge(
            label = formatDuration(durationMs),
            modifier = Modifier.align(Alignment.BottomEnd).padding(Space.x2),
        )
    }
}

@Composable
private fun DurationBadge(label: String, modifier: Modifier = Modifier) {
    Text(
        text = label,
        style = MaterialTheme.typography.labelSmall,
        color = MediaOverlay.BadgeInk,
        modifier = modifier
            .clip(RoundedCornerShape(Space.x1))
            .background(MediaOverlay.Badge)
            .padding(horizontal = Space.x2, vertical = 1.dp)
            .semantics { contentDescription = "Length $label" }
            .testTag("wizard_cover_duration"),
    )
}


/** What the preview draws: the chosen frame's bytes, or the chosen picture. */
private fun ComposeWizardState.coverModel(): Any? = when (val choice = coverChoice) {
    is CoverChoice.Frame -> coverFrames.getOrNull(choice.index)?.picture?.bytes
    is CoverChoice.Picture -> choice.uri
}

/**
 * The wizard's own answer, as the shared row reads it.
 *
 * [CoverChoice] carries the picked picture's URI because the composer
 * has to upload it; the row only has to draw it, so the two shapes stay
 * separate and this is the seam between them.
 */
internal fun CoverChoice.toPick(): CoverPick = when (this) {
    is CoverChoice.Frame -> CoverPick.Frame(index)
    is CoverChoice.Picture -> CoverPick.OwnPicture
}

/**
 * Minutes and seconds, the way the boards write it ("0:42").
 *
 * An hour-long clip grows an hours field rather than reading as a
 * three-digit minute count: there is no duration cap (rulings
 * 2026-09-02), so long clips are a case rather than an impossibility.
 */
internal fun formatDuration(ms: Int): String {
    val total = (ms / 1000).coerceAtLeast(0)
    val hours = total / 3600
    val minutes = (total % 3600) / 60
    val seconds = total % 60
    return if (hours > 0) {
        "$hours:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}"
    } else {
        "$minutes:${seconds.toString().padStart(2, '0')}"
    }
}

private val COVER_PREVIEW_HEIGHT = 342.dp
private val PLAY_DIAMETER = 56.dp
private val PLAY_GLYPH = 32.dp

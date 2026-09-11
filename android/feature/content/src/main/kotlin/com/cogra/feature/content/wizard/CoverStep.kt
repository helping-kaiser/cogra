package com.cogra.feature.content.wizard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.v2.media.CoverPick
import com.cogra.core.designsystem.v2.media.CoverRow
import com.cogra.core.designsystem.v2.media.cappedToTallestTile
import com.cogra.core.designsystem.v2.token.MediaOverlay
import com.cogra.core.designsystem.v2.token.MediaShape
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.feature.content.R

/**
 * `ComposeCover` — the video's face.
 *
 * The board offers a preview of the clip, a row of frames lifted out of
 * it, and one dashed tile that opens the device's own picker. Whichever
 * the author settles on is uploaded as its own still and named on the
 * clip's upload, because an asset row is immutable once written.
 *
 * A frame needs no crop: it was cut from the clip and already carries
 * the clip's shape. Only a cover picked from the gallery can disagree
 * with the video's shape.
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
            ratio = coverPreviewRatio(clip.sourceRatio),
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
 * The clip as it will be met: the chosen face **in the clip's own
 * frame**, a play glyph, and the running time.
 *
 * It is a still rather than a player. The board draws a play affordance
 * over a poster, and the stage's question is which frame stands in for
 * the clip — not how the clip plays, which the feed answers.
 *
 * [ratio] is that frame, and it is the whole point of the preview: an
 * author picking a face is being shown the format the post will have,
 * so a wide clip reads wide here and a vertical one reads 4:5. The
 * board's 342×342 is one square specimen drawn at the stage's width,
 * not a shape imposed on every clip.
 */
@Composable
private fun CoverPreview(model: Any?, durationMs: Int, ratio: Float) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(ratio)
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
            // Filled, never fitted: the reel round rules letterboxing
            // out of the product, and the cover "shares the clip's
            // ratio and crops identically".
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
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
    // Hoisted: `semantics {}` is not a composable scope.
    val spoken = stringResource(R.string.content_clip_length, label)
    Text(
        text = label,
        style = MaterialTheme.typography.labelSmall,
        color = MediaOverlay.BadgeInk,
        modifier = modifier
            .clip(RoundedCornerShape(Space.x1))
            .background(MediaOverlay.Badge)
            .padding(horizontal = Space.x2, vertical = 1.dp)
            .semantics { contentDescription = spoken }
            .testTag("wizard_cover_duration"),
    )
}


/**
 * The frame the clip will be met in, from the clip's own shape.
 *
 * A clip's ratio is not a crop an author chose, so the crop vocabulary
 * never governs it (design/readme.md, the reel round): **16:9 and 1:1
 * display true, and anything taller than 4:5 centre-crops to 4:5** —
 * which is exactly [cappedToTallestTile], the rule every tile in the
 * product already obeys. The preview draws that same frame, so what the
 * author settles a face on is the format the post will have.
 *
 * Square where the clip has not said yet: the ratio is read off the
 * header a beat after the pick, and a preview has to measure now. A
 * ratio that is zero, negative or not a number would make
 * `Modifier.aspectRatio` throw, so it is treated as not said either.
 */
internal fun coverPreviewRatio(sourceRatio: Float?): Float =
    (sourceRatio?.takeIf { it.isFinite() && it > 0f } ?: MediaShape.Square.ratio)
        .cappedToTallestTile()

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

private val PLAY_DIAMETER = 56.dp
private val PLAY_GLYPH = 32.dp

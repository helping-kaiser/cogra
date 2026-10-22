package com.cogra.feature.content.wizard

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.v2.atom.InlineAction
import com.cogra.core.designsystem.v2.atom.InlineSize
import com.cogra.core.designsystem.v2.media.CoverPick
import com.cogra.core.designsystem.v2.media.CoverRow
import com.cogra.core.designsystem.v2.media.VideoControls
import com.cogra.core.designsystem.v2.media.VideoPlayer
import com.cogra.core.designsystem.v2.media.cappedToTallestTile
import com.cogra.core.designsystem.v2.token.MediaShape
import com.cogra.core.designsystem.v2.token.Space
import com.cogra.core.designsystem.v2.token.TypeTokens
import com.cogra.feature.content.R

/**
 * `ComposeCover` — the video's face.
 *
 * The board offers a preview of the clip, a row of frames lifted out of
 * it, and one dashed tile that opens the device's own picker. Whichever
 * the author settles on is uploaded as its own standalone still, and the
 * clip's placement names it at prepare — which is what lets an edit put
 * a different face on a clip whose bytes never move.
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
    // THE PLAY TAP IS ONE-WAY (`ComposeCoverPlaying.md`): once the preview
    // runs, the cover never comes back — a frame tapped while it plays is
    // chosen, and the strip stands as it did.
    var playing by rememberSaveable(clip.uri) { mutableStateOf(false) }
    val ratio = coverPreviewRatio(clip.sourceRatio)
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Space.x4),
    ) {
        if (playing) {
            CoverPlaying(clip = clip, poster = state.coverModel() ?: clip.uri, ratio = ratio)
        } else {
            CoverPreview(
                // Nothing chosen is the clip's own frame 0 (the board's
                // `src` on the unchosen `ComposeCover`), which Coil's video
                // decoder cuts from the picked file.
                model = state.coverModel() ?: clip.uri.takeUnless { state.noFrames },
                durationMs = clip.durationMs ?: 0,
                ratio = ratio,
                noFrames = state.noFrames && state.coverModel() == null,
                onPlay = { playing = true },
            )
        }

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
            framesRead = state.coverFramesRead,
        )
    }
}

/** The device cut no frame from the clip (`ComposeCoverNoFrames`): extraction answered, empty. */
private val ComposeWizardState.noFrames: Boolean get() = coverFramesRead && coverFrames.isEmpty()

/**
 * `ComposeCoverPlaying`: the post detail's transport over the running clip —
 * play and pause between the two skips, elapsed · timeline · total and the
 * sound on the bar — and NO fullscreen toggle, because the clip is not a
 * post yet and there is nowhere for that control to go (`onOpenViewer`
 * null). The sound is the one sticky decision every video shares.
 */
@Composable
private fun CoverPlaying(clip: PickedAsset, poster: Any?, ratio: Float) {
    VideoPlayer(
        url = clip.uri,
        posterUrl = poster,
        autoplay = true,
        controls = VideoControls.Full,
        durationMs = clip.durationMs,
        videoAspectRatio = ratio,
        contentScale = ContentScale.Crop,
        contentDescription = stringResource(R.string.content_tray_video),
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(ratio)
            .clip(MaterialTheme.shapes.medium),
        testTag = "wizard_cover_player",
    )
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
 *
 * `ComposeCover.jsx`: "THE PREVIEW IS `MediaThumb`'s VIDEO STATE at post
 * scale — the play disc on its scrim and the duration on the trailing
 * corner are that component's anatomy" — so both badges here read the same
 * `inverseSurface`/`inverseOnSurface` plate `MediaThumb` reads, per jakob's
 * F8 ruling (2026-09-17).
 */
@Composable
private fun CoverPreview(model: Any?, durationMs: Int, ratio: Float, noFrames: Boolean, onPlay: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(ratio)
            .clip(MaterialTheme.shapes.medium)
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
        if (noFrames) {
            // THE NEUTRAL TILE (`ComposeCoverNoFrames`, `MediaThumb` `label`):
            // with no frame there is no still, and a play control drawn on
            // an empty tile is chrome — the word says what belongs there.
            Text(
                text = "No frame",
                style = MaterialTheme.typography.labelSmall.copy(fontWeight = TypeTokens.QuietLabelWeight),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(horizontal = Space.x2)
                    .testTag("wizard_cover_no_frame"),
            )
        } else {
            // The play disc (`MediaThumb` video state at post scale: 26% of
            // the short edge, clamped to 56) — and the preview's play, which
            // gives the cover over to the running clip.
            Box(
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(PLAY_DIAMETER)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.inverseSurface)
                    .clickable(role = Role.Button, onClick = onPlay)
                    .semantics { contentDescription = "Play" }
                    .testTag("wizard_cover_play_disc"),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Filled.PlayArrow,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.inverseOnSurface,
                    modifier = Modifier.size(PLAY_GLYPH),
                )
            }
        }
        DurationBadge(
            label = formatDuration(durationMs),
            modifier = Modifier.align(Alignment.BottomEnd).padding(PILL_INSET),
        )
    }
}

/** `MediaThumb`'s corner pill: 6px in, `0 6px`, the small (8dp) radius, the snackbar pair. */
@Composable
private fun DurationBadge(label: String, modifier: Modifier = Modifier) {
    // Hoisted: `semantics {}` is not a composable scope.
    val spoken = stringResource(R.string.content_clip_length, label)
    Text(
        text = label,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.inverseOnSurface,
        modifier = modifier
            .clip(MaterialTheme.shapes.small)
            .background(MaterialTheme.colorScheme.inverseSurface)
            .semantics { contentDescription = spoken }
            .testTag("wizard_cover_duration")
            .padding(horizontal = PILL_INSET),
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

/**
 * The chosen face's bytes, the chosen picture, or null for no cover —
 * what the stage's preview draws, and what the details field reads to
 * know whether it is a door or a face.
 *
 * The skipped step's first frame is null here too: it is a still the
 * clip is stored with, not a face anyone chose, so the details field
 * stays a door over it (`ComposeDetailsVideo`).
 */
internal fun ComposeWizardState.coverModel(): Any? = when (val choice = coverChoice) {
    CoverChoice.None, CoverChoice.FirstFrame, CoverChoice.NoStill -> null
    is CoverChoice.Frame -> coverFrames.getOrNull(choice.index)?.picture?.bytes
    is CoverChoice.Picture -> choice.uri
}

/**
 * The cover field's empty state — "Add a cover" and the line under it —
 * wherever a vertical clip stands without a chosen face: the details
 * stage (`ComposeDetailsVideo`) and the reply composer
 * (`ReplyVideoFailed`, which draws it at comment scale). A field's empty
 * state, never a second entrance: for a vertical clip it is the only
 * way to a face (design/readme.md §13, "The door is a field's empty
 * state").
 */
@Composable
internal fun CoverDoor(onOpen: () -> Unit, testTag: String) {
    // The boards' own section rhythm, off the 4dp grid like the columns
    // that hold it.
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(
            text = "Cover",
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurface,
        )
        // `ComposeDetailsVideo`: `InlineAction` at its `sm` rung.
        InlineAction(
            text = "Add a cover",
            onClick = onOpen,
            size = InlineSize.Small,
            testTag = testTag,
        )
        Text(
            text = "It plays the moment it is on screen, so it starts on its own first frame.",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/**
 * The wizard's own answer, as the shared row reads it.
 *
 * [CoverChoice] carries the picked picture's URI because the composer
 * has to upload it; the row only has to draw it, so the two shapes stay
 * separate and this is the seam between them.
 *
 * NOTHING CHOSEN IS ITS OWN ANSWER, and the row has a shape for it.
 * [CoverChoice.None] is what an author has for as long as they have not
 * tapped a tile — with every offer on screen — so mapping it onto the
 * first frame would ring a face nobody picked and make the screen lie
 * about what the post is going to carry.
 */
internal fun CoverChoice.toPick(): CoverPick = when (this) {
    // The first frame was never picked, so no tile rings for it.
    CoverChoice.None, CoverChoice.FirstFrame, CoverChoice.NoStill -> CoverPick.None
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
private val PILL_INSET = 6.dp

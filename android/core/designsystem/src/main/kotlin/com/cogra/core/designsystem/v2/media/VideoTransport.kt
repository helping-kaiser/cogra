package com.cogra.core.designsystem.v2.media

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.FastForward
import androidx.compose.material.icons.filled.FastRewind
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.R
import com.cogra.core.designsystem.v2.token.MediaOverlay
import com.cogra.core.designsystem.v2.token.Space

/**
 * The control ladder's second rung, laid over the clip it controls
 * (`design/components/media/VideoControls.jsx`).
 *
 * **The anatomy is the platform player's, not ours.** A big centred play/pause
 * flanked by the skips, and a bar along the bottom carrying elapsed, the
 * timeline, the total and the sound — "a transport is the one place in this
 * product where inventing a layout costs the reader something" (`:15-29`).
 *
 * **Nothing touches the bottom edge.** The system gesture zone lives in the
 * last strip of the screen, so a control there is not a control but a swipe
 * that closes the app; the bar is inset by [GESTURE_ZONE] (`:24-27`).
 *
 * **The timeline is a slider, not a progress bar** — "it reports where the clip
 * is and it is how the reader moves it" (`:89-91`) — so it is Material's
 * `Slider`, restyled to the drawn 3dp track and 12dp knob rather than redrawn:
 * the slider role, the drag, the tap anywhere along it and the accessibility
 * actions all come with it
 * (developer.android.com/develop/ui/compose/components/slider).
 *
 * **The sound rides the bar** rather than keeping its disc, because a disc
 * beside a bar is two pieces of chrome for one clip.
 *
 * It takes state and callbacks rather than a `Player`, which is what lets the
 * fullscreen viewer — the ladder's other full-transport surface — wear the same
 * component, and what lets this be tested without a decoder.
 *
 * @param progress where the clip is, 0..1.
 * @param onSeek where the reader put it, 0..1.
 * @param onSkip a step, in milliseconds, signed.
 */
@Composable
fun VideoTransport(
    playing: Boolean,
    elapsedMs: Long,
    durationMs: Long,
    progress: Float,
    muted: Boolean,
    onTogglePlay: () -> Unit,
    onSeek: (Float) -> Unit,
    onSkip: (Long) -> Unit,
    onToggleMute: () -> Unit,
    /**
     * The way into the fullscreen viewer (`VideoControls.jsx:231-233`).
     *
     * Drawn only where it is handed one, which is the master's own condition
     * (`{fullscreen && …}`): THE VIEWER DOES NOT DRAW IT, because "no
     * fullscreen toggle — this IS the fullscreen" (`MediaViewer.jsx:153`).
     */
    onFullscreen: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Box(modifier = modifier.fillMaxSize().testTag(TRANSPORT_TAG)) {
        // The wash is a gradient rather than a bar, so nothing cuts the frame.
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .fillMaxHeight(WASH_FRACTION)
                .background(
                    Brush.verticalGradient(
                        listOf(Color.Transparent, MediaOverlay.TransportWash),
                    ),
                ),
        )
        CentreCluster(
            playing = playing,
            onTogglePlay = onTogglePlay,
            onSkip = onSkip,
            modifier = Modifier.align(Alignment.Center),
        )
        Bar(
            elapsedMs = elapsedMs,
            durationMs = durationMs,
            progress = progress,
            muted = muted,
            onSeek = onSeek,
            onToggleMute = onToggleMute,
            onFullscreen = onFullscreen,
            modifier = Modifier.align(Alignment.BottomCenter),
        )
    }
}

/**
 * The big centred play/pause, flanked by the skips.
 *
 * Centred, "because the thumb that reaches for it is not aiming at a corner,
 * and it is the control the reader wants most often" (`VideoControls.jsx:19`).
 */
@Composable
private fun CentreCluster(
    playing: Boolean,
    onTogglePlay: () -> Unit,
    onSkip: (Long) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(Space.x6),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TransportButton(
            label = stringResource(R.string.designsystem_video_rewind),
            glyph = Icons.Filled.FastRewind,
            box = SKIP_DIAMETER,
            glyphSize = SKIP_GLYPH,
            onClick = { onSkip(-VideoStage.SKIP_MS) },
            testTag = "video_rewind",
        )
        TransportButton(
            label = stringResource(
                if (playing) R.string.designsystem_video_pause else R.string.designsystem_video_play,
            ),
            glyph = if (playing) Icons.Filled.Pause else Icons.Filled.PlayArrow,
            box = PLAY_DIAMETER,
            glyphSize = PLAY_GLYPH,
            plate = MediaOverlay.TransportPlate,
            onClick = onTogglePlay,
            testTag = "video_play_pause",
        )
        TransportButton(
            label = stringResource(R.string.designsystem_video_forward),
            glyph = Icons.Filled.FastForward,
            box = SKIP_DIAMETER,
            glyphSize = SKIP_GLYPH,
            onClick = { onSkip(VideoStage.SKIP_MS) },
            testTag = "video_forward",
        )
    }
}

/** Elapsed · the timeline · total · the sound, held clear of the gesture zone. */
@Composable
private fun Bar(
    elapsedMs: Long,
    durationMs: Long,
    progress: Float,
    muted: Boolean,
    onSeek: (Float) -> Unit,
    onToggleMute: () -> Unit,
    onFullscreen: (() -> Unit)?,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = Space.x3)
            .padding(bottom = GESTURE_ZONE),
        horizontalArrangement = Arrangement.spacedBy(Space.x2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = formatRunningTime(elapsedMs.toInt()),
            style = MaterialTheme.typography.labelSmall,
            color = MediaOverlay.BadgeInk,
            modifier = Modifier.testTag("video_elapsed"),
        )
        Timeline(
            progress = progress,
            onSeek = onSeek,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = formatRunningTime(durationMs.toInt()),
            style = MaterialTheme.typography.labelSmall,
            color = MediaOverlay.BadgeInk.copy(alpha = TOTAL_ALPHA),
            modifier = Modifier.testTag("video_duration"),
        )
        TransportButton(
            label = stringResource(
                if (muted) R.string.designsystem_video_unmute else R.string.designsystem_video_mute,
            ),
            glyph = if (muted) {
                Icons.AutoMirrored.Filled.VolumeOff
            } else {
                Icons.AutoMirrored.Filled.VolumeUp
            },
            box = BAR_CONTROL,
            glyphSize = BAR_GLYPH,
            onClick = onToggleMute,
            testTag = "video_mute",
        )
        // THE BAR ENDS IN THE WAY INTO THE VIEWER (`VideoControls.jsx:231`).
        // It is the transport's own route there; the clip's surface tap is the
        // other (graph.json, `PostDetailVideo` via 19 and via 3).
        if (onFullscreen != null) {
            TransportButton(
                label = stringResource(R.string.designsystem_video_fullscreen),
                glyph = Icons.Filled.Fullscreen,
                box = BAR_CONTROL,
                glyphSize = BAR_GLYPH,
                onClick = onFullscreen,
                testTag = "video_fullscreen",
            )
        }
    }
}

/**
 * The timeline, drawn to the board and operated by Material.
 *
 * The track is the drawn 3dp hairline and the knob the drawn 12dp dot; what
 * `Slider` keeps is everything that is not drawing — the slider role and its
 * range info, the tap anywhere, the drag along it, and the keyboard.
 *
 * The `thumb`/`track` overload is `@ExperimentalMaterial3Api`, and it is the
 * one Material's own custom-slider sample uses. The alternative is redrawing
 * the slider outright, which would mean re-implementing the gesture and the
 * semantics this component exists to keep.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Timeline(
    progress: Float,
    onSeek: (Float) -> Unit,
    modifier: Modifier = Modifier,
) {
    val seekLabel = stringResource(R.string.designsystem_video_seek)
    Slider(
        value = progress.coerceIn(0f, 1f),
        onValueChange = onSeek,
        modifier = modifier
            .height(TIMELINE_HEIGHT)
            .testTag(TIMELINE_TAG)
            .semantics { contentDescription = seekLabel },
        colors = SliderDefaults.colors(
            thumbColor = MaterialTheme.colorScheme.primary,
            activeTrackColor = MaterialTheme.colorScheme.primary,
            inactiveTrackColor = MediaOverlay.TimelineTrack,
        ),
        thumb = {
            Box(
                modifier = Modifier
                    .size(KNOB)
                    .clip(RoundedCornerShape(KNOB / 2))
                    .background(MaterialTheme.colorScheme.primary),
            )
        },
        track = { state ->
            Box(modifier = Modifier.fillMaxWidth().height(TRACK)) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(RoundedCornerShape(TRACK / 2))
                        .background(MediaOverlay.TimelineTrack),
                )
                Box(
                    modifier = Modifier
                        .fillMaxWidth(state.value.coerceIn(0f, 1f))
                        .fillMaxHeight()
                        .clip(RoundedCornerShape(TRACK / 2))
                        .background(MaterialTheme.colorScheme.primary),
                )
            }
        },
    )
}

@Composable
private fun TransportButton(
    label: String,
    glyph: ImageVector,
    box: Dp,
    glyphSize: Dp,
    onClick: () -> Unit,
    testTag: String,
    plate: Color = Color.Transparent,
) {
    Box(
        modifier = Modifier
            .size(box)
            .clip(RoundedCornerShape(box / 2))
            .background(plate)
            .clickable(onClick = onClick)
            .semantics { contentDescription = label }
            .testTag(testTag),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = glyph,
            contentDescription = null,
            tint = MediaOverlay.BadgeInk,
            modifier = Modifier.size(glyphSize),
        )
    }
}

/** The inset that keeps the bar clear of the system gesture zone
 * (`VideoControls.jsx:43` — `export const GESTURE_ZONE = 16`). */
val GESTURE_ZONE = 16.dp

internal const val TRANSPORT_TAG = "video_transport"
internal const val TIMELINE_TAG = "video_timeline"

/** `height: "45%"` — the wash's share of the frame (`VideoControls.jsx:177`). */
private const val WASH_FRACTION = 0.45f

/** `opacity: 0.85` on the total (`VideoControls.jsx:221`). */
private const val TOTAL_ALPHA = 0.85f

private val PLAY_DIAMETER = 64.dp
private val PLAY_GLYPH = 34.dp
private val SKIP_DIAMETER = 44.dp
private val SKIP_GLYPH = 26.dp
private val BAR_CONTROL = 28.dp
private val BAR_GLYPH = 20.dp
private val TIMELINE_HEIGHT = 16.dp
private val TRACK = 3.dp
private val KNOB = 12.dp

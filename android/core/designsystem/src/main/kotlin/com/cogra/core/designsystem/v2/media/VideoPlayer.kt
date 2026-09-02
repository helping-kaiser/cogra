package com.cogra.core.designsystem.v2.media

import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.VolumeOff
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.boundsInWindow
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.collectAsState
import androidx.media3.common.MediaItem as Media3Item
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.compose.PlayerSurface
import androidx.media3.ui.compose.state.rememberPresentationState
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.v2.token.MediaOverlay
import com.cogra.core.designsystem.v2.token.Space
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Whether video plays with sound, for the whole app.
 *
 * **One global sticky mute** (roadmap slice 2.5.2). A reader who
 * unmutes one clip has said what they want of every clip, so the answer
 * cannot live on a player: it survives scrolling one card out of view,
 * opening a post, and coming back. It starts muted because that is what
 * autoplay is allowed to be — sound that starts itself is sound nobody
 * asked for.
 *
 * It is process-lifetime rather than stored: the setting is about this
 * sitting, and a reader who opens the app tomorrow starts quiet again.
 */
object VideoSound {
    private val _muted = MutableStateFlow(true)

    val muted: StateFlow<Boolean> = _muted.asStateFlow()

    fun toggle() {
        _muted.value = !_muted.value
    }

    /** Test seam: puts the shared answer back where a fresh app starts. */
    fun reset() {
        _muted.value = true
    }
}

/**
 * How much of this element is inside the window, as a fraction of its
 * own height.
 *
 * Autoplay is a question about what the reader can actually see, and
 * Compose answers it through layout rather than through a scroll
 * listener: `boundsInWindow` is already clipped to what is on screen, so
 * its height against the element's own is the fraction showing.
 */
fun Modifier.onVisibilityChanged(onChange: (Float) -> Unit): Modifier =
    onGloballyPositioned { coordinates ->
        val height = coordinates.size.height
        onChange(
            if (height == 0) {
                0f
            } else {
                (coordinates.boundsInWindow().height / height.toFloat()).coerceIn(0f, 1f)
            },
        )
    }

/**
 * One clip, playing where it sits.
 *
 * The cover is the poster: it is drawn under the surface and stays until
 * the first frame is rendered, so a card never flashes black while a
 * decoder warms up. Autoplay follows visibility, muted, and the mute
 * control is the shared one — tapping it here answers for every clip.
 *
 * @param url the clip.
 * @param posterUrl the still that stands in before the first frame, and
 *   wherever autoplay does not run.
 * @param autoplay whether this surface is allowed to start itself —
 *   the caller's own visibility answer, so a list can decide that only
 *   one card at a time plays.
 * @param durationMs the running time the badge shows; null hides it.
 */
@OptIn(UnstableApi::class)
@Composable
fun VideoPlayer(
    url: String,
    posterUrl: Any?,
    autoplay: Boolean,
    modifier: Modifier = Modifier,
    durationMs: Int? = null,
    contentDescription: String? = null,
    testTag: String? = null,
) {
    val context = LocalContext.current
    val muted by VideoSound.muted.collectAsState()
    var playing by remember { mutableStateOf(false) }

    // One player per surface, released with it. An ExoPlayer holds a
    // codec, and a codec not released is a codec another card cannot
    // have.
    val player = remember(url) {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(Media3Item.fromUri(url))
            // A feed clip loops: it is a moment rather than a
            // programme, and the alternative is a card that goes still
            // and dead while the reader is still looking at it.
            repeatMode = Player.REPEAT_MODE_ONE
            prepare()
        }
    }

    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                playing = isPlaying
            }
        }
        player.addListener(listener)
        onDispose {
            player.removeListener(listener)
            player.release()
        }
    }

    // Autoplay and the shared mute are both *state*, applied to the
    // player rather than commanded at it: that way the player agrees
    // with what the reader last said, however it got here.
    LaunchedEffect(autoplay) { player.playWhenReady = autoplay }
    LaunchedEffect(muted) { player.volume = if (muted) 0f else 1f }

    val presentation = rememberPresentationState(player)

    Box(modifier = modifier.then(if (testTag != null) Modifier.testTag(testTag) else Modifier)) {
        PlayerSurface(player = player, modifier = Modifier.fillMaxSize())

        // The poster covers the surface until a frame exists to show —
        // which is also the state a clip that never autoplays stays in.
        if (presentation.coverSurface) {
            AsyncImage(
                model = posterUrl,
                contentDescription = contentDescription,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }

        PlayPauseButton(
            playing = playing,
            onToggle = { if (playing) player.pause() else player.play() },
            modifier = Modifier.align(Alignment.Center),
        )

        Row(
            modifier = Modifier.align(Alignment.BottomEnd).padding(Space.x2),
        ) {
            durationMs?.let {
                OverlayBadge(modifier = Modifier.testTag("video_duration")) {
                    Text(
                        text = formatRunningTime(it),
                        style = MaterialTheme.typography.labelSmall,
                        color = MediaOverlay.BadgeInk,
                    )
                }
            }
            MuteButton(muted = muted)
        }
    }
}

@Composable
private fun PlayPauseButton(
    playing: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .size(CONTROL_DIAMETER)
            .clip(RoundedCornerShape(CONTROL_DIAMETER / 2))
            .background(MediaOverlay.Badge)
            .clickable(onClick = onToggle)
            .semantics { contentDescription = if (playing) "Pause" else "Play" }
            .testTag("video_play_pause"),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = if (playing) Icons.Filled.Pause else Icons.Filled.PlayArrow,
            contentDescription = null,
            tint = MediaOverlay.BadgeInk,
            modifier = Modifier.size(CONTROL_GLYPH),
        )
    }
}

/**
 * The shared mute, as a control.
 *
 * It commands [VideoSound] rather than this player: the reader is
 * answering for every clip, which is the whole point of one sticky
 * answer.
 */
@Composable
private fun MuteButton(muted: Boolean) {
    Box(
        modifier = Modifier
            .padding(start = Space.x2)
            .size(BADGE_CONTROL)
            .clip(RoundedCornerShape(BADGE_CONTROL / 2))
            .background(MediaOverlay.Badge)
            .clickable(onClick = VideoSound::toggle)
            .semantics { contentDescription = if (muted) "Unmute" else "Mute" }
            .testTag("video_mute"),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = if (muted) {
                Icons.AutoMirrored.Filled.VolumeOff
            } else {
                Icons.AutoMirrored.Filled.VolumeUp
            },
            contentDescription = null,
            tint = MediaOverlay.BadgeInk,
            modifier = Modifier.size(BADGE_GLYPH),
        )
    }
}

@Composable
private fun OverlayBadge(modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(Space.x1))
            .background(MediaOverlay.Badge)
            .padding(horizontal = Space.x2, vertical = 1.dp),
        contentAlignment = Alignment.Center,
        content = content,
    )
}

/** Minutes and seconds, growing an hours field past the hour. */
fun formatRunningTime(ms: Int): String {
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

private val CONTROL_DIAMETER = 56.dp
private val CONTROL_GLYPH = 32.dp
private val BADGE_CONTROL = 28.dp
private val BADGE_GLYPH = 16.dp

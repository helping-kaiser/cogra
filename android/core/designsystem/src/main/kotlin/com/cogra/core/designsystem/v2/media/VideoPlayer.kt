package com.cogra.core.designsystem.v2.media

import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.collectAsState
import androidx.lifecycle.compose.LifecycleStartEffect
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.ui.compose.PlayerSurface
import androidx.media3.ui.compose.state.rememberPresentationState
import coil3.compose.AsyncImage
import com.cogra.core.designsystem.R
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
 * **A reading surface wears sound and nothing else** (`ReplyMedia`,
 * 2026-09-02): "no play/pause and no duration pill: presence on screen
 * is the policy on a reading surface, exactly as on a post's card". A
 * feed card, a post detail and a comment are all reading surfaces; the
 * composer is not, which is where the running time is shown instead.
 *
 * @param url the clip.
 * @param posterUrl the still that stands in before the first frame, and
 *   wherever autoplay does not run.
 * @param autoplay whether this surface is allowed to start itself —
 *   the caller's own visibility answer, so a list can decide that only
 *   one card at a time plays.
 * @param durationMs the running time, drawn only where [controls] asks
 *   for it. Null hides it everywhere.
 * @param controls which controls this surface wears.
 * @param contentScale how the clip fills its frame. **It has to be the
 *   scale the poster is drawn at**: the poster and the video stand in
 *   for each other, and two different scales make every swap between
 *   them a visible change of shape.
 * @param videoAspectRatio the clip's own shape, as the server derived
 *   it from the stored bytes. **Known before composition**, which is the
 *   point: sizing the surface from it means the surface is measured once
 *   rather than measured, then re-measured when the decoder reports in.
 *   Null falls back to filling the frame.
 */
@OptIn(UnstableApi::class)
@Composable
fun VideoPlayer(
    url: String,
    posterUrl: Any?,
    autoplay: Boolean,
    modifier: Modifier = Modifier,
    durationMs: Int? = null,
    controls: VideoControls = VideoControls.SoundOnly,
    contentScale: ContentScale = ContentScale.Crop,
    videoAspectRatio: Float? = null,
    contentDescription: String? = null,
    testTag: String? = null,
) {
    val context = LocalContext.current
    val muted by VideoSound.muted.collectAsState()
    var playing by remember { mutableStateOf(false) }

    // The player is borrowed rather than built: the same clip on the
    // feed card and on the post detail is the same instance, so opening
    // the detail continues from where the feed had it instead of
    // starting a second decoder at zero. See [VideoStage].
    val token = remember(url) { Any() }

    // Claiming the stage is a side effect, so it happens after the
    // composition that asked for it rather than inside it — the surface
    // entering last is the one that ends up showing.
    val traced = remember(url) { VideoTrace.clip(url) }

    // Tied to the lifecycle rather than to composition alone: the stage
    // gives the decoder back when the app goes to the background
    // ([VideoStageLifecycle]), and a surface still composed behind that
    // has to ask for a player again when the app comes back — otherwise
    // it sits on its poster forever, holding a token for a player that
    // no longer exists.
    LifecycleStartEffect(url, token) {
        VideoStage.claim(context, url, token)
        VideoStage.holding?.player?.let {
            VideoTrace.handover(traced, "claimed", it.currentPosition, it.isPlaying)
        }
        onStopOrDispose {
            // The player outlives this surface — surrendering is what
            // hands it on, and releasing it here is what used to make
            // the next screen start over.
            VideoStage.holding?.player?.let {
                VideoTrace.handover(traced, "surrender", it.currentPosition, it.isPlaying)
            }
            VideoStage.surrender(token)
        }
    }

    // Read from the stage rather than held: a second clip taking the
    // stage releases this one's player, and a surface holding its own
    // reference would go on talking to a released instance.
    val player = VideoStage.playerFor(token, url)

    // Whether the clip this surface is for is the one on stage — asked
    // separately from owning it, because during a navigation both
    // surfaces are composed and only the arriving one holds the token.
    // The leaving one then has no player while its own clip is playing
    // one composable over, and that is not a reason to draw a cover.
    val clipOnStage = VideoStage.holding?.url == url

    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                playing = isPlaying
            }

            override fun onRenderedFirstFrame() {
                // The end of every flash, whatever caused it — and the
                // fact the stage remembers, so the next surface this
                // clip lands on does not put the cover back.
                //
                // Media3 calls this again on every loop of a card clip
                // (`REPEAT_MODE_ONE` is a period transition, and each
                // period renders its own first frame), so the trace asks
                // the stage rather than the player: a line here means a
                // clip genuinely arrived, not that a four-second loop
                // came round again.
                if (!VideoStage.hasRendered) VideoTrace.firstFrame(traced)
                VideoStage.rendered()
            }
        }
        player?.addListener(listener)
        onDispose {
            player?.removeListener(listener)
            playing = false
        }
    }

    // Autoplay and the shared mute are both *state*, applied to the
    // player rather than commanded at it: that way the player agrees
    // with what the reader last said, however it got here. Only the
    // surface actually showing the clip drives it — a screen on its way
    // out must not pause what its replacement just started.
    LaunchedEffect(autoplay, player) { player?.playWhenReady = autoplay }
    LaunchedEffect(muted, player) { player?.volume = if (muted) 0f else 1f }

    // `keepContentOnReset` is the documented lever against the flash:
    // it keeps the frame already on screen visible when the player or
    // its tracks change, which is exactly what re-attaching one player
    // to a second surface looks like from the state holder's side.
    val presentation = rememberPresentationState(player, keepContentOnReset = true)

    // **Geometry from what is already known, never from what arrives.**
    //
    // A bare `SurfaceView` paints the decoder's output across whatever
    // area it is given, so the surface does have to be sized. The
    // previous attempt sized it with
    // `resizeWithContentScale(contentScale, videoSizeDp)` — and
    // `videoSizeDp` is filled in from an effect, so the surface measured
    // at full parent size and then re-measured when the value landed.
    // That is a relayout at exactly the moment a frame is arriving, and
    // it is the shape of what jakob describes as the container sizing
    // for the cover and then resizing for the video.
    //
    // [videoAspectRatio] is the server's own derivation from the stored
    // bytes, known before anything is composed. The design now
    // guarantees the cover shares it — "the cover shares the clip's
    // ratio and crops identically" (design/readme.md) — so one value
    // sizes both and neither waits for the other.
    //
    // `videoSizeDp` is still read, but only to say so in the trace: the
    // device log has to show whether it arrives before or after the
    // surface is measured, which is what tells us the relayout is gone.
    val videoSize = presentation.videoSizeDp

    // Whether this arrives before or after the surface is measured is
    // the whole of androidx/media#3238, and it decides whether the
    // geometry below changes under a frame that is already landing.
    LaunchedEffect(videoSize, traced) {
        VideoTrace.videoSize(traced, videoSize?.width, videoSize?.height)
    }

    Box(
        modifier = modifier
            .then(if (testTag != null) Modifier.testTag(testTag) else Modifier)
            // The box the frame actually measured. If this changes
            // between the cover and the video, jakob's relayout is real
            // and the log says so in two lines.
            .onSizeChanged { VideoTrace.surface(traced, "measured", it.width, it.height) },
        contentAlignment = Alignment.Center,
    ) {
        // A surface without the stage binds nothing: two surfaces
        // setting the same player's video output is the fight that
        // reads as a flicker.
        // Sized once, from a number known before composition. A clip
        // taller than its frame overflows it and is clipped by the box —
        // a centre-crop, which is what "letterboxing exists nowhere in
        // the product" asks for. A clip the frame's own shape fills it
        // exactly and nothing is cut.
        // And a surface with no player is not composed at all. A
        // `SurfaceView` keeps the last frame it was handed until it is
        // detached, so a host that has just lost the token goes on
        // showing that frozen frame — at its own geometry, over the
        // crossfade, beside the arriving host drawing the live one. Two
        // pictures of the same clip, one stale: the nested box.
        if (player != null) {
            PlayerSurface(
                player = player,
                modifier = if (videoAspectRatio != null) {
                    Modifier.fillMaxWidth().aspectRatio(videoAspectRatio)
                } else {
                    Modifier.fillMaxSize()
                },
            )
        }

        // The poster covers the surface until a frame of this clip
        // exists to show — which is also the state a clip that never
        // autoplays, or one whose stage another clip has taken, stays
        // in. A surface merely mid-handover draws nothing at all: the
        // arriving surface is showing the very same clip through the
        // crossfade, and a cover on top of that is the flash.
        val reason = posterReason(
            coverSurface = presentation.coverSurface,
            hasPlayer = player != null,
            alreadyRendered = VideoStage.hasRendered,
            clipOnStage = clipOnStage,
        )
        LaunchedEffect(reason, traced) {
            VideoTrace.poster(traced, shown = reason != null, reason = reason ?: "surface ready")
        }
        if (reason != null) {
            AsyncImage(
                model = posterUrl,
                contentDescription = contentDescription,
                contentScale = contentScale,
                modifier = Modifier.fillMaxSize(),
            )
        }

        if (controls == VideoControls.Full && player != null) {
            PlayPauseButton(
                playing = playing,
                onToggle = { if (playing) player.pause() else player.play() },
                modifier = Modifier.align(Alignment.Center),
            )
        }

        Row(
            modifier = Modifier.align(Alignment.BottomEnd).padding(Space.x2),
        ) {
            if (controls == VideoControls.Full) {
                durationMs?.let {
                    OverlayBadge(modifier = Modifier.testTag("video_duration")) {
                        Text(
                            text = formatRunningTime(it),
                            style = MaterialTheme.typography.labelSmall,
                            color = MediaOverlay.BadgeInk,
                        )
                    }
                }
            }
            MuteButton(muted = muted)
        }
    }
}

/**
 * What a surface lets a reader do to a clip.
 *
 * [SoundOnly] is the reading surfaces' answer and the default: presence
 * on screen decides whether a clip plays, so a play button would be a
 * second, contradictory answer to a question already settled. Sound is
 * the one decision left, and it is shared.
 */
enum class VideoControls { SoundOnly, Full }

/**
 * Whether the poster stands in front of the surface.
 *
 * [coverSurface] is Media3's own answer about this surface — no frame
 * has been rendered on it yet, so there is nothing behind the poster to
 * show. [hasPlayer] and [clipOnStage] are the stage's two halves: which
 * surface may bind the player, and which clip the player holds.
 * [alreadyRendered] is the stage's memory of having drawn this clip at
 * all.
 */
internal fun posterCovers(
    coverSurface: Boolean,
    hasPlayer: Boolean,
    alreadyRendered: Boolean,
    clipOnStage: Boolean,
): Boolean = posterReason(coverSurface, hasPlayer, alreadyRendered, clipOnStage) != null

/**
 * *Why* the poster is in front, or null when it is not.
 *
 * **A cover is a stand-in for a frame that does not exist yet.** Once
 * this clip has rendered one, it has a face of its own and the cover has
 * no job — which is the rule the detail was breaking: opening it made a
 * new surface, whose freshly remembered `PresentationState` starts with
 * `coverSurface` true, and the cover came back over a clip that had been
 * playing a moment before. [alreadyRendered] belongs to the stage rather
 * than the surface precisely because it has to outlive the surface.
 *
 * **Losing the token is not losing the clip.** A navigation composes
 * both screens at once and the arriving surface takes the token, so the
 * leaving one reads no player for the length of the crossfade — while
 * the clip it is for is playing one composable over. Drawing the cover
 * there put the hand-picked still on top of a clip in motion, in both
 * directions; drawing nothing lets the arriving surface show through.
 * So the question is asked in the order the reader experiences it: is
 * this clip on stage at all, has it ever drawn a frame, and only then
 * whose surface holds it.
 *
 * The reason is what the device log carries, and it names which of the
 * causes is in play. A third is not in this function at all — a
 * `SurfaceView` destroyed and recreated shows its own black window,
 * which no poster rule would explain — so naming these lets the log
 * rule them in or out, and their absence points at that one.
 */
internal fun posterReason(
    coverSurface: Boolean,
    hasPlayer: Boolean,
    alreadyRendered: Boolean,
    clipOnStage: Boolean,
): String? = when {
    !clipOnStage -> "no clip on stage"
    alreadyRendered -> null
    !hasPlayer || coverSurface -> "no frame rendered yet"
    else -> null
}

@Composable
private fun PlayPauseButton(
    playing: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val label =
        stringResource(if (playing) R.string.designsystem_video_pause else R.string.designsystem_video_play)
    Box(
        modifier = modifier
            .size(CONTROL_DIAMETER)
            .clip(RoundedCornerShape(CONTROL_DIAMETER / 2))
            .background(MediaOverlay.Badge)
            .clickable(onClick = onToggle)
            .semantics { contentDescription = label }
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
    val label =
        stringResource(if (muted) R.string.designsystem_video_unmute else R.string.designsystem_video_mute)
    Box(
        modifier = Modifier
            .padding(start = Space.x2)
            .size(BADGE_CONTROL)
            .clip(RoundedCornerShape(BADGE_CONTROL / 2))
            .background(MediaOverlay.Badge)
            .clickable(onClick = VideoSound::toggle)
            .semantics { contentDescription = label }
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

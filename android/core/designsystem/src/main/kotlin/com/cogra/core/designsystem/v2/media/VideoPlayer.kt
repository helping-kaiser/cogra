package com.cogra.core.designsystem.v2.media

import androidx.annotation.OptIn
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.material3.Icon
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
import androidx.media3.ui.compose.state.rememberProgressStateWithTickInterval
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
 * **The surface decides the controls, never the clip**
 * (`design/readme.md`, the control ladder): a feed card carries the
 * sound disc alone; a detail view and the fullscreen viewer carry the
 * full transport; the stream carries sound and a seek line. No length
 * threshold enters into it, because a reader who learns a control on
 * one clip has to find it on the next.
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
    /**
     * The way into the fullscreen viewer, where the surface has one.
     *
     * The graph draws TWO routes there from the video detail — "the transport's
     * own way into the viewer — the clip tap is the other" (graph.json,
     * `PostDetailVideo` via 19 and via 3) — and both land here: the bar grows
     * its fullscreen toggle, and the frame itself takes the tap. Only a
     * full-transport surface is offered one; the viewer passes none, because
     * "no fullscreen toggle — this IS the fullscreen"
     * (`MediaViewer.jsx:153`).
     */
    onOpenViewer: (() -> Unit)? = null,
    /**
     * What the device's own bars and gesture strip take, where this surface
     * reaches the screen's edges.
     *
     * Zero for every framed surface — a card's clip and the detail's pinned
     * clip sit inside the page, and a bar inset for a navigation bar that is
     * nowhere near them would just float. The fullscreen viewer hands its own
     * safe area down, because there the bar genuinely is the bottom of the
     * screen (jakob 2026-09-15, hand test).
     */
    chromeInsets: PaddingValues = PaddingValues(0.dp),
    testTag: String? = null,
) {
    val context = LocalContext.current
    val muted by VideoSound.muted.collectAsState()
    var playing by remember { mutableStateOf(false) }
    var ended by remember { mutableStateOf(false) }

    // The chrome is drawn revealed, and a tap on the clip takes it away and
    // brings it back — the same rule web has had since the transport landed.
    // On the fullscreen viewer that tap USED TO CLOSE the whole layer, which
    // turned every reach for a control into a dismissal (jakob 2026-09-15,
    // hand test).
    var chromeShown by remember { mutableStateOf(true) }

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

    // THE WAY BACK FROM A SURFACE THAT TOOK THE CLIP AND THEN LEFT (jakob
    // 2026-09-15, hand test: returning from the fullscreen viewer left the
    // detail's pinned clip a black box with no transport at all).
    //
    // The viewer claims the stage on the way in and surrenders on the way out,
    // which leaves the clip on stage with NO OWNER. The detail's surface never
    // stopped being composed, so its `LifecycleStartEffect` — keyed on the url
    // and the token, over a lifecycle that never stopped — does not run again:
    // it goes on holding a token the stage no longer recognises, `playerFor`
    // answers null, the `PlayerSurface` has nothing bound to draw, and the
    // transport is not drawn at all because there is no player to drive it.
    //
    // An unowned stage is a claim waiting to be made by whoever is still
    // composed and still showing this clip. Claiming the clip already on stage
    // keeps the very same player — no prepare, no seek — so what this costs is
    // a token swap, and what it buys is the clip coming back alive where the
    // reader left it.
    val unowned = VideoStage.holding?.let { it.url == url && it.owner == null } == true
    LaunchedEffect(unowned, url, token) {
        if (unowned) VideoStage.claim(context, url, token)
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

    // The one reason to give the surface up: another surface is showing
    // this clip. An empty stage is not that, and a surface that leaves
    // the composition there comes back unbound — see [VideoStage.displaced].
    val displaced = VideoStage.displaced(token, url)

    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                playing = isPlaying
            }

            // A CLIP THAT RAN OUT IS A CLIP AT REST, and the transport has to
            // say which rest it is: `STATE_ENDED` is what turns the Play glyph
            // into Replay, because the same press means two different things
            // either side of the end
            // (developer.android.com/media/media3/exoplayer/listening-to-player-events).
            override fun onPlaybackStateChanged(playbackState: Int) {
                ended = playbackState == Player.STATE_ENDED
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
        // The player may already be past its end when this surface binds it —
        // the viewer opening on a clip the detail had run out is exactly that —
        // and a listener only ever hears about the NEXT change.
        ended = player?.playbackState == Player.STATE_ENDED
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

    // A FEED CLIP LOOPS AND A CLIP UNDER THE REAL TRANSPORT STOPS (jakob
    // 2026-09-14, via the design loop). It sharpens the deliberate
    // reel-vs-video split: a clip in a card or a stream is a MOMENT, read with
    // the scroller's grammar, and stopping it would leave a card gone still and
    // dead under a reader still looking at it. A clip the reader opened on
    // purpose — the detail's pinned clip, the viewer — is a PROGRAMME, read
    // with a player's grammar, and a programme that silently restarted would be
    // a player that never admits it finished.
    //
    // It rides the SURFACE rather than the stage, because one clip is both: the
    // same player carries a card's loop and the detail's stop, and whichever
    // surface is showing it says which. That is also what restores the loop on
    // the way back to the feed.
    LaunchedEffect(controls, player) { player?.repeatMode = controls.repeatMode() }

    // Read for the clip's own size and nothing else. The poster asks the
    // stage instead: `PresentationState` is remembered across the player
    // being swapped, so it answers about the player that has gone.
    val presentation = rememberPresentationState(player)

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
            .onSizeChanged { VideoTrace.surface(traced, "measured", it.width, it.height) }
            .surfaceTap(enabled = controls == VideoControls.Full) {
                // THE TAP READS THE CHROME, NEVER THE LAYER. With the controls
                // up and somewhere to go, it is the clip's own route into the
                // viewer (graph.json, `PostDetailVideo` via 3); otherwise it
                // takes the chrome away and brings it back. Closing is the X's
                // job and the back gesture's, and nothing else's.
                if (chromeShown && onOpenViewer != null) onOpenViewer() else chromeShown = !chromeShown
            },
        contentAlignment = Alignment.Center,
    ) {
        // Sized once, from a number known before composition. A clip
        // taller than its frame overflows it and is clipped by the box —
        // a centre-crop, which is what "letterboxing exists nowhere in
        // the product" asks for. A clip the frame's own shape fills it
        // exactly and nothing is cut.
        //
        // The surface outlives the player, which is what Media3's
        // nullable `PlayerSurface(player: Player?)` is for: it keeps its
        // view and rebinds when a player arrives. Only a surface
        // displaced by another one leaves — a `SurfaceView` keeps the
        // last frame it was handed until it is detached, so a host that
        // has just lost the token would go on showing that frozen frame
        // beside the arriving host drawing the live one.
        if (!displaced) {
            PlayerSurface(
                player = player,
                modifier = (
                    if (videoAspectRatio != null) {
                        Modifier.fillMaxWidth().aspectRatio(videoAspectRatio)
                    } else {
                        Modifier.fillMaxSize()
                    }
                    ).testTag(SURFACE_TAG),
            )
        }

        // The poster covers the surface until a frame of this clip
        // exists to show — which is also the state a clip that never
        // autoplays, or one whose stage another clip has taken, stays
        // in. A surface merely mid-handover draws nothing at all: the
        // arriving surface is showing the very same clip through the
        // crossfade, and a cover on top of that is the flash.
        val reason = posterReason(
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
                modifier = Modifier.fillMaxSize().testTag(POSTER_TAG),
            )
        }

        // THE LADDER'S SECOND RUNG. The full transport REPLACES the disc
        // rather than joining it: the sound decision rides the bar, because a
        // disc beside a bar is two pieces of chrome for one clip.
        if (controls == VideoControls.Full && player != null && chromeShown) {
            FullTransport(
                player = player,
                playing = playing,
                ended = ended,
                muted = muted,
                recordDurationMs = durationMs,
                onFullscreen = onOpenViewer,
                chromeInsets = chromeInsets,
                modifier = Modifier.align(Alignment.Center),
            )
        }

        if (controls == VideoControls.SoundOnly) {
            Row(
                modifier = Modifier.align(Alignment.BottomStart).padding(Space.x2),
            ) {
                MuteButton(muted = muted)
            }
        }
    }
}

/**
 * Whether a clip on this surface loops.
 *
 * THE CLIP-LOOP RULING (jakob 2026-09-14, via the design loop): a reading
 * surface's clip is a MOMENT and keeps going round; a clip under the full
 * transport is a PROGRAMME the reader opened on purpose, and it stops so the
 * transport can stand at replay.
 */
private fun VideoControls.repeatMode(): Int = when (this) {
    VideoControls.Full -> Player.REPEAT_MODE_OFF
    VideoControls.SoundOnly -> Player.REPEAT_MODE_ONE
}

/**
 * THE TAP ON THE CLIP, on every surface that wears a transport.
 *
 * It sits UNDER the transport, so every press aimed at play, seek or sound is
 * that control's and only the frame around them is the frame's. A reading
 * surface takes no tap at all: presence on screen is the whole policy there,
 * and a card whose clip answered a press would be a second, contradictory
 * answer to a question already settled.
 */
private fun Modifier.surfaceTap(enabled: Boolean, onTap: () -> Unit): Modifier =
    if (enabled) clickable(onClick = onTap) else this

/**
 * The transport, bound to the clip on stage.
 *
 * Media3's own progress holder rather than a hand-rolled ticker: it polls the
 * player on an interval and stops when the composition leaves, which is
 * exactly the loop a timeline needs and the one every player writes wrong
 * (`androidx.media3.ui.compose.state.rememberProgressStateWithTickInterval`).
 *
 * @param recordDurationMs the length the record states, which stands until the
 *   player has read one off the file — a bar reading `0:00` over a clip the
 *   reader can see is longer says something false.
 */
@OptIn(UnstableApi::class)
@Composable
private fun FullTransport(
    player: Player,
    playing: Boolean,
    ended: Boolean,
    muted: Boolean,
    recordDurationMs: Int?,
    onFullscreen: (() -> Unit)?,
    chromeInsets: PaddingValues,
    modifier: Modifier = Modifier,
) {
    val progress = rememberProgressStateWithTickInterval(player, TICK_MS)
    val length = progress.durationMs.takeIf { it > 0 } ?: recordDurationMs?.toLong() ?: 0L
    val position = progress.currentPositionMs.coerceAtLeast(0L)
    VideoTransport(
        playing = playing,
        ended = ended,
        chromeInsets = chromeInsets,
        elapsedMs = position,
        durationMs = length,
        progress = if (length > 0) position.toFloat() / length else 0f,
        muted = muted,
        // PLAY AT THE END IS REPLAY. `play()` alone would not restart a player
        // in `STATE_ENDED` — it "resumes playback as soon as the player is in
        // STATE_READY" (`androidx.media3.common.Player.play`) — so the seek is
        // what turns the stopped transport's own Play glyph into the way back
        // to the start.
        onTogglePlay = {
            when {
                playing -> player.pause()
                player.playbackState == Player.STATE_ENDED -> {
                    player.seekToDefaultPosition()
                    player.play()
                }
                else -> player.play()
            }
        },
        // The PLAYER's own seek commands, so the increment it was built with
        // is the one every path uses.
        onSkip = { step -> if (step < 0) player.seekBack() else player.seekForward() },
        onSeek = { at -> if (length > 0) player.seekTo((at * length).toLong()) },
        onToggleMute = VideoSound::toggle,
        onFullscreen = onFullscreen,
        modifier = modifier,
    )
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
 * [clipOnStage] says whether the player holds this clip at all;
 * [alreadyRendered] is the stage's memory of having drawn it.
 */
internal fun posterCovers(
    alreadyRendered: Boolean,
    clipOnStage: Boolean,
): Boolean = posterReason(alreadyRendered, clipOnStage) != null

/**
 * *Why* the poster is in front, or null when it is not.
 *
 * **A cover is a stand-in for a frame that does not exist yet**, and the
 * stage is the only thing that knows whether one exists. Media3's
 * per-surface `PresentationState` is not: it is remembered across the
 * player being swapped, so a returning app — whose stage released its
 * decoder and built a fresh one — is told the released player's frame is
 * still on screen, and the cover stays off a surface with nothing behind
 * it. [alreadyRendered] belongs to the stage for the same reason it
 * outlives the surfaces: opening the detail makes a new surface, and the
 * clip it shows already has a face.
 *
 * **Losing the token is not losing the clip.** A navigation composes
 * both screens at once and the arriving surface takes the token, so the
 * leaving one reads no player for the length of the crossfade — while
 * the clip it is for is playing one composable over. Drawing the cover
 * there put the hand-picked still on top of a clip in motion, in both
 * directions; drawing nothing lets the arriving surface show through.
 * So the question is asked in the order the reader experiences it: is
 * this clip on stage at all, and has it ever drawn a frame.
 *
 * The reason is what the device log carries, and it names which of the
 * causes is in play.
 */
internal fun posterReason(
    alreadyRendered: Boolean,
    clipOnStage: Boolean,
): String? = when {
    !clipOnStage -> "no clip on stage"
    alreadyRendered -> null
    else -> "no frame rendered yet"
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

/** The player's own surface, and the still that stands in front of it. */
internal const val SURFACE_TAG = "video_surface"
internal const val POSTER_TAG = "video_poster"

/** How often the timeline asks the player where it is. Four times a second is
 * under the eye's threshold for a knob that follows playback and well above the
 * cost of a field read. */
private const val TICK_MS = 250L

private val BADGE_CONTROL = 28.dp
private val BADGE_GLYPH = 16.dp

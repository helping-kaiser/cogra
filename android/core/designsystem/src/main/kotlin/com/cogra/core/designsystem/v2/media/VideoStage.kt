package com.cogra.core.designsystem.v2.media

import android.content.Context
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.media3.common.MediaItem as Media3Item
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory

/**
 * The one clip the app is playing, and whichever surface is showing it.
 *
 * **Why one player and not one per surface.** A feed card and the post
 * detail draw the same clip on two different screens, and a player built
 * per composable means the detail starts a second decoder at position
 * zero: the cover flashes, playback restarts, and coming back to the
 * feed builds a third. ExoPlayer's own guidance is to release a player
 * "so as to free up limited resources such as video decoders"
 * (developer.android.com/media/media3/exoplayer/hello-world), which is
 * the same reason read the other way — a decoder is scarce enough to be
 * worth moving rather than duplicating.
 *
 * So the player outlives the composable. It is held here, keyed by the
 * clip it holds, and surfaces borrow it: the position, the buffered
 * data and the rendered frame all survive a navigation, which is what
 * makes the detail continue rather than restart.
 *
 * **One owner at a time.** During a navigation both screens are briefly
 * composed, and two `PlayerSurface`s binding one player would fight over
 * its video surface — the leaving one clearing what the arriving one
 * just set, which is the visible flicker this exists to stop. Ownership
 * is a token: the most recent claimant wins, and a surface that no
 * longer owns the player quietly draws the poster instead. A surface
 * gives ownership back only if it still holds it, so a departing screen
 * can never take the surface away from the one that replaced it.
 *
 * **Nobody holds a reference of their own.** A feed can have two clips
 * on screen at once, and the second claiming the stage releases the
 * first's player. So a surface never keeps the instance — it reads
 * [holding] each time and gets null the moment the stage moved on,
 * which is what keeps a released player from being touched.
 *
 * **The parked cost.** Exactly one decoder stays held once a clip has
 * played, paused and idle. That is the price of continuity and it is
 * bounded at one; a second clip claims the stage and the first is
 * released.
 */
@UnstableApi
object VideoStage {

    /** The clip on stage, its player, and the surface entitled to show it. */
    @Immutable
    data class Holding(
        val url: String,
        val player: ExoPlayer,
        val owner: Any?,
    )

    /**
     * What is on stage right now.
     *
     * Compose state rather than a plain field: a surface that loses the
     * stage has to recompose to stop drawing it, and one that gains it
     * has to recompose to start.
     */
    var holding: Holding? by mutableStateOf(null)
        private set

    /**
     * Takes the stage for [token], on [url].
     *
     * Claiming the clip already on stage keeps the same player
     * untouched — no `prepare`, no seek, no reset — which is precisely
     * what carries the position across a screen change. A different clip
     * releases the one before it: the stage holds one decoder.
     *
     * **Call this from an effect, never while composing.** It writes
     * Compose state, and a write during composition is a side effect in
     * the one place Compose does not allow one.
     */
    fun claim(context: Context, url: String, token: Any) {
        val current = holding
        if (current != null && current.url == url) {
            if (current.owner !== token) holding = current.copy(owner = token)
            return
        }
        current?.player?.release()
        // A new clip has its own face to earn: the last one's rendered
        // frame says nothing about this one, and inheriting it would
        // skip the cover on a clip that has not drawn anything yet.
        hasRendered = false
        val appContext = context.applicationContext
        holding = Holding(
            url = url,
            player = ExoPlayer.Builder(appContext)
                // Every read goes through the process's disk cache, so a
                // loop replays from disk and a clip scrolled back to is
                // not fetched again — see [VideoCache].
                .setMediaSourceFactory(
                    DefaultMediaSourceFactory(appContext)
                        .setDataSourceFactory(VideoCache.dataSourceFactory(appContext)),
                )
                // THE SKIPS ARE TEN SECONDS, said by the board's own labels
                // ("Back ten seconds", `VideoControls.jsx:196`). They are the
                // PLAYER's increments rather than arithmetic in the control,
                // because `seekBack`/`seekForward` are what Media3's own seek
                // commands act on — including the notification and any future
                // media button — and a control that did its own subtraction
                // would leave those two answering five seconds
                // (developer.android.com/media/media3/exoplayer/listening-to-player-events).
                .setSeekBackIncrementMs(SKIP_MS)
                .setSeekForwardIncrementMs(SKIP_MS)
                .build()
                .apply {
                    setMediaItem(Media3Item.fromUri(url))
                    // A clip on a card loops: it is a moment rather than a
                    // programme, and the alternative is a card that goes
                    // still and dead while the reader is still looking. The
                    // surface showing the clip settles it from here — a clip
                    // under the full transport stops at its end — and this is
                    // the reading surfaces' answer, which is every surface a
                    // clip starts on.
                    repeatMode = Player.REPEAT_MODE_ONE
                    prepare()
                },
            owner = token,
        )
    }

    /**
     * The player [token] may bind for [url], or null when the stage has
     * moved on.
     *
     * Both halves of the question matter: a surface that has lost
     * ownership must not bind, and a surface whose clip was replaced
     * must not touch what is now a released instance.
     */
    fun playerFor(token: Any, url: String): ExoPlayer? =
        holding?.takeIf { it.owner === token && it.url == url }?.player

    /**
     * Whether another *surface* is showing this clip instead of [token].
     *
     * The one reason a surface stops drawing at all. During a navigation
     * both screens are composed, the arriving one holds the token, and
     * the leaving one's `SurfaceView` still carries the frame it was
     * last handed — two pictures of the same clip, one frozen, side by
     * side through the crossfade.
     *
     * An **empty stage is not that**. Nobody is showing the clip, and a
     * surface torn down there cannot get the player back: Media3 binds a
     * player to its view from `AndroidView`'s update callback, which runs
     * on a layout pass, and an app returning from the background
     * recomposes without running one. The rebuilt surface then never
     * binds — the player plays to nobody, renders no frame, and the card
     * sits blank until something unrelated forces a layout.
     */
    fun displaced(token: Any, url: String): Boolean {
        val current = holding ?: return false
        return current.url == url && current.owner != null && current.owner !== token
    }

    /**
     * The surface is going away.
     *
     * The player is kept — that is the whole point — but it stops
     * playing to nobody. Ownership is surrendered only if this token
     * still holds it: a screen being disposed *after* its replacement
     * claimed the stage must not pull the surface out from under it.
     */
    fun surrender(token: Any) {
        val current = holding ?: return
        if (current.owner !== token) return
        current.player.pause()
        holding = current.copy(owner = null)
    }

    /**
     * Whether the clip on stage has ever put a frame on screen.
     *
     * **A cover that has already been replaced must not come back.**
     * `PresentationState` is remembered per composable, so its
     * `coverSurface` starts true on every new surface — which is why
     * opening the detail re-showed the cover even though the same
     * player had been playing a moment earlier. The stage outlives the
     * surfaces, so it is the thing that can remember.
     *
     * Compose state for the same reason [holding] is: the poster rule
     * reads it while composing, and the surface has to recompose to take
     * the cover away when the first frame lands. A plain field is read
     * without recording a dependency, so the answer would change and
     * nothing would ask again.
     */
    var hasRendered: Boolean by mutableStateOf(false)
        private set

    /** The player rendered — from here on this clip needs no stand-in. */
    fun rendered() {
        hasRendered = true
    }

    /** Lets go of the decoder entirely. */
    fun release() {
        holding?.player?.release()
        holding = null
        hasRendered = false
    }

    /** What one press of a skip is worth, on every clip this stage plays. */
    const val SKIP_MS = 10_000L
}

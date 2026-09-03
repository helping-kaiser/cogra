package com.cogra.core.designsystem.v2.media

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.media3.common.MediaItem as Media3Item
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer

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
 * **The parked cost.** Exactly one decoder stays held once a clip has
 * played, paused and idle. That is the price of continuity and it is
 * bounded at one; a second clip claims the stage and the first is
 * released.
 */
@androidx.media3.common.util.UnstableApi
object VideoStage {

    private var player: ExoPlayer? = null
    private var heldUrl: String? = null

    /**
     * Who may bind the player right now.
     *
     * Compose state rather than a plain field: a surface that loses
     * ownership has to recompose to stop binding, and a surface that
     * gains it has to recompose to start.
     */
    var owner: Any? by mutableStateOf(null)
        private set

    /**
     * The player for [url], building one if the stage holds a different
     * clip.
     *
     * Asking for the clip already on stage returns the same instance
     * untouched — no `prepare`, no seek, no reset — which is precisely
     * what carries the position across a screen change.
     *
     * Deliberately separate from [takeOwnership]: this is safe to call
     * while composing because it touches no Compose state, and the
     * ownership hand-over is a side effect that belongs in an effect.
     */
    fun playerFor(context: Context, url: String): ExoPlayer {
        val existing = player
        if (existing != null && heldUrl == url) return existing
        existing?.release()
        return ExoPlayer.Builder(context.applicationContext).build().apply {
            setMediaItem(Media3Item.fromUri(url))
            // A clip on a card loops: it is a moment rather than a
            // programme, and the alternative is a card that goes
            // still and dead while the reader is still looking.
            repeatMode = Player.REPEAT_MODE_ONE
            prepare()
        }.also {
            player = it
            heldUrl = url
        }
    }

    /** Makes [token] the surface allowed to bind the player. */
    fun takeOwnership(token: Any) {
        owner = token
    }

    /** True while [token] is the surface allowed to bind the player. */
    fun owns(token: Any): Boolean = owner === token

    /**
     * The surface is going away.
     *
     * The player is kept — that is the whole point — but it stops
     * playing to nobody. Ownership is surrendered only if this token
     * still holds it: a screen being disposed *after* its replacement
     * claimed the stage must not pull the surface out from under it.
     */
    fun surrender(token: Any) {
        if (owner !== token) return
        owner = null
        player?.pause()
    }

    /** Lets go of the decoder entirely. */
    fun release() {
        player?.release()
        player = null
        heldUrl = null
        owner = null
    }
}

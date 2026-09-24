package com.cogra.core.designsystem.v2.media

import android.content.Context
import android.os.Handler
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.source.WrappingMediaSource

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
 * **One player for every clip, too.** A new clip is swapped into the
 * player already on stage — `setMediaSource`, then `prepare` — rather than
 * given a player of its own. That is Media3's feed recipe: the app keeps
 * one player and hands it each item as the item is about to be shown,
 * from the preload manager when it has been reading the clip ahead
 * ([VideoPreload];
 * developer.android.com/media/media3/exoplayer/preloading-media/preloadmanager/manage-play).
 * Tearing a player down and building the next one is main-thread work
 * — `release` waits for the playback thread to let go of its codecs —
 * and it landed inside the very frame that scrolled a clip into view.
 *
 * **Nobody holds a reference of their own.** A feed can have two clips
 * on screen at once, and the second claiming the stage takes the player
 * over to its own clip. So a surface never keeps the instance — it reads
 * [holding] each time and gets null the moment the stage moved on,
 * which is what keeps a surface from driving a player that is now
 * playing somebody else's clip, or one that has been released.
 *
 * **The parked cost.** Exactly one player — one clip's decoders — stays
 * held once a clip has played, paused and idle. That is the price of
 * continuity and it is bounded at one: every clip shares that player,
 * so a second clip replaces the first inside it rather than beside it.
 * The parked player does not go on downloading: a paused player stops
 * loading ([VideoLoadControl]). It is released only when the app leaves
 * the screen ([VideoStageLifecycle]), and the next claim builds it again.
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
     * Where the stage's player reads every clip from — and the preload
     * manager beside it ([VideoPreload]).
     *
     * The app shell installs the process's disk cache here at startup
     * ([VideoCache]), before any player is built. Left unset, the player
     * reads straight from the network, which is Media3's own default.
     */
    @Volatile
    var dataSources: DataSource.Factory? = null

    /**
     * Takes the stage for [token], on [url].
     *
     * Claiming the clip already on stage keeps the same player
     * untouched — no `prepare`, no seek, no reset — which is precisely
     * what carries the position across a screen change. A different clip
     * replaces the one before it inside the same player: the stage holds
     * one decoder, and moving to the next clip builds and releases
     * nothing. The first claim, and the first after [release], builds it.
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
        // A new clip has its own face to earn: the last one's rendered
        // frame says nothing about this one, and inheriting it would
        // skip the cover on a clip that has not drawn anything yet.
        hasRendered = false
        val player = current?.player ?: build(context.applicationContext)
        // The source the preload manager has been reading when the clip is
        // in the list the reader is scrolling — its opening already in
        // memory — and a fresh one otherwise (the manage-play recipe).
        val source = VideoPreload.sourceFor(context, url)
        sourceOnStage = source
        player.apply {
            // Each clip starts as a freshly built player would: still until
            // the surface showing it says to play, rather than inheriting the
            // last clip's "play" and starting before anyone decided it should.
            playWhenReady = false
            // A clip on a card loops: it is a moment rather than a
            // programme, and the alternative is a card that goes
            // still and dead while the reader is still looking. The
            // surface showing the clip settles it from here — a clip
            // under the full transport stops at its end — and this is
            // the reading surfaces' answer, which is every surface a
            // clip starts on.
            repeatMode = Player.REPEAT_MODE_ONE
            // Replaces the last clip and starts this one from its beginning.
            // `prepare` is what a fresh player needs and what a player the
            // last clip left failed (idle, with its error) needs again; on a
            // player that is already prepared it does nothing.
            setMediaSource(if (current != null) fenced(source, player) else source)
            prepare()
        }
        holding = Holding(url = url, player = player, owner = token)
    }

    /**
     * What the stage handed its player for the clip on stage — the preload
     * manager's own source when the list had one. Read by tests.
     */
    internal var sourceOnStage: MediaSource? = null
        private set

    /**
     * The one player every clip plays in — built on the first claim, and
     * again after [release].
     *
     * Built by the preload manager's builder, which has to own everything
     * the two share: the data sources (the process's disk cache, so a loop
     * replays from disk and a clip scrolled back to is not fetched again)
     * and the load control (seconds of read-ahead rather than 50 s, and
     * none of it while paused) are set there — see [VideoPreload]. What is
     * this player's alone is set here.
     */
    private fun build(appContext: Context): ExoPlayer = VideoPreload.buildPlayer(
        appContext,
        ExoPlayer.Builder(appContext)
            // THE SKIPS ARE TEN SECONDS, said by the board's own labels
            // ("Back ten seconds", `VideoControls.jsx:196`). They are the
            // PLAYER's increments rather than arithmetic in the control,
            // because `seekBack`/`seekForward` are what Media3's own seek
            // commands act on — including the notification and any future
            // media button — and a control that did its own subtraction
            // would leave those two answering five seconds
            // (developer.android.com/media/media3/exoplayer/listening-to-player-events).
            .setSeekBackIncrementMs(SKIP_MS)
            .setSeekForwardIncrementMs(SKIP_MS),
    )

    /**
     * Set by a swap, cleared once the player has put the previous clip
     * behind it — until then a "first frame" may be the previous clip's.
     *
     * **Why a swap needs this and a fresh player did not.** The video
     * renderer reports a first frame from the playback thread by posting
     * to the main thread, and it does so on every loop of a card clip. A
     * report of the *previous* clip can therefore still be queued when the
     * swap happens, and would land after it — lifting the cover off a clip
     * that has drawn nothing, over a surface that may still hold the last
     * clip's picture. A released player dropped such reports with its
     * listeners; a reused one delivers them.
     *
     * **The fence rides the new clip's source** ([FencedSource]). The
     * playback thread prepares that source while it takes up the new
     * playlist — the step that also takes the previous clip's renderers
     * down — and the source posts the fence to the main thread right
     * there. Every report of the previous clip was posted before that
     * step; every report of the new clip needs a period of the new source,
     * which exists only after it. Both travel through the one main-thread
     * queue in order, so once the fence has arrived the next first frame
     * is this clip's.
     *
     * It has to be the source rather than a message sent after the swap.
     * A message is enqueued by a second call on the main thread, and the
     * playback thread is free to take up the new clip in between: a
     * preloaded clip needs no network and no header before its first
     * frame, so a main thread held up for the length of a decoder start
     * between the two calls would let the new clip's report land before
     * the fence — dropped, and the cover kept over a clip under the full
     * transport, which never loops to report again. The source has no
     * second call to wait for.
     */
    private var pendingSwap: Any? = null

    private fun fenced(source: MediaSource, player: ExoPlayer): MediaSource {
        val fence = Any()
        pendingSwap = fence
        val main = Handler(player.applicationLooper)
        return FencedSource(source) { main.post { if (pendingSwap === fence) pendingSwap = null } }
    }

    /**
     * A clip's source that says so, once, when the player prepares it.
     *
     * A `WrappingMediaSource` — Media3's own base for a source that adds to
     * another — so everything else, the preloaded period the player takes
     * over included, is the wrapped source's untouched.
     */
    internal class FencedSource(source: MediaSource, private val onPrepared: () -> Unit) :
        WrappingMediaSource(source) {
        override fun prepareSourceInternal() {
            onPrepared()
            super.prepareSourceInternal()
        }
    }

    /**
     * The player [token] may bind for [url], or null when the stage has
     * moved on.
     *
     * Both halves of the question matter: a surface that has lost
     * ownership must not bind, and a surface whose clip was replaced
     * must not drive what is now another clip's player.
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

    /**
     * The player drew a first frame, reported by a surface showing [url] —
     * from here on this clip needs no stand-in.
     *
     * Counted only when it can be this clip's: [url] is the clip on
     * stage, and no report of the clip it replaced can still be in
     * flight ([pendingSwap]). True the one time it lifts the cover.
     */
    fun rendered(url: String): Boolean {
        if (hasRendered || pendingSwap != null || holding?.url != url) return false
        hasRendered = true
        return true
    }

    /**
     * Lets go of the decoder entirely — the one path that releases the
     * player. The next claim builds a new one.
     */
    fun release() {
        holding?.player?.release()
        // The preload manager shares the player's thread and load control,
        // and a backgrounded app needs neither — nor the memory it holds.
        VideoPreload.release()
        holding = null
        sourceOnStage = null
        hasRendered = false
        pendingSwap = null
    }

    /** What one press of a skip is worth, on every clip this stage plays. */
    const val SKIP_MS = 10_000L
}

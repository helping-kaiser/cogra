package com.cogra.core.designsystem.v2.media

import android.content.Context
import androidx.annotation.OptIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.platform.LocalContext
import androidx.media3.common.MediaItem as Media3Item
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.source.preload.DefaultPreloadManager
import androidx.media3.exoplayer.source.preload.DefaultPreloadManager.PreloadStatus
import androidx.media3.exoplayer.source.preload.TargetPreloadStatusControl
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlin.math.abs

/**
 * The first seconds of the clips a reader is about to reach, read before
 * they arrive.
 *
 * **Why.** A clip used to ask for its first byte only when its card
 * crossed the autoplay bar, so its start waited on the network, the
 * header and the decoder in a row while the reader watched the cover —
 * a median of 482 ms on the same LAN as the server, and up to 2.9 s.
 * Media3's answer for a feed is `DefaultPreloadManager`: it reads the
 * opening of the clips around the reader in order of distance, and hands
 * the player a source already holding them
 * (developer.android.com/media/media3/exoplayer/preloading-media/preloadmanager).
 *
 * **The stage's player is built here, and has to be.** The preload
 * manager and the player share a load control, a track selector,
 * renderers and — above all — a playback thread: a preloaded source may
 * only be prepared on the thread that preloaded it (`PreloadMediaSource`
 * checks). Media3 guarantees that by building the player from the same
 * builder ([buildPlayer]), and the builder's settings win over the
 * player's for everything they share ("configurations on the
 * DefaultPreloadManager.Builder take precedence"). So what the app
 * installs for every read — the disk cache in [VideoStage.dataSources] —
 * and the stage's [VideoLoadControl] are set on the builder, never on
 * the player's own. What is the player's alone — the ten-second skips —
 * rides the player builder handed in.
 *
 * **Preloaded bytes are cached bytes.** The builder is handed the
 * installed data sources rather than a cache of its own: those already
 * read through the process's disk cache, and a second `setCache` would
 * wrap the cache in itself. So a clip scrolled past keeps its opening on
 * disk under the cache's own bound, and scrolling back reads it from
 * there.
 *
 * **One list: the one the reader is scrolling.** A list tells the
 * manager its clips in the order the reader meets them ([PreloadClips]);
 * the latest list is the one preloaded, and a clip that left it is let
 * go. The list survives the app going to the background — the manager
 * does not ([release]) — so the first player built on the way back
 * rebuilds the manager around the same clips.
 */
@UnstableApi
object VideoPreload {

    /**
     * What the stage plays [url] from: the source the preload manager has
     * been reading, when the clip is in the list — or a fresh one, read
     * through the same data sources, when it is not.
     *
     * "If the mediaSource is null, its mediaItem hasn't been added to the
     * preload manager yet" (the manage-play recipe), and a clip opened
     * from anywhere but the list is exactly that.
     */
    internal fun sourceFor(context: Context, url: String): MediaSource {
        val item = Media3Item.fromUri(url)
        return parts(context).let { it.manager.getMediaSource(item) ?: it.fallback.createMediaSource(item) }
    }

    /**
     * The stage's player, built beside the preload manager so the two
     * share what they must. [player] carries only what is the player's
     * own; see the class notes.
     */
    internal fun buildPlayer(context: Context, player: ExoPlayer.Builder): ExoPlayer =
        parts(context).builder.buildExoPlayer(player)

    /**
     * The list's clips, in the order the reader meets them. A clip keeps
     * the rank it had while its place is unchanged, so appending a page
     * costs nothing already preloaded; a clip that moved is added again
     * at its new place, and one that left is removed.
     */
    fun show(context: Context, clips: List<String>) {
        val next = clips.distinct().withIndex().associate { it.value to it.index }
        if (next == ranks) return
        val previous = ranks
        ranks = next
        // A manager built now is handed the whole list as it builds.
        val parts = built ?: return run { parts(context) }
        reconcile(parts.manager, previous, next)
    }

    /**
     * Where the reader is in the list: the rank of the clip at the middle
     * of the screen, or of the next one below it. The manager reads the
     * clips around it in order of distance, and lets go of what is now far.
     */
    fun focus(context: Context, index: Int) {
        if (index == current && built != null) return
        current = index
        parts(context).apply {
            // The control first: moving the manager's index re-asks it
            // about every clip at once.
            control.current = index
            manager.setCurrentPlayingIndex(index)
        }
    }

    /**
     * Lets go of the manager, its thread and everything preloaded — with
     * the stage's player, when the app leaves the screen. The list and the
     * reader's place in it are kept, for the manager built on the way back.
     */
    internal fun release() {
        built?.manager?.release()
        built = null
    }

    /**
     * Test seam: forgets the list as well, the way a fresh process starts —
     * with the stage, whose player was built beside the manager going away.
     */
    internal fun reset() {
        VideoStage.release()
        ranks = emptyMap()
        current = 0
    }

    /** The clip ranks the manager was last told, by URL. */
    internal var ranks: Map<String, Int> = emptyMap()
        private set

    /** The rank of the clip the reader is at. */
    internal var current: Int = 0
        private set

    /** The preloaded source for [url], or null when the manager has none. */
    internal fun preloaded(url: String): MediaSource? = built?.manager?.getMediaSource(Media3Item.fromUri(url))

    /** How much of a clip the manager reads, by its distance from the reader's. */
    internal fun statusAt(distance: Int): PreloadStatus = when {
        distance == 0 || distance == 1 -> PreloadStatus.specifiedRangeLoaded(AHEAD_MS)
        distance == -1 -> PreloadStatus.specifiedRangeLoaded(BEHIND_MS)
        abs(distance) == 2 -> PreloadStatus.PRELOAD_STATUS_TRACKS_SELECTED
        abs(distance) <= REACH -> PreloadStatus.PRELOAD_STATUS_SOURCE_PREPARED
        else -> PreloadStatus.PRELOAD_STATUS_NOT_PRELOADED
    }

    /**
     * The opening the reader's clip and the next one get: 3 s.
     *
     * Media3's own recipe gives the next clip 3000 ms. A clip starts on half
     * a second ([VideoLoadControl.BUFFER_FOR_PLAYBACK_MS]); the rest is what
     * keeps it playing while the player's own reads catch up. At the feed's
     * median 2.8 Mbps that is about 1 MB — one step of the loader, which
     * reads in 1 MiB steps whatever it is asked for — and at the highest
     * measured, 9.7 Mbps, about 3.6 MB. The reader's own clip gets it too:
     * the recipe assumes that clip is already playing, and a card below the
     * autoplay bar is not yet.
     */
    const val AHEAD_MS = 3_000L

    /** The clip just scrolled past: 1 s, the recipe's, for a reader who turns back. */
    const val BEHIND_MS = 1_000L

    /**
     * How far the manager keeps a clip's source prepared: four clips each
     * way, the recipe's. For a progressive clip that reads nothing — the
     * point is the other half: a clip beyond two is cleared of whatever it
     * had loaded, so a clip scrolled past gives its memory back.
     */
    const val REACH = 4

    private var built: Parts? = null

    private class Parts(
        val builder: DefaultPreloadManager.Builder,
        val manager: DefaultPreloadManager,
        val control: Distance,
        val fallback: MediaSource.Factory,
    )

    /** The recipe's control: the manager asks it about each clip, by rank. */
    internal class Distance : TargetPreloadStatusControl<Int, PreloadStatus> {
        // Asked on the preload thread as well as the main one.
        @Volatile
        var current: Int = 0

        override fun getTargetPreloadStatus(rankingData: Int): PreloadStatus = statusAt(rankingData - current)
    }

    private fun parts(context: Context): Parts = built ?: build(context.applicationContext).also { parts ->
        built = parts
        parts.control.current = current
        parts.manager.setCurrentPlayingIndex(current)
        reconcile(parts.manager, emptyMap(), ranks)
    }

    private fun build(appContext: Context): Parts {
        val control = Distance()
        val dataSources = VideoStage.dataSources
        val builder = DefaultPreloadManager.Builder(appContext, control)
            .setLoadControl(VideoLoadControl.create())
            .apply { dataSources?.let { setDataSourceFactory(it) } }
        val fallback = DefaultMediaSourceFactory(appContext)
            .apply { dataSources?.let { setDataSourceFactory(it) } }
        return Parts(builder = builder, manager = builder.build(), control = control, fallback = fallback)
    }

    private fun reconcile(manager: DefaultPreloadManager, previous: Map<String, Int>, next: Map<String, Int>) {
        previous.forEach { (url, rank) -> if (next[url] != rank) manager.remove(Media3Item.fromUri(url)) }
        next.forEach { (url, rank) -> if (previous[url] != rank) manager.add(Media3Item.fromUri(url), rank) }
        manager.invalidate()
    }
}

/**
 * Tells the stage which clips a scrolling list is about to reach, so their
 * opening seconds are read before the reader gets there ([VideoPreload]).
 *
 * The component draws nothing and decides nothing about the list: the
 * screen that owns the list knows which of its rows carry a clip and
 * where the reader is, and hands both over.
 *
 * @param clips the list's clips, in the order the reader meets them.
 * @param focus which of [clips] the reader is at — read inside a snapshot,
 *   so a scroll moves it without recomposing anything.
 */
@OptIn(UnstableApi::class)
@Composable
fun PreloadClips(clips: List<String>, focus: () -> Int) {
    val context = LocalContext.current
    val currentFocus by rememberUpdatedState(focus)
    LaunchedEffect(clips) {
        VideoPreload.show(context, clips)
        snapshotFlow { currentFocus() }
            .distinctUntilChanged()
            .collect { VideoPreload.focus(context, it) }
    }
}

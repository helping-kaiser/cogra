package com.cogra.core.designsystem.v2.media

import android.content.Context
import android.net.Uri
import android.os.Looper
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.BaseDataSource
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.exoplayer.source.preload.DefaultPreloadManager.PreloadStatus
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import org.junit.After
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import java.io.IOException
import java.io.InterruptedIOException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

/**
 * The clips around the reader, read before the reader gets there.
 *
 * The measured fault: a clip asked for its first byte only when its card
 * crossed the autoplay bar, so its start waited on the network in front
 * of the reader (median 482 ms on the LAN, up to 2.9 s).
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in,
// so it propagates by being applied here — `@OptIn` has no effect on it.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
class VideoPreloadTest {

    private val context = ApplicationProvider.getApplicationContext<Context>()

    private val a = "https://media/a.mp4"
    private val b = "https://media/b.mp4"
    private val c = "https://media/c.mp4"
    private val d = "https://media/d.mp4"

    @After
    fun tearDown() {
        VideoPreload.reset()
        VideoStage.dataSources = null
    }

    @Test
    fun theReadersClipAndTheNextGetTheirOpeningSeconds() {
        assertThat(VideoPreload.statusAt(0)).isEqualTo(PreloadStatus.specifiedRangeLoaded(3_000L))
        assertThat(VideoPreload.statusAt(1)).isEqualTo(PreloadStatus.specifiedRangeLoaded(3_000L))
    }

    @Test
    fun theClipJustPassedKeepsASecond() {
        assertThat(VideoPreload.statusAt(-1)).isEqualTo(PreloadStatus.specifiedRangeLoaded(1_000L))
    }

    @Test
    fun twoAwayReadsOnlyTheHeader() {
        assertThat(VideoPreload.statusAt(2)).isEqualTo(PreloadStatus.PRELOAD_STATUS_TRACKS_SELECTED)
        assertThat(VideoPreload.statusAt(-2)).isEqualTo(PreloadStatus.PRELOAD_STATUS_TRACKS_SELECTED)
    }

    @Test
    fun fartherClipsGiveTheirMemoryBack() {
        // SOURCE_PREPARED reads nothing for a progressive clip, and it is
        // the stage at which the manager clears what a clip had loaded.
        listOf(3, -3, 4, -4).forEach {
            assertThat(VideoPreload.statusAt(it)).isEqualTo(PreloadStatus.PRELOAD_STATUS_SOURCE_PREPARED)
        }
        listOf(5, -5, 40).forEach {
            assertThat(VideoPreload.statusAt(it)).isEqualTo(PreloadStatus.PRELOAD_STATUS_NOT_PRELOADED)
        }
    }

    @Test
    fun theControlMeasuresFromTheReadersClip() {
        val control = VideoPreload.Distance().apply { current = 5 }

        assertThat(control.getTargetPreloadStatus(6)).isEqualTo(VideoPreload.statusAt(1))
        assertThat(control.getTargetPreloadStatus(4)).isEqualTo(VideoPreload.statusAt(-1))
        assertThat(control.getTargetPreloadStatus(0)).isEqualTo(VideoPreload.statusAt(-5))
    }

    @Test
    fun theListIsHandedToTheManagerByRank() {
        VideoPreload.show(context, listOf(a, b, c))

        assertThat(VideoPreload.ranks).containsExactly(a, 0, b, 1, c, 2)
        listOf(a, b, c).forEach { assertThat(VideoPreload.preloaded(it)).isNotNull() }
    }

    @Test
    fun aPageAppendedKeepsWhatWasAlreadyPreloaded() {
        VideoPreload.show(context, listOf(a, b))
        val first = VideoPreload.preloaded(a)

        VideoPreload.show(context, listOf(a, b, c))

        assertThat(VideoPreload.preloaded(a)).isSameInstanceAs(first)
        assertThat(VideoPreload.preloaded(c)).isNotNull()
    }

    @Test
    fun aClipThatLeftTheListIsLetGo() {
        VideoPreload.show(context, listOf(a, b, c))

        VideoPreload.show(context, listOf(b, c, d))

        assertThat(VideoPreload.preloaded(a)).isNull()
        assertThat(VideoPreload.preloaded(d)).isNotNull()
        assertThat(VideoPreload.ranks).containsExactly(b, 0, c, 1, d, 2)
    }

    @Test
    fun aClipThatMovedIsReaddedAtItsNewPlace() {
        // Ranking data is fixed when a clip is added; a clip whose place
        // changed has to be added again to be measured from its new one.
        VideoPreload.show(context, listOf(a, b))
        val before = VideoPreload.preloaded(b)

        VideoPreload.show(context, listOf(b, a))

        assertThat(VideoPreload.preloaded(b)).isNotSameInstanceAs(before)
        assertThat(VideoPreload.ranks).containsExactly(b, 0, a, 1)
    }

    @Test
    fun theReadersPlaceIsKept() {
        VideoPreload.show(context, listOf(a, b, c, d))

        VideoPreload.focus(context, 2)

        assertThat(VideoPreload.current).isEqualTo(2)
    }

    @Test
    fun aClipInTheListIsPlayedFromThePreloadedSource() {
        // The manage-play recipe: what the manager has been reading is
        // what the player is handed, rather than a cold start.
        VideoPreload.show(context, listOf(a, b))

        VideoStage.claim(context, b, Any())

        assertThat(VideoStage.sourceOnStage).isSameInstanceAs(VideoPreload.preloaded(b))
    }

    @Test
    fun aClipOutsideTheListStartsFromAFreshSource() {
        VideoPreload.show(context, listOf(a))

        VideoStage.claim(context, c, Any())

        assertThat(VideoStage.sourceOnStage).isNotNull()
        assertThat(VideoPreload.preloaded(c)).isNull()
    }

    @Test
    fun theListOutlivesTheManagerWhenTheAppLeaves() {
        // The stage gives everything back on the way to the background;
        // the first player built on the way back finds the same clips.
        VideoPreload.show(context, listOf(a, b))
        VideoStage.release()
        assertThat(VideoPreload.preloaded(a)).isNull()

        VideoStage.claim(context, a, Any())

        assertThat(VideoPreload.preloaded(a)).isNotNull()
        assertThat(VideoStage.sourceOnStage).isSameInstanceAs(VideoPreload.preloaded(a))
    }

    @Test
    fun thePreloadReadsThroughWhatTheAppInstalled() {
        // The app installs the disk cache as the stage's data sources, and
        // the preload manager has to read through the same ones — or a clip
        // preloaded and then scrolled past would be fetched again.
        val opened = LinkedBlockingQueue<String>()
        VideoStage.dataSources = DataSource.Factory { Offline(opened) }

        VideoPreload.show(context, listOf(a))
        VideoPreload.focus(context, 0)

        assertThat(opened.poll(10, TimeUnit.SECONDS)).isEqualTo(a)
    }

    @Test
    fun aPreloadedClipPlaysOnThePreloadThread() {
        // A preloaded source may only be prepared on the thread that
        // preloaded it. A player not built beside the manager fails that
        // check the moment it takes the source; the marker below travels
        // behind the take and arrives after any such failure would have.
        VideoStage.dataSources = DataSource.Factory { Silent() }
        VideoPreload.show(context, listOf(a))
        VideoStage.claim(context, a, Any())
        val player = checkNotNull(VideoStage.holding?.player)

        val arrived = CountDownLatch(1)
        player.createMessage { _, _ -> arrived.countDown() }.setLooper(Looper.getMainLooper()).send()
        idleUntil { arrived.count == 0L }

        assertThat(player.playerError).isNull()
    }

    private fun idleUntil(done: () -> Boolean) {
        val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10)
        while (!done() && System.nanoTime() < deadline) {
            shadowOf(Looper.getMainLooper()).idle()
            if (!done()) Thread.sleep(10)
        }
        assertThat(done()).isTrue()
    }

    /** A reader with no network behind it that says which clip it was asked for. */
    private class Offline(private val opened: LinkedBlockingQueue<String>) : BaseDataSource(true) {
        override fun open(dataSpec: DataSpec): Long {
            opened += dataSpec.uri.toString()
            throw IOException("offline")
        }

        override fun read(buffer: ByteArray, offset: Int, length: Int): Int = C.RESULT_END_OF_INPUT

        override fun getUri(): Uri? = null

        override fun close() = Unit
    }

    /**
     * A reader that does not answer while the test runs — so no load error
     * can stand in for the fault the test is looking for. It gives up when
     * the loader cancels it, and on its own well after the test is over.
     */
    private class Silent : BaseDataSource(true) {
        override fun open(dataSpec: DataSpec): Long {
            try {
                CountDownLatch(1).await(SILENT_SECONDS, TimeUnit.SECONDS)
            } catch (interrupted: InterruptedException) {
                throw InterruptedIOException(interrupted.message)
            }
            throw IOException("silent")
        }

        override fun read(buffer: ByteArray, offset: Int, length: Int): Int = C.RESULT_END_OF_INPUT

        override fun getUri(): Uri? = null

        override fun close() = Unit
    }

    private companion object {
        const val SILENT_SECONDS = 30L
    }
}

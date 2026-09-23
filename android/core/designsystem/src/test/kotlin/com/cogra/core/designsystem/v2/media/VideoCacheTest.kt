package com.cogra.core.designsystem.v2.media

import android.content.Context
import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.BaseDataSource
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSourceUtil
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.cache.Cache
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.SimpleCache
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import kotlin.math.min

/**
 * The disk cache every stage player reads through.
 *
 * The measured fault: a looping card clip fetched its whole file once
 * per loop, and scrolling back to a clip fetched it again. Both are the
 * same question asked of the reader the player is handed — does a
 * second read of bytes it already fetched touch the network?
 */
// Media3's `UnstableApi` is a lint marker rather than a Kotlin opt-in,
// so it propagates by being applied here — `@OptIn` has no effect on it.
@UnstableApi
@RunWith(RobolectricTestRunner::class)
class VideoCacheTest {

    @get:Rule
    val folder = TemporaryFolder()

    private val context = ApplicationProvider.getApplicationContext<Context>()
    private val opened = mutableListOf<SimpleCache>()

    private val clip = "https://media/clip.mp4"
    private val other = "https://media/other.mp4"
    private val third = "https://media/third.mp4"

    @After
    fun tearDown() = opened.forEach { it.release() }

    @Test
    fun aLoopReadsTheClipFromDiskRatherThanTheNetwork() {
        // `REPEAT_MODE_ONE` opens the clip again from byte zero for every
        // loop; the second open is the one that must stay off the network.
        val network = Network(clip to bytes(64 * 1024))
        val reader = VideoCache.dataSourceFactory(openCache(), network)

        val firstLoop = readAll(reader, clip)
        val secondLoop = readAll(reader, clip)

        assertThat(secondLoop).isEqualTo(firstLoop)
        assertThat(network.opens).isEqualTo(1)
        assertThat(network.bytesServed).isEqualTo(64 * 1024L)
    }

    @Test
    fun aClipScrolledBackToIsReadFromDiskByTheNextPlayer() {
        // Every claim builds a new player with a new reader; what they
        // share is the cache, so a revisit is free too.
        val network = Network(clip to bytes(32 * 1024))
        val cache = openCache()

        readAll(VideoCache.dataSourceFactory(cache, network), clip)
        readAll(VideoCache.dataSourceFactory(cache, network), clip)

        assertThat(network.opens).isEqualTo(1)
    }

    @Test
    fun theCacheLetsGoOfTheClipUsedLongestAgoAtItsBound() {
        // Bounded, least-recently-used: room for two of these clips, so
        // the third pushes out the first and keeps the two most recent.
        val size = 8 * 1024
        val network = Network(clip to bytes(size), other to bytes(size), third to bytes(size))
        val cache = openCache(maxBytes = 2L * size + size / 2)
        val reader = VideoCache.dataSourceFactory(cache, network)

        readAll(reader, clip)
        readAll(reader, other)
        readAll(reader, third)

        assertThat(cache.isCached(clip, 0, size.toLong())).isFalse()
        assertThat(cache.isCached(other, 0, size.toLong())).isTrue()
        assertThat(cache.isCached(third, 0, size.toLong())).isTrue()
    }

    @Test
    fun theProcessHasOneCache() {
        // `SimpleCache` locks its folder; a second instance would throw.
        val cache = VideoCache.cache(context)
        assertThat(VideoCache.cache(context)).isSameInstanceAs(cache)
        settle(cache)
    }

    @Test
    fun thePlayersReaderIsTheProcessCache() {
        val reader = VideoCache.dataSourceFactory(context).createDataSource()

        assertThat(reader).isInstanceOf(CacheDataSource::class.java)
        assertThat((reader as CacheDataSource).cache).isSameInstanceAs(VideoCache.cache(context))
        settle(reader.cache)
    }

    @Test
    fun theBoundIsTwoHundredFiftySixMebibytes() {
        assertThat(VideoCache.MAX_BYTES).isEqualTo(268_435_456L)
    }

    private fun openCache(maxBytes: Long = VideoCache.MAX_BYTES): SimpleCache =
        VideoCache.build(folder.newFolder(), StandaloneDatabaseProvider(context), maxBytes)
            .also { opened += it }

    private fun readAll(factory: DataSource.Factory, uri: String): ByteArray {
        val source = factory.createDataSource()
        return try {
            source.open(DataSpec(Uri.parse(uri)))
            DataSourceUtil.readToEnd(source)
        } finally {
            source.close()
        }
    }

    private fun bytes(size: Int) = ByteArray(size) { it.toByte() }

    // `SimpleCache` indexes its folder on a thread of its own, holding the
    // cache's lock while it does; any locked call waits it out. Without
    // this the thread outlives the test and touches a sandbox Robolectric
    // has already torn down.
    private fun settle(cache: Cache) {
        assertThat(cache.cacheSpace).isAtLeast(0L)
    }

    /** A stand-in for the media server that counts what it was asked for. */
    private class Network(vararg files: Pair<String, ByteArray>) : DataSource.Factory {
        private val files = files.toMap()
        var opens = 0
            private set
        var bytesServed = 0L
            private set

        override fun createDataSource(): DataSource = Served()

        private inner class Served : BaseDataSource(true) {
            private var uri: Uri? = null
            private var data = ByteArray(0)
            private var position = 0
            private var end = 0

            override fun open(dataSpec: DataSpec): Long {
                opens++
                transferInitializing(dataSpec)
                data = files.getValue(dataSpec.uri.toString())
                position = dataSpec.position.toInt()
                end = if (dataSpec.length == C.LENGTH_UNSET.toLong()) {
                    data.size
                } else {
                    position + dataSpec.length.toInt()
                }
                uri = dataSpec.uri
                transferStarted(dataSpec)
                return (end - position).toLong()
            }

            override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
                if (length == 0) return 0
                if (position == end) return C.RESULT_END_OF_INPUT
                val count = min(length, end - position)
                System.arraycopy(data, position, buffer, offset, count)
                position += count
                bytesServed += count
                bytesTransferred(count)
                return count
            }

            override fun getUri(): Uri? = uri

            override fun close() {
                if (uri != null) {
                    uri = null
                    transferEnded()
                }
            }
        }
    }
}

package com.cogra.core.designsystem.v2.media

import android.content.Context
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.DatabaseProvider
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.cache.Cache
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import java.io.File

/**
 * The bytes of every clip the app has played, kept on disk.
 *
 * **Why a cache at all.** A clip on a card loops, and Media3 plays each
 * loop of `REPEAT_MODE_ONE` as a new period with its own load — without
 * a cache every loop fetched the whole file again, and scrolling back to
 * a clip fetched it a third time. Media's objects are content-addressed
 * and served `immutable`, so a byte fetched once is a byte that never
 * changes: the ideal thing to keep. Media3's own recipe is a
 * `SimpleCache` behind a `CacheDataSource`
 * (developer.android.com/media/media3/exoplayer/network-stacks#caching),
 * and this is that recipe.
 *
 * **One instance for the process.** `SimpleCache` locks its directory —
 * a second instance on the same folder throws — and the recipe says as
 * much: the database provider and the cache "should be a singleton in
 * your app". The player comes and goes with the clip on stage; the
 * cache does not, so the next clip, the next loop and the next visit all
 * read the same store. Built lazily on first use, the way Media3's own
 * short-form demo builds its cache (`DemoUtil.getDownloadCache`), so a
 * session that never plays a clip never opens it.
 *
 * **Installed by the app, not assumed by the stage.** The app shell
 * hands [dataSourceFactory] to [VideoStage.dataSources] — the same way
 * it wires the stage to the process lifecycle — so the cache is a
 * process fact the shell decides, and a component rendered anywhere
 * else (a test, a preview) never opens a disk cache it did not ask for.
 *
 * **Bounded, in the cache directory.** An on-the-fly cache "should evict
 * media when reaching a maximum disk space limit", so the evictor is
 * least-recently-used at [MAX_BYTES]. It lives under `cacheDir` because
 * that is Android's place for data the system may reclaim when storage
 * runs low — every byte here can be fetched again — and `SimpleCache`
 * tolerates files deleted underneath it (it drops the stale spans and
 * reads them from the network).
 */
@UnstableApi
object VideoCache {

    /**
     * The disk the cache may use: 256 MiB.
     *
     * The upload cap is 100 MiB per clip, so the bound always holds the
     * largest clip there can be with room for more; at the feed's median
     * of about 5 MB it holds some fifty clips — far more than one
     * session scrolls back over.
     */
    const val MAX_BYTES: Long = 256L * 1024 * 1024

    /** The cache's own folder under `cacheDir`; `SimpleCache` must own it outright. */
    const val DIRECTORY = "media3-video"

    @Volatile
    private var instance: Cache? = null

    /** The process's cache, opened on first use. */
    fun cache(context: Context): Cache = instance ?: synchronized(this) {
        instance ?: build(
            directory = File(context.applicationContext.cacheDir, DIRECTORY),
            databaseProvider = StandaloneDatabaseProvider(context.applicationContext),
        ).also { instance = it }
    }

    /**
     * What the stage's players read through — the app installs it as
     * [VideoStage.dataSources] at startup: the cache first, the network
     * for anything the cache does not hold yet.
     *
     * The cache is opened on the first read rather than here, so
     * installing this costs the app's start nothing. The upstream is the
     * same `DefaultDataSource` a player gets when nothing is set, so
     * every scheme it played before still plays.
     */
    fun dataSourceFactory(context: Context): DataSource.Factory {
        val appContext = context.applicationContext
        return DataSource.Factory {
            dataSourceFactory(cache(appContext), DefaultDataSource.Factory(appContext)).createDataSource()
        }
    }

    internal fun build(
        directory: File,
        databaseProvider: DatabaseProvider,
        maxBytes: Long = MAX_BYTES,
    ): SimpleCache = SimpleCache(directory, LeastRecentlyUsedCacheEvictor(maxBytes), databaseProvider)

    // A cache that cannot be read or written is a reason to go to the
    // network, never a reason for the clip to fail — the flag Media3's
    // main demo reads its cache with (`DemoUtil.buildReadOnlyCacheDataSource`).
    internal fun dataSourceFactory(cache: Cache, upstream: DataSource.Factory): CacheDataSource.Factory =
        CacheDataSource.Factory()
            .setCache(cache)
            .setUpstreamDataSourceFactory(upstream)
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
}

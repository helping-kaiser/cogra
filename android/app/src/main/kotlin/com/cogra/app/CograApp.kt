package com.cogra.app

import android.app.Application
import android.content.Context
import android.util.Log
import androidx.annotation.OptIn
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.media3.common.util.UnstableApi
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.video.VideoFrameDecoder
import com.cogra.core.designsystem.v2.media.VideoCache
import com.cogra.core.designsystem.v2.media.VideoStage
import com.cogra.core.designsystem.v2.media.VideoStageLifecycle
import com.cogra.domain.CograLog
import com.cogra.domain.history.SeenTracker
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

/**
 * The shell.
 *
 * It also owns Coil's singleton loader, because a video tile has to draw
 * a frame of itself: Coil decodes stills out of the box but reads no
 * video without `VideoFrameDecoder`, and the pick grid, the picked tray
 * and every gallery poster are all one loader
 * (coil-kt.github.io/coil/videos/).
 *
 * And it is where the log is turned on. `CograLog` writes nothing until
 * a sink is installed, and this is the only place that installs one —
 * under the *app's* own `BuildConfig.DEBUG`, which is the build the
 * user is running rather than the variant some library was compiled as.
 *
 * It is also where the video stage meets the only lifecycle whose scope
 * matches it — the process's, so a backgrounded app holds no decoder —
 * and the disk cache every clip is read through, one per process as
 * Media3's caching recipe asks (`VideoCache`). The cache itself opens on
 * the first clip read, not here.
 *
 * The seen tracker meets the same lifecycle for the same reason: its
 * queue is process-wide, so the app going to the background — from any
 * screen, not only a list — is the checkpoint that sends what is left.
 */
@HiltAndroidApp
class CograApp : Application(), SingletonImageLoader.Factory {

    // Lazy: the tracker pulls in the network stack, which app start has no
    // reason to build; the first list a reader opens builds it anyway.
    @Inject lateinit var seenTracker: dagger.Lazy<SeenTracker>

    @OptIn(UnstableApi::class)
    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.DEBUG) {
            CograLog.install { tag, message, cause ->
                if (cause == null) Log.w("CoGra/$tag", message) else Log.w("CoGra/$tag", message, cause)
            }
        }
        ProcessLifecycleOwner.get().lifecycle.addObserver(VideoStageLifecycle)
        // `ON_STOP` of the process, dispatched once the whole app is in the
        // background and never on a configuration change
        // (developer.android.com/reference/androidx/lifecycle/ProcessLifecycleOwner).
        ProcessLifecycleOwner.get().lifecycle.addObserver(
            LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_STOP) seenTracker.get().flush() },
        )
        VideoStage.dataSources = VideoCache.dataSourceFactory(this)
    }

    override fun newImageLoader(context: PlatformContext): ImageLoader =
        ImageLoader.Builder(context)
            .components { add(VideoFrameDecoder.Factory()) }
            .build()
}

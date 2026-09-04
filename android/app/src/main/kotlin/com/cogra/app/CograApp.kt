package com.cogra.app

import android.app.Application
import android.content.Context
import android.util.Log
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.video.VideoFrameDecoder
import com.cogra.domain.CograLog
import dagger.hilt.android.HiltAndroidApp

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
 */
@HiltAndroidApp
class CograApp : Application(), SingletonImageLoader.Factory {

    override fun onCreate() {
        super.onCreate()
        if (BuildConfig.DEBUG) {
            CograLog.install { tag, message, cause ->
                if (cause == null) Log.w("CoGra/$tag", message) else Log.w("CoGra/$tag", message, cause)
            }
        }
    }

    override fun newImageLoader(context: PlatformContext): ImageLoader =
        ImageLoader.Builder(context)
            .components { add(VideoFrameDecoder.Factory()) }
            .build()
}

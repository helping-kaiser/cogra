package com.cogra.app

import android.app.Application
import android.content.Context
import androidx.lifecycle.ProcessLifecycleOwner
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.video.VideoFrameDecoder
import com.cogra.core.designsystem.v2.media.VideoStageLifecycle
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
 * And it is where the video stage meets the only lifecycle whose scope
 * matches it — the process's, so a backgrounded app holds no decoder.
 */
@HiltAndroidApp
class CograApp : Application(), SingletonImageLoader.Factory {

    override fun onCreate() {
        super.onCreate()
        ProcessLifecycleOwner.get().lifecycle.addObserver(VideoStageLifecycle)
    }

    override fun newImageLoader(context: PlatformContext): ImageLoader =
        ImageLoader.Builder(context)
            .components { add(VideoFrameDecoder.Factory()) }
            .build()
}

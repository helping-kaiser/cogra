package com.cogra.core.designsystem.v2.media

import androidx.annotation.OptIn
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.media3.common.util.UnstableApi

/**
 * Gives the decoder back when the app leaves the screen.
 *
 * [VideoStage] deliberately keeps its player across a navigation — that
 * is what carries a clip from the feed to the detail. Nothing about that
 * argument survives the app going to the background: ExoPlayer's guidance
 * is to release a player "so as to free up limited resources such as
 * video decoders" once it is no longer needed
 * (developer.android.com/media/media3/exoplayer/hello-world), and a
 * process nobody is looking at needs none.
 *
 * **The process, not a screen.** A decoder held by a
 * process-lifetime singleton is a process-lifetime cost, so the lifecycle
 * that decides it has to have the same scope: `ProcessLifecycleOwner`
 * dispatches `ON_STOP` when the whole app goes to the background and
 * deliberately does not on a configuration change
 * (developer.android.com/reference/androidx/lifecycle/ProcessLifecycleOwner),
 * where an activity's own `onStop` would throw the clip away on every
 * rotation. It also covers the case no surface can: the reader walked to
 * a screen with no video on it and then left the app.
 *
 * Coming back rebuilds the player from zero. That is the trade Media3's
 * guidance assumes, and the surface asks for it again on `ON_START` —
 * see `VideoPlayer`'s `LifecycleStartEffect`.
 */
@OptIn(UnstableApi::class)
object VideoStageLifecycle : DefaultLifecycleObserver {

    override fun onStop(owner: LifecycleOwner) {
        VideoStage.release()
    }
}

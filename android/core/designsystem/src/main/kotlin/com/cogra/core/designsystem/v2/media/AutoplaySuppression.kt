package com.cogra.core.designsystem.v2.media

import android.content.Context
import android.net.ConnectivityManager
import android.provider.Settings
import androidx.compose.runtime.staticCompositionLocalOf

/**
 * WHEN THE DEVICE SUPPRESSES AUTOPLAY — the stage law's one input from the
 * reader's own settings: "ALWAYS the device suppresses autoplay GIVEN it asks
 * for reduced motion or data saver" (FeedCover.md:23). The web reads the two
 * requests where the browser publishes them (`autoplay-suppression.ts`:
 * `prefers-reduced-motion`, `navigator.connection.saveData`); this reads them
 * where Android publishes them.
 *
 * - **Reduced motion is "Remove animations"**, the accessibility setting
 *   (Settings › Accessibility › Color and motion), which sets the system's
 *   animator duration scale to zero — `Settings.Global.ANIMATOR_DURATION_SCALE`
 *   (developer.android.com/reference/android/provider/Settings.Global#ANIMATOR_DURATION_SCALE).
 *   The scale is read itself rather than through
 *   `ValueAnimator.areAnimatorsEnabled()`, whose answer also turns false under
 *   Battery Saver (developer.android.com/reference/android/animation/ValueAnimator#areAnimatorsEnabled()):
 *   battery saving is not a request the law names.
 * - **Data saver is Android's Data Saver**, read as its own guide reads it
 *   (developer.android.com/develop/connectivity/network-ops/data-saver): the
 *   active network is metered AND `getRestrictBackgroundStatus()` is
 *   `RESTRICT_BACKGROUND_STATUS_ENABLED` — "Wherever possible, the app should
 *   also use less data in the foreground". `…_WHITELISTED` is the reader
 *   exempting this app, so it suppresses nothing; off a metered network Data
 *   Saver restricts nothing either.
 *
 * Read at the moment a rule asks, never followed: on the detail the law reads
 * suppression at the open (:9) and at a dismissal (:47) and nowhere else — "the
 * open is the only start", and a mid-play flip stops nothing (ruling 96).
 */
fun interface AutoplaySuppression {

    /** Whether the device suppresses autoplay, right now. */
    fun suppressed(context: Context): Boolean

    companion object {

        /** The platform's answer: Remove animations, or Data Saver on a metered network. */
        val Device = AutoplaySuppression { context -> removesAnimations(context) || savesData(context) }

        internal fun removesAnimations(context: Context): Boolean =
            Settings.Global.getFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f

        internal fun savesData(context: Context): Boolean {
            val connectivity = context.getSystemService(ConnectivityManager::class.java) ?: return false
            return connectivity.isActiveNetworkMetered &&
                connectivity.restrictBackgroundStatus == ConnectivityManager.RESTRICT_BACKGROUND_STATUS_ENABLED
        }
    }
}

/** Where the stage asks whether autoplay is suppressed; tests provide their own answer. */
val LocalAutoplaySuppression = staticCompositionLocalOf { AutoplaySuppression.Device }

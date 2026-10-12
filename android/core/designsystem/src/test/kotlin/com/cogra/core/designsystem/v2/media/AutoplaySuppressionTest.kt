package com.cogra.core.designsystem.v2.media

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkInfo
import android.provider.Settings
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.shadows.ShadowNetworkInfo

/**
 * "ALWAYS the device suppresses autoplay GIVEN it asks for reduced motion or
 * data saver" (FeedCover.md:23), read where Android publishes the two
 * requests ([AutoplaySuppression.Device]).
 */
@RunWith(RobolectricTestRunner::class)
class AutoplaySuppressionTest {

    private val context: Context = ApplicationProvider.getApplicationContext()
    private val connectivity = context.getSystemService(ConnectivityManager::class.java)

    @Test
    fun aDeviceAskingForNeitherAllowsAutoplay() {
        assertThat(AutoplaySuppression.Device.suppressed(context)).isFalse()
    }

    /** Reduced motion: Remove animations sets the animator duration scale to zero. */
    @Test
    fun removeAnimationsSuppressesAutoplay() {
        Settings.Global.putFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 0f)

        assertThat(AutoplaySuppression.Device.suppressed(context)).isTrue()
    }

    /** A slowed or quickened scale is not the request: only zero removes animations. */
    @Test
    fun aScaledAnimatorIsNotReducedMotion() {
        Settings.Global.putFloat(context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 0.5f)

        assertThat(AutoplaySuppression.Device.suppressed(context)).isFalse()
    }

    /** Data saver: Data Saver on, over a metered network — the data-saver guide's own check. */
    @Test
    fun dataSaverOnAMeteredNetworkSuppressesAutoplay() {
        assertThat(connectivity.isActiveNetworkMetered).isTrue()
        shadowOf(connectivity).setRestrictBackgroundStatus(ConnectivityManager.RESTRICT_BACKGROUND_STATUS_ENABLED)

        assertThat(AutoplaySuppression.Device.suppressed(context)).isTrue()
    }

    /** The reader exempting this app from Data Saver asks for nothing of it. */
    @Test
    fun anAppExemptFromDataSaverIsNotSuppressed() {
        shadowOf(connectivity).setRestrictBackgroundStatus(ConnectivityManager.RESTRICT_BACKGROUND_STATUS_WHITELISTED)

        assertThat(AutoplaySuppression.Device.suppressed(context)).isFalse()
    }

    /** Off a metered network Data Saver restricts nothing. */
    @Test
    fun dataSaverOffAMeteredNetworkIsNotSuppressed() {
        shadowOf(connectivity).setRestrictBackgroundStatus(ConnectivityManager.RESTRICT_BACKGROUND_STATUS_ENABLED)
        shadowOf(connectivity).setActiveNetworkInfo(
            ShadowNetworkInfo.newInstance(
                NetworkInfo.DetailedState.CONNECTED,
                ConnectivityManager.TYPE_WIFI,
                0,
                true,
                NetworkInfo.State.CONNECTED,
            ),
        )
        assertThat(connectivity.isActiveNetworkMetered).isFalse()

        assertThat(AutoplaySuppression.Device.suppressed(context)).isFalse()
    }
}

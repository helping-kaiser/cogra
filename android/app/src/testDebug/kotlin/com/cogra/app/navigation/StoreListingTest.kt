package com.cogra.app.navigation

import android.app.Activity
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.ResolveInfo
import android.net.Uri
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf

/**
 * `Update now` in the app opens CoGra's store listing — the download, never a
 * page of the code repository (WhatsNewBehind.md:15; FeedNewerVersion.md:19, :23).
 * Launched from an activity, as the destinations' `LocalContext` is one.
 */
@RunWith(RobolectricTestRunner::class)
class StoreListingTest {

    private val activity: Activity = Robolectric.buildActivity(Activity::class.java).setup().get()

    private val web = "https://play.google.com/store/apps/details?id=local.cogra.app"

    @Test
    fun updateNowOpensTheStoreListingInTheStoreApp() {
        openStoreListing(activity)
        val opened = shadowOf(activity).nextStartedActivity
        assertThat(opened.action).isEqualTo(Intent.ACTION_VIEW)
        assertThat(opened.data.toString()).isEqualTo("market://details?id=local.cogra.app")
    }

    @Test
    fun withoutAStoreAppTheListingOpensOnTheWeb() {
        // Only a browser resolves: `market://` has no handler on this device.
        val shadow = shadowOf(activity)
        shadowOf(activity.application).checkActivities(true)
        val browser = ResolveInfo().apply {
            activityInfo = ActivityInfo().apply {
                packageName = "com.example.browser"
                name = "Browser"
            }
        }
        shadowOf(activity.packageManager).addResolveInfoForIntent(Intent(Intent.ACTION_VIEW, Uri.parse(web)), browser)
        openStoreListing(activity)
        val opened = shadow.nextStartedActivity
        assertThat(opened.action).isEqualTo(Intent.ACTION_VIEW)
        assertThat(opened.data.toString()).isEqualTo(web)
    }
}

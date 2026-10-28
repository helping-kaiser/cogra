// The Profile slot's re-tap over the profile's own root (Profile.md:61-63;
// design/readme.md §13): scrolled, the profile travels back to its top and
// never reloads; at its top, nothing happens.

package com.cogra.feature.profile

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performScrollToIndex
import com.cogra.crypto.Family
import com.cogra.domain.RecordRow
import com.cogra.domain.testing.testProfile
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ProfileReselectTest {

    @get:Rule
    val compose = createComposeRule()

    private var reselects by mutableIntStateOf(0)
    private var reloads = 0

    private fun render() {
        val state = ProfileUiState(
            loading = false,
            profile = testProfile(id = "u1", handle = "ada"),
            own = true,
            rows = List(ACTS) { RecordRow("r$it", Family.PUBLISH, true, "Act $it", null) },
        )
        compose.setContent {
            ProfileScreen(
                state = state,
                reselectSignal = reselects,
                profileSavedResult = false,
                onProfileSavedResultConsumed = {},
                onFilterChange = {},
                onLoadMore = {},
                onRetry = { reloads += 1 },
                onEdit = {},
                onOpenSettings = {},
                onOpenInvites = {},
                onOpenPost = {},
                onBack = null,
            )
        }
        compose.waitForIdle()
    }

    private fun headerShown() =
        compose.onAllNodesWithTag("profile.identity.name").fetchSemanticsNodes().isNotEmpty()

    @Test
    fun aRetapOverTheScrolledProfileTravelsToItsTopAndNeverReloads() {
        render()
        compose.onNodeWithTag("profile.chronicle").performScrollToIndex(ACTS)
        compose.waitForIdle()
        assertThat(headerShown()).isFalse()

        compose.runOnIdle { reselects += 1 }
        compose.waitForIdle()

        assertThat(headerShown()).isTrue()
        assertThat(reloads).isEqualTo(0)
    }

    @Test
    fun aRetapOverTheProfileAtItsTopDoesNothing() {
        render()
        assertThat(headerShown()).isTrue()

        compose.runOnIdle { reselects += 1 }
        compose.waitForIdle()

        assertThat(headerShown()).isTrue()
        assertThat(reloads).isEqualTo(0)
    }

    private companion object {
        const val ACTS = 40
    }
}

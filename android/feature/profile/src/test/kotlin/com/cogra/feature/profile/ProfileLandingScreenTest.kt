// The landing as the screen draws it (ProfileOther.md:21, Profile.md:25): the
// state a profile opens with lights the Posts tab and stands the posts view
// below the row — never Everything's chronicle, never Comments.

package com.cogra.feature.profile

import androidx.compose.ui.test.assertIsNotSelected
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.domain.testing.testProfile
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ProfileLandingScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private var picked: ProfileTab? = null

    /** The state a profile opens with, its tab left as the landing sets it. */
    private fun render(own: Boolean) {
        compose.setContent {
            ProfileScreen(
                state = ProfileUiState(loading = false, profile = testProfile(id = "u1", handle = "ada"), own = own),
                profileSavedResult = false,
                onProfileSavedResultConsumed = {},
                onTabChange = { picked = it },
                onLoadMore = {},
                onRetry = {},
                onEdit = {},
                onOpenSettings = {},
                onOpenInvites = {},
                onOpenPost = {},
                onBack = if (own) null else ({}),
            )
        }
        compose.waitForIdle()
    }

    private fun assertLandedOnPosts() {
        compose.onNodeWithTag("profile.tabRow.postsTab").assertIsSelected()
        compose.onNodeWithTag("profile.tabRow.commentsTab").assertIsNotSelected()
        compose.onNodeWithTag("profile.tabRow.everythingTab").assertIsNotSelected()
        compose.onNodeWithTag("profile.posts.empty").performScrollTo().assertExists()
        assertThat(compose.onAllNodesWithTag("profile.chronicle").fetchSemanticsNodes()).isEmpty()
    }

    // ProfileOther.md:21 — another's profile.
    @Test
    fun anothersProfileLandsWithThePostsTabLit() {
        render(own = false)
        assertLandedOnPosts()
    }

    // Profile.md:25 — the reader's own.
    @Test
    fun theOwnProfileLandsWithThePostsTabLit() {
        render(own = true)
        assertLandedOnPosts()
    }

    // ProfileOther.md:23 — Everything is one tap away, and the tap asks for it.
    @Test
    fun everythingIsChosenByItsTab() {
        render(own = false)
        compose.onNodeWithTag("profile.tabRow.everythingTab").performScrollTo().performClick()
        assertThat(picked).isEqualTo(ProfileTab.EVERYTHING)
    }
}

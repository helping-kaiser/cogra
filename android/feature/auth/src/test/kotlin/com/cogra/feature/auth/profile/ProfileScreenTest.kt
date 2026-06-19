package com.cogra.feature.auth.profile

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.cogra.feature.auth.testutil.testUser
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class ProfileScreenTest {

    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun editButtonIsShownAndFiresTheCallback() {
        var edited = false
        composeRule.setContent {
            ProfileScreen(
                state = ProfileUiState(isLoading = false, user = testUser()),
                onRetry = {},
                onLogout = {},
                onEditProfile = { edited = true },
            )
        }

        composeRule.onNodeWithTag(ProfileTestTags.EDIT).assertIsDisplayed().performClick()
        assertThat(edited).isTrue()
    }
}

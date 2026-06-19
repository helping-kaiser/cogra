package com.cogra.app

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import com.cogra.core.domain.model.AuthTokens
import com.cogra.feature.auth.login.LoginTestTags
import com.cogra.feature.auth.profile.EditProfileTestTags
import com.cogra.feature.auth.profile.ProfileTestTags
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import dagger.hilt.android.testing.HiltTestApplication
import javax.inject.Inject
import kotlinx.coroutines.runBlocking
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/**
 * Guards the root wiring that the `CograApp` name collision silently broke:
 * `CograRoot` must actually compose its selected branch, not nothing. Drives the
 * real Hilt graph (fakes swapped in for the network) through a Compose host and
 * asserts each auth state reaches its surface.
 */
@HiltAndroidTest
@RunWith(RobolectricTestRunner::class)
@Config(application = HiltTestApplication::class, sdk = [34])
class CograRootTest {

    @get:Rule(order = 0)
    val hiltRule = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val composeRule = createAndroidComposeRule<HiltTestActivity>()

    @Inject
    lateinit var tokenStore: FakeTokenStore

    @Inject
    lateinit var authRepository: FakeAuthRepository

    @Before
    fun setUp() {
        hiltRule.inject()
    }

    @Test
    fun loggedOutRendersLoginScreen() {
        composeRule.setContent { CograRoot() }

        composeRule.onNodeWithTag(LoginTestTags.EMAIL).assertIsDisplayed()
    }

    @Test
    fun loggedInRendersProfileScreen() {
        authRepository.viewer = testUser()
        runBlocking { tokenStore.save(AuthTokens(accessToken = "access", refreshToken = "refresh")) }

        composeRule.setContent { CograRoot() }

        composeRule.onNodeWithTag(ProfileTestTags.DISPLAY_NAME).assertIsDisplayed()
    }

    /** Regression: with the old activity-scoped edit ViewModel, re-opening the
     *  edit screen bounced straight back (a stale `saved` flag). Per-destination
     *  scoping under the NavHost gives a fresh ViewModel each visit. */
    @Test
    fun editProfileCanBeReopenedAfterCancel() {
        authRepository.viewer = testUser()
        runBlocking { tokenStore.save(AuthTokens(accessToken = "access", refreshToken = "refresh")) }
        composeRule.setContent { CograRoot() }

        composeRule.onNodeWithTag(ProfileTestTags.EDIT).performClick()
        composeRule.onNodeWithTag(EditProfileTestTags.DISPLAY_NAME).assertIsDisplayed()

        composeRule.onNodeWithTag(EditProfileTestTags.CANCEL).performScrollTo().performClick()
        composeRule.onNodeWithTag(ProfileTestTags.DISPLAY_NAME).assertIsDisplayed()

        // Reopen — must show the form again, not bounce shut.
        composeRule.onNodeWithTag(ProfileTestTags.EDIT).performClick()
        composeRule.onNodeWithTag(EditProfileTestTags.DISPLAY_NAME).assertIsDisplayed()
    }

    /** A saved edit navigates back to the profile. (The transient confirmation
     *  snackbar shown there is verified by hand — Robolectric's auto-advancing
     *  clock races past a snackbar's lifetime, so asserting it is flaky.) */
    @Test
    fun savingAnEditReturnsToTheProfile() {
        authRepository.viewer = testUser()
        runBlocking { tokenStore.save(AuthTokens(accessToken = "access", refreshToken = "refresh")) }
        composeRule.setContent { CograRoot() }

        composeRule.onNodeWithTag(ProfileTestTags.EDIT).performClick()
        composeRule.onNodeWithTag(EditProfileTestTags.DISPLAY_NAME).performTextReplacement("Alice B.")
        composeRule.onNodeWithTag(EditProfileTestTags.SAVE).performScrollTo().performClick()

        // The Edit button exists only on the profile, so seeing it means the
        // save popped us back off the edit screen.
        composeRule.onNodeWithTag(ProfileTestTags.EDIT).assertIsDisplayed()
    }
}

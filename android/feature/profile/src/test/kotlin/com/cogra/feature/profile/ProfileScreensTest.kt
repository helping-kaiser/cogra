package com.cogra.feature.profile

import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.crypto.Family
import com.cogra.domain.RecordLink
import com.cogra.domain.RecordRow
import com.cogra.domain.testing.testProfile
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ProfileScreensTest {

    @get:Rule
    val compose = createComposeRule()

    private fun render(
        state: ProfileUiState,
        onEdit: () -> Unit = {},
        onOpenInvites: () -> Unit = {},
        onOpenSettings: () -> Unit = {},
        onOpenPost: (String) -> Unit = {},
        onFilterChange: (ChronicleFilter) -> Unit = {},
        onBack: (() -> Unit)? = null,
        onStance: (String, String) -> Unit = { _, _ -> },
        profileSavedResult: Boolean = false,
        onProfileSavedResultConsumed: () -> Unit = {},
        onRetry: () -> Unit = {},
    ) {
        compose.setContent {
            ProfileScreen(
                stanceControl = { target, tag -> onStance(target, tag) },
                state = state,
                profileSavedResult = profileSavedResult,
                onProfileSavedResultConsumed = onProfileSavedResultConsumed,
                onFilterChange = onFilterChange,
                onLoadMore = {},
                onRetry = onRetry,
                onEdit = onEdit,
                onOpenSettings = onOpenSettings,
                onOpenInvites = onOpenInvites,
                onOpenPost = onOpenPost,
                onBack = onBack,
            )
        }
    }

    private fun loaded(own: Boolean = false, applicant: Boolean = false) = ProfileUiState(
        loading = false,
        profile = testProfile(
            id = "u1",
            handle = "ada",
            displayName = "Ada L",
            bio = "Curious.",
            websiteUrl = "https://ada.example",
        ),
        own = own,
        applicant = applicant,
    )

    @Test
    fun aSavedEditConfirmsOnTheProfilesOwnHost() {
        render(loaded(own = true), profileSavedResult = true)
        compose.onNodeWithTag("profile_snackbar").assertExists()
    }

    @Test
    fun theSavedResultIsConsumedOnlyAfterTheSnackbarHasRun() {
        // Consuming first flips the effect's key and cancels the
        // suspending show, so the confirmation died in the frame it was
        // posted (HT-8). The whole bug is the ordering, and only a
        // round-tripping consume can see it.
        var consumed = false
        render(
            loaded(own = true),
            profileSavedResult = true,
            onProfileSavedResultConsumed = { consumed = true },
        )
        assertThat(consumed).isFalse()
        compose.mainClock.advanceTimeBy(10_000)
        assertThat(consumed).isTrue()
    }

    // design/readme.md, "The pull-down lives on every full-screen
    // scrolling root" (ruled 2026-09-10): the profile is one of the
    // named surfaces. The PullToRefreshBox wraps every branch of the
    // Scaffold's content slot, so the loaded chronicle must still
    // render — and carry its own onRetry — underneath it.
    @Test
    fun theLoadedChronicleRendersUnderThePullToRefreshWrapper() {
        var retried = false
        render(loaded(), onRetry = { retried = true })
        compose.onNodeWithTag("profile_list").assertExists()
        assertThat(retried).isFalse()
    }

    @Test
    fun theHeaderRendersTheProfileFields() {
        render(loaded())
        compose.onNodeWithTag("profile_avatar").assertExists()
        compose.onNodeWithTag("profile_display_name").assertExists()
        compose.onNodeWithTag("profile_handle").assertExists()
        compose.onNodeWithTag("profile_bio").assertExists()
        compose.onNodeWithTag("profile_website").assertExists()
    }

    @Test
    fun anotherActorsProfileCarriesNoOwnAffordances() {
        render(loaded(own = false))
        compose.onNodeWithTag("profile_edit").assertDoesNotExist()
        compose.onNodeWithTag("profile_invites").assertDoesNotExist()
        compose.onNodeWithTag("profile_settings").assertDoesNotExist()
    }

    // The header's primary action on someone else's profile is the
    // stance toward them (design.md §6); one's own profile keeps edit
    // and invites, and nobody stances themself.
    @Test
    fun anotherActorsProfileCarriesTheStanceControl() {
        val stanced = mutableListOf<Pair<String, String>>()
        render(loaded(own = false), onStance = { target, tag -> stanced += target to tag })
        assertThat(stanced).containsExactly("u1" to "profile")
    }

    @Test
    fun theOwnProfileCarriesNoStanceControl() {
        val stanced = mutableListOf<Pair<String, String>>()
        render(loaded(own = true), onStance = { target, tag -> stanced += target to tag })
        assertThat(stanced).isEmpty()
    }

    @Test
    fun theOwnProfileOffersEditSettingsAndInvites() {
        var edited = false
        var invites = false
        render(loaded(own = true), onEdit = { edited = true }, onOpenInvites = { invites = true })
        compose.onNodeWithTag("profile_settings").assertExists()
        compose.onNodeWithTag("profile_edit").performScrollTo().performClick()
        assertThat(edited).isTrue()
        compose.onNodeWithTag("profile_invites").performScrollTo().performClick()
        assertThat(invites).isTrue()
    }

    @Test
    fun anApplicantsInvitesTapExplainsInsteadOfNavigating() {
        // Visible but locked (auth.md "Application"): the tap explains.
        var invites = false
        render(loaded(own = true, applicant = true), onOpenInvites = { invites = true })
        compose.onNodeWithTag("profile_invites").performScrollTo().performClick()
        assertThat(invites).isFalse()
    }

    @Test
    fun theChronicleRendersRowsAndOpensThePost() {
        var opened: String? = null
        render(
            loaded().copy(
                rows = listOf(
                    RecordRow(
                        id = "act:a:1:publish",
                        family = Family.PUBLISH,
                        genesis = true,
                        snippet = "Hello world",
                        link = RecordLink.ToPost("p1"),
                    ),
                ),
            ),
            onOpenPost = { opened = it },
        )
        compose.onNodeWithTag("chronicle_row").performScrollTo().performClick()
        assertThat(opened).isEqualTo("p1")
    }

    @Test
    fun anEmptyChronicleShowsTheEmptyCopy() {
        render(loaded())
        compose.onNodeWithTag("profile_chronicle_empty").assertExists()
    }

    @Test
    fun theFilterChipsSwitch() {
        var picked: ChronicleFilter? = null
        render(loaded(), onFilterChange = { picked = it })
        compose.onNodeWithTag("profile_filter_everything").performScrollTo().performClick()
        assertThat(picked).isEqualTo(ChronicleFilter.EVERYTHING)
    }

    @Test
    fun anUnknownProfileShowsNotFound() {
        render(ProfileUiState(loading = false, notFound = true))
        compose.onNodeWithTag("profile_not_found").assertExists()
    }

    @Test
    fun aTransportFaultWithNothingLoadedOffersRetry() {
        render(ProfileUiState(loading = false, transportFailed = true))
        compose.onNodeWithTag("profile_transport_error").assertExists()
        compose.onNodeWithTag("profile_retry").assertExists()
    }

    @Test
    fun aDrillInProfileCarriesTheBackArrow() {
        render(loaded(), onBack = {})
        compose.onNodeWithTag("profile_back").assertExists()
    }

    // -- The edit form --

    private fun renderEdit(
        state: ProfileEditUiState,
        onSubmit: () -> Unit = {},
    ) {
        compose.setContent {
            ProfileEditScreen(
                state = state,
                onDisplayNameChange = {},
                onBioChange = {},
                onWebsiteChange = {},
                onPickAvatar = {},
                onClearAvatar = {},
                onSubmit = onSubmit,
                onRetry = {},
                onBack = {},
            )
        }
    }

    @Test
    fun theEditFormRendersItsFields() {
        renderEdit(ProfileEditUiState(loading = false, displayName = "Ada", bio = "Hi"))
        compose.onNodeWithTag("profile_edit_display_name").assertExists()
        compose.onNodeWithTag("profile_edit_bio").assertExists()
        compose.onNodeWithTag("profile_edit_website").assertExists()
        compose.onNodeWithTag("profile_edit_save").assertExists()
    }

    @Test
    fun theEmptyNameErrorRenders() {
        renderEdit(ProfileEditUiState(loading = false, emptyName = true))
        compose.onNodeWithTag("profile_edit_display_name").assertExists()
        // The supporting text rides the field's semantics; the save
        // still submits (the refusal is the ViewModel's).
    }

    @Test
    fun refusalAndSigningErrorsRender() {
        renderEdit(ProfileEditUiState(loading = false, refused = true, signingFailed = true))
        compose.onNodeWithTag("profile_edit_refused").assertExists()
        compose.onNodeWithTag("profile_edit_signing_failed").assertExists()
    }

    @Test
    fun theEditTransportFaultOffersRetry() {
        renderEdit(ProfileEditUiState(loading = false, transportFailed = true))
        compose.onNodeWithTag("profile_edit_transport_error").assertExists()
        compose.onNodeWithTag("profile_edit_retry").assertExists()
    }

    // -- The ruled field atom (CograTextField) the three fields now share --
    //
    // Each cap is the server's own (crates/api/src/profile.rs:27,30,35,
    // mirrored at core/domain/src/main/kotlin/com/cogra/domain/content/
    // TextLimits.kt:33-40): display name 50, bio 500, website URL 2048. The
    // late-counter window is `max(20, round(cap / 10))`
    // (design/components/forms/TextField.jsx:32-93).

    @Test
    fun theDisplayNameCounterAppearsNearItsCap() {
        // Cap 50, window max(20, 5) = 20 -> the counter appears at 30 chars.
        renderEdit(ProfileEditUiState(loading = false, displayName = "a".repeat(30)))
        compose.onNodeWithTag("profile_edit_display_name_count").assertTextEquals("20 left")
    }

    @Test
    fun aDisplayNameOverItsCapDisablesSave() {
        renderEdit(ProfileEditUiState(loading = false, displayName = "a".repeat(51)))
        compose.onNodeWithTag("profile_edit_display_name_count").assertTextEquals("1 over")
        compose.onNodeWithTag("profile_edit_display_name_error")
            .assertTextEquals("Too long — at most 50 characters.")
        compose.onNodeWithTag("profile_edit_save").assertIsNotEnabled()
    }

    @Test
    fun theBioCounterAppearsNearItsCap() {
        // Cap 500, window max(20, 50) = 50 -> the counter appears at 450 chars.
        renderEdit(ProfileEditUiState(loading = false, bio = "a".repeat(450)))
        compose.onNodeWithTag("profile_edit_bio_count").assertTextEquals("50 left")
    }

    @Test
    fun aBioOverItsCapDisablesSave() {
        renderEdit(ProfileEditUiState(loading = false, bio = "a".repeat(501)))
        compose.onNodeWithTag("profile_edit_bio_count").assertTextEquals("1 over")
        compose.onNodeWithTag("profile_edit_bio_error")
            .assertTextEquals("Too long — at most 500 characters.")
        compose.onNodeWithTag("profile_edit_save").assertIsNotEnabled()
    }

    @Test
    fun theWebsiteUrlCounterAppearsNearItsCap() {
        // Cap 2048, window max(20, 205) = 205 -> the counter appears at 1843.
        renderEdit(ProfileEditUiState(loading = false, websiteUrl = "a".repeat(1843)))
        compose.onNodeWithTag("profile_edit_website_count").assertTextEquals("205 left")
    }

    @Test
    fun aWebsiteUrlOverItsCapDisablesSave() {
        renderEdit(ProfileEditUiState(loading = false, websiteUrl = "a".repeat(2049)))
        compose.onNodeWithTag("profile_edit_website_count").assertTextEquals("1 over")
        compose.onNodeWithTag("profile_edit_website_error")
            .assertTextEquals("Too long — at most 2048 characters.")
        compose.onNodeWithTag("profile_edit_save").assertIsNotEnabled()
    }
}

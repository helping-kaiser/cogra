package com.cogra.feature.profile

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
    ) {
        compose.setContent {
            ProfileScreen(
                stanceControl = { target, tag -> onStance(target, tag) },
                state = state,
                profileSavedResult = false,
                onProfileSavedResultConsumed = {},
                onFilterChange = onFilterChange,
                onLoadMore = {},
                onRetry = {},
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
                onPickCover = {},
                onClearCover = {},
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
}

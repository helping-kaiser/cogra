package com.cogra.feature.invites

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.cogra.domain.ApplicationInfo
import com.cogra.domain.InviteLinkInfo
import com.google.common.truth.Truth.assertThat
import java.time.Instant
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class InvitesScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private fun readyLink() = InviteLinkInfo(
        id = "link-1",
        prefillPDirected = 0.1,
        prefillPInterest = 0.1,
        singleUse = false,
        createdAt = Instant.EPOCH,
        expiresAt = Instant.MAX,
        revokedAt = null,
        applications = listOf(
            ApplicationInfo(
                id = "app-1",
                handle = "joiner",
                emailVerified = true,
                keyAttached = true,
                approvedAt = null,
                landedAt = null,
            ),
        ),
    )

    private fun render(
        state: InvitesUiState,
        onApprove: (String, Double, Double) -> Unit = { _, _, _ -> },
    ) {
        compose.setContent {
            InvitesScreen(
                state = state,
                onBack = {},
                onSingleUseChange = {},
                onPrefillPDirectedChange = {},
                onPrefillPInterestChange = {},
                onCreate = {},
                onRevoke = {},
                onApprove = onApprove,
                onVouchSignedShown = {},
                onSigningFailedShown = {},
                onShare = {},
            )
        }
    }

    @Test
    fun aHuskTapExplainsInsteadOfActing() {
        var approved = false
        render(
            InvitesUiState(loading = false, links = listOf(readyLink()), seedOnDevice = false),
            onApprove = { _, _, _ -> approved = true },
        )
        compose.onNodeWithTag("approve_app-1").performScrollTo().performClick()
        compose.onNodeWithTag("invites_snackbar").assertExists()
        assertThat(approved).isFalse()
    }

    @Test
    fun withTheKeyOnDeviceTheTapApproves() {
        var approved = false
        render(
            InvitesUiState(loading = false, links = listOf(readyLink())),
            onApprove = { _, _, _ -> approved = true },
        )
        compose.onNodeWithTag("approve_app-1").performScrollTo().performClick()
        assertThat(approved).isTrue()
    }

    @Test
    fun theVouchConfirmationRidesTheSnackbar() {
        render(InvitesUiState(loading = false, vouchSigned = true))
        compose.onNodeWithTag("invites_snackbar").assertExists()
    }

    @Test
    fun anUnfinishedVouchSigningRidesTheSnackbar() {
        render(InvitesUiState(loading = false, signingFailed = true))
        compose.onNodeWithTag("invites_snackbar").assertExists()
    }
}

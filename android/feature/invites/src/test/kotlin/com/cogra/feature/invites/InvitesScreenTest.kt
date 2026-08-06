package com.cogra.feature.invites

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.cogra.domain.ApplicationInfo
import com.cogra.domain.InviteLinkInfo
import java.time.Instant
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class InvitesScreenTest {

    @get:Rule
    val compose = createComposeRule()

    private fun render(state: InvitesUiState) {
        compose.setContent {
            InvitesScreen(
                state = state,
                onSingleUseChange = {}, onPrefillPDirectedChange = {}, onPrefillPInterestChange = {},
                onCreate = {}, onRevoke = {}, onApprove = { _, _, _ -> }, onShare = {},
            )
        }
    }

    private fun link(application: ApplicationInfo?) = InviteLinkInfo(
        id = "l1",
        singleUse = false,
        createdAt = Instant.EPOCH,
        expiresAt = Instant.MAX,
        revokedAt = null,
        applications = listOfNotNull(application),
    )

    private fun application(
        emailVerified: Boolean = true,
        keyAttached: Boolean = true,
    ) = ApplicationInfo("a1", "joiner", emailVerified, keyAttached, approvedAt = null, landedAt = null)

    @Test
    fun anApprovableApplicationGetsApprovalControls() {
        render(InvitesUiState(loading = false, links = listOf(link(application()))))
        compose.onNodeWithTag("approve_a1").assertExists()
        compose.onNodeWithTag("share_l1").assertExists()
    }

    @Test
    fun aRevokedLinkLosesItsActions() {
        val revoked = link(null).copy(revokedAt = Instant.EPOCH)
        render(InvitesUiState(loading = false, links = listOf(revoked)))
        compose.onNodeWithTag("share_l1").assertDoesNotExist()
        compose.onNodeWithTag("revoke_l1").assertDoesNotExist()
    }

    @Test
    fun anUnverifiedApplicantCannotBeApproved() {
        render(InvitesUiState(loading = false, links = listOf(link(application(emailVerified = false)))))
        compose.onNodeWithTag("application_a1").assertExists()
        compose.onNodeWithTag("approve_a1").assertDoesNotExist()
    }

    @Test
    fun aMissingKeyBlocksApprovalToo() {
        // Approvable needs both proofs (auth.md "Application").
        render(InvitesUiState(loading = false, links = listOf(link(application(keyAttached = false)))))
        compose.onNodeWithTag("application_a1").assertExists()
        compose.onNodeWithTag("approve_a1").assertDoesNotExist()
    }
}

package com.cogra.feature.invites

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import com.cogra.domain.ApplicantInfo
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

    @Test
    fun aVerifiedApplicantGetsApprovalControls() {
        val link = InviteLinkInfo(
            id = "l1",
            singleUse = false,
            createdAt = Instant.EPOCH,
            expiresAt = Instant.MAX,
            revokedAt = null,
            applicants = listOf(ApplicantInfo("a1", "joiner", emailVerified = true, null, null)),
        )
        render(InvitesUiState(loading = false, links = listOf(link)))
        compose.onNodeWithTag("approve_a1").assertExists()
        compose.onNodeWithTag("share_l1").assertExists()
    }

    @Test
    fun aRevokedLinkLosesItsActions() {
        val link = InviteLinkInfo("l1", false, Instant.EPOCH, Instant.MAX, Instant.EPOCH, emptyList())
        render(InvitesUiState(loading = false, links = listOf(link)))
        compose.onNodeWithTag("share_l1").assertDoesNotExist()
        compose.onNodeWithTag("revoke_l1").assertDoesNotExist()
    }

    @Test
    fun anUnverifiedApplicantCannotBeApproved() {
        val link = InviteLinkInfo(
            id = "l1",
            singleUse = false,
            createdAt = Instant.EPOCH,
            expiresAt = Instant.MAX,
            revokedAt = null,
            applicants = listOf(ApplicantInfo("a1", "joiner", emailVerified = false, null, null)),
        )
        render(InvitesUiState(loading = false, links = listOf(link)))
        compose.onNodeWithTag("applicant_a1").assertExists()
        compose.onNodeWithTag("approve_a1").assertDoesNotExist()
    }
}

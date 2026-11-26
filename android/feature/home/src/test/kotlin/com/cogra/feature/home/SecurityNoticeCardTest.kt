// THE SECURITY NOTICE AS THE FEED'S FIRST LIST CARD (FeedSecurityNotice.jsx,
// FeedSecurityNotice.md): the board's words character for character, read off
// the board itself; `Change password` and `Got it` under them; the card at the
// top of the column, full width, above an applicant's cards, standing while the
// account state loads.

package com.cogra.feature.home

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import com.cogra.domain.AccountState
import com.cogra.domain.UserProfile
import com.cogra.domain.signing.RegistrationProgress
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File

@RunWith(RobolectricTestRunner::class)
class SecurityNoticeCardTest {

    @get:Rule
    val compose = createComposeRule()

    /** The board, from this module's directory (android/feature/home). */
    private val board = File("../../../design/designs/canonical/screens/FeedSecurityNotice.jsx").readText()

    private fun drawn(pattern: String): String =
        checkNotNull(Regex(pattern).find(board)) { "the board has no $pattern" }.groupValues[1]

    private fun bounds(tag: String): Rect =
        compose.onAllNodes(hasTestTag(tag), useUnmergedTree = true).fetchSemanticsNodes().single().boundsInRoot

    private fun render(state: HomeUiState, onChangePassword: () -> Unit = {}, onGotIt: () -> Unit = {}) {
        compose.setContent {
            Box(Modifier.width(360.dp).testTag("host")) {
                StatusBanners(
                    state = state,
                    onResendEmailChange = {},
                    onResend = {},
                    onResumePending = {},
                    onStartKeyCeremony = {},
                    securityNotice = { SecurityNoticeCard(onChangePassword, onGotIt) },
                )
            }
        }
        compose.waitForIdle()
    }

    private val member = HomeUiState(loading = false)

    private val applicant = HomeUiState(
        loading = false,
        applicant = true,
        profile = UserProfile("u", "noor", null, AccountState.APPLICANT, false, null),
        progress = RegistrationProgress.AwaitingApproval(emailVerified = false, keyAttached = true, keyOnDevice = true),
    )

    @Test
    fun theCardSaysTheBoardsWordsCharacterForCharacter() {
        render(member)
        compose.onNodeWithTag("security_notice.title", useUnmergedTree = true)
            .assertTextEquals(drawn("""title="([^"]+)""""))
        compose.onNodeWithTag("security_notice.body", useUnmergedTree = true)
            .assertTextEquals(drawn("""body="([^"]+)""""))
        compose.onNodeWithTag("security_notice_change_password")
            .assertTextEquals(drawn("""<Button variant="inverse">([^<]+)</Button>"""))
        compose.onNodeWithTag("security_notice_dismiss")
            .assertTextEquals(drawn("""<Button variant="outline">([^<]+)</Button>"""))
    }

    @Test
    fun theWordsNeverNameTheTokenBeneathASignIn() {
        render(member)
        val words = listOf("security_notice.title", "security_notice.body").joinToString(" ") { tag ->
            compose.onNodeWithTag(tag, useUnmergedTree = true).fetchSemanticsNode()
                .config[androidx.compose.ui.semantics.SemanticsProperties.Text].joinToString()
        }
        assertThat(words.lowercase()).doesNotContain("token")
    }

    @Test
    fun changePasswordAndGotItEachAnswerTheirOwnPress() {
        var changed = 0
        var gotIt = 0
        render(member, onChangePassword = { changed++ }, onGotIt = { gotIt++ })
        compose.onNodeWithTag("security_notice_change_password").performClick()
        assertThat(changed to gotIt).isEqualTo(1 to 0)
        compose.onNodeWithTag("security_notice_dismiss").performClick()
        assertThat(changed to gotIt).isEqualTo(1 to 1)
    }

    @Test
    fun theCardStandsAtTheTopOfTheColumnFullWidthAboveAnApplicantsCards() {
        render(applicant)
        val host = bounds("host")
        val notice = bounds("security_notice")
        val verify = bounds("feed.verifyCard")
        assertThat(notice.top).isEqualTo(host.top)
        assertThat(notice.width).isEqualTo(host.width)
        assertThat(notice.bottom).isAtMost(verify.top)
    }

    @Test
    fun theCardStandsWhileTheAccountStateStillLoads() {
        render(HomeUiState(loading = true))
        compose.onNodeWithTag("security_notice").assertExists()
    }
}

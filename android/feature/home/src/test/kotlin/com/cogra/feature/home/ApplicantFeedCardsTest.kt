// THE APPLICANT'S TASK CARDS ON THE FEED, AS DRAWN (`ApplicantFeed.jsx`,
// `ApplicantLanding.jsx`; behavior/ApplicantFeed.md, ApplicantLanding.md): the
// verify card, the key card's `create` value and the landing card, each on
// `TaskCard`'s register wearing the board's registered nodes. Its own class
// beside StatusBannersTest and KeyAttachCardTest (the key card's `attach`).

package com.cogra.feature.home

import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import com.cogra.domain.AccountState
import com.cogra.domain.ActorRef
import com.cogra.domain.UserProfile
import com.cogra.domain.invites.ApplicantApplication
import com.cogra.domain.invites.MyApplication
import com.cogra.domain.signing.AttachFault
import com.cogra.domain.signing.RegistrationProgress
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.File

@RunWith(RobolectricTestRunner::class)
class ApplicantFeedCardsTest {

    @get:Rule
    val compose = createComposeRule()

    private var resends = 0
    private var typed = ""
    private var ceremonies = 0

    private fun applicant(
        progress: RegistrationProgress,
        approver: String? = "mira",
        resendEmail: String = "noor@fieldmail.org",
    ) = HomeUiState(
        loading = false,
        applicant = true,
        profile = UserProfile("u", "noor", null, AccountState.APPLICANT, false, null),
        progress = progress,
        application = MyApplication(
            askLink = "5d9e7a41-b062-4c38-8e5f-1a4703cbd926",
            application = ApplicantApplication(
                id = "application-1",
                approvedAt = null,
                rejectedAt = null,
                landedAt = null,
                approver = approver?.let { ActorRef("actor-$it", it) },
            ),
        ),
        resendEmail = resendEmail,
    )

    private fun owed(
        emailVerified: Boolean = false,
        keyAttached: Boolean = false,
        keyOnDevice: Boolean = false,
        fault: AttachFault? = null,
    ) = RegistrationProgress.AwaitingApproval(emailVerified, keyAttached, keyOnDevice, fault)

    private fun banners(state: HomeUiState, surface: ApplicationSurface = ApplicationSurface.FEED) =
        @Composable {
            StatusBanners(
                state = state,
                onResendEmailChange = { typed = it },
                onResend = { resends += 1 },
                onResumePending = {},
                onStartKeyCeremony = { ceremonies += 1 },
                application = ApplicationCardActions(surface = surface),
            )
        }

    private fun render(state: HomeUiState, surface: ApplicationSurface = ApplicationSurface.FEED) {
        val content = banners(state, surface)
        compose.setContent { content() }
    }

    // ApplicantFeed.jsx:65, :95, :97-99; ApplicantFeed.md:11, :29.
    @Test
    fun theVerifyCardReadsTheBoardsWordsOnItsNodes() {
        render(applicant(owed(keyAttached = true, keyOnDevice = true)))
        compose.onNodeWithTag("feed.verifyCard").assertExists()
        compose.onNodeWithTag("feed.verifyCard.title", useUnmergedTree = true).assertTextEquals("Verify your email")
        compose.onNodeWithTag("feed.verifyCard.note", useUnmergedTree = true).assertTextEquals(
            "An account left unverified for seven days is removed — joining again then starts over.",
        )
        compose.onNodeWithTag("feed.verifyCard.resend", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("verify_resend", useUnmergedTree = true).assertTextEquals("Resend the link")
    }

    // ApplicantFeed.md:43 — the resend still sends; the typed address still rides the field.
    @Test
    fun theVerifyCardsResendStillCallsTheResend() {
        render(applicant(owed(keyAttached = true, keyOnDevice = true), resendEmail = ""))
        compose.onNodeWithTag("verify_resend", useUnmergedTree = true).assertIsNotEnabled()
        compose.onNodeWithTag("resend_email").performTextInput("noor@fieldmail.org")
        assertThat(typed).isEqualTo("noor@fieldmail.org")
    }

    @Test
    fun aTypedAddressLetsTheResendGoOut() {
        render(applicant(owed(keyAttached = true, keyOnDevice = true)))
        compose.onNodeWithTag("verify_resend", useUnmergedTree = true).assertIsEnabled().performClick()
        assertThat(resends).isEqualTo(1)
    }

    // ApplicantFeed.jsx:101-106 (`wording` = app); ApplicantFeed.md:15, :17, :49.
    @Test
    fun theKeyCardNamesTheApproverInTheAppsWords() {
        render(applicant(owed(emailVerified = true)))
        compose.onNodeWithTag("feed.keyCard").assertExists()
        compose.onNodeWithTag("feed.keyCard.title", useUnmergedTree = true).assertTextEquals("Create your key")
        compose.onNodeWithTag("feed.keyCard.body", useUnmergedTree = true)
            .assertTextEquals("Your application needs a key in this app before @mira can approve it.")
        compose.onNodeWithTag("feed.keyCard.create", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("home_create_key", useUnmergedTree = true).assertTextEquals("Create my key")
    }

    @Test
    fun createMyKeyStillOpensTheCeremony() {
        render(applicant(owed(emailVerified = true)))
        compose.onNodeWithTag("home_create_key", useUnmergedTree = true).performClick()
        assertThat(ceremonies).isEqualTo(1)
    }

    /** No board draws the card before the approver is read: it stands, its title alone, never a placeholder name. */
    @Test
    fun beforeTheApproverIsReadTheKeyCardStandsItsTitleAlone() {
        render(applicant(owed(emailVerified = true), approver = null))
        compose.onNodeWithTag("feed.keyCard.title", useUnmergedTree = true).assertTextEquals("Create your key")
        compose.onNodeWithTag("feed.keyCard.body", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag("home_create_key", useUnmergedTree = true).assertExists()
    }

    // ApplicantFeed.md:23 — both owed cards at once.
    @Test
    fun bothOwedCardsStandTogether() {
        render(applicant(owed()))
        compose.onNodeWithTag("feed.verifyCard").assertExists()
        compose.onNodeWithTag("feed.keyCard").assertExists()
    }

    // The board registers the cards on the feed; on the profile they stand unnamed.
    @Test
    fun onTheProfileTheCardsStandUnnamedByTheFeedsNodes() {
        render(applicant(owed()), surface = ApplicationSurface.PROFILE)
        compose.onNodeWithTag("feed.verifyCard").assertDoesNotExist()
        compose.onNodeWithTag("feed.keyCard").assertDoesNotExist()
        compose.onNodeWithTag("verify_resend", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("home_create_key", useUnmergedTree = true).assertExists()
    }

    // ApplicantLanding.jsx:47; ApplicantLanding.md:5, :7, :11.
    @Test
    fun theLandingCardIsItsTitleAloneWithNoControl() {
        render(applicant(RegistrationProgress.AwaitingLanding))
        compose.onNodeWithTag("feed.application").assertExists()
        compose.onNodeWithTag("feed.application.title", useUnmergedTree = true)
            .assertTextEquals("Approved — your registration is landing")
        compose.onNodeWithTag("feed.application.body", useUnmergedTree = true).assertDoesNotExist()
        compose.onNodeWithTag("feed.application.dismiss", useUnmergedTree = true).assertDoesNotExist()
    }

    /**
     * Every `feed.verifyCard*` / `feed.keyCard*` path the registry gives
     * ApplicantFeed is worn in some state of the stack — save the two the app
     * owes (it holds no address to print, nor a way to the change: OWED).
     */
    @Test
    fun everyRegisteredCardPathIsWornInSomeState() {
        val registered = applicantFeedCardTags()
        assertThat(registered).containsAtLeastElementsIn(OWED)
        val first = banners(applicant(owed()))
        val attach = banners(applicant(owed(emailVerified = true, keyOnDevice = true, fault = AttachFault.FAILED)))
        compose.setContent {
            Column {
                first()
                attach()
            }
        }
        val missing = (registered - OWED).filter { tag ->
            compose.onAllNodesWithTagCount(tag) == 0
        }
        assertThat(missing).isEmpty()
        OWED.forEach { assertThat(compose.onAllNodesWithTagCount(it)).isEqualTo(0) }
    }

    private fun ComposeContentTestRule.onAllNodesWithTagCount(tag: String): Int =
        onAllNodes(hasTestTag(tag), useUnmergedTree = true).fetchSemanticsNodes().size

    private companion object {
        val OWED = setOf("feed.verifyCard.address", "feed.verifyCard.wrongAddress")

        /** The registry's ApplicantFeed card paths as tags, a keyed path once per key. */
        fun applicantFeedCardTags(): Set<String> {
            val registry = File("../../../design/designs/canonical/nodes.json").readText()
            val board = registry.substringAfter("\"ApplicantFeed\": {").substringBefore("\"ApplicantFellThrough\"")
            val nodes = board.substringAfter("\"nodes\": {")
            val entry = Regex("\"(feed\\.(?:verifyCard|keyCard)[^\"]*)\": \\[([^\\]]*)]")
            return entry.findAll(nodes).flatMap { match ->
                val path = match.groupValues[1]
                val keys = Regex("\"([^\"]+)\"").findAll(match.groupValues[2]).map { it.groupValues[1] }.toList()
                if (keys.isEmpty()) sequenceOf(path) else keys.asSequence().map { "$path:$it" }
            }.toSet()
        }
    }
}

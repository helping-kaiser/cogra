package com.cogra.feature.home

import android.content.Context
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ApplicationProvider
import com.cogra.domain.AccountState
import com.cogra.domain.ActorRef
import com.cogra.domain.ErrorCode
import com.cogra.domain.UserProfile
import com.cogra.domain.invites.ApplicantApplication
import com.cogra.domain.invites.MyApplication
import com.cogra.domain.signing.RegistrationProgress
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
class StatusBannersTest {

    @get:Rule
    val compose = createComposeRule()

    private fun render(
        state: HomeUiState,
        surface: ApplicationSurface = ApplicationSurface.FEED,
        onPutAway: () -> Unit = {},
    ) {
        compose.setContent {
            StatusBanners(
                state = state,
                onTokenChange = {},
                onVerify = {},
                onResendEmailChange = {},
                onResend = {},
                onResumePending = {},
                onStartKeyCeremony = {},
                application = ApplicationCardActions(surface = surface, onPutAway = onPutAway),
            )
        }
    }

    /** The one-shots ride the shell's host; the harness stands in for it. */
    private fun renderOneShots(state: HomeUiState, onShown: () -> Unit = {}) {
        compose.setContent {
            val host = remember { SnackbarHostState() }
            StatusBannerOneShots(
                state = state,
                snackbarHostState = host,
                onActorRestoredShown = onShown,
                onApprovedShown = onShown,
                onWelcomeShown = onShown,
                onResentShown = onShown,
            )
            SnackbarHost(host, modifier = Modifier.testTag("home_snackbar"))
        }
    }

    private fun applicant(
        progress: RegistrationProgress?,
        putAway: Boolean = false,
        closed: Boolean = false,
    ) = HomeUiState(
        loading = false,
        applicant = true,
        profile = UserProfile("u", "joiner", null, AccountState.APPLICANT, false, null),
        progress = progress,
        application = MyApplication(
            askLink = "5d9e7a41-b062-4c38-8e5f-1a4703cbd926",
            application = ApplicantApplication(
                id = "application-1",
                approvedAt = null,
                rejectedAt = if (closed) Instant.EPOCH else null,
                landedAt = null,
                approver = ActorRef("actor-mira", "mira"),
            ),
        ),
        cardPutAway = putAway,
    )

    private fun awaiting(
        emailVerified: Boolean = true,
        keyAttached: Boolean = true,
        keyOnDevice: Boolean = true,
    ) = RegistrationProgress.AwaitingApproval(emailVerified, keyAttached, keyOnDevice)

    @Test
    fun aLoadingStateRendersNothing() {
        render(HomeUiState(loading = true, huskWarning = true))
        compose.onNodeWithTag("home_restore").assertDoesNotExist()
    }

    @Test
    fun theHuskWarningRidesTheCollapsingTopNotTheStack() {
        render(HomeUiState(loading = false, huskWarning = true))
        compose.onNodeWithTag("home_restore").assertDoesNotExist()
        compose.onNodeWithTag("feed.vouchCard").assertDoesNotExist()
    }

    @Test
    fun theKeyRestoreBannerShowsForAMemberHusk() {
        compose.setContent {
            KeyRestoreBanner(HomeUiState(loading = false, huskWarning = true), onRestoreActor = {})
        }
        compose.onNodeWithTag("home_restore").assertExists()
    }

    @Test
    fun theKeyRestoreBannerShowsForAnApplicantKeyAttachedElsewhere() {
        compose.setContent {
            KeyRestoreBanner(
                applicant(awaiting(keyAttached = true, keyOnDevice = false)),
                onRestoreActor = {},
            )
        }
        compose.onNodeWithTag("home_restore").assertExists()
    }

    @Test
    fun theKeyRestoreBannerShowsWhileTheSigningKeyBlocksLanding() {
        compose.setContent {
            KeyRestoreBanner(
                applicant(RegistrationProgress.AwaitingSigningKey),
                onRestoreActor = {},
            )
        }
        compose.onNodeWithTag("home_restore").assertExists()
    }

    @Test
    fun theKeyRestoreBannerStaysQuietPreCeremonyAndOnKeyedDevices() {
        compose.setContent {
            Column {
                // No key anywhere yet: the ask is the ceremony, never
                // a restore with nothing to restore.
                KeyRestoreBanner(
                    applicant(awaiting(keyAttached = false, keyOnDevice = false)),
                    onRestoreActor = {},
                )
                KeyRestoreBanner(applicant(awaiting()), onRestoreActor = {})
                KeyRestoreBanner(
                    HomeUiState(loading = false, huskWarning = false),
                    onRestoreActor = {},
                )
            }
        }
        compose.onNodeWithTag("home_restore").assertDoesNotExist()
    }

    /**
     * The vouch card is the feed's own first card (`VouchCardRoute`): the
     * banner stack — which the own profile carries too — never draws it.
     */
    @Test
    fun theBannerStackNeverCarriesTheVouchCard() {
        render(
            HomeUiState(
                loading = false,
                profile = UserProfile("u", "joiner", null, AccountState.MEMBER, false, ActorRef("i", "inviter")),
                vouchVoucher = ActorRef("i", "inviter"),
            ),
        )
        compose.onNodeWithTag("feed.vouchCard").assertDoesNotExist()
    }

    @Test
    fun aFreshRestoreShowsTheConfirmationSnackbar() {
        renderOneShots(HomeUiState(loading = false, actorRestored = true))
        compose.onNodeWithTag("home_snackbar").assertExists()
    }

    @Test
    fun theSnackbarConsumesItsOneShotAfterShowing() {
        var shown = false
        renderOneShots(
            HomeUiState(loading = false, actorRestored = true),
            onShown = { shown = true },
        )
        // Consumption happens only after the snackbar's display run ends.
        assertThat(shown).isFalse()
        compose.mainClock.advanceTimeBy(10_000)
        assertThat(shown).isTrue()
    }

    @Test
    fun theApprovalAndWelcomeOneShotsShowTheSnackbar() {
        renderOneShots(HomeUiState(loading = false, approved = true))
        compose.onNodeWithTag("home_snackbar").assertExists()
    }

    @Test
    fun aResentTokenConfirmsThroughTheSnackbar() {
        renderOneShots(HomeUiState(loading = false, resent = true))
        compose.onNodeWithTag("home_snackbar").assertExists()
    }

    @Test
    fun aResentTokenLeavesNoStandingLineOnTheVerifyCard() {
        render(applicant(awaiting(emailVerified = false)).copy(resent = true))
        compose.onNodeWithTag("verify_resent").assertDoesNotExist()
    }

    @Test
    fun parkedHandshakesOfferResume() {
        render(HomeUiState(loading = false, pendingHandshakes = 2))
        compose.onNodeWithTag("home_pending").assertExists()
        compose.onNodeWithTag("home_resume").assertExists()
    }

    @Test
    fun anApplicantAwaitingVerificationGetsTheTokenCard() {
        render(applicant(awaiting(emailVerified = false)))
        compose.onNodeWithTag("verify_token").assertExists()
        compose.onNodeWithTag("verify_submit").assertIsNotEnabled()
    }

    @Test
    fun aRateLimitedVerifyShowsTheDeliberateRefusalCopy() {
        // Never the connectivity copy: the server refused on purpose.
        val context: Context = ApplicationProvider.getApplicationContext()
        render(
            applicant(awaiting(emailVerified = false))
                .copy(verifyError = ErrorCode.RATE_LIMITED),
        )
        compose.onNodeWithTag("verify_error")
            .assertTextEquals(context.getString(R.string.error_rate_limited))
    }

    @Test
    fun anUnknownVerifyRefusalFallsBackToTheTokenCopy() {
        val context: Context = ApplicationProvider.getApplicationContext()
        render(
            applicant(awaiting(emailVerified = false))
                .copy(verifyError = ErrorCode.INTERNAL),
        )
        compose.onNodeWithTag("verify_error")
            .assertTextEquals(context.getString(R.string.home_verify_failed))
    }

    @Test
    fun aRateLimitedResendShowsTheDeliberateRefusalCopy() {
        val context: Context = ApplicationProvider.getApplicationContext()
        render(
            applicant(awaiting(emailVerified = false))
                .copy(resendError = ErrorCode.RATE_LIMITED),
        )
        compose.onNodeWithTag("resend_error")
            .assertTextEquals(context.getString(R.string.error_rate_limited))
        compose.onNodeWithTag("verify_resent").assertDoesNotExist()
    }

    @Test
    fun aForeignDeviceKeyGetsItsOwnCardNotTheWaitingHint() {
        // keyOnDevice without keyAttached: this account's slot holds a
        // key the server refused to accept on the repair-attach.
        render(applicant(awaiting(keyAttached = false, keyOnDevice = true)))
        compose.onNodeWithTag("home_key_elsewhere").assertExists()
        compose.onNodeWithTag("home_fresh_key").assertExists()
        compose.onNodeWithTag("feed.application").assertDoesNotExist()
        compose.onNodeWithTag("home_create_key").assertDoesNotExist()
    }

    @Test
    fun aMissingKeyShowsTheCeremonyCardAlongsideTheVerifyCard() {
        // The two proofs are independent (auth.md "Application"): both
        // cards can show at once.
        render(applicant(awaiting(emailVerified = false, keyAttached = false, keyOnDevice = false)))
        compose.onNodeWithTag("verify_token").assertExists()
        compose.onNodeWithTag("home_create_key").assertExists()
    }

    @Test
    fun aKeyAttachedElsewhereLeavesRestoreToTheCollapsingTop() {
        render(applicant(awaiting(keyAttached = true, keyOnDevice = false)))
        compose.onNodeWithTag("home_restore").assertDoesNotExist()
        compose.onNodeWithTag("home_create_key").assertDoesNotExist()
        compose.onNodeWithTag("feed.application").assertDoesNotExist()
    }

    @Test
    fun theWaitingCardNamesTheApproverAndHoldsTheAskLink() {
        // ApplicantWaiting.md:5, :11 — the member whose approval is in play,
        // never the role inviter; the ask link whole with its caption.
        var putAway = 0
        render(applicant(awaiting()), onPutAway = { putAway++ })
        compose.onNodeWithTag("feed.application.title").assertTextEquals("All set — waiting on @mira")
        compose.onNodeWithText("inviter", substring = true).assertDoesNotExist()
        compose.onNodeWithTag("feed.application.link.address")
            .assertTextEquals("https://cogra.social/vouch/5d9e7a41-b062-4c38-8e5f-1a4703cbd926")
        compose.onNodeWithTag("feed.application.link.caption").assertTextEquals("It does not expire.")
        compose.onNodeWithContentDescription("Copy your ask link").assertExists()
        // :15 — Got it puts it away.
        compose.onNodeWithTag("feed.application.dismiss").performClick()
        assertThat(putAway).isEqualTo(1)
    }

    @Test
    fun aPutAwayWaitingCardLeavesTheBannerAreaQuiet() {
        render(applicant(awaiting(), putAway = true))
        compose.onNodeWithTag("feed.application").assertDoesNotExist()
    }

    @Test
    fun theWaitingCardWaitsForEveryOwedStep() {
        // ApplicantWaiting.md:3 — every owed step done.
        render(applicant(awaiting(emailVerified = false)))
        compose.onNodeWithTag("feed.application").assertDoesNotExist()
    }

    @Test
    fun theClosedCardStandsWhateverWasPutAwayOrOwed() {
        // ApplicantWaiting.md:19; ApplicantRejected.md:5-9 — titled by the
        // member who closed it, no way to put it away.
        render(applicant(awaiting(emailVerified = false), putAway = true, closed = true))
        compose.onNodeWithTag("feed.application.title").assertTextEquals("@mira closed your application")
        compose.onNodeWithTag("feed.application.link.label")
            .assertTextEquals("Ask someone you know to vouch for you")
        compose.onNodeWithTag("feed.application.dismiss").assertDoesNotExist()
    }

    @Test
    fun theProfileCardSaysItInTheProfilesWordsAndIsNeverPutAway() {
        // ProfileApplicant.md:5, :9, :14.
        render(applicant(awaiting(), putAway = true), surface = ApplicationSurface.PROFILE)
        compose.onNodeWithTag("profile.application.title").assertTextEquals("Waiting on @mira")
        compose.onNodeWithTag("profile.application.link.caption")
            .assertTextEquals(
                "It does not expire. Anyone who holds your ask can let you in — the first vouch lands it.",
            )
        compose.onNodeWithTag("profile.application.dismiss").assertDoesNotExist()
    }

    @Test
    fun landingRendersItsStatusLine() {
        render(applicant(RegistrationProgress.AwaitingLanding))
        compose.onNodeWithTag("home_landing").assertExists()
    }

    @Test
    fun applicantErrorsRender() {
        render(applicant(RegistrationProgress.RejectedByDevice("seal mismatch")))
        compose.onNodeWithTag("home_application_rejected").assertExists()
    }
}

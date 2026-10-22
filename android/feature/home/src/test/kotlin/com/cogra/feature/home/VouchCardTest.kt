package com.cogra.feature.home

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.longClick
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import com.cogra.core.designsystem.StanceControl
import com.cogra.core.designsystem.StanceControlState
import com.cogra.domain.ActorRef
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/** The vouch card as drawn (VouchBack.md); the web's twin is `feed/vouch-card.test.tsx`. */
@RunWith(RobolectricTestRunner::class)
class VouchCardTest {

    @get:Rule
    val compose = createComposeRule()

    private var putAways = 0
    private var padOpens = 0
    private var holds = 0

    /** The master stance control, worn on the card's registered `stance` node. */
    private fun render(failed: Boolean = false) {
        compose.setContent {
            VouchCard(
                voucher = ActorRef("mira-id", "mira", "Mira Voss"),
                putAwayFailed = failed,
                onPutAway = { putAways++ },
                stance = {
                    StanceControl(
                        state = StanceControlState(),
                        onHoldDefault = { holds++ },
                        onOpenPad = { padOpens++ },
                        onPick = {},
                        onCommit = {},
                        onDismissPad = {},
                        onOpenAlternates = {},
                        onOpenSeverance = {},
                        onConfirmSeverance = {},
                        onDismissSeverance = {},
                        onConfirmationShown = {},
                        testTagPrefix = "vouch_back",
                        targetLabel = "@mira",
                        node = VOUCH_CARD / "stance",
                        lineFaceInk = MaterialTheme.colorScheme.onTertiaryContainer,
                    )
                },
            )
        }
    }

    // VouchBack.md:5 — names the member who vouched the account in.
    @Test
    fun theVouchCardNamesTheMemberWhoVouchedTheAccountIn() {
        render()
        compose.onNodeWithTag("feed.vouchCard.title").assertTextEquals("@mira vouched you in")
        compose.onNodeWithTag("feed.vouchCard.avatar", useUnmergedTree = true).assertExists()
    }

    // VouchBack.md:7, :9 — the drawn body.
    @Test
    fun theVouchCardReadsItsDrawnBody() {
        render()
        compose.onNodeWithTag("feed.vouchCard.body").assertTextEquals(
            "Vouch back to open the way from your side — your opinion toward @mira, and your " +
                "feed grows from it. Vouching opens the opinion control, set to a gentle default.",
        )
        compose.onNodeWithTag("feed.vouchCard.dismiss").assertTextEquals("Got it")
    }

    // VouchBack.md:11, :13, :17 — the card's act is the stance face; one line
    // beside it, claiming nothing about first-ness.
    @Test
    fun theCardsActIsTheStanceFaceWithOneCoachingLineBesideIt() {
        render()
        compose.onNodeWithTag("feed.vouchCard.hint").assertTextEquals("Tap the face to vouch back.")
        compose.onNodeWithTag("feed.vouchCard.stance.anchor").assertExists()
        // The hollow face: the account holds no opinion of the voucher.
        compose.onNodeWithTag("feed.vouchCard.stance.anchor.face", useUnmergedTree = true).assertExists()
    }

    // stance-control.md, jakob 2026-10-14: the card's empty face is the line
    // face in the card's ink, never the 🫥 emoji (whose fixed colours cannot
    // read on the olive ground). The face keeps its registered `face` node.
    @Test
    fun theEmptyFaceIsALineFaceAndNeverTheEmoji() {
        render()
        compose.onNodeWithTag("feed.vouchCard.stance.anchor.face", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("🫥", useUnmergedTree = true).assertDoesNotExist()
    }

    // VouchBack.md:11 — Got it takes the row's leading edge, the line sits
    // against the face, and the face keeps the trailing seat.
    @Test
    fun gotItLeadsTheRowAndTheFaceKeepsTheTrailingSeat() {
        render()
        val dismiss = compose.onNodeWithTag("feed.vouchCard.dismiss").getBoundsInRoot()
        val hint = compose.onNodeWithTag("feed.vouchCard.hint").getBoundsInRoot()
        val anchor = compose.onNodeWithTag("feed.vouchCard.stance.anchor").getBoundsInRoot()
        assertThat(dismiss.right).isAtMost(hint.left)
        assertThat(hint.right).isAtMost(anchor.left)
    }

    // The button the face replaced (seam 178): no node and no words remain.
    @Test
    fun theVouchBackButtonIsGone() {
        render()
        compose.onNodeWithTag("feed.vouchCard.vouch").assertDoesNotExist()
    }

    // VouchBack.md:39, :43 — the tap opens the pad; the hold signs the default.
    @Test
    fun theFaceTapOpensThePadAndTheHoldSignsTheDefault() {
        render()
        compose.onNodeWithTag("feed.vouchCard.stance.anchor").performClick()
        assertThat(padOpens).isEqualTo(1)
        assertThat(holds).isEqualTo(0)
        compose.onNodeWithTag("feed.vouchCard.stance.anchor").performTouchInput { longClick() }
        assertThat(holds).isEqualTo(1)
        assertThat(padOpens).isEqualTo(1)
    }

    @Test
    fun gotItReachesItsAction() {
        render()
        compose.onNodeWithTag("feed.vouchCard.dismiss").performClick()
        assertThat(putAways).isEqualTo(1)
    }

    // VouchBack.md:39 — ruling 44: the row says so, Retry in Got it's slot.
    @Test
    fun aFailedGotItBringsTheCardBackWithRetry() {
        render(failed = true)
        compose.onNodeWithTag("feed_vouch_card_failed").assertTextEquals("That didn't go through.")
        compose.onNodeWithTag("feed.vouchCard.dismiss").assertDoesNotExist()
        compose.onNodeWithTag("feed_vouch_card_retry").assertTextEquals("Retry").performClick()
        assertThat(putAways).isEqualTo(1)
        compose.onNodeWithTag("feed.vouchCard.hint").assertExists()
        compose.onNodeWithTag("feed.vouchCard.stance.anchor").assertExists()
    }
}

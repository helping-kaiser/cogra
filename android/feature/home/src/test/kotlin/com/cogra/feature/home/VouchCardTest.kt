package com.cogra.feature.home

import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
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
    private var vouches = 0

    private fun render(failed: Boolean = false) {
        compose.setContent {
            VouchCard(
                voucher = ActorRef("mira-id", "mira", "Mira Voss"),
                putAwayFailed = failed,
                onPutAway = { putAways++ },
                onVouchBack = { vouches++ },
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

    // VouchBack.md:7, :11 — the drawn body; it claims no order.
    @Test
    fun theVouchCardReadsItsDrawnBodyAndClaimsNoOrder() {
        render()
        compose.onNodeWithTag("feed.vouchCard.body").assertTextEquals(
            "Vouch back to open the way from your side — your opinion toward @mira, and your " +
                "feed grows from it. Vouching opens the opinion control, set to a gentle default.",
        )
        compose.onNodeWithTag("feed.vouchCard.dismiss").assertTextEquals("Got it")
        compose.onNodeWithTag("feed.vouchCard.vouch").assertTextEquals("Vouch back")
    }

    @Test
    fun gotItAndVouchBackReachTheirActions() {
        render()
        compose.onNodeWithTag("feed.vouchCard.dismiss").performClick()
        compose.onNodeWithTag("feed.vouchCard.vouch").performClick()
        assertThat(putAways).isEqualTo(1)
        assertThat(vouches).isEqualTo(1)
    }

    // VouchBack.md:39 — ruling 44: the row says so, Retry in Got it's slot.
    @Test
    fun aFailedGotItBringsTheCardBackWithRetry() {
        render(failed = true)
        compose.onNodeWithTag("feed_vouch_card_failed").assertTextEquals("That didn't go through.")
        compose.onNodeWithTag("feed.vouchCard.dismiss").assertDoesNotExist()
        compose.onNodeWithTag("feed_vouch_card_retry").assertTextEquals("Retry").performClick()
        assertThat(putAways).isEqualTo(1)
        compose.onNodeWithTag("feed.vouchCard.vouch").assertExists()
    }
}

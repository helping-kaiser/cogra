// The bar's slot vocabulary. The bar is drawn against five slots and ships
// the ones whose surfaces exist — so what this pins is the pair of rules that
// keeps those two facts from drifting apart: the structure knows all five, and
// a build renders no slot that opens nothing (F-08).
//
// HiltTestActivity rather than createComposeRule()'s bare ComponentActivity:
// testDebug's robolectric.properties runs the whole source set under
// HiltTestApplication, so the module's Compose host is the Hilt one.

package com.cogra.app.ui

import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.cogra.app.HiltTestActivity
import com.cogra.app.ui.theme.CograTheme
import com.google.common.truth.Truth.assertThat
import dagger.hilt.android.testing.HiltAndroidRule
import dagger.hilt.android.testing.HiltAndroidTest
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
@HiltAndroidTest
class CograBottomBarTest {

    @get:Rule(order = 0)
    val hilt = HiltAndroidRule(this)

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<HiltTestActivity>()

    @Test
    fun theBarShipsOnlyTheSlotsThatHaveSurfaces() {
        compose.setContent {
            CograTheme {
                CograBottomBar(
                    feedSelected = true,
                    profileSelected = false,
                    onFeed = {},
                    onCompose = {},
                    onProfile = {},
                )
            }
        }

        compose.onNodeWithTag("bar_feed").assertExists()
        compose.onNodeWithTag("bar_compose").assertExists()
        compose.onNodeWithTag("bar_profile").assertExists()
        // Explore waits for slice 2.7's search backend and the wallet for
        // its own surfaces; a bar item that opens nothing teaches the
        // reader the bar lies.
        compose.onNodeWithTag("bar_explore").assertDoesNotExist()
        compose.onNodeWithTag("bar_wallet").assertDoesNotExist()
    }

    @Test
    fun theStructureKnowsAllFiveSlotsInTheDrawnOrder() {
        assertThat(NavSlot.entries.map { it.name })
            .containsExactly("Feed", "Search", "Compose", "Wallet", "Profile")
            .inOrder()

        var explore = 0
        var wallet = 0
        compose.setContent {
            CograTheme {
                CograBottomBar(
                    feedSelected = false,
                    profileSelected = false,
                    onFeed = {},
                    onCompose = {},
                    onProfile = {},
                    slots = NavSlot.entries,
                    onSearch = { explore++ },
                    onWallet = { wallet++ },
                )
            }
        }

        compose.onNodeWithTag("bar_explore").performClick()
        compose.onNodeWithTag("bar_wallet").performClick()

        assertThat(explore).isEqualTo(1)
        assertThat(wallet).isEqualTo(1)
    }
}

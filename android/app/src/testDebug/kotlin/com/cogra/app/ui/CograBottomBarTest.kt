// The bar's slot vocabulary: five slots in the drawn order, and V1.0 ships all
// five (BottomNav.jsx; readme §13, *The V1.0 scope cut*) — the wallet's opens
// its coming-soon door rather than standing as a slot that opens nothing.
//
// HiltTestActivity rather than createComposeRule()'s bare ComponentActivity:
// testDebug's robolectric.properties runs the whole source set under
// HiltTestApplication, so the module's Compose host is the Hilt one.

package com.cogra.app.ui

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationItemColors
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import com.cogra.app.HiltTestActivity
import com.cogra.app.ui.theme.CograTheme
import com.cogra.core.designsystem.DataNode
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
    fun theV10BarCarriesAllFiveSlots() {
        // BottomNav.jsx: "V1.0 carries all five" (readme §13, *The V1.0 scope
        // cut*). Explore stands on slice 2.7's search, and the wallet slot
        // keeps its place opening its coming-soon door (WalletComingSoon.md:3).
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

        listOf("bar_feed", "bar_explore", "bar_compose", "bar_wallet", "bar_profile").forEach {
            compose.onNodeWithTag(it).assertExists()
        }
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

    @Test
    fun underARegisteredScreenTheBarWearsThatScreensDataNodes() {
        // The registry names the bar per screen (`feed.bottomBar`,
        // `postDetail.bottomBar` in design/designs/canonical/nodes.json), and
        // the conformance harness finds it by exactly those paths.
        compose.setContent {
            CograTheme {
                CograBottomBar(
                    feedSelected = true,
                    profileSelected = false,
                    onFeed = {},
                    onCompose = {},
                    onProfile = {},
                    slots = NavSlot.entries,
                    node = DataNode("feed") / "bottomBar",
                )
            }
        }

        compose.onNodeWithTag("feed.bottomBar").assertExists()
        listOf("feedSlot", "searchSlot", "composeSlot", "walletSlot", "profileSlot").forEach {
            compose.onNodeWithTag("feed.bottomBar.$it").assertExists()
        }
        compose.onNodeWithTag("bottom_bar").assertDoesNotExist()
        compose.onNodeWithTag("bar_feed").assertDoesNotExist()
    }

    @Test
    fun selectionIsColourAloneNeverAnIndicatorPill() {
        // BottomNav.jsx: `tone(selected)` reads `--on-surface` over
        // `--text-secondary`, and "never an indicator pill" — where M3's
        // defaults tint `secondary` over a `secondaryContainer` pill.
        lateinit var colors: NavigationItemColors
        lateinit var scheme: ColorScheme
        compose.setContent {
            CograTheme {
                colors = barItemColors()
                scheme = MaterialTheme.colorScheme
            }
        }
        compose.waitForIdle()

        assertThat(colors.selectedIndicatorColor).isEqualTo(Color.Transparent)
        assertThat(colors.selectedIconColor).isEqualTo(scheme.onSurface)
        assertThat(colors.selectedTextColor).isEqualTo(scheme.onSurface)
        assertThat(colors.unselectedIconColor).isEqualTo(scheme.onSurfaceVariant)
        assertThat(colors.unselectedTextColor).isEqualTo(scheme.onSurfaceVariant)
    }
}

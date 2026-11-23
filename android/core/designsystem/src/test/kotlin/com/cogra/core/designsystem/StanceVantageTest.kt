// A guest's anchor, compiled from its sidecars: FeedBare.md:7/:9,
// TagPage.md:73-79, ProfileOther.md:59-63 and the master's `anchorName` —
// the borrowed view's own face, read-only, the hollow face where it holds
// none, the spoken name `@<handle>'s opinion on <label>` with its reading
// after it where the view holds one, never the hold hint, and the wide words
// `@<handle>'s opinion` in `Your opinion`'s place. Nodes, never widths.

package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.unit.dp
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

private const val TAG = "post"
private const val LENDER = "genesis_mod"

@Config(qualifiers = "w411dp-h891dp")
@RunWith(RobolectricTestRunner::class)
class StanceVantageTest {

    @get:Rule
    val compose = createComposeRule()

    private fun show(state: StanceControlState, label: String? = null, wide: Boolean = false) {
        compose.setContent {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                StanceControl(
                    state = state,
                    onHoldDefault = {},
                    onOpenPad = {},
                    onPick = {},
                    onCommit = {},
                    onDismissPad = {},
                    onOpenAlternates = {},
                    onOpenSeverance = {},
                    onConfirmSeverance = {},
                    onDismissSeverance = {},
                    onConfirmationShown = {},
                    testTagPrefix = TAG,
                    targetLabel = label,
                    wide = wide,
                    modifier = if (wide) Modifier.width(320.dp) else Modifier,
                )
            }
        }
    }

    private fun anchor() = compose.onNodeWithTag("${TAG}_stance")

    // FeedBare.md:7 — the borrowed view's own stance, at the member's anchor geometry.
    @Test
    fun aHeldBorrowedOpinionWearsItsFace() {
        show(StanceControlState(standing = StancePoint(0.55, 0.20), vantage = LENDER))
        compose.onNodeWithText("😊", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("${TAG}_stance_empty_face", useUnmergedTree = true).assertDoesNotExist()
    }

    // FeedBare.md:9 — spoken as the view's opinion, its reading after it, never the hold hint.
    @Test
    fun aHeldBorrowedOpinionIsSpokenAsTheViewsWithItsReading() {
        show(StanceControlState(standing = StancePoint(0.55, 0.20), vantage = LENDER))
        anchor().assertContentDescriptionEquals("@genesis_mod's opinion on this post: Like this, +0.55 / +0.20.")
    }

    // FeedBare.md:7/:9 — the hollow face where the view holds none, still named as the view's.
    @Test
    fun noBorrowedOpinionIsTheHollowFaceNamedAsTheViews() {
        show(StanceControlState(standing = null, vantage = LENDER), label = "@ada")
        compose.onNodeWithTag("${TAG}_stance_empty_face", useUnmergedTree = true).assertExists()
        anchor().assertContentDescriptionEquals("@genesis_mod's opinion on @ada")
    }

    // A walked-back borrowed bundle reads as a member's own walked-back one.
    @Test
    fun aSeveredBorrowedBundleReadsAsWalkedBack() {
        show(StanceControlState(standing = StancePoint.Origin, severed = true, vantage = LENDER))
        anchor().assertContentDescriptionEquals("@genesis_mod's opinion on this post: Walked back, +0.00 / +0.00.")
    }

    // TagPage.md:75 / ProfileOther.md:59 — the wide words name the view in `Your opinion`'s place.
    @Test
    fun theWideAnchorsWordsNameTheBorrowedView() {
        show(StanceControlState(standing = null, vantage = LENDER), label = "#saltmaps", wide = true)
        compose.onNodeWithTag(VANTAGE_WORDS_TAG, useUnmergedTree = true).assertExists()
        compose.onNodeWithText("@genesis_mod", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("'s opinion", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("Your opinion", useUnmergedTree = true).assertDoesNotExist()
        // TagPage.md:77 — the accessible name keeps the handle whole.
        anchor().assertContentDescriptionEquals("@genesis_mod's opinion on #saltmaps")
    }

    // The wide words stand only where there is no pair to show — a held view shows its face.
    @Test
    fun aHeldWideAnchorDrawsNoWords() {
        show(StanceControlState(standing = StancePoint(0.55, 0.20), vantage = LENDER), label = "@ada", wide = true)
        compose.onNodeWithTag(VANTAGE_WORDS_TAG, useUnmergedTree = true).assertDoesNotExist()
    }

    // A reader with a session is unchanged: their anchor is their own.
    @Test
    fun withoutAVantageTheAnchorIsTheReadersOwn() {
        show(StanceControlState(standing = null), label = "#saltmaps", wide = true)
        compose.onNodeWithText("Your opinion", useUnmergedTree = true).assertExists()
        anchor().assertContentDescriptionEquals("Give your opinion on #saltmaps")
    }
}

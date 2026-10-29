// The stance control's kept-pick faces, compiled from their sidecars:
// PadKeyAbsent.md (the keep under the key notice, on the pad and the
// alternates), KeyElsewhereNoBackup.md:13-:15 (the notice with no backup),
// PadPending.md and PadPendingReview.md (the anchor while a pick waits), and
// PadPendingReview.md:21 (a signed kept pick settling). Nodes, never widths.

package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertContentDescriptionEquals
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

private const val TAG = "post"

@Config(qualifiers = "w411dp-h891dp")
@RunWith(RobolectricTestRunner::class)
class StanceKeptTest {

    @get:Rule
    val compose = createComposeRule()

    private var kept = 0
    private var committed = 0
    private var dismissed = 0

    private fun show(state: StanceControlState, node: DataNode? = null) {
        compose.setContent {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                StanceControl(
                    state = state,
                    onHoldDefault = {},
                    onOpenPad = {},
                    onPick = {},
                    onCommit = { committed++ },
                    onDismissPad = { dismissed++ },
                    onOpenAlternates = {},
                    onOpenSeverance = {},
                    onConfirmSeverance = {},
                    onDismissSeverance = {},
                    onConfirmationShown = {},
                    testTagPrefix = TAG,
                    node = node,
                    onKeepPending = { kept++ },
                )
            }
        }
    }

    private val keyAway =
        StanceControlState(pad = StancePadMode.STICKY, pick = StancePoint(0.55, 0.2), keyAbsent = true)

    @Test
    fun padKeyAbsent27_keepItPendingStandsUnderTheNoticeAndKeepsThePick() {
        show(keyAway)
        compose.onNodeWithTag("${TAG}_stance_keep_pending")
            .performScrollTo()
            .assertTextEquals("Keep it pending, restore later")
            .performClick()
        assertThat(kept).isEqualTo(1)
        assertThat(committed).isEqualTo(0)
        compose.onNodeWithTag("${TAG}_stance_cancel").assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_set").assertDoesNotExist()
    }

    @Test
    fun keyElsewhereNoBackup13_theNoticeDropsRestoreAndKeepsTheKeep() {
        show(keyAway.copy(noBackup = true))
        compose.onNodeWithTag("${TAG}_stance_restore_key").assertDoesNotExist()
        compose.onNodeWithText(
            "This account has no backup, so the key can't be brought here yet. Make a recovery code on the " +
                "device that holds it, then restore it here. Until then, anything you sign waits as pending.",
        ).assertExists()
        compose.onNodeWithText("Restore the key with your recovery code to finish.").assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_keep_pending").assertExists()
    }

    @Test
    fun padKeyAbsent17_theAlternatesCarryThePadsNoticeAndTheKeep() {
        show(keyAway.copy(pad = StancePadMode.ALTERNATES))
        compose.onNodeWithTag("${TAG}_stance_key_absent").assertExists()
        compose.onNodeWithText("Sign it").assertDoesNotExist()
        compose.onNodeWithTag("${TAG}_stance_keep_pending").performScrollTo().performClick()
        assertThat(kept).isEqualTo(1)
    }

    private val feedStance = DataNode("feed.card.actionRow.stance")

    @Test
    fun padPending3_5_theAnchorWearsTheKeptPicksFaceWithWaitingForYourKey() {
        val face = KeptFace(StancePoint(0.1, 0.1), review = false)
        show(StanceControlState(standing = StancePoint(-0.3, 0.1), kept = face), feedStance)
        compose.onNodeWithTag("feed.card.actionRow.stance.pending").assertTextEquals("Waiting for your key")
        compose.onNodeWithTag("feed.card.actionRow.stance.anchor")
            .assertContentDescriptionEquals("Your opinion on this post, waiting for your key: Nice, +0.10 / +0.10.")
        compose.onNodeWithText("Still settling").assertDoesNotExist()
    }

    @Test
    fun padPendingReview5_withTheKeyBackTheLineReadsWaitingForYourReview() {
        show(StanceControlState(kept = KeptFace(StancePoint(0.1, 0.1), review = true)), feedStance)
        compose.onNodeWithTag("feed.card.actionRow.stance.pending").assertTextEquals("Waiting for your review")
        compose.onNodeWithTag("feed.card.actionRow.stance.anchor")
            .assertContentDescriptionEquals("Your opinion on this post, waiting for your review: Nice, +0.10 / +0.10.")
    }

    @Test
    fun padPendingReview21_aSignedKeptPickSettlesUnderItsFace() {
        show(StanceControlState(standing = StancePoint(0.1, 0.1), settling = true), feedStance)
        compose.onNodeWithTag("feed.card.actionRow.stance.pending").assertTextEquals("Still settling")
    }

    @Test
    fun nothingKeptNothingSettlingDrawsNoLine() {
        show(StanceControlState(standing = StancePoint(0.1, 0.1)), feedStance)
        compose.onNodeWithTag("feed.card.actionRow.stance.pending").assertDoesNotExist()
    }
}

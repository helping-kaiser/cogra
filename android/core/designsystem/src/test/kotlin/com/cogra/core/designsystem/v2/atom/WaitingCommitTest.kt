package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.test.assertHeightIsEqualTo
import androidx.compose.ui.test.assertTouchHeightIsEqualTo
import androidx.compose.ui.test.click
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.height
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * A-WAITINGCOMMIT-HITTARGET: the commit keeps its drawn 40dp pill in the
 * layout (`cg-hit`, readme §10) while its touch target still answers at
 * 48dp — the board's height, and accessibility not traded for it.
 */
@RunWith(RobolectricTestRunner::class)
class WaitingCommitTest {

    @get:Rule
    val compose = createComposeRule()

    private val commit = DataNode("signIn.commit")

    private fun render(waiting: Boolean, onCommit: () -> Unit = {}) {
        compose.setContent {
            Cogra2PreviewTheme {
                Column(Modifier.padding(24.dp)) {
                    WaitingCommit(
                        label = "Sign in",
                        reason = "Waiting for your email and password",
                        waiting = waiting,
                        onCommit = onCommit,
                        node = commit,
                    )
                }
            }
        }
    }

    @Test
    fun theCommitStandsItsDrawnFortyInTheLayout() {
        render(waiting = false)

        compose.onNodeWithTag((commit / "action").tag).assertHeightIsEqualTo(40.dp)
        // With nothing to wait for the atom is the pill alone: no 4dp above and below it.
        compose.onNodeWithTag(commit.tag).assertHeightIsEqualTo(40.dp)
    }

    @Test
    fun theWaitingStackIsTheReasonTheGapAndThePill() {
        render(waiting = true)

        val reason = compose.onNodeWithTag((commit / "reason").tag).getUnclippedBoundsInRoot().height
        compose.onNodeWithTag(commit.tag).assertHeightIsEqualTo(reason + 8.dp + 40.dp)
    }

    @Test
    fun theTouchTargetStillAnswersAtFortyEight() {
        render(waiting = false)

        compose.onNodeWithTag((commit / "action").tag).assertTouchHeightIsEqualTo(48.dp)
    }

    @Test
    fun aTapJustOutsideTheDrawnPillStillCommits() {
        var commits = 0
        render(waiting = false, onCommit = { commits++ })

        // 3dp above the pill's drawn top edge, inside the 48dp target.
        compose.onNodeWithTag((commit / "action").tag).performTouchInput {
            click(Offset(centerX, -3.dp.toPx()))
        }
        compose.waitForIdle()
        assertThat(commits).isEqualTo(1)
    }
}

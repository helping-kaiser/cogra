package com.cogra.core.designsystem.v2.atom

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.width
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import com.cogra.core.designsystem.DataNode
import com.cogra.core.designsystem.v2.token.Cogra2PreviewTheme
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/** The deletion band's two sentences, its spelled-out count and its one act (FeedDeleting.md). */
@RunWith(RobolectricTestRunner::class)
class DeletionBandTest {

    @get:Rule
    val compose = createComposeRule()

    private fun band(count: Int, inHours: Boolean, content: Boolean, onCancel: () -> Unit = {}) {
        compose.setContent {
            Cogra2PreviewTheme {
                Column(Modifier.width(390.dp)) {
                    DeletionBand(
                        count = forwardCount(count, inHours),
                        content = content,
                        onCancel = onCancel,
                        node = DataNode("feed") / "deletionBand",
                    )
                }
            }
        }
    }

    @Test
    fun theLineCountsTheDaysLeftSpelledOut() {
        band(6, inHours = false, content = false)
        compose.onNodeWithTag("feed.deletionBand.line").assertTextEquals("Your account is deleted in 6 days.")
    }

    @Test
    fun theSweepSwitchesTheSentenceNotTheBand() {
        band(1, inHours = false, content = true)
        compose.onNodeWithTag("feed.deletionBand.line")
            .assertTextEquals("Your account and everything you posted are deleted in 1 day.")
    }

    @Test
    fun theLastDayCountsHours() {
        band(5, inHours = true, content = false)
        compose.onNodeWithTag("feed.deletionBand.line").assertTextEquals("Your account is deleted in 5 hours.")
    }

    @Test
    fun cancelIsTheBandsOneAct() {
        var canceled = false
        band(6, inHours = false, content = false) { canceled = true }
        compose.onNodeWithTag("feed.deletionBand.cancel").assertTextEquals("Cancel").performClick()
        assertThat(canceled).isTrue()
    }
}

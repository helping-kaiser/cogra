package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

private val ROW = DataNode("tagPage") / "actionRow" / "stance"

/**
 * `TagPageHeldPad`'s pad (nodes.json, round 48): the topic's plain pad — no
 * variant — wears the registered `tagPage.actionRow.stance.pad.*` paths its
 * host hands it, as the web's plain `padNode` does.
 */
private val HELD_PAD_NODES = listOf(
    "pad", "pad.cancel", "pad.field", "pad.field.bottom", "pad.field.left", "pad.field.right",
    "pad.field.square", "pad.field.square.knob", "pad.field.square.zeroAcross", "pad.field.square.zeroDown",
    "pad.field.top", "pad.help", "pad.landing", "pad.landing.exact", "pad.landing.face", "pad.landing.label",
    "pad.set", "pad.sever", "pad.standing", "pad.standing.current", "pad.standing.current.exact",
    "pad.standing.current.face", "pad.standing.current.label", "pad.standing.pick", "pad.standing.pick.exact",
    "pad.standing.pick.face", "pad.standing.pick.label",
).map { "${ROW.path}.$it" }

@Config(qualifiers = "w411dp-h914dp")
@RunWith(RobolectricTestRunner::class)
class StancePlainPadNodeTest {

    @get:Rule
    val compose = createComposeRule()

    private fun show(padNode: DataNode?) {
        compose.setContent {
            CompositionLocalProvider(LocalShowExactValues provides true) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    StanceControl(
                        state = StanceControlState(
                            pad = StancePadMode.STICKY,
                            pick = StancePoint(0.3, 0.2),
                            standing = StancePoint(0.55, 0.2),
                            landing = StanceLanding(
                                StancePoint(0.85, 0.4),
                                inertDirected = false,
                                inertInterest = false,
                                severance = false,
                            ),
                        ),
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
                        testTagPrefix = "topic_affinity",
                        axes = StanceAxes.Affinity,
                        zeroWords = StanceZeroWords.Disconnected,
                        targetLabel = "#saltmaps",
                        wide = true,
                        node = ROW,
                        padNode = padNode,
                    )
                }
            }
        }
        compose.waitForIdle()
    }

    private fun shown(tag: String) =
        compose.onAllNodesWithTag(tag, useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty()

    // TagPageHeldPad (round 48): every registered part of the held topic's open pad stands under its path.
    @Test
    fun theHeldTopicsPadWearsEveryRegisteredPath() {
        show(ROW / "pad")
        assertThat(HELD_PAD_NODES.filterNot(::shown)).isEmpty()
    }

    // Given no pad node, the plain pad keeps the tags its unregistered hosts bind to.
    @Test
    fun withoutAPadNodeThePlainPadKeepsItsOwnTags() {
        show(null)
        assertThat(shown("topic_affinity_stance_pad")).isTrue()
        assertThat(shown("tagPage.actionRow.stance.pad")).isFalse()
    }
}

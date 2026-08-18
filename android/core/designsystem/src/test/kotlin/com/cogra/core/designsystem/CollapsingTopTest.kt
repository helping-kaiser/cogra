package com.cogra.core.designsystem

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.unit.dp
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class CollapsingTopTest {

    @get:Rule
    val compose = createComposeRule()

    private fun renderTop() {
        compose.setContent {
            val top = rememberCollapsingTop()
            Column(
                Modifier
                    .fillMaxSize()
                    .collapsingTop(top),
            ) {
                AnimatedVisibility(visible = top.showTop) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .testTag("top_region"),
                    )
                }
                LazyColumn(
                    Modifier
                        .fillMaxSize()
                        .testTag("list"),
                ) {
                    items(50) {
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height(80.dp),
                        )
                    }
                }
            }
        }
    }

    /** A held drag: per-frame deltas clear the jitter bar, no fling. */
    private fun dragUpBy(px: Float) {
        compose.onNodeWithTag("list").performTouchInput {
            down(center)
            moveBy(Offset(0f, px))
            advanceEventTime(250)
            up()
        }
    }

    @Test
    fun theTopReturnsOnlyAfterAThirdOfAScreenUpward() {
        renderTop()
        compose.onNodeWithTag("top_region").assertExists()
        compose.onNodeWithTag("list").performTouchInput { swipeUp() }
        compose.onNodeWithTag("top_region").assertDoesNotExist()

        // A short correction toward a post's top summons nothing.
        dragUpBy(30f)
        compose.onNodeWithTag("top_region").assertDoesNotExist()

        // The tally accumulates across gestures; a third of the window
        // (Robolectric: 470px tall, so ~157px) crosses the gate.
        dragUpBy(80f)
        dragUpBy(80f)
        dragUpBy(80f)
        compose.onNodeWithTag("top_region").assertExists()
    }

    @Test
    fun aDownwardScrollResetsTheTally() {
        renderTop()
        compose.onNodeWithTag("list").performTouchInput { swipeUp() }
        compose.onNodeWithTag("top_region").assertDoesNotExist()

        dragUpBy(60f)
        dragUpBy(60f)
        // Partway to the gate — but a downward move starts over.
        compose.onNodeWithTag("list").performTouchInput {
            down(center)
            moveBy(Offset(0f, -30f))
            advanceEventTime(250)
            up()
        }
        dragUpBy(60f)
        compose.onNodeWithTag("top_region").assertDoesNotExist()
    }
}

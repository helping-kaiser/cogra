// `SeenCardsEffect` on a real lazy list: which keys it reports, in which
// order, and the checkpoints it raises (scroll rest, leaving the list).

package com.cogra.core.designsystem

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performScrollToIndex
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.google.common.truth.Truth.assertThat
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class SeenCardsEffectTest {

    @get:Rule
    val compose = createComposeRule()

    private val reports = mutableListOf<List<String>>()
    private val edgeReports = mutableListOf<List<EdgeSighting>>()
    private lateinit var listState: LazyListState
    private var checkpoints = 0
    private val tracking = mutableStateOf(true)
    private val suspended = mutableStateOf(false)

    /** Everything reported so far, first report of each id only. */
    private val seen: List<String> get() = reports.flatten().distinct()

    /**
     * A 300dp list: a 20dp banner row that is not a card (its key maps to
     * no id), then one card per height, keyed `n0`, `n1`, …
     */
    private fun render(heights: List<Dp>) {
        compose.setContent {
            val state = rememberLazyListState().also { listState = it }
            if (tracking.value) {
                SeenCardsEffect(
                    listState = state,
                    nodeIdOf = { key -> (key as? String)?.takeIf { it.startsWith("n") } },
                    onSeen = { reports += it },
                    onEdgesSeen = { edgeReports += it },
                    onCheckpoint = { checkpoints++ },
                    suspended = suspended.value,
                )
            }
            LazyColumn(
                state = state,
                modifier = Modifier
                    .height(300.dp)
                    .testTag("list"),
            ) {
                item(key = "banner") { Box(Modifier.fillMaxWidth().height(20.dp)) }
                itemsIndexed(heights, key = { i, _ -> "n$i" }) { _, h -> Box(Modifier.fillMaxWidth().height(h)) }
            }
        }
        compose.waitForIdle()
    }

    @Test
    fun `the cards fully in the viewport are seen in list order and nothing else is`() {
        // n0 20-120, n1 120-220 are whole; n2 220-320 is cut at 300.
        render(List(6) { 100.dp })

        assertThat(reports.first()).containsExactly("n0", "n1").inOrder()
        assertThat(seen).containsExactly("n0", "n1").inOrder()
    }

    @Test
    fun `a partly visible card is seen once it is whole`() {
        render(List(6) { 100.dp })
        assertThat(seen).doesNotContain("n2")

        compose.onNodeWithTag("list").performScrollToIndex(2)
        compose.waitForIdle()

        assertThat(seen).contains("n2")
    }

    @Test
    fun `a card taller than the viewport reports its two edges, never as a whole`() {
        render(listOf(100.dp, 400.dp, 100.dp, 100.dp, 100.dp, 100.dp))

        // Scroll the tall card through the viewport from top to bottom.
        repeat(4) {
            compose.onNodeWithTag("list").performTouchInput { swipeUp() }
            compose.waitForIdle()
        }

        // The cards either side of it fired, so the list did travel past it:
        // n0 at the top, n5 at rest at the bottom. The tall one never stood
        // whole; its top and its bottom each reported as an edge instead
        // (History.md:13), for the receiver to put together.
        assertThat(seen).doesNotContain("n1")
        assertThat(seen).containsAtLeast("n0", "n5")
        val n1 = edgeReports.flatten().filter { it.nodeId == "n1" }
        assertThat(n1.any { it.top }).isTrue()
        assertThat(n1.any { it.bottom }).isTrue()
    }

    @Test
    fun `a tall card's top and bottom edges arrive in separate frames, never both at once`() {
        // n1 spans 120..520dp of a 300dp list: its top is on screen at rest.
        render(listOf(100.dp, 400.dp, 100.dp, 100.dp, 100.dp, 100.dp))
        assertThat(edgeReports.flatten()).containsExactly(EdgeSighting("n1", top = true, bottom = false))

        // 300dp on, it spans -180..220dp: its bottom is on screen, its top is not.
        val step = with(compose.density) { 300.dp.toPx() }
        compose.runOnIdle { listState.dispatchRawDelta(step) }
        compose.waitForIdle()

        assertThat(edgeReports.last()).containsExactly(EdgeSighting("n1", top = false, bottom = true))
        assertThat(edgeReports.flatten().none { it.top && it.bottom }).isTrue()
        assertThat(seen).doesNotContain("n1")
    }

    @Test
    fun `a tall card covering the viewport reports no edge`() {
        render(listOf(100.dp, 400.dp, 100.dp, 100.dp, 100.dp, 100.dp))
        edgeReports.clear()

        // 150dp on, n1 spans -30..370dp of the 300dp list.
        val step = with(compose.density) { 150.dp.toPx() }
        compose.runOnIdle { listState.dispatchRawDelta(step) }
        compose.waitForIdle()

        assertThat(edgeReports.flatten()).isEmpty()
    }

    @Test
    fun `a card that fits reports no edge, however it is cut`() {
        render(List(20) { 100.dp })
        // Cut at the bottom (n2 at 220..320dp), then at the top as well.
        val step = with(compose.density) { 50.dp.toPx() }
        compose.runOnIdle { listState.dispatchRawDelta(step) }
        compose.waitForIdle()
        compose.onNodeWithTag("list").performTouchInput { swipeUp() }
        compose.waitForIdle()

        assertThat(edgeReports).isEmpty()
    }

    @Test
    fun `a tall card under a raised sheet reports no edge until the sheet drops`() {
        suspended.value = true
        render(listOf(100.dp, 400.dp, 100.dp))
        assertThat(edgeReports).isEmpty()

        suspended.value = false
        compose.waitForIdle()

        assertThat(edgeReports.flatten()).containsExactly(EdgeSighting("n1", top = true, bottom = false))
    }

    @Test
    fun `a batch flushes at scroll idle`() {
        render(List(20) { 100.dp })
        assertThat(checkpoints).isEqualTo(0)

        compose.onNodeWithTag("list").performTouchInput { swipeUp() }
        compose.waitForIdle()

        // A drag and the fling after it may rest twice; each rest is a
        // checkpoint, and a second one with nothing queued sends nothing.
        assertThat(checkpoints).isAtLeast(1)
        assertThat(seen).contains("n2")
    }

    @Test
    fun `leaving the list is a checkpoint`() {
        render(List(6) { 100.dp })

        tracking.value = false
        compose.waitForIdle()

        assertThat(checkpoints).isEqualTo(1)
    }

    @Test
    fun `a card under a raised sheet is not seen until the sheet drops`() {
        suspended.value = true
        render(List(6) { 100.dp })
        assertThat(reports).isEmpty()

        suspended.value = false
        compose.waitForIdle()

        assertThat(seen).containsExactly("n0", "n1").inOrder()
    }
}

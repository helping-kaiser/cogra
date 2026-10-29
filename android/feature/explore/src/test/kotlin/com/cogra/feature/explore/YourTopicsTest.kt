// Your topics, compiled from YourTopics.md: the held list and nothing else,
// in the server's order (strongest first), each row the topic's mark, its
// name and the Affinity pair, no removal, no bar, and the word "follow"
// nowhere; plus copy-voice's empty line.

package com.cogra.feature.explore

import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.cogra.domain.Outcome
import com.cogra.domain.testing.ScriptedHeldTopicsRepository
import com.cogra.domain.topics.HeldTopic
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.IOException

private val HELD = listOf(
    HeldTopic("saltmaps", 0.6, 0.35, pending = false, id = "h-saltmaps"),
    HeldTopic("fieldnotes", 0.3, 0.15, pending = true, id = "h-fieldnotes"),
    HeldTopic("wellness", -0.65, -0.3, pending = false, id = "h-wellness"),
)

@OptIn(ExperimentalCoroutinesApi::class)
class YourTopicsViewModelTest {

    @Test
    fun `the list is every held topic in the order served, a topic held against among them`() {
        val dispatcher = StandardTestDispatcher()
        Dispatchers.setMain(dispatcher)
        try {
            runTest(dispatcher) {
                val held = ScriptedHeldTopicsRepository().apply { topics = HELD }
                val vm = YourTopicsViewModel(held)
                advanceUntilIdle()
                assertThat(vm.state.value.topics.map { it.name }).containsExactly("saltmaps", "fieldnotes", "wellness")
                    .inOrder()
                held.failure = Outcome.Failed(IOException("down"))
                vm.read()
                advanceUntilIdle()
                assertThat(vm.state.value.failed).isTrue()
            }
        } finally {
            Dispatchers.resetMain()
        }
    }
}

@RunWith(RobolectricTestRunner::class)
class YourTopicsScreenTest {

    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private fun render(state: YourTopicsUiState, onOpen: (String) -> Unit = {}, onBack: () -> Unit = {}) {
        compose.setContent {
            YourTopicsScreen(state = state, onBack = onBack, onOpenTopic = onOpen, onRetry = {}, onLoadMore = {})
        }
    }

    @Test
    fun `each row is the topic's name with its pair, pending says so, and a row opens its page`() {
        val opened = mutableListOf<String>()
        render(YourTopicsUiState(loading = false, topics = HELD), onOpen = { opened += it })
        compose.onNodeWithText("#saltmaps", useUnmergedTree = true).assertExists()
        compose.onNodeWithText("#wellness", useUnmergedTree = true).assertExists()
        compose.onNodeWithTag("yourTopics.row:fieldnotes", useUnmergedTree = true).assertExists()
        compose.onAllNodesWithText("Still settling", useUnmergedTree = true).fetchSemanticsNodes().let {
            assertThat(it).isNotEmpty()
        }
        compose.onNodeWithTag("yourTopics.row:saltmaps", useUnmergedTree = true).performClick()
        assertThat(opened).containsExactly("saltmaps")
    }

    @Test
    fun `the arrow goes back to Explore and the word follow appears nowhere`() {
        var back = 0
        render(YourTopicsUiState(loading = false, topics = HELD), onBack = { back += 1 })
        compose.onNodeWithContentDescription("Back to Explore").performClick()
        assertThat(back).isEqualTo(1)
        compose.onAllNodesWithText("follow", substring = true, ignoreCase = true, useUnmergedTree = true)
            .fetchSemanticsNodes().let { assertThat(it).isEmpty() }
    }

    @Test
    fun `no topic held reads copy-voice's empty line`() {
        render(YourTopicsUiState(loading = false))
        compose.onNodeWithText("No topics yet — say how you feel about one from its page.", useUnmergedTree = true)
            .assertExists()
    }
}

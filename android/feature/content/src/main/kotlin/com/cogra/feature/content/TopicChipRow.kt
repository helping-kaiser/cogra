// The chip row on owned content (hashtag.md §4; D14): the current
// topics, plus — on the viewer's own post or comment only — the
// standalone add/remove gesture. Add and remove are each their own
// priced Tag act (post.md §3); this never rides the post/comment
// editor (D14), and it never appears for content the viewer does not
// own — the server enforces authorship too, but the affordance itself
// should not invite a refusal.

package com.cogra.feature.content

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.ErrorLine
import com.cogra.core.designsystem.TopicChip
import com.cogra.domain.Outcome
import com.cogra.domain.TopicClaimView
import com.cogra.domain.repo.TopicRepository
import com.cogra.domain.signing.NoActorKeyException
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** One target's add-a-topic state, keyed the same way [com.cogra.feature.stance.StanceViewModel] keys its targets. */
data class TopicChipRowState(
    val adding: Boolean = false,
    val addInput: String = "",
    val busy: Boolean = false,
    val failed: Boolean = false,
    val needsKey: Boolean = false,
)

@HiltViewModel
class TopicChipRowViewModel @Inject constructor(
    private val topics: TopicRepository,
    private val signer: WriteSigner,
) : ViewModel() {

    private val _state = MutableStateFlow<Map<String, TopicChipRowState>>(emptyMap())
    val state = _state.asStateFlow()

    fun onOpenAdd(target: String) = update(target) { it.copy(adding = true, addInput = "", failed = false) }
    fun onDismissAdd(target: String) = update(target) { it.copy(adding = false, addInput = "") }
    fun onAddInputChange(target: String, v: String) = update(target) { it.copy(addInput = v) }

    /** The chip row's add gesture — a standalone Tag at the default relevance (D13, D14). */
    fun onConfirmAdd(target: String, onChanged: () -> Unit) {
        val entry = _state.value[target] ?: return
        if (entry.busy) return
        val name = normalizeTagPreview(entry.addInput)
        if (name.isEmpty()) return
        commit(target, name = name, pDirected = null, onChanged = onChanged)
    }

    /** The chip row's remove gesture — a further Tag at relevance 0 (hashtag.md §4). */
    fun onRemoveTag(target: String, name: String, onChanged: () -> Unit) =
        commit(target, name = name, pDirected = 0.0, onChanged = onChanged)

    private fun commit(target: String, name: String, pDirected: Double?, onChanged: () -> Unit) {
        update(target) { it.copy(busy = true, failed = false, needsKey = false) }
        viewModelScope.launch {
            val prepared = when (val outcome = topics.prepareTag(target, name, pDirected = pDirected)) {
                is Outcome.Success -> outcome.value
                else -> return@launch fail(target)
            }
            val results = try {
                signer.sign(prepared)
            } catch (_: NoActorKeyException) {
                return@launch fail(target, needsKey = true)
            }
            if (results.all { it is WriteResult.Done }) {
                update(target) { it.copy(adding = false, addInput = "", busy = false) }
                onChanged()
            } else {
                fail(target)
            }
        }
    }

    private fun fail(target: String, needsKey: Boolean = false) =
        update(target) { it.copy(busy = false, failed = true, needsKey = needsKey) }

    private fun update(target: String, block: (TopicChipRowState) -> TopicChipRowState) {
        _state.update { state -> state + (target to block(state[target] ?: TopicChipRowState())) }
    }
}

/**
 * The chip row for one piece of content. [editable] gates the
 * add/remove affordance to the viewer's own content (D14) — every
 * reader still sees the chips themselves.
 */
@Composable
fun TopicChipRowRoute(
    target: String,
    topics: List<TopicClaimView>,
    editable: Boolean,
    onOpenTopic: (String) -> Unit,
    onChanged: () -> Unit,
    testTagPrefix: String,
    viewModel: TopicChipRowViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val entry = state[target] ?: TopicChipRowState()
    TopicChipRow(
        topics = topics,
        editable = editable,
        state = entry,
        onOpenTopic = onOpenTopic,
        onOpenAdd = { viewModel.onOpenAdd(target) },
        onDismissAdd = { viewModel.onDismissAdd(target) },
        onAddInputChange = { viewModel.onAddInputChange(target, it) },
        onConfirmAdd = { viewModel.onConfirmAdd(target, onChanged) },
        onRemoveTag = { name -> viewModel.onRemoveTag(target, name, onChanged) },
        testTagPrefix = testTagPrefix,
    )
}

@Composable
internal fun TopicChipRow(
    topics: List<TopicClaimView>,
    editable: Boolean,
    state: TopicChipRowState,
    onOpenTopic: (String) -> Unit,
    onOpenAdd: () -> Unit,
    onDismissAdd: () -> Unit,
    onAddInputChange: (String) -> Unit,
    onConfirmAdd: () -> Unit,
    onRemoveTag: (String) -> Unit,
    testTagPrefix: String,
) {
    if (topics.isEmpty() && !editable) return
    Column {
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.testTag("${testTagPrefix}_topics"),
        ) {
            topics.forEach { claim ->
                val name = claim.hashtag.name.value.orEmpty()
                TopicChip(
                    name = name,
                    onClick = { onOpenTopic(name) },
                    onRemove = if (editable) ({ onRemoveTag(name) }) else null,
                    testTag = "${testTagPrefix}_topic_$name",
                )
            }
            if (editable && !state.adding) {
                TextButton(onClick = onOpenAdd, modifier = Modifier.testTag("${testTagPrefix}_topic_add_open")) {
                    Text(stringResource(R.string.content_topics_chip_row_add))
                }
            }
        }
        if (editable && state.adding) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                OutlinedTextField(
                    value = state.addInput,
                    onValueChange = onAddInputChange,
                    label = { Text(stringResource(R.string.content_topics_field)) },
                    singleLine = true,
                    modifier = Modifier
                        .weight(1f)
                        .testTag("${testTagPrefix}_topic_add_input"),
                )
                TextButton(
                    onClick = onConfirmAdd,
                    enabled = !state.busy && state.addInput.isNotBlank(),
                    modifier = Modifier.testTag("${testTagPrefix}_topic_add_confirm"),
                ) {
                    Text(stringResource(R.string.content_topics_add))
                }
                TextButton(onClick = onDismissAdd, modifier = Modifier.testTag("${testTagPrefix}_topic_add_cancel")) {
                    Text(stringResource(R.string.content_comment_edit_cancel))
                }
            }
            if (state.addInput.isNotBlank()) {
                Text(
                    stringResource(R.string.content_topics_preview, normalizeTagPreview(state.addInput)),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (state.failed) {
                ErrorLine(
                    if (state.needsKey) R.string.content_error_signing_no_key else R.string.content_error_signing,
                    "${testTagPrefix}_topic_add_failed",
                )
            }
        }
    }
}

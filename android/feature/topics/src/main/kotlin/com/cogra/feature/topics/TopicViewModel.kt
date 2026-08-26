// The topic screen's state holder (hashtag.md; roadmap "Slice 2.3"):
// the name and its tagged content — the fold read from the Type's own
// side. A read-only surface: every write toward a topic is a Tag act
// staged from the content that carries it (hashtag.md §4), so nothing
// here signs.

package com.cogra.feature.topics

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.HashtagView
import com.cogra.domain.Outcome
import com.cogra.domain.TaggedContentView
import com.cogra.domain.repo.TopicRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class TopicUiState(
    val loading: Boolean = true,
    /** Null only for a name the substrate cannot carry (D3's ASCII charset). */
    val notFound: Boolean = false,
    val transportFailed: Boolean = false,
    val hashtag: HashtagView? = null,
    val content: List<TaggedContentView> = emptyList(),
    val contentLoading: Boolean = false,
)

@HiltViewModel
class TopicViewModel @Inject constructor(
    private val topics: TopicRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(TopicUiState())
    val state = _state.asStateFlow()

    private var name: String? = null
    private var started = false

    /** Route entry: the canonical name from the chip/route that opened this screen. */
    fun start(name: String) {
        if (started) return
        started = true
        this.name = name
        refresh()
    }

    fun refresh() {
        val n = name ?: return
        viewModelScope.launch {
            when (val outcome = topics.hashtag(n)) {
                is Outcome.Success -> {
                    val hashtag = outcome.value
                    if (hashtag == null) {
                        _state.update { it.copy(loading = false, notFound = true) }
                    } else {
                        _state.update {
                            it.copy(loading = false, notFound = false, transportFailed = false, hashtag = hashtag)
                        }
                    }
                }
                is Outcome.Refused -> _state.update { it.copy(loading = false, notFound = true) }
                is Outcome.Failed -> _state.update {
                    it.copy(loading = false, transportFailed = it.hashtag == null)
                }
            }
        }
        loadContent()
    }

    private fun loadContent() {
        val n = name ?: return
        _state.update { it.copy(contentLoading = true) }
        viewModelScope.launch {
            when (val outcome = topics.taggedContent(n)) {
                is Outcome.Success -> _state.update { it.copy(contentLoading = false, content = outcome.value) }
                else -> _state.update { it.copy(contentLoading = false) }
            }
        }
    }
}

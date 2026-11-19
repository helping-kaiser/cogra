// The topic screen's state holder (hashtag.md; roadmap "Slice 2.3"):
// the name and its tagged content — the fold read from the Type's own
// side. A read-only surface: every write toward a topic is a Tag act
// staged from the content that carries it (hashtag.md §4), so nothing
// here signs.

package com.cogra.feature.topics

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.core.designsystem.EdgeSighting
import com.cogra.domain.HashtagView
import com.cogra.domain.Outcome
import com.cogra.domain.TaggedContentView
import com.cogra.domain.TaggedNode
import com.cogra.domain.di.WebOrigin
import com.cogra.domain.feed.CommittedFeedFilter
import com.cogra.domain.feed.FeedFilter
import com.cogra.domain.feed.ReaderDefaults
import com.cogra.domain.history.SeenTracker
import com.cogra.domain.removal.admitsRemoved
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
    private val seenTracker: SeenTracker,
    @WebOrigin private val webOrigin: String,
    private val readerDefaults: ReaderDefaults,
    private val committed: CommittedFeedFilter,
) : ViewModel() {

    private val _state = MutableStateFlow(TopicUiState())
    val state = _state.asStateFlow()

    /** Post and comment cards that stood fully in the viewport, in order. */
    fun onCardsSeen(nodeIds: List<String>) = seenTracker.saw(nodeIds)

    /** Tall cards with an edge on screen; each joins once both edges have been. */
    fun onCardEdgesSeen(sightings: List<EdgeSighting>) =
        sightings.forEach { seenTracker.sawEdges(it.nodeId, top = it.top, bottom = it.bottom) }

    /** The reading paused — the scroll rested or the reader left. */
    fun onSeenCheckpoint() = seenTracker.flush()

    /** What the stance row's share hands over: the tag's own web address, as a tag card's share does. */
    fun shareUrl(name: String): String = "$webOrigin/topics/$name"

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
                is Outcome.Success -> {
                    // THE TAG PAGE FOLLOWS THE FEED'S REMOVED SWITCH (TagPage.md:19-21):
                    // the filter the feed opens with — the one its Done committed on
                    // this device, else the reader's saved default — read each time
                    // the page is derived, so a removal taken from this page's own
                    // menu stands as its mark until the next read. Only posts are cut:
                    // a tagged comment's case is not ruled on main (round 58).
                    val feedFilter = committed.now() ?: readerDefaults.now()
                    val listed = outcome.value.filter { it.admittedBy(feedFilter) }
                    _state.update { it.copy(contentLoading = false, content = listed) }
                }
                else -> _state.update { it.copy(contentLoading = false) }
            }
        }
    }
}

/** Whether the feed's [filter] lets this row stand: a removed post only with Also show → Removed on. */
private fun TaggedContentView.admittedBy(filter: FeedFilter): Boolean =
    (node as? TaggedNode.Post)?.let { filter.admitsRemoved(it.post) } ?: true

// The topic screen's state holder (hashtag.md; roadmap "Slice 2.3"):
// the name and its tagged content — the fold read from the Type's own
// side — plus the follow control. Follow/unfollow reuse the generic
// stance machinery `feature:stance` already exercises for posts,
// comments, and profiles, addressed by name instead of by id; this
// slice ships a plain toggle rather than the pad (D10 — the pending
// redesign pass over slice 2 revisits every control's look).

package com.cogra.feature.topics

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.HashtagView
import com.cogra.domain.Outcome
import com.cogra.domain.TaggedContentView
import com.cogra.domain.repo.TopicRepository
import com.cogra.domain.signing.NoActorKeyException
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.stance.SeveranceQuote
import com.cogra.domain.stance.StancePair
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
    /** The follow control's read; unknown (false) until [standingRead]. */
    val following: Boolean = false,
    val standingRead: Boolean = false,
    val followBusy: Boolean = false,
    val followFailed: Boolean = false,
    /** The failure is a husk device, not a fault: the key has to come back. */
    val followNeedsKey: Boolean = false,
    /** The unfollow confirm, open when non-null (D9's existing confirm flow). */
    val severance: SeveranceQuote? = null,
    val severanceWorking: Boolean = false,
    val severanceFailed: Boolean = false,
)

@HiltViewModel
class TopicViewModel @Inject constructor(
    private val topics: TopicRepository,
    private val signer: WriteSigner,
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
        readFollowStanding()
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

    private fun readFollowStanding() {
        val n = name ?: return
        viewModelScope.launch {
            when (val outcome = topics.followStanding(n)) {
                is Outcome.Success -> _state.update {
                    it.copy(standingRead = true, following = outcome.value.records > 0)
                }
                // A missing standing is not a failure to surface here — the
                // follow control simply starts from "not following"; a
                // signed-out viewer's tap will refuse and say so then.
                else -> _state.update { it.copy(standingRead = true) }
            }
        }
    }

    /** The tap default follow (design.md's low-defaults policy; roadmap "Slice 2.3"). */
    fun onFollow() {
        val n = name ?: return
        if (_state.value.followBusy) return
        _state.update { it.copy(followBusy = true, followFailed = false, followNeedsKey = false) }
        viewModelScope.launch {
            val prepared = when (val outcome = topics.prepareFollow(n, StancePair.TapDefault)) {
                is Outcome.Success -> outcome.value
                else -> return@launch failFollow()
            }
            val results = try {
                signer.sign(prepared)
            } catch (_: NoActorKeyException) {
                return@launch failFollow(needsKey = true)
            }
            if (results.all { it is WriteResult.Done }) {
                _state.update { it.copy(followBusy = false, following = true) }
                readFollowStanding()
            } else {
                failFollow()
            }
        }
    }

    /** Unfollow: opens the severance confirm (D9), reusing the design system's own dialog. */
    fun onOpenUnfollow() {
        val n = name ?: return
        viewModelScope.launch {
            when (val outcome = topics.followSeveranceQuote(n)) {
                is Outcome.Success -> _state.update { it.copy(severance = outcome.value, severanceFailed = false) }
                else -> Unit
            }
        }
    }

    fun onDismissUnfollow() = _state.update { it.copy(severance = null) }

    fun onConfirmUnfollow() {
        val n = name ?: return
        if (_state.value.severanceWorking) return
        _state.update { it.copy(severanceWorking = true, severanceFailed = false) }
        viewModelScope.launch {
            val prepared = when (val outcome = topics.prepareUnfollow(n)) {
                is Outcome.Success -> outcome.value
                else -> return@launch failUnfollow()
            }
            val results = try {
                signer.sign(prepared)
            } catch (_: NoActorKeyException) {
                return@launch failUnfollow()
            }
            if (results.all { it is WriteResult.Done }) {
                _state.update { it.copy(severanceWorking = false, severance = null, following = false) }
                readFollowStanding()
            } else {
                failUnfollow()
            }
        }
    }

    private fun failFollow(needsKey: Boolean = false) =
        _state.update { it.copy(followBusy = false, followFailed = true, followNeedsKey = needsKey) }

    private fun failUnfollow() = _state.update { it.copy(severanceWorking = false, severanceFailed = true) }
}

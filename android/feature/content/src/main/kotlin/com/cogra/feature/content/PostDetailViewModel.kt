package com.cogra.feature.content

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.CommentView
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.OversightChoice
import com.cogra.domain.PostView
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class PostDetailUiState(
    val loading: Boolean = true,
    val post: PostView? = null,
    val comments: List<CommentView> = emptyList(),
    val commentsEndCursor: String? = null,
    val commentsHaveMore: Boolean = false,
    val loadingMore: Boolean = false,
    val notFound: Boolean = false,
    val transportFailed: Boolean = false,
    /** The comment box. */
    val draft: String = "",
    val attributionRequired: Boolean = false,
    val oversight: OversightChoice = OversightChoice.NONE,
    val submitting: Boolean = false,
    val refused: Boolean = false,
    val signingFailed: Boolean = false,
    /** One-shot: the comment signed; shown once, then consumed. */
    val commentSigned: Boolean = false,
)

/**
 * One post and its direct thread (comment.md §2), with the comment box
 * — a genesis Review signed on this device. A freshly signed comment is
 * still in flight (confirmation is asynchronous), so the thread shows
 * it only once its record lands; the refresh after landing is a pull.
 */
@HiltViewModel
class PostDetailViewModel @Inject constructor(
    private val content: ContentRepository,
    private val signer: WriteSigner,
) : ViewModel() {

    private val _state = MutableStateFlow(PostDetailUiState())
    val state = _state.asStateFlow()

    private var postId: String? = null

    fun start(id: String) {
        if (postId == id) return
        postId = id
        refresh()
    }

    fun refresh() {
        val id = postId ?: return
        _state.update { it.copy(loading = true, transportFailed = false) }
        viewModelScope.launch {
            when (val outcome = content.post(id, FEED_PAGE_SIZE, commentsAfter = null)) {
                is Outcome.Success -> {
                    val detail = outcome.value
                    if (detail == null) {
                        _state.update { it.copy(loading = false, notFound = true) }
                    } else {
                        _state.update {
                            it.copy(
                                loading = false,
                                post = detail.post,
                                comments = detail.comments.items,
                                commentsEndCursor = detail.comments.endCursor,
                                commentsHaveMore = detail.comments.hasNextPage,
                            )
                        }
                    }
                }
                is Outcome.Refused -> _state.update { it.copy(loading = false, notFound = true) }
                is Outcome.Failed -> _state.update { it.copy(loading = false, transportFailed = true) }
            }
        }
    }

    fun loadMoreComments() {
        val id = postId ?: return
        val s = _state.value
        if (s.loadingMore || !s.commentsHaveMore) return
        _state.update { it.copy(loadingMore = true) }
        viewModelScope.launch {
            when (val outcome = content.comments(id, FEED_PAGE_SIZE, s.commentsEndCursor)) {
                is Outcome.Success -> _state.update {
                    it.copy(
                        loadingMore = false,
                        comments = it.comments + outcome.value.items,
                        commentsEndCursor = outcome.value.endCursor,
                        commentsHaveMore = outcome.value.hasNextPage,
                    )
                }
                else -> _state.update { it.copy(loadingMore = false, transportFailed = true) }
            }
        }
    }

    fun onDraftChange(v: String) = _state.update { it.copy(draft = v) }
    fun onAttributionChange(v: Boolean) = _state.update { it.copy(attributionRequired = v) }
    fun onOversightChange(v: OversightChoice) = _state.update { it.copy(oversight = v) }
    fun onCommentSignedShown() = _state.update { it.copy(commentSigned = false) }

    fun onSubmitComment() {
        val id = postId ?: return
        val s = _state.value
        if (s.submitting || s.draft.isBlank()) return
        _state.update {
            it.copy(submitting = true, refused = false, signingFailed = false, transportFailed = false)
        }
        viewModelScope.launch {
            val prepared = when (
                val outcome = content.prepareComment(
                    target = id,
                    content = s.draft,
                    license = LicenseChoice(s.attributionRequired, s.oversight),
                )
            ) {
                is Outcome.Success -> outcome.value
                is Outcome.Refused -> {
                    _state.update { it.copy(submitting = false, refused = true) }
                    return@launch
                }
                is Outcome.Failed -> {
                    _state.update { it.copy(submitting = false, transportFailed = true) }
                    return@launch
                }
            }
            val results = signer.sign(prepared.writes)
            if (results.all { it is WriteResult.Done }) {
                _state.update { it.copy(submitting = false, draft = "", commentSigned = true) }
            } else {
                _state.update { it.copy(submitting = false, signingFailed = true) }
            }
        }
    }
}

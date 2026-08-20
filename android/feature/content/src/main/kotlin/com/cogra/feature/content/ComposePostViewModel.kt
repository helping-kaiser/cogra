package com.cogra.feature.content

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.signing.NoActorKeyException
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ComposePostUiState(
    /** Null for a new post; the edited post's id otherwise. */
    val editingId: String? = null,
    val loading: Boolean = false,
    val title: String = "",
    val description: String = "",
    val body: String = "",
    val license: LicenseChoice = LicenseChoice.PublicDomain,
    val submitting: Boolean = false,
    val emptyBody: Boolean = false,
    val refused: Boolean = false,
    val signingFailed: Boolean = false,
    /** The device held no key when signing failed — restore, don't wait. */
    val signingNeedsKey: Boolean = false,
    val transportFailed: Boolean = false,
    val notFound: Boolean = false,
    /** One-shot: the write signed; the caller pops back and refreshes. */
    val saved: Boolean = false,
)

/**
 * The composer, in create and edit mode. Create is a genesis Publish;
 * edit is the ordinary-role Publish behind the chain head, prepared by
 * the backend and signed here (post.md §1, §4). License qualifiers are
 * declared at authoring and immutable — the edit form never shows them.
 */
@HiltViewModel
class ComposePostViewModel @Inject constructor(
    private val content: ContentRepository,
    private val signer: WriteSigner,
) : ViewModel() {

    private val _state = MutableStateFlow(ComposePostUiState())
    val state = _state.asStateFlow()

    /** Route entry: null for create, a post id for edit (pre-fills). */
    fun start(postId: String?) {
        if (postId == null || _state.value.editingId == postId) return
        _state.update { it.copy(editingId = postId, loading = true) }
        viewModelScope.launch {
            when (val outcome = content.post(postId, commentsFirst = 1, commentsAfter = null)) {
                is Outcome.Success -> {
                    val post = outcome.value?.post
                    if (post == null) {
                        _state.update { it.copy(loading = false, notFound = true) }
                    } else {
                        _state.update {
                            it.copy(
                                loading = false,
                                title = post.title.value.orEmpty(),
                                description = post.description.value.orEmpty(),
                                body = post.content.value.orEmpty(),
                            )
                        }
                    }
                }
                is Outcome.Refused -> _state.update { it.copy(loading = false, notFound = true) }
                is Outcome.Failed -> _state.update { it.copy(loading = false, transportFailed = true) }
            }
        }
    }

    fun onTitleChange(v: String) = _state.update { it.copy(title = v) }
    fun onDescriptionChange(v: String) = _state.update { it.copy(description = v) }
    fun onBodyChange(v: String) = _state.update { it.copy(body = v, emptyBody = false) }
    fun onLicenseChange(v: LicenseChoice) = _state.update { it.copy(license = v) }
    fun onSavedConsumed() = _state.update { it.copy(saved = false) }

    fun onSubmit() {
        val s = _state.value
        if (s.submitting) return
        if (s.body.isBlank() && s.editingId == null) {
            _state.update { it.copy(emptyBody = true) }
            return
        }
        _state.update {
            it.copy(
                submitting = true,
                refused = false,
                signingFailed = false,
                signingNeedsKey = false,
                transportFailed = false,
            )
        }
        viewModelScope.launch {
            val outcome = if (s.editingId == null) {
                content.preparePost(
                    title = s.title.ifBlank { null },
                    description = s.description.ifBlank { null },
                    content = s.body,
                    license = s.license,
                )
            } else {
                content.preparePostEdit(
                    id = s.editingId,
                    title = s.title.ifBlank { null },
                    description = s.description.ifBlank { null },
                    content = s.body,
                )
            }
            val prepared = when (outcome) {
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
            val results = try {
                signer.sign(prepared.writes)
            } catch (_: NoActorKeyException) {
                // A husk device: the write waits on the reader restoring
                // the key, not on time passing (the invites twin) —
                // without the catch the coroutine would die unreported.
                _state.update {
                    it.copy(submitting = false, signingFailed = true, signingNeedsKey = true)
                }
                return@launch
            }
            if (results.all { it is WriteResult.Done }) {
                _state.update { it.copy(submitting = false, saved = true) }
            } else {
                _state.update { it.copy(submitting = false, signingFailed = true) }
            }
        }
    }
}

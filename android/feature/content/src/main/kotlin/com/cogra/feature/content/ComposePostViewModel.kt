package com.cogra.feature.content

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.cogra.domain.LicenseChoice
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.repo.ContentRepository
import com.cogra.domain.repo.TopicRepository
import com.cogra.domain.signing.NoActorKeyException
import com.cogra.domain.signing.WriteResult
import com.cogra.domain.signing.WriteSigner
import com.cogra.domain.store.IdentityStore
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
    /**
     * The topics this post will carry once the submit lands: staged
     * chips when creating, the post's current tags plus the author's
     * changes when editing (F3).
     */
    val tagSection: TagSectionState = TagSectionState(),
    val loadedTitle: String = "",
    val loadedDescription: String = "",
    val loadedBody: String = "",
    val submitting: Boolean = false,
    val emptyBody: Boolean = false,
    /** A refusal that named no chip of its own, in the server's words (F2). */
    val refusal: String? = null,
    val signingFailed: Boolean = false,
    /** The device held no key when signing failed — restore, don't wait. */
    val signingNeedsKey: Boolean = false,
    val transportFailed: Boolean = false,
    val notFound: Boolean = false,
    /** One-shot: the write signed; the caller leaves the composer. */
    val saved: Boolean = false,
    /** The multi-action confirm is open, holding this submit (F4). */
    val confirmPending: Boolean = false,
    /** The device preference behind that confirm. */
    val confirmMultiActionSubmits: Boolean = true,
) {
    val creating: Boolean get() = editingId == null

    /** Whether the edit record has anything to carry (F4's count depends on it). */
    val contentChanged: Boolean
        get() = creating ||
            title != loadedTitle ||
            description != loadedDescription ||
            body != loadedBody

    /**
     * What this submit will stage, counted the way the batch is priced —
     * each record its own signed act (F4). Live, so the reader watches
     * it move as they type. A creation's tags ride the minting write's
     * own input, so the server stages one Tag record per declared topic
     * beside it; an edit stages each change as its own standalone act.
     */
    val signedActionCount: Int
        get() = if (creating) {
            1 + tagSection.tags.size
        } else {
            (if (contentChanged) 1 else 0) + tagSection.changeCount
        }

    /** Nothing to sign: an edit opened and left alone stages no record. */
    val nothingToSign: Boolean get() = signedActionCount == 0
}

/**
 * The composer, in create and edit mode. Create is a genesis Publish;
 * edit is the ordinary-role Publish behind the chain head, prepared by
 * the backend and signed here (post.md §1, §4). License qualifiers are
 * declared at authoring and immutable — the edit form never shows them.
 *
 * Tags are never fields of either record (post.md §3): they are their
 * own Tag acts, staged beside the content write and signed with it in
 * one pass, so a submit is one signing flow however many records it
 * carries (F3).
 */
@HiltViewModel
class ComposePostViewModel @Inject constructor(
    private val content: ContentRepository,
    private val topics: TopicRepository,
    private val signer: WriteSigner,
    private val identity: IdentityStore,
) : ViewModel() {

    private val _state = MutableStateFlow(ComposePostUiState())
    val state = _state.asStateFlow()

    init {
        viewModelScope.launch {
            identity.confirmMultiActionSubmits.collect { on ->
                _state.update { it.copy(confirmMultiActionSubmits = on) }
            }
        }
    }

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
                        val tags = post.topics.map { claim ->
                            TagRow(
                                name = claim.hashtag.name.value.orEmpty(),
                                relevance = claim.relevance,
                                confidence = claim.confidence,
                            )
                        }
                        _state.update {
                            it.copy(
                                loading = false,
                                title = post.title.value.orEmpty(),
                                description = post.description.value.orEmpty(),
                                body = post.content.value.orEmpty(),
                                loadedTitle = post.title.value.orEmpty(),
                                loadedDescription = post.description.value.orEmpty(),
                                loadedBody = post.content.value.orEmpty(),
                                tagSection = TagSectionState(tags = tags, loaded = tags),
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

    fun onTagInputChange(v: String) = updateTags { it.withInput(v) }

    fun onAddTag() = updateTags { it.added() }

    fun onRemoveTag(name: String) = updateTags { it.removed(name) }

    /** Tapping a staged chip opens its parameters (F6). */
    fun onTuneTag(name: String) = updateTags { it.tuned(name) }

    fun onDoneTuningTag() = updateTags { it.tuned(null) }

    fun onTagRelevanceChange(name: String, value: Double) = updateTags { it.withRelevance(name, value) }

    fun onTagConfidenceChange(name: String, value: Double) = updateTags { it.withConfidence(name, value) }

    private fun updateTags(block: (TagSectionState) -> TagSectionState) = _state.update {
        it.copy(tagSection = block(it.tagSection))
    }

    /**
     * The submit gate (F4): a batch of more than one signed act asks
     * first, unless this device has been told not to.
     */
    fun onSubmit() {
        val s = _state.value
        if (s.submitting || s.confirmPending) return
        if (s.creating && s.body.isBlank()) {
            _state.update { it.copy(emptyBody = true) }
            return
        }
        if (s.nothingToSign) return
        if (s.confirmMultiActionSubmits && s.signedActionCount > 1) {
            _state.update { it.copy(confirmPending = true) }
            return
        }
        stage()
    }

    fun onConfirmSubmit(dontAskAgain: Boolean) {
        if (dontAskAgain) viewModelScope.launch { identity.setConfirmMultiActionSubmits(false) }
        _state.update { it.copy(confirmPending = false) }
        stage()
    }

    fun onDismissConfirm() = _state.update { it.copy(confirmPending = false) }

    /**
     * Stages every record this submit carries, then signs them together.
     * A refusal from any prepare stops before signing: nothing was
     * signed, so nothing may claim signing failed (F2).
     */
    private fun stage() {
        val s = _state.value
        _state.update {
            it.copy(
                submitting = true,
                refusal = null,
                signingFailed = false,
                signingNeedsKey = false,
                transportFailed = false,
                tagSection = it.tagSection.withoutErrors(),
            )
        }
        viewModelScope.launch {
            val writes = mutableListOf<PreparedWriteView>()
            val editingId = s.editingId
            if (editingId == null) {
                when (val outcome = content.preparePost(
                    title = s.title.ifBlank { null },
                    description = s.description.ifBlank { null },
                    content = s.body,
                    license = s.license,
                    tags = s.tagSection.tags.map { it.toClaim() },
                )) {
                    is Outcome.Success -> writes += outcome.value.writes
                    is Outcome.Refused -> return@launch refuse(outcome.errors)
                    is Outcome.Failed -> return@launch failTransport()
                }
            } else {
                if (s.contentChanged) {
                    when (val outcome = content.preparePostEdit(
                        id = editingId,
                        title = s.title.ifBlank { null },
                        description = s.description.ifBlank { null },
                        content = s.body,
                    )) {
                        is Outcome.Success -> writes += outcome.value.writes
                        is Outcome.Refused -> return@launch refuse(outcome.errors)
                        is Outcome.Failed -> return@launch failTransport()
                    }
                }
                for (row in s.tagSection.adds) {
                    when (val outcome = topics.prepareTag(editingId, row.name, row.relevance, row.confidence)) {
                        is Outcome.Success -> writes += outcome.value
                        is Outcome.Refused -> return@launch refuseTag(row.name, outcome.errors)
                        is Outcome.Failed -> return@launch failTransport()
                    }
                }
                for (name in s.tagSection.removes) {
                    when (val outcome = topics.prepareTag(editingId, name, pDirected = WITHDRAWN)) {
                        is Outcome.Success -> writes += outcome.value
                        is Outcome.Refused -> return@launch refuseTag(name, outcome.errors)
                        is Outcome.Failed -> return@launch failTransport()
                    }
                }
            }
            val results = try {
                signer.sign(writes)
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

    /**
     * A refusal from a write whose input carries the whole batch: the
     * server names the offender by path, so `["tags", i, …]` lands on
     * chip i and everything else says its piece once (F2).
     */
    private fun refuse(errors: List<UserError>) = _state.update { st ->
        var section = st.tagSection
        val unplaced = mutableListOf<String>()
        for (error in errors) {
            val index = tagFieldIndex(error.field)
            val (next, left) = if (index == null) {
                section to error.message
            } else {
                section.withErrorAt(index, error.message)
            }
            section = next
            left?.let { unplaced += it }
        }
        st.copy(submitting = false, tagSection = section, refusal = unplaced.firstOrNull())
    }

    /**
     * A refusal from a standalone Tag: its input holds one name, so the
     * chip it was staged for is the offender — a removal has no chip
     * left to carry the message, so that one surfaces on its own.
     */
    private fun refuseTag(name: String, errors: List<UserError>) = _state.update { st ->
        val (section, unplaced) = st.tagSection.withError(name, errors.firstOrNull()?.message)
        st.copy(submitting = false, tagSection = section, refusal = unplaced)
    }

    private fun failTransport() = _state.update { it.copy(submitting = false, transportFailed = true) }

    private companion object {
        /** A tag withdrawal is a Tag act at relevance 0 (hashtag.md §4). */
        const val WITHDRAWN = 0.0
    }
}

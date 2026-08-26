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
import com.cogra.domain.topics.TAG_DEFAULT_CONFIDENCE
import com.cogra.domain.topics.TAG_DEFAULT_RELEVANCE
import com.cogra.domain.topics.TagClaim
import com.cogra.domain.topics.canonicalTagName
import com.cogra.domain.topics.isAddableTagName
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * One tag this submit will declare: the canonical name, the two
 * parameters its sliders carry, and the server's own words about it
 * when the write was refused on this chip (F2).
 */
data class TagRow(
    val name: String,
    val relevance: Double = TAG_DEFAULT_RELEVANCE,
    val confidence: Double = TAG_DEFAULT_CONFIDENCE,
    val error: String? = null,
) {
    fun sameClaimAs(other: TagRow): Boolean =
        name == other.name && relevance == other.relevance && confidence == other.confidence
}

data class ComposePostUiState(
    /** Null for a new post; the edited post's id otherwise. */
    val editingId: String? = null,
    val loading: Boolean = false,
    val title: String = "",
    val description: String = "",
    val body: String = "",
    val license: LicenseChoice = LicenseChoice.PublicDomain,
    /** The tag entry field's raw text — [canonicalTagName] shows what it will become. */
    val tagInput: String = "",
    /**
     * The topics this post will carry once the submit lands: staged
     * chips when creating, the post's current tags plus the author's
     * changes when editing (F3).
     */
    val tags: List<TagRow> = emptyList(),
    /** What the edit loaded — what a change is measured against. */
    val loadedTags: List<TagRow> = emptyList(),
    val loadedTitle: String = "",
    val loadedDescription: String = "",
    val loadedBody: String = "",
    /** Which chip has its parameter sliders open; null when none. */
    val tagBeingTuned: String? = null,
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

    /** The batch cap (D18) — the composer blocks the 11th chip itself. */
    val tagCapReached: Boolean get() = tags.size >= MAX_TAGS

    /** Whether the edit record has anything to carry (F4's count depends on it). */
    val contentChanged: Boolean
        get() = creating ||
            title != loadedTitle ||
            description != loadedDescription ||
            body != loadedBody

    /**
     * Every tag this submit declares: on the edit screen, the ones the
     * post did not already carry at these parameters — re-declaring a
     * tag at a new relevance is its own Tag act, not a no-op.
     */
    val tagAdds: List<TagRow>
        get() = if (creating) tags else tags.filter { row -> loadedTags.none { it.sameClaimAs(row) } }

    /** Tags the author took off — each a further Tag at relevance 0 (hashtag.md §4). */
    val tagRemoves: List<String>
        get() = if (creating) emptyList() else loadedTags.map { it.name }.filter { name -> tags.none { it.name == name } }

    /**
     * What this submit will stage, counted the way the batch is priced —
     * each record its own signed act (F4). Live, so the reader watches
     * it move as they type.
     */
    val signedActionCount: Int
        get() = if (creating) 1 + tags.size else (if (contentChanged) 1 else 0) + tagAdds.size + tagRemoves.size

    /** Nothing to sign: an edit opened and left alone stages no record. */
    val nothingToSign: Boolean get() = signedActionCount == 0
}

/** Mirrors the API's batch cap (D18) so the composer refuses locally, not with a round trip. */
const val MAX_TAGS = 10

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
                                tags = tags,
                                loadedTags = tags,
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

    fun onTagInputChange(v: String) = _state.update { it.copy(tagInput = v) }

    /**
     * Adds the current entry as a chip: canonical, capped at 10 (D18),
     * legal by L1's atom rule (F1), and never duplicated — re-entering a
     * name already staged just clears the field, the same as a
     * successful add would.
     */
    fun onAddTag() {
        val s = _state.value
        if (s.tagCapReached) return
        if (!isAddableTagName(s.tagInput)) return
        val name = canonicalTagName(s.tagInput)
        _state.update {
            it.copy(
                tagInput = "",
                tags = if (it.tags.any { row -> row.name == name }) it.tags else it.tags + TagRow(name),
            )
        }
    }

    fun onRemoveTag(name: String) = _state.update {
        it.copy(tags = it.tags.filterNot { row -> row.name == name }, tagBeingTuned = null)
    }

    /** Tapping a staged chip opens its parameters (F6). */
    fun onTuneTag(name: String) = _state.update { it.copy(tagBeingTuned = name) }

    fun onDoneTuningTag() = _state.update { it.copy(tagBeingTuned = null) }

    fun onTagRelevanceChange(name: String, value: Double) = updateTag(name) { it.copy(relevance = value) }

    fun onTagConfidenceChange(name: String, value: Double) = updateTag(name) { it.copy(confidence = value) }

    private fun updateTag(name: String, block: (TagRow) -> TagRow) = _state.update { st ->
        st.copy(tags = st.tags.map { if (it.name == name) block(it) else it })
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
                tags = it.tags.map { row -> row.copy(error = null) },
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
                    tags = s.tags.map { TagClaim(it.name, it.relevance, it.confidence) },
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
                for (row in s.tagAdds) {
                    when (val outcome = topics.prepareTag(editingId, row.name, row.relevance, row.confidence)) {
                        is Outcome.Success -> writes += outcome.value
                        is Outcome.Refused -> return@launch refuseTag(row.name, outcome.errors)
                        is Outcome.Failed -> return@launch failTransport()
                    }
                }
                for (name in s.tagRemoves) {
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
        val tags = st.tags.toMutableList()
        val unplaced = mutableListOf<String>()
        for (error in errors) {
            val index = tagIndex(error.field)
            if (index != null && index in tags.indices) {
                tags[index] = tags[index].copy(error = error.message)
            } else {
                unplaced += error.message
            }
        }
        st.copy(submitting = false, tags = tags, refusal = unplaced.firstOrNull())
    }

    /**
     * A refusal from a standalone Tag: its input holds one name, so the
     * chip it was staged for is the offender — a removal has no chip
     * left to carry the message, so that one surfaces on its own.
     */
    private fun refuseTag(name: String, errors: List<UserError>) = _state.update { st ->
        val message = errors.firstOrNull()?.message
        val placed = st.tags.any { it.name == name }
        st.copy(
            submitting = false,
            tags = st.tags.map { if (it.name == name) it.copy(error = message) else it },
            refusal = if (placed) null else message,
        )
    }

    private fun failTransport() = _state.update { it.copy(submitting = false, transportFailed = true) }

    private companion object {
        /** A tag withdrawal is a Tag act at relevance 0 (hashtag.md §4). */
        const val WITHDRAWN = 0.0

        /** `["tags", i, "name"]` — the chip the server is talking about. */
        fun tagIndex(field: List<String>?): Int? {
            if (field == null || field.size < 2 || field[0] != "tags") return null
            return field[1].toIntOrNull()
        }
    }
}

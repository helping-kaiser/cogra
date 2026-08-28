// The compose wizard's local draft, at rest.
//
// It rides the same Tink-sealed store the tokens and the actor seed do,
// scoped to the signed-in account. A draft is the author's unpublished
// words and a list of pointers into their photo library — not a secret
// on the level of a key, but not something to leave in cleartext for
// any process with the app's storage either, and reusing the shipped
// store costs one class instead of a second DataStore.

package com.cogra.network.store

import com.cogra.domain.compose.ComposeDraft
import com.cogra.domain.compose.ComposeDraftStore
import com.cogra.domain.compose.DraftAsset
import com.cogra.domain.compose.DraftBodyKind
import com.cogra.domain.compose.DraftShape
import com.cogra.domain.store.TokenStore
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

@kotlinx.serialization.Serializable
private data class StoredAsset(val uri: String, val altText: String = "")

@kotlinx.serialization.Serializable
private data class StoredDraft(
    val bodyKind: String,
    val body: String = "",
    val title: String = "",
    val description: String = "",
    val assets: List<StoredAsset> = emptyList(),
    val shape: String = "Tall",
    val sensitive: Boolean = false,
    val sensitiveReason: String = "",
)

@Singleton
class ComposeDraftStoreImpl @Inject constructor(
    private val store: EncryptedStore,
    private val tokens: TokenStore,
) : ComposeDraftStore {

    private val json = Json { ignoreUnknownKeys = true }

    /** Null with no session: a draft belongs to whoever was writing it. */
    private suspend fun key(): String? =
        tokens.current()?.accountId?.let { "$KEY_PREFIX$it" }

    override suspend fun draft(): ComposeDraft? {
        val bytes = store.get(key() ?: return null) ?: return null
        val stored = try {
            json.decodeFromString(StoredDraft.serializer(), bytes.decodeToString())
        } catch (_: SerializationException) {
            // A draft that will not decode is no draft. It is dropped
            // rather than marked as storage loss: losing an unpublished
            // post is worth a quiet clear, not the shell's data-loss
            // dialog, which exists for identity material.
            store.remove(key() ?: return null)
            return null
        }
        // A body kind or shape this build cannot name reads as its
        // default rather than crashing the composer open — the same
        // degrade-never-crash rule the generated enums follow.
        return ComposeDraft(
            bodyKind = runCatching { DraftBodyKind.valueOf(stored.bodyKind) }
                .getOrDefault(DraftBodyKind.Words),
            body = stored.body,
            title = stored.title,
            description = stored.description,
            assets = stored.assets.map { DraftAsset(it.uri, it.altText) },
            shape = runCatching { DraftShape.valueOf(stored.shape) }
                .getOrDefault(DraftShape.Tall),
            sensitive = stored.sensitive,
            sensitiveReason = stored.sensitiveReason,
        )
    }

    override suspend fun save(draft: ComposeDraft) {
        val name = key() ?: return
        if (draft.isEmpty) {
            store.remove(name)
            return
        }
        val stored = StoredDraft(
            bodyKind = draft.bodyKind.name,
            body = draft.body,
            title = draft.title,
            description = draft.description,
            assets = draft.assets.map { StoredAsset(it.uri, it.altText) },
            shape = draft.shape.name,
            sensitive = draft.sensitive,
            sensitiveReason = draft.sensitiveReason,
        )
        store.put(name, json.encodeToString(StoredDraft.serializer(), stored).encodeToByteArray())
    }

    override suspend fun clear() {
        store.remove(key() ?: return)
    }

    private companion object {
        const val KEY_PREFIX = "compose_draft:"
    }
}

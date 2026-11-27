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
import com.cogra.domain.compose.SealVerdict
import com.cogra.domain.compose.SealedDraft
import com.cogra.domain.compose.SealedDraftStore
import com.cogra.domain.compose.StagedFate
import com.cogra.domain.compose.sealVerdict
import com.cogra.domain.signing.SigningAttempt
import com.cogra.domain.store.TokenStore
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json

@kotlinx.serialization.Serializable
private data class StoredAsset(val uri: String, val altText: String = "")

/** A pending signing, without its owner: the key it is stored under names the account. */
@kotlinx.serialization.Serializable
private data class StoredAttempt(val node: String, val writes: List<String>, val intent: String)

@kotlinx.serialization.Serializable
private data class StoredDraft(
    val bodyKind: String,
    val body: String = "",
    val title: String = "",
    val description: String = "",
    val assets: List<StoredAsset> = emptyList(),
    val shape: String = "Tall",
    val attempt: StoredAttempt? = null,
)

@Singleton
class ComposeDraftStoreImpl @Inject constructor(
    private val store: EncryptedStore,
    private val tokens: TokenStore,
) : ComposeDraftStore {

    private val json = Json { ignoreUnknownKeys = true }

    /** Null with no session: a draft belongs to whoever was writing it. */
    private suspend fun account(): String? = tokens.current()?.accountId

    private suspend fun key(): String? = account()?.let(::composeDraftKey)

    override suspend fun draft(): ComposeDraft? {
        val account = account() ?: return null
        val name = composeDraftKey(account)
        val bytes = store.get(name) ?: return null
        val stored = try {
            json.decodeFromString(StoredDraft.serializer(), bytes.decodeToString())
        } catch (_: SerializationException) {
            // A draft that will not decode is no draft. It is dropped
            // rather than marked as storage loss: losing an unpublished
            // post is worth a quiet clear, not the shell's data-loss
            // dialog, which exists for identity material.
            store.remove(name)
            return null
        }
        return stored.toDomain(owner = account)
    }

    override suspend fun save(draft: ComposeDraft) {
        val account = account() ?: return
        val name = composeDraftKey(account)
        if (draft.isEmpty) {
            store.remove(name)
            return
        }
        store.put(
            name,
            json.encodeToString(StoredDraft.serializer(), draft.toStored(owner = account)).encodeToByteArray(),
        )
    }

    override suspend fun clear() {
        store.remove(key() ?: return)
    }
}

/**
 * The draft as it goes to disk, and back. A body kind or shape this build
 * cannot name reads as its default rather than crashing the composer
 * open — the same degrade-never-crash rule the generated enums follow.
 *
 * THE PENDING SIGNING IS ITS ACCOUNT'S (auth.md "Multi-account device
 * custody"): it is written only under [owner]'s key, and read back as
 * [owner]'s, so no account's draft ever carries another's attempt. A sealed
 * copy ([owner] null) carries none.
 */
private fun ComposeDraft.toStored(owner: String? = null) = StoredDraft(
    bodyKind = bodyKind.name,
    body = body,
    title = title,
    description = description,
    assets = assets.map { StoredAsset(it.uri, it.altText) },
    shape = shape.name,
    attempt = attempt
        ?.takeIf { owner != null && it.owner == owner }
        ?.let { StoredAttempt(it.node, it.writes, it.intent) },
)

private fun StoredDraft.toDomain(owner: String? = null) = ComposeDraft(
    bodyKind = runCatching { DraftBodyKind.valueOf(bodyKind) }.getOrDefault(DraftBodyKind.Words),
    body = body,
    title = title,
    description = description,
    assets = assets.map { DraftAsset(it.uri, it.altText) },
    shape = runCatching { DraftShape.valueOf(shape) }.getOrDefault(DraftShape.Tall),
    attempt = owner?.let { account -> attempt?.let { SigningAttempt(account, it.node, it.writes, it.intent) } },
)

@kotlinx.serialization.Serializable
private data class StoredSeal(
    val node: String,
    val writes: List<String>,
    val sealedAt: Long,
    val draft: StoredDraft,
)

/**
 * The sealed copies of staged posts ([SealedDraftStore], FC-G5), in the
 * draft's own store under keys of their own — the same tier as the
 * draft, so they survive exactly what it survives, and the explicit
 * sign-out's custody purge takes them with it.
 */
@Singleton
class SealedDraftStoreImpl @Inject constructor(
    private val store: EncryptedStore,
    private val tokens: TokenStore,
) : SealedDraftStore {

    private val json = Json { ignoreUnknownKeys = true }

    private suspend fun account(): String? = tokens.current()?.accountId

    /**
     * Every readable copy of [account], oldest first. One that will not
     * open or decode is LEFT where it is — never purged, since what it
     * holds is someone's post — and simply not settled.
     */
    private suspend fun records(account: String): List<Pair<String, StoredSeal>> =
        store.names(composeSealedPrefix(account))
            .mapNotNull { name ->
                val bytes = store.get(name) ?: return@mapNotNull null
                try {
                    name to json.decodeFromString(StoredSeal.serializer(), bytes.decodeToString())
                } catch (_: SerializationException) {
                    null
                }
            }
            .sortedWith(compareBy({ it.second.sealedAt }, { it.first }))

    override suspend fun seal(draft: ComposeDraft, node: String, writes: List<String>) {
        val account = account() ?: return
        val first = writes.firstOrNull() ?: return
        val seal = StoredSeal(
            node = node,
            writes = writes,
            sealedAt = System.currentTimeMillis(),
            draft = draft.toStored(),
        )
        val bytes = json.encodeToString(StoredSeal.serializer(), seal).encodeToByteArray()
        // ONE edit: the copy is written and the working draft dropped
        // together, so there is no instant at which neither holds the post.
        store.edit {
            put(composeSealedPrefix(account) + first, bytes)
            remove(composeDraftKey(account))
        }
    }

    override suspend fun sealed(): List<SealedDraft> {
        val account = account() ?: return emptyList()
        return records(account).map { (_, seal) -> SealedDraft(seal.node, seal.writes, seal.draft.toDomain()) }
    }

    override suspend fun settle(fate: suspend (writeId: String) -> StagedFate) {
        val account = account() ?: return
        val draftKey = composeDraftKey(account)
        for ((name, seal) in records(account)) {
            when (sealVerdict(seal.writes.map { fate(it) })) {
                SealVerdict.Purge -> store.remove(name)
                // Only into an EMPTY draft slot (`ComposeDraft`: one draft
                // per target): a draft started since is never overwritten,
                // and the copy waits sealed until the slot is free.
                SealVerdict.Restore -> store.edit {
                    if (draftKey !in this) {
                        put(draftKey, json.encodeToString(StoredDraft.serializer(), seal.draft).encodeToByteArray())
                        remove(name)
                    }
                }
                SealVerdict.Wait -> Unit
            }
        }
    }
}

/**
 * Where an account's draft lives. Named once, because the explicit
 * sign-out's custody purge (`IdentityStoreImpl.purgeCustodySet`) has to
 * find the same record this store writes.
 */
internal fun composeDraftKey(account: String): String = "compose_draft:$account"

/** Where an account's sealed copies live — one name per staged post, under this prefix. */
internal fun composeSealedPrefix(account: String): String = "compose_sealed:$account:"

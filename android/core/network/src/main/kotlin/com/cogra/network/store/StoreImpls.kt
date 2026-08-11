// The domain stores over the encrypted layer. Tokens overwrite in
// place (the refresh token rotates on every use) and carry the account
// they authenticate; the identity store keys every value — actor seed,
// pending backup blob, per-write handshake material, and flags — by
// that account (auth.md "Multi-account device custody"), and adopts
// records left by earlier single-account builds into the first
// signed-in account's slots.

package com.cogra.network.store

import com.cogra.crypto.PreSignedProposal
import com.cogra.crypto.WireException
import com.cogra.crypto.decodeProposal
import com.cogra.crypto.encodeProposal
import com.cogra.domain.AuthTokens
import com.cogra.domain.store.IdentityStore
import com.cogra.domain.store.TokenStore
import java.util.Base64
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.coroutines.flow.map

@Serializable
private data class StoredTokens(
    val access: String,
    val refresh: String,
    // Absent in records written before multi-account custody; such a
    // record is treated as no session at all (the next login
    // overwrites it) — the accepted one-time re-login.
    val account: String? = null,
)

@Serializable
private data class StoredHandshake(
    val proposal: String,
    val authorPubkey: String,
    val nonce: String,
    val preSignature: String,
)

private val json = Json

private fun b64(bytes: ByteArray): String = Base64.getEncoder().encodeToString(bytes)

private fun unb64(s: String): ByteArray = Base64.getDecoder().decode(s)

@Singleton
class TokenStoreImpl @Inject constructor(private val store: EncryptedStore) : TokenStore {

    override val tokens: Flow<AuthTokens?> = store.watch(KEY).map { bytes ->
        bytes?.let { decodeTokens(it) }
    }

    override suspend fun current(): AuthTokens? = store.get(KEY)?.let { decodeTokens(it) }

    /** A record that decodes to garbage is no session — marked, never fatal. */
    private suspend fun decodeTokens(bytes: ByteArray): AuthTokens? {
        val stored = try {
            json.decodeFromString<StoredTokens>(bytes.decodeToString())
        } catch (_: SerializationException) {
            store.markStorageLost()
            return null
        }
        val account = stored.account ?: return null
        return AuthTokens(stored.access, stored.refresh, account)
    }

    override suspend fun save(tokens: AuthTokens) {
        val stored = StoredTokens(tokens.accessToken, tokens.refreshToken, tokens.accountId)
        store.put(KEY, json.encodeToString(StoredTokens.serializer(), stored).encodeToByteArray())
    }

    override suspend fun clear() {
        store.remove(KEY)
    }

    private companion object {
        const val KEY = "session_tokens"
    }
}

@Singleton
class IdentityStoreImpl @Inject constructor(
    private val store: EncryptedStore,
    private val tokens: TokenStore,
) : IdentityStore {

    private suspend fun account(): String? = tokens.current()?.accountId

    private fun scoped(account: String, name: String) = "$ACCT_PREFIX$account:$name"

    /**
     * Adopt-on-sign-in (auth.md "Multi-account device custody"): a
     * record left under the flat pre-multi-account key moves into the
     * active account's slot on its first scoped access, read or write —
     * a write consumes it too, so no later account can adopt material
     * that already belongs to someone. One-shot per key kind: the move
     * removes the legacy record. An occupied slot is unreachable while
     * a legacy record still exists (nothing writes flat keys anymore),
     * so the value is only dropped where it is already superseded.
     */
    private suspend fun adopt(legacyName: String, scopedName: String) {
        val legacy = store.get(legacyName) ?: return
        if (store.get(scopedName) == null) store.put(scopedName, legacy)
        store.remove(legacyName)
    }

    /** Resolves the active account's key for [name], adopting a legacy record. */
    private suspend fun key(name: String): String? {
        val account = account() ?: return null
        val scoped = scoped(account, name)
        adopt(name, scoped)
        return scoped
    }

    override suspend fun actorSeed(): ByteArray? = key(SEED)?.let { store.get(it) }

    override suspend fun saveActorSeed(seed: ByteArray) {
        key(SEED)?.let { store.put(it, seed) }
    }

    override suspend fun pendingBackupBlob(): ByteArray? = key(PENDING_BLOB)?.let { store.get(it) }

    override suspend fun savePendingBackupBlob(blob: ByteArray) {
        key(PENDING_BLOB)?.let { store.put(it, blob) }
    }

    override suspend fun clearPendingBackupBlob() {
        key(PENDING_BLOB)?.let { store.remove(it) }
    }

    /** The handshake set adopts as a whole: every legacy id moves at once. */
    private suspend fun handshakePrefix(): String? {
        val account = account() ?: return null
        for (legacyName in store.names(HS_PREFIX)) {
            adopt(legacyName, scoped(account, legacyName))
        }
        return scoped(account, HS_PREFIX)
    }

    override suspend fun handshake(stagedWriteId: String): PreSignedProposal? =
        handshakePrefix()?.let { prefix -> store.get(prefix + stagedWriteId) }?.let { bytes ->
            // Garbage material reads as absent — marked, never fatal; the
            // signer treats a missing handshake as its own degraded case.
            try {
                val stored = json.decodeFromString<StoredHandshake>(bytes.decodeToString())
                PreSignedProposal(
                    proposal = decodeProposal(unb64(stored.proposal)),
                    authorPubkey = unb64(stored.authorPubkey),
                    nonce = unb64(stored.nonce),
                    preSignature = unb64(stored.preSignature),
                )
            } catch (_: SerializationException) {
                store.markStorageLost()
                null
            } catch (_: WireException) {
                store.markStorageLost()
                null
            } catch (_: IllegalArgumentException) {
                store.markStorageLost()
                null
            }
        }

    override suspend fun saveHandshake(stagedWriteId: String, pre: PreSignedProposal) {
        val prefix = handshakePrefix() ?: return
        val stored = StoredHandshake(
            proposal = b64(encodeProposal(pre.proposal)),
            authorPubkey = b64(pre.authorPubkey),
            nonce = b64(pre.nonce),
            preSignature = b64(pre.preSignature),
        )
        store.put(
            prefix + stagedWriteId,
            json.encodeToString(StoredHandshake.serializer(), stored).encodeToByteArray(),
        )
    }

    override suspend fun clearHandshake(stagedWriteId: String) {
        handshakePrefix()?.let { store.remove(it + stagedWriteId) }
    }

    override suspend fun handshakeIds(): Set<String> {
        val prefix = handshakePrefix() ?: return emptySet()
        return store.names(prefix).map { it.removePrefix(prefix) }.toSet()
    }

    override suspend fun reciprocationDismissed(): Boolean =
        key(RECIPROCATION)?.let { store.get(it) } != null

    override suspend fun markReciprocationDismissed() {
        key(RECIPROCATION)?.let { store.put(it, byteArrayOf(1)) }
    }

    // No adoption: the flag arrived with multi-account custody, so no
    // legacy record can exist.
    override suspend fun forgetOnSignOut(): Boolean =
        account()?.let { store.get(scoped(it, FORGET)) } != null

    override suspend fun setForgetOnSignOut(value: Boolean) {
        val account = account() ?: return
        val name = scoped(account, FORGET)
        if (value) store.put(name, byteArrayOf(1)) else store.remove(name)
    }

    override suspend fun purge() {
        val account = account() ?: return
        // The whole slot goes: every key of this account, no other's.
        for (name in store.names(scoped(account, ""))) store.remove(name)
    }

    private companion object {
        const val ACCT_PREFIX = "acct:"
        const val SEED = "actor_seed"
        const val PENDING_BLOB = "pending_backup_blob"
        const val RECIPROCATION = "reciprocation_dismissed"
        const val FORGET = "forget_on_sign_out"
        const val HS_PREFIX = "handshake:"
    }
}

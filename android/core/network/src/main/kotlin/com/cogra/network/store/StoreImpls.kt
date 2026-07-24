// The domain stores over the encrypted layer. Tokens overwrite in
// place (the refresh token rotates on every use); the identity store
// keeps the actor seed, the applicant token, the pending backup blob,
// and the per-write handshake material that must survive process death
// (the approve step verifies against what THIS device pre-signed).

package com.cogra.network.store

import com.cogra.crypto.PreSignedProposal
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
import kotlinx.serialization.json.Json
import kotlinx.coroutines.flow.map

@Serializable
private data class StoredTokens(val access: String, val refresh: String)

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
        bytes?.let { json.decodeFromString<StoredTokens>(it.decodeToString()) }
            ?.let { AuthTokens(it.access, it.refresh) }
    }

    override suspend fun current(): AuthTokens? =
        store.get(KEY)?.let { json.decodeFromString<StoredTokens>(it.decodeToString()) }
            ?.let { AuthTokens(it.access, it.refresh) }

    override suspend fun save(tokens: AuthTokens) {
        val stored = StoredTokens(tokens.accessToken, tokens.refreshToken)
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
class IdentityStoreImpl @Inject constructor(private val store: EncryptedStore) : IdentityStore {

    override suspend fun actorSeed(): ByteArray? = store.get(SEED)

    override suspend fun saveActorSeed(seed: ByteArray) = store.put(SEED, seed)

    override suspend fun applicantToken(): String? = store.get(APPLICANT)?.decodeToString()

    override suspend fun saveApplicantToken(token: String) = store.put(APPLICANT, token.encodeToByteArray())

    override suspend fun clearApplicantToken() = store.remove(APPLICANT)

    override suspend fun pendingBackupBlob(): ByteArray? = store.get(PENDING_BLOB)

    override suspend fun savePendingBackupBlob(blob: ByteArray) = store.put(PENDING_BLOB, blob)

    override suspend fun clearPendingBackupBlob() = store.remove(PENDING_BLOB)

    override suspend fun handshake(stagedWriteId: String): PreSignedProposal? =
        store.get(HS_PREFIX + stagedWriteId)?.let { bytes ->
            val stored = json.decodeFromString<StoredHandshake>(bytes.decodeToString())
            PreSignedProposal(
                proposal = decodeProposal(unb64(stored.proposal)),
                authorPubkey = unb64(stored.authorPubkey),
                nonce = unb64(stored.nonce),
                preSignature = unb64(stored.preSignature),
            )
        }

    override suspend fun saveHandshake(stagedWriteId: String, pre: PreSignedProposal) {
        val stored = StoredHandshake(
            proposal = b64(encodeProposal(pre.proposal)),
            authorPubkey = b64(pre.authorPubkey),
            nonce = b64(pre.nonce),
            preSignature = b64(pre.preSignature),
        )
        store.put(
            HS_PREFIX + stagedWriteId,
            json.encodeToString(StoredHandshake.serializer(), stored).encodeToByteArray(),
        )
    }

    override suspend fun clearHandshake(stagedWriteId: String) = store.remove(HS_PREFIX + stagedWriteId)

    override suspend fun handshakeIds(): Set<String> =
        store.names(HS_PREFIX).map { it.removePrefix(HS_PREFIX) }.toSet()

    override suspend fun reciprocationHandled(): Boolean = store.get(RECIPROCATION) != null

    override suspend fun markReciprocationHandled() = store.put(RECIPROCATION, byteArrayOf(1))

    private companion object {
        const val SEED = "actor_seed"
        const val APPLICANT = "applicant_token"
        const val PENDING_BLOB = "pending_backup_blob"
        const val RECIPROCATION = "reciprocation_handled"
        const val HS_PREFIX = "handshake:"
    }
}

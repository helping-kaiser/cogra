// In-memory fakes and a minimal in-test host sealer. The host mirrors
// what the backend's relay does — verify nothing (that's the server's
// job), salt, commit, seal — so the orchestrators exercise the real
// crypto chain end to end.

package com.cogra.domain

import com.cogra.crypto.ActorKey
import com.cogra.crypto.PreSignedProposal
import com.cogra.crypto.SALT_LEN
import com.cogra.crypto.Tags
import com.cogra.crypto.VerifiedAct
import com.cogra.crypto.canonicalDeps
import com.cogra.crypto.commitment
import com.cogra.crypto.decodePreCommitment
import com.cogra.crypto.decodeProposal
import com.cogra.crypto.encodeProposal
import com.cogra.crypto.encodeVerifiedAct
import com.cogra.domain.store.IdentityStore
import com.cogra.domain.store.TokenStore
import kotlinx.coroutines.flow.MutableStateFlow

class FakeTokenStore : TokenStore {
    override val tokens = MutableStateFlow<AuthTokens?>(null)

    override suspend fun current(): AuthTokens? = tokens.value

    override suspend fun save(tokens: AuthTokens) {
        this.tokens.value = tokens
    }

    override suspend fun clear() {
        tokens.value = null
    }
}

class FakeIdentityStore : IdentityStore {
    var seed: ByteArray? = null
    var token: String? = null
    var pendingBlob: ByteArray? = null
    val handshakes = mutableMapOf<String, PreSignedProposal>()

    override suspend fun actorSeed(): ByteArray? = seed

    override suspend fun saveActorSeed(seed: ByteArray) {
        this.seed = seed
    }

    override suspend fun applicantToken(): String? = token

    override suspend fun saveApplicantToken(token: String) {
        this.token = token
    }

    override suspend fun clearApplicantToken() {
        token = null
    }

    override suspend fun pendingBackupBlob(): ByteArray? = pendingBlob

    override suspend fun savePendingBackupBlob(blob: ByteArray) {
        pendingBlob = blob
    }

    override suspend fun clearPendingBackupBlob() {
        pendingBlob = null
    }

    override suspend fun handshake(stagedWriteId: String): PreSignedProposal? = handshakes[stagedWriteId]

    override suspend fun saveHandshake(stagedWriteId: String, pre: PreSignedProposal) {
        handshakes[stagedWriteId] = pre
    }

    override suspend fun clearHandshake(stagedWriteId: String) {
        handshakes.remove(stagedWriteId)
    }

    override suspend fun handshakeIds(): Set<String> = handshakes.keys.toSet()
}

/** The backend's relay side, minimally: salt, commit, seal. */
class TestHost {
    val key: ActorKey = ActorKey.generate()

    fun seal(canonicalProposal: ByteArray, preCommitmentBlob: ByteArray, authorPubkey: ByteArray): ByteArray {
        val proposal = decodeProposal(canonicalProposal)
        val pre = decodePreCommitment(preCommitmentBlob)
        val contentSalt = ByteArray(SALT_LEN) { 3 }
        val depsSalt = ByteArray(SALT_LEN) { 4 }
        val unsealed = VerifiedAct(
            proposal = proposal,
            authorPubkey = authorPubkey,
            nonce = pre.nonce,
            preSignature = pre.preSignature,
            contentSalt = contentSalt,
            depsSalt = depsSalt,
            contentCommitment = commitment(Tags.COMMIT_CONTENT, contentSalt, proposal.payload),
            depsCommitment = commitment(Tags.COMMIT_DEPS, depsSalt, canonicalDeps(proposal.deps)),
            hostSeal = ByteArray(0),
        )
        val sealed = VerifiedAct(
            proposal = unsealed.proposal,
            authorPubkey = unsealed.authorPubkey,
            nonce = unsealed.nonce,
            preSignature = unsealed.preSignature,
            contentSalt = unsealed.contentSalt,
            depsSalt = unsealed.depsSalt,
            contentCommitment = unsealed.contentCommitment,
            depsCommitment = unsealed.depsCommitment,
            hostSeal = key.signTagged(Tags.HOST_SEAL, unsealed.sealMsg()),
        )
        return encodeVerifiedAct(sealed)
    }
}

/** A minimal Opinion proposal in its wire form. */
fun testProposalBytes(author: ActorKey, seq: ULong = 1u): ByteArray {
    val body = com.cogra.crypto.StructuralBody(
        author = author.address(),
        seq = seq,
        family = com.cogra.crypto.Family.OPINION,
        middle = null,
        target = com.cogra.crypto.NodeId.parse("prof:bob"),
        pD = 0.5,
        pI = 0.1,
        settlementRef = null,
        license = null,
        assertedParents = emptyList(),
    )
    return encodeProposal(com.cogra.crypto.Proposal(body, ByteArray(0), emptyList()))
}

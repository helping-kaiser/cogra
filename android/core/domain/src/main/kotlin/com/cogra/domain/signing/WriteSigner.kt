// The session-authorized write orchestration: pre-sign → submit → (await
// seal) → verify → approve → observe (architecture.md "The write path").
// Handshake material persists in the IdentityStore between the two
// signatures so the flow survives process death without ever trusting
// the server's echo of the nonce; `resume` picks up every persisted
// handshake wherever it stopped.

package com.cogra.domain.signing

import com.cogra.crypto.ActorKey
import com.cogra.crypto.Family
import com.cogra.crypto.HandshakeException
import com.cogra.crypto.PreSignedProposal
import com.cogra.crypto.WireException
import com.cogra.domain.ErrorCode
import com.cogra.domain.Outcome
import com.cogra.domain.PreparedWriteView
import com.cogra.domain.StagedWriteView
import com.cogra.domain.UserError
import com.cogra.domain.WriteState
import com.cogra.domain.repo.WriteRepository
import com.cogra.domain.store.IdentityStore
import javax.inject.Inject
import kotlinx.coroutines.delay

/** Where one write's handshake ended up after a signing pass. */
sealed interface WriteResult {
    val stagedWriteId: String

    /** Approved and relaying (or already landed) — the device's part is done. */
    data class Done(override val stagedWriteId: String, val state: WriteState) : WriteResult

    /** Sealing hadn't returned within the polling budget; `resume` continues it. */
    data class AwaitingSeal(override val stagedWriteId: String) : WriteResult

    /** The API refused; the handshake is over. */
    data class Refused(override val stagedWriteId: String, val errors: List<UserError>) : WriteResult

    /** The device refused to sign — the sealed act failed verification. */
    data class RejectedByDevice(override val stagedWriteId: String, val reason: String) : WriteResult

    /** Transport failed mid-handshake; material is kept and `resume` retries. */
    data class Failed(override val stagedWriteId: String, val cause: Exception) : WriteResult
}

/** Thrown when signing is requested with no actor key on the device. */
class NoActorKeyException : Exception("no actor key on this device")

class WriteSigner @Inject constructor(
    private val writes: WriteRepository,
    private val identity: IdentityStore,
) {
    /** Seal-await polling budget: the stand-in seals synchronously, so a
     *  short bounded poll only covers the asynchronous contract. */
    private val sealPollAttempts = 5
    private val sealPollDelayMs = 1_000L

    /**
     * Runs the two-signature handshake for every prepared write. Each
     * write is its own priced act — one result per write, no cross-write
     * atomicity (api-spec.md "The write flow").
     */
    suspend fun sign(prepared: List<PreparedWriteView>): List<WriteResult> {
        val key = actorKey()
        return prepared.map { write -> signOne(key, write) }
    }

    /**
     * Signs one staged write served mid-handshake — the path of the
     * staged Registration, which the backend stages at approval and the
     * device discovers on the status poll (auth.md "Approval and
     * landing"): same two signatures, same verification, through the
     * ordinary session-authorized legs.
     */
    suspend fun signStaged(staged: StagedWriteView): WriteResult {
        if (staged.family == Family.UNKNOWN) return unsupported(staged.id, "record family")
        val key = actorKey()
        return when (staged.state) {
            WriteState.AWAITING_PRE_SIGN -> when (val pre = identity.handshake(staged.id)) {
                // A fresh staging: pre-sign from the served proposal.
                null -> {
                    val step = try {
                        preSignStep(key, staged.canonicalProposal)
                    } catch (e: WireException) {
                        return WriteResult.RejectedByDevice(staged.id, e.message ?: "malformed proposal")
                    }
                    identity.saveHandshake(staged.id, step.pre)
                    when (val submitted = writes.submitProposal(staged.id, step.signatureBase64)) {
                        is Outcome.Success -> approveFrom(key, step.pre, submitted.value)
                        is Outcome.Refused -> refused(staged.id, submitted.errors)
                        is Outcome.Failed -> WriteResult.Failed(staged.id, submitted.cause)
                    }
                }
                // The submit response was lost; re-send THIS device's material.
                else -> when (val submitted = writes.submitProposal(staged.id, preCommitmentSignature(pre))) {
                    is Outcome.Success -> approveFrom(key, pre, submitted.value)
                    is Outcome.Refused -> refused(staged.id, submitted.errors)
                    is Outcome.Failed -> WriteResult.Failed(staged.id, submitted.cause)
                }
            }
            WriteState.SEALING, WriteState.AWAITING_APPROVAL -> when (val pre = identity.handshake(staged.id)) {
                // Pre-signed by a device that is not this one (or the
                // material is gone): only the expiry re-stage recovers.
                null -> WriteResult.Refused(
                    staged.id,
                    listOf(UserError(ErrorCode.INTERNAL, "handshake material lost — awaiting re-stage")),
                )
                else -> approveFrom(key, pre, staged)
            }
            WriteState.RELAYING, WriteState.LANDED -> {
                identity.clearHandshake(staged.id)
                WriteResult.Done(staged.id, staged.state)
            }
            WriteState.EXPIRED -> {
                identity.clearHandshake(staged.id)
                WriteResult.Refused(
                    staged.id,
                    listOf(UserError(ErrorCode.STAGED_WRITE_EXPIRED, "garbage-collected unlanded")),
                )
            }
            WriteState.UNKNOWN -> unsupported(staged.id, "staged-write state")
        }
    }

    /**
     * Continues every persisted handshake from its server-side state —
     * the process-death and lost-response recovery path.
     */
    suspend fun resume(): List<WriteResult> {
        val ids = identity.handshakeIds()
        if (ids.isEmpty()) return emptyList()
        val key = actorKey()
        return ids.map { id -> resumeOne(key, id) }
    }

    private suspend fun actorKey(): ActorKey =
        ActorKey.fromSeed(identity.actorSeed() ?: throw NoActorKeyException())

    private suspend fun signOne(key: ActorKey, write: PreparedWriteView): WriteResult {
        if (write.family == Family.UNKNOWN) return unsupported(write.id, "record family")
        val step = try {
            preSignStep(key, write.canonicalProposal)
        } catch (e: WireException) {
            return WriteResult.RejectedByDevice(write.id, e.message ?: "malformed proposal")
        }
        identity.saveHandshake(write.id, step.pre)
        return when (val submitted = writes.submitProposal(write.id, step.signatureBase64)) {
            is Outcome.Success -> approveFrom(key, step.pre, submitted.value)
            is Outcome.Refused -> refused(write.id, submitted.errors)
            is Outcome.Failed -> WriteResult.Failed(write.id, submitted.cause)
        }
    }

    private suspend fun resumeOne(key: ActorKey, id: String): WriteResult {
        val pre = identity.handshake(id) ?: return WriteResult.Failed(id, IllegalStateException("no material"))
        return when (val read = writes.stagedWrite(id)) {
            is Outcome.Failed -> WriteResult.Failed(id, read.cause)
            is Outcome.Refused -> refused(id, read.errors)
            is Outcome.Success -> when (val staged = read.value) {
                // Gone entirely — collected long ago; nothing to continue.
                null -> {
                    identity.clearHandshake(id)
                    WriteResult.Refused(id, listOf(UserError(ErrorCode.NOT_FOUND, "staged write is gone")))
                }
                else -> if (staged.family == Family.UNKNOWN) {
                    unsupported(id, "record family")
                } else when (staged.state) {
                    // The submit response was lost before the server saw it.
                    WriteState.AWAITING_PRE_SIGN -> {
                        val sig = preCommitmentSignature(pre)
                        when (val submitted = writes.submitProposal(id, sig)) {
                            is Outcome.Success -> approveFrom(key, pre, submitted.value)
                            is Outcome.Refused -> refused(id, submitted.errors)
                            is Outcome.Failed -> WriteResult.Failed(id, submitted.cause)
                        }
                    }
                    WriteState.SEALING, WriteState.AWAITING_APPROVAL ->
                        approveFrom(key, pre, staged)
                    WriteState.RELAYING, WriteState.LANDED -> {
                        identity.clearHandshake(id)
                        WriteResult.Done(id, staged.state)
                    }
                    WriteState.EXPIRED -> {
                        identity.clearHandshake(id)
                        WriteResult.Refused(
                            id,
                            listOf(UserError(ErrorCode.STAGED_WRITE_EXPIRED, "garbage-collected unlanded")),
                        )
                    }
                    WriteState.UNKNOWN -> unsupported(id, "staged-write state")
                }
            }
        }
    }

    /** From a staged write in hand: await the seal if needed, verify, approve. */
    private suspend fun approveFrom(key: ActorKey, pre: PreSignedProposal, staged: StagedWriteView): WriteResult {
        var current = staged
        var attempts = 0
        while (current.verifiedAct == null) {
            if (current.state == WriteState.UNKNOWN) return unsupported(current.id, "staged-write state")
            if (current.state == WriteState.EXPIRED) {
                identity.clearHandshake(current.id)
                return WriteResult.Refused(
                    current.id,
                    listOf(UserError(ErrorCode.STAGED_WRITE_EXPIRED, "garbage-collected unlanded")),
                )
            }
            if (attempts++ >= sealPollAttempts) return WriteResult.AwaitingSeal(current.id)
            delay(sealPollDelayMs)
            current = when (val read = writes.stagedWrite(current.id)) {
                is Outcome.Success -> read.value ?: return WriteResult.Failed(
                    current.id,
                    IllegalStateException("staged write vanished mid-seal"),
                )
                is Outcome.Refused -> return refused(current.id, read.errors)
                is Outcome.Failed -> return WriteResult.Failed(current.id, read.cause)
            }
        }
        val host = when (val read = writes.hostPublicKey()) {
            is Outcome.Success -> read.value
            is Outcome.Refused -> return refused(current.id, read.errors)
            is Outcome.Failed -> return WriteResult.Failed(current.id, read.cause)
        }
        val witnessSignature = try {
            approveStep(key, pre, checkNotNull(current.verifiedAct), host)
        } catch (e: HandshakeException) {
            // The device refuses to sign; the material is spent — the
            // unapproved staging garbage-collects server-side.
            identity.clearHandshake(current.id)
            return WriteResult.RejectedByDevice(current.id, e.message ?: "verification failed")
        } catch (e: WireException) {
            identity.clearHandshake(current.id)
            return WriteResult.RejectedByDevice(current.id, e.message ?: "malformed verified act")
        }
        return when (val approved = writes.approveAct(current.id, witnessSignature)) {
            is Outcome.Success -> {
                // The server holds the witness; the device's part is done.
                identity.clearHandshake(current.id)
                WriteResult.Done(current.id, approved.value.state)
            }
            is Outcome.Refused -> refused(current.id, approved.errors)
            is Outcome.Failed -> WriteResult.Failed(current.id, approved.cause)
        }
    }

    /** A refusal ends the handshake; spent material never resumes. */
    private suspend fun refused(id: String, errors: List<UserError>): WriteResult {
        identity.clearHandshake(id)
        return WriteResult.Refused(id, errors)
    }

    /**
     * A server value this app version does not know — refused WITHOUT
     * clearing the handshake material, so an updated build can resume.
     */
    private fun unsupported(id: String, what: String): WriteResult = WriteResult.Refused(
        id,
        listOf(UserError(ErrorCode.UNKNOWN, "$what this app version does not know — update the app")),
    )

    private fun preCommitmentSignature(pre: PreSignedProposal): String =
        java.util.Base64.getEncoder().encodeToString(com.cogra.crypto.encodePreCommitmentOf(pre))
}

// The session-authorized write orchestration: intent check → pre-sign →
// submit → (await seal) → verify → approve → observe (architecture.md "The
// write path"). A batch is checked against the gesture its user ordered
// before its first pre-signature (Intent.kt).
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
import kotlinx.coroutines.delay
import javax.inject.Inject

/** Where one write's handshake ended up after a signing pass. */
sealed interface WriteResult {
    val stagedWriteId: String

    /** Approved and relaying (or already landed) — the device's part is done. */
    data class Done(override val stagedWriteId: String, val state: WriteState) : WriteResult

    /** Sealing hadn't returned within the polling budget; `resume` continues it. */
    data class AwaitingSeal(override val stagedWriteId: String) : WriteResult

    /**
     * The API refused. Material is cleared only when every code is
     * terminal; a backoff/fault refusal keeps it and `resume` retries.
     */
    data class Refused(override val stagedWriteId: String, val errors: List<UserError>) : WriteResult

    /** The device refused to sign — the sealed act failed verification. */
    data class RejectedByDevice(override val stagedWriteId: String, val reason: String) : WriteResult

    /** Transport failed mid-handshake; material is kept and `resume` retries. */
    data class Failed(override val stagedWriteId: String, val cause: Exception) : WriteResult
}

/** Thrown when signing is requested with no actor key on the device. */
class NoActorKeyException : Exception("no actor key on this device")

/**
 * Refusal codes that end a handshake for good — the material is spent.
 * Anything else (RATE_LIMITED backoff, INTERNAL fault, UNAUTHENTICATED,
 * a code this build does not know) keeps the material for `resume`.
 */
internal val TERMINAL_REFUSALS = setOf(
    ErrorCode.SIGNATURE_INVALID,
    ErrorCode.STAGED_WRITE_EXPIRED,
    ErrorCode.NOT_FOUND,
    ErrorCode.BAD_INPUT,
    ErrorCode.FORBIDDEN,
    ErrorCode.WRITE_RULE_FAILED,
)

class WriteSigner @Inject constructor(
    private val writes: WriteRepository,
    private val identity: IdentityStore,
) {
    /** Seal-await polling budget: the stand-in seals synchronously, so a
     *  short bounded poll only covers the asynchronous contract. */
    internal val sealPollAttempts = 5
    internal val sealPollDelayMs = 1_000L

    /**
     * Runs the two-signature handshake for every prepared write. Each
     * write is its own priced act — one result per write (api-spec.md
     * "The write flow").
     *
     * THE BATCH IS CHECKED WHOLE BEFORE ANYTHING IS SIGNED. [expected] is
     * the gesture rebuilt from its form state (Intent.kt); one write that
     * disagrees refuses every write of the batch before the first
     * pre-signature — writes are independent priced acts, so a refusal
     * midway would leave half a gesture standing. There is no overload
     * without an expectation.
     */
    suspend fun sign(prepared: List<PreparedWriteView>, expected: Expectation): List<WriteResult> {
        // A family this build does not know is no verdict on the batch: the
        // whole of it waits for an updated build, as one write always has.
        if (prepared.any { it.family == Family.UNKNOWN }) {
            return prepared.map { write -> unsupported(write.id, "record family") }
        }
        val key = actorKey()
        val refusal = intentRefusal(key.address(), prepared.map { it.canonicalProposal }, expected)
        if (refusal != null) return prepared.map { write -> rejected(write.id, refusal) }
        return prepared.map { write -> signOne(key, write) }
    }

    /**
     * Signs the batch carried with this account's application, released
     * by the landing. It was prepared before the account landed, by
     * whichever device applied, and no form for it is held at the landing
     * — so it is signed on the transport checks alone, exactly as the
     * landing has always signed it.
     */
    suspend fun signCarriedAtLanding(batch: List<StagedWriteView>): List<WriteResult> =
        batch.map { staged -> signStaged(staged, TransportOnly) }

    /**
     * Signs one staged write served mid-handshake — the staged
     * Registration's path, which the backend stages at approval and the
     * device discovers on the status poll (auth.md "Approval and
     * landing"): same two signatures, same verification, through the
     * ordinary session-authorized legs. The write is checked against
     * [intent] first — the form's expectation, or the named
     * [RegistrationExemption].
     */
    suspend fun signStaged(staged: StagedWriteView, intent: Intent): WriteResult {
        if (staged.family == Family.UNKNOWN) return unsupported(staged.id, "record family")
        val key = actorKey()
        val refusal = intentRefusal(key.address(), listOf(staged.canonicalProposal), intent)
        if (refusal != null) return rejected(staged.id, refusal)
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
            WriteState.CARRIED, WriteState.UNKNOWN -> unsupported(staged.id, "staged-write state")
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

    /** The device refused the write: nothing of it is signed, and its material is spent. */
    private suspend fun rejected(id: String, reason: String): WriteResult {
        identity.clearHandshake(id)
        return WriteResult.RejectedByDevice(id, reason)
    }

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
            is Outcome.Refused -> refusedKeeping(id, read.errors)
            is Outcome.Success -> when (val staged = read.value) {
                // Gone entirely — collected long ago; nothing to continue.
                null -> {
                    identity.clearHandshake(id)
                    WriteResult.Refused(id, listOf(UserError(ErrorCode.NOT_FOUND, "staged write is gone")))
                }
                else -> if (staged.family == Family.UNKNOWN) {
                    unsupported(id, "record family")
                } else {
                    when (staged.state) {
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
                        WriteState.CARRIED, WriteState.UNKNOWN -> unsupported(id, "staged-write state")
                    }
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
                is Outcome.Refused -> return refusedKeeping(current.id, read.errors)
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

    /** A write-leg refusal: clears the material only when it is spent. */
    private suspend fun refused(id: String, errors: List<UserError>): WriteResult {
        if (errors.isNotEmpty() && errors.all { it.code in TERMINAL_REFUSALS }) {
            identity.clearHandshake(id)
        }
        return WriteResult.Refused(id, errors)
    }
}

/** A read-leg refusal: the handshake is intact server-side — keep the material. */
private fun refusedKeeping(id: String, errors: List<UserError>): WriteResult = WriteResult.Refused(id, errors)

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

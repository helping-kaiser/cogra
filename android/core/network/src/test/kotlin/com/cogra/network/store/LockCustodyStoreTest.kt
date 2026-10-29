// The device lock end to end on Android (sign-out-custody slice L2): the
// domain engine ([DeviceLock], [EndLocalSession]) over the REAL stores on a
// JVM Preferences DataStore with a fake cipher, against an in-memory server
// that plays issue / release / discard as `crates/api` does.
//
// The two ruled branches of seam 179 item 3 are pinned by name:
// - PR-61: `a_remote_end_without_a_held_lock_keeps_everything_and_never_destroys_it`
//   (the residual) and `a_forget_on_sign_in_is_not_ready_until_a_lock_is_held`;
// - PR-62: `a_dead_lock_completes_the_sign_in_deletes_the_ciphertext_and_reports_it_once`.

package com.cogra.network.store

import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.Preferences
import com.cogra.crypto.ActorKey
import com.cogra.crypto.Family
import com.cogra.crypto.NodeId
import com.cogra.crypto.Proposal
import com.cogra.crypto.StructuralBody
import com.cogra.domain.AuthTokens
import com.cogra.domain.compose.ComposeDraft
import com.cogra.domain.compose.DraftBodyKind
import com.cogra.domain.history.SeenWatermark
import com.cogra.domain.history.StoredSeenRecord
import com.cogra.domain.identity.DeviceLock
import com.cogra.domain.identity.EndLocalSession
import com.cogra.domain.identity.LocalSessionEnd
import com.cogra.domain.identity.SignInLeg
import com.cogra.domain.stance.KeptFamily
import com.cogra.domain.stance.StanceKind
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceTarget
import com.cogra.domain.testing.FakeDeviceLockRepository
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.time.Instant

private const val A = "11111111-1111-4111-8111-111111111111"
private const val B = "22222222-2222-4222-8222-222222222222"
private const val PASSWORD = "correct horse battery"

/** Invertible and visibly not a no-op, as `StoresTest`'s. */
private class MarkingCipher : StoreCipher {
    override fun seal(plaintext: ByteArray): ByteArray =
        byteArrayOf(0x5A) + plaintext.map { (it.toInt() xor 0x55).toByte() }.toByteArray()

    override fun open(sealed: ByteArray): ByteArray {
        check(sealed[0] == 0x5A.toByte()) { "not sealed by this cipher" }
        return sealed.drop(1).map { (it.toInt() xor 0x55).toByte() }.toByteArray()
    }
}

/** Counts the transactions a store commits — `edit` is `updateData`. */
private class EditCounter(private val inner: DataStore<Preferences>) : DataStore<Preferences> {
    var edits = 0

    override val data: Flow<Preferences> get() = inner.data

    override suspend fun updateData(transform: suspend (t: Preferences) -> Preferences): Preferences {
        edits++
        return inner.updateData(transform)
    }
}

class LockCustodyStoreTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    @After
    fun tearDown() {
        scope.cancel()
    }

    private inner class World {
        val counter = EditCounter(
            PreferenceDataStoreFactory.create(scope = scope) { File(tmp.newFolder(), "test.preferences_pb") },
        )
        val encrypted = EncryptedStore(counter, MarkingCipher())
        val tokens = TokenStoreImpl(encrypted)
        val identity = IdentityStoreImpl(encrypted, tokens)
        val custody = LockCustodyStoreImpl(encrypted)
        val drafts = ComposeDraftStoreImpl(encrypted, tokens)
        val seals = SealedDraftStoreImpl(encrypted, tokens)
        val server = FakeDeviceLockRepository().apply {
            passwords[A] = PASSWORD
            passwords[B] = PASSWORD
        }
        val engine = DeviceLock(custody, tokens, server)
        val endLocal = EndLocalSession(custody, tokens)

        suspend fun signIn(account: String) {
            tokens.save(AuthTokens("token-$account", "r-$account", account))
            server.sessionAccount = account
        }

        /** The sign-in's leg, then the pair stored when it is ready — LogIn's order. */
        suspend fun signInAgain(account: String, forget: Boolean, password: String = PASSWORD): SignInLeg {
            val leg = engine.signIn(account, password, "token-$account", forget)
            if (leg.ready) signIn(account)
            return leg
        }
    }

    private fun proposalOf(actor: ActorKey) = Proposal(
        body = StructuralBody(
            author = actor.address(),
            seq = 1u,
            family = Family.OPINION,
            middle = null,
            target = NodeId.parse("prof:bob"),
            pD = 0.5,
            pI = 0.1,
            settlementRef = null,
            license = null,
            assertedParents = emptyList(),
        ),
        payload = ByteArray(0),
        deps = emptyList(),
    )

    /**
     * A signed-in "don't remember" account with its whole custody set: a key
     * (backed or not), a pending blob, a handshake, a flag, a sealed copy and
     * a working draft — and, unless told otherwise, a held lock.
     */
    private suspend fun World.forgetAccount(
        account: String,
        backed: Boolean = false,
        holdLock: Boolean = true,
    ): ByteArray {
        signIn(account)
        val actor = ActorKey.generate()
        identity.saveActorSeed(actor.seed())
        identity.setKeyBacked(backed)
        identity.savePendingBackupBlob(byteArrayOf(9))
        identity.saveHandshake("w1", actor.preSign(proposalOf(actor)))
        identity.markStancePadTaught()
        identity.setForgetOnSignOut(true)
        seals.seal(ComposeDraft(bodyKind = DraftBodyKind.Words, body = "sealed post"), "node-1", listOf("write-1"))
        drafts.save(ComposeDraft(bodyKind = DraftBodyKind.Words, body = "half a thought"))
        if (holdLock) assertThat(engine.ensureHeld(account)).isTrue()
        return actor.seed()
    }

    /** Every plaintext name of the account's custody set, as the store holds them. */
    private suspend fun World.plaintextCustody(account: String): Set<String> =
        encrypted.names("acct:$account:") + encrypted.names("compose_draft:$account") +
            encrypted.names("compose_sealed:$account:")

    // ------------------------------------------------------- holding (§3.4)

    @Test
    fun `forget_on_sign_in_obtains_a_device_lock`() = runTest {
        val w = World()
        assertThat(w.signInAgain(A, forget = true)).isEqualTo(SignInLeg(ready = true, lockLost = false))
        val held = w.custody.heldLock(A)
        assertThat(held).isNotNull()
        assertThat(w.server.rows.getValue(held!!.id).first).isEqualTo(A)
    }

    @Test
    fun `forget_switch_on_obtains_a_lock_and_off_discards_it`() = runTest {
        val w = World()
        w.signIn(A)
        assertThat(w.engine.ensureHeld(A)).isTrue()
        val id = w.custody.lockId(A)!!
        assertThat(w.server.rows).containsKey(id)
        w.engine.discard(A)
        assertThat(w.custody.heldLock(A)).isNull()
        assertThat(w.custody.lockId(A)).isNull()
        assertThat(w.server.rows).doesNotContainKey(id)
    }

    @Test
    fun `a_missing_lock_is_retried_on_signed_in_start`() = runTest {
        val w = World()
        w.signIn(A)
        w.server.online = false
        assertThat(w.engine.ensureHeld(A)).isFalse()
        w.server.online = true
        assertThat(w.engine.ensureHeld(A)).isTrue()
        assertThat(w.server.issues).isEqualTo(2)
        // Held now: the next start asks for nothing.
        w.engine.ensureHeld(A)
        assertThat(w.server.issues).isEqualTo(2)
    }

    // ---------------------------------------------------------- LOCK (§3.5)

    @Test
    fun `keep_them_locked_seals_until_online_reauth`() = runTest {
        val w = World()
        val seed = w.forgetAccount(A)
        assertThat(w.engine.lock(A)).isTrue()
        assertThat(w.tokens.current()).isNull()
        assertThat(w.custody.isLocked(A)).isTrue()

        assertThat(w.signInAgain(A, forget = true)).isEqualTo(SignInLeg(ready = true, lockLost = false))
        assertThat(w.identity.actorSeed()).isEqualTo(seed)
        assertThat(w.identity.pendingBackupBlob()).isEqualTo(byteArrayOf(9))
        assertThat(w.identity.handshakeIds()).containsExactly("w1")
        assertThat(w.identity.stancePadTaught()).isTrue()
        assertThat(w.drafts.draft()?.body).isEqualTo("half a thought")
        assertThat(w.seals.sealed().map { it.draft.body }).containsExactly("sealed post")
        assertThat(w.custody.isLocked(A)).isFalse()
        // The released lock is held again — no new one was minted.
        assertThat(w.server.issues).isEqualTo(1)
        assertThat(w.custody.heldLock(A)).isNotNull()
    }

    @Test
    fun `keep_them_locked_leaves_no_usable_key_draft_or_pick`() = runTest {
        val w = World()
        val seed = w.forgetAccount(A)
        w.engine.lock(A)
        // What is left in plaintext is the lock's own bookkeeping, nothing else.
        assertThat(w.plaintextCustody(A))
            .containsExactly("acct:$A:forget_on_sign_out", "acct:$A:device_lock_id")
        // Even read as the account, nothing opens.
        w.signIn(A)
        assertThat(w.identity.actorSeed()).isNull()
        assertThat(w.identity.pendingBackupBlob()).isNull()
        assertThat(w.identity.handshakeIds()).isEmpty()
        assertThat(w.drafts.draft()).isNull()
        assertThat(w.seals.sealed()).isEmpty()
        assertThat(w.custody.heldLock(A)).isNull()
        // Each locked record is ciphertext: the seed's bytes appear in none.
        for (name in w.encrypted.names("locked:$A:")) {
            val record = w.encrypted.get(name)!!
            assertThat(record.toList().windowed(seed.size).none { it == seed.toList() }).isTrue()
        }
    }

    @Test
    fun `keep_them_locked_works_offline_when_a_lock_is_held`() = runTest {
        val w = World()
        w.forgetAccount(A)
        w.server.online = false
        val calls = Triple(w.server.issues, w.server.releases, w.server.discards)
        assertThat(w.engine.lock(A)).isTrue()
        assertThat(Triple(w.server.issues, w.server.releases, w.server.discards)).isEqualTo(calls)
        assertThat(w.custody.isLocked(A)).isTrue()
    }

    @Test
    fun `purge_and_lock_are_one_datastore_edit`() = runTest {
        val w = World()
        w.forgetAccount(A)
        w.counter.edits = 0
        assertThat(w.custody.lock(A)).isTrue()
        // Every name of the slot, the draft and the sealed copy, locked in one
        // transaction: a process death leaves the account before or after.
        assertThat(w.counter.edits).isEqualTo(1)
        // The unlock is one edit too.
        val secret = w.server.rows.getValue(w.custody.lockId(A)!!).second
        w.counter.edits = 0
        assertThat(w.custody.unlock(A, secret)).isTrue()
        assertThat(w.counter.edits).isEqualTo(1)
    }

    @Test
    fun `the_draft_is_in_the_custody_set`() = runTest {
        val w = World()
        w.forgetAccount(A)
        w.engine.lock(A)
        val locked = w.encrypted.names("locked:$A:")
        assertThat(locked).contains("locked:$A:compose_draft:$A")
        assertThat(locked).contains("locked:$A:compose_sealed:$A:write-1")
        assertThat(w.encrypted.get("compose_draft:$A")).isNull()
    }

    @Test
    fun `a second lock racing the first never overwrites the locked set`() = runTest {
        val w = World()
        w.forgetAccount(A)
        w.engine.lock(A)
        val first = w.encrypted.names("locked:$A:")
        assertThat(w.custody.lock(A)).isFalse()
        assertThat(w.encrypted.names("locked:$A:")).isEqualTo(first)
    }

    @Test
    fun `an_interrupted_lock_completes_on_next_start`() = runTest {
        val w = World()
        w.forgetAccount(A)
        // A process death right after step 2: pending marked, tokens gone.
        w.custody.setLockPending(A, true)
        w.tokens.clear()
        assertThat(w.custody.isLocked(A)).isFalse()
        w.engine.recover()
        assertThat(w.custody.isLocked(A)).isTrue()
        assertThat(w.custody.isLockPending(A)).isFalse()
        assertThat(w.signInAgain(A, forget = true).ready).isTrue()
        assertThat(w.drafts.draft()?.body).isEqualTo("half a thought")
    }

    @Test
    fun `a_locked_slot_with_a_leftover_plaintext_draft_deletes_it_on_start`() = runTest {
        val w = World()
        w.forgetAccount(A)
        w.engine.lock(A)
        // A draft write that landed after the lock (a save begun before it).
        w.encrypted.put("compose_draft:$A", "{\"bodyKind\":\"Words\",\"body\":\"late\"}".encodeToByteArray())
        w.engine.recover()
        assertThat(w.encrypted.get("compose_draft:$A")).isNull()
        // The locked set is untouched and unlocks to the draft it locked.
        assertThat(w.signInAgain(A, forget = true).ready).isTrue()
        assertThat(w.drafts.draft()?.body).isEqualTo("half a thought")
    }

    @Test
    fun `a locked record never opens in another account's slot`() = runTest {
        val w = World()
        w.forgetAccount(A)
        val secret = w.server.rows.getValue(w.custody.lockId(A)!!).second
        w.engine.lock(A)
        // Move A's locked records under B's prefix, as an attacker with the
        // app's storage could: the binding names A, so B's unlock refuses.
        w.encrypted.edit {
            for (name in names("locked:$A:")) {
                put(name.replace("locked:$A:", "locked:$B:"), get(name)!!)
            }
        }
        assertThat(w.custody.unlock(B, secret)).isFalse()
        assertThat(w.encrypted.names("locked:$B:")).isNotEmpty()
    }

    // ---------------------------------------------------- remote path (§3.6)

    @Test
    fun `remote_session_end_never_purges_and_never_asks`() = runTest {
        val w = World()
        val seed = w.forgetAccount(A)
        assertThat(w.endLocal.end()).isEqualTo(LocalSessionEnd.LOCKED)
        assertThat(w.tokens.current()).isNull()
        assertThat(w.signInAgain(A, forget = true).ready).isTrue()
        assertThat(w.identity.actorSeed()).isEqualTo(seed)
    }

    @Test
    fun `remote_end_locks_an_unbacked_key_draft_and_kept_picks`() = runTest {
        val w = World()
        w.forgetAccount(A)
        w.endLocal.end()
        val locked = w.encrypted.names("locked:$A:")
        assertThat(locked).contains("locked:$A:acct:$A:actor_seed")
        assertThat(locked).contains("locked:$A:compose_draft:$A")
        assertThat(locked).contains("locked:$A:compose_sealed:$A:write-1")
    }

    @Test
    fun `remote_end_purges_a_backed_key_but_locks_draft_and_kept_picks`() = runTest {
        val w = World()
        w.forgetAccount(A, backed = true)
        assertThat(w.endLocal.end()).isEqualTo(LocalSessionEnd.LOCKED)
        val locked = w.encrypted.names("locked:$A:")
        assertThat(locked).doesNotContain("locked:$A:acct:$A:actor_seed")
        assertThat(locked).doesNotContain("locked:$A:acct:$A:pending_backup_blob")
        assertThat(locked.none { it.contains(":handshake:") }).isTrue()
        assertThat(locked).contains("locked:$A:compose_draft:$A")
        assertThat(w.signInAgain(A, forget = true).ready).isTrue()
        assertThat(w.identity.actorSeed()).isNull()
        assertThat(w.drafts.draft()?.body).isEqualTo("half a thought")
    }

    @Test
    fun `remote_end_with_unknown_backup_state_locks`() = runTest {
        // Android kept no local backup bit before this lane: a slot without
        // the `backed` flag is unknown, and unknown locks rather than purges.
        val w = World()
        w.forgetAccount(A)
        w.encrypted.remove("acct:$A:key_backed")
        w.endLocal.end()
        assertThat(w.encrypted.names("locked:$A:")).contains("locked:$A:acct:$A:actor_seed")
    }

    @Test
    fun `remote_end_of_a_remembered_account_changes_nothing`() = runTest {
        val w = World()
        w.signIn(A)
        val seed = ActorKey.generate().seed()
        w.identity.saveActorSeed(seed)
        w.drafts.save(ComposeDraft(bodyKind = DraftBodyKind.Words, body = "kept"))
        assertThat(w.endLocal.end()).isEqualTo(LocalSessionEnd.KEPT)
        assertThat(w.tokens.current()).isNull()
        assertThat(w.encrypted.names("locked:")).isEmpty()
        w.signIn(A)
        assertThat(w.identity.actorSeed()).isEqualTo(seed)
        assertThat(w.drafts.draft()?.body).isEqualTo("kept")
    }

    @Test
    fun `a_remote_end_without_a_held_lock_keeps_everything_and_never_destroys_it`() = runTest {
        // PR-61's residual: the issue never landed and the session died first.
        val w = World()
        val seed = w.forgetAccount(A, holdLock = false)
        assertThat(w.endLocal.end()).isEqualTo(LocalSessionEnd.REFUSED)
        // Refused: signed out, no custody read resolves to the account…
        assertThat(w.identity.actorSeed()).isNull()
        assertThat(w.drafts.draft()).isNull()
        // …and nothing destroyed: it waits for this account's next sign-in.
        assertThat(w.encrypted.names("locked:")).isEmpty()
        assertThat(w.encrypted.get("acct:$A:actor_seed")).isEqualTo(seed)
        assertThat(w.signInAgain(A, forget = true).ready).isTrue()
        assertThat(w.drafts.draft()?.body).isEqualTo("half a thought")
    }

    @Test
    fun `a remote end without a lock still purges a backed key and keeps the draft`() = runTest {
        val w = World()
        w.forgetAccount(A, backed = true, holdLock = false)
        assertThat(w.endLocal.end()).isEqualTo(LocalSessionEnd.REFUSED)
        assertThat(w.encrypted.get("acct:$A:actor_seed")).isNull()
        assertThat(w.encrypted.get("compose_draft:$A")).isNotNull()
    }

    @Test
    fun `a_forget_on_remote_end_clears_that_accounts_seen_record_and_never_locks_it`() = runTest {
        // PR-69 beside the lock: the seen record is a cache of the server's
        // view log, so a forget-on end drops it — this account's alone — and
        // the lock set never carries it.
        val w = World()
        val seen = SeenRecordStoreImpl(w.encrypted)
        val record = StoredSeenRecord(setOf("n1"), SeenWatermark("w1", Instant.parse("2026-10-13T08:00:00Z")))
        seen.save(B, record)
        w.forgetAccount(A)
        seen.save(A, record)
        assertThat(w.endLocal.end()).isEqualTo(LocalSessionEnd.LOCKED)
        assertThat(seen.load(A)).isNull()
        assertThat(w.encrypted.names("locked:$A:").none { it.contains("seen_record") }).isTrue()
        assertThat(seen.load(B)).isEqualTo(record)
    }

    @Test
    fun `the residual remote end clears the seen record too, and a remembered end keeps it`() = runTest {
        val w = World()
        val seen = SeenRecordStoreImpl(w.encrypted)
        val record = StoredSeenRecord(setOf("n1"), null)
        w.forgetAccount(A, holdLock = false)
        seen.save(A, record)
        assertThat(w.endLocal.end()).isEqualTo(LocalSessionEnd.REFUSED)
        assertThat(seen.load(A)).isNull()

        w.signIn(B)
        seen.save(B, record)
        assertThat(w.endLocal.end()).isEqualTo(LocalSessionEnd.KEPT)
        assertThat(seen.load(B)).isEqualTo(record)
    }

    @Test
    fun `the backed-key purge never removes an unbacked key`() = runTest {
        val w = World()
        val seed = w.forgetAccount(A, holdLock = false)
        w.custody.purgeBackedKeyMaterial(A)
        assertThat(w.encrypted.get("acct:$A:actor_seed")).isEqualTo(seed)
    }

    // -------------------------------------------------------- UNLOCK (§3.5)

    @Test
    fun `sign_in_with_current_credentials_unlocks_before_the_shell_renders`() = runTest {
        val w = World()
        w.forgetAccount(A)
        w.engine.lock(A)
        // The leg runs with no stored session — the pair is not stored yet.
        val leg = w.engine.signIn(A, PASSWORD, "token-$A", true)
        assertThat(w.tokens.current()).isNull()
        assertThat(leg.ready).isTrue()
        assertThat(w.custody.isLocked(A)).isFalse()
        assertThat(w.encrypted.get("acct:$A:actor_seed")).isNotNull()
    }

    @Test
    fun `an old password never unlocks after a reset`() = runTest {
        val w = World()
        w.forgetAccount(A)
        w.engine.lock(A)
        w.server.passwords[A] = "the new one"
        assertThat(w.signInAgain(A, forget = true).ready).isFalse()
        assertThat(w.custody.isLocked(A)).isTrue()
        assertThat(w.signInAgain(A, forget = true, password = "the new one").ready).isTrue()
    }

    @Test
    fun `sign_in_unlock_without_an_answer_reads_didnt_send_and_retries_without_a_second_login`() = runTest {
        // The engine half: no answer keeps everything locked, and the leg
        // runs again on the same session (the form's half is LogInTest's).
        val w = World()
        w.forgetAccount(A)
        w.engine.lock(A)
        w.server.online = false
        assertThat(w.engine.signIn(A, PASSWORD, "token-$A", true)).isEqualTo(SignInLeg(ready = false, lockLost = false))
        assertThat(w.custody.isLocked(A)).isTrue()
        w.server.online = true
        assertThat(w.engine.signIn(A, PASSWORD, "token-$A", true).ready).isTrue()
    }

    @Test
    fun `sign_in_with_the_box_unchecked_unlocks_and_discards_the_lock`() = runTest {
        val w = World()
        w.forgetAccount(A)
        val id = w.custody.lockId(A)!!
        w.engine.lock(A)
        assertThat(w.signInAgain(A, forget = false).ready).isTrue()
        assertThat(w.custody.isLocked(A)).isFalse()
        assertThat(w.custody.heldLock(A)).isNull()
        assertThat(w.custody.lockId(A)).isNull()
        assertThat(w.server.rows).doesNotContainKey(id)
        assertThat(w.drafts.draft()?.body).isEqualTo("half a thought")
    }

    @Test
    fun `another_accounts_sign_in_never_touches_a_locked_slot`() = runTest {
        val w = World()
        w.forgetAccount(A)
        w.engine.lock(A)
        val lockedA = w.encrypted.names("locked:$A:")
        assertThat(w.signInAgain(B, forget = true).ready).isTrue()
        w.drafts.save(ComposeDraft(bodyKind = DraftBodyKind.Words, body = "B's draft"))
        w.engine.recover()
        assertThat(w.encrypted.names("locked:$A:")).isEqualTo(lockedA)
        assertThat(w.drafts.draft()?.body).isEqualTo("B's draft")
        assertThat(w.signInAgain(A, forget = true).ready).isTrue()
        assertThat(w.drafts.draft()?.body).isEqualTo("half a thought")
    }

    @Test
    fun `a_forget_on_sign_in_is_not_ready_until_a_lock_is_held`() = runTest {
        // PR-61: the issue gets no answer, so the sign-in does not complete.
        val w = World()
        w.server.online = false
        assertThat(w.engine.signIn(A, PASSWORD, "token-$A", true)).isEqualTo(SignInLeg(ready = false, lockLost = false))
        assertThat(w.custody.heldLock(A)).isNull()
        w.server.online = true
        assertThat(w.engine.signIn(A, PASSWORD, "token-$A", true).ready).isTrue()
        assertThat(w.custody.heldLock(A)).isNotNull()
    }

    @Test
    fun `a_dead_lock_completes_the_sign_in_deletes_the_ciphertext_and_reports_it_once`() = runTest {
        // PR-62: the server can no longer open the lock (its row is gone).
        val w = World()
        w.forgetAccount(A)
        val id = w.custody.lockId(A)!!
        w.engine.lock(A)
        w.server.rows.remove(id)
        assertThat(w.engine.signIn(A, PASSWORD, "token-$A", true)).isEqualTo(SignInLeg(ready = true, lockLost = true))
        assertThat(w.encrypted.names("locked:$A:")).isEmpty()
        // A fresh lock is held for the forget-on account going forward.
        assertThat(w.custody.heldLock(A)?.id).isNotEqualTo(id)
        // Once: the set is gone, so a later sign-in has nothing to report.
        assertThat(w.engine.signIn(A, PASSWORD, "token-$A", true)).isEqualTo(SignInLeg(ready = true, lockLost = false))
    }

    @Test
    fun `a locked slot's lock is never discarded`() = runTest {
        val w = World()
        w.forgetAccount(A)
        val id = w.custody.lockId(A)!!
        w.engine.lock(A)
        w.engine.discard(A)
        assertThat(w.server.rows).containsKey(id)
        assertThat(w.custody.lockId(A)).isEqualTo(id)
        assertThat(w.engine.ensureHeld(A)).isFalse()
    }

    // ------------------------------------------- the kept picks (PadKeyAbsent.md:41)

    @Test
    fun `the_kept_picks_are_locked_with_the_draft_and_put_back_by_the_unlock`() = runTest {
        val w = World()
        w.forgetAccount(A, backed = true)
        val kept = KeptPickStoreImpl(w.encrypted, w.tokens)
        kept.keep(StanceTarget.Node("post-1"), StancePair(0.3, 0.2), KeptFamily.OPINION, StanceKind.POST)
        assertThat(w.endLocal.end()).isEqualTo(LocalSessionEnd.LOCKED)
        // Sealed and unusable until the account signs in again, never destroyed.
        assertThat(w.encrypted.names("kept_picks:$A")).isEmpty()
        assertThat(w.encrypted.names("locked:$A:")).contains("locked:$A:kept_picks:$A")
        assertThat(w.signInAgain(A, forget = true).ready).isTrue()
        assertThat(kept.list().single().pick).isEqualTo(StancePair(0.3, 0.2))
    }

    // ------------------------------------- the carried expectation (PR-88)

    @Test
    fun `a_carried_expectation_is_locked_with_the_draft_and_put_back_by_the_unlock`() = runTest {
        val w = World()
        w.forgetAccount(A)
        w.identity.saveCarriedExpectation("c1", byteArrayOf(7, 7, 7))
        assertThat(w.engine.lock(A)).isTrue()
        assertThat(w.encrypted.names("acct:$A:carried:")).isEmpty()
        assertThat(w.encrypted.names("locked:$A:")).contains("locked:$A:acct:$A:carried:c1")
        assertThat(w.signInAgain(A, forget = true).ready).isTrue()
        assertThat(w.identity.carriedExpectation("c1")).isEqualTo(byteArrayOf(7, 7, 7))
    }

    @Test
    fun `a_backed_remote_end_purges_the_key_but_locks_the_carried_expectation_with_the_draft`() = runTest {
        val w = World()
        w.forgetAccount(A, backed = true)
        w.identity.saveCarriedExpectation("c1", byteArrayOf(7, 7, 7))
        assertThat(w.endLocal.end()).isEqualTo(LocalSessionEnd.LOCKED)
        assertThat(w.encrypted.names("locked:$A:")).contains("locked:$A:acct:$A:carried:c1")
        assertThat(w.signInAgain(A, forget = true).ready).isTrue()
        assertThat(w.identity.actorSeed()).isNull()
        assertThat(w.identity.carriedExpectation("c1")).isEqualTo(byteArrayOf(7, 7, 7))
    }
}

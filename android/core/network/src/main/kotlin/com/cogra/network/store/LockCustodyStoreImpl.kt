// The device lock's custody (sign-out-custody slice L2) over the encrypted
// store: every change is ONE `DataStore.edit`, so a process death leaves an
// account's slot before or after it, never between (custody packet F3, and
// §3.5 LOCK step 4: "ONE DataStore.edit {} over every name in the slot plus
// compose_draft:<id>").
//
// THE CUSTODY SET of an account is its whole identity slot (`acct:<id>:`),
// its draft (`compose_draft:<id>`) and the draft's sealed copies — the set
// the explicit sign-out's purge removes (`purgeCustodySet`). A lock writes
// each of them as a device-lock record under `locked:<id>:<name>`, bound to
// the account and the name, and removes the plaintext in the same edit. A
// handful of the slot's own names stay plaintext through a lock, because the
// lock itself needs them: the opt-in flag, the lock's id, the pending mark,
// and the `backed` flag. The secret goes in the lock's edit.
//
// The values here are still sealed by the store's own Tink AEAD under the
// Keystore master key; the device lock is the second layer that the app
// itself cannot open while the secret is with the server.

package com.cogra.network.store

import com.cogra.crypto.DeviceLockBinding
import com.cogra.crypto.DeviceLockException
import com.cogra.crypto.openDeviceLockRecord
import com.cogra.crypto.sealDeviceLockRecord
import com.cogra.domain.store.HeldLock
import com.cogra.domain.store.LockCustodyStore
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

// One method per atomic custody edit the interface names, plus the name
// helpers they share: splitting the class would split the one namespace every
// edit must agree on.
@Suppress("TooManyFunctions")
@Singleton
class LockCustodyStoreImpl @Inject constructor(private val store: EncryptedStore) : LockCustodyStore {

    private fun slot(account: String) = "$ACCT_PREFIX$account:"

    private fun scoped(account: String, name: String) = slot(account) + name

    private fun lockedPrefix(account: String) = "$LOCKED_PREFIX$account:"

    private fun isControl(account: String, name: String) =
        name.removePrefix(slot(account)) in CONTROL_NAMES

    private fun isKeyMaterial(account: String, name: String): Boolean {
        val local = name.removePrefix(slot(account))
        return local == SEED || local == PENDING_BLOB || local.startsWith(HANDSHAKE_PREFIX)
    }

    /** The account's custody names as one transaction sees them — never the lock's own. */
    private fun EncryptedStore.Editor.custodyNames(account: String): List<String> =
        names(slot(account)).filterNot { isControl(account, it) } +
            listOfNotNull(composeDraftKey(account).takeIf { it in this }) +
            names(composeSealedPrefix(account))

    /** Draft rows lock as `draft`; everything in the identity slot as `identity`. */
    private fun bindingOf(account: String, name: String) = DeviceLockBinding(
        account = UUID.fromString(account),
        kind = if (name.startsWith(slot(account))) KIND_IDENTITY else KIND_DRAFT,
        key = name,
    )

    override suspend fun forgetOnSignOut(account: String): Boolean = store.get(scoped(account, FORGET)) != null

    override suspend fun heldLock(account: String): HeldLock? {
        val id = store.get(scoped(account, LOCK_ID))?.decodeToString() ?: return null
        val secret = store.get(scoped(account, LOCK_SECRET)) ?: return null
        return HeldLock(id, secret)
    }

    override suspend fun holdLock(account: String, lock: HeldLock): String? {
        var replaced: String? = null
        store.edit {
            replaced = get(scoped(account, LOCK_ID))?.decodeToString()?.takeIf { it != lock.id }
            put(scoped(account, LOCK_ID), lock.id.encodeToByteArray())
            put(scoped(account, LOCK_SECRET), lock.secret)
        }
        return replaced
    }

    override suspend fun lockId(account: String): String? = store.get(scoped(account, LOCK_ID))?.decodeToString()

    override suspend fun dropLock(account: String) {
        store.edit {
            remove(scoped(account, LOCK_ID))
            remove(scoped(account, LOCK_SECRET))
        }
    }

    override suspend fun setLockPending(account: String, pending: Boolean) {
        val name = scoped(account, LOCK_PENDING)
        if (pending) store.put(name, byteArrayOf(1)) else store.remove(name)
    }

    override suspend fun isLockPending(account: String): Boolean = store.get(scoped(account, LOCK_PENDING)) != null

    override suspend fun lock(account: String): Boolean {
        var locked = false
        store.edit {
            val secret = get(scoped(account, LOCK_SECRET)) ?: return@edit
            // Never over an existing locked set: a second lock racing the
            // first would otherwise replace it with what an emptied slot reads.
            if (names(lockedPrefix(account)).isNotEmpty()) return@edit
            val backed = scoped(account, BACKED) in this
            for (name in custodyNames(account)) {
                if (backed && isKeyMaterial(account, name)) {
                    // A backed key survives in its backup: purged, not locked.
                    remove(name)
                } else {
                    // A value this transaction cannot open stays where it
                    // is — locked or not, it is never what a lock destroys.
                    get(name)?.let { plain ->
                        val record = sealDeviceLockRecord(secret, bindingOf(account, name), plain)
                        put(lockedPrefix(account) + name, record)
                        remove(name)
                    }
                }
            }
            remove(scoped(account, LOCK_SECRET))
            locked = true
        }
        return locked
    }

    override suspend fun isLocked(account: String): Boolean = store.names(lockedPrefix(account)).isNotEmpty()

    override suspend fun unlock(account: String, secret: ByteArray): Boolean {
        var unlocked = false
        store.edit {
            val lockedNames = names(lockedPrefix(account))
            if (lockedNames.isEmpty()) return@edit
            val opened = try {
                lockedNames.map { lockedName ->
                    val name = lockedName.removePrefix(lockedPrefix(account))
                    val record = get(lockedName) ?: throw DeviceLockException("unreadable locked record")
                    Triple(lockedName, name, openDeviceLockRecord(secret, record, bindingOf(account, name)))
                }
            } catch (_: DeviceLockException) {
                // All or nothing: a set that does not open whole is left whole.
                return@edit
            }
            for ((lockedName, name, plain) in opened) {
                put(name, plain)
                remove(lockedName)
            }
            unlocked = true
        }
        return unlocked
    }

    override suspend fun deleteDeadLockedSet(account: String) {
        store.edit {
            names(lockedPrefix(account)).forEach(::remove)
            remove(scoped(account, LOCK_ID))
            remove(scoped(account, LOCK_PENDING))
        }
    }

    override suspend fun purgeBackedKeyMaterial(account: String) {
        store.edit {
            // Decided inside the edit, by the one fact that proves a backup:
            // an unbacked key is the only copy and is never removed here.
            if (scoped(account, BACKED) !in this) return@edit
            names(slot(account)).filter { isKeyMaterial(account, it) }.forEach(::remove)
        }
    }

    override suspend fun removeLeftoverDraft(account: String) {
        store.edit {
            if (names(lockedPrefix(account)).isEmpty()) return@edit
            remove(composeDraftKey(account))
            names(composeSealedPrefix(account)).forEach(::remove)
        }
    }

    override suspend fun forgetSeenRecord(account: String) {
        store.remove(seenRecordKey(account))
    }

    override suspend fun lockSlots(): Set<String> {
        val locked = store.names(LOCKED_PREFIX).map { it.removePrefix(LOCKED_PREFIX).substringBefore(':') }
        val pending = store.names(ACCT_PREFIX)
            .filter { it.endsWith(":$LOCK_PENDING") }
            .map { it.removePrefix(ACCT_PREFIX).substringBefore(':') }
        return (locked + pending).toSet()
    }

    internal companion object {
        const val ACCT_PREFIX = "acct:"
        const val LOCKED_PREFIX = "locked:"
        const val KIND_IDENTITY = "identity"
        const val KIND_DRAFT = "draft"
        const val SEED = "actor_seed"
        const val PENDING_BLOB = "pending_backup_blob"
        const val HANDSHAKE_PREFIX = "handshake:"
        const val FORGET = "forget_on_sign_out"
        const val LOCK_ID = "device_lock_id"
        const val LOCK_SECRET = "device_lock_secret"
        const val LOCK_PENDING = "device_lock_pending"
        const val BACKED = "key_backed"

        /** The slot's names a lock leaves in plaintext: the lock itself needs them. */
        val CONTROL_NAMES = setOf(FORGET, LOCK_ID, LOCK_SECRET, LOCK_PENDING, BACKED)
    }
}

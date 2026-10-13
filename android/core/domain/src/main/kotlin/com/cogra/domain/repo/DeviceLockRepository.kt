package com.cogra.domain.repo

import com.cogra.domain.Outcome

/** The server half of a device lock, as the device receives it (auth.md "Device lock"). */
class IssuedLock(val id: String, val secret: ByteArray)

/**
 * The device lock's three verbs. Each takes an access token the call carries
 * INSTEAD of the stored session's: the sign-in's leg runs before its fresh
 * pair is stored. A null token rides the stored session, refreshed and
 * replayed like any other guarded call.
 */
interface DeviceLockRepository {
    /** Mints a lock for the signed-in account; RATE_LIMITED past the account's budget or cap. */
    suspend fun issue(accessToken: String? = null): Outcome<IssuedLock>

    /**
     * The lock's secret behind the account's CURRENT password. Idempotent —
     * a release never spends the lock. NOT_FOUND for an unknown lock or
     * another account's.
     */
    suspend fun release(lock: String, password: String, accessToken: String? = null): Outcome<ByteArray>

    /** Deletes one of the viewer's locks; idempotent and silent for an unknown id. */
    suspend fun discard(lock: String, accessToken: String? = null): Outcome<Unit>
}

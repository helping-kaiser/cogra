// The last release this device announced (FeedNewerVersion.md:3), over the
// same DataStore-backed store the device's preferences ride
// (`DevicePreferencesImpl`). Nothing here is a secret; the name sits outside
// every `acct:` slot, so it belongs to the device whoever is signed in. An
// unreadable value reads as never announced: at worst one release is said
// twice, which costs a reader nothing.

package com.cogra.network.store

import com.cogra.domain.release.AnnouncedReleaseStore
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AnnouncedReleaseStoreImpl @Inject constructor(
    private val store: EncryptedStore,
) : AnnouncedReleaseStore {

    override suspend fun lastAnnounced(): String? = store.get(ANNOUNCED)?.decodeToString()

    override suspend fun markAnnounced(version: String) {
        store.put(ANNOUNCED, version.encodeToByteArray())
    }

    private companion object {
        const val ANNOUNCED = "device:announced_release"
    }
}

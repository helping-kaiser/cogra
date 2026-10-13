// Everything CoGra keeps on this device, erased (EraseConfirm.md:21).
//
// Every value the app keeps lives in the one Tink-sealed store: the tokens,
// every account's identity slot and custody material, the drafts and their
// sealed copies, the device's own choices, and the seen list's copy — the
// ids and the sync watermark as ONE value under `seen_record:<account>`
// (PR-52), so the wipe resets the watermark with the cache and the next
// sign-in re-seeds the record from the server's view log. One
// `DataStore.edit` takes all of it, so nothing is ever left half-erased.
//
// The Tink keyset (its own shared preferences) stays: it holds nothing of
// the reader's, and the next values written are sealed under it again.

package com.cogra.network.store

import com.cogra.domain.store.DeviceData
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DeviceDataImpl @Inject constructor(private val store: EncryptedStore) : DeviceData {
    override suspend fun eraseEverything() {
        store.removeAll { true }
    }
}

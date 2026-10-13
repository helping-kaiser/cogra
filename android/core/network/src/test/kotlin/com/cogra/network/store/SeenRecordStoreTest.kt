// The seen record at rest, over a real (JVM) Preferences DataStore with a
// fake cipher (android/CLAUDE.md "Tests ship with the code"): sealed, per
// account, ids and watermark together, and a record that will not decode
// reads as none — the next sync re-seeds it.

package com.cogra.network.store

import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import com.cogra.domain.history.SeenWatermark
import com.cogra.domain.history.StoredSeenRecord
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.time.Instant

/** Invertible and visibly not a no-op, as StoresTest's. */
private class FlipCipher : StoreCipher {
    override fun seal(plaintext: ByteArray): ByteArray =
        byteArrayOf(0x5A) + plaintext.map { (it.toInt() xor 0x55).toByte() }.toByteArray()

    override fun open(sealed: ByteArray): ByteArray {
        check(sealed[0] == 0x5A.toByte()) { "not sealed by this cipher" }
        return sealed.drop(1).map { (it.toInt() xor 0x55).toByte() }.toByteArray()
    }
}

class SeenRecordStoreTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private lateinit var file: File

    /** A store over the same file each call — a new one is a restart. */
    private fun encrypted(): EncryptedStore {
        if (!::file.isInitialized) file = File(tmp.newFolder(), "test.preferences_pb")
        return EncryptedStore(PreferenceDataStoreFactory.create(scope = scope) { file }, FlipCipher())
    }

    @After
    fun tearDown() {
        scope.cancel()
    }

    private val mark = SeenWatermark("p9", Instant.parse("2026-10-13T08:00:00Z"))

    @Test
    fun aRecordRoundTripsWithItsWatermarkAndIsSealedAtRest() = runTest {
        val encrypted = encrypted()
        val store = SeenRecordStoreImpl(encrypted)
        store.save("u1", StoredSeenRecord(setOf("p1", "seen-thing-alpha"), mark))

        assertThat(store.load("u1")).isEqualTo(StoredSeenRecord(setOf("p1", "seen-thing-alpha"), mark))
        // At rest the ids are ciphertext, never a readable list.
        assertThat(file.readBytes().decodeToString()).doesNotContain("seen-thing-alpha")
    }

    @Test
    fun eachAccountsRecordIsItsOwn() = runTest {
        val store = SeenRecordStoreImpl(encrypted())
        store.save("u1", StoredSeenRecord(setOf("p1"), null))
        store.save("u2", StoredSeenRecord(setOf("q1"), mark))

        assertThat(store.load("u1")).isEqualTo(StoredSeenRecord(setOf("p1"), null))
        assertThat(store.load("u2")).isEqualTo(StoredSeenRecord(setOf("q1"), mark))
        assertThat(store.load("u3")).isNull()
    }

    @Test
    fun aRecordThatWillNotDecodeReadsAsNone() = runTest {
        val encrypted = encrypted()
        encrypted.put(seenRecordKey("u1"), "not json".encodeToByteArray())

        assertThat(SeenRecordStoreImpl(encrypted).load("u1")).isNull()
    }
}

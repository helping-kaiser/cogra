package com.cogra.domain.identity

import com.cogra.crypto.ActorKey
import com.cogra.crypto.toHex
import com.cogra.domain.testing.FakeIdentityStore
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.junit.Test

class KeyExportTest {

    private val identity = FakeIdentityStore()
    private val export = ExportActorKey(identity)

    @Test
    fun withoutAKeyThereIsNothingToExport() = runTest {
        assertThat(export()).isEmpty()
    }

    @Test
    fun theActorKeyLeavesInBothPortableForms() = runTest {
        val seed = ActorKey.generate().seed()
        identity.seed = seed

        val secrets = export()

        assertThat(secrets).hasSize(1)
        val actor = secrets.single()
        assertThat(actor.kind).isEqualTo(SecretKind.ACTOR_KEY)
        assertThat(actor.pem).startsWith("-----BEGIN PRIVATE KEY-----")
        assertThat(actor.pem).endsWith("-----END PRIVATE KEY-----")
        assertThat(actor.hex).isEqualTo(seed.toHex())
    }

    /** Export reads; it must not disturb what the device holds. */
    @Test
    fun exportingLeavesTheStoredKeyInPlace() = runTest {
        val seed = ActorKey.generate().seed()
        identity.seed = seed

        export()

        assertThat(identity.seed).isEqualTo(seed)
    }
}

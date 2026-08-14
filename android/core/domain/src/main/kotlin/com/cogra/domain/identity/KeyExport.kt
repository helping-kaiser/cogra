// Key export (auth.md "Key export"): the device reveals the secrets it
// holds, each in a portable encoding, so the holder can act as their L0
// address on L1 without CoGra. Purely local — nothing here talks to the
// server, and the seed never crosses the wire.

package com.cogra.domain.identity

import com.cogra.crypto.exportActorSeed
import com.cogra.domain.store.IdentityStore
import javax.inject.Inject

/** Which client-held secret a block carries. */
enum class SecretKind {
    ACTOR_KEY,
}

/** One secret, in the portable forms the export surface shows. */
data class ExportedSecret(val kind: SecretKind, val pem: String, val hex: String)

/**
 * Every secret in the backup container, each in its own portable form —
 * today the actor key alone (auth.md "the blob is a container"; the
 * Collective splits extend the list). Empty when this device holds no
 * actor key.
 */
class ExportActorKey @Inject constructor(
    private val identity: IdentityStore,
) {
    suspend operator fun invoke(): List<ExportedSecret> {
        val seed = identity.actorSeed() ?: return emptyList()
        val exported = exportActorSeed(seed)
        return listOf(ExportedSecret(SecretKind.ACTOR_KEY, exported.pem, exported.hex))
    }
}

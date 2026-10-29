// The kept picks at rest (PadKeyAbsent.md:33-:43): one sealed value per
// account, `kept_picks:<account>`, over the store every device value rides.
//
// THE DRAFT'S CUSTODY TIER. The name joins the account's custody set beside the
// compose draft and its sealed copies, so a device lock seals the picks with
// the draft and an unlock puts them back (`LockCustodyStoreImpl`), the explicit
// sign-out's purge clears them with the draft (`IdentityStoreImpl.
// purgeCustodySet`), a remembered sign-out never touches them, and Settings'
// erase takes them with everything else.
//
// EVERY CHANGE IS ONE `DataStore.edit`: the list is read and written in the
// same transaction, so two keeps never take the same place and a process death
// leaves the list before or after a change, never between. A value this build
// cannot read back is no kept pick at all, never a fault — the same rule the
// draft follows.

package com.cogra.network.store

import com.cogra.domain.stance.KeptFamily
import com.cogra.domain.stance.KeptPick
import com.cogra.domain.stance.KeptPickStore
import com.cogra.domain.stance.StanceKind
import com.cogra.domain.stance.StancePair
import com.cogra.domain.stance.StanceTarget
import com.cogra.domain.store.TokenStore
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class KeptPickStoreImpl @Inject constructor(
    private val store: EncryptedStore,
    private val tokens: TokenStore,
) : KeptPickStore {

    /** The moment a pick is kept; a test pins it. */
    internal var now: () -> Long = System::currentTimeMillis

    @OptIn(ExperimentalCoroutinesApi::class)
    override fun watch(): Flow<List<KeptPick>> = tokens.tokens
        .map { it?.accountId }
        .distinctUntilChanged()
        .flatMapLatest { account ->
            if (account == null) flowOf(emptyList()) else store.watch(keptPicksKey(account)).map(::decode)
        }
        .distinctUntilChanged()

    override suspend fun list(): List<KeptPick> {
        val account = tokens.current()?.accountId ?: return emptyList()
        return decode(store.get(keptPicksKey(account)))
    }

    override suspend fun keep(target: StanceTarget, pick: StancePair, family: KeptFamily, kind: StanceKind?) {
        val account = tokens.current()?.accountId ?: return
        val name = keptPicksKey(account)
        store.edit {
            val others = decode(get(name)).filterNot { it.target == target && it.family == family }
            // THE ORDER THEY WERE KEPT IN, strictly: a pick kept in the same
            // millisecond as the last still comes after it.
            val at = maxOf(now(), (others.maxOfOrNull { it.keptAt } ?: 0L) + 1)
            put(name, encode(others + KeptPick(target, pick, family, kind, at)))
        }
    }

    override suspend fun drop(targets: List<StanceTarget>, family: KeptFamily) {
        val account = tokens.current()?.accountId ?: return
        val name = keptPicksKey(account)
        store.edit {
            val left = decode(get(name)).filterNot { it.family == family && it.target in targets }
            if (left.isEmpty()) remove(name) else put(name, encode(left))
        }
    }
}

/**
 * Where an account's kept picks live. Named once, because the custody set
 * (`LockCustodyStoreImpl`, `IdentityStoreImpl.purgeCustodySet`) has to find
 * the same record this store writes.
 */
internal fun keptPicksKey(account: String): String = "kept_picks:$account"

@Serializable
private data class StoredPick(
    /** `node` or `topic`: the target's address. */
    val address: String,
    val id: String,
    val pDirected: Double,
    val pInterest: Double,
    val family: String,
    val kind: String? = null,
    val keptAt: Long,
)

private val json = Json { ignoreUnknownKeys = true }

private fun encode(picks: List<KeptPick>): ByteArray = json.encodeToString(
    picks.map { pick ->
        StoredPick(
            address = if (pick.target is StanceTarget.Topic) TOPIC else NODE,
            id = when (val target = pick.target) {
                is StanceTarget.Node -> target.id
                is StanceTarget.Topic -> target.name
            },
            pDirected = pick.pick.pDirected,
            pInterest = pick.pick.pInterest,
            family = pick.family.name,
            kind = pick.kind?.name,
            keptAt = pick.keptAt,
        )
    },
).encodeToByteArray()

private fun decode(bytes: ByteArray?): List<KeptPick> {
    if (bytes == null) return emptyList()
    val stored = try {
        json.decodeFromString<List<StoredPick>>(bytes.decodeToString())
    } catch (_: SerializationException) {
        return emptyList()
    } catch (_: IllegalArgumentException) {
        return emptyList()
    }
    return stored.mapNotNull { it.toDomain() }.sortedBy { it.keptAt }
}

/** A row this build cannot name — an unknown family or address — is no kept pick. */
private fun StoredPick.toDomain(): KeptPick? {
    val target = when (address) {
        NODE -> StanceTarget.Node(id)
        TOPIC -> StanceTarget.Topic(id)
        else -> return null
    }
    val family = KeptFamily.entries.firstOrNull { it.name == family } ?: return null
    return KeptPick(
        target = target,
        pick = StancePair(pDirected, pInterest),
        family = family,
        kind = StanceKind.entries.firstOrNull { it.name == kind },
        keptAt = keptAt,
    )
}

private const val NODE = "node"
private const val TOPIC = "topic"

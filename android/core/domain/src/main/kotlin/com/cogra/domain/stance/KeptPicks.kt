// A PICK KEPT PENDING (PadKeyAbsent.md, PadPending.md, PadPendingReview.md,
// KeptPicksReview.md). With the signing key elsewhere nothing is signed and
// nothing is staged server-side — but a reader who pressed `Keep it pending,
// restore later` made a pick and kept it, and the target's anchor has to say
// so or the pick reads as lost. Once the key is back the kept opinions sign
// together, from the review's own seal, never on their own.
//
// - It lives on THIS DEVICE ONLY and survives a restart (PadKeyAbsent.md:33).
// - ONE PER TARGET: a new pick kept on the same target replaces the old one;
//   several targets can wait at once (:31, :35).
// - Only `Keep it pending` keeps one; leaving the pad any other way drops it.
// - PER ACCOUNT, in the draft's custody tier (auth.md "Sign-out", "Device
//   lock"): a device lock seals it with the draft, a don't-remember sign-out
//   clears it with the draft, a remembered sign-out keeps every one, and a
//   session ended elsewhere never destroys one (:37-:43).
// - A KEPT VOUCH-BACK OR APPROVAL IS NOT A KEPT OPINION (KeptPicksReview.md:9,
//   VouchBackPad.md:49, ApprovePad.md:41): it is kept with its family named,
//   so the review — which lists plain picks only — never takes it into the
//   batch. web's twin is `web/src/lib/stance/kept-picks.ts`.

package com.cogra.domain.stance

import kotlinx.coroutines.flow.Flow

/** What a kept pick will sign as once the key is back. */
enum class KeptFamily {
    /** A plain pick — an opinion, or a feeling on a topic: the review's batch. */
    OPINION,

    /** The vouch card's answer: its own card and pad, its ceremony kept. */
    VOUCH_BACK,

    /** A vouch toward an application, keyed by the application: it waits on Invites. */
    APPROVAL,
}

/**
 * What a stance target is, as a kept pick's row names it (KeptPicksReview.md:13:
 * `Post`, `Comment`, `Person` or `Topic`). The control holds an opaque id, so
 * the kind is whatever the target's standing read already learned — known at
 * the keep in practice, since the pad opened over a target the surface read.
 */
enum class StanceKind { POST, COMMENT, PERSON, TOPIC }

/** One kept pick: what it is on, the pair it will sign, and what it signs as. */
data class KeptPick(
    val target: StanceTarget,
    val pick: StancePair,
    val family: KeptFamily,
    /** The target's kind; null where no read had learned it when the pick was kept. */
    val kind: StanceKind?,
    /** When it was kept — the review lists the picks in the order they were made. */
    val keptAt: Long,
)

/**
 * The active account's kept picks, sealed on this device. Every call reads
 * the account signed in now; with nobody signed in there is nothing kept.
 */
interface KeptPickStore {
    /** The account's kept picks, every family, oldest first — live. */
    fun watch(): Flow<List<KeptPick>>

    /** The same, read once. */
    suspend fun list(): List<KeptPick>

    /** Keeps [pick] toward [target] as [family], replacing whatever that family kept there. */
    suspend fun keep(target: StanceTarget, pick: StancePair, family: KeptFamily, kind: StanceKind?)

    /** Drops the picks kept toward [targets] as [family] — a review's ×, a signed batch, a closed application. */
    suspend fun drop(targets: List<StanceTarget>, family: KeptFamily)
}

/** The kept plain picks — what the review lists and its seal signs (KeptPicksReview.md:5). */
fun List<KeptPick>.opinions(): List<KeptPick> = filter { it.family == KeptFamily.OPINION }

/** The pick [family] keeps toward [target], or null. */
fun List<KeptPick>.keptFor(target: StanceTarget, family: KeptFamily): KeptPick? =
    firstOrNull { it.target == target && it.family == family }

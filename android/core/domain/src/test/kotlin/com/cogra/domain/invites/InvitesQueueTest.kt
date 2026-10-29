package com.cogra.domain.invites

import com.google.common.truth.Truth.assertThat
import org.junit.Test
import java.time.Instant

/** The order law (behavior/Invites.md:9-17, :29, :71), compiled from the sidecar's lines. */
class InvitesQueueTest {

    private fun row(
        id: String,
        age: Long,
        link: QueueLink? = null,
        ready: Boolean = true,
        rejectedAt: Instant? = null,
    ) = ApplicationInfo(
        id = id,
        handle = id,
        emailVerified = ready,
        keyAttached = ready,
        createdAt = Instant.ofEpochSecond(age),
        rejectedAt = rejectedAt,
        inviteLink = link,
    )

    private val many = QueueLink("many", singleUse = false)
    private val single = QueueLink("single", singleUse = true)

    @Test
    fun groupsStandByTheirOldestRowAndRowsByAgeInsideThem() {
        // :9, :11 — the single-use group's oldest row is older than the many-use one's.
        val layout = layoutQueue(
            listOf(
                row("m2", age = 40, link = many),
                row("s1", age = 10, link = single),
                row("m1", age = 20, link = many),
                row("m3", age = 50, link = many),
            ),
        )
        assertThat(layout.groups.map { it.linkId }).containsExactly("single", "many").inOrder()
        assertThat(layout.groups[1].rows.map { it.id }).containsExactly("m1", "m2", "m3").inOrder()
        assertThat(layout.groups[1].singleUse).isFalse()
        assertThat(layout.groups[0].singleUse).isTrue()
    }

    @Test
    fun theQueueIsNeverOrderedByReadiness() {
        // :13 — an older row not fully registered stands before a newer ready one.
        val layout = layoutQueue(
            listOf(row("ready", age = 20, link = many), row("unready", age = 10, link = many, ready = false)),
        )
        assertThat(layout.rows.map { it.id }).containsExactly("unready", "ready").inOrder()
    }

    @Test
    fun askLinkRowsHeadTheListBeforeEveryGroup() {
        // :71 + design digest item 5 — a staging has no link and heads Applications.
        val layout = layoutQueue(
            listOf(row("linked", age = 1, link = many), row("asked", age = 99)),
        )
        assertThat(layout.head.map { it.id }).containsExactly("asked")
        assertThat(layout.rows.map { it.id }).containsExactly("asked", "linked").inOrder()
    }

    @Test
    fun closeAllStandsOnlyPastOneWaiting() {
        // :15, :17.
        val layout = layoutQueue(
            listOf(row("a", 1, many), row("b", 2, many), row("c", 3, single)),
        )
        assertThat(layout.groups.single { it.linkId == "many" }.closesAll).isTrue()
        assertThat(layout.groups.single { it.linkId == "single" }.closesAll).isFalse()
    }

    @Test
    fun aClosedRowNeverStandsEvenOnAStaleRead() {
        val layout = layoutQueue(listOf(row("closed", 1, many, rejectedAt = Instant.EPOCH)))
        assertThat(layout.isEmpty).isTrue()
    }

    @Test
    fun onlyAUsableLinkStandsUnderLiveLinks() {
        // :29 — revoked, expired or used are all `usable = false`, the server's one reckoning.
        val live = InviteLinkInfo("live", true, Instant.EPOCH, Instant.EPOCH, null, usable = true)
        val dead = InviteLinkInfo("dead", true, Instant.EPOCH, Instant.EPOCH, null, usable = false)
        assertThat(liveLinks(listOf(live, dead))).containsExactly(live)
    }
}

// INVITES, AS DATA (behavior/Invites.md): the order law and what stands on
// the page, pure, so it is tested once. web's twin is
// `web/src/lib/invites/queue.ts`.

package com.cogra.domain.invites

/** A link's group: its rows, oldest first (Invites.md:11). */
data class ApplicationGroup(
    /** The link's id: the group's registered key (`invites.group`). */
    val linkId: String,
    val singleUse: Boolean,
    val rows: List<ApplicationInfo>,
) {
    /** The batch control stands only where more than one waits (Invites.md:15-17). */
    val closesAll: Boolean get() = rows.size > 1
}

/** Applications as the page stands them. */
data class QueueLayout(
    /**
     * Rows taken up through the reader's ask-link door, at the head of
     * Applications before every group (Invites.md:71; design digest item 5:
     * "the same head-of-list Invites row on every device").
     */
    val head: List<ApplicationInfo>,
    val groups: List<ApplicationGroup>,
) {
    val isEmpty: Boolean get() = head.isEmpty() && groups.isEmpty()

    /** Every row in the order it stands. */
    val rows: List<ApplicationInfo> get() = head + groups.flatMap { it.rows }
}

/**
 * THE ORDER LAW (Invites.md:9-13): rows grouped by the link they came
 * through, groups standing by their oldest waiting application, rows by age
 * inside them — never by whether the reader can act on a row. Only waiting
 * rows stand: the queue read already serves only those, and the filter
 * holds the line against a stale read.
 */
fun layoutQueue(queue: List<ApplicationInfo>): QueueLayout {
    // A stable sort: two rows of one age keep the server's order.
    val waiting = queue.filter { it.waiting }.sortedBy { it.createdAt }
    val head = mutableListOf<ApplicationInfo>()
    // Insertion-ordered, and rows arrive oldest first, so the groups
    // already stand by their oldest row.
    val groups = LinkedHashMap<String, MutableList<ApplicationInfo>>()
    val singleUse = HashMap<String, Boolean>()
    for (application in waiting) {
        val link = application.inviteLink
        if (link == null) {
            head += application
        } else {
            groups.getOrPut(link.id) { mutableListOf() } += application
            singleUse.putIfAbsent(link.id, link.singleUse)
        }
    }
    return QueueLayout(
        head = head,
        groups = groups.map { (id, rows) -> ApplicationGroup(id, singleUse.getValue(id), rows) },
    )
}

/** Only a link that still works stands under Live links (Invites.md:29). */
fun liveLinks(links: List<InviteLinkInfo>): List<InviteLinkInfo> = links.filter { it.usable }

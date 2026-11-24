// THE EVERYTHING TAB'S READ (Profile.md:29-39; `profile.graphql`
// `ProfileChronicle`): the person's chronicle, one act to a row, in the
// server's order — the posts and comments still settling first, newest
// signed first, then the landed records newest first (Profile.md:31, :33).
// web's twin is `web/src/lib/api/profile-api.ts` `fetchProfileChronicle`.

package com.cogra.network.repo

import com.apollographql.apollo.ApolloClient
import com.apollographql.apollo.api.Optional
import com.cogra.crypto.Family
import com.cogra.domain.Outcome
import com.cogra.domain.Page
import com.cogra.domain.RecordAbout
import com.cogra.domain.RecordAct
import com.cogra.domain.RecordLink
import com.cogra.domain.RecordOpinion
import com.cogra.domain.RecordRow
import com.cogra.domain.RemovalAgent
import com.cogra.domain.map
import com.cogra.domain.stance.removalMark
import com.cogra.network.fetch
import com.cogra.network.graphql.ProfileChronicleQuery
import com.cogra.network.graphql.fragment.ChronicleRecordFields
import com.cogra.network.graphql.fragment.ChronicleSettlingCommentFields
import com.cogra.network.graphql.fragment.ChronicleSettlingPostFields
import com.cogra.network.graphql.type.LandingState
import com.cogra.network.toDomain

/**
 * One page of the chronicle, every entry in the order served — no
 * client-side merge or sort. A person the server does not know reads empty;
 * an entry of a kind this build does not read is left out.
 */
internal suspend fun readProfileChronicle(
    client: ApolloClient,
    authorId: String,
    first: Int,
    after: String?,
): Outcome<Page<RecordRow>> = client.query(
    ProfileChronicleQuery(id = authorId, first = first, after = Optional.presentIfNotNull(after)),
).fetch().map { data ->
    val chronicle = data.user?.chronicle ?: return@map Page(emptyList(), endCursor = null, hasNextPage = false)
    Page(
        items = chronicle.edges.mapNotNull { edge ->
            val node = edge.node
            node.chronicleRecordFields?.toRow()
                ?: node.chronicleSettlingPostFields?.toRow()
                ?: node.chronicleSettlingCommentFields?.toRow()
        },
        endCursor = chronicle.pageInfo.endCursor,
        hasNextPage = chronicle.pageInfo.hasNextPage,
    )
}

/**
 * A STILL-SETTLING POST as its act's row: the row its genesis record will
 * draw (`Published a post`), its own words as the snippet (its title, else
 * its words), the post itself as its door, aged by its signing, keyed by the
 * record it lands as.
 */
private fun ChronicleSettlingPostFields.toRow(): RecordRow = RecordRow(
    id = genesisRecordId,
    family = Family.PUBLISH,
    genesis = true,
    // A removed one reads its mark where its words were (Profile.md:39).
    snippet = removalMark(removal?.by?.toDomain()) ?: title.value ?: content.value,
    link = RecordLink.ToPost(postId),
    act = RecordAct.GENESIS,
    pending = landing.state == LandingState.PENDING,
    signedAt = createdAt,
)

/**
 * A STILL-SETTLING COMMENT as its act's row (`Commented`): its own words,
 * and its thread's post as the door the Comments tab's card opens.
 */
private fun ChronicleSettlingCommentFields.toRow(): RecordRow = RecordRow(
    id = genesisRecordId,
    family = Family.REVIEW,
    genesis = true,
    snippet = removalMark(removal?.by?.toDomain()) ?: content.value,
    link = post?.id?.let { RecordLink.ToPost(it) },
    act = RecordAct.GENESIS,
    pending = landing.state == LandingState.PENDING,
    signedAt = createdAt,
)

/**
 * One landed act: family + genesis mark, the touched content's snippet,
 * and the post it opens. A record is a genesis exactly when its target
 * (binary) or terminal (hyper) is the mint of its own act.
 */
private fun ChronicleRecordFields.toRow(): RecordRow {
    val mint = "mint:$id"
    val kind = family.toDomain()
    // A citation is about its terminal leg — the cited thing — while every
    // other family is about its target (a Review's terminal being the
    // comment it minted, whose words are the row's).
    val reading = if (kind == Family.REFERENCE) citedReading() else touchedReading()
    // The row's own thing — the node its second line quotes: a comment's or a
    // citation's terminal, anything else's target. Once that thing is removed
    // its mark stands where its words were, and no other node's words ever
    // fall through in their place (Profile.md:37, :39; ProfileDeleted.md:25).
    val removed = removalMark(
        if (kind == Family.REVIEW || kind == Family.REFERENCE) terminalRemoval() else targetRemoval(),
    )
    // The server's reading of what the record did (`Record.act`); a value
    // this client does not know reads ordinary.
    val did = runCatching { RecordAct.valueOf(act.rawValue) }.getOrDefault(RecordAct.ORDINARY)
    return RecordRow(
        id = id,
        family = kind,
        genesis = did == RecordAct.GENESIS || targetId == mint || terminalId == mint,
        snippet = removed ?: reading.snippet,
        link = reading.link,
        landedAt = landedAt,
        // Both stance families wear their own face (the chronicle's opinion card).
        opinion = RecordOpinion(pDirected, pInterest, severed == true)
            .takeIf { kind == Family.OPINION || kind == Family.AFFINITY },
        targetHandle = reading.handle,
        act = did,
        about = reading.about,
        topic = topic?.name?.value?.takeIf { it.isNotBlank() },
        untag = kind == Family.TAG && pDirected == 0.0 && pInterest == 0.0,
    )
}

/** Who removed the record's target, when it is a removed post or comment. */
private fun ChronicleRecordFields.targetRemoval(): RemovalAgent? =
    (target?.onPost?.removal?.by ?: target?.onComment?.removal?.by)?.toDomain()

/** Who removed the record's terminal — a Review's comment, a citation's cited thing. */
private fun ChronicleRecordFields.terminalRemoval(): RemovalAgent? =
    (terminal?.onPost?.removal?.by ?: terminal?.onComment?.removal?.by)?.toDomain()

/** What a chronicle row reads of the node its act is about. */
private class RowReading(
    val snippet: String?,
    val link: RecordLink?,
    val about: RecordAbout?,
    val handle: String?,
)

/** A citation's row reads its terminal leg, the cited thing: a post, a comment, or a person mentioned. */
private fun ChronicleRecordFields.citedReading(): RowReading {
    val post = terminal?.onPost
    val comment = terminal?.onComment
    val person = terminal?.onUser
    return RowReading(
        snippet = post?.title?.value ?: post?.content?.value ?: comment?.content?.value,
        link = post?.let { RecordLink.ToPost(it.id) }
            ?: comment?.target?.onPost?.id?.let { RecordLink.ToPost(it) },
        about = when {
            person != null -> RecordAbout.PERSON
            post != null -> RecordAbout.POST
            comment != null -> RecordAbout.COMMENT
            else -> null
        },
        handle = person?.handle,
    )
}

/**
 * Every other row reads what its act touched: a Review's minted comment
 * (its terminal), else the target post or comment, or the person an
 * opinion was given on.
 */
private fun ChronicleRecordFields.touchedReading(): RowReading {
    val minted = terminal?.onComment
    val post = target?.onPost
    val comment = target?.onComment
    val person = target?.onUser
    return RowReading(
        snippet = minted?.content?.value ?: post?.title?.value ?: post?.content?.value ?: comment?.content?.value,
        // A Review's thread opens at its parent post, when the parent is a
        // post CoGra carries; nested reply chains stay unlinked until a
        // comment permalink exists.
        link = when {
            minted != null -> minted.target?.onPost?.id?.let { RecordLink.ToPost(it) }
            post != null -> RecordLink.ToPost(post.id)
            else -> comment?.target?.onPost?.id?.let { RecordLink.ToPost(it) }
        },
        about = when {
            person != null -> RecordAbout.PERSON
            post != null -> RecordAbout.POST
            comment != null -> RecordAbout.COMMENT
            else -> null
        },
        handle = person?.handle,
    )
}

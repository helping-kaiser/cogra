// WHAT CITES A NODE, as the Cited by sheet reads it (CitedBy.md;
// CommentCitedByEmpty.md). web's twin: `fetchCitingArtifacts` in
// `web/src/lib/api/references-api.ts` and `citingView` in
// `web/src/lib/ui2/cited-by-sheet.tsx`.

package com.cogra.domain.references

import com.cogra.domain.Outcome

/** The citing artifact's kind, as the row's mark tells it. */
enum class CitingKind { POST, COMMENT }

/**
 * The artifact a citation was built into, as its row names it (CitedBy.md:13).
 *
 * A citing artifact this client cannot type still counts and still shows: it
 * keeps its row and simply offers no destination, the same contract the
 * tags-and-references sheet gives a citation whose far end it cannot address.
 * A REMOVED artifact keeps its row too, its mark emptied and its name the
 * removal's own mark — the citation is still a fact, its payload is what went.
 */
data class CitingView(
    val kind: CitingKind,
    /** The post's title (or its stand-in), the comment's words, or the removal's mark. */
    val name: String,
    /** A post's cover for the mark; null draws the kind's own. */
    val cover: String? = null,
    /** The artifact was removed: its mark keeps its space and fills with nothing. */
    val redacted: Boolean = false,
    /**
     * The post the row opens: the citing post, or the post a citing comment
     * answers — a comment has no surface of its own, so it opens the thread it
     * stands in (CitedBy.md:15). One hop, as the web reads it: a reply nested
     * deeper keeps its row without a destination. Null opens nothing.
     */
    val opensPost: String? = null,
)

/** The inbound read behind the Cited by sheet. */
interface CitedByRepository {
    /**
     * Everything that cites [nodeId], newest first — one row per standing
     * citation, however many records it took, and none for a withdrawn one
     * ([foldCitingArtifacts]). The whole set is read, because a bundle's net
     * needs every record in it.
     */
    suspend fun citedBy(nodeId: String): Outcome<List<CitingArtifact<CitingView>>>
}

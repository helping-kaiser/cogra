// WHO HOLDS AN OPINION ON A POST OR A COMMENT (PostOpinions.md;
// CommentOpinionsEmpty.md). The profile's "opinions on them", mirrored onto
// content and ungated: everyone sees every row, the author no more than a
// stranger. web's twin is `fetchHeldOpinions` in
// `web/src/lib/api/opinions-api.ts`.

package com.cogra.domain.stance

import com.cogra.domain.Outcome

/** The inbound read behind the opinions sheet. */
interface NodeOpinionsRepository {
    /**
     * Everyone holding an opinion on [nodeId], strongest first — one row per
     * PERSON, however many records their opinion took ([foldHeldOpinions]):
     * the count the detail's line reads and the sheet's rows are this one
     * answer (PostOpinions.md:11).
     */
    suspend fun opinionsOn(nodeId: String): Outcome<List<HeldOpinion>>
}

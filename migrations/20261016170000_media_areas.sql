-- Media areas (data-model.md "Media areas"): where an asset's bytes
-- physically sit, which is a different fact from whether anything
-- shows them.
--
-- `live` is the world-readable store every MediaAttachment.url points
-- into — open by design, the license on every piece of content being
-- the evidence against misuse, not access control. `held` is the
-- operator-only store a deleted asset's bytes leave the internet for:
-- no public policy and no serving route, reached by the operator over
-- the host alone. `carried` is the non-public store an applicant's
-- carried media waits in until the landing publishes it.
--
-- The column moves only after the bytes have: an asset reads `held`
-- once its bytes are verified in the operator store and gone from the
-- live one, and `live` again only once a carried copy is verified in
-- the live store. Every existing row's bytes are in the live store.
ALTER TABLE media_attachments
    ADD COLUMN area TEXT NOT NULL DEFAULT 'live'
        CHECK (area IN ('live', 'carried', 'held')),
    ADD CONSTRAINT media_attachments_held_area_is_held
        CHECK (area <> 'held' OR held_at IS NOT NULL);

-- The held assets whose bytes have not yet left the live store — what
-- the reconciler retries. Empty at rest.
CREATE INDEX media_attachments_held_unmoved_idx
    ON media_attachments (held_at)
    WHERE held_at IS NOT NULL AND area = 'live';

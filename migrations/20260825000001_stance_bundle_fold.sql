-- The stance bundle fold (feed-ranking.md §3.2): a viewer's records toward
-- one node, netted per author by sum-then-clip. The read spans both halves
-- of the write path — the landed half in the mirror and, when the reader
-- takes the L2 view, the pending half still in flight — so each half needs
-- the bundle key as an index.
--
-- The landed half already has mirror_legs_source_idx on (source), but the
-- bundle is keyed (author, family, target): source alone makes every one of
-- an author's records a candidate. The composite key is the fold's own
-- shape.
CREATE INDEX mirror_legs_bundle_idx
    ON mirror_record_legs (source, family, target);

-- The pending half. A staged write counts toward the bundle from the
-- pre-commitment onward and stops counting once it lands (the mirror then
-- holds it) or expires (on the graph it never existed), so the partial
-- index carries exactly the rows the fold adds.
CREATE INDEX staged_writes_bundle_idx
    ON staged_writes (author, family, target)
    WHERE pre_signed_at IS NOT NULL AND state NOT IN ('landed', 'expired');

-- The record mirror's per-epoch boundary timestamp is the host's
-- asserted timestamp (layer1-interface.md, the Host Contract's
-- accepted-records package): the host asserts it, and it is checkable
-- only for consistency with the published duration bounds. The column
-- carries that name; its values and type are unchanged.
ALTER TABLE mirror_epochs RENAME COLUMN attested_at TO asserted_at;

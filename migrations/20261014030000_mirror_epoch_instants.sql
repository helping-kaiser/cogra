-- The record mirror's per-epoch attested boundary timestamp
-- (layer1-interface.md, the Host Contract's accepted-records package):
-- the instant every record of the epoch landed. `Record.landedAt` serves
-- it, the wall-clock time the ages ladder reads (copy-voice.md), where
-- the landing epoch and the causal key keep the order. Rebuildable with
-- the rest of the mirror from the published sequence.
--
-- Epochs ingested before the package carried the instant are filled
-- through the seam, never from here: the ingestion pass re-reads their
-- published packages (api::ingest::ingest_pending). A migration may not
-- read the stand-in's tables, which leave at the swap.
CREATE TABLE mirror_epochs (
    epoch       BIGINT      PRIMARY KEY,
    attested_at TIMESTAMPTZ NOT NULL
);

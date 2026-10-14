-- The record mirror's per-epoch attested boundary timestamp
-- (layer1-interface.md, the Host Contract's accepted-records package):
-- the instant every record of the epoch landed. `Record.landedAt` serves
-- it, the wall-clock time the ages ladder reads (copy-voice.md), where
-- the landing epoch and the causal key keep the order. Rebuildable with
-- the rest of the mirror from the published sequence.
CREATE TABLE mirror_epochs (
    epoch       BIGINT      PRIMARY KEY,
    attested_at TIMESTAMPTZ NOT NULL
);

-- The epochs already ingested take their instant from the stand-in's own
-- record of each close, the source every later package carries.
INSERT INTO mirror_epochs (epoch, attested_at)
SELECT e.epoch, e.closed_at
FROM l1_epochs e
WHERE e.epoch <= (SELECT last_epoch FROM mirror_epoch_cursor WHERE singleton);

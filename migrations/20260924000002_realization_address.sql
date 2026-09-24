-- The actor's address is the address a realization of the burn primitive
-- knows it by, so the column carries the compound name
-- `realization_address` (bare "address" would read as the email address
-- beside it). The unique index behind attachActorKey's refusal follows its
-- column; the kind CHECK references the column by attribute and needs no
-- change.

ALTER TABLE actors RENAME COLUMN l0_address TO realization_address;
ALTER INDEX actors_l0_address_key RENAME TO actors_realization_address_key;

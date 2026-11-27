-- Whether a staged write's act was sealed before the approval covered the
-- act alone (data-model.md "Staged writes"). The host takes an approval
-- for such an act in the sealed-act form as well as the current one, and
-- the relay checks a witness it is about to hold by the same rule
-- (`common::l1::handshake::approval_form_of`), so it neither refuses what
-- the host would take nor holds what the host would refuse. The host
-- keeps the same mark on its own acts
-- (20261127120000_l1_standin_replay_floor).
--
-- Additive and valid on a non-empty table. Every write whose seal is
-- recorded now — its dependency commitment is stored from the seal on,
-- and only a row the GC kept, already expired or landed, can lack it —
-- was sealed before; a write sealed later is not.
ALTER TABLE staged_writes ADD COLUMN sealed_before_switch BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE staged_writes SET sealed_before_switch = TRUE WHERE deps_commitment IS NOT NULL;

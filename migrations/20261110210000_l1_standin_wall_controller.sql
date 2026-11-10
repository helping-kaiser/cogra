-- The stand-in's price and closure outputs. Owned by the l1-standin crate
-- and dropped at the swap with the rest of the l1_* set.
--
-- θ is the wall controller's output (layer1-interface.md §11.8): each close
-- charges the wall in force and publishes the next. An epoch row now
-- records what its close computed beyond the records (§5 host contract
-- (i), (ii), (vi)): the debit vintage θ^(k) it charged, why it closed, the
-- marker policy it binds, and the controller step — the wall in force,
-- the width and rung inputs, the proposal, the delivered wall and its burn
-- image θ^(k+1). Reduced-axis values are exact ratios, stored as
-- numerator and positive denominator in lowest terms.
--
-- History: every epoch closed before this migration charged 52_810 µ — the
-- stand-in's only price, never configurable outside its own config default
-- — and ran no controller, so its step columns stay NULL. The next close
-- charges the declared initialization instead (l1-standin wall.rs), which
-- is how the deployment is re-initialized at the reference; no closed
-- epoch's debit changes (§11.7).

ALTER TABLE l1_epochs
    ADD COLUMN theta_charged_micro BIGINT,
    ADD COLUMN closure_cause       TEXT,
    ADD COLUMN marker_policy       TEXT,
    ADD COLUMN marker_edition      INTEGER,
    ADD COLUMN wall_num            BIGINT,
    ADD COLUMN wall_den            BIGINT,
    ADD COLUMN width_num           BIGINT,
    ADD COLUMN width_den           BIGINT,
    ADD COLUMN rung_num            BIGINT,
    ADD COLUMN rung_den            BIGINT,
    ADD COLUMN proposal_num        BIGINT,
    ADD COLUMN proposal_den        BIGINT,
    ADD COLUMN delivered_num       BIGINT,
    ADD COLUMN delivered_den       BIGINT,
    ADD COLUMN theta_next_micro    BIGINT;

-- The budget was 10_000 acts for every historical close; an epoch that
-- filled it closed on the target, every other one on the clock.
UPDATE l1_epochs
   SET theta_charged_micro = 52810,
       closure_cause = CASE WHEN act_count >= 10000 THEN 'target' ELSE 'duration' END,
       marker_policy = 'stand-in: the epoch close',
       marker_edition = 1;

ALTER TABLE l1_epochs
    ALTER COLUMN theta_charged_micro SET NOT NULL,
    ALTER COLUMN closure_cause SET NOT NULL,
    ALTER COLUMN marker_policy SET NOT NULL,
    ALTER COLUMN marker_edition SET NOT NULL,
    ADD CONSTRAINT l1_epochs_theta_charged_positive CHECK (theta_charged_micro > 0),
    ADD CONSTRAINT l1_epochs_closure_cause_known CHECK (closure_cause IN ('target', 'duration')),
    ADD CONSTRAINT l1_epochs_wall_step_whole CHECK (
        num_nonnulls(wall_num, wall_den, width_num, width_den, rung_num, rung_den,
                     proposal_num, proposal_den, delivered_num, delivered_den,
                     theta_next_micro) IN (0, 11)),
    ADD CONSTRAINT l1_epochs_wall_step_denominators CHECK (
        wall_den > 0 AND width_den > 0 AND rung_den > 0
        AND proposal_den > 0 AND delivered_den > 0),
    ADD CONSTRAINT l1_epochs_theta_next_positive CHECK (theta_next_micro > 0);

-- The epoch's final ledger, one line per author with an act in it: the
-- accepted-act increment, the action count after it, and the residual
-- balance after the epoch's debits. A historical epoch's increments and
-- counts are recomputed from its accepted acts — every count increment
-- came from a close — but its residual balances were never kept and
-- cannot be: burns credited between closes left no epoch behind. They
-- stay NULL.
CREATE TABLE l1_epoch_ledger (
    epoch         BIGINT NOT NULL REFERENCES l1_epochs (epoch),
    address       TEXT   NOT NULL,
    accepted_acts BIGINT NOT NULL CHECK (accepted_acts >= 1),
    action_count  BIGINT NOT NULL,
    balance_micro BIGINT,
    PRIMARY KEY (epoch, address),
    CHECK (action_count >= accepted_acts)
);

INSERT INTO l1_epoch_ledger (epoch, address, accepted_acts, action_count)
SELECT epoch, author, acts,
       SUM(acts) OVER (PARTITION BY author ORDER BY epoch)
  FROM (SELECT epoch, author, COUNT(*) AS acts
          FROM l1_acts
         WHERE status = 'accepted'
         GROUP BY epoch, author) AS per_epoch;

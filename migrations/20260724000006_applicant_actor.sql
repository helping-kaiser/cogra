-- Landing provenance: which actor a landed application became. Set at
-- landing; landed applicant rows persist as the account's registration
-- trace, and this join answers the viewer's invitedBy read.
ALTER TABLE auth_applicants
    ADD COLUMN actor_id UUID REFERENCES actors(id);

CREATE UNIQUE INDEX auth_applicants_actor_idx
    ON auth_applicants (actor_id) WHERE actor_id IS NOT NULL;

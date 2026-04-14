# Data Model

## The Boundary Rule

> If the data is needed to **navigate or weight** the graph → Memgraph.
> If the data is needed to **display** something → Postgres.

UUIDs are the shared key. Both databases store the same ID for the same entity; neither database stores the other's fields.

---

## PostgreSQL Schema

Postgres holds all human-readable metadata. It knows nothing about the social graph.

```sql
-- Users: identity and profile display data
CREATE TABLE users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT        NOT NULL UNIQUE,
    display_name  TEXT        NOT NULL,
    bio           TEXT,
    avatar_url    TEXT,
    website_url   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Posts: content authored by users
CREATE TABLE posts (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content    TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Media attached to posts (images, videos)
CREATE TABLE media_attachments (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id       UUID         NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    url           TEXT         NOT NULL,
    mime_type     TEXT         NOT NULL,
    size_bytes    BIGINT,
    alt_text      TEXT,
    display_order SMALLINT     NOT NULL DEFAULT 0
);

-- Comments: threaded replies on posts
CREATE TABLE comments (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id           UUID        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id UUID        REFERENCES comments(id),
    content           TEXT        NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hashtag registry (name lookup + metadata)
CREATE TABLE hashtags (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL UNIQUE,  -- stored lowercase, no '#'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### What is intentionally NOT in Postgres

- Counts (followers, likes, comments) — stored as graph node properties in Memgraph (see below)
- Follow / like / block relationships — graph-only (edges in Memgraph)
- Feed ordering logic — graph-only
- Recommendation signals — graph-only

---

## Graph Model (Memgraph / Cypher)

Memgraph stores the social topology and all counts. Nodes hold the UUID (the link back to Postgres) plus materialized counters. Relationships hold timestamps and optional weights.

### Nodes

```cypher
(:User {
    id:              String,   -- UUID, matches users.id in Postgres
    follower_count:  Int,      -- materialized, updated on FOLLOWS edge changes
    following_count: Int       -- materialized, updated on FOLLOWS edge changes
})

(:Post {
    id:            String,     -- UUID, matches posts.id in Postgres
    like_count:    Int,        -- materialized, updated on LIKED edge changes
    comment_count: Int         -- materialized, updated on COMMENTED edge changes
})

(:Hashtag { name: String })   -- lowercase name, matches hashtags.name
```

### Why counts live on graph nodes

Counts are graph signals used for ranking (e.g. sorting posts by most-liked). Most reads reach a node via graph traversal, so the counts are available as node properties for free — no separate aggregation query needed. On mutations, the count is updated atomically with the edge in a single Cypher transaction:

```cypher
-- Example: liking a post — edge + count in one transaction
MATCH (u:User {id: $user_id}), (p:Post {id: $post_id})
CREATE (u)-[:LIKED {at: datetime()}]->(p)
SET p.like_count = p.like_count + 1
```

This eliminates cross-database consistency issues (no dual-write to Postgres) and keeps the graph as the single source of truth for both topology and counts. For the minority of reads that bypass the graph (e.g. opening a direct link), a single node lookup by indexed ID returns the counts instantly.

### Relationships

```cypher
-- Social graph
(:User)-[:FOLLOWS   { since: DateTime }                  ]->(:User)
(:User)-[:BLOCKED                                        ]->(:User)

-- Content authorship
(:User)-[:CREATED   { at: DateTime }                     ]->(:Post)

-- Interactions (graph signals for ranking)
(:User)-[:LIKED     { at: DateTime }                     ]->(:Post)
(:User)-[:COMMENTED { comment_id: String, at: DateTime } ]->(:Post)
(:User)-[:SHARED    { at: DateTime }                     ]->(:Post)

-- Taxonomy
(:Post)-[:TAGGED_WITH                                    ]->(:Hashtag)
(:User)-[:INTERESTED_IN { weight: Float }               ]->(:Hashtag)
```

### Why store `comment_id` on the COMMENTED edge?

Comments are a frequent interaction and a strong graph signal, but their content lives in Postgres. The `comment_id` on the edge lets us retrieve the comment body from Postgres when needed, without duplicating content in the graph.

---

## Example Cypher Queries

### Feed: posts from people I follow (counts included for free)
```cypher
MATCH (me:User {id: $my_id})-[:FOLLOWS]->(followed:User)-[:CREATED]->(p:Post)
WHERE NOT (me)-[:BLOCKED]->(followed)
RETURN p.id, p.like_count, p.comment_count, followed.id, followed.follower_count
ORDER BY p.like_count DESC
LIMIT $limit
```

### Suggested users: friends of friends I don't follow yet
```cypher
MATCH (me:User {id: $my_id})-[:FOLLOWS]->(friend)-[:FOLLOWS]->(suggestion)
WHERE suggestion.id <> $my_id
  AND NOT (me)-[:FOLLOWS]->(suggestion)
RETURN suggestion.id, count(friend) AS mutual_count
ORDER BY mutual_count DESC
LIMIT $limit
```

### Shortest path between two users
```cypher
MATCH path = shortestPath(
    (a:User {id: $from_id})-[:FOLLOWS*..6]-(b:User {id: $to_id})
)
RETURN [node IN nodes(path) | node.id] AS user_ids
```

### Degree of separation
```cypher
MATCH path = shortestPath(
    (a:User {id: $from_id})-[:FOLLOWS*]-(b:User {id: $to_id})
)
RETURN length(path) AS degrees
```

---

## ID Strategy

1. UUIDs are generated in the **API layer** (Rust), not by the database.
2. The same UUID is written to Postgres and Memgraph in the same request.
3. Postgres uses `UUID` as the primary key type with a `DEFAULT gen_random_uuid()` fallback, but the API always supplies it explicitly.
4. Memgraph nodes store the UUID as a `String` property named `id`.
5. Memgraph indexes: `CREATE INDEX ON :User(id)`, `CREATE INDEX ON :Post(id)`.

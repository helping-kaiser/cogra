# Architecture

## Overview

graph_and_pull is a social network built around a dual-database architecture. The core insight is that a social network has two fundamentally different data access patterns that map poorly to a single database:

1. **Traversal queries** — "who do my followers follow?", "shortest path between two users", "what content is trending in my network?" These are graph problems. They perform well when the database understands relationships natively.

2. **Lookup queries** — "give me the profile for user X", "give me the content of post Y". These are key-value / relational lookups. They perform well in a traditional RDBMS.

Storing everything in one database forces a compromise. Storing graph topology in a graph DB and metadata in Postgres lets each database do what it was built for.

---

## Design Principles

### 1. Graph DB owns topology, Postgres owns content

The rule is simple: if a piece of data is only needed to *display* something, it goes in Postgres. If a piece of data is needed to *navigate or weight* the graph, it goes in Memgraph.

| Data | Where | Why |
|---|---|---|
| `User.id` | Both (UUID is the key) | Identity |
| `User.bio`, `User.avatar_url` | Postgres | Display only |
| `(User)-[:FOLLOWS]->(User)` | Memgraph | Graph topology |
| `Post.id` | Both | Identity |
| `Post.content`, `Post.media_urls` | Postgres | Display only |
| `(User)-[:LIKED]->(Post)` | Memgraph | Graph signal |
| `(User)-[:CREATED]->(Post)` | Memgraph | Authorship edge |
| `(Post)-[:TAGGED_WITH]->(Hashtag)` | Memgraph | Graph signal |

### 2. UUIDs as the shared key

Every entity gets a UUID at creation time. This UUID is stored in both databases and is the only way they reference each other. The graph engine never needs to know a username; the Postgres store never needs to know the follow graph.

### 3. Counts live on graph nodes

Follower counts, like counts, and comment counts are stored as **properties on graph nodes** in Memgraph — not in Postgres. They are updated atomically with the corresponding edge in a single Cypher transaction. This means:
- During traversal, counts are available as node properties for free (no aggregation query)
- No cross-database consistency problem (no dual-write for counts)
- Memgraph is the single source of truth for all graph state including counts

### 4. Writes are dual (content + topology)

When a user follows another user:
- Memgraph: create `(User)-[:FOLLOWS]->(User)` edge + increment both users' counters — single transaction
- Postgres: nothing

When a user creates a post:
- Postgres: insert row into `posts` table (content + metadata)
- Memgraph: create `(:Post {id, like_count: 0, comment_count: 0})` node + `(User)-[:CREATED]->(Post)` edge

When a user likes a post:
- Memgraph: create `(User)-[:LIKED]->(Post)` edge + increment `post.like_count` — single transaction
- Postgres: nothing

---

## Components

### `crates/api`

The public-facing binary. Responsibilities:
- Starts the Axum HTTP server
- Hosts the async-graphql schema at `/graphql`
- Hosts the GraphQL playground at `/playground` (dev only)
- Holds connection pools for both databases
- Calls `graph-engine` and `postgres-store` to fulfill resolvers
- No business logic — it orchestrates, it does not decide

### `crates/graph-engine`

The Memgraph access layer. Responsibilities:
- Owns the `neo4rs::Graph` connection pool
- Exposes typed Rust functions for every Cypher query
- All Cypher strings live here, nowhere else
- Returns domain types from `common`, not raw graph results

### `crates/postgres-store`

The PostgreSQL access layer. Responsibilities:
- Owns the `sqlx::PgPool`
- Exposes typed Rust functions for every SQL query
- All SQL strings live here, nowhere else
- Manages migrations via SQLx

### `crates/common`

Shared types with no external dependencies. Responsibilities:
- Domain model structs (`User`, `Post`, `Comment`, etc.)
- Shared error types
- No database or HTTP logic

---

## Request Lifecycle: Feed Query

A GraphQL query for a personalized feed shows how the two databases compose:

```
Client → POST /graphql { feed(limit: 20) }

1. API receives query, calls graph-engine
2. graph-engine: Cypher query to Memgraph
   MATCH (me:User {id: $my_id})-[:FOLLOWS]->(followed:User)-[:CREATED]->(p:Post)
   RETURN p.id, followed.id
   ORDER BY p.created_at DESC LIMIT 20
   → returns: [(post_id, author_id), ...]

3. API calls postgres-store with post_ids + author_ids
4. postgres-store: SQL query to Postgres
   SELECT * FROM posts WHERE id = ANY($1)
   SELECT * FROM users WHERE id = ANY($2)
   → returns: post content + author metadata

5. API merges results, resolves GraphQL fields
6. Returns JSON to client
```

The graph engine decides *which* posts to show (topology-based ranking). Postgres tells us *what* those posts contain.

---

## Infrastructure

```
Local dev (Docker Compose):
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  ┌─────────────────┐      ┌─────────────────────────┐   │
│  │  gnp_postgres   │      │      gnp_memgraph        │   │
│  │  postgres:16    │      │  memgraph-platform:latest│   │
│  │  port 5432      │      │  bolt: 7687              │   │
│  └─────────────────┘      │  lab:  3000              │   │
│                           └─────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

Volumes are named (`postgres_data`, `memgraph_data`) so data persists across `make down` / `make up`. Use `make reset-db` to wipe everything.

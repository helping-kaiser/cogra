# CoGra

The **graph-architecture exploration** for **Peer Network**'s next
evolution — designing and prototyping how a graph-driven social media
platform can replace AI content algorithms with transparent, user-controlled
feed ranking based on the social graph.

No AI algorithms. No push marketing. No black boxes. Every user's feed is
computed from their own position in the graph and the weighted edges they
create through explicit interactions.

See [CLAUDE.md](CLAUDE.md) for the full set of project principles.

## Architecture

Two databases, each doing what it does best:

- **Memgraph** — the social graph: nodes (users, collectives, posts, comments,
  chats, items, hashtags, junction nodes), directional tensor edges, and all
  traversal/ranking queries in Cypher.
- **PostgreSQL** — metadata: profiles, post content, media URLs, display data.
  Everything needed to render a page, nothing needed to weight the graph.

```
┌─────────────┐     GraphQL      ┌────────────────────────────────────────┐
│   Client    │ ──────────────── │             API  (Axum)                │
└─────────────┘                  └──────────────┬─────────────────────────┘
                                                │
                              ┌─────────────────┴──────────────────┐
                              │                                     │
                   ┌──────────▼──────────┐             ┌───────────▼───────────┐
                   │   graph-engine      │             │   postgres-store      │
                   │  (Cypher / bolt)    │             │      (SQLx)           │
                   └──────────┬──────────┘             └───────────┬───────────┘
                              │                                     │
                   ┌──────────▼──────────┐             ┌───────────▼───────────┐
                   │     Memgraph        │             │      PostgreSQL        │
                   │   (graph layer)     │             │   (metadata layer)    │
                   └─────────────────────┘             └───────────────────────┘
```

The shared key between both databases is the **UUID** assigned at creation
time. Memgraph stores graph topology (nodes + tensor edges). PostgreSQL stores
everything needed to display content.

## Crate Structure

| Crate | Role |
|---|---|
| `api` | Axum HTTP server, async-graphql schema, request handlers |
| `graph-engine` | Cypher queries against Memgraph via bolt protocol |
| `postgres-store` | SQLx queries, migrations, metadata CRUD |
| `common` | Shared domain types, error types, UUIDs |

## Quick Start

```bash
make run          # first-time: init + start DBs + migrate + start API
make dev          # returning: start DBs + migrate + start API
make api          # just the API (if DBs already running)
```

Memgraph Lab (visual graph browser): http://localhost:3000

## Make Commands

```
make init         first-time setup: copy .env, check/install dependencies
make run          full start: init + dev (first-time friendly)
make dev          start DBs + migrate + start API
make api          start the API server
make up           start all services (Postgres + Memgraph)
make down         stop all services
make reset-db     wipe all data and re-migrate
make migrate      run pending Postgres migrations
make ci           full CI pipeline (lint + test)
make lint         clippy + fmt check
make fmt          format all code
make test         cargo test --all
make logs         follow docker compose logs
```

## Documentation

Docs are organized in three layers under `docs/`:

- **`docs/primitive/`** — what the graph IS and how it BEHAVES (graph-model, nodes, edges, layers, governance, authorship, feed-ranking, invitations).
- **`docs/instances/`** — concrete applications of the primitive (chats, collectives, items).
- **`docs/implementation/`** — system and code-level concerns (architecture, data-model, development, api-spec, graph-db-options).

See [docs/README.md](docs/README.md) for the full index by layer and the suggested reading order. Cross-cutting design questions live in [docs/open-questions.md](docs/open-questions.md).

## Tech Stack

| Concern | Choice |
|---|---|
| Language | Rust 2021 |
| API | Axum + async-graphql |
| Graph DB | Memgraph (openCypher, bolt protocol) |
| Metadata DB | PostgreSQL 16 (SQLx) |
| Local dev | Docker Compose |
| CI | GitHub Actions |

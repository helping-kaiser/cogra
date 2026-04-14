# graph_and_pull

A graph social network built in Rust — exploring how dedicated graph databases model social relationships and how pull-based content discovery emerges naturally from graph topology.

## Architecture

Two databases, each doing what it does best:

- **Memgraph** — the social graph: users, follows, likes, post authorship, hashtags. All traversal and recommendation queries run here in Cypher.
- **PostgreSQL** — metadata: user profiles, post content, media URLs, biographies. Everything needed to render a page, nothing needed to weight the graph.

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

The shared key between both databases is the **UUID** assigned at creation time. Memgraph nodes store only IDs and relationship weights; PostgreSQL stores everything needed to display them.

## Crate Structure

| Crate | Role |
|---|---|
| `api` | Axum HTTP server, async-graphql schema, request handlers |
| `graph-engine` | Cypher queries against Memgraph via bolt protocol |
| `postgres-store` | SQLx queries, migrations, metadata CRUD |
| `common` | Shared domain types, error types, UUIDs |

## Quick Start

```bash
cp .env.example .env
make dev          # start Postgres + Memgraph, run migrations
cargo run -p api
```

Memgraph Lab (visual graph browser): http://localhost:3000

## Make Commands

```
make up           start all services
make down         stop all services
make reset-db     wipe all data and re-migrate
make migrate      run pending Postgres migrations
make dev          up + migrate, ready to run the API
make ci           full CI pipeline (lint + test)
make lint         clippy + fmt check
make fmt          format all code
make test         cargo test --all
make logs         follow docker compose logs
```

## Documentation

- [Architecture](docs/architecture.md) — system design, data flow, design principles
- [Data Model](docs/data-model.md) — Postgres schema + graph node/edge definitions
- [API Spec](docs/api-spec.md) — GraphQL schema and query examples
- [Development Guide](docs/development.md) — local setup, tools, workflows
- [Graph DB Decision Record](docs/graph-db-options.md) — why Memgraph, alternatives considered

## Tech Stack

| Concern | Choice |
|---|---|
| Language | Rust 2021 |
| API | Axum + async-graphql |
| Graph DB | Memgraph (openCypher, bolt protocol) |
| Metadata DB | PostgreSQL 16 (SQLx) |
| Local dev | Docker Compose |
| CI | GitHub Actions |

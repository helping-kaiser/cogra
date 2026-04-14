-include .env
export

DOCKER_COMPOSE = docker compose -f docker/docker-compose.yml
CARGO          = cargo

.PHONY: help up down reset-db migrate ci lint fmt test build logs dev

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

up: ## Start all services (Postgres + Memgraph)
	$(DOCKER_COMPOSE) up -d
	@echo "Memgraph Lab: http://localhost:3000"

down: ## Stop all services
	$(DOCKER_COMPOSE) down

reset-db: ## Wipe all data volumes and restart fresh
	$(DOCKER_COMPOSE) down -v
	$(DOCKER_COMPOSE) up -d
	@echo "Waiting for Postgres to be ready..."
	@until $(DOCKER_COMPOSE) exec -T postgres pg_isready -U $(POSTGRES_USER) > /dev/null 2>&1; do sleep 1; done
	$(MAKE) migrate
	@echo "Done. Databases are clean and migrated."

migrate: ## Run pending Postgres migrations
	sqlx migrate run --source migrations --database-url $(DATABASE_URL)

dev: up ## Start services and prepare for local development
	@echo "Waiting for Postgres to be ready..."
	@until $(DOCKER_COMPOSE) exec -T postgres pg_isready -U $(POSTGRES_USER) > /dev/null 2>&1; do sleep 1; done
	$(MAKE) migrate
	@echo "Ready. Run: cargo run -p api"

ci: lint test ## Run full CI pipeline locally (lint + test)

lint: ## Run clippy and fmt check (read-only, matches CI)
	$(CARGO) fmt --all -- --check
	$(CARGO) clippy --all-targets --all-features -- -D warnings

fmt: ## Format all code
	$(CARGO) fmt --all

test: ## Run all tests
	$(CARGO) test --all

build: ## Build all crates
	$(CARGO) build --all

logs: ## Follow docker compose logs
	$(DOCKER_COMPOSE) logs -f

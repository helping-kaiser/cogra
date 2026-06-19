-include .env
export

DOCKER_COMPOSE = docker compose -f docker/docker-compose.yml
CARGO          = cargo

.PHONY: help init up down reset-db migrate api api-release bootstrap run ci lint fmt test build logs dev docs-link-check schema android-ci android-lint android-test android-build

help: ## Show available commands
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

init: ## First-time setup: copy .env, check & install dependencies
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env from .env.example"; \
	else \
		echo ".env already exists, skipping"; \
	fi
	@command -v docker >/dev/null 2>&1 || { echo "Error: docker is not installed"; exit 1; }
	@command -v cargo >/dev/null 2>&1 || { echo "Error: cargo is not installed (install via https://rustup.rs)"; exit 1; }
	@if ! command -v sqlx >/dev/null 2>&1; then \
		echo "Installing sqlx-cli..."; \
		cargo install sqlx-cli --no-default-features --features postgres; \
	else \
		echo "sqlx-cli already installed"; \
	fi
	@echo "All dependencies ready."

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

api: ## Start the API server
	$(CARGO) run -p api

api-release: ## Start the API server (optimized build; realistic auth/crypto latency)
	$(CARGO) run --release -p api

schema: ## Regenerate schema.graphql (the frontend contract) from the Rust schema
	$(CARGO) run -p api --bin export-schema > schema.graphql

bootstrap: up ## One-time instance setup: generate the JWT key, write genesis nodes + first invite link
	@echo "Waiting for Postgres to be ready..."
	@until $(DOCKER_COMPOSE) exec -T postgres pg_isready -U $(POSTGRES_USER) > /dev/null 2>&1; do sleep 1; done
	$(CARGO) run -p api --bin bootstrap

dev: up ## Start DBs, run migrations, then start the API
	@echo "Waiting for Postgres to be ready..."
	@until $(DOCKER_COMPOSE) exec -T postgres pg_isready -U $(POSTGRES_USER) > /dev/null 2>&1; do sleep 1; done
	$(MAKE) migrate
	$(MAKE) api

run: init dev ## Full start: init + dev (first-time friendly)

ci: lint test docs-link-check ## Run full CI pipeline locally (lint + test + docs)

lint: ## Run clippy and fmt check (read-only, matches CI)
	$(CARGO) fmt --all -- --check
	$(CARGO) clippy --all-targets --all-features -- -D warnings

fmt: ## Format all code
	$(CARGO) fmt --all

test: ## Run all tests
	$(CARGO) test --all

docs-link-check: ## Check markdown link targets + anchors (mirrors docs-ci.yml; needs lychee)
	@command -v lychee >/dev/null 2>&1 || { echo "Error: lychee not found (cargo install lychee)"; exit 1; }
	lychee --offline --include-fragments --no-progress 'docs/**/*.md' '*.md'

build: ## Build all crates
	$(CARGO) build --all

android-ci: android-test android-build ## Run the Android CI checks (mirrors the android job in ci.yml; needs JDK 17 + Android SDK)

android-test: ## Run Android unit tests (./gradlew test)
	cd android && ./gradlew test

android-build: ## Assemble the debug APK (./gradlew :app:assembleDebug)
	cd android && ./gradlew :app:assembleDebug

android-lint: ## Run Android lint (./gradlew lint; not a CI gate, convenience only)
	cd android && ./gradlew lint

logs: ## Follow docker compose logs
	$(DOCKER_COMPOSE) logs -f

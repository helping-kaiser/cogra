-include .env
export

# ?= so a machine-local .env can point at another compose runtime
# (e.g. podman in a WSL toolbox — development.md "Environment Variables").
DOCKER_COMPOSE ?= docker compose -f docker/docker-compose.yml
CARGO          = cargo

# The debug APK the web app hands to hotspot guests (development.md
# "Reaching the web dev server from the phone"): built by android-build,
# staged into web/public by web-apk, gitignored at the destination.
ANDROID_DEBUG_APK = android/app/build/outputs/apk/debug/app-debug.apk
WEB_APK_DIR       = web/public/downloads

# The dev machine's mkcert root CA, staged by scripts/stamp-net.sh: the
# guest APK trusts it so it can talk https to this machine's web origin.
ANDROID_DEV_CA = android/app/src/devCa/res/raw/cogra_dev_ca.pem

.PHONY: help init up down reset-db migrate api api-release bootstrap run ci lint fmt test build logs dev docs-link-check schema vectors tokens sqlx-prepare sqlx-check android-ci android-lint android-test android-build web-dev web-apk guest-apk web-ci

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

up: ## Start all services (Postgres)
	$(DOCKER_COMPOSE) up -d

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
	# Force a fresh build: on /mnt/c worktrees, cargo's mtime-based
	# fingerprints can be reused across worktrees sharing a target dir,
	# silently exporting stale SDL from an old binary while reporting green.
	find crates -name '*.rs' -exec touch {} +
	$(CARGO) run -p api --bin export-schema > schema.graphql

vectors: ## Regenerate client-crypto-vectors.json (the client crypto contract) from common
	UPDATE_CLIENT_VECTORS=1 $(CARGO) test -p common --test client_vectors

tokens: ## Regenerate design-tokens.json (the colour contract both clients pin to) from design.md §2.2
	cd web && UPDATE_DESIGN_TOKENS=1 npx vitest run src/lib/ui/design-tokens.test.ts

sqlx-prepare: ## Regenerate the committed .sqlx/ offline metadata (needs a live, migrated DB)
	$(CARGO) sqlx prepare --workspace --database-url $(DATABASE_URL)

sqlx-check: ## Verify .sqlx/ matches the queries against the live schema (needs a live, migrated DB)
	$(CARGO) sqlx prepare --workspace --check --database-url $(DATABASE_URL)

bootstrap: up ## One-time instance setup: seed genesis and land the L1 genesis records
	@echo "Waiting for Postgres to be ready..."
	@until $(DOCKER_COMPOSE) exec -T postgres pg_isready -U $(POSTGRES_USER) > /dev/null 2>&1; do sleep 1; done
	$(CARGO) run -p api --bin bootstrap

dev: up ## Start DBs, run migrations, then start the API
	@echo "Waiting for Postgres to be ready..."
	@until $(DOCKER_COMPOSE) exec -T postgres pg_isready -U $(POSTGRES_USER) > /dev/null 2>&1; do sleep 1; done
	$(MAKE) migrate
	$(MAKE) api

run: init dev ## Full start: init + dev (first-time friendly)

ci: lint sqlx-check test docs-link-check ## Run full CI pipeline locally (lint + sqlx metadata check + test + docs)

lint: ## Run clippy and fmt check (read-only, matches CI)
	$(CARGO) fmt --all -- --check
	SQLX_OFFLINE=true $(CARGO) clippy --all-targets --all-features -- -D warnings

fmt: ## Format all code
	$(CARGO) fmt --all

test: ## Run all tests
	$(CARGO) test --all

docs-link-check: ## Check markdown link targets + anchors (mirrors docs-ci.yml; needs lychee)
	@command -v lychee >/dev/null 2>&1 || { echo "Error: lychee not found (cargo install lychee)"; exit 1; }
	lychee --offline --include-fragments --no-progress 'docs/**/*.md' '*.md' 'android/*.md' 'web/*.md'

build: ## Build all crates
	$(CARGO) build --all

android-ci: android-test android-build ## Run the Android CI checks (mirrors the android job in ci.yml; needs JDK 17 + JDK 21 + Android SDK)

android-test: ## Run Android unit tests; scope to one module with m=feature:home
	cd android && ./gradlew $(if $(m),:$(m):test,test)

android-build: ## Assemble the debug APK (./gradlew :app:assembleDebug)
	cd android && ./gradlew :app:assembleDebug

android-lint: ## Run Android lint (./gradlew lint; not a CI gate, convenience only)
	cd android && ./gradlew lint

web-dev: ## Start the web app dev server (needs Node from web/.nvmrc)
	cd web && npm run dev

web-apk: ## Stage the Android debug APK where the web app serves it (run make android-build first)
	@[ -f $(ANDROID_DEBUG_APK) ] || { \
		echo "Error: $(ANDROID_DEBUG_APK) not found — run 'make android-build' first"; \
		exit 1; \
	}
	@mkdir -p $(WEB_APK_DIR)
	cp $(ANDROID_DEBUG_APK) $(WEB_APK_DIR)/app-debug.apk
	@echo "Staged $(WEB_APK_DIR)/app-debug.apk — the login page links it at /downloads/app-debug.apk"

guest-apk: ## Build the debug APK for a guest's phone against this machine's dev server, and stage it
	@case '$(WEB_ORIGIN)' in \
		https://*) ;; \
		*) echo "Error: WEB_ORIGIN must be an https origin (got '$(WEB_ORIGIN)') — run scripts/stamp-net.sh"; exit 1;; \
	esac
	@[ -f $(ANDROID_DEV_CA) ] || { \
		echo "Error: $(ANDROID_DEV_CA) not found — run scripts/stamp-net.sh"; \
		exit 1; \
	}
	cd android && ./gradlew :app:assembleDebug \
		-Pcogra.graphqlUrl=$(WEB_ORIGIN)/graphql \
		-Pcogra.webOrigin=$(WEB_ORIGIN)
	$(MAKE) web-apk

web-ci: ## Run the web CI checks (mirrors the web job in ci.yml)
	cd web && npm ci && npm run codegen && npm run lint && npm test && npm run build

logs: ## Follow docker compose logs
	$(DOCKER_COMPOSE) logs -f

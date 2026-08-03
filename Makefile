.PHONY: help setup up down logs build restart clean db-migrate db-upgrade db-downgrade db-shell test test-unit test-integration test-local

help:
	@echo "DineBuddy - Available Commands:"
	@echo "  make setup           - Copy .env.example to .env"
	@echo "  make up              - Start all services"
	@echo "  make down            - Stop all services"
	@echo "  make logs            - View logs"
	@echo "  make build           - Rebuild containers"
	@echo "  make restart         - Restart services"
	@echo "  make clean           - Remove containers and volumes"
	@echo "  make db-migrate      - Create a new migration (usage: make db-migrate MSG='description')"
	@echo "  make db-upgrade      - Apply migrations"
	@echo "  make db-downgrade    - Rollback last migration"
	@echo "  make db-shell        - Connect to database"
	@echo "  make test            - Run all tests (in Docker; works on any system)"
	@echo "  make test-unit       - Run unit tests only (in Docker)"
	@echo "  make test-integration - Run integration tests only (in Docker)"
	@echo "  make test-local      - Run all tests locally (requires Python 3.11/3.12 in backend/.venv)"

setup:
	cp backend/.env.example backend/.env
	@echo "✅ Created .env file. Please update with your settings."

up:
	docker-compose up -d
	@echo "✅ Services started. API: http://localhost:8000/api/v1/docs"

down:
	docker-compose down

logs:
	docker-compose logs -f backend

build:
	docker-compose build

restart:
	docker-compose restart

clean:
	docker-compose down -v
	@echo "✅ Removed all containers and volumes"

db-migrate:
	docker-compose exec backend alembic revision --autogenerate -m "$(MSG)"

db-upgrade:
	docker-compose exec backend alembic upgrade head

db-downgrade:
	docker-compose exec backend alembic downgrade -1

db-shell:
	docker-compose exec db psql -U postgres -d dinebuddy

# Run tests inside the backend container (Python 3.11, no local install needed). Use this for CI and sharing.
test:
	docker-compose exec backend python -m pytest tests/ -v

test-unit:
	docker-compose exec backend python -m pytest tests/unit/ -v

test-integration:
	docker-compose exec backend python -m pytest tests/integration/ -v

# Run tests on host. Ensures backend/.venv exists and deps are installed; uses Python 3.12, 3.11, or default.
# For best compatibility (psycopg2-binary wheels), use Python 3.11 or 3.12 (see .python-version).
test-local:
	@cd backend && ( [ -d .venv ] || (command -v python3.12 >/dev/null && python3.12 -m venv .venv) || (command -v python3.11 >/dev/null && python3.11 -m venv .venv) || (python3 -m venv .venv) ) && .venv/bin/pip install -q -r requirements.txt && .venv/bin/pytest tests/ -v

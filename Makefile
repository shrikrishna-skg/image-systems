.PHONY: help dev local frontend backend stack install-frontend install-root setup-backend

help:
	@echo "Targets:"
	@echo "  make setup-backend   - Create backend/.venv + pip install (fixes: No module named uvicorn)"
	@echo "  make dev / make stack - browser only, IndexedDB (npm run dev — no Python)"
	@echo "  make local   - full stack: API + Vite (npm run dev:full)"
	@echo "  Supabase + Postgres: npm run dev:supabase"
	@echo "  make frontend        - Vite only (run make backend in another terminal)"
	@echo "  make backend         - FastAPI via backend/.venv (node scripts/run-backend.mjs)"
	@echo "  make install-frontend - npm install inside frontend/"
	@echo "  make install-root    - npm install at repo root (concurrently)"

stack:
	npm run dev

install-root:
	npm install

setup-backend:
	npm run setup:backend

dev: stack

local:
	npm run dev:full

frontend:
	cd frontend && npm run dev

backend:
	npm run backend

install-frontend:
	cd frontend && npm install

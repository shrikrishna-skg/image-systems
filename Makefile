.PHONY: help dev frontend backend stack install-frontend install-root

help:
	@echo "Targets:"
	@echo "  make stack           - API + Vite together (needs: make install-root once)"
	@echo "  make dev             - Vite only (needs: make backend in another terminal)"
	@echo "  make backend         - FastAPI on http://127.0.0.1:8000"
	@echo "  make install-frontend - npm install inside frontend/"
	@echo "  make install-root    - npm install at repo root (for dev:all / stack)"
	@echo ""
	@echo "Fix ECONNREFUSED 127.0.0.1:8000: run make backend OR make stack."

stack:
	npm run dev:all

install-root:
	npm install

dev: frontend

frontend:
	cd frontend && npm run dev

backend:
	cd backend && python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

install-frontend:
	cd frontend && npm install

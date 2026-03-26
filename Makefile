.PHONY: help dev frontend backend install-frontend

help:
	@echo "Targets:"
	@echo "  make dev             - Start Vite (same as: cd frontend && npm run dev)"
	@echo "  make backend         - Start FastAPI on http://127.0.0.1:8000"
	@echo "  make install-frontend - npm install inside frontend/"
	@echo ""
	@echo "Uploads need BOTH: make backend (terminal 1) and make dev (terminal 2)."

dev: frontend

frontend:
	cd frontend && npm run dev

backend:
	cd backend && python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

install-frontend:
	cd frontend && npm install

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Karpathy's AI Coding Principles
Follow these rules strictly for all code generation, edits, refactors, and explanations:
1.Think First, Code Later
 Clarify ambiguous requirements before writing code. State assumptions explicitly. Do not guess requirements or invent unrequested features. Propose options when unclear, wait for confirmation.

2.Simplicity Over Engineering
 Build the simplest working solution that meets the current need. Avoid over-engineering, unnecessary abstraction, premature optimization, and future-proofing that is not required. Keep code minimal and readable.

3.Surgical Only Changes
 Modify only code directly related to the task. Do not reformat unrelated code, rename variables arbitrarily, fix style issues, or refactor untouched logic unless explicitly requested. Preserve existing comments and unrelated implementation.
4.Goal-Driven & Verifiable
Define clear success criteria. Deliver working, testable results. When applicable, include basic test cases to verify correctness. Focus on solving the stated problem completely, not adding extra features.
4.全部用中文回答问题。


## Project Overview

AssetHub is an enterprise asset management system with full lifecycle asset management capabilities and AI-powered conversational interface. The system uses a React frontend with a Node.js/Express backend and MySQL database.

## Commands

```bash
# Development (runs both frontend and backend)
npm run dev

# Frontend only (port 5173)
npm run dev:frontend

# Backend only (port 5183)
npm run dev:backend

# Build frontend
npm run build

# Run tests
npm test

# Docker deployment
docker-compose up -d        # Start services
docker-compose build       # Rebuild images
docker-compose down        # Stop services

# Backend logs
docker logs assetrob-backend -f
```

## Architecture

### Frontend (React + Vite)
- Location: `frontend/`
- Port: 5173 (dev), served via nginx in production (port 80)
- UI Library: Ant Design 6.1
- 112 page components in `frontend/src/pages/`
- API client in `frontend/src/api/` with domain-based organization

### Backend (Express.js)
- Location: `backend/`
- Entry point: `backend/server.js`
- Port: 5183
- Modular architecture with business logic in `backend/modules/`

### Backend Module Structure
Each module in `backend/modules/` follows a consistent pattern:
```
module-name/
├── config/module.config.js    # Module configuration
├── controllers/               # Request handlers
├── routes/                    # API route definitions
└── services/                 # Business logic
```

Key modules include: `asset-management`, `user-management`, `department-management`, `maintenance-management`, `inventory-management`, `quality-control`, `procurement-management`, and more (36 modules total).

### Database
- MySQL 8 at `192.168.1.111:3306` (configurable via `backend/.env`)
- Redis for caching (graceful fallback to in-memory cache if unavailable)
- Key tables: `users`, `departments`, `assets`, `maintenance_requests`, `maintenance_work_orders`, `quality_control_records`, etc.

### Microservices (under development)
- Location: `microservices/`
- Individual services: `api-gateway`, `auth-service`, `asset-service`, `user-service`, etc.
- Shared code in `microservices/shared/`

## Authentication & Multi-tenancy

### JWT Authentication
```bash
curl -H "Authorization: Bearer <token>" http://localhost:5183/api/...
```

### Tenant Isolation
```bash
curl -H "X-Tenant-ID: <tenant_id>" http://localhost:5183/api/...
```

### Idempotency
For POST/PUT/DELETE requests, include an idempotency key:
```bash
curl -H "Idempotency-Key: <uuid>" ...
```

## Key Configuration Files

| File | Purpose |
|------|---------|
| `backend/.env` | Database, Redis, app configuration |
| `backend/.env.sms` | SMS notification settings |
| `frontend/vite.config.js` | Vite dev server, proxy config |
| `docker-compose.yml` | Container orchestration |
| `frontend/nginx/default.conf` | Nginx config for production frontend |

## API Documentation

- Backend API docs: `backend/API_DOCUMENTATION.md`
- Routes structure in `backend/routes/` (64 route files)
- Route registration in `backend/server.js`

## Common Patterns

### Adding a New Module
1. Create module directory in `backend/modules/`
2. Follow the controller/routes/service structure
3. Register routes in `backend/server.js`
4. Add frontend pages in `frontend/src/pages/`
5. Add API client functions in `frontend/src/api/domains/`

### Status Field Conventions
- Assets: `在用` (in use), `维修中` (maintenance), `闲置` (idle), `报废` (scrapped)
- Work orders: `pending`, `assigned`, `in_progress`, `pending_acceptance`, `completed`, `cancelled`
- Users: `active`, `inactive`, `disabled`

## Docker Network

Services communicate via Docker internal DNS:
- Frontend nginx proxies to `assetrob-backend:5183`
- `resolver 127.0.0.11` in nginx config for Docker DNS

## Recent Changes

The following issues were recently fixed:
- Department deletion logic now uses `department_code` instead of `department_name` for asset association
- Department code generation now supports more than 999 departments (6-digit sequence)
- User list now properly filters by `status` parameter
- Cross-tenant access protection added to `getUserById`
- User deletion now checks for related work orders and assets
- Work order updates now use transactions for data consistency
- QC and metrology record number generation now uses database sequences instead of in-memory counters

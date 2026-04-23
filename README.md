# Investor Finance Tracker System (IFTS)

Full-stack web application for Ethiopian investors with multi-company portfolio management.

## Current Project Status
- Unified authenticated UI theme (light/dark) across dashboard, companies, transactions, investments, approvals, reports, audit logs, and settings.
- Role-gated company management and approval workflows are enabled.
- Frontend production build is passing.

## Tech Stack
- Backend: Node.js, Express, Mongoose (MongoDB), JWT, bcrypt, express-validator, Swagger
- Frontend: React (Vite), Redux Toolkit, Tailwind CSS, Recharts, jsPDF, xlsx

## Quick Start
1. Copy `.env.example` to `.env` and set values.
2. Backend:
   - Install deps: `cd backend && npm install`
   - Seed sample data: `npm run seed`
   - Start dev: `npm run dev`
3. Frontend:
   - Install deps: `cd frontend && npm install`
   - Start dev: `npm run dev`

API docs at `/api/docs` when backend is running.

## Environment Notes
- Run backend and frontend in separate terminals.
- If backend code changes do not appear in the UI, restart backend (`cd backend && npm run dev`).
- Ensure frontend API base URL matches backend host/port in environment config.
- Local development uses MongoDB at `mongodb://127.0.0.1:27017/IFTS`.

## Scripts
- Backend: `npm run dev`, `npm run start`, `npm run migrate`, `npm run seed`
- Frontend: `npm run dev`, `npm run build`, `npm run preview`

## Authenticated App Pages
- Dashboard: consolidated metrics, chart summaries, and company-aware views.
- Companies: directory, profile, and admin-only create/edit workflow.
- Transactions: create/edit flow with filters, pagination, and approval-state awareness.
- Investments: portfolio tracking, metrics, and calculation preview.
- Approvals: queue + detail decision flow (approve/reject with rationale).
- Reports: generated reports and profit/loss reporting views.
- Audit Logs and Settings: operational controls and platform auditability.

## Theming And UI System
- Authenticated pages use CSS variable tokens defined in `frontend/src/styles/tailwind.css`.
- Core tokens include `--panel`, `--panel-strong`, `--card-border`, `--text-primary`, and `--muted-foreground`.
- Light/dark mode is handled globally through the app shell and shared page styles.
- For new internal pages, prefer token-based classes over hardcoded `white/slate` palettes.

## Approvals & Thresholds
- Each company has an `approvalThreshold`; transactions at or above this amount are created as `pending` and generate an approval record.
- Approvals are limited to company members. Decisions update the linked transaction status.
- Manage approvals in the app under Approvals; transaction lists indicate whether approval is required.

## Operational Notes
- Company creation/editing requires admin access.
- Dashboard/report summaries rely on company context; when no context exists, APIs return safe defaults.
- Transaction creation supports optional investment linkage and validates status/amount rules on the backend.

## Database
- MongoDB models in `backend/src/models/mongoModels.js`
- Local database name: `IFTS`

## Sample Accounts
- Email: `admin@ifts.test` / Password: `Password123!`
- Email: `manager@ifts.test` / Password: `Password123!`

## Verification Commands
- Frontend build: `npm run build --prefix frontend`
- Frontend diagnostics (in VS Code): Problems panel or `get_errors` tooling

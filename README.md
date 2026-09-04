# OpsFlow — Mini Operations ERP

OpsFlow is a production-oriented mini ERP for a practical operations workflow: inventory visibility, material shortages on work orders, internal stock transfers, and customer-order reservations. The client calls a REST API; business rules, authorization, audit records, and concurrency controls live on the server and PostgreSQL.

## Features

- JWT login with bcrypt password verification and `ADMIN`, `OPERATIONS_USER`, and `SALES_USER` roles.
- Inventory by item, location, and batch with physical, reserved, and computed available quantities.
- Immutable inventory transaction/audit records for stock-ins, adjustments, dispatches, receipts, and reservations.
- Admin-created work orders with a live material availability, shortage, and alternate-source view.
- Requested → dispatched → received internal transfers with atomic stock movement.
- Multi-line customer orders with all-or-nothing stock reservation.
- Professional React operations UI: responsive sidebar, loading/empty/error states, filters, validation, confirmation dialogs, and toast feedback.
- Swagger UI at `/api/docs`.

## Architecture

```text
React + TanStack Query
        │ HTTPS / JSON
Express route → controller → service → Prisma/repository → PostgreSQL
                                      │
                           validation · RBAC · transactions · audit
```

The frontend owns presentation and server-state caching only. Express controllers remain small; services contain the business rules. `InventoryRepository` centralizes the PostgreSQL `SELECT … FOR UPDATE` locks used by stock-changing workflows.

## Tech stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form, Zod, Axios, Lucide.
- Backend: Node.js, Express 5, TypeScript, Prisma, PostgreSQL, JWT, bcrypt, Zod, Swagger UI.
- Tests: Vitest and Supertest against a real PostgreSQL test database.
- Local infrastructure: Docker Compose / PostgreSQL 16.

## Project structure

```text
frontend/                 React application
backend/src/
  controllers/            HTTP boundary
  services/               business workflows
  repositories/           row-locking data access
  middleware/             auth, RBAC, errors, request context
  validators/             Zod request contracts
backend/prisma/           schema, migration, idempotent seed
backend/tests/            PostgreSQL API integration tests
```

## Prerequisites

- Node.js 20+ (Node 24 was used during development)
- npm 10+
- PostgreSQL 16+ or Docker Desktop

## Installation

```bash
npm install
Copy-Item backend/.env.example backend/.env
# Start PostgreSQL with Docker (or set DATABASE_URL to your own server)
docker compose up -d
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

The app starts at [http://localhost:5173](http://localhost:5173); the API is at `http://localhost:4000`.

Useful commands:

```bash
npm run dev          # API + web client
npm run build        # Prisma generation + TypeScript + Vite production build
npm test             # PostgreSQL integration suite (requires TEST_DATABASE_URL)
npm run prisma:migrate
npm run prisma:seed
```

## Environment variables

Use `backend/.env.example` as the server template.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection URL |
| `JWT_SECRET` | Long secret used to sign bearer tokens |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `8h` |
| `PORT` | API port (default `4000`) |
| `CLIENT_URL` | Allowed frontend origin |
| `NODE_ENV` | `development`, `test`, or `production` |

Never commit a populated `.env` file.

## Demo accounts

All seeded accounts use the password `OpsFlow!2026`.

| Role | Email |
| --- | --- |
| Admin | `admin@opsflow.demo` |
| Operations User | `operations@opsflow.demo` |
| Sales User | `sales@opsflow.demo` |

The seed includes three warehouses and distribution deliberately arranged so that `WO-DEMO-1001` has a steel-component shortage in `WH-A` and an alternate source in `WH-B`.

## API documentation

When the API is running, visit [http://localhost:4000/api/docs](http://localhost:4000/api/docs). It documents authentication, response formats, key request bodies, role-protected endpoints, and business errors.

All API responses use a consistent envelope:

```json
{ "success": true, "data": {} }
```

```json
{ "success": false, "error": { "code": "INSUFFICIENT_STOCK", "message": "Insufficient available inventory." } }
```

## Database / ER diagram

```mermaid
erDiagram
  Role ||--o{ User : grants
  Category ||--o{ Item : groups
  Item ||--o{ Inventory : stocked_as
  Location ||--o{ Inventory : holds
  Inventory ||--o{ InventoryTransaction : audited_by
  User ||--o{ InventoryTransaction : creates
  Location ||--o{ WorkOrder : hosts
  User ||--o{ WorkOrder : assigned
  WorkOrder ||--|{ WorkOrderMaterial : needs
  Item ||--o{ WorkOrderMaterial : material
  Item ||--o{ Transfer : moves
  Location ||--o{ Transfer : source_destination
  Customer ||--o{ CustomerOrder : places
  Location ||--o{ CustomerOrder : fulfills
  CustomerOrder ||--|{ CustomerOrderItem : contains
  Item ||--o{ CustomerOrderItem : requests
  CustomerOrderItem ||--o| Reservation : protected_by
  Inventory ||--o{ Reservation : reserved_from
  User ||--o{ Reservation : reserves
```

`Inventory` has a unique `(itemId, locationId, batch)` key. PostgreSQL constraints enforce non-negative physical and reserved values and require `reservedQuantity <= physicalQuantity`; the migration also enforces positive transfer, reservation, work-order-material, and order-line quantities.

## Business rules and concurrency

### Available inventory

`availableQuantity = physicalQuantity - reservedQuantity`. It is calculated for API output and never stored as a stale duplicate.

### Reservation

`POST /api/orders/:id/reserve` locks the customer order, locks every needed inventory row in deterministic item/batch order, checks every line, increments `reservedQuantity`, creates `Reservation` and `InventoryTransaction` records, then marks the order `RESERVED`. Any shortage throws `INSUFFICIENT_STOCK`, rolling back the full transaction—there are no partial reservations.

### Transfers

- `REQUESTED`: validation only; no stock moves.
- `DISPATCHED`: a locked source row is checked again and its **physical** quantity decreases. The destination does not change.
- `RECEIVED`: only a locked, dispatched transfer may be received. The destination inventory is incremented and the transfer becomes `RECEIVED` in the same transaction.

A received transfer returns `TRANSFER_ALREADY_RECEIVED` on a second receipt and cannot increase stock twice.

### Race-condition strategy

Reservation and transfer stock mutations use PostgreSQL `SELECT … FOR UPDATE` inside serializable Prisma transactions. Checks occur after acquiring the lock. The transaction wrapper retries PostgreSQL serialization conflicts (`P2034`) up to three times, re-running the check in a fresh transaction. This prevents competing requests from collectively consuming more than the physical inventory.

## Testing

The suite is intentionally integration-focused: it talks to Express and a real PostgreSQL database, not a mocked repository. It exercises invalid login and unauthenticated access, hash verification, RBAC, over-reservation, transfer availability, dispatch/receipt timing, duplicate receipt, work-order shortage, and concurrent reservations.

Run with an isolated test database:

```powershell
$env:TEST_DATABASE_URL = "postgresql://opsflow:opsflow@localhost:5432/opsflow_test?schema=public"
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npm run prisma:migrate
npm test
```

The test file is safely skipped when `TEST_DATABASE_URL` is absent, so routine installs do not point destructive test cleanup at a developer database.

## Production considerations

- Use a managed PostgreSQL instance, unique JWT secret, TLS, and environment-managed secrets.
- Put the API behind HTTPS and configure `CLIENT_URL` precisely.
- Add request rate limiting, structured log shipping, health monitoring, and backups for a production deployment.
- Keep Prisma migrations reviewed and run them in CI/CD before application rollout.
- The domain model can support later extensions such as damaged stock, partial receipts, cancellation/release of reservations, and user/location scoping without changing UI contracts.


## Deployment

See `DEPLOYMENT.md` for Docker production-style deployment and separate frontend/backend hosting. Do not commit real `.env` secrets.

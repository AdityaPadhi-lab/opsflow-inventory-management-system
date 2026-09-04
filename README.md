<<<<<<< HEAD
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
=======
# OpsFlow — Inventory & Operations Management System

<p align="center">
  <strong>A production-oriented inventory and operations platform for managing stock, reservations, transfers, work orders, and customer orders.</strong>
</p>

<p align="center">
  <img src="./docs/screenshots/dashboard.png" alt="OpsFlow Dashboard" width="900">
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#project-flow">Project Flow</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a>
</p>

---

## Overview

**OpsFlow** is a full-stack inventory and operations management system designed around real-world warehouse and operational workflows.

The platform provides centralized visibility into inventory across locations while enforcing business rules around stock availability, reservations, transfers, and operational work orders.

The system is built with a modern TypeScript stack and a relational PostgreSQL database, with a clear separation between the frontend, backend API, business services, validation, and persistence layers.

---

## ✨ Features

### 📦 Inventory Management

* Multi-location inventory tracking
* Batch-level inventory
* Physical quantity tracking
* Reserved quantity tracking
* Real-time available quantity
* Inventory search and filtering
* Stock-in transactions
* Inventory adjustments
* Inventory transaction audit trail
* Protection against negative available inventory

### 🔄 Inventory Transfers

* Create stock transfer requests
* Source and destination locations
* Transfer lifecycle tracking
* Dispatch workflow
* Receipt workflow
* Inventory movement auditing

### 🧾 Customer Orders

* Customer management
* Customer order creation
* Order item management
* Inventory reservation
* Reservation release
* Location-aware order processing

### 🛠️ Work Orders

* Work order creation
* User assignment
* Location association
* Required material tracking
* Work order status management

### 👥 Role-Based Access

Supported roles:

* `ADMIN`
* `OPERATIONS_USER`
* `SALES_USER`

Permissions are enforced at the API layer rather than relying only on frontend visibility.

### 📊 Operational Dashboard

* Inventory overview
* Stock availability
* Operational metrics
* Location-level visibility
* Workflow status indicators

---

# 🖥️ Screenshots

## Dashboard

<p align="center">
  <img src="./docs/screenshots/dashboard.png" alt="OpsFlow dashboard" width="900">
</p>

## Inventory

<p align="center">
  <img src="./docs/screenshots/inventory.png" alt="OpsFlow inventory management screen" width="900">
</p>

## Stock In

<p align="center">
  <img src="./docs/screenshots/stock-in.png" alt="OpsFlow stock-in workflow" width="900">
</p>

## Transfers

<p align="center">
  <img src="./docs/screenshots/transfers.png" alt="OpsFlow transfer management" width="900">
</p>

## Work Orders

<p align="center">
  <img src="./docs/screenshots/work-orders.png" alt="OpsFlow work orders" width="900">
</p>

---

# 🏗️ Architecture

```mermaid
flowchart TB

    User["👤 User"]

    subgraph Frontend["Frontend"]
        UI["React UI"]
        RQ["TanStack Query"]
        APIClient["Axios API Client"]
    end

    subgraph Backend["Backend API"]
        Routes["Express Routes"]
        Auth["Authentication & Authorization"]
        Validation["Zod Validation"]
        Controllers["Controllers"]
        Services["Business Services"]
        Errors["Error Handler"]
    end

    subgraph Data["Data Layer"]
        Prisma["Prisma ORM"]
        PostgreSQL[("PostgreSQL")]
    end

    User --> UI
    UI --> RQ
    RQ --> APIClient
    APIClient --> Routes

    Routes --> Auth
    Auth --> Validation
    Validation --> Controllers
    Controllers --> Services
    Services --> Prisma
    Prisma --> PostgreSQL

    Services --> Errors
```

---

# 🔄 Project Flow

OpsFlow follows a layered request flow:

```mermaid
flowchart LR

    A["User Action"]
    B["React UI"]
    C["React Query"]
    D["Axios"]
    E["Express API"]
    F["Auth / RBAC"]
    G["Zod Validation"]
    H["Controller"]
    I["Service Layer"]
    J["Prisma"]
    K[("PostgreSQL")]

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H --> I
    I --> J
    J --> K

    K --> J
    J --> I
    I --> H
    H --> E
    E --> D
    D --> C
    C --> B
```

---

# 📦 Inventory Flow

The core inventory workflow is designed around physical stock, reservations, and available stock.

```mermaid
flowchart TD

    StockIn["Stock In"]
    Physical["Physical Quantity"]
    Reservation["Customer Reservation"]
    Reserved["Reserved Quantity"]
    Available["Available Quantity"]
    Transfer["Transfer"]
    Adjustment["Inventory Adjustment"]
    Audit["Inventory Transaction"]

    StockIn --> Physical
    Physical --> Available

    Reservation --> Reserved
    Reserved --> Available

    Transfer --> Physical
    Adjustment --> Physical

    StockIn --> Audit
    Reservation --> Audit
    Transfer --> Audit
    Adjustment --> Audit

    Available --> Rule{"Available >= 0?"}

    Rule -- "Yes" --> Valid["Transaction Allowed"]
    Rule -- "No" --> Reject["Transaction Rejected"]
```

### Inventory calculation

```text
Available Quantity
    =
Physical Quantity
    -
Reserved Quantity
```

The backend is responsible for enforcing inventory business rules so that clients cannot simply manipulate available stock from the frontend.

---

# 🔐 Authentication Flow

```mermaid
sequenceDiagram

    participant U as User
    participant F as Frontend
    participant A as API
    participant Auth as Auth Middleware
    participant DB as PostgreSQL

    U->>F: Enter credentials
    F->>A: POST /api/auth/login
    A->>DB: Verify user
    DB-->>A: User + password hash
    A-->>F: JWT token
    F->>F: Store authentication token

    U->>F: Perform protected action
    F->>A: API request + Bearer token
    A->>Auth: Validate token
    Auth-->>A: Authorized user
    A->>DB: Execute operation
    DB-->>A: Result
    A-->>F: JSON response
```

---

# 🧩 Domain Model

```mermaid
erDiagram

    ROLE ||--o{ USER : has

    CATEGORY ||--o{ ITEM : contains

    ITEM ||--o{ INVENTORY : stored_as
    LOCATION ||--o{ INVENTORY : contains

    INVENTORY ||--o{ INVENTORY_TRANSACTION : records
    USER ||--o{ INVENTORY_TRANSACTION : creates

    USER ||--o{ WORK_ORDER : assigned
    LOCATION ||--o{ WORK_ORDER : contains
    WORK_ORDER ||--o{ WORK_ORDER_MATERIAL : requires
    ITEM ||--o{ WORK_ORDER_MATERIAL : used_in

    ITEM ||--o{ TRANSFER : moved
    LOCATION ||--o{ TRANSFER : source
    LOCATION ||--o{ TRANSFER : destination

    CUSTOMER ||--o{ CUSTOMER_ORDER : places
    CUSTOMER_ORDER ||--o{ CUSTOMER_ORDER_ITEM : contains
    ITEM ||--o{ CUSTOMER_ORDER_ITEM : ordered

    CUSTOMER_ORDER_ITEM ||--o| RESERVATION : creates
    INVENTORY ||--o{ RESERVATION : reserves
    USER ||--o{ RESERVATION : creates
```

---

# 🛠️ Tech Stack

## Frontend

* React
* TypeScript
* Vite
* TanStack Query
* Axios
* Tailwind CSS
* Lucide React

## Backend

* Node.js
* TypeScript
* Express
* Zod
* JWT authentication
* Service/controller architecture

## Database

* PostgreSQL
* Prisma ORM

## Development

* npm
* tsx
* Prisma CLI
* Environment-based configuration

---

# 📁 Project Structure

```text
opsflow-inventory-management-system/
│
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   │
│   └── src/
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       ├── services/
│       ├── validators/
│       ├── server.ts
│       └── ...
│
├── frontend/
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       ├── services/
│       ├── types/
│       └── ...
│
├── docs/
│   └── screenshots/
│       ├── dashboard.png
│       ├── inventory.png
│       ├── stock-in.png
│       ├── transfers.png
│       ├── work-orders.png
│       └── orders.png
│
├── .gitignore
├── README.md
└── package.json
```

---

# 🚀 Getting Started

## Prerequisites

Make sure you have installed:

* Node.js 20+
* npm
* PostgreSQL

Verify:

```bash
node --version
npm --version
psql --version
```

---

## 1. Clone the repository

```bash
git clone https://github.com/<your-username>/opsflow-inventory-management-system.git

cd opsflow-inventory-management-system
```

---

## 2. Install dependencies

```bash
npm install
```

If frontend and backend have separate package files:

```bash
cd backend
npm install

cd ../frontend
npm install
```

---

## 3. Configure environment variables

Create:

```text
backend/.env
```

Example:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/opsflow"
JWT_SECRET="replace-with-a-secure-secret"
PORT=4000
NODE_ENV="development"
```

For the frontend:

```env
VITE_API_URL=http://localhost:4000/api
```

> Never commit real credentials, JWT secrets, database passwords, or production environment files.

---

## 4. Setup the database

From the backend directory:

```bash
npx prisma migrate deploy
```

Generate the Prisma client:

```bash
npx prisma generate
```

Validate the schema:

```bash
npx prisma validate
```

Check migration status:

```bash
npx prisma migrate status
```

---

## 5. Start the backend

```bash
cd backend
npm run dev
```

The API runs on:

```text
http://localhost:4000
```

---

## 6. Start the frontend

In another terminal:

```bash
cd frontend
npm run dev
```

Vite will provide the local frontend URL.

---

# 🔌 API Overview

The backend exposes REST APIs for the major operational domains.

| Domain         | Endpoint           | Purpose                        |
| -------------- | ------------------ | ------------------------------ |
| Authentication | `/api/auth`        | Login and authentication       |
| Inventory      | `/api/inventory`   | Stock and inventory operations |
| Items          | `/api/items`       | Item master data               |
| Locations      | `/api/locations`   | Location master data           |
| Categories     | `/api/categories`  | Category master data           |
| Transfers      | `/api/transfers`   | Inventory movement             |
| Orders         | `/api/orders`      | Customer orders                |
| Work Orders    | `/api/work-orders` | Operational work orders        |

Protected endpoints require:

```http
Authorization: Bearer <JWT_TOKEN>
```

---

# 🧠 Business Rules

OpsFlow intentionally keeps important business logic in the backend.

Examples include:

* Available inventory cannot become negative.
* Reservations affect available quantity.
* Inventory changes create transaction records.
* Inventory is tracked by item, location, and batch.
* Role permissions are enforced server-side.
* Foreign-key relationships protect data integrity.
* Destructive relationships use restrictive delete behavior where appropriate.
* Inventory movements are auditable.

---

# 🧪 Validation & Verification

Useful backend checks:

```bash
npx prisma validate
```

```bash
npx prisma migrate status
```

```bash
npm run dev
```

Example API verification:

```powershell
$login = Invoke-RestMethod `
  -Uri "http://localhost:4000/api/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"email":"admin@opsflow.demo","password":"your-password"}'

$token = $login.data.token
```

Then:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:4000/api/items" `
  -Method GET `
  -Headers @{ Authorization = "Bearer $token" }
```

---

# 🎯 Design Goals

OpsFlow is designed around several principles:

### 1. Business logic belongs in the backend

The frontend should present workflows, not enforce critical business rules.

### 2. Inventory should be auditable

Every meaningful inventory mutation should have a corresponding transaction record.

### 3. Data integrity matters

Relational constraints and service-layer validation work together to prevent inconsistent operational data.

### 4. Clear domain boundaries

Inventory, orders, transfers, work orders, users, and master data are separated into understandable domains.

### 5. Production-oriented architecture

The project is structured so that authentication, validation, controllers, services, persistence, and frontend state management can evolve independently.

---

# 🔮 Future Improvements

Potential next iterations include:

* Advanced inventory analytics
* Barcode / QR scanning
* Purchase orders
* Supplier management
* Low-stock alerts
* Email notifications
* CSV import/export
* Inventory cycle counting
* Approval workflows
* Comprehensive automated tests
* Docker-based deployment
* CI/CD pipeline
* Production observability
* Audit-log viewer
* Advanced reporting

---

# 🤝 Contributing

Contributions, suggestions, and improvements are welcome.

1. Fork the repository.
2. Create a feature branch.

```bash
git checkout -b feature/your-feature
```

3. Make your changes.
4. Validate the application.
5. Commit your changes.

```bash
git commit -m "feat: add your feature"
```

6. Push the branch.

```bash
git push origin feature/your-feature
```

7. Open a pull request.

---

# 📄 License

This project is currently provided for educational, portfolio, and development purposes.

Add an explicit open-source license if you intend to allow redistribution or modification.

---

# 👨‍💻 Author

**Aditya Padhi**

Built with TypeScript, React, Node.js, PostgreSQL, and Prisma.

---

<p align="center">
  <strong>OpsFlow — turning operational complexity into a structured workflow.</strong>
</p>
>>>>>>> 4c3c6b96a565212ef11d21647fa1b667b2013e69

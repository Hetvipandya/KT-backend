# Kevalon Unified Backend (KT HRMS + Finance ERP)

A unified Node.js/Express and MongoDB backend merging Kevalon KT HRMS & Kevalon Finance ERP into a single high-performance application.

---

## Features

### KT HRMS & CRM
- **User & Employee Management**: Multi-role onboarding, permissions, department allocations.
- **Attendance & Geofencing**: Live punch tracking, radius validation, time adjustment requests.
- **Leave Management**: Balances, approvals, policy calculations.
- **Payroll**: Dynamic salary structures, monthly payslips.
- **CRM & Project Pipeline**: Leads, customer milestones, task assignments, deliverables.
- **Notifications**: Cross-platform FCM push notifications and in-app alerts.

### Kevalon Finance ERP
- **Multi-Company & Branch Accounting**: Organization hierarchies with isolated financial years.
- **Chart of Accounts & Ledgers**: Hierarchical COA with automatic debit/credit journal posting.
- **Sales & Purchases**: GST invoices, purchase orders, credit/debit notes, PDF generation.
- **Banking**: Bank transfers, statement reconciliation, payment processing.
- **Approvals & Auditing**: Multi-tier approval thresholds and immutable security audit logs.
- **Reports**: Instant P&L, Balance Sheet, Trial Balance, GSTR-1, GSTR-3B tax calculations.

---

## Getting Started

### 1. Installation
```bash
cd KT-BACKEND
npm install
```

### 2. Environment Setup
Create or verify `.env` in `KT-BACKEND/`:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
```

### 3. Run Locally
```bash
npm run dev
```

### 4. Production Start
```bash
npm start
```

---

## Documentation
- [MERGE_ANALYSIS.md](./MERGE_ANALYSIS.md): Comprehensive merge and architecture analysis.
- [ROUTE_MAP.md](./ROUTE_MAP.md): Full listing of all available endpoints.
- [API_COMPATIBILITY.md](./API_COMPATIBILITY.md): Compatibility details for KT and FIN frontends.

## Real-time notifications
Socket.IO is served on the same HTTP origin and default `/socket.io` path as the REST API.
Connect with `auth: { token: '<JWT>' }`; the server validates the existing access token and
resolves its canonical `User._id`. It joins only that user's private `employee:<User._id>`
room; clients cannot choose rooms. After a user-owned notification is saved, the server
emits `notification:new` with `{ notificationId: '<saved Mongo _id>' }`. The existing
FCM delivery remains independent.

Admin and HR announcement creation supports all users, a role, selected employees, or
selected departments. Targeted announcements create user-owned notification records so
the existing notification list, unread count, Socket.IO delivery, and FCM delivery are
restricted to the selected recipients. Announcement write and recipient-lookup endpoints
require an authenticated admin or HR session.

## Scaling behind Nginx

The Nginx example at [deployment/nginx/kevalon-backend.conf](./deployment/nginx/kevalon-backend.conf)
balances API requests across two local backend processes and keeps Socket.IO polling
sessions on one process. Adapt the upstream addresses and merge the `server` block with
the existing TLS configuration for your API hostname.

Run both processes against the same MongoDB and Redis services. Configure
`REDIS_URL` and `SOCKET_REDIS_REQUIRED=true` on **every** backend process so
Socket.IO notifications are shared across instances. Keep
`RUN_STARTUP_MAINTENANCE=true` on exactly one process and set it to `false` on
the others; this keeps index maintenance, reconciliation, payslip sync, geofence
recovery, and the attendance scheduler from running repeatedly. The default is
`true` for a single-instance deployment.

MongoDB connection pools default to a maximum of 50 connections per process
(minimum 0), with up to 2 new connections being opened at a time. Requests waiting
for a pool connection time out after 10 seconds by default. Configure
`MONGO_MAX_POOL_SIZE`, `MONGO_MIN_POOL_SIZE`, and `MONGO_WAIT_QUEUE_TIMEOUT_MS`
when the database connection limit or expected request concurrency calls for
different values. Keep the minimum at or below the maximum, and account for the
pool size across every running backend process.

### Frontend CDN and caching

Build the frontend with `npm run build` in `KT_Employee-main/` and deploy its
`dist/` directory to a static web server. The sample
[deployment/nginx/kevalon-frontend.conf](./deployment/nginx/kevalon-frontend.conf)
sets long-lived immutable caching for Vite's fingerprinted `/assets/` files and
revalidates SPA routes so new deployments take effect promptly. Replace its
hostname and document root with your deployment values, and terminate TLS at
your load balancer or CDN.

For Cloudflare, proxy the frontend hostname and cache only its `/assets/*`
files, respecting the origin cache headers. Keep HTML revalidated. Set cache
bypass for `/api/*`, `/socket.io/*`, and `/uploads/*`; never use a
"Cache Everything" rule on the API hostname or authenticated responses.
The API Nginx config disables proxy/CDN caching and returns `private, no-store`.
New managed files already use Cloudinary delivery; keep those on their
Cloudinary URLs rather than routing them through the application API.

The frontend's short-lived API response cache is browser-local and partitioned
by the authenticated token. It is intentionally not an edge/shared cache:
HR, payroll, attendance, and finance responses can contain user- or
company-specific data. Cache entries are capped to prevent unbounded memory use.

Backend request logs are limited to requests taking at least one second or
returning a server error, reducing per-request log I/O and collector volume.
Employee dashboard birthday data is cached per process and its cache miss now
looks up only employees linked to active users using indexed user ID fields.
Employee user ID and email indexes also speed up the per-request employee status
lookup during authentication. These indexes are created by the designated
startup-maintenance instance.

Example process settings:

```sh
PORT=5000 REDIS_URL=redis://127.0.0.1:6379 SOCKET_REDIS_REQUIRED=true RUN_STARTUP_MAINTENANCE=true npm start
PORT=5001 REDIS_URL=redis://127.0.0.1:6379 SOCKET_REDIS_REQUIRED=true RUN_STARTUP_MAINTENANCE=false npm start
```

If legacy files are served from `/uploads`, both processes must see the same
`uploads` directory (for example, through a shared mount). New managed uploads
use Cloudinary. If the maintenance instance is stopped, move
`RUN_STARTUP_MAINTENANCE=true` to another instance before expecting scheduled
attendance jobs to run.

## MongoDB sharding

See [deployment/mongodb/sharding-runbook.md](./deployment/mongodb/sharding-runbook.md)
for the Atlas sharding plan, read-only readiness checks, eligible Finance
collections, and the HRMS tenant-data migration prerequisites. The application
uses the standard MongoDB driver through the configured Atlas `mongos` URI; the
readiness script does not change production data or shard collections.

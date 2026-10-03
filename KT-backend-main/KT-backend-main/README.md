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

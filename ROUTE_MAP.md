# COMPLETE ROUTE MAP — UNIFIED KT + FINANCE BACKEND

## Health & System
| Method | Endpoint | Source | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | KT / FIN | Server health and greeting status |
| `GET` | `/health` | FIN | Lightweight health ping |
| `GET` | `/api/ping` | FIN | Ping endpoint for keep-alive |
| `GET` | `/reset-password` | KT | Web reset password form rendering |

---

## Authentication & User Management
| Method | Endpoint | Source | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | FIN | Register company owner |
| `POST` | `/api/auth/login` | FIN | Login with credentials / 2FA check |
| `POST` | `/api/auth/refresh` | FIN | Refresh JWT access token |
| `POST` | `/api/auth/logout` | FIN | Logout and revoke refresh session |
| `POST` | `/api/auth/forgot-password` | FIN | Request password reset email |
| `POST` | `/api/auth/reset-password` | FIN | Complete password reset |
| `GET` | `/api/auth/me` | FIN | Current user profile |
| `POST` | `/api/users/register` | KT | Register KT user / employee |
| `POST` | `/api/users/login` | KT | Login KT user |
| `GET` | `/api/users/profile` | KT | Get KT profile |
| `PUT` | `/api/users/profile` | KT | Update KT profile |
| `POST` | `/api/users/forgot-password` | KT | Send OTP for password reset |
| `POST` | `/api/users/verify-otp` | KT | Verify password reset OTP |
| `POST` | `/api/users/reset-password` | KT | Reset password with OTP/token |
| `POST` | `/api/user/invite` | FIN | Invite user to company |
| `GET` | `/api/user` | FIN | List company users |
| `GET` | `/api/user/:id` | FIN | Get user details |
| `PUT` | `/api/user/:id` | FIN | Update user company access |

---

## HRMS, Attendance, Leave & Payroll (KT)
| Method | Endpoint | Source | Description |
| :--- | :--- | :--- | :--- |
| `POST/GET` | `/api/attendance/*` | KT | Clock-in, clock-out, geofencing, daily records |
| `POST/GET` | `/api/leave/*` | KT | Leave applications, balance calculation, approvals |
| `POST/GET` | `/api/payroll/*` | KT | Salary structures, payslip generation, disbursements |
| `POST/GET` | `/api/employee-panel/*` | KT | Employee portal dashboard, profile, documents |
| `POST/GET` | `/api/performance/*` | KT | Performance reviews and scoring |
| `POST/GET` | `/api/adjustment/*` | KT | Attendance and time adjustments |
| `POST/GET` | `/api/holiday/*` | KT | Organization holiday calendar |
| `POST/GET` | `/api/student/*` | KT | Student training and intern management |
| `POST/GET` | `/api/recruitment/*` | KT | Recruitment pipeline, jobs, applications |
| `POST/GET` | `/api/interviewRound/*` | KT | Interview scheduling and evaluation |

---

## CRM & Project Management (KT)
| Method | Endpoint | Source | Description |
| :--- | :--- | :--- | :--- |
| `POST/GET` | `/api/crm/*` | KT | Lead generation, pipeline stages, conversions |
| `POST/GET` | `/api/project/*` | KT | Project creation, deliverables, assignments |
| `POST/GET` | `/api/projectManage/*` | KT | Project status logs and milestones |
| `POST/GET` | `/api/task/*` | KT | Task assignment, boards, submission |
| `POST/GET` | `/api/dailyUpdate/*` | KT | Daily employee standup reports and comments |
| `POST/GET` | `/api/teamLead/*` | KT | Team lead monitoring and approvals |
| `POST/GET` | `/api/followup/*` | KT | Project and client follow-ups |
| `POST/GET` | `/api/projectAnalytics/*` | KT | Project time tracking and metrics |
| `POST/GET` | `/api/fileManagement/*` | KT | File and version storage |
| `POST/GET` | `/api/milestone/*` | KT | Milestone tracking |
| `POST/GET` | `/api/client/*` | KT | Client accounts and feedback |
| `POST/GET` | `/api/portfolio/*` | KT | Company portfolio management |
| `POST/GET` | `/api/position/*` | KT | Job position definitions |
| `POST/GET` | `/api/contact/*` | KT | General contacts |
| `POST/GET` | `/api/application/*` | KT | Job application submissions |

---

## Accounting & Finance ERP (FIN)
| Method | Endpoint | Source | Description |
| :--- | :--- | :--- | :--- |
| `POST/GET/PUT` | `/api/company/*` | KT & FIN | Company creation, settings, logo uploads |
| `POST/GET/PUT` | `/api/branch/*` | FIN | Branch creation, head office switch |
| `POST/GET/PUT` | `/api/financial-year/*` | FIN | FY setup and lock controls |
| `POST/GET/PUT` | `/api/coa/*` | FIN | Chart of Accounts hierarchy & ledgers |
| `POST/GET/PUT` | `/api/bank-account/*` | FIN | Bank accounts, transfers, reconciliation |
| `POST/GET/PUT` | `/api/customer/*` | FIN | Financial ledger customers, GSTIN/PAN, limits |
| `POST/GET/PUT` | `/api/supplier/*` | FIN | Supplier directory and payment processing |
| `POST/GET/PUT` | `/api/product/*` | FIN | Products, services, HSN/SAC codes, inventory |
| `POST/GET/PUT` | `/api/invoice/*` | FIN | Sales invoices, PDF generation, tax calculations |
| `POST/GET/PUT` | `/api/purchase-order/*`| FIN | Purchase order creation and workflow |
| `POST/GET/PUT` | `/api/purchase/*` | FIN | Purchase bills, stock inward |
| `POST/GET/PUT` | `/api/payment/*` | FIN | Customer receipts & supplier disbursements |
| `POST/GET/PUT` | `/api/journal-entry/*` | FIN | Manual journal vouchers with Dr/Cr balancing |
| `POST/GET/PUT` | `/api/ledger/*` | FIN | General ledger statements and PDF export |
| `POST/GET/PUT` | `/api/credit-note/*` | FIN | Sales credit note issuance |
| `POST/GET/PUT` | `/api/debit-note/*` | FIN | Purchase debit note issuance |
| `POST/GET/PUT` | `/api/tax/*` | FIN | GST rate master configurations |
| `POST/GET/PUT` | `/api/gst/*` | FIN | GSTR-1, GSTR-3B tax computation |
| `POST/GET/PUT` | `/api/gst/return/*` | FIN | GST filing logs |
| `POST/GET/PUT` | `/api/asset/*` | FIN | Fixed assets register & depreciation |
| `POST/GET/PUT` | `/api/salary/*` | FIN | Accounting salary expense bookings |
| `POST/GET/PUT` | `/api/approval/*` | FIN | Multi-tier approval rules and task actions |
| `POST/GET/PUT` | `/api/ca-panel/*` | FIN | Chartered accountant auditor access portal |
| `POST/GET/PUT` | `/api/reports/*` | FIN | P&L, Balance Sheet, Trial Balance, Cashflow |
| `POST/GET/PUT` | `/api/admin/dashboard/*`| FIN | High-level executive dashboard summaries |
| `POST/GET/PUT` | `/api/audit-log/*` | FIN | Immutable security and activity audit logs |

---

## Notifications & FCM
| Method | Endpoint | Source | Description |
| :--- | :--- | :--- | :--- |
| `POST/GET` | `/api/notification/*` | KT | KT notification list and read triggers |
| `POST/GET` | `/api/notifications/*` | KT | KT notification list alias |
| `GET` | `/api/notifications` | FIN | FIN notification feed |
| `GET` | `/api/notifications/unread-count` | FIN | FIN unread count badge |
| `PATCH` | `/api/notifications/:id/read` | FIN | Mark notification read |
| `PATCH` | `/api/notifications/read-all` | FIN | Mark all notifications read |

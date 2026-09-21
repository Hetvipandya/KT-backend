# MERGE ANALYSIS REPORT — KT BACKEND + FIN BACKEND

## Executive Summary
This document details the complete analysis and architectural integration of **KT-BACKEND** (HRMS, CRM, Project Management, Attendance, Payroll) and **FIN-BACKEND** (Accounting ERP, Invoicing, Banking, Tax, GST, Fixed Assets, Approvals) into **ONE UNIFIED KT-BACKEND**.

---

## 1. Architecture Overview
- **Unified Main Project**: `KT-BACKEND/`
- **Server Entry Point**: `KT-BACKEND/server.js`
- **Database Architecture**: Single shared MongoDB connection (`MONGODB_URI` / `MONGO_URI`)
- **Environment Configuration**: Single unified `.env` (`KT-BACKEND/.env`)
- **Third-Party Integrations**: Firebase Admin (FCM), Cloudinary, Nodemailer, Brevo, EmailJS

---

## 2. Inventory of Merged Components

### Models (Unified & Preserved)
| Model | Status | Resolution |
| :--- | :--- | :--- |
| `User.js` | **Unified** | Contains comprehensive profile, HRMS fields, bank details, multi-company access array (`companyAccess`), session refresh tokens, security lockout, and FCM tokens. |
| `Company.js` | **Unified** | Supports single-tenant default company settings (KT) and multi-tenant organization creation/lookup with GSTIN/PAN validation (FIN). |
| `Branch.js` | **Unified** | Supports default branch (KT) and company-scoped branches with head office flag & contact info (FIN). |
| `Department.js` | **Unified** | Supports KT department hierarchy/head and FIN company/branch scoped departments. |
| `Employee.js` | **Unified** | Merges full HRMS employee profiles (salary structure, skills, education, history) with FIN employee codes and emergency contacts. |
| `Role.js` | **Unified** | Supports KT role definitions & Permission references alongside FIN 15-module permission matrices. |
| `Expense.js` | **Unified** | Supports KT employee travel/project expense claims and FIN accounting ledger expense journal entries. |
| `Customer.js` | **Unified** | Supports KT CRM leads-to-customers pipeline and FIN accounting ledger accounts with GSTIN/PAN and credit limits. |
| `Notification.js` | **Unified** | Combined sender/receiver model with companyId, type, read status, and metadata payload. |
| *Finance Specific (26 models)* | **Preserved** | `AccountTransfer`, `Alert`, `ApprovalConfig`, `ApprovalTask`, `Asset`, `AuditLog`, `BankAccount`, `BankReconciliation`, `ChartOfAccount`, `CreditNote`, `DebitNote`, `FinancialYear`, `GSTReturn`, `Invoice`, `JournalEntry`, `Payment`, `Product`, `Purchase`, `PurchaseOrder`, `PurchaseReturn`, `Reminder`, `ReminderConfig`, `Salary`, `Supplier`, `SupplierPayment`, `Tax`. |
| *KT Specific (58 models)* | **Preserved** | `AdjustmentRequest`, `Application`, `Attendance`, `Candidate`, `Client`, `ClientFeedback`, `ClientMeeting`, `Contact`, `DailyReport`, `DailyReportComment`, `Deliverable`, `Document`, `EmployeeDocument`, `EmployeeHistory`, `EmployeePerformance`, `File`, `FileVersion`, `FollowUp`, `Holiday`, `InactivityEvent`, `Income`, `Interview`, `InterviewRound`, `Job`, `Lead`, `Leave`, `LeaveBalance`, `MilestoneProgress`, `MonitoringSettings`, `Offer`, `Payroll`, `Payslip`, `Permission`, `Policy`, `Portfolio`, `Position`, `Project`, `ProjectAnalytics`, `ProjectDocument`, `ProjectFollowUp`, `ProjectMilestone`, `ProjectStatusLog`, `SalaryStructure`, `Screenshot`, `Session`, `SharedResource`, `Student`, `StudentEducation`, `StudentSkills`, `TaskManagement`, `Team`, `TeamLeadActivity`, `TeamMember`, `Transaction`, `announcement`, `dailyUpdateModel`, `milestoneModel`, `projectModel`, `taskModel`. |

---

## 3. Controllers & Routes Structure
- **Controller Organization**: Controllers coexist cleanly in `KT-BACKEND/controllers/`.
  - KT controllers retain camelCase names (`userControllers.js`, `companyController.js`, `employeeController.js`, etc.).
  - FIN controllers retain dot notation (`auth.controller.js`, `company.controller.js`, `invoice.controller.js`, etc.).
- **Route Organization**:
  - KT routes: `*Routes.js` (e.g. `userRoutes.js`, `companyRoutes.js`, `attendanceRoutes.js`).
  - FIN routes: `*.routes.js` (e.g. `auth.routes.js`, `company.routes.js`, `invoice.routes.js`).
- **Route Mounting**:
  - Express router mounts KT routes and FIN routes concurrently. Overlapping prefixes (e.g. `/api/company`, `/api/department`, `/api/employee`, `/api/expense`, `/api/role`) match exact KT subpaths (`/create`, `/details`, `/addDepartment`, `/all`) first, cascading to FIN REST endpoints (`/`, `/:id`).

---

## 4. Environment Variables Consolidation
The single `.env` in `KT-BACKEND` contains:
```env
PORT=5000
NODE_ENV=production
MONGODB_URI=...
MONGO_URI=...
JWT_SECRET=...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
EMAIL_USER=...
EMAIL_PASS=...
BREVO_API_KEY=...
BREVO_REGISTRATION_TEMPLATE_ID=14
BREVO_FORGOT_PASSWORD_TEMPLATE_ID=16
BREVO_SENDER_EMAIL=...
BREVO_SENDER_NAME=...
EMAILJS_SERVICE_ID=...
EMAILJS_TEMPLATE_ID=...
EMAILJS_PUBLIC_KEY=...
EMAILJS_PRIVATE_KEY=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="..."
ALLOWED_ORIGINS=...
CLIENT_URL=...
```

---

## 5. Conflict Resolution Matrix
1. **Database Connections**:
   - *Conflict*: KT used `mongoose.connect(process.env.MONGODB_URI)` in `server.js`; FIN used `connectDB()` in `config/db.js`.
   - *Resolution*: Unified `config/db.js` connecting to `process.env.MONGODB_URI || process.env.MONGO_URI`, called once during server startup in `server.js`.
2. **Email Services**:
   - *Conflict*: KT used Brevo & Gmail; FIN used EmailJS & SMTP.
   - *Resolution*: Unified `services/email.service.js` with cascading fallback: EmailJS -> Brevo -> Nodemailer -> Mock simulation.
3. **Keep-Alive & Reconcile Services**:
   - *Resolution*: Auto-initialized in `server.js` to reconcile orphaned user references and keep server awake on cloud providers.

# Employee Soft-Deactivation & Data Retention API Documentation

## 1. Overview
The Kevalon Technology HRMS employee management module implements **soft-deactivation with guaranteed related-data retention**.

Rather than permanently deleting employee records from the database, administrative deletions and deactivation requests mark the employee and their corresponding user account as inactive (`isDeactivated: true`, `employeeStatus: 'Inactive'`). All historical records—including attendance logs, payroll and salary histories, approved/pending deductions, leave applications, documents, project tasks, and audit logs—are strictly retained without alteration or cascading deletion.

---

## 2. Key Architecture & Business Rules

### 2.1 Complete Data Retention (Zero-Data-Loss Guarantee)
- **No Cascade Deletion**: Deactivating an employee leaves all linked models intact:
  - Attendance (`models/Attendance.js`)
  - Payroll & Monthly Salary (`models/MonthlySalary.js`, `models/Salary.js`)
  - Employee Deductions (`models/EmployeeDeduction.js`)
  - Leave Applications (`models/Leave.js`)
  - Employee Documents & KYC (`models/EmployeeDocument.js`)
  - Performance Reviews (`models/Performance.js`)
  - Audit Logs (`models/AuditLog.js`)
  - Employee History (`models/EmployeeHistory.js`)
- **Foreign Key Integrity**: The `employeeId` / `userId` references remain intact so authorized administrators and HR personnel can query historical records at any time.

### 2.2 Access Revocation
- **Login Blocking**: Deactivated employees are strictly rejected upon authentication:
  - `POST /api/auth/login` returns `403 Forbidden` (`{"message": "Your account is inactive. Please contact administrator."}`)
  - `POST /api/users/login` returns `403 Forbidden` (`{"message": "Your account is inactive. Please contact administrator."}`)
- **Active Session Invalidation**: The authentication middleware (`middleware/authMiddleware.js` and `middleware/authenticate.js`) verifies the user's and employee's active state on every request. Existing JWT Bearer tokens held by a deactivated user are immediately rejected with `403 Forbidden`. In addition, refresh tokens are revoked upon deactivation.

### 2.3 Safe In-Place Reactivation
- Inactive employees can be reactivated by Admin or HR (`POST /api/employee/:id/reactivate`).
- Reactivation updates the existing `Employee` and `User` records in place without recreating or duplicating any documents or relationships.
- Reactivated accounts immediately regain access with their existing credentials.

### 2.4 Legacy Delete Route Safety
- Existing frontends or scripts invoking legacy deletion endpoints (`DELETE /api/employee/delete/:id`, `DELETE /api/employee/remove/:id`, or `DELETE /api/employee/:id`) are transparently routed to soft deactivation.
- For backward compatibility, the response retains `{ success: true, message: "...", deletedEmployeeId: "<id>", isDeactivated: true }`.

### 2.5 Isolated Super-Admin Hard Deletion
- For exceptional legal or GDPR/compliance requirements where complete physical erasure is mandated, a dedicated endpoint is available: `DELETE /api/employee/hard-delete/:id`.
- Restricted strictly to `Super Admin`.
- Requires explicit confirmation body: `{ "confirmHardDelete": true }`.
- Audit log is immutably generated before hard deletion occurs.

---

## 3. Endpoints Specification

### 3.1 Soft Deactivate Employee
Marks the employee and linked user account inactive, revokes active sessions, and appends history/audit logs.

- **Routes**:
  - `POST /api/employee/:id/deactivate`
  - `PUT /api/employee/:id/deactivate`
  - `PATCH /api/employee/:id/deactivate`
  - `PUT /api/employee/deactivate/:id`
- **Authorization**: `Admin`, `HR`, `Super Admin`
- **URL Parameters**:
  - `id` (string, required): MongoDB `_id` of the `Employee` record.
- **Request Body** (optional):
  ```json
  {
    "reason": "Resigned on 2026-11-01"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Employee deactivated successfully. Historical records, attendance, and payroll data have been preserved.",
    "isDeactivated": true,
    "employeeStatus": "Inactive",
    "deactivatedAt": "2026-11-08T19:00:00.000Z",
    "deletedEmployeeId": "651fbc1234567890abcdef12",
    "data": {
      "_id": "651fbc1234567890abcdef12",
      "employeeId": "KT0042",
      "fullName": "Jane Doe",
      "isDeactivated": true,
      "employeeStatus": "Inactive",
      "status": "INACTIVE",
      "deactivatedAt": "2026-11-08T19:00:00.000Z",
      "deactivationReason": "Resigned on 2026-11-01"
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Self-deactivation attempt or employee is already inactive.
  - `401 Unauthorized`: Missing or invalid Bearer token.
  - `403 Forbidden`: User does not have Admin/HR role.
  - `404 Not Found`: Employee not found.

---

### 3.2 Reactivate Employee
Restores an inactive employee and linked user account back to active status in place.

- **Routes**:
  - `POST /api/employee/:id/reactivate`
  - `PUT /api/employee/:id/reactivate`
  - `PATCH /api/employee/:id/reactivate`
  - `PUT /api/employee/reactivate/:id`
- **Authorization**: `Admin`, `HR`, `Super Admin`
- **URL Parameters**:
  - `id` (string, required): MongoDB `_id` of the `Employee` record.
- **Request Body**: None required.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Employee reactivated successfully.",
    "isDeactivated": false,
    "employeeStatus": "Active",
    "reactivatedAt": "2026-11-08T19:05:00.000Z",
    "data": {
      "_id": "651fbc1234567890abcdef12",
      "employeeId": "KT0042",
      "fullName": "Jane Doe",
      "isDeactivated": false,
      "employeeStatus": "Active",
      "status": "ACTIVE",
      "reactivatedAt": "2026-11-08T19:05:00.000Z"
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Target employee is already active.
  - `401 Unauthorized`: Missing or invalid Bearer token.
  - `403 Forbidden`: User does not have Admin/HR role.
  - `404 Not Found`: Employee not found.

---

### 3.3 List Employees with Active/Inactive Filtering
Retrieves employees with filtering support and explicit active/inactive status metadata.

- **Route**: `GET /api/employee/list` (and `GET /api/employee/all`, `GET /api/employees`)
- **Authorization**: Authenticated Users (`Admin`, `HR`, `Team Lead`, etc.)
- **Query Parameters**:
  - `status`: Filter by status.
    - `active` (default): returns only active employees (`isDeactivated: false`, `employeeStatus: 'Active'`).
    - `inactive`: returns only deactivated employees (`isDeactivated: true` or `employeeStatus: 'Inactive'`).
    - `all`: returns all employees regardless of active/inactive state.
  - `page`, `limit`: Pagination parameters.
  - `search`: Case-insensitive search on name, email, employee ID.
- **Response Format**:
  ```json
  {
    "success": true,
    "employees": [
      {
        "_id": "651fbc1234567890abcdef12",
        "employeeId": "KT0042",
        "firstName": "Jane",
        "lastName": "Doe",
        "email": "jane.doe@kevalon.com",
        "isDeactivated": false,
        "isActive": true,
        "employeeStatus": "Active",
        "status": "ACTIVE"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10
  }
  ```

---

### 3.4 Legacy Delete Routes (Soft-Delete Alias)
Safely delegates to soft deactivation to prevent accidental data loss.

- **Routes**:
  - `DELETE /api/employee/:id`
  - `DELETE /api/employee/delete/:id`
  - `DELETE /api/employee/remove/:id`
- **Authorization**: `Admin`, `HR`, `Super Admin`
- **Response**: Same as `3.1 Soft Deactivate Employee`, preserving backward-compatible fields `deletedEmployeeId` and `success: true`.

---

### 3.5 Exceptional Hard Delete (Super Admin Only)
Permanently removes the employee and user document for strict compliance use cases.

- **Route**: `DELETE /api/employee/hard-delete/:id`
- **Authorization**: `Super Admin` only.
- **Request Body** (mandatory):
  ```json
  {
    "confirmHardDelete": true
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Employee and linked user account permanently hard-deleted by Super Admin.",
    "hardDeleted": true,
    "employeeId": "651fbc1234567890abcdef12"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Missing or false `confirmHardDelete` confirmation in body.
  - `403 Forbidden`: Caller does not possess `super admin` role.
  - `404 Not Found`: Target employee not found.

---

## 4. Model Schema Additions

### Employee Schema (`models/Employee.js`)
```javascript
{
  isDeactivated: { type: Boolean, default: false, index: true },
  deactivatedAt: { type: Date, default: null },
  deactivatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  deactivationReason: { type: String, default: '' },
  reactivatedAt: { type: Date, default: null },
  reactivatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}
```

### User Schema (`models/User.js`)
```javascript
{
  isDeactivated: { type: Boolean, default: false, index: true },
  deactivatedAt: { type: Date, default: null },
  deactivatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reactivatedAt: { type: Date, default: null },
  reactivatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}
```

### EmployeeHistory Schema (`models/EmployeeHistory.js`)
- Action enum updated to include: `"deactivated"` and `"reactivated"`.

### Audit Logging (`services/auditLog.service.js`)
- Operations recorded under `AuditLog` entity `Employee`:
  - `DEACTIVATE`
  - `REACTIVATE`
  - `HARD_DELETE`
- Allowlisted fields include `employeeStatus`, `currentAction`, `isDeactivated`, `deactivatedAt`, `deactivatedBy`, `deactivationReason`, `reactivatedAt`, and `reactivatedBy`.

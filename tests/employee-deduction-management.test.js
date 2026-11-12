const express = require("express");
const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const DeductionMaster = require("../models/DeductionMaster");
const EmployeeDeduction = require("../models/EmployeeDeduction");
const User = require("../models/User");
const Employee = require("../models/Employee");
const Team = require("../models/Team");
const Company = require("../models/Company");
const Branch = require("../models/Branch");
const SalaryStructure = require("../models/SalaryStructure");
const MonthlySalary = require("../models/MonthlySalary");
const AuditLog = require("../models/AuditLog");
const ChartOfAccount = require("../models/ChartOfAccount");

const deductionMasterRoutes = require("../routes/deductionMasterRoutes");
const employeeDeductionRoutes = require("../routes/employeeDeductionRoutes");
const monthlySalaryRoutes = require("../routes/monthlySalaryRoutes");
const salarySlipRoutes = require("../routes/salarySlipRoutes");
const teamLeadRoutes = require("../routes/teamLeadRoutes");
const employeePanelRoutes = require("../routes/employeePanelRoutes");
const reportsRoutes = require("../routes/reports.routes");
const { postSalaryAccountingEntry } = require("../services/deduction.service");

// Mock notifications to prevent external networking
jest.mock("../utils/sendNotification", () => ({ notify: jest.fn().mockResolvedValue(undefined) }));

describe("Centralized Employee Deduction Management Module Test Suite", () => {
  let mongoServer;
  let app;
  let companyId;
  let branchId;
  let adminUser;
  let hrUser;
  let teamLeadUser;
  let employeeUser;
  let outsideTeamUser;
  let caUser;
  let activeSalaryStructure;

  // Track active role for supertest requests
  let currentAuthUser;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    companyId = new mongoose.Types.ObjectId();
    branchId = new mongoose.Types.ObjectId();

    // 1. Create Company and Branch
    await Company.create({
      _id: companyId,
      name: "Kevalon Technology Pvt Ltd",
      companyName: "Kevalon Technology Pvt Ltd",
      email: "info@kevalon.com",
    });

    await Branch.create({
      _id: branchId,
      companyId,
      branchName: "Ahmedabad HQ",
    });

    // 2. Create Users (Admin, HR, Team Lead, Employee, CA)
    adminUser = await User.create({
      name: "Admin User",
      email: "admin@kevalon.com",
      phoneNumber: "9876543210",
      password: "password123",
      role: "admin",
      uniqueID: "ADM-001",
      companyId,
      branchId,
      isApproved: true,
      status: "Active",
    });

    hrUser = await User.create({
      name: "HR Manager",
      email: "hr@kevalon.com",
      phoneNumber: "9876543211",
      password: "password123",
      role: "hr",
      uniqueID: "HR-001",
      companyId,
      branchId,
      isApproved: true,
      status: "Active",
    });

    teamLeadUser = await User.create({
      name: "Engineering Team Lead",
      email: "teamlead@kevalon.com",
      phoneNumber: "9876543212",
      password: "password123",
      role: "team lead",
      uniqueID: "TL0001",
      companyId,
      branchId,
      isApproved: true,
      status: "Active",
    });

    employeeUser = await User.create({
      name: "John Doe",
      email: "john.doe@kevalon.com",
      phoneNumber: "9876543213",
      password: "password123",
      role: "employee",
      uniqueID: "EMP-001",
      companyId,
      branchId,
      isApproved: true,
      status: "Active",
      designation: "Fullstack Developer",
      department: "Engineering",
      joiningDate: new Date("2025-01-01"),
      pan: "ABCDE1234F",
    });

    outsideTeamUser = await User.create({
      name: "Outside Team Employee",
      email: "outside.team@kevalon.com",
      password: "password123",
      role: "employee",
      uniqueID: "EMP-OUTSIDE",
      companyId,
      branchId,
      isApproved: true,
      status: "Active",
    });

    const teamLeadEmployee = await Employee.create({
      userID: teamLeadUser._id,
      firstName: "Engineering",
      lastName: "Lead",
      email: teamLeadUser.email,
      employeeID: "TL0001",
      isTeamLead: true,
    });
    const assignedEmployee = await Employee.create({
      userID: employeeUser._id,
      firstName: "John",
      lastName: "Doe",
      email: employeeUser.email,
      employeeID: "EMP-001",
    });
    await Employee.create({
      userID: outsideTeamUser._id,
      firstName: "Outside",
      lastName: "Employee",
      email: outsideTeamUser.email,
      employeeID: "EMP-OUTSIDE",
    });
    await Team.create({
      name: "Engineering Team",
      teamLeadId: "TL0001",
      teamLeadUser: teamLeadUser._id,
      teamLeadEmployee: teamLeadEmployee._id,
      employees: [assignedEmployee._id],
    });

    caUser = await User.create({
      name: "Chartered Accountant",
      email: "ca@kevalon.com",
      phoneNumber: "9876543214",
      password: "password123",
      role: "ca",
      uniqueID: "CA-001",
      companyId,
      branchId,
      isApproved: true,
      status: "Active",
    });

    // 3. Create Salary Structure for Employee
    // Basic = 30000, HRA = 15000, DA = 5000, Special = 10000 -> Gross = 60000
    // Basic for PF = 35000 (Basic+DA) -> PF = 4200 (12%)
    // ESI = 450 (0.75%), PT = 200 -> Standard deductions = 4850
    activeSalaryStructure = await SalaryStructure.create({
      userId: employeeUser._id,
      employeeId: employeeUser._id,
      companyId,
      branchId,
      basicSalary: 30000,
      hra: 15000,
      dearnessAllowance: 5000,
      specialAllowance: 10000,
      grossSalary: 60000,
      basicForPf: 35000,
      pfDeduction: 4200,
      esicDeduction: 450,
      professionalTax: 200,
      totalDeduction: 4850,
      netSalary: 55150,
      isActive: true,
    });

    // 4. Setup Express App
    app = express();
    app.use(express.json());

    // Role-switching auth middleware for testing
    app.use((req, res, next) => {
      req.user = currentAuthUser || adminUser;
      next();
    });

    app.use("/api/deduction-masters", deductionMasterRoutes);
    app.use("/api/employee-deductions", employeeDeductionRoutes);
    app.use("/api/deductions/master", deductionMasterRoutes);
    app.use("/api/deductions", employeeDeductionRoutes);
    app.use("/api/salaries", monthlySalaryRoutes);
    app.use("/api/salary-slips", salarySlipRoutes);
    app.use("/api/teamLead", teamLeadRoutes);
    app.use("/api/employee-panel", employeePanelRoutes);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
  });

  beforeEach(() => {
    currentAuthUser = adminUser;
  });

  // =========================================================================
  // 1. DEDUCTION MASTER CRUD & RBAC
  // =========================================================================
  describe("1. Deduction Master CRUD & RBAC", () => {
    let loanMasterId;
    let impermissibleMasterId;

    test("1.1 Admin / HR can create valid Deduction Master (with legal permissibility flag)", async () => {
      currentAuthUser = hrUser;

      const res = await request(app)
        .post("/api/deduction-masters")
        .send({
          name: "Company Loan Repayment",
          code: "LOAN_REC",
          category: "LOAN_ADVANCE",
          description: "Monthly recovery of advance loan granted to employee",
          calculationType: "FLAT",
          defaultAmount: 2000,
          isLegallyPermissible: true,
          legalReference: "Payment of Wages Act 1936 Section 7(2)(f)",
          maxDeductionPercent: 50,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe("LOAN_REC");
      expect(res.body.data.isLegallyPermissible).toBe(true);
      loanMasterId = res.body.data._id;

      // Verify audit log
      const audit = await AuditLog.findOne({ actionType: "CREATE_DEDUCTION_MASTER" });
      expect(audit).toBeTruthy();
      expect(audit.module).toBe("HRMS_DEDUCTIONS");
    });

    test("1.2 Prevents duplicate Deduction Master code", async () => {
      currentAuthUser = adminUser;

      const res = await request(app)
        .post("/api/deduction-masters")
        .send({
          name: "Another Loan",
          code: "LOAN_REC",
          category: "LOAN_ADVANCE",
          isLegallyPermissible: true,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    test("1.3 Can create non-legally permissible master (e.g. Disciplinary Arbitrary Fine)", async () => {
      currentAuthUser = adminUser;

      const res = await request(app)
        .post("/api/deduction-masters")
        .send({
          name: "Unauthorized Disciplinary Penalty",
          code: "UNAUTH_PENALTY",
          category: "PENALTY_DAMAGE",
          description: "Arbitrary penalty not conforming to statutory labour limits",
          calculationType: "FLAT",
          defaultAmount: 5000,
          isLegallyPermissible: false,
          legalReference: "Prohibited under Payment of Wages Act Sec 8 without statutory notice",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isLegallyPermissible).toBe(false);
      impermissibleMasterId = res.body.data._id;
    });

    test("1.4 CA and Accountant roles can view Deduction Masters but cannot create or edit them", async () => {
      currentAuthUser = caUser;

      // GET is allowed for CA
      const getRes = await request(app).get("/api/deduction-masters");
      expect(getRes.status).toBe(200);
      expect(getRes.body.count).toBeGreaterThanOrEqual(2);

      // POST is forbidden for CA
      const postRes = await request(app)
        .post("/api/deduction-masters")
        .send({ name: "Audit Deduction", code: "AUDIT_DED", isLegallyPermissible: true });
      expect(postRes.status).toBe(403);
    });

    test("1.5 Admin can update Deduction Master", async () => {
      currentAuthUser = adminUser;

      const res = await request(app)
        .put(`/api/deduction-masters/${loanMasterId}`)
        .send({
          description: "Updated Loan Repayment Description with specific recovery terms",
          defaultAmount: 2500,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.defaultAmount).toBe(2500);
      expect(res.body.data.description).toContain("Updated Loan Repayment");
    });
  });

  // =========================================================================
  // 2. EMPLOYEE DEDUCTION CRUD & MANDATORY IDENTIFIERS
  // =========================================================================
  describe("2. Employee Deduction CRUD & Mandatory Identifiers", () => {
    let loanMaster;
    let impermissibleMaster;
    let approvedDeductionRecord;

    beforeAll(async () => {
      loanMaster = await DeductionMaster.findOne({ code: "LOAN_REC" });
      impermissibleMaster = await DeductionMaster.findOne({ code: "UNAUTH_PENALTY" });
    });

    test("2.1 Requires mandatory fields: employeeId, deductionMasterId, teamLeadId", async () => {
      currentAuthUser = hrUser;

      // Missing employeeId
      const res1 = await request(app)
        .post("/api/employee-deductions")
        .send({
          teamLeadId: "TL0001",
          deductionMasterId: loanMaster._id,
          month: 11,
          year: 2026,
          amount: 2500,
        });
      expect(res1.status).toBe(400);
      expect(res1.body.message).toMatch(/employeeId/i);

      // Missing deductionMasterId
      const res2 = await request(app)
        .post("/api/employee-deductions")
        .send({
          employeeId: employeeUser._id,
          teamLeadId: "TL0001",
          month: 11,
          year: 2026,
          amount: 2500,
        });
      expect(res2.status).toBe(400);
      expect(res2.body.message).toMatch(/deductionMasterId/i);
    });

    test("2.2 Successfully creates Employee Deduction with mandatory fields & auto-generated unique Record ID", async () => {
      currentAuthUser = hrUser;

      const res = await request(app)
        .post("/api/employee-deductions")
        .send({
          employeeId: employeeUser._id,
          teamLeadId: "TL0001",
          deductionMasterId: loanMaster._id,
          month: 11,
          year: 2026,
          amount: 2500,
          reason: "Approved laptop advance EMI 1 of 5",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deductionRecordId).toMatch(/^DED-202611-\d{4}$/);
      expect(res.body.data.employeeId._id.toString()).toBe(employeeUser._id.toString());
      expect(res.body.data.teamLeadId).toBe("TL0001");
      expect(res.body.data.status).toBe("Pending");
      expect(res.body.data.isLocked).toBe(false);
      expect(res.body.data.approvalHistory.length).toBe(1);
      expect(res.body.data.approvalHistory[0].status).toBe("Pending");

      approvedDeductionRecord = res.body.data;
    });

    test("2.3 DUPLICATE PROTECTION: Blocks duplicate active deduction for same employee, master, month and year", async () => {
      currentAuthUser = hrUser;

      const res = await request(app)
        .post("/api/employee-deductions")
        .send({
          employeeId: employeeUser._id,
          teamLeadId: "TL0001",
          deductionMasterId: loanMaster._id,
          month: 11,
          year: 2026,
          amount: 2500,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists for this employee/i);
    });

    test("2.4 DUPLICATE PROTECTION: Blocks duplicate explicit deductionRecordId", async () => {
      currentAuthUser = hrUser;

      const res = await request(app)
        .post("/api/employee-deductions")
        .send({
          deductionRecordId: approvedDeductionRecord.deductionRecordId,
          employeeId: employeeUser._id,
          teamLeadId: "TL0001",
          deductionMasterId: loanMaster._id,
          month: 12,
          year: 2026,
          amount: 2500,
        });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already exists/i);
    });

    test("2.5 Create non-legally permissible employee deduction (flagged as false)", async () => {
      currentAuthUser = adminUser;

      const res = await request(app)
        .post("/api/employee-deductions")
        .send({
          employeeId: employeeUser._id,
          teamLeadId: "TL0001",
          deductionMasterId: impermissibleMaster._id,
          month: 11,
          year: 2026,
          amount: 5000,
          reason: "Disciplinary charge (impermissible)",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.isLegallyPermissible).toBe(false);
    });
  });

  // =========================================================================
  // 3. APPROVAL WORKFLOW & APPROVAL HISTORY AUDIT TRAIL
  // =========================================================================
  describe("3. Approval Workflow & Approval History Audit Trail", () => {
    let pendingDeductionId;

    beforeAll(async () => {
      const deduction = await EmployeeDeduction.findOne({ status: "Pending", isLegallyPermissible: true });
      pendingDeductionId = deduction._id;
    });

    test("3.1 Team Lead or Admin approves deduction and records approval history", async () => {
      currentAuthUser = teamLeadUser;

      const res = await request(app)
        .post(`/api/employee-deductions/${pendingDeductionId}/approve`)
        .send({ comments: "Verified by Team Lead against approved asset agreement" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("Approved");
      expect(res.body.data.approvedAt).toBeTruthy();

      // Check approval history
      const history = res.body.data.approvalHistory;
      expect(history.length).toBe(2);
      expect(history[1].status).toBe("Approved");
      expect(history[1].previousStatus).toBe("Pending");
      expect(history[1].comments).toContain("Verified by Team Lead");
    });

    test("3.2 Rejection flow logs rejectionReason and appends to history", async () => {
      currentAuthUser = adminUser;

      // Create a test deduction to reject
      const loanMaster = await DeductionMaster.findOne({ code: "LOAN_REC" });
      const newDed = await EmployeeDeduction.create({
        deductionRecordId: "DED-REJECT-TEST-001",
        employeeId: employeeUser._id,
        teamLeadId: "TL0001",
        deductionMasterId: loanMaster._id,
        month: 10,
        year: 2026,
        amount: 1500,
        status: "Pending",
        approvalHistory: [{ status: "Pending", comments: "Initial submission" }],
      });

      const res = await request(app)
        .post(`/api/employee-deductions/${newDed._id}/reject`)
        .send({ reason: "Disputed by employee: loan was already settled" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("Rejected");
      expect(res.body.data.rejectionReason).toContain("loan was already settled");

      const updated = await EmployeeDeduction.findById(newDed._id);
      expect(updated.approvalHistory[updated.approvalHistory.length - 1].status).toBe("Rejected");
    });
  });

  // =========================================================================
  // 4. PAYROLL CALCULATION INTEGRATION: ONLY APPROVED & LEGALLY PERMISSIBLE
  // =========================================================================
  describe("4. Payroll Calculation Integration & Legal Compliance", () => {
    test("4.1 Payroll Preview excludes pending, rejected, and legally impermissible deductions", async () => {
      currentAuthUser = hrUser;

      // We have:
      // - 1 Approved & Permissible deduction (Rs. 2500) for Month 11/2026
      // - 1 Pending & Impermissible deduction (Rs. 5000) for Month 11/2026
      const res = await request(app)
        .post("/api/deductions/preview")
        .send({
          employeeId: employeeUser._id,
          month: 11,
          year: 2026,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { customDeductions, summary } = res.body.data;
      // Approved and permissible should be exactly Rs. 2500
      expect(customDeductions.totalApprovedCustomDeductions).toBe(2500);
      expect(customDeductions.approvedAndPermissible.length).toBe(1);
      expect(customDeductions.approvedAndPermissible[0].amount).toBe(2500);

      // Excluded should contain the impermissible one
      expect(customDeductions.excludedDeductions.length).toBeGreaterThanOrEqual(1);

      // Net salary = Gross (60000) - Statutory (4850) - Approved Custom (2500) = 52650
      expect(summary.grossSalary).toBe(60000);
      expect(summary.totalDeductions).toBe(4850 + 2500); // 7350
      expect(summary.netSalary).toBe(60000 - 7350); // 52650
    });

    test("4.2 Monthly Salary Generation (/api/salaries/generate) automatically applies approved deduction and locks it", async () => {
      currentAuthUser = adminUser;

      const res = await request(app)
        .post("/api/salaries/generate")
        .send({
          companyId,
          branchId,
          month: 11,
          year: 2026,
          employeeId: employeeUser._id,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const salaryDoc = res.body.data[0];
      expect(salaryDoc.customDeductions).toBe(2500);
      expect(salaryDoc.customDeductionsList.length).toBe(1);
      expect(salaryDoc.customDeductionsList[0].amount).toBe(2500);
      expect(salaryDoc.totalDeduction).toBe(4850 + 2500); // 7350
      expect(salaryDoc.netSalary).toBe(60000 - 7350); // 52650

      // PAYROLL LOCKING VERIFICATION
      const approvedDed = await EmployeeDeduction.findOne({
        employeeId: employeeUser._id,
        month: 11,
        year: 2026,
        status: "Approved",
      });
      expect(approvedDed.isLocked).toBe(true);
      expect(approvedDed.monthlySalaryId.toString()).toBe(salaryDoc._id.toString());
    });
  });

  // =========================================================================
  // 5. PAYROLL LOCKING PROTECTION
  // =========================================================================
  describe("5. Payroll Locking Protection", () => {
    let lockedDeduction;

    beforeEach(async () => {
      lockedDeduction = await EmployeeDeduction.findOne({
        employeeId: employeeUser._id,
        month: 11,
        year: 2026,
        isLocked: true,
      });
    });

    test("5.1 PUT /api/employee-deductions/:id BLOCKS modification of locked deduction", async () => {
      currentAuthUser = adminUser;

      const res = await request(app)
        .put(`/api/employee-deductions/${lockedDeduction._id}`)
        .send({ amount: 9999, reason: "Unauthorized tamper attempt" });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/locked to an active\/finalized payroll/i);
    });

    test("5.2 DELETE /api/employee-deductions/:id BLOCKS deletion of locked deduction", async () => {
      currentAuthUser = adminUser;

      const res = await request(app)
        .delete(`/api/employee-deductions/${lockedDeduction._id}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/locked to a finalized\/approved payroll/i);
    });

    test("5.3 Admin can explicitly unlock deduction via /api/employee-deductions/:id/unlock", async () => {
      currentAuthUser = adminUser;

      const res = await request(app)
        .post(`/api/employee-deductions/${lockedDeduction._id}/unlock`)
        .send({ reason: "Auditor approved adjustment" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isLocked).toBe(false);

      // Re-lock for remaining tests
      await EmployeeDeduction.findByIdAndUpdate(lockedDeduction._id, { isLocked: true });
    });
  });

  // =========================================================================
  // 6. PAYSLIP HTML & PDF PRESENTATION INTEGRATION
  // =========================================================================
  describe("6. Payslip HTML & PDF Presentation Integration", () => {
    let monthlySalaryDoc;

    beforeAll(async () => {
      monthlySalaryDoc = await MonthlySalary.findOne({
        employeeId: employeeUser._id,
        month: 11,
        year: 2026,
      });
    });

    test("6.1 GET /api/salary-slips/:salaryId renders HTML with itemized custom deductions", async () => {
      currentAuthUser = employeeUser;

      const res = await request(app)
        .get(`/api/salary-slips/${monthlySalaryDoc._id}`);

      expect(res.status).toBe(200);
      expect(res.text).toContain("Company Loan Repayment");
      expect(res.text).toContain("Rs. 2,500.00");
      expect(res.text).toContain("Total Deductions (B)");
    });

    test("6.2 GET /api/salary-slips/pdf/:salaryId generates PDF with itemized deductions", async () => {
      currentAuthUser = employeeUser;

      const res = await request(app)
        .get(`/api/salary-slips/pdf/${monthlySalaryDoc._id}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
    });
  });

  // =========================================================================
  // 7. REPORTS, AUDIT LOGS, MOBILE & ACCOUNTING INTEGRATION
  // =========================================================================
  describe("7. Reports, Audit Logs, Mobile & Accounting Integration", () => {
    test("7.1 GET /api/deductions/report provides aggregated category breakdown and total deducted", async () => {
      currentAuthUser = caUser;

      const res = await request(app)
        .get("/api/deductions/report?month=11&year=2026");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.reportSummary.approvedAmount).toBe(2500);
      expect(res.body.reportSummary.byCategory.LOAN_ADVANCE).toBe(2500);
    });

    test("7.2 Mobile / Web Employee portal: GET /api/employee-panel/deductions returns employee's records", async () => {
      currentAuthUser = employeeUser;

      const res = await request(app)
        .get("/api/employee-panel/deductions?month=11&year=2026");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
      const amounts = res.body.data.map((d) => d.amount);
      expect(amounts).toContain(2500);
    });

    test("7.3 Team Lead Portal: GET /api/teamLead/deductions returns team members' deductions", async () => {
      currentAuthUser = teamLeadUser;

      await EmployeeDeduction.create({
        deductionRecordId: `DED-TEAM-${Date.now()}`,
        employeeId: employeeUser._id,
        teamLeadId: "TL0001",
        deductionMasterId: new mongoose.Types.ObjectId(),
        month: 11,
        year: 2026,
        amount: 125,
      });
      await EmployeeDeduction.create({
        deductionRecordId: `DED-OUTSIDE-${Date.now()}`,
        employeeId: outsideTeamUser._id,
        teamLeadId: "OTHER-TL",
        deductionMasterId: new mongoose.Types.ObjectId(),
        month: 11,
        year: 2026,
        amount: 999,
      });

      const listRes = await request(app)
        .get("/api/employee-deductions?month=11&year=2026");

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThan(0);
      expect(listRes.body.data.every((deduction) =>
        String(deduction.employeeId?._id || deduction.employeeId) === String(employeeUser._id)
      )).toBe(true);

      const res = await request(app)
        .get("/api/teamLead/deductions?month=11&year=2026");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.every((deduction) =>
        String(deduction.employeeId?._id || deduction.employeeId) === String(employeeUser._id)
      )).toBe(true);
    });

    test("7.4 Authorized Accounting Entry helper creates journal entry with deduction lines", async () => {
      // Setup COA accounts
      const expenseCoa = await ChartOfAccount.create({
        companyId,
        name: "Salaries & Wages Expense",
        code: "EXP-SAL-001",
        type: "Expense",
        isActive: true,
      });

      const payableCoa = await ChartOfAccount.create({
        companyId,
        name: "Salary Payable",
        code: "LIA-SAL-001",
        type: "Liability",
        isActive: true,
      });

      let salaryDoc = await MonthlySalary.findOne({ employeeId: employeeUser._id, month: 11, year: 2026 });
      if (!salaryDoc) {
        salaryDoc = await MonthlySalary.create({
          companyId,
          branchId,
          employeeId: employeeUser._id,
          userId: employeeUser._id,
          month: 11,
          year: 2026,
          grossSalary: 60000,
          totalDeduction: 7350,
          customDeductions: 2500,
          netSalary: 52650,
          status: "Approved",
        });
      }
      const journalEntry = await postSalaryAccountingEntry(salaryDoc._id, adminUser._id);

      expect(journalEntry).toBeTruthy();
      expect(journalEntry.lines.length).toBeGreaterThanOrEqual(2);

      // Verify debit gross and credit net & deductions
      const debits = journalEntry.lines.reduce((s, l) => s + (l.debit || 0), 0);
      const credits = journalEntry.lines.reduce((s, l) => s + (l.credit || 0), 0);
      expect(debits).toBe(credits); // Balancing Dr = Cr
    });

    test("7.5 Audit logs verify all actions were recorded into AuditLog collection", async () => {
      const logs = await AuditLog.find({ module: "HRMS_DEDUCTIONS" });
      expect(logs.length).toBeGreaterThanOrEqual(4);

      const actionTypes = logs.map((l) => l.actionType);
      expect(actionTypes).toContain("CREATE_DEDUCTION_MASTER");
      expect(actionTypes).toContain("CREATE_EMPLOYEE_DEDUCTION");
      expect(actionTypes).toContain("APPROVE_EMPLOYEE_DEDUCTION");
    });
  });
});

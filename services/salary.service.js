const S = require('../models/Salary');
const FY = require('../models/FinancialYear');
const B = require('../models/Branch');
const COA = require('../models/ChartOfAccount');
const J = require('./journalEntry.service');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { createNotification } = require('./notification.service');

const fail = (m, c = 400, e) => Object.assign(new Error(m), { statusCode: c, errorCode: e });

exports.create = async (d, u) => {
  const fy = await FY.findOne({ _id: d.financialYearId, companyId: d.companyId, branchId: d.branchId });
  const b = await B.findOne({ _id: d.branchId, companyId: d.companyId });
  if (!fy || !b) throw fail('Branch or financial year does not belong to the company', 400, 'INVALID_BRANCH_FINANCIAL_YEAR');
  if (new Date(d.periodStart) > new Date(d.periodEnd)) throw fail('periodStart cannot be after periodEnd', 400, 'INVALID_PERIOD');
  if (Math.abs(d.netPayable - (d.grossSalary - d.deductions)) > .01) throw fail('netPayable is inconsistent', 400, 'INVALID_TOTALS');
  const accounts = await COA.find({ _id: { $in: [d.salaryExpenseAccountId, d.payableAccountId] }, companyId: d.companyId, isActive: true, isGroup: false });
  if (accounts.length !== 2) throw fail('Salary accounts not found', 404, 'ACCOUNT_NOT_FOUND');
  const x = await S.create({ ...d, periodStart: new Date(d.periodStart), periodEnd: new Date(d.periodEnd), createdBy: u, updatedBy: u });
  const j = await J.createJournalEntry({
    companyId: d.companyId,
    financialYearId: d.financialYearId,
    entryDate: d.periodEnd,
    reference: d.reference || 'SALARY',
    narration: 'Salary accrual',
    lines: [
      { accountId: d.salaryExpenseAccountId, debit: d.grossSalary, credit: 0 },
      { accountId: d.payableAccountId, debit: 0, credit: d.netPayable },
      ...(d.deductions ? [{ accountId: d.payableAccountId, debit: 0, credit: d.deductions, remarks: 'Deductions' }] : [])
    ]
  }, u);
  x.journalEntryId = j._id;
  await x.save();
  createNotification({
    userId: u,
    companyId: d.companyId,
    type: 'SALARY_ACCROUED',
    title: 'Salary Slip Processed',
    message: `Salary of ₹${d.netPayable} for period ending ${new Date(d.periodEnd).toLocaleDateString()} has been processed.`,
    channel: 'PUSH',
    meta: { salaryId: x._id.toString() }
  }).catch(() => {});
  return x;
};

exports.list = async (companyId, q) => {
  const salaries = await S.find({
    companyId,
    branchId: q.branchId,
    ...(q.financialYearId ? { financialYearId: q.financialYearId } : {})
  }).sort({ periodEnd: -1 }).lean();

  const empIds = salaries.map(s => s.employeeId).filter(Boolean);

  const [employees, users] = await Promise.all([
    Employee.find({ _id: { $in: empIds } }).lean(),
    User.find({ _id: { $in: empIds } }).lean()
  ]);

  const empMap = new Map(employees.map(e => [e._id.toString(), e]));
  const userMap = new Map(users.map(u => [u._id.toString(), u]));

  return salaries.map(s => {
    const empIdStr = s.employeeId ? s.employeeId.toString() : '';
    let employeeName = '';
    const emp = empMap.get(empIdStr);
    if (emp) {
      employeeName = [emp.firstName, emp.middleName, emp.lastName]
        .filter(Boolean)
        .join(' ');
    } else {
      const usr = userMap.get(empIdStr);
      if (usr) {
        employeeName = usr.name;
      }
    }
    return {
      ...s,
      employeeName
    };
  });
};

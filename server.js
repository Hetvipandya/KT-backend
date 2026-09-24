const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const pino = require('pino');

const { connectDB, disconnectDB } = require('./config/db');
const { initKeepAlive } = require('./services/keepAlive.service');
const { cleanupAllOrphanedUsers } = require('./services/reconcile.service');

const isDev = (process.env.NODE_ENV || 'development') === 'development';
const logger = pino({
  transport: isDev ? { target: 'pino-pretty' } : undefined
});

const app = express();

// ================= TRUST PROXY =================
app.set('trust proxy', true);

// ================= SECURITY & PERFORMANCE =================
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "*"],
      connectSrc: ["'self'", "*"],
    },
  },
}));
app.use(compression());

// ================= AUTO CREATE UPLOAD FOLDERS =================
const uploadFolders = [
  path.join(__dirname, 'uploads'),
  path.join(__dirname, 'uploads', 'employees'),
  path.join(__dirname, 'uploads', 'tasks'),
  path.join(__dirname, 'uploads', 'file-management'),
];

uploadFolders.forEach((folder) => {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
});

// ================= CORS CONFIGURATION =================
const rawAllowedOrigins = process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173,http://localhost:5000';
const allowedOrigins = rawAllowedOrigins.split(',').map((o) => o.trim());

const corsOptionsDelegate = (req, callback) => {
  let corsOptions = { credentials: true };

  // Always allow reset password web forms
  if (req.path && req.path.includes('/reset-password')) {
    corsOptions.origin = true;
    return callback(null, corsOptions);
  }

  const origin = req.header('Origin');
  if (!origin) {
    corsOptions.origin = true;
  } else {
    const host = req.header('x-forwarded-host') || req.get('host');
    const isSameHost = host && origin.includes(host);

    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*') || isSameHost) {
      corsOptions.origin = true;
    } else {
      corsOptions.origin = true; // Permissive for mobile apps / local testing
    }
  }
  callback(null, corsOptions);
};

app.use(cors(corsOptionsDelegate));

// ================= BODY PARSERS =================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ================= STATIC FILES =================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ================= REQUEST LOGGER =================
app.use((req, res, next) => {
  logger.info({
    method: req.method,
    url: req.originalUrl,
    ip: req.ip
  }, `Incoming: ${req.method} ${req.originalUrl}`);
  next();
});

// ============================================================
// ROUTES: KT-BACKEND
// ============================================================
const ktUserRoutes = require('./routes/userRoutes');
const ktRoleRoutes = require('./routes/roleRoutes');
const ktCompanyRoutes = require('./routes/companyRoutes');
const ktDepartmentRoutes = require('./routes/departmentRoutes');
const ktTeamRoutes = require('./routes/teamRoutes');
const ktEmployeeRoutes = require('./routes/employeeRoutes');
const ktStudentRoutes = require('./routes/studentRoutes');
const ktRecruitmentRoutes = require('./routes/recruitmentRoutes');
const ktInterviewRoundRoutes = require('./routes/interviewRoundRoutes');
const ktAttendanceRoutes = require('./routes/attendanceRoutes');
const ktLeaveRoutes = require('./routes/leaveRoutes');
const ktProjectRoutes = require('./routes/projectRoutes');
const ktTaskManagementRoutes = require('./routes/taskManagementRoutes');
const ktCrmRoutes = require('./routes/crmRoutes');
const ktPayrollRoutes = require('./routes/payrollRoutes');
const ktExpenseRoutes = require('./routes/expenseRoutes');
const ktDocumentRoutes = require('./routes/documentRoutes');
const ktNotificationRoutes = require('./routes/notificationRoutes');
const ktProjectManagementRoutes = require('./routes/projectManagementRoutes');
const ktDailyReportRoutes = require('./routes/dailyReportRoutes');
const ktTeamLeadRoutes = require('./routes/teamLeadRoutes');
const ktProjectFollowUpRoutes = require('./routes/projectFollowUpRoutes');
const ktProjectAnalyticsRoutes = require('./routes/projectMonitoringRoutes');
const ktFileManagementRoutes = require('./routes/fileManagementRoutes');
const ktMilestoneRoutes = require('./routes/milestoneRoutes');
const ktClientProjectRoutes = require('./routes/clientProjectRoutes');
const ktHolidayRoutes = require('./routes/holidayRoutes');
const ktAppRoutes = require('./routes/appRoutes');
const ktContactRoutes = require('./routes/contactRoutes');
const ktPositionRoutes = require('./routes/positionRoutes');
const ktPortfolioRoutes = require('./routes/portfolioRoutes');
const ktAdjustmentRequestRoutes = require('./routes/adjustmentRequestRoutes');
const ktPerformanceRoutes = require('./routes/performanceRoutes');
const ktEmployeePanelRoutes = require('./routes/employeePanelRoutes');

// ============================================================
// ROUTES: FIN-BACKEND
// ============================================================
const finAuthRoutes = require('./routes/auth.routes');
const finCompanyRoutes = require('./routes/company.routes');
const finBranchRoutes = require('./routes/branch.routes');
const finFinancialYearRoutes = require('./routes/financialYear.routes');
const finCoaRoutes = require('./routes/coa.routes');
const finBankAccountRoutes = require('./routes/bankAccount.routes');
const finCustomerRoutes = require('./routes/customer.routes');
const finProductRoutes = require('./routes/product.routes');
const finAuditLogRoutes = require('./routes/auditLog.routes');
const finRoleRoutes = require('./routes/role.routes');
const finUserRoutes = require('./routes/user.routes');
const finTaxRoutes = require('./routes/tax.routes');
const finGstRoutes = require('./routes/gst.routes');
const finCaPanelRoutes = require('./routes/caPanel.routes');
const finReportsRoutes = require('./routes/reports.routes');
const finJournalEntryRoutes = require('./routes/journalEntry.routes');
const finLedgerRoutes = require('./routes/ledger.routes');
const finInvoiceRoutes = require('./routes/invoice.routes');
const finPaymentRoutes = require('./routes/payment.routes');
const finSupplierRoutes = require('./routes/supplier.routes');
const finPurchaseOrderRoutes = require('./routes/purchaseOrder.routes');
const finPurchaseRoutes = require('./routes/purchase.routes');
const finPaySupplierRoutes = require('./routes/paySupplier.routes');
const finExpenseRoutes = require('./routes/expense.routes');
const finSalaryRoutes = require('./routes/salary.routes');
const finGstReturnRoutes = require('./routes/gstReturn.routes');
const finDepartmentRoutes = require('./routes/department.routes');
const finEmployeeRoutes = require('./routes/employee.routes');
const finAssetRoutes = require('./routes/asset.routes');
const finAdminDashboardRoutes = require('./routes/adminDashboard.routes');
const finNotificationRoutes = require('./routes/notification.routes');
const finCreditNoteRoutes = require('./routes/creditNote.routes');
const finDebitNoteRoutes = require('./routes/debitNote.routes');
const finApprovalRoutes = require('./routes/approval.routes');
const authenticate = require('./middleware/authenticate');

// ============================================================
// MOUNT ROUTES (PRESERVING 100% OF KT AND FIN ENDPOINTS)
// ============================================================

// Health checks
app.get(['/', '/health', '/api/ping'], (req, res) => {
  res.status(200).json({
    success: true,
    message: '🚀 Unified Kevalon KT HRMS + Finance Backend Running Successfully',
    timestamp: new Date().toISOString(),
    status: 'HEALTHY'
  });
});

app.get('/reset-password', require('./controllers/userControllers').renderResetPasswordPage);

// FIN Authentication & User Management
app.use('/api/auth', finAuthRoutes);
app.use('/api/user', finUserRoutes);

// KT Users & Employee Panel
app.use('/api/users', ktUserRoutes);
app.use('/api/employee-panel', ktEmployeePanelRoutes);
app.use('/api/performance', ktPerformanceRoutes);
app.use('/api/adjustment', ktAdjustmentRequestRoutes);
app.use('/api/portfolio', ktPortfolioRoutes);
app.use('/api/position', ktPositionRoutes);
app.use('/api/contact', ktContactRoutes);
app.use('/api/application', ktAppRoutes);
app.use('/api/holiday', ktHolidayRoutes);
app.use('/api/team', ktTeamRoutes);
app.use('/api/student', ktStudentRoutes);
app.use('/api/recruitment', ktRecruitmentRoutes);
app.use('/api/interviewRound', ktInterviewRoundRoutes);
app.use('/api/attendance', ktAttendanceRoutes);
app.use('/api/leave', ktLeaveRoutes);
app.use('/api/projectManage', ktProjectRoutes);
app.use('/api/task', ktTaskManagementRoutes);
app.use('/api/crm', ktCrmRoutes);
app.use('/api/payroll', ktPayrollRoutes);
app.use('/api/document', ktDocumentRoutes);
app.use('/api/project', ktProjectManagementRoutes);
app.use('/api/dailyUpdate', ktDailyReportRoutes);
app.use('/api/teamLead', ktTeamLeadRoutes);
app.use('/api/followup', ktProjectFollowUpRoutes);
app.use('/api/projectAnalytics', ktProjectAnalyticsRoutes);
app.use('/api/fileManagement', ktFileManagementRoutes);
app.use('/api/milestone', ktMilestoneRoutes);
app.use('/api/client', ktClientProjectRoutes);

// Overlapping routes: KT endpoints first, followed by FIN RESTful endpoints
app.use('/api/company', ktCompanyRoutes);
app.use('/api/company', finCompanyRoutes);

app.use('/api/department', ktDepartmentRoutes);
app.use('/api/department', finDepartmentRoutes);

app.use('/api/employee', ktEmployeeRoutes);
app.use('/api/employee', finEmployeeRoutes);

app.use('/api/expense', ktExpenseRoutes);
app.use('/api/expense', finExpenseRoutes);

app.use('/api/role', ktRoleRoutes);
app.use('/api/role', finRoleRoutes);

// FIN Specific Routes
app.use('/api/branch', finBranchRoutes);
app.use('/api/financial-year', finFinancialYearRoutes);
app.use('/api/coa', finCoaRoutes);
app.use('/api/bank-account', finBankAccountRoutes);
app.use('/api/customer', finCustomerRoutes);
app.use('/api/product', finProductRoutes);
app.use('/api/audit-log', finAuditLogRoutes);
app.use('/api/tax', finTaxRoutes);
app.use('/api/gst', finGstRoutes);
app.use('/api/ca-panel', finCaPanelRoutes);
app.use('/api/reports', finReportsRoutes);
app.use('/api/journal-entry', finJournalEntryRoutes);
app.use('/api/ledger', finLedgerRoutes);
app.use('/api/invoice', finInvoiceRoutes);
app.use('/api/payment', finPaymentRoutes);
app.use('/api/payment', finPaySupplierRoutes);
app.use('/api/supplier', finSupplierRoutes);
app.use('/api/purchase-order', finPurchaseOrderRoutes);
app.use('/api/purchase', finPurchaseRoutes);
app.use('/api/salary', finSalaryRoutes);
app.use('/api/gst/return', finGstReturnRoutes);
app.use('/api/asset', finAssetRoutes);
app.use('/api/admin/dashboard', finAdminDashboardRoutes);
app.use('/api/credit-note', authenticate, finCreditNoteRoutes);
app.use('/api/debit-note', authenticate, finDebitNoteRoutes);
app.use('/api/approval', finApprovalRoutes);

// Notifications (KT & FIN)
app.use('/api/notification', ktNotificationRoutes);
app.use('/api/notifications', ktNotificationRoutes);
app.use('/api', finNotificationRoutes);

// ================= 404 NOT FOUND HANDLER =================
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`
  });
});

// ================= GLOBAL ERROR HANDLER =================
app.use((err, req, res, next) => {
  logger.error(err.stack || err.message);

  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: isDev ? err.stack : undefined
  });
});

// ================= SERVER INITIALIZATION =================
const startServer = async () => {
  try {
    // 1. Connect to single shared MongoDB
    await connectDB();

    // 2. Reconcile any orphaned user references
    try {
      await cleanupAllOrphanedUsers();
    } catch (reconcileErr) {
      logger.warn(`⚠️ Reconcile warning: ${reconcileErr.message}`);
    }

    // 3. Start Listening 
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server Running on Port ${PORT} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);
      initKeepAlive();
    });

    // Graceful shutdown handling
    const gracefulShutdown = () => {
      logger.info('Received shutdown signal, closing server gracefully...');
      server.close(async () => {
        logger.info('Closed all HTTP connections.');
        await disconnectDB();
        process.exit(0);
      });

      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    logger.error(`❌ Server initialization failed: ${error.message}`);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Promise Rejection: ${err && err.message}`);
  if (err && err.stack) logger.error(err.stack);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err && err.message}`);
  if (err && err.stack) logger.error(err.stack);
  process.exit(1);
});

if (require.main === module) {
  startServer();
}

module.exports = app;